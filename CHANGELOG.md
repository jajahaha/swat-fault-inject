# Changelog

All notable changes to this project will be documented in this file.

## [1.2.7] - 2026-05-09

### Fixed

- **完全兼容 Python 3.7.9 离线安装**
  - 所有纯 Python 包降级到 Python 3.7 兼容版本
  - anyio: 4.13.0 → 3.7.1 (要求 Python >=3.10)
  - click: 8.3.3 → 8.0.4
  - packaging: 26.2 → 21.3
  - pluggy: 1.6.0 → 1.0.0
  - sniffio: 1.3.1 → 1.2.0
  - aiosqlite: 0.19.0 → 0.17.0
  - certifi: 2026.4.22 → 2021.10.8
  - idna: 3.13 → 3.3
  - h11: 0.14.0 → 0.12.0
  - httpcore: 0.17.3 → 0.15.0
  - httpx: 0.24.1 → 0.23.0
  - pytest: 7.4.0 → 7.2.0
  - pytest_asyncio: 0.21.0 → 0.20.3
  - iniconfig: 2.3.0 → 1.1.1
  - typing_extensions: 4.15.0 → 4.7.1

### Added

- **pip wheel 预升级机制**
  - 先安装 pip 21.3.1 wheel，支持 manylinux2014+ 标签
  - SQLAlchemy 使用版本特定 wheel (cp37, cp38, ..., cp312)

### Changes

- 总计 38 个 wheel 文件
- 支持 py2.py3-none-any 格式的 wheel（兼容 Python 2 和 3）

## [1.2.6] - 2026-05-09

### Fixed

- **修复 Python 3.7 pip 兼容性问题**
  - asyncpg 0.22.0 使用简单 manylinux1_x86_64 标签（兼容旧版 pip）
  - 之前 asyncpg 0.25.0 使用压缩 manylinux 标签，Python 3.7.9 pip 无法解析
  - 保留 greenlet 1.1.3 简单标签格式

### Changes

- asyncpg Python 3.7 版本：0.25.0 → 0.22.0
- Wheel 文件命名格式：单一 manylinux1_x86_64 标签

## [1.2.5] - 2026-05-09

### Added

- **支持 Python 3.7-3.12 全版本离线安装**
  - asyncpg: 添加 cp38, cp39, cp310, cp311 版本 wheel (0.29.0)
  - greenlet: 添加 cp38, cp39, cp310, cp311 版本 wheel (3.0.3)
  - 总共 33 个 wheel 文件（21个纯Python + 12个二进制包）

### Fixed

- **修复 wheel 文件选择逻辑**
  - 根据精确 Python 版本匹配 wheel（cp37, cp38, ..., cp312）
  - 之前逻辑：Python 3.8-3.11 错误地尝试使用 cp37 wheel
  - 现在逻辑：精确匹配当前 Python 版本的 wheel 标签

### Changes

- start.sh 智能选择兼容 wheel 文件
- Wheel 标签计算：`cp3${PYTHON_MINOR}`（如 Python 3.12 → cp312）

## [1.2.4] - 2026-05-09

### Fixed

- **同时支持 Python 3.7 和 Python 3.12**
  - asyncpg: 包含 cp37 和 cp312 双版本 wheel
  - greenlet: 包含 cp37 和 cp312 双版本 wheel
  - pip 安装时自动选择兼容当前 Python 版本的包
  - 总共 25 个 wheel 文件（+2 个 Python 3.7 版本）

### Changes

- 修复路径错误：`backend/backend/packages/` → `backend/packages/`
- asyncpg 0.31.0 (Python 3.12) + asyncpg 0.25.0 (Python 3.7)
- greenlet 3.5.0 (Python 3.12) + greenlet 1.1.3 (Python 3.7)

## [1.2.3] - 2026-05-09

### Fixed

- **修复 wheel 文件平台标签兼容性问题**
  - asyncpg 改用 manylinux1 标签（兼容旧版 pip）
  - SQLAlchemy 使用 py3-none-any（纯 Python，无平台限制）
  - greenlet 使用 manylinux1 标签
  - asyncpg 版本降级到 0.25.0（有 manylinux1 支持）

### Changes

