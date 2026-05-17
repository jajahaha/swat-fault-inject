import React, { useState, useEffect } from 'react'
import { Layout as AntLayout, Menu, Typography, Tooltip } from 'antd'
import { DatabaseOutlined, ThunderboltOutlined, RocketOutlined, ApiOutlined, FireOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Content, Sider } = AntLayout
const { Text } = Typography

// 蓝色渐变主题色
const COLORS = {
  deepBlue: '#1a365d',
  midBlue: '#2c5282',
  lightBlue: '#4299e1',
  deepBlueLight: '#2b6cb0',
  midBlueLight: '#3182ce',
  lightBlueLight: '#63b3ed',
}

function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [serviceStatus, setServiceStatus] = useState('checking') // 'checking' | 'online' | 'offline'

  // 检查后端服务状态
  useEffect(() => {
    const checkServiceStatus = async () => {
      try {
        const response = await fetch('http://localhost:9010/', {
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3秒超时
        })
        if (response.ok) {
          setServiceStatus('online')
        } else {
          setServiceStatus('offline')
        }
      } catch (error) {
        setServiceStatus('offline')
      }
    }

    // 立即检查一次
    checkServiceStatus()

    // 每5秒检查一次
    const interval = setInterval(checkServiceStatus, 5000)

    return () => clearInterval(interval)
  }, [])

  const menuItems = [
    {
      key: '/database-config',
      icon: <DatabaseOutlined />,
      label: '数据库配置',
    },
    {
      key: '/fault-scenarios',
      icon: <ThunderboltOutlined />,
      label: '故障场景',
    },
    {
      key: '/drill',
      icon: <RocketOutlined />,
      label: '演练管理',
    },
    {
      key: '/sql-console',
      icon: <ApiOutlined />,
      label: '连接环境',
    },
  ]

  // 状态指示器
  const StatusIndicator = () => {
    const statusConfig = {
      checking: { color: '#fbbf24', text: '检测中...', dotColor: '#fbbf24' },
      online: { color: '#34d399', text: '服务正常运行', dotColor: '#34d399' },
      offline: { color: '#f87171', text: '服务已断开', dotColor: '#f87171' },
    }
    const config = statusConfig[serviceStatus]

    return (
      <div style={{
        padding: '16px 20px 24px',
      }}>
        <Text style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.5)',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          textAlign: 'center',
          marginBottom: '8px',
          display: 'block',
          width: '100%',
        }}>
          后端服务状态
        </Text>
        <Tooltip title={`自动检测: 每5秒检查 (3秒超时)`}>
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: config.dotColor,
              boxShadow: `0 0 8px ${config.dotColor}`,
            }} />
            <Text style={{
              fontSize: '13px',
              color: config.color,
              fontWeight: 500,
            }}>
              {config.text}
            </Text>
          </div>
        </Tooltip>
      </div>
    )
  }

  return (
    <AntLayout style={{ minHeight: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sider
        width={240}
        style={{
          background: `linear-gradient(180deg, ${COLORS.deepBlue} 0%, ${COLORS.midBlue} 50%, ${COLORS.lightBlue} 100%)`,
          boxShadow: '4px 0 24px rgba(26, 54, 93, 0.35)',
          flexShrink: 0,
        }}
      >
        {/* Logo 区域 (高度80px) */}
        <div style={{
          height: '80px',
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${COLORS.lightBlueLight} 0%, ${COLORS.midBlueLight} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 12px rgba(99, 179, 237, 0.4)`,
          }}>
            <FireOutlined style={{ fontSize: '20px', color: '#fff' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <Text style={{ fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>
                SWAT
              </Text>
              <Text style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.6)' }}>
                v1.7.8
              </Text>
            </div>
            <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.3px' }}>
              Fault Injection
            </Text>
          </div>
        </div>

        {/* 服务状态区域 */}
        <StatusIndicator />

        {/* 导航分组标题 */}
        <div style={{
          padding: '16px 20px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <Text style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
          }}>
            功能模块
          </Text>
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems.map(item => ({
            ...item,
            style: {
              margin: '4px 12px',
              borderRadius: '10px',
              height: '46px',
              lineHeight: '46px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            },
          }))}
          onClick={({ key }) => navigate(key)}
          style={{
            height: '100%',
            borderRight: 0,
            padding: '8px 0',
            background: 'transparent',
          }}
          theme="dark"
        />
      </Sider>
      <Content
        style={{
          padding: '28px',
          background: `linear-gradient(135deg, ${COLORS.lightBlueLight}20 0%, ${COLORS.midBlueLight}15 50%, ${COLORS.deepBlueLight}10 100%)`,
          minHeight: '100vh',
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
        }}
      >
        {/* 服务离线时显示警告提示 */}
        {serviceStatus === 'offline' && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <ExclamationCircleOutlined style={{ color: '#ef4444', fontSize: '16px' }} />
            <Text style={{ color: '#dc2626', fontWeight: 500 }}>
              后端服务已断开，请检查服务状态或重启服务
            </Text>
          </div>
        )}
        {children}
      </Content>
    </AntLayout>
  )
}

export default Layout