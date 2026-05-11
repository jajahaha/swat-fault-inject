"""
故障场景导入导出 API
"""
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
import io
import zipfile
from datetime import datetime
from typing import List, Optional

from app.database import FaultScenario, async_session
from app.models.schemas import FaultScenarioResponse
from app.services.scenario_yaml import ScenarioYamlParser, create_zip_from_scenarios


router = APIRouter(prefix="/api/fault-scenarios", tags=["scenario-import-export"])

parser = ScenarioYamlParser()


@router.post("/import")
async def import_scenario(file: UploadFile = File(...)):
    """导入单个故障场景 YAML 文件"""
    
    # 检查文件类型
    if not file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="文件必须是 YAML 格式")
    
    # 读取文件内容
    content = await file.read()
    
    # 检查文件大小
    if len(content) > 100 * 1024:  # 100KB 限制
        raise HTTPException(status_code=400, detail="文件大小不能超过 100KB")
    
    try:
        yaml_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="文件编码必须是 UTF-8")
    
    # 解析 YAML
    scenario_create, errors = parser.parse_yaml_to_scenario(yaml_content)
    
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    # 检查是否已存在同名场景
    async with async_session() as session:
        result = await session.execute(
            select(FaultScenario).where(FaultScenario.name == scenario_create.name)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            # 更新现有场景
            existing.name = scenario_create.name
            existing.type = scenario_create.type
            existing.description = scenario_create.description
            existing.config = json.dumps(scenario_create.config)  # 转为 JSON 字符串
            existing.setup_scripts = json.dumps([s.dict() for s in (scenario_create.setup_scripts or [])])  # 转为 JSON 字符串
            existing.cleanup_scripts = json.dumps([s.dict() for s in (scenario_create.cleanup_scripts or [])])  # 转为 JSON 字符串
            existing.setup_timeout = scenario_create.setup_timeout
            existing.cleanup_timeout = scenario_create.cleanup_timeout
            existing.updated_at = datetime.utcnow()
            
            await session.commit()
            await session.refresh(existing)
            
            return {
                "success": True,
                "scenario": existing.to_dict(),
                "message": f"场景 '{scenario_create.name}' 已更新"
            }
        else:
            # 创建新场景
            new_scenario = FaultScenario(
                name=scenario_create.name,
                type=scenario_create.type,
                description=scenario_create.description,
                config=json.dumps(scenario_create.config),  # 转为 JSON 字符串
                setup_scripts=json.dumps([s.dict() for s in (scenario_create.setup_scripts or [])]),  # 转为 JSON 字符串
                cleanup_scripts=json.dumps([s.dict() for s in (scenario_create.cleanup_scripts or [])]),  # 转为 JSON 字符串
                setup_timeout=scenario_create.setup_timeout,
                cleanup_timeout=scenario_create.cleanup_timeout,
            )
            
            session.add(new_scenario)
            await session.commit()
            await session.refresh(new_scenario)
            
            return {
                "success": True,
                "scenario": new_scenario.to_dict(),
                "message": f"场景 '{scenario_create.name}' 导入成功"
            }


@router.post("/import-batch")
async def import_scenarios_batch(files: List[UploadFile] = File(...)):
    """批量导入故障场景"""
    
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
                
                scenario_create, errors = parser.parse_yaml_to_scenario(yaml_content)
                
                if errors:
                    results["failed"].append({
                        "filename": file.filename,
                        "errors": errors
                    })
                    continue
                
                # 检查是否存在
                result = await session.execute(
                    select(FaultScenario).where(FaultScenario.name == scenario_create.name)
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    # 更新
                    existing.name = scenario_create.name
                    existing.type = scenario_create.type
                    existing.description = scenario_create.description
                    existing.config = json.dumps(scenario_create.config)  # 转为 JSON 字符串
                    existing.setup_scripts = json.dumps([s.dict() for s in (scenario_create.setup_scripts or [])])  # 转为 JSON 字符串
                    existing.cleanup_scripts = json.dumps([s.dict() for s in (scenario_create.cleanup_scripts or [])])  # 转为 JSON 字符串
                    existing.setup_timeout = scenario_create.setup_timeout
                    existing.cleanup_timeout = scenario_create.cleanup_timeout
                    existing.updated_at = datetime.utcnow()
                    
                    results["success"].append({
                        "filename": file.filename,
                        "scenario_name": scenario_create.name,
                        "action": "updated"
                    })
                else:
                    # 创建
                    new_scenario = FaultScenario(
                        name=scenario_create.name,
                        type=scenario_create.type,
                        description=scenario_create.description,
                        config=json.dumps(scenario_create.config),  # 转为 JSON 字符串
                        setup_scripts=json.dumps([s.dict() for s in (scenario_create.setup_scripts or [])]),  # 转为 JSON 字符串
                        cleanup_scripts=json.dumps([s.dict() for s in (scenario_create.cleanup_scripts or [])]),  # 转为 JSON 字符串
                        setup_timeout=scenario_create.setup_timeout,
                        cleanup_timeout=scenario_create.cleanup_timeout,
                    )
                    session.add(new_scenario)
                    
                    results["success"].append({
                        "filename": file.filename,
                        "scenario_name": scenario_create.name,
                        "action": "created"
                    })
                    
            except Exception as e:
                results["failed"].append({
                    "filename": file.filename,
                    "error": str(e)
                })
        
        await session.commit()
    
    return results


@router.get("/export/{scenario_id}")
async def export_scenario(scenario_id: int):
    """导出单个故障场景"""
    
    async with async_session() as session:
        result = await session.execute(
            select(FaultScenario).where(FaultScenario.id == scenario_id)
        )
        scenario = result.scalar_one_or_none()
        
        if not scenario:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 转换为 YAML
        yaml_content = parser.scenario_to_yaml(scenario.to_dict())
        
        # 生成文件名（使用 ID 避免中文编码问题）
        filename = f"scenario_{scenario.id}.yaml"
        
        return Response(
            content=yaml_content,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )


@router.post("/export-batch")
async def export_scenarios_batch(scenario_ids: List[int]):
    """批量导出故障场景"""
    
    async with async_session() as session:
        scenarios = []
        for sid in scenario_ids:
            result = await session.execute(
                select(FaultScenario).where(FaultScenario.id == sid)
            )
            scenario = result.scalar_one_or_none()
            if scenario:
                scenarios.append(scenario.to_dict())
        
        if not scenarios:
            raise HTTPException(status_code=404, detail="没有找到可导出的场景")
        
        # 创建 ZIP
        zip_content = create_zip_from_scenarios(scenarios)
        
        return Response(
            content=zip_content,
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=scenarios_export.zip"
            }
        )


@router.get("/export-all")
async def export_all_scenarios():
    """导出所有故障场景"""
    
    async with async_session() as session:
        result = await session.execute(select(FaultScenario))
        scenarios = [s.to_dict() for s in result.scalars().all()]
        
        if not scenarios:
            raise HTTPException(status_code=404, detail="没有可导出的场景")
        
        # 创建 ZIP
        zip_content = create_zip_from_scenarios(scenarios)
        
        return Response(
            content=zip_content,
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=all_scenarios_export.zip"
            }
        )


@router.post("/validate")
async def validate_scenario_yaml(file: UploadFile = File(...)):
    """验证 YAML 文件格式（不导入）"""
    
    if not file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="文件必须是 YAML 格式")
    
    content = await file.read()
    
    try:
        yaml_content = content.decode('utf-8')
    except UnicodeDecodeError:
        return {"valid": False, "errors": ["文件编码必须是 UTF-8"]}
    
    scenario_create, errors = parser.parse_yaml_to_scenario(yaml_content)
    
    if errors:
        return {"valid": False, "errors": errors}
    
    return {
        "valid": True,
        "preview": {
            "name": scenario_create.name,
            "type": scenario_create.type,
            "description": scenario_create.description,
            "config": scenario_create.config,
            "has_setup": bool(scenario_create.setup_scripts),
            "has_cleanup": bool(scenario_create.cleanup_scripts),
        }
    }