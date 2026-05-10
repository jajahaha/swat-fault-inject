from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


# ==================== 数据库配置 ====================

class DatabaseConfigCreate(BaseModel):
    name: str
    db_type: str = "postgresql"  # postgresql, opengauss, gaussdb
    connection_method: str = "psycopg2"  # asyncpg, psycopg2, gsql, jdbc
    host: str
    port: int
    database: str
    username: str
    password: str = ""  # Default empty string, allow empty password
    jdbc_driver_path: Optional[str] = None  # Path to JDBC driver jar file


class DatabaseConfigUpdate(BaseModel):
    name: Optional[str] = None
    db_type: Optional[str] = None
    connection_method: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    jdbc_driver_path: Optional[str] = None


class DatabaseConfigResponse(BaseModel):
    id: int
    name: str
    db_type: str
    connection_method: str
    host: str
    port: int
    database: str
    username: str
    password: str
    jdbc_driver_path: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ==================== 故障场景 ====================

class SetupScript(BaseModel):
    """前置准备脚本"""
    type: str = "sql"  # sql / shell
    description: Optional[str] = None
    content: str
    timeout: int = 30  # 超时时间（秒）


class CleanupScript(BaseModel):
    """清理环境脚本"""
    type: str = "sql"  # sql / shell
    description: Optional[str] = None
    content: str
    timeout: int = 10  # 超时时间（秒）


class FaultScenarioCreate(BaseModel):
    name: str
    type: str
    description: Optional[str] = None
    config: Dict[str, Any]
    setup_scripts: Optional[List[SetupScript]] = None  # 新增
    cleanup_scripts: Optional[List[CleanupScript]] = None  # 新增
    setup_timeout: Optional[int] = 60  # 新增
    cleanup_timeout: Optional[int] = 30  # 新增


class FaultScenarioUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    setup_scripts: Optional[List[SetupScript]] = None  # 新增
    cleanup_scripts: Optional[List[CleanupScript]] = None  # 新增
    setup_timeout: Optional[int] = None  # 新增
    cleanup_timeout: Optional[int] = None  # 新增


class FaultScenarioResponse(BaseModel):
    id: int
    name: str
    type: str
    description: Optional[str] = None
    config: Dict[str, Any]
    setup_scripts: Optional[List[Dict[str, Any]]] = None  # 新增
    cleanup_scripts: Optional[List[Dict[str, Any]]] = None  # 新增
    setup_timeout: Optional[int] = None  # 新增
    cleanup_timeout: Optional[int] = None  # 新增
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ==================== 演练 ====================

class DrillStepConfig(BaseModel):
    """演练步骤配置"""
    scenario_id: int
    step_order: int


class DrillCreate(BaseModel):
    """创建演练"""
    name: str
    description: Optional[str] = None
    execution_mode: str = "sequential"  # sequential / parallel
    db_config_id: int
    steps: List[DrillStepConfig]


class DrillUpdate(BaseModel):
    """更新演练"""
    name: Optional[str] = None
    description: Optional[str] = None
    execution_mode: Optional[str] = None
    steps: Optional[List[DrillStepConfig]] = None


class DrillResponse(BaseModel):
    """演练响应"""
    id: int
    name: str
    description: Optional[str] = None
    execution_mode: str
    db_config_id: int
    status: str
    total_steps: int
    current_step: Optional[int] = None
    progress_percent: Optional[int] = None
    current_phase: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    log: Optional[str] = None


class DrillStepResponse(BaseModel):
    """演练步骤响应"""
    id: int
    drill_id: int
    step_order: int
    scenario_id: int
    scenario_name: Optional[str] = None  # 包含场景名称
    status: str
    progress_percent: Optional[int] = None
    current_phase: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    log: Optional[str] = None


class DrillDetailResponse(BaseModel):
    """演练详情响应（包含步骤列表）"""
    id: int
    name: str
    description: Optional[str] = None
    execution_mode: str
    db_config_id: int
    db_config_name: Optional[str] = None  # 包含数据库配置名称
    status: str
    total_steps: int
    current_step: Optional[int] = None
    progress_percent: Optional[int] = None
    current_phase: Optional[str] = None
    steps: List[DrillStepResponse] = []
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    log: Optional[str] = None


# ==================== 故障注入 ====================

class InjectionStartRequest(BaseModel):
    scenario_id: int
    db_config_id: int


class InjectionRecordResponse(BaseModel):
    id: int
    scenario_id: int
    db_config_id: int
    status: str
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    log: Optional[str] = None


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    server_version: Optional[str] = None