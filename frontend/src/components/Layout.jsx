import React from 'react'
import { Layout as AntLayout, Menu } from 'antd'
import { DatabaseOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Header, Content, Sider } = AntLayout

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
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#001529',
        }}
      >
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
          SWAT Fault Inject Platform
        </div>
      </Header>
      <AntLayout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
          <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
            v1.3.3
          </div>
        </Sider>
        <Content
          style={{
            padding: '24px',
            background: '#f5f5f5',
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