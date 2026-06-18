import { useState, useEffect, useMemo } from 'react';
import { Activity, LayoutDashboard, Thermometer, HeartPulse, Stethoscope, Droplets, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../apiClient';

export default function NurseVitals() {
  const user = useAuthStore((s) => s.user);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [activeWard, setActiveWard] = useState('All');
  
  // Vitals Form State
  const [vitalsForm, setVitalsForm] = useState({
    temperature: '',
    blood_pressure: '',
    heart_rate: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWardStatus();
  }, []);

  const fetchWardStatus = async () => {
    try {
      setLoading(true);
      // Real God-Mode data pull: Live telemetry from Ward Command Center
      const res = await apiClient.get('/ward/status');
      if (res.data && res.data.beds) {
        // Group and format real beds data
        const formattedBeds = res.data.beds.map(b => ({
          id: b.id, // Admission ID if occupied, or Bed ID
          bed_number: b.bed_number,
          status: b.status.toUpperCase(),
          patient_name: b.status.toUpperCase() === 'OCCUPIED' ? b.patient_name || 'Patient Admitted' : null,
          department_name: b.department_name || 'General Ward'
        }));
        setBeds(formattedBeds);
      }
    } catch (err) {
      console.error("Failed to load real ward data", err);
      // Fallback: don't crash the UI, show empty state if API fails
      setBeds([]); 
    } finally {
      setLoading(false);
    }
  };

  const handleRecordVitals = async (e) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    
    try {
      setSubmitting(true);
      // Real API Call: Write to Immutable Ledger
      await apiClient.post(`/admissions/${selectedAdmission}/vitals`, {
        temperature: parseFloat(vitalsForm.temperature),
        blood_pressure: vitalsForm.blood_pressure,
        heart_rate: parseInt(vitalsForm.heart_rate, 10)
      });
      alert('Vitals successfully recorded into the immutable ledger and synced to God Mode!');
      setSelectedAdmission(null);
      setVitalsForm({ temperature: '', blood_pressure: '', heart_rate: '' });
      fetchWardStatus(); // Refresh telemetry
    } catch (error) {
      console.error("Failed to post vitals", error);
      alert('Error recording vitals. Ensure the patient has an active admission record.');
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic Ward Matrix Logic
  const wards = useMemo(() => {
    const uniqueWards = new Set(beds.map(b => b.department_name));
    return ['All', ...Array.from(uniqueWards)];
  }, [beds]);

  const filteredBeds = useMemo(() => {
    if (activeWard === 'All') return beds;
    return beds.filter(b => b.department_name === activeWard);
  }, [beds, activeWard]);

  // Statistics
  const stats = useMemo(() => {
    const total = beds.length;
    const occupied = beds.filter(b => b.status === 'OCCUPIED').length;
    const available = beds.filter(b => b.status === 'AVAILABLE').length;
    const occupancyRate = total === 0 ? 0 : Math.round((occupied / total) * 100);
    return { total, occupied, available, occupancyRate };
  }, [beds]);

  if (loading) return (
    <div style={styles.page}>
      <div style={{ textAlign: 'center', marginTop: '20vh', color: '#64748b' }}>
        <Activity size={48} className="spin" style={{ color: 'var(--color-brand)', marginBottom: '1rem' }} />
        <h2>Synchronizing Live Ward Matrix...</h2>
        <p>Connecting to secure hospital telemetry network.</p>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0 0 0.5rem 0' }}>
            <LayoutDashboard size={32} style={{ color: 'var(--color-brand)' }} />
            Live Ward Matrix
          </h1>
          <p className="text-secondary" style={{ margin: 0 }}>
            Strict Zero-Mock telemetry. Vitals flow directly to Patient EHR and Owner Dashboard.
          </p>
        </div>

        {/* Global Statistics */}
        <div style={styles.statsContainer}>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Occupancy</span>
            <span style={{ ...styles.statValue, color: stats.occupancyRate > 80 ? 'var(--color-danger)' : 'var(--color-brand)' }}>
              {stats.occupancyRate}%
            </span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Occupied</span>
            <span style={styles.statValue}>{stats.occupied}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Available</span>
            <span style={styles.statValue}>{stats.available}</span>
          </div>
        </div>
      </div>

      {/* Ward Tabs */}
      <div style={styles.tabsContainer}>
        {wards.map(ward => (
          <button
            key={ward}
            onClick={() => setActiveWard(ward)}
            style={{
              ...styles.tab,
              ...(activeWard === ward ? styles.activeTab : {})
            }}
          >
            {ward}
            <span style={styles.tabBadge(activeWard === ward)}>
              {ward === 'All' ? beds.length : beds.filter(b => b.department_name === ward).length}
            </span>
          </button>
        ))}
      </div>

      {/* Matrix Grid */}
      <div style={styles.grid}>
        {filteredBeds.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '12px' }}>
            <Stethoscope size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#475569' }}>No beds found in {activeWard}</h3>
            <p style={{ color: '#94a3b8', margin: 0 }}>Configure departments and beds in the hospital setup module.</p>
          </div>
        ) : filteredBeds.map((bed) => (
          <div key={bed.bed_number} className="card" style={{
            ...styles.bedCard,
            borderTop: `4px solid ${bed.status === 'AVAILABLE' ? 'var(--color-success)' : 'var(--color-danger)'}`
          }}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{bed.bed_number}</h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{bed.department_name}</span>
              </div>
              <div style={styles.badge(bed.status)}>
                {bed.status === 'OCCUPIED' ? <Activity size={12} /> : <CheckCircle size={12} />}
                {bed.status}
              </div>
            </div>

            <div style={{ flex: 1, marginTop: '1.5rem' }}>
              {bed.status === 'OCCUPIED' ? (
                <div style={styles.patientInfo}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text-primary)' }}>{bed.patient_name}</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Active Admission</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Ready for Patient</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              {bed.status === 'OCCUPIED' ? (
                <button 
                  className="btn btn--primary" 
                  style={{ width: '100%', background: 'linear-gradient(to right, var(--color-brand), #4f46e5)', border: 'none' }}
                  onClick={() => setSelectedAdmission(bed.id)}
                >
                  <Activity size={16}/> Push Vitals <ArrowRight size={16} />
                </button>
              ) : (
                <div style={{ height: '38px' }} /> /* Placeholder for alignment */
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Vitals Entry Modal */}
      {selectedAdmission && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={24} style={{ color: 'var(--color-danger)' }} />
                Record Live Vitals
              </h2>
              <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                Data will be immutably recorded to the patient's timeline and God Mode telemetry.
              </p>
            </div>
            
            <form onSubmit={handleRecordVitals} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={styles.label}>Temperature (°C) *</label>
                <div style={styles.inputWrap}>
                  <Thermometer size={18} style={styles.icon}/>
                  <input required type="number" step="0.1" style={styles.input} value={vitalsForm.temperature} onChange={e => setVitalsForm({...vitalsForm, temperature: e.target.value})} placeholder="e.g. 37.5" />
                </div>
              </div>
              
              <div>
                <label style={styles.label}>Blood Pressure (mmHg) *</label>
                <div style={styles.inputWrap}>
                  <Droplets size={18} style={styles.icon}/>
                  <input required type="text" style={styles.input} value={vitalsForm.blood_pressure} onChange={e => setVitalsForm({...vitalsForm, blood_pressure: e.target.value})} placeholder="e.g. 120/80" pattern="\d{2,3}\/\d{2,3}" title="Format: SYS/DIA (e.g. 120/80)" />
                </div>
              </div>
              
              <div>
                <label style={styles.label}>Heart Rate (BPM) *</label>
                <div style={styles.inputWrap}>
                  <HeartPulse size={18} style={styles.icon}/>
                  <input required type="number" style={styles.input} value={vitalsForm.heart_rate} onChange={e => setVitalsForm({...vitalsForm, heart_rate: e.target.value})} placeholder="e.g. 72" />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setSelectedAdmission(null)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'Committing...' : 'Push to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple CheckCircle Icon for AVAILABLE status
const CheckCircle = ({ size, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const styles = {
  page: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
  statsContainer: { display: 'flex', gap: '1rem' },
  statBox: { background: 'white', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px' },
  statLabel: { fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0 0' },
  tabsContainer: { display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', overflowX: 'auto' },
  tab: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', background: 'none', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#64748b', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' },
  activeTab: { background: 'var(--color-brand)', color: 'white' },
  tabBadge: (active) => ({ background: active ? 'rgba(255,255,255,0.2)' : '#e2e8f0', color: active ? 'white' : '#475569', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem' }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' },
  bedCard: { padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: (status) => ({ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.6rem', borderRadius: '6px', background: status === 'AVAILABLE' ? 'var(--color-success-muted)' : 'var(--color-danger-muted)', color: status === 'AVAILABLE' ? 'var(--color-success)' : 'var(--color-danger)' }),
  patientInfo: { background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' },
  modal: { background: 'white', padding: '2.5rem', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
  modalHeader: { marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  icon: { position: 'absolute', left: '1rem', color: '#94a3b8' },
  input: { width: '100%', padding: '0.875rem 1rem 0.875rem 3rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', transition: 'border-color 0.2s' },
};
