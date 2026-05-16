import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import FaultScenarios from '../pages/FaultScenarios'

// Mock the API module
vi.mock('../api', () => ({
  faultScenarioApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: '测试场景1', type: 'high_concurrency', category1: 'full', category2: 'cpu', config: { concurrency: 50, duration_seconds: 60 } },
        { id: 2, name: '测试场景2', type: 'slow_query', category1: 'slow', category2: 'cpu', config: { concurrency: 10, duration_seconds: 30 } },
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
  drillApi: {
    create: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    start: vi.fn().mockResolvedValue({ data: {} }),
    getAll: vi.fn().mockResolvedValue({ data: [] }),
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

  it('应该显示执行按钮', async () => {
    renderWithRouter(<FaultScenarios />)

    await waitFor(() => {
      const buttons = screen.getAllByText('执行')
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('应该显示执行按钮', async () => {
    renderWithRouter(<FaultScenarios />)

    await waitFor(() => {
      const buttons = screen.getAllByText('执行')
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })
  })
})