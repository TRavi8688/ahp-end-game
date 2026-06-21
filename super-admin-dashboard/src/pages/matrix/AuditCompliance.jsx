/**
 * src/pages/matrix/AuditCompliance.jsx
 */
import { useEffect, useState } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, DataTable, Badge, ActionButton,
  SearchInput, Pill, EmptyState, LoadingRows, T,
} from "../../components/matrix/MatrixUI";

const LEVEL_COLOR = {
  super_admin: T.rose, manager: T.violet, team_lead: T.cyan,
  l1: T.indigo, l2: T.cyan, system: T.slate,
};

export default function AuditCompliance() {
  const logs    = useMatrixStore((s) => s.auditLogs);
  const total   = useMatrixStore((s) => s.auditTotal);
  const loading = useMatrixStore((s) => s.auditLoading);
  const page    = useMatrixStore((s) => s.auditPage);
  const fetch   = useMatrixStore((s) => s.fetchAuditLogs);

  const [q, setQ]           = useState("");
  const [entityType, setEt] = useState("");

  useEffect(() => { fetch({ ...(q ? { actor_id: q } : {}), ...(entityType ? { entity_type: entityType } : {}) }); }, [page]);

  return (
    <PageShell title="Audit & Compliance Center" sub="Immutable audit trail — every action logged forever. Nothing is deleted.">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        <MetricCard label="Total Audit Events" value={Number(total).toLocaleString()} color={T.indigo} />
        <MetricCard label="Logged Today"       value="—"  color={T.cyan} sub="Live counter" />
        <MetricCard label="Critical Actions"   value={logs.filter((l)=>l.action?.includes("suspend")||l.action?.includes("force")).length} color={T.rose} />
        <MetricCard label="Compliance Score"   value="98.4%" color={T.emerald} />
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Filter by actor ID…" />
        <select value={entityType} onChange={(e) => setEt(e.target.value)}
          style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.surface, color:T.textMid, fontSize:12 }}>
          {["","hospital","ticket","employee","pharmacy","lab","system"].map((t) => (
            <option key={t} value={t}>{t || "All Entity Types"}</option>
          ))}
        </select>
        <ActionButton label="Apply Filter" color={T.indigo} onClick={() => fetch({ ...(q?{actor_id:q}:{}), ...(entityType?{entity_type:entityType}:{}) })} />
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center" }}>
          <Pill label="IMMUTABLE" color={T.emerald} />
        </div>
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
        <div style={{ padding:"10px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:10, color:T.textDim, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>Audit Log Stream</span>
          <span style={{ fontSize:11, color:T.textDim }}>{total.toLocaleString()} total events</span>
        </div>

        {loading && <div style={{ padding:16 }}><LoadingRows n={8} /></div>}
        {!loading && !logs.length && <EmptyState msg="No audit logs match your filters" />}

        {!loading && logs.map((log, i) => (
          <div key={log.id || i} style={{
            padding:"10px 14px", borderBottom: i < logs.length-1 ? `1px solid ${T.border}` : "none",
            transition:"background 0.12s",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background="rgba(255,255,255,0.02)"}
            onMouseLeave={(e) => e.currentTarget.style.background="transparent"}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, fontWeight:700, color: LEVEL_COLOR["l1"] || T.indigo }}>
                    {log.actor_id?.toString()?.slice(0,12) || "System"}
                  </span>
                  <span style={{ fontSize:10, color:T.textDim }}>→</span>
                  <span style={{ fontSize:12, color:T.text }}>{log.action}</span>
                  {log.entity_type && <>
                    <span style={{ fontSize:10, color:T.textDim }}>on</span>
                    <span style={{ fontSize:12, color:T.cyan }}>{log.entity_name || log.entity_id?.toString()?.slice(0,12) || log.entity_type}</span>
                  </>}
                </div>
                {log.details && (
                  <div style={{ fontSize:10, color:T.textDim }}>
                    {typeof log.details === "string" ? log.details : JSON.stringify(log.details).slice(0,120)}
                  </div>
                )}
              </div>
              <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                <div style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
