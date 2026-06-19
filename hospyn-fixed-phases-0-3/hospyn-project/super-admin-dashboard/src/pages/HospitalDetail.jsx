import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  ArrowLeft, Building2, Users, DollarSign, Activity, Bed, Pill,
  Star, Clock, TrendingUp, ChevronRight, Loader2, AlertTriangle,
  CheckCircle2, Shield, Eye, RefreshCw, UserCheck, Calendar
} from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-dark text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold text-white">{typeof p.value === 'number' && p.value > 999 ? `₹${p.value.toLocaleString()}` : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const InfoBlock = ({ label, value, sub, color = 'indigo' }) => (
  <div className={`glass-card p-4 border-l-2 border-${color}-500/50`}>
    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">{label}</div>
    <div className="text-xl font-bold text-white">{value ?? '—'}</div>
    {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
  </div>
);

const RatingStars = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={10} className={i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
    ))}
    <span className="text-xs text-slate-400 ml-1">{rating?.toFixed(1)}</span>
  </div>
);

export default function HospitalDetail({ hospitalId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!hospitalId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/admin/owner/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { hospital_id: hospitalId }
        });
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [hospitalId]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
        <p className="text-slate-500 text-sm">Loading hospital data...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Could not load hospital data</p>
        <button onClick={onBack} className="btn-ghost mt-4"><ArrowLeft size={14} />Go Back</button>
      </div>
    </div>
  );

  const { hospital_name, scale, telemetry, branches, beds, pharmacy, staff, doctors, ledger, activity_feed } = data;

  // Build revenue chart from ledger
  const revenueByDay = {};
  (ledger || []).slice(0, 30).forEach(l => {
    const day = l.date ? new Date(l.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Unknown';
    revenueByDay[day] = (revenueByDay[day] || 0) + (l.total_amount || 0);
  });
  const revenueChartData = Object.entries(revenueByDay).slice(-7).map(([d, v]) => ({ day: d, revenue: v }));

  const bedsByStatus = {};
  (beds || []).forEach(b => { bedsByStatus[b.status] = (bedsByStatus[b.status] || 0) + 1; });
  const bedChartData = Object.entries(bedsByStatus).map(([name, value]) => ({ name, value }));

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'staff', label: `Staff (${(staff || []).length})` },
    { id: 'doctors', label: `Doctors (${(doctors || []).length})` },
    { id: 'financial', label: `Ledger (${(ledger || []).length})` },
    { id: 'inventory', label: `Pharmacy (${(pharmacy || []).length})` },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="btn-ghost py-1.5 px-2">
            <ArrowLeft size={14} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg">
            {(hospital_name || 'H').charAt(0)}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{hospital_name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="badge badge-green"><CheckCircle2 size={10} /> Verified</span>
              <span className="badge badge-blue">Scale: {scale}</span>
              {branches?.length > 0 && <span className="badge badge-violet">{branches.length} Branch{branches.length > 1 ? 'es' : ''}</span>}
            </div>
          </div>
          <button onClick={() => { setLoading(true); }} className="btn-ghost ml-auto"><RefreshCw size={14} />Refresh</button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === t.id
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* === OVERVIEW TAB === */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoBlock label="Total Revenue" value={`₹${(telemetry?.revenue || 0).toLocaleString()}`} color="emerald" />
              <InfoBlock label="Total Visits" value={(telemetry?.visits || 0).toLocaleString()} sub="All time" color="indigo" />
              <InfoBlock label="Beds Occupied" value={`${telemetry?.beds_occupied || 0} / ${telemetry?.beds_total || 0}`} sub="Occupancy rate" color="amber" />
              <InfoBlock label="Low Stock Items" value={telemetry?.low_stock_count || 0} sub="Pharmacy alerts" color="rose" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Revenue Chart */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <DollarSign size={15} className="text-emerald-400" />
                  Revenue Trend (Last 7 days)
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Beds Chart */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Bed size={15} className="text-indigo-400" />
                  Bed Status Distribution
                </h3>
                {bedChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-44 text-slate-600 text-sm">No bed data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={bedChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {bedChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Branches */}
            {branches?.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Active Branches</h3>
                <div className="grid grid-cols-3 gap-3">
                  {branches.map(b => (
                    <div key={b.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-sm font-semibold text-white">{b.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{b.city}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === STAFF TAB === */}
        {activeTab === 'staff' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Staff Directory</h3>
              <span className="badge badge-blue">{(staff || []).length} members</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(staff || []).length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-600">No staff records found</td></tr>
                ) : (staff || []).map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-semibold text-xs">
                          {(s.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white text-sm">{s.name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-violet uppercase">{s.role}</span></td>
                    <td><span className="text-slate-400">{s.department_name || 'Administration'}</span></td>
                    <td><span className="badge badge-green"><CheckCircle2 size={10} />Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* === DOCTORS TAB === */}
        {activeTab === 'doctors' && (
          <div className="space-y-4">
            {(doctors || []).length === 0 ? (
              <div className="glass-card p-10 text-center text-slate-600">No doctor records found</div>
            ) : (doctors || []).map(doc => {
              const pct = Math.min(100, Math.round((doc.patients_treated / 50) * 100));
              return (
                <div key={doc.id} className="glass-card p-5 flex items-center gap-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-lg">
                    {(doc.name || 'D').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{doc.name}</span>
                      <span className="badge badge-blue">{doc.specialty}</span>
                    </div>
                    <RatingStars rating={doc.rating || 4.8} />
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-lg font-bold text-white">{doc.patients_treated}</div>
                      <div className="text-xs text-slate-600">Patients</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{doc.avg_treatment_time_mins}m</div>
                      <div className="text-xs text-slate-600">Avg Time</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{doc.hours_worked}h</div>
                      <div className="text-xs text-slate-600">Hours</div>
                    </div>
                  </div>
                  <div className="w-28">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Performance</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* === FINANCIAL TAB === */}
        {activeTab === 'financial' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Payment Ledger</h3>
              <span className="badge badge-emerald">
                Total: ₹{(ledger || []).reduce((s, l) => s + (l.total_amount || 0), 0).toLocaleString()}
              </span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Splits</th>
                  <th>Escrow</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(ledger || []).length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-600">No payment records</td></tr>
                ) : (ledger || []).slice(0, 50).map(l => (
                  <tr key={l.payment_id}>
                    <td><span className="font-mono text-xs text-indigo-400">{l.invoice_number || l.invoice_id?.substring(0, 8)}</span></td>
                    <td>
                      <div className="text-sm text-white">{l.patient_name}</div>
                      <div className="text-xs text-slate-600 font-mono">{l.patient_hospyn_id}</div>
                    </td>
                    <td className="font-semibold text-emerald-400">₹{(l.total_amount || 0).toLocaleString()}</td>
                    <td><span className="badge badge-cyan uppercase">{l.payment_method}</span></td>
                    <td>
                      <div className="text-xs space-y-0.5">
                        {l.splits?.consultation > 0 && <div className="text-slate-400">Consult: ₹{l.splits.consultation}</div>}
                        {l.splits?.pharmacy > 0 && <div className="text-slate-400">Pharma: ₹{l.splits.pharmacy}</div>}
                        {l.splits?.lab > 0 && <div className="text-slate-400">Lab: ₹{l.splits.lab}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${l.escrow?.status === 'Routed_to_Owner' ? 'badge-green' : 'badge-amber'}`}>
                        {l.escrow?.status || 'Pending'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">
                      {l.date ? new Date(l.date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* === PHARMACY TAB === */}
        {activeTab === 'inventory' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Pharmacy Inventory</h3>
              {(pharmacy || []).some(p => p.stock_quantity <= p.reorder_level) && (
                <span className="badge badge-red"><AlertTriangle size={10} />Low Stock Alert</span>
              )}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Generic Name</th>
                  <th>Stock</th>
                  <th>Reorder At</th>
                  <th>Unit Price</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(pharmacy || []).length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-600">No inventory records</td></tr>
                ) : (pharmacy || []).map(p => {
                  const isLow = p.stock_quantity <= p.reorder_level;
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold text-white">{p.item_name}</td>
                      <td className="text-slate-500 text-xs">{p.generic_name || '—'}</td>
                      <td className={isLow ? 'text-rose-400 font-bold' : 'text-white'}>{p.stock_quantity}</td>
                      <td className="text-slate-500">{p.reorder_level}</td>
                      <td className="text-emerald-400">₹{p.unit_price}</td>
                      <td className="text-xs text-slate-500">{p.expiry_date || '—'}</td>
                      <td>
                        {isLow
                          ? <span className="badge badge-red"><AlertTriangle size={10} />Low Stock</span>
                          : <span className="badge badge-green"><CheckCircle2 size={10} />OK</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* === ACTIVITY TAB === */}
        {activeTab === 'activity' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Activity Feed</h3>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {(activity_feed || []).length === 0 ? (
                <div className="p-8 text-center text-slate-600">No activity recorded</div>
              ) : (activity_feed || []).map((a, i) => (
                <div key={a.id || i} className="p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-slate-500 mt-0.5 shrink-0">
                    <Activity size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge badge-violet text-xs">{a.action?.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-400">by <span className="text-slate-300 font-semibold">{a.actor_name}</span></span>
                      <span className="badge badge-slate">{a.actor_role}</span>
                    </div>
                    {a.patient && <div className="text-xs text-slate-600 mt-1">Patient: {a.patient}</div>}
                  </div>
                  <span className="text-xs text-slate-600 shrink-0">
                    {a.timestamp ? new Date(a.timestamp).toLocaleString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
