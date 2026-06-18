/**
 * hospyn-v2-web/src/pages/HospynInternalPanel.jsx
 *
 * Hospyn Internal Support Team Panel — /hospyn-internal
 * Separate product for Hospyn team members only.
 * - See all tickets across all products
 * - Auto-routed by category to the right team
 * - Live chat with hospital owners via Firebase
 * - Call, assign, escalate, resolve, close tickets
 * - Internal notes (not visible to owner)
 * - Dashboard stats
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, LogOut, RefreshCw, Search, Filter, ChevronRight,
  MessageSquare, Phone, User, Clock, AlertCircle, CheckCircle,
  ArrowLeft, Send, StickyNote, Users, BarChart3, LifeBuoy,
  Star, Zap, Eye, X, Circle, Check, Bell, ArrowRight
} from 'lucide-react';
import { post, get, postForm } from '../lib/api';

// ── Firebase chat (same helper as TicketSystem) ───────────────────────────────
let _db = null;
async function getFirebaseDb() {
  if (_db) return _db;
  const { initializeApp, getApps } = await import('firebase/app');
  const { getDatabase } = await import('firebase/database');
  const config = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  _db = getDatabase(app); return _db;
}

async function listenChat(ticketId, cb) {
  try {
    const db = await getFirebaseDb();
    const { ref, onValue } = await import('firebase/database');
    const r = ref(db, `hospyn_tickets/${ticketId}/messages`);
    const unsub = onValue(r, snap => {
      const raw = snap.val();
      cb(raw ? Object.entries(raw).map(([k,v]) => ({id:k,...v})).sort((a,b)=>a.timestamp-b.timestamp) : []);
    });
    return unsub;
  } catch { return () => {}; }
}

async function pushMessage(ticketId, msg) {
  try {
    const db = await getFirebaseDb();
    const { ref, push } = await import('firebase/database');
    await push(ref(db, `hospyn_tickets/${ticketId}/messages`), { ...msg, timestamp: Date.now() });
  } catch { }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = {
  billing:      { label: 'Billing & Payments',  team: 'Finance Team',      color: 'amber' },
  technical:    { label: 'Technical/Software',  team: 'Engineering Team',  color: 'rose' },
  onboarding:   { label: 'Onboarding & Setup',  team: 'Onboarding Team',   color: 'violet' },
  staff_access: { label: 'Staff Access',        team: 'Support Team',      color: 'blue' },
  data:         { label: 'Data & Reports',      team: 'Data Team',         color: 'indigo' },
  other:        { label: 'Other',               team: 'General Support',   color: 'slate' },
};

const STATUS_OPS = [
  { value: 'open',            label: 'Mark Open' },
  { value: 'in_progress',     label: 'Mark In Progress' },
  { value: 'waiting_on_user', label: 'Waiting on Owner' },
  { value: 'resolved',        label: 'Mark Resolved' },
  { value: 'closed',          label: 'Close Ticket' },
];

const STATUS_STYLES = {
  open:            'bg-blue-100 text-blue-700',
  in_progress:     'bg-violet-100 text-violet-700',
  waiting_on_user: 'bg-amber-100 text-amber-700',
  resolved:        'bg-emerald-100 text-emerald-700',
  closed:          'bg-slate-100 text-slate-500',
};

const PRIORITY_COLORS = {
  critical: 'text-rose-600 bg-rose-50',
  high:     'text-orange-600 bg-orange-50',
  medium:   'text-amber-600 bg-amber-50',
  low:      'text-slate-500 bg-slate-50',
};

// ── Internal Login ────────────────────────────────────────────────────────────
function InternalLogin({ onLogin }) {
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!email || !password) { setError('Enter both email and password.'); return; }
    setLoading(true); setError('');
    try {
      const data = await post('/auth/login', { username: email, password });
      if (data.user?.role !== 'hospyn_staff' && data.user?.role !== 'hospyn_admin') {
        setError('Access denied. This panel is for Hospyn team members only.');
        return;
      }
      localStorage.setItem('hospyn_internal_token', data.access_token);
      localStorage.setItem('hospyn_internal_email', email);
      localStorage.setItem('hospyn_internal_role', data.user.role);
      onLogin({ token: data.access_token, email, role: data.user.role });
    } catch (e) {
      setError(e.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-violet-500/30">
            <Shield size={22} className="text-white" strokeWidth={2.5}/>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Hospyn Internal</h1>
          <p className="text-slate-500 text-xs font-medium">Support Operations Panel — Hospyn Team Only</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-900/40 border border-rose-800/50 rounded-xl flex items-start gap-2.5 text-xs">
            <AlertCircle size={13} className="text-rose-400 shrink-0 mt-0.5"/><p className="text-rose-300 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Hospyn Email</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="you@hospyn.com" autoComplete="email"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3.5 text-sm outline-none focus:border-violet-500 transition-all"/>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Password</label>
            <input type="password" value={password} onChange={e => { setPass(e.target.value); setError(''); }} placeholder="Enter password" autoComplete="current-password"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3.5 text-sm outline-none focus:border-violet-500 transition-all"/>
          </div>
          <button type="submit" disabled={loading} className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2">
            {loading ? <><RefreshCw size={15} className="animate-spin"/>Signing in…</> : 'Access Internal Panel →'}
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">Protected — Hospyn Technologies Pvt. Ltd.</p>
      </div>
    </div>
  );
}

// ── Ticket Chat (internal side) ───────────────────────────────────────────────
function InternalTicketView({ ticket, onBack, onStatusChange, agentEmail }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [note, setNote]           = useState('');
  const [sending, setSending]     = useState(false);
  const [tab, setTab]             = useState('chat'); // chat | notes | details
  const [assignee, setAssignee]   = useState(ticket.assigned_to || '');
  const [statusMenu, setStatusMenu] = useState(false);
  const [notes, setNotes]         = useState([]);
  const bottomRef = useRef();

  useEffect(() => {
    let unsub = () => {};
    listenChat(ticket.ticket_id, msgs => {
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }).then(u => { unsub = u; });
    loadNotes();
    return () => unsub();
  }, [ticket.ticket_id]);

  const loadNotes = async () => {
    try { const d = await get(`/tickets/${ticket.ticket_id}/internal-notes`); setNotes(d.notes || []); } catch { }
  };

  const sendReply = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim(); setInput(''); setSending(true);
    const msg = { sender: 'agent', sender_label: agentEmail || 'Hospyn Support', text, timestamp: Date.now() };
    await pushMessage(ticket.ticket_id, msg);
    try { await post(`/tickets/${ticket.ticket_id}/message`, { text, sender: 'agent', sender_label: agentEmail }); } catch { }
    setSending(false);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try { await post(`/tickets/${ticket.ticket_id}/internal-notes`, { note: note.trim(), author: agentEmail }); setNote(''); loadNotes(); } catch { }
  };

  const updateStatus = async (status) => {
    try { await postForm(`/tickets/${ticket.ticket_id}/status`, { status }); setStatusMenu(false); onStatusChange(ticket.ticket_id, status); } catch { }
  };

  const updateAssignee = async () => {
    try { await postForm(`/tickets/${ticket.ticket_id}/assign`, { assignee }); } catch { }
  };

  const markCallRequired = async () => {
    try { await post(`/tickets/${ticket.ticket_id}/flag-call`, {}); } catch { }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <button onClick={onBack} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all"><ArrowLeft size={15}/></button>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-sm truncate">{ticket.subject}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-violet-400">{ticket.ticket_id}</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${STATUS_STYLES[ticket.status] || 'bg-slate-800 text-slate-400'}`}>{ticket.status?.replace('_',' ')}</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${PRIORITY_COLORS[ticket.priority] || ''}`}>{ticket.priority}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ticket.owner_phone && (
            <a href={`tel:${ticket.owner_phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 rounded-xl text-[10px] font-bold hover:bg-emerald-600/30 transition-all">
              <Phone size={12}/> Call Owner
            </a>
          )}
          <div className="relative">
            <button onClick={() => setStatusMenu(p => !p)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-[10px] font-bold hover:bg-slate-700 transition-all">
              Status <ChevronRight size={11} className={`transition-all ${statusMenu ? 'rotate-90' : ''}`}/>
            </button>
            <AnimatePresence>
              {statusMenu && (
                <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:4 }}
                  className="absolute right-0 top-full mt-1.5 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-10 min-w-[160px]">
                  {STATUS_OPS.map(op => (
                    <button key={op.value} onClick={() => updateStatus(op.value)} className="w-full text-left px-4 py-2.5 text-xs text-slate-300 font-bold hover:bg-slate-700 hover:text-white transition-all">
                      {op.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-800 bg-slate-900 shrink-0">
        {[['chat','Chat'],['notes','Internal Notes'],['details','Details']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2.5 text-[11px] font-bold transition-all border-b-2 ${tab===t?'text-violet-400 border-violet-500':'text-slate-500 border-transparent hover:text-slate-300'}`}>{l}</button>
        ))}
      </div>

      {/* Chat Tab */}
      {tab === 'chat' && (
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-center">
              <span className="text-[10px] text-slate-600 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                {ticket.ticket_id} • {ticket.org_name} • {CATEGORIES[ticket.category]?.team}
              </span>
            </div>
            {messages.map(msg => {
              const isAgent = msg.sender === 'agent';
              return (
                <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] space-y-1 flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
                    <p className={`text-[10px] font-bold ${isAgent ? 'text-violet-400' : 'text-slate-500'}`}>
                      {isAgent ? (msg.sender_label || 'Hospyn Support') : (ticket.org_name || 'Owner')}
                    </p>
                    <div className={`px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${isAgent ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                    <p className="text-[9px] text-slate-600 font-mono">{new Date(msg.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef}/>
          </div>
          <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2 items-end shrink-0">
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendReply();} }}
              placeholder="Reply to owner… (Enter to send)" rows={2}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500 transition-all resize-none placeholder-slate-600"/>
            <button onClick={sendReply} disabled={!input.trim()||sending} className="w-10 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shrink-0">
              {sending ? <RefreshCw size={14} className="animate-spin"/> : <Send size={14}/>}
            </button>
          </div>
        </div>
      )}

      {/* Notes Tab */}
      {tab === 'notes' && (
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="p-3 bg-amber-900/20 border border-amber-800/30 rounded-xl">
              <p className="text-[10px] font-bold text-amber-500">🔒 Internal notes are NOT visible to the hospital owner.</p>
            </div>
            {notes.length === 0 ? (
              <div className="text-center py-8"><p className="text-slate-600 text-sm font-medium">No internal notes yet.</p></div>
            ) : notes.map((n, i) => (
              <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-400">{n.author}</span>
                  <span className="text-[9px] text-slate-600 font-mono">{new Date(n.created_at).toLocaleString('en-IN')}</span>
                </div>
                <p className="text-sm text-slate-300 font-medium leading-relaxed">{n.note}</p>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2 items-end shrink-0">
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add internal note…" rows={2}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all resize-none placeholder-slate-600"/>
            <button onClick={addNote} disabled={!note.trim()} className="w-10 h-10 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shrink-0">
              <StickyNote size={14}/>
            </button>
          </div>
        </div>
      )}

      {/* Details Tab */}
      {tab === 'details' && (
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950 space-y-5">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ticket Details</p>
            {[
              ['Ticket ID', ticket.ticket_id],
              ['Organization', ticket.org_name || '—'],
              ['Owner Email', ticket.owner_email || '—'],
              ['Owner Phone', ticket.owner_phone || '—'],
              ['Product', ticket.product || '—'],
              ['Category', CATEGORIES[ticket.category]?.label || ticket.category],
              ['Routed To', CATEGORIES[ticket.category]?.team || 'Support'],
              ['Priority', ticket.priority],
              ['Created', new Date(ticket.created_at).toLocaleString('en-IN')],
              ['Last Updated', new Date(ticket.updated_at || ticket.created_at).toLocaleString('en-IN')],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between text-xs gap-4">
                <span className="text-slate-500 font-medium shrink-0">{k}</span>
                <span className="text-slate-300 font-bold text-right">{v}</span>
              </div>
            ))}
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Issue Description</p>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">{ticket.description}</p>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assign To</p>
            <div className="flex gap-2">
              <input type="email" value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="agent@hospyn.com"
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500 transition-all"/>
              <button onClick={updateAssignee} className="px-4 py-2.5 bg-violet-600 text-white font-bold text-xs rounded-xl hover:bg-violet-700 transition-all">Assign</button>
            </div>
          </div>

          <button onClick={markCallRequired} className="w-full py-3.5 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 font-bold text-sm rounded-2xl hover:bg-emerald-600/30 transition-all flex items-center justify-center gap-2">
            <Phone size={16}/> Flag as "Call Required"
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Internal Panel ───────────────────────────────────────────────────────
export default function HospynInternalPanel() {
  const [agent, setAgent]         = useState(() => {
    const token = localStorage.getItem('hospyn_internal_token');
    const email = localStorage.getItem('hospyn_internal_email');
    const role  = localStorage.getItem('hospyn_internal_role');
    return token ? { token, email, role } : null;
  });

  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFStatus] = useState('all');
  const [filterCat, setFCat]      = useState('all');
  const [filterPriority, setFPri] = useState('all');
  const [activeTicket, setActive] = useState(null);
  const [stats, setStats]         = useState(null);
  const [view, setView]           = useState('tickets'); // tickets | stats

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterCat !== 'all') params.category = filterCat;
      if (filterPriority !== 'all') params.priority = filterPriority;
      if (search) params.q = search;
      const data = await get('/tickets/all', { params });
      setTickets(data.tickets || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, [filterStatus, filterCat, filterPriority, search]);

  const loadStats = async () => {
    try { const d = await get('/tickets/stats'); setStats(d); } catch { }
  };

  useEffect(() => { if (agent) { loadTickets(); loadStats(); } }, [agent, loadTickets]);

  const onStatusChange = (ticketId, newStatus) => {
    setTickets(prev => prev.map(t => t.ticket_id === ticketId ? { ...t, status: newStatus } : t));
    if (activeTicket?.ticket_id === ticketId) setActive(prev => ({ ...prev, status: newStatus }));
  };

  const logout = () => {
    ['hospyn_internal_token','hospyn_internal_email','hospyn_internal_role'].forEach(k => localStorage.removeItem(k));
    setAgent(null);
  };

  if (!agent) return <InternalLogin onLogin={setAgent}/>;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-inter">
      {/* Top nav */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center"><Shield size={16} className="text-white" strokeWidth={2.5}/></div>
          <div>
            <span className="font-black text-white tracking-tight">HOSPYN <span className="text-violet-400">INTERNAL</span></span>
            <span className="ml-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-800 border border-slate-700">Support Operations</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-800 rounded-xl">
            {[['tickets','Tickets'],['stats','Stats']].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${view===v?'bg-slate-700 text-white':'text-slate-500 hover:text-slate-300'}`}>{l}</button>
            ))}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{agent.email}</p>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest">{agent.role?.replace('_',' ')}</p>
          </div>
          <button onClick={logout} className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all"><LogOut size={15}/></button>
        </div>
      </div>

      {/* Stats View */}
      {view === 'stats' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <h2 className="text-xl font-black text-white">Support Operations Overview</h2>
            {stats ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Tickets', val: stats.total || 0, color: 'text-white' },
                    { label: 'Open', val: stats.open || 0, color: 'text-blue-400' },
                    { label: 'Critical', val: stats.critical || 0, color: 'text-rose-400' },
                    { label: 'Resolved Today', val: stats.resolved_today || 0, color: 'text-emerald-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{s.label}</p>
                      <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">By Category</p>
                    {Object.entries(stats.by_category || {}).map(([k,v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-sm text-slate-400 font-medium">{CATEGORIES[k]?.label || k}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, (v / (stats.total||1))*100)}%` }}/>
                          </div>
                          <span className="text-sm font-black text-white w-6 text-right">{v}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Response SLA</p>
                    {[['Critical','&lt;2 hours', stats.sla_critical_met], ['High','&lt;4 hours', stats.sla_high_met], ['Medium','&lt;8 hours', stats.sla_medium_met]].map(([k,v,met]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-sm text-slate-400 font-medium">{k} ({v})</span>
                        <span className={`text-sm font-black ${met >= 90 ? 'text-emerald-400' : met >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>{met ?? '—'}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40"><RefreshCw size={24} className="text-slate-600 animate-spin"/></div>
            )}
          </div>
        </div>
      )}

      {/* Tickets View */}
      {view === 'tickets' && (
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className={`${activeTicket ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[420px] border-r border-slate-800 shrink-0`}>
            {/* Search + filters */}
            <div className="p-4 space-y-3 border-b border-slate-800 bg-slate-900 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input value={search} onChange={e => { setSearch(e.target.value); }} placeholder="Search tickets, orgs, IDs…"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-violet-500 transition-all placeholder-slate-600"/>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <select value={filterStatus} onChange={e => setFStatus(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none focus:border-violet-500 shrink-0">
                  <option value="all">All Status</option>
                  {['open','in_progress','waiting_on_user','resolved','closed'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
                <select value={filterCat} onChange={e => setFCat(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none focus:border-violet-500 shrink-0">
                  <option value="all">All Categories</option>
                  {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFPri(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none focus:border-violet-500 shrink-0">
                  <option value="all">All Priority</option>
                  {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={loadTickets} className="shrink-0 p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-all"><RefreshCw size={13}/></button>
              </div>
            </div>

            {/* Ticket list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <RefreshCw size={22} className="text-violet-500 animate-spin"/>
                  <p className="text-xs text-slate-500 font-medium">Loading tickets…</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                  <LifeBuoy size={28} className="text-slate-700"/>
                  <p className="text-slate-500 font-medium text-sm">No tickets found</p>
                </div>
              ) : tickets.map(t => (
                <button key={t.ticket_id} onClick={() => setActive(t)}
                  className={`w-full text-left p-4 border-b border-slate-800 hover:bg-slate-900/80 transition-all ${activeTicket?.ticket_id === t.ticket_id ? 'bg-slate-900 border-l-2 border-l-violet-500' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-violet-400 font-bold">{t.ticket_id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${STATUS_STYLES[t.status] || 'bg-slate-800 text-slate-400'}`}>{t.status?.replace('_',' ')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${PRIORITY_COLORS[t.priority] || ''}`}>{t.priority}</span>
                    </div>
                    {t.unread_agent_count > 0 && <span className="w-5 h-5 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shrink-0">{t.unread_agent_count}</span>}
                  </div>
                  <p className="font-bold text-slate-200 text-xs truncate mb-1">{t.subject}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
                    <span>{t.org_name || t.owner_email}</span>
                    <span>·</span>
                    <span>{CATEGORIES[t.category]?.team || 'Support'}</span>
                    <span>·</span>
                    <span>{new Date(t.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
                  </div>
                  {t.last_message && <p className="mt-1.5 text-[10px] text-slate-600 truncate">{t.last_message_sender === 'owner' ? '💬 Owner: ' : '🔵 Agent: '}{t.last_message}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Detail pane */}
          <div className={`flex-1 overflow-hidden ${activeTicket ? 'flex' : 'hidden lg:flex'} flex-col`}>
            {activeTicket ? (
              <InternalTicketView ticket={activeTicket} onBack={() => setActive(null)} onStatusChange={onStatusChange} agentEmail={agent.email}/>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10">
                <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
                  <MessageSquare size={24} className="text-slate-700"/>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">Select a ticket to view</p>
                  <p className="text-slate-600 text-xs mt-1">Click any ticket from the list to open the chat and details.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
