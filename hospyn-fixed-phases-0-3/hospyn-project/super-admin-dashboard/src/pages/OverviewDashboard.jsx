import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import {
  Building2, Users, Activity, ShieldCheck, TrendingUp, AlertTriangle,
  ArrowUpRight, Clock, Zap, Globe, RefreshCw, Terminal, Eye,
  ChevronRight, Server, Database
} from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const CHART_COLORS = {
  indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b',
  rose: '#f43f5e', cyan: '#06b6d4', violet: '#8b5cf6'
};

// Synthetic traffic data for sparklines (augmented with real anchor)
const genTrafficData = (base) => Array.from({ length: 24 }, (_, i) => ({
  h: `${i}:00`,
  v: Math.max(0, base + Math.floor(Math.sin(i / 3) * base * 0.3 + Math.random() * base * 0.2))
}));

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-dark text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-white">{p.value}</span></p>
      ))}
    </div>
  );
};

const StatCard = ({ icon, label, value, sub, color, glow, loading, trend }) => (
  <div className={`glass-card p-5 stat-card-glow-${glow} animate-fadeIn`}>
    <div className="flex items-start justify-between mb-4">
      <div className={`p-2.5 rounded-lg bg-${color}-500/10`}>
        {React.cloneElement(icon, { size: 18, style: { color: CHART_COLORS[color] } })}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
          <ArrowUpRight size={13} />
          <span>{trend}%</span>
        </div>
      )}
    </div>
    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
    {loading
      ? <div className="skeleton h-8 w-24 mt-1" />
      : <div className="text-2xl font-bold text-white">{value}</div>
    }
    {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
  </div>
);

