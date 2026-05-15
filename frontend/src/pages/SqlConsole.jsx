import React, { useState, useEffect } from 'react'
import {
  Card,
  Select,
  Button,
  Input,
  Table,
  Space,
  message,
  Typography,
  Row,
  Col,
  Divider,
  Alert,
  Statistic,
  Spin,
} from 'antd'
import {
  PlayCircleOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { databaseConfigApi, sqlConsoleApi } from '../api'

const { TextArea } = Input
const { Text, Title } = Typography

function SqlConsole() {
  const [dbConfigs, setDbConfigs] = useState([])
  const [selectedDb, setSelectedDb] = useState(null)
  const [sql, setSql] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    loadDbConfigs()
  }, [])

  const loadDbConfigs = async () => {
    try {
      const response = await databaseConfigApi.getAll()
      setDbConfigs(response.data)
      if (response.data.length > 0) {
        setSelectedDb(response.data[0].id)
      }
    } catch (error) {
      message.error('加载数据库配置失败')
    }
  }

  const handleExecute = async () => {
    if (!selectedDb) {
      message.warning('请先选择数据库')
      return
    }
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await sqlConsoleApi.execute(selectedDb, sql)
      setResult(response.data)

      // 添加到历史记录
      const selectedConfig = dbConfigs.find(c => c.id === selectedDb)
      setHistory(prev => [
        {
          sql: sql.substring(0, 100),
          db: selectedConfig?.name,
          success: response.data.success,
          time: response.data.execution_time,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),  // 保留最近10条
      ])

      if (response.data.success) {
        message.success(`查询成功，返回 ${response.data.row_count} 行`)
      } else {
        message.error(response.data.message)
      }
    } catch (error) {
      message.error('执行失败: ' + (error.response?.data?.detail || error.message))
    }
    setLoading(false)
  }

  // 快捷 SQL 示例
  const quickSqlExamples = [
    { label: 'SELECT version()', sql: 'SELECT version()' },
    { label: 'SELECT 1', sql: 'SELECT 1' },
    { label: '查看表', sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 20" },
    { label: '当前时间', sql: 'SELECT NOW()' },
  ]

  const handleQuickSql = (sqlText) => {
    setSql(sqlText)
  }

  // 结果表格列配置
  const resultColumns = result?.columns?.map(col => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
    width: 150,
  })) || []

  // 结果表格数据
  const resultData = result?.rows?.map((row, idx) => {
    const rowData = { key: idx }
    result?.columns?.forEach((col, i) => {
      rowData[col] = row[i]
    })
    return rowData
  }) || []

  const selectedConfig = dbConfigs.find(c => c.id === selectedDb)

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Statistic
              title="数据库配置"
              value={dbConfigs.length}
              prefix={<DatabaseOutlined style={{ color: '#667eea' }} />}
              valueStyle={{ color: '#667eea' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Statistic
              title="当前连接"
              value={selectedConfig?.name || '未选择'}
              valueStyle={{ fontSize: '16px', color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Statistic
              title="执行历史"
              value={history.length}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        bordered={false}
        style={{ borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
        title={
          <span>
            <PlayCircleOutlined style={{ color: '#667eea', marginRight: 8 }} />
            SQL 控制台
          </span>
        }
      >
        {/* 数据库选择 */}
        <Alert
          message="选择数据库连接环境，在线执行 SQL 查询"
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: '8px' }}
        />

        <Row gutter={16}>
          <Col span={8}>
            <Text strong>数据库连接：</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={selectedDb}
              onChange={setSelectedDb}
              placeholder="选择数据库"
            >
              {dbConfigs.map(config => (
                <Select.Option key={config.id} value={config.id}>
                  {config.name} ({config.db_type})
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={16}>
            <Text strong>快捷示例：</Text>
            <Space style={{ marginTop: 8 }} wrap>
              {quickSqlExamples.map(example => (
                <Button
                  key={example.label}
                  size="small"
                  onClick={() => handleQuickSql(example.sql)}
                  style={{ borderRadius: '6px' }}
                >
                  {example.label}
                </Button>
              ))}
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        {/* SQL 编辑器 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong>SQL 语句：</Text>
          <TextArea
            rows={6}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="输入 SQL 查询语句，例如：SELECT * FROM table_name LIMIT 10"
            style={{
              marginTop: 8,
              borderRadius: '8px',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* 执行按钮 */}
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={handleExecute}
          loading={loading}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            height: '40px',
            fontWeight: 500,
          }}
        >
          执行查询
        </Button>

        <Divider style={{ margin: '24px 0' }} />

        {/* 结果展示 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <Text style={{ marginTop: 16, display: 'block', color: '#666' }}>
              正在执行查询...
            </Text>
          </div>
        )}

        {result && !loading && (
          <div>
            {/* 执行统计 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Text>
                  {result.success ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#f5222d', marginRight: 8 }} />
                  )}
                  {result.success ? '执行成功' : '执行失败'}
                </Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">返回行数: {result.row_count || 0}</Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">执行时间: {result.execution_time?.toFixed(3)}s</Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">列数: {result.columns?.length || 0}</Text>
              </Col>
            </Row>

            {result.success && result.rows && result.rows.length > 0 ? (
              <Table
                columns={resultColumns}
                dataSource={resultData}
                pagination={{ pageSize: 20, showSizeChanger: true }}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
                style={{ borderRadius: '8px' }}
              />
            ) : result.success ? (
              <Alert message="查询成功，无返回结果" type="success" showIcon style={{ borderRadius: '8px' }} />
            ) : (
              <Alert message={result.message} type="error" showIcon style={{ borderRadius: '8px' }} />
            )}
          </div>
        )}

        {/* 执行历史 */}
        {history.length > 0 && (
          <Divider style={{ margin: '24px 0' }}>执行历史</Divider>
        )}
        {history.length > 0 && (
          <Table
            columns={[
              { title: '时间', dataIndex: 'timestamp', width: 100 },
              { title: '数据库', dataIndex: 'db', width: 150 },
              { title: 'SQL', dataIndex: 'sql', ellipsis: true },
              {
                title: '状态',
                dataIndex: 'success',
                width: 80,
                render: (success) =>
                  success ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#f5222d' }} />
                  ),
              },
              { title: '耗时', dataIndex: 'time', width: 80, render: (t) => t?.toFixed(3) + 's' },
            ]}
            dataSource={history}
            pagination={false}
            size="small"
            rowKey="timestamp"
            style={{ borderRadius: '8px' }}
          />
        )}
      </Card>
    </div>
  )
}

export default SqlConsole