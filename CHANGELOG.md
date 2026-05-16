# Changelog

All notable changes to this project will be documented in this file.

## [1.7.7] - 2026-05-16

### Changed

- **版本号统一升级**
  - 所有版本号从1.7.6升级到1.7.7
  - 更新README.md、CHANGELOG.md、设计文档等

### Technical

- 版本号更新文件：start.sh, stop.sh, README.md, CHANGELOG.md, package.json, Layout.jsx, main.py

## [1.7.6] - 2026-05-16

### Added

- **DDL锁阻塞场景并发执行支持**
  - 新增 `_execute_run_scripts_concurrently` 方法支持混合模式脚本并发执行
  - centralized脚本（DDL事务）先启动获取表锁
  - distributed脚本（INSERT/UPDATE/DELETE）并发执行被阻塞
  - 新增 `_execute_single_script_with_iterations` 支持脚本迭代执行

- **DDL锁阻塞测试场景**
  - 场景包含4个运行脚本：DDL事务 + INSERT + UPDATE + DELETE
  - DDL事务获取表锁后保持600秒
  - IUD操作并发执行，被DDL锁阻塞

### Changed

- **演练详情布局优化**
  - 演练概述卡片置于顶部（故障类型、描述、连接数据库、执行模式等）
  - 演练步骤卡片置于中间（显示正在执行的阶段和具体SQL/脚本）
  - 执行日志卡片置于底部

- `drill_executor.py`: 新增混合模式脚本并发执行逻辑
- `DrillManagement.jsx`: 演练详情弹窗布局重组

### Fixed

- 前端测试修复：版本号格式验证、按钮文本更新

## [1.7.5] - 2026-05-16

### Added

- **演练详情界面优化**
  - 演练信息卡片置于顶部，便于快速查看演练状态
  - 执行日志实时刷新，运行时每秒自动更新
  - 步骤进度显示完整场景信息（故障类型、分类、描述）
  - 三阶段（前置准备、故障注入、清理环境）始终显示，即使无脚本也展示

- **SQL控制台新增实时会话快捷示例**
  - 新增"实时会话"快捷按钮，查看当前数据库活跃连接
  - 新增"活跃连接"快捷按钮，按用户统计连接数量
  - 快捷按钮带图标和颜色区分

- **故障场景执行优化**
  - 点击执行后弹出确认窗口，显示场景信息
  - 执行后自动跳转到演练管理页面并高亮新演练
  - 自动弹出演练详情，便于实时监控

- **僵尸演练自动清理**
  - 服务启动时自动检测并修复僵尸演练（状态为preparing/running/cleaning但实际未执行）
  - 将僵尸演练状态改为stopped，添加说明日志

### Fixed

- **演练详情API修复**
  - 修复获取演练详情时的AttributeError错误
  - DrillStepResponse schema新增scenario字段支持完整场景信息

- **进度显示优化**
  - 修复进度百分比与进度条位置重叠问题
  - 使用自定义div实现进度条，圆角设计更连贯
  - 添加过渡动画和发光效果

- **测试代码修复**
  - 修复版本号检查测试，使用格式验证而非硬编码版本号

### Changed

- `DrillManagement.jsx`: 演练详情弹窗重新布局，日志实时刷新
- `SqlConsole.jsx`: 新增实时会话快捷示例
- `FaultScenarios.jsx`: 执行流程优化，错误处理改进
- `drill.py`: API返回完整场景信息
- `schemas.py`: DrillStepResponse新增scenario字段
- `database.py`: 服务启动时清理僵尸演练
- `test_api.py`: 版本号检查改为格式验证

### Added

- **故障场景三级分类功能**
  - 新增三级分类字段 `category3`，细化故障类型
  - 一级分类：慢、满、宕、错（故障大类）
  - 二级分类：CPU、内存、磁盘、网络、连接等（资源类型）
  - 三级分类：慢查询、进程CPU满、OOM崩溃等（具体场景）
  - 共支持 36 种三级分类组合

- **前端三级分类支持**
  - 故障场景表格新增"三级分类"列
  - 新建/编辑场景表单新增三级分类下拉选择器
  - 三级分类选项根据一级+二级分类级联联动
  - 切换一级分类时自动重置二级、三级分类
  - 切换二级分类时自动重置三级分类

- **导入导出支持三级分类**
  - YAML 配置文件支持 `category1`、`category2`、`category3` 字段
  - 导入时自动解析三级分类并保存到数据库
  - 导出时包含完整的三级分类信息

- **数据库迁移脚本**
  - 新增 `migrate_add_category3.py` 自动添加 category3 列

### Changed

