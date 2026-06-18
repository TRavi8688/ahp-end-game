import { useNavigate } from 'react-router-dom';

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020617',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      color: '#f8fafc',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '1.5rem',
        maxWidth: '420px',
        width: '100%',
      }}>
        {/* Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          fontSize: '2rem',
        }}>
          🔒
        </div>

        {/* Status code */}
        <div style={{
          fontSize: '4rem',
          fontWeight: '800',
          color: 'rgba(239,68,68,0.6)',
          lineHeight: 1,
          marginBottom: '0.5rem',
          letterSpacing: '-2px',
        }}>
          403
        </div>

        <h1 style={{
          fontSize: '1.4rem',
          fontWeight: '700',
          marginBottom: '0.75rem',
          color: '#f1f5f9',
        }}>
          Access Denied
        </h1>

        <p style={{
          color: '#94a3b8',
          fontSize: '0.95rem',
          lineHeight: 1.6,
          marginBottom: '2rem',
        }}>
          This area is restricted to <strong style={{ color: '#0ea5e9' }}>Super Admin</strong> accounts only.
          You do not have the required role to access this page.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              color: '#fff',
              border: 'none',
              padding: '0.7rem 1.5rem',
              borderRadius: '0.6rem',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Back to Login
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0.7rem 1.5rem',
              borderRadius: '0.6rem',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
