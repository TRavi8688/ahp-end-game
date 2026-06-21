/**
 * src/pages/matrix/EmployeeCommandCenter.jsx
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, DataTable, Badge,
  ProgressBar, ActionButton, SearchInput, EmptyState, LoadingRows,
  Modal, StatRow, T,
} from "../../components/matrix/MatrixUI";

const SHIFT_COLORS = {
  online:   T.emerald, offline: T.slate, break:  T.amber,
  meeting:  T.cyan,    training:T.violet, leave:  T.rose,
};
const LEVEL_ORDER = { l1:1, l2:2, team_lead:3, manager:4, super_admin:5 };
const TEAMS = ["","support","finance","engineering","onboarding","data"];
const SHIFTS = ["online","offline","break","meeting","training","leave"];

export default function EmployeeCommandCenter() {
  const employees   = useMatrixStore((s) => s.employees);
  const loading     = useMatrixStore((s) => s.employeesLoading);
  const fetchEmp    = useMatrixStore((s) => s.fetchEmployees);
  const updateShift = useMatrixStore((s) => s.updateShift);

  const [teamFilter, setTeamFilter] = useState("");
  const [selected,   setSelected]   = useState(null);
  const [confirmShift, setConfirmShift] = useState(null);
  const [view, setView] = useState("grid"); // grid | table

  useEffect(() => {
    fetchEmp(teamFilter ? { team: teamFilter } : {});
  }, [teamFilter]);

  const online   = employees.filter((e) => e.shift_status === "online");
  const onBreak  = employees.filter((e) => e.shift_status === "break");
  const onLeave  = employees.filter((e) => e.shift_status === "leave");
  const maxLoad  = Math.max(...employees.map((e) => e.open_tickets || 0), 1);

  return (
    <PageShell title="Employee Command Center" sub="Workforce visibility · Shift management · Workload distribution · Auto-redistribution">
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:18 }}>
        <MetricCard label="Total Staff"  value={employees.length} color={T.indigo}  />
        <MetricCard label="Online"       value={online.length}    color={T.emerald} />
        <MetricCard label="On Break"     value={onBreak.length}   color={T.amber}   />
        <MetricCard label="On Leave"     value={onLeave.length}   color={T.rose}    />
        <MetricCard label="Unassigned Pool" value={online.filter((e)=>(e.open_tickets||0)===0).length} color={T.cyan} sub="Ready for assignment" />
      </div>

      {/* Filters & view toggle */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        {TEAMS.map((t) => (
          <button key={t} onClick={() => setTeamFilter(t)} style={{
            padding:"4px 12px", borderRadius:16,
            border:`1px solid ${teamFilter===t ? T.indigo : T.border}`,
            background: teamFilter===t ? `${T.indigo}18` : "none",
            color: teamFilter===t ? T.indigoL : T.textDim,
            fontSize:11, cursor:"pointer", textTransform:"capitalize",
          }}>{t || "All Teams"}</button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
          {["grid","table"].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:"4px 10px", borderRadius:6, border:`1px solid ${view===v ? T.indigo : T.border}`,
              background: view===v ? `${T.indigo}18` : "none", color: view===v ? T.indigoL : T.textDim, fontSize:11, cursor:"pointer",
            }}>{v}</button>
          ))}
        </div>
      </div>

      {loading && <LoadingRows n={6} />}

      {/* Grid view */}
      {!loading && view === "grid" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10 }}>
          {employees.map((e) => {
            const load  = e.open_tickets || 0;
            const cap   = e.daily_ticket_limit || 40;
            const color = SHIFT_COLORS[e.shift_status] || T.slate;
            return (
              <div key={e.employee_id} onClick={() => setSelected(selected?.employee_id === e.employee_id ? null : e)} style={{
                background: selected?.employee_id === e.employee_id ? "rgba(99,102,241,0.1)" : T.surface,
                border:`1px solid ${selected?.employee_id === e.employee_id ? `${T.indigo}40` : T.border}`,
                borderRadius:12, padding:14, cursor:"pointer", transition:"all 0.15s",
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:`${color}18`, border:`1px solid ${color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color }}>
                    {e.avatar_initials || e.full_name?.slice(0,2)}
                  </div>
                  <Badge label={e.shift_status} variant={e.shift_status === "online" ? "approved" : e.shift_status === "leave" ? "critical" : "pending"} />
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:2 }}>{e.full_name}</div>
                <div style={{ fontSize:10, color:T.textDim, marginBottom:8 }}>{e.team} · {e.level}</div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:11, color:T.textMid }}>{load} / {cap} tickets</span>
                  <span style={{ fontSize:10, color: load/cap > 0.8 ? T.rose : T.textDim }}>{Math.round((load/cap)*100)}%</span>
                </div>
                <ProgressBar value={load} max={cap} color={load/cap > 0.8 ? T.rose : load/cap > 0.5 ? T.amber : T.emerald} />
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {!loading && view === "table" && (
        <DataTable
          cols={["Employee ID","Name","Team","Level","Shift","Open Tickets","Resolved Total","SLA %"]}
          rows={employees.map((e) => [
            <span style={{ fontFamily:"monospace", fontSize:10, color:T.textDim }}>{e.employee_id}</span>,
            e.full_name,
            e.team,
            <Badge label={e.level} variant={e.level} />,
            <Badge label={e.shift_status} variant={e.shift_status === "online" ? "approved" : e.shift_status === "leave" ? "critical" : "pending"} />,
            <span style={{ fontWeight:700, color:(e.open_tickets||0)>30?T.rose:(e.open_tickets||0)>15?T.amber:T.text }}>{e.open_tickets || 0}</span>,
            (e.resolved_total || 0).toLocaleString(),
            `${e.resolution_rate || "—"}%`,
          ])}
          onRowClick={(_, i) => setSelected(employees[i])}
        />
      )}

      {/* Selected employee panel */}
      {selected && (
        <div style={{ marginTop:14, background:T.surface, border:`1px solid ${T.indigo}30`, borderRadius:14, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
            <div style={{ display:"flex", gap:12 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:`${SHIFT_COLORS[selected.shift_status]||T.indigo}18`, border:`1px solid ${SHIFT_COLORS[selected.shift_status]||T.indigo}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:SHIFT_COLORS[selected.shift_status]||T.indigo }}>
                {selected.avatar_initials || selected.full_name?.slice(0,2)}
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:T.text }}>{selected.full_name}</div>
                <div style={{ fontSize:11, color:T.textDim }}>{selected.employee_id} · {selected.team} · {selected.level}</div>
                <div style={{ fontSize:11, color:T.textDim }}>{selected.email}</div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:T.textDim, cursor:"pointer", fontSize:20 }}>×</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <div>
              <StatRow label="Current Shift"    value={<Badge label={selected.shift_status} variant={selected.shift_status==="online"?"approved":"pending"} />} />
              <StatRow label="Open Tickets"     value={selected.open_tickets || 0} color={selected.open_tickets > 30 ? T.rose : T.text} />
              <StatRow label="Daily Limit"      value={selected.daily_ticket_limit || 40} />
              <StatRow label="Resolved Total"   value={(selected.resolved_total || 0).toLocaleString()} color={T.emerald} />
            </div>
            <div>
              <StatRow label="Resolution Rate"  value={`${selected.resolution_rate || "—"}%`} />
              <StatRow label="Last Seen"        value={selected.last_seen_at ? new Date(selected.last_seen_at).toLocaleString() : "—"} />
            </div>
          </div>

          <SectionHeader title="Update Shift Status" />
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {SHIFTS.map((s) => (
              <button key={s} onClick={() => setConfirmShift({ employee: selected, newStatus: s })}
                disabled={s === selected.shift_status}
                style={{
                  padding:"6px 14px", borderRadius:8,
                  border:`1px solid ${SHIFT_COLORS[s]}40`,
                  background:`${SHIFT_COLORS[s]}${s===selected.shift_status?"30":"10"}`,
                  color: SHIFT_COLORS[s], fontSize:12, cursor: s===selected.shift_status?"not-allowed":"pointer",
                  opacity: s===selected.shift_status ? 0.5 : 1,
                }}>
                {s === selected.shift_status ? `● ${s}` : `→ ${s}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shift change confirm modal */}
      <Modal open={!!confirmShift} onClose={() => setConfirmShift(null)} title="Confirm Shift Change">
        {confirmShift && (
          <>
            <p style={{ fontSize:13, color:T.textMid, marginBottom:6 }}>
              Changing <strong style={{ color:T.text }}>{confirmShift.employee.full_name}</strong> from
              <strong style={{ color:SHIFT_COLORS[confirmShift.employee.shift_status] }}> {confirmShift.employee.shift_status}</strong> →
              <strong style={{ color:SHIFT_COLORS[confirmShift.newStatus] }}> {confirmShift.newStatus}</strong>
            </p>
            {(confirmShift.newStatus === "leave" || confirmShift.newStatus === "offline") && (confirmShift.employee.open_tickets || 0) > 0 && (
              <div style={{ background:`${T.amber}08`, border:`1px solid ${T.amber}20`, borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
                <div style={{ fontSize:12, color:T.amber, fontWeight:600 }}>⚠ Auto-Redistribution</div>
                <div style={{ fontSize:11, color:T.textMid, marginTop:3 }}>
                  {confirmShift.employee.open_tickets} open tickets will be automatically redistributed to available online agents.
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <ActionButton label="Cancel" color={T.slate} onClick={() => setConfirmShift(null)} />
              <ActionButton
                label={`Confirm → ${confirmShift.newStatus}`}
                color={SHIFT_COLORS[confirmShift.newStatus]}
                onClick={async () => {
                  await updateShift(confirmShift.employee.employee_id, confirmShift.newStatus);
                  setConfirmShift(null); setSelected(null);
                }}
              />
            </div>
          </>
        )}
      </Modal>
    </PageShell>
  );
}
