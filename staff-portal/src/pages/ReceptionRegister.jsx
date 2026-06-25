import { useState } from 'react';
import { UserPlus, LayoutDashboard, Stethoscope, Phone, Clock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../apiClient';

export default function ReceptionRegister() {
  const user = useAuthStore((s) => s.user);
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    age: '',
    reason: ''
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [lastRegistered, setLastRegistered] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      // Get the hospital ID for this receptionist. 
      // Fallback to a query parameter or context if tenantId isn't directly on user.
      const hospitalId = user?.tenantId || user?.hospital_id;
      
      if (!hospitalId) {
        alert("Error: Your receptionist account is not linked to a hospital tenant.");
        setSubmitting(false);
        return;
      }

      const payload = {
        hospital_id: hospitalId,
        name: form.name,
        phone: form.phone,
        age: parseInt(form.age, 10),
        reason: form.reason
      };
      
      // Use the quick-register endpoint which creates the shadow patient & queue entry
      const res = await apiClient.post('/visit/public/quick-register', payload);
      
      setLastRegistered({
        name: form.name,
        hospyn_id: res.data.hospyn_id,
        patient_id: res.data.patient_id
      });
      
      alert('Walk-in patient successfully registered and added to the Doctor queue!');
      setForm({ name: '', phone: '', age: '', reason: '' });
      
    } catch (error) {
      console.error("Registration failed", error);
      alert('Error registering patient. Please ensure all fields are correct.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <UserPlus size={28} style={{ color: 'var(--color-brand)' }} />
          Walk-In Registration (Reception)
        </h1>
        <p className="text-secondary" style={{margin: '0.5rem 0 0 0'}}>
          Register new patients. They will be immediately routed to the doctor's queue.
        </p>
      </div>

      <div style={styles.grid}>
        <div className="card" style={styles.card}>
          <h2 style={{marginTop: 0}}>New Patient Details</h2>
          <form onSubmit={handleRegister} style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
            
            <div>
              <label style={styles.label}>Patient Full Name</label>
              <div style={styles.inputWrap}>
                <UserPlus size={18} style={styles.icon}/>
                <input required type="text" style={styles.input} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Rahul Sharma" />
              </div>
            </div>
            
            <div style={{display: 'flex', gap: '1rem'}}>
              <div style={{flex: 2}}>
                <label style={styles.label}>Mobile Number</label>
                <div style={styles.inputWrap}>
                  <Phone size={18} style={styles.icon}/>
                  <input required type="tel" style={styles.input} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="9876543210" />
                </div>
              </div>
              <div style={{flex: 1}}>
                <label style={styles.label}>Age</label>
                <input required type="number" style={styles.input_no_icon} value={form.age} onChange={e => setForm({...form, age: e.target.value})} placeholder="34" />
              </div>
            </div>
            
            <div>
              <label style={styles.label}>Reason for Visit (Symptoms)</label>
              <div style={styles.inputWrap}>
                <Stethoscope size={18} style={styles.icon}/>
                <input required type="text" style={styles.input} value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="High fever and cough for 2 days" />
              </div>
            </div>
            
            <button type="submit" className="btn btn--primary" style={{marginTop: '0.5rem', padding: '1rem'}} disabled={submitting}>
              {submitting ? 'Registering Patient...' : 'Register & Assign to Queue'}
            </button>
          </form>
        </div>

        <div>
          <div className="card" style={{...styles.card, background: 'var(--color-bg-surface)'}}>
            <h3 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <Clock size={20} style={{color: 'var(--color-brand)'}}/>
              Recent Registration
            </h3>
            
            {lastRegistered ? (
              <div style={{padding: '1rem', background: 'var(--color-success-muted)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)'}}>
                <p style={{margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--color-success)'}}>Success! Patient Queued.</p>
                <p style={{margin: '0.25rem 0'}}><strong>Name:</strong> {lastRegistered.name}</p>
                <p style={{margin: '0.25rem 0'}}><strong>Hospain ID:</strong> <span style={{fontFamily: 'monospace', background: 'white', padding: '0.1rem 0.3rem', borderRadius: '4px'}}>{lastRegistered.hospyn_id}</span></p>
              </div>
            ) : (
              <p className="text-secondary" style={{fontSize: '0.9rem'}}>No patients registered in this session.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
  grid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' },
  card: { padding: '2rem' },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  icon: { position: 'absolute', left: '1rem', color: '#94a3b8' },
  input: { width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem' },
  input_no_icon: { width: '100%', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem' }
};
