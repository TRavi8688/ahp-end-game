import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Activity, 
  ArrowRight, 
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  ArrowLeft,
  KeyRound
} from 'lucide-react';
import apiClient from '../apiClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Backend uses OAuth2PasswordRequestForm → must send form-encoded data
      const formData = new URLSearchParams();
      formData.append('username', identifier);
      formData.append('password', password);

      const response = await apiClient.post(`/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token } = response.data;
      
      // Decode JWT to get user info (role, id, etc.)
      let userInfo = {};
      try {
        const payload = JSON.parse(atob(access_token.split('.')[1]));
        userInfo = {
          id: payload.sub,
          role: payload.role,
          is_temporary_password: payload.is_temporary_password || false
        };
      } catch (e) {
        console.warn('Could not decode JWT payload:', e);
      }

      // Store security credentials
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userInfo));
      localStorage.setItem('isAuthenticated', 'true');

      // Redirect to the appropriate dashboard based on role
      let targetPath = '/clinical';
      const r = userInfo.role;
      if (r === 'nurse') targetPath = '/ward';
      else if (r === 'pharmacy') targetPath = '/pharmacy';
      else if (r === 'lab') targetPath = '/lab';
      else if (r === 'receptionist' || r === 'biller') targetPath = '/billing';
      else if (r === 'hr') targetPath = '/staff';
      
      window.location.href = targetPath;
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password handlers ───────────────────────────────
  const [showForgot, setShowForgot] = useState(false);
  const [fpStep, setFpStep] = useState('request');
  const [fpId, setFpId] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpResetToken, setFpResetToken] = useState(''); // stored after verify step
  const [fpNewPw, setFpNewPw] = useState('');
  const [fpConfirmPw, setFpConfirmPw] = useState('');
  const [fpShowPw, setFpShowPw] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');

  const handleFpRequest = async () => {
    setFpLoading(true); setFpError(''); setFpSuccess('');
    try {
      const res = await apiClient.post(`/auth/forgot-password/request`, { identifier: fpId });
      setFpSuccess('Reset code sent to your registered email / phone.');
      setFpStep('verify');
    } catch (err) { setFpError(err.response?.data?.detail || 'Failed to send reset code.'); }
    finally { setFpLoading(false); }
  };

  const handleFpVerify = async () => {
    setFpLoading(true); setFpError('');
    try {
      const res = await apiClient.post(`/auth/forgot-password/verify`, { identifier: fpId, otp: fpOtp });
      // Backend returns a signed reset_token — store it securely
      setFpResetToken(res.data.reset_token);
      setFpStep('reset');
    } catch (err) { setFpError(err.response?.data?.detail || 'Invalid or expired code.'); }
    finally { setFpLoading(false); }
  };

  const handleFpReset = async () => {
    if (fpNewPw !== fpConfirmPw) { setFpError('Passwords do not match.'); return; }
    if (fpNewPw.length < 8) { setFpError('Password must be at least 8 characters.'); return; }
    setFpLoading(true); setFpError('');
    try {
      // Backend requires reset_token (from verify step) + new_password
      await apiClient.post(`/auth/forgot-password/reset`, { reset_token: fpResetToken, new_password: fpNewPw });
      setFpStep('done');
    } catch (err) { setFpError(err.response?.data?.detail || 'Reset failed. Please try again.'); }
    finally { setFpLoading(false); }
  };

  const inputClass = "w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium";

  // ── Forgot Password Modal ────────────────────────────────────
  if (showForgot) return (
    <div className="login-wrapper min-h-screen flex items-center justify-center bg-[#020617] p-6 font-outfit">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[120px]" />
      </div>
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <button onClick={() => { setShowForgot(false); setFpStep('request'); setFpError(''); setFpSuccess(''); }} className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 transition-colors text-sm font-bold">
          <ArrowLeft size={16} /> Back to Login
        </button>
        <div className="glass-card p-10 border border-white/10">
          <h2 className="text-2xl font-black text-white mb-1">{fpStep === 'done' ? 'Password Reset ✓' : 'Recover Access'}</h2>
          <p className="text-slate-500 text-sm mb-8">
            {fpStep === 'request' && 'Enter your Hospyn ID or email to receive a reset code.'}
            {fpStep === 'verify' && 'Enter the 6-digit code sent to your registered contact.'}
            {fpStep === 'reset' && 'Set a new secure password for your account.'}
            {fpStep === 'done' && 'Your password has been reset. You can now log in.'}
          </p>

          {fpError && <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-6">{fpError}</div>}
          {fpSuccess && <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6">{fpSuccess}</div>}

          {fpStep === 'request' && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500"><Mail size={18} /></div>
                <input type="text" value={fpId} onChange={e => setFpId(e.target.value)} className={inputClass} placeholder="Hospyn ID or email" />
              </div>
              <button onClick={handleFpRequest} disabled={fpLoading || !fpId} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                {fpLoading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </div>
          )}

          {fpStep === 'verify' && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-indigo-400"><KeyRound size={18} /></div>
                <input type="text" value={fpOtp} onChange={e => setFpOtp(e.target.value)} className={inputClass} placeholder="6-digit code" maxLength={6} />
              </div>
              <button onClick={handleFpVerify} disabled={fpLoading || fpOtp.length < 6} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                {fpLoading ? 'Verifying...' : 'Verify Code'}
              </button>
              <button onClick={handleFpRequest} className="w-full text-slate-500 hover:text-white text-xs font-bold py-2 transition-colors">Resend code</button>
            </div>
          )}

          {fpStep === 'reset' && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500"><Lock size={18} /></div>
                <input type={fpShowPw ? 'text' : 'password'} value={fpNewPw} onChange={e => setFpNewPw(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium" placeholder="New password" />
                <button type="button" onClick={() => setFpShowPw(v => !v)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white">
                  {fpShowPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500"><Lock size={18} /></div>
                <input type="password" value={fpConfirmPw} onChange={e => setFpConfirmPw(e.target.value)} className={inputClass} placeholder="Confirm new password" />
              </div>
              <button onClick={handleFpReset} disabled={fpLoading || !fpNewPw || !fpConfirmPw} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                {fpLoading ? 'Updating...' : 'Set New Password'}
              </button>
            </div>
          )}

          {fpStep === 'done' && (
            <button onClick={() => { setShowForgot(false); setFpStep('request'); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs">
              Return to Login
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .glass-card { background: #0f172a; border-radius: 40px; }
      `}</style>
    </div>
  );

  return (
    <div className="login-wrapper min-h-screen flex items-center justify-center bg-[#020617] p-6 font-outfit">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="login-card w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-[2rem] bg-indigo-600/10 border border-indigo-600/20 mb-6 shadow-2xl shadow-indigo-600/20">
            <Activity className="text-indigo-500" size={40} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">HOSPYN <span className="text-indigo-500">ERP</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Clinical Command Center Access</p>
        </div>

        <div className="glass-card p-10 border border-white/10 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Staff Identifier</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-500 transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={`${inputClass} pr-4`}
                  placeholder="Hospyn ID (e.g. HOSPYN-ADM-XXXX) or email"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secure Passkey</label>
                <button type="button" onClick={() => setShowForgot(true)} className="text-[10px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                  placeholder="••••••••"
                  required
                  autoComplete="off"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold animate-shake">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Initialize Session</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-slate-600">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Clinical Encryption</span>
            </div>
          </div>
        </div>

        <p className="text-center mt-10 text-slate-700 text-[10px] font-black tracking-[0.3em] uppercase">
          Sovereign Medical Intelligence Platform
        </p>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        .glass-card { background: #0f172a; border-radius: 40px; }
      `}</style>
    </div>
  );
};

export default Login;
