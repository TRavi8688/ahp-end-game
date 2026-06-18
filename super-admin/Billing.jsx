import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';

const STATUS_STYLE = {
  paid:    { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' },
  pending: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)' },
  overdue: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)' },
  refunded:{ color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.2)' },
};

function StatCard({ label, value, sub, accent, prefix = '₹' }) {
  const isPlain = !prefix || value === undefined;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '0.875rem',
      padding: '1.25rem 1.5rem',
      borderTop: `2px solid ${accent}`,
    }}>
      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: '800', color: '#f1f5f9', lineHeight: 1 }}>
        {isPlain ? value : `${prefix}${Number(value || 0).toLocaleString('en-IN')}`}
      </div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{sub}</div>}
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

export default function Billing() {
  const [invoices, setInvoices]     = useState([]);
  const [stats, setStats]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]         = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [invRes, statsRes] = await Promise.all([
          apiClient.get('/api/v1/admin/billing/invoices'),
          apiClient.get('/api/v1/admin/billing/stats'),
        ]);
        setInvoices(invRes.data?.invoices || invRes.data || []);
        setStats(statsRes.data || {});
      } catch (err) {
        console.error('Billing load error:', err);
        setError('Failed to load billing data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchSearch = !search ||
      inv.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.hospital_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f1f5f9', margin: 0, letterSpacing: '-0.5px' }}>
          Billing & Payments
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.9rem' }}>
          Network-wide invoice and revenue tracking
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Revenue"    value={stats.total_revenue}    sub="All time"          accent="#22c55e" />
        <StatCard label="This Month"       value={stats.monthly_revenue}  sub="MTD"               accent="#0ea5e9" />
        <StatCard label="Pending"          value={stats.pending_amount}   sub="Awaiting payment"  accent="#f59e0b" />
        <StatCard label="Overdue"          value={stats.overdue_amount}   sub="Action needed"     accent="#ef4444" />
        <StatCard label="Total Invoices"   value={stats.total_invoices}   sub="All time"          accent="#6366f1" prefix="" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
          placeholder="🔍  Search invoice no., patient, hospital…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '0.875rem',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>Loading invoices…</div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>No invoices match.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Invoice #', 'Patient', 'Hospital', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '0.75rem 1rem', textAlign: 'left',
                    fontSize: '0.72rem', fontWeight: '700',
                    color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => {
                const s = STATUS_STYLE[inv.status] || STATUS_STYLE.pending;
                return (
                  <tr key={inv.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>
                      {inv.invoice_number || `INV-${String(inv.id).padStart(6, '0')}`}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#e2e8f0', fontWeight: '500', fontSize: '0.875rem' }}>
                      {inv.patient_name || '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                      {inv.hospital_name || '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#f1f5f9', fontWeight: '700', fontSize: '0.9rem' }}>
                      ₹{Number(inv.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{
                        background: s.bg, border: `1px solid ${s.border}`,
                        color: s.color, borderRadius: '0.35rem',
                        padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: '600', textTransform: 'capitalize',
                      }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-IN') : '—'}
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
