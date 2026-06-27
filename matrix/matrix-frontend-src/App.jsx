/**
 * src/App.jsx — Hospain Matrix 3.0
 * FIX: /tickets now redirects to /matrix/support — removes the duplicate ticket page
 *      so agents always work from one single ticket queue with no state conflicts.
 */
import { lazy, Suspense } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout          from './components/Layout';
import ProtectedRoute  from './components/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const PageLoader = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#334155', fontSize:13, fontFamily:'Inter,system-ui,sans-serif' }}>
    <div style={{ textAlign:'center' }}>
      <div style={{ width:32, height:32, border:'2px solid rgba(99,102,241,0.2)', borderTop:'2px solid #6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
      Loading…
    </div>
  </div>
);

const Login                          = lazy(() => import('./pages/Login'));
const ChangePassword                 = lazy(() => import('./pages/ChangePassword'));
const EmployeeAccounts               = lazy(() => import('./pages/matrix/EmployeeAccounts'));
const Unauthorized                   = lazy(() => import('./pages/Unauthorized'));
const OverviewDashboard              = lazy(() => import('./pages/OverviewDashboard'));
const HospitalNetwork                = lazy(() => import('./pages/HospitalNetwork'));
const HospitalDetail                 = lazy(() => import('./pages/HospitalDetail'));
const RevenueAnalytics               = lazy(() => import('./pages/RevenueAnalytics'));
const StaffPerformance               = lazy(() => import('./pages/StaffPerformance'));
const EmergencyAlerts                = lazy(() => import('./pages/EmergencyAlerts'));
const IAMManagement                  = lazy(() => import('./pages/IAMManagement'));
const VerificationQueue              = lazy(() => import('./pages/VerificationQueue'));
const VerificationDetail             = lazy(() => import('./pages/VerificationDetail'));
const OperationalGovernanceDashboard = lazy(() => import('./pages/OperationalGovernanceDashboard'));
const AuditLogViewer                 = lazy(() => import('./pages/AuditLogViewer'));
const ExportReports                  = lazy(() => import('./pages/ExportReports'));
// NOTE: TicketSystem import removed — /tickets now redirects to /matrix/support

const MissionControl        = lazy(() => import('./pages/matrix/MissionControl'));
const SupportMatrix         = lazy(() => import('./pages/matrix/SupportMatrix'));
const AutoAssignmentEngine  = lazy(() => import('./pages/matrix/AutoAssignmentEngine'));
const WorkloadBalancer      = lazy(() => import('./pages/matrix/WorkloadBalancer'));
const EmployeeCommandCenter = lazy(() => import('./pages/matrix/EmployeeCommandCenter'));
const SLAEngine             = lazy(() => import('./pages/matrix/SLAEngine'));
const EscalationEngine      = lazy(() => import('./pages/matrix/EscalationEngine'));
const HospitalNetworkCenter = lazy(() => import('./pages/matrix/HospitalNetworkCenter'));
const PharmacyNetworkCenter = lazy(() => import('./pages/matrix/PharmacyNetworkCenter'));
const LabNetworkCenter      = lazy(() => import('./pages/matrix/LabNetworkCenter'));
const PatientIntelligence   = lazy(() => import('./pages/matrix/PatientIntelligence'));
const IncidentWarRoom       = lazy(() => import('./pages/matrix/IncidentWarRoom'));
const IAMGovernance         = lazy(() => import('./pages/matrix/IAMGovernance'));
const VerificationCommand   = lazy(() => import('./pages/matrix/VerificationCommand'));
const FinancialCommand      = lazy(() => import('./pages/matrix/FinancialCommand'));
const AuditCompliance       = lazy(() => import('./pages/matrix/AuditCompliance'));
const AICopilot             = lazy(() => import('./pages/matrix/AICopilot'));
const ExecutiveBoardroom    = lazy(() => import('./pages/matrix/ExecutiveBoardroom'));
const EmergencyBroadcast    = lazy(() => import('./pages/matrix/EmergencyBroadcast'));

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0;}
          body{background:#060a12;color:#f1f5f9;}
          ::-webkit-scrollbar{width:3px;height:3px;}
          ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        `}</style>
        <Routes>
          <Route path="/login"           element={<Suspense fallback={<PageLoader/>}><Login /></Suspense>} />
          <Route path="/change-password" element={<Suspense fallback={<PageLoader/>}><ChangePassword /></Suspense>} />
          <Route path="/unauthorized"    element={<Suspense fallback={<PageLoader/>}><Unauthorized /></Suspense>} />
          <Route path="/" element={<Navigate to="/matrix/mission" replace />} />

          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Legacy routes */}
                    <Route path="overview"          element={<OverviewDashboard />} />
                    <Route path="hospitals"         element={<HospitalNetwork />} />
                    <Route path="hospitals/:id"     element={<HospitalDetail />} />
                    <Route path="revenue"           element={<RevenueAnalytics />} />
                    <Route path="staff"             element={<StaffPerformance />} />
                    <Route path="alerts"            element={<EmergencyAlerts />} />
                    <Route path="iam"               element={<IAMManagement />} />
                    <Route path="verifications"     element={<VerificationQueue />} />
                    <Route path="verifications/:id" element={<VerificationDetail />} />
                    <Route path="governance"        element={<OperationalGovernanceDashboard />} />
                    <Route path="audit-logs"        element={<AuditLogViewer />} />
                    <Route path="export"            element={<ExportReports />} />

                    {/* FIX: /tickets redirects to /matrix/support — single source of truth */}
                    <Route path="tickets" element={<Navigate to="/matrix/support" replace />} />

                    {/* Matrix 3.0 — COMMAND */}
                    <Route path="matrix/mission"   element={<MissionControl />} />
                    <Route path="matrix/boardroom" element={
                      <ProtectedRoute requiredPermission="view_boardroom">
                        <ExecutiveBoardroom />
                      </ProtectedRoute>
                    } />

                    {/* Matrix 3.0 — OPERATIONS */}
                    <Route path="matrix/support"    element={<SupportMatrix />} />
                    <Route path="matrix/assignment" element={<AutoAssignmentEngine />} />
                    <Route path="matrix/workload"   element={<WorkloadBalancer />} />
                    <Route path="matrix/sla"        element={<SLAEngine />} />
                    <Route path="matrix/escalation" element={<EscalationEngine />} />

                    {/* Matrix 3.0 — WORKFORCE */}
                    <Route path="matrix/workforce" element={
                      <ProtectedRoute requiredPermission="manage_employees">
                        <EmployeeCommandCenter />
                      </ProtectedRoute>
                    } />
                    <Route path="matrix/employee-accounts" element={
                      <ProtectedRoute requiredPermission="manage_employees">
                        <EmployeeAccounts />
                      </ProtectedRoute>
                    } />

                    {/* Matrix 3.0 — NETWORK */}
                    <Route path="matrix/hospitals" element={<HospitalNetworkCenter />} />
                    <Route path="matrix/pharmacy"  element={<PharmacyNetworkCenter />} />
                    <Route path="matrix/lab"       element={<LabNetworkCenter />} />
                    <Route path="matrix/patients"  element={<PatientIntelligence />} />

                    {/* Matrix 3.0 — CRISIS */}
                    <Route path="matrix/incidents" element={<IncidentWarRoom />} />
                    <Route path="matrix/broadcast" element={
                      <ProtectedRoute requiredPermission="send_broadcast">
                        <EmergencyBroadcast />
                      </ProtectedRoute>
                    } />

                    {/* Matrix 3.0 — SECURITY */}
                    <Route path="matrix/iam" element={
                      <ProtectedRoute requiredPermission="manage_iam">
                        <IAMGovernance />
                      </ProtectedRoute>
                    } />
                    <Route path="matrix/verification" element={<VerificationCommand />} />

                    {/* Matrix 3.0 — ANALYTICS */}
                    <Route path="matrix/financial" element={
                      <ProtectedRoute requiredPermission="view_financial">
                        <FinancialCommand />
                      </ProtectedRoute>
                    } />
                    <Route path="matrix/audit" element={
                      <ProtectedRoute requiredPermission="view_audit">
                        <AuditCompliance />
                      </ProtectedRoute>
                    } />

                    {/* Matrix 3.0 — INTELLIGENCE */}
                    <Route path="matrix/ai" element={<AICopilot />} />

                    <Route path="*" element={<Navigate to="/matrix/mission" replace />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
