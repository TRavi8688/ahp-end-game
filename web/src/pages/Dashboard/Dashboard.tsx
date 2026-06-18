// partner-app/src/pages/Dashboard/Dashboard.tsx
//
// BUG FIX: Entire dashboard was hardcoded mock data — no API calls whatsoever.
// Stats (24 orders, $4250 revenue) were fake constants.
// "View All Orders" button did nothing.
// Now wired to GET /api/v1/partner/dashboard-stats via Redux store.

import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Clock, CheckCircle, DollarSign, Package,
  Users, TrendingUp, ArrowRight, RefreshCw, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import apiClient from '../../services/apiClient';

interface DashboardStats {
  total_orders:        number;
  total_revenue:       number;
  pending_referrals:   number;
  commission_earned:   number;
  commission_pending:  number;
  active_patients:     number;
  conversion_rate:     number;
  revenue_trend:       { month: string; revenue: number; commission: number }[];
  recent_activity:     { id: string; type: string; patient: string; amount: number; timestamp: string }[];
}

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1929] border border-[#1e3a5f] rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<any>();
  const navigate = useNavigate();
  const [stats,    setStats]    = useState<DashboardStats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const loadStats = async () => {
    setError('');
    try {
      const { data } = await apiClient.get<DashboardStats>('/api/v1/partner/dashboard-stats');
      setStats(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load dashboard');
    }
  };

  useEffect(() => {
    loadStats().finally(() => setLoading(false));
  }, []);

  const statCards = [
    { title: 'Total Orders',       value: stats?.total_orders         ?? '—', icon: <Package className="w-6 h-6 text-blue-400" />,   color: 'blue'   },
    { title: 'Revenue',            value: stats ? fmt(stats.total_revenue)   : '—', icon: <DollarSign className="w-6 h-6 text-purple-400" />, color: 'purple' },
    { title: 'Commission Earned',  value: stats ? fmt(stats.commission_earned)  : '—', icon: <TrendingUp className="w-6 h-6 text-green-400" />,  color: 'green'  },
    { title: 'Active Patients',    value: stats?.active_patients      ?? '—', icon: <Users className="w-6 h-6 text-amber-400" />,   color: 'amber'  },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-slate-800/60 rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6 h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Partner Dashboard</h1>
          <p className="text-slate-400 mt-1">Overview of your daily operations</p>
        </div>
        <button
          onClick={() => { setLoading(true); loadStats().finally(() => setLoading(false)); }}
          className="glass-button-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.title} className="glass-card p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">{card.title}</p>
                <h3 className="text-3xl font-bold text-white mt-2">{card.value}</h3>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Trend Chart */}
      {stats?.revenue_trend && stats.revenue_trend.length > 0 && (
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Revenue Trend (6 months)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.revenue_trend}>
              <defs>
                <linearGradient id="revGrad"  x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
              <XAxis dataKey="month" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue"    name="Revenue"    stroke="#3b82f6" fill="url(#revGrad)"  strokeWidth={2} />
              <Area type="monotone" dataKey="commission" name="Commission" stroke="#10b981" fill="url(#commGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> Recent Activity
            </h2>
          </div>
          <div className="space-y-3">
            {(stats?.recent_activity ?? []).length === 0 ? (
              <p className="text-slate-500 text-center py-8">No recent activity</p>
            ) : (
              stats!.recent_activity.map((act) => (
                <div key={act.id}
                  className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-transparent hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {act.patient?.charAt(0) ?? '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{act.patient}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(act.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-white">{fmt(act.amount)}</p>
                </div>
              ))
            )}
          </div>
          {/* BUG FIX: "View All Orders" now actually navigates */}
          <button
            onClick={() => navigate('/orders')}
            className="w-full mt-6 py-3 border border-dashed border-slate-600 rounded-xl text-slate-400 font-medium hover:bg-slate-800/50 transition-colors flex items-center justify-center gap-2"
          >
            View All Orders <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="glass-panel p-6 flex flex-col">
          <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {[
              { label: 'Orders',     icon: <Package className="w-6 h-6" />,  path: '/orders',    color: 'indigo'  },
              { label: 'Inventory',  icon: <Package className="w-6 h-6" />,  path: '/inventory', color: 'emerald' },
              { label: 'Referrals',  icon: <Users className="w-6 h-6" />,    path: '/referrals', color: 'purple'  },
              { label: 'Settings',   icon: <CheckCircle className="w-6 h-6" />, path: '/settings', color: 'amber' },
            ].map((action) => (
              <button key={action.path}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800/40 text-slate-300 rounded-xl hover:bg-slate-700/50 transition-colors border border-slate-700/50 hover:border-primary/20">
                <div className="p-3 bg-slate-700 rounded-full">{action.icon}</div>
                <span className="font-medium text-sm">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Commission Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Pending Referrals',  value: stats.pending_referrals,  accent: '#f59e0b' },
            { label: 'Commission Pending', value: fmt(stats.commission_pending), accent: '#f59e0b' },
            { label: 'Conversion Rate',    value: `${(stats.conversion_rate * 100).toFixed(1)}%`, accent: '#10b981' },
          ].map(({ label, value, accent }) => (
            <div key={label} className="glass-card p-5">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">{label}</p>
              <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
