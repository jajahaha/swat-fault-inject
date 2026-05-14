import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Popconfirm,
  Progress,
  Tag,
  Descriptions,
  Divider,
  Alert,
  List,
  Transfer,
  Typography,
  Row,
  Col,
  Statistic,
  Timeline,
} from 'antd'
import {
  PlusOutlined,
  PlayCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  OrderedListOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { drillApi, faultScenarioApi, databaseConfigApi } from '../api'

const { TextArea } = Input
const { Text } = Typography

const DRILL_STATUS_CONFIG = {
  pending: { label: '待执行', color: 'default', bg: '#f5f5f5', icon: <ClockCircleOutlined /> },
  preparing: { label: '准备中', color: 'processing', bg: '#e6f7ff', icon: <LoadingOutlined spin /> },
  running: { label: '运行中', color: 'processing', bg: '#e6f7ff', icon: <LoadingOutlined spin /> },
  cleaning: { label: '清理中', color: 'warning', bg: '#fff7e6', icon: <LoadingOutlined spin /> },
  completed: { label: '已完成', color: 'success', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
  failed: { label: '失败', color: 'error', bg: '#fff2f0', icon: null },
  stopped: { label: '已停止', color: 'warning', bg: '#fff7e6', icon: null },
  completed_with_cleanup_failed: { label: '已完成(清理失败)', color: 'warning', bg: '#fffbe6', icon: <CheckCircleOutlined /> },
}

const PHASE_CONFIG = {
  preparing: { label: '前置准备', color: '#1890ff', desc: '创建测试环境...' },
  injecting: { label: '故障注入', color: '#52c41a', desc: '执行压力测试...' },
  cleaning: { label: '清理环境', color: '#fa8c16', desc: '清除测试数据...' },
}

function DrillManagement() {
  const location = useLocation()
  const [drills, setDrills] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [dbConfigs, setDbConfigs] = useState([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedDrill, setSelectedDrill] = useState(null)
  const [selectedSteps, setSelectedSteps] = useState([])
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [location.pathname])

  const loadData = async () => {
    setLoading(true)
    try {
      const [drillsRes, scenariosRes, dbConfigsRes] = await Promise.all([
        drillApi.getList(),
        faultScenarioApi.getAll(),
        databaseConfigApi.getAll(),
      ])
      setDrills(drillsRes.data)
      setScenarios(scenariosRes.data)
      setDbConfigs(dbConfigsRes.data)
    } catch (error) {
      message.error('加载数据失败')
    }
    setLoading(false)
  }

  const handleCreate = () => {
    form.resetFields()
    setSelectedSteps([])
    setCreateModalVisible(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (selectedSteps.length === 0) {
        message.error('请选择至少一个故障场景')
        return
      }

      const steps = selectedSteps.map((scenarioId, index) => ({
        scenario_id: scenarioId,
        step_order: index + 1,
      }))

      const drillData = {
        name: values.name,
        description: values.description,
        execution_mode: values.execution_mode,
        db_config_id: values.db_config_id,
        steps: steps,
      }

      await drillApi.create(drillData)
      message.success('演练创建成功')
      setCreateModalVisible(false)
      loadData()
    } catch (error) {
      message.error('创建失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleStart = async (drillId) => {
    try {
      await drillApi.start(drillId)
      message.success('演练已启动')
      loadData()
      pollDrillStatus(drillId)
    } catch (error) {
      message.error('启动失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleStop = async (drillId) => {
    try {
      await drillApi.stop(drillId)
      message.success('演练已停止')
      loadData()
    } catch (error) {
      message.error('停止失败')
    }
  }

  const handleDelete = async (drillId) => {
    try {
      await drillApi.delete(drillId)
      message.success('演练已删除')
      loadData()
    } catch (error) {
      message.error('删除失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleViewDetail = async (drill) => {
    try {
      const response = await drillApi.getStatus(drill.id)
      setSelectedDrill(response.data)
      setDetailModalVisible(true)
    } catch (error) {
      message.error('获取详情失败')
    }
  }

  const pollDrillStatus = async (drillId) => {
    const maxPolls = 300
    let pollCount = 0
    const poll = async () => {
      if (pollCount >= maxPolls) return
      pollCount++
      try {
        const response = await drillApi.getStatus(drillId)
        setDrills((prev) =>
          prev.map((d) => (d.id === drillId ? response.data : d))
        )
        if (['running', 'preparing', 'cleaning'].includes(response.data.status)) {
          setTimeout(poll, 1000)
        }
      } catch (error) {
        setTimeout(poll, 2000)
      }
    }
    poll()
  }

  const getStatusTag = (status) => {
    const config = DRILL_STATUS_CONFIG[status] || { label: status, color: 'default' }
    return (
      <Tag 
        color={config.color} 
        icon={config.icon}
        style={{ borderRadius: '6px', padding: '2px 8px' }}
      >
        {config.label}
      </Tag>
    )
  }

  const getPhaseTag = (phase) => {
    if (!phase) return null
    const config = PHASE_CONFIG[phase] || { label: phase, color: '#8c8c8c' }
    return (
      <Tag
        style={{
          background: config.color + '20',
          color: config.color,
          border: `1px solid ${config.color}`,
          borderRadius: '6px',
        }}
      >
        {config.label}
      </Tag>
    )
  }

  // 统计
  const runningCount = drills.filter(d => ['running', 'preparing', 'cleaning'].includes(d.status)).length
  const completedCount = drills.filter(d => d.status === 'completed').length

  const transferDataSource = scenarios.map((s) => ({
    key: s.id,
    title: s.name,
    description: s.description || s.type,
  }))

  const columns = [
    { 
      title: 'ID', 
      dataIndex: 'id', 
      key: 'id', 
      width: 60,
      render: (id) => <Text style={{ color: '#8c8c8c' }}>{id}</Text>,
    },
    { 
      title: '演练名称', 
      dataIndex: 'name', 
      key: 'name',
      render: (name) => <Text strong>{name}</Text>,
    },
    { 
      title: '执行模式', 
      dataIndex: 'execution_mode', 
      key: 'execution_mode',
      render: (mode) => (
        <Tag 
          color={mode === 'sequential' ? 'blue' : 'purple'}
          style={{ borderRadius: '6px' }}
        >
          {mode === 'sequential' ? '顺序执行' : '并行执行'}
        </Tag>
      )
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: getStatusTag
    },
    {
      title: '进度',
      key: 'progress',
      width: 220,
      render: (_, record) => (
        <div style={{ width: 200 }}>
          {/* 进度条 */}
          <Progress 
            percent={record.progress_percent || 0} 
            size="large"
            strokeWidth={14}
            status={['running', 'preparing', 'cleaning'].includes(record.status) ? 'active' : 
                    record.status === 'completed' ? 'success' : 
                    record.status === 'failed' ? 'exception' : 'normal'}
            strokeColor={{
              '0%': '#667eea',
              '100%': '#764ba2',
            }}
            trailColor="#f0f0f0"
          />
          {/* 步骤和阶段信息 */}
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: '12px', color: '#8c8c8c' }}>
              步骤 {record.current_step || 0}/{record.total_steps}
            </Text>
            {['running', 'preparing', 'cleaning'].includes(record.status) && record.current_phase && getPhaseTag(record.current_phase)}
          </div>
        </div>
      )
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (time) => time ? 
        <Text style={{ color: '#8c8c8c', fontSize: '13px' }}>
          {new Date(time).toLocaleString()}
        </Text> : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record.id)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '6px',
              }}
            >
              启动
            </Button>
          )}
          {['running', 'preparing', 'cleaning'].includes(record.status) && (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={() => handleStop(record.id)}
              style={{ borderRadius: '6px' }}
            >
              停止
            </Button>
          )}
          <Button
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            style={{ borderRadius: '6px' }}
          >
            详情
          </Button>
          {!['running', 'preparing', 'cleaning'].includes(record.status) && (
            <Popconfirm
              title="确定要删除这个演练吗?"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button danger icon={<DeleteOutlined />} style={{ borderRadius: '6px' }} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const renderStepProgress = (step) => {
    const progress = step.progress_percent || 0
    const phase = step.current_phase
    const phaseConfig = phase ? (PHASE_CONFIG[phase] || { label: phase, color: '#8c8c8c', desc: '' }) : null
    
    // 根据阶段设置进度条颜色
    let strokeColor = { '0%': '#667eea', '100%': '#764ba2' }
    if (phase === 'preparing') {
      strokeColor = { '0%': '#1890ff', '100%': '#40a9ff' }
    } else if (phase === 'injecting') {
      strokeColor = { '0%': '#52c41a', '100%': '#73d13d' }
    } else if (phase === 'cleaning') {
      strokeColor = { '0%': '#fa8c16', '100%': '#ffc53d' }
    }
    
    return (
      <div key={step.id} style={{ marginBottom: 20, padding: '16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: '14px' }}>
            步骤 {step.step_order}: {step.scenario_name}
          </Text>
          <Space>
            {getStatusTag(step.status)}
            {['running', 'preparing', 'cleaning'].includes(step.status) && phase && getPhaseTag(phase)}
          </Space>
        </div>
        
        {/* 大进度条 */}
        <div style={{ position: 'relative' }}>
          <Progress 
            percent={progress} 
            size="large"
            strokeWidth={18}
            status={step.status === 'failed' ? 'exception' : step.status === 'completed' ? 'success' : 'active'}
            strokeColor={strokeColor}
            trailColor="#f0f0f0"
            style={{ marginBottom: 8 }}
          />
          {/* 进度百分比显示 */}
          <div style={{ 
            position: 'absolute', 
            right: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            fontSize: '14px',
            fontWeight: 600,
            color: progress >= 100 ? '#52c41a' : progress > 0 ? '#667eea' : '#8c8c8c'
          }}>
            {progress}%
          </div>
        </div>
        
        {/* 阶段描述 */}
        {phaseConfig && ['running', 'preparing', 'cleaning'].includes(step.status) && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              display: 'inline-block', 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              background: phaseConfig.color,
              animation: step.status === 'running' ? 'pulse 1.5s infinite' : 'none'
            }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {phaseConfig.desc}
            </Text>
          </div>
        )}
        
        {/* CSS 动画 */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    )
  }

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
              title="演练总数"
              value={drills.length}
              prefix={<RocketOutlined style={{ color: '#667eea' }} />}
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
              title="正在执行"
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
              title="场景库"
              value={scenarios.length}
              prefix={<ThunderboltOutlined style={{ color: '#8c8c8c' }} />}
              valueStyle={{ color: '#8c8c8c', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 演练管理卡片 */}
      <Card 
        bordered={false}
        style={{ borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
        title={<span><RocketOutlined style={{ color: '#667eea', marginRight: 8 }} />演练管理</span>}
        extra={
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
            新建演练
          </Button>
        }
      >
        <Alert
          message="演练说明"
          description="演练支持组合多个故障场景进行批量测试。可以选择顺序执行或并行执行。每个场景包含：前置准备 → 故障注入 → 清理环境 三个阶段。"
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: '8px' }}
        />
        <Table
          columns={columns}
          dataSource={drills}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 创建演练弹窗 */}
      <Modal
        title={<span><PlusOutlined style={{ color: '#667eea' }} /> 新建演练</span>}
        open={createModalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateModalVisible(false)}
        width={700}
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="演练名称"
            rules={[{ required: true, message: '请输入演练名称' }]}
          >
            <Input placeholder="例如: 综合压力测试演练" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="演练描述" />
          </Form.Item>
          <Form.Item
            name="execution_mode"
            label="执行模式"
            rules={[{ required: true, message: '请选择执行模式' }]}
            initialValue="sequential"
          >
            <Select>
              <Select.Option value="sequential">
                <Tag color="blue" style={{ borderRadius: '6px' }}>顺序执行</Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>（推荐，按步骤逐一执行）</Text>
              </Select.Option>
              <Select.Option value="parallel">
                <Tag color="purple" style={{ borderRadius: '6px' }}>并行执行</Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>（所有场景同时执行）</Text>
              </Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="db_config_id"
            label="目标数据库"
            rules={[{ required: true, message: '请选择目标数据库' }]}
          >
            <Select
              placeholder="选择要注入故障的数据库"
              options={dbConfigs.map((config) => ({
                value: config.id,
                label: `${config.name} (${config.host}:${config.port}/${config.database})`,
              }))}
            />
          </Form.Item>
          <Divider style={{ margin: '16px 0' }}>
            <OrderedListOutlined style={{ color: '#667eea', marginRight: 8 }} />
            选择故障场景（拖动调整顺序）
          </Divider>
          <Transfer
            dataSource={transferDataSource}
            titles={['可选场景', '已选场景']}
            targetKeys={selectedSteps}
            onChange={(newTargetKeys) => setSelectedSteps(newTargetKeys)}
            render={(item) => item.title}
            listStyle={{ width: 280, height: 300 }}
            showSearch
          />
          {selectedSteps.length > 0 && (
            <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
              <Text type="secondary">执行顺序：</Text>
              <List
                size="small"
                dataSource={selectedSteps.map((id) => scenarios.find((s) => s.id === id))}
                renderItem={(item, index) => (
                  <List.Item style={{ padding: '8px 12px' }}>
                    <Tag color="blue" style={{ borderRadius: '6px' }}>{index + 1}</Tag>
                    <Text>{item?.name}</Text>
                  </List.Item>
                )}
              />
            </div>
          )}
        </Form>
      </Modal>

      {/* 演练详情弹窗 */}
      <Modal
        title={<span><EyeOutlined style={{ color: '#667eea' }} /> 演练详情</span>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={<Button onClick={() => setDetailModalVisible(false)} style={{ borderRadius: '8px' }}>关闭</Button>}
        width={800}
      >
        {selectedDrill && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ borderRadius: '8px' }}>
              <Descriptions.Item label="演练名称">
                <Text strong>{selectedDrill.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="执行模式">
                <Tag color={selectedDrill.execution_mode === 'sequential' ? 'blue' : 'purple'} style={{ borderRadius: '6px' }}>
                  {selectedDrill.execution_mode === 'sequential' ? '顺序执行' : '并行执行'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标数据库">
                <Text>{selectedDrill.db_config_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {getStatusTag(selectedDrill.status)}
              </Descriptions.Item>
              <Descriptions.Item label="总进度">
                <Progress 
                  percent={selectedDrill.progress_percent || 0} 
                  size="small"
                  strokeColor={{ '0%': '#667eea', '100%': '#764ba2' }}
                />
              </Descriptions.Item>
              <Descriptions.Item label="当前阶段">
                {['running', 'preparing', 'cleaning'].includes(selectedDrill.status) && selectedDrill.current_phase
                  ? getPhaseTag(selectedDrill.current_phase)
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                <Text type="secondary">
                  {selectedDrill.started_at ? new Date(selectedDrill.started_at).toLocaleString() : '-'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                <Text type="secondary">
                  {selectedDrill.ended_at ? new Date(selectedDrill.ended_at).toLocaleString() : '-'}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '24px 0' }}>
              <OrderedListOutlined style={{ color: '#667eea', marginRight: 8 }} />
              步骤进度
            </Divider>
            <div style={{ padding: '16px', background: '#fafafa', borderRadius: '8px' }}>
              {selectedDrill.steps && selectedDrill.steps.length > 0 ? (
                selectedDrill.steps.map((step) => renderStepProgress(step))
              ) : (
                <Text type="secondary">暂无步骤信息</Text>
              )}
            </div>

            <Divider style={{ margin: '24px 0' }}>执行日志</Divider>
            <pre style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: '16px',
              borderRadius: '8px',
              maxHeight: '300px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}>
              {selectedDrill.log || '暂无日志记录'}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DrillManagement