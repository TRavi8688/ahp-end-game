import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const STATUS_INFO = {
  verified:   { color:"#10b981", label:"Verified"   },
  pending:    { color:"#f59e0b", label:"Pending"    },
  suspended:  { color:"#f43f5e", label:"Suspended"  },
  rejected:   { color:"#94a3b8", label:"Rejected"   },
};

const DEFAULT_PHARMACIES = [
  { id: "PHM-001", name: "Apollo Pharmacy Indiranagar", license_number: "DL-KA-20938", city: "Bengaluru", status: "verified", monthly_revenue: 450000, complaint_count_7d: 1, created_at: "2025-10-12T10:00:00Z" },
  { id: "PHM-002", name: "MedPlus Jubilee Hills", license_number: "DL-TS-39485", city: "Hyderabad", status: "verified", monthly_revenue: 580000, complaint_count_7d: 0, created_at: "2025-11-05T09:30:00Z" },
  { id: "PHM-003", name: "Wellness Forever Chembur", license_number: "DL-MH-82938", city: "Mumbai", status: "pending", monthly_revenue: 0, complaint_count_7d: 0, created_at: "2026-06-20T14:15:00Z" },
  { id: "PHM-004", name: "Netmeds Store Sector 62", license_number: "DL-UP-10293", city: "Noida", status: "suspended", monthly_revenue: 210000, complaint_count_7d: 5, created_at: "2025-08-19T11:45:00Z" },
  { id: "PHM-005", name: "Guardian Pharmacy Saket", license_number: "DL-DL-98273", city: "New Delhi", status: "verified", monthly_revenue: 390000, complaint_count_7d: 0, created_at: "2025-05-14T08:00:00Z" },
  { id: "PHM-006", name: "Frank Ross Pharmacy Gariahat", license_number: "DL-WB-39281", city: "Kolkata", status: "pending", monthly_revenue: 0, complaint_count_7d: 0, created_at: "2026-06-22T16:20:00Z" },
];

