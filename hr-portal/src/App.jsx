/**
 * App.jsx  (REPLACE hr-portal/src/App.jsx)
 * Phase 3 Fix: HR Portal — Main App with routing and all 3 MVP pages
 *
 * Install dependency first:
 *   npm install react-router-dom
 *
 * File structure needed:
 *   hr-portal/src/App.jsx                  ← this file
 *   hr-portal/src/components/ErrorBoundary.jsx
 *   hr-portal/src/pages/StaffList.jsx      ← from phase 4-8 package
 *   hr-portal/src/pages/ShiftRoster.jsx    ← see below (create separately)
 *   hr-portal/src/pages/LeaveManagement.jsx ← see below
 */

import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useState } from "react";
import StaffList from "./pages/StaffList";
import ShiftRoster from "./pages/ShiftRoster";
import LeaveManagement from "./pages/LeaveManagement";
import ErrorBoundary from "./components/ErrorBoundary";

// ── Layout ──────────────────────────────────────────────────────────────
function Layout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={{ fontSize: "20px" }}>🏥</span>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>Hospyn HR</span>
        </div>
        <nav style={styles.nav}>
          <NavLink to="/staff" style={navStyle}>👥 Staff Directory</NavLink>
          <NavLink to="/shifts" style={navStyle}>📅 Shift Roster</NavLink>
          <NavLink to="/leave" style={navStyle}>🏖️ Leave Requests</NavLink>
          <NavLink to="/payroll" style={navStyle}>💰 Payroll</NavLink>
          <NavLink to="/attendance" style={navStyle}>✅ Attendance</NavLink>
        </nav>
        <div style={styles.sidebarFooter}>
          <button
            style={styles.logoutBtn}
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/login";
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

// ── Placeholder pages (Phase 9+) ─────────────────────────────────────────
function ComingSoon({ title }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <h2 style={{ color: "#374151" }}>{title}</h2>
      <p>This page is under construction. See Phase 9+ in the audit roadmap.</p>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/staff" replace />} />
            <Route path="/staff" element={<StaffList />} />
            <Route path="/shifts" element={<ShiftRoster />} />
            <Route path="/leave" element={<LeaveManagement />} />
            <Route path="/payroll" element={<ComingSoon title="Payroll Management" />} />
            <Route path="/attendance" element={<ComingSoon title="Attendance Tracker" />} />
            <Route path="*" element={<Navigate to="/staff" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const styles = {
  sidebar: {
    width: 220,
    background: "#1e3a5f",
    color: "white",
    display: "flex",
    flexDirection: "column",
    padding: "16px 0",
    flexShrink: 0,
    minHeight: "100vh",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 16px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    marginBottom: 8,
    color: "white",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    padding: "8px 0",
  },
  sidebarFooter: {
    padding: "12px 16px",
    borderTop: "1px solid rgba(255,255,255,0.1)",
  },
  logoutBtn: {
    width: "100%",
    background: "rgba(255,255,255,0.1)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 6,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 13,
  },
  main: {
    flex: 1,
    background: "#f9fafb",
    overflow: "auto",
  },
};

const navStyle = ({ isActive }) => ({
  display: "block",
  padding: "10px 16px",
  color: isActive ? "white" : "rgba(255,255,255,0.7)",
  background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
  textDecoration: "none",
  fontSize: 14,
  borderLeft: isActive ? "3px solid #60a5fa" : "3px solid transparent",
  transition: "all 0.15s",
});
