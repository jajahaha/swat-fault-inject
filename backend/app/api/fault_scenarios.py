from fastapi import APIRouter, HTTPException
from sqlalchemy import select, delete
from typing import List
import json

from app.database import async_session, FaultScenario
from app.models.schemas import (
    FaultScenarioCreate,
    FaultScenarioUpdate,
    FaultScenarioResponse,
)

router = APIRouter(prefix="/api/fault-scenarios", tags=["fault-scenarios"])


@router.get("", response_model=List[FaultScenarioResponse])
async def get_fault_scenarios():
    async with async_session() as session:
        result = await session.execute(select(FaultScenario))
        scenarios = result.scalars().all()
        return [scenario.to_dict() for scenario in scenarios]


@router.get("/{scenario_id}", response_model=FaultScenarioResponse)
async def get_fault_scenario(scenario_id: int):
    async with async_session() as session:
        result = await session.execute(
            select(FaultScenario).where(FaultScenario.id == scenario_id)
        )
        scenario = result.scalar_one_or_none()
        if not scenario:
            raise HTTPException(status_code=404, detail="Fault scenario not found")
        return scenario.to_dict()


@router.post("", response_model=FaultScenarioResponse)
async def create_fault_scenario(scenario: FaultScenarioCreate):
    async with async_session() as session:
        fault_scenario = FaultScenario(
            name=scenario.name,
            type=scenario.type,
            description=scenario.description,
            config=json.dumps(scenario.config),
            setup_scripts=json.dumps([s.dict() for s in scenario.setup_scripts]) if scenario.setup_scripts else None,
            cleanup_scripts=json.dumps([s.dict() for s in scenario.cleanup_scripts]) if scenario.cleanup_scripts else None,
            setup_timeout=scenario.setup_timeout,
            cleanup_timeout=scenario.cleanup_timeout,
        )
        session.add(fault_scenario)
        await session.commit()
        await session.refresh(fault_scenario)
        return fault_scenario.to_dict()


@router.put("/{scenario_id}", response_model=FaultScenarioResponse)
async def update_fault_scenario(scenario_id: int, scenario: FaultScenarioUpdate):
    async with async_session() as session:
        result = await session.execute(
            select(FaultScenario).where(FaultScenario.id == scenario_id)
        )
        fault_scenario = result.scalar_one_or_none()
        if not fault_scenario:
            raise HTTPException(status_code=404, detail="Fault scenario not found")

        update_data = scenario.dict(exclude_unset=True)
        for key, value in update_data.items():
            if key in ("config", "setup_scripts", "cleanup_scripts") and value is not None:
                if key == "setup_scripts" or key == "cleanup_scripts":
                    setattr(fault_scenario, key, json.dumps([s.dict() if hasattr(s, 'dict') else s for s in value]))
                else:
                    setattr(fault_scenario, key, json.dumps(value))
            else:
                setattr(fault_scenario, key, value)

        await session.commit()
        await session.refresh(fault_scenario)
        return fault_scenario.to_dict()


@router.delete("/{scenario_id}")
async def delete_fault_scenario(scenario_id: int):
    async with async_session() as session:
        result = await session.execute(
            select(FaultScenario).where(FaultScenario.id == scenario_id)
        )
        scenario = result.scalar_one_or_none()
        if not scenario:
            raise HTTPException(status_code=404, detail="Fault scenario not found")

        await session.delete(scenario)
        await session.commit()
        return {"message": "Fault scenario deleted successfully"}