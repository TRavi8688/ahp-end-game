import { useState, useEffect } from 'react';
import { Activity, LayoutDashboard, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function NurseVitals() {
  const user = useAuthStore((s) => s.user);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock fetching beds and admissions from /api/v1/admissions
    setTimeout(() => {
      setBeds([
        { id: 201, bed_number: 'ICU-01', status: 'OCCUPIED', patient_name: 'Sneha Patel', admitted_at: '2 hrs ago' },
        { id: 202, bed_number: 'GEN-12', status: 'TEMP_RESERVED', patient_name: 'Rahul Kumar', admitted_at: 'Just now' },
        { id: 203, bed_number: 'GEN-14', status: 'AVAILABLE' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const handleConfirmArrival = (bedId) => {
    alert(`Confirming patient arrival for bed ${bedId}. Moves status from TEMP_RESERVED to OCCUPIED.`);
    setBeds(prev => prev.map(b => b.id === bedId ? { ...b, status: 'OCCUPIED' } : b));
  };

  if (loading) return <div style={styles.page}><div className="spinner" /> Loading Ward Data...</div>;

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LayoutDashboard size={28} style={{ color: 'var(--color-brand)' }} />
          Ward Management
        </h1>
        <p className="text-secondary">Monitor bed allocations and confirm patient arrivals.</p>
      </div>

      <div style={styles.grid}>
        {beds.map((bed) => (
          <div key={bed.id} className="card" style={styles.bedCard}>
            <div style={styles.cardHeader}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{bed.bed_number}</h2>
              <div style={styles.badge(bed.status)}>
                {bed.status}
              </div>
            </div>

            {bed.status !== 'AVAILABLE' && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{bed.patient_name}</p>
                <span className="text-sm text-secondary">Admitted: {bed.admitted_at}</span>
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              {bed.status === 'TEMP_RESERVED' && (
                <button className="btn btn--primary" style={{ width: '100%' }} onClick={() => handleConfirmArrival(bed.id)}>
                  <Check size={16}/> Confirm Arrival
                </button>
              )}
              {bed.status === 'OCCUPIED' && (
                <button className="btn btn--ghost" style={{ width: '100%', color: 'var(--color-brand)' }}>
                  <Activity size={16}/> Record Vitals
                </button>
              )}
              {bed.status === 'AVAILABLE' && (
                <p className="text-sm text-secondary" style={{ textAlign: 'center', margin: 0 }}>Ready for Admission</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' },
  bedCard: { padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: (status) => ({
    fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '4px',
    background: status === 'AVAILABLE' ? 'var(--color-success-muted)' : 
                status === 'TEMP_RESERVED' ? 'var(--color-warning-muted)' : 'var(--color-danger-muted)',
    color: status === 'AVAILABLE' ? 'var(--color-success)' : 
           status === 'TEMP_RESERVED' ? '#ca8a04' : 'var(--color-danger)',
  })
};
