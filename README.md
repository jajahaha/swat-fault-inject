# SWAT Fault Inject Platform

数据库故障自动注入平台，用于测试数据库在高负载场景下的表现。

## 版本

**v1.1.7** - 2026-05-09

## 功能特性

- 支持多数据库类型：PostgreSQL、openGauss、GaussDB
- 管理不同的故障注入场景
- 自动连接数据库执行故障脚本
- 可配置连接特定数据库
- 现代美观的前端界面（React + Ant Design）
- 一键启动/关闭脚本
- 完整的API文档和测试覆盖
- **离线安装支持**：预打包所有依赖，无需联网即可运行

## 技术栈

- **后端**: Python FastAPI（异步高性能）
- **前端**: React + Ant Design（现代化UI）
- **元数据存储**: SQLite
- **目标数据库**: PostgreSQL / openGauss / GaussDB
- **数据库驱动**: asyncpg（异步PostgreSQL协议驱动）

## 项目结构

```
swat-fault-inject/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI入口
│   │   ├── config.py            # 配置管理
│   │   ├── database.py          # SQLite数据库模型
│   │   ├── api/                 # API路由
│   │   │   ├── database_config.py
│   │   │   ├── fault_scenarios.py
│   │   │   └── injection.py
│   │   ├── models/schemas.py    # Pydantic模型
│   │   └── services/            # 故障注入服务
│   │       └── fault_injector.py
│   ├── tests/                   # 测试用例（20个）
│   ├── requirements.txt
│   ├── pytest.ini
│   └── run.sh
├── frontend/
│   ├── src/
│   │   ├── pages/               # 页面组件
│   │   │   ├── DatabaseConfig.jsx
│   │   │   └── FaultScenarios.jsx
│   │   ├── components/          # 布局组件
│   │   │   └── Layout.jsx
│   │   ├── api/                 # API封装
│   │   │   └── index.js
│   │   └── test/                # 测试用例（11个）
│   ├── package.json
│   ├── vite.config.js
│   └── vitest.config.js
├── start.sh                     # 一键启动脚本
├── stop.sh                      # 一键关闭脚本
├── CHANGELOG.md                 # 版本更新记录
└── README.md
```

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+
- PostgreSQL / openGauss / GaussDB（目标测试数据库）

### 一键启动

```bash
./start.sh
```

启动后访问：
- 前端界面: http://localhost:9020
- 后端API: http://localhost:9010
- API文档: http://localhost:9010/docs

### 一键关闭

```bash
./stop.sh
```

### 手动启动

**后端**：
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
uvicorn app.main:app --reload --host 0.0.0.0 --port 9010
```

**前端**：
```bash
cd frontend
npm install
npm run dev
```

## 支持的数据库类型

| 数据库类型 | 默认端口 | 说明 |
|------------|----------|------|
| PostgreSQL | 5432 | 原生支持 |
| openGauss | 5432 | PostgreSQL协议兼容 |
| GaussDB | 8000 | PostgreSQL协议兼容 |

## 默认配置

系统启动后自动保存以下默认数据：

**数据库配置**：
- 本地测试数据库 (PostgreSQL: 127.0.0.1:5432)
- openGauss示例 (192.168.1.100:5432)
- GaussDB示例 (192.168.1.200:8000)

**故障场景**：
- 高并发CPU压力测试（50并发，60秒）
- 连接耗尽测试（200并发，30秒）
- 慢查询测试（10并发）

## 使用流程

1. 在"数据库配置"页面选择数据库类型并添加连接配置
2. 点击"测试连接"验证配置是否正确
3. 在"故障场景"页面创建或使用已有的故障场景
4. 点击"执行注入"选择目标数据库开始故障注入
5. 在注入历史记录中查看状态和日志

## 故障场景类型

### 高并发查询 (high_concurrency)

通过多个并发连接执行CPU密集型SQL查询，模拟SQL并发过高导致CPU打满的场景。

参数：
- `concurrency`: 并发连接数（默认50）
- `duration_seconds`: 持续时间（默认60秒）
- `interval_ms`: 查询间隔（默认100毫秒）
- `query_template`: SQL查询模板

### 慢查询 (slow_query)

执行复杂SQL查询消耗数据库资源。

### 连接耗尽 (connection_exhaustion)

创建大量连接耗尽数据库连接池。

### IO压力 (io_pressure)

执行大量IO操作。

## API文档

启动后端后访问 http://localhost:9010/docs 查看自动生成的Swagger API文档。

## 测试

### 后端测试

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

### 前端测试

```bash
cd frontend
npm run test:run
```

## 端口配置

| 服务 | 默认端口 |
|------|----------|
| 后端 API | 9010 |
| 前端界面 | 9020 |

## 安全提示

⚠️ 故障注入将对目标数据库产生压力，请确保：
- 目标数据库可以承受测试负载
- 已获得授权进行测试
- 在测试环境中运行，避免影响生产系统