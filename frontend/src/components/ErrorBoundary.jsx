import React from 'react'
import { Result, Button } from 'antd'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f5f5f5'
        }}>
          <Result
            status="error"
            title="页面出现错误"
            subTitle={this.state.error?.message || '未知错误'}
            extra={[
              <Button type="primary" key="console" onClick={this.handleReset}>
                返回首页
              </Button>,
              <Button key="reload" onClick={() => window.location.reload()}>
                刷新页面
              </Button>,
            ]}
          />
          <details style={{
            whiteSpace: 'pre-wrap',
            position: 'fixed',
            bottom: 20,
            left: 20,
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            maxWidth: '80%',
            maxHeight: '200px',
            overflow: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <summary style={{ cursor: 'pointer', color: '#1890ff' }}>查看详细错误信息</summary>
            <pre style={{ fontSize: '12px', marginTop: '8px' }}>
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary