/**
 * src/pages/matrix/SLAEngine.jsx
 */
import { useEffect } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, DataTable, Badge,
  ProgressBar, Pill, EmptyState, LoadingRows, T,
} from "../../components/matrix/MatrixUI";

const PRI_COLOR = { critical:T.rose, high:"#f97316", medium:T.amber, low:T.slate };
const minToHuman = (m) => {
  if (!m) return "—";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h${m%60 ? ` ${m%60}m` : ""}`;
};

export default function SLAEngine() {
  const rules    = useMatrixStore((s) => s.slaRules);
  const breaches = useMatrixStore((s) => s.slaBreaches);
  const atRisk   = useMatrixStore((s) => s.slaAtRisk);
  const fetch    = useMatrixStore((s) => s.fetchSLAData);

  useEffect(() => { fetch(); }, []);

  return (
    <PageShell title="SLA Engine" sub="Automated SLA tracking · Breach detection · Auto-escalation triggers">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        <MetricCard label="Active Breaches"   value={breaches.length}        color={T.rose}    />
        <MetricCard label="At Risk (30 min)"  value={atRisk.length}          color={T.amber}   />
        <MetricCard label="SLA Rules"         value={rules.length}           color={T.indigo}  />
        <MetricCard label="Auto-Escalations"  value={breaches.filter((b)=>b.auto_escalated).length} color={T.violet} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* SLA Matrix */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
          <SectionHeader title="SLA Matrix by Priority" />
          {!rules.length && <LoadingRows n={4} />}
          {rules.map((r) => (
            <div key={r.priority} style={{ marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <Badge label={r.priority} variant={r.priority} />
                <span style={{ fontSize:10, color:T.textDim }}>Escalate after {minToHuman(r.escalate_after_minutes)}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  ["First Response", minToHuman(r.response_minutes),   PRI_COLOR[r.priority]],
                  ["Resolution",     minToHuman(r.resolution_minutes), PRI_COLOR[r.priority]],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ background:`${color}10`, border:`1px solid ${color}20`, borderRadius:8, padding:"8px 10px" }}>
                    <div style={{ fontSize:9, color:T.textDim, marginBottom:3 }}>{label}</div>
                    <div style={{ fontSize:15, fontWeight:800, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          {/* Active breaches */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16, marginBottom:12 }}>
            <SectionHeader title="Active SLA Breaches" />
            {!breaches.length && <EmptyState msg="No active breaches" icon="✅" />}
            {breaches.slice(0,5).map((b) => (
              <div key={b.id} style={{ marginBottom:10, padding:"10px 12px", background:`${T.rose}06`, border:`1px solid ${T.rose}15`, borderRadius:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:10, fontFamily:"monospace", color:T.textDim }}>{b.ticket_id}</span>
                  <Badge label={b.priority} variant={b.priority} />
                </div>
                <div style={{ fontSize:12, color:T.text, marginBottom:3 }}>
                  {b.breach_type} SLA — <span style={{ color:T.rose }}>+{b.overage_minutes}m over limit</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:10, color:T.textDim }}>Agent: {b.agent_name || b.assigned_to || "Unassigned"}</span>
                  {b.auto_escalated && <Pill label="AUTO-ESCALATED" color={T.rose} />}
                </div>
              </div>
            ))}
          </div>

          {/* At-risk tickets */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
            <SectionHeader title="At Risk — next 30 minutes" />
            {!atRisk.length && <EmptyState msg="No tickets at risk" icon="✅" />}
            {atRisk.slice(0,4).map((t) => {
              const nearestDue = new Date(t.nearest_deadline);
              const minsLeft   = Math.max(0, Math.round((nearestDue - Date.now()) / 60000));
              return (
                <div key={t.ticket_id} style={{ marginBottom:8, padding:"8px 12px", background:`${T.amber}06`, border:`1px solid ${T.amber}20`, borderRadius:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:11, fontFamily:"monospace", color:T.textDim }}>{t.ticket_id}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:T.amber }}>{minsLeft}m left</span>
                  </div>
                  <div style={{ fontSize:12, color:T.textMid, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.subject}</div>
                  <ProgressBar value={30 - minsLeft} max={30} color={minsLeft < 10 ? T.rose : T.amber} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full breach table */}
      {breaches.length > 0 && (
        <div style={{ marginTop:14 }}>
          <SectionHeader title="All Breaches" />
          <DataTable
            cols={["Ticket","Priority","Type","Overage","Agent","Auto-Escalated","When"]}
            rows={breaches.map((b) => [
              <span style={{ fontFamily:"monospace", fontSize:11, color:T.textDim }}>{b.ticket_id}</span>,
              <Badge label={b.priority} variant={b.priority} />,
              b.breach_type,
              `+${b.overage_minutes}m`,
              b.agent_name || b.assigned_to || "—",
              b.auto_escalated ? <Pill label="Yes" color={T.rose} /> : "—",
              new Date(b.created_at).toLocaleString(),
            ])}
          />
        </div>
      )}
    </PageShell>
  );
}
