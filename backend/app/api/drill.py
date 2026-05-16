"""
Drill API - 演练管理 API 路由

提供：
1. 创建演练
2. 启动/停止演练
3. 查询演练状态和进度
4. 演练列表
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import List
import asyncio
import json

from app.database import async_session, Drill, DrillStep, DatabaseConfig, FaultScenario
from app.models.schemas import (
    DrillCreate,
    DrillUpdate,
    DrillResponse,
    DrillStepResponse,
    DrillDetailResponse,
)
from app.services.drill_executor import DrillExecutor, active_drills

router = APIRouter(prefix="/api/drill", tags=["drill"])


@router.post("/create", response_model=DrillResponse)
async def create_drill(drill: DrillCreate):
    """创建演练"""
    async with async_session() as session:
        # 验证数据库配置存在
        db_result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == drill.db_config_id)
        )
        db_config = db_result.scalar_one_or_none()
        if not db_config:
            raise HTTPException(status_code=404, detail="Database config not found")

        # 验证所有场景存在
        for step in drill.steps:
            scenario_result = await session.execute(
                select(FaultScenario).where(FaultScenario.id == step.scenario_id)
            )
            scenario = scenario_result.scalar_one_or_none()
            if not scenario:
                raise HTTPException(
                    status_code=404,
                    detail=f"Fault scenario {step.scenario_id} not found"
                )

        # 创建演练记录
        new_drill = Drill(
            name=drill.name,
            description=drill.description,
            execution_mode=drill.execution_mode,
            db_config_id=drill.db_config_id,
            status="pending",
            total_steps=len(drill.steps),
            current_step=0,
            progress_percent=0,
        )
        session.add(new_drill)
        await session.commit()
        await session.refresh(new_drill)

        # 创建演练步骤记录
        for step in drill.steps:
            drill_step = DrillStep(
                drill_id=new_drill.id,
                step_order=step.step_order,
                scenario_id=step.scenario_id,
                status="pending",
                progress_percent=0,
            )
            session.add(drill_step)

        await session.commit()

        return new_drill.to_dict()


@router.post("/start/{drill_id}", response_model=DrillResponse)
async def start_drill(drill_id: int):
    """启动演练"""
    async with async_session() as session:
        # 获取演练记录
        result = await session.execute(
            select(Drill).where(Drill.id == drill_id)
        )
        drill = result.scalar_one_or_none()
        if not drill:
            raise HTTPException(status_code=404, detail="Drill not found")

        if drill.status != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Drill is already in status: {drill.status}"
            )

        # 获取数据库配置
        db_result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == drill.db_config_id)
        )
        db_config = db_result.scalar_one_or_none()
        if not db_config:
            raise HTTPException(status_code=404, detail="Database config not found")

        # 更新演练状态
        drill.status = "preparing"
        drill.started_at = datetime.utcnow()
        await session.commit()
        await session.refresh(drill)

        # 创建执行器并启动
        drill_config = {
            "execution_mode": drill.execution_mode,
        }

        executor = DrillExecutor(
            drill_id=drill_id,
            db_config=db_config,
            drill_config=drill_config,
        )

        asyncio.create_task(executor.run())
        active_drills[drill_id] = executor

        return drill.to_dict()


@router.post("/stop/{drill_id}", response_model=DrillResponse)
async def stop_drill(drill_id: int):
    """停止演练"""
    if drill_id not in active_drills:
        # 演练可能已经完成，直接返回状态
        async with async_session() as session:
            result = await session.execute(
                select(Drill).where(Drill.id == drill_id)
            )
            drill = result.scalar_one_or_none()
            if not drill:
                raise HTTPException(status_code=404, detail="Drill not found")
            return drill.to_dict()

    executor = active_drills[drill_id]
    await executor.stop()

    async with async_session() as session:
        result = await session.execute(
            select(Drill).where(Drill.id == drill_id)
        )
        drill = result.scalar_one_or_none()
        return drill.to_dict()


@router.get("/status/{drill_id}", response_model=DrillDetailResponse)
async def get_drill_status(drill_id: int):
    """获取演练状态和进度（包含步骤详情和完整场景信息）"""
    async with async_session() as session:
        # 获取演练
        drill_result = await session.execute(
            select(Drill).where(Drill.id == drill_id)
        )
        drill = drill_result.scalar_one_or_none()
        if not drill:
            raise HTTPException(status_code=404, detail="Drill not found")

        # 批量获取步骤列表
        steps_result = await session.execute(
            select(DrillStep).where(DrillStep.drill_id == drill_id).order_by(DrillStep.step_order)
        )
        steps = steps_result.scalars().all()

        # 批量获取所有相关场景的完整信息
        scenario_ids = [step.scenario_id for step in steps]
        if scenario_ids:
            scenarios_result = await session.execute(
                select(FaultScenario).where(FaultScenario.id.in_(scenario_ids))
            )
            scenarios = {s.id: s.to_dict() for s in scenarios_result.scalars().all()}
        else:
            scenarios = {}

        # 获取数据库配置名称
        db_result = await session.execute(
            select(DatabaseConfig.name).where(DatabaseConfig.id == drill.db_config_id)
        )
        db_name = db_result.scalar_one_or_none() or "Unknown"

        # 构建步骤响应，包含完整场景信息
        steps_with_scenarios = []
        for step in steps:
            step_dict = step.to_dict()
            # 包含完整的场景信息
            step_dict["scenario"] = scenarios.get(step.scenario_id, {"name": "Unknown"})
            step_dict["scenario_name"] = scenarios.get(step.scenario_id, {}).get("name", "Unknown")
            steps_with_scenarios.append(step_dict)

        # 构建响应
        response = drill.to_dict()
        response["steps"] = steps_with_scenarios
        response["db_config_name"] = db_name

        return response


@router.get("/batch-status")
async def get_batch_status(drill_ids: str):
    """批量获取演练状态（轻量版，用于轮询）"""
    # drill_ids 是逗号分隔的ID字符串
    ids = [int(id) for id in drill_ids.split(',') if id.strip()]

    if not ids:
        return []

    async with async_session() as session:
        # 批量查询所有演练
        drills_result = await session.execute(
            select(Drill).where(Drill.id.in_(ids))
        )
        drills = drills_result.scalars().all()
        drill_map = {d.id: d.to_dict() for d in drills}

        # 批量查询步骤
        steps_result = await session.execute(
            select(DrillStep).where(DrillStep.drill_id.in_(ids))
        )
        steps = steps_result.scalars().all()

        # 按演练ID分组步骤
        for step in steps:
            if step.drill_id in drill_map:
                if "steps" not in drill_map[step.drill_id]:
                    drill_map[step.drill_id]["steps"] = []
                drill_map[step.drill_id]["steps"].append(step.to_dict())

        # 返回按原始顺序的结果
        return [drill_map.get(id, {"id": id, "error": "not found"}) for id in ids]


@router.get("/list", response_model=List[DrillResponse])
async def get_drill_list():
    """获取演练列表"""
    async with async_session() as session:
        result = await session.execute(
            select(Drill).order_by(Drill.created_at.desc())
        )
        drills = result.scalars().all()
        return [drill.to_dict() for drill in drills]


@router.get("/step-status/{step_id}", response_model=DrillStepResponse)
async def get_step_status(step_id: int):
    """获取单个步骤状态"""
    async with async_session() as session:
        result = await session.execute(
            select(DrillStep).where(DrillStep.id == step_id)
        )
        step = result.scalar_one_or_none()
        if not step:
            raise HTTPException(status_code=404, detail="Step not found")

        # 获取场景名称
        scenario_result = await session.execute(
            select(FaultScenario).where(FaultScenario.id == step.scenario_id)
        )
        scenario = scenario_result.scalar_one_or_none()

        response = step.to_dict()
        response["scenario_name"] = scenario.name if scenario else "Unknown"

        return response


@router.delete("/{drill_id}")
async def delete_drill(drill_id: int):
    """删除演练"""
    async with async_session() as session:
        # 获取演练
        result = await session.execute(
            select(Drill).where(Drill.id == drill_id)
        )
        drill = result.scalar_one_or_none()
        if not drill:
            raise HTTPException(status_code=404, detail="Drill not found")

        if drill.status in ("running", "preparing", "cleaning"):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete a running drill"
            )

        # 先删除该演练的所有步骤
        steps_result = await session.execute(
            select(DrillStep).where(DrillStep.drill_id == drill_id)
        )
        steps = steps_result.scalars().all()
        for step in steps:
            await session.delete(step)

        # 再删除演练
        await session.delete(drill)
        await session.commit()

        return {"message": "Drill deleted successfully"}