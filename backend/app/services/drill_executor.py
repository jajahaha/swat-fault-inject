"""
Drill Executor - 演练执行器

负责：
1. 执行多场景演练（顺序/并行）
2. 每个场景的前置准备 -> 故障注入 -> 清理环境
3. 实时进度追踪
4. 日志收集
"""

import asyncpg
import asyncio
import threading
import psycopg2
import subprocess
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from concurrent.futures import ThreadPoolExecutor

from app.database import async_session, Drill, DrillStep, DatabaseConfig, FaultScenario

# 活跃演练追踪
active_drills: Dict[int, "DrillExecutor"] = {}

# 线程池
sync_executor = ThreadPoolExecutor(max_workers=200)


async def run_sync(func, *args):
    """Run synchronous function in thread pool (Python 3.7 compatible)"""
    loop = asyncio.get_event_loop()
    if args:
        return await loop.run_in_executor(None, lambda: func(*args))
    return await loop.run_in_executor(None, func)


class DrillExecutor:
    """演练执行器 - 执行多场景组合演练"""

    def __init__(self, drill_id: int, db_config: DatabaseConfig, drill_config: dict):
        self.drill_id = drill_id
        self.db_config = db_config
        self.drill_config = drill_config
        self.execution_mode = drill_config.get("execution_mode", "sequential")
        self.steps: List[Dict[str, Any]] = []
        self.running = False
        self.log_lines: List[str] = []
        self._stop_event = threading.Event()
        self.current_step_id: Optional[int] = None

    def _filter_scripts_by_mode(self, scripts: List[Dict], deployment_mode: str) -> List[Dict]:
        """根据部署形态过滤脚本

        Args:
            scripts: 脚本列表
            deployment_mode: 部署形态 (centralized / distributed)

        Returns:
            过滤后的脚本列表，包含 mode=all 和 mode=deployment_mode 的脚本
        """
        if not scripts:
            return []

        filtered = []
        for script in scripts:
            mode = script.get("mode", "all")  # 默认为 all（向后兼容）
            # mode=all 的脚本在所有形态下执行
            # mode=deployment_mode 的脚本只在对应形态下执行
            if mode == "all" or mode == deployment_mode:
                filtered.append(script)
                self.log(f"脚本 '{script.get('description', '未命名')}' 匹配形态: {mode}")

        self.log(f"脚本过滤结果: 原始 {len(scripts)} 个, 过滤后 {len(filtered)} 个")
        return filtered

    async def run(self):
        """执行演练"""
        self.running = True
        self.log("演练开始执行")
        self.log(f"执行模式: {self.execution_mode}")

        try:
            # 获取演练步骤
            async with async_session() as session:
                result = await session.execute(
                    select(DrillStep).where(DrillStep.drill_id == self.drill_id).order_by(DrillStep.step_order)
                )
                steps = result.scalars().all()
                self.steps = [step.to_dict() for step in steps]

            if not self.steps:
                self.log("没有演练步骤，退出")
                await self._update_drill_status("failed")
                return

            self.log(f"共 {len(self.steps)} 个步骤")

            # 根据执行模式执行
            if self.execution_mode == "parallel":
                await self._run_parallel()
            else:
                await self._run_sequential()

            # 完成
            self.log("演练执行完成")
            await self._update_drill_status("completed", 100, current_phase=None)

        except Exception as e:
            self.log(f"演练执行失败: {str(e)}")
            await self._update_drill_status("failed", current_phase=None)
        finally:
            self.running = False
            if self.drill_id in active_drills:
                del active_drills[self.drill_id]

    async def _run_sequential(self):
        """顺序执行步骤"""
        for i, step in enumerate(self.steps):
            if self._stop_event.is_set():
                self.log("收到停止信号，中断演练")
                break

            step_id = step["id"]
            self.current_step_id = step_id

            # 更新当前步骤
            await self._update_drill_progress(
                current_step=i + 1,
                current_phase="preparing",
                progress_percent=int((i / len(self.steps)) * 100)
            )

            self.log(f"开始执行步骤 {i + 1}/{len(self.steps)}")

            # 执行单个步骤（前置准备 -> 故障注入 -> 清理环境）
            await self._execute_step(step_id)

        # 计算总进度
        completed_steps = sum(1 for s in self.steps if self._get_step_status(s["id"]) == "completed")
        total_progress = int((completed_steps / len(self.steps)) * 100)
        await self._update_drill_progress(progress_percent=total_progress)

    async def _run_parallel(self):
        """并行执行步骤"""
        self.log("并行执行所有步骤")

        # 更新状态
        await self._update_drill_progress(current_phase="running")

        # 创建所有步骤的执行任务
        tasks = []
        for step in self.steps:
            task = asyncio.create_task(self._execute_step(step["id"]))
            tasks.append(task)

        # 等待所有任务完成
        await asyncio.gather(*tasks, return_exceptions=True)

        # 计算总进度（并行模式下所有步骤同时完成）
        await self._update_drill_progress(progress_percent=100)

    async def _execute_step(self, step_id: int):
        """执行单个演练步骤"""
        # 获取步骤和场景信息
        async with async_session() as session:
            result = await session.execute(
                select(DrillStep).where(DrillStep.id == step_id)
            )
            step = result.scalar_one_or_none()
            if not step:
                self.log(f"步骤 {step_id} 不存在")
                return

            # 获取场景配置
            scenario_result = await session.execute(
                select(FaultScenario).where(FaultScenario.id == step.scenario_id)
            )
            scenario = scenario_result.scalar_one_or_none()
            if not scenario:
                self.log(f"场景 {step.scenario_id} 不存在")
                await self._update_step_status(step_id, "failed")
                return

            scenario_config = scenario.to_dict()

            # 获取数据库配置的部署形态和最新配置
            db_result = await session.execute(
                select(DatabaseConfig).where(DatabaseConfig.id == self.db_config.id)
            )
            db_config_obj = db_result.scalar_one_or_none()
            if db_config_obj:
                deployment_mode = db_config_obj.deployment_mode
                # 更新 self.db_config 以反映最新配置（包括 connection_method）
                self.db_config = db_config_obj
                self.log(f"数据库部署形态: {deployment_mode}")
                self.log(f"数据库连接方式: {db_config_obj.connection_method}")
            else:
                deployment_mode = "centralized"
                self.log(f"数据库配置不存在，使用默认形态: {deployment_mode}")

        # 1. 前置准备阶段
        self.log(f"步骤 {step.step_order}: 开始前置准备")
        await self._update_step_status(step_id, "preparing", current_phase="preparing", progress_percent=0)

        # 根据部署形态过滤脚本
        filtered_setup_scripts = self._filter_scripts_by_mode(
            scenario_config.get("setup_scripts", []),
            deployment_mode
        )

        setup_success = await self._execute_scripts(
            step_id,
            filtered_setup_scripts,
            "setup",
            scenario_config.get("setup_timeout", 60)
        )

        if not setup_success:
            self.log(f"步骤 {step.step_order}: 前置准备失败")
            await self._update_step_status(step_id, "failed", current_phase=None)
            return

        self.log(f"步骤 {step.step_order}: 前置准备完成")
        await self._update_step_progress(step_id, current_phase="injecting", progress_percent=20)

        # 2. 运行环节（故障注入核心）
        if self._stop_event.is_set():
            self.log(f"步骤 {step.step_order}: 收到停止信号")
            await self._update_step_status(step_id, "stopped", current_phase=None)
            return

        self.log(f"步骤 {step.step_order}: 开始运行环节")
        await self._update_step_progress(step_id, current_phase="injecting", progress_percent=20)

        # 检查是否有自定义运行脚本
        run_scripts = scenario_config.get("run_scripts", [])
        filtered_run_scripts = self._filter_scripts_by_mode(run_scripts, deployment_mode)

        if filtered_run_scripts:
            # 使用自定义运行脚本
            self.log(f"步骤 {step.step_order}: 使用自定义运行脚本")
            run_success = await self._execute_scripts(
                step_id,
                filtered_run_scripts,
                "run",
                scenario_config.get("run_timeout", 120)
            )
        else:
            # 使用默认故障注入（基于 config 参数）
            self.log(f"步骤 {step.step_order}: 使用默认故障注入")
            inject_success = await self._execute_fault_injection(
                step_id,
                scenario_config,
                scenario_config.get("run_timeout", 120)
            )
            run_success = inject_success

        if not run_success:
            self.log(f"步骤 {step.step_order}: 运行环节失败")
            # 即使失败，也尝试清理环境
        else:
            self.log(f"步骤 {step.step_order}: 运行环节完成")
            await self._update_step_progress(step_id, current_phase="cleaning", progress_percent=80)

        # 3. 清理环境阶段
        self.log(f"步骤 {step.step_order}: 开始清理环境")
        await self._update_step_progress(step_id, current_phase="cleaning", progress_percent=80)

        # 根据部署形态过滤清理脚本
        filtered_cleanup_scripts = self._filter_scripts_by_mode(
            scenario_config.get("cleanup_scripts", []),
            deployment_mode
        )

        cleanup_success = await self._execute_scripts(
            step_id,
            filtered_cleanup_scripts,
            "cleanup",
            scenario_config.get("cleanup_timeout", 30)
        )

        if cleanup_success:
            self.log(f"步骤 {step.step_order}: 清理环境完成")
            await self._update_step_status(step_id, "completed", current_phase=None, progress_percent=100)
        else:
            self.log(f"步骤 {step.step_order}: 清理环境失败（环境可能残留）")
            await self._update_step_status(step_id, "completed_with_cleanup_failed", current_phase=None, progress_percent=100)

    async def _execute_scripts(self, step_id: int, scripts: List[Dict], phase: str, timeout: int) -> bool:
        """执行脚本列表（前置准备或清理环境）"""
        if not scripts:
            return True

        for i, script in enumerate(scripts):
            script_type = script.get("type", "sql")
            content = script.get("content", "")
            script_timeout = script.get("timeout", timeout)
            description = script.get("description", f"脚本 {i + 1}")

            self.log(f"执行脚本 ({phase}): {description}")
            self.log(f"类型: {script_type}, 超时: {script_timeout}s")

            try:
                if script_type == "sql":
                    success = await self._execute_sql(content, script_timeout)
                elif script_type == "shell":
                    success = await self._execute_shell(content, script_timeout)
                else:
                    self.log(f"不支持的脚本类型: {script_type}")
                    continue

                if not success:
                    self.log(f"脚本执行失败: {description}")
                    return False

                self.log(f"脚本执行成功: {description}")

            except Exception as e:
                self.log(f"脚本执行异常: {str(e)}")
                return False

        return True

    async def _execute_sql(self, sql: str, timeout: int) -> bool:
        """执行 SQL 脚本"""
        try:
            method = self.db_config.connection_method

            if method == "asyncpg":
                conn = await asyncpg.connect(
                    host=self.db_config.host,
                    port=self.db_config.port,
                    database=self.db_config.database,
                    user=self.db_config.username,
                    password=self.db_config.password,
                    timeout=timeout,
                )
                await conn.execute(sql)
                await conn.close()

            elif method == "psycopg2":
                def run_sql_psycopg2():
                    # GaussDB/openGauss sha256 认证可能需要 SSL 参数
                    connect_params = {
                        "host": self.db_config.host,
                        "port": self.db_config.port,
                        "database": self.db_config.database,
                        "user": self.db_config.username,
                        "password": self.db_config.password,
                    }
                    # 添加 SSL 支持（GaussDB/openGauss sha256 认证需要）
                    if self.db_config.db_type in ("gaussdb", "opengauss"):
                        connect_params["sslmode"] = "prefer"

                    conn = psycopg2.connect(**connect_params)
                    cursor = conn.cursor()
                    cursor.execute(sql)
                    conn.commit()
                    cursor.close()
                    conn.close()

                await run_sync(run_sql_psycopg2)

            elif method == "gsql":
                # 使用 gsql 命令行工具执行 SQL
                success = await self._execute_sql_via_gsql(sql, timeout)
                if not success:
                    return False

            elif method == "jdbc":
                # 使用 JDBC 驱动执行 SQL
                success = await self._execute_sql_via_jdbc(sql, timeout)
                if not success:
                    return False

            else:
                self.log(f"不支持的连接方式: {method}")
                return False

            return True

        except asyncio.TimeoutError:
            self.log(f"SQL 执行超时")
            return False
        except Exception as e:
            self.log(f"SQL 执行错误: {str(e)}")
            return False

    async def _execute_sql_via_gsql(self, sql: str, timeout: int) -> bool:
        """使用 gsql 命令行工具执行 SQL"""
        try:
            # 查找 gsql 可执行文件
            gsql_path = "gsql"
            gsql_paths = [
                "gsql",
                "/usr/bin/gsql",
                "/usr/local/bin/gsql",
                "/opt/gaussdb/bin/gsql",
                "/opt/opengauss/bin/gsql",
                "/home/service/gsql",
            ]
            for path in gsql_paths:
                if os.path.exists(path):
                    gsql_path = path
                    break

            if not os.path.exists(gsql_path):
                self.log(f"gsql 未找到")
                return False

            # 构建 gsql 命令
            cmd = [
                gsql_path,
                "-h", self.db_config.host,
                "-p", str(self.db_config.port),
                "-d", self.db_config.database,
                "-U", self.db_config.username,
                "-W", self.db_config.password,
                "-r",  # 远程连接
                "-c", sql,  # 执行 SQL
            ]

            def run_gsql():
                env = os.environ.copy()
                env["PGPASSWORD"] = self.db_config.password
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    env=env,
                )
                return result

            result = await run_sync(run_gsql)

            if result.returncode != 0:
                self.log(f"gsql 执行失败: {result.stderr}")
                return False

            self.log(f"gsql 执行成功")
            return True

        except subprocess.TimeoutExpired:
            self.log(f"gsql 执行超时")
            return False
        except Exception as e:
            self.log(f"gsql 执行异常: {str(e)}")
            return False

    async def _execute_sql_via_jdbc(self, sql: str, timeout: int) -> bool:
        """使用 JDBC 驱动执行 SQL"""
        try:
            driver_path = self.db_config.jdbc_driver_path
            if not driver_path:
                self.log(f"JDBC 驱动路径未配置")
                return False

            # 检查驱动文件是否存在
            if not os.path.exists(driver_path):
                project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
                full_path = os.path.join(project_root, driver_path)
                if os.path.exists(full_path):
                    driver_path = full_path
                else:
                    self.log(f"JDBC 驱动文件不存在: {driver_path}")
                    return False

            # JDBC 驱动类名
            driver_classes = {
                "postgresql": "org.postgresql.Driver",
                "opengauss": "org.opengauss.Driver",
                "gaussdb": "com.huawei.gaussdb.jdbc.Driver",
            }
            driver_class = driver_classes.get(self.db_config.db_type, "org.postgresql.Driver")

            # JDBC URL with sha256 auth support for GaussDB
            if self.db_config.db_type == "gaussdb":
                # GaussDB 需要指定 authmode=sha256 来支持 sha256 认证
                jdbc_url = f"jdbc:gaussdb://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}?authmode=sha256"
            elif self.db_config.db_type == "opengauss":
                # openGauss 也可能需要 sha256 认证支持
                jdbc_url = f"jdbc:opengauss://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}?authmode=sha256"
            else:
                jdbc_url = f"jdbc:{self.db_config.db_type}://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}"

            def run_jdbc():
                try:
                    import jaydebeapi
                    conn = jaydebeapi.connect(
                        driver_class,
                        jdbc_url,
                        [self.db_config.username, self.db_config.password],
                        driver_path,
                    )
                    # GaussDB JDBC 默认 autoCommit=True，不需要手动 commit
                    # 如果需要手动 commit，先禁用 autoCommit：conn.setAutoCommit(False)
                    cursor = conn.cursor()
                    cursor.execute(sql)
                    # autoCommit 模式下不需要手动 commit
                    cursor.close()
                    conn.close()
                    return True
                except ImportError:
                    raise Exception("jaydebeapi 未安装，请运行: pip install jaydebeapi JPype1")
                except Exception as e:
                    raise e

            await run_sync(run_jdbc)
            self.log(f"JDBC 执行成功")
            return True

        except asyncio.TimeoutError:
            self.log(f"JDBC 执行超时")
            return False
        except Exception as e:
            self.log(f"JDBC 执行异常: {str(e)}")
            return False

    async def _execute_shell(self, command: str, timeout: int) -> bool:
        """执行 Shell 脚本"""
        try:
            def run_shell():
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    timeout=timeout,
                    text=True,
                )
                if result.returncode != 0:
                    self.log(f"Shell stderr: {result.stderr}")
                return result.returncode == 0

            success = await run_sync(run_shell)
            return success

        except subprocess.TimeoutExpired:
            self.log(f"Shell 执行超时")
            return False
        except Exception as e:
            self.log(f"Shell 执行错误: {str(e)}")
            return False

    async def _execute_fault_injection(self, step_id: int, scenario_config: Dict, timeout: int) -> bool:
        """执行故障注入"""
        config = scenario_config.get("config", {})
        concurrency = config.get("concurrency", 50)
        duration = config.get("duration_seconds", 60)
        interval_ms = config.get("interval_ms", 100)
        query = config.get("query_template", "SELECT 1")

        self.log(f"故障注入参数: 并发={concurrency}, 持续={duration}s, 间隔={interval_ms}ms")
        method = self.db_config.connection_method

        try:
            # JDBC 和 gsql 方式使用不同的执行逻辑
            if method == "jdbc":
                self.log(f"使用 JDBC 方式执行故障注入")
                return await self._execute_fault_injection_jdbc(query, concurrency, duration, interval_ms, step_id)

            elif method == "gsql":
                self.log(f"使用 gsql 方式执行故障注入")
                return await self._execute_fault_injection_gsql(query, concurrency, duration, interval_ms, step_id)

            # asyncpg 和 psycopg2 方式使用连接池
            connections = []
            for i in range(concurrency):
                try:
                    if method == "asyncpg":
                        conn = await asyncpg.connect(
                            host=self.db_config.host,
                            port=self.db_config.port,
                            database=self.db_config.database,
                            user=self.db_config.username,
                            password=self.db_config.password,
                        )
                    elif method == "psycopg2":
                        def create_conn():
                            connect_params = {
                                "host": self.db_config.host,
                                "port": self.db_config.port,
                                "database": self.db_config.database,
                                "user": self.db_config.username,
                                "password": self.db_config.password,
                            }
                            if self.db_config.db_type in ("gaussdb", "opengauss"):
                                connect_params["sslmode"] = "prefer"
                            return psycopg2.connect(**connect_params)
                        conn = await run_sync(create_conn)
                    else:
                        self.log(f"故障注入不支持连接方式: {method}")
                        return False

                    connections.append(conn)
                    self.log(f"连接 {i + 1}/{concurrency} 建立")

                except Exception as e:
                    self.log(f"连接 {i + 1} 失败: {str(e)}")

            if not connections:
                self.log("无法建立任何连接")
                return False

            self.log(f"成功建立 {len(connections)} 个连接")

            # 执行查询
            async def run_queries(conn, conn_idx):
                elapsed = 0
                while self.running and not self._stop_event.is_set() and elapsed < duration:
                    try:
                        if method == "asyncpg":
                            await conn.execute(query)
                        elif method == "psycopg2":
                            def exec_query():
                                cursor = conn.cursor()
                                cursor.execute(query)
                                cursor.close()
                            await run_sync(exec_query)

                        step_progress = 20 + int((elapsed / duration) * 60)
                        await self._update_step_progress(step_id, progress_percent=step_progress)

                    except Exception as e:
                        self.log(f"查询错误 (连接{conn_idx}): {str(e)}")

                    await asyncio.sleep(interval_ms / 1000)
                    elapsed += interval_ms / 1000

            # 并发执行
            tasks = []
            for idx, conn in enumerate(connections):
                task = asyncio.create_task(run_queries(conn, idx))
                tasks.append(task)

            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=duration + 10)

            # 关闭连接
            for i, conn in enumerate(connections):
                try:
                    if method == "asyncpg":
                        await conn.close()
                    else:
                        await run_sync(conn.close)
                except Exception as e:
                    self.log(f"关闭连接 {i + 1} 失败: {str(e)}")

            return True

        except asyncio.TimeoutError:
            self.log(f"故障注入超时")
            return False
        except Exception as e:
            self.log(f"故障注入错误: {str(e)}")
            return False

    async def _execute_fault_injection_gsql(self, query: str, concurrency: int, duration: int, interval_ms: int, step_id: int) -> bool:
        """使用 gsql 方式执行故障注入（并发查询）"""
        self.log(f"gsql 故障注入: 并发={concurrency}, 持续={duration}s, 间隔={interval_ms}ms")

        # gsql 每次执行都是独立进程，使用线程池实现并发
        async def run_gsql_worker(worker_idx: int):
            """单个 gsql worker 执行查询"""
            elapsed = 0
            query_count = 0
            error_count = 0

            # 查找 gsql
            gsql_path = "gsql"
            gsql_paths = [
                "gsql",
                "/usr/bin/gsql",
                "/usr/local/bin/gsql",
                "/opt/gaussdb/bin/gsql",
                "/opt/opengauss/bin/gsql",
                "/home/service/gsql",
            ]
            for path in gsql_paths:
                if os.path.exists(path):
                    gsql_path = path
                    break

            if not os.path.exists(gsql_path):
                self.log(f"Worker {worker_idx}: gsql 未找到")
                return False

            while self.running and not self._stop_event.is_set() and elapsed < duration:
                try:
                    def run_single_gsql():
                        env = os.environ.copy()
                        env["PGPASSWORD"] = self.db_config.password
                        cmd = [
                            gsql_path,
                            "-h", self.db_config.host,
                            "-p", str(self.db_config.port),
                            "-d", self.db_config.database,
                            "-U", self.db_config.username,
                            "-W", self.db_config.password,
                            "-r",
                            "-c", query,
                        ]
                        result = subprocess.run(
                            cmd,
                            capture_output=True,
                            text=True,
                            timeout=30,  # 单次查询超时
                            env=env,
                        )
                        return result.returncode == 0, result.stderr

                    success, stderr = await run_sync(run_single_gsql)
                    query_count += 1

                    if not success:
                        error_count += 1
                        if error_count <= 3:  # 只记录前3次错误
                            self.log(f"Worker {worker_idx}: 查询失败 - {stderr[:100]}")

                    # 更新进度（每个 worker 共享进度）
                    step_progress = 20 + int((elapsed / duration) * 60)
                    await self._update_step_progress(step_id, progress_percent=step_progress)

                except subprocess.TimeoutExpired:
                    error_count += 1
                    self.log(f"Worker {worker_idx}: 单次查询超时")
                except Exception as e:
                    error_count += 1
                    self.log(f"Worker {worker_idx}: 查询异常 - {str(e)}")

                await asyncio.sleep(interval_ms / 1000)
                elapsed += interval_ms / 1000

            self.log(f"Worker {worker_idx}: 完成，执行 {query_count} 次，错误 {error_count} 次")
            return error_count < query_count * 0.5  # 错误率小于50%视为成功

        # 创建并发 workers
        tasks = []
        for i in range(concurrency):
            task = asyncio.create_task(run_gsql_worker(i))
            tasks.append(task)

        try:
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=duration + 60)
            self.log(f"gsql 故障注入完成")
            return True
        except asyncio.TimeoutError:
            self.log(f"gsql 故障注入超时")
            return False
        except Exception as e:
            self.log(f"gsql 故障注入错误: {str(e)}")
            return False

    async def _execute_fault_injection_jdbc(self, query: str, concurrency: int, duration: int, interval_ms: int, step_id: int) -> bool:
        """使用 JDBC 方式执行故障注入（并发查询）"""
        self.log(f"JDBC 故障注入: 并发={concurrency}, 持续={duration}s, 间隔={interval_ms}ms")

        driver_path = self.db_config.jdbc_driver_path
        if not driver_path:
            self.log(f"JDBC 驱动路径未配置")
            return False

        # 检查驱动文件
        if not os.path.exists(driver_path):
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            full_path = os.path.join(project_root, driver_path)
            if os.path.exists(full_path):
                driver_path = full_path
            else:
                self.log(f"JDBC 驱动文件不存在: {driver_path}")
                return False

        # JDBC 驱动类名
        driver_classes = {
            "postgresql": "org.postgresql.Driver",
            "opengauss": "org.opengauss.Driver",
            "gaussdb": "com.huawei.gaussdb.jdbc.Driver",
        }
        driver_class = driver_classes.get(self.db_config.db_type, "org.postgresql.Driver")

        # JDBC URL
        if self.db_config.db_type == "gaussdb":
            jdbc_url = f"jdbc:gaussdb://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}?authmode=sha256"
        elif self.db_config.db_type == "opengauss":
            jdbc_url = f"jdbc:opengauss://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}?authmode=sha256"
        else:
            jdbc_url = f"jdbc:{self.db_config.db_type}://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}"

        # 创建 JDBC 连接的同步函数
        def create_jdbc_connection():
            try:
                import jaydebeapi
                conn = jaydebeapi.connect(
                    driver_class,
                    jdbc_url,
                    [self.db_config.username, self.db_config.password],
                    driver_path,
                )
                return conn
            except ImportError:
                raise Exception("jaydebeapi 未安装")
            except Exception as e:
                raise e

        # 建立 JDBC 连接池
        connections = []
        for i in range(concurrency):
            try:
                conn = await run_sync(create_jdbc_connection)
                connections.append(conn)
                self.log(f"JDBC 连接 {i + 1}/{concurrency} 建立")
            except Exception as e:
                self.log(f"JDBC 连接 {i + 1} 失败: {str(e)}")

        if not connections:
            self.log("无法建立任何 JDBC 连接")
            return False

        self.log(f"成功建立 {len(connections)} 个 JDBC 连接")

        # JDBC 查询执行器
        async def run_jdbc_queries(conn, conn_idx):
            elapsed = 0
            query_count = 0
            error_count = 0

            while self.running and not self._stop_event.is_set() and elapsed < duration:
                try:
                    def exec_jdbc_query():
                        cursor = conn.cursor()
                        cursor.execute(query)
                        cursor.close()

                    await run_sync(exec_jdbc_query)
                    query_count += 1

                    step_progress = 20 + int((elapsed / duration) * 60)
                    await self._update_step_progress(step_id, progress_percent=step_progress)

                except Exception as e:
                    error_count += 1
                    if error_count <= 3:
                        self.log(f"JDBC 查询错误 (连接{conn_idx}): {str(e)}")

                await asyncio.sleep(interval_ms / 1000)
                elapsed += interval_ms / 1000

            self.log(f"JDBC 连接 {conn_idx}: 完成，执行 {query_count} 次，错误 {error_count} 次")

        # 并发执行
        tasks = []
        for idx, conn in enumerate(connections):
            task = asyncio.create_task(run_jdbc_queries(conn, idx))
            tasks.append(task)

        try:
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=duration + 10)

            # 关闭连接
            for i, conn in enumerate(connections):
                try:
                    await run_sync(conn.close)
                except Exception as e:
                    self.log(f"关闭 JDBC 连接 {i + 1} 失败: {str(e)}")

            self.log(f"JDBC 故障注入完成")
            return True

        except asyncio.TimeoutError:
            self.log(f"JDBC 故障注入超时")
            return False
        except Exception as e:
            self.log(f"JDBC 故障注入错误: {str(e)}")
            return False

    async def stop(self):
        """停止演练"""
        self.log("收到停止演练请求")
        self.running = False
        self._stop_event.set()

        # 更新状态
        await self._update_drill_status("stopped", current_phase=None)

    def log(self, message: str):
        """记录日志"""
        timestamp = datetime.utcnow().strftime("%H:%M:%S")
        line = f"[{timestamp}] {message}"
        self.log_lines.append(line)
        print(line)  # 同时打印到控制台

    async def _update_drill_status(self, status: str, progress_percent: Optional[int] = None, current_phase: Optional[str] = None):
        """更新演练状态"""
        async with async_session() as session:
            result = await session.execute(
                select(Drill).where(Drill.id == self.drill_id)
            )
            drill = result.scalar_one_or_none()
            if drill:
                drill.status = status
                if progress_percent is not None:
                    drill.progress_percent = progress_percent
                if current_phase is not None:
                    drill.current_phase = current_phase
                drill.ended_at = datetime.utcnow()
                drill.log = "\n".join(self.log_lines)
                await session.commit()

    async def _update_drill_progress(
        self,
        current_step: Optional[int] = None,
        current_phase: Optional[str] = None,
        progress_percent: Optional[int] = None
    ):
        """更新演练进度"""
        async with async_session() as session:
            result = await session.execute(
                select(Drill).where(Drill.id == self.drill_id)
            )
            drill = result.scalar_one_or_none()
            if drill:
                if current_step is not None:
                    drill.current_step = current_step
                if current_phase is not None:
                    drill.current_phase = current_phase
                if progress_percent is not None:
                    drill.progress_percent = progress_percent
                drill.log = "\n".join(self.log_lines)
                await session.commit()

    async def _update_step_status(
        self,
        step_id: int,
        status: str,
        current_phase: Optional[str] = None,
        progress_percent: Optional[int] = None
    ):
        """更新步骤状态"""
        async with async_session() as session:
            result = await session.execute(
                select(DrillStep).where(DrillStep.id == step_id)
            )
            step = result.scalar_one_or_none()
            if step:
                step.status = status
                if current_phase is not None:
                    step.current_phase = current_phase
                if progress_percent is not None:
                    step.progress_percent = progress_percent
                step.ended_at = datetime.utcnow()
                await session.commit()

    async def _update_step_progress(
        self,
        step_id: int,
        current_phase: Optional[str] = None,
        progress_percent: Optional[int] = None
    ):
        """更新步骤进度"""
        async with async_session() as session:
            result = await session.execute(
                select(DrillStep).where(DrillStep.id == step_id)
            )
            step = result.scalar_one_or_none()
            if step:
                if current_phase is not None:
                    step.current_phase = current_phase
                if progress_percent is not None:
                    step.progress_percent = progress_percent
                await session.commit()

    def _get_step_status(self, step_id: int) -> str:
        """获取步骤状态"""
        async def _get():
            async with async_session() as session:
                result = await session.execute(
                    select(DrillStep).where(DrillStep.id == step_id)
                )
                step = result.scalar_one_or_none()
                return step.status if step else "unknown"

        # 这里简化处理，实际应该异步调用
        for step in self.steps:
            if step["id"] == step_id:
                return step.get("status", "unknown")
        return "unknown"