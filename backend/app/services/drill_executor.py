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
            await self._update_drill_status("completed", 100)

        except Exception as e:
            self.log(f"演练执行失败: {str(e)}")
            await self._update_drill_status("failed")
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

        # 1. 前置准备阶段
        self.log(f"步骤 {step.step_order}: 开始前置准备")
        await self._update_step_status(step_id, "preparing", current_phase="preparing", progress_percent=0)

        setup_success = await self._execute_scripts(
            step_id,
            scenario_config.get("setup_scripts", []),
            "setup",
            scenario_config.get("setup_timeout", 60)
        )

        if not setup_success:
            self.log(f"步骤 {step.step_order}: 前置准备失败")
            await self._update_step_status(step_id, "failed")
            return

        self.log(f"步骤 {step.step_order}: 前置准备完成")
        await self._update_step_progress(step_id, current_phase="injecting", progress_percent=20)

        # 2. 故障注入阶段
        if self._stop_event.is_set():
            self.log(f"步骤 {step.step_order}: 收到停止信号")
            await self._update_step_status(step_id, "stopped")
            return

        self.log(f"步骤 {step.step_order}: 开始故障注入")
        await self._update_step_progress(step_id, current_phase="injecting", progress_percent=20)

        inject_success = await self._execute_fault_injection(
            step_id,
            scenario_config,
            scenario_config.get("setup_timeout", 60)
        )

        if not inject_success:
            self.log(f"步骤 {step.step_order}: 故障注入失败")
            # 即使注入失败，也尝试清理环境
        else:
            self.log(f"步骤 {step.step_order}: 故障注入完成")
            await self._update_step_progress(step_id, current_phase="cleaning", progress_percent=80)

        # 3. 清理环境阶段
        self.log(f"步骤 {step.step_order}: 开始清理环境")
        await self._update_step_progress(step_id, current_phase="cleaning", progress_percent=80)

        cleanup_success = await self._execute_scripts(
            step_id,
            scenario_config.get("cleanup_scripts", []),
            "cleanup",
            scenario_config.get("cleanup_timeout", 30)
        )

        if cleanup_success:
            self.log(f"步骤 {step.step_order}: 清理环境完成")
            await self._update_step_status(step_id, "completed", progress_percent=100)
        else:
            self.log(f"步骤 {step.step_order}: 清理环境失败（环境可能残留）")
            await self._update_step_status(step_id, "completed_with_cleanup_failed", progress_percent=100)

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
            if self.db_config.connection_method == "asyncpg":
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
            else:
                # psycopg2 或其他
                def run_sql():
                    conn = psycopg2.connect(
                        host=self.db_config.host,
                        port=self.db_config.port,
                        database=self.db_config.database,
                        user=self.db_config.username,
                        password=self.db_config.password,
                    )
                    cursor = conn.cursor()
                    cursor.execute(sql)
                    conn.commit()
                    cursor.close()
                    conn.close()

                await run_sync(run_sql)

            return True

        except asyncio.TimeoutError:
            self.log(f"SQL 执行超时")
            return False
        except Exception as e:
            self.log(f"SQL 执行错误: {str(e)}")
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

        try:
            # 创建连接
            connections = []
            for i in range(concurrency):
                try:
                    if self.db_config.connection_method == "asyncpg":
                        conn = await asyncpg.connect(
                            host=self.db_config.host,
                            port=self.db_config.port,
                            database=self.db_config.database,
                            user=self.db_config.username,
                            password=self.db_config.password,
                        )
                    else:
                        def create_conn():
                            return psycopg2.connect(
                                host=self.db_config.host,
                                port=self.db_config.port,
                                database=self.db_config.database,
                                user=self.db_config.username,
                                password=self.db_config.password,
                            )
                        conn = await run_sync(create_conn)

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
                        if self.db_config.connection_method == "asyncpg":
                            await conn.execute(query)
                        else:
                            def exec_query():
                                cursor = conn.cursor()
                                cursor.execute(query)
                                cursor.close()
                            await run_sync(exec_query)

                        # 更新进度
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

            # 等待完成
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=duration + 10)

            # 关闭连接
            for i, conn in enumerate(connections):
                try:
                    if self.db_config.connection_method == "asyncpg":
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

    async def stop(self):
        """停止演练"""
        self.log("收到停止演练请求")
        self.running = False
        self._stop_event.set()

        # 更新状态
        await self._update_drill_status("stopped")

    def log(self, message: str):
        """记录日志"""
        timestamp = datetime.utcnow().strftime("%H:%M:%S")
        line = f"[{timestamp}] {message}"
        self.log_lines.append(line)
        print(line)  # 同时打印到控制台

    async def _update_drill_status(self, status: str, progress_percent: Optional[int] = None):
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