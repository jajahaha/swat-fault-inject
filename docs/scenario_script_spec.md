# 故障演练脚本规范设计方案

## 1. 概述

设计一套文本化的故障演练脚本规范，支持用户通过 YAML 文件定义故障场景，实现场景的导入、导出和复用。

## 2. 脚本格式选择

### 选择 YAML 格式

**原因：**
- 易读易写，适合人工编辑
- 支持复杂数据结构（列表、字典）
- 支持注释，方便添加说明
- 业界广泛使用的配置格式
- Python 原生支持解析

### 文件命名规范

```
scenario_<场景名称>.yaml
```

示例：
- `scenario_high_cpu_load.yaml`
- `scenario_connection_exhaustion.yaml`
- `scenario_slow_query.yaml`

## 3. YAML 脚本结构规范

### 3.1 基本结构

```yaml
# 故障场景定义文件
# 版本: 1.0

metadata:
  name: "场景名称"              # 必填，唯一标识
  type: "场景类型"              # 必填，见类型列表
  category1: "慢"               # 可选，一级分类：慢/满/宕/错
  category2: "CPU慢"            # 可选，二级分类：CPU/内存/磁盘/网络/连接等
  category3: "慢查询"           # 可选，三级分类：具体场景类型
  description: "场景描述"       # 可选，详细说明

config:
  # 场景配置参数（根据类型不同，参数不同）
  concurrency: 50              # 并发数
  duration_seconds: 60         # 持续时间（秒）
  interval_ms: 100             # 请求间隔（毫秒）
  query_template: "SELECT ..." # SQL 查询模板

setup:                          # 可选，前置准备脚本
  timeout: 60                   # 整体超时时间
  scripts:                      # 脚本列表
    - type: sql                 # sql / shell
      description: "创建测试表"
      content: |
        CREATE TABLE IF NOT EXISTS test_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        );
      timeout: 30               # 单脚本超时

cleanup:                        # 可选，清理环境脚本
  timeout: 30                   # 整体超时时间
  scripts:                      # 脚本列表
    - type: sql
      description: "删除测试表"
      content: "DROP TABLE IF EXISTS test_table;"
      timeout: 10
```

### 3.2 场景类型定义

| 类型 | 名称 | 说明 | 配置参数 |
|------|------|------|----------|
| `high_concurrency` | 高并发查询 | 模拟高并发SQL压力 | concurrency, duration_seconds, interval_ms, query_template |
| `connection_exhaustion` | 连接耗尽 | 模拟连接池耗尽 | concurrency, duration_seconds, interval_ms, query_template |
| `slow_query` | 慢查询 | 模拟慢查询场景 | concurrency, duration_seconds, interval_ms, query_template |
| `io_pressure` | IO压力 | 模拟IO密集操作 | concurrency, duration_seconds, query_template |
| `custom` | 自定义 | 用户自定义类型 | 任意配置参数 |

### 3.3 完整示例

```yaml
# 高并发CPU压力测试场景
# 用于测试数据库在高并发CPU密集型查询下的表现

metadata:
  name: "高并发CPU压力测试"
  type: "high_concurrency"
  description: |
    通过50个并发连接持续执行CPU密集型SQL查询，
    模拟SQL并发过高导致CPU打满的场景。
    适用于测试数据库在高负载下的响应能力。

config:
  concurrency: 50
  duration_seconds: 60
  interval_ms: 100
  query_template: |
    SELECT count(*) FROM pg_catalog.pg_class a, 
    pg_catalog.pg_class b, pg_catalog.pg_class c 
    WHERE a.oid = b.oid AND b.oid = c.oid

setup:
  timeout: 60
  scripts:
    - type: sql
      description: "创建压力测试表"
      content: |
        CREATE TABLE IF NOT EXISTS stress_test (
          id SERIAL PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        INSERT INTO stress_test (data) 
        SELECT md5(random()::text) FROM generate_series(1, 1000);
      timeout: 30

    - type: shell
      description: "检查系统资源"
      content: "echo 'Starting stress test...' && free -m"
      timeout: 5

cleanup:
  timeout: 30
  scripts:
    - type: sql
      description: "清理测试数据"
      content: |
        DROP TABLE IF EXISTS stress_test;
        DELETE FROM test_log WHERE test_type = 'stress';
      timeout: 10
```

## 4. 功能设计

### 4.1 导入功能

**单个场景导入：**
- 前端：上传 YAML 文件按钮
- 后端：解析 YAML，验证格式，创建场景记录
- 处理：重复名称时提示覆盖或跳过

**批量导入：**
- 支持上传多个 YAML 文件（ZIP 包或批量选择）
- 自动处理导入结果，显示成功/失败统计

