/**
 * src/pages/matrix/AuditCompliance.jsx — Hospain Matrix 3.0
 * Immutable audit log — every action taken on the platform, filterable and searchable
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const ACTION_COLORS = {
  EMPLOYEE_CREATED: "#10b981", EMPLOYEE_DELETED: "#f43f5e",
  ROLE_UPDATED: "#f59e0b",     PASSWORD_RESET: "#f59e0b",
  LOGIN_SUCCESS: "#6366f1",    LOGIN_FAILED: "#f43f5e",
  TICKET_CREATED: "#06b6d4",   TICKET_RESOLVED: "#10b981",
  TICKET_ESCALATED: "#f59e0b", BROADCAST_SENT: "#8b5cf6",
  IAM_ACTION: "#f97316",       HOSPITAL_VERIFIED: "#10b981",
  HOSPITAL_SUSPENDED: "#f43f5e",AI_COPILOT_QUERY: "#818cf8",
};

export default function AuditCompliance() {
  const auditLogs      = useMatrixStore((s) => s.auditLogs);
  const auditTotal     = useMatrixStore((s) => s.auditTotal);
  const auditPage      = useMatrixStore((s) => s.auditPage);
  const auditLoading   = useMatrixStore((s) => s.auditLoading);
  const fetchAuditLogs = useMatrixStore((s) => s.fetchAuditLogs);

  const [search,     setSearch]     = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");

  const applyFilters = () => {
    fetchAuditLogs({
      ...(search      ? { q:           search      } : {}),
      ...(actionFilter? { action_filter:actionFilter} : {}),
      ...(dateFrom    ? { date_from:   dateFrom    } : {}),
      ...(dateTo      ? { date_to:     dateTo      } : {}),
    });
  };

  useEffect(() => { fetchAuditLogs(); }, []);

  const COMMON_ACTIONS = [
    "","LOGIN_SUCCESS","LOGIN_FAILED","EMPLOYEE_CREATED","ROLE_UPDATED",
    "TICKET_CREATED","TICKET_RESOLVED","TICKET_ESCALATED",
    "BROADCAST_SENT","HOSPITAL_VERIFIED","HOSPITAL_SUSPENDED","AI_COPILOT_QUERY"
  ];

  return (
    <PageShell title="Audit & Compliance">
      {/* Summary row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label:"Total Events",    value: auditTotal,                                                                    color:"#6366f1" },
          { label:"This Page",       value: auditLogs.length,                                                              color:"#94a3b8" },
          { label:"Auth Events",     value: auditLogs.filter(l => l.action?.includes("LOGIN")).length,                     color:"#06b6d4" },
          { label:"Critical Actions",value: auditLogs.filter(l => ["EMPLOYEE_DELETED","IAM_ACTION","BROADCAST_SENT"].includes(l.action)).length, color:"#f43f5e" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actor / resource ID…"
          style={{ flex:1, minWidth:180, padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:12 }} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          style={{ padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:12 }}>
          {COMMON_ACTIONS.map(a => <option key={a} value={a}>{a || "All Actions"}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:12 }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:12 }} />
        <button onClick={applyFilters}
          style={{ padding:"7px 16px", borderRadius:8, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", fontSize:12, fontWeight:600, cursor:"pointer" }}>
          Apply
        </button>
        <button onClick={() => { setSearch(""); setActionFilter(""); setDateFrom(""); setDateTo(""); fetchAuditLogs(); }}
          style={{ padding:"7px 12px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b", fontSize:12, cursor:"pointer" }}>
          Reset
        </button>
        <span style={{ fontSize:11, color:"#334155", marginLeft:"auto" }}>{auditTotal.toLocaleString()} total events</span>
      </div>

      {/* Log table */}
      <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
        {auditLoading ? <div style={{ padding:16 }}><LoadingRows n={8} /></div> : (
          auditLogs.length === 0 ? <div style={{ padding:24 }}><EmptyState msg="No audit events match your filters" /></div> : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    {["Timestamp","Actor","Action","Resource","Resource ID","IP"].map(h => (
                      <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => {
                    const col = ACTION_COLORS[log.action] || "#475569";
                    return (
                      <tr key={log.id || i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", transition:"background 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                        <td style={{ padding:"9px 14px", fontSize:11, color:"#475569", whiteSpace:"nowrap", fontFamily:"monospace" }}>
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding:"9px 14px", fontSize:11, color:"#94a3b8", fontFamily:"monospace" }}>
                          {log.actor_id?.substring(0,14) || "SYSTEM"}
                        </td>
                        <td style={{ padding:"9px 14px", whiteSpace:"nowrap" }}>
                          <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:`${col}18`, color:col }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding:"9px 14px", fontSize:11, color:"#64748b" }}>{log.resource_type || "—"}</td>
                        <td style={{ padding:"9px 14px", fontSize:11, color:"#475569", fontFamily:"monospace" }}>
                          {log.resource_id?.substring(0,16) || "—"}
                        </td>
                        <td style={{ padding:"9px 14px", fontSize:11, color:"#334155", fontFamily:"monospace" }}>
                          {log.ip_address || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Pagination */}
        {auditTotal > 50 && (
          <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10, justifyContent:"flex-end" }}>
            <span style={{ fontSize:11, color:"#334155" }}>Page {auditPage} of {Math.ceil(auditTotal/50)}</span>
            <button onClick={() => { useMatrixStore.setState({ auditPage: Math.max(1, auditPage-1) }); fetchAuditLogs(); }}
              disabled={auditPage === 1}
              style={{ padding:"5px 12px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.04)", color:"#64748b", fontSize:11, cursor:"pointer", opacity: auditPage===1 ? 0.4 : 1 }}>
              ← Prev
            </button>
            <button onClick={() => { useMatrixStore.setState({ auditPage: auditPage+1 }); fetchAuditLogs(); }}
              disabled={auditPage >= Math.ceil(auditTotal/50)}
              style={{ padding:"5px 12px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.04)", color:"#64748b", fontSize:11, cursor:"pointer", opacity: auditPage>=Math.ceil(auditTotal/50) ? 0.4 : 1 }}>
              Next →
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
