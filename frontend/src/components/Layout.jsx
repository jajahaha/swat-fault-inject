import React from 'react'
import { Layout as AntLayout, Menu, Typography } from 'antd'
import { DatabaseOutlined, ThunderboltOutlined, RocketOutlined, ApiOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Header, Content, Sider } = AntLayout
const { Text } = Typography

function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

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

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '0 24px',
          height: '64px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThunderboltOutlined style={{ fontSize: '28px', color: '#fff' }} />
          <Text style={{ color: '#fff', fontSize: '20px', fontWeight: 600 }}>
            SWAT Fault Inject
          </Text>
        </div>
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.2)',
          padding: '4px 12px',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 500,
        }}>
          v1.7.2
        </div>
      </Header>
      <AntLayout>
        <Sider 
          width={220} 
          style={{
            background: '#fff',
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div style={{ 
            padding: '16px 24px',
            borderBottom: '1px solid #f0f0f0',
          }}>
            <Text type="secondary" style={{ fontSize: '12px', fontWeight: 500 }}>
              功能模块
            </Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems.map(item => ({
              ...item,
              style: {
                margin: '4px 8px',
                borderRadius: '8px',
                height: '48px',
                lineHeight: '48px',
                transition: 'all 0.3s ease',
              },
            }))}
            onClick={({ key }) => navigate(key)}
            style={{
              height: '100%',
              borderRight: 0,
              padding: '8px 0',
              background: 'transparent',
            }}
          />
        </Sider>
        <Content
          style={{
            padding: '24px',
            background: 'linear-gradient(180deg, #f5f7fa 0%, #f0f2f5 100%)',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout