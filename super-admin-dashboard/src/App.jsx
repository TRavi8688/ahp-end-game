/**
 * src/App.jsx — Hospin Matrix 3.0
 *
 * REPLACES: existing super-admin-dashboard/src/App.jsx
 *
 * Changes from previous version:
 *  - All 21 Matrix modules added as lazy routes
 *  - Nav rebuilt around GROUPS from matrixStore
 *  - Real-time mission polling starts on login
 *  - Notification toast tied to matrixStore.notification
 *  - Keeps all existing routes — backwards compatible
 */
import { lazy, Suspense, useEffect, useRef, useCallback } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useNavigate, useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Building2, Users, DollarSign, Activity,
  Radio, ShieldCheck, LogOut, Bell, Search, Command,
  AlertTriangle, X, Ticket, Cpu, Satellite, Siren,
  FlaskConical, Pill, Brain, ShieldAlert, BarChart3,
  Scale, Zap, Clock, GitBranch, ChevronLeft, ChevronRight,
} from "lucide-react";

import { useAuthStore }  from "./stores/authStore";
import { useMatrixStore, startMissionPolling, stopMissionPolling } from "./stores/matrixStore";
import { api } from "./lib/apiClient";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// ─── Lazy pages (existing) ────────────────────────────────────────────────────
const Login                          = lazy(() => import("./pages/Login"));
const OverviewDashboard              = lazy(() => import("./pages/OverviewDashboard"));
const HospitalNetwork                = lazy(() => import("./pages/HospitalNetwork"));
const HospitalDetail                 = lazy(() => import("./pages/HospitalDetail"));
const RevenueAnalytics               = lazy(() => import("./pages/RevenueAnalytics"));
const StaffPerformance               = lazy(() => import("./pages/StaffPerformance"));
const EmergencyAlerts                = lazy(() => import("./pages/EmergencyAlerts"));
const IAMManagement                  = lazy(() => import("./pages/IAMManagement"));
const VerificationQueue              = lazy(() => import("./pages/VerificationQueue"));
const VerificationDetail             = lazy(() => import("./pages/VerificationDetail"));
const OperationalGovernanceDashboard = lazy(() => import("./pages/OperationalGovernanceDashboard"));
const AuditLogViewer                 = lazy(() => import("./pages/AuditLogViewer"));
const ExportReports                  = lazy(() => import("./pages/ExportReports"));
const TicketSystem                   = lazy(() => import("./pages/TicketSystem"));

// ─── NEW Matrix 3.0 pages ─────────────────────────────────────────────────────
const MissionControl       = lazy(() => import("./pages/matrix/MissionControl"));
const SupportMatrix        = lazy(() => import("./pages/matrix/SupportMatrix"));
const AutoAssignmentEngine = lazy(() => import("./pages/matrix/AutoAssignmentEngine"));
const WorkloadBalancer     = lazy(() => import("./pages/matrix/WorkloadBalancer"));
const EmployeeCommandCenter= lazy(() => import("./pages/matrix/EmployeeCommandCenter"));
const SLAEngine            = lazy(() => import("./pages/matrix/SLAEngine"));
const EscalationEngine     = lazy(() => import("./pages/matrix/EscalationEngine"));
const HospitalNetworkCenter= lazy(() => import("./pages/matrix/HospitalNetworkCenter"));
const PharmacyNetworkCenter= lazy(() => import("./pages/matrix/PharmacyNetworkCenter"));
const LabNetworkCenter     = lazy(() => import("./pages/matrix/LabNetworkCenter"));
const PatientIntelligence  = lazy(() => import("./pages/matrix/PatientIntelligence"));
const IncidentWarRoom      = lazy(() => import("./pages/matrix/IncidentWarRoom"));
const IAMGovernance        = lazy(() => import("./pages/matrix/IAMGovernance"));
const VerificationCommand  = lazy(() => import("./pages/matrix/VerificationCommand"));
const FinancialCommand     = lazy(() => import("./pages/matrix/FinancialCommand"));
const AuditCompliance      = lazy(() => import("./pages/matrix/AuditCompliance"));
const AICopilot            = lazy(() => import("./pages/matrix/AICopilot"));
const ExecutiveBoardroom   = lazy(() => import("./pages/matrix/ExecutiveBoardroom"));
const EmergencyBroadcast   = lazy(() => import("./pages/matrix/EmergencyBroadcast"));

