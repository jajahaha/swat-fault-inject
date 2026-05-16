import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
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
  Divider,
  Alert,
  List,
  Transfer,
  Typography,
  Row,
  Col,
  Statistic,
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

// 一级分类配置
const CATEGORY1_CONFIG = {
  slow: { label: '慢', color: '#722ed1', bg: '#f9f0ff' },
  full: { label: '满', color: '#fa8c16', bg: '#fff7e6' },
  crash: { label: '宕', color: '#f5222d', bg: '#fff1f0' },
  error: { label: '错', color: '#1890ff', bg: '#e6f7ff' },
}

// 二级分类配置
const CATEGORY2_CONFIG = {
  slow: {
    cpu: { label: 'CPU慢' },
    io: { label: 'IO慢' },
    lock: { label: '锁等待' },
    network: { label: '网络慢' },
  },
  full: {
    cpu: { label: 'CPU满' },
    memory: { label: '内存满' },
    disk: { label: '磁盘满' },
    connection: { label: '连接满' },
  },
  crash: {
    process: { label: '进程宕' },
    service: { label: '服务宕' },
    network: { label: '网络宕' },
  },
  error: {
    syntax: { label: '语法错' },
    logic: { label: '逻辑错' },
    permission: { label: '权限错' },
    data: { label: '数据错' },
  },
}

// 三级分类配置
const CATEGORY3_CONFIG = {
  slow: {
    cpu: { query: { label: '慢查询' }, calculation: { label: '计算密集' }, function: { label: '函数调用' } },
    io: { read: { label: '读IO慢' }, write: { label: '写IO慢' }, random: { label: '随机IO' } },
    lock: { table: { label: '表锁' }, row: { label: '行锁' }, deadlock: { label: '死锁' } },
    network: { latency: { label: '网络延迟' }, bandwidth: { label: '带宽限制' }, packet: { label: '丢包' } },
  },
  full: {
    cpu: { process: { label: '进程CPU满' }, multi_process: { label: '多进程CPU满' }, query: { label: '查询CPU满' } },
    memory: { cache: { label: '缓存内存满' }, buffer: { label: '缓冲区满' }, leak: { label: '内存泄漏' } },
    disk: { data: { label: '数据盘满' }, log: { label: '日志盘满' }, temp: { label: '临时盘满' } },
    connection: { max_conn: { label: '最大连接' }, idle: { label: '空闲连接' }, pool: { label: '连接池满' } },
  },
  crash: {
    process: { oom: { label: 'OOM崩溃' }, signal: { label: '信号崩溃' }, assert: { label: '断言失败' } },
    service: { kill: { label: '服务杀掉' }, restart: { label: '服务重启' }, hang: { label: '服务挂起' } },
    network: { disconnect: { label: '连接断开' }, timeout: { label: '连接超时' }, firewall: { label: '防火墙阻断' } },
  },
  error: {
    syntax: { sql: { label: 'SQL语法错' }, type: { label: '类型错误' }, format: { label: '格式错误' } },
    logic: { constraint: { label: '约束违反' }, duplicate: { label: '重复数据' }, null: { label: '空值错误' } },
    permission: { table: { label: '表权限' }, column: { label: '列权限' }, operation: { label: '操作权限' } },
    data: { corrupt: { label: '数据损坏' }, mismatch: { label: '数据不匹配' }, invalid: { label: '无效数据' } },
  },
}

