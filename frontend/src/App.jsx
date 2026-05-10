import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DatabaseConfig from './pages/DatabaseConfig'
import FaultScenarios from './pages/FaultScenarios'
import DrillManagement from './pages/DrillManagement'  // 新增

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DatabaseConfig />} />
        <Route path="/database-config" element={<DatabaseConfig />} />
        <Route path="/fault-scenarios" element={<FaultScenarios />} />
        <Route path="/drill" element={<DrillManagement />} />  {/* 新增 */}
      </Routes>
    </Layout>
  )
}

export default App