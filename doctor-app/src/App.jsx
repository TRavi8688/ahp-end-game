// doctor-app/src/App.jsx
// ============================================================
// FIXES APPLIED (from Hospyn Full System Audit):
//   FIX 1: PatientSearch route added → /patients/search
//   FIX 2: VerificationScreen route added → /verify
//   FIX 3: All routes wrapped with ErrorBoundary
// (FIX 4: IntakeModal wired into QueueScreen — see QueueScreen.jsx)
// ============================================================

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

// Layout
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

// Auth pages (no layout wrapper)
import LoginScreen from "./pages/LoginScreen";
import SignupScreen from "./pages/SignupScreen";

// ── FIX 3: Import ErrorBoundary ──────────────────────────────
import ErrorBoundary from "./components/ErrorBoundary";

// Authenticated pages
import HomeDashboard from "./pages/HomeDashboard";
import PatientList from "./pages/PatientList";
import PatientDetailView from "./pages/PatientDetailView";
import QueueScreen from "./pages/QueueScreen";
import PrescriptionBuilder from "./pages/PrescriptionBuilder";
import Schedule from "./pages/Schedule";
import Analytics from "./pages/Analytics";
import EarningsDashboard from "./pages/EarningsDashboard";
import LeaveManagement from "./pages/LeaveManagement";
import RosterScreen from "./pages/RosterScreen";
import Alerts from "./pages/Alerts";
import AccessHistory from "./pages/AccessHistory";
import NotificationsScreen from "./pages/NotificationsScreen";
import Settings from "./pages/Settings";
import VerificationScreen from "./pages/VerificationScreen";

// ── FIX 1: Import PatientSearch ──────────────────────────────
import PatientSearch from "./pages/PatientSearch";

// Hooks
import { useAuth, AuthProvider } from "./contexts/AuthContext";
import { useIdleLogout } from "./hooks/useIdleLogout";
import { SocketProvider } from "./contexts/SocketContext";

// ── Premium Dark Glass Theme (unchanged) ─────────────────────
const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#050810", paper: "#0a0f1e" },
    primary: { main: "#0D9488" },
    secondary: { main: "#6366F1" },
  },
  typography: {
    fontFamily: "DM Sans, Syne, Space Mono, sans-serif",
  },
});

// ── Protected Route wrapper ───────────────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// ── Authenticated layout shell ────────────────────────────────
function AuthenticatedLayout({ children }) {
  useIdleLogout(() => {
    localStorage.clear();
    window.location.href = '/login';
  }); // auto-logout on inactivity
  return (
    <SocketProvider>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Topbar />
          <main style={{ flex: 1, padding: "24px" }}>{children}</main>
        </div>
      </div>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          {/* ── FIX 3: Wrap all Routes with ErrorBoundary ────────
              Prevents any single page crash from white-screening
              the entire app. ErrorBoundary shows a fallback UI.  */}
          <ErrorBoundary>
            <Routes>

              {/* ── Public routes (no layout) ───────────────── */}
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/signup" element={<SignupScreen />} />

              {/* ── FIX 2: VerificationScreen route ─────────────
                  File exists at pages/VerificationScreen.jsx but
                  had zero Route entry — was completely unreachable. */}
              <Route path="/verify" element={<VerificationScreen />} />

              {/* ── Authenticated routes (with layout) ─────────── */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <HomeDashboard />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patients"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <PatientList />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              {/* FIX: route was "/patients/:patientId" but
                  PatientDetailView.jsx reads useParams() as { id } —
                  patientId was never populated, id was always undefined.
                  Fixed param name to :id to match the component. */}
              <Route
                path="/patients/:id"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <PatientDetailView />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />

              {/* FIX: 9 separate call sites across the app
                  (HomeDashboard, Schedule, Alerts, AccessHistory,
                  NotificationsScreen, PatientList, PatientSearch,
                  ScanModal x2) navigate to "/patient/:id" (singular) —
                  a route that never existed. Every one of those links
                  was dead, silently redirecting to "/" via the
                  catch-all route. Added as an alias to the same page
                  rather than rewriting 9 files. */}
              <Route
                path="/patient/:id"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <PatientDetailView />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />

              {/* NEW (item #10): Monthly roster — shift CRUD + holiday
                  calendar, ties into approved leave automatically. */}
              <Route
                path="/roster"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <RosterScreen />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />

              {/* ── FIX 1: PatientSearch route ───────────────────
                  File exists at pages/PatientSearch.jsx but had
                  zero Route entry — was completely unreachable.
                  Now accessible via sidebar search or /patients/search */}
              <Route
                path="/patients/search"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <PatientSearch />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/queue"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <QueueScreen />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              {/* FIX: only "/prescription" (no param) was registered, but
                  PrescriptionBuilder.jsx reads useParams().patientId, and
                  PatientList.jsx navigates to "/prescriptions/:hospynId"
                  (plural + param) — neither matched. Registered both the
                  bare route (Quick Action from HomeDashboard, walks in
                  without a pre-selected patient) and the patient-specific
                  route actually used by PatientList. */}
              <Route
                path="/prescription"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <PrescriptionBuilder />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prescriptions/:patientId"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <PrescriptionBuilder />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schedule"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Schedule />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Analytics />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/earnings"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <EarningsDashboard />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leave"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <LeaveManagement />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Alerts />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/access-history"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <AccessHistory />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <NotificationsScreen />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <AuthenticatedLayout>
                      <Settings />
                    </AuthenticatedLayout>
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </ErrorBoundary>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
