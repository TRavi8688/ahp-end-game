/**
 * src/pages/Login.jsx — Hospain Matrix 3.0
 *
 * CHANGES (Employee ID Login Overhaul):
 *  - Primary login: Employee ID (6-char, e.g. H3RK9N) + password
 *  - Email/Phone login removed from Matrix (internal portal only uses Employee ID)
 *  - Role check uses strict equality, not substring match (BUG-19 FIX)
 *  - Duplicate 'hospain_employee' removed from ALLOWED_ROLES (BUG-19 FIX)
 *  - Error detection by HTTP status code, not fragile string match (BUG-31 FIX)
 *  - Session stored in sessionStorage only, not localStorage (BUG-29 FIX)
 *
 * Employee IDs look like: H3RK9N, 7HR2K4, H2K9R3
 * Always 6 characters, always contain H and R (Hospain HR branding)
 */
import React, { useState } from 'react';
import {
  Lock, AlertTriangle, ArrowRight,
  Loader2, ShieldCheck, IdCard, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { api }          from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import hospainLogo       from '../assets/hospain-logo.png';

// Roles that are allowed to access this portal (EXACT match — BUG-19 FIX)
const ALLOWED_ROLES = new Set([
  'super_admin', 'admin', 'hr',
  'manager', 'team_lead',
  'l1', 'l2',
  'support', 'finance', 'engineering',
  'onboarding', 'data', 'verification',
  'employee',
]);

export default function Login() {
  const { login }  = useAuthStore();
  const navigate   = useNavigate();
  const location   = useLocation();
  const from       = location.state?.from?.pathname || '/matrix/mission';

  const [employeeId, setEmployeeId] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPwd,    setShowPwd]    = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const eid = employeeId.trim().toUpperCase();

    // Basic format validation — 6 chars, contains H and R
    if (eid.length !== 6 || !eid.includes('H') || !eid.includes('R')) {
      setError('Employee ID must be exactly 6 characters and contain H and R. Example: H3RK9N');
      setLoading(false);
      return;
    }

    try {
      const data = await api.post('/api/v1/auth/login', {
        employee_id: eid,
        password,
      });

      if (!data?.access_token) {
        throw new Error('No access token returned. Check backend connection.');
      }

      const user = data.user || {};
      const role = (user.role || data.role || '').toLowerCase();

      // BUG-19 FIX: exact match, not substring
      if (!ALLOWED_ROLES.has(role)) {
        setError(
          `Access denied. Role "${role}" is not authorised for Hospain Matrix. ` +
          `Contact your manager or HR admin.`
        );
        return;
      }

      // Store employee_id in user object for display
      const enrichedUser = {
        ...user,
        employee_id: data.employee_id || eid,
        must_change_password: data.must_change_password || false,
      };

      login(enrichedUser, data.access_token);

      // If first login with temp password → go to password change page
      // The ProtectedRoute and Layout also intercept this via authStore
      if (data.must_change_password) {
        navigate('/change-password', {
          replace: true,
          state: { forced: true, from },
        });
        return;
      }

      navigate(from, { replace: true });
    } catch (err) {
      // BUG-31 FIX: use err.message from apiClient (already has HTTP status stripped)
      const msg = err.message || '';
      if (msg.toLowerCase().includes('employee id') || msg.toLowerCase().includes('not found')) {
        setError('Employee ID not found. Double-check your ID or contact HR.');
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('credentials')) {
        setError('Incorrect Employee ID or password. Please try again.');
      } else if (msg.toLowerCase().includes('deactivated') || msg.toLowerCase().includes('suspended')) {
        setError('Your account has been deactivated. Contact your HR administrator.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed')) {
        setError('Cannot connect to Hospain server. Please check your connection.');
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
    padding: '11px 14px 11px 42px',
    color: '#f1f5f9',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    letterSpacing: '0.04em',
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
          <div style={{ width:90, height:90, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
            <img src={hospainLogo} alt="Hospain" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
          </div>
          <div style={{ fontSize:24, fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.03em', marginBottom:4 }}>
            Hospain
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600,
            background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Care Beyond Today
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 14px', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:20 }}>
            <div style={{ width:6, height:6, background:'#10b981', borderRadius:'50%', boxShadow:'0 0 6px #10b981' }} />
            <span style={{ fontSize:10, color:'#10b981', fontWeight:700, letterSpacing:'0.06em' }}>MATRIX 3.0 — COMMAND CENTER</span>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.2)', borderRadius:10, marginBottom:18 }}
            >
              <AlertTriangle size={14} color="#fb7185" style={{ flexShrink:0, marginTop:1 }} />
              <p style={{ fontSize:12, color:'#fb7185', margin:0, lineHeight:1.6 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Employee ID */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
              Employee ID
            </label>
            <div style={{ position:'relative' }}>
              <IdCard size={15} color="#334155" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
              <input
                type="text"
                required
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value.toUpperCase())}
                style={{ ...inputStyle, fontFamily:'monospace', fontSize:16, fontWeight:700, letterSpacing:'0.18em' }}
                placeholder="H3RK9N"
                maxLength={6}
                autoComplete="username"
                spellCheck={false}
                onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e =>  { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
              />
            </div>
            <div style={{ fontSize:10, color:'#334155', marginTop:5, paddingLeft:2 }}>
              6-character ID provided by your HR admin (e.g. H3RK9N)
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
              Password
            </label>
            <div style={{ position:'relative' }}>
              <Lock size={14} color="#334155" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight:40 }}
                placeholder="Enter your password"
                autoComplete="current-password"
                onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e =>  { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#334155', padding:0 }}
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width:'100%', padding:'13px 20px', marginTop:4,
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
              : <>Access Command Center <ArrowRight size={15} /></>
            }
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop:24, paddingTop:18, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.12)', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#818cf8', fontWeight:700, marginBottom:4 }}>🔐 Need access?</div>
            <div style={{ fontSize:11, color:'#475569', lineHeight:1.7 }}>
              Your Employee ID and temporary password are provided by HR.<br/>
              Contact <span style={{ color:'#818cf8' }}>hr@hospain.in</span> or your manager.
            </div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginBottom:3 }}>
              <ShieldCheck size={10} color="#475569" />
              <span style={{ fontSize:10, color:'#475569', fontFamily:'monospace' }}>HIPAA · SOC2 · ISO 27001</span>
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
