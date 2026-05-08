from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from datetime import datetime
import asyncio
import json

from app.database import async_session, DatabaseConfig, FaultScenario, InjectionRecord
from app.models.schemas import InjectionStartRequest, InjectionRecordResponse
from app.services.fault_injector import FaultInjector, active_injections

router = APIRouter(prefix="/api/injection", tags=["injection"])


@router.post("/start", response_model=InjectionRecordResponse)
async def start_injection(request: InjectionStartRequest):
    async with async_session() as session:
        db_result = await session.execute(
            select(DatabaseConfig).where(DatabaseConfig.id == request.db_config_id)
        )
        db_config = db_result.scalar_one_or_none()
        if not db_config:
            raise HTTPException(status_code=404, detail="Database config not found")

        scenario_result = await session.execute(
            select(FaultScenario).where(FaultScenario.id == request.scenario_id)
        )
        scenario = scenario_result.scalar_one_or_none()
        if not scenario:
            raise HTTPException(status_code=404, detail="Fault scenario not found")

        record = InjectionRecord(
            scenario_id=request.scenario_id,
            db_config_id=request.db_config_id,
            status="running",
            started_at=datetime.utcnow(),
        )
        session.add(record)
        await session.commit()
        await session.refresh(record)

        injector = FaultInjector(
            record_id=record.id,
            db_config=db_config,
            scenario_config=json.loads(scenario.config),
        )
        asyncio.create_task(injector.run())
        active_injections[record.id] = injector

        return record.to_dict()


@router.post("/stop/{record_id}", response_model=InjectionRecordResponse)
async def stop_injection(record_id: int):
    if record_id not in active_injections:
        async with async_session() as session:
            result = await session.execute(
                select(InjectionRecord).where(InjectionRecord.id == record_id)
            )
            record = result.scalar_one_or_none()
            if not record:
                raise HTTPException(status_code=404, detail="Injection record not found")
            return record.to_dict()

    injector = active_injections[record_id]
    await injector.stop()

    async with async_session() as session:
        result = await session.execute(
            select(InjectionRecord).where(InjectionRecord.id == record_id)
        )
        record = result.scalar_one_or_none()
        return record.to_dict()


@router.get("/status/{record_id}", response_model=InjectionRecordResponse)
async def get_injection_status(record_id: int):
    async with async_session() as session:
        result = await session.execute(
            select(InjectionRecord).where(InjectionRecord.id == record_id)
        )
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=404, detail="Injection record not found")
        return record.to_dict()


@router.get("/records", response_model=list[InjectionRecordResponse])
async def get_injection_records():
    async with async_session() as session:
        result = await session.execute(
            select(InjectionRecord).order_by(InjectionRecord.started_at.desc())
        )
        records = result.scalars().all()
        return [record.to_dict() for record in records]