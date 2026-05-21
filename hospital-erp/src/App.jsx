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

const SetPasswordModal = () => {
  const token = localStorage.getItem('token');
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsOpen(false);
      return;
    }
    // Check if dismissed for the current session
    if (sessionStorage.getItem('password_modal_dismissed') === 'true') {
      setIsOpen(false);
      return;
    }
    // Decode JWT payload
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const decoded = JSON.parse(jsonPayload);
      if (decoded && decoded.is_temporary_password) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } catch (e) {
      setIsOpen(false);
    }
  }, [token]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Current temporary password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data && res.data.success) {
        setSuccess('Password updated successfully! Redirecting you to login with your new password...');
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('hospitalSettings');
          window.location.href = '/login';
        }, 3000);
      } else {
        setError('Failed to update password. Please check your credentials.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'An error occurred while updating your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl text-slate-100 flex flex-col space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 animate-pulse text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight font-outfit">Set Secure Password <span className="text-amber-500">*</span></h2>
          <p className="text-xs text-slate-400">
            For secure node activation, you are required to change your temporary password before proceeding.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-xs font-semibold text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs font-semibold text-emerald-400">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Temporary Password *</label>
            <input
              type="password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 text-white placeholder-slate-600"
              placeholder="Enter current temp password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading || success}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New Password *</label>
            <input
              type="password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 text-white placeholder-slate-600"
              placeholder="Enter at least 6 characters"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading || success}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm New Password *</label>
            <input
              type="password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 text-white placeholder-slate-600"
              placeholder="Repeat new password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || success}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 mt-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Updating Password...' : 'Activate Node Access'}
          </button>

          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem('password_modal_dismissed', 'true');
              setIsOpen(false);
            }}
            disabled={loading || success}
            className="w-full py-2.5 mt-1 bg-slate-950/40 hover:bg-slate-950 border border-slate-800 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-200 disabled:opacity-50 cursor-pointer text-center"
          >
            Dismiss for Now <span className="text-amber-500 font-bold">*</span>
          </button>

          <div className="text-[10px] text-slate-500 text-center font-semibold italic mt-1">
            * Temporary postponement. You will be prompted again on next app reload/login.
          </div>
        </form>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <div className="erp-container">
        <SetPasswordModal />
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

