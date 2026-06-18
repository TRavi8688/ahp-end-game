// src/pages/Queue/PharmacyQueue.tsx
// Live prescription queue for pharmacy counter/desktop
// Staff sees incoming Rx cards, checks stock, swaps substitutes, triggers UPI, marks done

import React, { useEffect, useState, useCallback } from 'react';
import { Clock, CheckCircle2, AlertTriangle, RefreshCw, User, Phone, X, ArrowRightLeft, Loader2 } from 'lucide-react';
import apiClient from '../../services/apiClient';

interface RxItem {
  medicine_name: string;
  generic_name: string;
  quantity: number;
  dosage: string;
  in_stock: boolean;
  stock_qty: number;
  substitute?: { id: string; name: string; price: number } | null;
}

interface Prescription {
  id: string;
  queue_number: number;
  patient_name: string;
  patient_phone: string;
  patient_id: string | null;
  source: 'app' | 'manual';
  status: 'waiting' | 'accepted' | 'billing' | 'payment_pending' | 'done' | 'cancelled';
  items: RxItem[];
  total_amount: number;
  accepted_by: string | null;
  created_at: string;
  notes: string;
}

interface ManualPatient {
  name: string;
  phone: string;
  items: { medicine_name: string; quantity: number; price: number }[];
}

const statusColor: Record<string, string> = {
  waiting:         '#f59e0b',
  accepted:        '#0ea5e9',
  billing:         '#a78bfa',
  payment_pending: '#f97316',
  done:            '#22c55e',
  cancelled:       '#ef4444',
};

