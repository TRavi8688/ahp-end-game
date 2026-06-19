import { useState, useEffect } from 'react';
import { Users, Clock, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function DoctorQueue() {
  const user = useAuthStore((s) => s.user);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock fetching from /api/v1/queue (in a real app, use the api client)
  useEffect(() => {
    // Simulated fetch
    setTimeout(() => {
      setTokens([
        { id: 101, patient_name: 'Rahul Kumar', status: 'WAITING', priority_score: 160, is_emergency: true },
        { id: 102, patient_name: 'Sneha Patel', status: 'IN_PROGRESS', priority_score: 80, is_vip: true },
        { id: 103, patient_name: 'Amit Singh', status: 'WAITING', priority_score: 10 },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const handleStatusUpdate = (tokenId, newStatus) => {
    // optimistic update
    setTokens((prev) => prev.map(t => t.id === tokenId ? { ...t, status: newStatus } : t));
    // Here we would call the actual API: hospitalAPI.updateQueueStatus(tokenId, newStatus)
  };

  const handleAdmit = (tokenId) => {
    alert(`Triggering Admission Workflow for Token ${tokenId}. This moves the patient to TEMP_RESERVED bed status.`);
  };

  if (loading) return <div style={styles.page}><div className="spinner" /> Loading Queue...</div>;

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={28} style={{ color: 'var(--color-brand)' }} />
          Patient Queue
        </h1>
        <p className="text-secondary">Strictly ordered by priority score. Highest priority first.</p>
      </div>

      <div style={styles.grid}>
        {tokens.map((token) => (
          <div key={token.id} className="card" style={{ ...styles.tokenCard, borderLeft: token.is_emergency ? '4px solid var(--color-danger)' : '1px solid var(--color-border)' }}>
            
            <div style={styles.cardHeader}>
              <div>
                <h3 style={{ margin: 0 }}>{token.patient_name}</h3>
                <span className="text-sm text-secondary">Token #{token.id}</span>
              </div>
              <div style={styles.badge(token.status)}>
                {token.status}
              </div>
            </div>

            <div style={styles.scoreRow}>
              <div style={styles.scorePill(token.priority_score)}>
                Priority Score: {token.priority_score}
              </div>
              {token.is_emergency && <span style={{ color: 'var(--color-danger)', fontSize: '0.875rem', fontWeight: 600 }}><AlertTriangle size={14}/> EMERGENCY</span>}
            </div>

            <div style={styles.actions}>
              {token.status === 'WAITING' && (
                <button className="btn btn--primary btn--sm" onClick={() => handleStatusUpdate(token.id, 'IN_PROGRESS')}>
                  Call Patient <ArrowRight size={14} />
                </button>
              )}
              {token.status === 'IN_PROGRESS' && (
                <>
                  <button className="btn btn--ghost btn--sm" onClick={() => handleStatusUpdate(token.id, 'COMPLETED')} style={{ color: 'var(--color-success)' }}>
                    <CheckCircle2 size={14} /> Complete
                  </button>
                  <button className="btn btn--secondary btn--sm" onClick={() => handleAdmit(token.id)}>
                    [Admit] to Ward
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: '900px', margin: '0 auto' },
  grid: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  tokenCard: { padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: '1rem' },
  scorePill: (score) => ({
    background: score > 100 ? 'var(--color-danger-muted)' : 'var(--color-brand-muted)',
    color: score > 100 ? 'var(--color-danger)' : 'var(--color-brand)',
    padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 600,
  }),
  actions: { display: 'flex', gap: '0.75rem', marginTop: '0.5rem' },
  badge: (status) => ({
    fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '4px',
    background: status === 'WAITING' ? 'var(--color-bg-elevated)' : 'var(--color-brand-muted)',
    color: status === 'WAITING' ? 'var(--color-text-muted)' : 'var(--color-brand)',
    border: '1px solid var(--color-border)'
  })
};
