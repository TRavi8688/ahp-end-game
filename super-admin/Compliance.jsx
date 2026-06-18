import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

const SEVERITY = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: '🔴' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', icon: '🟠' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: '🟡' },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.2)', icon: '🟢' },
  info:     { color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.2)', icon: '🔵' },
};

function ComplianceBadge({ score }) {
  const color = score >= 90 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${(score / 100) * 125.7} 125.7`}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
        <text x="24" y="28" textAnchor="middle" fill={color} fontSize="11" fontWeight="800">{score}%</text>
      </svg>
    </div>
  );
}

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

export default function Compliance() {
  const [logs, setLogs]         = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [severity, setSeverity] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [logsRes, summaryRes] = await Promise.all([
          apiClient.get('/api/v1/admin/compliance/logs'),
          apiClient.get('/api/v1/admin/compliance/summary'),
        ]);
        setLogs(logsRes.data?.logs || logsRes.data || []);
        setSummary(summaryRes.data || null);
      } catch (err) {
        console.error('Compliance load error:', err);
        setError('Failed to load compliance data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = severity === 'all' ? logs : logs.filter(l => l.severity === severity);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f1f5f9', margin: 0, letterSpacing: '-0.5px' }}>
          Compliance & DPDP
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.9rem' }}>
          Digital Personal Data Protection Act audit trail and compliance monitoring
        </p>
      </div>

      {/* Compliance score cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          {[
            { label: 'DPDP Score',        score: summary.dpdp_score,        sub: 'Data Privacy'  },
            { label: 'Data Consent',      score: summary.consent_score,     sub: 'Patient Consent' },
            { label: 'Access Control',    score: summary.access_score,      sub: 'Role Enforcement' },
            { label: 'Audit Coverage',    score: summary.audit_score,       sub: 'Log Completeness' },
          ].map(c => (
            <div key={c.label} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '0.875rem',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <ComplianceBadge score={c.score || 0} />
              <div>
                <div style={{ fontWeight: '700', color: '#f1f5f9', fontSize: '0.9rem' }}>{c.label}</div>
                <div style={{ color: '#475569', fontSize: '0.75rem' }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue counts */}
      {summary?.issues && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          {Object.entries(SEVERITY).map(([key, meta]) => (
            <div key={key} style={{
              background: meta.bg,
              border: `1px solid ${meta.border}`,
              borderRadius: '0.75rem',
              padding: '0.875rem 1rem',
            }}>
              <div style={{ fontSize: '0.7rem', color: meta.color, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: '700' }}>
                {meta.icon} {key}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#f1f5f9', lineHeight: 1.2 }}>
                {summary.issues[key] || 0}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <select style={inputStyle} value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="all">All Severities</option>
          {Object.keys(SEVERITY).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Audit log table */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '0.875rem',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>Loading compliance logs…</div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>No compliance events found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Severity', 'Event', 'Actor', 'Resource', 'Hospital', 'Timestamp'].map(h => (
                  <th key={h} style={{
                    padding: '0.75rem 1rem', textAlign: 'left',
                    fontSize: '0.72rem', fontWeight: '700', color: '#475569',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const s = SEVERITY[log.severity] || SEVERITY.info;
                return (
                  <tr key={log.id || i}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        background: s.bg, border: `1px solid ${s.border}`,
                        color: s.color, borderRadius: '0.35rem',
                        padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase',
                      }}>
                        {s.icon} {log.severity}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#e2e8f0', fontSize: '0.85rem', maxWidth: '200px' }}>
                      <div style={{ fontWeight: '600' }}>{log.event_type || log.action}</div>
                      {log.description && (
                        <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                      {log.actor_name || log.actor_id || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                      {log.resource_type ? `${log.resource_type}:${log.resource_id}` : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                      {log.hospital_name || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
