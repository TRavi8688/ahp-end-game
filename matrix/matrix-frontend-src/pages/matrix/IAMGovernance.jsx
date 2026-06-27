/**
 * src/pages/matrix/IAMGovernance.jsx — Hospin Matrix 3.0
 * Platform-wide identity search and IAM actions — admin+ only
 */
import { useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const ENTITY_TYPES = ["","hospital","pharmacy","lab","doctor","patient","hospital_admin"];
const ACTIONS = [
  { key:"suspend",    label:"Suspend",    color:"#f59e0b" },
  { key:"activate",   label:"Activate",   color:"#10b981" },
  { key:"ban",        label:"Ban",        color:"#f43f5e" },
  { key:"verify",     label:"Verify",     color:"#06b6d4" },
  { key:"flag",       label:"Flag",       color:"#8b5cf6" },
];

export default function IAMGovernance() {
  const results    = useMatrixStore((s) => s.iamResults);
  const loading    = useMatrixStore((s) => s.iamLoading);
  const iamSearch  = useMatrixStore((s) => s.iamSearch);
  const iamAction  = useMatrixStore((s) => s.iamAction);

  const [q,          setQ]          = useState("");
  const [entityType, setEntityType] = useState("");
  const [acting,     setActing]     = useState(null);
  const [reason,     setReason]     = useState("");
  const [toast,      setToast]      = useState(null);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const handleSearch = () => { if (q.trim()) iamSearch(q.trim(), entityType); };

  const handleAction = async (entity, act) => {
    if (!reason.trim()) return;
    try {
      await iamAction(entity.entity_type || entityType, entity.id, act, reason);
      showToast(`${act} applied to ${entity.id}`);
      setActing(null); setReason("");
    } catch (e) { showToast(e.message,"error"); }
  };

  return (
    <PageShell title="IAM Governance">
      {toast && (
        <div style={{ position:"fixed", top:24, right:24, zIndex:999, padding:"10px 18px", borderRadius:10,
          background: toast.type==="success" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
          border:`1px solid ${toast.type==="success" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
          color: toast.type==="success" ? "#10b981" : "#f43f5e", fontSize:13, fontWeight:600 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:20, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", marginBottom:14 }}>Search Any Identity</div>
        <div style={{ display:"flex", gap:8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSearch()}
            placeholder="Search by ID, email, phone, name…"
            style={{ flex:1, padding:"9px 14px", borderRadius:9, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:13 }} />
          <select value={entityType} onChange={e => setEntityType(e.target.value)}
            style={{ padding:"9px 12px", borderRadius:9, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#94a3b8", fontSize:12 }}>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t || "All Types"}</option>)}
          </select>
          <button onClick={handleSearch}
            style={{ padding:"9px 20px", borderRadius:9, background:"rgba(99,102,241,0.2)", border:"1px solid rgba(99,102,241,0.35)", color:"#818cf8", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            Search
          </button>
        </div>
        <div style={{ marginTop:10, fontSize:11, color:"#334155" }}>
          Search hospitals, pharmacies, labs, doctors, patients, or admin accounts. All actions are logged to the audit trail.
        </div>
      </div>

      {loading ? <LoadingRows n={5} /> : (
        results.length === 0 ? (
          <EmptyState msg={q ? "No identities found. Try a different ID or email." : "Enter a search query above to find identities."} />
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {results.map((entity, i) => (
              <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
                      <Badge label={entity.entity_type || entityType} variant="open" />
                      <Badge label={entity.status} variant={entity.status==="active" ? "resolved" : entity.status==="suspended" ? "critical" : "open"} />
                      {entity.is_verified && <Badge label="Verified" variant="resolved" />}
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, color:"#f1f5f9", marginBottom:2 }}>{entity.name || entity.full_name || entity.email}</div>
                    <div style={{ fontSize:11, color:"#475569", fontFamily:"monospace" }}>{entity.id}</div>
                    {entity.email && <div style={{ fontSize:11, color:"#475569" }}>{entity.email}</div>}
                    {entity.phone && <div style={{ fontSize:11, color:"#475569" }}>{entity.phone}</div>}
                    {entity.city  && <div style={{ fontSize:11, color:"#334155" }}>{entity.city}{entity.state ? `, ${entity.state}`:""}</div>}
                  </div>

                  {acting?.entity === entity ? (
                    <div style={{ display:"flex", gap:6, alignItems:"center", minWidth:300 }}>
                      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required for audit)…"
                        style={{ flex:1, padding:"6px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"#060a12", color:"#f1f5f9", fontSize:11 }} />
                      <button onClick={() => handleAction(entity, acting.action)} disabled={!reason.trim()}
                        style={{ padding:"6px 12px", borderRadius:7, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", fontSize:11, fontWeight:600, cursor:"pointer", opacity:!reason.trim()?0.5:1 }}>
                        Confirm
                      </button>
                      <button onClick={() => { setActing(null); setReason(""); }}
                        style={{ padding:"6px 10px", borderRadius:7, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b", fontSize:11, cursor:"pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {ACTIONS.map(a => (
                        <button key={a.key} onClick={() => setActing({ entity, action: a.key })}
                          style={{ padding:"5px 10px", borderRadius:7, background:`${a.color}10`, border:`1px solid ${a.color}25`, color:a.color, fontSize:10, fontWeight:600, cursor:"pointer" }}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </PageShell>
  );
}
