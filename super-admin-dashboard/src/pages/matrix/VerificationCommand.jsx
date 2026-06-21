/**
 * src/pages/matrix/VerificationCommand.jsx
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, Badge, ActionButton, Pill,
  EmptyState, LoadingRows, Modal, T,
} from "../../components/matrix/MatrixUI";

const ENTITY_COLOR = { hospital:T.cyan, pharmacy:T.violet, lab:T.emerald, employee:T.indigo };
const TYPE_FILTERS = ["all","hospital","pharmacy","lab","employee"];

export default function VerificationCommand() {
  const queue  = useMatrixStore((s) => s.verificationQueue);
  const fetch  = useMatrixStore((s) => s.fetchVerificationQueue);
  const doAction = useMatrixStore((s) => s.verificationAction);
  const employee = useMatrixStore((s) => s.employee);

  const [typeFilter, setTypeFilter] = useState("all");
  const [confirm, setConfirm]       = useState(null);
  const [loading, setLoading]       = useState(false);

  useEffect(() => { setLoading(true); fetch().finally(() => setLoading(false)); }, []);

  const filtered = typeFilter === "all" ? queue : queue.filter((v) => v.entity_type === typeFilter);

  const stats = {
    submitted:    queue.filter((v) => v.verification_status === "pending_verification").length,
    under_review: queue.filter((v) => v.verification_status === "under_review").length,
    approved:     queue.filter((v) => v.verification_status === "active").length,
    rejected:     queue.filter((v) => v.verification_status === "suspended").length,
  };

  return (
    <PageShell title="Verification Command Center" sub="Hospital · Pharmacy · Lab · Employee document verification">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        <MetricCard label="Submitted"    value={stats.submitted}    color={T.amber}   />
        <MetricCard label="Under Review" value={stats.under_review} color={T.indigo}  />
        <MetricCard label="Approved"     value={stats.approved}     color={T.emerald} />
        <MetricCard label="Rejected"     value={stats.rejected}     color={T.rose}    />
      </div>

      {/* Type filters */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {TYPE_FILTERS.map((f) => (
          <button key={f} onClick={() => setTypeFilter(f)} style={{
            padding:"4px 12px", borderRadius:16, border:`1px solid ${typeFilter===f ? T.indigo : T.border}`,
            background: typeFilter===f ? `${T.indigo}18` : "none",
            color: typeFilter===f ? T.indigoL : T.textDim,
            fontSize:11, cursor:"pointer", textTransform:"capitalize",
          }}>{f}</button>
        ))}
      </div>

      {/* Queue */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
        {loading && <div style={{ padding:16 }}><LoadingRows n={5} /></div>}
        {!loading && !filtered.length && <EmptyState msg="No verifications in queue" />}
        {!loading && filtered.map((v) => (
          <div key={v.id} style={{
            padding:"14px 16px", borderBottom:`1px solid ${T.border}`,
            transition:"background 0.12s",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background="rgba(255,255,255,0.02)"}
            onMouseLeave={(e) => e.currentTarget.style.background="transparent"}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <span style={{ fontSize:10, fontFamily:"monospace", color:T.textDim }}>{v.id?.slice(0,8)}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:ENTITY_COLOR[v.entity_type] || T.indigo, background:`${ENTITY_COLOR[v.entity_type] || T.indigo}18`, padding:"1px 7px", borderRadius:10 }}>
                    {v.entity_type}
                  </span>
                  <Badge label={
                    v.verification_status === "pending_verification" ? "submitted" :
                    v.verification_status === "active" ? "approved" :
                    v.verification_status === "suspended" ? "rejected" : v.verification_status
                  } variant={
                    v.verification_status === "active" ? "approved" :
                    v.verification_status === "suspended" ? "rejected" :
                    "pending"
                  } />
                </div>
                <div style={{ fontSize:13, color:T.text, fontWeight:600, marginBottom:3 }}>{v.name}</div>
                <div style={{ fontSize:11, color:T.textDim }}>
                  {v.city && `📍 ${v.city} · `}
                  📄 {v.doc_count || 0} documents ·
                  Submitted {v.submitted_at ? new Date(v.submitted_at).toLocaleDateString() : "—"}
                  {v.verified_by && ` · Reviewed by ${v.verified_by}`}
                  {v.fraud_signals > 0 && <span style={{ color:T.rose }}> · ⚠ {v.fraud_signals} fraud signal{v.fraud_signals>1?"s":""}</span>}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
                {v.verification_status !== "active" && (
                  <ActionButton small label="✓ Approve" color={T.emerald}
                    onClick={() => setConfirm({ entity:v, action:"approve" })} />
                )}
                {v.verification_status !== "suspended" && (
                  <ActionButton small label="✕ Reject" color={T.rose}
                    onClick={() => setConfirm({ entity:v, action:"reject" })} />
                )}
                <ActionButton small label="Review Docs" color={T.indigo}
                  onClick={() => setConfirm({ entity:v, action:"request_more_info" })} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Confirm: ${confirm?.action?.replace(/_/g," ")}`}>
        <p style={{ fontSize:13, color:T.textMid, marginBottom:16 }}>
          Action: <strong style={{ color:T.text }}>{confirm?.action?.replace(/_/g," ")}</strong><br />
          Entity: <strong style={{ color:T.indigoL }}>{confirm?.entity?.name}</strong> ({confirm?.entity?.entity_type})
        </p>
        {confirm?.action === "reject" && (
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, color:T.textDim, display:"block", marginBottom:4 }}>Rejection reason</label>
            <textarea id="vrf-reason" rows={3} placeholder="Enter reason for rejection…" style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:12, resize:"vertical", outline:"none" }} />
          </div>
        )}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <ActionButton label="Cancel" color={T.slate} onClick={() => setConfirm(null)} />
          <ActionButton
            label={confirm?.action === "approve" ? "✓ Approve" : confirm?.action === "reject" ? "✕ Reject" : "Request Info"}
            color={confirm?.action === "approve" ? T.emerald : T.rose}
            onClick={async () => {
              const reason = document.getElementById("vrf-reason")?.value;
              await doAction(confirm.entity.entity_type, confirm.entity.id, confirm.action, reason, employee?.employee_id);
              setConfirm(null);
            }}
          />
        </div>
      </Modal>
    </PageShell>
  );
}
