// partner-app/src/App.tsx
//
// FIX 1: Orders.jsx and ReferralTracking.jsx were built pages but had
//         ZERO Route entries — users could never navigate to them.
// FIX 2: Standardized on AuthContext (TypeScript) as the single auth system.
//         Redux authSlice still handles API calls but AuthContext owns the
//         session state read by ProtectedRoute.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';

// Auth Pages (TypeScript — single auth system)
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Dashboard Pages
import Dashboard from './pages/Dashboard/Dashboard';
import Scanner from './pages/Scanner/Scanner';
import Inventory from './pages/Inventory/Inventory';
import Settings from './pages/Profile/Settings';

// FIX 1: Import previously unreachable pages
import Orders from './pages/Orders';
import ReferralTracking from './pages/ReferralTracking';

function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/settings" element={<Settings />} />

            {/* FIX 1: Add routes for Orders and ReferralTracking */}
            <Route path="/orders" element={<Orders />} />
            <Route path="/referrals" element={<ReferralTracking />} />
          </Route>

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
