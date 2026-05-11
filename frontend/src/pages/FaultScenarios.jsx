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
  Progress,
  Typography,
  Divider,
  Alert,
  Upload,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  StopOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  UploadOutlined,
  DownloadOutlined,
  ExportOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { faultScenarioApi, injectionApi, databaseConfigApi, scenarioIOApi } from '../api'

const { TextArea } = Input
const { Text } = Typography

const SCENARIO_TYPE_CONFIG = {
  high_concurrency: { label: '高并发查询', color: '#1890ff', bg: '#e6f7ff' },
  slow_query: { label: '慢查询', color: '#722ed1', bg: '#f9f0ff' },
  connection_exhaustion: { label: '连接耗尽', color: '#fa8c16', bg: '#fff7e6' },
  io_pressure: { label: 'IO压力', color: '#13c2c2', bg: '#e6fffb' },
}

const STATUS_CONFIG = {
  running: { label: '运行中', color: 'processing', icon: <LoadingOutlined spin /> },
  completed: { label: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
  failed: { label: '失败', color: 'error', icon: null },
  stopped: { label: '已停止', color: 'warning', icon: null },
}

function FaultScenarios() {
  const location = useLocation()
  const [scenarios, setScenarios] = useState([])
  const [dbConfigs, setDbConfigs] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [injectModalVisible, setInjectModalVisible] = useState(false)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [selectedLog, setSelectedLog] = useState('')
  const [editingScenario, setEditingScenario] = useState(null)
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])  // 批量选择
  const [importModalVisible, setImportModalVisible] = useState(false)  // 导入弹窗
  const [form] = Form.useForm()
  const [injectForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [location.pathname])

  const loadData = async () => {
    setLoading(true)
    try {
      const [scenariosRes, dbConfigsRes, recordsRes] = await Promise.all([
        faultScenarioApi.getAll(),
        databaseConfigApi.getAll(),
        injectionApi.getRecords(),
      ])
      setScenarios(scenariosRes.data)
      setDbConfigs(dbConfigsRes.data)
      setRecords(recordsRes.data)
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
    return false  // 阻止默认上传行为
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
      config: {
        concurrency: 50,
        duration_seconds: 60,
        interval_ms: 100,
        query_template: 'SELECT count(*) FROM pg_catalog.pg_class a, pg_catalog.pg_class b, pg_catalog.pg_class c WHERE a.oid = b.oid AND b.oid = c.oid',
      },
      // 三阶段超时默认值
      setup_timeout: 60,
      run_timeout: 120,
      cleanup_timeout: 30,
      // 空脚本列表
      setup_scripts: [],
      run_scripts: [],
      cleanup_scripts: [],
    })
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingScenario(record)
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      description: record.description,
      config: record.config,
      // 三阶段脚本
      setup_scripts: record.setup_scripts || [],
      run_scripts: record.run_scripts || [],
      cleanup_scripts: record.cleanup_scripts || [],
      // 超时配置
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
      message.error('操作失败')
    }
  }

  const handleInjectClick = (scenario) => {
    setSelectedScenario(scenario)
    injectForm.resetFields()
    setInjectModalVisible(true)
  }

  const handleStartInjection = async () => {
    try {
      const values = await injectForm.validateFields()
      const response = await injectionApi.start(
        selectedScenario.id,
        values.db_config_id
      )
      message.success('故障注入已启动')
      setInjectModalVisible(false)
      loadData()
      pollStatus(response.data.id)
    } catch (error) {
      message.error('启动失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleStopInjection = async (recordId) => {
    try {
      await injectionApi.stop(recordId)
      message.success('已停止故障注入')
      loadData()
    } catch (error) {
      message.error('停止失败')
    }
  }

  const handleViewLog = (record) => {
    setSelectedLog(record.log || '暂无日志记录')
    setLogModalVisible(true)
  }

  const pollStatus = async (recordId) => {
    const maxPolls = 120
    let pollCount = 0
    const poll = async () => {
      if (pollCount >= maxPolls) return
      pollCount++
      try {
        const response = await injectionApi.getStatus(recordId)
        setRecords((prev) =>
          prev.map((r) => (r.id === recordId ? response.data : r))
        )
        if (response.data.status === 'running') {
          setTimeout(poll, 1000)
        }
      } catch (error) {
        setTimeout(poll, 2000)
      }
    }
    poll()
  }

  // 统计
  const runningCount = records.filter(r => r.status === 'running').length
  const completedCount = records.filter(r => r.status === 'completed').length

  const scenarioColumns = [
    {
      title: '场景名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const config = SCENARIO_TYPE_CONFIG[type] || { label: type, color: '#666' }
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
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc) => <Text type="secondary" style={{ fontSize: '13px' }}>{desc}</Text>,
    },
    {
      title: '并发数',
      dataIndex: ['config', 'concurrency'],
      key: 'concurrency',
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '持续时间',
      dataIndex: ['config', 'duration_seconds'],
      key: 'duration',
      render: (val) => <span style={{ color: '#999' }}>{val}s</span>,
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
            onClick={() => handleInjectClick(record)}
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

  const recordColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '场景',
      dataIndex: 'scenario_name',
      key: 'scenario_name',
      render: (name) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '数据库',
      dataIndex: 'db_config_name',
      key: 'db_config_name',
      render: (name) => <Text type="secondary">{name}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = STATUS_CONFIG[status] || { label: status, color: 'default' }
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: '进度',
      key: 'progress',
      render: (_, record) => (
        record.status === 'running' ? (
          <Progress 
            percent={record.progress_percent || 0} 
            size="small" 
            status="active"
            style={{ width: 100 }}
          />
        ) : (
          <span style={{ color: '#999' }}>-</span>
        )
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'running' && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleStopInjection(record.id)}
            >
              停止
            </Button>
          )}
          <Button
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleViewLog(record)}
          >
            日志
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card 
            bordered={false}
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <Statistic
              title="故障场景"
              value={scenarios.length}
              prefix={<ThunderboltOutlined style={{ color: '#667eea' }} />}
              valueStyle={{ color: '#667eea', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            bordered={false}
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <Statistic
              title="正在运行"
              value={runningCount}
              prefix={runningCount > 0 ? <LoadingOutlined spin style={{ color: '#1890ff' }} /> : <ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            bordered={false}
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <Statistic
              title="已完成"
              value={completedCount}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            bordered={false}
            style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <Statistic
              title="注入记录"
              value={records.length}
              prefix={<HistoryOutlined style={{ color: '#8c8c8c' }} />}
              valueStyle={{ color: '#8c8c8c', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 故障场景卡片 */}
      <Card
        bordered={false}
        style={{ borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24 }}
        title={<span><ThunderboltOutlined style={{ color: '#667eea', marginRight: 8 }} />故障场景管理</span>}
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
          dataSource={scenarios}
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

      {/* 注入历史卡片 */}
      <Card
        bordered={false}
        style={{ borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
        title={<span><HistoryOutlined style={{ color: '#8c8c8c', marginRight: 8 }} />注入历史记录</span>}
        extra={
          <Button onClick={loadData}>刷新</Button>
        }
      >
        <Table
          columns={recordColumns}
          dataSource={records}
          rowKey="id"
          pagination={{ pageSize: 5, showSizeChanger: false }}
          locale={{ emptyText: '暂无注入记录' }}
        />
      </Card>

      {/* 创建/编辑场景弹窗 */}
      <Modal
        title={editingScenario ? '编辑故障场景' : '新建故障场景'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={900}
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="场景名称"
                rules={[{ required: true, message: '请输入场景名称' }]}
              >
                <Input placeholder="例如: 高并发CPU压力测试" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="故障类型"
                rules={[{ required: true, message: '请选择故障类型' }]}
              >
                <Select>
                  {Object.entries(SCENARIO_TYPE_CONFIG).map(([key, val]) => (
                    <Select.Option key={key} value={key}>
                      <Tag style={{ background: val.bg, color: val.color, border: `1px solid ${val.color}` }}>
                        {val.label}
                      </Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="场景描述" />
          </Form.Item>

          <Divider orientation="left">⚡ 运行环节参数（默认故障注入）</Divider>
          <Alert 
            message="如果未配置自定义脚本，将使用以下参数进行默认故障注入"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={['config', 'concurrency']} label="并发连接数">
                <InputNumber min={1} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={['config', 'duration_seconds']} label="持续时间(秒)">
                <InputNumber min={1} max={3600} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={['config', 'interval_ms']} label="查询间隔(毫秒)">
                <InputNumber min={10} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name={['config', 'query_template']} label="SQL查询模板">
            <TextArea rows={3} placeholder="SELECT ..." />
          </Form.Item>

          <Divider orientation="left">📋 前置环节脚本</Divider>
          <Form.Item name="setup_timeout" label="前置环节超时(秒)">
            <InputNumber min={10} max={300} style={{ width: 200 }} />
          </Form.Item>
          <Form.List name="setup_scripts">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8 }} title={`前置脚本 ${name + 1}`}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'type']} label="类型">
                          <Select>
                            <Select.Option value="sql">SQL</Select.Option>
                            <Select.Option value="shell">Shell</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'timeout']} label="超时(秒)">
                          <InputNumber min={5} max={120} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item {...restField} name={[name, 'description']} label="描述">
                          <Input placeholder="脚本用途说明" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item {...restField} name={[name, 'content']} label="脚本内容">
                      <TextArea rows={3} placeholder="SQL语句或Shell命令" />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(name)} icon={<DeleteOutlined />}>
                      删除脚本
                    </Button>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ type: 'sql', timeout: 30 })} block icon={<PlusOutlined />}>
                  添加前置脚本
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left">🔥 运行环节脚本（可选，替代默认注入）</Divider>
          <Alert 
            message="配置运行脚本后，将替代默认故障注入参数，执行自定义脚本"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item name="run_timeout" label="运行环节超时(秒)">
            <InputNumber min={10} max={600} style={{ width: 200 }} />
          </Form.Item>
          <Form.List name="run_scripts">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fff7e6' }} title={`运行脚本 ${name + 1}`}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'type']} label="类型">
                          <Select>
                            <Select.Option value="sql">SQL</Select.Option>
                            <Select.Option value="shell">Shell</Select.Option>
                            <Select.Option value="stress">Stress (压力测试)</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'timeout']} label="超时(秒)">
                          <InputNumber min={10} max={300} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'iterations']} label="执行次数">
                          <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'interval_ms']} label="间隔(毫秒)">
                          <InputNumber min={0} max={10000} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item {...restField} name={[name, 'description']} label="描述">
                      <Input placeholder="脚本用途说明" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'content']} label="脚本内容">
                      <TextArea rows={3} placeholder="SQL语句、Shell命令或压力测试参数" />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(name)} icon={<DeleteOutlined />}>
                      删除脚本
                    </Button>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ type: 'sql', timeout: 60, iterations: 1, interval_ms: 100 })} block icon={<PlusOutlined />}>
                  添加运行脚本
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left">🧹 清理环节脚本</Divider>
          <Form.Item name="cleanup_timeout" label="清理环节超时(秒)">
            <InputNumber min={5} max={60} style={{ width: 200 }} />
          </Form.Item>
          <Form.List name="cleanup_scripts">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#f6ffed' }} title={`清理脚本 ${name + 1}`}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'type']} label="类型">
                          <Select>
                            <Select.Option value="sql">SQL</Select.Option>
                            <Select.Option value="shell">Shell</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'timeout']} label="超时(秒)">
                          <InputNumber min={5} max={60} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item {...restField} name={[name, 'description']} label="描述">
                          <Input placeholder="脚本用途说明" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item {...restField} name={[name, 'content']} label="脚本内容">
                      <TextArea rows={3} placeholder="SQL语句或Shell命令" />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(name)} icon={<DeleteOutlined />}>
                      删除脚本
                    </Button>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ type: 'sql', timeout: 10 })} block icon={<PlusOutlined />}>
                  添加清理脚本
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* 执行注入弹窗 */}
      <Modal
        title={<span><PlayCircleOutlined style={{ color: '#667eea' }} /> 执行故障注入</span>}
        open={injectModalVisible}
        onOk={handleStartInjection}
        onCancel={() => setInjectModalVisible(false)}
        okText="开始注入"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          }
        }}
      >
        <Alert
          message={`即将执行场景: ${selectedScenario?.name}`}
          description={selectedScenario?.description}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={injectForm} layout="vertical">
          <Form.Item
            name="db_config_id"
            label="目标数据库"
            rules={[{ required: true, message: '请选择目标数据库' }]}
          >
            <Select
              placeholder="选择要注入故障的数据库"
              options={dbConfigs.map(config => ({
                value: config.id,
                label: `${config.name} (${config.host}:${config.port}/${config.database})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 日志弹窗 */}
      <Modal
        title={<span><FileTextOutlined style={{ color: '#8c8c8c' }} /> 执行日志</span>}
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={<Button onClick={() => setLogModalVisible(false)}>关闭</Button>}
        width={700}
      >
        <pre style={{
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: '16px',
          borderRadius: '8px',
          maxHeight: '400px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '13px',
        }}>
          {selectedLog}
        </pre>
      </Modal>
    </div>
  )
}

export default FaultScenarios