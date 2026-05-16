from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.api.db_config_import_export import router as db_config_io_router  # 新增：数据库配置导入导出路由
from app.api.database_config import router as db_config_router
from app.api.fault_scenarios import router as fault_scenarios_router
from app.api.injection import router as injection_router
from app.api.drill import router as drill_router  # 新增：演练路由
from app.api.scenario_import_export import router as scenario_io_router  # 新增：导入导出路由
from app.api.sql_console import router as sql_console_router  # 新增：SQL控制台路由


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="SWAT Fault Inject Platform",
    description="Database fault injection platform for testing high-load scenarios",
    version="1.7.6",  # 版本升级 - DDL锁阻塞场景并发执行支持
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(db_config_io_router)  # 导入导出路由必须在 database_config 路由之前注册
app.include_router(db_config_router)
app.include_router(scenario_io_router)  # 导入导出路由必须在 fault_scenarios_router 之前注册
app.include_router(fault_scenarios_router)
app.include_router(injection_router)
app.include_router(drill_router)
app.include_router(sql_console_router)  # SQL控制台路由


@app.get("/")
async def root():
    return {"message": "SWAT Fault Inject Platform API", "version": "1.7.6"}