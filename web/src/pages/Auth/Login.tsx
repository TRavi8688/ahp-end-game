// partner-app/src/pages/Auth/Login.tsx
//
// BUG FIX: handleSubmit only did console.log({ email, password }).
// It NEVER called the backend, never saved tokens, and never navigated.
// Logging in did nothing. Now wired to Redux loginPartner thunk + AuthContext.

import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginPartner } from '../../store/authSlice';
import { useAuth } from '../../context/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const dispatch  = useDispatch<any>();
  const navigate  = useNavigate();
  const { login } = useAuth();

  // BUG FIX: Was console.log only. Now calls backend, saves tokens, navigates.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await dispatch(loginPartner({ email, password }));

      if (loginPartner.fulfilled.match(result)) {
        const { access_token, partner } = result.payload;
        // Sync token into AuthContext so ProtectedRoute sees isAuthenticated=true
        login(access_token, {
          id: partner.id,
          email: partner.email,
          business_name: partner.name,
          business_type: 'pharmacy',
          verification_status: partner.is_active ? 'approved' : 'pending',
          partner_code: partner.partner_code,
        });
        navigate('/dashboard', { replace: true });
      } else {
        setError(result.payload as string || 'Login failed. Check your credentials.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="glass-panel p-8 sm:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/30 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <Activity className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Partner Portal</h1>
            <p className="text-slate-400 text-center">Sign in to manage your medical services and operations.</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1 relative">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input pl-11"
                  placeholder="admin@pharmacy.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1 relative">
              <div className="flex justify-between items-center pl-1">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                <a href="#" className="text-xs text-primary hover:text-blue-400 transition-colors">Forgot Password?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input pl-11"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glass-button w-full flex items-center justify-center gap-2 mt-8"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              Don't have a partner account?{' '}
              <Link to="/register" className="text-primary font-medium hover:text-blue-400 hover:underline transition-all">
                Apply now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
