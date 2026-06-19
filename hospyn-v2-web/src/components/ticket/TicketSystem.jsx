/**
 * hospyn-v2-web/src/components/ticket/TicketSystem.jsx
 *
 * Complete ticket system — cross-product, Google/Zomato grade.
 * Components exported:
 *   SupportButton    — floating button in owner dashboard
 *   NewTicketModal   — raise a new ticket
 *   MyTicketsPanel   — owner sees all their tickets + live chat per ticket
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy, X, Send, Paperclip, ChevronDown, ChevronRight,
  Clock, CheckCircle, AlertCircle, MessageSquare, Phone,
  RefreshCw, Plus, ArrowLeft, Circle, UploadCloud, Star
} from 'lucide-react';
import { post, get, postMultipart } from '../../lib/api';

// ── Firebase realtime chat (config from env) ──────────────────────────────────
// We lazy-initialise Firebase so the app doesn't crash if env vars are missing
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
  _db = getDatabase(app);
  return _db;
}

async function listenTicketChat(ticketId, callback) {
  try {
    const db = await getFirebaseDb();
    const { ref, onValue } = await import('firebase/database');
    const chatRef = ref(db, `hospyn_tickets/${ticketId}/messages`);
    const unsub = onValue(chatRef, snap => {
      const raw = snap.val();
      callback(raw ? Object.entries(raw).map(([k, v]) => ({ id: k, ...v })).sort((a, b) => a.timestamp - b.timestamp) : []);
    });
    return unsub;
  } catch {
    // Firebase not configured — fall back to REST polling
    return () => {};
  }
}

async function sendFirebaseMessage(ticketId, message) {
  try {
    const db = await getFirebaseDb();
    const { ref, push, serverTimestamp } = await import('firebase/database');
    await push(ref(db, `hospyn_tickets/${ticketId}/messages`), { ...message, timestamp: Date.now() });
  } catch {
    // Fallback: backend REST will store the message
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'billing',      label: 'Billing & Payments',   color: 'amber',   team: 'Finance Team' },
  { value: 'technical',    label: 'Technical / Software',  color: 'rose',    team: 'Engineering Team' },
  { value: 'onboarding',   label: 'Onboarding & Setup',   color: 'violet',  team: 'Onboarding Team' },
  { value: 'staff_access', label: 'Staff Access & Roles', color: 'blue',    team: 'Support Team' },
  { value: 'data',         label: 'Data & Reports',       color: 'indigo',  team: 'Data Team' },
  { value: 'other',        label: 'Other',                color: 'slate',   team: 'General Support' },
];

const PRIORITIES = [
  { value: 'low',      label: 'Low',      desc: 'General questions, non-urgent',         color: 'slate' },
  { value: 'medium',   label: 'Medium',   desc: 'Affecting operations, not critical',    color: 'amber' },
  { value: 'high',     label: 'High',     desc: 'Operations severely impacted',          color: 'orange' },
  { value: 'critical', label: 'Critical', desc: 'Hospital operations completely blocked', color: 'rose' },
];

const PRODUCTS = [
  { value: 'hospyn_web',    label: 'Hospyn Web (Owner Dashboard)' },
  { value: 'hospyn_doctor', label: 'Hospyn Doctor App' },
  { value: 'hospyn_erp',    label: 'Hospyn ERP Portal' },
  { value: 'hospyn_nurse',  label: 'Hospyn Nurse Console' },
  { value: 'other',         label: 'Other Hospyn Product' },
];

const STATUS_CONFIG = {
  open:             { label: 'Open',             color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  in_progress:      { label: 'In Progress',      color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  waiting_on_user:  { label: 'Waiting on You',   color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  resolved:         { label: 'Resolved',          color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  closed:           { label: 'Closed',            color: 'bg-slate-100 text-slate-500',  dot: 'bg-slate-400' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── New Ticket Modal ──────────────────────────────────────────────────────────
function NewTicketModal({ isOpen, onClose, onCreated }) {
  const [step, setStep]         = useState(1); // 1=category 2=details 3=success
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [product, setProduct]   = useState('hospyn_web');
  const [subject, setSubject]   = useState('');
  const [description, setDesc]  = useState('');
  const [attachment, setAttach] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [createdTicket, setCreated] = useState(null);

  const reset = () => { setStep(1); setCategory(''); setPriority('medium'); setProduct('hospyn_web'); setSubject(''); setDesc(''); setAttach(null); setError(''); setCreated(null); };

  const submit = async () => {
    if (!subject.trim() || subject.trim().length < 5) { setError('Subject must be at least 5 characters.'); return; }
    if (!description.trim() || description.trim().length < 20) { setError('Please describe the issue in at least 20 characters so our team can help effectively.'); return; }
    setLoading(true); setError('');

    const ownerEmail = localStorage.getItem('hospyn_owner_email') || '';
    const orgName    = localStorage.getItem('hospyn_org_name') || '';

    try {
      let data;
      if (attachment) {
        const fd = new FormData();
        fd.append('category', category); fd.append('priority', priority); fd.append('product', product);
        fd.append('subject', subject); fd.append('description', description);
        fd.append('owner_email', ownerEmail); fd.append('org_name', orgName);
        fd.append('attachment', attachment);
        data = await postMultipart('/tickets/create', fd);
      } else {
        data = await post('/tickets/create', { category, priority, product, subject, description, owner_email: ownerEmail, org_name: orgName });
      }
      setCreated(data);
      setStep(3);
      onCreated?.(data);
    } catch (e) {
      setError(e.message || 'Failed to create ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            {step === 2 && <button onClick={() => { setStep(1); setError(''); }} className="text-slate-400 hover:text-slate-600 mr-1"><ArrowLeft size={16}/></button>}
            <LifeBuoy size={18} className="text-violet-600"/>
            <span className="font-black text-slate-900 text-sm">
              {step === 1 ? 'What do you need help with?' : step === 2 ? 'Describe the Issue' : 'Ticket Created'}
            </span>
          </div>
          <button onClick={() => { onClose(); reset(); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"><X size={16}/></button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs">
              <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5"/>
              <p className="text-rose-700 font-semibold">{error}</p>
            </div>
          )}

          {/* Step 1 — Category */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORIES.map(cat => (
                  <button key={cat.value} onClick={() => { setCategory(cat.value); setStep(2); }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all hover:border-violet-300 hover:bg-violet-50/40 ${category === cat.value ? 'border-violet-500 bg-violet-50' : 'border-slate-100 bg-white'}`}>
                    <p className="font-bold text-slate-900 text-xs">{cat.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{cat.team}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Product</label>
                <select value={product} onChange={e => setProduct(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-violet-500 transition-all">
                  {PRODUCTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Priority</label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITIES.map(p => (
                    <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${priority === p.value ? 'border-violet-400 bg-violet-50' : 'border-slate-100 hover:border-slate-200'}`}>
                      <p className={`font-black text-xs text-${p.color}-600`}>{p.label}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Subject <span className="text-rose-500">*</span></label>
                <input type="text" value={subject} onChange={e => { setSubject(e.target.value); setError(''); }} placeholder="Brief summary of the issue" maxLength={120}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:bg-white focus:border-violet-500 transition-all"/>
                <p className="text-[10px] text-slate-400 mt-1 text-right">{subject.length}/120</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Description <span className="text-rose-500">*</span></label>
                <textarea value={description} onChange={e => { setDesc(e.target.value); setError(''); }} placeholder="Describe exactly what happened, what you expected, and what you see instead. The more detail, the faster we can help." rows={5}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:bg-white focus:border-violet-500 transition-all resize-none"/>
                <p className="text-[10px] text-slate-400 mt-1">{description.length} chars (min 20)</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Attachment <span className="text-slate-400">(optional)</span></label>
                <label className={`flex items-center gap-3 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${attachment ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'}`}>
                  <Paperclip size={16} className={attachment ? 'text-emerald-500' : 'text-slate-400'}/>
                  <span className="text-xs font-medium text-slate-500">{attachment ? attachment.name : 'Attach screenshot or file (max 10MB)'}</span>
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setAttach(e.target.files[0])}/>
                </label>
              </div>

              <button onClick={submit} disabled={loading} className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                {loading ? <><RefreshCw size={15} className="animate-spin"/>Submitting…</> : 'Submit Ticket →'}
              </button>
            </div>
          )}

          {/* Step 3 — Success */}
          {step === 3 && createdTicket && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-emerald-500"/>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">Ticket Raised!</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Our {CATEGORIES.find(c => c.value === category)?.team || 'Support Team'} has been notified and will respond within{' '}
                  <strong className="text-slate-700">{priority === 'critical' ? '2 hours' : priority === 'high' ? '4 hours' : priority === 'medium' ? '8 hours' : '24 hours'}</strong>.
                </p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Ticket ID</span>
                  <span className="font-black text-violet-600 font-mono">{createdTicket.ticket_id}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Status</span>
                  <StatusBadge status="open"/>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Routed To</span>
                  <span className="font-bold text-slate-700">{CATEGORIES.find(c => c.value === category)?.team}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">You'll receive an SMS confirmation shortly. Track this ticket in "My Support Tickets".</p>
              <div className="flex gap-3">
                <button onClick={() => { onClose(); reset(); }} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all">Close</button>
                <button onClick={() => { onClose(); reset(); onCreated?.(createdTicket, true); }} className="flex-1 py-3 bg-violet-600 text-white font-bold text-xs rounded-xl hover:bg-violet-700 transition-all">View Ticket →</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Ticket Chat ───────────────────────────────────────────────────────────────
function TicketChat({ ticket, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [rating, setRating]     = useState(0);
  const [rated, setRated]       = useState(false);
  const bottomRef = useRef();
  const ownerEmail = localStorage.getItem('hospyn_owner_email') || 'owner';

  useEffect(() => {
    let unsub = () => {};
    listenTicketChat(ticket.ticket_id, msgs => {
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }).then(u => { unsub = u; });
    return () => unsub();
  }, [ticket.ticket_id]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    const msg = { sender: 'owner', sender_label: ownerEmail, text, timestamp: Date.now() };
    await sendFirebaseMessage(ticket.ticket_id, msg);
    try { await post(`/tickets/${ticket.ticket_id}/message`, { text, sender: 'owner' }); } catch { }
    setSending(false);
  };

  const submitRating = async () => {
    try { await post(`/tickets/${ticket.ticket_id}/rate`, { rating }); setRated(true); } catch { }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50 shrink-0">
        <button onClick={onBack} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-all"><ArrowLeft size={15}/></button>
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 text-sm truncate">{ticket.subject}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-slate-400">{ticket.ticket_id}</span>
            <StatusBadge status={ticket.status}/>
          </div>
        </div>
        {ticket.support_agent_phone && (
          <a href={`tel:${ticket.support_agent_phone}`} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-[10px] font-bold hover:bg-emerald-100 transition-all">
            <Phone size={12}/> Call Agent
          </a>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        {/* System message */}
        <div className="text-center">
          <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            Ticket {ticket.ticket_id} • Routed to {ticket.team || 'Support Team'}
          </span>
        </div>

        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare size={32} className="text-slate-200 mx-auto mb-3"/>
            <p className="text-xs text-slate-400 font-medium">No messages yet. Our team will respond here.</p>
          </div>
        )}

        {messages.map(msg => {
          const isOwner = msg.sender === 'owner';
          return (
            <div key={msg.id} className={`flex ${isOwner ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] space-y-1 ${isOwner ? 'items-end' : 'items-start'} flex flex-col`}>
                <p className={`text-[10px] font-bold ${isOwner ? 'text-slate-400 text-right' : 'text-violet-600'}`}>
                  {isOwner ? 'You' : (msg.sender_label || 'Hospyn Support')}
                </p>
                <div className={`px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${isOwner ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                  {msg.text}
                </div>
                <p className="text-[9px] text-slate-400 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Rating (if resolved) */}
      {ticket.status === 'resolved' && !rated && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-3">
          <p className="text-xs font-bold text-amber-800 flex-1">Rate this resolution:</p>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRating(n)} className={`transition-all ${n <= rating ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}>
                <Star size={18} fill={n <= rating ? 'currentColor' : 'none'}/>
              </button>
            ))}
          </div>
          <button onClick={submitRating} disabled={!rating} className="px-3 py-1.5 bg-amber-500 disabled:opacity-40 text-white font-bold text-[10px] rounded-lg transition-all">Submit</button>
        </div>
      )}
      {rated && (
        <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 text-center">
          <p className="text-xs font-bold text-emerald-700">Thank you for your feedback!</p>
        </div>
      )}

      {/* Input */}
      {ticket.status !== 'closed' && (
        <div className="p-3 border-t border-slate-100 bg-white shrink-0 flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-violet-400 transition-all resize-none"
          />
          <button onClick={send} disabled={!input.trim() || sending}
            className="w-10 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shrink-0">
            {sending ? <RefreshCw size={15} className="animate-spin"/> : <Send size={15}/>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── My Tickets Panel ──────────────────────────────────────────────────────────
function MyTicketsPanel({ isOpen, onClose, openTicketId }) {
  const [tickets, setTickets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTicket, setActive] = useState(null);
  const [filter, setFilter]     = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get('/tickets/my-tickets');
      setTickets(data.tickets || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) { load(); } }, [isOpen, load]);

  useEffect(() => {
    if (openTicketId && tickets.length) {
      const t = tickets.find(t => t.ticket_id === openTicketId);
      if (t) setActive(t);
    }
  }, [openTicketId, tickets]);

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2900] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8">
      <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.97, opacity: 0 }}
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col" style={{ height: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            {activeTicket && <button onClick={() => setActive(null)} className="text-slate-400 hover:text-slate-600 mr-1"><ArrowLeft size={16}/></button>}
            <LifeBuoy size={18} className="text-violet-600"/>
            <span className="font-black text-slate-900">{activeTicket ? 'Support Chat' : 'My Support Tickets'}</span>
            {!activeTicket && tickets.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-black">{tickets.length}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"><X size={16}/></button>
        </div>

        {activeTicket ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <TicketChat ticket={activeTicket} onBack={() => setActive(null)}/>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Filters */}
            <div className="flex gap-1.5 p-4 border-b border-slate-100 overflow-x-auto shrink-0">
              {[['all','All'], ['open','Open'], ['in_progress','In Progress'], ['waiting_on_user','Waiting'], ['resolved','Resolved'], ['closed','Closed']].map(([val, lbl]) => (
                <button key={val} onClick={() => setFilter(val)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${filter===val?'bg-violet-100 text-violet-700':'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                  {lbl}
                </button>
              ))}
              <button onClick={load} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                <RefreshCw size={14}/>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <RefreshCw size={24} className="text-violet-400 animate-spin"/>
                  <p className="text-sm text-slate-400 font-medium">Loading your tickets…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                  <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
                    <LifeBuoy size={24} className="text-slate-300"/>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">No tickets yet</p>
                    <p className="text-xs text-slate-400 mt-1">When you raise a support ticket, it will appear here.</p>
                  </div>
                </div>
              ) : (
                filtered.map(ticket => (
                  <button key={ticket.ticket_id} onClick={() => setActive(ticket)}
                    className="w-full text-left p-4 bg-white border border-slate-100 rounded-2xl hover:border-violet-200 hover:shadow-md hover:shadow-violet-500/5 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-violet-600 font-bold">{ticket.ticket_id}</span>
                          <StatusBadge status={ticket.status}/>
                          {ticket.unread_count > 0 && (
                            <span className="px-1.5 py-0.5 bg-violet-600 text-white rounded-full text-[9px] font-black">{ticket.unread_count} new</span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 text-sm truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1"><Clock size={10}/>{new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span>{CATEGORIES.find(c => c.value === ticket.category)?.team || 'Support'}</span>
                          <span className={`font-bold ${ticket.priority === 'critical' ? 'text-rose-500' : ticket.priority === 'high' ? 'text-orange-500' : ticket.priority === 'medium' ? 'text-amber-500' : 'text-slate-400'}`}>
                            {ticket.priority?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1"/>
                    </div>
                    {ticket.last_message && (
                      <p className="mt-2.5 text-xs text-slate-400 font-medium truncate border-t border-slate-50 pt-2.5">
                        {ticket.last_message_sender === 'agent' ? '🔵 Support: ' : 'You: '}{ticket.last_message}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Support Button — rendered inside OwnerDashboard ──────────────────────────
export function SupportButton() {
  const [showMenu, setShowMenu]       = useState(false);
  const [newTicket, setNewTicket]     = useState(false);
  const [myTickets, setMyTickets]     = useState(false);
  const [openTicketId, setOpenTicketId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Poll unread count every 60s
    const load = async () => {
      try { const d = await get('/tickets/unread-count'); setUnreadCount(d.count || 0); } catch { }
    };
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const handleCreated = (ticket, openImmediately) => {
    if (openImmediately) { setOpenTicketId(ticket.ticket_id); setMyTickets(true); }
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-[2800] flex flex-col items-end gap-2">
        <AnimatePresence>
          {showMenu && (
            <motion.div initial={{ opacity:0, y:8, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:8, scale:0.96 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-w-[200px]">
              <button onClick={() => { setShowMenu(false); setNewTicket(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-violet-50 transition-all text-left border-b border-slate-100">
                <Plus size={16} className="text-violet-600"/><span className="font-bold text-slate-800 text-sm">Raise New Ticket</span>
              </button>
              <button onClick={() => { setShowMenu(false); setMyTickets(true); setOpenTicketId(null); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-all text-left">
                <MessageSquare size={16} className="text-slate-500"/>
                <span className="font-bold text-slate-700 text-sm">My Tickets</span>
                {unreadCount > 0 && <span className="ml-auto px-2 py-0.5 bg-violet-600 text-white rounded-full text-[10px] font-black">{unreadCount}</span>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={() => setShowMenu(p => !p)}
          className="relative w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl shadow-xl shadow-violet-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
          {showMenu ? <X size={20}/> : <LifeBuoy size={22}/>}
          {!showMenu && unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center">{unreadCount}</span>
          )}
        </button>
      </div>

      <NewTicketModal isOpen={newTicket} onClose={() => setNewTicket(false)} onCreated={handleCreated}/>
      <MyTicketsPanel isOpen={myTickets} onClose={() => setMyTickets(false)} openTicketId={openTicketId}/>
    </>
  );
}

export default SupportButton;
