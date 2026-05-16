from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, select, text
from datetime import datetime
import json
import asyncio

from app.config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


class DatabaseConfig(Base):
    __tablename__ = "database_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    db_type = Column(String(50), nullable=False, default="postgresql")
    connection_method = Column(String(50), nullable=False, default="psycopg2")
    deployment_mode = Column(String(20), nullable=False, default="centralized")  # 部署形态: centralized / distributed
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    database = Column(String(100), nullable=False)
    username = Column(String(100), nullable=False)
    password = Column(Text, nullable=False)
    jdbc_driver_path = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "db_type": self.db_type,
            "connection_method": self.connection_method,
            "deployment_mode": self.deployment_mode,
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "username": self.username,
            "password": self.password,
            "jdbc_driver_path": self.jdbc_driver_path,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class FaultScenario(Base):
    __tablename__ = "fault_scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    category1 = Column(String(50), nullable=True)  # 一级分类: 慢/满/宕/错
    category2 = Column(String(50), nullable=True)  # 二级分类: CPU/内存/磁盘/网络/连接等
    category3 = Column(String(50), nullable=True)  # 三级分类: 具体场景类型
    description = Column(Text)
    config = Column(Text, nullable=False)
    # 三阶段脚本配置
    setup_scripts = Column(Text, nullable=True)  # JSON array of setup scripts
    run_scripts = Column(Text, nullable=True)  # JSON array of run scripts（新增）
    cleanup_scripts = Column(Text, nullable=True)  # JSON array of cleanup scripts
    # 超时配置
    setup_timeout = Column(Integer, nullable=True, default=60)  # 前置准备超时（秒）
    run_timeout = Column(Integer, nullable=True, default=120)  # 运行环节超时（秒）（新增）
    cleanup_timeout = Column(Integer, nullable=True, default=30)  # 清理超时（秒）
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "category1": self.category1,
            "category2": self.category2,
            "category3": self.category3,
            "description": self.description,
            "config": json.loads(self.config) if self.config else {},
            # 三阶段脚本
            "setup_scripts": json.loads(self.setup_scripts) if self.setup_scripts else [],
            "run_scripts": json.loads(self.run_scripts) if self.run_scripts else [],
            "cleanup_scripts": json.loads(self.cleanup_scripts) if self.cleanup_scripts else [],
            # 超时配置
            "setup_timeout": self.setup_timeout or 60,
            "run_timeout": self.run_timeout or 120,
            "cleanup_timeout": self.cleanup_timeout or 30,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class Drill(Base):
    """演练表 - 支持多场景组合执行"""
    __tablename__ = "drills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    execution_mode = Column(String(20), nullable=False, default="sequential")  # sequential/parallel
    db_config_id = Column(Integer, ForeignKey("database_configs.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending/preparing/running/cleaning/completed/failed
    total_steps = Column(Integer, nullable=False, default=0)
    current_step = Column(Integer, nullable=True, default=0)
    progress_percent = Column(Integer, nullable=True, default=0)
    current_phase = Column(String(20), nullable=True)  # preparing/injecting/cleaning
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    log = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)  # 添加创建时间字段
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # 添加更新时间字段

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "execution_mode": self.execution_mode,
            "db_config_id": self.db_config_id,
            "status": self.status,
            "total_steps": self.total_steps,
            "current_step": self.current_step,
            "progress_percent": self.progress_percent,
            "current_phase": self.current_phase,
            "started_at": self.started_at.isoformat() + "Z" if self.started_at else None,
            "ended_at": self.ended_at.isoformat() + "Z" if self.ended_at else None,
            "log": self.log,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class DrillStep(Base):
    """演练步骤表 - 每个步骤对应一个故障场景"""
    __tablename__ = "drill_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    drill_id = Column(Integer, ForeignKey("drills.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    scenario_id = Column(Integer, ForeignKey("fault_scenarios.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending/preparing/injecting/cleaning/completed/failed
    progress_percent = Column(Integer, nullable=True, default=0)
    current_phase = Column(String(20), nullable=True)  # preparing/injecting/cleaning
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    log = Column(Text)

    def to_dict(self):
        return {
            "id": self.id,
            "drill_id": self.drill_id,
            "step_order": self.step_order,
            "scenario_id": self.scenario_id,
            "status": self.status,
            "progress_percent": self.progress_percent,
            "current_phase": self.current_phase,
            "started_at": self.started_at.isoformat() + "Z" if self.started_at else None,
            "ended_at": self.ended_at.isoformat() + "Z" if self.ended_at else None,
            "log": self.log,
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
    
    # Relationships for eager loading
    scenario = relationship("FaultScenario", backref="injection_records")
    db_config = relationship("DatabaseConfig", backref="injection_records")

    def to_dict(self):
        return {
            "id": self.id,
            "scenario_id": self.scenario_id,
            "db_config_id": self.db_config_id,
            "status": self.status,
            "started_at": self.started_at.isoformat() + "Z" if self.started_at else None,
            "ended_at": self.ended_at.isoformat() + "Z" if self.ended_at else None,
            "log": self.log,
        }


async def init_db():
    async with engine.begin() as conn:
        # 创建所有表（如果不存在）
        await conn.run_sync(Base.metadata.create_all)

        # 迁移：检查并添加 deployment_mode 列（如果不存在）
        try:
            # SQLite 使用 pragma_table_info 检查列是否存在
            result = await conn.execute(text(
                "SELECT column_name FROM pragma_table_info('database_configs') WHERE column_name='deployment_mode'"
            ))
            existing = result.fetchone()
            if not existing:
                await conn.execute(text(
                    "ALTER TABLE database_configs ADD COLUMN deployment_mode VARCHAR(20) NOT NULL DEFAULT 'centralized'"
                ))
                print("迁移成功: 添加 deployment_mode 列")
        except Exception as e:
            # 如果不是 SQLite 或者 pragma 命令失败，尝试直接添加（会失败如果列已存在）
            try:
                await conn.execute(text(
                    "ALTER TABLE database_configs ADD COLUMN deployment_mode VARCHAR(20) NOT NULL DEFAULT 'centralized'"
                ))
                print("迁移成功: 添加 deployment_mode 列")
            except Exception:
                # 列已存在，忽略
                pass

    # 等待迁移完成后再插入默认数据
    await asyncio.sleep(0.1)

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
                connection_method="asyncpg",
                deployment_mode="centralized",
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
                connection_method="gsql",
                deployment_mode="centralized",
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
                connection_method="jdbc",
                deployment_mode="centralized",
                host="192.168.1.200",
                port=8000,
                database="postgres",
                username="root",
                password="",
                jdbc_driver_path="drivers/gaussdbjdbc.jar",
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
                category1="full",
                category2="cpu",
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
                category1="full",
                category2="connection",
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
                category1="slow",
                category2="cpu",
                description="执行复杂SQL查询消耗数据库资源，模拟慢查询场景",
                config=json.dumps({
                    "concurrency": 10,
                    "duration_seconds": 60,
                    "interval_ms": 500,
                    "query_template": "SELECT pg_sleep(1)"
                }),
            )
            session.add(slow_query_scenario)

        # 添加DDL锁阻塞测试场景
        result = await session.execute(
            select(FaultScenario).where(FaultScenario.name == "DDL锁阻塞测试")
        )
        if result.scalar_one_or_none() is None:
            ddl_lock_scenario = FaultScenario(
                name="DDL锁阻塞测试",
                type="ddl_lock_blocking",
                category1="slow",
                category2="lock",
                category3="table",
                description="执行DDL操作获取表级锁，阻塞后续INSERT/UPDATE/DELETE操作，模拟DDL导致的锁等待场景",
                config=json.dumps({
                    "concurrency": 10,
                    "duration_seconds": 60,
                    "interval_ms": 100
                }),
                setup_scripts=json.dumps([
                    {
                        "type": "sql",
                        "mode": "all",
                        "description": "创建测试表并插入初始数据",
                        "content": "DROP TABLE IF EXISTS ddl_lock_test; CREATE TABLE ddl_lock_test (id SERIAL PRIMARY KEY, name VARCHAR(100), value INT); INSERT INTO ddl_lock_test (name, value) SELECT 'test' || i::text, i FROM generate_series(1, 100) i;",
                        "timeout": 30
                    }
                ]),
                run_scripts=json.dumps([
                    {
                        "type": "sql",
                        "mode": "centralized",
                        "description": "启动DDL事务获取表级锁",
                        "content": "BEGIN; ALTER TABLE ddl_lock_test ADD COLUMN new_column VARCHAR(50); SELECT pg_sleep(60); COMMIT;",
                        "timeout": 120,
                        "iterations": 1
                    },
                    {
                        "type": "sql",
                        "mode": "distributed",
                        "description": "并发执行INSERT被DDL锁阻塞",
                        "content": "INSERT INTO ddl_lock_test (name, value) VALUES ('blocked_insert', 999);",
                        "timeout": 30,
                        "iterations": 100
                    },
                    {
                        "type": "sql",
                        "mode": "distributed",
                        "description": "并发执行UPDATE被DDL锁阻塞",
                        "content": "UPDATE ddl_lock_test SET value = value + 1 WHERE id = 1;",
                        "timeout": 30,
                        "iterations": 100
                    },
                    {
                        "type": "sql",
                        "mode": "distributed",
                        "description": "并发执行DELETE被DDL锁阻塞",
                        "content": "DELETE FROM ddl_lock_test WHERE id = 100;",
                        "timeout": 30,
                        "iterations": 100
                    }
                ]),
                cleanup_scripts=json.dumps([
                    {
                        "type": "sql",
                        "mode": "all",
                        "description": "删除测试表",
                        "content": "DROP TABLE IF EXISTS ddl_lock_test;",
                        "timeout": 10
                    }
                ]),
                setup_timeout=30,
                run_timeout=120,
                cleanup_timeout=10,
            )
            session.add(ddl_lock_scenario)

        await session.commit()

        # 清理僵尸演练：服务重启时将卡住的演练状态改为 stopped
        zombie_result = await session.execute(
            select(Drill).where(Drill.status.in_(["preparing", "running", "cleaning"]))
        )
        zombie_drills = zombie_result.scalars().all()
        if zombie_drills:
            now = datetime.utcnow().isoformat() + "Z"
            for drill in zombie_drills:
                drill.status = "stopped"
                drill.ended_at = datetime.utcnow()
                drill.log = (drill.log or "") + f"\n[{datetime.utcnow().strftime('%H:%M:%S')}] 服务重启，演练自动停止"
            # 同时更新步骤状态
            for drill in zombie_drills:
                step_result = await session.execute(
                    select(DrillStep).where(DrillStep.drill_id == drill.id)
                )
                steps = step_result.scalars().all()
                for step in steps:
                    if step.status in ["preparing", "running", "cleaning"]:
                        step.status = "stopped"
                        step.ended_at = datetime.utcnow()
            await session.commit()
            print(f"已清理 {len(zombie_drills)} 个僵尸演练")