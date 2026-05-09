import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('App组件', () => {
  it('应该渲染应用布局', () => {
    renderWithRouter(<App />)

    // 检查是否有侧边栏菜单项
    expect(screen.getByText('数据库配置')).toBeInTheDocument()
    expect(screen.getByText('故障场景')).toBeInTheDocument()
  })

  it('应该显示平台标题', () => {
    renderWithRouter(<App />)

    expect(screen.getByText('SWAT Fault Inject Platform')).toBeInTheDocument()
  })

  it('应该显示版本号', () => {
    renderWithRouter(<App />)

    // 版本号应该在侧边栏底部显示
    expect(screen.getByText(/v1\.2\.0/)).toBeInTheDocument()
  })
})