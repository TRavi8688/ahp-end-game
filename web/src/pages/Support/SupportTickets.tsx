// src/pages/Support/SupportTickets.tsx
// Partner-facing support ticket system
// Partners raise tickets against any order or lab report
// Hospyn internal team resolves — partners only see status + SLA countdown

import React, { useEffect, useState, useCallback } from 'react';
import {
  LifeBuoy, Plus, X, Clock, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, Loader2, MessageSquare
} from 'lucide-react';
import apiClient from '../../services/apiClient';

interface Ticket {
  id: string;
  ticket_number: string;
  category: 'order_issue' | 'report_error' | 'payment_dispute' | 'system_bug' | 'other';
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reference_id: string | null;   // order_id or lab_order_id
  reference_type: 'order' | 'lab_order' | null;
  sla_deadline: string;
  created_at: string;
  resolved_at: string | null;
  partner_message: string | null;
  internal_note: string;         // shown to partner as generic update
}

const statusColor: Record<string, string> = {
  open:        '#f59e0b',
  in_progress: '#0ea5e9',
  resolved:    '#22c55e',
  closed:      '#475569',
};

const statusLabel: Record<string, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  closed:      'Closed',
};

const priorityColor: Record<string, string> = {
  low:      '#22c55e',
  medium:   '#0ea5e9',
  high:     '#f59e0b',
  critical: '#ef4444',
};

const CATEGORIES = [
  { value: 'order_issue',      label: 'Order Issue'       },
  { value: 'report_error',     label: 'Lab Report Error'  },
  { value: 'payment_dispute',  label: 'Payment Dispute'   },
  { value: 'system_bug',       label: 'System Bug'        },
  { value: 'other',            label: 'Other'             },
];

