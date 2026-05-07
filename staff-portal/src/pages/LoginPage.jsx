import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { authAPI } from '../api/client';
import { useAuthStore } from '../stores/authStore';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [apiError, setApiError] = useState(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async ({ email, password }) => {
    setApiError(null);
    try {
      const res = await authAPI.login(email, password);
      setAuth(res.data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setApiError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.background} />
      <div className="card" style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={styles.logoText}>AHP Staff Portal</span>
        </div>

        <h1 style={styles.title}>Welcome back</h1>
        <p className="text-secondary text-sm mt-2" style={{ marginBottom: '2rem' }}>
          Sign in to access your hospital dashboard
        </p>

        {apiError && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} />
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <div style={styles.inputWrapper}>
              <Mail size={16} style={styles.inputIcon} />
              <input
                {...register('email')}
                type="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                style={{ paddingLeft: '2.5rem' }}
                placeholder="doctor@hospital.com"
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <span className="form-error"><AlertCircle size={12} />{errors.email.message}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={16} style={styles.inputIcon} />
              <input
                {...register('password')}
                type="password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                style={{ paddingLeft: '2.5rem' }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {errors.password && (
              <span className="form-error"><AlertCircle size={12} />{errors.password.message}</span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full btn--lg"
            disabled={isSubmitting}
            style={{ marginTop: '1.5rem' }}
          >
            {isSubmitting ? <><div className="spinner" />Signing in...</> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    position: 'relative',
  },
  background: {
    position: 'fixed', inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    width: '100%', maxWidth: '420px',
    position: 'relative', zIndex: 1,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: '0.625rem',
    marginBottom: '2rem',
  },
  logoIcon: {
    width: '36px', height: '36px', borderRadius: '10px',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' },
  title: { fontSize: '1.75rem', fontWeight: 700 },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'var(--color-danger-muted)', color: 'var(--color-danger)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  inputWrapper: { position: 'relative' },
  inputIcon: {
    position: 'absolute', left: '0.875rem', top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--color-text-muted)', pointerEvents: 'none',
  },
};
