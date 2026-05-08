import pytest
import asyncio
import os
from sqlalchemy import text

pytest_plugins = ('pytest_asyncio',)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Synchronous setup to delete database before tests
@pytest.fixture(scope="session", autouse=True)
def setup_db_session():
    # Delete old database once at session start
    from app.config import BASE_DIR
    db_path = os.path.join(BASE_DIR, "data.db")
    if os.path.exists(db_path):
        os.remove(db_path)
    yield


@pytest.fixture(autouse=True)
async def cleanup_data():
    yield
    # Cleanup after each test - clear data but keep schema
    from app.database import async_session
    async with async_session() as session:
        await session.execute(text("DELETE FROM injection_records"))
        await session.execute(text("DELETE FROM fault_scenarios"))
        await session.execute(text("DELETE FROM database_configs"))
        await session.commit()