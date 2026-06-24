/**
 * src/pages/matrix/WorkloadBalancer.jsx — Hospain Matrix 3.0
 * Team leads can see all agents' loads and manually reassign tickets
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows, ActionButton } from "../../components/matrix/MatrixUI";
import { api } from "../../lib/apiClient";

export default function WorkloadBalancer() {
  const employees     = useMatrixStore((s) => s.employees);
  const fetchEmployees = useMatrixStore((s) => s.fetchEmployees);

  const [agentTickets, setAgentTickets] = useState({});
  const [loading,      setLoading]      = useState(true);
  const [reassigning,  setReassigning]  = useState(null);
  const [toast,        setToast]        = useState(null);
  const [dragging,     setDragging]     = useState(null); // { ticket, fromAgent }
  const [filterTeam,   setFilterTeam]   = useState("all");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      await fetchEmployees({ shift_status: "online" });
      const res = await api.get("/api/v1/matrix/assignment/agent-loads");
      setAgentTickets(res?.data || {});
    } catch {
      // backend not yet connected
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 20000); return () => clearInterval(id); }, []);

  const handleReassign = async (ticketId, fromAgent, toAgent) => {
    if (fromAgent === toAgent) return;
    setReassigning(ticketId);
    try {
      await api.post(`/api/v1/tickets/${ticketId}/reassign`, {
        from_agent: fromAgent,
        to_agent:   toAgent,
        reason:     "Manual rebalance by team lead",
      });
      showToast(`Ticket reassigned to ${toAgent}`);
      fetchData();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setReassigning(null);
      setDragging(null);
    }
  };

  const onlineAgents = employees.filter(e =>
    e.shift_status === "online" &&
    (filterTeam === "all" || e.team === filterTeam)
  );

  const teams = ["all", ...new Set(employees.map(e => e.team).filter(Boolean))];

  const totalOpen = onlineAgents.reduce((s, a) => s + (a.open_ticket_count ?? 0), 0);
  const overloaded = onlineAgents.filter(a => {
    const pct = (a.open_ticket_count ?? 0) / (a.daily_ticket_limit ?? 30);
    return pct > 0.8;
  }).length;

  return (
    <PageShell title="Workload Balancer">
      {toast && (
        <div style={{ position:"fixed", top:24, right:24, zIndex:999, padding:"10px 18px", borderRadius:10,
          background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
          border:`1px solid ${toast.type==="success" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
          color: toast.type === "success" ? "#10b981" : "#f43f5e", fontSize:13, fontWeight:600 }}>
          {toast.msg}
        </div>
      )}

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label:"Online Agents",   value: onlineAgents.length, color:"#10b981" },
          { label:"Total Open",      value: totalOpen,           color:"#f59e0b" },
          { label:"Overloaded (>80%)",value: overloaded,         color: overloaded > 0 ? "#f43f5e" : "#10b981" },
          { label:"Avg Load",        value: onlineAgents.length ? Math.round(totalOpen / onlineAgents.length) : 0, color:"#6366f1" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Team filter */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {teams.map(t => (
          <button key={t} onClick={() => setFilterTeam(t)}
            style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:500, cursor:"pointer", border:`1px solid ${filterTeam===t ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`, background: filterTeam===t ? "rgba(99,102,241,0.15)" : "transparent", color: filterTeam===t ? "#818cf8" : "#475569" }}>
            {t === "all" ? "All Teams" : t}
          </button>
        ))}
        <button onClick={fetchData} style={{ marginLeft:"auto", padding:"4px 12px", borderRadius:20, fontSize:11, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#475569", cursor:"pointer" }}>
          ↻ Refresh
        </button>
      </div>

      {/* Agent cards grid */}
      {loading ? <LoadingRows n={6} /> : (
        onlineAgents.length === 0 ? (
          <EmptyState msg="No agents online right now" />
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {onlineAgents.map(agent => {
              const open  = agent.open_ticket_count ?? 0;
              const max   = agent.daily_ticket_limit ?? 30;
              const pct   = Math.min(100, Math.round((open / max) * 100));
              const col   = pct > 80 ? "#f43f5e" : pct > 50 ? "#f59e0b" : "#10b981";
              const tix   = agentTickets[agent.employee_id] || [];

              return (
                <div key={agent.employee_id}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragging) handleReassign(dragging.ticketId, dragging.fromAgent, agent.employee_id);
                  }}
                  style={{ background:"#0c1220", border:`1px solid ${dragging ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius:14, overflow:"hidden", transition:"border-color 0.2s" }}>
                  {/* Agent header */}
                  <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#f1f5f9" }}>{agent.full_name}</div>
                        <div style={{ fontSize:10, color:"#475569" }}>{agent.team} · {agent.role?.toUpperCase()}</div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:col }}>{open}<span style={{ fontSize:10, color:"#475569", fontWeight:400 }}>/{max}</span></span>
                    </div>
                    <div style={{ height:5, background:"rgba(255,255,255,0.06)", borderRadius:3 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:3, transition:"width 0.4s" }} />
                    </div>
                  </div>
                  {/* Ticket list */}
                  <div style={{ maxHeight:180, overflowY:"auto", padding:"6px 0" }}>
                    {tix.length === 0 ? (
                      <div style={{ padding:"10px 14px", fontSize:11, color:"#334155", textAlign:"center" }}>No open tickets</div>
                    ) : tix.slice(0,8).map(t => (
                      <div key={t.ticket_id} draggable
                        onDragStart={() => setDragging({ ticketId: t.ticket_id, fromAgent: agent.employee_id })}
                        onDragEnd={() => setDragging(null)}
                        style={{ padding:"7px 14px", display:"flex", alignItems:"center", gap:8, cursor:"grab", borderBottom:"1px solid rgba(255,255,255,0.03)", opacity: reassigning === t.ticket_id ? 0.5 : 1 }}>
                        <span style={{ fontSize:9, fontFamily:"monospace", color:"#334155" }}>{t.ticket_id}</span>
                        <span style={{ flex:1, fontSize:11, color:"#94a3b8", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.subject}</span>
                        <Badge label={t.priority} variant={t.priority} />
                      </div>
                    ))}
                    {tix.length > 8 && <div style={{ padding:"6px 14px", fontSize:10, color:"#334155" }}>+{tix.length-8} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
      <div style={{ marginTop:12, fontSize:11, color:"#334155", textAlign:"center" }}>
        Drag a ticket card from one agent to another to reassign it
      </div>
    </PageShell>
  );
}
