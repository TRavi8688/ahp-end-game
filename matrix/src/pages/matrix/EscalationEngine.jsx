/**
 * src/pages/matrix/EscalationEngine.jsx — Hospain Matrix 3.0
 * Shows the full escalation ladder and escalated ticket queue
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const LADDER = [
  { level:"L1 Agent",   role:"l1",        color:"#6366f1", desc:"First response. Resolves or escalates within SLA window." },
  { level:"L2 Agent",   role:"l2",        color:"#8b5cf6", desc:"Handles technical / escalated tickets from L1." },
  { level:"Team Lead",  role:"team_lead",  color:"#f59e0b", desc:"Oversees full queue. Can reassign and force-resolve." },
  { level:"Manager",    role:"manager",    color:"#f97316", desc:"Receives critical escalations. Has full override powers." },
  { level:"Super Admin",role:"super_admin",color:"#f43f5e", desc:"Final escalation point. All platform powers." },
];

export default function EscalationEngine() {
  const tickets       = useMatrixStore((s) => s.tickets);
  const fetchTickets  = useMatrixStore((s) => s.fetchTickets);
  const setFilters    = useMatrixStore((s) => s.setTicketFilters);
  const escalate      = useMatrixStore((s) => s.escalateTicket);
  const updateStatus  = useMatrixStore((s) => s.updateTicketStatus);

  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [note,     setNote]     = useState("");
  const [actingOn, setActingOn] = useState(null);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setFilters({ status: "escalated" });
      await fetchTickets();
      setLoading(false);
    })();
  }, []);

  const escalatedTickets = tickets.filter(t => t.status === "escalated");

  const handleResolve = async (ticketId) => {
    try {
      await updateStatus(ticketId, "resolved");
      showToast(`Ticket ${ticketId} resolved`);
    } catch (e) { showToast(e.message, "error"); }
  };

  const handleEscalate = async (ticketId) => {
    try {
      await escalate(ticketId, note || "Escalated via Escalation Engine");
      showToast(`Ticket ${ticketId} escalated further`);
      setNote(""); setActingOn(null);
    } catch (e) { showToast(e.message, "error"); }
  };

  return (
    <PageShell title="Escalation Engine">
      {toast && (
        <div style={{ position:"fixed", top:24, right:24, zIndex:999, padding:"10px 18px", borderRadius:10,
          background: toast.type==="success" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
          border:`1px solid ${toast.type==="success" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
          color: toast.type==="success" ? "#10b981" : "#f43f5e", fontSize:13, fontWeight:600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.6fr", gap:14 }}>
        {/* Escalation ladder */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9", marginBottom:14 }}>Escalation Ladder</div>
          <div style={{ position:"relative" }}>
            {/* Vertical line */}
            <div style={{ position:"absolute", left:15, top:24, bottom:24, width:1, background:"rgba(255,255,255,0.06)" }} />
            {[...LADDER].reverse().map((step, i) => (
              <div key={i} style={{ display:"flex", gap:12, marginBottom: i < LADDER.length-1 ? 20 : 0, position:"relative" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:`${step.color}20`, border:`2px solid ${step.color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:step.color, flexShrink:0, zIndex:1 }}>
                  {LADDER.length - i}
                </div>
                <div style={{ flex:1, paddingTop:4 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f1f5f9", marginBottom:2 }}>{step.level}</div>
                  <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Escalated ticket queue */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#f1f5f9" }}>Escalated Queue</span>
            <span style={{ fontSize:11, fontWeight:600, padding:"2px 10px", borderRadius:20, background:"rgba(244,63,94,0.12)", color:"#f43f5e" }}>
              {escalatedTickets.length} tickets
            </span>
          </div>

          {loading ? <div style={{ padding:16 }}><LoadingRows n={5} /></div> : (
            escalatedTickets.length === 0 ? (
              <div style={{ padding:24 }}><EmptyState msg="No escalated tickets — all clear ✓" /></div>
            ) : (
              <div style={{ maxHeight:480, overflowY:"auto" }}>
                {escalatedTickets.map(t => (
                  <div key={t.ticket_id} style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display:"flex", gap:6, marginBottom:5, flexWrap:"wrap", alignItems:"center" }}>
                      <span style={{ fontSize:10, fontFamily:"monospace", color:"#475569" }}>{t.ticket_id}</span>
                      <Badge label={t.priority} variant={t.priority} />
                      <Badge label={t.category} variant="open" />
                    </div>
                    <div style={{ fontSize:13, color:"#f1f5f9", marginBottom:3 }}>{t.subject}</div>
                    <div style={{ fontSize:11, color:"#475569", marginBottom:8 }}>
                      {t.org_name} · Assigned: {t.assigned_employee_name || "Unassigned"} · {t.team}
                    </div>

                    {actingOn === t.ticket_id ? (
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Escalation note…"
                          style={{ flex:1, padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:11 }} />
                        <button onClick={() => handleEscalate(t.ticket_id)}
                          style={{ padding:"6px 12px", borderRadius:7, background:"rgba(244,63,94,0.12)", border:"1px solid rgba(244,63,94,0.25)", color:"#f43f5e", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                          Confirm
                        </button>
                        <button onClick={() => { setActingOn(null); setNote(""); }}
                          style={{ padding:"6px 10px", borderRadius:7, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b", fontSize:11, cursor:"pointer" }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={() => handleResolve(t.ticket_id)}
                          style={{ padding:"5px 12px", borderRadius:7, background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.2)", color:"#10b981", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                          Resolve
                        </button>
                        <button onClick={() => setActingOn(t.ticket_id)}
                          style={{ padding:"5px 12px", borderRadius:7, background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.2)", color:"#f43f5e", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                          Escalate Further
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </PageShell>
  );
}
