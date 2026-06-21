import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, AlertTriangle, Clock, Package } from 'lucide-react';
import apiClient from '../services/apiClient';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeeklySeries(transactions) {
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

function topDispensedItems(transactions, inventory) {
  const counts = {};
  for (const tx of transactions || []) {
    if (tx.transaction_type !== 'dispense' || !tx.inventory_item_id) continue;
    counts[tx.inventory_item_id] = (counts[tx.inventory_item_id] || 0) + Math.abs(tx.quantity);
  }
  return Object.entries(counts)
    .map(([id, qty]) => ({
      id,
      qty,
      name: inventory.find((i) => i.id === id)?.item_name || 'Unknown item',
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
}

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, txRes, invRes] = await Promise.all([
        apiClient.get('/pharmacy/stats'),
        apiClient.get('/pharmacy/transactions'),
        apiClient.get('/pharmacy/inventory'),
      ]);
      setStats(statsRes.data);
      setChartData(buildWeeklySeries(txRes.data));
      setTopItems(topDispensedItems(txRes.data, invRes.data || []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const weekTotal = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-ink-900 mb-4">Analytics</h1>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="bg-white rounded-2xl shadow-card p-3">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-primary-600" />
          </div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase">7-Day Revenue</p>
          <p className="text-lg font-extrabold text-ink-900">₹{Math.round(weekTotal).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-3">
          <div className="w-8 h-8 rounded-lg bg-warning-50 flex items-center justify-center mb-2">
            <AlertTriangle className="w-4 h-4 text-warning-600" />
          </div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase">Low Stock</p>
          <p className="text-lg font-extrabold text-ink-900">{stats?.lowStock ?? '—'}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center mb-2">
            <Clock className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase">Near Expiry</p>
          <p className="text-lg font-extrabold text-ink-900">{stats?.nearExpiry ?? '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
        <p className="text-sm font-bold text-ink-900 mb-2">Revenue Trend</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`₹${Math.round(v)}`, 'Revenue']} />
              <Area type="monotone" dataKey="value" stroke="#7C3AED" strokeWidth={2.5} fill="url(#analyticsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <p className="text-sm font-bold text-ink-900 px-4 pt-4 pb-2">Top Dispensed Items (7 days)</p>
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Loading...</p>
        ) : topItems.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No dispense activity yet this week.</p>
        ) : (
          <div className="divide-y divide-lavender-50">
            {topItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-lavender-50 flex items-center justify-center text-xs font-bold text-primary-600 shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <p className="font-semibold text-ink-900 text-sm">{item.name}</p>
                </div>
                <p className="text-sm text-gray-500">{item.qty} units</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
