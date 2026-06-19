// staff-portal/src/pages/Dashboard/SupportPage.tsx
//
// Shared "Raise a Ticket / Support Chat" page for ALL staff roles.
// Wired to the real backend endpoints in healthcare-core/app/api/v1/tickets.py:
//   POST /tickets/create            (apiClient auto-prefixes -> /healthcare/tickets/create)
//   GET  /tickets/my-tickets        (uses X-Owner-Email header — see note below)
//   GET  /tickets/{id}/messages     (full thread, added alongside this page)
//   POST /tickets/{id}/message
//   POST /tickets/{id}/rate
//
// NOTE on identity: the backend's /tickets/my-tickets and /tickets/unread-count
// endpoints identify the ticket owner via an `X-Owner-Email` header (see
// tickets.py: `request.headers.get("X-Owner-Email", ...)`), not via the
// staff JWT's `sub` claim. This page reads the logged-in user's email from
// AuthContext and sends it as that header on every relevant call.

import React, { useEffect, useRef, useState } from 'react';
import {
  LifeBuoy, Plus, Send, X, Clock, AlertCircle, CheckCircle2,
  MessageSquare, Loader2, Star,
} from 'lucide-react';
import apiClient from '../../apiClient';
import { useAuth } from '../../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────

interface Ticket {
  ticket_id: string;
  subject: string;
  description: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
  team?: string;
  assigned_employee_name?: string;
  last_message?: string;
  last_message_sender?: string;
  rating?: number;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  sender: 'owner' | 'agent';
  sender_label?: string;
  text: string;
  created_at: string;
}

const CATEGORY_OPTIONS = [
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'staff_access', label: 'Staff Access' },
  { value: 'data', label: 'Data' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const;

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  waiting_on_user: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-slate-500/10 text-slate-400',
};

const POLL_MS = 8000;

// ── Component ────────────────────────────────────────────────────────────

const SupportPage: React.FC = () => {
  const { user } = useAuth();
  const ownerEmail = user?.email || '';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const ownerHeaders = ownerEmail ? { 'X-Owner-Email': ownerEmail } : undefined;

  const fetchTickets = async () => {
    try {
      const { data } = await apiClient.get('/tickets/my-tickets', { headers: ownerHeaders });
      setTickets(data.tickets || []);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Could not load your tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ownerEmail) {
      setLoading(false);
      setError('No email on your staff profile — support tickets need one to route replies back to you.');
      return;
    }
    fetchTickets();
    const interval = setInterval(fetchTickets, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerEmail]);

  return (
    <div className="space-y-6 text-slate-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LifeBuoy size={24} className="text-blue-400" /> Support
          </h1>
          <p className="text-sm text-slate-400">Raise an issue, track its status, and chat with our team.</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
        >
          <Plus size={18} /> Raise a Ticket
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="animate-spin mr-2" size={20} /> Loading tickets…
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
          <LifeBuoy size={32} className="mb-3 opacity-40" />
          <p>No tickets yet. Raise one if something needs attention.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tickets.map((t) => (
            <button
              key={t.ticket_id}
              onClick={() => setActiveTicket(t)}
              className="text-left bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500">{t.ticket_id}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLES[t.status] || STATUS_STYLES.open}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium}`}>
                      {t.priority}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white truncate">{t.subject}</h3>
                  {t.last_message && (
                    <p className="text-sm text-slate-500 truncate mt-1 flex items-center gap-1">
                      <MessageSquare size={12} />
                      {t.last_message_sender === 'agent' ? 'Support: ' : 'You: '}{t.last_message}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500 flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="flex items-center gap-1"><Clock size={12} /> {new Date(t.updated_at).toLocaleString()}</span>
                  {t.assigned_employee_name && <span>Agent: {t.assigned_employee_name}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showNewModal && (
        <NewTicketModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); fetchTickets(); }}
          ownerEmail={ownerEmail}
          ownerName={user?.name}
          ownerPhone={user?.phone}
        />
      )}

      {activeTicket && (
        <TicketChatModal
          ticket={activeTicket}
          ownerEmail={ownerEmail}
          onClose={() => setActiveTicket(null)}
          onUpdated={fetchTickets}
        />
      )}
    </div>
  );
};

// ── New Ticket Modal ─────────────────────────────────────────────────────

const NewTicketModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
  ownerEmail: string;
  ownerName?: string;
  ownerPhone?: string;
}> = ({ onClose, onCreated, ownerEmail, ownerName, ownerPhone }) => {
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState<typeof PRIORITY_OPTIONS[number]>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 5) { setErr('Subject needs at least 5 characters.'); return; }
    if (description.trim().length < 20) { setErr('Please describe the issue in at least 20 characters.'); return; }
    setSubmitting(true);
    setErr('');
    try {
      await apiClient.post('/tickets/create', {
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        owner_email: ownerEmail,
        org_name: ownerName || '',
        owner_phone: ownerPhone || '',
      });
      onCreated();
    } catch (e: any) {
      setErr(e?.message || 'Could not create the ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Raise a Ticket</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>

        {err && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <AlertCircle size={16} /> {err}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-slate-100"
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-slate-100"
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What happened, when, and what you expected instead"
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-slate-100 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Chat Modal ────────────────────────────────────────────────────────────

const TicketChatModal: React.FC<{
  ticket: Ticket;
  ownerEmail: string;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ ticket, ownerEmail, onClose, onUpdated }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'seed',
      sender: 'owner',
      sender_label: 'You',
      text: ticket.description,
      created_at: ticket.created_at,
    },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState<number>(ticket.rating || 0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchThread = async () => {
    try {
      const { data } = await apiClient.get(`/tickets/${ticket.ticket_id}/messages`);
      if (data.messages?.length) {
        setMessages([
          {
            id: 'seed',
            sender: 'owner',
            sender_label: 'You',
            text: ticket.description,
            created_at: ticket.created_at,
          },
          ...data.messages,
        ]);
      }
    } catch {
      // fall back to the locally-seeded transcript if this fails
    }
  };

  useEffect(() => {
    fetchThread();
    const interval = setInterval(fetchThread, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.ticket_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      await apiClient.post(`/tickets/${ticket.ticket_id}/message`, {
        text,
        sender: 'owner',
        sender_label: 'You',
      });
      await fetchThread();
      onUpdated();
    } catch (e) {
      setDraft(text); // restore on failure so nothing is lost
    } finally {
      setSending(false);
    }
  };

  const submitRating = async (value: number) => {
    setRating(value);
    try {
      await apiClient.post(`/tickets/${ticket.ticket_id}/rate`, { rating: value });
      onUpdated();
    } catch {
      // non-critical — leave rating as selected locally
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">{ticket.ticket_id}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLES[ticket.status] || STATUS_STYLES.open}`}>
                {ticket.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">{ticket.subject}</h2>
            {ticket.assigned_employee_name && (
              <p className="text-xs text-slate-500 mt-0.5">Assigned to {ticket.assigned_employee_name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'owner' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                m.sender === 'owner'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200'
              }`}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.sender === 'owner' ? 'text-blue-200' : 'text-slate-500'}`}>
                  {m.sender_label || (m.sender === 'owner' ? 'You' : 'Support')} · {new Date(m.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Resolved → rating prompt */}
        {ticket.status === 'resolved' && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center gap-2 text-sm text-slate-400">
            <CheckCircle2 size={16} className="text-emerald-400" />
            Resolved — rate your experience:
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} onClick={() => submitRating(v)}>
                <Star size={16} className={v <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'} />
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="p-4 border-t border-slate-800 flex items-end gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-3 text-slate-100 resize-none"
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white p-3 rounded-xl"
          >
            {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