// ─── Nav config ──────────────────────────────────────────────────────────────
const NAV = [
  {
    group: "COMMAND",
    items: [
      { path: "/matrix/mission",    icon: Satellite,      label: "Mission Control",        badge: null },
      { path: "/matrix/boardroom",  icon: BarChart3,      label: "Executive Boardroom",    badge: null },
    ],
  },
  {
    group: "OPERATIONS",
    items: [
      { path: "/matrix/support",      icon: Ticket,      label: "Support Matrix",            badgeKey: "tickets_critical" },
      { path: "/matrix/assignment",   icon: Zap,         label: "Auto-Assignment Engine",    badge: null },
      { path: "/matrix/workload",     icon: Scale,       label: "Workload Balancer",         badge: null },
      { path: "/matrix/sla",          icon: Clock,       label: "SLA Engine",                badge: null },
      { path: "/matrix/escalation",   icon: GitBranch,   label: "Escalation Engine",         badge: null },
    ],
  },
  {
    group: "WORKFORCE",
    items: [
      { path: "/matrix/workforce",    icon: Users,       label: "Employee Command Center",   badge: null },
    ],
  },
  {
    group: "NETWORK",
    items: [
      { path: "/matrix/hospitals",    icon: Building2,   label: "Hospital Network",          badge: null },
      { path: "/matrix/pharmacy",     icon: Pill,        label: "Pharmacy Network",          badge: null },
      { path: "/matrix/lab",          icon: FlaskConical,label: "Lab Network",               badge: null },
      { path: "/matrix/patients",     icon: Brain,       label: "Patient Intelligence",      badge: null },
    ],
  },
  {
    group: "CRISIS",
    items: [
      { path: "/matrix/incidents",    icon: Siren,       label: "Incident War Room",         badge: null },
      { path: "/matrix/broadcast",    icon: Radio,       label: "Emergency Broadcast",       badge: null },
    ],
  },
  {
    group: "SECURITY",
    items: [
      { path: "/matrix/iam",          icon: ShieldAlert, label: "IAM Governance",            badge: null },
      { path: "/matrix/verification", icon: ShieldCheck, label: "Verification Command",      badgeKey: "verifications_pending" },
    ],
  },
  {
    group: "ANALYTICS",
    items: [
      { path: "/matrix/financial",    icon: DollarSign,  label: "Financial Command",         badge: null },
      { path: "/matrix/audit",        icon: Activity,    label: "Audit & Compliance",        badge: null },
    ],
  },
  {
    group: "INTELLIGENCE",
    items: [
      { path: "/matrix/ai",           icon: Cpu,         label: "AI Operations Copilot",     badge: null },
    ],
  },
];

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:      "#060a12",
  surface: "#0c1220",
  border:  "rgba(255,255,255,0.06)",
  indigo:  "#6366f1",
  text:    "#f1f5f9",
  textMid: "#94a3b8",
  textDim: "#475569",
  emerald: "#10b981",
  rose:    "#f43f5e",
  amber:   "#f59e0b",
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ collapsed, onToggle }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { logout }= useAuthStore();
  const metrics   = useMatrixStore((s) => s.missionMetrics);

  const badgeValues = {
    tickets_critical:      metrics?.tickets?.critical       || 0,
    verifications_pending: metrics?.verifications?.pending  || 0,
  };

  return (
    <aside style={{
      width:          collapsed ? 52 : 220,
      flexShrink:     0,
      background:     "#050911",
      borderRight:    `1px solid ${T.border}`,
      display:        "flex",
      flexDirection:  "column",
      overflow:       "hidden",
      transition:     "width 0.2s ease",
      height:         "100vh",
    }}>
      {/* Logo */}
      <div style={{ padding: "14px 12px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, flexShrink: 0, color: "#fff", fontWeight: 900,
          }}>⬡</div>
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: T.text, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
                Hospin <span style={{ color: T.indigo }}>Matrix</span>
              </div>
              <div style={{ fontSize: 8, color: T.textDim, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Enterprise OS v3.0
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
        {NAV.map(({ group, items }) => (
          <div key={group} style={{ marginBottom: 10 }}>
            {!collapsed && (
              <div style={{
                fontSize: 8, fontWeight: 800, color: T.textDim,
                letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "2px 7px", marginBottom: 1, opacity: 0.5,
              }}>{group}</div>
            )}
            {items.map(({ path, icon: Icon, label, badge, badgeKey }) => {
              const active = location.pathname === path || location.pathname.startsWith(path + "/");
              const bval   = badgeKey ? badgeValues[badgeKey] : null;
              return (
                <button key={path} onClick={() => navigate(path)}
                  title={collapsed ? label : undefined}
                  style={{
                    display:         "flex",
                    alignItems:      "center",
                    gap:             7,
                    width:           "100%",
                    padding:         collapsed ? "7px 0" : "5px 7px",
                    justifyContent:  collapsed ? "center" : "flex-start",
                    borderRadius:    7,
                    border:          "none",
                    cursor:          "pointer",
                    marginBottom:    1,
                    fontSize:        11,
                    fontWeight:      active ? 700 : 400,
                    background:      active ? "rgba(99,102,241,0.14)" : "none",
                    color:           active ? "#818cf8" : T.textDim,
                    transition:      "all 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "none"; }}
                >
                  <Icon size={13} style={{ flexShrink: 0 }} />
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {label}
                      </span>
                      {bval > 0 && (
                        <span style={{
                          background: T.rose, color: "#fff",
                          fontSize: 9, fontWeight: 800,
                          padding: "1px 5px", borderRadius: 10,
                          flexShrink: 0,
                        }}>{bval > 99 ? "99+" : bval}</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "6px 4px", flexShrink: 0 }}>
        <button onClick={onToggle} style={{
          display: "flex", alignItems: "center", gap: 7,
          justifyContent: collapsed ? "center" : "flex-start",
          width: "100%", padding: collapsed ? "7px 0" : "5px 7px",
          borderRadius: 7, border: "none", background: "none",
          color: T.textDim, fontSize: 11, cursor: "pointer",
        }}>
          {collapsed ? <ChevronRight size={13} /> : <><ChevronLeft size={13} /><span>Collapse</span></>}
        </button>
        <button onClick={logout} style={{
          display: "flex", alignItems: "center", gap: 7,
          justifyContent: collapsed ? "center" : "flex-start",
          width: "100%", padding: collapsed ? "7px 0" : "5px 7px",
          borderRadius: 7, border: "none", background: "none",
          color: T.textDim, fontSize: 11, cursor: "pointer",
        }}>
          <LogOut size={13} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar() {
  const location  = useLocation();
  const employee  = useMatrixStore((s) => s.employee);
  const metrics   = useMatrixStore((s) => s.missionMetrics);
  const notification = useMatrixStore((s) => s.notification);

  const current = NAV.flatMap((s) => s.items).find(
    (i) => location.pathname === i.path || location.pathname.startsWith(i.path + "/")
  );

  return (
    <header style={{
      height:          48,
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "space-between",
      padding:         "0 18px",
      borderBottom:    `1px solid ${T.border}`,
      flexShrink:      0,
      background:      "rgba(6,10,18,0.97)",
      backdropFilter:  "blur(8px)",
      zIndex:          10,
      position:        "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {current?.icon && <current.icon size={14} style={{ color: T.indigo }} />}
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
          {current?.label || "Hospin Matrix"}
        </span>
        {metrics?.tickets?.critical > 0 && (
          <span style={{
            background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)",
            color: T.rose, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
          }}>
            ⚠ {metrics.tickets.critical} CRITICAL
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.emerald, boxShadow: `0 0 5px ${T.emerald}` }} />
          <span style={{ fontSize: 10, color: T.textDim }}>LIVE</span>
        </div>

        {/* Notification toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              style={{
                position: "absolute", right: 60, top: 8,
                background: notification.type === "error" ? "rgba(244,63,94,0.15)" : "rgba(16,185,129,0.15)",
                border: `1px solid ${notification.type === "error" ? T.rose : T.emerald}40`,
                color: notification.type === "error" ? T.rose : T.emerald,
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                maxWidth: 300,
              }}
            >{notification.message}</motion.div>
          )}
        </AnimatePresence>

        {/* Employee avatar */}
        {employee && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: "#fff",
          }}>
            {(employee.avatar_initials || employee.full_name?.slice(0, 2) || "SA").toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function Shell({ children }) {
  const { sidebarCollapsed, setModule } = useMatrixStore();
  const toggleSidebar = useMatrixStore((s) => s.toggleSidebar);
  const location = useLocation();

  // Start mission polling on mount
  useEffect(() => {
    startMissionPolling(5000);
    return () => stopMissionPolling();
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: T.bg, fontFamily: "system-ui,-apple-system,sans-serif", color: T.text }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar />
        <main style={{ flex: 1, overflow: "auto" }}>
          <Suspense fallback={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.textDim, fontSize: 13 }}>
              Loading…
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// ─── Auth guard ───────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />

          {/* Protected shell */}
          <Route path="/*" element={
            <RequireAuth>
              <Shell>
                <Routes>
                  {/* ── Legacy routes (backwards-compat) ── */}
                  <Route index                  element={<Navigate to="/matrix/mission" replace />} />
                  <Route path="overview"        element={<OverviewDashboard />} />
                  <Route path="hospitals"       element={<HospitalNetwork />} />
                  <Route path="hospitals/:id"   element={<HospitalDetail />} />
                  <Route path="revenue"         element={<RevenueAnalytics />} />
                  <Route path="staff"           element={<StaffPerformance />} />
                  <Route path="alerts"          element={<EmergencyAlerts />} />
                  <Route path="iam"             element={<IAMManagement />} />
                  <Route path="verifications"   element={<VerificationQueue />} />
                  <Route path="verifications/:id" element={<VerificationDetail />} />
                  <Route path="governance"      element={<OperationalGovernanceDashboard />} />
                  <Route path="audit-logs"      element={<AuditLogViewer />} />
                  <Route path="export"          element={<ExportReports />} />
                  <Route path="tickets"         element={<TicketSystem />} />

                  {/* ── Matrix 3.0 modules ── */}
                  <Route path="matrix/mission"      element={<MissionControl />} />
                  <Route path="matrix/support"      element={<SupportMatrix />} />
                  <Route path="matrix/assignment"   element={<AutoAssignmentEngine />} />
                  <Route path="matrix/workload"     element={<WorkloadBalancer />} />
                  <Route path="matrix/workforce"    element={<EmployeeCommandCenter />} />
                  <Route path="matrix/sla"          element={<SLAEngine />} />
                  <Route path="matrix/escalation"   element={<EscalationEngine />} />
                  <Route path="matrix/hospitals"    element={<HospitalNetworkCenter />} />
                  <Route path="matrix/pharmacy"     element={<PharmacyNetworkCenter />} />
                  <Route path="matrix/lab"          element={<LabNetworkCenter />} />
                  <Route path="matrix/patients"     element={<PatientIntelligence />} />
                  <Route path="matrix/incidents"    element={<IncidentWarRoom />} />
                  <Route path="matrix/iam"          element={<IAMGovernance />} />
                  <Route path="matrix/verification" element={<VerificationCommand />} />
                  <Route path="matrix/financial"    element={<FinancialCommand />} />
                  <Route path="matrix/audit"        element={<AuditCompliance />} />
                  <Route path="matrix/ai"           element={<AICopilot />} />
                  <Route path="matrix/boardroom"    element={<ExecutiveBoardroom />} />
                  <Route path="matrix/broadcast"    element={<EmergencyBroadcast />} />
                </Routes>
              </Shell>
            </RequireAuth>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
