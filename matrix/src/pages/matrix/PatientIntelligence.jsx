import { useEffect, useState } from "react";
import { PageShell, Badge, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const RISK_INFO = {
  low:      { color:"#10b981", label:"Low Risk"   },
  moderate: { color:"#f59e0b", label:"Moderate"    },
  high:     { color:"#f97316", label:"High Risk"  },
  critical: { color:"#f43f5e", label:"Critical"   },
};

const DEFAULT_PATIENTS = [
  { id: "PAT-8091", name: "Rahul Sharma", age: 45, city: "New Delhi", risk_level: "low", health_score: 85, last_visit: "2026-06-15", next_followup: "2026-12-15" },
  { id: "PAT-8092", name: "Priya Patel", age: 62, city: "Mumbai", risk_level: "moderate", health_score: 65, last_visit: "2026-06-18", next_followup: "2026-07-18" },
  { id: "PAT-8093", name: "Amit Kumar", age: 58, city: "Bengaluru", risk_level: "high", health_score: 42, last_visit: "2026-06-20", next_followup: "2026-06-27" },
  { id: "PAT-8094", name: "Sneha Reddy", age: 31, city: "Hyderabad", risk_level: "low", health_score: 92, last_visit: "2026-05-10", next_followup: "2027-05-10" },
  { id: "PAT-8095", name: "Vikram Singh", age: 74, city: "Chennai", risk_level: "critical", health_score: 18, last_visit: "2026-06-23", next_followup: "2026-06-24" },
  { id: "PAT-8096", name: "Anjali Gupta", age: 28, city: "Kolkata", risk_level: "low", health_score: 88, last_visit: "2026-04-22", next_followup: "2027-04-22" },
];

export default function PatientIntelligence() {
  const [patients, setPatients] = useState(DEFAULT_PATIENTS);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const handleSearch = () => {
    setLoading(true);
    setTimeout(() => {
      let filtered = DEFAULT_PATIENTS;
      if (search) {
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.id.toLowerCase().includes(search.toLowerCase()) ||
          p.city.toLowerCase().includes(search.toLowerCase())
        );
      }
      if (riskFilter) {
        filtered = filtered.filter(p => p.risk_level === riskFilter);
      }
      setPatients(filtered);
      setLoading(false);
    }, 300);
  };

  useEffect(() => {
    handleSearch();
  }, [riskFilter]);

  const handleAction = async (action) => {
    showToast(`Action '${action}' triggered for ${selected.name}`);
    setSelected(null);
  };

  const RISKS = ["", "low", "moderate", "high", "critical"];

  return (
    <PageShell title="Patient Intelligence">
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
          { label:"Total Patients", value: patients.length,                                      color:"#94a3b8" },
          { label:"Low Risk",  value: patients.filter(p=>p.risk_level==="low").length,           color:"#10b981" },
          { label:"High Risk",   value: patients.filter(p=>p.risk_level==="high").length,            color:"#f97316" },
          { label:"Critical", value: patients.filter(p=>p.risk_level==="critical").length,          color:"#f43f5e" },
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
          placeholder="Search patient name, ID, city…"
          style={{ flex:1, minWidth:200, padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#f1f5f9", fontSize:12 }} />
        <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
          style={{ padding:"7px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", background:"#0c1220", color:"#94a3b8", fontSize:12 }}>
          {RISKS.map(r => <option key={r} value={r}>{r ? RISK_INFO[r].label : "All Risks"}</option>)}
        </select>
        <button onClick={handleSearch}
          style={{ padding:"7px 16px", borderRadius:8, background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8", fontSize:12, fontWeight:600, cursor:"pointer" }}>
          Search
        </button>
      </div>

      {/* Table */}
      <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
        {loading ? <div style={{ padding:16 }}><LoadingRows n={6} /></div> : (
          patients.length === 0 ? <div style={{ padding:24 }}><EmptyState msg="No patients found" /></div> : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#64748b", fontWeight:600 }}>Patient ID</th>
                    <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#64748b", fontWeight:600 }}>Name & Age</th>
                    <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#64748b", fontWeight:600 }}>City</th>
                    <th style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#64748b", fontWeight:600 }}>Health Score</th>
                    <th style={{ padding:"12px 16px", textAlign:"center", fontSize:11, color:"#64748b", fontWeight:600 }}>Risk Level</th>
                    <th style={{ padding:"12px 16px", textAlign:"right", fontSize:11, color:"#64748b", fontWeight:600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#cbd5e1" }}>{p.id}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ fontSize:13, fontWeight:500, color:"#f1f5f9" }}>{p.name}</div>
                        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{p.age} years old</div>
                      </td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#94a3b8" }}>{p.city}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ flex:1, height:4, background:"rgba(255,255,255,0.1)", borderRadius:2, overflow:"hidden" }}>
                            <div style={{ width:`${p.health_score}%`, height:"100%", background: p.health_score > 70 ? "#10b981" : p.health_score > 40 ? "#f59e0b" : "#f43f5e" }} />
                          </div>
                          <div style={{ fontSize:11, color:"#cbd5e1", width:24 }}>{p.health_score}</div>
                        </div>
                      </td>
                      <td style={{ padding:"12px 16px", textAlign:"center" }}>
                        <Badge color={RISK_INFO[p.risk_level]?.color}>{RISK_INFO[p.risk_level]?.label}</Badge>
                      </td>
                      <td style={{ padding:"12px 16px", textAlign:"right" }}>
                        <button onClick={() => setSelected(p)}
                          style={{ padding:"4px 10px", borderRadius:6, background:"rgba(255,255,255,0.05)", border:"none", color:"#94a3b8", fontSize:11, cursor:"pointer" }}>
                          View Intelligence
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
              <div style={{ fontWeight:600, fontSize:14, color:"#f1f5f9" }}>Patient Intelligence File</div>
              <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:16 }}>×</button>
            </div>
            
            <div style={{ padding:20 }}>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:15, fontWeight:600, color:"#f1f5f9" }}>{selected.name}</div>
                <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{selected.id} • {selected.age} yrs • {selected.city}</div>
              </div>

              <div style={{ display:"grid", gap:10, marginBottom:20 }}>
                <div style={{ padding:12, background:"rgba(255,255,255,0.03)", borderRadius:8, border:"1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Last Visit</div>
                  <div style={{ fontSize:13, color:"#f1f5f9" }}>{selected.last_visit}</div>
                </div>
                <div style={{ padding:12, background:"rgba(255,255,255,0.03)", borderRadius:8, border:"1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Next Follow-up</div>
                  <div style={{ fontSize:13, color:"#f1f5f9" }}>{selected.next_followup}</div>
                </div>
                <div style={{ padding:12, background:"rgba(255,255,255,0.03)", borderRadius:8, border:"1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Health Score</div>
                  <div style={{ fontSize:18, fontWeight:600, color: selected.health_score > 70 ? "#10b981" : selected.health_score > 40 ? "#f59e0b" : "#f43f5e" }}>
                    {selected.health_score} / 100
                  </div>
                </div>
              </div>

              <div style={{ display:"grid", gap:8 }}>
                <button onClick={() => handleAction("Assign Care Manager")}
                  style={{ padding:"10px", borderRadius:8, background:`#3b82f615`, border:`1px solid #3b82f630`, color:"#3b82f6", fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"center" }}>
                  Assign Care Manager
                </button>
                <button onClick={() => handleAction("Generate AI Risk Report")}
                  style={{ padding:"10px", borderRadius:8, background:`#8b5cf615`, border:`1px solid #8b5cf630`, color:"#8b5cf6", fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"center" }}>
                  Generate AI Risk Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}