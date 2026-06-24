/**
 * src/pages/matrix/HospitalNetworkCenter.jsx — Hospain Matrix 3.0
 * Full hospital management from Matrix — search, filter, IAM actions, stats
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const STATUS_INFO = {
  verified:   { color:"#10b981", label:"Verified"   },
  pending:    { color:"#f59e0b", label:"Pending"    },
  suspended:  { color:"#f43f5e", label:"Suspended"  },
  rejected:   { color:"#94a3b8", label:"Rejected"   },
};

export default function HospitalNetworkCenter() {
  const hospitals      = useMatrixStore((s) => s.hospitals);
  const hospitalsTotal = useMatrixStore((s) => s.hospitalsTotal);
  const hospitalsLoading = useMatrixStore((s) => s.hospitalsLoading);
  const fetchHospitals = useMatrixStore((s) => s.fetchHospitals);
  const hospitalAction = useMatrixStore((s) => s.hospitalAction);

  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState("");
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);
  const [actioning,setActioning]= useState(null);
  const [reason,   setReason]   = useState("");

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  useEffect(() => { fetchHospitals({ status, q: search }); }, [status]);

  const handleSearch = () => fetchHospitals({ status, q: search });

  const handleAction = async (hospitalId, action) => {
    try {
      await hospitalAction(hospitalId, action, reason || `${action} via Hospital Network Center`);
      showToast(`Hospital ${action} successfully`);
      setActioning(null); setReason(""); setSelected(null);
    } catch (e) { showToast(e.message, "error"); }
  };

  const STATUSES = ["","verified","pending","suspended","rejected"];
  const ACTIONS  = [
    { key:"suspend",  label:"Suspend",  color:"#f59e0b", confirm:true },
    { key:"reactivate",label:"Reactivate",color:"#10b981",confirm:true },
    { key:"reject",   label:"Reject",   color:"#f43f5e", confirm:true },
  ];

  return (
    <PageShell title="Hospital Network Center">
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
          { label:"Total",     value: hospitalsTotal,                                              color:"#94a3b8" },
          { label:"Verified",  value: hospitals.filter(h=>h.status==="verified").length,           color:"#10b981" },
          { label:"Pending",   value: hospitals.filter(h=>h.status==="pending").length,            color:"#f59e0b" },
          { label:"Suspended", value: hospitals.filter(h=>h.status==="suspended").length,          color:"#f43f5e" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSearch()}
          placeholder="Search hospital name, ID, city…"
          style={{ flex:1, minWidth:200, padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:12 }} />
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:12 }}>
          {STATUSES.map(s => <option key={s} value={s}>{s || "All Status"}</option>)}
        </select>
        <button onClick={handleSearch}
          style={{ padding:"7px 16px", borderRadius:8, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", fontSize:12, fontWeight:600, cursor:"pointer" }}>
          Search
        </button>
        <span style={{ fontSize:11, color:"#334155", alignSelf:"center", marginLeft:"auto" }}>{hospitalsTotal.toLocaleString()} hospitals</span>
      </div>

      {/* Table */}
      <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
        {hospitalsLoading ? <div style={{ padding:16 }}><LoadingRows n={8} /></div> : (
          hospitals.length === 0 ? <div style={{ padding:24 }}><EmptyState msg="No hospitals found" /></div> : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    {["Hospital","City / State","Beds","Status","Since","Actions"].map(h => (
                      <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hospitals.map(h => {
                    const si = STATUS_INFO[h.status] || { color:"#475569", label:h.status };
                    return (
                      <tr key={h.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", cursor:"pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background="transparent"}
                        onClick={() => setSelected(selected?.id === h.id ? null : h)}>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ width:32, height:32, borderRadius:8, background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🏥</div>
                            <div>
                              <div style={{ fontSize:13, fontWeight:600, color:"#f1f5f9" }}>{h.name}</div>
                              <div style={{ fontSize:10, color:"#334155", fontFamily:"monospace" }}>{h.hospain_id || h.id?.substring(0,12)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:"11px 14px", fontSize:12, color:"#94a3b8" }}>{h.city}{h.state ? `, ${h.state}` : ""}</td>
                        <td style={{ padding:"11px 14px", fontSize:12, color:"#f1f5f9", fontWeight:600 }}>{h.bed_count ?? "—"}</td>
                        <td style={{ padding:"11px 14px" }}>
                          <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:`${si.color}18`, color:si.color }}>
                            {si.label}
                          </span>
                        </td>
                        <td style={{ padding:"11px 14px", fontSize:11, color:"#475569" }}>
                          {h.created_at ? new Date(h.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex", gap:5 }}>
                            {ACTIONS.filter(a => {
                              if (h.status==="suspended" && a.key==="suspend") return false;
                              if (h.status==="verified"  && a.key==="reactivate") return false;
                              return true;
                            }).map(action => (
                              <button key={action.key}
                                onClick={e => { e.stopPropagation(); setActioning({ hospital:h, action:action.key }); }}
                                style={{ padding:"4px 10px", borderRadius:6, background:`${action.color}12`, border:`1px solid ${action.color}30`, color:action.color, fontSize:10, fontWeight:600, cursor:"pointer" }}>
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Action confirm modal */}
      {actioning && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}
          onClick={e => e.target===e.currentTarget && setActioning(null)}>
          <div style={{ background:"#0d1525", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:24, width:400 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9", marginBottom:8, textTransform:"capitalize" }}>
              Confirm {actioning.action}
            </div>
            <div style={{ fontSize:12, color:"#475569", marginBottom:16 }}>
              You are about to <strong style={{ color:"#94a3b8" }}>{actioning.action}</strong> hospital: <strong style={{ color:"#f1f5f9" }}>{actioning.hospital.name}</strong>
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required for audit log)…" rows={3}
              style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:12, resize:"none", marginBottom:16 }} />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => setActioning(null)}
                style={{ padding:"8px 16px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b", fontSize:12, cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={() => handleAction(actioning.hospital.id, actioning.action)} disabled={!reason.trim()}
                style={{ padding:"8px 16px", borderRadius:8, background:"rgba(244,63,94,0.15)", border:"1px solid rgba(244,63,94,0.3)", color:"#f43f5e", fontSize:12, fontWeight:600, cursor:"pointer", opacity:!reason.trim()?0.5:1 }}>
                Confirm {actioning.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
