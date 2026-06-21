import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield, LayoutDashboard, Building2, Users, DollarSign, Activity,
  Radio, ShieldCheck, LogOut, Bell, Search, ChevronRight, Command,
  Globe, Zap, Settings, HelpCircle, AlertTriangle, X, Moon,
  Database, Terminal, TrendingUp, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

import Login from './pages/Login';
import OverviewDashboard from './pages/OverviewDashboard';
import HospitalNetwork from './pages/HospitalNetwork';
import HospitalDetail from './pages/HospitalDetail';
import RevenueAnalytics from './pages/RevenueAnalytics';
import StaffPerformance from './pages/StaffPerformance';
import EmergencyAlerts from './pages/EmergencyAlerts';
import IAMManagement from './pages/IAMManagement';
import VerificationQueue from './pages/VerificationQueue';
import VerificationDetail from './pages/VerificationDetail';
import OperationalGovernanceDashboard from './pages/OperationalGovernanceDashboard';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Nav structure — mirrors AWS Console sidebar hierarchy
const NAV_SECTIONS = [
  {
    label: 'PLATFORM COMMAND',
    items: [
      { id: 'overview', icon: <LayoutDashboard size={15} />, label: 'Overview', shortcut: '1' },
    ]
  },
  {
    label: 'GLOBAL INFRASTRUCTURE',
    items: [
      { id: 'hospitals', icon: <Building2 size={15} />, label: 'Registered Clients', shortcut: '2' },
      { id: 'verification', icon: <ShieldCheck size={15} />, label: 'Verification Queue', badge: 'pending', shortcut: '3' },
      { id: 'iam', icon: <Shield size={15} />, label: 'Global Access Control', shortcut: '4' },
    ]
  },
  {
    label: 'ANALYTICS',
    items: [
      { id: 'revenue', icon: <DollarSign size={15} />, label: 'Revenue Analytics', shortcut: '5' },
      { id: 'staff', icon: <UserCheck size={15} />, label: 'Staff Performance', shortcut: '6' },
      { id: 'operational', icon: <Activity size={15} />, label: 'Operational Metrics', shortcut: '7' },
    ]
  },
  {
    label: 'SECURITY',
    items: [
      { id: 'alerts', icon: <Radio size={15} />, label: 'Emergency Alerts', dot: true, shortcut: '8' },
    ]
  }
];

// Command palette commands
const CMD_COMMANDS = [
  { id: 'overview', label: 'Go to Overview', icon: <LayoutDashboard size={14} />, section: 'Navigation' },
  { id: 'hospitals', label: 'Registered Clients', icon: <Building2 size={14} />, section: 'Navigation' },
  { id: 'verification', label: 'Verification Queue', icon: <ShieldCheck size={14} />, section: 'Navigation' },
  { id: 'iam', label: 'Global Access Control', icon: <Shield size={14} />, section: 'Navigation' },
  { id: 'revenue', label: 'Revenue Analytics', icon: <DollarSign size={14} />, section: 'Navigation' },
  { id: 'staff', label: 'Staff Performance', icon: <UserCheck size={14} />, section: 'Navigation' },
  { id: 'alerts', label: 'Emergency Alerts', icon: <Radio size={14} />, section: 'Navigation' },
  { id: 'operational', label: 'Operational Metrics', icon: <Activity size={14} />, section: 'Navigation' },
];

