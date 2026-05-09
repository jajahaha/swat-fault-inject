from fastapi import APIRouter, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.database import async_session, DatabaseConfig
from app.models.schemas import (
    DatabaseConfigCreate,
    DatabaseConfigUpdate,
    DatabaseConfigResponse,
    ConnectionTestResponse,
)
import asyncpg

router = APIRouter(prefix="/api/database-configs", tags=["database-configs"])

# Supported database types
SUPPORTED_DB_TYPES = [
    {"value": "postgresql", "label": "PostgreSQL", "default_port": 5432},
    {"value": "opengauss", "label": "openGauss", "default_port": 5432},
    {"value": "gaussdb", "label": "GaussDB", "default_port": 8000},
]


@router.get("/types")
async def get_database_types():
    return SUPPORTED_DB_TYPES


@router.get("", response_model=list[DatabaseConfigResponse])
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
            host=config.host,
            port=config.port,
            database=config.database,
            username=config.username,
            password=config.password,
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

    # PostgreSQL, openGauss, GaussDB all use PostgreSQL protocol
    try:
        conn = await asyncpg.connect(
            host=db_config.host,
            port=db_config.port,
            database=db_config.database,
            user=db_config.username,
            password=db_config.password,
            timeout=10,
        )
        version = await conn.fetchval("SELECT version()")
        await conn.close()
        return ConnectionTestResponse(
            success=True,
            message=f"{db_config.db_type} 连接成功",
            server_version=version,
        )
    except Exception as e:
        return ConnectionTestResponse(
            success=False,
            message=f"连接失败: {str(e)}",
        )