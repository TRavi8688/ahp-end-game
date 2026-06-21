/**
 * src/pages/matrix/IAMGovernance.jsx
 */
import { useState, useCallback } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, DataTable, Badge, ActionButton,
  SearchInput, EmptyState, LoadingRows, Modal, StatRow, T,
} from "../../components/matrix/MatrixUI";

const ENTITY_TYPES = ["", "employee", "hospital", "patient", "pharmacy"];
const ACTIONS = ["suspend","activate","force_logout","reset_password"];
const roleColor = { doctor:T.cyan, employee:T.indigo, patient:T.emerald, hospital_admin:T.violet, receptionist:T.amber, pharmacy:T.rose, super_admin:T.rose };

export default function IAMGovernance() {
  const results  = useMatrixStore((s) => s.iamResults);
  const loading  = useMatrixStore((s) => s.iamLoading);
  const search   = useMatrixStore((s) => s.iamSearch);
  const action   = useMatrixStore((s) => s.iamAction);

  const [q, setQ]       = useState("");
  const [et, setEt]     = useState("");
  const [confirm, setConfirm] = useState(null); // { entity, action }

  const doSearch = useCallback(() => { if (q.trim()) search(q, et || undefined); }, [q, et]);

  return (
    <PageShell title="IAM Governance Center" sub="Global identity search · suspend, activate, force-logout, reset password">
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, ID, email, org…" />
        <select value={et} onChange={(e) => setEt(e.target.value)} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:12 }}>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t || "All Entity Types"}</option>)}
        </select>
        <ActionButton label="Search" color={T.indigo} onClick={doSearch} />
      </div>

      {loading && <LoadingRows n={6} />}

      {!loading && results.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {results.map((u) => (
            <div key={u.id} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{
                width:36, height:36, borderRadius:"50%", flexShrink:0,
                background:`${roleColor[u.role] || T.indigo}18`,
                border:`1px solid ${roleColor[u.role] || T.indigo}30`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:700, color:roleColor[u.role] || T.indigo,
              }}>{u.name?.[0] || "?"}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:13, color:T.text, fontWeight:600 }}>{u.name}</span>
                  <span style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>{u.id}</span>
                </div>
                <div style={{ display:"flex", gap:7 }}>
                  <Badge label={u.role?.replace(/_/g," ")} variant={u.role} />
                  <span style={{ fontSize:11, color:T.textDim }}>{u.org}</span>
                  <Badge label={u.status || (u.is_active ? "active" : "inactive")} variant={u.status || (u.is_active ? "active" : "suspended")} />
                </div>
              </div>
              <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                {u.is_active
                  ? <ActionButton small label="Suspend" color={T.rose} onClick={() => setConfirm({ entity:u, action:"suspend" })} />
                  : <ActionButton small label="Activate" color={T.emerald} onClick={() => setConfirm({ entity:u, action:"activate" })} />
                }
                <ActionButton small label="Force Logout" color={T.amber} onClick={() => setConfirm({ entity:u, action:"force_logout" })} />
                <ActionButton small label="Reset PWD" color={T.indigo} onClick={() => setConfirm({ entity:u, action:"reset_password" })} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !results.length && q && <EmptyState msg={`No results for "${q}"`} />}
      {!loading && !results.length && !q && <EmptyState msg="Search for any patient, employee, hospital, pharmacy, or lab" icon="🔍" />}

      {/* Confirm modal */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Confirm: ${confirm?.action?.replace(/_/g," ")}`}>
        <p style={{ fontSize:13, color:T.textMid, marginBottom:16 }}>
          You are about to <strong style={{ color:T.text }}>{confirm?.action?.replace(/_/g," ")}</strong> the entity:
          <br /><strong style={{ color:T.indigoL }}>{confirm?.entity?.name}</strong> ({confirm?.entity?.id})
        </p>
        <p style={{ fontSize:11, color:T.textDim, marginBottom:20 }}>This action will be logged to the immutable audit trail.</p>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <ActionButton label="Cancel" color={T.slate} onClick={() => setConfirm(null)} />
          <ActionButton label={`Confirm ${confirm?.action?.replace(/_/g," ")}`} color={T.rose} onClick={async () => {
            await action(confirm.entity.entity_type || et || "employee", confirm.entity.id, confirm.action, "IAM action via Matrix");
            setConfirm(null);
          }} />
        </div>
      </Modal>
    </PageShell>
  );
}
