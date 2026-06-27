/**
 * src/pages/matrix/SLAEngine.jsx — Hospain Matrix 3.0
 * Real SLA breach tracking, at-risk tickets, and configurable SLA rules
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows, SectionHeader } from "../../components/matrix/MatrixUI";

export default function SLAEngine() {
  const slaRules    = useMatrixStore((s) => s.slaRules);
  const slaBreaches = useMatrixStore((s) => s.slaBreaches);
  const slaAtRisk   = useMatrixStore((s) => s.slaAtRisk);
  const fetchSLA    = useMatrixStore((s) => s.fetchSLAData);
  const escalate    = useMatrixStore((s) => s.escalateTicket);

  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState("risk");
  const [toast,     setToast]     = useState(null);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchSLA();
      setLoading(false);
    })();
    const id = setInterval(fetchSLA, 30000);
    return () => clearInterval(id);
  }, []);

  const handleEscalate = async (ticketId) => {
    try {
      await escalate(ticketId, "SLA breach risk — manually escalated from SLA Engine");
      showToast(`Ticket ${ticketId} escalated`);
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const timeLeft = (deadline) => {
    const ms  = new Date(deadline) - Date.now();
    if (ms <= 0) return { label: "BREACHED", color: "#f43f5e", urgent: true };
    const h   = Math.floor(ms / 3600000);
    const m   = Math.floor((ms % 3600000) / 60000);
    const col = h < 1 ? "#f43f5e" : h < 4 ? "#f59e0b" : "#10b981";
    return { label: h > 0 ? `${h}h ${m}m` : `${m}m`, color: col, urgent: h < 2 };
  };

  const TABS = [["risk","At Risk"], ["breaches","Breached"], ["rules","SLA Rules"]];

  return (
    <PageShell title="SLA Engine">
      {toast && (
        <div style={{ position:"fixed", top:24, right:24, zIndex:999, padding:"10px 18px", borderRadius:10,
          background: toast.type==="success" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
          border:`1px solid ${toast.type==="success" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
          color: toast.type==="success" ? "#10b981" : "#f43f5e", fontSize:13, fontWeight:600 }}>
          {toast.msg}
        </div>
      )}

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label:"At Risk",      value: slaAtRisk.length,   color: slaAtRisk.length > 0 ? "#f59e0b" : "#10b981" },
          { label:"Breached",     value: slaBreaches.length, color: slaBreaches.length > 0 ? "#f43f5e" : "#10b981" },
          { label:"SLA Rules",    value: slaRules.length,    color:"#6366f1" },
          { label:"Status",       value: slaBreaches.length === 0 ? "Healthy" : "Action Needed", color: slaBreaches.length === 0 ? "#10b981" : "#f43f5e" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid rgba(255,255,255,0.06)", marginBottom:14 }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:"8px 18px", border:"none", background:"none", cursor:"pointer", fontSize:12, fontWeight:500,
            color: tab===k ? "#818cf8" : "#475569", borderBottom: tab===k ? "2px solid #6366f1" : "2px solid transparent" }}>{l}</button>
        ))}
      </div>

      {loading ? <LoadingRows n={6} /> : (
        <>
          {/* AT RISK */}
          {tab === "risk" && (
            slaAtRisk.length === 0 ? <EmptyState msg="No tickets at risk — all SLAs healthy ✓" /> : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {slaAtRisk.map(t => {
                  const tl = timeLeft(t.sla_deadline);
                  return (
                    <div key={t.ticket_id} style={{ background:"#0c1220", border:`1px solid ${tl.urgent ? "rgba(244,63,94,0.25)" : "rgba(245,158,11,0.2)"}`, borderLeft:`3px solid ${tl.color}`, borderRadius:"0 10px 10px 0", padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", gap:6, marginBottom:4, alignItems:"center", flexWrap:"wrap" }}>
                          <span style={{ fontSize:10, fontFamily:"monospace", color:"#475569" }}>{t.ticket_id}</span>
                          <Badge label={t.priority} variant={t.priority} />
                          <Badge label={t.status?.replace(/_/g," ")} variant={t.status} />
                          <Badge label={t.category} variant="open" />
                        </div>
                        <div style={{ fontSize:13, color:"#f1f5f9", marginBottom:2 }}>{t.subject}</div>
                        <div style={{ fontSize:11, color:"#475569" }}>Assigned: {t.assigned_employee_name || "Unassigned"} · {t.team}</div>
                      </div>
                      <div style={{ textAlign:"right", minWidth:90 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:tl.color }}>{tl.label}</div>
                        <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>remaining</div>
                      </div>
                      <button onClick={() => handleEscalate(t.ticket_id)}
                        style={{ padding:"6px 12px", borderRadius:8, background:"rgba(244,63,94,0.12)", border:"1px solid rgba(244,63,94,0.25)", color:"#f43f5e", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
                        Escalate Now
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* BREACHED */}
          {tab === "breaches" && (
            slaBreaches.length === 0 ? <EmptyState msg="No SLA breaches — great work ✓" /> : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {slaBreaches.map(t => (
                  <div key={t.ticket_id} style={{ background:"#0c1220", border:"1px solid rgba(244,63,94,0.2)", borderLeft:"3px solid #f43f5e", borderRadius:"0 10px 10px 0", padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, fontFamily:"monospace", color:"#475569" }}>{t.ticket_id}</span>
                      <Badge label={t.priority} variant={t.priority} />
                      <span style={{ fontSize:10, fontWeight:600, padding:"1px 7px", borderRadius:20, background:"rgba(244,63,94,0.15)", color:"#f43f5e" }}>BREACHED</span>
                    </div>
                    <div style={{ fontSize:13, color:"#f1f5f9", marginBottom:3 }}>{t.subject}</div>
                    <div style={{ fontSize:11, color:"#475569" }}>
                      Breached: {t.breached_at ? new Date(t.breached_at).toLocaleString() : "—"} ·
                      Assigned: {t.assigned_employee_name || "Unassigned"}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* RULES */}
          {tab === "rules" && (
            slaRules.length === 0 ? <EmptyState msg="No SLA rules configured yet" /> : (
              <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                      {["Priority","Category","Response Time","Resolution Time","Escalation After"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slaRules.map((r,i) => (
                      <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding:"10px 14px" }}><Badge label={r.priority} variant={r.priority} /></td>
                        <td style={{ padding:"10px 14px", fontSize:12, color:"#94a3b8" }}>{r.category || "All"}</td>
                        <td style={{ padding:"10px 14px", fontSize:12, color:"#f1f5f9", fontWeight:600 }}>{r.response_time_hours}h</td>
                        <td style={{ padding:"10px 14px", fontSize:12, color:"#f1f5f9", fontWeight:600 }}>{r.resolution_time_hours}h</td>
                        <td style={{ padding:"10px 14px", fontSize:12, color:"#f59e0b" }}>{r.escalate_after_hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </PageShell>
  );
}
