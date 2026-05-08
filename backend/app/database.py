from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, select
from datetime import datetime
import json

from app.config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class DatabaseConfig(Base):
    __tablename__ = "database_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    db_type = Column(String(50), nullable=False, default="postgresql")  # postgresql, opengauss, gaussdb
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    database = Column(String(100), nullable=False)
    username = Column(String(100), nullable=False)
    password = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "db_type": self.db_type,
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "username": self.username,
            "password": self.password,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class FaultScenario(Base):
    __tablename__ = "fault_scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    description = Column(Text)
    config = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "description": self.description,
            "config": json.loads(self.config) if self.config else {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class InjectionRecord(Base):
    __tablename__ = "injection_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("fault_scenarios.id"), nullable=False)
    db_config_id = Column(Integer, ForeignKey("database_configs.id"), nullable=False)
    status = Column(String(20), nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime)
    log = Column(Text)

    def to_dict(self):
        return {
            "id": self.id,
            "scenario_id": self.scenario_id,
            "db_config_id": self.db_config_id,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "log": self.log,
        }


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Insert default data
    async with async_session() as session:
        # Check if default database config exists
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.name == "本地测试数据库")
        )
        if result.scalar_one_or_none() is None:
            default_db = DatabaseConfig(
                name="本地测试数据库",
                db_type="postgresql",
                host="127.0.0.1",
                port=5432,
                database="postgres",
                username="lcj",
                password="",
            )
            session.add(default_db)

        # Check if default openGauss config exists
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.name == "openGauss示例")
        )
        if result.scalar_one_or_none() is None:
            opengauss_db = DatabaseConfig(
                name="openGauss示例",
                db_type="opengauss",
                host="localhost",
                port=5433,
                database="postgres",
                username="gaussdb",
                password="Enmotech@123",
            )
            session.add(opengauss_db)

        # Check if default GaussDB config exists
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.name == "GaussDB示例")
        )
        if result.scalar_one_or_none() is None:
            gaussdb_db = DatabaseConfig(
                name="GaussDB示例",
                db_type="gaussdb",
                host="192.168.1.200",
                port=8000,
                database="postgres",
                username="root",
                password="",
            )
            session.add(gaussdb_db)

        # Check if default fault scenario exists
        result = await session.execute(
            select(FaultScenario).where(FaultScenario.name == "高并发CPU压力测试")
        )
        if result.scalar_one_or_none() is None:
            default_scenario = FaultScenario(
                name="高并发CPU压力测试",
                type="high_concurrency",
                description="通过50个并发连接持续执行CPU密集型SQL查询，模拟SQL并发过高导致CPU打满的场景",
                config=json.dumps({
                    "concurrency": 50,
                    "duration_seconds": 60,
                    "interval_ms": 100,
                    "query_template": "SELECT count(*) FROM pg_catalog.pg_class a, pg_catalog.pg_class b, pg_catalog.pg_class c WHERE a.oid = b.oid AND b.oid = c.oid"
                }),
            )
            session.add(default_scenario)

        # Add more default scenarios
        result = await session.execute(
            select(FaultScenario).where(FaultScenario.name == "连接耗尽测试")
        )
        if result.scalar_one_or_none() is None:
            conn_exhaustion_scenario = FaultScenario(
                name="连接耗尽测试",
                type="connection_exhaustion",
                description="创建大量连接耗尽数据库连接池，模拟连接资源耗尽场景",
                config=json.dumps({
                    "concurrency": 200,
                    "duration_seconds": 30,
                    "interval_ms": 0,
                    "query_template": "SELECT 1"
                }),
            )
            session.add(conn_exhaustion_scenario)

        result = await session.execute(
            select(FaultScenario).where(FaultScenario.name == "慢查询测试")
        )
        if result.scalar_one_or_none() is None:
            slow_query_scenario = FaultScenario(
                name="慢查询测试",
                type="slow_query",
                description="执行复杂SQL查询消耗数据库资源，模拟慢查询场景",
                config=json.dumps({
                    "concurrency": 10,
                    "duration_seconds": 60,
                    "interval_ms": 500,
                    "query_template": "SELECT pg_sleep(1)"
                }),
            )
            session.add(slow_query_scenario)

        await session.commit()