- `database.py`: FaultScenario 模型新增 category3 字段
- `schemas.py`: Create/Update/Response Schema 支持 category3
- `fault_scenarios.py`: API 创建/更新支持三级分类
- `scenario_import_export.py`: 导入导出支持三级分类和 run_scripts
- `scenario_yaml.py`: YAML 解析和导出支持三级分类和 run_scripts
- `FaultScenarios.jsx`: 新增 CATEGORY3_CONFIG 和三级分类表单组件

## [1.6.2] - 2026-05-11

### Added

- **故障场景 YAML 导入导出功能**
  - 支持单个场景 YAML 文件导入导出
  - 支持批量场景导入导出（ZIP 包）
  - 支持导出所有场景
  - YAML 格式验证 API
  - 新增设计文档 `docs/scenario_script_spec.md`

- **新增API接口**
  - `POST /api/fault-scenarios/import` 导入单个场景
  - `POST /api/fault-scenarios/import-batch` 批量导入场景
  - `GET /api/fault-scenarios/export/{id}` 导出单个场景
  - `POST /api/fault-scenarios/export-batch` 批量导出场景
  - `GET /api/fault-scenarios/export-all` 导出所有场景
  - `POST /api/fault-scenarios/validate` 验证 YAML 格式

- **新增前端功能**
  - 故障场景页面新增导入、导出选中、导出全部按钮
  - 支持拖拽上传 YAML 文件
  - 批量选择场景导出

### Fixed

- **演练进度显示问题**
  - 演练完成后 `current_phase` 不再显示（清除为 null）
  - 步骤完成后 `current_phase` 不再显示（清除为 null）
  - 前端只在运行状态时显示阶段标签

- **统计图标优化**
  - "正在运行"/"正在执行"数量为 0 时显示静止时钟图标
  - 数量 > 0 时显示转圈加载图标

### Changed

- 后端 `drill_executor.py` 完成时清除 current_phase
- 前端 `FaultScenarios.jsx` 添加 ClockCircleOutlined 图标
- 前端 `DrillManagement.jsx` 阶段标签显示逻辑优化

## [1.6.1] - 2026-05-11

### Fixed

- **故障注入历史信息显示不全**
  - API `/api/injection/history` 现返回 `scenario_name` 和 `db_config_name`
  - 前端注入历史表格正确显示场景名称和数据库配置名称
  - 新增数据库关系映射查询

- **演练管理页面加载数据失败**
  - 数据库 `drills` 表缺少 `created_at` 和 `updated_at` 列
  - 新增数据库修复脚本自动添加缺失列

- **统计图标旋转问题优化**
  - "正在运行"/"正在执行"图标 spin 属性改为动态判断
  - 仅在有运行任务时图标旋转，静止任务不转圈

### Changed

- 前端 `FaultScenarios.jsx` 和 `DrillManagement.jsx` 统计卡片图标优化

## [1.6.0] - 2026-05-10

### Added

- **演练管理功能**
  - 组合多个故障场景进行批量测试
  - 支持顺序执行和并行执行两种模式
  - 每个演练步骤独立跟踪进度和状态
  - 实时显示演练进度、当前阶段和执行日志
  - 支持启动、停止、查看演练详情

- **故障场景增强**
  - 新增前置准备脚本 (`setup_scripts`)：在故障注入前执行环境准备
  - 新增清理环境脚本 (`cleanup_scripts`)：故障注入后自动清理测试数据
  - 新增脚本超时配置 (`setup_timeout`, `cleanup_timeout`)
  - 支持 SQL 和 Shell 两种脚本类型

- **新增数据表**
  - `drills` 表：演练记录
  - `drill_steps` 表：演练步骤详情

- **新增API接口**
  - `POST /api/drill/create` 创建演练
  - `POST /api/drill/start/{id}` 启动演练
  - `POST /api/drill/stop/{id}` 停止演练
  - `GET /api/drill/status/{id}` 获取演练状态和进度
  - `GET /api/drill/list` 获取演练列表
  - `GET /api/drill/step-status/{id}` 获取步骤状态
  - `DELETE /api/drill/{id}` 删除演练

- **新增前端页面**
  - 演练管理页面 (`DrillManagement.jsx`)
  - 演练创建表单（支持场景选择和排序）
  - 演练详情弹窗（显示步骤进度和日志）

### Changed

- 版本号升级至 1.6.0
- 前端菜单新增"演练管理"入口
- 前端 Layout 组件添加 RocketOutlined 图标

## [1.5.1] - 2026-05-09

### Fixed

- **修复 Python 3.7 兼容性问题**
  - 替换 `asyncio.to_thread` (Python 3.9+) 为 `loop.run_in_executor` (Python 3.7+)
  - 修复 gsql、JDBC、psycopg2 连接测试和故障注入功能

### Technical

