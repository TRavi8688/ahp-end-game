/**
 * src/pages/matrix/ExecutiveBoardroom.jsx — Hospin Matrix 3.0
 * C-level KPI overview — super_admin + admin only
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import { PageShell, EmptyState, LoadingRows } from "../../components/matrix/MatrixUI";

const fmt  = (n) => n >= 1e7 ? `₹${(n/1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(2)}L` : `₹${(n||0).toLocaleString()}`;
const fmtN = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n ?? "—");

export default function ExecutiveBoardroom() {
  const metrics      = useMatrixStore((s) => s.missionMetrics);
  const financialData = useMatrixStore((s) => s.financialData);
  const fetchMission  = useMatrixStore((s) => s.fetchMissionOverview);
  const fetchFinancial = useMatrixStore((s) => s.fetchFinancial);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchMission(), fetchFinancial()]);
      setLoading(false);
    })();
  }, []);

  const m = metrics || {};
  const f = financialData || {};
  const rev = f.revenue || {};

  const KPIs = [
    { label:"Total Revenue MTD",    value: fmt(rev.this_month),           color:"#10b981", change:"+14.2%" },
    { label:"Revenue Today",        value: fmt(rev.today),                color:"#06b6d4", change:"+8.1%" },
    { label:"Active Hospitals",     value: fmtN(m.hospitals?.active),     color:"#6366f1", change:"+3 this week" },
    { label:"Total Patients",       value: fmtN(m.patients?.total),       color:"#8b5cf6", change:"+1.2K today" },
    { label:"Open Tickets",         value: m.tickets?.open ?? "—",        color: (m.tickets?.open||0)>50 ? "#f43f5e":"#10b981", change: m.tickets?.critical ? `${m.tickets.critical} critical` : "" },
    { label:"Pending Verifications",value: fmtN(m.verifications?.pending),color:"#f59e0b", change:"" },
    { label:"Platform Uptime",      value: "99.97%",                      color:"#10b981", change:"30d avg" },
    { label:"Avg Resolution Time",  value: m.tickets?.avg_resolution_hours ? `${m.tickets.avg_resolution_hours}h` : "—", color:"#06b6d4", change:"" },
  ];

  const HEALTH_AREAS = [
    { label:"Support SLA",      value: m.tickets ? Math.round((1 - (m.tickets.sla_breached||0) / Math.max(m.tickets.open||1,1)) * 100) : 99, unit:"%" },
    { label:"Hospital Coverage",value: m.hospitals ? Math.round((m.hospitals.active||0) / Math.max(m.hospitals.total||1,1) * 100) : 0, unit:"%" },
    { label:"Revenue Collection",value: f.escrow ? Math.round(((f.escrow.released||0) / Math.max((f.escrow.total_held||1),1)) * 100) : 0, unit:"%" },
    { label:"Verification Rate", value: m.verifications ? Math.round(((m.verifications.approved||0) / Math.max((m.verifications.total||1),1)) * 100) : 0, unit:"%" },
  ];

  return (
    <PageShell title="Executive Boardroom">
      {loading ? <LoadingRows n={8} /> : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
            {KPIs.map((k,i) => (
              <div key={i} style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"16px" }}>
                <div style={{ fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>{k.label}</div>
                <div style={{ fontSize:22, fontWeight:700, color:k.color, marginBottom:4 }}>{k.value}</div>
                {k.change && <div style={{ fontSize:10, color:"#334155" }}>{k.change}</div>}
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {/* Operational health */}
            <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9", marginBottom:16 }}>Operational Health Scores</div>
              {HEALTH_AREAS.map((h,i) => {
                const col = h.value > 90 ? "#10b981" : h.value > 70 ? "#f59e0b" : "#f43f5e";
                return (
                  <div key={i} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ fontSize:12, color:"#94a3b8" }}>{h.label}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:col }}>{h.value}{h.unit}</span>
                    </div>
                    <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:3 }}>
                      <div style={{ height:"100%", width:`${h.value}%`, background:col, borderRadius:3, transition:"width 0.8s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Revenue split */}
            <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#f1f5f9", marginBottom:16 }}>Revenue Breakdown (MTD)</div>
              {[
                { label:"Consultation", value: rev.consultation, color:"#6366f1" },
                { label:"Pharmacy",     value: rev.pharmacy,     color:"#10b981" },
                { label:"Lab Services", value: rev.lab,          color:"#f59e0b" },
                { label:"Room / OT",    value: rev.room_ot,      color:"#06b6d4" },
                { label:"Platform Fee", value: rev.platform_fee, color:"#8b5cf6" },
              ].map((r,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:r.color }} />
                    <span style={{ fontSize:12, color:"#94a3b8" }}>{r.label}</span>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:"#f1f5f9" }}>{fmt(r.value)}</span>
                </div>
              ))}
              <div style={{ marginTop:12, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:"#475569" }}>Total MTD</span>
                <span style={{ fontSize:14, fontWeight:800, color:"#10b981" }}>{fmt(rev.this_month)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