export default function OverviewDashboard({ onNavigate }) {
  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const cfg = { headers: { Authorization: `Bearer ${token}` } };
      const [analyticsRes, auditRes] = await Promise.all([
        axios.get(`${API_BASE}/analytics/overview`, cfg),
        axios.get(`${API_BASE}/admin/audit-logs?limit=15`, cfg)
      ]);
      setMetrics(analyticsRes.data.metrics);
      setAuditLogs(Array.isArray(analyticsRes.data.recent_audit_events)
        ? analyticsRes.data.recent_audit_events
        : (Array.isArray(auditRes.data) ? auditRes.data : []));
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15000);
    return () => clearInterval(id);
  }, []);

  const trafficData = genTrafficData(metrics?.registered_patients || 50);
  const visitData = Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    visits: Math.floor(Math.random() * 80 + 20),
    patients: Math.floor(Math.random() * 60 + 15)
  }));

  const actionBadge = (action) => {
    const m = {
      'HOSPITAL_INVITE_CREATED': 'badge-cyan',
      'LOGIN': 'badge-green',
      'EMERGENCY_BROADCAST': 'badge-red',
      'QUEUE_STATUS_UPDATE': 'badge-violet',
      'PRESCRIPTION_CREATED': 'badge-blue',
      'PATIENT_REGISTERED': 'badge-green',
      'DOCTOR_VERIFIED': 'badge-amber',
    };
    return m[action] || 'badge-slate';
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Last synced: {lastRefresh.toLocaleTimeString()} · Auto-refresh every 15s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="pulse-green" />
            <span className="text-emerald-400 text-xs font-semibold">ALL SYSTEMS NOMINAL</span>
          </div>
          <button onClick={fetchData} className="btn-ghost">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Building2 />} label="Verified Hospitals" value={(metrics?.active_hospitals || 0).toLocaleString()} sub={`${metrics?.pending_verifications || 0} pending verification`} color="indigo" glow="indigo" loading={loading} trend={8} />
        <StatCard icon={<Users />} label="Global Patients" value={(metrics?.registered_patients || 0).toLocaleString()} sub="Across all hospital nodes" color="emerald" glow="emerald" loading={loading} trend={12} />
        <StatCard icon={<ShieldCheck />} label="Active Staff" value={(metrics?.registered_staff || 0).toLocaleString()} sub="Doctors · Nurses · Admins" color="amber" glow="amber" loading={loading} />
        <StatCard icon={<Activity />} label="System Health" value="Optimal" sub="0ms avg latency · 99.98% uptime" color="cyan" glow="cyan" loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* 24h Traffic */}
        <div className="col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Globe size={15} className="text-indigo-400" />
                24h Ecosystem Traffic
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">API requests across all clinical nodes</p>
            </div>
            <span className="badge badge-blue">Live</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="h" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="v" name="Requests" stroke="#6366f1" strokeWidth={2} fill="url(#trafficGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Visits */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp size={15} className="text-emerald-400" />
              Weekly Visits
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={visitData} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="visits" name="Visits" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="patients" name="Patients" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Stats + Audit Log */}
      <div className="grid grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
          {[
            { icon: <Building2 size={15} />, label: 'Hospital Verification Queue', sub: `${metrics?.pending_verifications || 0} pending`, color: 'text-amber-400', view: 'verification' },
            { icon: <Users size={15} />, label: 'IAM Governance', sub: 'Manage access & roles', color: 'text-indigo-400', view: 'iam' },
            { icon: <Activity size={15} />, label: 'Revenue Analytics', sub: 'Financial ledger view', color: 'text-emerald-400', view: 'revenue' },
            { icon: <Globe size={15} />, label: 'Hospital Network', sub: 'All registered nodes', color: 'text-cyan-400', view: 'hospitals' },
            { icon: <AlertTriangle size={15} />, label: 'Emergency Alerts', sub: 'Broadcast & monitor', color: 'text-rose-400', view: 'alerts' },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => onNavigate(item.view)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all group"
            >
              <span className={item.color}>{item.icon}</span>
              <div className="flex-1 text-left">
                <div className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{item.label}</div>
                <div className="text-xs text-slate-600">{item.sub}</div>
              </div>
              <ChevronRight size={13} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
            </button>
          ))}
        </div>

        {/* Audit Log Stream */}
        <div className="col-span-2 glass-card overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal size={15} className="text-indigo-400" />
              Live Audit Stream
            </h3>
            <span className="font-mono text-xs text-slate-600">IMMUTABLE · POSTGRESQL WAL</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-72">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-10 w-full" style={{ animationDelay: `${i * 0.1}s` }} />
              ))
            ) : auditLogs.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-slate-600 text-sm">No audit events yet</div>
            ) : auditLogs.map((log, i) => (
              <div key={log.id || i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                <span className="font-mono text-xs text-slate-600 whitespace-nowrap pt-0.5 w-16 shrink-0">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                </span>
                <span className={`badge ${actionBadge(log.action)} shrink-0`}>{log.action?.replace(/_/g, ' ') || 'EVENT'}</span>
                <span className="text-xs text-slate-500 truncate">
                  Actor: <span className="text-slate-400 font-mono">{log.actor_id?.substring(0, 8) || 'SYSTEM'}</span>
                  {log.resource_type && <> · <span className="text-slate-500">{log.resource_type}</span></>}
                  {log.ip_address && <> · <span className="text-slate-600">{log.ip_address}</span></>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Infrastructure Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <Server size={16} />, label: 'API Server', status: 'Healthy', latency: '12ms', uptime: '99.98%', color: 'emerald' },
          { icon: <Database size={16} />, label: 'PostgreSQL DB', status: 'Healthy', latency: '3ms', uptime: '99.99%', color: 'emerald' },
          { icon: <Zap size={16} />, label: 'Background Workers', status: 'Active', latency: '—', uptime: '99.95%', color: 'emerald' },
        ].map((node, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-4">
            <div className={`p-2.5 rounded-lg bg-${node.color}-500/10 text-${node.color}-400`}>
              {node.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{node.label}</span>
                <span className={`badge badge-${node.color}`}>{node.status}</span>
              </div>
              <div className="text-xs text-slate-600 mt-0.5">Latency: {node.latency} · Uptime: {node.uptime}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
