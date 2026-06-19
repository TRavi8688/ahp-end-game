/**
 * App.jsx
 * Phase 5 Fix: HR Portal — Main App with routing
 *
 * APPLY TO: hr-portal/src/App.jsx  (REPLACE the existing empty file)
 *
 * Install dependency first:
 *   npm install react-router-dom
 */
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import StaffList from "./pages/StaffList";
import ErrorBoundary from "./components/ErrorBoundary";

function Layout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={{ fontSize: "20px" }}>🏥</span>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>Hospyn HR</span>
        </div>
        <nav style={styles.nav}>
          <NavLink to="/staff" style={navStyle}>
            👥 Staff Directory
          </NavLink>
          <NavLink to="/shifts" style={navStyle}>
            📅 Shift Roster
          </NavLink>
          <NavLink to="/leave" style={navStyle}>
            🏖️ Leave Management
          </NavLink>
          <NavLink to="/payroll" style={navStyle}>
            💰 Payroll
          </NavLink>
          <NavLink to="/attendance" style={navStyle}>
            ✅ Attendance
          </NavLink>
        </nav>
      </aside>

      {/* Main content */}
      <main style={styles.main}>{children}</main>
    </div>
  );
}

// Placeholder for unbuilt pages
function ComingSoon({ title }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <h2 style={{ color: "#374151" }}>{title}</h2>
      <p>This page is under construction. See Phase 9+ in the audit roadmap.</p>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/staff" replace />} />
            <Route path="/staff" element={<StaffList />} />
            <Route path="/shifts" element={<ComingSoon title="Shift Roster" />} />
            <Route path="/leave" element={<ComingSoon title="Leave Management" />} />
            <Route path="/payroll" element={<ComingSoon title="Payroll" />} />
            <Route path="/attendance" element={<ComingSoon title="Attendance Tracking" />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

const navStyle = ({ isActive }) => ({
  display: "block",
  padding: "10px 16px",
  borderRadius: "8px",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: isActive ? 600 : 400,
  background: isActive ? "#eff6ff" : "transparent",
  color: isActive ? "#1d4ed8" : "#374151",
  marginBottom: "4px",
});

const styles = {
  sidebar: { width: 220, background: "#f9fafb", borderRight: "1px solid #e5e7eb", padding: "20px 12px", flexShrink: 0 },
  logo: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", padding: "0 4px", color: "#111827" },
  nav: { display: "flex", flexDirection: "column" },
  main: { flex: 1, overflowY: "auto" },
};
