import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, TrendingUp, Package, Users } from 'lucide-react';
import apiClient from '../../services/apiClient';

const PERIODS = ['today', 'week', 'month'];

export default function MoreReports() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('week');
  const [sales, setSales] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, invRes, custRes] = await Promise.all([
        apiClient.get(`/pharmacy/reports/sales?period=${period}`),
        apiClient.get('/pharmacy/reports/inventory'),
        apiClient.get('/pharmacy/reports/customers'),
      ]);
      setSales(salesRes.data);
      setInventory(invRes.data);
      setCustomers(custRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="p-4 sm:p-6">
      <button onClick={() => navigate('/more')} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <h1 className="text-xl font-bold text-ink-900 mb-4">Reports</h1>

      <div className="flex gap-1.5 mb-5">
        {PERIODS.map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize ${period === p ? 'bg-primary-600 text-white' : 'bg-white text-gray-400 shadow-card'}`}>
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading...</p>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary-600" />
              <p className="font-bold text-ink-900 text-sm">Sales Report</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-400">Bills</p><p className="text-lg font-extrabold text-ink-900">{sales?.bills ?? 0}</p></div>
              <div><p className="text-xs text-gray-400">Revenue</p><p className="text-lg font-extrabold text-primary-700">₹{sales?.revenue?.toFixed(0) ?? 0}</p></div>
              <div><p className="text-xs text-gray-400">Expenses</p><p className="text-lg font-extrabold text-warning-600">₹{sales?.expenses?.toFixed(0) ?? 0}</p></div>
              <div><p className="text-xs text-gray-400">Profit</p><p className="text-lg font-extrabold text-success-600">₹{sales?.profit?.toFixed(0) ?? 0}</p></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-primary-600" />
              <p className="font-bold text-ink-900 text-sm">Inventory Report</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-400">Total Items</p><p className="text-lg font-extrabold text-ink-900">{inventory?.total_items ?? 0}</p></div>
              <div><p className="text-xs text-gray-400">Stock Value</p><p className="text-lg font-extrabold text-primary-700">₹{inventory?.stock_value?.toFixed(0) ?? 0}</p></div>
              <div><p className="text-xs text-gray-400">Low Stock</p><p className="text-lg font-extrabold text-warning-600">{inventory?.low_stock ?? 0}</p></div>
              <div><p className="text-xs text-gray-400">Expiring</p><p className="text-lg font-extrabold text-red-500">{inventory?.expiring ?? 0}</p></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary-600" />
              <p className="font-bold text-ink-900 text-sm">Customer Report</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><p className="text-xs text-gray-400">Total Customers</p><p className="text-lg font-extrabold text-ink-900">{customers?.total_customers ?? 0}</p></div>
              <div><p className="text-xs text-gray-400">Repeat Customers</p><p className="text-lg font-extrabold text-success-600">{customers?.repeat_customers ?? 0}</p></div>
            </div>
            {customers?.top_customers?.length > 0 && (
              <div className="pt-3 border-t border-lavender-50">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Top Spenders</p>
                {customers.top_customers.slice(0, 5).map((c, idx) => (
                  <div key={c.id} className="flex justify-between text-sm py-1">
                    <span className="text-gray-600">#{idx + 1} · {c.id.slice(0, 8)}</span>
                    <span className="font-semibold text-ink-900">₹{c.total_spent.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
