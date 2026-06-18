import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV = [
  { to: "/reception/checkin", icon: "👤", label: "Check In Patient" },
  { to: "/reception/queue", icon: "📋", label: "Live Queue Board" },
  { to: "/reception/appointments", icon: "📅", label: "Today's Appointments" },
  { to: "/reception/billing", icon: "💳", label: "Patient Billing" },
];

const ReceptionLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <nav style={s.sidebar}>
        <div style={s.brand}>
          <span style={s.brandName}>Hospyn</span>
          <span style={s.brandRole}>Reception</span>
        </div>

        <div style={s.navLinks}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                ...s.navLink,
                background: isActive ? "#eff6ff" : "transparent",
                color: isActive ? "#1d4ed8" : "#374151",
                fontWeight: isActive ? 600 : 400,
                borderLeft: `3px solid ${isActive ? "#1d4ed8" : "transparent"}`,
              })}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <div style={s.sidebarFooter}>
          {user && (
            <div style={s.userInfo}>
              <div style={s.userAvatar}>{user.name?.charAt(0) || "S"}</div>
              <div style={s.userDetails}>
                <div style={s.userName}>{user.name}</div>
                <div style={s.userRole}>{user.role}</div>
              </div>
            </div>
          )}
          <button style={s.logoutBtn} onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      {/* Main content */}
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  );
};

const s = {
  shell: { display: "flex", minHeight: "100vh", background: "#f9fafb" },
  sidebar: {
    width: 230, background: "#fff", borderRight: "1px solid #e5e7eb",
    display: "flex", flexDirection: "column", padding: "20px 0",
    position: "sticky", top: 0, height: "100vh", flexShrink: 0,
  },
  brand: {
    padding: "0 20px 20px",
    borderBottom: "1px solid #f3f4f6",
    display: "flex", alignItems: "baseline", gap: 6,
  },
  brandName: { fontSize: 20, fontWeight: 800, color: "#1d4ed8" },
  brandRole: {
    fontSize: 10, fontWeight: 700, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  navLinks: { flex: 1, padding: "16px 0", display: "flex", flexDirection: "column", gap: 2 },
  navLink: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 20px", borderRadius: "0 8px 8px 0",
    fontSize: 14, textDecoration: "none", transition: "all 0.15s",
    marginRight: 12,
  },
  sidebarFooter: { padding: "0 16px", borderTop: "1px solid #f3f4f6", paddingTop: 16 },
  userInfo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  userAvatar: {
    width: 34, height: 34, borderRadius: "50%",
    background: "#dbeafe", color: "#1d4ed8",
    fontSize: 15, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  userDetails: {},
  userName: { fontSize: 13, fontWeight: 600, color: "#111827" },
  userRole: { fontSize: 11, color: "#6b7280", textTransform: "capitalize" },
  logoutBtn: {
    width: "100%", padding: "8px",
    border: "1.5px solid #e5e7eb", borderRadius: 7,
    background: "#fff", cursor: "pointer", fontSize: 13, color: "#6b7280",
  },
  main: { flex: 1, overflowY: "auto" },
};

export default ReceptionLayout;
