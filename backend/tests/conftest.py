import pytest
import asyncio
from sqlalchemy import text

pytest_plugins = ('pytest_asyncio',)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_db():
    from app.database import init_db, async_session
    await init_db()
    yield
    # Cleanup after each test
    async with async_session() as session:
        await session.execute(text("DELETE FROM injection_records"))
        await session.execute(text("DELETE FROM fault_scenarios"))
        await session.execute(text("DELETE FROM database_configs"))
        await session.commit()