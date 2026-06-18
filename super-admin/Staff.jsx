import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/apiClient';

const ROLE_COLORS = {
  doctor:     { bg: 'rgba(14,165,233,0.12)',  text: '#0ea5e9',  border: 'rgba(14,165,233,0.25)' },
  nurse:      { bg: 'rgba(20,184,166,0.12)',  text: '#14b8a6',  border: 'rgba(20,184,166,0.25)' },
  pharmacist: { bg: 'rgba(99,102,241,0.12)',  text: '#6366f1',  border: 'rgba(99,102,241,0.25)' },
  admin:      { bg: 'rgba(249,115,22,0.12)',  text: '#f97316',  border: 'rgba(249,115,22,0.25)' },
  lab:        { bg: 'rgba(234,179,8,0.12)',   text: '#eab308',  border: 'rgba(234,179,8,0.25)' },
};

const STATUS_COLORS = {
  active:     { text: '#22c55e', label: 'Active' },
  inactive:   { text: '#ef4444', label: 'Inactive' },
  on_leave:   { text: '#f59e0b', label: 'On Leave' },
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '0.875rem',
      padding: '1.25rem 1.5rem',
      borderTop: `2px solid ${accent}`,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f1f5f9', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

export default function Staff() {
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate                  = useNavigate();

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/api/v1/admin/staff');
        setStaff(res.data?.staff || res.data || []);
      } catch (err) {
        console.error('Failed to fetch staff:', err);
        setError('Failed to load staff data.');
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, []);

  const filtered = staff.filter(s => {
    const matchSearch = !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.hospital_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'all'   || s.role === roleFilter;
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const stats = {
    total:    staff.length,
    active:   staff.filter(s => s.status === 'active').length,
    doctors:  staff.filter(s => s.role === 'doctor').length,
    on_leave: staff.filter(s => s.status === 'on_leave').length,
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

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f1f5f9', margin: 0, letterSpacing: '-0.5px' }}>
          Staff Management
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.9rem' }}>
          All staff across the Hospyn hospital network
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Staff"  value={stats.total}    sub="Across all hospitals" accent="#0ea5e9" />
        <StatCard label="Active"       value={stats.active}   sub="Currently on duty"    accent="#22c55e" />
        <StatCard label="Doctors"      value={stats.doctors}  sub="Medical staff"        accent="#6366f1" />
        <StatCard label="On Leave"     value={stats.on_leave} sub="Temporarily away"     accent="#f59e0b" />
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
        marginBottom: '1.25rem', alignItems: 'center',
      }}>
        <input
          style={{ ...inputStyle, flex: '1', minWidth: '200px' }}
          placeholder="🔍  Search by name, email, hospital…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={inputStyle} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="admin">Admin</option>
          <option value="lab">Lab Tech</option>
        </select>
        <select style={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
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
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>Loading staff…</div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569' }}>No staff found matching your filters.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Name', 'Role', 'Hospital', 'Status', 'Joined', ''].map(h => (
                  <th key={h} style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.72rem', fontWeight: '700',
                    color: '#475569', textAlign: 'left',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const roleMeta   = ROLE_COLORS[s.role] || ROLE_COLORS.admin;
                const statusMeta = STATUS_COLORS[s.status] || { text: '#94a3b8', label: s.status };
                return (
                  <tr key={s.id || i} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.12s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '32px', height: '32px',
                          background: roleMeta.bg, border: `1px solid ${roleMeta.border}`,
                          borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: '700', color: roleMeta.text,
                          flexShrink: 0,
                        }}>
                          {(s.name || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#f1f5f9' }}>{s.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#475569' }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{
                        background: roleMeta.bg, border: `1px solid ${roleMeta.border}`,
                        color: roleMeta.text, borderRadius: '0.35rem',
                        padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: '600',
                        textTransform: 'capitalize',
                      }}>
                        {s.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                      {s.hospital_name || '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: statusMeta.text, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '0.8rem', color: statusMeta.text }}>{statusMeta.label}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <button
                        onClick={() => navigate(`/staff/${s.id}`)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#94a3b8', borderRadius: '0.4rem',
                          padding: '0.3rem 0.7rem', fontSize: '0.75rem',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        View →
                      </button>
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
