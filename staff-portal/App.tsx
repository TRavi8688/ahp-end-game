// App.tsx — COMPLETE UPDATED VERSION
// Changes from current version:
//   1. Added <Route path="/settings"> with Settings page
//   2. All imports now use correct Dashboard/ subdirectory paths
//   3. Removed stale imports (LoginPage.jsx etc.)
//
// HOW TO USE:
//   Replace your existing src/App.tsx with this file entirely.
//   Adjust any import paths that differ in your project structure.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

import AuthContext from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

// ── Auth ────────────────────────────────────────────────────
const Login = lazy(() => import("./pages/Login"));

// ── Dashboards ──────────────────────────────────────────────
const AdminDashboard      = lazy(() => import("./pages/Dashboard/AdminDashboard"));
const DoctorDashboard     = lazy(() => import("./pages/Dashboard/DoctorDashboard"));
const NurseDashboard      = lazy(() => import("./pages/Dashboard/NurseDashboard"));
const OwnerDashboard      = lazy(() => import("./pages/Dashboard/OwnerDashboard"));
const PharmacyDashboard   = lazy(() => import("./pages/Dashboard/PharmacyDashboard"));
const LabDashboard        = lazy(() => import("./pages/Dashboard/LabDashboard"));
const ReceptionDashboard  = lazy(() => import("./pages/Reception/CheckInPage"));

// ── HR sub-pages ──────────────────────────────────────────────
const HRDashboard         = lazy(() => import("./pages/HR/HRDashboard"));

// ── Reception sub-pages ──────────────────────────────────────
const TodaysAppointmentsPage = lazy(() => import("./pages/Reception/TodaysAppointmentsPage"));
const BillingPage            = lazy(() => import("./pages/Reception/BillingPage"));
const WalkInPage             = lazy(() => import("./pages/WalkInPage"));

// ── Settings (NEW — was missing) ────────────────────────────
const Settings = lazy(() => import("./pages/Settings"));

// ── Fallback loader ──────────────────────────────────────────
function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#060a14",
        color: "rgba(255,255,255,0.3)",
        fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <AuthContext>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Walk-in join (public — arrived via QR) */}
            <Route path="/join/:signedToken" element={<WalkInPage />} />

            {/* Protected routes wrapped in shared Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Default redirect */}
              <Route index element={<Navigate to="/reception" replace />} />

              {/* Role dashboards */}
              <Route path="/admin"      element={<ProtectedRoute roles={["admin"]}}>      <AdminDashboard />     </ProtectedRoute>} />
              <Route path="/doctor"     element={<ProtectedRoute roles={["doctor"]}>      <DoctorDashboard />    </ProtectedRoute>} />
              <Route path="/nurse"      element={<ProtectedRoute roles={["nurse"]}>       <NurseDashboard />     </ProtectedRoute>} />
              <Route path="/owner"      element={<ProtectedRoute roles={["owner"]}>       <OwnerDashboard />     </ProtectedRoute>} />
              <Route path="/pharmacy"   element={<ProtectedRoute roles={["pharmacist"]}>  <PharmacyDashboard />  </ProtectedRoute>} />
              <Route path="/lab"        element={<ProtectedRoute roles={["lab_tech"]}>    <LabDashboard />       </ProtectedRoute>} />
              <Route path="/reception"  element={<ProtectedRoute roles={["receptionist", "admin"]}> <ReceptionDashboard /> </ProtectedRoute>} />
              <Route path="/hr"         element={<ProtectedRoute roles={["hr", "admin", "owner"]}> <HRDashboard /> </ProtectedRoute>} />

              {/* Reception sub-pages */}
              <Route path="/reception/appointments" element={<TodaysAppointmentsPage />} />
              <Route path="/reception/billing"      element={<BillingPage />} />

              {/* Settings — previously missing, now wired */}
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/reception" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthContext>
  );
}
