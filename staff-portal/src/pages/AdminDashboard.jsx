import { useState, useEffect } from 'react';
import { Users, Building, Activity, Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Mock fetching stats
    setTimeout(() => {
      setStats({
        active_staff: 14,
        total_beds: 50,
        occupied_beds: 32,
        patients_in_queue: 18
      });
    }, 600);
  }, []);

  if (!stats) return <div style={styles.page}><div className="spinner" /> Loading Stats...</div>;

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building size={28} style={{ color: 'var(--color-brand)' }} />
          Hospital Administration
        </h1>
        <p className="text-secondary">Overview of hospital capacity and staff.</p>
      </div>

      <div style={styles.statsGrid}>
        <StatCard icon={Users} title="Active Staff" value={stats.active_staff} />
        <StatCard icon={Building} title="Available Beds" value={stats.total_beds - stats.occupied_beds} sub={`${stats.occupied_beds} occupied`} />
        <StatCard icon={Activity} title="Patients in Queue" value={stats.patients_in_queue} />
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn--secondary">
            <Users size={16}/> Invite Staff Member
          </button>
          <button className="btn btn--ghost">
            <Settings size={16}/> Hospital Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, sub }) {
  return (
    <div className="card" style={styles.statCard}>
      <div style={styles.iconWrapper}>
        <Icon size={24} style={{ color: 'var(--color-brand)' }} />
      </div>
      <div>
        <p className="text-secondary" style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500 }}>{title}</p>
        <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '2rem' }}>{value}</h2>
        {sub && <p className="text-sm text-secondary" style={{ margin: '0.25rem 0 0 0' }}>{sub}</p>}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' },
  statCard: { display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem' },
  iconWrapper: {
    width: '48px', height: '48px', borderRadius: '12px',
    background: 'var(--color-brand-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }
};
