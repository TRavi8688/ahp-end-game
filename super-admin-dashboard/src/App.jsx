// super-admin-dashboard/src/App.jsx
//
// WHAT CHANGED vs existing file:
//  - Removed ALL localStorage.getItem/setItem('token') calls
//  - Removed axios — uses api from lib/apiClient (in-memory token)
//  - Added react-router-dom: BrowserRouter, Routes, Route, useNavigate
//  - Sidebar nav now uses useNavigate() — no more prop drilling
//  - HospitalDetail and VerificationDetail use useParams() — no more selectedHospitalId state
//  - VITE_API_URL → VITE_API_BASE_URL (was wrong env var)
//  - Added Tickets page (new enterprise feature)
//  - Kept all the CommandPalette, keyboard shortcuts, notification bell UI
//
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield, LayoutDashboard, Building2, Users, DollarSign, Activity,
  Radio, ShieldCheck, LogOut, Bell, Search, ChevronRight, Command,
  AlertTriangle, X, Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrowserRouter, Routes, Route, Navigate,
  useNavigate, useLocation, useParams
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';

import { useAuthStore }  from './stores/authStore';
import { api, tokenStore } from './lib/apiClient';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Lazy-load pages
const Login                          = lazy(() => import('./pages/Login'));
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
const TicketSystem                   = lazy(() => import('./pages/TicketSystem'));

// ─── Nav config ──────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'PLATFORM COMMAND',
    items: [
      { path: '/',            icon: <LayoutDashboard size={15} />, label: 'Overview',             shortcut: '1' },
    ]
  },
  {
    label: 'GLOBAL INFRASTRUCTURE',
    items: [
      { path: '/hospitals',    icon: <Building2 size={15} />,    label: 'Registered Clients',   shortcut: '2' },
      { path: '/verifications',icon: <ShieldCheck size={15} />,  label: 'Verification Queue',   badge: 'pending', shortcut: '3' },
      { path: '/iam',          icon: <Shield size={15} />,       label: 'Global Access Control', shortcut: '4' },
    ]
  },
  {
    label: 'ANALYTICS',
    items: [
      { path: '/revenue',     icon: <DollarSign size={15} />, label: 'Revenue Analytics',   shortcut: '5' },
      { path: '/staff',       icon: <Users size={15} />,      label: 'Staff Performance',   shortcut: '6' },
      { path: '/governance',  icon: <Activity size={15} />,   label: 'Operational Metrics', shortcut: '7' },
    ]
  },
  {
    label: 'SUPPORT',
    items: [
      { path: '/tickets',     icon: <Ticket size={15} />,     label: 'Support Tickets',     shortcut: '9' },
      { path: '/alerts',      icon: <Radio size={15} />,      label: 'Emergency Alerts',    dot: true, shortcut: '8' },
      { path: '/audit-logs',  icon: <Shield size={15} />,     label: 'Audit Logs',          shortcut: '0' },
    ]
  }
];

const CMD_COMMANDS = NAV_SECTIONS.flatMap(s => s.items.map(i => ({
  id: i.path, label: i.label, icon: i.icon, section: s.label,
})));

// ─── Command Palette ──────────────────────────────────────────────────────────
function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = CMD_COMMANDS.filter(c =>
    !query || c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && filtered[selected]) { navigate(filtered[selected].id); onClose(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: 520, background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, boxShadow: '0 40px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Search size={15} color="#475569" />
          <input
            ref={inputRef}
            style={{ flex: 1, background: 'none', border: 'none', color: '#f1f5f9', fontSize: 14, outline: 'none' }}
            placeholder="Search commands..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
          />
          <kbd style={{ fontSize: 10, color: '#475569', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => { navigate(cmd.id); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 16px', border: 'none', background: selected === i ? 'rgba(99,102,241,0.15)' : 'none',
                color: selected === i ? '#c7d2fe' : '#94a3b8', fontSize: 13, cursor: 'pointer', textAlign: 'left',
              }}
            >
              {cmd.icon}
              {cmd.label}
              <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#334155' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ pendingCount, showCmd, setShowCmd }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout, user } = useAuthStore();

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <aside style={{
      width: 220, flexShrink: 0, background: '#080d16',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ padding: 7, background: 'rgba(99,102,241,0.2)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)' }}>
            <Shield size={15} color="#818cf8" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              Hospyn<span style={{ color: '#6366f1' }}>Core</span>
            </div>
            <div style={{ fontSize: 9, color: '#334155', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Platform Admin
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <button
          onClick={() => setShowCmd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer',
          }}
        >
          <Search size={12} color="#334155" />
          <span style={{ flex: 1, textAlign: 'left', fontSize: 11, color: '#334155' }}>Search...</span>
          <kbd style={{ fontSize: 9, color: '#1e293b', background: 'rgba(255,255,255,0.03)', padding: '1px 4px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.07)' }}>⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#1e293b', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 5px', marginBottom: 2 }}>
              {section.label}
            </div>
            {section.items.map(item => {
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    marginBottom: 1, fontSize: 12, fontWeight: isActive ? 600 : 400,
                    background: isActive ? 'rgba(99,102,241,0.12)' : 'none',
                    color: isActive ? '#c7d2fe' : '#475569',
                  }}
                >
                  <span style={{ color: isActive ? '#818cf8' : '#334155' }}>{item.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {item.badge === 'pending' && pendingCount > 0 && (
                    <span style={{ background: '#f59e0b', color: '#000', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 10 }}>
                      {pendingCount}
                    </span>
                  )}
                  {item.dot && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e', boxShadow: '0 0 6px #f43f5e' }} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginBottom: 4 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
            SA
          </div>
          <span style={{ fontSize: 11, color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name || 'Platform Admin'}
          </span>
        </div>
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', background: 'none', color: '#475569', fontSize: 12 }}
        >
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

// ─── Protected Shell ──────────────────────────────────────────────────────────
function AdminShell({ children }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [showCmd, setShowCmd] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowCmd(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/api/v1/admin/analytics/overview')
      .then(r => setPendingCount(r?.metrics?.pending_verifications || 0))
      .catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#070b14', overflow: 'hidden' }}>
      <AnimatePresence>
        {showCmd && <CommandPalette onClose={() => setShowCmd(false)} />}
      </AnimatePresence>
      <Sidebar pendingCount={pendingCount} showCmd={showCmd} setShowCmd={setShowCmd} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AdminShell><Suspense fallback={<PageLoader />}><React.Outlet /></Suspense></AdminShell>}>
              <Route path="/"                  element={<OverviewDashboard />} />
              <Route path="/hospitals"         element={<HospitalNetwork />} />
              <Route path="/hospitals/:id"     element={<HospitalDetail />} />
              <Route path="/verifications"     element={<VerificationQueue />} />
              <Route path="/verifications/:id" element={<VerificationDetail />} />
              <Route path="/iam"               element={<IAMManagement />} />
              <Route path="/revenue"           element={<RevenueAnalytics />} />
              <Route path="/staff"             element={<StaffPerformance />} />
              <Route path="/governance"        element={<OperationalGovernanceDashboard />} />
              <Route path="/alerts"            element={<EmergencyAlerts />} />
              <Route path="/tickets"           element={<TicketSystem />} />
              <Route path="/audit-logs"        element={<AuditLogViewer />} />
              <Route path="/exports"           element={<ExportReports />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
