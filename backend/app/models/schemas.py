from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


# ==================== 数据库配置 ====================

class DatabaseConfigCreate(BaseModel):
    name: str
    db_type: str = "postgresql"  # postgresql, opengauss, gaussdb
    connection_method: str = "psycopg2"  # asyncpg, psycopg2, gsql, jdbc
    deployment_mode: str = "centralized"  # centralized / distributed
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
    deployment_mode: Optional[str] = None
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
    deployment_mode: str
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
    mode: str = "all"  # centralized / distributed / all
    description: Optional[str] = None
    content: str
    timeout: int = 30  # 超时时间（秒）
    continue_on_error: bool = False  # 是否在失败时继续


class RunScript(BaseModel):
    """运行环节脚本（故障注入核心）"""
    type: str = "sql"  # sql / shell / stress
    mode: str = "all"  # centralized / distributed / all
    description: Optional[str] = None
    content: str
    timeout: int = 60  # 超时时间（秒）
    iterations: int = 1  # 执行次数（仅对 shell/sql 有效）
    interval_ms: int = 100  # 间隔毫秒（仅对 stress 有效）


class CleanupScript(BaseModel):
    """清理环境脚本"""
    type: str = "sql"  # sql / shell
    mode: str = "all"  # centralized / distributed / all
    description: Optional[str] = None
    content: str
    timeout: int = 10  # 超时时间（秒）
    continue_on_error: bool = True  # 清理环节默认失败继续


class FaultScenarioCreate(BaseModel):
    name: str
    type: str
    category1: Optional[str] = None  # 一级分类: 慢/满/宕/错
    category2: Optional[str] = None  # 二级分类: CPU/内存/磁盘/网络/连接等
    category3: Optional[str] = None  # 三级分类: 具体场景类型
    description: Optional[str] = None
    config: Dict[str, Any]
    # 三阶段脚本配置
    setup_scripts: Optional[List[SetupScript]] = None  # 前置环节
    run_scripts: Optional[List[RunScript]] = None  # 运行环节（新增）
    cleanup_scripts: Optional[List[CleanupScript]] = None  # 清理环节
    # 超时配置
    setup_timeout: Optional[int] = 60
    run_timeout: Optional[int] = 120  # 运行环节超时（新增）
    cleanup_timeout: Optional[int] = 30


class FaultScenarioUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    category1: Optional[str] = None  # 一级分类
    category2: Optional[str] = None  # 二级分类
    category3: Optional[str] = None  # 三级分类
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    # 三阶段脚本配置
    setup_scripts: Optional[List[SetupScript]] = None
    run_scripts: Optional[List[RunScript]] = None  # 新增
    cleanup_scripts: Optional[List[CleanupScript]] = None
    # 超时配置
    setup_timeout: Optional[int] = None
    run_timeout: Optional[int] = None  # 新增
    cleanup_timeout: Optional[int] = None


class FaultScenarioResponse(BaseModel):
    id: int
    name: str
    type: str
    category1: Optional[str] = None  # 一级分类
    category2: Optional[str] = None  # 二级分类
    category3: Optional[str] = None  # 三级分类
    description: Optional[str] = None
    config: Dict[str, Any]
    # 三阶段脚本配置
    setup_scripts: Optional[List[Dict[str, Any]]] = None  # 前置环节
    run_scripts: Optional[List[Dict[str, Any]]] = None  # 运行环节（新增）
    cleanup_scripts: Optional[List[Dict[str, Any]]] = None  # 清理环节
    # 超时配置
    setup_timeout: Optional[int] = None
    run_timeout: Optional[int] = None  # 新增
    cleanup_timeout: Optional[int] = None
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
    scenario: Optional[Dict[str, Any]] = None  # 包含完整场景信息
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


# ==================== SQL 控制台 ====================

class SqlExecuteRequest(BaseModel):
    """SQL 执行请求"""
    db_config_id: int
    sql: str
    limit: Optional[int] = 1000  # 结果行数限制


class SqlExecuteResponse(BaseModel):
    """SQL 执行响应"""
    success: bool
    message: Optional[str] = None
    columns: Optional[List[str]] = None  # 列名
    rows: Optional[List[List[Any]]] = None  # 行数据
    row_count: Optional[int] = None  # 返回行数
    execution_time: Optional[float] = None  # 执行时间（秒）