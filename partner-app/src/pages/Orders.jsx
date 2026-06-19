import React, { useState, useEffect, useCallback } from 'react';
import { ListOrdered, Bell, RefreshCw, Pill } from 'lucide-react';
import apiClient from '../services/apiClient';

// EXECUTION FIX: this page rendered only a static "Awaiting Orders" empty
// state — it never called the backend at all. Wired to the same
// GET /pharmacy/network-orders endpoint Dashboard.jsx's "Network Orders"
// view uses, so prescriptions shared by patients via QR actually show up
// here too.
export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/pharmacy/network-orders');
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
      setError('Could not load orders. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // light polling for a "live feed" feel
    return () => clearInterval(interval);
  }, [fetchOrders]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incoming Orders</h1>
          <p className="text-sm text-gray-500">Live feed of patient prescriptions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchOrders} className="p-2 text-gray-400 hover:text-primary-600 transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {orders.length > 0 && (
            <div className="relative">
              <Bell className="w-6 h-6 text-gray-400" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-gray-50 rounded-full"></span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {!loading && orders.length === 0 && !error && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-4">
            <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ListOrdered className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Awaiting Orders</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              When a patient scans your QR code and shares their prescription, it will pop up here instantly.
            </p>
          </div>
        )}

        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{order.patient_name}</h3>
                <p className="text-xs text-gray-500">{order.patient_phone}</p>
              </div>
              <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                New
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {(order.medications || []).map((med, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                  <Pill className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-medium">{med.name}</span>
                  {med.dosage && <span className="text-gray-400">· {med.dosage}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
