import { useEffect, useState } from "react";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const STATUS_INFO = {
  verified:   { color:"#10b981", label:"Verified"   },
  pending:    { color:"#f59e0b", label:"Pending"    },
  suspended:  { color:"#f43f5e", label:"Suspended"  },
  rejected:   { color:"#94a3b8", label:"Rejected"   },
};

const DEFAULT_LABS = [
  { id: "LAB-001", name: "Lal PathLabs Core", license_number: "NABL-1092", city: "New Delhi", status: "verified", monthly_tests: 12500, complaint_count_7d: 1, created_at: "2025-08-10T10:00:00Z" },
  { id: "LAB-002", name: "Metropolis Diagnostics", license_number: "NABL-2034", city: "Mumbai", status: "verified", monthly_tests: 9800, complaint_count_7d: 0, created_at: "2025-09-05T09:30:00Z" },
  { id: "LAB-003", name: "Thyrocare Regional Center", license_number: "NABL-3045", city: "Bengaluru", status: "pending", monthly_tests: 0, complaint_count_7d: 0, created_at: "2026-06-20T14:15:00Z" },
  { id: "LAB-004", name: "SRL Diagnostics", license_number: "NABL-4056", city: "Hyderabad", status: "suspended", monthly_tests: 4500, complaint_count_7d: 3, created_at: "2025-11-19T11:45:00Z" },
  { id: "LAB-005", name: "Apollo Diagnostics", license_number: "NABL-5067", city: "Chennai", status: "verified", monthly_tests: 8900, complaint_count_7d: 0, created_at: "2025-07-14T08:00:00Z" },
  { id: "LAB-006", name: "Lucid Medical Diagnostics", license_number: "NABL-6078", city: "Kolkata", status: "pending", monthly_tests: 0, complaint_count_7d: 0, created_at: "2026-06-22T16:20:00Z" },
];

