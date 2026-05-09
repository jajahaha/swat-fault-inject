import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import FaultScenarios from '../pages/FaultScenarios'

// Mock the API module
vi.mock('../api', () => ({
  faultScenarioApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: '测试场景1', type: 'high_concurrency', config: { concurrency: 50, duration_seconds: 60 } },
        { id: 2, name: '测试场景2', type: 'slow_query', config: { concurrency: 10, duration_seconds: 30 } },
      ],
    }),
    create: vi.fn().mockResolvedValue({ data: { id: 3 } }),
    update: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({}),
  },
  injectionApi: {
    getRecords: vi.fn().mockResolvedValue({ data: [] }),
    start: vi.fn().mockResolvedValue({ data: { id: 1, status: 'running' } }),
    stop: vi.fn().mockResolvedValue({}),
    getStatus: vi.fn().mockResolvedValue({ data: { id: 1, status: 'completed' } }),
  },
  databaseConfigApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'PostgreSQL', host: 'localhost', port: 5432, database: 'test', db_type: 'postgresql' },
        { id: 2, name: 'openGauss', host: 'localhost', port: 5433, database: 'postgres', db_type: 'opengauss' },
        { id: 3, name: 'GaussDB', host: '192.168.1.200', port: 8000, database: 'postgres', db_type: 'gaussdb' },
      ],
    }),
  },
}))

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('FaultScenarios组件', () => {
  it('应该渲染故障场景列表', async () => {
    renderWithRouter(<FaultScenarios />)

    await waitFor(() => {
      expect(screen.getByText('测试场景1')).toBeInTheDocument()
      expect(screen.getByText('测试场景2')).toBeInTheDocument()
    })
  })

  it('应该显示执行注入按钮', async () => {
    renderWithRouter(<FaultScenarios />)

    await waitFor(() => {
      const buttons = screen.getAllByText('执行注入')
      expect(buttons.length).toBe(2)
    })
  })

  it('点击执行注入按钮应弹出选择数据库的Modal', async () => {
    renderWithRouter(<FaultScenarios />)

    await waitFor(() => {
      expect(screen.getByText('测试场景1')).toBeInTheDocument()
    })

    // Click the first inject button
    const injectButtons = screen.getAllByText('执行注入')
    fireEvent.click(injectButtons[0])

    // Modal should appear with database selection
    await waitFor(() => {
      expect(screen.getByText('执行故障注入')).toBeInTheDocument()
      expect(screen.getByText('目标数据库')).toBeInTheDocument()
    })
  })

  it('注入Modal应使用options属性渲染Select', async () => {
    renderWithRouter(<FaultScenarios />)

    await waitFor(() => {
      expect(screen.getByText('测试场景1')).toBeInTheDocument()
    })

    const injectButtons = screen.getAllByText('执行注入')
    fireEvent.click(injectButtons[0])

    await waitFor(() => {
      // Check that the Select placeholder is shown
      expect(screen.getByText('选择要注入故障的数据库')).toBeInTheDocument()
    })
  })
})