- asyncpg: 0.28.0 → 0.25.0
- SQLAlchemy: cp37 wheel → py3-none-any wheel
- greenlet: manylinux_2_17 → manylinux1

## [1.2.2] - 2026-05-09

### Fixed

- **强制离线安装，移除在线回退**
  - start.sh 在无 packages 目录或无 wheel 文件时直接退出
  - 不尝试联网下载（避免在离线环境报网络错误）
  - 添加调试信息：显示找到的 wheel 文件数量
  - 移除 pip install 错误输出抑制，显示完整错误信息

### Important

- 此版本**仅支持离线安装**
- 必须确保 `backend/packages/` 目录包含 23 个 wheel 文件
- 如缺少依赖包，将直接失败而非尝试联网

## [1.2.1] - 2026-05-09

### Fixed

- **修复完全离线安装问题**
  - 修改 start.sh 离线安装逻辑：直接安装所有 wheel 文件
  - 使用 `pip install --no-index --no-deps packages/*.whl` 替代 `pip install -r requirements.txt`
  - 重新下载完整的 Python 3.7 兼容依赖包（23个 wheel 文件）
  - 包含所有二进制依赖：SQLAlchemy、asyncpg、greenlet（Python 3.7 版本）

### Pre-packaged Dependencies (23 packages)

- fastapi==0.99.1 (py3-none-any)
- uvicorn==0.22.0 (py3-none-any)
- starlette==0.27.0 (py3-none-any)
- sqlalchemy==2.0.23 (cp37-cp37m)
- asyncpg==0.28.0 (cp37-cp37m)
- pydantic==1.10.13 (py3-none-any)
- greenlet==1.1.3 (cp37-cp37m)
- pytest==7.4.0 (py3-none-any)
- httpx==0.24.1 (py3-none-any)
- 以及所有间接依赖包

## [1.2.0] - 2026-05-09

### Changed

- **完全离线安装支持 Python 3.7**
  - 预打包 23 个依赖包（20个纯Python包 + 3个Python 3.7二进制包）
  - 固定依赖版本号确保兼容性
  - 移除 uvicorn[standard]，使用基本 uvicorn 减少依赖
  - Python 3.7 用户可直接从本地包离线安装

### Dependencies (Fixed Versions)

- fastapi==0.99.1
- uvicorn==0.22.0
- starlette==0.27.0
- sqlalchemy==2.0.23
- asyncpg==0.28.0
- pydantic==1.10.13
- pytest==7.4.0
- httpx==0.24.1

## [1.1.9] - 2026-05-09

### Changed

- **兼容 Python 3.7+**（之前要求 Python 3.10+）
  - 降级 FastAPI 到 0.95.x（最后一个支持 Python 3.7 的版本）
  - 降级 Pydantic 到 v1.x（v2 需要 Python 3.7+ 但某些特性不兼容 3.7）
  - 降级其他依赖到兼容 Python 3.7 的版本
  - 重新下载 Python 3.7 兼容的依赖包

### Fixed

- 移除 Python 3.10+ 硬性要求，改为 Python 3.7+ 即可运行

## [1.1.8] - 2026-05-09

### Fixed

- 添加 Python 版本检查，要求 Python 3.10+（FastAPI 依赖要求）
- 离线安装失败时自动回退到在线安装
- 重新下载 Python 3.10+ 兼容的依赖包

### Added

- Python 版本检测和安装指引提示
- 离线/在线安装自动切换机制

## [1.1.7] - 2026-05-09

### Added

- 预打包所有依赖，支持离线安装
  - Python 依赖包下载到 `backend/packages/` 目录（37个 wheel 文件）
  - 前端依赖打包为 `frontend/node_modules.tar.gz`（67MB）
  - 用户下载代码后执行 `./start.sh` 无需联网下载依赖

### Changed

- start.sh 优先从本地 packages 目录安装 Python 依赖
- start.sh 自动解压 node_modules.tar.gz（如果 node_modules 不存在）
- 更新 .gitignore 允许提交 packages 目录和 node_modules.tar.gz

## [1.1.6] - 2026-05-09

### Fixed