function CommandPalette({ onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = CMD_COMMANDS.filter(c =>
    !query || c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && filtered[selected]) { onNavigate(filtered[selected].id); onClose(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="cmd-bar" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cmd-bar-inner">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <Search size={16} className="text-slate-500" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-600"
            placeholder="Search commands, pages, actions..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="text-xs text-slate-600 bg-white/[0.04] px-2 py-0.5 rounded border border-white/8">ESC</kbd>
        </div>
        <div className="overflow-y-auto max-h-80 py-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-sm">No commands found</div>
          ) : (
            <>
              <div className="px-4 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Navigation</div>
              {filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={() => { onNavigate(cmd.id); onClose(); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                    selected === i ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className={selected === i ? 'text-indigo-400' : 'text-slate-600'}>{cmd.icon}</span>
                  {cmd.label}
                  <ChevronRight size={12} className="ml-auto text-slate-700" />
                </button>
              ))}
            </>
          )}
        </div>
        <div className="px-4 py-2 border-t border-white/8 flex items-center gap-4 text-xs text-slate-700">
          <span className="flex items-center gap-1"><kbd className="bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/8">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/8">↵</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/8">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [showCmd, setShowCmd] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [userInfo, setUserInfo] = useState({ name: 'Super Admin', email: '' });
  const [notifOpen, setNotifOpen] = useState(false);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCmd(v => !v);
      }
      // Number shortcuts
      if (!showCmd && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const shortcuts = { '1': 'overview', '2': 'hospitals', '3': 'verification', '4': 'iam', '5': 'revenue', '6': 'staff', '7': 'operational', '8': 'alerts' };
        if (shortcuts[e.key] && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          setView(shortcuts[e.key]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showCmd]);

  // Fetch pending count for badge
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('token');
    axios.get(`${API_BASE}/analytics/overview`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setPendingCount(r.data?.metrics?.pending_verifications || 0))
      .catch(() => {});
  }, [isAuthenticated]);

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_id');
    setIsAuthenticated(false);
  };

  const navigate = useCallback((id) => {
    setView(id);
    setSelectedHospitalId(null);
  }, []);

  const handleViewHospital = (id) => {
    setSelectedHospitalId(id);
    setView('hospital-detail');
  };

  if (!isAuthenticated) return <Login onLoginSuccess={handleLogin} />;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#070b14', overflow: 'hidden' }}>
      {/* Command Palette */}
      <AnimatePresence>
        {showCmd && <CommandPalette onNavigate={navigate} onClose={() => setShowCmd(false)} />}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="sidebar flex flex-col" style={{
        background: '#080d16',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        zIndex: 10
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 7, background: 'rgba(99,102,241,0.2)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)' }}>
              <Shield size={16} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                Hospyn<span style={{ color: '#6366f1' }}>Core</span>
              </div>
              <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Platform Admin
              </div>
            </div>
          </div>
        </div>

        {/* Command Search */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <button
            onClick={() => setShowCmd(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
          >
            <Search size={13} color="#334155" />
            <span style={{ flex: 1, textAlign: 'left', fontSize: 12, color: '#334155' }}>Search...</span>
            <kbd style={{ fontSize: 10, color: '#1e293b', background: 'rgba(255,255,255,0.03)', padding: '1px 5px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'monospace' }}>⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1e293b', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 6px', marginBottom: 2 }}>
                {section.label}
              </div>
              {section.items.map(item => {
                const isActive = view === item.id || (item.id === 'verification' && view === 'detail');
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    style={{ position: 'relative' }}
                  >
                    {item.icon}
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge === 'pending' && pendingCount > 0 && (
                      <span style={{
                        background: '#f59e0b', color: '#000', fontSize: 9, fontWeight: 800,
                        padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center'
                      }}>{pendingCount}</span>
                    )}
                    {item.dot && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e', boxShadow: '0 0 6px #f43f5e' }} />
                    )}
                    {item.shortcut && !isActive && (
                      <kbd style={{ fontSize: 9, color: '#1e293b', background: 'rgba(255,255,255,0.03)', padding: '1px 4px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'monospace' }}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* System Status */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span className="pulse-green" />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Systems Online</span>
            </div>
            <div style={{ fontSize: 10, color: '#0f4c35' }}>99.98% uptime · v2.0</div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-item"
            style={{ color: '#475569' }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Bar */}
        <header style={{
          height: 52,
          background: 'rgba(8,13,22,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          flexShrink: 0,
          position: 'relative',
          zIndex: 5
        }}>
          {/* Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: '#1e293b' }}>HospynCore</span>
            <ChevronRight size={12} color="#1e293b" />
            <span style={{ color: '#64748b', fontWeight: 500 }}>
              {{
                overview: 'Overview',
                hospitals: 'Registered Clients',
                'hospital-detail': 'Hospital Detail',
                verification: 'Verification Queue',
                detail: 'Verification Detail',
                iam: 'Global Access Control',
                revenue: 'Revenue Analytics',
                staff: 'Staff Performance',
                operational: 'Operational Metrics',
                alerts: 'Emergency Alerts',
              }[view] || view}
            </span>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setShowCmd(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 7, cursor: 'pointer', color: '#475569', fontSize: 12
              }}
            >
              <Command size={13} />
              <span>Command</span>
              <kbd style={{ fontSize: 10, color: '#1e293b', marginLeft: 2 }}>⌘K</kbd>
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                style={{ padding: 7, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#475569' }}
              >
                <Bell size={15} />
                {pendingCount > 0 && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: '#f43f5e', borderRadius: '50%', border: '1.5px solid #080d16' }} />
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    style={{
                      position: 'absolute', right: 0, top: '110%', width: 300,
                      background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 50, overflow: 'hidden'
                    }}
                  >
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Notifications</span>
                      <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                    <div style={{ padding: 12 }}>
                      {pendingCount > 0 ? (
                        <button
                          onClick={() => { navigate('verification'); setNotifOpen(false); }}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', width: '100%', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <AlertTriangle size={15} color="#f59e0b" style={{ marginTop: 1, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>{pendingCount} Hospital{pendingCount !== 1 ? 's' : ''} Awaiting Verification</div>
                            <div style={{ fontSize: 11, color: '#78350f', marginTop: 2 }}>Click to open verification queue</div>
                          </div>
                        </button>
                      ) : (
                        <div style={{ padding: 16, textAlign: 'center', color: '#334155', fontSize: 12 }}>No new notifications</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white' }}>
                SA
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Platform Admin</span>
            </div>
          </div>
          <div className="header-glow-line" />
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
            >
              {view === 'overview' && <OverviewDashboard onNavigate={navigate} />}
              {view === 'hospitals' && <HospitalNetwork onViewHospital={handleViewHospital} />}
              {view === 'hospital-detail' && <HospitalDetail hospitalId={selectedHospitalId} onBack={() => setView('hospitals')} />}
              {view === 'verification' && <VerificationQueue onSelect={id => { setSelectedHospitalId(id); setView('detail'); }} />}
              {view === 'detail' && <VerificationDetail hospitalId={selectedHospitalId} onBack={() => setView('verification')} />}
              {view === 'iam' && <IAMManagement />}
              {view === 'revenue' && <RevenueAnalytics />}
              {view === 'staff' && <StaffPerformance />}
              {view === 'operational' && <OperationalGovernanceDashboard />}
              {view === 'alerts' && <EmergencyAlerts />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
