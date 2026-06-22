/**
 * src/components/Layout.jsx — Hospain Matrix 3.0
 *
 * FIXES:
 *  1. "Hospain" → "Hospain" everywhere
 *  2. Hospain logo shown in sidebar
 *  3. "Care Beyond Today" tagline
 *  4. Employee role + name shown correctly in footer
 *  5. All Matrix 3.0 nav modules included
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  LayoutDashboard, Building2, Users, DollarSign, ShieldCheck,
  Activity, Radio, Shield, Download, ClipboardList, LogOut,
  ChevronRight, Satellite, Ticket, Zap, Scale, Clock, GitBranch,
  Siren, ShieldAlert, BarChart3, Cpu, FlaskConical, Brain,
  Pill, ChevronLeft,
} from 'lucide-react';
import { useState } from 'react';
import hospainLogo from '../assets/hospain-logo.png';

// ─── Role display labels ──────────────────────────────────────────────────────
const ROLE_LABELS = {
  super_admin:   'Super Admin',
  admin:         'Admin',
  manager:       'Operations Manager',
  team_lead:     'Team Lead',
  l1:            'L1 Support Agent',
  l2:            'L2 Agent',
  support:       'Support Team',
  finance:       'Finance Team',
  engineering:   'Engineering',
  onboarding:    'Onboarding Team',
  data:          'Data Team',
  verification:  'Verification Team',
  employee:      'Employee',
};

// ─── Navigation groups ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    group: 'COMMAND',
    items: [
      { path: '/matrix/mission',    label: 'Mission Control',     icon: Satellite },
      { path: '/matrix/boardroom',  label: 'Executive Boardroom', icon: BarChart3 },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { path: '/matrix/support',    label: 'Support Matrix',      icon: Ticket },
      { path: '/matrix/assignment', label: 'Auto-Assignment',     icon: Zap },
      { path: '/matrix/workload',   label: 'Workload Balancer',   icon: Scale },
      { path: '/matrix/sla',        label: 'SLA Engine',          icon: Clock },
      { path: '/matrix/escalation', label: 'Escalation Engine',   icon: GitBranch },
    ],
  },
  {
    group: 'WORKFORCE',
    items: [
      { path: '/matrix/workforce',  label: 'Employee Command',    icon: Users },
    ],
  },
  {
    group: 'NETWORK',
    items: [
      { path: '/matrix/hospitals',  label: 'Hospital Network',    icon: Building2 },
      { path: '/matrix/pharmacy',   label: 'Pharmacy Network',    icon: Pill },
      { path: '/matrix/lab',        label: 'Lab Network',         icon: FlaskConical },
      { path: '/matrix/patients',   label: 'Patient Intelligence',icon: Brain },
    ],
  },
  {
    group: 'CRISIS',
    items: [
      { path: '/matrix/incidents',  label: 'Incident War Room',   icon: Siren },
      { path: '/matrix/broadcast',  label: 'Emergency Broadcast', icon: Radio },
    ],
  },
  {
    group: 'SECURITY',
    items: [
      { path: '/matrix/iam',        label: 'IAM Governance',      icon: ShieldAlert },
      { path: '/matrix/verification',label:'Verification Command', icon: ShieldCheck },
    ],
  },
  {
    group: 'ANALYTICS',
    items: [
      { path: '/matrix/financial',  label: 'Financial Command',   icon: DollarSign },
      { path: '/matrix/audit',      label: 'Audit & Compliance',  icon: Activity },
    ],
  },
  {
    group: 'INTELLIGENCE',
    items: [
      { path: '/matrix/ai',         label: 'AI Copilot',          icon: Cpu },
    ],
  },
];

export default function Layout({ children }) {
  const navigate              = useNavigate();
  const location              = useLocation();
  const { user, logout }      = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const roleLabel = ROLE_LABELS[(user?.role || '').toLowerCase()] || user?.role || 'Employee';
  const initials  = (user?.name || user?.full_name || user?.email || 'H').slice(0,2).toUpperCase();

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#060a12', fontFamily:'Inter, system-ui, sans-serif' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside style={{
        width:          collapsed ? 52 : 224,
        flexShrink:     0,
        background:     '#05080f',
        borderRight:    '1px solid rgba(255,255,255,0.06)',
        display:        'flex',
        flexDirection:  'column',
        overflow:       'hidden',
        transition:     'width 0.2s ease',
      }}>

        {/* Logo */}
        <div style={{
          padding:      collapsed ? '14px 10px' : '14px 14px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display:      'flex',
          alignItems:   'center',
          gap:          9,
          flexShrink:   0,
        }}>
          <img
            src={hospainLogo}
            alt="Hospain"
            style={{ width:30, height:30, objectFit:'contain', flexShrink:0 }}
          />
          {!collapsed && (
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.02em', whiteSpace:'nowrap' }}>Hospain</div>
              <div style={{
                fontSize:9, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap',
                background:'linear-gradient(90deg,#06b6d4,#8b5cf6)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              }}>Care Beyond Today</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'6px 4px' }}>
          {NAV_GROUPS.map(({ group, items }) => (
            <div key={group} style={{ marginBottom:8 }}>
              {!collapsed && (
                <div style={{ fontSize:8, fontWeight:800, color:'rgba(71,85,105,0.7)', letterSpacing:'0.14em', textTransform:'uppercase', padding:'2px 7px', marginBottom:1 }}>
                  {group}
                </div>
              )}
              {items.map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path || location.pathname.startsWith(path + '/');
                return (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    title={collapsed ? label : undefined}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      gap:            collapsed ? 0 : 7,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      width:          '100%',
                      padding:        collapsed ? '8px 0' : '6px 8px',
                      borderRadius:   7,
                      border:         'none',
                      cursor:         'pointer',
                      marginBottom:   1,
                      fontSize:       11,
                      fontWeight:     active ? 700 : 400,
                      background:     active ? 'rgba(99,102,241,0.14)' : 'none',
                      color:          active ? '#818cf8' : '#475569',
                      transition:     'all 0.12s',
                    }}
                    onMouseEnter={e => { if(!active) e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if(!active) e.currentTarget.style.background='none'; }}
                  >
                    <Icon size={13} style={{ flexShrink:0 }} />
                    {!collapsed && <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1, textAlign:'left' }}>{label}</span>}
                    {!collapsed && active && <ChevronRight size={10} style={{ opacity:0.4, flexShrink:0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: user + logout */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', padding:'8px 4px', flexShrink:0 }}>
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(v => !v)}
            style={{
              display:'flex', alignItems:'center', gap:7,
              justifyContent: collapsed ? 'center' : 'flex-start',
              width:'100%', padding: collapsed ? '7px 0' : '6px 8px',
              borderRadius:7, border:'none', background:'none',
              color:'#334155', fontSize:11, cursor:'pointer', marginBottom:4,
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <><ChevronLeft size={13}/><span>Collapse</span></>}
          </button>

          {/* User info */}
          {!collapsed && user && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', marginBottom:4, borderRadius:8, background:'rgba(255,255,255,0.02)' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#818cf8', fontWeight:800, fontSize:11, flexShrink:0 }}>
                {initials}
              </div>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {user.name || user.full_name || 'Hospain Employee'}
                </div>
                <div style={{ fontSize:9, color:'#475569', fontWeight:600 }}>{roleLabel}</div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            style={{
              display:'flex', alignItems:'center', gap:7,
              justifyContent: collapsed ? 'center' : 'flex-start',
              width:'100%', padding: collapsed ? '7px 0' : '6px 8px',
              borderRadius:7, border:'none', background:'none',
              color:'rgba(244,63,94,0.7)', fontSize:11, cursor:'pointer',
              transition:'color 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.color='#f43f5e'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(244,63,94,0.7)'}
          >
            <LogOut size={13} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', minWidth:0, background:'#060a12' }}>
        {children}
      </main>
    </div>
  );
}