function slaCountdown(deadline: string): { label: string; urgent: boolean } {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return { label: 'SLA breached', urgent: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h < 2) return { label: `${h}h ${m}m left`, urgent: true };
  if (h < 24) return { label: `${h}h left`, urgent: false };
  return { label: `${Math.floor(h / 24)}d left`, urgent: false };
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function SupportTickets() {
  const [tickets,      setTickets]      = useState<Ticket[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [actionLoad,   setActionLoad]   = useState(false);
  const [error,        setError]        = useState('');
  const [showCreate,   setShowCreate]   = useState(false);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const [form, setForm] = useState({
    category:       'order_issue',
    subject:        '',
    description:    '',
    reference_id:   '',
    reference_type: 'order' as 'order' | 'lab_order' | null,
    priority:       'medium',
  });

  const load = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const { data } = await apiClient.get<Ticket[]>(`/api/v1/partner/support/tickets${params}`);
      setTickets(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const createTicket = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      setError('Subject and description are required.');
      return;
    }
    setActionLoad(true);
    try {
      await apiClient.post('/api/v1/partner/support/tickets', {
        ...form,
        reference_id:   form.reference_id || null,
        reference_type: form.reference_id ? form.reference_type : null,
      });
      setShowCreate(false);
      setForm({ category:'order_issue', subject:'', description:'', reference_id:'', reference_type:'order', priority:'medium' });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setActionLoad(false);
    }
  };

  const STATUS_TABS = ['all', 'open', 'in_progress', 'resolved', 'closed'];

  const openCount = tickets.filter(t => t.status === 'open').length;

  return (
    <div className="min-h-screen bg-[#020917] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e3a5f]/60 sticky top-0 z-30 bg-[#020917]/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <LifeBuoy size={20} className="text-[#0ea5e9]"/>
          <h1 className="text-xl font-bold text-white">Support Tickets</h1>
          {openCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#fbbf24] text-xs font-semibold">
              {openCount} open
            </span>
          )}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/20 text-[#38bdf8] text-sm font-medium hover:bg-[#0ea5e9]/20 transition-colors flex items-center gap-2">
          <Plus size={14}/> Raise Ticket
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle size={16}/>{error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14}/></button>
        </div>
      )}

      {/* SLA info banner */}
      <div className="mx-6 mt-4 bg-[#0d1929] border border-[#1e3a5f]/40 rounded-xl px-4 py-3 text-xs text-slate-400 flex items-center gap-3">
        <Clock size={14} className="text-[#0ea5e9]"/>
        <span>SLA: Critical → 4h · High → 12h · Medium → 24h · Low → 72h. Hospyn internal team handles all resolutions.</span>
      </div>

      {/* Status tabs */}
      <div className="px-6 pt-4 flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button key={tab} onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
              statusFilter === tab
                ? 'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#38bdf8]'
                : 'bg-[#0d1929] border-[#1e3a5f] text-[#64748b] hover:text-white'
            }`}>
            {tab === 'all' ? 'All' : statusLabel[tab]}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading ? [...Array(4)].map((_,i) => (
          <div key={i} className="h-24 bg-[#0d1929] rounded-2xl border border-[#1e3a5f]/40 animate-pulse"/>
        )) : tickets.length === 0 ? (
          <div className="text-center py-20 text-[#334155]">
            <LifeBuoy size={40} className="mx-auto mb-3 opacity-30"/>
            <p>No tickets found</p>
            <p className="text-sm mt-1">Raise a ticket if something goes wrong</p>
          </div>
        ) : tickets.map(ticket => {
          const sla   = slaCountdown(ticket.sla_deadline);
          const isExp = expanded === ticket.id;
          return (
            <div key={ticket.id}
              className={`bg-[#0d1929] border rounded-2xl transition-all ${
                isExp ? 'border-[#0ea5e9]/40' : 'border-[#1e3a5f]/60 hover:border-[#1e3a5f]'
              }`}>
              <div className="p-4 cursor-pointer"
                onClick={() => setExpanded(isExp ? null : ticket.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-[#475569]">{ticket.ticket_number}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background:`${statusColor[ticket.status]}18`, color:statusColor[ticket.status] }}>
                        {statusLabel[ticket.status]}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{ color:priorityColor[ticket.priority], borderColor:`${priorityColor[ticket.priority]}40`, background:`${priorityColor[ticket.priority]}10` }}>
                        {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                      </span>
                      {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${
                          sla.urgent
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-[#0d1929] text-[#475569] border border-[#1e3a5f]/40'
                        }`}>
                          <Clock size={9}/>{sla.label}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-semibold text-sm truncate">{ticket.subject}</p>
                    <p className="text-[#475569] text-xs mt-0.5">
                      {CATEGORIES.find(c => c.value === ticket.category)?.label} · {timeAgo(ticket.created_at)}
                    </p>
                  </div>
                  {isExp ? <ChevronUp size={16} className="text-slate-400 shrink-0"/> : <ChevronDown size={16} className="text-slate-400 shrink-0"/>}
                </div>
              </div>

              {isExp && (
                <div className="border-t border-[#1e3a5f]/40 p-4 space-y-4">
                  <div>
                    <p className="text-xs text-[#475569] uppercase tracking-widest mb-2">Description</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{ticket.description}</p>
                  </div>

                  {ticket.reference_id && (
                    <div className="bg-[#050d18] border border-[#1e3a5f]/40 rounded-xl px-4 py-3">
                      <p className="text-xs text-[#475569] mb-1">Linked {ticket.reference_type === 'lab_order' ? 'Lab Order' : 'Order'}</p>
                      <p className="text-white font-mono text-sm">{ticket.reference_id}</p>
                    </div>
                  )}

                  {ticket.internal_note && (
                    <div className="bg-[#0ea5e9]/5 border border-[#0ea5e9]/20 rounded-xl px-4 py-3">
                      <p className="text-xs text-[#0ea5e9] mb-1 flex items-center gap-1">
                        <MessageSquare size={11}/> Update from Hospyn Team
                      </p>
                      <p className="text-slate-300 text-sm">{ticket.internal_note}</p>
                    </div>
                  )}

                  {ticket.resolved_at && (
                    <div className="flex items-center gap-2 text-[#22c55e] text-sm">
                      <CheckCircle2 size={14}/>
                      Resolved {timeAgo(ticket.resolved_at)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create ticket modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1929] border border-[#1e3a5f] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <LifeBuoy size={18}/> Raise Support Ticket
              </h3>
              <button onClick={() => setShowCreate(false)}><X size={18} className="text-slate-400 hover:text-white"/></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value as any})}
                    className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ea5e9] appearance-none">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Priority</label>
                  <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                    className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ea5e9] appearance-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Subject</label>
                <input type="text" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
                  className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ea5e9]"
                  placeholder="Brief description of the issue"/>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ea5e9] h-28 resize-none"
                  placeholder="Describe exactly what happened, when, and what was expected..."/>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
                  Link to Order / Lab Order (optional)
                </label>
                <div className="flex gap-2">
                  <input type="text" value={form.reference_id} onChange={e => setForm({...form, reference_id: e.target.value})}
                    className="flex-1 bg-[#050d18] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ea5e9] font-mono"
                    placeholder="Order ID or Lab Order ID"/>
                  <select value={form.reference_type || 'order'} onChange={e => setForm({...form, reference_type: e.target.value as any})}
                    className="w-32 bg-[#050d18] border border-[#1e3a5f] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#0ea5e9] appearance-none">
                    <option value="order">Order</option>
                    <option value="lab_order">Lab Order</option>
                  </select>
                </div>
              </div>

              <button onClick={createTicket} disabled={actionLoad}
                className="w-full py-3 rounded-xl bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 text-[#38bdf8] font-semibold hover:bg-[#0ea5e9]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoad ? <Loader2 size={16} className="animate-spin"/> : null}
                Submit Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
