/**
 * Hospital Setup Wizard
 *
 * A 3-step onboarding wizard for hospital admins.
 * Step 1: Hospital Profile (name, registration number)
 * Step 2: Infrastructure (bed count, zone type)
 * Step 3: Review & Submit (sends to /api/v1/hospital with Idempotency-Key)
 *
 * Architecture rules followed:
 *  - Idempotency-Key is generated once (UUID v4) and stored in component state.
 *    Re-submitting the same form sends the same key — safe against double-tap.
 *  - Error responses are rendered using the StandardErrorSchema shape.
 *  - Backend is the source of truth — frontend does NOT redirect based on JWT alone.
 */
import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Building2, Layers, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { hospitalAPI } from '../api/client';

// --- Validation Schemas (per step) ---
const step1Schema = z.object({
  name: z.string().min(3, 'Hospital name must be at least 3 characters'),
  registration_number: z.string().min(3, 'Registration number is required'),
});

const step2Schema = z.object({
  has_beds: z.enum(['yes', 'no'], { required_error: 'Please select one' }),
  initial_zone_name: z.string().optional(),
});

const STEPS = [
  { id: 1, label: 'Hospital Profile', icon: Building2 },
  { id: 2, label: 'Infrastructure',   icon: Layers },
  { id: 3, label: 'Review',           icon: CheckCircle2 },
];

export default function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Idempotency key generated once per wizard session
  const idempotencyKey = useRef(crypto.randomUUID());

  const step1Form = useForm({ resolver: zodResolver(step1Schema) });
  const step2Form = useForm({ resolver: zodResolver(step2Schema) });

  const goNext = (data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    setApiError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        registration_number: formData.registration_number,
        subscription_status: 'active',
      };
      await hospitalAPI.create(payload, idempotencyKey.current);

      // After hospital is created, navigate to the admin dashboard
      navigate('/dashboard/admin');
    } catch (err) {
      setApiError(err.message || 'Setup failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.glow} />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>AHP Staff Portal</span>
        </div>

        <div className="card" style={styles.card}>
          <h2 style={{ marginBottom: '0.375rem' }}>Set up your hospital</h2>
          <p className="text-sm text-secondary" style={{ marginBottom: '2rem' }}>
            This takes about 60 seconds. You can always edit these details later.
          </p>

          {/* Step Indicator */}
          <div className="step-bar" style={{ marginBottom: '2.5rem' }}>
            {STEPS.map((s, i) => (
              <>
                <div key={s.id} className={`step ${step === s.id ? 'active' : step > s.id ? 'done' : ''}`}>
                  <div className="step-dot">
                    {step > s.id ? '✓' : s.id}
                  </div>
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div key={`div-${s.id}`} className="step-divider" />}
              </>
            ))}
          </div>

          {/* Step 1: Hospital Profile */}
          {step === 1 && (
            <form onSubmit={step1Form.handleSubmit(goNext)} style={styles.form}>
              <div className="form-group">
                <label className="form-label">Hospital / Clinic Name</label>
                <input
                  {...step1Form.register('name')}
                  className={`form-input ${step1Form.formState.errors.name ? 'error' : ''}`}
                  placeholder="e.g. Apollo Hospitals, Chennai"
                />
                {step1Form.formState.errors.name && (
                  <span className="form-error">
                    <AlertCircle size={12}/>{step1Form.formState.errors.name.message}
                  </span>
                )}
                <span className="form-hint">Use the official registered name of your facility</span>
              </div>

              <div className="form-group">
                <label className="form-label">Government Registration Number</label>
                <input
                  {...step1Form.register('registration_number')}
                  className={`form-input ${step1Form.formState.errors.registration_number ? 'error' : ''}`}
                  placeholder="e.g. MH-HOS-2024-00123"
                />
                {step1Form.formState.errors.registration_number && (
                  <span className="form-error">
                    <AlertCircle size={12}/>{step1Form.formState.errors.registration_number.message}
                  </span>
                )}
                <span className="form-hint">This is used for identity verification. It won't be public.</span>
              </div>

              <div style={styles.actions}>
                <span />
                <button type="submit" className="btn btn--primary">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Infrastructure */}
          {step === 2 && (
            <form onSubmit={step2Form.handleSubmit(goNext)} style={styles.form}>
              <div className="form-group">
                <label className="form-label">Does your facility have inpatient beds?</label>
                <div style={styles.optionGroup}>
                  {[
                    { value: 'no',  label: 'No',  sub: 'Clinic or outpatient only' },
                    { value: 'yes', label: 'Yes', sub: 'Hospital with admitted patients' },
                  ].map(({ value, label, sub }) => (
                    <label key={value} style={styles.optionCard(step2Form.watch('has_beds') === value)}>
                      <input
                        {...step2Form.register('has_beds')}
                        type="radio" value={value}
                        style={{ display: 'none' }}
                      />
                      <span style={{ fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{sub}</span>
                    </label>
                  ))}
                </div>
                {step2Form.formState.errors.has_beds && (
                  <span className="form-error"><AlertCircle size={12}/> Please select an option</span>
                )}
              </div>

              {step2Form.watch('has_beds') === 'yes' && (
                <div className="form-group">
                  <label className="form-label">Name your first ward/zone (optional)</label>
                  <input
                    {...step2Form.register('initial_zone_name')}
                    className="form-input"
                    placeholder="e.g. General Ward, ICU Wing A"
                  />
                  <span className="form-hint">You can add more zones from your dashboard later.</span>
                </div>
              )}

              <div style={styles.actions}>
                <button type="button" className="btn btn--ghost" onClick={goBack}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" className="btn btn--primary">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div style={styles.form}>
              <div style={styles.reviewBox}>
                <ReviewRow label="Hospital Name" value={formData.name} />
                <ReviewRow label="Registration No." value={formData.registration_number} />
                <ReviewRow
                  label="Inpatient Beds"
                  value={formData.has_beds === 'yes' ? 'Yes' : 'No (Outpatient Only)'}
                />
                {formData.initial_zone_name && (
                  <ReviewRow label="First Zone" value={formData.initial_zone_name} />
                )}
              </div>

              {apiError && (
                <div style={styles.errorBanner}>
                  <AlertCircle size={16} />
                  <span>{apiError}</span>
                </div>
              )}

              <div style={{ ...styles.actions, marginTop: '1.5rem' }}>
                <button type="button" className="btn btn--ghost" onClick={goBack} disabled={isSubmitting}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? <><div className="spinner" />Creating hospital...</>
                    : <><CheckCircle2 size={16} />Confirm & Launch</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '1.5rem', position: 'relative',
  },
  glow: {
    position: 'fixed', inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  container: { width: '100%', maxWidth: '580px', position: 'relative', zIndex: 1 },
  header: {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    marginBottom: '1.5rem',
  },
  logoMark: {
    width: '34px', height: '34px', borderRadius: '9px',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: { padding: '2.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  optionGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' },
  optionCard: (selected) => ({
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
    border: `2px solid ${selected ? 'var(--color-brand)' : 'var(--color-border)'}`,
    background: selected ? 'var(--color-brand-muted)' : 'var(--color-bg-elevated)',
    transition: 'all 200ms ease',
  }),
  reviewBox: {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.25rem 1.25rem',
    display: 'flex', flexDirection: 'column',
    divideY: '1px solid var(--color-border)',
  },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'var(--color-danger-muted)', color: 'var(--color-danger)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem', fontSize: '0.875rem',
  },
};
