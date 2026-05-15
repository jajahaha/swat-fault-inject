"""
数据库配置导入导出 API
"""
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from sqlalchemy import select
import io
import zipfile
from datetime import datetime
from typing import List

from app.database import DatabaseConfig, async_session
from app.services.db_config_yaml import DbConfigYamlParser, create_zip_from_configs


router = APIRouter(prefix="/api/database-configs", tags=["db-config-import-export"])

parser = DbConfigYamlParser()


@router.post("/import")
async def import_db_config(file: UploadFile = File(...)):
    """导入单个数据库配置 YAML 文件"""

    # 检查文件类型
    if not file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="文件必须是 YAML 格式")

    # 读取文件内容
    content = await file.read()

    # 检查文件大小
    if len(content) > 50 * 1024:  # 50KB 限制
        raise HTTPException(status_code=400, detail="文件大小不能超过 50KB")

    try:
        yaml_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="文件编码必须是 UTF-8")

    # 解析 YAML
    config_create, errors = parser.parse_yaml_to_config(yaml_content)

    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    # 检查是否已存在同名配置
    async with async_session() as session:
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.name == config_create.name)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # 更新现有配置
            existing.name = config_create.name
            existing.db_type = config_create.db_type
            existing.connection_method = config_create.connection_method
            existing.deployment_mode = config_create.deployment_mode
            existing.host = config_create.host
            existing.port = config_create.port
            existing.database = config_create.database
            existing.username = config_create.username
            existing.password = config_create.password
            existing.jdbc_driver_path = config_create.jdbc_driver_path
            existing.updated_at = datetime.utcnow()

            await session.commit()
            await session.refresh(existing)

            return {
                "success": True,
                "config": existing.to_dict(),
                "message": f"配置 '{config_create.name}' 已更新"
            }
        else:
            # 创建新配置
            new_config = DatabaseConfig(
                name=config_create.name,
                db_type=config_create.db_type,
                connection_method=config_create.connection_method,
                deployment_mode=config_create.deployment_mode,
                host=config_create.host,
                port=config_create.port,
                database=config_create.database,
                username=config_create.username,
                password=config_create.password,
                jdbc_driver_path=config_create.jdbc_driver_path,
            )

            session.add(new_config)
            await session.commit()
            await session.refresh(new_config)

            return {
                "success": True,
                "config": new_config.to_dict(),
                "message": f"配置 '{config_create.name}' 导入成功"
            }


@router.post("/import-batch")
async def import_db_configs_batch(files: List[UploadFile] = File(...)):
    """批量导入数据库配置"""

    results = {
        "success": [],
        "failed": [],
        "total": len(files),
    }

    async with async_session() as session:
        for file in files:
            if not file.filename.endswith(('.yaml', '.yml')):
                results["failed"].append({
                    "filename": file.filename,
                    "error": "文件必须是 YAML 格式"
                })
                continue

            try:
                content = await file.read()
                yaml_content = content.decode('utf-8')

                config_create, errors = parser.parse_yaml_to_config(yaml_content)

                if errors:
                    results["failed"].append({
                        "filename": file.filename,
                        "errors": errors
                    })
                    continue

                # 检查是否存在
                result = await session.execute(
                    select(DatabaseConfig).where(DatabaseConfig.name == config_create.name)
                )
                existing = result.scalar_one_or_none()

                if existing:
                    # 更新
                    existing.name = config_create.name
                    existing.db_type = config_create.db_type
                    existing.connection_method = config_create.connection_method
                    existing.deployment_mode = config_create.deployment_mode
                    existing.host = config_create.host
                    existing.port = config_create.port
                    existing.database = config_create.database
                    existing.username = config_create.username
                    existing.password = config_create.password
                    existing.jdbc_driver_path = config_create.jdbc_driver_path
                    existing.updated_at = datetime.utcnow()

                    results["success"].append({
                        "filename": file.filename,
                        "config_name": config_create.name,
                        "action": "updated"
                    })
                else:
                    # 创建
                    new_config = DatabaseConfig(
                        name=config_create.name,
                        db_type=config_create.db_type,
                        connection_method=config_create.connection_method,
                        deployment_mode=config_create.deployment_mode,
                        host=config_create.host,
                        port=config_create.port,
                        database=config_create.database,
                        username=config_create.username,
                        password=config_create.password,
                        jdbc_driver_path=config_create.jdbc_driver_path,
                    )
                    session.add(new_config)

                    results["success"].append({
                        "filename": file.filename,
                        "config_name": config_create.name,
                        "action": "created"
                    })

            except Exception as e:
                results["failed"].append({
                    "filename": file.filename,
                    "error": str(e)
                })

        await session.commit()

    return results


@router.get("/export-all")
async def export_all_db_configs():
    """导出所有数据库配置"""

    async with async_session() as session:
        result = await session.execute(select(DatabaseConfig))
        configs = [c.to_dict() for c in result.scalars().all()]

        if not configs:
            raise HTTPException(status_code=404, detail="没有可导出的配置")

        # 创建 ZIP
        zip_content = create_zip_from_configs(configs)

        return Response(
            content=zip_content,
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=all_db_configs_export.zip"
            }
        )


@router.get("/export/{config_id}")
async def export_db_config(config_id: int):
    """导出单个数据库配置"""

    async with async_session() as session:
        result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == config_id)
        )
        config = result.scalar_one_or_none()

        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")

        # 转换为 YAML
        yaml_content = parser.config_to_yaml(config.to_dict())

        # 生成文件名
        safe_name = config.name.replace(" ", "_").replace("/", "_")
        filename = f"db_config_{safe_name}.yaml"

        return Response(
            content=yaml_content,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )


@router.post("/export-batch")
async def export_db_configs_batch(config_ids: List[int]):
    """批量导出数据库配置"""

    async with async_session() as session:
        configs = []
        for cid in config_ids:
            result = await session.execute(
                select(DatabaseConfig).where(DatabaseConfig.id == cid)
            )
            config = result.scalar_one_or_none()
            if config:
                configs.append(config.to_dict())

        if not configs:
            raise HTTPException(status_code=404, detail="没有找到可导出的配置")

        # 创建 ZIP
        zip_content = create_zip_from_configs(configs)

        return Response(
            content=zip_content,
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=db_configs_export.zip"
            }
        )


@router.post("/validate")
async def validate_db_config_yaml(file: UploadFile = File(...)):
    """验证 YAML 文件格式（不导入）"""

    if not file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="文件必须是 YAML 格式")

    content = await file.read()

    try:
        yaml_content = content.decode('utf-8')
    except UnicodeDecodeError:
        return {"valid": False, "errors": ["文件编码必须是 UTF-8"]}

    config_create, errors = parser.parse_yaml_to_config(yaml_content)

    if errors:
        return {"valid": False, "errors": errors}

    return {
        "valid": True,
        "preview": {
            "name": config_create.name,
            "db_type": config_create.db_type,
            "connection_method": config_create.connection_method,
            "deployment_mode": config_create.deployment_mode,
            "host": config_create.host,
            "port": config_create.port,
            "database": config_create.database,
            "username": config_create.username,
        }
    }