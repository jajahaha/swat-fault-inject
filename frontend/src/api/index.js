import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export const databaseConfigApi = {
  getAll: () => api.get('/database-configs'),
  getOne: (id) => api.get(`/database-configs/${id}`),
  create: (data) => api.post('/database-configs', data),
  update: (id, data) => api.put(`/database-configs/${id}`, data),
  delete: (id) => api.delete(`/database-configs/${id}`),
  testConnection: (id) => api.post(`/database-configs/${id}/test`),
  getTypes: () => api.get('/database-configs/types'),
  getConnectionMethods: () => api.get('/database-configs/connection-methods'),
}

export const faultScenarioApi = {
  getAll: () => api.get('/fault-scenarios'),
  getOne: (id) => api.get(`/fault-scenarios/${id}`),
  create: (data) => api.post('/fault-scenarios', data),
  update: (id, data) => api.put(`/fault-scenarios/${id}`, data),
  delete: (id) => api.delete(`/fault-scenarios/${id}`),
}

export const injectionApi = {
  start: (scenarioId, dbConfigId) =>
    api.post('/injection/start', { scenario_id: scenarioId, db_config_id: dbConfigId }),
  stop: (recordId) => api.post(`/injection/stop/${recordId}`),
  getStatus: (recordId) => api.get(`/injection/status/${recordId}`),
  getRecords: () => api.get('/injection/records'),
}

// 新增：演练 API
export const drillApi = {
  create: (data) => api.post('/drill/create', data),
  start: (drillId) => api.post(`/drill/start/${drillId}`),
  stop: (drillId) => api.post(`/drill/stop/${drillId}`),
  getStatus: (drillId) => api.get(`/drill/status/${drillId}`),
  getList: () => api.get('/drill/list'),
  getStepStatus: (stepId) => api.get(`/drill/step-status/${stepId}`),
  delete: (drillId) => api.delete(`/drill/${drillId}`),
}