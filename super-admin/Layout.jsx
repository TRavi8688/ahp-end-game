import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const NAV_ITEMS = [
  { path: '/dashboard',   icon: '⊞',  label: 'Dashboard' },
  { path: '/hospitals',   icon: '🏥',  label: 'Hospitals' },
  { path: '/staff',       icon: '👥',  label: 'Staff' },
  { path: '/billing',     icon: '💳',  label: 'Billing' },
  { path: '/analytics',   icon: '📊',  label: 'Analytics' },
  { path: '/compliance',  icon: '🛡',  label: 'Compliance' },
  { path: '/audit-log',   icon: '📋',  label: 'Audit Log' },
  { path: '/settings',    icon: '⚙',  label: 'Settings' },
];

// Existing pages that already have their own sidebar
const EXISTING_NAV_EXTRAS = [
  { path: '/hospital-network',  icon: '🌐', label: 'Network' },
  { path: '/verification',      icon: '✅', label: 'Verification' },
  { path: '/emergency-alerts',  icon: '🚨', label: 'Alerts' },
  { path: '/iam',               icon: '🔑', label: 'IAM' },
  { path: '/governance',        icon: '⚖',  label: 'Governance' },
];

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#020617',
      fontFamily: "'DM Sans', 'Syne', sans-serif",
      color: '#f1f5f9',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? '64px' : '220px',
        minHeight: '100vh',
        background: 'rgba(255,255,255,0.02)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>
        {/* Logo / Brand */}
        <div style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          justifyContent: collapsed ? 'center' : 'space-between',
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '32px', height: '32px',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: '800',
              }}>H</div>
              <span style={{ fontWeight: '700', fontSize: '1rem', letterSpacing: '-0.3px' }}>Hospyn</span>
            </div>
          )}
          {collapsed && (
            <div style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '800',
            }}>H</div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: '1rem', padding: '2px',
              display: collapsed ? 'none' : 'block',
            }}
          >
            ◀
          </button>
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div style={{ padding: '0.75rem 1rem' }}>
            <div style={{
              background: 'rgba(14,165,233,0.1)',
              border: '1px solid rgba(14,165,233,0.2)',
              borderRadius: '0.4rem',
              padding: '0.35rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: '700',
              color: '#0ea5e9',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              ◈ Super Admin
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem 0.5rem' }}>
          <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.5rem 0.5rem 0.25rem', display: collapsed ? 'none' : 'block' }}>
            Main
          </div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: collapsed ? '0.65rem 0' : '0.65rem 0.75rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: '0.5rem',
                marginBottom: '2px',
                textDecoration: 'none',
                color: isActive ? '#f1f5f9' : '#64748b',
                background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                fontWeight: isActive ? '600' : '400',
                fontSize: '0.875rem',
                transition: 'all 0.15s',
                borderLeft: isActive ? '2px solid #0ea5e9' : '2px solid transparent',
              })}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.75rem 0.5rem' }} />

          <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.5rem 0.5rem 0.25rem', display: collapsed ? 'none' : 'block' }}>
            Operations
          </div>
          {EXISTING_NAV_EXTRAS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: collapsed ? '0.65rem 0' : '0.65rem 0.75rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: '0.5rem',
                marginBottom: '2px',
                textDecoration: 'none',
                color: isActive ? '#f1f5f9' : '#64748b',
                background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                fontWeight: isActive ? '600' : '400',
                fontSize: '0.875rem',
                transition: 'all 0.15s',
                borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
              })}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{
          padding: collapsed ? '1rem 0.5rem' : '1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {!collapsed && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#e2e8f0' }}>
                {user?.name || 'Super Admin'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {user?.email || ''}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#ef4444',
              borderRadius: '0.5rem',
              padding: '0.5rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            {collapsed ? '⇥' : '⇥ Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: '56px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          background: 'rgba(2,6,23,0.8)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0,
        }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: '1.1rem', padding: '4px',
            }}
          >
            ☰
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Notification bell */}
            <button style={{
              background: 'none', border: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: '1.1rem', position: 'relative', padding: '4px',
            }}>
              🔔
              <span style={{
                position: 'absolute', top: 0, right: 0,
                width: '8px', height: '8px',
                background: '#ef4444', borderRadius: '50%',
                border: '2px solid #020617',
              }} />
            </button>

            {/* Avatar */}
            <div style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: '700', color: '#fff',
            }}>
              {(user?.name || 'SA').substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
