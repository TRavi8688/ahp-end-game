import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth, ROLE_REDIRECT_MAP } from '../context/AuthContext';

/**
 * FIXES:
 * 1. Used local role-parse from email prefix for redirect — that was only valid for the
 *    now-removed demo bypass. Real JWT carries role; we read it from context after login.
 * 2. alert() replaced with inline error message.
 * 3. Redirect now reads user.role from context (set by AuthContext after token parse).
 */
const Login: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      // After login(), AuthContext parses the JWT and sets user.role.
      // We read from the module-level ROLE_REDIRECT_MAP — no local guessing.
      // Note: user state updates asynchronously; we read role from token directly.
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const redirect = ROLE_REDIRECT_MAP[payload.role] || '/unauthorized';
        navigate(redirect, { replace: true });
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail?.message ||
        err?.response?.data?.detail ||
        'Invalid email or password. Please try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-3xl p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-white text-2xl mx-auto mb-4 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            H
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Hospyn 2.0</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">
            Enterprise Staff Portal
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-semibold">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                Work Email
              </label>
              <div className="relative group">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="name@hospital.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative group">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 group disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <span>Secure Login</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Protected by Hospyn Security Engine (RS256 / HS256)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
