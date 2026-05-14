import asyncpg
import asyncio
import threading
import psycopg2
import subprocess
import os
import shlex
import sys
from datetime import datetime
from typing import List, Dict, Any
import json
from sqlalchemy import select
from concurrent.futures import ThreadPoolExecutor

from app.database import async_session, InjectionRecord

active_injections: Dict[int, "FaultInjector"] = {}

# Thread pool for synchronous operations
sync_executor = ThreadPoolExecutor(max_workers=200)


# Python 3.7 compatible async thread wrapper
async def run_sync(func, *args):
    """Run synchronous function in thread pool (Python 3.7 compatible)"""
    loop = asyncio.get_event_loop()
    if args:
        return await loop.run_in_executor(None, lambda: func(*args))
    return await loop.run_in_executor(None, func)


class FaultInjector:
    def __init__(self, record_id: int, db_config, scenario_config: dict):
        self.record_id = record_id
        self.db_config = db_config
        self.config = scenario_config
        self.connections: List[Any] = []  # Can be asyncpg.Connection, psycopg2 connection, or subprocess
        self.connection_method = "asyncpg"
        self.running = False
        self.log_lines: List[str] = []
        self._stop_event = threading.Event()
        self.gsql_processes: List[subprocess.Popen] = []  # Track gsql subprocesses

    async def run(self):
        self.running = True
        self.connection_method = self.db_config.connection_method

        concurrency = self.config.get("concurrency", 50)
        duration = self.config.get("duration_seconds", 60)
        interval_ms = self.config.get("interval_ms", 100)
        query = self.config.get(
            "query_template",
            "SELECT count(*) FROM pg_catalog.pg_class a, pg_catalog.pg_class b, pg_catalog.pg_class c WHERE a.oid = b.oid AND b.oid = c.oid",
        )

        self.log(f"Starting injection with {concurrency} concurrent connections")
        self.log(f"Connection method: {self.connection_method}")
        self.log(f"Duration: {duration}s, Interval: {interval_ms}ms")

        try:
            # Route to appropriate injection method
            if self.connection_method == "asyncpg":
                await self._run_asyncpg(concurrency, duration, query, interval_ms)
            elif self.connection_method == "psycopg2":
                await self._run_psycopg2(concurrency, duration, query, interval_ms)
            elif self.connection_method == "gsql":
                await self._run_gsql(concurrency, duration, query, interval_ms)
            elif self.connection_method == "jdbc":
                await self._run_jdbc(concurrency, duration, query, interval_ms)
            else:
                self.log(f"Unsupported connection method: {self.connection_method}")
                await self._update_status("failed")
                return

            await self.stop()

        except Exception as e:
            self.log(f"Error during injection: {str(e)}")
            await self._update_status("failed")

    async def _run_asyncpg(self, concurrency: int, duration: int, query: str, interval_ms: int):
        """Run injection using asyncpg (for PostgreSQL)"""
        self.log("Using asyncpg driver")

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
            task = asyncio.create_task(self._run_asyncpg_queries(conn, query, interval_ms))
            tasks.append(task)

        # Wait for duration
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
        self.log("Using psycopg2 driver")

        def create_connection():
            # GaussDB/openGauss sha256 认证可能需要 SSL 参数
            connect_params = {
                "host": self.db_config.host,
                "port": self.db_config.port,
                "database": self.db_config.database,
                "user": self.db_config.username,
                "password": self.db_config.password,
            }
            # 添加 SSL 支持（GaussDB/openGauss sha256 认证需要）
            if self.db_config.db_type in ("gaussdb", "opengauss"):
                connect_params["sslmode"] = "prefer"

            return psycopg2.connect(**connect_params)

        # Create connections in thread pool
        for i in range(concurrency):
            try:
                conn = await run_sync(create_connection)
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

    async def _run_gsql(self, concurrency: int, duration: int, query: str, interval_ms: int):
        """Run injection using gsql command line tool"""
        self.log("Using gsql command line tool")
        self.log(f"Note: gsql should be run by OS user 'service'")

        # Find gsql executable
        gsql_path = "gsql"
        gsql_paths = [
            "gsql",
            "/usr/bin/gsql",
            "/usr/local/bin/gsql",
            "/opt/gaussdb/bin/gsql",
            "/opt/opengauss/bin/gsql",
            "/home/service/gsql",
        ]
        for path in gsql_paths:
            if os.path.exists(path):
                gsql_path = path
                break

        if not os.path.exists(gsql_path):
            self.log(f"gsql not found at expected paths")
            await self._update_status("failed")
            return

        self.log(f"Using gsql at: {gsql_path}")

        # Build base gsql command
        base_cmd = [
            gsql_path,
            "-h", self.db_config.host,
            "-p", str(self.db_config.port),
            "-d", self.db_config.database,
            "-U", self.db_config.username,
            "-W", self.db_config.password,
            "-r",  # Remote connection
        ]

        # Create concurrent gsql sessions
        for i in range(concurrency):
            try:
                # Each gsql process runs queries in a loop
                env = os.environ.copy()
                env["PGPASSWORD"] = self.db_config.password

                # Start gsql process
                process = await run_sync(
                    lambda: subprocess.Popen(
                        base_cmd,
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        env=env,
                    )
                )
                self.gsql_processes.append(process)
                self.log(f"gsql session {i + 1}/{concurrency} started")
            except Exception as e:
                self.log(f"Failed to start gsql session {i + 1}: {str(e)}")

        if not self.gsql_processes:
            self.log("No gsql sessions started, aborting")
            await self._update_status("failed")
            return

        self.log(f"Successfully started {len(self.gsql_processes)} gsql sessions")
        self.log("Starting concurrent query execution via gsql")

        # Run queries in gsql processes
        threads = []
        for process in self.gsql_processes:
            thread = threading.Thread(
                target=self._run_gsql_queries,
                args=(process, query, interval_ms),
                daemon=True
            )
            thread.start()
            threads.append(thread)

        # Wait for duration
        await asyncio.sleep(duration)
        self.log(f"Duration {duration}s reached, stopping")

        # Signal threads to stop
        self._stop_event.set()

    def _run_gsql_queries(self, process: subprocess.Popen, query: str, interval_ms: int):
        """Run queries in a gsql process"""
        interval_sec = interval_ms / 1000
        while self.running and not self._stop_event.is_set():
            try:
                # Send query to gsql stdin
                process.stdin.write((query + "\n").encode())
                process.stdin.flush()
                self._stop_event.wait(interval_sec)
            except Exception as e:
                self.log(f"gsql query error: {str(e)}")
                self._stop_event.wait(1)

    async def _run_jdbc(self, concurrency: int, duration: int, query: str, interval_ms: int):
        """Run injection using JDBC driver"""
        self.log("Using JDBC driver")

        driver_path = self.db_config.jdbc_driver_path
        if not driver_path:
            self.log("JDBC driver path not configured")
            await self._update_status("failed")
            return

        # Check driver file
        if not os.path.exists(driver_path):
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
            full_path = os.path.join(project_root, driver_path)
            if os.path.exists(full_path):
                driver_path = full_path
            else:
                self.log(f"JDBC driver file not found: {driver_path}")
                await self._update_status("failed")
                return

        # Driver class names
        driver_classes = {
            "postgresql": "org.postgresql.Driver",
            "opengauss": "org.opengauss.Driver",
            "gaussdb": "com.huawei.gaussdb.jdbc.Driver",
        }
        driver_class = driver_classes.get(self.db_config.db_type, "org.postgresql.Driver")

        # JDBC URL with sha256 auth support for GaussDB
        if self.db_config.db_type == "gaussdb":
            # GaussDB 需要指定 authmode=sha256 来支持 sha256 认证
            jdbc_url = f"jdbc:gaussdb://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}?authmode=sha256"
        elif self.db_config.db_type == "opengauss":
            # openGauss 也可能需要 sha256 认证支持
            jdbc_url = f"jdbc:opengauss://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}?authmode=sha256"
        else:
            jdbc_url = f"jdbc:{self.db_config.db_type}://{self.db_config.host}:{self.db_config.port}/{self.db_config.database}"

        self.log(f"JDBC URL: {jdbc_url}")
        self.log(f"Driver: {driver_class}")

        def create_jdbc_connection():
            try:
                import jaydebeapi
                conn = jaydebeapi.connect(
                    driver_class,
                    jdbc_url,
                    [self.db_config.username, self.db_config.password],
                    driver_path,
                )
                return conn
            except ImportError:
                raise Exception("jaydebeapi not installed. Run: pip install jaydebeapi JPype1")

        # Create connections
        for i in range(concurrency):
            try:
                conn = await run_sync(create_jdbc_connection)
                self.connections.append(conn)
                self.log(f"JDBC connection {i + 1}/{concurrency} established")
            except Exception as e:
                self.log(f"Failed to create JDBC connection {i + 1}: {str(e)}")

        if not self.connections:
            self.log("No JDBC connections established, aborting")
            await self._update_status("failed")
            return

        self.log(f"Successfully created {len(self.connections)} JDBC connections")
        self.log("Starting concurrent query execution")

        # Run queries in threads
        threads = []
        for conn in self.connections:
            thread = threading.Thread(
                target=self._run_jdbc_queries,
                args=(conn, query, interval_ms),
                daemon=True
            )
            thread.start()
            threads.append(thread)

        # Wait for duration
        await asyncio.sleep(duration)
        self.log(f"Duration {duration}s reached, stopping")

        self._stop_event.set()

    def _run_jdbc_queries(self, conn, query: str, interval_ms: int):
        """Run queries in a thread for JDBC connection"""
        interval_sec = interval_ms / 1000
        while self.running and not self._stop_event.is_set():
            try:
                cursor = conn.cursor()
                cursor.execute(query)
                cursor.close()
                self._stop_event.wait(interval_sec)
            except Exception as e:
                self.log(f"JDBC query error: {str(e)}")
                self._stop_event.wait(1)

    async def stop(self):
        self.running = False
        self._stop_event.set()
        self.log("Stopping injection")

        # Close connections based on method
        for i, conn in enumerate(self.connections):
            try:
                if self.connection_method == "asyncpg":
                    await conn.close()
                else:
                    await run_sync(conn.close)
                self.log(f"Connection {i + 1} closed")
            except Exception as e:
                self.log(f"Error closing connection {i + 1}: {str(e)}")

        # Terminate gsql processes
        for i, process in enumerate(self.gsql_processes):
            try:
                process.terminate()
                process.wait(timeout=2)
                self.log(f"gsql session {i + 1} terminated")
            except Exception as e:
                self.log(f"Error terminating gsql session {i + 1}: {str(e)}")

        self.connections.clear()
        self.gsql_processes.clear()
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