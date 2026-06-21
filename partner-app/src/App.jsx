import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { setAuthFailureCallback } from './services/apiClient';

import Login from './pages/Login';
import Register from './pages/Register';
import VerificationPending from './pages/VerificationPending';
import Home from './pages/Home';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Layout from './components/Layout';

function PrivateLayout({ isAuthenticated, onLogout, children }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout onLogout={onLogout}>{children}</Layout>;
}

function App() {
  // EXECUTION FIX (carried over): was hardcoded `useState(true)` with the
  // auth-failure callback commented out — anyone, logged in or not, landed
  // straight on the dashboard. Reflects real token presence on load, and a
  // 401 from any API call genuinely logs the user out.
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('token')
  );
  const navigate = useNavigate();

  useEffect(() => {
    setAuthFailureCallback(() => {
      setIsAuthenticated(false);
      navigate('/login');
    });
  }, [navigate]);

  const handleLogin = () => {
    setIsAuthenticated(true);
    navigate('/home');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/home" replace /> : <Login onLogin={handleLogin} />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/home" replace /> : <Register />} />
      <Route path="/verification-pending" element={<VerificationPending />} />

      <Route path="/home" element={<PrivateLayout isAuthenticated={isAuthenticated} onLogout={handleLogout}><Home /></PrivateLayout>} />
      <Route path="/orders" element={<PrivateLayout isAuthenticated={isAuthenticated} onLogout={handleLogout}><Orders /></PrivateLayout>} />
      <Route path="/inventory" element={<PrivateLayout isAuthenticated={isAuthenticated} onLogout={handleLogout}><Inventory /></PrivateLayout>} />
      <Route path="/analytics" element={<PrivateLayout isAuthenticated={isAuthenticated} onLogout={handleLogout}><Analytics /></PrivateLayout>} />
      <Route path="/profile" element={<PrivateLayout isAuthenticated={isAuthenticated} onLogout={handleLogout}><Profile onLogout={handleLogout} /></PrivateLayout>} />

      <Route path="*" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