### 4.2 导出功能

**单个场景导出：**
- 点击场景行 -> 导出按钮
- 下载 `scenario_<name>.yaml` 文件

**批量导出：**
- 选择多个场景 -> 批量导出
- 下载 ZIP 包，包含所有场景 YAML 文件

### 4.3 导出格式

导出的 YAML 文件包含：
- 完整的场景定义
- 所有配置参数
- setup/cleanup 脚本
- 创建时间等元信息（可选注释）

## 5. API 设计

### 新增 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/fault-scenarios/import` | POST | 导入单个场景（YAML 文件上传） |
| `/api/fault-scenarios/import-batch` | POST | 批量导入场景 |
| `/api/fault-scenarios/export/{id}` | GET | 导出单个场景 |
| `/api/fault-scenarios/export-batch` | POST | 批量导出场景（返回 ZIP） |
| `/api/fault-scenarios/validate` | POST | 验证 YAML 格式（不导入） |

### 请求/响应格式

**导入请求：**
```http
POST /api/fault-scenarios/import
Content-Type: multipart/form-data

file: scenario_high_cpu.yaml
```

**导入响应：**
```json
{
  "success": true,
  "scenario": {
    "id": 4,
    "name": "高并发CPU压力测试",
    "type": "high_concurrency",
    ...
  },
  "message": "场景导入成功"
}
```

**导出响应：**
```http
GET /api/fault-scenarios/export/4

Content-Type: application/octet-stream
Content-Disposition: attachment; filename="scenario_high_cpu.yaml"
```

## 6. 前端界面设计

### 6.1 故障场景页面增强

**新增按钮：**
- "导入场景" - 上传 YAML 文件
- "导出场景" - 导出选中的场景
- "批量导出" - 导出所有场景

**导入流程：**
1. 点击 "导入场景" 按钮
2. 弹出上传对话框
3. 选择 YAML 文件（支持拖拽）
4. 显示预览和验证结果
5. 确认导入

**导出流程：**
1. 选中场景行（可多选）
2. 点击 "导出场景" 按钮
3. 自动下载 YAML 文件

### 6.2 批量操作

- 表格支持多选（checkbox）
- 批量导出按钮（导出选中的场景）
- 导入 ZIP 包（解压后批量导入）

## 7. YAML 解析验证

### 验证规则

| 字段 | 必填 | 验证规则 |
|------|------|----------|
| metadata.name | 是 | 非空，最大100字符 |
| metadata.type | 是 | 必须在允许的类型列表中 |
| metadata.description | 否 | 最大500字符 |
| config | 是 | 必须包含必要参数 |
| config.concurrency | 是* | 正整数，1-1000 |
| config.duration_seconds | 是* | 正整数，1-3600 |
| config.query_template | 是* | 非空字符串 |
| setup.scripts[].type | 是 | sql 或 shell |
| setup.scripts[].content | 是 | 非空字符串 |

*注：具体必填参数根据场景类型不同

### 错误提示

导入失败时返回详细错误信息：
```json
{
  "success": false,
  "errors": [
    {"field": "metadata.name", "message": "场景名称不能为空"},
    {"field": "config.concurrency", "message": "并发数必须是正整数"}
  ]
}
```

## 8. 开发计划

### Phase 1: 后端 API（预计 1 天）
- YAML 解析模块
- 导入/导出 API
- 格式验证逻辑

### Phase 2: 前端界面（预计 1 天）
- 导入对话框组件
- 导出按钮和下载逻辑
- 批量选择和操作

### Phase 3: 测试和演示（预计 0.5 天）
- 创建示例脚本
- 导入导出测试
- 录制演示视频

## 9. 示例脚本库

系统预置示例脚本，用户可直接导入使用：

| 文件名 | 场景类型 | 说明 |
|--------|----------|------|
| scenario_high_cpu.yaml | high_concurrency | 高并发CPU压力 |
| scenario_connection.yaml | connection_exhaustion | 连接耗尽 |
| scenario_slow_query.yaml | slow_query | 慢查询测试 |
| scenario_io_pressure.yaml | io_pressure | IO压力测试 |

## 10. 安全考虑

- YAML 文件大小限制：最大 100KB
- 脚本内容审查：禁止危险命令（如 rm -rf /）
- 导入数量限制：单次最多 50 个场景
- 文件类型验证：必须是有效的 YAML 格式

---

**实现状态：已完成**

- Phase 1: 后端 API（已完成）
- Phase 2: 前端界面（已完成）
- Phase 3: 测试和演示（已完成）

**实现版本：v1.6.3**