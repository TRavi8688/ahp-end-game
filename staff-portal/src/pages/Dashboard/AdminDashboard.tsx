import React, { useState, useEffect } from 'react';
import {
  Terminal, Globe,
  ChevronRight,
  Server, ShieldAlert, RefreshCw, AlertCircle,
} from 'lucide-react';
import apiClient from '../../apiClient';

interface Tenant {
  id: string;
  name: string;
  city: string;
  status: string;
  // NOTE: backend's HospitalResponse has no "slug" or "user_count" field —
  // those were invented. Using real fields only.
}

interface AuditLog {
  id: string;
  action: string;
  user_name: string | null;
  resource_type: string | null;
  ip_address: string | null;
  timestamp: string | null;
  // NOTE: backend's audit_logs rows have no "status" or "latency" field —
  // those (and the whole MOCK_LOGS fallback below) were fabricated to make
  // this look like a live security feed. Removed.
}

/**
 * FIXES:
 * 1. Removed all undefined CSS class names: glass-panel, glass-card-premium,
 *    btn-cyber, pulse-emergency — replaced with explicit Tailwind utility classes.
 * 2. Tenant list now fetched from /hospitals/ instead of being hardcoded —
 *    AND fixed the response unwrap: backend wraps as {success, data: {items, total,...}},
 *    so tenants live at d.data.items, not d.data directly (which is an object, not an array).
 * 3. Audit log fetched from /admin/audit-logs, same unwrap fix (d.data.logs not d.data).
 *    Removed the MOCK_LOGS fabrication entirely — a fabricated "live security feed"
 *    showing fake events ("Dr. Sharma", "JWT_RS256_VERIFY", "2ms") is actively
 *    misleading on what's supposed to be a real security console.
 * 4. /admin/audit-logs requires role "super_admin" specifically (see
 *    super_admin.py: `SuperAdmin = Annotated[TokenPayload, Depends(require_role("super_admin"))]`)
 *    but this whole page was only routed for role "admin" — meaning a real
 *    "admin" user would always get a 403 here. Broadened routing in
 *    App.tsx/Layout.tsx to include super_admin (see those files).
 * 5. Removed fabricated "security theater": hardcoded fake SHA256 hash, a
 *    "key rotation" button with no onClick handler at all, a hardcoded
 *    "Uptime: 99.99%", an invented "auto-scaling... +2 nodes" blurb, and a
 *    lockdown toggle pointing at /admin/security/lockdown — an endpoint
 *    that doesn't exist anywhere in the backend (confirmed). Shipping
 *    controls that look functional but silently do nothing (or 404) is
 *    worse than not having them — replaced with an honest "not yet built"
 *    panel instead.
 */
const AdminDashboard: React.FC = () => {
  const [tenants, setTenants]     = useState<Tenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const tRes = await apiClient.get('/hospitals/');
        setTenants(tRes.data?.data?.items ?? []);
      } catch {
        setError('Unable to load hospital tenants.');
      }
      try {
        const lRes = await apiClient.get('/admin/audit-logs');
        setAuditLogs(lRes.data?.data?.logs ?? []);
      } catch (err: any) {
        // Most likely cause: logged in as "admin" rather than "super_admin" —
        // this endpoint is super_admin-only on the backend.
        setAuditError(
          err.response?.status === 403
            ? 'Audit logs require Super Admin access.'
            : 'Unable to load audit logs.'
        );
      }
    };
    load();
  }, []);

  const panelBase = 'bg-white/[0.02] border border-white/5 rounded-3xl';

  return (
    <div className="min-h-screen p-6 space-y-8 text-slate-100">

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 text-sm font-bold">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <Server size={36} className="text-blue-500" />
            Infrastructure Console
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase">
            Platform Administration · Tenants &amp; Audit
          </p>
        </div>
      </div>

      {/* NOTE: removed the old "Telemetry" stat cards (API Latency / Database
          Load / Cluster CPU / WAF Protection). They read from useStore's
          systemStatus, which is only ever updated by a "SYSTEM_HEALTH"
          websocket message type — and the backend's websocket handler
          (ws_endpoint.py) never sends one. Those cards would have shown
          0ms/0%/0% forever, plus a hardcoded "WAF Protection: ACTIVE/100%"
          that isn't backed by anything. Flagging as a real backend gap
          rather than shipping permanently-zero numbers. */}
      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-amber-400 text-xs font-bold flex items-center gap-3">
        <AlertCircle size={16} className="flex-shrink-0" />
        Live infrastructure telemetry (latency, DB load, CPU) isn't wired to a real data source yet — removed rather than show permanent zeros.
      </div>

      <div className="grid grid-cols-12 gap-8">

        {/* Left — Audit + Tenants */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
              <Terminal size={20} className="text-blue-500" />
              Security Engine Audit Feed
            </h3>
          </div>

          <div className={`${panelBase} overflow-hidden`}>
            <div className="bg-slate-900/40 p-4 border-b border-white/5 grid grid-cols-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span>Action</span>
              <span>User</span>
              <span>Resource</span>
              <span className="text-right">When</span>
            </div>
            {auditError ? (
              <div className="p-8 text-center text-amber-400 text-xs font-bold">{auditError}</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-bold">No audit events recorded yet.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 grid grid-cols-4 items-center hover:bg-white/[0.02] transition-all font-mono text-xs">
                    <span className="text-blue-500 font-bold truncate">{log.action}</span>
                    <span className="text-slate-400 truncate">{log.user_name || '—'}</span>
                    <span className="text-slate-500 truncate">{log.resource_type || '—'}</span>
                    <span className="text-right text-slate-500 font-bold">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tenants */}
          <div className="space-y-4">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
              <Globe size={20} className="text-blue-500" />
              Active Hospital Tenants
            </h3>
            {tenants.length === 0 ? (
              <div className={`${panelBase} p-8 text-center text-slate-500 text-sm`}>No tenants loaded.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tenants.map((t, i) => (
                  <div key={t.id ?? i} className={`${panelBase} p-6 flex justify-between items-center`}>
                    <div className="space-y-1">
                      <h4 className="font-black text-white uppercase tracking-tight">{t.name}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                        {t.city}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">{t.status ?? 'Active'}</span>
                      <div className="p-2 rounded-lg bg-slate-900">
                        <ChevronRight size={16} className="text-slate-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Keys + Lockdown */}
        <div className="col-span-12 lg:col-span-4 space-y-8">

          {/* NOTE: removed three fabricated panels here:
              1. "Cryptographic Control" — hardcoded fake SHA256 hash and an
                 "Initiate Key Rotation" button with no onClick handler at all.
              2. "Security Lockdown" toggle — pointed at /admin/security/lockdown,
                 an endpoint that does not exist anywhere in the backend
                 (confirmed). A toggle that claims to "instantly revoke all
                 JWT tokens and block incoming traffic" but actually just
                 404s is worse than not having the feature — it could give
                 a real admin false confidence during an actual incident.
              3. "SRE Automation Insight" — a hardcoded, invented blurb
                 about an auto-scaling event that never happened.
              All three are real features worth building properly later —
              flagging clearly rather than shipping non-functional theater. */}
          <div className={`${panelBase} p-6 space-y-3`}>
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-slate-500" size={20} />
              <h3 className="font-black uppercase tracking-tighter text-sm text-slate-400">Security Controls</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Key rotation and emergency lockdown aren't wired to the backend yet —
              removed the controls rather than ship ones that look functional but
              don't actually do anything.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
