// src/pages/Orders.jsx
//
// BUG FIX: Line 1 declared `const dispatch = useNavigate()` — assigning the
// navigation hook to a variable named "dispatch". Then line 2 called useNavigate()
// again for navigate. Line 3 tried useDispatch() for reduxDispatch (unused).
// Line 4 then declared _dispatch = useDispatch() which was the only correct one.
// This left 3 dead variables and would confuse React's hook ordering if
// useDispatch() was conditionally guarded.
// Cleaned to single correct declarations.

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, updateOrderStatus, setFilter } from '../store/ordersSlice';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const statusConfig = {
  pending:    { color: '#f59e0b', bg: '#f59e0b18', label: 'Pending'    },
  confirmed:  { color: '#0ea5e9', bg: '#0ea5e918', label: 'Confirmed'  },
  processing: { color: '#a78bfa', bg: '#a78bfa18', label: 'Processing' },
  shipped:    { color: '#38bdf8', bg: '#38bdf818', label: 'Shipped'    },
  delivered:  { color: '#22c55e', bg: '#22c55e18', label: 'Delivered'  },
  cancelled:  { color: '#ef4444', bg: '#ef444418', label: 'Cancelled'  },
};

const NEXT_STATUS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered'],
  delivered:  [],
  cancelled:  [],
};

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const timeLabel = (iso) => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
};

