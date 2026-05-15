"""
SQL 控制台 API - 在线执行 SQL 查询
"""
import time
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from typing import List, Any, Optional
import asyncpg
import psycopg2
import subprocess
import os
import asyncio

from app.database import async_session, DatabaseConfig
from app.models.schemas import SqlExecuteRequest, SqlExecuteResponse
from app.services.drill_executor import run_sync

router = APIRouter(prefix="/api/sql-console", tags=["sql-console"])


async def execute_sql_asyncpg(db_config, sql: str, limit: int) -> SqlExecuteResponse:
    """使用 asyncpg 执行 SQL"""
    start_time = time.time()
    try:
        conn = await asyncpg.connect(
            host=db_config.host,
            port=db_config.port,
            database=db_config.database,
            user=db_config.username,
            password=db_config.password,
            timeout=30,
        )

        # 执行查询
        rows = await conn.fetch(sql)
        await conn.close()

        # 处理结果
        if rows:
            columns = list(rows[0].keys())
            data = [list(row.values()) for row in rows[:limit]]
            row_count = len(data)
        else:
            columns = []
            data = []
            row_count = 0

        execution_time = time.time() - start_time

        return SqlExecuteResponse(
            success=True,
            message=f"查询成功，返回 {row_count} 行",
            columns=columns,
            rows=data,
            row_count=row_count,
            execution_time=execution_time,
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return SqlExecuteResponse(
            success=False,
            message=f"执行失败: {str(e)}",
            execution_time=execution_time,
        )


async def execute_sql_psycopg2(db_config, sql: str, limit: int) -> SqlExecuteResponse:
    """使用 psycopg2 执行 SQL"""
    start_time = time.time()

    def run_query():
        connect_params = {
            "host": db_config.host,
            "port": db_config.port,
            "database": db_config.database,
            "user": db_config.username,
            "password": db_config.password,
        }
        # GaussDB/openGauss sha256 认证支持
        if db_config.db_type in ("gaussdb", "opengauss"):
            connect_params["sslmode"] = "prefer"

        conn = psycopg2.connect(**connect_params)
        cursor = conn.cursor()
        cursor.execute(sql)

        # 获取结果
        if cursor.description:
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchmany(limit)
            data = [list(row) for row in rows]
            row_count = len(data)
        else:
            columns = []
            data = []
            row_count = 0
            conn.commit()  # 对于 INSERT/UPDATE 等需要 commit

        cursor.close()
        conn.close()
        return columns, data, row_count

    try:
        columns, data, row_count = await run_sync(run_query)
        execution_time = time.time() - start_time

        return SqlExecuteResponse(
            success=True,
            message=f"查询成功，返回 {row_count} 行",
            columns=columns,
            rows=data,
            row_count=row_count,
            execution_time=execution_time,
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return SqlExecuteResponse(
            success=False,
            message=f"执行失败: {str(e)}",
            execution_time=execution_time,
        )


async def execute_sql_gsql(db_config, sql: str, limit: int) -> SqlExecuteResponse:
    """使用 gsql 执行 SQL"""
    start_time = time.time()

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
        return SqlExecuteResponse(
            success=False,
            message="gsql 命令未找到",
            execution_time=time.time() - start_time,
        )

    def run_gsql():
        env = os.environ.copy()
        env["PGPASSWORD"] = db_config.password
        cmd = [
            gsql_path,
            "-h", db_config.host,
            "-p", str(db_config.port),
            "-d", db_config.database,
            "-U", db_config.username,
            "-W", db_config.password,
            "-r",
            "-c", sql,
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            env=env,
        )
        return result.stdout, result.stderr, result.returncode

    try:
        stdout, stderr, returncode = await run_sync(run_gsql)
        execution_time = time.time() - start_time

        if returncode != 0:
            return SqlExecuteResponse(
                success=False,
                message=f"gsql 执行失败: {stderr}",
                execution_time=execution_time,
            )

        # 解析 gsql 输出（表格格式）
        output = stdout.strip()
        lines = output.split('\n')

        # gsql 输出格式：列名行、分隔线、数据行
        # 简化处理：直接返回文本输出
        return SqlExecuteResponse(
            success=True,
            message=f"查询成功",
            columns=["output"],
            rows=[[output[:5000]]],  # 截取前5000字符
            row_count=1,
            execution_time=execution_time,
        )
    except subprocess.TimeoutExpired:
        execution_time = time.time() - start_time
        return SqlExecuteResponse(
            success=False,
            message="gsql 执行超时",
            execution_time=execution_time,
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return SqlExecuteResponse(
            success=False,
            message=f"gsql 执行异常: {str(e)}",
            execution_time=execution_time,
        )


async def execute_sql_jdbc(db_config, sql: str, limit: int) -> SqlExecuteResponse:
    """使用 JDBC 执行 SQL"""
    start_time = time.time()

    driver_path = db_config.jdbc_driver_path
    if not driver_path:
        return SqlExecuteResponse(
            success=False,
            message="JDBC 驱动路径未配置",
            execution_time=time.time() - start_time,
        )

    # 检查驱动文件
    if not os.path.exists(driver_path):
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        full_path = os.path.join(project_root, driver_path)
        if os.path.exists(full_path):
            driver_path = full_path
        else:
            return SqlExecuteResponse(
                success=False,
                message=f"JDBC 驱动文件不存在: {driver_path}",
                execution_time=time.time() - start_time,
            )

    # JDBC 驱动类名
    driver_classes = {
        "postgresql": "org.postgresql.Driver",
        "opengauss": "org.opengauss.Driver",
        "gaussdb": "com.huawei.gaussdb.jdbc.Driver",
    }
    driver_class = driver_classes.get(db_config.db_type, "org.postgresql.Driver")

    # JDBC URL
    if db_config.db_type == "gaussdb":
        jdbc_url = f"jdbc:gaussdb://{db_config.host}:{db_config.port}/{db_config.database}?authmode=sha256"
    elif db_config.db_type == "opengauss":
        jdbc_url = f"jdbc:opengauss://{db_config.host}:{db_config.port}/{db_config.database}?authmode=sha256"
    else:
        jdbc_url = f"jdbc:{db_config.db_type}://{db_config.host}:{db_config.port}/{db_config.database}"

    def run_jdbc():
        import jaydebeapi
        conn = jaydebeapi.connect(
            driver_class,
            jdbc_url,
            [db_config.username, db_config.password],
            driver_path,
        )
        cursor = conn.cursor()
        cursor.execute(sql)

        # 获取结果
        if cursor.description:
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchmany(limit)
            data = [list(row) for row in rows]
            row_count = len(data)
        else:
            columns = []
            data = []
            row_count = 0

        cursor.close()
        conn.close()
        return columns, data, row_count

    try:
        columns, data, row_count = await run_sync(run_jdbc)
        execution_time = time.time() - start_time

        return SqlExecuteResponse(
            success=True,
            message=f"查询成功，返回 {row_count} 行",
            columns=columns,
            rows=data,
            row_count=row_count,
            execution_time=execution_time,
        )
    except ImportError:
        execution_time = time.time() - start_time
        return SqlExecuteResponse(
            success=False,
            message="jaydebeapi 未安装，请运行: pip install jaydebeapi JPype1",
            execution_time=execution_time,
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return SqlExecuteResponse(
            success=False,
            message=f"JDBC 执行失败: {str(e)}",
            execution_time=execution_time,
        )


@router.post("/execute", response_model=SqlExecuteResponse)
async def execute_sql(request: SqlExecuteRequest):
    """执行 SQL 查询"""

    # 获取数据库配置
    async with async_session() as session:
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == request.db_config_id)
        )
        db_config = result.scalar_one_or_none()

        if not db_config:
            raise HTTPException(status_code=404, detail="数据库配置不存在")

    # 根据连接方式执行 SQL
    method = db_config.connection_method

    if method == "asyncpg":
        return await execute_sql_asyncpg(db_config, request.sql, request.limit)
    elif method == "psycopg2":
        return await execute_sql_psycopg2(db_config, request.sql, request.limit)
    elif method == "gsql":
        return await execute_sql_gsql(db_config, request.sql, request.limit)
    elif method == "jdbc":
        return await execute_sql_jdbc(db_config, request.sql, request.limit)
    else:
        raise HTTPException(status_code=400, detail=f"不支持的连接方式: {method}")