export default function LabNetworkCenter() {
  const [labs, setLabs] = useState(DEFAULT_LABS);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [actioning, setActioning] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const handleSearch = () => {
    setLoading(true);
    setTimeout(() => {
      let filtered = DEFAULT_LABS;
      if (search) {
        filtered = filtered.filter(l => 
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.id.toLowerCase().includes(search.toLowerCase()) ||
          l.city.toLowerCase().includes(search.toLowerCase())
        );
      }
      if (status) {
        filtered = filtered.filter(l => l.status === status);
      }
      setLabs(filtered);
      setLoading(false);
    }, 300);
  };

  useEffect(() => {
    handleSearch();
  }, [status]);

  const handleAction = async (labId, action) => {
    setLabs(prev => 
      prev.map(l => {
        if (l.id === labId) {
          const newStatus = action === "reactivate" || action === "verify" ? "verified" : action === "suspend" ? "suspended" : "rejected";
          return { ...l, status: newStatus };
        }
        return l;
      })
    );
    showToast(`Lab ${action} successfully`);
    setActioning(null);
    setReason("");
    setSelected(null);
  };

  const STATUSES = ["", "verified", "pending", "suspended", "rejected"];
  const ACTIONS  = [
    { key:"verify",      label:"Verify",      color:"#10b981", confirm:true },
    { key:"suspend",     label:"Suspend",     color:"#f59e0b", confirm:true },
    { key:"reactivate",  label:"Reactivate",  color:"#10b981", confirm:true },
    { key:"reject",      label:"Reject",      color:"#f43f5e", confirm:true },
  ];

  return (
    <PageShell title="Lab Network Center">
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
          { label:"Total Labs", value: labs.length,                                      color:"#94a3b8" },
          { label:"Verified",  value: labs.filter(l=>l.status==="verified").length,           color:"#10b981" },
          { label:"Pending",   value: labs.filter(l=>l.status==="pending").length,            color:"#f59e0b" },
          { label:"Suspended", value: labs.filter(l=>l.status==="suspended").length,          color:"#f43f5e" },
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
          placeholder="Search lab name, ID, city…"
          style={{ flex:1, minWidth:200, padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:12 }} />
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:12 }}>
          {STATUSES.map(s => <option key={s} value={s}>{s || "All Status"}</option>)}
        </select>
        <button onClick={handleSearch}
          style={{ padding:"7px 16px", borderRadius:8, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", fontSize:12, fontWeight:600, cursor:"pointer" }}>
          Search
        </button>
      </div>

      {/* Table */}
      <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
        {loading ? <div style={{ padding:16 }}><LoadingRows n={6} /></div> : (
          labs.length === 0 ? <div style={{ padding:24 }}><EmptyState msg="No labs found" /></div> : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#64748b", fontWeight:600 }}>Lab ID</th>
                    <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#64748b", fontWeight:600 }}>Name & License</th>
                    <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#64748b", fontWeight:600 }}>City</th>
                    <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#64748b", fontWeight:600 }}>Monthly Tests</th>
                    <th style={{ padding:"12px 16px", textAlign:"center", fontSize:11, color:"#64748b", fontWeight:600 }}>Status</th>
                    <th style={{ padding:"12px 16px", textAlign:"right", fontSize:11, color:"#64748b", fontWeight:600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {labs.map(l => (
                    <tr key={l.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#cbd5e1" }}>{l.id}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ fontSize:13, fontWeight:500, color:"#f1f5f9" }}>{l.name}</div>
                        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{l.license_number}</div>
                      </td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#94a3b8" }}>{l.city}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#cbd5e1" }}>{l.monthly_tests.toLocaleString()}</td>
                      <td style={{ padding:"12px 16px", textAlign:"center" }}>
                        <Badge color={STATUS_INFO[l.status]?.color}>{STATUS_INFO[l.status]?.label}</Badge>
                      </td>
                      <td style={{ padding:"12px 16px", textAlign:"right" }}>
                        <button onClick={() => setSelected(l)}
                          style={{ padding:"4px 10px", borderRadius:6, background:"rgba(255,255,255,0.05)", border:"none", color:"#94a3b8", fontSize:11, cursor:"pointer" }}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, width:"100%", maxWidth:400, overflow:"hidden", boxShadow:"0 20px 40px rgba(0,0,0,0.4)" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:600, fontSize:14, color:"#f1f5f9" }}>Manage Lab</div>
              <button onClick={()=>{setSelected(null);setActioning(null);}} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:16 }}>×</button>
            </div>
            
            <div style={{ padding:20 }}>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:15, fontWeight:600, color:"#f1f5f9" }}>{selected.name}</div>
                <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{selected.id} • {selected.city}</div>
              </div>

              {!actioning ? (
                <div style={{ display:"grid", gap:8 }}>
                  {ACTIONS.filter(a => {
                    if (selected.status === "verified") return a.key === "suspend";
                    if (selected.status === "pending") return a.key === "verify" || a.key === "reject";
                    if (selected.status === "suspended") return a.key === "reactivate";
                    if (selected.status === "rejected") return false;
                    return true;
                  }).map(a => (
                    <button key={a.key} onClick={() => setActioning(a)}
                      style={{ padding:"10px", borderRadius:8, background:`${a.color}15`, border:`1px solid ${a.color}30`, color:a.color, fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"left" }}>
                      {a.label}
                    </button>
                  ))}
                  {selected.status === "rejected" && <div style={{ fontSize:12, color:"#64748b" }}>No actions available for rejected lab.</div>}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:12, color:"#cbd5e1", marginBottom:8 }}>Reason for {actioning.label.toLowerCase()}</div>
                  <textarea value={reason} onChange={e=>setReason(e.target.value)}
                    style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:10, color:"#f1f5f9", fontSize:12, minHeight:60, marginBottom:16 }}
                    placeholder="Enter reason..." />
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>setActioning(null)}
                      style={{ flex:1, padding:"8px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"none", color:"#94a3b8", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      Cancel
                    </button>
                    <button onClick={() => handleAction(selected.id, actioning.key)}
                      style={{ flex:1, padding:"8px", borderRadius:8, background:actioning.color, border:"none", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      Confirm {actioning.label}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}