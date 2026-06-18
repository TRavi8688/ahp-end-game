// src/App.tsx
// All routes wired. Queue, Lab, Support pages added.
// ProtectedRoute guards all dashboard pages.
// Pharmacy and Lab dashboards are separate based on partner.business_type.

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';

// Lazy load all pages for performance
const Login        = lazy(() => import('./pages/Auth/Login'));
const Register     = lazy(() => import('./pages/Auth/Register'));
const Dashboard    = lazy(() => import('./pages/Dashboard/Dashboard'));
const Orders       = lazy(() => import('./pages/Orders'));
const Inventory    = lazy(() => import('./pages/Inventory/Inventory'));
const Scanner      = lazy(() => import('./pages/Scanner/Scanner'));
const ReferralTracking = lazy(() => import('./pages/ReferralTracking'));
const Settings     = lazy(() => import('./pages/Profile/Settings'));
const PharmacyQueue = lazy(() => import('./pages/Queue/PharmacyQueue'));
const LabDashboard  = lazy(() => import('./pages/Lab/LabDashboard'));
const SupportTickets = lazy(() => import('./pages/Support/SupportTickets'));

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function PublicRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#020917] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicRoute />}>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected — all behind Layout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/orders"     element={<Orders />} />
          <Route path="/inventory"  element={<Inventory />} />
          <Route path="/scanner"    element={<Scanner />} />
          <Route path="/referrals"  element={<ReferralTracking />} />
          <Route path="/settings"   element={<Settings />} />
          {/* New routes */}
          <Route path="/queue"      element={<PharmacyQueue />} />
          <Route path="/lab"        element={<LabDashboard />} />
          <Route path="/support"    element={<SupportTickets />} />
        </Route>

        {/* Catch-all */}
        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
        <Route path="*"  element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </Provider>
  );
}
