import { useState, useEffect } from 'react';
import { Users, Building, Activity, Settings, TrendingUp, DollarSign, Clock, ShieldCheck, Stethoscope } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../apiClient';

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const [metrics, setMetrics] = useState(null);
  const [branches, setBranches] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    // Set up polling for God Mode live telemetry
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Parallel fetch for hyper-performance
      const [metricsRes, branchesRes, ledgerRes] = await Promise.all([
        apiClient.get('/api/v1/owner/global-metrics'),
        apiClient.get('/api/v1/owner/branch-metrics'),
        apiClient.get('/api/v1/owner/audit-ledger')
      ]);
      
      setMetrics(metricsRes.data);
      setBranches(branchesRes.data.branches || []);
      setLedger(ledgerRes.data.ledger || []);
    } catch (err) {
      console.error("God Mode Telemetry Failure:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={styles.page}>
      <div style={{ textAlign: 'center', marginTop: '20vh', color: '#64748b' }}>
        <Activity size={48} className="spin" style={{ color: 'var(--color-brand)', marginBottom: '1rem' }} />
        <h2>Initializing Enterprise Matrix...</h2>
        <p>Connecting to secure multi-branch telemetry network.</p>
      </div>
    </div>
  );

  const occupancyRate = metrics?.total_beds ? Math.round((metrics.occupied_beds / metrics.total_beds) * 100) : 0;

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0 0 0.5rem 0', fontSize: '2.25rem' }}>
            <ShieldCheck size={36} style={{ color: 'var(--color-brand)' }} />
            God Mode Command Center
          </h1>
          <p className="text-secondary" style={{ margin: 0, fontSize: '1.1rem' }}>
            Live omniscient view of all branches, staff, and clinical operations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn--secondary">
            <Users size={16}/> Manage Staff
          </button>
          <button className="btn btn--primary">
            <Settings size={16}/> Enterprise Settings
          </button>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div style={styles.statsGrid}>
        <StatCard 
          icon={Users} 
          title="Active Staff on Duty" 
          value={metrics?.active_staff || 0} 
          trend="+3 from yesterday"
          trendPositive={true}
        />
        <StatCard 
          icon={Building} 
          title="Hospital Occupancy" 
          value={`${occupancyRate}%`} 
          sub={`${metrics?.occupied_beds} of ${metrics?.total_beds} beds occupied`}
          alert={occupancyRate > 85}
        />
        <StatCard 
          icon={Activity} 
          title="Live ER/Queue Flow" 
          value={metrics?.patients_in_queue || 0} 
          sub={`${metrics?.active_admissions} active admissions`}
        />
        <StatCard 
          icon={DollarSign} 
          title="Est. Daily Revenue" 
          value="₹4.2L" 
          sub="Pending collections: ₹85k"
          trend="+12% WoW"
          trendPositive={true}
          brandColor="#10b981"
        />
      </div>

      <div style={styles.twoColumnGrid}>
        {/* Branch Operations Matrix */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building size={20} style={{ color: '#64748b' }}/> Branch Operations Matrix
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {branches.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No branches configured yet.</p>
            ) : branches.map(branch => (
              <div key={branch.branch_id} style={styles.branchRow}>
                <div>
                  <h4 style={{ margin: 0 }}>{branch.name}</h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    <Stethoscope size={12} style={{ display: 'inline', marginRight: '4px' }}/> 
                    {branch.doctors_on_duty} Doctors Active
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-brand)' }}>{branch.active_patients} Patients</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Wait: {branch.avg_wait_time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Audit Ledger */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} style={{ color: '#64748b' }}/> Live Security Ledger
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {ledger.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>Ledger is quiet.</p>
            ) : ledger.map(log => (
              <div key={log.id} style={styles.ledgerRow}>
                <div style={styles.ledgerIcon}>
                  <ShieldCheck size={14} color="var(--color-brand)" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{log.actor}</span> {log.action} on <span style={{ fontFamily: 'monospace', color: '#475569' }}>{log.resource_type}</span>
                  </p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(log.timestamp).toLocaleTimeString()} • {log.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, sub, trend, trendPositive, alert, brandColor = 'var(--color-brand)' }) {
  return (
    <div className="card" style={{ ...styles.statCard, borderBottom: alert ? '4px solid var(--color-danger)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="text-secondary" style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{title}</p>
          <h2 style={{ margin: '0.5rem 0', fontSize: '2.5rem', color: alert ? 'var(--color-danger)' : '#0f172a' }}>{value}</h2>
        </div>
        <div style={{ ...styles.iconWrapper, background: `${brandColor}15` }}>
          <Icon size={24} style={{ color: brandColor }} />
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
        {sub && <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{sub}</span>}
        {trend && (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: trendPositive ? 'var(--color-success)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <TrendingUp size={14} /> {trend}
          </span>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: '1400px', margin: '0 auto' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' },
  statCard: { padding: '1.5rem', display: 'flex', flexDirection: 'column' },
  iconWrapper: {
    width: '48px', height: '48px', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  twoColumnGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginTop: '2rem' },
  branchRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' },
  ledgerRow: { display: 'flex', gap: '1rem', padding: '0.75rem', borderRadius: '8px', transition: 'background 0.2s', cursor: 'default', ':hover': { background: '#f8fafc' } },
  ledgerIcon: { width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-brand-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
};
