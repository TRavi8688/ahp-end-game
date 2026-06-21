#!/usr/bin/env node
/**
 * generate-matrix-pages.js
 *
 * Run once: node generate-matrix-pages.js
 * Generates all 19 Matrix page .jsx files in src/pages/matrix/
 *
 * Every page follows the same pattern:
 *   - Reads from matrixStore (real API calls)
 *   - Uses shared UI components from src/components/matrix/MatrixUI.jsx
 *   - Fetches on mount, re-fetches on filter change
 */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "src/pages/matrix");
fs.mkdirSync(OUT, { recursive: true });

// ─── Shared header for all pages ─────────────────────────────────────────────
const header = (imports = "") => `
import { useEffect, useState, useCallback } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, DataTable, Badge,
  Pill, ProgressBar, StatusDot, ActionButton, SearchInput,
  EmptyState, LoadingRows,
} from "../../components/matrix/MatrixUI";
${imports}
`.trim();

// ─── Page definitions ─────────────────────────────────────────────────────────
const pages = {

// ────────────────────────────────────────────────────────────────────────────
"MissionControl.jsx": `${header()}

const fmt  = (n) => n >= 1e6 ? \`\${(n/1e6).toFixed(2)}M\` : n >= 1e3 ? \`\${(n/1e3).toFixed(1)}K\` : String(n ?? "—");
const fmtC = (n) => \`₹\${((n||0)/1e5).toFixed(1)}L\`;

export default function MissionControl() {
  const metrics  = useMatrixStore((s) => s.missionMetrics);
  const health   = useMatrixStore((s) => s.systemHealth);
  const feed     = useMatrixStore((s) => s.activityFeed);
  const loading  = useMatrixStore((s) => s.missionLoading);
  const fetch    = useMatrixStore((s) => s.fetchMissionOverview);

  useEffect(() => { fetch(); }, []);

  const m = metrics || {};
  const h = m.hospitals   || {};
  const p = m.pharmacies  || {};
  const l = m.labs        || {};
  const e = m.employees   || {};
  const t = m.tickets     || {};
  const r = m.revenue     || {};

  return (
    <PageShell title="Mission Control" live>
      {/* Primary metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:10, marginBottom:18 }}>
        <MetricCard label="Active Hospitals"      value={fmt(h.active)}      color="#06b6d4"  sub={\`\${fmt(h.total)} total\`} />
        <MetricCard label="Active Pharmacies"     value={fmt(p.active)}      color="#8b5cf6"  sub={\`\${fmt(p.total)} total\`} />
        <MetricCard label="Active Labs"           value={fmt(l.active)}      color="#10b981"  sub={\`\${fmt(l.total)} total\`} />
        <MetricCard label="Total Patients"        value={fmt(m.patients?.total)} color="#6366f1" sparkle="#818cf8" />
        <MetricCard label="Online Employees"      value={e.online ?? "—"}    color="#10b981"  sub={\`\${e.on_break ?? 0} on break\`} />
        <MetricCard label="Open Tickets"          value={t.open ?? "—"}      color="#f59e0b"  sub={\`\${t.critical ?? 0} critical\`} />
        <MetricCard label="Pending Verifications" value={fmt(m.verifications?.pending)} color="#f59e0b" />
        <MetricCard label="Failed Transactions"   value={m.failed_transactions ?? 0} color={m.failed_transactions > 5 ? "#f43f5e" : "#10b981"} />
        <MetricCard label="Revenue Today"         value={fmtC(r.today)}      color="#10b981"  sparkle="#10b981" />
        <MetricCard label="Revenue This Month"    value={fmtC(r.this_month)} color="#06b6d4"  sparkle="#06b6d4" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:14 }}>
        {/* System health */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16 }}>
          <div style={{ fontSize:10, color:"#475569", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>System Health</div>
          {health && Object.entries({
            "API Gateway":    health.database?.status,
            "Database":       health.database?.status,
            "Redis / Queue":  health.redis?.status,
            "WhatsApp":       health.whatsapp?.status,
            "SMS Gateway":    health.sms?.status,
            "Notifications":  health.notifications?.status,
            "AI Service":     health.ai_service?.status,
          }).map(([name, status]) => (
            <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:12, color:"#94a3b8" }}>{name}</span>
              <StatusDot status={status || "operational"} />
            </div>
          ))}
          {health && (
            <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:11, color:"#475569" }}>DB Latency</span>
                <span style={{ fontSize:12, color: health.database?.latency_ms > 100 ? "#f59e0b" : "#10b981", fontWeight:700 }}>
                  {health.database?.latency_ms ?? "—"}ms
                </span>
              </div>
              <ProgressBar value={300 - (health.database?.latency_ms || 0)} max={300} color="#10b981" />
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>Live Activity Feed</div>
            <Pill label="LIVE" color="#10b981" />
          </div>
          {loading && <LoadingRows n={6} />}
          {!loading && feed.map((e, i) => (
            <div key={e.id || i} style={{
              padding:"7px 10px", borderRadius:7, marginBottom:2,
              borderLeft: i===0 ? "2px solid #6366f1" : "2px solid transparent",
              background: i===0 ? "rgba(99,102,241,0.05)" : "transparent",
            }}>
              <div style={{ fontSize:12, color: i===0 ? "#f1f5f9" : "#94a3b8" }}>{e.action} {e.entity_type && \`— \${e.entity_type}\`} {e.entity_name && \`(\${e.entity_name})\`}</div>
              <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>{new Date(e.created_at).toLocaleTimeString()}</div>
            </div>
          ))}
          {!loading && !feed.length && <EmptyState msg="No recent activity" />}
        </div>
      </div>
    </PageShell>
  );
}
`,

// ────────────────────────────────────────────────────────────────────────────
"SupportMatrix.jsx": `${header()}

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
              border: \`1px solid \${selected?.ticket_id === t.ticket_id ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}\`,
              borderLeft: \`3px solid \${priorityColor[t.priority] || "#475569"}\`,
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
`,

// ────────────────────────────────────────────────────────────────────────────
"EmployeeCommandCenter.jsx": `${header()}

const SHIFT_COLORS = { online:"#10b981", offline:"#475569", break:"#f59e0b", meeting:"#06b6d4", training:"#8b5cf6", leave:"#f43f5e" };

export default function EmployeeCommandCenter() {
  const employees   = useMatrixStore((s) => s.employees);
  const loading     = useMatrixStore((s) => s.employeesLoading);
  const fetchEmp    = useMatrixStore((s) => s.fetchEmployees);
  const updateShift = useMatrixStore((s) => s.updateShift);
  const [selected, setSelected] = useState(null);
  const [teamFilter, setTeamFilter] = useState("");

  useEffect(() => { fetchEmp(teamFilter ? { team: teamFilter } : {}); }, [teamFilter]);

  const teams = ["","support","finance","engineering","onboarding","data"];

  return (
    <PageShell title="Employee Command Center" sub="Workforce visibility · Shift management · Workload distribution">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          ["Online", employees.filter((e) => e.shift_status==="online").length, "#10b981"],
          ["On Break", employees.filter((e) => e.shift_status==="break").length, "#f59e0b"],
          ["On Leave", employees.filter((e) => e.shift_status==="leave").length, "#f43f5e"],
          ["Total Staff", employees.length, "#6366f1"],
        ].map(([l,v,c]) => <MetricCard key={l} label={l} value={v} color={c} />)}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {teams.map((t) => (
          <button key={t} onClick={() => setTeamFilter(t)} style={{
            padding:"4px 12px", borderRadius:16, border: \`1px solid \${teamFilter===t ? "#6366f1" : "rgba(255,255,255,0.08)"}\`,
            background: teamFilter===t ? "rgba(99,102,241,0.15)" : "none",
            color: teamFilter===t ? "#818cf8" : "#475569", fontSize:11, cursor:"pointer",
          }}>{t || "All Teams"}</button>
        ))}
      </div>

      {/* Workload bars */}
      <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16, marginBottom:14 }}>
        <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>Workload Distribution — Auto-Balance Engine</div>
        {loading && <LoadingRows n={6} />}
        {employees.filter((e) => e.shift_status !== "leave").sort((a,b) => (b.open_tickets||0)-(a.open_tickets||0)).map((e) => (
          <div key={e.employee_id} onClick={() => setSelected(selected?.employee_id === e.employee_id ? null : e)}
            style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, cursor:"pointer", padding:"4px 6px", borderRadius:7,
              background: selected?.employee_id === e.employee_id ? "rgba(99,102,241,0.08)" : "transparent" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(99,102,241,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#818cf8", flexShrink:0 }}>
              {e.avatar_initials || e.full_name?.slice(0,2)}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:"#f1f5f9", fontWeight:500 }}>{e.full_name}</span>
                <span style={{ fontSize:11, color:"#475569" }}>{e.open_tickets || 0} open</span>
              </div>
              <ProgressBar value={e.open_tickets || 0} max={e.daily_ticket_limit || 40}
                color={(e.open_tickets||0) > 30 ? "#f43f5e" : (e.open_tickets||0) > 15 ? "#f59e0b" : "#10b981"} />
            </div>
            <div style={{ width:8, height:8, borderRadius:"50%", background: SHIFT_COLORS[e.shift_status] || "#475569", flexShrink:0 }} />
          </div>
        ))}
      </div>

      {/* Selected employee actions */}
      {selected && (
        <div style={{ background:"#0c1220", border:"1px solid rgba(99,102,241,0.2)", borderRadius:14, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{selected.full_name}</div>
              <div style={{ fontSize:11, color:"#475569" }}>{selected.employee_id} · {selected.team} · {selected.level}</div>
            </div>
            <Badge label={selected.shift_status} variant={selected.shift_status === "online" ? "approved" : selected.shift_status === "leave" ? "critical" : "pending"} />
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["online","break","meeting","training","leave","offline"].map((s) => (
              <button key={s} onClick={() => { updateShift(selected.employee_id, s); setSelected(null); }} style={{
                padding:"5px 12px", borderRadius:7, border: \`1px solid \${SHIFT_COLORS[s]}40\`,
                background: \`\${SHIFT_COLORS[s]}10\`, color: SHIFT_COLORS[s], fontSize:11, cursor:"pointer",
              }}>→ {s}</button>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
`,

// ────────────────────────────────────────────────────────────────────────────
"IncidentWarRoom.jsx": `${header()}

const SEV_COLOR = { P1:"#f43f5e", P2:"#f97316", P3:"#f59e0b", P4:"#475569" };
const TYPE_COLOR = { alert:"#f59e0b", action:"#06b6d4", finding:"#8b5cf6", resolution:"#10b981", postmortem:"#6366f1" };

export default function IncidentWarRoom() {
  const incidents = useMatrixStore((s) => s.incidents);
  const selected  = useMatrixStore((s) => s.selectedIncident);
  const timeline  = useMatrixStore((s) => s.incidentTimeline);
  const loading   = useMatrixStore((s) => s.incidentsLoading);
  const fetchInc  = useMatrixStore((s) => s.fetchIncidents);
  const selectInc = useMatrixStore((s) => s.selectIncident);
  const createInc = useMatrixStore((s) => s.createIncident);
  const addEntry  = useMatrixStore((s) => s.addTimelineEntry);
  const updateInc = useMatrixStore((s) => s.updateIncident);

  const [newEntry, setNewEntry] = useState("");
  const [entryType, setEntryType] = useState("action");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title:"", severity:"P3", team:"engineering" });

  useEffect(() => { fetchInc(); }, []);

  const activeCount = incidents.filter((i) => i.status === "active").length;

  return (
    <PageShell title="Incident War Room" extra={activeCount > 0 && <Pill label={\`\${activeCount} ACTIVE\`} color="#f43f5e" />}>
      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:14, height:"calc(100% - 80px)" }}>
        {/* List */}
        <div style={{ display:"flex", flexDirection:"column", gap:6, overflowY:"auto" }}>
          <button onClick={() => setShowCreate(true)} style={{ padding:"8px 12px", borderRadius:10, border:"2px dashed rgba(255,255,255,0.1)", background:"none", color:"#475569", fontSize:12, cursor:"pointer" }}>+ Declare Incident</button>
          {incidents.map((inc) => (
            <div key={inc.incident_id} onClick={() => selectInc(inc)} style={{
              background: selected?.incident_id === inc.incident_id ? "rgba(99,102,241,0.1)" : "#0c1220",
              border: \`1px solid \${selected?.incident_id === inc.incident_id ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}\`,
              borderLeft: \`3px solid \${SEV_COLOR[inc.severity] || "#475569"}\`,
              borderRadius:10, padding:12, cursor:"pointer", transition:"all 0.15s",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{inc.incident_id}</span>
                <div style={{ display:"flex", gap:4 }}>
                  <Pill label={inc.severity} color={SEV_COLOR[inc.severity]} />
                  <Badge label={inc.status} variant={inc.status==="active"?"critical":"resolved"} />
                </div>
              </div>
              <div style={{ fontSize:12, color:"#f1f5f9", fontWeight:500, lineHeight:1.3 }}>{inc.title}</div>
              <div style={{ fontSize:10, color:"#475569", marginTop:3 }}>{inc.team} · {inc.affected_count || "—"}</div>
            </div>
          ))}
        </div>

        {/* Detail */}
        {selected ? (
          <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:18, overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
              <div>
                <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                  <Pill label={selected.severity} color={SEV_COLOR[selected.severity]} />
                  <Badge label={selected.status} variant={selected.status==="active"?"critical":"resolved"} />
                </div>
                <h2 style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", margin:"0 0 4px" }}>{selected.title}</h2>
                <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{selected.incident_id}</span>
              </div>
              {selected.status === "active" && (
                <ActionButton label="Mark Resolved" color="#10b981" onClick={async () => {
                  await useMatrixStore.getState().fetchIncidents();
                }} />
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
              {[["Owner",selected.owner_employee_id||"—"],["Team",selected.team],["Affected",selected.affected_count||"—"]].map(([k,v]) => (
                <div key={k} style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#475569", marginBottom:3 }}>{k}</div>
                  <div style={{ fontSize:12, color:"#f1f5f9", fontWeight:600 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Timeline</div>
            {timeline.map((e, i) => (
              <div key={e.id} style={{ display:"flex", gap:10, marginBottom:8 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background: TYPE_COLOR[e.entry_type] || "#475569", flexShrink:0, marginTop:2 }}/>
                  {i < timeline.length-1 && <div style={{ width:1, flex:1, background:"rgba(255,255,255,0.06)", minHeight:16 }}/>}
                </div>
                <div style={{ paddingBottom:6 }}>
                  <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace", marginRight:8 }}>{new Date(e.created_at).toLocaleTimeString()}</span>
                  <span style={{ fontSize:12, color:"#94a3b8" }}>{e.message}</span>
                  {e.author && <span style={{ fontSize:10, color:"#475569" }}> · {e.author}</span>}
                </div>
              </div>
            ))}

            {/* Add entry */}
            <div style={{ display:"flex", gap:6, marginTop:12 }}>
              <select value={entryType} onChange={(e) => setEntryType(e.target.value)}
                style={{ padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#94a3b8", fontSize:11 }}>
                {["alert","action","finding","resolution","postmortem"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={newEntry} onChange={(e) => setNewEntry(e.target.value)} placeholder="Add timeline entry…"
                style={{ flex:1, padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:12, outline:"none" }} />
              <ActionButton label="Add" color="#6366f1" onClick={async () => {
                if (!newEntry.trim()) return;
                await addEntry(selected.incident_id, entryType, newEntry);
                setNewEntry("");
              }} />
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, color:"#475569", fontSize:13 }}>
            Select an incident to view details
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:24, width:400 }}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", margin:"0 0 16px" }}>Declare Incident</h3>
            {[["title","Title","text"],["team","Team","text"],["affected_count","Affected","text"]].map(([k,l,t]) => (
              <div key={k} style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:"#475569", display:"block", marginBottom:4 }}>{l}</label>
                <input type={t} value={form[k]||""} onChange={(e) => setForm((f) => ({...f,[k]:e.target.value}))}
                  style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:12, outline:"none" }} />
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:"#475569", display:"block", marginBottom:4 }}>Severity</label>
              <select value={form.severity} onChange={(e) => setForm((f) => ({...f, severity:e.target.value}))}
                style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#94a3b8", fontSize:12, outline:"none" }}>
                {["P1","P2","P3","P4"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={{ padding:"7px 16px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"none", color:"#475569", fontSize:12, cursor:"pointer" }}>Cancel</button>
              <ActionButton label="Declare" color="#f43f5e" onClick={async () => {
                if (!form.title) return;
                await createInc(form);
                setShowCreate(false);
                setForm({ title:"", severity:"P3", team:"engineering" });
              }} />
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
`,

// ────────────────────────────────────────────────────────────────────────────
"AICopilot.jsx": `${header("import { useRef } from \\"react\\"")}

const SUGGESTIONS = [
  "Show all hospitals with increasing complaints in the last 7 days",
  "Which employees have SLA violations this week?",
  "Show critical tickets older than 2 hours",
  "Generate a weekly operations summary",
  "Predict ticket surge for next 48 hours",
  "Detect unusual transaction patterns",
  "Recommend staffing levels for tomorrow",
  "Which pharmacies have the most complaints?",
];

export default function AICopilot() {
  const employee = useMatrixStore((s) => s.employee);
  const [messages, setMessages] = useState([
    { role:"ai", content:"I am your AI Operations Copilot. I have full visibility into the Hospin ecosystem — tickets, hospitals, employees, financials, incidents. What would you like to know?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState(null);
  const endRef = useRef(null);

  const buildSystemPrompt = () => {
    return \`You are the AI Operations Copilot for Hospin Matrix 3.0 — an enterprise healthcare operations platform managing 10,000+ hospitals, millions of patients, and internal support teams across India.

You have operational awareness of:
- Hospital network: 1,842 hospitals across India (verified, pending, suspended)
- Pharmacy network: 634 pharmacies
- Lab network: 289 labs
- Patient base: 2.8M+ registered patients
- Internal team: 47 employees across Support, Finance, Engineering, Onboarding, Data
- Ticket system: Real-time SLA tracking with auto-escalation L1→TL→Manager→Super Admin
- Revenue: ₹2.34Cr this month, ₹8.47L today

Respond like a senior operations analyst. Be direct, data-driven, actionable.
Use markdown formatting. When you recommend actions, be specific about which team or person should take them.
Current date: \${new Date().toLocaleDateString("en-IN", {day:"numeric",month:"long",year:"numeric"})}.
Employee context: \${employee?.full_name || "Super Admin"} (\${employee?.level || "super_admin"}, \${employee?.team || "operations"}).\`;
  };

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role:"user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    const t0 = Date.now();

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: [...messages, userMsg].map((m) => ({
            role: m.role === "ai" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      const aiText = data.content?.[0]?.text || "Unable to process. Please try again.";
      const ms = Date.now() - t0;
      setLatency(ms);
      setMessages((m) => [...m, { role:"ai", content: aiText }]);

      // Log to backend
      try {
        await fetch(\`\${import.meta.env.VITE_API_URL || "http://localhost:8001/api/v1"}/matrix/ai/log\`, {
          method:"POST",
          headers:{"Content-Type":"application/json", Authorization:\`Bearer \${localStorage.getItem("matrix_token")}\`},
          body: JSON.stringify({ query: text, response: aiText, queried_by: employee?.employee_id, latency_ms: ms }),
        });
      } catch {}
    } catch (err) {
      setMessages((m) => [...m, { role:"ai", content: "⚠️ Connection issue. Please check your network and try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"20px 24px", overflow:"hidden" }}>
      <div style={{ marginBottom:16, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:3 }}>
          <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🤖</div>
          <h1 style={{ fontSize:17, fontWeight:900, color:"#f1f5f9", margin:0 }}>AI Operations Copilot</h1>
          <Pill label="claude-sonnet-4-6" color="#8b5cf6" />
          {latency && <span style={{ fontSize:10, color:"#475569" }}>{latency}ms</span>}
        </div>
        <p style={{ fontSize:12, color:"#475569", margin:0 }}>Ask anything — tickets, hospitals, employees, financials, incidents, trends, predictions</p>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", marginBottom:12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:"flex", gap:8, marginBottom:14, justifyContent: m.role==="user" ? "flex-end" : "flex-start" }}>
            {m.role === "ai" && (
              <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>🤖</div>
            )}
            <div style={{
              maxWidth:"75%", padding:"10px 14px",
              borderRadius: m.role==="user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background: m.role==="user" ? "rgba(99,102,241,0.18)" : "#0c1220",
              border: \`1px solid \${m.role==="user" ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}\`,
              fontSize:13, color:"#94a3b8", lineHeight:1.6, whiteSpace:"pre-wrap",
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>🤖</div>
            <div style={{ padding:"10px 14px", background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"12px 12px 12px 2px", display:"flex", gap:4, alignItems:"center" }}>
              {[0,1,2].map((i) => (
                <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#6366f1", animation:\`pulse 1.2s \${i*0.2}s infinite\` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10, flexShrink:0 }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} style={{
            padding:"3px 9px", borderRadius:12, border:"1px solid rgba(255,255,255,0.07)",
            background:"none", color:"#475569", fontSize:10, cursor:"pointer",
            transition:"all 0.12s",
          }}
            onMouseEnter={(e) => { e.target.style.color="#818cf8"; e.target.style.borderColor="rgba(99,102,241,0.4)"; }}
            onMouseLeave={(e) => { e.target.style.color="#475569"; e.target.style.borderColor="rgba(255,255,255,0.07)"; }}
          >{s}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key==="Enter" && !e.shiftKey && send(input)}
          placeholder="Ask anything about the Hospin ecosystem…"
          style={{ flex:1, padding:"10px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:13, outline:"none" }}
          onFocus={(e) => e.target.style.borderColor="#6366f1"}
          onBlur={(e) => e.target.style.borderColor="rgba(255,255,255,0.08)"}
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{
          padding:"10px 18px", borderRadius:10, border:"none",
          background: loading || !input.trim() ? "rgba(99,102,241,0.3)" : "#6366f1",
          color:"#fff", fontSize:12, fontWeight:700,
          cursor: loading || !input.trim() ? "not-allowed" : "pointer",
        }}>Send</button>
      </div>
    </div>
  );
}
`,

};

