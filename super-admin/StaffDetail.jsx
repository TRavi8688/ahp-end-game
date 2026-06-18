import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../lib/apiClient';

function Section({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '0.875rem',
      padding: '1.25rem 1.5rem',
      marginBottom: '1rem',
    }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.8rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: '500' }}>{value || '—'}</div>
    </div>
  );
}

export default function StaffDetail() {
  const { id }              = useParams();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const navigate            = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/api/v1/admin/staff/${id}`);
        setMember(res.data);
      } catch (err) {
        console.error('Failed to load staff member:', err);
        setError('Could not load this staff member.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetch();
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#475569' }}>
      Loading…
    </div>
  );

  if (error || !member) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
      <div style={{ color: '#ef4444', fontSize: '0.95rem' }}>{error || 'Staff member not found.'}</div>
      <button onClick={() => navigate('/staff')} style={{
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#94a3b8', borderRadius: '0.5rem', padding: '0.5rem 1.25rem',
        cursor: 'pointer', fontFamily: 'inherit',
      }}>← Back to Staff</button>
    </div>
  );

  const ROLE_COLORS = {
    doctor:     '#0ea5e9',
    nurse:      '#14b8a6',
    pharmacist: '#6366f1',
    admin:      '#f97316',
    lab:        '#eab308',
  };
  const roleColor = ROLE_COLORS[member.role] || '#94a3b8';

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Back */}
      <button
        onClick={() => navigate('/staff')}
        style={{
          background: 'none', border: 'none', color: '#64748b',
          cursor: 'pointer', fontSize: '0.875rem', padding: '0',
          marginBottom: '1.25rem', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}
      >
        ← Back to Staff
      </button>

      {/* Profile header */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: '64px', height: '64px',
          background: `rgba(${roleColor === '#0ea5e9' ? '14,165,233' : '99,102,241'},0.15)`,
          border: `2px solid ${roleColor}33`,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', fontWeight: '800', color: roleColor,
          flexShrink: 0,
        }}>
          {(member.name || 'U').substring(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.3px' }}>
            {member.name}
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              background: `${roleColor}1a`, border: `1px solid ${roleColor}33`,
              color: roleColor, borderRadius: '0.35rem',
              padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'capitalize',
            }}>
              {member.role}
            </span>
            <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{member.email}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>Status</div>
          <div style={{
            color: member.status === 'active' ? '#22c55e' : member.status === 'on_leave' ? '#f59e0b' : '#ef4444',
            fontWeight: '700', fontSize: '0.9rem',
          }}>
            {member.status === 'active' ? '● Active' : member.status === 'on_leave' ? '● On Leave' : '● Inactive'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Section title="Personal Info">
          <Field label="Full Name"    value={member.name} />
          <Field label="Email"        value={member.email} />
          <Field label="Phone"        value={member.phone} />
          <Field label="Date Joined"  value={member.created_at ? new Date(member.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
        </Section>

        <Section title="Employment">
          <Field label="Role"          value={member.role} />
          <Field label="Department"    value={member.department} />
          <Field label="Hospital"      value={member.hospital_name} />
          <Field label="Employee ID"   value={member.employee_id || `EMP-${id}`} />
        </Section>
      </div>

      <Section title="Qualifications">
        <Field label="Specialization" value={member.specialization} />
        <Field label="Licence / Reg No." value={member.licence_number} />
        <Field label="Education"      value={member.education} />
      </Section>

      {/* Performance (if available) */}
      {member.performance && (
        <Section title="Performance Summary">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {Object.entries(member.performance).map(([k, v]) => (
              <div key={k} style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '0.5rem', padding: '0.75rem',
              }}>
                <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'capitalize', marginBottom: '0.2rem' }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontWeight: '700', color: '#f1f5f9' }}>{v}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
