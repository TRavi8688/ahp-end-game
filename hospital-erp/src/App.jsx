import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import SetupServices from './pages/SetupServices'
import PharmacyDashboard from './pages/PharmacyDashboard'
import BillingDashboard from './pages/BillingDashboard'
import VisitDashboard from './pages/VisitDashboard'
import LabDashboard from './pages/LabDashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import SettingsPage from './pages/SettingsPage'
import WardDashboard from './pages/WardDashboard'
import SurgeryDashboard from './pages/SurgeryDashboard'
import StaffDashboard from './pages/StaffDashboard'
import AcceptInvite from './pages/AcceptInvite'
import axios from 'axios'
import { API_BASE_URL } from './api'
import './App.css'

// Security Gate: Ensures only authenticated hospital staff can access clinical data and checks setup status
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const token = localStorage.getItem('token');
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [hasSettings, setHasSettings] = useState(false);

  useEffect(() => {
    const verifySettings = async () => {
      if (!isAuthenticated || !token) {
        setCheckingSettings(false);
        return;
      }
      
      const cached = localStorage.getItem('hospitalSettings');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) {
            setHasSettings(true);
            setCheckingSettings(false);
            return;
          }
        } catch (e) {
          // fallback to api if parsing fails
        }
      }

      try {
        const res = await axios.get(`${API_BASE_URL}/hospital-settings/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // If settings have been saved (id exists)
        if (res.data && res.data.id) {
          localStorage.setItem('hospitalSettings', JSON.stringify(res.data));
          setHasSettings(true);
        } else {
          setHasSettings(false);
        }
      } catch (err) {
        console.error("Error verifying settings", err);
        setHasSettings(false);
      } finally {
        setCheckingSettings(false);
      }
    };

    verifySettings();
  }, [isAuthenticated, token]);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  if (checkingSettings) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // If hospital has no settings, send them to the Setup Services wizard
  // (unless they are already on the setup-services page)
  const isSetupPage = window.location.pathname === '/setup-services';
  if (!hasSettings && !isSetupPage) {
    return <Navigate to="/setup-services" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <div className="erp-container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          
          <Route path="/setup-services" element={
            <ProtectedRoute>
              <SetupServices />
            </ProtectedRoute>
          } />
          
          <Route path="/pharmacy" element={<ProtectedRoute><PharmacyDashboard /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><BillingDashboard /></ProtectedRoute>} />
          <Route path="/clinical" element={<ProtectedRoute><VisitDashboard /></ProtectedRoute>} />
          <Route path="/lab" element={<ProtectedRoute><LabDashboard /></ProtectedRoute>} />
          <Route path="/ward" element={<ProtectedRoute><WardDashboard /></ProtectedRoute>} />
          <Route path="/surgery" element={<ProtectedRoute><SurgeryDashboard /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute><StaffDashboard /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          <Route path="/" element={<Navigate to="/clinical" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App

