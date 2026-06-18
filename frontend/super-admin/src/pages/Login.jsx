// super-admin-dashboard/src/pages/Login.jsx
// FIXED:
//   1. Sends { phone: ..., password: ... } — backend reads "phone" not "phone_number"
//   2. Role check uses data.user.role === 'super_admin'
//   3. Falls back to data.user.id if data.user is flat object

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const { login }  = useAuthStore();
  const navigate   = useNavigate();

  const [form, setForm]       = useState({ phone_number: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Backend v1/auth.py reads body.get("phone") — NOT "phone_number"
      const data = await api.post('/api/v1/auth/login', {
        phone:    form.phone_number,
        password: form.password,
      });

      if (!data?.access_token) {
        throw new Error('Invalid response from server — no token returned');
      }

      const user = data.user || {};

      if (user.role !== 'super_admin') {
        setError('Your account does not have super-admin access.');
        return;
      }

      login(user, data.access_token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#070b14' }}>
      <div className="w-full max-w-sm" style={{
        background: 'rgba(17,24,39,0.9)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 32,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, color: 'white', fontSize: 16,
          }}>H</div>
          <div>
            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>Hospyn</div>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Super Admin</div>
          </div>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Sign in</h1>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 24 }}>Internal team access only</p>

        {error && (
          <div style={{
            background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)',
            color: '#fb7185', fontSize: 13, borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
              Phone number
            </label>
            <input
              name="phone_number"
              type="tel"
              autoComplete="tel"
              value={form.phone_number}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              className="input-dark"
              style={{ padding: '10px 14px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
              Password
            </label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="input-dark"
              style={{ padding: '10px 14px' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !form.phone_number || !form.password}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: 4, opacity: (loading || !form.phone_number || !form.password) ? 0.5 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
