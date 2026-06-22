/**
 * src/pages/Login.jsx — Hospain Matrix 3.0
 *
 * FIXES IN THIS FILE:
 *  1. "Hospain" → "Hospain" everywhere
 *  2. Tagline "Care Beyond Today" added
 *  3. Hospain logo displayed (from assets/hospain-logo.png)
 *  4. Role check: allows super_admin, admin, AND all hospain_employee roles
 *     (team_lead, manager, l1, l2, support, finance, etc.)
 *  5. Error messages updated to say "Hospain" not "Hospain"
 *  6. placeholder email updated to @hospain.in
 */
import React, { useState } from 'react';
import {
  Lock, Mail, AlertTriangle, ArrowRight,
  Loader2, Terminal, Phone, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { api }          from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import hospainLogo       from '../assets/hospain-logo.png';

// Roles that are allowed to access this portal
const ALLOWED_ROLES = [
  'super_admin', 'admin',
  'manager', 'team_lead',
  'l1', 'l2',
  'support', 'finance', 'engineering',
  'onboarding', 'data', 'verification',
  'employee', 'hospain_employee', 'hospain_employee',
];

export default function Login() {
  const { login }  = useAuthStore();
  const navigate   = useNavigate();
  const location   = useLocation();
  const from       = location.state?.from?.pathname || '/matrix/mission';

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [usePhone,   setUsePhone]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = usePhone
        ? { phone: identifier, password }
        : { email: identifier, password };

      const data = await api.post('/api/v1/auth/login', body);

      if (!data?.access_token) {
        throw new Error('No access token returned. Check backend connection.');
      }

      const user = data.user || {};
      const role = (user.role || data.role || '').toLowerCase();

      // Allow all internal Hospain employee roles
      const isAllowed = ALLOWED_ROLES.some(r => role.includes(r));
      if (!isAllowed) {
        setError(
          `Access denied. This portal is for Hospain internal team only. ` +
          `Your role "${role}" is not authorised. Contact your manager.`
        );
        return;
      }

      login(user, data.access_token);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('401') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('incorrect')) {
        setError('Invalid email or password. Please try again.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setError('Cannot connect to Hospain server. Make sure the backend is running at ' + (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'));
      } else {
        setError(msg || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '11px 14px 11px 40px',
    color: '#f1f5f9',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070b14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{ position:'absolute', top:'-15%', left:'-10%', width:'45%', height:'50%', background:'rgba(6,182,212,0.06)', borderRadius:'50%', filter:'blur(120px)' }} />
      <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:'45%', height:'50%', background:'rgba(139,92,246,0.06)', borderRadius:'50%', filter:'blur(120px)' }} />
      <div style={{ position:'absolute', top:'40%', left:'50%', transform:'translate(-50%,-50%)', width:'30%', height:'30%', background:'rgba(99,102,241,0.04)', borderRadius:'50%', filter:'blur(80px)' }} />

      {/* Grid */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
        backgroundSize:'50px 50px',
        maskImage:'radial-gradient(ellipse at center, black 20%, transparent 80%)',
      }} />

      <motion.div
        initial={{ opacity:0, y:20 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.4 }}
        style={{
          background: 'rgba(10,14,22,0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 440,
          padding: 36,
          position: 'relative',
          boxShadow: '0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.08)',
        }}
      >
        {/* Top accent line */}
        <div style={{ position:'absolute', top:0, left:40, right:40, height:1, background:'linear-gradient(90deg, transparent, rgba(6,182,212,0.5), rgba(139,92,246,0.5), transparent)', borderRadius:1 }} />

        {/* Logo + Branding */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:28 }}>
          {/* Hospain logo — exact as uploaded, no changes */}
          <div style={{
            width: 100,
            height: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}>
            <img
              src={hospainLogo}
              alt="Hospain"
              style={{ width:'100%', height:'100%', objectFit:'contain' }}
            />
          </div>

          <h1 style={{
            fontSize: 26,
            fontWeight: 900,
            color: '#0d1829',
            letterSpacing: '-0.03em',
            margin: '0 0 4px',
            /* Use Hospain brand dark blue from logo text */
            background: 'linear-gradient(135deg, #0d1829, #1a237e)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            /* fallback */
          }}>
            {/* Plain white for dark bg */}
          </h1>
          {/* Brand name in white since bg is dark */}
          <div style={{ fontSize:24, fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.03em', marginBottom:4 }}>
            Hospain
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 14,
            letterSpacing: '0.02em',
          }}>
            Care Beyond Today
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:20 }}>
            <div style={{ width:6, height:6, background:'#10b981', borderRadius:'50%', boxShadow:'0 0 6px #10b981' }} />
            <span style={{ fontSize:10, color:'#10b981', fontWeight:600 }}>Matrix 3.0 — Internal Operations Portal</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.2)', borderRadius:10, marginBottom:18 }}
          >
            <AlertTriangle size={14} color="#fb7185" style={{ flexShrink:0, marginTop:1 }} />
            <p style={{ fontSize:12, color:'#fb7185', margin:0, lineHeight:1.5 }}>{error}</p>
          </motion.div>
        )}

        {/* Email / Phone toggle */}
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {['Email', 'Phone'].map((mode, i) => (
            <button
              key={mode}
              type="button"
              onClick={() => setUsePhone(i === 1)}
              style={{
                flex:1, padding:'6px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
                background: (i===1) === usePhone ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${(i===1) === usePhone ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
                color: (i===1) === usePhone ? '#c7d2fe' : '#475569',
                transition: 'all 0.15s',
              }}
            >{mode}</button>
          ))}
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Identifier */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:7 }}>
              {usePhone ? 'Phone Number' : 'Work Email'}
            </label>
            <div style={{ position:'relative' }}>
              {usePhone
                ? <Phone size={14} color="#334155" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                : <Mail  size={14} color="#334155" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
              }
              <input
                type={usePhone ? 'tel' : 'email'}
                required
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                style={inputStyle}
                placeholder={usePhone ? '+91 98765 43210' : 'yourname@hospain.in'}
                autoComplete="username"
                onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e =>  { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:7 }}>
              Password
            </label>
            <div style={{ position:'relative' }}>
              <Lock size={14} color="#334155" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="••••••••••••"
                autoComplete="current-password"
                onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e =>  { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width:'100%', padding:'12px 20px', marginTop:4,
              background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              border:'1px solid rgba(99,102,241,0.3)', borderRadius:10, color:'#fff',
              fontSize:13, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              boxShadow: loading ? 'none' : '0 0 30px rgba(99,102,241,0.2)',
              transition:'all 0.2s',
            }}
          >
            {loading
              ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} />Authenticating…</>
              : <>Enter Hospain Matrix <ArrowRight size={15} /></>
            }
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop:24, paddingTop:18, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          {/* How to get access info */}
          <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.12)', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#818cf8', fontWeight:700, marginBottom:4 }}>🔐 How to get access</div>
            <div style={{ fontSize:11, color:'#475569', lineHeight:1.6 }}>
              Your account is created by your manager or Super Admin.<br/>
              Contact <span style={{ color:'#818cf8' }}>admin@hospain.in</span> if you don't have credentials.
            </div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginBottom:3 }}>
              <ShieldCheck size={10} color="#1e293b" />
              <span style={{ fontSize:10, color:'#1e293b', fontFamily:'monospace' }}>HIPAA · SOC2 · ISO 27001</span>
            </div>
            <p style={{ fontSize:10, color:'#1e293b', margin:0 }}>
              All sessions are cryptographically signed and immutably logged.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
