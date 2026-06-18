// super-admin-dashboard/src/App.jsx
// FIXED:
//   1. Added Layout wrapper with sidebar for all protected routes
//   2. Wired react-router-dom v6 useNavigate to OverviewDashboard onNavigate prop
//   3. HospitalDetail and VerificationDetail now use route params (not props)
//   4. HospitalNetwork uses navigate internally (not onViewHospital prop)
//   5. react-router-dom added to package.json

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazy, Suspense } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Login                          = lazy(() => import('./pages/Login'));
const Unauthorized                   = lazy(() => import('./pages/Unauthorized'));
const Layout                         = lazy(() => import('./components/Layout'));
const OverviewDashboard              = lazy(() => import('./pages/OverviewDashboard'));
const HospitalNetwork                = lazy(() => import('./pages/HospitalNetwork'));
const HospitalDetail                 = lazy(() => import('./pages/HospitalDetail'));
const StaffPerformance               = lazy(() => import('./pages/StaffPerformance'));
const RevenueAnalytics               = lazy(() => import('./pages/RevenueAnalytics'));
const VerificationQueue              = lazy(() => import('./pages/VerificationQueue'));
const VerificationDetail             = lazy(() => import('./pages/VerificationDetail'));
const OperationalGovernanceDashboard = lazy(() => import('./pages/OperationalGovernanceDashboard'));
const EmergencyAlerts                = lazy(() => import('./pages/EmergencyAlerts'));
const IAMManagement                  = lazy(() => import('./pages/IAMManagement'));
const ExportReports                  = lazy(() => import('./pages/ExportReports'));
const AuditLogViewer                 = lazy(() => import('./pages/AuditLogViewer'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}

// Wraps a page in ProtectedRoute + Layout
function AdminPage({ children }) {
  return (
    <ProtectedRoute requiredRole="super_admin">
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/login"        element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Protected admin routes — all wrapped in AdminPage (ProtectedRoute + Layout) */}
              <Route path="/"                      element={<AdminPage><OverviewDashboard /></AdminPage>} />
              <Route path="/hospitals"             element={<AdminPage><HospitalNetwork /></AdminPage>} />
              <Route path="/hospitals/:id"         element={<AdminPage><HospitalDetail /></AdminPage>} />
              <Route path="/staff"                 element={<AdminPage><StaffPerformance /></AdminPage>} />
              <Route path="/revenue"               element={<AdminPage><RevenueAnalytics /></AdminPage>} />
              <Route path="/verifications"         element={<AdminPage><VerificationQueue /></AdminPage>} />
              <Route path="/verifications/:id"     element={<AdminPage><VerificationDetail /></AdminPage>} />
              <Route path="/governance"            element={<AdminPage><OperationalGovernanceDashboard /></AdminPage>} />
              <Route path="/alerts"                element={<AdminPage><EmergencyAlerts /></AdminPage>} />
              <Route path="/iam"                   element={<AdminPage><IAMManagement /></AdminPage>} />
              <Route path="/exports"               element={<AdminPage><ExportReports /></AdminPage>} />
              <Route path="/audit-logs"            element={<AdminPage><AuditLogViewer /></AdminPage>} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
