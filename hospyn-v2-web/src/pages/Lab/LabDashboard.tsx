// src/pages/Lab/LabDashboard.tsx
// Full lab management dashboard
// - Incoming test orders (from patient app or manual entry)
// - Sample tracking with QR
// - Result upload with auto-flag for abnormal values
// - Digital report delivery to patient app

import React, { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, User, Phone, Plus, RefreshCw, X,
  Upload, CheckCircle2, AlertTriangle, Clock, FileText,
  Loader2, QrCode, ChevronDown, ChevronUp
} from 'lucide-react';
import apiClient from '../../services/apiClient';

interface TestItem {
  test_name: string;
  test_code: string;
  normal_range: string;
  unit: string;
  result_value?: string;
  is_abnormal?: boolean;
}

interface TestOrder {
  id: string;
  order_number: string;
  patient_name: string;
  patient_phone: string;
  patient_id: string | null;
  source: 'app' | 'manual';
  status: 'pending' | 'sample_collected' | 'processing' | 'result_ready' | 'report_sent' | 'cancelled';
  tests: TestItem[];
  sample_qr: string | null;
  report_url: string | null;
  total_amount: number;
  created_at: string;
  notes: string;
}

const statusColor: Record<string, string> = {
  pending:          '#f59e0b',
  sample_collected: '#0ea5e9',
  processing:       '#a78bfa',
  result_ready:     '#f97316',
  report_sent:      '#22c55e',
  cancelled:        '#ef4444',
};

