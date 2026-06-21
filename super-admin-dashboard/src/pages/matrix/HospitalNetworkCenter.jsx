/**
 * src/pages/matrix/HospitalNetworkCenter.jsx
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, Badge, ActionButton,
  SearchInput, ProgressBar, EmptyState, LoadingRows, Modal,
  StatRow, T,
} from "../../components/matrix/MatrixUI";

const fmtCurr = (n) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n ? `₹${n.toLocaleString()}` : "—";

export default function HospitalNetworkCenter() {
  const hospitals = useMatrixStore((s) => s.hospitals);
  const loading   = useMatrixStore((s) => s.hospitalsLoading);
  const total     = useMatrixStore((s) => s.hospitalsTotal);
  const fetch     = useMatrixStore((s) => s.fetchHospitals);
  const doAction  = useMatrixStore((s) => s.hospitalAction);

  const [q, setQ]           = useState("");
  const [statusFilter, setSF] = useState("");
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm]   = useState(null);

  useEffect(() => { fetch({ ...(q ? { q } : {}), ...(statusFilter ? { status: statusFilter } : {}) }); }, [q, statusFilter]);

  const stats = {
    total:     hospitals.length,
    active:    hospitals.filter((h) => h.status === "active" || h.is_active).length,
    pending:   hospitals.filter((h) => h.status === "pending_verification").length,
    suspended: hospitals.filter((h) => h.status === "suspended").length,
  };

  return (
    <PageShell title="Hospital Network Center" sub="10,000+ hospital management — verifications, suspensions, revenue, complaints">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        <MetricCard label="Total Registered" value={total || hospitals.length} color={T.cyan}    />
        <MetricCard label="Active"           value={stats.active}              color={T.emerald} />
        <MetricCard label="Pending"          value={stats.pending}             color={T.amber}   />
        <MetricCard label="Suspended"        value={stats.suspended}           color={T.rose}    />
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search hospital name, city, registration…" />
        <select value={statusFilter} onChange={(e) => setSF(e.target.value)}
          style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:12 }}>
          {[["","All Status"],["active","Active"],["pending_verification","Pending"],["suspended","Suspended"]].map(([v,l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {loading && <LoadingRows n={6} />}
      {!loading && !hospitals.length && <EmptyState msg="No hospitals found" />}

      {!loading && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))", gap:10 }}>
          {hospitals.map((h) => (
            <div key={h.id} onClick={() => setSelected(h)} style={{
              background: selected?.id === h.id ? "rgba(99,102,241,0.08)" : T.surface,
              border: `1px solid ${selected?.id === h.id ? "rgba(99,102,241,0.3)" : T.border}`,
              borderRadius:12, padding:14, cursor:"pointer", transition:"all 0.15s",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.name}</div>
                  <div style={{ fontSize:11, color:T.textDim }}>📍 {h.city || h.address_city} · {h.bed_count ? `${h.bed_count} beds` : h.registration_number || "—"}</div>
                </div>
                <Badge label={h.status?.replace(/_/g," ") || (h.is_active ? "active" : "inactive")} variant={h.status || (h.is_active ? "active" : "suspended")} />
              </div>

              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:9, color:T.textDim, marginBottom:2 }}>Monthly Revenue</div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.emerald }}>{fmtCurr(h.monthly_revenue)}</div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:T.textDim, marginBottom:2 }}>Open Tickets</div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text }}>—</div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:T.textDim, marginBottom:2 }}>Joined</div>
                  <div style={{ fontSize:12, color:T.textMid }}>{h.created_at ? new Date(h.created_at).toLocaleDateString() : "—"}</div>
                </div>
              </div>

              <div style={{ display:"flex", gap:5 }} onClick={(e) => e.stopPropagation()}>
                {(h.status === "pending_verification") && (
                  <ActionButton small label="✓ Verify" color={T.emerald} onClick={() => setConfirm({ hospital:h, action:"activate" })} />
                )}
                {(h.status === "active" || h.is_active) && (
                  <ActionButton small label="Suspend" color={T.rose} onClick={() => setConfirm({ hospital:h, action:"suspend" })} />
                )}
                {h.status === "suspended" && (
                  <ActionButton small label="Reactivate" color={T.emerald} onClick={() => setConfirm({ hospital:h, action:"activate" })} />
                )}
                <ActionButton small label="View Tickets" color={T.indigo} onClick={() => {}} />
                <ActionButton small label="Investigate" color={T.amber} onClick={() => {}} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Confirm: ${confirm?.action} hospital`}>
        <p style={{ fontSize:13, color:T.textMid, marginBottom:16 }}>
          You are about to <strong style={{ color:T.text }}>{confirm?.action}</strong>:
          <br /><strong style={{ color:T.indigoL }}>{confirm?.hospital?.name}</strong>
        </p>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <ActionButton label="Cancel" color={T.slate} onClick={() => setConfirm(null)} />
          <ActionButton
            label={confirm?.action === "activate" ? "✓ Confirm Activate" : "Confirm Suspend"}
            color={confirm?.action === "activate" ? T.emerald : T.rose}
            onClick={async () => {
              await doAction(confirm.hospital.id, confirm.action, `${confirm.action} via Matrix`);
              setConfirm(null); setSelected(null);
            }}
          />
        </div>
      </Modal>
    </PageShell>
  );
}