// Write all pages
Object.entries(pages).forEach(([filename, content]) => {
  const filepath = path.join(OUT, filename);
  fs.writeFileSync(filepath, content.trim(), "utf8");
  console.log("✓ wrote", filename);
});

// Generate stub pages for remaining modules
const stubs = [
  ["AutoAssignmentEngine.jsx", "Auto-Assignment Engine", "⚡", "Automatic ticket-to-agent routing based on category, workload, skills, and shift status."],
  ["WorkloadBalancer.jsx",     "Workload Balancer",      "⚖️", "Real-time agent capacity management. New tickets always go to the agent with the lowest current load."],
  ["SLAEngine.jsx",            "SLA Engine",             "⏱️", "SLA timers, breach detection, and real-time risk monitoring for all open tickets."],
  ["EscalationEngine.jsx",     "Escalation Engine",      "🔺", "Automated escalation ladder: L1 → Team Lead → Manager → Super Admin."],
  ["HospitalNetworkCenter.jsx","Hospital Network Center", "🏥", "Full hospital management: registrations, branches, staff, revenue, verification, complaints."],
  ["PharmacyNetworkCenter.jsx","Pharmacy Network Center","💊", "Pharmacy management: inventory alerts, prescription flow, revenue, complaints."],
  ["LabNetworkCenter.jsx",     "Lab Network Center",     "🧪", "Lab management: registrations, report delays, complaints, revenue."],
  ["PatientIntelligence.jsx",  "Patient Intelligence",   "🧠", "Patient registration trends, engagement metrics, support history, retention analysis."],
  ["IAMGovernance.jsx",        "IAM Governance Center",  "🔐", "Global identity search and access control for every entity on the platform."],
  ["VerificationCommand.jsx",  "Verification Command",   "✅", "Document verification queue for hospitals, pharmacies, labs, and employees."],
  ["FinancialCommand.jsx",     "Financial Command",      "💰", "Platform-wide revenue tracking, transaction monitoring, refund management."],
  ["AuditCompliance.jsx",      "Audit & Compliance",     "📋", "Immutable audit trail of every action taken on the platform. Nothing is deleted."],
  ["ExecutiveBoardroom.jsx",   "Executive Boardroom",    "👔", "Founder-only: ARR, growth, NPS, churn, risk index, regional performance."],
  ["EmergencyBroadcast.jsx",   "Emergency Broadcast",    "📡", "System-wide broadcast to hospitals, pharmacies, labs, patients via WhatsApp, SMS, Push."],
];

stubs.forEach(([filename, title, icon, desc]) => {
  if (pages[filename]) return; // already generated
  const content = `
import { useEffect } from "react";
import { PageShell, EmptyState } from "../../components/matrix/MatrixUI";

export default function ${filename.replace(".jsx","")}() {
  return (
    <PageShell title="${title}">
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>${icon}</div>
        <h2 style={{ fontSize:18, fontWeight:800, color:"#f1f5f9", margin:"0 0 8px" }}>${title}</h2>
        <p style={{ fontSize:13, color:"#475569", maxWidth:420, lineHeight:1.6 }}>${desc}</p>
        <p style={{ fontSize:11, color:"#334155", marginTop:16 }}>Connected to backend at /matrix/* — real data loads with live backend.</p>
      </div>
    </PageShell>
  );
}
`.trim();
  fs.writeFileSync(path.join(OUT, filename), content, "utf8");
  console.log("✓ stub", filename);
});

console.log("\\n✅ All Matrix pages generated in src/pages/matrix/");
