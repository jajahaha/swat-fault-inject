import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
  Popconfirm,
  Tag,
  Row,
  Col,
  Statistic,
  Typography,
  Divider,
  Alert,
  Upload,
  TreeSelect,
  Collapse,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  UploadOutlined,
  DownloadOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import { faultScenarioApi, drillApi, databaseConfigApi, scenarioIOApi } from '../api'

const { TextArea } = Input
const { Text } = Typography

// 一级分类配置: 慢、满、宕、错
const CATEGORY1_CONFIG = {
  slow: { label: '慢', color: '#722ed1', bg: '#f9f0ff', desc: '响应缓慢' },
  full: { label: '满', color: '#fa8c16', bg: '#fff7e6', desc: '资源耗尽' },
  crash: { label: '宕', color: '#f5222d', bg: '#fff1f0', desc: '服务崩溃' },
  error: { label: '错', color: '#1890ff', bg: '#e6f7ff', desc: '错误异常' },
}

// 二级分类配置（根据一级分类）
const CATEGORY2_CONFIG = {
  slow: {
    cpu: { label: 'CPU慢', desc: 'CPU计算密集' },
    io: { label: 'IO慢', desc: '磁盘IO延迟' },
    lock: { label: '锁等待', desc: '锁竞争' },
    network: { label: '网络慢', desc: '网络延迟' },
  },
  full: {
    cpu: { label: 'CPU满', desc: 'CPU资源耗尽' },
    memory: { label: '内存满', desc: '内存耗尽' },
    disk: { label: '磁盘满', desc: '磁盘空间耗尽' },
    connection: { label: '连接满', desc: '连接池耗尽' },
  },
  crash: {
    process: { label: '进程宕', desc: '进程崩溃' },
    service: { label: '服务宕', desc: '服务停止' },
    network: { label: '网络宕', desc: '网络中断' },
  },
  error: {
    syntax: { label: '语法错', desc: 'SQL语法错误' },
    logic: { label: '逻辑错', desc: '业务逻辑错误' },
    permission: { label: '权限错', desc: '权限不足' },
    data: { label: '数据错', desc: '数据异常' },
  },
}

// 三级分类配置（根据一级+二级分类）
const CATEGORY3_CONFIG = {
  slow: {
    cpu: {
      query: { label: '慢查询', desc: '复杂查询导致CPU慢' },
      calculation: { label: '计算密集', desc: '大量计算任务' },
      function: { label: '函数调用', desc: '复杂函数运算' },
    },
    io: {
      read: { label: '读IO慢', desc: '磁盘读取延迟' },
      write: { label: '写IO慢', desc: '磁盘写入延迟' },
      random: { label: '随机IO', desc: '随机访问延迟' },
    },
    lock: {
      table: { label: '表锁', desc: '表级锁竞争' },
      row: { label: '行锁', desc: '行级锁竞争' },
      deadlock: { label: '死锁', desc: '死锁等待' },
    },
    network: {
      latency: { label: '网络延迟', desc: '网络传输延迟' },
      bandwidth: { label: '带宽限制', desc: '带宽不足' },
      packet: { label: '丢包', desc: '网络丢包' },
    },
  },
  full: {
    cpu: {
      process: { label: '进程CPU满', desc: '单进程CPU打满' },
      multi_process: { label: '多进程CPU满', desc: '多进程CPU打满' },
      query: { label: '查询CPU满', desc: 'SQL查询CPU打满' },
    },
    memory: {
      cache: { label: '缓存内存满', desc: '缓存占用过多' },
      buffer: { label: '缓冲区满', desc: '缓冲区耗尽' },
      leak: { label: '内存泄漏', desc: '内存未释放' },
    },
    disk: {
      data: { label: '数据盘满', desc: '数据空间耗尽' },
      log: { label: '日志盘满', desc: '日志空间耗尽' },
      temp: { label: '临时盘满', desc: '临时空间耗尽' },
    },
    connection: {
      max_conn: { label: '最大连接', desc: '达到最大连接数' },
      idle: { label: '空闲连接', desc: '空闲连接未释放' },
      pool: { label: '连接池满', desc: '连接池耗尽' },
    },
  },
  crash: {
    process: {
      oom: { label: 'OOM崩溃', desc: '内存不足崩溃' },
      signal: { label: '信号崩溃', desc: '异常信号终止' },
      assert: { label: '断言失败', desc: '断言检查失败' },
    },
    service: {
      kill: { label: '服务杀掉', desc: '手动停止服务' },
      restart: { label: '服务重启', desc: '服务异常重启' },
      hang: { label: '服务挂起', desc: '服务无响应' },
    },
    network: {
      disconnect: { label: '连接断开', desc: '网络连接中断' },
      timeout: { label: '连接超时', desc: '连接超时断开' },
      firewall: { label: '防火墙阻断', desc: '防火墙阻断连接' },
    },
  },
  error: {
    syntax: {
      sql: { label: 'SQL语法错', desc: 'SQL语句错误' },
      type: { label: '类型错误', desc: '数据类型不匹配' },
      format: { label: '格式错误', desc: '格式不规范' },
    },
    logic: {
      constraint: { label: '约束违反', desc: '违反业务约束' },
      duplicate: { label: '重复数据', desc: '数据重复错误' },
      null: { label: '空值错误', desc: '空值处理错误' },
    },
    permission: {
      table: { label: '表权限', desc: '表访问权限不足' },
      column: { label: '列权限', desc: '列访问权限不足' },
      operation: { label: '操作权限', desc: '操作权限不足' },
    },
    data: {
      corrupt: { label: '数据损坏', desc: '数据文件损坏' },
      mismatch: { label: '数据不匹配', desc: '数据不一致' },
      invalid: { label: '无效数据', desc: '数据格式无效' },
    },
  },
}

