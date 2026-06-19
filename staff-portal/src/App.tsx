// staff-portal/src/App.tsx
//
// WHAT CHANGED vs existing file:
//  - pharmacy route: allowedRoles=['pharmacy'] → ['pharmacist'] (JWT issues 'pharmacist')
//  - Added /hr route for HR role
//  - Added /lab route for lab role
//  - Added /reception route for receptionist role
//  - Added /owner route for owner role
//  - Removed import of Settings page (file doesn't exist — caused crash)
//  - RoleBasedRedirect uses sessionStorage (not localStorage)
//  - All page imports use Dashboard/ subfolder (.tsx versions only)

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const Login             = lazy(() => import('./pages/Login'));
const Unauthorized      = lazy(() => import('./pages/Unauthorized'));
const Layout            = lazy(() => import('./components/Layout'));

// All dashboard pages — from Dashboard/ subfolder (TypeScript versions)
const AdminDashboard    = lazy(() => import('./pages/Dashboard/AdminDashboard'));
const DoctorDashboard   = lazy(() => import('./pages/Dashboard/DoctorDashboard'));
const NurseDashboard    = lazy(() => import('./pages/Dashboard/NurseDashboard'));
const PharmacyDashboard = lazy(() => import('./pages/Dashboard/PharmacyDashboard'));
const LabDashboard      = lazy(() => import('./pages/Dashboard/LabDashboard'));
const OwnerDashboard    = lazy(() => import('./pages/Dashboard/OwnerDashboard'));
const HRDashboard       = lazy(() => import('./pages/Dashboard/HRDashboard'));
const ReceptionDashboard = lazy(() => import('./pages/Dashboard/ReceptionDashboard'));

function Loading() {
  return (
    <div style={{
      height: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#0f172a',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid #6366f1', borderTopColor: 'transparent',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

// Wraps a page in ProtectedRoute + Layout
function StaffPage({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: string[];
}) {
  return (
    <ProtectedRoute allowedRoles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

// After login, redirect to the correct dashboard based on role
function RoleBasedRedirect() {
  const storedToken = sessionStorage.getItem('hospyn_access_token');
  if (!storedToken) return <Navigate to="/login" replace />;

  const userStr = sessionStorage.getItem('hospyn_user');
  let role = '';
  try {
    role = userStr ? JSON.parse(userStr).role : '';
  } catch {
    return <Navigate to="/login" replace />;
  }

  const routes: Record<string, string> = {
    admin:          '/admin',
    hospital_admin: '/admin',
    super_admin:    '/admin',
    doctor:         '/doctor',
    nurse:          '/nurse',
    staff:          '/nurse',
    pharmacist:     '/pharmacy',   // FIXED: was 'pharmacy'
    lab:            '/lab',
    owner:          '/owner',
    receptionist:   '/reception',
    hr:             '/hr',         // FIXED: was missing
  };

  return <Navigate to={routes[role] || '/unauthorized'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login"        element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Admin / Hospital Admin */}
            <Route
              path="/admin/*"
              element={
                <StaffPage roles={['admin', 'hospital_admin', 'super_admin']}>
                  <AdminDashboard />
                </StaffPage>
              }
            />

            {/* Doctor */}
            <Route
              path="/doctor/*"
              element={
                <StaffPage roles={['doctor']}>
                  <DoctorDashboard />
                </StaffPage>
              }
            />

            {/* Nurse / Staff */}
            <Route
              path="/nurse/*"
              element={
                <StaffPage roles={['nurse', 'staff']}>
                  <NurseDashboard />
                </StaffPage>
              }
            />

            {/* FIXED: was allowedRoles={['pharmacy']} — JWT role is 'pharmacist' */}
            <Route
              path="/pharmacy/*"
              element={
                <StaffPage roles={['pharmacist']}>
                  <PharmacyDashboard />
                </StaffPage>
              }
            />

            {/* Lab technician — FIXED: was missing entirely */}
            <Route
              path="/lab/*"
              element={
                <StaffPage roles={['lab']}>
                  <LabDashboard />
                </StaffPage>
              }
            />

            {/* Hospital Owner */}
            <Route
              path="/owner/*"
              element={
                <StaffPage roles={['owner', 'hospital_admin']}>
                  <OwnerDashboard />
                </StaffPage>
              }
            />

            {/* HR — FIXED: was missing entirely */}
            <Route
              path="/hr/*"
              element={
                <StaffPage roles={['hr', 'admin']}>
                  <HRDashboard />
                </StaffPage>
              }
            />

            {/* Receptionist */}
            <Route
              path="/reception/*"
              element={
                <StaffPage roles={['receptionist']}>
                  <ReceptionDashboard />
                </StaffPage>
              }
            />

            {/* Root → role-based redirect */}
            <Route path="/"  element={<RoleBasedRedirect />} />
            <Route path="*"  element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
