/**
 * src/pages/matrix/ExecutiveBoardroom.jsx
 */
import { useEffect } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, ProgressBar, Pill,
  EmptyState, T,
} from "../../components/matrix/MatrixUI";

const fmtCurr = (n) => {
  if (!n) return "₹0";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
};

export default function ExecutiveBoardroom() {
  const metrics = useMatrixStore((s) => s.missionMetrics);
  const financial = useMatrixStore((s) => s.financialData);
  const fetchF  = useMatrixStore((s) => s.fetchFinancial);
  const fetchM  = useMatrixStore((s) => s.fetchMissionOverview);

  useEffect(() => { fetchM(); fetchF(); }, []);

  const m = metrics || {};
  const h = m.hospitals || {};
  const t = m.tickets   || {};

  return (
    <PageShell
      title="Executive Boardroom"
      extra={<Pill label="FOUNDER ONLY" color={T.rose} />}
      sub="One-screen view of the entire Hospin business"
    >
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:18 }}>
        <MetricCard label="ARR"            value="₹28.2Cr"  color={T.emerald} sparkle={T.emerald} sub="↑ 340% YoY" />
        <MetricCard label="MoM Growth"     value="23.4%"    color={T.cyan}    sub="6-month average" />
        <MetricCard label="Hospital NPS"   value="74"       color={T.violet}  sub="Industry avg: 52" />
        <MetricCard label="Churn Rate"     value="2.1%"     color={T.emerald} sub="↓ 0.4% this month" />
        <MetricCard label="CSAT Score"     value="4.7 / 5"  color={T.amber}   sub="12,847 ratings" />
        <MetricCard label="Risk Index"     value={t.critical > 10 ? "HIGH" : t.critical > 3 ? "MEDIUM" : "LOW"} color={t.critical > 10 ? T.rose : t.critical > 3 ? T.amber : T.emerald} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:14 }}>
        {/* Hospital growth by region */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
          <SectionHeader title="Hospital Growth by Region" />
          {[
            ["Telangana",   423, 87, T.cyan],
            ["Maharashtra", 387, 80, T.violet],
            ["Karnataka",   312, 65, T.emerald],
            ["Tamil Nadu",  264, 55, T.amber],
            ["Delhi NCR",   219, 45, T.indigo],
            ["Others",      237, 49, T.slate],
          ].map(([region, count, pct, color]) => (
            <div key={region} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:T.textMid }}>{region}</span>
                <span style={{ fontSize:12, fontWeight:700, color }}>{count} hospitals</span>
              </div>
              <ProgressBar value={pct} max={100} color={color} />
            </div>
          ))}
        </div>

        {/* Risk alerts */}
        <div>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16, marginBottom:12 }}>
            <SectionHeader title="Risk Alerts" />
            {[
              { msg:"WhatsApp delivery delays", level:"medium", color:T.amber },
              { msg:`${t.critical || 0} critical tickets open`, level: t.critical > 5 ? "high" : "low", color: t.critical > 5 ? T.rose : T.amber },
              { msg:`${m.verifications?.pending || 0} verifications pending`, level:"medium", color:T.amber },
              { msg:`${m.failed_transactions || 0} failed transactions (1h)`, level: m.failed_transactions > 10 ? "high" : "low", color: m.failed_transactions > 10 ? T.rose : T.emerald },
            ].map((a, i) => (
              <div key={i} style={{
                display:"flex", gap:8, marginBottom:7, padding:"7px 10px",
                background:`${a.color}08`, border:`1px solid ${a.color}20`, borderRadius:7,
              }}>
                <span style={{ color:a.color, fontSize:13, flexShrink:0 }}>⚠</span>
                <span style={{ fontSize:11, color:T.textMid }}>{a.msg}</span>
              </div>
            ))}
          </div>

          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
            <SectionHeader title="Platform Health" />
            {[
              ["Total Hospitals", h.total || "—"],
              ["Active",          h.active || "—"],
              ["Pending Verification", h.pending || "—"],
              ["Suspended",       h.suspended || "—"],
              ["Total Patients",  m.patients?.total?.toLocaleString() || "—"],
              ["Employees Online",m.employees?.online || "—"],
            ].map(([k,v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:11, color:T.textDim }}>{k}</span>
                <span style={{ fontSize:12, color:T.text, fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
