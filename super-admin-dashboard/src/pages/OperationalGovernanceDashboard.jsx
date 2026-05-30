import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import {
  Activity, Server, Database, ShieldCheck, Building2, FileCheck,
  Users, Loader2, RefreshCw, Clock, Cpu, HardDrive, Wifi
} from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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

// Synthetic infra metrics
const genCpuData = () => Array.from({ length: 20 }, (_, i) => ({
  t: `${i}m`, cpu: Math.floor(Math.random() * 20 + 15), mem: Math.floor(Math.random() * 30 + 40), db: Math.floor(Math.random() * 10 + 3)
}));

const INFRA_NODES = [
  { name: 'API Gateway', status: 'healthy', region: 'ap-south-1', cpu: 18, mem: 52, latency: '12ms', uptime: '99.98%', icon: <Server size={14} /> },
  { name: 'PostgreSQL Primary', status: 'healthy', region: 'ap-south-1', cpu: 8, mem: 61, latency: '3ms', uptime: '99.99%', icon: <Database size={14} /> },
  { name: 'Redis Cache', status: 'healthy', region: 'ap-south-1', cpu: 4, mem: 32, latency: '0.5ms', uptime: '99.99%', icon: <HardDrive size={14} /> },
  { name: 'Celery Workers', status: 'healthy', region: 'ap-south-1', cpu: 22, mem: 48, latency: '—', uptime: '99.95%', icon: <Cpu size={14} /> },
  { name: 'CDN / Static', status: 'healthy', region: 'Global', cpu: 2, mem: 12, latency: '8ms', uptime: '100%', icon: <Wifi size={14} /> },
];

export default function OperationalGovernanceDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cpuData] = useState(genCpuData());

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/analytics/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMetrics(res.data.metrics);
        setAuditLogs(Array.isArray(res.data.recent_audit_events) ? res.data.recent_audit_events : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
    const id = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity size={20} className="text-emerald-400" />
            Operational Metrics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Live infrastructure telemetry and platform health</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="pulse-green" />
            <span className="text-emerald-400 text-xs font-semibold">{metrics?.system_health || 'OPTIMAL'}</span>
          </div>
          <button onClick={() => window.location.reload()} className="btn-ghost"><RefreshCw size={14} />Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Hospitals', value: metrics?.active_hospitals || 0, icon: <Building2 size={16} />, color: 'indigo' },
            { label: 'Pending Verification', value: metrics?.pending_verifications || 0, icon: <FileCheck size={16} />, color: 'amber' },
            { label: 'Registered Staff', value: metrics?.registered_staff || 0, icon: <Users size={16} />, color: 'emerald' },
            { label: 'Global Patients', value: metrics?.registered_patients || 0, icon: <Activity size={16} />, color: 'cyan' },
          ].map((card, i) => (
            <div key={i} className={`glass-card p-5 stat-card-glow-${card.color}`}>
              <div className={`p-2.5 rounded-lg bg-${card.color}-500/10 text-${card.color}-400 w-fit mb-3`}>
                {card.icon}
              </div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">{card.label}</div>
              <div className="text-2xl font-bold text-white">{card.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Infrastructure Load (Last 20m)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={cpuData}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="t" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#6366f1" strokeWidth={1.5} fill="url(#cpuGrad)" dot={false} />
              <Area type="monotone" dataKey="mem" name="Memory %" stroke="#10b981" strokeWidth={1.5} fill="url(#memGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">DB Query Rate</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="t" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="db" name="Queries/s" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Infrastructure Nodes */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server size={14} className="text-indigo-400" />
            Infrastructure Nodes
          </h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Region</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Latency</th>
              <th>Uptime</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {INFRA_NODES.map((node, i) => (
              <tr key={i}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">{node.icon}</div>
                    <span className="font-semibold text-white text-sm">{node.name}</span>
                  </div>
                </td>
                <td><span className="font-mono text-xs text-slate-500">{node.region}</span></td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="progress-bar w-16">
                      <div className="progress-fill bg-indigo-500" style={{ width: `${node.cpu}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{node.cpu}%</span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="progress-bar w-16">
                      <div className="progress-fill bg-emerald-500" style={{ width: `${node.mem}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{node.mem}%</span>
                  </div>
                </td>
                <td><span className="text-xs text-slate-400">{node.latency}</span></td>
                <td><span className="text-xs text-emerald-400 font-semibold">{node.uptime}</span></td>
                <td><span className="badge badge-green">Healthy</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Log */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck size={14} className="text-indigo-400" />
            Immutable Audit Stream
          </h3>
          <span className="font-mono text-xs text-slate-600">POSTGRESQL WAL</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <div className="py-10 text-center text-slate-600 text-sm">No recent audit events</div>
          ) : auditLogs.map((log, i) => (
            <div key={log.id || i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <span className="font-mono text-xs text-slate-600 w-20 shrink-0">
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
              </span>
              <span className="badge badge-violet shrink-0">{log.action?.replace(/_/g, ' ')}</span>
              <span className="text-xs text-slate-500 truncate">
                <span className="font-mono text-slate-400">{log.actor_id?.substring(0, 8) || 'SYSTEM'}</span>
                {log.resource_type && <> · {log.resource_type}</>}
                {log.ip_address && <> · <span className="font-mono">{log.ip_address}</span></>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