export default function PharmacyNetworkCenter() {
  const [pharmacies, setPharmacies] = useState(DEFAULT_PHARMACIES);
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
      let filtered = DEFAULT_PHARMACIES;
      if (search) {
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.id.toLowerCase().includes(search.toLowerCase()) ||
          p.city.toLowerCase().includes(search.toLowerCase())
        );
      }
      if (status) {
        filtered = filtered.filter(p => p.status === status);
      }
      setPharmacies(filtered);
      setLoading(false);
    }, 300);
  };

  useEffect(() => {
    handleSearch();
  }, [status]);

  const handleAction = async (pharmacyId, action) => {
    setPharmacies(prev => 
      prev.map(p => {
        if (p.id === pharmacyId) {
          const newStatus = action === "reactivate" || action === "verify" ? "verified" : action === "suspend" ? "suspended" : "rejected";
          return { ...p, status: newStatus };
        }
        return p;
      })
    );
    showToast(`Pharmacy ${action} successfully`);
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
    <PageShell title="Pharmacy Network Center">
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
          { label:"Total Pharmacies", value: pharmacies.length,                                      color:"#94a3b8" },
          { label:"Verified",  value: pharmacies.filter(p=>p.status==="verified").length,           color:"#10b981" },
          { label:"Pending",   value: pharmacies.filter(p=>p.status==="pending").length,            color:"#f59e0b" },
          { label:"Suspended", value: pharmacies.filter(p=>p.status==="suspended").length,          color:"#f43f5e" },
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
          placeholder="Search pharmacy name, ID, license, city…"
          style={{ flex:1, minWidth:200, padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:12 }} />
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:12 }}>
          {STATUSES.map(s => <option key={s} value={s}>{s || "All Status"}</option>)}
        </select>
        <button onClick={handleSearch}
          style={{ padding:"7px 16px", borderRadius:8, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", fontSize:12, fontWeight:600, cursor:"pointer" }}>
          Search
        </button>
        <span style={{ fontSize:11, color:"#334155", alignSelf:"center", marginLeft:"auto" }}>{pharmacies.length} pharmacies</span>
      </div>

      {/* Table */}
      <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
        {loading ? <div style={{ padding:16 }}><LoadingRows n={8} /></div> : (
          pharmacies.length === 0 ? <div style={{ padding:24 }}><EmptyState msg="No pharmacies found" /></div> : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    {["ID", "Pharmacy Name", "License No", "City", "Monthly Rev", "Complaints (7d)", "Status", "Actions"].map((h, i) => (
                      <th key={i} style={{ padding:"12px 16px", textAlign:"left", fontSize:11, fontWeight:600, color:"#475569", textTransform:"uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pharmacies.map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: idx===pharmacies.length-1 ? "none" : "1px solid rgba(255,255,255,0.04)", background: selected?.id===p.id ? "rgba(99,102,241,0.03)" : "transparent" }}>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#475569", fontWeight:600 }}>{p.id}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#f1f5f9", fontWeight:700 }}>{p.name}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#94a3b8" }}>{p.license_number}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#94a3b8" }}>{p.city}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#10b981", fontWeight:600 }}>{p.monthly_revenue ? `₹${(p.monthly_revenue/100000).toFixed(1)}L` : "—"}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:p.complaint_count_7d>0?"#f43f5e":"#475569" }}>{p.complaint_count_7d}</td>
                      <td style={{ padding:"12px 16px" }}><Badge label={STATUS_INFO[p.status]?.label} color={STATUS_INFO[p.status]?.color} /></td>
                      <td style={{ padding:"12px 16px" }}>
                        <button onClick={() => setSelected(p)}
                          style={{ padding:"4px 10px", borderRadius:6, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", color:"#94a3b8", fontSize:11, cursor:"pointer" }}>Manage</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Details drawer/modal */}
      {selected && (
        <div style={{ position:"fixed", top:0, right:0, bottom:0, width:380, background:"#080c14", borderLeft:"1px solid rgba(255,255,255,0.08)", zIndex:90, padding:24, display:"flex", flexDirection:"column", boxShadow:"-10px 0 30px rgba(0,0,0,0.5)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", margin:0 }}>Manage Pharmacy</h3>
            <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:"#475569", fontSize:18, cursor:"pointer" }}>&times;</button>
          </div>

          <div style={{ flex:1, overflowY:"auto" }}>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", fontWeight:600 }}>Pharmacy Name</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{selected.name}</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", fontWeight:600 }}>Pharmacy ID</div>
                <div style={{ fontSize:12, color:"#94a3b8", fontWeight:600 }}>{selected.id}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", fontWeight:600 }}>License</div>
                <div style={{ fontSize:12, color:"#94a3b8" }}>{selected.license_number}</div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", fontWeight:600 }}>City</div>
                <div style={{ fontSize:12, color:"#94a3b8" }}>{selected.city}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", fontWeight:600 }}>Status</div>
                <div style={{ marginTop:4 }}><Badge label={STATUS_INFO[selected.status]?.label} color={STATUS_INFO[selected.status]?.color} /></div>
              </div>
            </div>

            <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:16, marginTop:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.05em" }}>Quick Actions</div>
              
              {actioning ? (
                <div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:6 }}>Provide a reason for <strong>{actioning}</strong>:</div>
                  <textarea value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="E.g. license expired, documentation issue..."
                    style={{ width:"100%", height:70, padding:8, borderRadius:8, background:"#0c1220", border:"1px solid rgba(255,255,255,0.08)", color:"#f1f5f9", fontSize:12, resize:"none", marginBottom:10 }} />
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => handleAction(selected.id, actioning)}
                      style={{ flex:1, padding:"6px 12px", borderRadius:6, background: ACTIONS.find(a=>a.key===actioning)?.color, border:"none", color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer" }}>Confirm</button>
                    <button onClick={() => { setActioning(null); setReason(""); }}
                      style={{ padding:"6px 12px", borderRadius:6, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"#94a3b8", fontSize:11, cursor:"pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {ACTIONS.filter(a => {
                    if (selected.status === "verified") return a.key === "suspend";
                    if (selected.status === "suspended") return a.key === "reactivate";
                    if (selected.status === "pending") return a.key === "verify" || a.key === "reject";
                    return false;
                  }).map(a => (
                    <button key={a.key} onClick={() => setActioning(a.key)}
                      style={{ width:"100%", padding:"8px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", color:a.color, fontSize:12, fontWeight:600, textAlign:"left", cursor:"pointer" }}>
                      {a.label} Pharmacy
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