const statusLabel: Record<string, string> = {
  waiting:         'Waiting',
  accepted:        'Accepted',
  billing:         'Billing',
  payment_pending: 'Awaiting Payment',
  done:            'Done',
  cancelled:       'Cancelled',
};

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function PharmacyQueue() {
  const [queue,       setQueue]       = useState<Prescription[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [active,      setActive]      = useState<Prescription | null>(null);
  const [actionLoad,  setActionLoad]  = useState(false);
  const [showManual,  setShowManual]  = useState(false);
  const [upiStatus,   setUpiStatus]   = useState<'idle'|'pending'|'confirmed'|'failed'>('idle');
  const [swaps,       setSwaps]       = useState<Record<string, boolean>>({});

  // Manual entry form state
  const [manual, setManual] = useState<ManualPatient>({
    name: '', phone: '',
    items: [{ medicine_name: '', quantity: 1, price: 0 }]
  });

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Prescription[]>('/api/v1/partner/queue');
      setQueue(data);
      // refresh active card if open
      if (active) {
        const refreshed = data.find(p => p.id === active.id);
        if (refreshed) setActive(refreshed);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [active]);

  // Poll every 8 seconds — real-time feel without websocket complexity
  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  const accept = async (rx: Prescription) => {
    setActionLoad(true);
    try {
      const { data } = await apiClient.post(`/api/v1/partner/queue/${rx.id}/accept`);
      setActive(data);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to accept');
    } finally {
      setActionLoad(false);
    }
  };

  const applySwap = async (rxId: string, itemName: string) => {
    setSwaps(s => ({ ...s, [itemName]: true }));
    try {
      await apiClient.post(`/api/v1/partner/queue/${rxId}/swap`, { original_name: itemName });
      await load();
    } catch {}
  };

  const triggerBilling = async (rx: Prescription) => {
    setActionLoad(true);
    try {
      const { data } = await apiClient.post(`/api/v1/partner/queue/${rx.id}/bill`);
      setActive(data);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Billing failed');
    } finally {
      setActionLoad(false);
    }
  };

  const triggerUPI = async (rx: Prescription) => {
    setUpiStatus('pending');
    try {
      // Get UPI deep link from backend
      const { data } = await apiClient.post(`/api/v1/partner/queue/${rx.id}/payment/initiate`);
      // Open UPI deep link — works on mobile; on desktop shows QR
      window.open(data.upi_link, '_blank');
      // Poll for confirmation for up to 90s
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const { data: status } = await apiClient.get(`/api/v1/partner/queue/${rx.id}/payment/status`);
          if (status.paid) {
            clearInterval(poll);
            setUpiStatus('confirmed');
            await load();
            setTimeout(() => setUpiStatus('idle'), 3000);
          }
        } catch {}
        if (attempts >= 18) { // 90s timeout
          clearInterval(poll);
          setUpiStatus('failed');
        }
      }, 5000);
    } catch (e: any) {
      setUpiStatus('failed');
    }
  };

  const cancel = async (rx: Prescription) => {
    setActionLoad(true);
    try {
      await apiClient.post(`/api/v1/partner/queue/${rx.id}/cancel`);
      setActive(null);
      await load();
    } catch {} finally { setActionLoad(false); }
  };

  const submitManual = async () => {
    if (!manual.name || !manual.phone || manual.items.some(i => !i.medicine_name)) return;
    setActionLoad(true);
    try {
      await apiClient.post('/api/v1/partner/queue/manual', manual);
      setShowManual(false);
      setManual({ name: '', phone: '', items: [{ medicine_name: '', quantity: 1, price: 0 }] });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to add');
    } finally {
      setActionLoad(false);
    }
  };

  const waiting    = queue.filter(q => q.status === 'waiting');
  const inProgress = queue.filter(q => ['accepted','billing','payment_pending'].includes(q.status));
  const done       = queue.filter(q => ['done','cancelled'].includes(q.status));

  return (
    <div className="min-h-screen bg-[#020917] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e3a5f]/60 sticky top-0 z-30 bg-[#020917]/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Prescription Queue</h1>
          {waiting.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#fbbf24] text-xs font-semibold animate-pulse">
              {waiting.length} waiting
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setLoading(true); load(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowManual(true)}
            className="px-4 py-2 rounded-xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/20 text-[#38bdf8] text-sm font-medium hover:bg-[#0ea5e9]/20 transition-colors">
            + Add Patient Manually
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14}/></button>
        </div>
      )}

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* LEFT: Queue columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 content-start">

          {/* WAITING */}
          <div>
            <div className="text-xs font-semibold text-[#f59e0b] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse inline-block"/> Waiting ({waiting.length})
            </div>
            <div className="space-y-3">
              {loading ? [...Array(3)].map((_,i) => (
                <div key={i} className="h-28 bg-[#0d1929] rounded-2xl border border-[#1e3a5f]/40 animate-pulse"/>
              )) : waiting.map(rx => (
                <QueueCard key={rx.id} rx={rx} onClick={() => setActive(rx)} onAccept={() => accept(rx)} actionLoad={actionLoad}/>
              ))}
              {!loading && waiting.length === 0 && (
                <div className="text-center py-10 text-[#334155] text-sm">No prescriptions waiting</div>
              )}
            </div>
          </div>

          {/* IN PROGRESS */}
          <div>
            <div className="text-xs font-semibold text-[#0ea5e9] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0ea5e9] inline-block"/> In Progress ({inProgress.length})
            </div>
            <div className="space-y-3">
              {inProgress.map(rx => (
                <QueueCard key={rx.id} rx={rx} onClick={() => setActive(rx)} actionLoad={actionLoad}/>
              ))}
              {inProgress.length === 0 && (
                <div className="text-center py-10 text-[#334155] text-sm">Nothing in progress</div>
              )}
            </div>
          </div>

          {/* DONE */}
          <div>
            <div className="text-xs font-semibold text-[#22c55e] uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block"/> Done today ({done.length})
            </div>
            <div className="space-y-3">
              {done.slice(0, 10).map(rx => (
                <QueueCard key={rx.id} rx={rx} onClick={() => setActive(rx)} actionLoad={actionLoad}/>
              ))}
              {done.length === 0 && (
                <div className="text-center py-10 text-[#334155] text-sm">None completed yet</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Active Rx detail */}
        {active && (
          <div className="w-full lg:w-[400px] border-l border-[#1e3a5f]/60 bg-[#050d18] flex flex-col overflow-y-auto">
            <div className="p-5 border-b border-[#1e3a5f]/40 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-[#475569]">#{active.queue_number}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: `${statusColor[active.status]}18`, color: statusColor[active.status] }}>
                    {statusLabel[active.status]}
                  </span>
                  {active.source === 'app' && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-[#7F77DD]/10 text-[#a78bfa] border border-[#7F77DD]/20">Via App</span>
                  )}
                </div>
                <p className="text-white font-bold text-lg">{active.patient_name}</p>
                <p className="text-[#475569] text-sm flex items-center gap-1"><Phone size={12}/>{active.patient_phone}</p>
              </div>
              <button onClick={() => setActive(null)} className="text-[#475569] hover:text-white p-1"><X size={18}/></button>
            </div>

            {/* Medicine list */}
            <div className="p-5 flex-1">
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-widest mb-3">Medicines</p>
              <div className="space-y-3">
                {active.items.map((item, idx) => (
                  <div key={idx} className={`rounded-xl p-3 border ${
                    !item.in_stock
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-[#0d1929] border-[#1e3a5f]/40'
                  }`}>
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-white font-medium text-sm">{item.medicine_name}</p>
                        {item.generic_name && <p className="text-[#475569] text-xs">{item.generic_name}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-slate-300 text-sm">×{item.quantity}</p>
                        {item.dosage && <p className="text-[#475569] text-xs">{item.dosage}</p>}
                      </div>
                    </div>

                    {item.in_stock ? (
                      <div className="flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} className="text-[#22c55e]"/>
                        <span className="text-[#22c55e] text-xs">{item.stock_qty} in stock</span>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="flex items-center gap-1 mb-2">
                          <AlertTriangle size={12} className="text-red-400"/>
                          <span className="text-red-400 text-xs">Out of stock</span>
                        </div>
                        {item.substitute && !swaps[item.medicine_name] && (
                          <button onClick={() => applySwap(active.id, item.medicine_name)}
                            className="flex items-center gap-1.5 text-xs text-[#a78bfa] bg-[#a78bfa]/10 border border-[#a78bfa]/20 px-3 py-1.5 rounded-lg hover:bg-[#a78bfa]/20 transition-colors w-full">
                            <ArrowRightLeft size={11}/>
                            Swap → {item.substitute.name} (₹{item.substitute.price})
                          </button>
                        )}
                        {swaps[item.medicine_name] && (
                          <span className="text-xs text-[#22c55e]">✓ Swapped to {item.substitute?.name}</span>
                        )}
                        {!item.substitute && (
                          <span className="text-xs text-[#475569]">No substitute found — inform patient</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {active.notes && (
                <div className="mt-4 bg-[#0d1929] border border-[#1e3a5f]/40 rounded-xl p-3">
                  <p className="text-xs text-[#475569] mb-1">Patient notes</p>
                  <p className="text-sm text-slate-300">{active.notes}</p>
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="p-5 border-t border-[#1e3a5f]/40 space-y-3">
              {/* Total */}
              {active.total_amount > 0 && (
                <div className="flex justify-between items-center bg-[#0d1929] rounded-xl px-4 py-3">
                  <span className="text-slate-400 text-sm">Total</span>
                  <span className="text-white font-bold text-xl">₹{active.total_amount.toLocaleString('en-IN')}</span>
                </div>
              )}

              {/* UPI payment status */}
              {upiStatus === 'pending' && (
                <div className="flex items-center gap-2 bg-[#f97316]/10 border border-[#f97316]/20 rounded-xl px-4 py-3 text-[#fb923c] text-sm">
                  <Loader2 size={14} className="animate-spin"/> Waiting for UPI confirmation...
                </div>
              )}
              {upiStatus === 'confirmed' && (
                <div className="flex items-center gap-2 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl px-4 py-3 text-[#22c55e] text-sm">
                  <CheckCircle2 size={14}/> Payment confirmed — receipt sent to patient
                </div>
              )}
              {upiStatus === 'failed' && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  <AlertTriangle size={14}/> Payment timeout — collect cash or retry
                </div>
              )}

              {/* Action buttons based on status */}
              {active.status === 'waiting' && (
                <button onClick={() => accept(active)} disabled={actionLoad}
                  className="w-full py-3 rounded-xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 text-[#38bdf8] font-semibold hover:bg-[#0ea5e9]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {actionLoad ? <Loader2 size={16} className="animate-spin"/> : null}
                  Accept Prescription
                </button>
              )}

              {active.status === 'accepted' && (
                <button onClick={() => triggerBilling(active)} disabled={actionLoad}
                  className="w-full py-3 rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/30 text-[#a78bfa] font-semibold hover:bg-[#a78bfa]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {actionLoad ? <Loader2 size={16} className="animate-spin"/> : null}
                  Confirm & Generate Bill
                </button>
              )}

              {active.status === 'billing' && (
                <button onClick={() => triggerUPI(active)} disabled={upiStatus === 'pending'}
                  className="w-full py-3 rounded-xl bg-[#f97316]/10 border border-[#f97316]/30 text-[#fb923c] font-bold text-base hover:bg-[#f97316]/20 transition-colors disabled:opacity-50">
                  Collect Payment via UPI →
                </button>
              )}

              {!['done','cancelled'].includes(active.status) && (
                <button onClick={() => cancel(active)} disabled={actionLoad}
                  className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 text-sm hover:bg-red-500/10 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual patient entry modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1929] border border-[#1e3a5f] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-bold text-lg flex items-center gap-2"><User size={18}/> Add Patient Manually</h3>
              <button onClick={() => setShowManual(false)}><X size={18} className="text-slate-400 hover:text-white"/></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Patient Name</label>
                <input type="text" value={manual.name} onChange={e => setManual({...manual, name: e.target.value})}
                  className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ea5e9]"
                  placeholder="Full name"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Phone Number</label>
                <input type="tel" value={manual.phone} onChange={e => setManual({...manual, phone: e.target.value})}
                  className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ea5e9]"
                  placeholder="+91 98765 43210"/>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Medicines</label>
                <div className="space-y-2">
                  {manual.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="text" value={item.medicine_name}
                        onChange={e => {
                          const items = [...manual.items];
                          items[idx] = {...items[idx], medicine_name: e.target.value};
                          setManual({...manual, items});
                        }}
                        className="flex-1 bg-[#050d18] border border-[#1e3a5f] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0ea5e9]"
                        placeholder="Medicine name"/>
                      <input type="number" value={item.quantity} min={1}
                        onChange={e => {
                          const items = [...manual.items];
                          items[idx] = {...items[idx], quantity: parseInt(e.target.value)||1};
                          setManual({...manual, items});
                        }}
                        className="w-16 bg-[#050d18] border border-[#1e3a5f] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0ea5e9]"/>
                      <input type="number" value={item.price} min={0}
                        onChange={e => {
                          const items = [...manual.items];
                          items[idx] = {...items[idx], price: parseFloat(e.target.value)||0};
                          setManual({...manual, items});
                        }}
                        className="w-20 bg-[#050d18] border border-[#1e3a5f] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0ea5e9]"
                        placeholder="₹"/>
                      {manual.items.length > 1 && (
                        <button onClick={() => setManual({...manual, items: manual.items.filter((_,i) => i !== idx)})}>
                          <X size={14} className="text-red-400"/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setManual({...manual, items: [...manual.items, {medicine_name:'',quantity:1,price:0}]})}
                  className="mt-2 text-xs text-[#0ea5e9] hover:text-[#38bdf8]">+ Add medicine</button>
              </div>

              <button onClick={submitManual} disabled={actionLoad}
                className="w-full py-3 rounded-xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 text-[#38bdf8] font-semibold hover:bg-[#0ea5e9]/20 transition-colors mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoad ? <Loader2 size={16} className="animate-spin"/> : null}
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QueueCard({ rx, onClick, onAccept, actionLoad }: {
  rx: Prescription;
  onClick: () => void;
  onAccept?: () => void;
  actionLoad?: boolean;
}) {
  const outOfStock = rx.items.filter(i => !i.in_stock).length;
  return (
    <div onClick={onClick}
      className="bg-[#0d1929] border border-[#1e3a5f]/60 rounded-2xl p-4 cursor-pointer hover:border-[#1e3a5f] transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[#475569] font-mono text-xs">#{rx.queue_number}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: `${statusColor[rx.status]}18`, color: statusColor[rx.status] }}>
            {statusLabel[rx.status]}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[#475569] text-xs">
          <Clock size={11}/>{timeAgo(rx.created_at)}
        </div>
      </div>

      <p className="text-white font-semibold text-sm">{rx.patient_name}</p>
      <p className="text-[#475569] text-xs mb-2">{rx.patient_phone}</p>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{rx.items.length} medicine{rx.items.length !== 1 ? 's' : ''}</p>
        {outOfStock > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
            <AlertTriangle size={9}/>{outOfStock} out of stock
          </span>
        )}
      </div>

      {rx.status === 'waiting' && onAccept && (
        <button onClick={e => { e.stopPropagation(); onAccept(); }} disabled={actionLoad}
          className="mt-3 w-full py-2 rounded-lg bg-[#0ea5e9]/10 border border-[#0ea5e9]/20 text-[#38bdf8] text-xs font-medium hover:bg-[#0ea5e9]/20 transition-colors disabled:opacity-50">
          Accept
        </button>
      )}
    </div>
  );
}
