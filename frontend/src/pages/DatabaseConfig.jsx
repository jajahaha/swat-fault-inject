import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
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
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { databaseConfigApi } from '../api'

const DB_TYPE_COLORS = {
  postgresql: 'blue',
  opengauss: 'green',
  gaussdb: 'orange',
}

const CONNECTION_METHOD_COLORS = {
  asyncpg: 'blue',
  psycopg2: 'green',
  gsql: 'purple',
  jdbc: 'orange',
}

function DatabaseConfig() {
  const location = useLocation()
  const [configs, setConfigs] = useState([])
  const [dbTypes, setDbTypes] = useState([])
  const [connectionMethods, setConnectionMethods] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState(null)
  const [form] = Form.useForm()
  const [selectedDbType, setSelectedDbType] = useState('postgresql')

  // Load data when route changes to this page
  useEffect(() => {
    loadConfigs()
    loadDbTypes()
    loadConnectionMethods()
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
        { value: 'asyncpg', label: 'asyncpg (Python异步驱动)', supported_db_types: ['postgresql'] },
        { value: 'psycopg2', label: 'psycopg2 (Python同步驱动)', supported_db_types: ['postgresql', 'opengauss', 'gaussdb'] },
        { value: 'gsql', label: 'gsql (命令行工具)', supported_db_types: ['opengauss', 'gaussdb'] },
        { value: 'jdbc', label: 'JDBC (Java驱动)', supported_db_types: ['opengauss', 'gaussdb'] },
      ])
    }
  }

  const handleCreate = () => {
    setEditingConfig(null)
    form.resetFields()
    form.setFieldsValue({
      db_type: 'postgresql',
      connection_method: 'asyncpg',
      port: 5432,
      password: ''
    })
    setSelectedDbType('postgresql')
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingConfig(record)
    form.setFieldsValue(record)
    setSelectedDbType(record.db_type)
    setModalVisible(true)
  }

  const handleDbTypeChange = (value) => {
    setSelectedDbType(value)
    const selectedType = dbTypes.find(t => t.value === value)
    if (selectedType) {
      form.setFieldsValue({ port: selectedType.default_port })
    }
    // Auto-select appropriate connection method
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

  // Filter connection methods based on selected db type
  const filteredConnectionMethods = connectionMethods.filter(method =>
    method.supported_db_types?.includes(selectedDbType)
  )

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'db_type',
      key: 'db_type',
      render: (type) => {
        const typeInfo = dbTypes.find(t => t.value === type) || { label: type }
        return <Tag color={DB_TYPE_COLORS[type] || 'default'}>{typeInfo.label}</Tag>
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
    { title: '主机', dataIndex: 'host', key: 'host' },
    { title: '端口', dataIndex: 'port', key: 'port' },
    { title: '数据库', dataIndex: 'database', key: 'database' },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => (
        <Button
          size="small"
          icon={<LinkOutlined />}
          onClick={() => handleTestConnection(record.id)}
        >
          测试连接
        </Button>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个配置吗?"
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建数据库配置
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={configs}
        rowKey="id"
        loading={loading}
      />
      <Modal
        title={editingConfig ? '编辑数据库配置' : '新建数据库配置'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
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
                <Tooltip title="选择数据库连接方式：asyncpg适用于PostgreSQL；psycopg2兼容性更好；gsql为命令行工具；JDBC需要配置驱动路径">
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
                  {method.os_user && <span style={{ color: '#999', marginLeft: 8 }}>(OS用户: {method.os_user})</span>}
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
            <InputNumber min={1} max={65535} />
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
                <Tooltip title="仅JDBC连接方式需要，指定JDBC驱动jar文件路径，如: drivers/gaussdbjdbc.jar">
                  <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                </Tooltip>
              </span>
            }
            rules={[{
              required: form.getFieldValue('connection_method') === 'jdbc',
              message: 'JDBC连接方式必须配置驱动路径'
            }]}
          >
            <Input placeholder="例如: drivers/gaussdbjdbc.jar 或 /path/to/driver.jar" disabled={form.getFieldValue('connection_method') !== 'jdbc'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DatabaseConfig