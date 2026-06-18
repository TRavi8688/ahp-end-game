/**
 * hospyn-v2-web/src/pages/HospynInternalPanel.jsx
 *
 * Complete internal team panel with:
 * - Employee login using internal JWT (separate from hospital owners)
 * - Role-aware UI: L1 sees own queue, TL sees team, Manager sees team + stats
 * - Ticket assignment with hierarchy enforcement (backend validates too)
 * - Escalation button (L1→TL→Manager)
 * - Assignment audit log per ticket
 * - Employee workload view (Manager/TL only)
 * - Super admin: create/deactivate employees
 * - Live Firebase chat with owners
 * - Internal notes
 * - Stats dashboard
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, LogOut, Search, ChevronRight, MessageSquare,
  Phone, Clock, AlertCircle, CheckCircle, ArrowLeft,
  Send, StickyNote, BarChart3, LifeBuoy, Star, X,
  RefreshCw, ArrowUp, User, Users, Plus, Eye, Filter,
  ChevronDown, Hash, Layers
} from 'lucide-react';
import { post, get, postForm } from '../lib/api';

// ── Firebase chat ────────────────────────────────────────────────────────────
let _db = null;
async function getDb() {
  if (_db) return _db;
  const { initializeApp, getApps } = await import('firebase/app');
  const { getDatabase } = await import('firebase/database');
  const cfg = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  _db = getDatabase(app);
  return _db;
}

async function listenChat(ticketId, cb) {
  try {
    const db = await getDb();
    const { ref, onValue } = await import('firebase/database');
    const unsub = onValue(ref(db, `hospyn_tickets/${ticketId}/messages`), snap => {
      const raw = snap.val();
      cb(raw ? Object.entries(raw).map(([k,v])=>({id:k,...v})).sort((a,b)=>a.timestamp-b.timestamp) : []);
    });
    return unsub;
  } catch { return () => {}; }
}

async function pushMsg(ticketId, msg) {
  try {
    const db = await getDb();
    const { ref, push } = await import('firebase/database');
    await push(ref(db, `hospyn_tickets/${ticketId}/messages`), {...msg, timestamp: Date.now()});
  } catch {}
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TEAM_LABELS = {
  finance: 'Finance', engineering: 'Engineering', onboarding: 'Onboarding',
  support: 'Support', data: 'Data',
};
const LEVEL_LABELS = { l1: 'L1 Agent', team_lead: 'Team Lead', manager: 'Manager', super_admin: 'Super Admin' };
const LEVEL_COLOR  = {
  l1: 'bg-slate-700 text-slate-300', team_lead: 'bg-blue-900/60 text-blue-300',
  manager: 'bg-violet-900/60 text-violet-300', super_admin: 'bg-amber-900/60 text-amber-300',
};
const STATUS_STYLE = {
  open:            'bg-blue-100 text-blue-700',
  in_progress:     'bg-violet-100 text-violet-700',
  waiting_on_user: 'bg-amber-100 text-amber-700',
  resolved:        'bg-emerald-100 text-emerald-700',
  closed:          'bg-slate-200 text-slate-500',
};
const PRI_COLOR = {
  critical: 'text-rose-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-slate-500',
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLE[status] || 'bg-slate-200 text-slate-500';
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${cls}`}>{status?.replace('_',' ')}</span>;
}

function EmpBadge({ level }) {
  return <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${LEVEL_COLOR[level] || ''}`}>{LEVEL_LABELS[level] || level}</span>;
}

// ── Internal Login ────────────────────────────────────────────────────────────
function InternalLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pw, setPw]       = useState('');
  const [err, setErr]     = useState('');
  const [load, setLoad]   = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!email || !pw) { setErr('Enter email and password.'); return; }
    setLoad(true); setErr('');
    try {
      const data = await post('/auth/internal/login', { email: email.trim(), password: pw });
      localStorage.setItem('hospyn_internal_token',  data.access_token);
      localStorage.setItem('hospyn_internal_email',  data.employee.email);
      localStorage.setItem('hospyn_internal_empid',  data.employee.employee_id);
      localStorage.setItem('hospyn_internal_level',  data.employee.level);
      localStorage.setItem('hospyn_internal_team',   data.employee.team);
      localStorage.setItem('hospyn_internal_name',   data.employee.full_name);
      onLogin(data.employee);
    } catch (e) { setErr(e.message || 'Login failed.'); }
    finally { setLoad(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-violet-500/30">
            <Shield size={22} className="text-white" strokeWidth={2.5}/>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Hospyn Internal</h1>
          <p className="text-slate-500 text-xs font-medium">Support Operations — Team Members Only</p>
        </div>
        {err && <div className="p-3 bg-rose-900/30 border border-rose-800/50 rounded-xl text-xs text-rose-300 font-medium">{err}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Work Email</label>
            <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr('');}} placeholder="you@hospyn.com"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3.5 text-sm outline-none focus:border-violet-500 transition-all"/>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Password</label>
            <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr('');}} placeholder="Enter password"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3.5 text-sm outline-none focus:border-violet-500 transition-all"/>
          </div>
          <button type="submit" disabled={load}
            className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
            {load ? <><RefreshCw size={15} className="animate-spin"/>Signing in…</> : 'Access Internal Panel →'}
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-700 font-bold uppercase tracking-widest">Hospyn Technologies Pvt. Ltd.</p>
      </div>
    </div>
  );
}

// ── Ticket Chat (internal side) ───────────────────────────────────────────────
function TicketDetail({ ticket, onBack, onStatusChange, agent, allEmployees }) {
  const [msgs, setMsgs]       = useState([]);
  const [input, setInput]     = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote]       = useState('');
  const [notes, setNotes]     = useState([]);
  const [tab, setTab]         = useState('chat');
  const [log, setLog]         = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [statusMenu, setStatusMenu] = useState(false);
  const [assigning, setAssigning]   = useState(false);
  const [escalating, setEscalating] = useState(false);
  const bottomRef = useRef();

  const canAssign   = ['team_lead','manager','super_admin'].includes(agent.level);
  const canEscalate = ['l1','team_lead','manager'].includes(agent.level);
  const canSeeNotes = true;

  // Eligible targets for assignment based on level
  const eligibleEmployees = allEmployees.filter(e => {
    if (agent.level === 'super_admin') return e.is_active;
    if (agent.level === 'manager')     return e.team === agent.team && e.is_active;
    if (agent.level === 'team_lead')   return e.team === agent.team && ['l1','team_lead'].includes(e.level) && e.is_active;
    if (agent.level === 'l1')          return e.team === agent.team && e.level === 'l1' && e.is_active && e.employee_id !== agent.employee_id;
    return false;
  });

  useEffect(() => {
    let unsub = () => {};
    listenChat(ticket.ticket_id, m => { setMsgs(m); setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),80); })
      .then(u => { unsub = u; });
    loadNotes(); loadLog();
    return () => unsub();
  }, [ticket.ticket_id]);

  const loadNotes = async () => {
    try { const d = await get(`/tickets/${ticket.ticket_id}/internal-notes`); setNotes(d.notes||[]); } catch {}
  };
  const loadLog = async () => {
    try { const d = await get(`/tickets/${ticket.ticket_id}/assignment-log`); setLog(d.assignment_log||[]); } catch {}
  };

  const sendReply = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim(); setInput(''); setSending(true);
    const msg = { sender:'agent', sender_label: `${agent.employee_id} — ${agent.full_name}`, text, timestamp: Date.now() };
    await pushMsg(ticket.ticket_id, msg);
    try { await post(`/tickets/${ticket.ticket_id}/message`, { text, sender:'agent', sender_label: agent.full_name }); } catch {}
    setSending(false);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try { await post(`/tickets/${ticket.ticket_id}/internal-notes`, { note: note.trim(), author: agent.employee_id }); setNote(''); loadNotes(); } catch {}
  };

  const doAssign = async () => {
    if (!assignTo) return;
    setAssigning(true);
    try {
      await post(`/tickets/${ticket.ticket_id}/assign-to`, { to_employee_id: assignTo, note: `Assigned by ${agent.employee_id}` });
      onStatusChange(ticket.ticket_id, ticket.status, assignTo);
      loadLog();
      setAssignTo('');
    } catch (e) { alert(e.message); }
    finally { setAssigning(false); }
  };

  const doEscalate = async () => {
    setEscalating(true);
    try {
      const r = await post(`/tickets/${ticket.ticket_id}/escalate`, { note: `Escalated by ${agent.employee_id}` });
      onStatusChange(ticket.ticket_id, ticket.status, r.assigned_to);
      loadLog();
      alert(`Escalated to ${r.escalated_to_level}: ${r.assigned_name}`);
    } catch (e) { alert(e.message); }
    finally { setEscalating(false); }
  };

  const updateStatus = async (status) => {
    try { await postForm(`/tickets/${ticket.ticket_id}/status`, { status }); setStatusMenu(false); onStatusChange(ticket.ticket_id, status); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <button onClick={onBack} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all"><ArrowLeft size={15}/></button>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-sm truncate">{ticket.subject}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="font-mono text-[10px] text-violet-400">{ticket.ticket_id}</span>
            <StatusBadge status={ticket.status}/>
            <span className={`text-[10px] font-black uppercase ${PRI_COLOR[ticket.priority]||''}`}>{ticket.priority}</span>
            {ticket.assigned_employee_id && (
              <span className="text-[10px] text-slate-500 font-medium">→ {ticket.assigned_employee_name || ticket.assigned_employee_id}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ticket.owner_phone && (
            <a href={`tel:${ticket.owner_phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 rounded-xl text-[10px] font-bold hover:bg-emerald-600/30 transition-all">
              <Phone size={12}/> Call
            </a>
          )}
          {canEscalate && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <button onClick={doEscalate} disabled={escalating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 border border-amber-600/30 text-amber-400 rounded-xl text-[10px] font-bold hover:bg-amber-600/30 transition-all disabled:opacity-50">
              {escalating ? <RefreshCw size={11} className="animate-spin"/> : <ArrowUp size={11}/>} Escalate
            </button>
          )}
          <div className="relative">
            <button onClick={() => setStatusMenu(p=>!p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-[10px] font-bold hover:bg-slate-700 transition-all">
              Status <ChevronDown size={11}/>
            </button>
            <AnimatePresence>
              {statusMenu && (
                <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:4}}
                  className="absolute right-0 top-full mt-1.5 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-20 min-w-[160px]">
                  {['open','in_progress','waiting_on_user','resolved','closed'].map(s => (
                    <button key={s} onClick={() => updateStatus(s)}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-300 font-bold hover:bg-slate-700 hover:text-white transition-all">
                      {s.replace('_',' ')}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900 shrink-0">
        {[['chat','Chat'],['notes','Notes'],['assign','Assign'],['log','Audit Log']].map(([t,l]) => (
          <button key={t} onClick={()=>setTab(t)}
            className={`px-5 py-2.5 text-[11px] font-bold transition-all border-b-2 ${tab===t?'text-violet-400 border-violet-500':'text-slate-500 border-transparent hover:text-slate-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* CHAT */}
      {tab === 'chat' && (
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-center">
              <span className="text-[10px] text-slate-600 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                {ticket.ticket_id} · {ticket.org_name} · {TEAM_LABELS[ticket.team] || ticket.team}
              </span>
            </div>
            {msgs.map(m => {
              const isAgent = m.sender === 'agent';
              return (
                <div key={m.id} className={`flex ${isAgent?'justify-end':'justify-start'}`}>
                  <div className={`max-w-[76%] flex flex-col ${isAgent?'items-end':'items-start'} space-y-1`}>
                    <p className={`text-[10px] font-bold ${isAgent?'text-violet-400':'text-slate-500'}`}>
                      {isAgent ? (m.sender_label||'Hospyn Support') : (ticket.org_name||'Owner')}
                    </p>
                    <div className={`px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${isAgent?'bg-violet-600 text-white rounded-tr-sm':'bg-slate-800 text-slate-200 rounded-tl-sm'}`}>
                      {m.text}
                    </div>
                    <p className="text-[9px] text-slate-600 font-mono">{new Date(m.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                </div>
              );
            })}
            {msgs.length === 0 && <div className="text-center py-10"><MessageSquare size={28} className="text-slate-700 mx-auto mb-2"/><p className="text-xs text-slate-600">No messages yet</p></div>}
            <div ref={bottomRef}/>
          </div>
          {ticket.status !== 'closed' && (
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2 items-end shrink-0">
              <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendReply();}}}
                placeholder="Reply to owner… (Enter to send)" rows={2}
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500 transition-all resize-none placeholder-slate-600"/>
              <button onClick={sendReply} disabled={!input.trim()||sending}
                className="w-10 h-10 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shrink-0">
                {sending ? <RefreshCw size={14} className="animate-spin"/> : <Send size={14}/>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* NOTES */}
      {tab === 'notes' && (
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="p-3 bg-amber-900/20 border border-amber-800/30 rounded-xl">
              <p className="text-[10px] font-bold text-amber-500">🔒 Internal notes — NOT visible to owner</p>
            </div>
            {notes.length === 0 && <div className="text-center py-10 text-slate-600 text-sm">No notes yet</div>}
            {notes.map((n,i) => (
              <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] font-black text-amber-400 font-mono">{n.author}</span>
                  <span className="text-[9px] text-slate-600">{new Date(n.created_at).toLocaleString('en-IN')}</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{n.note}</p>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2 items-end shrink-0">
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add internal note…" rows={2}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all resize-none placeholder-slate-600"/>
            <button onClick={addNote} disabled={!note.trim()}
              className="w-10 h-10 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shrink-0">
              <StickyNote size={14}/>
            </button>
          </div>
        </div>
      )}

      {/* ASSIGN */}
      {tab === 'assign' && (
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950 space-y-5">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assign to Employee</p>
            {!canAssign ? (
              <div className="p-4 bg-rose-900/20 border border-rose-800/30 rounded-xl">
                <p className="text-xs text-rose-400 font-medium">L1 agents can only reassign to same-team L1 agents. Escalate to your Team Lead instead.</p>
              </div>
            ) : (
              <>
                <select value={assignTo} onChange={e=>setAssignTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-violet-500 transition-all">
                  <option value="">Select employee…</option>
                  {eligibleEmployees.map(e => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.employee_id} — {e.full_name} ({LEVEL_LABELS[e.level]}) · {e.open_tickets||0} open
                    </option>
                  ))}
                </select>
                <button onClick={doAssign} disabled={!assignTo||assigning}
                  className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                  {assigning ? <><RefreshCw size={14} className="animate-spin"/>Assigning…</> : 'Assign Ticket →'}
                </button>
              </>
            )}
          </div>

          {canEscalate && (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Escalate to Next Level</p>
              <p className="text-xs text-slate-400 font-medium">
                {agent.level === 'l1' ? 'Escalate to your Team Lead' : agent.level === 'team_lead' ? 'Escalate to Manager' : 'Escalate to Super Admin queue'}
              </p>
              <button onClick={doEscalate} disabled={escalating}
                className="w-full py-3.5 bg-amber-600/20 border border-amber-600/30 text-amber-400 font-bold text-sm rounded-2xl hover:bg-amber-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {escalating ? <><RefreshCw size={14} className="animate-spin"/>Escalating…</> : <><ArrowUp size={14}/>Escalate Ticket</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* AUDIT LOG */}
      {tab === 'log' && (
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assignment & Escalation History</p>
          {log.length === 0 && <div className="text-center py-10 text-slate-600 text-sm">No assignment history yet</div>}
          {log.map((entry,i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="w-8 h-8 bg-violet-600/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                {entry.action === 'escalated' ? <ArrowUp size={14} className="text-amber-400"/> :
                 entry.action === 'resolved'  ? <CheckCircle size={14} className="text-emerald-400"/> :
                 <User size={14} className="text-violet-400"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wide text-violet-400">{entry.action}</span>
                  {entry.from_name && <span className="text-[10px] text-slate-500">by {entry.from_employee_id} {entry.from_name}</span>}
                </div>
                <p className="text-sm font-bold text-slate-200 mt-0.5">
                  → {entry.to_employee_id} {entry.to_name}
                  {entry.to_level && <span className="ml-1.5"><EmpBadge level={entry.to_level}/></span>}
                </p>
                {entry.note && <p className="text-xs text-slate-500 mt-1 italic">{entry.note}</p>}
              </div>
              <span className="text-[9px] text-slate-600 font-mono shrink-0">{new Date(entry.created_at).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Employee Modal ─────────────────────────────────────────────────────
function CreateEmployeeModal({ isOpen, onClose, onCreated }) {
  const [f, setF]       = useState({ full_name:'', email:'', team:'support', level:'l1', phone:'' });
  const [load, setLoad] = useState(false);
  const [err, setErr]   = useState('');
  const [created, setCreated] = useState(null);
  const set = k => v => setF(p=>({...p,[k]:v}));

  const submit = async () => {
    if (!f.full_name.trim() || !f.email.trim()) { setErr('Name and email required.'); return; }
    setLoad(true); setErr('');
    try {
      const data = await post('/employees/create', f);
      setCreated(data);
      onCreated(data);
    } catch (e) { setErr(e.message||'Failed to create employee.'); }
    finally { setLoad(false); }
  };

  const reset = () => { setF({full_name:'',email:'',team:'support',level:'l1',phone:''}); setErr(''); setCreated(null); };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
      <motion.div initial={{scale:0.96,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.96,opacity:0}}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Users size={17} className="text-violet-400"/>
            <span className="font-black text-white text-sm">Create Hospyn Employee</span>
          </div>
          <button onClick={()=>{onClose();reset();}} className="text-slate-500 hover:text-slate-300 p-1"><X size={16}/></button>
        </div>
        <div className="p-6 space-y-4">
          {err && <div className="p-3 bg-rose-900/30 border border-rose-800/50 rounded-xl text-xs text-rose-300">{err}</div>}

          {created ? (
            <div className="space-y-4">
              <div className="p-5 bg-emerald-900/20 border border-emerald-800/30 rounded-2xl space-y-3">
                <p className="text-emerald-400 font-black text-sm flex items-center gap-2"><CheckCircle size={16}/>Employee Created!</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Employee ID</span><span className="font-black text-violet-400 font-mono">{created.employee_id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Team / Level</span><span className="font-bold text-slate-300">{TEAM_LABELS[f.team]} / {LEVEL_LABELS[f.level]}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Temp Password</span><span className="font-mono font-black text-amber-400">{created.temp_password}</span></div>
                </div>
                <p className="text-[10px] text-slate-500">⚠️ Share this password securely. It will not be shown again.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>{onClose();reset();}} className="flex-1 py-3 border border-slate-700 text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-800 transition-all">Done</button>
                <button onClick={reset} className="flex-1 py-3 bg-violet-600 text-white font-bold text-xs rounded-xl hover:bg-violet-700 transition-all">Create Another</button>
              </div>
            </div>
          ) : (
            <>
              {[
                {key:'full_name', label:'Full Name', placeholder:'Dr. Rajan Kumar'},
                {key:'email',     label:'Work Email', placeholder:'rajan@hospyn.com', type:'email'},
                {key:'phone',     label:'Phone (optional)', placeholder:'+91 98765 43210'},
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">{field.label}</label>
                  <input type={field.type||'text'} value={f[field.key]} onChange={e=>set(field.key)(e.target.value)} placeholder={field.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-3 text-sm outline-none focus:border-violet-500 transition-all"/>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Team</label>
                  <select value={f.team} onChange={e=>set('team')(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-3 text-sm outline-none focus:border-violet-500 transition-all">
                    {Object.entries(TEAM_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Level</label>
                  <select value={f.level} onChange={e=>set('level')(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-3 text-sm outline-none focus:border-violet-500 transition-all">
                    <option value="l1">L1 Agent</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>
              <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl">
                <p className="text-[10px] font-black text-violet-400">Employee ID Preview</p>
                <p className="font-mono text-sm font-black text-white mt-1">
                  HPN-{({'finance':'FIN','engineering':'ENG','onboarding':'ONB','support':'SUP','data':'DAT'})[f.team]}-{({'l1':'L1','team_lead':'TL','manager':'MGR'})[f.level]}-XXX
                </p>
              </div>
              <button onClick={submit} disabled={load}
                className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2">
                {load ? <><RefreshCw size={14} className="animate-spin"/>Creating…</> : 'Create Employee →'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function HospynInternalPanel() {
  const [agent, setAgent] = useState(() => {
    const token = localStorage.getItem('hospyn_internal_token');
    if (!token) return null;
    return {
      token, email: localStorage.getItem('hospyn_internal_email'),
      employee_id:  localStorage.getItem('hospyn_internal_empid'),
      level:        localStorage.getItem('hospyn_internal_level'),
      team:         localStorage.getItem('hospyn_internal_team'),
      full_name:    localStorage.getItem('hospyn_internal_name'),
    };
  });

  const [view, setView]             = useState('tickets'); // tickets | stats | employees
  const [tickets, setTickets]       = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFS]       = useState('all');
  const [filterPriority, setFP]     = useState('all');
  const [activeTicket, setActive]   = useState(null);
  const [stats, setStats]           = useState(null);
  const [createEmpOpen, setEmpOpen] = useState(false);

  const isSuperAdmin = agent?.level === 'super_admin';
  const isManager    = ['manager','super_admin'].includes(agent?.level);
  const isTL         = ['team_lead','manager','super_admin'].includes(agent?.level);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus !== 'all')   params.status   = filterStatus;
      if (filterPriority !== 'all') params.priority  = filterPriority;
      if (search)                   params.q         = search;
      const data = await get('/tickets/all', { params });
      setTickets(data.tickets || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, [filterStatus, filterPriority, search]);

  const loadEmployees = useCallback(async () => {
    try { const d = await get('/employees/list'); setEmployees(d.employees||[]); } catch {}
  }, []);

  const loadStats = async () => {
    try { const d = await get('/tickets/stats'); setStats(d); } catch {}
  };

  useEffect(() => {
    if (!agent) return;
    loadTickets(); loadEmployees(); loadStats();
  }, [agent, loadTickets, loadEmployees]);

  const onStatusChange = (tid, newStatus, newAssignee) => {
    setTickets(p => p.map(t => t.ticket_id === tid ? {...t, status: newStatus||t.status, assigned_employee_id: newAssignee||t.assigned_employee_id} : t));
    if (activeTicket?.ticket_id === tid) setActive(p => ({...p, status: newStatus||p.status}));
  };

  const logout = () => {
    ['hospyn_internal_token','hospyn_internal_email','hospyn_internal_empid','hospyn_internal_level','hospyn_internal_team','hospyn_internal_name'].forEach(k=>localStorage.removeItem(k));
    setAgent(null);
  };

  if (!agent) return <InternalLogin onLogin={emp => setAgent({...emp, token: localStorage.getItem('hospyn_internal_token')})} />;

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

        <div className="flex items-center gap-1.5 p-1 bg-slate-800 rounded-xl">
          {[['tickets','Tickets'],['stats','Stats'],[...(isTL?[['employees','Team']]:[])]].flat(1).filter(x=>x.length).map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${view===v?'bg-slate-700 text-white':'text-slate-500 hover:text-slate-300'}`}>{l}</button>
          ))}
          {isSuperAdmin && (
            <button onClick={()=>setView('employees')} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${view==='employees'?'bg-slate-700 text-white':'text-slate-500 hover:text-slate-300'}`}>Employees</button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-300">{agent.employee_id}</p>
            <p className="text-[9px] text-slate-600">{agent.full_name} · <span className="text-violet-400">{LEVEL_LABELS[agent.level]}</span> · {TEAM_LABELS[agent.team]}</p>
          </div>
          <button onClick={logout} className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all"><LogOut size={15}/></button>
        </div>
      </div>

      {/* Stats */}
      {view === 'stats' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <h2 className="text-xl font-black">Support Operations — {isManager ? TEAM_LABELS[agent.team]+' Team' : 'Overview'}</h2>
            {stats ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[['Total Tickets',stats.total,'text-white'],['Open',stats.open,'text-blue-400'],['Critical',stats.critical,'text-rose-400'],['Resolved Today',stats.resolved_today,'text-emerald-400']].map(([l,v,c])=>(
                    <div key={l} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{l}</p>
                      <p className={`text-3xl font-black ${c}`}>{v}</p>
                    </div>
                  ))}
                </div>
                {stats.employee_workload?.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Team Workload</p>
                    <div className="space-y-3">
                      {stats.employee_workload.map(e => (
                        <div key={e.employee_id} className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-violet-600/20 rounded-lg flex items-center justify-center text-[11px] font-black text-violet-400 shrink-0">{e.avatar_initials||'??'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200 text-xs truncate">{e.full_name}</span>
                              <span className="font-mono text-[9px] text-slate-600">{e.employee_id}</span>
                              <EmpBadge level={e.level}/>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                              <span className="text-blue-400 font-black">{e.open_tickets} open</span>
                              <span className="text-emerald-400 font-black">{e.resolved_tickets} resolved</span>
                            </div>
                          </div>
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{width:`${Math.min(100,(e.open_tickets/Math.max(1,...stats.employee_workload.map(x=>x.open_tickets)))*100)}%`}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <div className="flex justify-center py-20"><RefreshCw size={24} className="text-slate-600 animate-spin"/></div>}
          </div>
        </div>
      )}

      {/* Employees */}
      {view === 'employees' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Hospyn Employees</h2>
              {isSuperAdmin && (
                <button onClick={()=>setEmpOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl transition-all">
                  <Plus size={14}/> Create Employee
                </button>
              )}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/80">
                  <tr>
                    {['Employee ID','Name','Team','Level','Status','Open Tickets'].map(h=>(
                      <th key={h} className="px-4 py-3 font-bold uppercase tracking-wider text-slate-500 text-[9px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {employees.map(e => (
                    <tr key={e.employee_id} className="hover:bg-slate-800/30 transition-all">
                      <td className="px-4 py-3.5 font-mono font-black text-violet-400">{e.employee_id}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-violet-600/20 rounded-lg flex items-center justify-center text-[10px] font-black text-violet-400 shrink-0">{e.avatar_initials||'??'}</div>
                          <div>
                            <p className="font-bold text-slate-200">{e.full_name}</p>
                            <p className="text-[10px] text-slate-500">{e.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-300">{TEAM_LABELS[e.team]||e.team}</td>
                      <td className="px-4 py-3.5"><EmpBadge level={e.level}/></td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${e.is_active?'bg-emerald-900/40 text-emerald-400':'bg-slate-800 text-slate-500'}`}>
                          {e.is_active?'Active':'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-black text-blue-400">{e.open_tickets||0}</td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600 text-sm">No employees yet. Create the first one.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tickets */}
      {view === 'tickets' && (
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className={`${activeTicket?'hidden lg:flex':'flex'} flex-col w-full lg:w-[400px] border-r border-slate-800 shrink-0`}>
            <div className="p-4 space-y-3 border-b border-slate-800 bg-slate-900 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tickets…"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-violet-500 transition-all placeholder-slate-600"/>
              </div>
              <div className="flex gap-2">
                <select value={filterStatus} onChange={e=>setFS(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none focus:border-violet-500">
                  <option value="all">All Status</option>
                  {['open','in_progress','waiting_on_user','resolved','closed'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
                <select value={filterPriority} onChange={e=>setFP(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none focus:border-violet-500">
                  <option value="all">All Priority</option>
                  {['critical','high','medium','low'].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={loadTickets} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"><RefreshCw size={13}/></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <RefreshCw size={22} className="text-violet-500 animate-spin"/>
                  <p className="text-xs text-slate-500">Loading…</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                  <LifeBuoy size={28} className="text-slate-700"/><p className="text-slate-500 text-sm">No tickets found</p>
                </div>
              ) : tickets.map(t => (
                <button key={t.ticket_id} onClick={()=>setActive(t)}
                  className={`w-full text-left p-4 border-b border-slate-800 hover:bg-slate-900/80 transition-all ${activeTicket?.ticket_id===t.ticket_id?'bg-slate-900 border-l-2 border-l-violet-500':''}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] text-violet-400 font-bold">{t.ticket_id}</span>
                      <StatusBadge status={t.status}/>
                      <span className={`text-[10px] font-black uppercase ${PRI_COLOR[t.priority]||''}`}>{t.priority}</span>
                    </div>
                    {t.unread_agent_count > 0 && (
                      <span className="w-5 h-5 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shrink-0">{t.unread_agent_count}</span>
                    )}
                  </div>
                  <p className="font-bold text-slate-200 text-xs truncate mb-1">{t.subject}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-600">
                    <span>{t.org_name||t.owner_email}</span>
                    <span>·</span>
                    <span>{TEAM_LABELS[t.team]||t.team}</span>
                    {t.assigned_employee_id && <><span>·</span><span className="text-violet-500 font-bold">{t.assigned_employee_id}</span></>}
                  </div>
                  {t.last_message && <p className="mt-1.5 text-[10px] text-slate-600 truncate">{t.last_message_sender==='owner'?'💬 ':'🔵 '}{t.last_message}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className={`flex-1 overflow-hidden ${activeTicket?'flex':'hidden lg:flex'} flex-col`}>
            {activeTicket ? (
              <TicketDetail
                ticket={activeTicket}
                onBack={() => setActive(null)}
                onStatusChange={onStatusChange}
                agent={agent}
                allEmployees={employees}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10">
                <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
                  <MessageSquare size={24} className="text-slate-700"/>
                </div>
                <p className="text-slate-500 font-bold">Select a ticket</p>
              </div>
            )}
          </div>
        </div>
      )}

      <CreateEmployeeModal isOpen={createEmpOpen} onClose={()=>setEmpOpen(false)} onCreated={emp=>{setEmployees(p=>[emp,...p]);loadEmployees();}}/>
    </div>
  );
}