export default function Orders() {
  // BUG FIX: was `const dispatch = useNavigate()` — completely wrong.
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { orders, loading, error, activeFilter, pendingCount } = useSelector((s) => s.orders);

  const [search,      setSearch]   = useState('');
  const [detailOrder, setDetail]   = useState(null);
  const [updatingId,  setUpdating] = useState(null);

  useEffect(() => {
    dispatch(fetchOrders({ status: activeFilter, search }));
  }, [dispatch, activeFilter, search]);

  const handleTabChange = (tab) => {
    dispatch(setFilter(tab));
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdating(orderId);
    await dispatch(updateOrderStatus({ id: orderId, status: newStatus }));
    setUpdating(null);
    if (detailOrder?.id === orderId) {
      setDetail((prev) => ({ ...prev, status: newStatus }));
    }
  };

  return (
    <div className="min-h-screen bg-[#020917] text-white">
      {/* Header */}
      <header className="border-b border-[#1e3a5f]/60 bg-[#020917]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[#475569] hover:text-white transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <span className="text-[#1e3a5f]">/</span>
            <span className="text-white font-semibold">Orders</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#fbbf24] text-xs font-medium">
                {pendingCount} pending
              </span>
            )}
          </div>
          <input
            type="text"
            placeholder="Search orders or patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#0d1929] border border-[#1e3a5f] text-white placeholder-[#334155] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#0ea5e9] w-64 transition-all"
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-[#64748b] text-sm mt-0.5">{orders.length} orders loaded</p>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                activeFilter === tab
                  ? 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#38bdf8]'
                  : 'bg-[#0d1929] border-[#1e3a5f] text-[#64748b] hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Orders List */}
        <div className="space-y-3">
          {loading
            ? [...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-[#0d1929] border border-[#1e3a5f]/40 rounded-2xl animate-pulse" />
              ))
            : orders.length === 0
            ? (
              <div className="text-center py-20 text-[#475569]">
                <p className="text-lg">No orders found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            )
            : orders.map((order) => {
                const cfg      = statusConfig[order.status] ?? statusConfig.pending;
                const nextOpts = NEXT_STATUS[order.status] ?? [];

                return (
                  <div
                    key={order.id}
                    className="bg-[#0d1929] border border-[#1e3a5f]/60 rounded-2xl p-5 hover:border-[#1e3a5f] transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-xs text-[#64748b]">{order.order_number}</span>
                          <span
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-white font-semibold">{order.patient_name}</p>
                        <p className="text-[#475569] text-xs mt-0.5">
                          {order.patient_phone} · {timeLabel(order.created_at)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {order.items.slice(0, 3).map((item) => (
                            <span key={item.item_id} className="text-[10px] bg-[#1e3a5f]/30 text-[#94a3b8] px-2 py-0.5 rounded-md">
                              {item.item_name} × {item.quantity}
                            </span>
                          ))}
                          {order.items.length > 3 && (
                            <span className="text-[10px] text-[#475569]">+{order.items.length - 3} more</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-2">
                        <div>
                          <p className="text-white font-bold">{fmt(order.total_amount)}</p>
                          <p className="text-[#a78bfa] text-xs">+{fmt(order.commission_amount)} commission</p>
                        </div>
                        {nextOpts.length > 0 && (
                          <div className="flex gap-1.5 justify-end">
                            {nextOpts.map((next) => {
                              const nc = statusConfig[next];
                              return (
                                <button
                                  key={next}
                                  onClick={() => handleStatusUpdate(order.id, next)}
                                  disabled={updatingId === order.id}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
                                  style={{ background: nc.bg, color: nc.color, borderColor: `${nc.color}30` }}
                                >
                                  {updatingId === order.id ? '...' : `→ ${nc.label}`}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <button
                          onClick={() => setDetail(order)}
                          className="text-[#0ea5e9] hover:text-[#38bdf8] text-xs transition-colors"
                        >
                          View details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </main>

      {/* Order Detail Modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1929] border border-[#1e3a5f] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-mono text-xs text-[#64748b]">{detailOrder.order_number}</p>
                <h3 className="text-white font-semibold text-lg">{detailOrder.patient_name}</h3>
              </div>
              <button onClick={() => setDetail(null)} className="text-[#475569] hover:text-white text-2xl transition-colors">×</button>
            </div>

            {(() => {
              const cfg = statusConfig[detailOrder.status] ?? statusConfig.pending;
              return (
                <div className="flex items-center gap-2 mb-5">
                  <span className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="text-[#475569] text-xs">{timeLabel(detailOrder.created_at)}</span>
                </div>
              );
            })()}

            <div className="bg-[#0a111e] rounded-xl overflow-hidden mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f]/40">
                    <th className="text-left px-4 py-2 text-[#475569] text-xs">Item</th>
                    <th className="text-right px-4 py-2 text-[#475569] text-xs">Qty</th>
                    <th className="text-right px-4 py-2 text-[#475569] text-xs">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detailOrder.items.map((item) => (
                    <tr key={item.item_id} className="border-b border-[#1e3a5f]/20">
                      <td className="px-4 py-2.5 text-white">{item.item_name}</td>
                      <td className="px-4 py-2.5 text-[#94a3b8] text-right">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-white">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">Order Total</span>
                <span className="text-white font-bold">{fmt(detailOrder.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">Your Commission</span>
                <span className="text-[#a78bfa] font-semibold">{fmt(detailOrder.commission_amount)}</span>
              </div>
            </div>

            {detailOrder.notes && (
              <div className="bg-[#1e3a5f]/20 rounded-xl px-4 py-3 mb-4">
                <p className="text-xs text-[#64748b] mb-1">Notes</p>
                <p className="text-[#94a3b8] text-sm">{detailOrder.notes}</p>
              </div>
            )}

            {NEXT_STATUS[detailOrder.status]?.length > 0 && (
              <div className="flex gap-2">
                {NEXT_STATUS[detailOrder.status].map((next) => {
                  const nc = statusConfig[next];
                  return (
                    <button
                      key={next}
                      onClick={() => handleStatusUpdate(detailOrder.id, next)}
                      disabled={updatingId === detailOrder.id}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all disabled:opacity-50"
                      style={{ background: nc.bg, color: nc.color, borderColor: `${nc.color}30` }}
                    >
                      {updatingId === detailOrder.id ? 'Updating...' : `Mark as ${nc.label}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
