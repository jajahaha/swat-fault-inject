import React, { useState, useEffect } from 'react'
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
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons'
import { databaseConfigApi } from '../api'

const DB_TYPE_COLORS = {
  postgresql: 'blue',
  opengauss: 'green',
  gaussdb: 'orange',
}

function DatabaseConfig() {
  const [configs, setConfigs] = useState([])
  const [dbTypes, setDbTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadConfigs()
    loadDbTypes()
  }, [])

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
      // Use default types if API fails
      setDbTypes([
        { value: 'postgresql', label: 'PostgreSQL', default_port: 5432 },
        { value: 'opengauss', label: 'openGauss', default_port: 5432 },
        { value: 'gaussdb', label: 'GaussDB', default_port: 8000 },
      ])
    }
  }

  const handleCreate = () => {
    setEditingConfig(null)
    form.resetFields()
    form.setFieldsValue({ db_type: 'postgresql', port: 5432 })
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingConfig(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDbTypeChange = (value) => {
    const selectedType = dbTypes.find(t => t.value === value)
    if (selectedType) {
      form.setFieldsValue({ port: selectedType.default_port })
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
      message.error('测试连接失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingConfig) {
        await databaseConfigApi.update(editingConfig.id, values)
        message.success('更新成功')
      } else {
        await databaseConfigApi.create(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      loadConfigs()
    } catch (error) {
      message.error('操作失败')
    }
  }

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
            <Input placeholder="例如: postgres" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
          >
            <Input.Password placeholder="数据库密码（可为空）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DatabaseConfig