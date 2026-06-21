/**
 * src/pages/matrix/MissionControl.jsx
 *
 * Module 1 — Mission Control
 * The first screen. Real-time ecosystem visibility.
 * Polls /matrix/mission/overview every 5s (via App.jsx shell's startMissionPolling).
 * System health from /matrix/mission/system-health.
 * Activity feed from /matrix/mission/activity-feed.
 */
import { useEffect } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, ProgressBar,
  StatusDot, Pill, EmptyState, LoadingRows, T,
} from "../../components/matrix/MatrixUI";

const fmt  = (n) => {
  if (n == null) return "—";
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};
const fmtC = (n) => {
  if (!n) return "₹0";
  if (n >= 1e7)  return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5)  return `₹${(n / 1e5).toFixed(1)}L`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
};

const FEED_ICONS = {
  ticket:   { icon:"🎫", color:T.indigo  },
  hospital: { icon:"🏥", color:T.cyan    },
  patient:  { icon:"👤", color:T.emerald },
  escalate: { icon:"🔺", color:T.rose    },
  resolve:  { icon:"✅", color:T.emerald },
  suspend:  { icon:"🚫", color:T.rose    },
  verify:   { icon:"✅", color:T.emerald },
  default:  { icon:"📌", color:T.slate   },
};

function feedMeta(event) {
  const type = event.entity_type?.toLowerCase() || "default";
  return FEED_ICONS[type] || FEED_ICONS.default;
}

