/**
 * src/pages/matrix/VerificationCommand.jsx — Hospin Matrix 3.0
 * Matrix-integrated verification queue with approve/reject/request-info actions
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const STATUS_COLOR = { submitted:"#06b6d4", under_review:"#8b5cf6", request_more_info:"#f59e0b", approved:"#10b981", rejected:"#f43f5e" };

export default function VerificationCommand() {
  const queue  = useMatrixStore((s) => s.verificationQueue);
  const fetchQ = useMatrixStore((s) => s.fetchVerificationQueue);
  const action = useMatrixStore((s) => s.verificationAction);

  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState(null); // { item, action }
  const [reason,    setReason]    = useState("");
  const [toast,     setToast]     = useState(null);
  const [filter,    setFilter]    = useState("all");

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  useEffect(() => {
    (async () => { setLoading(true); await fetchQ(); setLoading(false); })();
  }, []);

  const handleAction = async (entityType, entityId, act) => {
    try {
      await action(entityType, entityId, act, reason, "matrix_verifier");
      showToast(`${act} applied to ${entityId}`);
      setActing(null); setReason("");
    } catch (e) { showToast(e.message,"error"); }
  };

  const filtered = filter === "all" ? queue : queue.filter(q => q.status === filter);

  const counts = {
    total:   queue.length,
    pending: queue.filter(q => ["submitted","under_review"].includes(q.status)).length,
    info:    queue.filter(q => q.status === "request_more_info").length,
    done:    queue.filter(q => ["approved","rejected"].includes(q.status)).length,
  };

  return (
    <PageShell title="Verification Command">
      {toast && (
        <div style={{ position:"fixed", top:24, right:24, zIndex:999, padding:"10px 18px", borderRadius:10,
          background: toast.type==="success" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
          border:`1px solid ${toast.type==="success" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
          color: toast.type==="success" ? "#10b981" : "#f43f5e", fontSize:13, fontWeight:600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label:"Total Queue",    value:counts.total,   color:"#94a3b8" },
          { label:"Needs Review",   value:counts.pending, color:"#f59e0b" },
          { label:"Info Requested", value:counts.info,    color:"#8b5cf6" },
          { label:"Completed",      value:counts.done,    color:"#10b981" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:14 }}>
        {["all","submitted","under_review","request_more_info","approved","rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:500, cursor:"pointer",
              border:`1px solid ${filter===f ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
              background: filter===f ? "rgba(99,102,241,0.15)" : "transparent",
              color: filter===f ? "#818cf8" : "#475569", textTransform:"capitalize" }}>
            {f.replace(/_/g," ")}
          </button>
        ))}
      </div>

      {loading ? <LoadingRows n={6} /> : (
        filtered.length === 0 ? <EmptyState msg="No verification tasks match this filter" /> : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map(item => {
              const col = STATUS_COLOR[item.status] || "#475569";
              return (
                <div key={item.id} style={{ background:"#0c1220", border:`1px solid rgba(255,255,255,0.06)`, borderLeft:`3px solid ${col}`, borderRadius:"0 12px 12px 0", padding:"14px 16px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
                        <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:`${col}18`, color:col, fontWeight:600 }}>
                          {item.status?.replace(/_/g," ").toUpperCase()}
                        </span>
                        {item.priority === "critical" && <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:"rgba(244,63,94,0.12)", color:"#f43f5e", fontWeight:600 }}>CRITICAL SLA</span>}
                        <span style={{ fontSize:10, color:"#334155", fontFamily:"monospace" }}>{item.hospital_id?.substring(0,20)}</span>
                      </div>
                      <div style={{ fontSize:13, color:"#f1f5f9", marginBottom:3 }}>{item.entity_name || item.hospital_id}</div>
                      <div style={{ fontSize:11, color:"#475569" }}>
                        Submitted: {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"} ·
                        Verifier: {item.assigned_verifier_id || "Unassigned"}
                      </div>
                    </div>

                    {acting?.item?.id === item.id ? (
                      <div style={{ display:"flex", gap:6, alignItems:"center", minWidth:300 }}>
                        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={`Reason for ${acting.action}…`}
                          style={{ flex:1, padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:11 }} />
                        <button onClick={() => handleAction("hospital", item.hospital_id, acting.action)}
                          style={{ padding:"6px 12px", borderRadius:7, background:`${STATUS_COLOR[acting.action]||"#6366f1"}18`, border:`1px solid ${STATUS_COLOR[acting.action]||"#6366f1"}30`, color:STATUS_COLOR[acting.action]||"#818cf8", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
                          Confirm
                        </button>
                        <button onClick={() => { setActing(null); setReason(""); }}
                          style={{ padding:"6px 10px", borderRadius:7, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b", fontSize:11, cursor:"pointer" }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display:"flex", gap:5 }}>
                        {item.status !== "approved" && (
                          <button onClick={() => setActing({ item, action:"approved" })}
                            style={{ padding:"5px 10px", borderRadius:7, background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.2)", color:"#10b981", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                            Approve
                          </button>
                        )}
                        <button onClick={() => setActing({ item, action:"request_more_info" })}
                          style={{ padding:"5px 10px", borderRadius:7, background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.2)", color:"#f59e0b", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
                          Request Info
                        </button>
                        {item.status !== "rejected" && (
                          <button onClick={() => setActing({ item, action:"rejected" })}
                            style={{ padding:"5px 10px", borderRadius:7, background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.2)", color:"#f43f5e", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                            Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </PageShell>
  );
}
