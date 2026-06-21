import { useEffect, useState, useCallback } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, DataTable, Badge,
  Pill, ProgressBar, StatusDot, ActionButton, SearchInput,
  EmptyState, LoadingRows,
} from "../../components/matrix/MatrixUI";

const SHIFT_COLORS = { online:"#10b981", offline:"#475569", break:"#f59e0b", meeting:"#06b6d4", training:"#8b5cf6", leave:"#f43f5e" };

export default function EmployeeCommandCenter() {
  const employees   = useMatrixStore((s) => s.employees);
  const loading     = useMatrixStore((s) => s.employeesLoading);
  const fetchEmp    = useMatrixStore((s) => s.fetchEmployees);
  const updateShift = useMatrixStore((s) => s.updateShift);
  const [selected, setSelected] = useState(null);
  const [teamFilter, setTeamFilter] = useState("");

  useEffect(() => { fetchEmp(teamFilter ? { team: teamFilter } : {}); }, [teamFilter]);

  const teams = ["","support","finance","engineering","onboarding","data"];

  return (
    <PageShell title="Employee Command Center" sub="Workforce visibility · Shift management · Workload distribution">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          ["Online", employees.filter((e) => e.shift_status==="online").length, "#10b981"],
          ["On Break", employees.filter((e) => e.shift_status==="break").length, "#f59e0b"],
          ["On Leave", employees.filter((e) => e.shift_status==="leave").length, "#f43f5e"],
          ["Total Staff", employees.length, "#6366f1"],
        ].map(([l,v,c]) => <MetricCard key={l} label={l} value={v} color={c} />)}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {teams.map((t) => (
          <button key={t} onClick={() => setTeamFilter(t)} style={{
            padding:"4px 12px", borderRadius:16, border: `1px solid ${teamFilter===t ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
            background: teamFilter===t ? "rgba(99,102,241,0.15)" : "none",
            color: teamFilter===t ? "#818cf8" : "#475569", fontSize:11, cursor:"pointer",
          }}>{t || "All Teams"}</button>
        ))}
      </div>

      {/* Workload bars */}
      <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16, marginBottom:14 }}>
        <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>Workload Distribution — Auto-Balance Engine</div>
        {loading && <LoadingRows n={6} />}
        {employees.filter((e) => e.shift_status !== "leave").sort((a,b) => (b.open_tickets||0)-(a.open_tickets||0)).map((e) => (
          <div key={e.employee_id} onClick={() => setSelected(selected?.employee_id === e.employee_id ? null : e)}
            style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, cursor:"pointer", padding:"4px 6px", borderRadius:7,
              background: selected?.employee_id === e.employee_id ? "rgba(99,102,241,0.08)" : "transparent" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(99,102,241,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#818cf8", flexShrink:0 }}>
              {e.avatar_initials || e.full_name?.slice(0,2)}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:"#f1f5f9", fontWeight:500 }}>{e.full_name}</span>
                <span style={{ fontSize:11, color:"#475569" }}>{e.open_tickets || 0} open</span>
              </div>
              <ProgressBar value={e.open_tickets || 0} max={e.daily_ticket_limit || 40}
                color={(e.open_tickets||0) > 30 ? "#f43f5e" : (e.open_tickets||0) > 15 ? "#f59e0b" : "#10b981"} />
            </div>
            <div style={{ width:8, height:8, borderRadius:"50%", background: SHIFT_COLORS[e.shift_status] || "#475569", flexShrink:0 }} />
          </div>
        ))}
      </div>

      {/* Selected employee actions */}
      {selected && (
        <div style={{ background:"#0c1220", border:"1px solid rgba(99,102,241,0.2)", borderRadius:14, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{selected.full_name}</div>
              <div style={{ fontSize:11, color:"#475569" }}>{selected.employee_id} · {selected.team} · {selected.level}</div>
            </div>
            <Badge label={selected.shift_status} variant={selected.shift_status === "online" ? "approved" : selected.shift_status === "leave" ? "critical" : "pending"} />
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["online","break","meeting","training","leave","offline"].map((s) => (
              <button key={s} onClick={() => { updateShift(selected.employee_id, s); setSelected(null); }} style={{
                padding:"5px 12px", borderRadius:7, border: `1px solid ${SHIFT_COLORS[s]}40`,
                background: `${SHIFT_COLORS[s]}10`, color: SHIFT_COLORS[s], fontSize:11, cursor:"pointer",
              }}>→ {s}</button>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}