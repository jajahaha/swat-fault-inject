import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DatabaseConfig from './pages/DatabaseConfig'
import FaultScenarios from './pages/FaultScenarios'
import DrillManagement from './pages/DrillManagement'
import SqlConsole from './pages/SqlConsole'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DatabaseConfig />} />
        <Route path="/database-config" element={<DatabaseConfig />} />
        <Route path="/fault-scenarios" element={<FaultScenarios />} />
        <Route path="/drill" element={<DrillManagement />} />
        <Route path="/sql-console" element={<SqlConsole />} />
      </Routes>
    </Layout>
  )
}

export default App