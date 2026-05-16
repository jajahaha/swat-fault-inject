import React from 'react'
import { Layout as AntLayout, Menu, Typography } from 'antd'
import { DatabaseOutlined, ThunderboltOutlined, RocketOutlined, ApiOutlined, FireOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Content, Sider } = AntLayout
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
    <AntLayout style={{ minHeight: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sider 
        width={220} 
        style={{
          background: 'linear-gradient(180deg, #1e3a5f 0%, #0d2137 50%, #0a1929 100%)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.25)',
          flexShrink: 0,
        }}
      >
        {/* Banner 区域 */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(6, 182, 212, 0.35)',
          }}>
            <FireOutlined style={{ fontSize: '24px', color: '#fff' }} />
          </div>
          <div>
            <Text style={{ fontSize: '18px', fontWeight: 700, color: '#fff', letterSpacing: '0.5px', display: 'block' }}>
              SWAT
            </Text>
            <Text style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.65)', letterSpacing: '0.3px' }}>
              Fault Injection · v1.7.8
            </Text>
          </div>
        </div>

        {/* 导航分组标题 */}
        <div style={{ 
          padding: '20px 24px 12px',
        }}>
          <Text style={{ 
            fontSize: '11px', 
            fontWeight: 600, 
            color: 'rgba(255, 255, 255, 0.35)',
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
          background: 'linear-gradient(135deg, #f8fafc 0%, #f0f4f8 50%, #e8f0f7 100%)',
          minHeight: '100vh',
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
        }}
      >
        {children}
      </Content>
    </AntLayout>
  )
}

export default Layout