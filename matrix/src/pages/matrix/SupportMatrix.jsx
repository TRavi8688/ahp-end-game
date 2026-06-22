import { useEffect, useState, useCallback } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, DataTable, Badge,
  Pill, ProgressBar, StatusDot, ActionButton, SearchInput,
  EmptyState, LoadingRows,
} from "../../components/matrix/MatrixUI";

const PRIORITIES = ["","critical","high","medium","low"];
const STATUSES   = ["","open","in_progress","waiting_on_user","escalated","resolved","closed"];

export default function SupportMatrix() {
  const tickets        = useMatrixStore((s) => s.tickets);
  const selected       = useMatrixStore((s) => s.selectedTicket);
  const messages       = useMatrixStore((s) => s.ticketMessages);
  const notes          = useMatrixStore((s) => s.ticketNotes);
  const log            = useMatrixStore((s) => s.ticketLog);
  const filters        = useMatrixStore((s) => s.ticketFilters);
  const loading        = useMatrixStore((s) => s.ticketsLoading);
  const fetchTickets   = useMatrixStore((s) => s.fetchTickets);
  const selectTicket   = useMatrixStore((s) => s.selectTicket);
  const setFilters     = useMatrixStore((s) => s.setTicketFilters);
  const updateStatus   = useMatrixStore((s) => s.updateTicketStatus);
  const escalate       = useMatrixStore((s) => s.escalateTicket);
  const sendMessage    = useMatrixStore((s) => s.sendMessage);
  const addNote        = useMatrixStore((s) => s.addNote);
  const employee       = useMatrixStore((s) => s.employee);

  const [reply, setReply] = useState("");
  const [note, setNote]   = useState("");
  const [tab, setTab]     = useState("messages"); // messages | notes | log

  useEffect(() => { fetchTickets(); }, [filters]);

  const priorityColor = { critical:"#f43f5e", high:"#f97316", medium:"#f59e0b", low:"#475569" };

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      {/* List */}
      <div style={{ width: selected ? 420 : "100%", display:"flex", flexDirection:"column", borderRight: selected ? "1px solid rgba(255,255,255,0.06)" : "none", transition:"width 0.2s" }}>
        <div style={{ padding:"16px 20px 10px", flexShrink:0 }}>
          <SectionHeader title="Support Matrix" sub="All tickets — every channel, every category" />
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
            <SearchInput value={filters.q} onChange={(v) => setFilters({ q:v })} placeholder="Search tickets…" />
            <select value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value })}
              style={{ padding:"5px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:11 }}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p || "All Priorities"}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}
              style={{ padding:"5px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:11 }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s || "All Statuses"}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"0 20px 20px" }}>
          {loading && <LoadingRows n={8} />}
          {!loading && tickets.map((t) => (
            <div key={t.ticket_id} onClick={() => selectTicket(t)} style={{
              background: selected?.ticket_id === t.ticket_id ? "rgba(99,102,241,0.08)" : "#0c1220",
              border: `1px solid ${selected?.ticket_id === t.ticket_id ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderLeft: `3px solid ${priorityColor[t.priority] || "#475569"}`,
              borderRadius:10, padding:"11px 13px", marginBottom:6, cursor:"pointer", transition:"all 0.15s",
            }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{t.ticket_id}</span>
                    <Badge label={t.priority} variant={t.priority} />
                    <Badge label={t.status?.replace(/_/g," ")} variant={t.status} />
                  </div>
                  <div style={{ fontSize:13, color:"#f1f5f9", fontWeight:500, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.subject}</div>
                  <div style={{ fontSize:11, color:"#475569" }}>{t.org_name || t.owner_email} · {t.team} · {t.assigned_employee_name || "Unassigned"}</div>
                </div>
              </div>
            </div>
          ))}
          {!loading && !tickets.length && <EmptyState msg="No tickets match your filters" />}
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{selected.ticket_id}</span>
                  <Badge label={selected.priority} variant={selected.priority} />
                  <Badge label={selected.status?.replace(/_/g," ")} variant={selected.status} />
                </div>
                <h2 style={{ fontSize:15, fontWeight:700, color:"#f1f5f9", margin:0, lineHeight:1.3 }}>{selected.subject}</h2>
                <p style={{ fontSize:12, color:"#475569", margin:"4px 0 0" }}>{selected.org_name} · {selected.category} · {selected.team}</p>
              </div>
              <button onClick={() => selectTicket(null)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:18, padding:"2px 6px" }}>×</button>
            </div>
            {/* Action buttons */}
            <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
              <ActionButton label="Resolve" color="#10b981" onClick={() => updateStatus(selected.ticket_id, "resolved")} />
              <ActionButton label="Escalate" color="#f59e0b" onClick={() => escalate(selected.ticket_id)} />
              <ActionButton label="Close" color="#475569" onClick={() => updateStatus(selected.ticket_id, "closed")} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:0, borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            {[["messages","Messages"],["notes","Internal Notes"],["log","Assignment Log"]].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding:"8px 16px", border:"none", background:"none", cursor:"pointer", fontSize:12,
                color: tab===k ? "#818cf8" : "#475569",
                borderBottom: tab===k ? "2px solid #6366f1" : "2px solid transparent",
              }}>{l}</button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"14px 18px" }}>
            {tab === "messages" && (
              <>
                {messages.map((m, i) => (
                  <div key={i} style={{
                    display:"flex", justifyContent: m.sender === "agent" ? "flex-end" : "flex-start",
                    marginBottom:10,
                  }}>
                    <div style={{
                      maxWidth:"70%", padding:"8px 12px", borderRadius: m.sender==="agent" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      background: m.sender === "agent" ? "rgba(99,102,241,0.18)" : "#0c1220",
                      border: "1px solid rgba(255,255,255,0.06)",
                      fontSize:13, color:"#94a3b8", lineHeight:1.5,
                    }}>
                      <div style={{ fontSize:10, color:"#475569", marginBottom:3 }}>{m.sender_label || m.sender}</div>
                      {m.text}
                    </div>
                  </div>
                ))}
                {!messages.length && <EmptyState msg="No messages yet" />}
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <input value={reply} onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to customer…"
                    style={{ flex:1, padding:"8px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:13, outline:"none" }}
                  />
                  <ActionButton label="Send" color="#6366f1" onClick={async () => {
                    if (!reply.trim()) return;
                    await sendMessage(selected.ticket_id, reply, "agent", employee?.full_name || "Agent");
                    setReply("");
                  }} />
                </div>
              </>
            )}
            {tab === "notes" && (
              <>
                {notes.map((n, i) => (
                  <div key={i} style={{ padding:"10px 12px", background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:8, marginBottom:8 }}>
                    <div style={{ fontSize:10, color:"#f59e0b", marginBottom:4 }}>{n.author} · {new Date(n.created_at).toLocaleString()}</div>
                    <div style={{ fontSize:13, color:"#94a3b8" }}>{n.note}</div>
                  </div>
                ))}
                {!notes.length && <EmptyState msg="No internal notes" />}
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <input value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Add internal note…"
                    style={{ flex:1, padding:"8px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:13, outline:"none" }}
                  />
                  <ActionButton label="Add Note" color="#f59e0b" onClick={async () => {
                    if (!note.trim()) return;
                    await addNote(selected.ticket_id, note);
                    setNote("");
                  }} />
                </div>
              </>
            )}
            {tab === "log" && (
              <DataTable
                cols={["Action","From","To","Note","When"]}
                rows={log.map((l) => [
                  <Badge key="a" label={l.action} variant={l.action === "escalated" ? "critical" : "open"} />,
                  l.from_name || "System",
                  l.to_name || l.to_employee_id,
                  l.note || "—",
                  new Date(l.created_at).toLocaleString(),
                ])}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}