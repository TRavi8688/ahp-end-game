// super-admin-dashboard/src/components/Layout.jsx
// FIXED: New file — provides sidebar + topbar shell for all admin pages.
// All protected routes are wrapped in this by App.jsx.

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  LayoutDashboard, Building2, Users, DollarSign, ShieldCheck,
  Activity, Radio, Shield, Download, ClipboardList, LogOut,
  ChevronRight
} from 'lucide-react';

const NAV = [
  { path: '/',             label: 'Overview',        icon: LayoutDashboard },
  { path: '/hospitals',    label: 'Hospital Network', icon: Building2 },
  { path: '/verifications',label: 'Verification Queue',icon: ShieldCheck },
  { path: '/iam',          label: 'IAM / Access',    icon: Shield },
  { path: '/staff',        label: 'Staff Performance',icon: Users },
  { path: '/revenue',      label: 'Revenue Analytics',icon: DollarSign },
  { path: '/governance',   label: 'Operational Metrics',icon: Activity },
  { path: '/alerts',       label: 'Emergency Alerts', icon: Radio },
  { path: '/audit-logs',   label: 'Audit Logs',       icon: ClipboardList },
  { path: '/exports',      label: 'Export Reports',   icon: Download },
];

export default function Layout({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: 232,
        flexShrink: 0,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: 'white', fontSize: 14,
          }}>H</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Hospyn</div>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Super Admin</div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {NAV.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`nav-item${isActive ? ' active' : ''}`}
                style={{ marginBottom: 2 }}
              >
                <Icon size={15} />
                <span style={{ flex: 1 }}>{label}</span>
                {isActive && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
              </button>
            );
          })}
        </nav>

        {/* User + logout */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.04)',
          padding: '12px 8px',
        }}>
          {user && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', marginBottom: 4,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(99,102,241,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#818cf8', fontWeight: 700, fontSize: 12, flexShrink: 0,
              }}>
                {String(user.phone || user.email || 'A')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', truncate: true }}>
                  {user.name || 'Super Admin'}
                </div>
                <div style={{ fontSize: 10, color: '#475569' }}>super_admin</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="nav-item"
            style={{ color: '#f43f5e', width: '100%' }}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>
        {children}
      </main>
    </div>
  );
}
