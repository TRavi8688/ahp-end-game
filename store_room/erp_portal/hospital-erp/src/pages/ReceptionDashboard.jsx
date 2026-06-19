import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users, UserPlus, Search, Activity, Clock, ArrowRight,
  ChevronDown, IndianRupee, QrCode, Settings, Stethoscope,
  Calendar, FileText, LayoutDashboard, Filter, X, RefreshCw,
  TrendingUp, CheckCircle2, AlertTriangle, Download, Eye,
  CreditCard, Banknote, Hash, Phone, Droplet, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient';

/* ─── helpers ─────────────────────────────────────────── */
const token = () => localStorage.getItem('token');
const headers = () => ({ Authorization: `Bearer ${token()}` });
const today = () => new Date().toISOString().split('T')[0];
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

/* ─── small reusable badge ──────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    active: 'bg-indigo-500/20 text-indigo-300',
    ACTIVE: 'bg-indigo-500/20 text-indigo-300',
    completed: 'bg-emerald-500/20 text-emerald-400',
    COMPLETED: 'bg-emerald-500/20 text-emerald-400',
    PAID: 'bg-emerald-500/20 text-emerald-400',
    DRAFT: 'bg-slate-500/20 text-slate-400',
    cancelled: 'bg-rose-500/20 text-rose-400',
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${map[status] || 'bg-slate-700 text-slate-400'}`}>
      {status}
    </span>
  );
};

/* ─── payment method pill ───────────────────────────────── */
const PayBadge = ({ method }) => {
  const isUPI = method?.toUpperCase() === 'UPI';
  return (
    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest ${isUPI ? 'bg-violet-500/20 text-violet-400' : 'bg-amber-500/20 text-amber-400'}`}>
      {isUPI ? <QrCode size={10} /> : <Banknote size={10} />}
      {method || 'CASH'}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const ReceptionDashboard = () => {
  /* ── navigation ─────────────────────────────── */
  const [view, setView] = useState('desk');

  /* ── global loading / error ─────────────────── */
  const [loading, setLoading] = useState(false);

  /* ── reception desk state ───────────────────── */
  const [searchTerm, setSearchTerm]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayCount, setTodayCount]     = useState(0);

  /* ── modals ─────────────────────────────────── */
  const [showRegister, setShowRegister] = useState(false);
  const [showCheckIn, setShowCheckIn]   = useState(false);
  const [selectedPt, setSelectedPt]     = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [toast, setToast]               = useState(null);

  /* ── new patient form ───────────────────────── */
  const [np, setNp] = useState({ first_name:'', last_name:'', phone_number:'', date_of_birth:'', gender:'Male', blood_group:'O+' });

  /* ── check-in form ──────────────────────────── */
  const [ci, setCi] = useState({ visit_reason:'', symptoms:'', department:'General Medicine', is_emergency:false, op_fee:'', payment_method:'CASH', transaction_id:'', doctor_name:'' });

  /* ── directory ──────────────────────────────── */
  const [patients, setPatients]         = useState([]);
  const [ptSearch, setPtSearch]         = useState('');

  /* ── appointments ───────────────────────────── */
  const [appointments, setAppointments] = useState([]);
  const [apptFilter, setApptFilter]     = useState('all');

  /* ── doctor roster ──────────────────────────── */
  const [doctors, setDoctors]           = useState([]);

  /* ── billing ledger ─────────────────────────── */
  const [ledger, setLedger]             = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerFilters, setLedgerFilters] = useState({ date_from: today(), date_to: today(), payment_method: '', search: '' });
  const [ledgerSummary, setLedgerSummary] = useState({ total: 0, cash: 0, upi: 0, count: 0 });
  const [showFilters, setShowFilters]   = useState(false);

  /* ── staff status ───────────────────────────── */
  const [staffStatus, setStaffStatus]   = useState('ACTIVE');
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const STATUS_OPTS = [
    { label:'ACTIVE',       color:'text-emerald-400', dot:'bg-emerald-400' },
    { label:'BIO BREAK',    color:'text-amber-400',   dot:'bg-amber-400'   },
    { label:'LUNCH BREAK',  color:'text-orange-400',  dot:'bg-orange-400'  },
    { label:'IN MEETING',   color:'text-rose-400',    dot:'bg-rose-400'    },
  ];
  const activeStat = STATUS_OPTS.find(s => s.label === staffStatus) || STATUS_OPTS[0];

  /* ══ FETCH FUNCTIONS ══════════════════════════════════ */
  const fetchQueue = useCallback(async () => {
    try {
      const r = await apiClient.get('/visit/reception/appointments', { headers: headers() });
      const active = r.data.filter(a => ['active','ACTIVE'].includes(a.status));
      setWaitingQueue(active);
    } catch (e) { console.error('queue', e); }
  }, []);

  const fetchPatients = useCallback(async () => {
    try {
      const r = await apiClient.get('/patient/reception/directory', { headers: headers() });
      setPatients(r.data);
    } catch (e) { console.error('patients', e); }
  }, []);

  const fetchAppointments = useCallback(async () => {
    try {
      const r = await apiClient.get('/visit/reception/appointments', { headers: headers() });
      setAppointments(r.data);
    } catch (e) { console.error('appts', e); }
  }, []);

  const fetchDoctors = useCallback(async () => {
    try {
      const r = await apiClient.get('/staff/members', { headers: headers() });
      setDoctors((r.data || []).filter(m => m.user?.role === 'doctor'));
    } catch (e) { console.error('docs', e); }
  }, []);

  const fetchLedger = useCallback(async (filters) => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_from)      params.append('date_from', filters.date_from);
      if (filters.date_to)        params.append('date_to',   filters.date_to);
      if (filters.payment_method) params.append('payment_method', filters.payment_method);
      if (filters.search)         params.append('search', filters.search);
      const r = await apiClient.get(`/billing/reception/op-payments?${params}`, { headers: headers() });
      const data = r.data || [];
      setLedger(data);
      const total = data.reduce((a, c) => a + (c.payable_amount || 0), 0);
      const cash  = data.filter(d => d.payment_method === 'CASH').reduce((a, c) => a + (c.payable_amount || 0), 0);
      const upi   = data.filter(d => d.payment_method === 'UPI').reduce((a,  c) => a + (c.payable_amount || 0), 0);
      setLedgerSummary({ total, cash, upi, count: data.length });
    } catch (e) { console.error('ledger', e); }
    finally { setLedgerLoading(false); }
  }, []);

  const fetchTodayRevenue = useCallback(async () => {
    try {
      const params = new URLSearchParams({ date_from: today(), date_to: today() });
      const r = await apiClient.get(`/billing/reception/op-payments?${params}`, { headers: headers() });
      const total = (r.data || []).reduce((a, c) => a + (c.payable_amount || 0), 0);
      setTodayRevenue(total);
      setTodayCount((r.data || []).length);
    } catch (e) { console.error('revenue', e); }
  }, []);

  /* ── initial load ─────────────────────────────────── */
  useEffect(() => {
    fetchQueue();
    fetchDoctors();
    fetchTodayRevenue();
    const interval = setInterval(fetchQueue, 60000);
    return () => clearInterval(interval);
  }, []);

  /* ── load per view ────────────────────────────────── */
  useEffect(() => {
    if (view === 'directory')   fetchPatients();
    if (view === 'appointments') fetchAppointments();
    if (view === 'roster')      fetchDoctors();
    if (view === 'ledger')      fetchLedger(ledgerFilters);
  }, [view]);

  /* ── patient search ───────────────────────────────── */
  useEffect(() => {
    if (searchTerm.length < 3) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await apiClient.get(`/patients/search?q=${encodeURIComponent(searchTerm)}`, { headers: headers() });
        setSearchResults(r.data || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  /* ── group ledger by date ─────────────────────────── */
  const ledgerByDate = ledger.reduce((acc, row) => {
    const d = row.date_display || row.date?.split('T')[0] || 'Unknown';
    if (!acc[d]) acc[d] = [];
    acc[d].push(row);
    return acc;
  }, {});

  /* ── toast helper ─────────────────────────────────── */
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── staff status save ────────────────────────────── */
  const changeStatus = async (label) => {
    setStaffStatus(label);
    setShowStatusDrop(false);
    try {
      await apiClient.put('/profile/status', { status: label }, { headers: headers() });
    } catch (e) { console.error('status', e); }
  };

  /* ── register patient ─────────────────────────────── */
  const handleRegister = async () => {
    if (!np.first_name || !np.phone_number) { showToast('First name and phone are required.', 'error'); return; }
    setSubmitting(true);
    try {
      const r = await apiClient.post('/patients/', np, { headers: headers() });
      showToast(`Patient ${r.data.hospyn_id} registered!`);
      setSelectedPt(r.data);
      setShowRegister(false);
      setShowCheckIn(true);
      fetchPatients();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Registration failed', 'error');
    }
    setSubmitting(false);
  };

  /* ── check-in / dispatch ──────────────────────────── */
  const handleCheckIn = async () => {
    if (!ci.visit_reason) { showToast('Visit reason is required.', 'error'); return; }
    if (ci.payment_method === 'UPI' && Number(ci.op_fee) > 0 && !ci.transaction_id) {
      showToast('UPI Transaction ID is required.', 'error'); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        patient_id: selectedPt.id,
        visit_reason: ci.is_emergency ? `[EMERGENCY] ${ci.visit_reason}` : ci.visit_reason,
        symptoms: ci.symptoms,
        department: ci.department,
        doctor_name: ci.doctor_name || undefined,
        op_fee: Number(ci.op_fee) || 0,
        payment_method: ci.payment_method,
        transaction_id: ci.transaction_id || undefined,
      };
      const r = await apiClient.post('/visit/reception/check-in', payload, { headers: headers() });
      showToast(`✓ Checked in! Token: ${r.data.queue_token}`);
      setShowCheckIn(false);
      setCi({ visit_reason:'', symptoms:'', department:'General Medicine', is_emergency:false, op_fee:'', payment_method:'CASH', transaction_id:'', doctor_name:'' });
      setSelectedPt(null);
      setSearchTerm('');
      setSearchResults([]);
      fetchQueue();
      fetchTodayRevenue();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Check-in failed', 'error');
    }
    setSubmitting(false);
  };

  /* ═══════════════════════════════════════════════════════
     SIDEBAR NAV
  ═══════════════════════════════════════════════════════ */
  const NAV = [
    { id:'desk',         label:'Reception Desk',    icon: LayoutDashboard },
    { id:'directory',    label:'Patient Directory',  icon: Users           },
    { id:'appointments', label:'Appointments',       icon: Calendar        },
    { id:'roster',       label:'Doctor Roster',      icon: Stethoscope     },
    { id:'ledger',       label:'Billing Ledger',     icon: FileText        },
  ];

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen bg-[#020917] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ────────────────────── SIDEBAR ────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-white/[0.06] bg-[#080f1e] flex flex-col">

        {/* Logo */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[28px] font-black tracking-tight text-white leading-none">HOSPYN</span>
            <span className="text-[28px] font-black text-indigo-500 leading-none">.</span>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500 mt-1">Enterprise OS</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600 px-3 mb-3">Main Menu</p>
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/25'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={18} className={active ? 'text-indigo-400' : 'text-slate-600'} />
                {label}
                {id === 'desk' && waitingQueue.length > 0 && (
                  <span className="ml-auto bg-indigo-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                    {waitingQueue.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-white/[0.06]">
          <Link to="/settings" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] rounded-xl text-sm font-semibold transition-all">
            <Settings size={18} className="text-slate-600" /> System Settings
          </Link>
          <div className="mt-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-xs shrink-0">RC</div>
            <div>
              <p className="text-xs font-bold text-white">Receptionist</p>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Active Shift</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ────────────────────── MAIN ────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

        {/* Top Bar */}
        <header className="h-16 border-b border-white/[0.06] bg-[#080f1e]/80 backdrop-blur-xl flex items-center justify-between px-8 shrink-0">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              {NAV.find(n => n.id === view)?.label}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Revenue pill */}
            <div className="flex items-center gap-2.5 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl px-4 py-2">
              <TrendingUp size={15} className="text-emerald-400" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70">Today's Revenue</p>
                <p className="text-sm font-black text-white leading-none">₹{fmt(todayRevenue)}</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 rounded-md px-1.5 py-0.5">{todayCount} OP</span>
            </div>

            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDrop(v => !v)}
                className="flex items-center gap-2.5 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 hover:bg-white/[0.07] transition-all"
              >
                <span className={`w-2 h-2 rounded-full animate-pulse ${activeStat.dot}`} />
                <span className={`text-xs font-black tracking-widest ${activeStat.color}`}>{staffStatus}</span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>
              {showStatusDrop && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[#0f1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                  {STATUS_OPTS.map(opt => (
                    <button key={opt.label} onClick={() => changeStatus(opt.label)}
                      className="w-full text-left px-4 py-3 hover:bg-white/[0.05] flex items-center gap-3 transition-colors">
                      <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                      <span className={`text-xs font-bold tracking-wider ${opt.color}`}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* New Patient button */}
            <button
              onClick={() => setShowRegister(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/30"
            >
              <UserPlus size={16} /> New Patient
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* ══════════════ RECEPTION DESK ══════════════ */}
          {view === 'desk' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">

              {/* Patient Search Panel */}
              <div className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-base font-black uppercase tracking-widest text-white mb-5 flex items-center gap-2">
                  <Search size={16} className="text-indigo-400" /> Patient Lookup
                </h3>

                <div className="relative mb-6">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  {searching && <RefreshCw size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />}
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search by name, phone, or Hospyn ID…"
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3.5 pl-11 pr-11 text-white text-sm font-medium placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>

                {/* Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {searchResults.map(pt => (
                      <div key={pt.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 hover:bg-white/[0.06] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 font-black flex items-center justify-center text-sm">
                            {pt.first_name?.[0]}{pt.last_name?.[0]}
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{pt.first_name} {pt.last_name}</p>
                            <p className="text-slate-500 text-xs font-mono">{pt.hospyn_id} • {pt.phone_number}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedPt(pt); setShowCheckIn(true); }}
                          className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                        >
                          Check-In →
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {searchTerm.length >= 3 && searchResults.length === 0 && !searching && (
                  <div className="text-center py-10">
                    <p className="text-slate-500 text-sm mb-3">No patient found for "{searchTerm}"</p>
                    <button onClick={() => setShowRegister(true)} className="text-indigo-400 text-sm font-bold hover:underline">
                      + Register as new patient
                    </button>
                  </div>
                )}

                {searchTerm.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 opacity-40">
                    <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-5">
                      <Users size={36} className="text-indigo-400" />
                    </div>
                    <p className="text-white font-bold text-sm uppercase tracking-widest">Ready for Intake</p>
                    <p className="text-slate-500 text-xs text-center mt-2 max-w-xs leading-relaxed">Type a patient's name, phone number, or Hospyn ID above to begin check-in.</p>
                  </div>
                )}
              </div>

              {/* Waiting Room */}
              <div className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl p-6 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Clock size={16} className="text-indigo-400" /> Waiting Room
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-500/20 text-indigo-300 text-xs font-black px-2.5 py-1 rounded-lg">{waitingQueue.length}</span>
                    <button onClick={fetchQueue} className="text-slate-600 hover:text-slate-300 transition-colors"><RefreshCw size={14} /></button>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1 max-h-[520px]">
                  {waitingQueue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 opacity-40">
                      <Activity size={32} className="text-indigo-400 mb-3" />
                      <p className="text-white text-xs font-bold uppercase tracking-widest">Queue Clear</p>
                    </div>
                  ) : (
                    waitingQueue.map((q, i) => {
                      const mins = q.time ? Math.max(0, Math.floor((Date.now() - new Date(q.time)) / 60000)) : 0;
                      const late = mins > 30;
                      return (
                        <div key={q.id} className={`flex items-center gap-3 p-3.5 rounded-xl border ${late ? 'border-rose-500/30 bg-rose-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                          <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-black text-sm ${late ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm truncate">{q.patient_name}</p>
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold truncate">{q.visit_reason || 'General'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-xs font-black ${late ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>{mins}m</p>
                            {q.queue_token && <p className="text-[9px] font-mono text-indigo-400">{q.queue_token}</p>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ PATIENT DIRECTORY ══════════════ */}
          {view === 'directory' && (
            <div className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-widest">Patient Registry</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{patients.length} patients registered</p>
                </div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={ptSearch}
                    onChange={e => setPtSearch(e.target.value)}
                    placeholder="Filter patients…"
                    className="bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all w-56"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-slate-500 bg-black/20">
                      <th className="px-6 py-4">Hospyn ID</th>
                      <th className="px-6 py-4">Patient Name</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Gender</th>
                      <th className="px-6 py-4">Blood Group</th>
                      <th className="px-6 py-4">Registered</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {patients
                      .filter(p => {
                        const s = ptSearch.toLowerCase();
                        return !s || `${p.first_name} ${p.last_name} ${p.hospyn_id} ${p.phone_number}`.toLowerCase().includes(s);
                      })
                      .map(pt => (
                      <tr key={pt.id} className="hover:bg-white/[0.02] transition-colors text-sm">
                        <td className="px-6 py-4 font-mono text-indigo-400 font-bold text-xs">{pt.hospyn_id}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {pt.first_name?.[0]}{pt.last_name?.[0]}
                            </div>
                            <span className="text-white font-semibold">{pt.first_name} {pt.last_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-mono text-xs">{pt.phone_number}</td>
                        <td className="px-6 py-4 text-slate-400">{pt.gender || '—'}</td>
                        <td className="px-6 py-4">
                          <span className="bg-rose-500/10 text-rose-400 text-xs font-bold px-2 py-0.5 rounded-md">{pt.blood_group || '—'}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">{pt.created_at ? new Date(pt.created_at).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => { setSelectedPt(pt); setShowCheckIn(true); }}
                            className="text-indigo-400 hover:text-white text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            Check-In <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {patients.length === 0 && (
                  <div className="text-center py-16 text-slate-600 text-sm">No patients registered yet.</div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ APPOINTMENTS ══════════════ */}
          {view === 'appointments' && (
            <div className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-widest">Today's Appointments</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{appointments.length} total visits</p>
                </div>
                <div className="flex gap-2">
                  {['all','active','completed'].map(f => (
                    <button key={f} onClick={() => setApptFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${apptFilter === f ? 'bg-indigo-600 text-white' : 'bg-white/[0.04] text-slate-500 hover:text-white'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-slate-500 bg-black/20">
                      <th className="px-6 py-4">Time</th>
                      <th className="px-6 py-4">Patient</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4">Doctor</th>
                      <th className="px-6 py-4">Token</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {appointments
                      .filter(a => apptFilter === 'all' || a.status?.toLowerCase() === apptFilter)
                      .map(a => (
                      <tr key={a.id} className="hover:bg-white/[0.02] transition-colors text-sm">
                        <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                          {a.time ? new Date(a.time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-white font-semibold">{a.patient_name}</p>
                          <p className="text-indigo-400 font-mono text-[10px]">{a.hospyn_id}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-400 max-w-[180px] truncate">{a.visit_reason || '—'}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{a.doctor_name || 'Unassigned'}</td>
                        <td className="px-6 py-4">
                          {a.queue_token && <span className="font-mono text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">{a.queue_token}</span>}
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {appointments.length === 0 && (
                  <div className="text-center py-16 text-slate-600 text-sm">No appointments today.</div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ DOCTOR ROSTER ══════════════ */}
          {view === 'roster' && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {doctors.map(doc => {
                  const status = doc.user?.current_status || 'ACTIVE';
                  const isAvail = ['ACTIVE', null, undefined, ''].includes(status);
                  return (
                    <div key={doc.id} className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl p-5 hover:border-indigo-500/30 transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 font-black text-lg flex items-center justify-center border border-indigo-500/20">
                          {doc.user?.first_name?.[0] || 'D'}
                        </div>
                        <span className={`text-[9px] font-black tracking-widest px-2 py-1 rounded-md uppercase ${isAvail ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                          {status}
                        </span>
                      </div>
                      <h3 className="text-white font-bold text-sm mb-1">Dr. {doc.user?.first_name} {doc.user?.last_name}</h3>
                      <p className="text-indigo-400 text-xs font-medium mb-3">{doc.department?.name || 'General Medicine'}</p>
                      <p className="text-slate-600 text-[10px] font-mono">LIC: {doc.license_number || '—'}</p>
                    </div>
                  );
                })}
                {doctors.length === 0 && (
                  <div className="col-span-4 text-center py-16 text-slate-600 text-sm">No doctors on roster.</div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════ BILLING LEDGER ══════════════ */}
          {view === 'ledger' && (
            <div className="space-y-6">

              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label:'Total Revenue',  val:`₹${fmt(ledgerSummary.total)}`, icon: TrendingUp,    color:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/20' },
                  { label:'Cash Collected', val:`₹${fmt(ledgerSummary.cash)}`,  icon: Banknote,      color:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/20'   },
                  { label:'UPI / PhonePe',  val:`₹${fmt(ledgerSummary.upi)}`,   icon: QrCode,        color:'text-violet-400',  bg:'bg-violet-500/10 border-violet-500/20' },
                  { label:'Transactions',   val:ledgerSummary.count,             icon: Hash,          color:'text-indigo-400',  bg:'bg-indigo-500/10 border-indigo-500/20' },
                ].map(({ label, val, icon: Icon, color, bg }) => (
                  <div key={label} className={`${bg} border rounded-2xl p-5 flex items-center gap-4`}>
                    <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
                      <p className="text-xl font-black text-white leading-tight">{val}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Filter bar */}
              <div className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
                    <Filter size={15} className="text-indigo-400" /> Filters
                  </div>
                  <input type="date" value={ledgerFilters.date_from}
                    onChange={e => setLedgerFilters(f => ({...f, date_from: e.target.value}))}
                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-all"
                  />
                  <span className="text-slate-600 text-xs font-bold">TO</span>
                  <input type="date" value={ledgerFilters.date_to}
                    onChange={e => setLedgerFilters(f => ({...f, date_to: e.target.value}))}
                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-all"
                  />
                  <select value={ledgerFilters.payment_method}
                    onChange={e => setLedgerFilters(f => ({...f, payment_method: e.target.value}))}
                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="">All Methods</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / PhonePe</option>
                    <option value="CARD">Card</option>
                  </select>
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={ledgerFilters.search}
                      onChange={e => setLedgerFilters(f => ({...f, search: e.target.value}))}
                      placeholder="Search invoice, patient…"
                      className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <button
                    onClick={() => fetchLedger(ledgerFilters)}
                    disabled={ledgerLoading}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={ledgerLoading ? 'animate-spin' : ''} /> Apply
                  </button>
                  <button
                    onClick={() => { const f = { date_from: today(), date_to: today(), payment_method: '', search: '' }; setLedgerFilters(f); fetchLedger(f); }}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-white text-xs font-bold transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.04]"
                  >
                    <X size={13} /> Reset
                  </button>
                </div>
              </div>

              {/* Ledger Table — grouped by date */}
              {ledgerLoading ? (
                <div className="text-center py-16 text-slate-500 text-sm flex items-center justify-center gap-3">
                  <RefreshCw size={16} className="animate-spin" /> Loading ledger…
                </div>
              ) : Object.keys(ledgerByDate).length === 0 ? (
                <div className="text-center py-16 text-slate-600 text-sm bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl">
                  No transactions found for selected filters.
                </div>
              ) : (
                Object.entries(ledgerByDate).map(([date, rows]) => {
                  const dayTotal = rows.reduce((a, c) => a + (c.payable_amount || 0), 0);
                  return (
                    <div key={date} className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl overflow-hidden">
                      {/* Date header */}
                      <div className="px-6 py-3.5 bg-black/20 border-b border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar size={14} className="text-indigo-400" />
                          <span className="text-sm font-black text-white">{date}</span>
                          <span className="text-[10px] font-bold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-md">{rows.length} tx</span>
                        </div>
                        <span className="text-sm font-black text-emerald-400">₹{fmt(dayTotal)}</span>
                      </div>

                      {/* Rows */}
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[9px] uppercase tracking-widest text-slate-600 border-b border-white/[0.04]">
                            <th className="px-6 py-3">Time</th>
                            <th className="px-6 py-3">Invoice #</th>
                            <th className="px-6 py-3">Patient</th>
                            <th className="px-6 py-3">Description</th>
                            <th className="px-6 py-3">Method</th>
                            <th className="px-6 py-3">Transaction ID</th>
                            <th className="px-6 py-3">Amount</th>
                            <th className="px-6 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                          {rows.map(row => (
                            <tr key={row.id} className="hover:bg-white/[0.02] transition-colors text-sm">
                              <td className="px-6 py-3.5 font-mono text-slate-500 text-xs">{row.time_display}</td>
                              <td className="px-6 py-3.5 font-mono text-indigo-400 text-xs font-bold">{row.invoice_number}</td>
                              <td className="px-6 py-3.5">
                                <p className="text-white font-semibold text-sm">{row.patient_name}</p>
                                <p className="text-slate-600 font-mono text-[10px]">{row.hospyn_id}</p>
                              </td>
                              <td className="px-6 py-3.5 text-slate-400 text-xs max-w-[160px] truncate">
                                {(row.items_summary || []).join(', ')}
                              </td>
                              <td className="px-6 py-3.5"><PayBadge method={row.payment_method} /></td>
                              <td className="px-6 py-3.5">
                                {row.transaction_id ? (
                                  <span className="font-mono text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">
                                    {row.transaction_id}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-6 py-3.5 font-black text-white">₹{fmt(row.payable_amount)}</td>
                              <td className="px-6 py-3.5"><StatusBadge status={row.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </main>
      </div>

      {/* ══════════════════════ MODALS ══════════════════════ */}

      {/* Register Patient Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1829] border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-7">
              <div>
                <h2 className="text-xl font-black text-white">Register New Patient</h2>
                <p className="text-slate-500 text-xs mt-1">A unique Hospyn ID will be auto-generated.</p>
              </div>
              <button onClick={() => setShowRegister(false)} className="text-slate-500 hover:text-white p-2 rounded-xl hover:bg-white/[0.06] transition-all"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">First Name *</label>
                <input value={np.first_name} onChange={e => setNp({...np, first_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500 transition-all" placeholder="Ravi" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Last Name</label>
                <input value={np.last_name} onChange={e => setNp({...np, last_name: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500 transition-all" placeholder="Kumar" />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Phone Number *</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="tel" value={np.phone_number} onChange={e => setNp({...np, phone_number: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all" placeholder="9876543210" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-7">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">DOB</label>
                <input type="date" value={np.date_of_birth} onChange={e => setNp({...np, date_of_birth: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Gender</label>
                <select value={np.gender} onChange={e => setNp({...np, gender: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500 transition-all appearance-none">
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Blood Group</label>
                <div className="relative">
                  <Droplet size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400" />
                  <select value={np.blood_group} onChange={e => setNp({...np, blood_group: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-3 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all appearance-none">
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRegister(false)} className="px-5 py-2.5 text-slate-500 hover:text-white text-sm font-bold transition-colors rounded-xl hover:bg-white/[0.04]">Cancel</button>
              <button onClick={handleRegister} disabled={submitting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/25">
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Register & Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-In / Dispatch Modal */}
      {showCheckIn && selectedPt && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1829] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl max-h-[95vh] overflow-y-auto">

            {/* Patient header */}
            <div className="p-7 border-b border-white/[0.07]">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-black text-white">Patient Check-In</h2>
                <button onClick={() => { setShowCheckIn(false); setSelectedPt(null); }}
                  className="text-slate-500 hover:text-white p-1.5 rounded-xl hover:bg-white/[0.06] transition-all"><X size={16} /></button>
              </div>
              <div className="flex items-center gap-3 mt-4 bg-white/[0.03] border border-white/[0.07] rounded-xl p-3">
                <div className="w-11 h-11 rounded-full bg-indigo-600/20 text-indigo-400 font-black text-lg flex items-center justify-center border border-indigo-500/20">
                  {selectedPt.first_name?.[0]}{selectedPt.last_name?.[0]}
                </div>
                <div>
                  <p className="text-white font-bold">{selectedPt.first_name} {selectedPt.last_name}</p>
                  <p className="text-indigo-400 font-mono text-xs">{selectedPt.hospyn_id} • {selectedPt.phone_number}</p>
                </div>
              </div>
            </div>

            <div className="p-7 space-y-5">
              {/* Visit Reason */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Visit Reason *</label>
                <input value={ci.visit_reason} onChange={e => setCi({...ci, visit_reason: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500 transition-all" placeholder="e.g. Fever, Routine checkup, Chest pain" />
              </div>

              {/* Department + Doctor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Department</label>
                  <select value={ci.department} onChange={e => setCi({...ci, department: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500 transition-all appearance-none">
                    {['General Medicine','Cardiology','Orthopedics','Pediatrics','Gynecology','ENT','Dermatology','Ophthalmology','Neurology'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Assign Doctor</label>
                  <select value={ci.doctor_name} onChange={e => setCi({...ci, doctor_name: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500 transition-all appearance-none">
                    <option value="">General Queue</option>
                    {doctors.filter(d => !d.user?.current_status || d.user.current_status === 'ACTIVE').map(doc => (
                      <option key={doc.id} value={`Dr. ${doc.user?.first_name} ${doc.user?.last_name || ''}`}>
                        Dr. {doc.user?.first_name} {doc.user?.last_name || ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* OP Fee */}
              <div className="border-t border-white/[0.07] pt-5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-3">OPD Consultation Fee</label>
                <div className="flex gap-3 items-stretch">
                  <div className="relative flex-1">
                    <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="number" value={ci.op_fee} onChange={e => setCi({...ci, op_fee: e.target.value})}
                      className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white text-lg font-black outline-none focus:border-emerald-500 transition-all"
                      placeholder="0.00" min="0" step="50" />
                  </div>
                  <div className="flex bg-black/30 border border-white/10 rounded-xl overflow-hidden">
                    {['CASH','UPI'].map(m => (
                      <button key={m} onClick={() => setCi({...ci, payment_method: m, transaction_id: ''})}
                        className={`px-4 text-xs font-black tracking-widest transition-all flex items-center gap-1.5 ${ci.payment_method === m ? (m === 'UPI' ? 'bg-violet-600 text-white' : 'bg-amber-600 text-white') : 'text-slate-500 hover:text-white'}`}>
                        {m === 'UPI' ? <QrCode size={12} /> : <Banknote size={12} />} {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI Transaction ID & Dynamic QR Code */}
                {ci.payment_method === 'UPI' && (
                  <div className="mt-3 bg-violet-500/[0.08] border border-violet-500/20 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <QrCode size={15} className="text-violet-400" />
                        <span className="text-violet-400 text-xs font-black uppercase tracking-widest">Dynamic UPI QR Code</span>
                      </div>
                    </div>
                    
                    {Number(ci.op_fee) > 0 ? (
                      <div className="flex gap-5 items-center bg-black/40 border border-violet-500/10 rounded-xl p-4 mb-4">
                        <div className="bg-white p-2 rounded-lg shrink-0">
                          <QRCodeSVG 
                            value={`upi://pay?pa=hospyn@upi&pn=Hospyn%20Hospital&am=${ci.op_fee}&cu=INR`} 
                            size={90} 
                            level="M" 
                          />
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">Scan with PhonePe, GPay, or Paytm</p>
                          <p className="text-slate-500 text-xs mt-1">Amount is pre-filled to <span className="text-emerald-400 font-bold">₹{fmt(ci.op_fee)}</span>.</p>
                          <p className="text-slate-600 text-[10px] mt-1 font-mono">UPI ID: hospyn@upi</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 text-xs text-slate-500 text-center py-3 bg-black/20 rounded-xl">
                        Enter an OP Fee to generate the dynamic QR code.
                      </div>
                    )}

                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">
                      Transaction ID {Number(ci.op_fee) > 0 && <span className="text-rose-400">*</span>}
                    </label>
                    <input value={ci.transaction_id} onChange={e => setCi({...ci, transaction_id: e.target.value})}
                      className="w-full bg-black/40 border border-violet-500/30 rounded-xl p-3 text-white font-mono text-sm outline-none focus:border-violet-400 transition-all placeholder-slate-600"
                      placeholder="e.g. T230524120423847123" />
                    <p className="text-[10px] text-slate-600 mt-2">Verify the success screen on the patient's phone and enter the exact transaction ID.</p>
                  </div>
                )}
              </div>

              {/* Emergency flag */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${ci.is_emergency ? 'bg-rose-600 border-rose-600' : 'border-white/20 group-hover:border-rose-500/50'}`}
                  onClick={() => setCi({...ci, is_emergency: !ci.is_emergency})}>
                  {ci.is_emergency && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <span className="text-rose-400 font-bold text-sm flex items-center gap-2">
                  <AlertTriangle size={14} /> Mark as EMERGENCY — moves to top of queue
                </span>
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowCheckIn(false); setSelectedPt(null); }}
                  className="flex-1 py-3 text-slate-500 hover:text-white text-sm font-bold transition-colors rounded-xl hover:bg-white/[0.04] border border-white/[0.06]">
                  Cancel
                </button>
                <button onClick={handleCheckIn} disabled={submitting || !ci.visit_reason}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 shadow-lg shadow-emerald-600/20">
                  {submitting ? <RefreshCw size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                  Dispatch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold border transition-all ${toast.type === 'error' ? 'bg-rose-600/20 border-rose-500/40 text-rose-300' : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'}`}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default ReceptionDashboard;
