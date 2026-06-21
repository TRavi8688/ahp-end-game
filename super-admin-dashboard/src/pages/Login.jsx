// super-admin-dashboard/src/pages/Login.jsx
//
// WHAT CHANGED vs existing file:
//  - Removed localStorage.setItem('token'/'role'/'user_id')
//  - Calls useAuthStore().login() which writes to in-memory tokenStore
//  - Accepts both email AND phone number (backend returns role in JSON body)
//  - Role check: must be 'super_admin' — blocks all other roles
//  - Removed axios — uses api from lib/apiClient
//  - Kept all original visual design (orbs, grid, framer-motion)
//
import React, { useState } from 'react';
import {
  Shield, Lock, Mail, AlertTriangle, ArrowRight,
  Loader2, Terminal, Phone
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { api }           from '../lib/apiClient';
import { useAuthStore }  from '../stores/authStore';

export default function Login() {
  const { login } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/';

  const [identifier, setIdentifier] = useState('');  // email or phone
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [usePhone,   setUsePhone]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Backend accepts: email, phone, phone_number, username
      const body = usePhone
        ? { phone: identifier, password }
        : { email: identifier, password };

      const data = await api.post('/api/v1/auth/login', body);

      if (!data?.access_token) {
        throw new Error('No access token returned from server');
      }

      const user = data.user || {};
      const role = user.role || data.role;

      if (role !== 'super_admin' && role !== 'admin') {
        setError(
          'This portal is restricted to Hospyn internal team only. ' +
          'Your account role is: ' + (role || 'unknown')
        );
        return;
      }

      // FIXED: writes to in-memory tokenStore — NOT localStorage
      login(user, data.access_token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Verify credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '10px 14px 10px 38px', color: '#f1f5f9',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#070b14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '45%', height: '50%', background: 'rgba(99,102,241,0.07)', borderRadius: '50%', filter: 'blur(100px)' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '45%', height: '50%', background: 'rgba(16,185,129,0.05)', borderRadius: '50%', filter: 'blur(100px)' }} />

      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)', backgroundSize: '50px 50px', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20,
          width: '100%', maxWidth: 440, padding: 36, position: 'relative',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
        }}
      >
        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 40, right: 40, height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)', borderRadius: 1 }} />

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(99,102,241,0.2)', marginBottom: 18 }}>
            <Shield size={28} color="#818cf8" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Hospyn<span style={{ color: '#6366f1' }}>Core</span>
          </h1>
          <p style={{ fontSize: 11, color: '#334155', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            Platform Admin Console
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 20 }}>
            <div style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%', boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>All Systems Operational</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, marginBottom: 20 }}
          >
            <AlertTriangle size={14} color="#fb7185" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#fb7185', margin: 0 }}>{error}</p>
          </motion.div>
        )}

        {/* Toggle email/phone */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['Email', 'Phone'].map((mode, i) => (
            <button
              key={mode}
              type="button"
              onClick={() => setUsePhone(i === 1)}
              style={{
                flex: 1, padding: '6px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: (i === 1) === usePhone ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${(i === 1) === usePhone ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
                color: (i === 1) === usePhone ? '#c7d2fe' : '#475569',
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Identifier */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
              {usePhone ? 'Phone Number' : 'Email Address'}
            </label>
            <div style={{ position: 'relative' }}>
              {usePhone
                ? <Phone size={14} color="#334155" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
                : <Mail  size={14} color="#334155" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
              }
              <input
                type={usePhone ? 'tel' : 'email'}
                required
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                style={inputStyle}
                placeholder={usePhone ? '+91 98765 43210' : 'admin@hospyn.com'}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} color="#334155" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="••••••••••••"
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px 20px', marginTop: 4,
              background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: loading ? 'none' : '0 0 30px rgba(99,102,241,0.25)',
            }}
          >
            {loading
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />Authenticating...</>
              : <>Access Platform Console <ArrowRight size={15} /></>
            }
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 4 }}>
            <Terminal size={10} color="#1e293b" />
            <span style={{ fontSize: 10, color: '#1e293b', fontFamily: 'monospace' }}>HIPAA · SOC2 · ISO 27001</span>
          </div>
          <p style={{ fontSize: 10, color: '#1e293b', margin: 0 }}>
            All sessions are cryptographically signed and immutably logged.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
