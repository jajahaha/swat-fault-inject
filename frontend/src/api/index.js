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
  getDeploymentModes: () => api.get('/database-configs/deployment-modes'),
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

export const drillApi = {
  create: (data) => api.post('/drill/create', data),
  start: (drillId) => api.post(`/drill/start/${drillId}`),
  stop: (drillId) => api.post(`/drill/stop/${drillId}`),
  getStatus: (drillId) => api.get(`/drill/status/${drillId}`),
  getList: () => api.get('/drill/list'),
  getStepStatus: (stepId) => api.get(`/drill/step-status/${stepId}`),
  delete: (drillId) => api.delete(`/drill/${drillId}`),
}

export const dbConfigIOApi = {
  import: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/database-configs/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  importBatch: (files) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post('/database-configs/import-batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  export: (configId) => api.get(`/database-configs/export/${configId}`, { responseType: 'blob' }),
  exportBatch: (configIds) => api.post('/database-configs/export-batch', configIds, { responseType: 'blob' }),
  exportAll: () => api.get('/database-configs/export-all', { responseType: 'blob' }),
  validate: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/database-configs/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
}

export const scenarioIOApi = {
  import: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/fault-scenarios/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  importBatch: (files) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post('/fault-scenarios/import-batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  export: (scenarioId) => api.get(`/fault-scenarios/export/${scenarioId}`, { responseType: 'blob' }),
  exportBatch: (scenarioIds) => api.post('/fault-scenarios/export-batch', scenarioIds, { responseType: 'blob' }),
  exportAll: () => api.get('/fault-scenarios/export-all', { responseType: 'blob' }),
  validate: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/fault-scenarios/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
}

export const sqlConsoleApi = {
  execute: (dbConfigId, sql, limit = 1000) =>
    api.post('/sql-console/execute', { db_config_id: dbConfigId, sql, limit }),
}