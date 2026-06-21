import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, Package, ShoppingCart, FileBarChart } from 'lucide-react';
import apiClient from '../services/apiClient';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeeklySeries(transactions) {
  // Builds a 7-day revenue series from dispense transactions (qty is stored
  // negative for dispenses — see app/models/pharmacy.py TransactionType).
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: d.toDateString(), label: DAY_LABELS[d.getDay()], value: 0 };
  });

  for (const tx of transactions || []) {
    if (tx.transaction_type !== 'dispense' || !tx.created_at) continue;
    const txDate = new Date(tx.created_at).toDateString();
    const bucket = days.find((d) => d.key === txDate);
    if (bucket) bucket.value += Math.abs(tx.quantity) * (tx.unit_price || 0);
  }
  return days;
}

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [readyCount, setReadyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, txRes, rxRes, readyRes] = await Promise.all([
        apiClient.get('/pharmacy/stats'),
        apiClient.get('/pharmacy/transactions'),
        apiClient.get('/clinical/prescriptions'),
        apiClient.get('/pharmacy/orders?status=ready'),
      ]);
      setStats(statsRes.data);
      setChartData(buildWeeklySeries(txRes.data));
      setPrescriptions(rxRes.data || []);
      setReadyCount((readyRes.data || []).length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const QUICK_ACTIONS = [
    { label: 'New Walk-In', icon: Plus, path: '/walkin' },
    { label: 'Inventory', icon: Package, path: '/inventory' },
    { label: 'Purchase Stock', icon: ShoppingCart, path: '/more/purchases' },
    { label: 'Reports', icon: FileBarChart, path: '/more/reports' },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Today's Sales</p>
          <p className="text-2xl font-extrabold text-primary-700 mt-1">{stats ? stats.todaySales : '—'}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pending Orders</p>
          <p className="text-2xl font-extrabold text-warning-600 mt-1">{prescriptions.length}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="bg-white rounded-2xl shadow-card p-3 text-center">
          <p className="text-lg font-extrabold text-success-600">{readyCount}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">Ready for Pickup</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-3 text-center">
          <p className="text-lg font-extrabold text-warning-600">{stats?.lowStock ?? '—'}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">Low Stock</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-3 text-center">
          <p className="text-lg font-extrabold text-red-500">{stats?.nearExpiry ?? '—'}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">Expiring</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {QUICK_ACTIONS.map((a) => (
          <button key={a.label} onClick={() => navigate(a.path)} className="bg-white rounded-2xl shadow-card p-3 flex flex-col items-center gap-1.5">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <a.icon className="w-4.5 h-4.5 text-primary-600" />
            </div>
            <span className="text-[10px] font-semibold text-ink-900 text-center leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
        <p className="text-sm font-bold text-ink-900 mb-2">Weekly Revenue</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`₹${Math.round(v)}`, 'Revenue']} />
              <Area type="monotone" dataKey="value" stroke="#7C3AED" strokeWidth={2.5} fill="url(#revenueFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <p className="text-sm font-bold text-ink-900 px-4 pt-4 pb-2">Recent Prescriptions</p>
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Loading...</p>
        ) : prescriptions.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No prescriptions yet.</p>
        ) : (
          <div className="divide-y divide-lavender-50">
            {prescriptions.slice(0, 8).map((rx) => (
              <div key={rx.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="font-semibold text-ink-900 text-sm">Patient {rx.patient_id.slice(0, 8)}</p>
                  <p className="text-xs text-gray-400">{(rx.medications || []).length} item(s)</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    rx.status === 'dispensed' ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'
                  }`}
                >
                  {rx.status === 'dispensed' ? 'Dispensed' : 'Processing'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
