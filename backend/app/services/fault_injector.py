import asyncpg
import asyncio
import threading
import psycopg2
from datetime import datetime
from typing import List, Dict, Any
import json
from sqlalchemy import select
from concurrent.futures import ThreadPoolExecutor

from app.database import async_session, InjectionRecord

active_injections: Dict[int, "FaultInjector"] = {}

# Thread pool for psycopg2 synchronous operations
psycopg2_executor = ThreadPoolExecutor(max_workers=200)


class FaultInjector:
    def __init__(self, record_id: int, db_config, scenario_config: dict):
        self.record_id = record_id
        self.db_config = db_config
        self.config = scenario_config
        self.connections: List[Any] = []  # Can be asyncpg.Connection or psycopg2 connection
        self.connection_type = "asyncpg"  # Track which driver we're using
        self.running = False
        self.log_lines: List[str] = []
        self._stop_event = threading.Event()  # For psycopg2 threads

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
            # For GaussDB/openGauss, use psycopg2 for better sha256 compatibility
            if self.db_config.db_type in ("gaussdb", "opengauss"):
                self.connection_type = "psycopg2"
                self.log(f"Using psycopg2 driver for {self.db_config.db_type}")
                await self._run_psycopg2(concurrency, duration, query, interval_ms)
            else:
                self.connection_type = "asyncpg"
                self.log(f"Using asyncpg driver for {self.db_config.db_type}")
                await self._run_asyncpg(concurrency, duration, query, interval_ms)

            await self.stop()

        except Exception as e:
            self.log(f"Error during injection: {str(e)}")
            await self._update_status("failed")

    async def _run_asyncpg(self, concurrency: int, duration: int, query: str, interval_ms: int):
        """Run injection using asyncpg (for PostgreSQL)"""
        # Create connections
        for i in range(concurrency):
            try:
                connect_params = {
                    "host": self.db_config.host,
                    "port": self.db_config.port,
                    "database": self.db_config.database,
                    "user": self.db_config.username,
                    "password": self.db_config.password,
                }

                conn = await asyncpg.connect(**connect_params)
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
            task = asyncio.create_task(self._run_asyncpg_queries(conn, query, interval_ms))
            tasks.append(task)

        # Wait for duration or until stopped
        try:
            await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=duration,
            )
        except asyncio.TimeoutError:
            self.log(f"Duration {duration}s reached, stopping")

    async def _run_asyncpg_queries(self, conn: asyncpg.Connection, query: str, interval_ms: int):
        while self.running:
            try:
                await conn.execute(query)
                await asyncio.sleep(interval_ms / 1000)
            except Exception as e:
                self.log(f"Query error: {str(e)}")
                await asyncio.sleep(1)

    async def _run_psycopg2(self, concurrency: int, duration: int, query: str, interval_ms: int):
        """Run injection using psycopg2 with threading (for GaussDB/openGauss)"""

        def create_connection():
            return psycopg2.connect(
                host=self.db_config.host,
                port=self.db_config.port,
                database=self.db_config.database,
                user=self.db_config.username,
                password=self.db_config.password,
            )

        # Create connections in thread pool
        for i in range(concurrency):
            try:
                conn = await asyncio.to_thread(create_connection)
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

        # Run queries in threads
        threads = []
        for conn in self.connections:
            thread = threading.Thread(
                target=self._run_psycopg2_queries,
                args=(conn, query, interval_ms),
                daemon=True
            )
            thread.start()
            threads.append(thread)

        # Wait for duration
        await asyncio.sleep(duration)
        self.log(f"Duration {duration}s reached, stopping")

        # Signal threads to stop
        self._stop_event.set()

    def _run_psycopg2_queries(self, conn, query: str, interval_ms: int):
        """Run queries in a thread for psycopg2 connection"""
        interval_sec = interval_ms / 1000
        while self.running and not self._stop_event.is_set():
            try:
                cursor = conn.cursor()
                cursor.execute(query)
                cursor.close()
                self._stop_event.wait(interval_sec)
            except Exception as e:
                self.log(f"Query error: {str(e)}")
                self._stop_event.wait(1)

    async def stop(self):
        self.running = False
        self._stop_event.set()
        self.log("Stopping injection")

        for i, conn in enumerate(self.connections):
            try:
                if self.connection_type == "asyncpg":
                    await conn.close()
                else:
                    await asyncio.to_thread(conn.close)
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