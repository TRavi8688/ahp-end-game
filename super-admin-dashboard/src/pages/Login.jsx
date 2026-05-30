import React, { useState } from 'react';
import { Shield, Lock, Mail, AlertTriangle, ArrowRight, Loader2, Terminal, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      const response = await axios.post(`${API_BASE}/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const { access_token, role, user_id } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', role);
      localStorage.setItem('user_id', user_id);
      onLoginSuccess(access_token);
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Verify credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#070b14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden'
    }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '45%', height: '50%', background: 'rgba(99,102,241,0.07)', borderRadius: '50%', filter: 'blur(100px)' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '45%', height: '50%', background: 'rgba(16,185,129,0.05)', borderRadius: '50%', filter: 'blur(100px)' }} />
      <div style={{ position: 'absolute', top: '40%', right: '20%', width: '25%', height: '30%', background: 'rgba(139,92,246,0.04)', borderRadius: '50%', filter: 'blur(80px)' }} />

      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)'
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: 'rgba(13,17,23,0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 440,
          padding: 36,
          position: 'relative',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
        }}
      >
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 40, right: 40, height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)', borderRadius: 1 }} />

        {/* Logo block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(99,102,241,0.2)'
            }}>
              <Shield size={28} color="#818cf8" />
            </div>
            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, background: '#10b981', border: '2px solid #070b14', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, background: 'white', borderRadius: '50%' }} />
            </div>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Hospyn<span style={{ color: '#6366f1' }}>Core</span>
          </h1>
          <p style={{ fontSize: 12, color: '#334155', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Platform Admin Console
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '4px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 20 }}>
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
            <AlertTriangle size={15} color="#fb7185" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#fb7185' }}>{error}</p>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Platform Admin Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} color="#334155" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="email" required
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 14px 10px 38px', color: '#f1f5f9', fontSize: 13,
                  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box'
                }}
                placeholder="superadmin@hospyn.com"
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Admin Security Key
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} color="#334155" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="password" required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 14px 10px 38px', color: '#f1f5f9', fontSize: 13,
                  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box'
                }}
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
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: loading ? 'none' : '0 0 30px rgba(99,102,241,0.25)',
              transition: 'all 0.15s', fontFamily: 'Inter, sans-serif'
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 0 40px rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = loading ? 'none' : '0 0 30px rgba(99,102,241,0.25)'; e.currentTarget.style.transform = 'none'; }}
          >
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Authenticating...</> : <>Access Platform Console <ArrowRight size={16} /></>}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
            <Terminal size={11} color="#1e293b" />
            <span style={{ fontSize: 10, color: '#1e293b', fontFamily: 'monospace' }}>HIPAA · SOC2 · ISO 27001</span>
          </div>
          <p style={{ fontSize: 10, color: '#1e293b' }}>
            All sessions are cryptographically signed and immutably logged.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
