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
  Tag,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Statistic,
  Upload,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import { databaseConfigApi, dbConfigIOApi } from '../api'

const DB_TYPE_COLORS = {
  postgresql: { bg: '#e6f7ff', text: '#1890ff', border: '#91d5ff' },
  opengauss: { bg: '#f6ffed', text: '#52c41a', border: '#b7eb8f' },
  gaussdb: { bg: '#fff7e6', text: '#fa8c16', border: '#ffd591' },
}

const CONNECTION_METHOD_COLORS = {
  asyncpg: 'processing',
  psycopg2: 'success',
  gsql: 'purple',
  jdbc: 'warning',
}

const DEPLOYMENT_MODE_COLORS = {
  centralized: { bg: '#e6f7ff', text: '#1890ff', label: '集中式' },
  distributed: { bg: '#fff7e6', text: '#fa8c16', label: '分布式' },
}

function DatabaseConfig() {
  const location = useLocation()
  const [configs, setConfigs] = useState([])
  const [dbTypes, setDbTypes] = useState([])
  const [connectionMethods, setConnectionMethods] = useState([])
  const [deploymentModes, setDeploymentModes] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [selectedDbType, setSelectedDbType] = useState('postgresql')

  useEffect(() => {
    loadConfigs()
    loadDbTypes()
    loadConnectionMethods()
    loadDeploymentModes()
  }, [location.pathname])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const response = await databaseConfigApi.getAll()
      setConfigs(response.data)
    } catch (error) {
      message.error('加载数据库配置失败')
    }
    setLoading(false)
  }

  const loadDbTypes = async () => {
    try {
      const response = await databaseConfigApi.getTypes()
      setDbTypes(response.data)
    } catch (error) {
      setDbTypes([
        { value: 'postgresql', label: 'PostgreSQL', default_port: 5432 },
        { value: 'opengauss', label: 'openGauss', default_port: 5432 },
        { value: 'gaussdb', label: 'GaussDB', default_port: 8000 },
      ])
    }
  }

  const loadConnectionMethods = async () => {
    try {
      const response = await databaseConfigApi.getConnectionMethods()
      setConnectionMethods(response.data)
    } catch (error) {
      setConnectionMethods([
        { value: 'asyncpg', label: 'asyncpg', supported_db_types: ['postgresql'] },
        { value: 'psycopg2', label: 'psycopg2', supported_db_types: ['postgresql', 'opengauss', 'gaussdb'] },
        { value: 'gsql', label: 'gsql', supported_db_types: ['opengauss', 'gaussdb'] },
        { value: 'jdbc', label: 'JDBC', supported_db_types: ['opengauss', 'gaussdb'] },
      ])
    }
  }

  const loadDeploymentModes = async () => {
    try {
      const response = await databaseConfigApi.getDeploymentModes()
      setDeploymentModes(response.data)
    } catch (error) {
      setDeploymentModes([
        { value: 'centralized', label: '集中式' },
        { value: 'distributed', label: '分布式' },
      ])
    }
  }

  const handleCreate = () => {
    setEditingConfig(null)
    form.resetFields()
    form.setFieldsValue({
      db_type: 'postgresql',
      connection_method: 'asyncpg',
      deployment_mode: 'centralized',
      port: 5432,
      password: ''
    })
    setSelectedDbType('postgresql')
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingConfig(record)
    form.setFieldsValue({
      ...record,
      deployment_mode: record.deployment_mode || 'centralized',
    })
    setSelectedDbType(record.db_type)
    setModalVisible(true)
  }

  const handleDbTypeChange = (value) => {
    setSelectedDbType(value)
    const selectedType = dbTypes.find(t => t.value === value)
    if (selectedType) {
      form.setFieldsValue({ port: selectedType.default_port })
    }
    if (value === 'postgresql') {
      form.setFieldsValue({ connection_method: 'asyncpg' })
    } else if (value === 'opengauss' || value === 'gaussdb') {
      form.setFieldsValue({ connection_method: 'psycopg2' })
    }
  }

  const handleDelete = async (id) => {
    try {
      await databaseConfigApi.delete(id)
      message.success('删除成功')
      loadConfigs()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleTestConnection = async (id) => {
    try {
      const response = await databaseConfigApi.testConnection(id)
      if (response.data.success) {
        message.success(`连接成功: ${response.data.server_version}`)
      } else {
        message.error(response.data.message)
      }
    } catch (error) {
      message.error('测试连接失败: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data = {
        name: values.name || '',
        db_type: values.db_type || 'postgresql',
        connection_method: values.connection_method || 'psycopg2',
        deployment_mode: values.deployment_mode || 'centralized',
        host: values.host || '',
        port: values.port || 5432,
        database: values.database || '',
        username: values.username || '',
        password: values.password || '',
        jdbc_driver_path: values.jdbc_driver_path || null,
      }
      if (editingConfig) {
        await databaseConfigApi.update(editingConfig.id, data)
        message.success('更新成功')
      } else {
        await databaseConfigApi.create(data)
        message.success('创建成功')
      }
      setModalVisible(false)
      loadConfigs()
    } catch (error) {
      console.error('提交失败:', error)
      message.error('操作失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  const filteredConnectionMethods = connectionMethods.filter(method =>
    method.supported_db_types?.includes(selectedDbType)
  )

  // 导入配置
  const handleImport = async (file) => {
    try {
      const res = await dbConfigIOApi.import(file)
      message.success(res.data.message)
      loadConfigs()
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

  // 导出单个配置
  const handleExport = async (configId) => {
    try {
      const res = await dbConfigIOApi.export(configId)
      downloadFile(res.data, `db_config_${configId}.yaml`)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
    }
  }

  // 批量导出选中配置
  const handleExportSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的配置')
      return
    }
    try {
      const res = await dbConfigIOApi.exportBatch(selectedRowKeys)
      downloadFile(res.data, 'db_configs_export.zip')
      message.success(`已导出 ${selectedRowKeys.length} 个配置`)
    } catch (error) {
      message.error('导出失败')
    }
  }

  // 导出所有配置
  const handleExportAll = async () => {
    try {
      const res = await dbConfigIOApi.exportAll()
      downloadFile(res.data, 'all_db_configs.zip')
      message.success(`已导出所有配置`)
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

  // 统计数据
  const dbTypeStats = configs.reduce((acc, config) => {
    acc[config.db_type] = (acc[config.db_type] || 0) + 1
    return acc
  }, {})

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '类型',
      dataIndex: 'db_type',
      key: 'db_type',
      render: (type) => {
        const typeInfo = dbTypes.find(t => t.value === type) || { label: type }
        const colors = DB_TYPE_COLORS[type] || { bg: '#f5f5f5', text: '#666', border: '#d9d9d9' }
        return (
          <Tag 
            style={{
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              padding: '2px 8px',
            }}
          >
            {typeInfo.label}
          </Tag>
        )
      },
    },
    {
      title: '连接方式',
      dataIndex: 'connection_method',
      key: 'connection_method',
      render: (method) => {
        const methodInfo = connectionMethods.find(m => m.value === method) || { label: method }
        return <Tag color={CONNECTION_METHOD_COLORS[method] || 'default'}>{methodInfo.label}</Tag>
      },
    },
    {
      title: '部署形态',
      dataIndex: 'deployment_mode',
      key: 'deployment_mode',
      render: (mode) => {
        const modeInfo = DEPLOYMENT_MODE_COLORS[mode] || { bg: '#f5f5f5', text: '#666', label: mode || '集中式' }
        return (
          <Tag
            style={{
              background: modeInfo.bg,
              color: modeInfo.text,
              border: `1px solid ${modeInfo.text}`,
              borderRadius: '6px',
            }}
          >
            {modeInfo.label}
          </Tag>
        )
      },
    },
    {
      title: '主机', 
      dataIndex: 'host', 
      key: 'host',
      render: (host) => <span style={{ color: '#666' }}>{host}</span>,
    },
    { 
      title: '端口', 
      dataIndex: 'port', 
      key: 'port',
      render: (port) => <span style={{ color: '#999' }}>{port}</span>,
    },
    { 
      title: '数据库', 
      dataIndex: 'database', 
      key: 'database',
      render: (db) => <span style={{ color: '#666' }}>{db}</span>,
    },
    { 
      title: '用户名', 
      dataIndex: 'username', 
      key: 'username',
      render: (user) => <span style={{ color: '#999' }}>{user}</span>,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          icon={<LinkOutlined />}
          onClick={() => handleTestConnection(record.id)}
          style={{ color: '#1890ff' }}
        >
          测试连接
        </Button>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleExport(record.id)}
            title="导出"
          />
          <Button
            size="small"
            type="text"
            icon={<EditOutlined style={{ color: '#1890ff' }} />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定要删除这个配置吗?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
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
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Statistic
              title="数据库总数"
              value={configs.length}
              prefix={<DatabaseOutlined style={{ color: '#667eea' }} />}
              valueStyle={{ color: '#667eea', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Statistic
              title="PostgreSQL"
              value={dbTypeStats.postgresql || 0}
              prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Statistic
              title="openGauss"
              value={dbTypeStats.opengauss || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            bordered={false}
            style={{
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Statistic
              title="GaussDB"
              value={dbTypeStats.gaussdb || 0}
              prefix={<CheckCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 数据库配置卡片 */}
      <Card
        bordered={false}
        style={{
          borderRadius: '12px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        }}
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
                fontWeight: 500,
              }}
            >
              新建配置
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{ 
            pageSize: 10,
            showSizeChanger: false,
            style: { marginTop: 16 },
          }}
          style={{
            borderRadius: '8px',
          }}
          rowClassName={(record, index) => 
            index % 2 === 0 ? 'even-row' : 'odd-row'
          }
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={editingConfig ? '编辑数据库配置' : '新建数据库配置'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
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
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如: 生产环境数据库" />
          </Form.Item>
          <Form.Item
            name="db_type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select onChange={handleDbTypeChange}>
              {dbTypes.map(type => (
                <Select.Option key={type.value} value={type.value}>
                  {type.label} (默认端口: {type.default_port})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="connection_method"
            label={
              <span>
                连接方式
                <Tooltip title="asyncpg适用于PostgreSQL；psycopg2兼容性好；gsql为命令行工具；JDBC需配置驱动">
                  <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                </Tooltip>
              </span>
            }
            rules={[{ required: true, message: '请选择连接方式' }]}
          >
            <Select>
              {filteredConnectionMethods.map(method => (
                <Select.Option key={method.value} value={method.value}>
                  {method.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="deployment_mode"
            label={
              <span>
                部署形态
                <Tooltip title="集中式: 单节点部署；分布式: 多节点部署。执行场景时会根据形态选择对应脚本">
                  <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                </Tooltip>
              </span>
            }
            rules={[{ required: true, message: '请选择部署形态' }]}
          >
            <Select>
              {deploymentModes.map(mode => (
                <Select.Option key={mode.value} value={mode.value}>
                  {mode.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="host"
            label="主机地址"
            rules={[{ required: true, message: '请输入主机地址' }]}
          >
            <Input placeholder="例如: localhost 或 192.168.1.100" />
          </Form.Item>
          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="database"
            label="数据库名"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input placeholder="例如: postgres" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="例如: postgres 或 gaussdb" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
          >
            <Input.Password placeholder="数据库密码（可为空）" />
          </Form.Item>
          <Form.Item
            name="jdbc_driver_path"
            label={
              <span>
                JDBC驱动路径
                <Tooltip title="仅JDBC连接方式需要">
                  <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                </Tooltip>
              </span>
            }
          >
            <Input 
              placeholder="例如: drivers/gaussdbjdbc.jar" 
              disabled={form.getFieldValue('connection_method') !== 'jdbc'} 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入弹窗 */}
      <Modal
        title="导入数据库配置"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={500}
      >
        <Upload.Dragger
          accept=".yaml,.yml"
          beforeUpload={handleImport}
          multiple
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: '48px', color: '#667eea' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽 YAML 文件到此区域导入</p>
          <p className="ant-upload-hint">支持单个或批量导入，同名配置将自动更新</p>
        </Upload.Dragger>
      </Modal>

      {/* 表格行样式 */}
      <style>{`
        .even-row {
          background: #fafafa;
        }
        .odd-row {
          background: #fff;
        }
        .ant-table-row:hover {
          background: #f5f5f5 !important;
        }
      `}</style>
    </div>
  )
}

export default DatabaseConfig