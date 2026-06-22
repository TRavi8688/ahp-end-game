import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  CreditCard, Building2, RefreshCw, Download, Filter, Calendar, Loader2
} from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-dark text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold text-white">
            {p.name?.toLowerCase().includes('revenue') || p.name?.toLowerCase().includes('amount')
              ? `₹${Number(p.value).toLocaleString()}` : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};

// Synthetic monthly breakdown
const genMonthlyData = (totalRevenue) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map((m, i) => ({
    month: m,
    revenue: Math.floor((totalRevenue / 6) * (0.7 + Math.random() * 0.6)),
    consult: Math.floor(totalRevenue * 0.3 / 6 * (0.8 + Math.random() * 0.4)),
    pharmacy: Math.floor(totalRevenue * 0.25 / 6 * (0.8 + Math.random() * 0.4)),
    lab: Math.floor(totalRevenue * 0.15 / 6 * (0.8 + Math.random() * 0.4)),
  }));
};

export default function RevenueAnalytics() {
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const token = localStorage.getItem('token');
        const cfg = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(`${API_BASE}/admin/hospitals`, cfg);
        const list = res.data?.data || [];
        setHospitals(list.filter(h => h.status === 'verified'));
        if (list.length > 0) setSelectedHospital(list[0]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchHospitals();
  }, []);

  useEffect(() => {
    if (!selectedHospital) return;
    const fetchDash = async () => {
      setDashLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/admin/owner/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDashData(res.data);
      } catch (e) { console.error(e); }
      finally { setDashLoading(false); }
    };
    fetchDash();
  }, [selectedHospital]);

  const ledger = dashData?.ledger || [];
  const totalRev = ledger.reduce((s, l) => s + (l.total_amount || 0), 0);
  const monthlyData = genMonthlyData(totalRev || 150000);

  const methodCounts = {};
  ledger.forEach(l => {
    const m = (l.payment_method || 'unknown').toUpperCase();
    methodCounts[m] = (methodCounts[m] || 0) + (l.total_amount || 0);
  });
  const pieData = Object.entries(methodCounts).map(([name, value]) => ({ name, value }));

  const splitTotals = ledger.reduce((acc, l) => ({
    consultation: acc.consultation + (l.splits?.consultation || 0),
    pharmacy: acc.pharmacy + (l.splits?.pharmacy || 0),
    lab: acc.lab + (l.splits?.lab || 0),
    room: acc.room + (l.splits?.room_ot || 0),
    tax: acc.tax + (l.splits?.tax || 0),
  }), { consultation: 0, pharmacy: 0, lab: 0, room: 0, tax: 0 });

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign size={20} className="text-emerald-400" />
            Revenue Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Unified financial ledger across all verified hospitals</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && hospitals.length > 0 && (
            <select
              value={selectedHospital?.id || ''}
              onChange={e => setSelectedHospital(hospitals.find(h => h.id === e.target.value))}
              className="input-dark py-2 text-xs w-52"
            >
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
          <button className="btn-ghost"><RefreshCw size={14} />Refresh</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {dashLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-indigo-500" size={28} />
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', value: `₹${totalRev.toLocaleString()}`, icon: <DollarSign size={16} />, color: 'emerald', trend: '+14%' },
                { label: 'Consultation', value: `₹${splitTotals.consultation.toLocaleString()}`, icon: <CreditCard size={16} />, color: 'indigo', trend: '+8%' },
                { label: 'Pharmacy', value: `₹${splitTotals.pharmacy.toLocaleString()}`, icon: <TrendingUp size={16} />, color: 'amber', trend: '+5%' },
                { label: 'Lab Services', value: `₹${splitTotals.lab.toLocaleString()}`, icon: <TrendingUp size={16} />, color: 'cyan', trend: '+11%' },
              ].map((card, i) => (
                <div key={i} className={`glass-card p-5 stat-card-glow-${card.color}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg bg-${card.color}-500/10 text-${card.color}-400`}>{card.icon}</div>
                    <span className="text-emerald-400 text-xs font-semibold flex items-center gap-0.5">
                      <ArrowUpRight size={12} />{card.trend}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">{card.label}</div>
                  <div className="text-xl font-bold text-white">{card.value}</div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Monthly Revenue Breakdown</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="consult" name="Consultation Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="pharmacy" name="Pharmacy Revenue" fill="#10b981" radius={[0, 0, 0, 0]} stackId="a" />
                    <Bar dataKey="lab" name="Lab Revenue" fill="#f59e0b" radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Payment Methods</h3>
                {pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-44 text-slate-600 text-sm">No payment data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-3">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                            <span className="text-slate-400">{d.name}</span>
                          </div>
                          <span className="text-white font-semibold">₹{(d.value || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Trend Line */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Revenue Trend — Monthly</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" name="Total Revenue" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Ledger Table */}
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Transaction Ledger</h3>
                <span className="badge badge-blue">{ledger.length} transactions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Patient</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Date</th>
                      <th>Escrow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-600">No transactions found</td></tr>
                    ) : ledger.slice(0, 20).map(l => (
                      <tr key={l.payment_id}>
                        <td><span className="font-mono text-xs text-indigo-400">{l.invoice_number || l.invoice_id?.substring(0, 10)}</span></td>
                        <td>
                          <div className="text-sm text-white">{l.patient_name}</div>
                          <div className="font-mono text-xs text-slate-600">{l.patient_hospain_id}</div>
                        </td>
                        <td className="font-bold text-emerald-400">₹{(l.total_amount || 0).toLocaleString()}</td>
                        <td><span className="badge badge-cyan uppercase">{l.payment_method}</span></td>
                        <td className="text-xs text-slate-500">{l.date ? new Date(l.date).toLocaleDateString() : '—'}</td>
                        <td>
                          <span className={`badge ${l.escrow?.status === 'Routed_to_Owner' ? 'badge-green' : 'badge-amber'}`}>
                            {l.escrow?.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