- 修复 start.sh 在新环境中无法运行的错误
  - 自动创建 Python 虚拟环境（如果不存在）
  - 自动安装 Python 依赖（使用 venv/.installed 标记避免重复安装）
  - 自动安装 npm 依赖（如果 node_modules 不存在）
  - 启动失败时显示日志内容便于排查问题

## [1.1.5] - 2026-05-09

### Fixed

- 修复注入历史记录时间显示问题
  - UTC时间输出添加"Z"后缀，确保JavaScript正确解析为UTC时间
  - 修复所有模型的 `to_dict()` 方法中的时间格式输出
- 修复故障注入Modal中Select组件无法选择目标数据库的问题
  - 使用 Ant Design 5.x 推荐的 `options` 属性替代 `<Select.Option>` 子元素
  - 解决 Modal 内 Select 组件渲染问题

### Added

- 后端时间格式测试用例（3个）
  - 数据库配置时间格式测试
  - 故障场景时间格式测试
  - 注入记录时间格式测试
- 前端组件测试用例（5个）
  - FaultScenarios 组件渲染测试
  - Select options 属性测试
  - 时间格式显示测试

## [1.1.4] - 2026-05-08

### Added

- 默认数据库配置新增 openGauss 和 GaussDB 示例
  - 本地测试数据库
  - openGauss示例 (opengauss, 192.168.1.100:5432)
  - GaussDB示例 (gaussdb, 192.168.1.200:8000)

### Fixed

- 修复前端路由切换时数据不刷新的问题
  - 引入 useLocation hook 监听路由变化
  - useEffect 依赖数组改为 [location.pathname]

### Changed

- 后端测试用例更新（验证3种默认数据库配置）
- 版本号：1.1.3 -> 1.1.4

## [1.1.3] - 2026-05-08

### Added

- 多数据库类型支持
  - PostgreSQL (默认端口 5432)
  - openGauss (默认端口 5432)
  - GaussDB (默认端口 8000)
- 数据库类型 API: `GET /api/database-configs/types`
- 前端数据库类型选择器（自动填充默认端口）
- 前端数据库类型标签显示（彩色区分）

### Changed

- 数据库配置模型新增 `db_type` 字段
- 数据库配置 API 增加 `db_type` 参数
- 测试用例适配多数据库类型
- 测试框架优化（解决 pytest_asyncio 兼容性问题）

## [1.1.2] - 2026-05-08

### Added

- 默认数据库配置自动保存
  - 本地测试数据库 (127.0.0.1:5432/postgres/lcj)
- 默认故障场景自动保存
  - 高并发CPU压力测试 (50并发, 60秒)
  - 连接耗尽测试 (200并发, 30秒)
  - 慢查询测试 (10并发, pg_sleep)

### Changed

- 更新测试用例适配默认数据
- 更新 .gitignore 排除 logs 目录

## [1.1.1] - 2026-05-08

### Added

- 一键启动脚本（start.sh）
  - 自动检测端口占用
  - 健康检查等待服务启动
  - PID 文件追踪
  - 日志输出到 logs/ 目录
- 一键关闭脚本（stop.sh）
  - 进程 PID 精准关闭
  - 端口强制释放
  - 关闭状态验证

## [1.1.0] - 2026-05-08

### Added

- 后端API测试用例（17个测试）
  - 根路由测试
  - 数据库配置 CRUD 操作测试
  - 故障场景 CRUD 操作测试
  - 故障注入 API 基础测试
- 前端测试用例（11个测试）
  - API 模块 Mock 测试
  - App 组件渲染测试
- pytest 配置文件（pytest.ini）
- vitest 配置文件（vitest.config.js）
- 测试 setup 文件（setup.js）

### Changed

- 后端默认端口从 8000 改为 9010
- 前端默认端口从 3000 改为 9020
- 更新 README.md 文档结构
- 完善项目文档说明

### Features

- 数据库配置管理（增删改查、连接测试）
- 故障场景管理（场景配置、保存）
- 故障注入执行器（启动、停止、状态监控）
- 注入历史记录和日志查看
- 第一个故障场景：SQL并发过高导致CPU打满

## [1.0.0] - 2026-05-08

### Initial Release

- 基础项目架构搭建
- FastAPI 后端框架
- React + Ant Design 前端界面
- SQLite 元数据存储
- PostgreSQL 故障注入支持
- 高并发查询故障场景