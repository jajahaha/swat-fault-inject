# Changelog

All notable changes to this project will be documented in this file.

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