- 添加 `run_sync()` helper 函数用于异步包装同步操作
- 所有同步数据库操作使用线程池执行

## [1.5.0] - 2026-05-09

### Added

- **支持多种数据库连接方式**
  - asyncpg: Python异步驱动，适用于PostgreSQL
  - psycopg2: Python同步驱动，兼容性更好，支持sha256认证
  - gsql: 命令行工具，操作系统用户为service，适用于openGauss/GaussDB
  - JDBC: Java驱动方式，需要配置JDBC驱动jar文件路径

- **新增API接口**
  - `GET /api/database-configs/connection-methods` 获取支持的连接方式列表

- **新增数据库配置字段**
  - `connection_method`: 连接方式选择
  - `jdbc_driver_path`: JDBC驱动路径（仅JDBC方式需要）

- **新增drivers目录**
  - 用于存放JDBC驱动jar文件
  - 支持GaussDB、openGauss、PostgreSQL JDBC驱动

### Changed

- **前端界面优化**
  - 数据库配置表格新增"连接方式"列
  - 新建/编辑表单新增连接方式选择和JDBC驱动路径配置
  - 连接方式根据数据库类型自动过滤可选项

### Technical

- 故障注入服务支持四种连接方式
- gsql方式使用subprocess管理子进程
- JDBC方式使用jaydebeapi库（需额外安装）

## [1.4.5] - 2026-05-09

### Added

- **添加 psycopg2 驱动支持 GaussDB sha256 认证**
  - GaussDB/openGauss 优先使用 psycopg2 连接（更好兼容 sha256 认证）
  - PostgreSQL 继续使用 asyncpg 异步驱动
  - 故障注入服务支持两种驱动模式

### Fixed

- **修复 Vite 代理 IPv6 连接问题**
  - 代理目标从 `localhost` 改为 `127.0.0.1`，强制使用 IPv4

### Technical

- 添加 `psycopg2-binary==2.9.9` 到依赖
- 使用 `asyncio.to_thread` 包装同步 psycopg2 调用
- 故障注入使用 threading 支持 psycopg2 并发连接

## [1.4.4] - 2026-05-09

### Fixed

- **修复 Vite 代理 IPv6 连接问题**
  - 代理目标从 `localhost` 改为 `127.0.0.1`，强制使用 IPv4
  - 解决 `connect ECONNREFUSED ::1:9010` 错误

- **优化 GaussDB/openGauss 连接认证**
  - 为 GaussDB 和 openGauss 添加 `ssl="prefer"` 参数
  - 改进 SASL 认证错误的提示信息
  - 注意：GaussDB 若使用非标准认证方式仍可能失败

### Problem

- Vite 代理使用 `localhost`，部分系统优先解析为 IPv6 (::1)
- 后端只监听 IPv4 (127.0.0.1)，导致连接被拒绝
- GaussDB/openGauss 可能使用非标准 SASL 认证机制

### Solution

- 前端 vite.config.js: `target: 'http://127.0.0.1:9010'`
- 后端 asyncpg.connect 添加 SSL 参数并改进错误提示

## [1.4.3] - 2026-05-09

### Fixed

- **修复新建数据库配置时空密码导致的500错误**
  - `DatabaseConfigCreate` schema 中 `password` 字段添加默认空字符串
  - 前端提交时确保空值转换为空字符串（避免 undefined）
  - 前端新建表单初始化时设置 `password: ''`
  - 前端错误提示显示具体错误详情

### Problem

- 前端表单密码字段为空时，发送 `undefined` 到后端
- Pydantic schema 中 `password: str` 是必填字段，不接受 undefined/null
- 导致 500 Internal Server Error

### Solution

- 后端: `password: str = ""` 添加默认值
- 前端: 表单初始化和提交时处理空值

## [1.4.2] - 2026-05-09

### Added

- **支持通过IP地址访问服务**
  - 前端 Vite 配置添加 `host: '0.0.0.0'`
  - 后端已配置为监听 `0.0.0.0` (所有网络接口)
  - 可通过局域网IP访问：`http://<IP>:9020`

### Usage

- 本机访问: `http://localhost:9020`
- 远程访问: `http://<服务器IP>:9020`
- API访问: `http://<服务器IP>:9010`

## [1.4.1] - 2026-05-09

### Fixed

- **添加前端 ARM64 二进制依赖**
  - @rollup/rollup-linux-arm64-gnu@4.60.3
  - @esbuild/linux-arm64@0.21.5
  - node_modules.tar.gz 现包含 x64 和 ARM64 双架构二进制

### Problem

- 之前 node_modules.tar.gz 只包含 x86_64 版本的 rollup/esbuild
- ARM64 (aarch64) 机器运行 vite 时缺少二进制依赖

