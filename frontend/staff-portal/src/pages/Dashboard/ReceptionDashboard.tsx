import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Users, Clock, Calendar, Activity,
  UserPlus, ShieldAlert, CreditCard, CheckCircle2,
  Printer, X, ChevronRight, Check, Sparkles, RefreshCw,
  UserCheck, QrCode,
} from 'lucide-react';
// FIXED: import from canonical apiClient
import apiClient from '../../apiClient';
import { useAuth } from '../../context/AuthContext';

interface WalkInRequest {
  id: string;
  queue_number: number;
  full_name: string;
  phone: string;
  age: number;
  gender: string;
  reason_for_visit: string;
  symptoms?: string;
  priority_level: string;
  queue_state: string;
  wait_minutes: number;
  billing_status: string;
  billing_amount: number;
  payment_method?: string;
  payment_reference?: string;
}

interface DoctorRosterItem {
  id: string;
  full_name: string;
  specialization: string;
  consultation_fee: number;
  years_of_experience: number;
  active_load: number;
}

interface SearchPatientResult {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  age?: number;
  gender?: string;
  known_allergies?: string;
}

const ReceptionDashboard: React.FC = () => {
  const { user } = useAuth();
  const [queue, setQueue]   = useState<WalkInRequest[]>([]);
  const [stats, setStats]   = useState({ total_pending: 0, state_counts: {} as any });
  const [doctors, setDoctors] = useState<DoctorRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Search
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<SearchPatientResult[]>([]);
  const [isSearching, setIsSearching]     = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Manual form drawer
  const [showManualForm, setShowManualForm] = useState(false);
  const emptyForm = { hospyn_id: '', first_name: '', last_name: '', phone: '', age: '', gender: 'Male', reason_for_visit: '', priority_level: 'normal', symptoms: '' };
  const [formData, setFormData] = useState(emptyForm);

  // Billing drawer
  const [selectedWalkinForBilling, setSelectedWalkinForBilling] = useState<WalkInRequest | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [transactionRef, setTransactionRef]   = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Receipt modal
  const [receiptToPrint, setReceiptToPrint] = useState<WalkInRequest | null>(null);

  // Route picker modal
  const [routingWalkin, setRoutingWalkin] = useState<WalkInRequest | null>(null);

  // QR modal
  const [hospitalQrToken, setHospitalQrToken] = useState<string | null>(null);
  const [showQrModal, setShowQrModal]         = useState(false);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchQueue = async () => {
    try {
      const res = await apiClient.get('/reception/queue');
      setQueue(res.data.data.queue || []);
      setStats({
        total_pending: res.data.data.total_pending || 0,
        state_counts:  res.data.data.state_counts  || {},
      });
    } catch (err) {
      console.error('Failed to fetch queue', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await apiClient.get('/reception/doctors');
      setDoctors(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch doctors', err);
    }
  };

  const fetchQrToken = async () => {
    try {
      // FIXED: endpoint is /reception/qr-token (not /walkin/qr/:id)
      const res = await apiClient.get('/reception/qr-token');
      setHospitalQrToken(res.data.data.token);
    } catch (err) {
      console.error('Failed to fetch QR token', err);
    }
  };

  // ── WebSocket ─────────────────────────────────────────────────────────────

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (wsRef.current) wsRef.current.close();

    // FIXED: VITE_WS_URL should be ws://... not http://...
    // Construct from VITE_API_BASE_URL by swapping protocol
    const httpBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsBase   = httpBase.replace(/^http/, 'ws');
    const wsUrl    = `${wsBase}/api/v1/ws/reception?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen    = () => { setIsWsConnected(true); };
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event !== 'pong') { fetchQueue(); fetchDoctors(); }
      } catch { /* ignore parse errors */ }
    };
    ws.onerror  = ()  => { setIsWsConnected(false); };
    ws.onclose  = ()  => {
      setIsWsConnected(false);
      setTimeout(connectWebSocket, 5000);
    };
  };

  useEffect(() => {
    fetchQueue();
    fetchDoctors();
    fetchQrToken();
    connectWebSocket();

    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);

    return () => {
      clearInterval(ping);
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Patient search debounce ───────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        try {
          const res = await apiClient.get(`/reception/patients/search?q=${encodeURIComponent(searchQuery)}`);
          setSearchResults(res.data.data || []);
          setShowSearchResults(true);
        } catch { /* swallow */ } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const selectPatientFromSearch = (patient: SearchPatientResult) => {
    setFormData({
      hospyn_id: '',
      first_name: patient.first_name,
      last_name:  patient.last_name,
      phone:      patient.phone,
      age:        patient.age ? String(patient.age) : '',
      gender:     patient.gender || 'Male',
      reason_for_visit: '',
      priority_level:   'normal',
      symptoms: patient.known_allergies ? `Known Allergies: ${patient.known_allergies}` : '',
    });
    setShowSearchResults(false);
    setSearchQuery('');
    setShowManualForm(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/reception/queue/manual', {
        ...formData,
        age: parseInt(formData.age, 10),
      });
      setShowManualForm(false);
      setFormData(emptyForm);
      fetchQueue();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to check in patient.');
    }
  };

  const handleRouteWalkin = async (route_to: 'triage' | 'doctor', doc_id?: string) => {
    if (!routingWalkin) return;
    try {
      await apiClient.patch(`/reception/queue/${routingWalkin.id}/accept`, {
        route_to,
        assigned_doctor_id: doc_id,
      });
      setRoutingWalkin(null);
      fetchQueue();
      fetchDoctors();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to route patient.');
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Cancel this walk-in request?')) return;
    try {
      await apiClient.patch(`/reception/queue/${id}/reject`, { reason: 'Cancelled by receptionist' });
      fetchQueue();
    } catch { /* swallow */ }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWalkinForBilling) return;
    setIsProcessingPayment(true);
    try {
      await apiClient.patch(`/reception/queue/${selectedWalkinForBilling.id}/pay`, {
        payment_method:        paymentMethod,
        transaction_reference: transactionRef || null,
      });
      const updated = {
        ...selectedWalkinForBilling,
        billing_status:    'paid',
        payment_method:    paymentMethod,
        payment_reference: transactionRef,
      };
      setSelectedWalkinForBilling(null);
      setTransactionRef('');
      setReceiptToPrint(updated);
      fetchQueue();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Payment failed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const printReceipt = () => {
    const el = document.getElementById('receipt-print-area');
    if (!el) return;
    const w = window.open('about:blank', '_blank', 'width=400,height=600');
    if (!w) return;
    w.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;padding:20px;max-width:300px}.row{display:flex;justify-content:space-between;margin:4px 0}.divider{border-top:1px dashed #000;margin:10px 0}.center{text-align:center}</style></head><body>${el.innerHTML}<script>window.onload=function(){window.print();window.close()}<\/script></body></html>`);
    w.document.close();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-10 bg-[#050505] text-[#f8fafc] font-sans overflow-x-hidden">

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className={`text-[10px] font-black tracking-[0.3em] uppercase ${isWsConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isWsConnected ? 'Live Connection Sync' : 'Offline Mode (Polling)'}
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter leading-none text-white">Reception Hub</h1>
          <p className="text-slate-500 text-sm font-medium">Operations Center · {user?.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => { fetchQueue(); fetchDoctors(); }} className="border border-white/10 bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-2xl font-bold text-[11px] tracking-wider uppercase transition-all flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowQrModal(true)} className="border border-white/10 bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-2xl font-bold text-[11px] tracking-wider uppercase transition-all flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" /> Hospital QR
          </button>
          <button onClick={() => { setFormData(emptyForm); setShowManualForm(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all flex items-center gap-2 shadow-lg">
            <UserPlus size={16} /> Manual Intake
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Waiting',       value: stats.total_pending,                        color: 'text-amber-500',   icon: Users },
          { label: 'Triage',        value: stats.state_counts['in_triage'] || 0,       color: 'text-blue-500',    icon: Activity },
          { label: 'Consultations', value: stats.state_counts['in_consultation'] || 0, color: 'text-indigo-500',  icon: Clock },
          { label: 'Completed',     value: stats.state_counts['completed'] || 0,       color: 'text-emerald-500', icon: Calendar },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
            <stat.icon size={20} className={`${stat.color} mb-3`} />
            <div className={`text-4xl font-black tracking-tighter ${stat.color}`}>{stat.value}</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-12 gap-6">

        {/* Queue list */}
        <div className="col-span-12 xl:col-span-8 space-y-4">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients by name or phone for express check-in..."
              className="w-full bg-white/[0.03] border border-white/5 focus:border-indigo-500 rounded-2xl pl-12 pr-6 py-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
            />
            {isSearching && <RefreshCw size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5">
                {searchResults.map((p) => (
                  <div key={p.id} onClick={() => selectPatientFromSearch(p)}
                    className="p-4 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-all">
                    <div>
                      <h4 className="font-bold text-white text-sm">{p.full_name}</h4>
                      <p className="text-xs text-slate-500">{p.phone} · {p.gender} · {p.age ? `${p.age}y` : 'N/A'}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Queue table */}
          <div className="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Users className="text-indigo-500" size={20} />
                <h3 className="text-lg font-black tracking-tight">Walk-In Waiting Board</h3>
              </div>
              <span className="px-3 py-1.5 bg-indigo-500/10 text-indigo-500 rounded-xl text-[10px] font-black tracking-widest uppercase">
                {queue.length} Pending
              </span>
            </div>

            <div className="divide-y divide-white/5">
              {isLoading && <div className="p-16 text-center text-slate-500">Loading...</div>}
              {!isLoading && queue.length === 0 && (
                <div className="p-16 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                  Queue empty — all patients routed.
                </div>
              )}
              {queue.map((p) => (
                <div key={p.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.01] transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-lg border ${
                      p.priority_level === 'emergency' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' :
                      p.priority_level === 'urgent'    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                      'bg-white/5 text-slate-400 border-white/10'
                    }`}>
                      {p.queue_number}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="text-base font-bold text-white">{p.full_name}</h4>
                        {p.priority_level === 'emergency' && (
                          <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded font-black uppercase">
                            <ShieldAlert size={10} /> Emergency
                          </span>
                        )}
                        {p.billing_status === 'paid' ? (
                          <span onClick={() => setReceiptToPrint(p)} className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-black uppercase cursor-pointer">
                            <Check size={10} /> Paid <Printer size={10} className="ml-1" />
                          </span>
                        ) : (
                          <span onClick={() => setSelectedWalkinForBilling(p)} className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-black uppercase cursor-pointer">
                            <CreditCard size={10} /> Unpaid
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {p.phone} · {p.gender} · {p.age}y · Wait: {p.wait_minutes}m
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRoutingWalkin(p)} className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-4 py-2.5 rounded-xl font-bold text-[10px] tracking-widest uppercase transition-all">
                      Route
                    </button>
                    <button onClick={() => handleReject(p.id)} className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Doctor roster */}
        <div className="col-span-12 xl:col-span-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6">
            <div className="flex items-center gap-3 mb-5">
              <Activity className="text-indigo-500" size={18} />
              <h3 className="text-base font-black uppercase tracking-tight text-white">Live Doctor Roster</h3>
            </div>
            <div className="space-y-3">
              {doctors.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No active doctors on duty.</p>
              ) : doctors.map((doc) => {
                const load = doc.active_load;
                const dot  = load >= 5 ? 'bg-rose-500' : load >= 2 ? 'bg-amber-500' : 'bg-emerald-500';
                const lbl  = load >= 5 ? 'High' : load >= 2 ? 'Moderate' : 'Optimal';
                return (
                  <div key={doc.id} className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white">{doc.full_name}</h4>
                      <p className="text-xs text-slate-500">{doc.specialization}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white block">{load} Queue</span>
                      <span className="inline-flex items-center gap-1.5 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{lbl}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Manual Check-in Drawer ── */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-[#0a0a0a] border-l border-white/10 h-full p-8 flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <UserPlus className="text-indigo-500" size={22} />
                <h3 className="text-lg font-black text-white uppercase">Manual Patient Entry</h3>
              </div>
              <button onClick={() => setShowManualForm(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Hospyn ID <span className="text-emerald-500 ml-2">Optional</span>
                </label>
                <input type="text" placeholder="PAT-999999" value={formData.hospyn_id}
                  onChange={e => setFormData({ ...formData, hospyn_id: e.target.value })}
                  className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 text-sm text-indigo-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(['first_name', 'last_name'] as const).map((f) => (
                  <div key={f}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{f.replace('_', ' ')}</label>
                    <input required type="text" value={formData[f]}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Phone</label>
                <input required type="tel" value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Age</label>
                  <input required type="number" value={formData.age}
                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Gender</label>
                  <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none appearance-none">
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Reason for Visit</label>
                <textarea required value={formData.reason_for_visit}
                  onChange={e => setFormData({ ...formData, reason_for_visit: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none h-20" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Priority</label>
                <select value={formData.priority_level} onChange={e => setFormData({ ...formData, priority_level: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none appearance-none">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[11px] tracking-widest uppercase transition-all mt-4">
                Add to Queue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Route Modal ── */}
      {routingWalkin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0c0c0c] border border-white/10 rounded-3xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Route Patient</h3>
              <button onClick={() => setRoutingWalkin(null)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-400">Route <span className="font-bold text-white">{routingWalkin.full_name}</span> (#{routingWalkin.queue_number})</p>
            <button onClick={() => handleRouteWalkin('triage')} className="w-full p-4 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-between font-bold text-sm">
              <span>Send to Nurse Triage</span><ChevronRight size={18} />
            </button>
            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Direct to Doctor</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {doctors.map(doc => (
                  <button key={doc.id} onClick={() => handleRouteWalkin('doctor', doc.id)}
                    className="w-full p-3 bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded-xl text-left flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white block">{doc.full_name}</span>
                      <span className="text-slate-500">{doc.specialization} · Load: {doc.active_load}</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Billing Drawer ── */}
      {selectedWalkinForBilling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-[#0a0a0a] border-l border-white/10 h-full p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <CreditCard className="text-indigo-500" size={22} />
                <h3 className="text-lg font-bold text-white uppercase">Payment Checkout</h3>
              </div>
              <button onClick={() => setSelectedWalkinForBilling(null)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400"><X size={20} /></button>
            </div>
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 mb-6 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Patient</span><span className="font-bold text-white">{selectedWalkinForBilling.full_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Token</span><span className="font-mono font-bold text-indigo-400">#{selectedWalkinForBilling.queue_number}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold text-white">₹{(selectedWalkinForBilling.billing_amount / 100).toFixed(2)}</span></div>
            </div>
            <form onSubmit={handleCollectPayment} className="space-y-5">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['cash', 'card', 'upi'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                      className={`py-3 rounded-xl border text-xs font-bold uppercase transition-all ${paymentMethod === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {paymentMethod !== 'cash' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Transaction Ref</label>
                  <input required type="text" placeholder="TXN123456789" value={transactionRef}
                    onChange={e => setTransactionRef(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
                </div>
              )}
              <button type="submit" disabled={isProcessingPayment}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-black text-[11px] tracking-widest uppercase transition-all">
                {isProcessingPayment ? 'Processing...' : 'Collect & Mark Paid'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ── */}
      {receiptToPrint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0c0c0c] border border-white/10 rounded-3xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Receipt</h3>
              <button onClick={() => setReceiptToPrint(null)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400"><X size={18} /></button>
            </div>
            <div id="receipt-print-area" className="p-5 bg-white border border-slate-200 text-slate-900 rounded-2xl text-xs">
              <div className="text-center font-bold text-base mb-1">HOSPYN CLINICS</div>
              <div className="text-center text-[10px] text-slate-500 mb-3">INTAKE BILL RECEIPT</div>
              <div className="border-t border-dashed border-slate-300 my-2" />
              <div className="flex justify-between my-1"><span>Patient</span><span className="font-bold">{receiptToPrint.full_name}</span></div>
              <div className="flex justify-between my-1"><span>Token</span><span className="font-bold">#{receiptToPrint.queue_number}</span></div>
              <div className="flex justify-between my-1"><span>Status</span><span className="font-bold text-emerald-600">PAID</span></div>
              <div className="border-t border-dashed border-slate-300 my-2" />
              <div className="flex justify-between my-1 font-bold"><span>Amount</span><span>₹{(receiptToPrint.billing_amount / 100).toFixed(2)}</span></div>
              <div className="flex justify-between my-1 text-slate-500"><span>Method</span><span className="uppercase">{receiptToPrint.payment_method || 'Cash'}</span></div>
              {receiptToPrint.payment_reference && (
                <div className="flex justify-between my-1 text-slate-500"><span>Ref</span><span className="font-mono">{receiptToPrint.payment_reference}</span></div>
              )}
              <div className="border-t border-dashed border-slate-300 mt-3 pt-2 text-center text-[9px] text-slate-400">Thank you for visiting Hospyn Clinics.</div>
            </div>
            <div className="flex gap-3">
              <button onClick={printReceipt} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                <Printer size={14} /> Print
              </button>
              <button onClick={() => setReceiptToPrint(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Modal ── */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-3xl p-8 space-y-6 text-center">
            <div className="flex justify-between items-center text-left">
              <h3 className="text-lg font-bold text-white">Hospital Intake QR</h3>
              <button onClick={() => setShowQrModal(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6 bg-white rounded-2xl inline-block mx-auto">
              {hospitalQrToken ? (
                <div className="space-y-3">
                  <svg className="w-48 h-48 mx-auto" viewBox="0 0 100 100">
                    <rect width="100" height="100" fill="#fff" />
                    <path d="M5 5h30v30H5zm5 5h20v20H10zm0 10h10v10H10zm35-20h50v20H45v10H95V5H45zm5 25h10v10H50zm15 0h20v10H65zm-60 30h30v30H5zm5 5h20v20H10zm30 15h15v15H40zm20 5h10v10H60zm15-5h10v15H75zm10-15h10v10H85zm-5 25h15v5H80z" fill="#000" />
                  </svg>
                  <p className="text-[10px] text-slate-400 font-mono break-all max-w-[240px] mx-auto">{hospitalQrToken}</p>
                </div>
              ) : (
                <p className="text-slate-500 text-xs py-10">Generating...</p>
              )}
            </div>
            <p className="text-xs text-slate-400">Patients scan this to join the digital walk-in queue from their mobile.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionDashboard;