const statusLabel: Record<string, string> = {
  pending:          'Pending',
  sample_collected: 'Sample Collected',
  processing:       'Processing',
  result_ready:     'Results Ready',
  report_sent:      'Report Sent',
  cancelled:        'Cancelled',
};

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function LabDashboard() {
  const [orders,      setOrders]      = useState<TestOrder[]>([]);
  const [active,      setActive]      = useState<TestOrder | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [actionLoad,  setActionLoad]  = useState(false);
  const [error,       setError]       = useState('');
  const [showManual,  setShowManual]  = useState(false);
  const [results,     setResults]     = useState<Record<string, string>>({});
  const [statusFilter,setStatusFilter]= useState('all');
  const [expanded,    setExpanded]    = useState<Record<string, boolean>>({});

  // Manual patient form
  const [manual, setManual] = useState({
    name: '', phone: '',
    tests: [{ test_name: '', test_code: '', price: 0, normal_range: '', unit: '' }],
    notes: ''
  });

  const load = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const { data } = await apiClient.get<TestOrder[]>(`/api/v1/partner/lab/orders${params}`);
      setOrders(data);
      if (active) {
        const refreshed = data.find(o => o.id === active.id);
        if (refreshed) setActive(refreshed);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, active]);

  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);

  const markSampleCollected = async (order: TestOrder) => {
    setActionLoad(true);
    try {
      const { data } = await apiClient.post(`/api/v1/partner/lab/orders/${order.id}/collect-sample`);
      setActive(data);
      await load();
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed'); }
    finally { setActionLoad(false); }
  };

  const markProcessing = async (order: TestOrder) => {
    setActionLoad(true);
    try {
      const { data } = await apiClient.post(`/api/v1/partner/lab/orders/${order.id}/start-processing`);
      setActive(data);
      await load();
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed'); }
    finally { setActionLoad(false); }
  };

  const submitResults = async (order: TestOrder) => {
    const missingValues = order.tests.some(t => !results[t.test_code]?.trim());
    if (missingValues) { setError('Enter result values for all tests before submitting.'); return; }
    setActionLoad(true);
    try {
      const resultPayload = order.tests.map(t => ({
        test_code:    t.test_code,
        test_name:    t.test_name,
        result_value: results[t.test_code],
        normal_range: t.normal_range,
        unit:         t.unit,
      }));
      const { data } = await apiClient.post(`/api/v1/partner/lab/orders/${order.id}/submit-results`, {
        results: resultPayload
      });
      setActive(data);
      setResults({});
      await load();
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed to submit results'); }
    finally { setActionLoad(false); }
  };

  const sendReport = async (order: TestOrder) => {
    setActionLoad(true);
    try {
      const { data } = await apiClient.post(`/api/v1/partner/lab/orders/${order.id}/send-report`);
      setActive(data);
      await load();
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed to send report'); }
    finally { setActionLoad(false); }
  };

  const submitManual = async () => {
    if (!manual.name || !manual.phone || manual.tests.some(t => !t.test_name)) return;
    setActionLoad(true);
    try {
      await apiClient.post('/api/v1/partner/lab/orders/manual', manual);
      setShowManual(false);
      setManual({ name:'', phone:'', tests:[{test_name:'',test_code:'',price:0,normal_range:'',unit:''}], notes:'' });
      await load();
    } catch (e: any) { setError(e?.response?.data?.detail || 'Failed'); }
    finally { setActionLoad(false); }
  };

  const STATUS_TABS = ['all','pending','sample_collected','processing','result_ready','report_sent'];

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#020917] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e3a5f]/60 sticky top-0 z-30 bg-[#020917]/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <FlaskConical size={20} className="text-[#a78bfa]"/>
          <h1 className="text-xl font-bold text-white">Lab Orders</h1>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#fbbf24] text-xs font-semibold animate-pulse">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setLoading(true); load(); }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw size={16}/>
          </button>
          <button onClick={() => setShowManual(true)}
            className="px-4 py-2 rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/20 text-[#a78bfa] text-sm font-medium hover:bg-[#a78bfa]/20 transition-colors flex items-center gap-2">
            <Plus size={14}/> Add Patient Manually
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle size={16}/>{error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14}/></button>
        </div>
      )}

      {/* Status tabs */}
      <div className="px-6 pt-4 flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button key={tab} onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
              statusFilter === tab
                ? 'bg-[#a78bfa]/10 border-[#a78bfa]/30 text-[#a78bfa]'
                : 'bg-[#0d1929] border-[#1e3a5f] text-[#64748b] hover:text-white'
            }`}>
            {tab === 'all' ? 'All' : statusLabel[tab] || tab}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Order list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? [...Array(4)].map((_,i) => (
            <div key={i} className="h-24 bg-[#0d1929] rounded-2xl border border-[#1e3a5f]/40 animate-pulse"/>
          )) : filteredOrders.length === 0 ? (
            <div className="text-center py-20 text-[#334155]">
              <FlaskConical size={40} className="mx-auto mb-3 opacity-30"/>
              <p>No orders found</p>
            </div>
          ) : filteredOrders.map(order => {
            const abnormal = order.tests.filter(t => t.is_abnormal).length;
            const isExpanded = expanded[order.id];
            return (
              <div key={order.id}
                className={`bg-[#0d1929] border rounded-2xl transition-all cursor-pointer ${
                  active?.id === order.id ? 'border-[#a78bfa]/50' : 'border-[#1e3a5f]/60 hover:border-[#1e3a5f]'
                }`}>
                <div className="p-4 flex items-start justify-between gap-4"
                  onClick={() => setActive(active?.id === order.id ? null : order)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-[#475569]">{order.order_number}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background:`${statusColor[order.status]}18`, color:statusColor[order.status] }}>
                        {statusLabel[order.status]}
                      </span>
                      {order.source === 'app' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#7F77DD]/10 text-[#a78bfa] border border-[#7F77DD]/20">Via App</span>
                      )}
                      {abnormal > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                          <AlertTriangle size={10}/>{abnormal} abnormal
                        </span>
                      )}
                    </div>
                    <p className="text-white font-semibold">{order.patient_name}</p>
                    <p className="text-[#475569] text-xs flex items-center gap-1"><Phone size={10}/>{order.patient_phone}</p>
                    <p className="text-slate-500 text-xs mt-1">{order.tests.length} test{order.tests.length !== 1 ? 's' : ''} · {timeAgo(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">₹{order.total_amount.toLocaleString('en-IN')}</span>
                    {active?.id === order.id ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                  </div>
                </div>

                {/* Expanded detail inline */}
                {active?.id === order.id && (
                  <div className="border-t border-[#1e3a5f]/40 p-4 space-y-4">
                    {/* Sample QR */}
                    {order.sample_qr && (
                      <div className="flex items-center gap-3 bg-[#050d18] rounded-xl px-4 py-3">
                        <QrCode size={18} className="text-[#a78bfa]"/>
                        <div>
                          <p className="text-xs text-slate-400">Sample QR</p>
                          <p className="text-white font-mono text-sm">{order.sample_qr}</p>
                        </div>
                      </div>
                    )}

                    {/* Tests */}
                    <div>
                      <p className="text-xs text-[#475569] uppercase tracking-widest mb-2">Tests</p>
                      <div className="space-y-2">
                        {order.tests.map((test, idx) => (
                          <div key={idx} className={`rounded-xl p-3 border ${
                            test.is_abnormal
                              ? 'bg-red-500/5 border-red-500/20'
                              : 'bg-[#050d18] border-[#1e3a5f]/40'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-white text-sm font-medium">{test.test_name}</p>
                                {test.test_code && <p className="text-[#475569] text-xs font-mono">{test.test_code}</p>}
                              </div>
                              {test.result_value ? (
                                <div className="text-right">
                                  <p className={`font-bold text-sm ${test.is_abnormal ? 'text-red-400' : 'text-[#22c55e]'}`}>
                                    {test.result_value} {test.unit}
                                  </p>
                                  <p className="text-[#475569] text-xs">Normal: {test.normal_range}</p>
                                  {test.is_abnormal && (
                                    <span className="text-xs text-red-400 flex items-center gap-1 justify-end">
                                      <AlertTriangle size={10}/>Abnormal
                                    </span>
                                  )}
                                </div>
                              ) : order.status === 'processing' ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder={`Result ${test.unit ? `(${test.unit})` : ''}`}
                                    value={results[test.test_code] || ''}
                                    onChange={e => setResults(r => ({...r, [test.test_code]: e.target.value}))}
                                    onClick={e => e.stopPropagation()}
                                    className="w-32 bg-[#0d1929] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#a78bfa]"
                                  />
                                </div>
                              ) : (
                                <span className="text-[#475569] text-xs">—</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.notes && (
                      <div className="bg-[#050d18] border border-[#1e3a5f]/40 rounded-xl p-3">
                        <p className="text-xs text-[#475569] mb-1">Notes</p>
                        <p className="text-sm text-slate-300">{order.notes}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {order.status === 'pending' && (
                        <button onClick={e => { e.stopPropagation(); markSampleCollected(order); }}
                          disabled={actionLoad}
                          className="flex-1 py-2.5 rounded-xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 text-[#38bdf8] text-sm font-medium hover:bg-[#0ea5e9]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                          {actionLoad ? <Loader2 size={14} className="animate-spin"/> : null}
                          Collect Sample + Generate QR
                        </button>
                      )}
                      {order.status === 'sample_collected' && (
                        <button onClick={e => { e.stopPropagation(); markProcessing(order); }}
                          disabled={actionLoad}
                          className="flex-1 py-2.5 rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/30 text-[#a78bfa] text-sm font-medium hover:bg-[#a78bfa]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                          {actionLoad ? <Loader2 size={14} className="animate-spin"/> : null}
                          Start Processing
                        </button>
                      )}
                      {order.status === 'processing' && (
                        <button onClick={e => { e.stopPropagation(); submitResults(order); }}
                          disabled={actionLoad}
                          className="flex-1 py-2.5 rounded-xl bg-[#f97316]/10 border border-[#f97316]/30 text-[#fb923c] text-sm font-medium hover:bg-[#f97316]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                          {actionLoad ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                          Submit Results
                        </button>
                      )}
                      {order.status === 'result_ready' && (
                        <button onClick={e => { e.stopPropagation(); sendReport(order); }}
                          disabled={actionLoad}
                          className="flex-1 py-2.5 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-sm font-medium hover:bg-[#22c55e]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                          {actionLoad ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
                          Send Report to Patient
                        </button>
                      )}
                      {order.status === 'report_sent' && order.report_url && (
                        <a href={order.report_url} target="_blank" rel="noreferrer"
                          className="flex-1 py-2.5 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-sm font-medium hover:bg-[#22c55e]/20 transition-colors flex items-center justify-center gap-2">
                          <FileText size={14}/> Download Report PDF
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual entry modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1929] border border-[#1e3a5f] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <User size={18}/> Add Patient Manually
              </h3>
              <button onClick={() => setShowManual(false)}><X size={18} className="text-slate-400 hover:text-white"/></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Patient Name</label>
                  <input type="text" value={manual.name} onChange={e => setManual({...manual, name: e.target.value})}
                    className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#a78bfa]"
                    placeholder="Full name"/>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Phone</label>
                  <input type="tel" value={manual.phone} onChange={e => setManual({...manual, phone: e.target.value})}
                    className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#a78bfa]"
                    placeholder="+91 98765 43210"/>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Tests</label>
                <div className="space-y-2">
                  {manual.tests.map((test, idx) => (
                    <div key={idx} className="bg-[#050d18] border border-[#1e3a5f]/60 rounded-xl p-3 space-y-2">
                      <div className="flex gap-2">
                        <input type="text" value={test.test_name}
                          onChange={e => { const t=[...manual.tests]; t[idx]={...t[idx],test_name:e.target.value}; setManual({...manual,tests:t}); }}
                          className="flex-1 bg-[#0d1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#a78bfa]"
                          placeholder="Test name (e.g. CBC, HbA1c)"/>
                        <input type="text" value={test.test_code}
                          onChange={e => { const t=[...manual.tests]; t[idx]={...t[idx],test_code:e.target.value}; setManual({...manual,tests:t}); }}
                          className="w-24 bg-[#0d1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#a78bfa]"
                          placeholder="Code"/>
                        {manual.tests.length > 1 && (
                          <button onClick={() => setManual({...manual, tests: manual.tests.filter((_,i)=>i!==idx)})}>
                            <X size={14} className="text-red-400"/>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={test.normal_range}
                          onChange={e => { const t=[...manual.tests]; t[idx]={...t[idx],normal_range:e.target.value}; setManual({...manual,tests:t}); }}
                          className="flex-1 bg-[#0d1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#a78bfa]"
                          placeholder="Normal range (e.g. 4.0-11.0)"/>
                        <input type="text" value={test.unit}
                          onChange={e => { const t=[...manual.tests]; t[idx]={...t[idx],unit:e.target.value}; setManual({...manual,tests:t}); }}
                          className="w-20 bg-[#0d1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#a78bfa]"
                          placeholder="Unit"/>
                        <input type="number" value={test.price} min={0}
                          onChange={e => { const t=[...manual.tests]; t[idx]={...t[idx],price:parseFloat(e.target.value)||0}; setManual({...manual,tests:t}); }}
                          className="w-20 bg-[#0d1929] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#a78bfa]"
                          placeholder="₹"/>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setManual({...manual, tests:[...manual.tests,{test_name:'',test_code:'',price:0,normal_range:'',unit:''}]})}
                  className="mt-2 text-xs text-[#a78bfa] hover:text-[#c4b5fd]">+ Add test</button>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Notes (optional)</label>
                <textarea value={manual.notes} onChange={e => setManual({...manual, notes: e.target.value})}
                  className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#a78bfa] h-20 resize-none"
                  placeholder="Doctor's instructions, special requirements..."/>
              </div>

              <button onClick={submitManual} disabled={actionLoad}
                className="w-full py-3 rounded-xl bg-[#a78bfa]/10 border border-[#a78bfa]/30 text-[#a78bfa] font-semibold hover:bg-[#a78bfa]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
