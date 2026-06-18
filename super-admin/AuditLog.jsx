import { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/apiClient';

const ACTION_COLORS = {
  CREATE: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' },
  UPDATE: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.2)' },
  DELETE: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)' },
  LOGIN:  { color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.2)' },
  LOGOUT: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
  VIEW:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)' },
  EXPORT: { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.2)' },
};

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.5rem',
  color: '#f1f5f9',
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  outline: 'none',
};

export default function AuditLog() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [search, setSearch]     = useState('');
  const [action, setAction]     = useState('all');
  const [resource, setResource] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page,
        limit: PAGE_SIZE,
        ...(search   && { search }),
        ...(action !== 'all'   && { action }),
        ...(resource !== 'all' && { resource_type: resource }),
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo   && { to: dateTo }),
      });
      const res = await apiClient.get(`/api/v1/admin/audit-log?${params}`);
      setLogs(res.data?.logs || res.data || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error('AuditLog load error:', err);
      setError('Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }, [page, search, action, resource, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f1f5f9', margin: 0, letterSpacing: '-0.5px' }}>
          Audit Log
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.9rem' }}>
          Complete tamper-evident log of all admin and system actions
        </p>
      </div>

      {/* Summary strip */}
      <div style={{
        display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem',
      }}>
        {['CREATE','UPDATE','DELETE','LOGIN','VIEW','EXPORT'].map(a => {
          const c = ACTION_COLORS[a] || ACTION_COLORS.VIEW;
          const count = logs.filter(l => (l.action || '').toUpperCase() === a).length;
          return (
            <div key={a} style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: '0.5rem', padding: '0.35rem 0.75rem',
              fontSize: '0.75rem', color: c.color, fontWeight: '700',
            }}>
              {a} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: '0.8rem', color: '#475569', alignSelf: 'center' }}>
          {total.toLocaleString()} total entries
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: '180px' }}
          placeholder="🔍  Search actor, resource, IP…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select style={inputStyle} value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
          <option value="all">All Actions</option>
          {['CREATE','UPDATE','DELETE','LOGIN','LOGOUT','VIEW','EXPORT'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select style={inputStyle} value={resource} onChange={e => { setResource(e.target.value); setPage(1); }}>
          <option value="all">All Resources</option>
          {['hospital','staff','patient','billing','compliance','settings','iam'].map(r => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
        <input style={inputStyle} type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} title="From date" />
        <input style={inputStyle} type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value); setPage(1); }} title="To date" />
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '0.875rem',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>Loading audit log…</div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>No audit entries found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Timestamp', 'Action', 'Actor', 'Resource', 'IP Address', 'Outcome'].map(h => (
                  <th key={h} style={{
                    padding: '0.75rem 1rem', textAlign: 'left',
                    fontSize: '0.72rem', fontWeight: '700', color: '#475569',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const actionKey = (log.action || '').toUpperCase();
                const ac = ACTION_COLORS[actionKey] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' };
                const success = log.outcome === 'success' || log.outcome === undefined;
                return (
                  <tr key={log.id || i}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        background: ac.bg, border: `1px solid ${ac.border}`,
                        color: ac.color, borderRadius: '0.3rem',
                        padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: '700',
                      }}>
                        {log.action || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: '500' }}>{log.actor_name || log.actor_id || '—'}</div>
                      <div style={{ color: '#475569', fontSize: '0.72rem' }}>{log.actor_role}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {log.resource_type && log.resource_id ? `${log.resource_type}/${log.resource_id}` : log.resource_type || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {log.ip_address || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        color: success ? '#22c55e' : '#ef4444',
                        fontSize: '0.78rem', fontWeight: '600',
                      }}>
                        {success ? '✓ Success' : '✗ Failed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: page === 1 ? '#334155' : '#94a3b8', borderRadius: '0.4rem',
              padding: '0.4rem 0.9rem', cursor: page === 1 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontSize: '0.85rem',
            }}
          >← Prev</button>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: page === totalPages ? '#334155' : '#94a3b8', borderRadius: '0.4rem',
              padding: '0.4rem 0.9rem', cursor: page === totalPages ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontSize: '0.85rem',
            }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
