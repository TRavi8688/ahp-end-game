/**
 * src/pages/matrix/MissionControl.jsx — Hospain Matrix 3.0
 * FIX: renamed `fetch` variable to `fetchMission` — `fetch` shadows the browser API
 */
import { useEffect, useState, useCallback } from "react";
import { useMatrixStore } from "../../stores/matrixStore";
import {
  PageShell, MetricCard, SectionHeader, DataTable, Badge,
  Pill, ProgressBar, StatusDot, ActionButton, SearchInput,
  EmptyState, LoadingRows,
} from "../../components/matrix/MatrixUI";

const fmt  = (n) => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n ?? "—");
const fmtC = (n) => `₹${((n||0)/1e5).toFixed(1)}L`;

export default function MissionControl() {
  const metrics      = useMatrixStore((s) => s.missionMetrics);
  const health       = useMatrixStore((s) => s.systemHealth);
  const feed         = useMatrixStore((s) => s.activityFeed);
  const loading      = useMatrixStore((s) => s.missionLoading);
  // FIX: was `const fetch = ...` which shadows the browser fetch API
  const fetchMission = useMatrixStore((s) => s.fetchMissionOverview);

  // FIX: was `fetch()` — now correctly calls fetchMission()
  useEffect(() => { fetchMission(); }, []);

  const m = metrics || {};
  const h = m.hospitals   || {};
  const p = m.pharmacies  || {};
  const l = m.labs        || {};
  const e = m.employees   || {};
  const t = m.tickets     || {};
  const r = m.revenue     || {};

  return (
    <PageShell title="Mission Control" live>
      {/* Primary metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:10, marginBottom:18 }}>
        <MetricCard label="Active Hospitals"      value={fmt(h.active)}      color="#06b6d4"  sub={`${fmt(h.total)} total`} />
        <MetricCard label="Active Pharmacies"     value={fmt(p.active)}      color="#8b5cf6"  sub={`${fmt(p.total)} total`} />
        <MetricCard label="Active Labs"           value={fmt(l.active)}      color="#10b981"  sub={`${fmt(l.total)} total`} />
        <MetricCard label="Total Patients"        value={fmt(m.patients?.total)} color="#6366f1" sparkle="#818cf8" />
        <MetricCard label="Online Employees"      value={e.online ?? "—"}    color="#10b981"  sub={`${e.on_break ?? 0} on break`} />
        <MetricCard label="Open Tickets"          value={t.open ?? "—"}      color="#f59e0b"  sub={`${t.critical ?? 0} critical`} />
        <MetricCard label="Pending Verifications" value={fmt(m.verifications?.pending)} color="#f59e0b" />
        <MetricCard label="Failed Transactions"   value={m.failed_transactions ?? 0} color={m.failed_transactions > 5 ? "#f43f5e" : "#10b981"} />
        <MetricCard label="Revenue Today"         value={fmtC(r.today)}      color="#10b981"  sparkle="#10b981" />
        <MetricCard label="Revenue This Month"    value={fmtC(r.this_month)} color="#06b6d4"  sparkle="#06b6d4" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:14 }}>
        {/* System health */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16 }}>
          <div style={{ fontSize:10, color:"#475569", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>System Health</div>
          {health && Object.entries({
            "API Gateway":    health.database?.status,
            "Database":       health.database?.status,
            "Redis / Queue":  health.redis?.status,
            "WhatsApp":       health.whatsapp?.status,
            "SMS Gateway":    health.sms?.status,
            "Notifications":  health.notifications?.status,
            "AI Service":     health.ai_service?.status,
          }).map(([name, status]) => (
            <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:12, color:"#94a3b8" }}>{name}</span>
              <StatusDot status={status || "operational"} />
            </div>
          ))}
          {health && (
            <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:11, color:"#475569" }}>DB Latency</span>
                <span style={{ fontSize:12, color: health.database?.latency_ms > 100 ? "#f59e0b" : "#10b981", fontWeight:700 }}>
                  {health.database?.latency_ms ?? "—"}ms
                </span>
              </div>
              <ProgressBar value={300 - (health.database?.latency_ms || 0)} max={300} color="#10b981" />
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div style={{ background:"#0c1220", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ fontSize:10, color:"#475569", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>Live Activity Feed</div>
            <Pill label="LIVE" color="#10b981" />
          </div>
          {loading && <LoadingRows n={6} />}
          {!loading && feed.map((e, i) => (
            <div key={e.id || i} style={{
              padding:"7px 10px", borderRadius:7, marginBottom:2,
              borderLeft: i===0 ? "2px solid #6366f1" : "2px solid transparent",
              background: i===0 ? "rgba(99,102,241,0.05)" : "transparent",
            }}>
              <div style={{ fontSize:12, color: i===0 ? "#f1f5f9" : "#94a3b8" }}>{e.action} {e.entity_type && `— ${e.entity_type}`} {e.entity_name && `(${e.entity_name})`}</div>
              <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>{new Date(e.created_at).toLocaleTimeString()}</div>
            </div>
          ))}
          {!loading && !feed.length && <EmptyState msg="No recent activity" />}
        </div>
      </div>
    </PageShell>
  );
}
