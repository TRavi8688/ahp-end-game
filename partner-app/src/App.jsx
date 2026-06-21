import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { setAuthFailureCallback } from './services/apiClient';

import Login from './pages/Login';
import Register from './pages/Register';
import VerificationPending from './pages/VerificationPending';
import Home from './pages/Home';
import Orders from './pages/Orders';
import WalkIn from './pages/WalkIn';
import Inventory from './pages/Inventory';
import Notifications from './pages/Notifications';
import More from './pages/more/More';
import MoreReports from './pages/more/MoreReports';
import MoreCustomers from './pages/more/MoreCustomers';
import MoreStaff from './pages/more/MoreStaff';
import MoreSuppliers from './pages/more/MoreSuppliers';
import MorePurchases from './pages/more/MorePurchases';
import MoreFinance from './pages/more/MoreFinance';
import MoreSettings from './pages/more/MoreSettings';
import Layout from './components/Layout';

function PrivateLayout({ isAuthenticated, onLogout, children }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout onLogout={onLogout}>{children}</Layout>;
}

function App() {
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

  const wrap = (el) => <PrivateLayout isAuthenticated={isAuthenticated} onLogout={handleLogout}>{el}</PrivateLayout>;

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/home" replace /> : <Login onLogin={handleLogin} />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/home" replace /> : <Register />} />
      <Route path="/verification-pending" element={<VerificationPending />} />

      <Route path="/home" element={wrap(<Home />)} />
      <Route path="/orders" element={wrap(<Orders />)} />
      <Route path="/walkin" element={wrap(<WalkIn />)} />
      <Route path="/inventory" element={wrap(<Inventory />)} />
      <Route path="/notifications" element={wrap(<Notifications />)} />

      <Route path="/more" element={wrap(<More />)} />
      <Route path="/more/reports" element={wrap(<MoreReports />)} />
      <Route path="/more/customers" element={wrap(<MoreCustomers />)} />
      <Route path="/more/staff" element={wrap(<MoreStaff />)} />
      <Route path="/more/suppliers" element={wrap(<MoreSuppliers />)} />
      <Route path="/more/purchases" element={wrap(<MorePurchases />)} />
      <Route path="/more/finance" element={wrap(<MoreFinance />)} />
      <Route path="/more/settings" element={wrap(<MoreSettings onLogout={handleLogout} />)} />

      <Route path="*" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
