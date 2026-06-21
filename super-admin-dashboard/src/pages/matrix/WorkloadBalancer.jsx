/**
 * src/pages/matrix/WorkloadBalancer.jsx
 */
import { useEffect } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, ProgressBar,
  Badge, EmptyState, LoadingRows, T,
} from "../../components/matrix/MatrixUI";

export default function WorkloadBalancer() {
  const employees = useMatrixStore((s) => s.employees);
  const loading   = useMatrixStore((s) => s.employeesLoading);
  const fetch     = useMatrixStore((s) => s.fetchEmployees);

  useEffect(() => { fetch(); }, []);

  const active   = employees.filter((e) => e.shift_status === "online");
  const maxLoad  = Math.max(...active.map((e) => e.open_tickets || 0), 1);
  const avgLoad  = active.length ? (active.reduce((s,e)=>(s + (e.open_tickets||0)),0) / active.length).toFixed(1) : 0;
  const maxAgent = active.reduce((a,b) => (a.open_tickets||0) > (b.open_tickets||0) ? a : b, {});
  const minAgent = active.reduce((a,b) => (a.open_tickets||0) < (b.open_tickets||0) ? a : b, {});

  return (
    <PageShell title="Workload Balancer" sub="Real-time capacity management — new tickets auto-routed to lowest-load agent">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        <MetricCard label="Online Agents"  value={active.length}   color={T.emerald} />
        <MetricCard label="Avg Load"       value={avgLoad}         color={T.indigo}  sub="tickets per agent" />
        <MetricCard label="Highest Load"   value={maxAgent.open_tickets || 0} color={T.rose}   sub={maxAgent.full_name} />
        <MetricCard label="Lowest Load"    value={minAgent.open_tickets || 0} color={T.emerald} sub={minAgent.full_name} />
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
        <SectionHeader title="Live Agent Load Distribution" sub="Sorted by open ticket count · Auto-balance engine assigns to lowest first" />
        {loading && <LoadingRows n={6} />}
        {!loading && !active.length && <EmptyState msg="No agents currently online" />}
        {!loading && [...active].sort((a,b) => (b.open_tickets||0)-(a.open_tickets||0)).map((e) => {
          const load = e.open_tickets || 0;
          const cap  = e.daily_ticket_limit || 40;
          const pct  = (load / cap) * 100;
          const color = pct > 80 ? T.rose : pct > 50 ? T.amber : T.emerald;
          return (
            <div key={e.employee_id} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:"50%", background:`${T.indigo}18`, border:`1px solid ${T.indigo}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:T.indigoL, flexShrink:0 }}>
                    {e.avatar_initials || e.full_name?.slice(0,2)}
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:T.text, fontWeight:500 }}>{e.full_name}</div>
                    <div style={{ fontSize:10, color:T.textDim }}>{e.team} · {e.level}</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:700, color }}>{load}</span>
                  <span style={{ fontSize:10, color:T.textDim }}>/ {cap}</span>
                  {load === 0 && <span style={{ fontSize:10, color:T.emerald, background:`${T.emerald}15`, padding:"1px 7px", borderRadius:10 }}>NEXT IN QUEUE</span>}
                </div>
              </div>
              <ProgressBar value={load} max={cap} color={color} />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:14, background:`${T.indigo}08`, border:`1px solid ${T.indigo}20`, borderRadius:12, padding:14 }}>
        <div style={{ fontSize:11, color:T.indigoL, fontWeight:700, marginBottom:8 }}>⚡ Assignment Algorithm</div>
        <div style={{ fontSize:12, color:T.textMid, lineHeight:1.7 }}>
          When a ticket arrives → <strong style={{color:T.text}}>AI detects category</strong> → routed to correct team queue →
          <strong style={{color:T.text}}> load balancer scans all online L1 agents</strong> → selects agent with
          <strong style={{color:T.text}}> lowest open ticket count</strong> → also checks: shift status, leave status, daily limit, skill match →
          auto-assigns with zero manager involvement.
        </div>
      </div>
    </PageShell>
  );
}
