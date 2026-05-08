import React, { useState, useEffect } from 'react'
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
  Descriptions,
  Alert,
  Divider,
  Typography,
  Tag,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  StopOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { faultScenarioApi, injectionApi, databaseConfigApi } from '../api'

const { TextArea } = Input
const { Text } = Typography

function FaultScenarios() {
  const [scenarios, setScenarios] = useState([])
  const [dbConfigs, setDbConfigs] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [injectModalVisible, setInjectModalVisible] = useState(false)
  const [editingScenario, setEditingScenario] = useState(null)
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [form] = Form.useForm()
  const [injectForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

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
    if (dbConfigs.length > 0) {
      injectForm.setFieldsValue({ db_config_id: dbConfigs[0].id })
    }
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

  const getScenarioTypeLabel = (type) => {
    const types = {
      high_concurrency: '高并发查询',
      slow_query: '慢查询',
      connection_exhaustion: '连接耗尽',
      io_pressure: 'IO压力',
    }
    return types[type] || type
  }

  const getStatusTag = (status) => {
    const colors = {
      running: 'processing',
      completed: 'success',
      failed: 'error',
    }
    return <Tag color={colors[status] || 'default'}>{status}</Tag>
  }

  const columns = [
    { title: '场景名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => getScenarioTypeLabel(type),
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '并发数',
      key: 'concurrency',
      render: (_, record) => record.config?.concurrency || '-',
    },
    {
      title: '持续时间(s)',
      key: 'duration',
      render: (_, record) => record.config?.duration_seconds || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => handleInjectClick(record)}
          >
            执行注入
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个场景吗?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const recordColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    {
      title: '场景',
      key: 'scenario',
      render: (_, record) =>
        scenarios.find((s) => s.id === record.scenario_id)?.name || '-',
    },
    {
      title: '数据库',
      key: 'database',
      render: (_, record) =>
        dbConfigs.find((d) => d.id === record.db_config_id)?.name || '-',
    },
    { title: '状态', dataIndex: 'status', key: 'status', render: getStatusTag },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '结束时间',
      dataIndex: 'ended_at',
      key: 'ended_at',
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'running' && (
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleStopInjection(record.id)}
            >
              停止
            </Button>
          )}
          <Tooltip title={record.log || '无日志'}>
            <Button size="small">查看日志</Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card title="故障场景管理" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建故障场景
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={scenarios}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Card title={<><HistoryOutlined /> 注入历史记录</>} extra={<Button onClick={loadData}>刷新</Button>}>
        <Table
          columns={recordColumns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingScenario ? '编辑故障场景' : '新建故障场景'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="场景名称"
            rules={[{ required: true, message: '请输入场景名称' }]}
          >
            <Input placeholder="例如: 高并发CPU压力测试" />
          </Form.Item>
          <Form.Item
            name="type"
            label="场景类型"
            rules={[{ required: true, message: '请选择场景类型' }]}
          >
            <Select>
              <Select.Option value="high_concurrency">高并发查询</Select.Option>
              <Select.Option value="slow_query">慢查询</Select.Option>
              <Select.Option value="connection_exhaustion">连接耗尽</Select.Option>
              <Select.Option value="io_pressure">IO压力</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="场景描述" />
          </Form.Item>
          <Divider>注入参数配置</Divider>
          <Form.Item
            name={['config', 'concurrency']}
            label="并发连接数"
            rules={[{ required: true, message: '请输入并发数' }]}
          >
            <InputNumber min={1} max={1000} />
          </Form.Item>
          <Form.Item
            name={['config', 'duration_seconds']}
            label="持续时间(秒)"
            rules={[{ required: true, message: '请输入持续时间' }]}
          >
            <InputNumber min={1} max={3600} />
          </Form.Item>
          <Form.Item
            name={['config', 'interval_ms']}
            label="查询间隔(毫秒)"
          >
            <InputNumber min={0} max={10000} />
          </Form.Item>
          <Form.Item
            name={['config', 'query_template']}
            label="SQL查询模板"
          >
            <TextArea
              rows={3}
              placeholder="CPU密集型查询SQL，默认使用pg_class表自连接"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<><ThunderboltOutlined /> 执行故障注入</>}
        open={injectModalVisible}
        onOk={handleStartInjection}
        onCancel={() => setInjectModalVisible(false)}
      >
        <Alert
          message="警告"
          description="故障注入将对目标数据库产生压力，请确保目标数据库可以承受测试负载，且已获得授权进行测试。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="场景名称">{selectedScenario?.name}</Descriptions.Item>
          <Descriptions.Item label="并发数">{selectedScenario?.config?.concurrency}</Descriptions.Item>
          <Descriptions.Item label="持续时间">{selectedScenario?.config?.duration_seconds}秒</Descriptions.Item>
        </Descriptions>
        <Divider />
        <Form form={injectForm} layout="vertical">
          <Form.Item
            name="db_config_id"
            label="目标数据库"
            rules={[{ required: true, message: '请选择目标数据库' }]}
          >
            <Select placeholder="选择要注入故障的数据库">
              {dbConfigs.map((config) => (
                <Select.Option key={config.id} value={config.id}>
                  {config.name} ({config.host}:{config.port}/{config.database})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FaultScenarios