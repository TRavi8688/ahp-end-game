/**
 * src/pages/matrix/SupportMatrix.jsx
 *
 * Module 2 — Support Matrix
 * The heart of Hospin Matrix.
 * Every issue becomes a ticket. All sources, all categories, full lifecycle.
 */
import { useEffect, useState, useRef } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, SectionHeader, Badge, ActionButton, Pill,
  SearchInput, EmptyState, LoadingRows, T,
} from "../../components/matrix/MatrixUI";

const PRIORITY_COLOR = {
  critical: T.rose, high: "#f97316", medium: T.amber, low: T.slate,
};
const LIFECYCLE = [
  "new","assigned","in_progress","waiting_on_user","escalated","resolved","closed"
];
const STATUS_LABEL = {
  new:"NEW", assigned:"ASSIGNED", in_progress:"IN PROGRESS",
  waiting_on_user:"WAITING", escalated:"ESCALATED", resolved:"RESOLVED", closed:"CLOSED",
};
const PRIORITIES = ["","critical","high","medium","low"];
const STATUSES   = ["","open","in_progress","waiting_on_user","escalated","resolved","closed"];
const CATEGORIES = ["","patient_support","hospital_support","pharmacy_support","lab_support","technical","finance","verification","onboarding"];

export default function SupportMatrix() {
  const tickets      = useMatrixStore((s) => s.tickets);
  const selected     = useMatrixStore((s) => s.selectedTicket);
  const messages     = useMatrixStore((s) => s.ticketMessages);
  const notes        = useMatrixStore((s) => s.ticketNotes);
  const log          = useMatrixStore((s) => s.ticketLog);
  const filters      = useMatrixStore((s) => s.ticketFilters);
  const loading      = useMatrixStore((s) => s.ticketsLoading);
  const employee     = useMatrixStore((s) => s.employee);
  const fetchTickets = useMatrixStore((s) => s.fetchTickets);
  const selectTicket = useMatrixStore((s) => s.selectTicket);
  const setFilters   = useMatrixStore((s) => s.setTicketFilters);
  const updateStatus = useMatrixStore((s) => s.updateTicketStatus);
  const escalate     = useMatrixStore((s) => s.escalateTicket);
  const sendMsg      = useMatrixStore((s) => s.sendMessage);
  const addNote      = useMatrixStore((s) => s.addNote);
  const createTicket = useMatrixStore((s) => s.createTicket);

  const [reply, setReply]       = useState("");
  const [note,  setNote]        = useState("");
  const [tab,   setTab]         = useState("messages");
  const [showCreate, setCreate] = useState(false);
  const [newForm, setNewForm]   = useState({ subject:"", category:"technical", priority:"medium", team:"support" });
  const msgEndRef               = useRef(null);

  useEffect(() => { fetchTickets(); }, [filters]);
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const criticalCount = tickets.filter((t) => t.priority === "critical" && !["resolved","closed"].includes(t.status)).length;
  const openCount     = tickets.filter((t) => !["resolved","closed"].includes(t.status)).length;

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>

      {/* ── Ticket List ─────────────────────────────────────────────────── */}
      <div style={{
        width:       selected ? 420 : "100%",
        minWidth:    selected ? 380 : undefined,
        display:     "flex",
        flexDirection:"column",
        borderRight: selected ? `1px solid ${T.border}` : "none",
        transition:  "width 0.2s",
        overflow:    "hidden",
      }}>
        {/* Header */}
        <div style={{ padding:"16px 20px 12px", flexShrink:0, borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <h1 style={{ fontSize:17, fontWeight:900, color:T.text, margin:0 }}>Support Matrix</h1>
              <p style={{ fontSize:11, color:T.textDim, margin:"2px 0 0" }}>
                {openCount} open · <span style={{ color:T.rose }}>{criticalCount} critical</span>
              </p>
            </div>
            <ActionButton label="+ New Ticket" color={T.indigo} onClick={() => setCreate(true)} />
          </div>

          {/* Search */}
          <SearchInput value={filters.q} onChange={(v) => setFilters({ q:v })} placeholder="Search tickets, orgs, IDs…" />

          {/* Filter row */}
          <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
            <select value={filters.priority} onChange={(e) => setFilters({ priority:e.target.value })}
              style={{ padding:"4px 8px", borderRadius:7, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:11, flex:1 }}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p || "All Priorities"}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters({ status:e.target.value })}
              style={{ padding:"4px 8px", borderRadius:7, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:11, flex:1 }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
            </select>
            <select value={filters.category} onChange={(e) => setFilters({ category:e.target.value })}
              style={{ padding:"4px 8px", borderRadius:7, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:11, flex:1 }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c || "All Categories"}</option>)}
            </select>
          </div>
        </div>

        {/* Ticket rows */}
        <div style={{ flex:1, overflowY:"auto", padding:"8px 12px" }}>
          {loading && <LoadingRows n={8} />}
          {!loading && !tickets.length && <EmptyState msg="No tickets match your filters" />}
          {!loading && tickets.map((ticket) => {
            const isSelected = selected?.ticket_id === ticket.ticket_id;
            const priColor   = PRIORITY_COLOR[ticket.priority] || T.slate;
            const slaWarning = ticket.sla_response_due && new Date(ticket.sla_response_due) < new Date(Date.now() + 30*60*1000);
            return (
              <div key={ticket.ticket_id} onClick={() => selectTicket(ticket)} style={{
                background:  isSelected ? "rgba(99,102,241,0.08)" : T.surface,
                border:      `1px solid ${isSelected ? "rgba(99,102,241,0.3)" : T.border}`,
                borderLeft:  `3px solid ${priColor}`,
                borderRadius:10,
                padding:     "11px 13px",
                marginBottom:6,
                cursor:      "pointer",
                transition:  "all 0.15s",
              }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* ID + badges */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:9, color:T.textDim, fontFamily:"monospace" }}>{ticket.ticket_id}</span>
                      <Badge label={ticket.priority}             variant={ticket.priority} />
                      <Badge label={ticket.status?.replace(/_/g," ")} variant={ticket.status} />
                      {slaWarning && <Pill label="SLA RISK" color={T.rose} />}
                    </div>
                    {/* Subject */}
                    <div style={{ fontSize:12, color:T.text, fontWeight:500, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {ticket.subject}
                    </div>
                    {/* Meta */}
                    <div style={{ fontSize:10, color:T.textDim }}>
                      {ticket.org_name || ticket.owner_email || "—"} · {ticket.team || ticket.category} · {ticket.assigned_employee_name || "Unassigned"}
                    </div>
                  </div>
                  {/* SLA timer */}
                  {ticket.sla_resolution_due && (
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:9, color:T.textDim }}>SLA</div>
                      <div style={{ fontSize:11, fontWeight:700, color: slaWarning ? T.rose : T.textMid, fontFamily:"monospace" }}>
                        {Math.max(0, Math.round((new Date(ticket.sla_resolution_due) - Date.now()) / 60000))}m
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ticket Detail ────────────────────────────────────────────────── */}
      {selected && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
          {/* Header */}
          <div style={{ padding:"14px 18px 10px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0, paddingRight:12 }}>
                <div style={{ display:"flex", gap:6, marginBottom:5, flexWrap:"wrap" }}>
                  <span style={{ fontSize:9, color:T.textDim, fontFamily:"monospace" }}>{selected.ticket_id}</span>
                  <Badge label={selected.priority}              variant={selected.priority} />
                  <Badge label={selected.status?.replace(/_/g," ")} variant={selected.status} />
                </div>
                <h2 style={{ fontSize:14, fontWeight:700, color:T.text, margin:"0 0 4px", lineHeight:1.3 }}>{selected.subject}</h2>
                <p style={{ fontSize:11, color:T.textDim, margin:0 }}>
                  {selected.org_name || "—"} · {selected.category} · {selected.team} · Assigned: {selected.assigned_employee_name || "Unassigned"}
                </p>
              </div>
              <button onClick={() => selectTicket(null)} style={{ background:"none", border:"none", color:T.textDim, cursor:"pointer", fontSize:20, flexShrink:0 }}>×</button>
            </div>

            {/* Lifecycle bar */}
            <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:10, overflowX:"auto" }}>
              {LIFECYCLE.map((step, i) => {
                const currIdx = LIFECYCLE.indexOf(selected.status?.toLowerCase()) ?? 0;
                const done    = i <= currIdx;
                const current = i === currIdx;
                return (
                  <div key={step} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                    <div style={{
                      padding:       "2px 8px",
                      borderRadius:  12,
                      fontSize:      9,
                      fontWeight:    700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      background:    current ? T.indigo : done ? `${T.indigo}30` : "rgba(255,255,255,0.04)",
                      color:         current ? "#fff" : done ? T.indigoL : T.textDim,
                      border:        current ? `1px solid ${T.indigo}` : "1px solid transparent",
                    }}>{STATUS_LABEL[step] || step}</div>
                    {i < LIFECYCLE.length - 1 && (
                      <div style={{ width:16, height:1, background: done ? `${T.indigo}50` : T.border, flexShrink:0 }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {selected.status !== "resolved" && (
                <ActionButton label="✓ Resolve" color={T.emerald} onClick={() => updateStatus(selected.ticket_id, "resolved")} />
              )}
              {!["escalated","resolved","closed"].includes(selected.status) && (
                <ActionButton label="↑ Escalate" color={T.amber} onClick={() => escalate(selected.ticket_id, "Manual escalation from Matrix")} />
              )}
              {selected.status !== "closed" && (
                <ActionButton label="Close" color={T.slate} onClick={() => updateStatus(selected.ticket_id, "closed")} />
              )}
              {selected.status === "new" && (
                <ActionButton label="Mark In Progress" color={T.indigo} onClick={() => updateStatus(selected.ticket_id, "in_progress")} />
              )}
              {selected.status === "in_progress" && (
                <ActionButton label="Waiting on Customer" color={T.cyan} onClick={() => updateStatus(selected.ticket_id, "waiting_on_user")} />
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            {[
              ["messages", `Messages${messages.length ? ` (${messages.length})` : ""}`],
              ["notes",    `Notes${notes.length ? ` (${notes.length})` : ""}`],
              ["log",      "Assignment Log"],
            ].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding:      "8px 16px",
                border:       "none",
                background:   "none",
                cursor:       "pointer",
                fontSize:     12,
                fontWeight:   tab===k ? 700 : 400,
                color:        tab===k ? T.indigoL : T.textDim,
                borderBottom: tab===k ? `2px solid ${T.indigo}` : "2px solid transparent",
                transition:   "all 0.12s",
              }}>{l}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex:1, overflowY:"auto", padding:"14px 18px" }}>

            {/* Messages */}
            {tab === "messages" && (
              <>
                {!messages.length && <EmptyState msg="No messages yet — start the conversation" icon="💬" />}
                {messages.map((m, i) => (
                  <div key={i} style={{ display:"flex", justifyContent: m.sender==="agent"?"flex-end":"flex-start", marginBottom:10 }}>
                    <div style={{
                      maxWidth:    "72%",
                      padding:     "9px 13px",
                      borderRadius:m.sender==="agent" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      background:  m.sender==="agent" ? "rgba(99,102,241,0.18)" : T.surface,
                      border:      `1px solid ${m.sender==="agent" ? "rgba(99,102,241,0.3)" : T.border}`,
                      fontSize:    13,
                      color:       T.textMid,
                      lineHeight:  1.5,
                    }}>
                      <div style={{ fontSize:9, color:T.textDim, marginBottom:3 }}>
                        {m.sender_label || m.sender} · {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}
                      </div>
                      {m.text || m.message}
                    </div>
                  </div>
                ))}
                <div ref={msgEndRef} />
                {/* Reply box */}
                <div style={{ marginTop:12, display:"flex", gap:8 }}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); if (reply.trim()) { sendMsg(selected.ticket_id, reply, "agent", employee?.full_name||"Agent"); setReply(""); } } }}
                    placeholder="Reply to customer… (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    style={{ flex:1, padding:"8px 12px", borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, color:T.text, fontSize:12, resize:"none", outline:"none" }}
                    onFocus={(e) => e.target.style.borderColor=T.indigo}
                    onBlur={(e) => e.target.style.borderColor=T.border}
                  />
                  <ActionButton label="Send" color={T.indigo} onClick={async () => {
                    if (!reply.trim()) return;
                    await sendMsg(selected.ticket_id, reply, "agent", employee?.full_name||"Agent");
                    setReply("");
                  }} />
                </div>
              </>
            )}

            {/* Internal Notes */}
            {tab === "notes" && (
              <>
                {!notes.length && <EmptyState msg="No internal notes yet" icon="📝" />}
                {notes.map((n, i) => (
                  <div key={i} style={{ padding:"10px 12px", background:`${T.amber}06`, border:`1px solid ${T.amber}18`, borderRadius:9, marginBottom:8 }}>
                    <div style={{ fontSize:9, color:T.amber, marginBottom:4 }}>
                      📝 {n.author || "Agent"} · {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                    </div>
                    <div style={{ fontSize:13, color:T.textMid, lineHeight:1.5 }}>{n.note || n.text}</div>
                  </div>
                ))}
                {/* Note input */}
                <div style={{ display:"flex", gap:8, marginTop:8 }}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add internal note (not visible to customer)…"
                    rows={2}
                    style={{ flex:1, padding:"8px 12px", borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, color:T.text, fontSize:12, resize:"none", outline:"none" }}
                    onFocus={(e) => e.target.style.borderColor=T.amber}
                    onBlur={(e) => e.target.style.borderColor=T.border}
                  />
                  <ActionButton label="Add Note" color={T.amber} onClick={async () => {
                    if (!note.trim()) return;
                    await addNote(selected.ticket_id, note);
                    setNote("");
                  }} />
                </div>
              </>
            )}

            {/* Assignment Log */}
            {tab === "log" && (
              <>
                {!log.length && <EmptyState msg="No assignment history yet" icon="🔄" />}
                {log.map((entry, i) => (
                  <div key={i} style={{ display:"flex", gap:10, marginBottom:10, padding:"8px 12px", background:"rgba(255,255,255,0.02)", border:`1px solid ${T.border}`, borderRadius:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:6, marginBottom:3, alignItems:"center" }}>
                        <Badge label={entry.action} variant={entry.action==="escalated"?"critical":"open"} />
                        <span style={{ fontSize:11, color:T.textMid }}>
                          {entry.from_name || entry.from_employee_id || "System"} → {entry.to_name || entry.to_employee_id || "—"}
                        </span>
                      </div>
                      {entry.note && <div style={{ fontSize:11, color:T.textDim }}>{entry.note}</div>}
                    </div>
                    <div style={{ fontSize:10, color:T.textDim, whiteSpace:"nowrap" }}>
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Create Ticket Modal ──────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:24, width:440, maxWidth:"95%" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:18 }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:T.text, margin:0 }}>Create New Ticket</h3>
              <button onClick={() => setCreate(false)} style={{ background:"none", border:"none", color:T.textDim, cursor:"pointer", fontSize:20 }}>×</button>
            </div>
            {[
              { label:"Subject", key:"subject", type:"text",   placeholder:"Brief description of the issue" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:T.textDim, display:"block", marginBottom:4 }}>{label}</label>
                <input type={type} value={newForm[key]||""} onChange={(e) => setNewForm((f)=>({...f,[key]:e.target.value}))}
                  placeholder={placeholder}
                  style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:"#060a12", color:T.text, fontSize:12, outline:"none", boxSizing:"border-box" }} />
              </div>
            ))}
            {[
              { label:"Category", key:"category", opts:CATEGORIES.filter(Boolean) },
              { label:"Priority", key:"priority", opts:PRIORITIES.filter(Boolean) },
              { label:"Team",     key:"team",     opts:["support","finance","engineering","onboarding","data"] },
            ].map(({ label, key, opts }) => (
              <div key={key} style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:T.textDim, display:"block", marginBottom:4 }}>{label}</label>
                <select value={newForm[key]||""} onChange={(e) => setNewForm((f)=>({...f,[key]:e.target.value}))}
                  style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:"#060a12", color:T.textMid, fontSize:12, outline:"none" }}>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:18 }}>
              <ActionButton label="Cancel"        color={T.slate}   onClick={() => setCreate(false)} />
              <ActionButton label="Create Ticket" color={T.indigo}  onClick={async () => {
                if (!newForm.subject) return;
                await createTicket({ ...newForm, source:"internal", created_by: employee?.employee_id });
                setCreate(false);
                setNewForm({ subject:"", category:"technical", priority:"medium", team:"support" });
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
