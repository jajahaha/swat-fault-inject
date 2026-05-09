import asyncpg
import asyncio
from datetime import datetime
from typing import List, Dict
import json
from sqlalchemy import select

from app.database import async_session, InjectionRecord

active_injections: Dict[int, "FaultInjector"] = {}


class FaultInjector:
    def __init__(self, record_id: int, db_config, scenario_config: dict):
        self.record_id = record_id
        self.db_config = db_config
        self.config = scenario_config
        self.connections: List[asyncpg.Connection] = []
        self.running = False
        self.log_lines: List[str] = []

    async def run(self):
        self.running = True
        concurrency = self.config.get("concurrency", 50)
        duration = self.config.get("duration_seconds", 60)
        interval_ms = self.config.get("interval_ms", 100)
        query = self.config.get(
            "query_template",
            "SELECT count(*) FROM pg_catalog.pg_class a, pg_catalog.pg_class b, pg_catalog.pg_class c WHERE a.oid = b.oid AND b.oid = c.oid",
        )

        self.log(f"Starting injection with {concurrency} concurrent connections")
        self.log(f"Duration: {duration}s, Interval: {interval_ms}ms")

        try:
            # Create connections
            for i in range(concurrency):
                try:
                    conn = await asyncpg.connect(
                        host=self.db_config.host,
                        port=self.db_config.port,
                        database=self.db_config.database,
                        user=self.db_config.username,
                        password=self.db_config.password,
                    )
                    self.connections.append(conn)
                    self.log(f"Connection {i + 1}/{concurrency} established")
                except Exception as e:
                    self.log(f"Failed to create connection {i + 1}: {str(e)}")

            if not self.connections:
                self.log("No connections established, aborting")
                await self._update_status("failed")
                return

            self.log(f"Successfully created {len(self.connections)} connections")
            self.log("Starting concurrent query execution")

            # Run queries concurrently
            tasks = []
            for conn in self.connections:
                task = asyncio.create_task(self._run_queries(conn, query, interval_ms))
                tasks.append(task)

            # Wait for duration or until stopped
            try:
                await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=duration,
                )
            except asyncio.TimeoutError:
                self.log(f"Duration {duration}s reached, stopping")

            await self.stop()

        except Exception as e:
            self.log(f"Error during injection: {str(e)}")
            await self._update_status("failed")

    async def _run_queries(self, conn: asyncpg.Connection, query: str, interval_ms: int):
        while self.running:
            try:
                await conn.execute(query)
                await asyncio.sleep(interval_ms / 1000)
            except Exception as e:
                self.log(f"Query error: {str(e)}")
                await asyncio.sleep(1)

    async def stop(self):
        self.running = False
        self.log("Stopping injection")

        for i, conn in enumerate(self.connections):
            try:
                await conn.close()
                self.log(f"Connection {i + 1} closed")
            except Exception as e:
                self.log(f"Error closing connection {i + 1}: {str(e)}")

        self.connections.clear()
        await self._update_status("completed")
        if self.record_id in active_injections:
            del active_injections[self.record_id]

    def log(self, message: str):
        timestamp = datetime.utcnow().strftime("%H:%M:%S")
        self.log_lines.append(f"[{timestamp}] {message}")

    async def _update_status(self, status: str):
        async with async_session() as session:
            result = await session.execute(
                select(InjectionRecord).where(InjectionRecord.id == self.record_id)
            )
            record = result.scalar_one_or_none()
            if record:
                record.status = status
                record.ended_at = datetime.utcnow()
                record.log = "\n".join(self.log_lines)
                await session.commit()