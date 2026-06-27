/**
 * src/pages/ChangePassword.jsx — Hospain Matrix 3.0
 *
 * Two modes:
 * 1. FORCED (state.forced = true): First login with temporary password.
 *    User CANNOT skip this. Full-screen takeover with modal.
 *    After success → redirected to their original destination.
 *
 * 2. VOLUNTARY (from Settings): User chooses to change password.
 *    Shows current password field too.
 *
 * Validation:
 *  - Min 8 chars
 *  - At least 1 uppercase
 *  - At least 1 number
 *  - Confirm password must match
 */
import React, { useState, useEffect } from 'react';
import {
  Lock, Eye, EyeOff, CheckCircle, AlertTriangle,
  Loader2, ShieldAlert, ArrowRight, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import hospainLogo from '../assets/hospain-logo.png';

const RULES = [
  { id:'len',     label:'At least 8 characters',      test: p => p.length >= 8 },
  { id:'upper',   label:'At least one uppercase letter', test: p => /[A-Z]/.test(p) },
  { id:'number',  label:'At least one number',          test: p => /[0-9]/.test(p) },
];

export default function ChangePassword() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, login, logout } = useAuthStore();

  const isForced = location.state?.forced === true;
  const from     = location.state?.from || '/matrix/mission';

  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);

  const rulesPassed = RULES.map(r => ({ ...r, passed: r.test(newPwd) }));
  const allRulesPassed = rulesPassed.every(r => r.passed);
  const passwordsMatch = newPwd === confirmPwd && confirmPwd.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!allRulesPassed) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const body = {
        new_password: newPwd,
        ...(isForced ? {} : { current_password: currentPwd }),
      };

      const data = await api.post('/api/v1/auth/change-password', body);

      if (data?.access_token) {
        // Update the session with the new token (which has must_change_password: false)
        const updatedUser = { ...(user || {}), must_change_password: false };
        login(updatedUser, data.access_token);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '11px 42px 11px 42px',
    color: '#f1f5f9',
    fontSize: 14,
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
      <div style={{ position:'absolute', top:'-15%', left:'-10%', width:'45%', height:'50%', background:'rgba(245,158,11,0.04)', borderRadius:'50%', filter:'blur(120px)' }} />
      <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:'45%', height:'50%', background:'rgba(99,102,241,0.05)', borderRadius:'50%', filter:'blur(120px)' }} />

      <motion.div
        initial={{ opacity:0, y:20 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.4 }}
        style={{
          background: 'rgba(10,14,22,0.97)',
          backdropFilter: 'blur(20px)',
          border: isForced ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 460,
          padding: 36,
          position: 'relative',
          boxShadow: isForced
            ? '0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.1)'
            : '0 40px 120px rgba(0,0,0,0.7)',
        }}
      >
        {/* Top accent line */}
        <div style={{
          position:'absolute', top:0, left:40, right:40, height:1,
          background: isForced
            ? 'linear-gradient(90deg, transparent, rgba(245,158,11,0.6), rgba(99,102,241,0.4), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(6,182,212,0.5), rgba(139,92,246,0.5), transparent)',
          borderRadius:1
        }} />

        {/* Header */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:24 }}>
          <img src={hospainLogo} alt="Hospain" style={{ width:60, height:60, objectFit:'contain', marginBottom:12 }} />

          {isForced && (
            <motion.div
              initial={{ scale:0.9 }} animate={{ scale:1 }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:20, marginBottom:14 }}
            >
              <ShieldAlert size={14} color="#f59e0b" />
              <span style={{ fontSize:11, color:'#f59e0b', fontWeight:700, letterSpacing:'0.06em' }}>
                FIRST LOGIN — ACTION REQUIRED
              </span>
            </motion.div>
          )}

          <h2 style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', margin:'0 0 6px', letterSpacing:'-0.02em' }}>
            {isForced ? 'Set Your Permanent Password' : 'Change Password'}
          </h2>
          <p style={{ fontSize:13, color:'#64748b', margin:0, textAlign:'center', lineHeight:1.6 }}>
            {isForced
              ? 'Your account was created with a temporary password. Set a permanent password to continue.'
              : 'Update your Matrix account password.'
            }
          </p>

          {user?.employee_id && (
            <div style={{ marginTop:10, padding:'4px 12px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:8 }}>
              <span style={{ fontSize:11, color:'#818cf8', fontFamily:'monospace', fontWeight:700 }}>
                Employee ID: {user.employee_id}
              </span>
            </div>
          )}
        </div>

        {/* Success state */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
              style={{ textAlign:'center', padding:'20px 0' }}
            >
              <CheckCircle size={40} color="#10b981" style={{ marginBottom:12 }} />
              <div style={{ fontSize:16, fontWeight:700, color:'#10b981', marginBottom:6 }}>
                Password updated successfully!
              </div>
              <div style={{ fontSize:13, color:'#64748b' }}>
                Redirecting to Command Center…
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!success && (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Current password (only for voluntary change) */}
            {!isForced && (
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                  Current Password
                </label>
                <div style={{ position:'relative' }}>
                  <Lock size={14} color="#334155" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)}
                    style={inputStyle}
                    placeholder="Enter current password"
                    onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; }}
                    onBlur={e =>  { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
                  />
                  <button type="button" onClick={() => setShowCurrent(s=>!s)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#334155', padding:0 }}>
                    {showCurrent ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
              </div>
            )}

            {/* New password */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                New Password
              </label>
              <div style={{ position:'relative' }}>
                <Lock size={14} color="#334155" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  style={inputStyle}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  onFocus={e => { e.target.style.borderColor='rgba(99,102,241,0.5)'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; }}
                  onBlur={e =>  { e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
                />
                <button type="button" onClick={() => setShowNew(s=>!s)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#334155', padding:0 }}>
                  {showNew ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>

              {/* Password rules */}
              {newPwd.length > 0 && (
                <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:5 }}>
                  {rulesPassed.map(r => (
                    <div key={r.id} style={{ display:'flex', alignItems:'center', gap:7 }}>
                      <div style={{ width:14, height:14, borderRadius:'50%', background: r.passed ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', border:`1px solid ${r.passed ? '#10b981' : 'rgba(255,255,255,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {r.passed && <CheckCircle size={9} color="#10b981" />}
                      </div>
                      <span style={{ fontSize:11, color: r.passed ? '#10b981' : '#475569' }}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                Confirm New Password
              </label>
              <div style={{ position:'relative' }}>
                <Lock size={14} color="#334155" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: confirmPwd.length > 0
                      ? (passwordsMatch ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)')
                      : 'rgba(255,255,255,0.08)'
                  }}
                  placeholder="Repeat your new password"
                  autoComplete="new-password"
                  onFocus={e => { e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'; }}
                  onBlur={e =>  { e.target.style.boxShadow='none'; }}
                />
                <button type="button" onClick={() => setShowConfirm(s=>!s)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#334155', padding:0 }}>
                  {showConfirm ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {confirmPwd.length > 0 && !passwordsMatch && (
                <div style={{ fontSize:11, color:'#fb7185', marginTop:5 }}>Passwords do not match</div>
              )}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.2)', borderRadius:10 }}
                >
                  <AlertTriangle size={14} color="#fb7185" style={{ flexShrink:0, marginTop:1 }} />
                  <p style={{ fontSize:12, color:'#fb7185', margin:0, lineHeight:1.5 }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !allRulesPassed || !passwordsMatch}
              style={{
                width:'100%', padding:'13px 20px',
                background: (loading || !allRulesPassed || !passwordsMatch)
                  ? 'rgba(99,102,241,0.3)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border:'1px solid rgba(99,102,241,0.3)', borderRadius:10, color:'#fff',
                fontSize:13, fontWeight:700,
                cursor: (loading || !allRulesPassed || !passwordsMatch) ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: (loading || !allRulesPassed || !passwordsMatch) ? 'none' : '0 0 30px rgba(99,102,241,0.2)',
                transition:'all 0.2s',
              }}
            >
              {loading
                ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} />Updating…</>
                : <>Set Permanent Password <ArrowRight size={15} /></>
              }
            </button>

            {/* Logout option for forced change */}
            {isForced && (
              <button
                type="button"
                onClick={handleLogout}
                style={{ background:'none', border:'none', color:'#475569', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:8, transition:'color 0.15s' }}
                onMouseOver={e => e.target.style.color='#94a3b8'}
                onMouseOut={e => e.target.style.color='#475569'}
              >
                <LogOut size={12} />
                Sign out and log in as someone else
              </button>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
}
