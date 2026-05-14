import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import PharmacyDashboard from './pages/PharmacyDashboard'
import BillingDashboard from './pages/BillingDashboard'
import './App.css'

function App() {
  return (
    <Router>
      <div className="erp-container">
        <Routes>
          <Route path="/pharmacy" element={<PharmacyDashboard />} />
          <Route path="/billing" element={<BillingDashboard />} />
          <Route path="/" element={<Navigate to="/pharmacy" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