export default function MissionControl() {
  const metrics = useMatrixStore((s) => s.missionMetrics);
  const health  = useMatrixStore((s) => s.systemHealth);
  const feed    = useMatrixStore((s) => s.activityFeed);
  const loading = useMatrixStore((s) => s.missionLoading);
  const fetch   = useMatrixStore((s) => s.fetchMissionOverview);

  // Initial fetch (polling is already running from Shell)
  useEffect(() => { fetch(); }, []);

  const h = metrics?.hospitals   || {};
  const p = metrics?.pharmacies  || {};
  const l = metrics?.labs        || {};
  const e = metrics?.employees   || {};
  const t = metrics?.tickets     || {};
  const r = metrics?.revenue     || {};
  const v = metrics?.verifications || {};

  const services = health ? [
    ["API Gateway",    health.database?.status,     health.database?.latency_ms],
    ["Database",       health.database?.status,     health.database?.latency_ms],
    ["Redis / Queue",  health.redis?.status,        health.redis?.latency_ms],
    ["WhatsApp",       health.whatsapp?.status,     null],
    ["SMS Gateway",    health.sms?.status,          null],
    ["Notifications",  health.notifications?.status,null],
    ["AI Service",     health.ai_service?.status,   null],
  ] : [];

  return (
    <PageShell title="Mission Control" live sub="Real-time visibility across the entire Hospin ecosystem">
      {/* ── Primary Metrics ─────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(158px,1fr))", gap:10, marginBottom:18 }}>
        <MetricCard label="Active Hospitals"      value={fmt(h.active)}          color={T.cyan}    sub={`${fmt(h.pending||0)} pending`} />
        <MetricCard label="Active Pharmacies"     value={fmt(p.active)}          color={T.violet}  sub={`${fmt(p.total||0)} total`} />
        <MetricCard label="Active Labs"           value={fmt(l.active)}          color={T.emerald} sub={`${fmt(l.total||0)} total`} />
        <MetricCard label="Total Patients"        value={fmt(metrics?.patients?.total)} color={T.indigo} sparkle={T.indigoL} />
        <MetricCard label="Online Employees"      value={e.online ?? "—"}        color={T.emerald} sub={`${e.on_break||0} on break · ${e.on_leave||0} leave`} />
        <MetricCard label="Open Tickets"          value={t.open ?? "—"}          color={t.critical > 0 ? T.amber : T.emerald} sub={`${t.critical||0} critical`} />
        <MetricCard label="Resolved Today"        value={t.resolved_today ?? "—"}color={T.emerald} />
        <MetricCard label="Pending Verifications" value={fmt(v.pending)}         color={v.pending > 20 ? T.rose : T.amber} />
        <MetricCard label="Failed Transactions"   value={metrics?.failed_transactions ?? 0} color={metrics?.failed_transactions > 5 ? T.rose : T.emerald} sub="Last 1 hour" />
        <MetricCard label="Revenue Today"         value={fmtC(r.today)}          color={T.emerald} sparkle={T.emerald} />
        <MetricCard label="Revenue This Month"    value={fmtC(r.this_month)}     color={T.cyan}    sparkle={T.cyan} />
      </div>

      {/* ── System Health + Activity Feed ───────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:14, marginBottom:14 }}>

        {/* System Health */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
          <div style={{ fontSize:10, color:T.textDim, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>
            System Health
          </div>

          {!health && <LoadingRows n={6} />}

          {services.map(([name, status, latency]) => (
            <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:12, color:T.textMid }}>{name}</span>
              <StatusDot status={status || "operational"} />
            </div>
          ))}

          {health && (
            <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:11, color:T.textDim }}>DB Latency</span>
                <span style={{ fontSize:12, fontWeight:700, color: health.database?.latency_ms > 200 ? T.amber : T.emerald }}>
                  {health.database?.latency_ms ?? "—"}ms
                </span>
              </div>
              <ProgressBar
                value={Math.max(0, 500 - (health.database?.latency_ms || 0))}
                max={500}
                color={health.database?.latency_ms > 200 ? T.amber : T.emerald}
              />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, marginBottom:5 }}>
                <span style={{ fontSize:11, color:T.textDim }}>Redis Latency</span>
                <span style={{ fontSize:12, fontWeight:700, color: health.redis?.latency_ms > 50 ? T.amber : T.emerald }}>
                  {health.redis?.latency_ms ?? "—"}ms
                </span>
              </div>
              <ProgressBar
                value={Math.max(0, 100 - (health.redis?.latency_ms || 0))}
                max={100}
                color={health.redis?.latency_ms > 50 ? T.amber : T.emerald}
              />
              <div style={{ marginTop:12, fontSize:10, color:T.textDim }}>
                Checked: {new Date(health.checked_at).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>

        {/* Live Activity Feed */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:10, color:T.textDim, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>
              Live Activity Feed
            </div>
            <Pill label="LIVE · updates every 5s" color={T.emerald} />
          </div>

          {loading && !feed.length && <LoadingRows n={8} />}

          {feed.map((event, i) => {
            const meta = feedMeta(event);
            const isNew = i === 0;
            return (
              <div key={event.id || i} style={{
                display:    "flex",
                alignItems: "flex-start",
                gap:        10,
                padding:    "8px 10px",
                borderRadius: 8,
                marginBottom: 3,
                background:  isNew ? "rgba(99,102,241,0.05)" : "transparent",
                borderLeft:  `2px solid ${isNew ? T.indigo : "transparent"}`,
                transition:  "all 0.3s",
              }}>
                <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{meta.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color: isNew ? T.text : T.textMid, lineHeight:1.4 }}>
                    <strong style={{ color:meta.color }}>{event.action?.replace(/_/g," ")}</strong>
                    {event.entity_type && <> · <span style={{ color:T.textDim }}>{event.entity_type}</span></>}
                    {event.entity_name && <> · <span style={{ color:T.cyan }}>{event.entity_name}</span></>}
                  </div>
                  <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>
                    {event.created_at
                      ? new Date(event.created_at).toLocaleTimeString()
                      : event.ts || "just now"}
                  </div>
                </div>
                {isNew && (
                  <div style={{ width:6, height:6, borderRadius:"50%", background:T.indigo, flexShrink:0, marginTop:4 }} />
                )}
              </div>
            );
          })}

          {!loading && !feed.length && (
            <EmptyState msg="Waiting for platform activity…" icon="📡" />
          )}
        </div>
      </div>

      {/* ── Network Overview ────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {[
          { label:"Hospital Network", active:h.active, pending:h.pending, suspended:h.suspended, total:h.total, color:T.cyan },
          { label:"Pharmacy Network", active:p.active, pending:null, suspended:null, total:p.total, color:T.violet },
          { label:"Lab Network",      active:l.active, pending:null, suspended:null, total:l.total, color:T.emerald },
        ].map(({ label, active, pending, suspended, total, color }) => (
          <div key={label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:14 }}>
            <div style={{ fontSize:11, color:T.textDim, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color, marginBottom:8 }}>{fmt(active)}<span style={{ fontSize:13, color:T.textDim, fontWeight:400 }}> active</span></div>
            <ProgressBar value={active || 0} max={total || 1} color={color} />
            <div style={{ display:"flex", gap:12, marginTop:8, fontSize:10, color:T.textDim }}>
              {pending != null && <span>⏳ {pending} pending</span>}
              {suspended != null && suspended > 0 && <span style={{ color:T.rose }}>🚫 {suspended} suspended</span>}
              <span>{fmt(total)} total</span>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
