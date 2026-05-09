from fastapi import APIRouter, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import List
import asyncio
import subprocess
import os
import shlex
import sys

from app.database import async_session, DatabaseConfig
from app.models.schemas import (
    DatabaseConfigCreate,
    DatabaseConfigUpdate,
    DatabaseConfigResponse,
    ConnectionTestResponse,
)
import asyncpg
import psycopg2

# Python 3.7 compatible async thread wrapper
async def run_sync(func, *args):
    """Run synchronous function in thread pool (Python 3.7 compatible)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, func, *args)

router = APIRouter(prefix="/api/database-configs", tags=["database-configs"])

# Supported database types
SUPPORTED_DB_TYPES = [
    {"value": "postgresql", "label": "PostgreSQL", "default_port": 5432},
    {"value": "opengauss", "label": "openGauss", "default_port": 5432},
    {"value": "gaussdb", "label": "GaussDB", "default_port": 8000},
]

# Supported connection methods
SUPPORTED_CONNECTION_METHODS = [
    {"value": "asyncpg", "label": "asyncpg (Python异步驱动)", "supported_db_types": ["postgresql"], "requires_password": True},
    {"value": "psycopg2", "label": "psycopg2 (Python同步驱动)", "supported_db_types": ["postgresql", "opengauss", "gaussdb"], "requires_password": True},
    {"value": "gsql", "label": "gsql (命令行工具)", "supported_db_types": ["opengauss", "gaussdb"], "requires_password": True, "os_user": "service"},
    {"value": "jdbc", "label": "JDBC (Java驱动)", "supported_db_types": ["opengauss", "gaussdb"], "requires_password": True, "requires_driver": True},
]


@router.get("/types")
async def get_database_types():
    return SUPPORTED_DB_TYPES


@router.get("/connection-methods")
async def get_connection_methods():
    return SUPPORTED_CONNECTION_METHODS


@router.get("", response_model=List[DatabaseConfigResponse])
async def get_database_configs():
    async with async_session() as session:
        result = await session.execute(select(DatabaseConfig))
        configs = result.scalars().all()
        return [config.to_dict() for config in configs]


@router.get("/{config_id}", response_model=DatabaseConfigResponse)
async def get_database_config(config_id: int):
    async with async_session() as session:
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == config_id)
        )
        config = result.scalar_one_or_none()
        if not config:
            raise HTTPException(status_code=404, detail="Database config not found")
        return config.to_dict()


@router.post("", response_model=DatabaseConfigResponse)
async def create_database_config(config: DatabaseConfigCreate):
    async with async_session() as session:
        db_config = DatabaseConfig(
            name=config.name,
            db_type=config.db_type,
            connection_method=config.connection_method,
            host=config.host,
            port=config.port,
            database=config.database,
            username=config.username,
            password=config.password,
            jdbc_driver_path=config.jdbc_driver_path,
        )
        session.add(db_config)
        await session.commit()
        await session.refresh(db_config)
        return db_config.to_dict()


@router.put("/{config_id}", response_model=DatabaseConfigResponse)
async def update_database_config(config_id: int, config: DatabaseConfigUpdate):
    async with async_session() as session:
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == config_id)
        )
        db_config = result.scalar_one_or_none()
        if not db_config:
            raise HTTPException(status_code=404, detail="Database config not found")

        update_data = config.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_config, key, value)

        await session.commit()
        await session.refresh(db_config)
        return db_config.to_dict()


@router.delete("/{config_id}")
async def delete_database_config(config_id: int):
    async with async_session() as session:
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == config_id)
        )
        db_config = result.scalar_one_or_none()
        if not db_config:
            raise HTTPException(status_code=404, detail="Database config not found")

        await session.delete(db_config)
        await session.commit()
        return {"message": "Database config deleted successfully"}


@router.post("/{config_id}/test", response_model=ConnectionTestResponse)
async def test_database_connection(config_id: int):
    async with async_session() as session:
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == config_id)
        )
        db_config = result.scalar_one_or_none()
        if not db_config:
            raise HTTPException(status_code=404, detail="Database config not found")

    # Choose connection method based on configuration
    method = db_config.connection_method

    if method == "asyncpg":
        return await _test_asyncpg(db_config)
    elif method == "psycopg2":
        return await _test_psycopg2(db_config)
    elif method == "gsql":
        return await _test_gsql(db_config)
    elif method == "jdbc":
        return await _test_jdbc(db_config)
    else:
        return ConnectionTestResponse(
            success=False,
            message=f"不支持的连接方式: {method}",
        )


async def _test_asyncpg(db_config) -> ConnectionTestResponse:
    """Test connection using asyncpg driver"""
    try:
        connect_params = {
            "host": db_config.host,
            "port": db_config.port,
            "database": db_config.database,
            "user": db_config.username,
            "password": db_config.password,
            "timeout": 10,
        }

        conn = await asyncpg.connect(**connect_params)
        version = await conn.fetchval("SELECT version()")
        await conn.close()
        return ConnectionTestResponse(
            success=True,
            message=f"{db_config.db_type} 连接成功 (asyncpg)",
            server_version=version,
        )
    except Exception as e:
        return ConnectionTestResponse(
            success=False,
            message=f"asyncpg 连接失败: {str(e)}",
        )


async def _test_psycopg2(db_config) -> ConnectionTestResponse:
    """Test connection using psycopg2 driver"""
    def connect_psycopg2():
        conn = psycopg2.connect(
            host=db_config.host,
            port=db_config.port,
            database=db_config.database,
            user=db_config.username,
            password=db_config.password,
            connect_timeout=10,
        )
        cursor = conn.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return version

    try:
        version = await run_sync(connect_psycopg2)
        return ConnectionTestResponse(
            success=True,
            message=f"{db_config.db_type} 连接成功 (psycopg2)",
            server_version=version,
        )
    except Exception as e:
        return ConnectionTestResponse(
            success=False,
            message=f"psycopg2 连接失败: {str(e)}",
        )


async def _test_gsql(db_config) -> ConnectionTestResponse:
    """Test connection using gsql command line tool

    gsql uses OS user 'service' as specified
    Command: gsql -h host -p port -d database -U username -W password
    """
    try:
        # Build gsql command
        # gsql command format: gsql -h host -p port -d database -U user -W password
        cmd = [
            "gsql",
            "-h", db_config.host,
            "-p", str(db_config.port),
            "-d", db_config.database,
            "-U", db_config.username,
            "-W", db_config.password,
        ]

        # Add -r flag for remote connection
        cmd.append("-r")

        # Execute query to get version
        query_cmd = cmd + ["-c", "SELECT version();"]

        # Run as 'service' user if needed (requires sudo permission)
        # For simplicity, we run directly. If OS user is different, use:
        # sudo -u service gsql ...

        def run_gsql():
            try:
                result = subprocess.run(
                    query_cmd,
                    capture_output=True,
                    text=True,
                    timeout=15,
                    env={**os.environ, "PGPASSWORD": db_config.password}
                )
                return result
            except subprocess.TimeoutExpired:
                return None
            except FileNotFoundError:
                # gsql not found, try to find it in common paths
                gsql_paths = [
                    "/usr/bin/gsql",
                    "/usr/local/bin/gsql",
                    "/opt/gaussdb/bin/gsql",
                    "/opt/opengauss/bin/gsql",
                    "/home/service/gsql",
                ]
                for path in gsql_paths:
                    if os.path.exists(path):
                        query_cmd[0] = path
                        try:
                            result = subprocess.run(
                                query_cmd,
                                capture_output=True,
                                text=True,
                                timeout=15,
                                env={**os.environ, "PGPASSWORD": db_config.password}
                            )
                            return result
                        except:
                            continue
                return None

        result = await run_sync(run_gsql)

        if result is None:
            return ConnectionTestResponse(
                success=False,
                message="gsql 连接超时或命令未找到",
            )

        if result.returncode == 0:
            version_output = result.stdout.strip()
            # Extract version from output
            lines = version_output.split('\n')
            version = lines[-1] if lines else "版本信息获取成功"
            return ConnectionTestResponse(
                success=True,
                message=f"{db_config.db_type} 连接成功 (gsql)",
                server_version=version,
            )
        else:
            error_msg = result.stderr.strip() if result.stderr else "未知错误"
            return ConnectionTestResponse(
                success=False,
                message=f"gsql 连接失败: {error_msg}",
            )

    except Exception as e:
        return ConnectionTestResponse(
            success=False,
            message=f"gsql 连接异常: {str(e)}",
        )


async def _test_jdbc(db_config) -> ConnectionTestResponse:
    """Test connection using JDBC driver

    Uses JayDeBeApi to connect via JDBC driver jar file
    Requires jaydebeapi and JPype1 packages
    """
    try:
        # Check if JDBC driver path is configured
        driver_path = db_config.jdbc_driver_path
        if not driver_path:
            return ConnectionTestResponse(
                success=False,
                message="JDBC 驱动路径未配置，请在 jdbc_driver_path 中指定驱动 jar 文件路径",
            )

        # Check if driver file exists
        if not os.path.exists(driver_path):
            # Try relative path from project root
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            full_path = os.path.join(project_root, driver_path)
            if os.path.exists(full_path):
                driver_path = full_path
            else:
                return ConnectionTestResponse(
                    success=False,
                    message=f"JDBC 驱动文件不存在: {driver_path}",
                )

        # JDBC driver class names for different databases
        driver_classes = {
            "postgresql": "org.postgresql.Driver",
            "opengauss": "org.opengauss.Driver",
            "gaussdb": "com.huawei.gaussdb.jdbc.Driver",
        }
        driver_class = driver_classes.get(db_config.db_type, "org.postgresql.Driver")

        # JDBC URL format
        jdbc_url = f"jdbc:{db_config.db_type}://{db_config.host}:{db_config.port}/{db_config.database}"

        def connect_jdbc():
            try:
                import jaydebeapi
                conn = jaydebeapi.connect(
                    driver_class,
                    jdbc_url,
                    [db_config.username, db_config.password],
                    driver_path,
                )
                cursor = conn.cursor()
                cursor.execute("SELECT version()")
                result = cursor.fetchone()
                version = result[0] if result else "版本获取成功"
                cursor.close()
                conn.close()
                return version
            except ImportError:
                raise Exception("jaydebeapi 未安装，请运行: pip install jaydebeapi JPype1")
            except Exception as e:
                raise e

        version = await run_sync(connect_jdbc)
        return ConnectionTestResponse(
            success=True,
            message=f"{db_config.db_type} 连接成功 (JDBC)",
            server_version=version,
        )

    except Exception as e:
        return ConnectionTestResponse(
            success=False,
            message=f"JDBC 连接失败: {str(e)}",
        )