### Solution

- 手动下载 ARM64 版本的 rollup 和 esbuild 包
- 解压到 node_modules 目录，与 x64 版本共存
- 重新打包 node_modules.tar.gz（约 68MB）

## [1.4.0] - 2026-05-09

### Added

- **集成 Node.js 离线安装**
  - 添加 Node.js v18.20.2 ARM64 (aarch64) 版本
  - 添加 Node.js v18.20.2 x64 (x86_64) 版本
  - 自动检测架构并选择正确的 Node.js 包
  - 自动解压安装到项目目录的 node-install 子目录
  - 无需系统安装 Node.js，完全离线部署

### Changed

- start.sh: Node.js 检测逻辑改为自动安装模式
- .gitignore: 允许提交 nodejs/*.tar.gz，排除 node-install/

### Requirements

- 现支持完全离线安装：Python 依赖 + Node.js + npm
- 总计约 130MB 离线包（Python wheels + Node.js + node_modules.tar.gz）

## [1.3.3] - 2026-05-09

### Fixed

- **修复 Node.js 检测逻辑**
  - 使用 `command -v` 正确检测命令是否存在
  - 之前的 `$?` 检测的是 `sed` 的返回值而非 `node`
  - 修复当 Node.js 未安装时显示 "(OK)" 的错误

## [1.3.2] - 2026-05-09

### Added

- **Node.js 检测和安装提示**
  - 启动前检测 Node.js 和 npm 是否安装
  - 提供在线安装命令（apt/yum/brew）
  - 提供离线安装指南（下载 Node.js tar.gz）
  - 验证 Node.js 版本 >= 18

### Requirements

- Node.js 18+ 是必需依赖（前端运行）
- aarch64 用户需下载 ARM64 版本的 Node.js

## [1.3.1] - 2026-05-09

### Added

- **添加 Python 3.7 缺失依赖**
  - importlib_metadata 4.13.0 (Python 3.7 backport)
  - zipp 3.15.0 (importlib_metadata 依赖)
  - Python 3.8+ 已内置 importlib.metadata，无需额外安装

### Fixed

- ModuleNotFoundError: No module named 'importlib_metadata'

## [1.3.0] - 2026-05-09

### Fixed

- **修复 Python 3.7 语法兼容性**
  - 将 Python 3.9+ 类型注解语法 (`list[]`, `dict[]`) 改为 Python 3.7 兼容语法 (`List[]`, `Dict[]`)
  - 使用 `declarative_base()` 替代 `DeclarativeBase` (SQLAlchemy 2.0 兼容)
  - 使用 `sessionmaker` 替代 `async_sessionmaker` (Python 3.7 兼容)

### Changed

- database.py: SQLAlchemy 1.4 风格声明基类
- fault_injector.py: 使用 typing.List 和 typing.Dict
- injection.py: 使用 typing.List
- fault_scenarios.py: 使用 typing.List
- database_config.py: 使用 typing.List

## [1.2.9] - 2026-05-09

### Added

- **支持 ARM64/aarch64 架构离线安装**
  - asyncpg aarch64 wheels (Python 3.7-3.12)
  - greenlet aarch64 wheels (Python 3.7-3.12)
  - SQLAlchemy aarch64 wheels (Python 3.7-3.12)
  - 自动检测机器架构：x86_64, aarch64, i686

### Fixed

- **修复架构检测逻辑**
  - 新增 aarch64 (ARM64) 架构支持
  - 分别处理 asyncpg, greenlet, SQLAlchemy 的架构选择
  - 支持的架构：x86_64 (Intel/AMD), aarch64 (ARM/Apple Silicon), i686 (32-bit)

### Changes

- Wheel 文件总数：59 个（x86_64 + aarch64 + i686）
- 架构后缀映射：aarch64/arm64 → aarch64, i686/i386/x86 → i686, 其他 → x86_64

## [1.2.8] - 2026-05-09

### Fixed

- **修复 Python 3.7 架构兼容性问题**
  - asyncpg 降级到 0.21.0（提供 32 位和 64 位 wheel）
  - 添加 asyncpg 32 位 wheel (i686)
  - 自动检测机器架构并选择正确的 asyncpg wheel
  - pip 降级到 19.3.1（更好支持旧版 manylinux 标签）

### Added

- **架构自动检测**
  - 检测 32 位 (i686/i386/x86) 和 64 位 (x86_64/AMD64) 系统
  - 自动选择匹配架构的 asyncpg wheel

### Changes

- asyncpg Python 3.7 版本：0.22.0 → 0.21.0
- pip：21.3.1 → 19.3.1
- 添加 setuptools 59.8.0 和 wheel 0.37.1（备用构建工具）
- Wheel 文件总数：40 个

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