// 场景类型配置
const SCENARIO_TYPE_CONFIG = {
  high_concurrency: { label: '高并发查询', color: '#1890ff' },
  slow_query: { label: '慢查询', color: '#722ed1' },
  connection_exhaustion: { label: '连接耗尽', color: '#fa8c16' },
  io_pressure: { label: 'IO压力', color: '#13c2c2' },
}

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
  const [searchParams] = useSearchParams()
  const highlightDrillId = searchParams.get('highlight') // 从URL获取要高亮的演练ID
  const [drills, setDrills] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [dbConfigs, setDbConfigs] = useState([])
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedDrill, setSelectedDrill] = useState(null)
  const [selectedSteps, setSelectedSteps] = useState([])
  const [highlightedDrillId, setHighlightedDrillId] = useState(null) // 当前高亮的演练ID
  const [form] = Form.useForm()

  // 统一轮询定时器
  const pollTimerRef = useRef(null)
  const isPollingRef = useRef(false)
  // 详情弹窗轮询定时器
  const detailPollTimerRef = useRef(null)
  // 日志容器ref，用于自动滚动
  const logContainerRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [location.pathname])

  // 统一轮询所有运行中的演练
  const startUnifiedPolling = useCallback(() => {
    if (isPollingRef.current) return
    isPollingRef.current = true

    const poll = async () => {
      const runningDrills = drills.filter(d => ['running', 'preparing', 'cleaning'].includes(d.status))
      if (runningDrills.length === 0) {
        isPollingRef.current = false
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
        }
        return
      }

      // 使用批量查询API，减少请求次数
      try {
        const drillIds = runningDrills.map(d => d.id)
        const response = await drillApi.getBatchStatus(drillIds)
        const updates = {}

        // 处理批量响应
        response.data.forEach(drillData => {
          if (drillData && !drillData.error) {
            updates[drillData.id] = drillData
          }
        })

        // 批量更新状态
        if (Object.keys(updates).length > 0) {
          setDrills(prev => prev.map(d => updates[d.id] ? { ...d, ...updates[d.id] } : d))
        }
      } catch (error) {
        // 请求失败时不中断轮询
      }
    }

    // 每3秒轮询一次
    pollTimerRef.current = setInterval(poll, 3000)
    poll() // 立即执行一次
  }, [drills])

  // 监听演练状态变化，自动启停轮询
  useEffect(() => {
    const runningCount = drills.filter(d => ['running', 'preparing', 'cleaning'].includes(d.status)).length
    if (runningCount > 0 && !isPollingRef.current) {
      startUnifiedPolling()
    }
    // 清理定时器
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [drills.filter(d => ['running', 'preparing', 'cleaning'].includes(d.status)).length, startUnifiedPolling])

  // 详情弹窗自动刷新轮询
  useEffect(() => {
    if (detailModalVisible && selectedDrill && ['running', 'preparing', 'cleaning'].includes(selectedDrill.status)) {
      // 每1秒刷新详情
      detailPollTimerRef.current = setInterval(async () => {
        try {
          const response = await drillApi.getStatus(selectedDrill.id)
          setSelectedDrill(response.data)
          // 同步更新列表中的演练状态
          setDrills(prev => prev.map(d => d.id === response.data.id ? response.data : d))
        } catch (error) {
          // 忽略错误，继续轮询
        }
      }, 1000)
    }

    // 清理定时器
    return () => {
      if (detailPollTimerRef.current) {
        clearInterval(detailPollTimerRef.current)
        detailPollTimerRef.current = null
      }
    }
  }, [detailModalVisible, selectedDrill?.id, selectedDrill?.status])

  // 日志自动滚动到底部
  useEffect(() => {
    if (detailModalVisible && logContainerRef.current && selectedDrill?.log) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [detailModalVisible, selectedDrill?.log])

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

      // 处理URL中的highlight参数：自动高亮并弹出详情
      if (highlightDrillId) {
        const targetDrill = drillsRes.data.find(d => d.id === parseInt(highlightDrillId))
        if (targetDrill) {
          setHighlightedDrillId(parseInt(highlightDrillId))
          // 自动弹出详情弹窗
          setTimeout(() => {
            handleViewDetail(targetDrill)
          }, 300)
          // 3秒后取消高亮
          setTimeout(() => {
            setHighlightedDrillId(null)
          }, 5000)
        }
      }
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
      // 重新加载列表，统一轮询会自动启动
      loadData()
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

  // 使用 useMemo 缓存统计计算
  const stats = useMemo(() => ({
    runningCount: drills.filter(d => ['running', 'preparing', 'cleaning'].includes(d.status)).length,
    completedCount: drills.filter(d => d.status === 'completed').length,
    totalCount: drills.length,
    scenarioCount: scenarios.length,
  }), [drills, scenarios])

  const transferDataSource = useMemo(() => scenarios.map((s) => ({
    key: s.id,
    title: s.name,
    description: s.description || s.type,
  })), [scenarios])

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
      render: (name, record) => (
        <Space>
          {record.id === highlightedDrillId && (
            <Tag color="processing" style={{ borderRadius: '6px' }}>
              <LoadingOutlined spin style={{ marginRight: 4 }} />
              当前执行
            </Tag>
          )}
          <Text strong>{name}</Text>
        </Space>
      ),
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

    // 获取完整场景信息
    const scenario = step.scenario || {}
    const category1Label = CATEGORY1_CONFIG[scenario.category1]?.label || '-'
    const category2Label = CATEGORY2_CONFIG[scenario.category1]?.[scenario.category2]?.label || '-'
    const category3Label = CATEGORY3_CONFIG[scenario.category1]?.[scenario.category2]?.[scenario.category3]?.label || '-'
    const scenarioTypeLabel = SCENARIO_TYPE_CONFIG[scenario.type]?.label || scenario.type || '-'

    // 根据阶段设置进度条颜色
    let strokeColor = { '0%': '#667eea', '100%': '#764ba2' }
    if (phase === 'preparing') {
      strokeColor = { '0%': '#1890ff', '100%': '#40a9ff' }
    } else if (phase === 'injecting') {
      strokeColor = { '0%': '#52c41a', '100%': '#73d13d' }
    } else if (phase === 'cleaning') {
      strokeColor = { '0%': '#fa8c16', '100%': '#ffc53d' }
    }

    // 三阶段配置
    const phases = [
      { key: 'preparing', label: '前置准备', color: '#1890ff', scripts: scenario.setup_scripts || [], timeout: scenario.setup_timeout || 60 },
      { key: 'injecting', label: '故障注入', color: '#52c41a', scripts: scenario.run_scripts || [], timeout: scenario.run_timeout || 120, useDefault: scenario.run_scripts?.length === 0 },
      { key: 'cleaning', label: '清理环境', color: '#fa8c16', scripts: scenario.cleanup_scripts || [], timeout: scenario.cleanup_timeout || 30 },
    ]

    return (
      <div key={step.id} style={{ marginBottom: 20, padding: '16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
        {/* 步骤标题和状态 */}
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: '14px' }}>
            步骤 {step.step_order}: {step.scenario_name}
          </Text>
          <Space>
            {getStatusTag(step.status)}
            {['running', 'preparing', 'cleaning'].includes(step.status) && phase && getPhaseTag(phase)}
          </Space>
        </div>

        {/* 场景信息 */}
        <div style={{ marginBottom: 12, padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #e8e8e8' }}>
          <Row gutter={8}>
            <Col span={6}>
              <Text type="secondary" style={{ fontSize: '12px' }}>故障类型：</Text>
              <Tag color="blue" style={{ marginLeft: 4 }}>{scenarioTypeLabel}</Tag>
            </Col>
            <Col span={6}>
              <Text type="secondary" style={{ fontSize: '12px' }}>分类：</Text>
              <Tag style={{ marginLeft: 4, background: CATEGORY1_CONFIG[scenario.category1]?.bg || '#f5f5f5', color: CATEGORY1_CONFIG[scenario.category1]?.color }}>
                {category1Label}/{category2Label}/{category3Label}
              </Tag>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: '12px' }}>描述：</Text>
              <Text style={{ fontSize: '12px', marginLeft: 4 }}>{scenario.description || '-'}</Text>
            </Col>
          </Row>
          {/* 默认注入参数 */}
          {scenario.run_scripts?.length === 0 && scenario.config && (
            <div style={{ marginTop: 8, fontSize: '12px', color: '#8c8c8c' }}>
              默认注入参数：并发={scenario.config.concurrency || 50}, 持续={scenario.config.duration_seconds || 60}s, 间隔={scenario.config.interval_ms || 100}ms
            </div>
          )}
        </div>

        {/* 进度条 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{
              height: '12px',
              background: '#e8e8e8',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${strokeColor['0%']}, ${strokeColor['100%']})`,
                borderRadius: '6px',
                transition: 'width 0.3s ease-out',
                boxShadow: step.status === 'running' ? '0 0 8px rgba(102, 126, 234, 0.4)' : 'none'
              }} />
            </div>
          </div>
          <div style={{
            minWidth: '50px',
            textAlign: 'right',
            fontSize: '15px',
            fontWeight: 600,
            color: progress >= 100 ? '#52c41a' : progress > 0 ? '#667eea' : '#8c8c8c'
          }}>
            {progress}%
          </div>
        </div>

        {/* 三阶段详情 */}
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: '12px', marginBottom: 8 }}>执行环节：</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {phases.map((p) => {
              const isActive = phase === p.key && ['running', 'preparing', 'cleaning'].includes(step.status)
              const isCompleted = step.status === 'completed' || (step.status === 'cleaning' && (p.key === 'preparing' || p.key === 'injecting')) || (step.status === 'running' && p.key === 'preparing')
              const scriptCount = p.useDefault ? 1 : p.scripts.length

              return (
                <div key={p.key} style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: isActive ? `${p.color}15` : '#fff',
                  border: `1px solid ${isActive ? p.color : '#e8e8e8'}`,
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isCompleted ? '#52c41a' : isActive ? p.color : '#d9d9d9',
                      animation: isActive ? 'pulse 1.5s infinite' : 'none'
                    }} />
                    <Text strong style={{ fontSize: '12px', color: isActive ? p.color : '#666' }}>
                      {p.label}
                    </Text>
                    {isActive && <LoadingOutlined style={{ fontSize: '12px', color: p.color }} />}
                  </div>
                  <Text type="secondary" style={{ fontSize: '11px', marginTop: 4 }}>
                    {p.useDefault ? '默认注入' : scriptCount > 0 ? `${scriptCount} 个脚本` : '无脚本'} / 超时 {p.timeout}s
                  </Text>
                </div>
              )
            })}
          </div>
        </div>

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
              value={stats.runningCount}
              prefix={stats.runningCount > 0 ? <LoadingOutlined spin style={{ color: '#1890ff' }} /> : <ClockCircleOutlined style={{ color: '#1890ff' }} />}
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
              value={stats.completedCount}
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
              value={stats.scenarioCount}
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
          rowClassName={(record) => record.id === highlightedDrillId ? 'highlighted-drill-row' : ''}
          style={{
            '--highlight-bg': '#e6f7ff',
          }}
        />
        {/* 高亮行样式 */}
        <style>{`
          .highlighted-drill-row {
            background-color: #e6f7ff !important;
            animation: highlight-pulse 2s ease-in-out;
          }
          .highlighted-drill-row:hover > td {
            background-color: #bae7ff !important;
          }
          @keyframes highlight-pulse {
            0%, 100% { background-color: #e6f7ff; }
            50% { background-color: #bae7ff; }
          }
        `}</style>
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
            {/* 演练基本信息卡片 - 放在最上面 */}
            <Card
              size="small"
              style={{ marginBottom: 16, borderRadius: '8px', background: '#fafafa' }}
              title={
                <Space>
                  <RocketOutlined style={{ color: '#667eea' }} />
                  <Text strong>{selectedDrill.name}</Text>
                  {getStatusTag(selectedDrill.status)}
                  {['running', 'preparing', 'cleaning'].includes(selectedDrill.status) && selectedDrill.current_phase && getPhaseTag(selectedDrill.current_phase)}
                </Space>
              }
            >
              <Row gutter={16}>
                <Col span={6}>
                  <Text type="secondary">执行模式：</Text>
                  <Tag color={selectedDrill.execution_mode === 'sequential' ? 'blue' : 'purple'} style={{ marginLeft: 4 }}>
                    {selectedDrill.execution_mode === 'sequential' ? '顺序执行' : '并行执行'}
                  </Tag>
                </Col>
                <Col span={6}>
                  <Text type="secondary">目标数据库：</Text>
                  <Text>{selectedDrill.db_config_name}</Text>
                </Col>
                <Col span={6}>
                  <Text type="secondary">总进度：</Text>
                  <Progress
                    percent={selectedDrill.progress_percent || 0}
                    size="small"
                    style={{ marginLeft: 8, width: 100 }}
                    strokeColor={{ '0%': '#667eea', '100%': '#764ba2' }}
                  />
                </Col>
                <Col span={6}>
                  <Text type="secondary">步骤：</Text>
                  <Text>{selectedDrill.current_step || 0}/{selectedDrill.total_steps}</Text>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <Text type="secondary">开始时间：</Text>
                  <Text>{selectedDrill.started_at ? new Date(selectedDrill.started_at).toLocaleString() : '-'}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">结束时间：</Text>
                  <Text>{selectedDrill.ended_at ? new Date(selectedDrill.ended_at).toLocaleString() : '-'}</Text>
                </Col>
              </Row>
            </Card>

            {/* 执行日志 - 放在中间，实时刷新 */}
            <Card
              size="small"
              style={{ marginBottom: 16, borderRadius: '8px' }}
              title={
                <Space>
                  <Text>执行日志</Text>
                  {['running', 'preparing', 'cleaning'].includes(selectedDrill.status) && (
                    <Tag color="processing" style={{ marginLeft: 8 }}>
                      <LoadingOutlined spin style={{ marginRight: 4 }} />
                      实时更新
                    </Tag>
                  )}
                </Space>
              }
            >
              <pre
                ref={logContainerRef}
                style={{
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: '12px',
                  borderRadius: '6px',
                  maxHeight: '300px',
                  minHeight: '100px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  margin: 0,
                }}
              >
                {selectedDrill.log || '暂无日志记录'}
              </pre>
            </Card>

            {/* 步骤进度 - 放在最后 */}
            <Card
              size="small"
              style={{ borderRadius: '8px' }}
              title={
                <Space>
                  <OrderedListOutlined style={{ color: '#667eea' }} />
                  <Text>步骤进度</Text>
                </Space>
              }
            >
              {selectedDrill.steps && selectedDrill.steps.length > 0 ? (
                selectedDrill.steps.map((step) => renderStepProgress(step))
              ) : (
                <Text type="secondary">暂无步骤信息</Text>
              )}
            </Card>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DrillManagement