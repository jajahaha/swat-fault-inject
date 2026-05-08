import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { databaseConfigApi, faultScenarioApi, injectionApi } from '../api'

vi.mock('axios', () => {
  const mockAxios = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(() => mockAxios),
  }
  return {
    default: mockAxios,
  }
})

describe('API模块', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('databaseConfigApi', () => {
    it('getAll 应该调用正确的API', async () => {
      const mockData = [{ id: 1, name: '测试数据库' }]
      axios.get.mockResolvedValue({ data: mockData })

      const result = await databaseConfigApi.getAll()

      expect(axios.get).toHaveBeenCalledWith('/database-configs')
      expect(result.data).toEqual(mockData)
    })

    it('create 应该发送正确的数据', async () => {
      const configData = {
        name: '新数据库',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'user',
        password: 'pass',
      }
      axios.post.mockResolvedValue({ data: { id: 1, ...configData } })

      const result = await databaseConfigApi.create(configData)

      expect(axios.post).toHaveBeenCalledWith('/database-configs', configData)
      expect(result.data.id).toBe(1)
    })

    it('testConnection 应该调用正确的API', async () => {
      axios.post.mockResolvedValue({ data: { success: true, message: '连接成功' } })

      const result = await databaseConfigApi.testConnection(1)

      expect(axios.post).toHaveBeenCalledWith('/database-configs/1/test')
      expect(result.data.success).toBe(true)
    })

    it('delete 应该调用正确的API', async () => {
      axios.delete.mockResolvedValue({ data: { message: '删除成功' } })

      await databaseConfigApi.delete(1)

      expect(axios.delete).toHaveBeenCalledWith('/database-configs/1')
    })
  })

  describe('faultScenarioApi', () => {
    it('getAll 应该获取所有场景', async () => {
      const mockData = [{ id: 1, name: '高并发测试', type: 'high_concurrency' }]
      axios.get.mockResolvedValue({ data: mockData })

      const result = await faultScenarioApi.getAll()

      expect(axios.get).toHaveBeenCalledWith('/fault-scenarios')
      expect(result.data).toEqual(mockData)
    })

    it('create 应该创建新场景', async () => {
      const scenarioData = {
        name: '新场景',
        type: 'high_concurrency',
        config: { concurrency: 50 },
      }
      axios.post.mockResolvedValue({ data: { id: 1, ...scenarioData } })

      const result = await faultScenarioApi.create(scenarioData)

      expect(axios.post).toHaveBeenCalledWith('/fault-scenarios', scenarioData)
      expect(result.data.id).toBe(1)
    })
  })

  describe('injectionApi', () => {
    it('start 应该启动注入', async () => {
      axios.post.mockResolvedValue({ data: { id: 1, status: 'running' } })

      const result = await injectionApi.start(1, 2)

      expect(axios.post).toHaveBeenCalledWith('/injection/start', {
        scenario_id: 1,
        db_config_id: 2,
      })
      expect(result.data.status).toBe('running')
    })

    it('stop 应该停止注入', async () => {
      axios.post.mockResolvedValue({ data: { id: 1, status: 'completed' } })

      const result = await injectionApi.stop(1)

      expect(axios.post).toHaveBeenCalledWith('/injection/stop/1')
      expect(result.data.status).toBe('completed')
    })

    it('getRecords 应该获取所有记录', async () => {
      const mockData = [{ id: 1, status: 'completed' }]
      axios.get.mockResolvedValue({ data: mockData })

      const result = await injectionApi.getRecords()

      expect(axios.get).toHaveBeenCalledWith('/injection/records')
      expect(result.data).toEqual(mockData)
    })
  })
})