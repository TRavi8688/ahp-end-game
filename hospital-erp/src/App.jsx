import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import PharmacyDashboard from './pages/PharmacyDashboard'
import BillingDashboard from './pages/BillingDashboard'
import VisitDashboard from './pages/VisitDashboard'
import LabDashboard from './pages/LabDashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import SettingsPage from './pages/SettingsPage'
import WardDashboard from './pages/WardDashboard'
import SurgeryDashboard from './pages/SurgeryDashboard'
import './App.css'

// Security Gate: Ensures only authenticated hospital staff can access clinical data
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const token = localStorage.getItem('token');
  
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <div className="erp-container">
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/pharmacy" element={<ProtectedRoute><PharmacyDashboard /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><BillingDashboard /></ProtectedRoute>} />
          <Route path="/clinical" element={<ProtectedRoute><VisitDashboard /></ProtectedRoute>} />
          <Route path="/lab" element={<ProtectedRoute><LabDashboard /></ProtectedRoute>} />
          <Route path="/ward" element={<ProtectedRoute><WardDashboard /></ProtectedRoute>} />
          <Route path="/surgery" element={<ProtectedRoute><SurgeryDashboard /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          <Route path="/" element={<Navigate to="/clinical" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
