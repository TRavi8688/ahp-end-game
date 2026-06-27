// super-admin-dashboard/src/pages/TicketSystem.jsx
// Full support ticket system for Hospain internal team.
// Shows all hospital/partner tickets. Agents can reply, update status, assign.

import React, { useState, useEffect, useRef } from 'react';
import {
  Ticket, Search, RefreshCw, MessageSquare, AlertTriangle,
  CheckCircle2, Clock, ChevronRight, X, Send, User,
  StickyNote, Phone, Tag, Loader2
} from 'lucide-react';
import { api } from '../lib/apiClient';

const PRIORITY_CONFIG = {
  critical: { color: '#f43f5e', bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.2)', label: 'CRITICAL' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', label: 'HIGH' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', label: 'MEDIUM' },
  low:      { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', label: 'LOW' },
};

const STATUS_CONFIG = {
  open:            { color: '#6366f1', label: 'Open' },
  in_progress:     { color: '#f59e0b', label: 'In Progress' },
  waiting_on_user: { color: '#06b6d4', label: 'Waiting on User' },
  resolved:        { color: '#10b981', label: 'Resolved' },
  closed:          { color: '#475569', label: 'Closed' },
};

export default function TicketSystem() {
  const [tickets,        setTickets]        = useState([]);
  const [stats,          setStats]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [selected,       setSelected]       = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [notes,          setNotes]          = useState([]);
  const [msgText,        setMsgText]        = useState('');
  const [noteText,       setNoteText]       = useState('');
  const [activeTab,      setActiveTab]      = useState('reply');  // 'reply' | 'notes'
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search,         setSearch]         = useState('');
  const [sending,        setSending]        = useState(false);
  const messagesEndRef = useRef(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus)   params.set('status',   filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      if (search)         params.set('q',        search);

      const [ticketRes, statsRes] = await Promise.all([
        api.get(`/api/v1/tickets/all?${params}`),
        api.get('/api/v1/tickets/stats'),
      ]);
      setTickets(ticketRes?.tickets || []);
      setStats(statsRes);
    } catch (e) {
      console.error('Ticket fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId) => {
    // Messages are part of the ticket object in the list — use inline
    // For this demo we build from the ticket's last_message
    setMessages([]);
    setNotes([]);
    try {
      const [notesRes] = await Promise.all([
        api.get(`/api/v1/tickets/${ticketId}/internal-notes`),
      ]);
      setNotes(notesRes?.notes || []);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { fetchTickets(); }, [filterStatus, filterPriority]);

  useEffect(() => {
    if (selected) fetchMessages(selected.ticket_id);
  }, [selected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async () => {
    if (!msgText.trim() || !selected) return;
    setSending(true);
    try {
      await api.post(`/api/v1/tickets/${selected.ticket_id}/message`, {
        text:   msgText,
        sender: 'agent',
        sender_label: 'Hospain Support',
      });
      setMessages(prev => [...prev, {
        id: Date.now(), sender: 'agent', sender_label: 'Hospain Support',
        text: msgText, created_at: new Date().toISOString(),
      }]);
      setMsgText('');
    } catch (e) {
      alert('Failed to send reply: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selected) return;
    setSending(true);
    try {
      await api.post(`/api/v1/tickets/${selected.ticket_id}/internal-notes`, {
        note:   noteText,
        author: 'Agent',
      });
      setNotes(prev => [...prev, {
        id: Date.now(), note: noteText, author: 'Agent',
        created_at: new Date().toISOString(),
      }]);
      setNoteText('');
    } catch (e) {
      alert('Failed to add note: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selected) return;
    try {
      await api.post(`/api/v1/tickets/${selected.ticket_id}/status`, { status: newStatus });
      setSelected(prev => ({ ...prev, status: newStatus }));
      setTickets(prev => prev.map(t =>
        t.ticket_id === selected.ticket_id ? { ...t, status: newStatus } : t
      ));
    } catch (e) {
      alert('Failed to update status: ' + e.message);
    }
  };

  const handleFlagCall = async () => {
    if (!selected) return;
    try {
      await api.post(`/api/v1/tickets/${selected.ticket_id}/flag-call`);
      setSelected(prev => ({ ...prev, call_required: true }));
    } catch (e) { /* ignore */ }
  };

  const pc = PRIORITY_CONFIG;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Ticket size={18} color="#6366f1" />
              Support Tickets
            </h1>
            <p style={{ fontSize: 12, color: '#475569', margin: '3px 0 0' }}>
              All hospital and partner support requests
            </p>
          </div>
          <button onClick={fetchTickets} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
            <RefreshCw size={13} />Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Total',       value: stats.total,          color: '#6366f1' },
              { label: 'Open',        value: stats.open,           color: '#f59e0b' },
              { label: 'Critical',    value: stats.critical,       color: '#f43f5e' },
              { label: 'Resolved Today', value: stats.resolved_today, color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Ticket list */}
        <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
          {/* Filters */}
          <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#334155' }} />
              <input
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 10px 7px 30px', color: '#f1f5f9', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                placeholder="Search tickets..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchTickets()}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: '6px 8px', color: '#64748b', fontSize: 11, outline: 'none' }}
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: '6px 8px', color: '#64748b', fontSize: 11, outline: 'none' }}
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
              >
                <option value="">All Priority</option>
                {Object.entries(pc).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}>
                <Loader2 size={22} color="#6366f1" style={{ animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : tickets.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#334155', fontSize: 13 }}>No tickets found</div>
            ) : tickets.map(ticket => {
              const p = pc[ticket.priority] || pc.medium;
              const s = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
              const isActive = selected?.ticket_id === ticket.ticket_id;
              return (
                <div
                  key={ticket.ticket_id}
                  onClick={() => setSelected(ticket)}
                  style={{
                    padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                    background: isActive ? 'rgba(99,102,241,0.08)' : 'none',
                    borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569' }}>{ticket.ticket_id}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
                      {p.label}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: s.color, fontWeight: 600 }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ticket.subject}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {ticket.org_name || ticket.owner_email}
                    </span>
                    {(ticket.unread_agent_count > 0) && (
                      <span style={{ background: '#6366f1', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10 }}>
                        {ticket.unread_agent_count}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ticket detail */}
        {selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Detail header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6366f1', fontWeight: 700 }}>{selected.ticket_id}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                    background: (pc[selected.priority] || pc.medium).bg,
                    color: (pc[selected.priority] || pc.medium).color,
                    border: `1px solid ${(pc[selected.priority] || pc.medium).border}`,
                  }}>
                    {(pc[selected.priority] || pc.medium).label}
                  </span>
                  {selected.call_required && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                      📞 CALL REQUIRED
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{selected.subject}</h2>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                  {selected.org_name} · {selected.owner_email} · {selected.category} · SLA: {selected.sla_hours}h
                </div>
              </div>

              {/* Status selector */}
              <select
                value={selected.status}
                onChange={e => handleStatusChange(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: STATUS_CONFIG[selected.status]?.color || '#f1f5f9', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <button onClick={handleFlagCall} title="Flag call required" style={{ padding: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer', color: '#64748b' }}>
                <Phone size={14} />
              </button>
              <button onClick={() => setSelected(null)} style={{ padding: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer', color: '#64748b' }}>
                <X size={14} />
              </button>
            </div>

            {/* Original description */}
            <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Original Request</div>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>{selected.description}</p>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#334155', fontSize: 13, paddingTop: 20 }}>
                  No messages yet. Reply below to start the conversation.
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex', flexDirection: msg.sender === 'agent' ? 'row-reverse' : 'row', gap: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: msg.sender === 'agent' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: msg.sender === 'agent' ? '#818cf8' : '#10b981', fontSize: 11, fontWeight: 700,
                  }}>
                    {msg.sender === 'agent' ? 'H' : 'U'}
                  </div>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textAlign: msg.sender === 'agent' ? 'right' : 'left' }}>
                      {msg.sender_label || msg.sender} · {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                    <div style={{
                      padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                      background: msg.sender === 'agent' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${msg.sender === 'agent' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      color: '#e2e8f0',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply/Notes tabs */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {[
                  { id: 'reply', icon: <MessageSquare size={13} />, label: 'Reply to User' },
                  { id: 'notes', icon: <StickyNote size={13} />,     label: 'Internal Notes' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                      border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                      background: activeTab === tab.id ? 'rgba(99,102,241,0.1)' : 'none',
                      color: activeTab === tab.id ? '#c7d2fe' : '#475569',
                      borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                    }}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: 14 }}>
                {activeTab === 'reply' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea
                      style={{
                        flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, padding: '10px 14px', color: '#f1f5f9', fontSize: 13,
                        resize: 'none', outline: 'none', minHeight: 80, fontFamily: 'inherit',
                      }}
                      placeholder="Type your reply to the hospital/partner..."
                      value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sending || !msgText.trim()}
                      style={{
                        padding: '0 16px', background: '#6366f1', border: 'none', borderRadius: 10,
                        color: '#fff', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {sending ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
                      Send
                    </button>
                  </div>
                ) : (
                  <div>
                    {notes.length > 0 && (
                      <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {notes.map(note => (
                          <div key={note.id} style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8 }}>
                            <div style={{ fontSize: 10, color: '#78350f', marginBottom: 3 }}>{note.author} · {new Date(note.created_at).toLocaleString()}</div>
                            <div style={{ fontSize: 12, color: '#fcd34d' }}>{note.note}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea
                        style={{
                          flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 10, padding: '8px 12px', color: '#fcd34d', fontSize: 12,
                          resize: 'none', outline: 'none', minHeight: 64, fontFamily: 'inherit',
                        }}
                        placeholder="Internal note (only visible to Hospain team)..."
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={sending || !noteText.trim()}
                        style={{
                          padding: '0 14px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                          borderRadius: 10, color: '#fcd34d', cursor: sending ? 'not-allowed' : 'pointer',
                          opacity: sending ? 0.5 : 1, fontSize: 12, fontWeight: 600, flexShrink: 0,
                        }}
                      >
                        Add Note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
            <div style={{ textAlign: 'center' }}>
              <Ticket size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>Select a ticket to view and respond</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
