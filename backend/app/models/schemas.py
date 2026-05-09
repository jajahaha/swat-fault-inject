from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


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


class FaultScenarioCreate(BaseModel):
    name: str
    type: str
    description: Optional[str] = None
    config: Dict[str, Any]


class FaultScenarioUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class FaultScenarioResponse(BaseModel):
    id: int
    name: str
    type: str
    description: Optional[str] = None
    config: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


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