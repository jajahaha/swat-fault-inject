from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.api.database_config import router as db_config_router
from app.api.fault_scenarios import router as fault_scenarios_router
from app.api.injection import router as injection_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="SWAT Fault Inject Platform",
    description="Database fault injection platform for testing high-load scenarios",
    version="1.4.3",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(db_config_router)
app.include_router(fault_scenarios_router)
app.include_router(injection_router)


@app.get("/")
async def root():
    return {"message": "SWAT Fault Inject Platform API", "version": "1.4.3"}