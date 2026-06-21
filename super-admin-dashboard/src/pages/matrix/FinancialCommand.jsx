/**
 * src/pages/matrix/FinancialCommand.jsx
 */
import { useEffect } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, DataTable, Badge,
  ProgressBar, Pill, EmptyState, LoadingRows, T,
} from "../../components/matrix/MatrixUI";

const fmtCurr = (n) => {
  if (!n) return "₹0";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)}L`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
};

export default function FinancialCommand() {
  const data  = useMatrixStore((s) => s.financialData);
  const fetch = useMatrixStore((s) => s.fetchFinancial);

  useEffect(() => { fetch(); }, []);

  if (!data) return <PageShell title="Financial Command Center"><LoadingRows n={6} /></PageShell>;

  const src = data.by_source || {};
  const total = (src.hospital||0) + (src.pharmacy||0) + (src.lab||0) || 1;

  return (
    <PageShell title="Financial Command Center" sub="Revenue · Transactions · Refunds — Finance team and above only">
      <div style={{ background:`${T.rose}08`, border:`1px solid ${T.rose}20`, borderRadius:9, padding:"8px 14px", marginBottom:16, fontSize:11, color:T.rose }}>
        🔒 Role-restricted — Finance Manager and above
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:18 }}>
        <MetricCard label="Revenue Today"      value={fmtCurr(data.revenue_today)}   color={T.emerald} sparkle={T.emerald} sub="Live counter" />
        <MetricCard label="Revenue This Month" value={fmtCurr(data.revenue_month)}   color={T.cyan}    sparkle={T.cyan} />
        <MetricCard label="Failed Transactions"value={data.failed_transactions}        color={data.failed_transactions > 5 ? T.rose : T.emerald} sub="Last 1 hour" />
        <MetricCard label="Refunds This Month" value={fmtCurr(data.refunds_amount)}  color={T.amber}   sub={`${data.refunds_count || 0} transactions`} />
        <MetricCard label="Hospital Revenue"   value={fmtCurr(src.hospital)}         color={T.violet}  />
        <MetricCard label="Pharmacy Revenue"   value={fmtCurr(src.pharmacy)}         color={T.indigo}  />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:14 }}>
        {/* Recent transactions */}
        <div>
          <SectionHeader title="Recent Transactions" />
          <DataTable
            cols={["Amount","Status","Method","Context","Time"]}
            rows={(data.recent_transactions || []).map((t) => [
              <span key="a" style={{ fontWeight:700, color: t.status==="success" ? T.emerald : T.rose }}>{fmtCurr(t.amount)}</span>,
              <Badge key="b" label={t.status} variant={t.status === "success" ? "approved" : "critical"} />,
              t.payment_method || "—",
              t.payment_context || "—",
              new Date(t.created_at).toLocaleTimeString(),
            ])}
          />
        </div>

        {/* Revenue by vertical */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
          <SectionHeader title="Revenue by Vertical" />
          {[
            ["Hospitals",  src.hospital||0, T.cyan],
            ["Pharmacies", src.pharmacy||0, T.violet],
            ["Labs",       src.lab||0,      T.emerald],
          ].map(([l,v,c]) => (
            <div key={l} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:12, color:T.textMid }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:c }}>{fmtCurr(v)}</span>
              </div>
              <ProgressBar value={v} max={total} color={c} />
              <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>{((v/total)*100).toFixed(1)}% of total</div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}


/**
 * src/pages/matrix/AuditCompliance.jsx
 * (exported as named export — import as default from separate file or re-export)
 */
export { default as _AuditCompliance } from "./AuditCompliance_impl";