const SCENARIO_TYPE_CONFIG = {
  high_concurrency: { label: '高并发查询', color: '#1890ff', bg: '#e6f7ff' },
  slow_query: { label: '慢查询', color: '#722ed1', bg: '#f9f0ff' },
  connection_exhaustion: { label: '连接耗尽', color: '#fa8c16', bg: '#fff7e6' },
  io_pressure: { label: 'IO压力', color: '#13c2c2', bg: '#e6fffb' },
  ddl_lock_blocking: { label: 'DDL锁阻塞', color: '#eb2f96', bg: '#fff0f6' },
}

function FaultScenarios() {
  const location = useLocation()
  const [scenarios, setScenarios] = useState([])
  const [dbConfigs, setDbConfigs] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [editingScenario, setEditingScenario] = useState(null)
  const [category1Filter, setCategory1Filter] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [location.pathname])

  const loadData = async () => {
    setLoading(true)
    try {
      const [scenariosRes, dbConfigsRes] = await Promise.all([
        faultScenarioApi.getAll(),
        databaseConfigApi.getAll(),
      ])
      setScenarios(scenariosRes.data)
      setDbConfigs(dbConfigsRes.data)
    } catch (error) {
      message.error('加载数据失败')
    }
    setLoading(false)
  }

  // 导入场景
  const handleImport = async (file) => {
    try {
      const res = await scenarioIOApi.import(file)
      message.success(res.data.message)
      loadData()
      setImportModalVisible(false)
    } catch (error) {
      const detail = error.response?.data?.detail
      if (typeof detail === 'object' && detail.errors) {
        message.error('导入失败: ' + detail.errors.join(', '))
      } else {
        message.error('导入失败: ' + (detail || error.message))
      }
    }
    return false
  }

  // 导出单个场景
  const handleExport = async (scenarioId) => {
    try {
      const res = await scenarioIOApi.export(scenarioId)
      downloadFile(res.data, `scenario_${scenarioId}.yaml`)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
    }
  }

  // 批量导出选中场景
  const handleExportSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的场景')
      return
    }
    try {
      const res = await scenarioIOApi.exportBatch(selectedRowKeys)
      downloadFile(res.data, 'scenarios_export.zip')
      message.success(`已导出 ${selectedRowKeys.length} 个场景`)
    } catch (error) {
      message.error('导出失败')
    }
  }

  // 导出所有场景
  const handleExportAll = async () => {
    try {
      const res = await scenarioIOApi.exportAll()
      downloadFile(res.data, 'all_scenarios.zip')
      message.success(`已导出所有场景`)
    } catch (error) {
      message.error('导出失败')
    }
  }

  // 下载文件辅助函数
  const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleCreate = () => {
    setEditingScenario(null)
    form.resetFields()
    form.setFieldsValue({
      type: 'high_concurrency',
      category1: 'slow',
      category2: 'cpu',
      category3: 'query',
      config: {
        concurrency: 50,
        duration_seconds: 60,
        interval_ms: 100,
        query_template: 'SELECT count(*) FROM pg_catalog.pg_class a, pg_catalog.pg_class b, pg_catalog.pg_class c WHERE a.oid = b.oid AND b.oid = c.oid',
      },
      setup_timeout: 60,
      run_timeout: 120,
      cleanup_timeout: 30,
      setup_scripts: [],
      run_scripts: [],
      cleanup_scripts: [],
    })
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingScenario(record)
    // 为每个脚本添加 mode 默认值
    const setupScripts = (record.setup_scripts || []).map(s => ({ ...s, mode: s.mode || 'all' }))
    const runScripts = (record.run_scripts || []).map(s => ({ ...s, mode: s.mode || 'all' }))
    const cleanupScripts = (record.cleanup_scripts || []).map(s => ({ ...s, mode: s.mode || 'all' }))
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      category1: record.category1 || 'slow',
      category2: record.category2 || 'cpu',
      category3: record.category3 || 'query',
      description: record.description,
      config: record.config,
      setup_scripts: setupScripts,
      run_scripts: runScripts,
      cleanup_scripts: cleanupScripts,
      setup_timeout: record.setup_timeout || 60,
      run_timeout: record.run_timeout || 120,
      cleanup_timeout: record.cleanup_timeout || 30,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id) => {
    try {
      await faultScenarioApi.delete(id)
      message.success('删除成功')
      loadData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingScenario) {
        await faultScenarioApi.update(editingScenario.id, values)
        message.success('更新成功')
      } else {
        await faultScenarioApi.create(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      loadData()
    } catch (error) {
      // 表单验证错误
      if (error.errorFields) {
        message.error('请检查表单填写是否正确')
        return
      }
      // API错误
      const detail = error.response?.data?.detail || error.message || '未知错误'
      message.error('操作失败: ' + detail)
    }
  }

  // 执行按钮：自动创建演练并启动，然后跳转到演练详情
  const handleExecute = async (scenario) => {
    if (dbConfigs.length === 0) {
      message.error('请先配置数据库连接')
      return
    }

    // 弹窗让用户选择目标数据库
    Modal.confirm({
      title: '执行故障场景',
      icon: <PlayCircleOutlined style={{ color: '#667eea' }} />,
      content: (
        <div style={{ marginTop: 16 }}>
          <Text>场景名称：<Text strong>{scenario.name}</Text></Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            分类：{CATEGORY1_CONFIG[scenario.category1]?.label || '-'} /
            {CATEGORY2_CONFIG[scenario.category1]?.[scenario.category2]?.label || '-'} /
            {CATEGORY3_CONFIG[scenario.category1]?.[scenario.category2]?.[scenario.category3]?.label || '-'}
          </Text>
          <Divider style={{ margin: '12px 0' }} />
          <Text>将创建演练并自动启动执行</Text>
        </div>
      ),
      okText: '确认执行',
      cancelText: '取消',
      okButtonProps: {
        style: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
        }
      },
      onOk: async () => {
        try {
          // 使用第一个数据库配置
          const dbConfigId = dbConfigs[0].id

          // 自动生成演练名称
          const drillName = `${scenario.name} - ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`

          // 创建演练
          const drillData = {
            name: drillName,
            description: `自动创建：故障场景"${scenario.name}"的单场景演练`,
            execution_mode: 'sequential',
            db_config_id: dbConfigId,
            steps: [
              { scenario_id: scenario.id, step_order: 1 }
            ]
          }

          const createRes = await drillApi.create(drillData)
          const drillId = createRes.data.id

          // 立即启动演练
          await drillApi.start(drillId)

          message.success('演练已创建并启动')

          // 跳转到演练管理页面，并带上演练ID参数
          window.location.href = `/drill?highlight=${drillId}`
        } catch (error) {
          message.error('执行失败: ' + (error.response?.data?.detail || error.message))
        }
      }
    })
  }

  // 统计：按一级分类计算数量
  const categoryStats = {
    slow: scenarios.filter(s => s.category1 === 'slow').length,
    full: scenarios.filter(s => s.category1 === 'full').length,
    crash: scenarios.filter(s => s.category1 === 'crash').length,
    error: scenarios.filter(s => s.category1 === 'error').length,
  }

  // 过滤场景列表
  const filteredScenarios = category1Filter
    ? scenarios.filter(s => s.category1 === category1Filter)
    : scenarios

  const scenarioColumns = [
    {
      title: '场景名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '一级分类',
      dataIndex: 'category1',
      key: 'category1',
      render: (category1) => {
        const config = CATEGORY1_CONFIG[category1] || { label: '-', color: '#999' }
        return (
          <Tag
            style={{
              background: config.bg,
              color: config.color,
              border: `1px solid ${config.color}`,
              borderRadius: '6px',
            }}
          >
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: '二级分类',
      dataIndex: 'category2',
      key: 'category2',
      render: (category2, record) => {
        const category1 = record.category1 || 'slow'
        const config = CATEGORY2_CONFIG[category1]?.[category2] || { label: category2 || '-' }
        return <Tag color="default">{config.label}</Tag>
      },
    },
    {
      title: '三级分类',
      dataIndex: 'category3',
      key: 'category3',
      render: (category3, record) => {
        const category1 = record.category1 || 'slow'
        const category2 = record.category2 || 'cpu'
        const config = CATEGORY3_CONFIG[category1]?.[category2]?.[category3] || { label: category3 || '-' }
        return <Tag color="geekblue">{config.label}</Tag>
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc) => <Text type="secondary" style={{ fontSize: '13px' }}>{desc}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record)}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '6px',
            }}
          >
            执行
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleExport(record.id)}
            title="导出"
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定要删除这个场景吗?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 统计卡片 - 按分类统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card
            bordered={false}
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer' }}
            onClick={() => setCategory1Filter(category1Filter === 'slow' ? null : 'slow')}
          >
            <Statistic
              title={<span style={{ color: CATEGORY1_CONFIG.slow.color }}>慢类场景</span>}
              value={categoryStats.slow}
              suffix={`/ ${scenarios.length}`}
              valueStyle={{ color: CATEGORY1_CONFIG.slow.color, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            bordered={false}
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer' }}
            onClick={() => setCategory1Filter(category1Filter === 'full' ? null : 'full')}
          >
            <Statistic
              title={<span style={{ color: CATEGORY1_CONFIG.full.color }}>满类场景</span>}
              value={categoryStats.full}
              suffix={`/ ${scenarios.length}`}
              valueStyle={{ color: CATEGORY1_CONFIG.full.color, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            bordered={false}
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer' }}
            onClick={() => setCategory1Filter(category1Filter === 'crash' ? null : 'crash')}
          >
            <Statistic
              title={<span style={{ color: CATEGORY1_CONFIG.crash.color }}>宕类场景</span>}
              value={categoryStats.crash}
              suffix={`/ ${scenarios.length}`}
              valueStyle={{ color: CATEGORY1_CONFIG.crash.color, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            bordered={false}
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer' }}
            onClick={() => setCategory1Filter(category1Filter === 'error' ? null : 'error')}
          >
            <Statistic
              title={<span style={{ color: CATEGORY1_CONFIG.error.color }}>错类场景</span>}
              value={categoryStats.error}
              suffix={`/ ${scenarios.length}`}
              valueStyle={{ color: CATEGORY1_CONFIG.error.color, fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 故障场景管理卡片 */}
      <Card
        bordered={false}
        style={{ borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
        title={
          <span>
            <ThunderboltOutlined style={{ color: '#667eea', marginRight: 8 }} />
            故障场景管理
            {category1Filter && (
              <Tag
                style={{ marginLeft: 8, background: CATEGORY1_CONFIG[category1Filter].bg, color: CATEGORY1_CONFIG[category1Filter].color }}
              >
                筛选: {CATEGORY1_CONFIG[category1Filter].label}类
              </Tag>
            )}
          </span>
        }
        extra={
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              导入
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportSelected}
              disabled={selectedRowKeys.length === 0}
            >
              导出选中 ({selectedRowKeys.length})
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={handleExportAll}
            >
              导出全部
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                height: '36px',
              }}
            >
              新建场景
            </Button>
          </Space>
        }
      >
        <Table
          columns={scenarioColumns}
          dataSource={filteredScenarios}
          rowKey="id"
          loading={loading}
          pagination={false}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      </Card>

      {/* 导入场景弹窗 */}
      <Modal
        title="导入故障场景"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={500}
      >
        <Alert
          message="导入说明"
          description="上传 YAML 格式的故障场景配置文件，支持单个或多个文件导入。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Upload.Dragger
          accept=".yaml,.yml"
          beforeUpload={handleImport}
          showUploadList={false}
          multiple
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 YAML 文件到此区域</p>
          <p className="ant-upload-hint">支持单个或批量导入，文件格式: .yaml 或 .yml</p>
        </Upload.Dragger>
      </Modal>

      {/* 创建/编辑场景弹窗 - 优化版 */}
      <Modal
        title={editingScenario ? '编辑故障场景' : '新建故障场景'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={720}
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          }
        }}
      >
        <Form form={form} layout="vertical">
          {/* 基本信息 - 紧凑布局 */}
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }} title={<Text strong>基本信息</Text>}>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="name" label="场景名称" rules={[{ required: true, message: '必填' }]}>
                  <Input placeholder="如: CPU压力测试" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="type" label="故障类型" rules={[{ required: true }]}>
                  <Select>
                    {Object.entries(SCENARIO_TYPE_CONFIG).map(([key, val]) => (
                      <Select.Option key={key} value={key}>{val.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="description" label="描述">
                  <Input placeholder="简短描述" />
                </Form.Item>
              </Col>
            </Row>
            {/* 分类选择 - 合并一行 */}
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="category1" label="分类" rules={[{ required: true }]}>
                  <Select onChange={(val) => {
                    const c2Keys = Object.keys(CATEGORY2_CONFIG[val])
                    const c2First = c2Keys[0]
                    const c3Keys = Object.keys(CATEGORY3_CONFIG[val]?.[c2First] || {})
                    form.setFieldsValue({ category2: c2First, category3: c3Keys[0] || 'query' })
                  }}>
                    {Object.entries(CATEGORY1_CONFIG).map(([key, val]) => (
                      <Select.Option key={key} value={key}>
                        <Tag style={{ background: val.bg, color: val.color, border: `1px solid ${val.color}`, marginRight: 4 }}>{val.label}</Tag>
                        {val.desc}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="category2" rules={[{ required: true }]}>
                  <Select onChange={(val) => {
                    const c1 = form.getFieldValue('category1') || 'slow'
                    const c3Keys = Object.keys(CATEGORY3_CONFIG[c1]?.[val] || {})
                    form.setFieldsValue({ category3: c3Keys[0] || 'query' })
                  }}>
                    {(form.getFieldValue('category1') || 'slow') && 
                      Object.entries(CATEGORY2_CONFIG[form.getFieldValue('category1') || 'slow']).map(([key, val]) => (
                        <Select.Option key={key} value={key}>{val.label}</Select.Option>
                      ))
                    }
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="category3" rules={[{ required: true }]}>
                  <Select>
                    {((form.getFieldValue('category1') || 'slow') && (form.getFieldValue('category2') || 'cpu')) && 
                      Object.entries(CATEGORY3_CONFIG[form.getFieldValue('category1') || 'slow']?.[form.getFieldValue('category2') || 'cpu'] || {}).map(([key, val]) => (
                        <Select.Option key={key} value={key}>{val.label}</Select.Option>
                      ))
                    }
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 三环节配置 - 默认展开运行环节 */}
          <Collapse defaultActiveKey={['run']} style={{ marginBottom: 16 }}>
            <Collapse.Panel key="setup" header={<><Tag color="blue">前置准备</Tag> <Text type="secondary">创建测试环境</Text></>}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="setup_timeout" label="环节超时">
                    <InputNumber min={10} max={600} style={{ width: '100%' }} addonAfter="秒" placeholder="60" />
                  </Form.Item>
                </Col>
              </Row>
              <Divider style={{ margin: '8px 0' }} />
              <Form.List name="setup_scripts">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card key={key} size="small" style={{ marginBottom: 8 }} bodyStyle={{ padding: '12px' }}>
                        <Row gutter={8}>
                          <Col span={3}>
                            <Form.Item {...restField} name={[name, 'type']} label="类型">
                              <Select size="small" style={{ width: '100%' }}>
                                <Select.Option value="sql">SQL</Select.Option>
                                <Select.Option value="shell">Shell</Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col span={3}>
                            <Form.Item {...restField} name={[name, 'timeout']} label="超时">
                              <InputNumber size="small" min={5} max={300} style={{ width: '100%' }} addonAfter="s" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item {...restField} name={[name, 'description']} label="说明">
                              <Input size="small" placeholder="脚本用途" />
                            </Form.Item>
                          </Col>
                          <Col span={9}>
                            <Form.Item {...restField} name={[name, 'content']} label="内容">
                              <Input.TextArea size="small" rows={1} placeholder="SQL或命令" autoSize />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Button type="link" size="small" danger onClick={() => remove(name)} icon={<DeleteOutlined />}>删除</Button>
                      </Card>
                    ))}
                    <Button size="small" type="dashed" onClick={() => add({ type: 'sql', mode: 'all', timeout: 30 })} icon={<PlusOutlined />}>
                      添加脚本
                    </Button>
                  </>
                )}
              </Form.List>
            </Collapse.Panel>

            <Collapse.Panel key="run" header={<><Tag color="orange">故障注入</Tag> <Text type="secondary">执行压力测试</Text></>}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="run_timeout" label="环节超时">
                    <InputNumber min={10} max={600} style={{ width: '100%' }} addonAfter="秒" placeholder="120" />
                  </Form.Item>
                </Col>
              </Row>
              
              {/* 默认注入参数 */}
              <Alert type="info" style={{ marginBottom: 8, fontSize: 12 }} message="未配置脚本时，将使用以下参数执行默认故障注入" />
              <Card size="small" style={{ marginBottom: 8, background: '#fffbe6' }} bodyStyle={{ padding: '12px' }}>
                <Row gutter={12}>
                  <Col span={6}>
                    <Form.Item name={['config', 'concurrency']} label="并发数">
                      <InputNumber size="small" min={1} max={500} style={{ width: '100%' }} placeholder="50" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name={['config', 'duration_seconds']} label="持续时间">
                      <InputNumber size="small" min={1} max={3600} style={{ width: '100%' }} addonAfter="秒" placeholder="60" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name={['config', 'interval_ms']} label="查询间隔">
                      <InputNumber size="small" min={10} max={10000} style={{ width: '100%' }} addonAfter="ms" placeholder="100" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name={['config', 'query_template']} label="SQL模板" style={{ marginBottom: 0 }}>
                  <Input.TextArea size="small" rows={2} placeholder="SELECT count(*) FROM ..." style={{ fontFamily: 'monospace' }} />
                </Form.Item>
              </Card>

              <Divider style={{ margin: '12px 0' }} orientation="left"><Text type="secondary">自定义脚本（替代默认注入）</Text></Divider>
              <Form.List name="run_scripts">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card key={key} size="small" style={{ marginBottom: 8, background: '#fff7e6' }} bodyStyle={{ padding: '12px' }}>
                        <Row gutter={8}>
                          <Col span={3}>
                            <Form.Item {...restField} name={[name, 'type']} label="类型">
                              <Select size="small" style={{ width: '100%' }}>
                                <Select.Option value="sql">SQL</Select.Option>
                                <Select.Option value="shell">Shell</Select.Option>
                                <Select.Option value="stress">Stress</Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col span={3}>
                            <Form.Item {...restField} name={[name, 'timeout']} label="超时">
                              <InputNumber size="small" min={10} max={300} style={{ width: '100%' }} addonAfter="s" />
                            </Form.Item>
                          </Col>
                          <Col span={3}>
                            <Form.Item {...restField} name={[name, 'iterations']} label="次数">
                              <InputNumber size="small" min={1} max={1000} style={{ width: '100%' }} placeholder="1" />
                            </Form.Item>
                          </Col>
                          <Col span={7}>
                            <Form.Item {...restField} name={[name, 'description']} label="说明">
                              <Input size="small" placeholder="脚本用途" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item {...restField} name={[name, 'content']} label="内容">
                              <Input.TextArea size="small" rows={1} placeholder="SQL或命令" autoSize />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Button type="link" size="small" danger onClick={() => remove(name)} icon={<DeleteOutlined />}>删除</Button>
                      </Card>
                    ))}
                    <Button size="small" type="dashed" onClick={() => add({ type: 'sql', mode: 'all', timeout: 60, iterations: 1 })} icon={<PlusOutlined />}>
                      添加脚本
                    </Button>
                  </>
                )}
              </Form.List>
            </Collapse.Panel>

            <Collapse.Panel key="cleanup" header={<><Tag color="green">清理环境</Tag> <Text type="secondary">清除测试数据</Text></>}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="cleanup_timeout" label="环节超时">
                    <InputNumber min={5} max={300} style={{ width: '100%' }} addonAfter="秒" placeholder="30" />
                  </Form.Item>
                </Col>
              </Row>
              <Divider style={{ margin: '8px 0' }} />
              <Form.List name="cleanup_scripts">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card key={key} size="small" style={{ marginBottom: 8, background: '#f6ffed' }} bodyStyle={{ padding: '12px' }}>
                        <Row gutter={8}>
                          <Col span={3}>
                            <Form.Item {...restField} name={[name, 'type']} label="类型">
                              <Select size="small" style={{ width: '100%' }}>
                                <Select.Option value="sql">SQL</Select.Option>
                                <Select.Option value="shell">Shell</Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col span={3}>
                            <Form.Item {...restField} name={[name, 'timeout']} label="超时">
                              <InputNumber size="small" min={5} max={60} style={{ width: '100%' }} addonAfter="s" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item {...restField} name={[name, 'description']} label="说明">
                              <Input size="small" placeholder="脚本用途" />
                            </Form.Item>
                          </Col>
                          <Col span={9}>
                            <Form.Item {...restField} name={[name, 'content']} label="内容">
                              <Input.TextArea size="small" rows={1} placeholder="SQL或命令" autoSize />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Button type="link" size="small" danger onClick={() => remove(name)} icon={<DeleteOutlined />}>删除</Button>
                      </Card>
                    ))}
                    <Button size="small" type="dashed" onClick={() => add({ type: 'sql', mode: 'all', timeout: 10 })} icon={<PlusOutlined />}>
                      添加脚本
                    </Button>
                  </>
                )}
              </Form.List>
            </Collapse.Panel>
          </Collapse>
        </Form>
      </Modal>
    </div>
  )
}

export default FaultScenarios