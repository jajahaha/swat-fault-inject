import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db


@pytest.fixture
async def client():
    # Initialize database before creating client
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestRootEndpoint:
    """测试根路由"""

    async def test_root_returns_message(self, client):
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "SWAT Fault Inject Platform API"
        assert data["version"] == "1.1.4"


class TestDatabaseConfigAPI:
    """测试数据库配置API"""

    async def test_get_database_types(self, client):
        response = await client.get("/api/database-configs/types")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert any(t["value"] == "postgresql" for t in data)
        assert any(t["value"] == "opengauss" for t in data)
        assert any(t["value"] == "gaussdb" for t in data)

    async def test_create_database_config(self, client):
        config_data = {
            "name": "测试数据库",
            "db_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "testdb",
            "username": "testuser",
            "password": "testpass",
        }
        response = await client.post("/api/database-configs", json=config_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "测试数据库"
        assert data["db_type"] == "postgresql"
        assert data["host"] == "localhost"
        assert data["port"] == 5432
        assert "id" in data

    async def test_create_opengauss_config(self, client):
        config_data = {
            "name": "openGauss测试",
            "db_type": "opengauss",
            "host": "192.168.1.100",
            "port": 5432,
            "database": "postgres",
            "username": "omm",
            "password": "password",
        }
        response = await client.post("/api/database-configs", json=config_data)
        assert response.status_code == 200
        data = response.json()
        assert data["db_type"] == "opengauss"

    async def test_create_gaussdb_config(self, client):
        config_data = {
            "name": "GaussDB测试",
            "db_type": "gaussdb",
            "host": "192.168.1.200",
            "port": 8000,
            "database": "postgres",
            "username": "root",
            "password": "password",
        }
        response = await client.post("/api/database-configs", json=config_data)
        assert response.status_code == 200
        data = response.json()
        assert data["db_type"] == "gaussdb"

    async def test_get_database_configs_has_default(self, client):
        response = await client.get("/api/database-configs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3  # Has default configs (postgresql, opengauss, gaussdb)
        # Check default database configs exist
        postgresql_found = any(db["name"] == "本地测试数据库" for db in data)
        opengauss_found = any(db["name"] == "openGauss示例" for db in data)
        gaussdb_found = any(db["name"] == "GaussDB示例" for db in data)
        assert postgresql_found
        assert opengauss_found
        assert gaussdb_found
        # Check default has db_type
        default_db = next(db for db in data if db["name"] == "本地测试数据库")
        assert default_db["db_type"] == "postgresql"
        opengauss_db = next(db for db in data if db["name"] == "openGauss示例")
        assert opengauss_db["db_type"] == "opengauss"
        gaussdb_db = next(db for db in data if db["name"] == "GaussDB示例")
        assert gaussdb_db["db_type"] == "gaussdb"

    async def test_get_database_configs_with_data(self, client):
        # 先创建一个配置
        await client.post(
            "/api/database-configs",
            json={
                "name": "测试DB",
                "db_type": "opengauss",
                "host": "127.0.0.1",
                "port": 5432,
                "database": "postgres",
                "username": "postgres",
                "password": "password",
            },
        )
        response = await client.get("/api/database-configs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 4  # Default 3 + new 1
        # Check the new config exists
        new_found = any(db["name"] == "测试DB" for db in data)
        assert new_found

    async def test_get_single_database_config(self, client):
        # 创建配置
        create_response = await client.post(
            "/api/database-configs",
            json={
                "name": "单条测试",
                "db_type": "gaussdb",
                "host": "localhost",
                "port": 8000,
                "database": "test",
                "username": "user",
                "password": "pass",
            },
        )
        config_id = create_response.json()["id"]

        # 获取单个配置
        response = await client.get(f"/api/database-configs/{config_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "单条测试"
        assert response.json()["db_type"] == "gaussdb"

    async def test_get_nonexistent_database_config(self, client):
        response = await client.get("/api/database-configs/999")
        assert response.status_code == 404

    async def test_update_database_config(self, client):
        # 创建配置
        create_response = await client.post(
            "/api/database-configs",
            json={
                "name": "原始名称",
                "db_type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "test",
                "username": "user",
                "password": "pass",
            },
        )
        config_id = create_response.json()["id"]

        # 更新配置
        response = await client.put(
            f"/api/database-configs/{config_id}",
            json={"name": "更新后的名称", "db_type": "opengauss"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "更新后的名称"
        assert response.json()["db_type"] == "opengauss"

    async def test_delete_database_config(self, client):
        # 创建配置
        create_response = await client.post(
            "/api/database-configs",
            json={
                "name": "待删除",
                "db_type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "test",
                "username": "user",
                "password": "pass",
            },
        )
        config_id = create_response.json()["id"]

        # 删除配置
        response = await client.delete(f"/api/database-configs/{config_id}")
        assert response.status_code == 200

        # 确认已删除
        get_response = await client.get(f"/api/database-configs/{config_id}")
        assert get_response.status_code == 404

    async def test_delete_nonexistent_database_config(self, client):
        response = await client.delete("/api/database-configs/999")
        assert response.status_code == 404


class TestFaultScenarioAPI:
    """测试故障场景API"""

    async def test_create_fault_scenario(self, client):
        scenario_data = {
            "name": "高并发测试",
            "type": "high_concurrency",
            "description": "测试描述",
            "config": {
                "concurrency": 50,
                "duration_seconds": 60,
                "interval_ms": 100,
            },
        }
        response = await client.post("/api/fault-scenarios", json=scenario_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "高并发测试"
        assert data["type"] == "high_concurrency"
        assert data["config"]["concurrency"] == 50

    async def test_get_fault_scenarios_has_default(self, client):
        response = await client.get("/api/fault-scenarios")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3  # Has default scenarios
        # Check default scenarios exist
        high_concurrency_found = any(s["name"] == "高并发CPU压力测试" for s in data)
        assert high_concurrency_found

    async def test_get_fault_scenarios_with_data(self, client):
        await client.post(
            "/api/fault-scenarios",
            json={
                "name": "场景1",
                "type": "high_concurrency",
                "config": {"concurrency": 10},
            },
        )
        response = await client.get("/api/fault-scenarios")
        assert response.status_code == 200
        assert len(response.json()) >= 4  # Default 3 + new 1

    async def test_update_fault_scenario(self, client):
        create_response = await client.post(
            "/api/fault-scenarios",
            json={
                "name": "原始场景",
                "type": "high_concurrency",
                "config": {"concurrency": 10},
            },
        )
        scenario_id = create_response.json()["id"]

        response = await client.put(
            f"/api/fault-scenarios/{scenario_id}",
            json={"name": "更新场景", "config": {"concurrency": 100}},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "更新场景"
        assert data["config"]["concurrency"] == 100

    async def test_delete_fault_scenario(self, client):
        create_response = await client.post(
            "/api/fault-scenarios",
            json={
                "name": "待删除场景",
                "type": "high_concurrency",
                "config": {"concurrency": 10},
            },
        )
        scenario_id = create_response.json()["id"]

        response = await client.delete(f"/api/fault-scenarios/{scenario_id}")
        assert response.status_code == 200

        get_response = await client.get(f"/api/fault-scenarios/{scenario_id}")
        assert get_response.status_code == 404


class TestInjectionAPI:
    """测试故障注入API"""

    async def test_start_injection_missing_scenario(self, client):
        response = await client.post(
            "/api/injection/start",
            json={"scenario_id": 999, "db_config_id": 999},
        )
        assert response.status_code == 404

    async def test_get_injection_records_empty(self, client):
        response = await client.get("/api/injection/records")
        assert response.status_code == 200
        assert response.json() == []

    async def test_get_injection_status_not_found(self, client):
        response = await client.get("/api/injection/status/999")
        assert response.status_code == 404