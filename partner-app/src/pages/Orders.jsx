import React, { useState, useEffect, useCallback } from 'react';
import { ListOrdered, Search, Pill, Check, X, Hash, Clock } from 'lucide-react';
import apiClient from '../services/apiClient';

const TABS = [
  { key: 'pending', label: 'New' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'ready', label: 'Ready' },
  { key: 'history', label: 'History' },
];

function OrderCard({ order, onAccept, onReject, onAdvance, onDeliver, onOpenDetail }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <button onClick={() => onOpenDetail(order)} className="w-full text-left">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-bold text-ink-900">{order.patient_name}</p>
            <p className="text-xs text-gray-400">{order.patient_code ? `${order.patient_code} · ` : ''}{order.patient_phone}</p>
          </div>
          {order.token_number ? (
            <span className="flex items-center gap-1 text-sm font-bold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-full">
              <Hash className="w-3.5 h-3.5" /> {order.token_number}
            </span>
          ) : (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {order.shared_at ? new Date(order.shared_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(order.medications || []).map((m, idx) => (
            <span key={idx} className="text-xs bg-lavender-50 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1">
              <Pill className="w-3 h-3" /> {m.name}
            </span>
          ))}
        </div>
      </button>

      {order.status === 'pending' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onReject(order.id)} className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 rounded-xl text-sm flex items-center justify-center gap-1.5">
            <X className="w-4 h-4" /> Reject
          </button>
          <button onClick={() => onAccept(order.id)} className="bg-success-50 hover:bg-success-100 text-success-700 font-semibold py-2 rounded-xl text-sm flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" /> Accept
          </button>
        </div>
      )}
      {order.status === 'accepted' && (
        <button onClick={() => onAdvance(order.id, 'preparing')} className="w-full bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-2 rounded-xl text-sm">
          Reserve Stock — Start Preparing
        </button>
      )}
      {order.status === 'preparing' && (
        <button onClick={() => onAdvance(order.id, 'ready')} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 rounded-xl text-sm">
          Mark Ready
        </button>
      )}
      {order.status === 'ready' && (
        <button onClick={() => onDeliver(order.id)} className="w-full bg-success-600 hover:bg-success-700 text-white font-semibold py-2 rounded-xl text-sm">
          Delivered
        </button>
      )}
      {(order.status === 'delivered' || order.status === 'rejected') && (
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${order.status === 'delivered' ? 'bg-success-100 text-success-700' : 'bg-red-100 text-red-600'}`}>
          {order.status === 'delivered' ? 'Delivered' : 'Rejected'}
        </span>
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-ink-900/40 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 flex items-center justify-between border-b border-lavender-100 sticky top-0 bg-white">
          <h2 className="font-bold text-ink-900">Order Details</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-lavender-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Patient</p>
            <p className="font-bold text-ink-900">{order.patient_name}</p>
            <p className="text-sm text-gray-500">{order.patient_phone} {order.patient_code && `· ${order.patient_code}`}</p>
          </div>
          {order.prescription_image_url ? (
            <img src={order.prescription_image_url} alt="Prescription" className="w-full rounded-xl" />
          ) : (
            <div className="bg-lavender-50 rounded-2xl p-6 text-center text-sm text-gray-400">No prescription image attached.</div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Medicines</p>
            <div className="space-y-1.5">
              {(order.medications || []).map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Pill className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-ink-900">{m.name}</span>
                  <span className="text-gray-400">{m.dosage} · {m.frequency} · {m.duration}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase">Status: <span className="text-primary-600">{order.status}</span></p>
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const [tab, setTab] = useState('pending');
  const [period, setPeriod] = useState('today');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === 'history') {
        params.set('period', period);
        if (search) params.set('q', search);
      } else if (tab === 'accepted') {
        // "Accepted" tab covers accepted + preparing
      } else {
        params.set('status', tab);
      }
      const res = await apiClient.get(`/pharmacy/orders?${params.toString()}`);
      let data = res.data || [];
      if (tab === 'accepted') data = data.filter((o) => ['accepted', 'preparing'].includes(o.status));
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, period, search]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 20000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const act = async (id, action, body) => {
    try {
      if (action === 'accept') await apiClient.post(`/pharmacy/orders/${id}/accept`);
      else if (action === 'reject') await apiClient.post(`/pharmacy/orders/${id}/reject`);
      else await apiClient.post(`/pharmacy/orders/${id}/status`, body);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Action failed.');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-ink-900 mb-4">Orders</h1>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 shadow-card'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-1.5">
            {['today', 'week', 'month'].map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${period === p ? 'bg-primary-100 text-primary-700' : 'bg-white text-gray-400 shadow-card'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient name or mobile..."
              className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl text-sm shadow-card outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading...</p>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          <ListOrdered className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No orders here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onOpenDetail={setDetailOrder}
              onAccept={(id) => act(id, 'accept')}
              onReject={(id) => act(id, 'reject')}
              onAdvance={(id, status) => act(id, 'status', { status })}
              onDeliver={(id) => act(id, 'status', { status: 'delivered' })}
            />
          ))}
        </div>
      )}

      {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}
    </div>
  );
}
