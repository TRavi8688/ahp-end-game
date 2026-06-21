import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { Mail, Lock, AlertCircle, Zap } from 'lucide-react';
import Logo from '../components/Logo';

// Demo credentials that work against the live cloud backend
const DEMO_EMAIL    = 'doctor@hospyn.com';
const DEMO_PASSWORD = 'Hospyn123!';

export default function Login({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const doLogin = async (usr, pwd) => {
    setLoading(true);
    setError('');
    try {
      // Cloud API uses OAuth2 x-www-form-urlencoded with 'username' field.
      const formData = new URLSearchParams();
      formData.append('username', usr);
      formData.append('password', pwd);
      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      localStorage.setItem('token', response.data.access_token);
      onLogin();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setError('Account still pending verification.');
      } else {
        setError('Invalid credentials or unauthorized account.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); doLogin(email, password); };
  const handleDemo   = ()  => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); doLogin(DEMO_EMAIL, DEMO_PASSWORD); };

  return (
    <div className="min-h-screen bg-lavender-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo variant="full" className="w-48 mb-1" />
          <p className="text-primary-600 font-semibold text-sm mt-1">Hospin Partner Portal</p>
        </div>

        <div className="bg-white p-7 rounded-3xl shadow-card border border-lavender-100">
          <h2 className="text-2xl font-bold text-ink-900 mb-1">Sign In</h2>
          <p className="text-gray-500 text-sm mb-6">Access your partner account to manage pharmacy operations.</p>

          {/* One-click Demo Login */}
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 font-semibold py-3 rounded-2xl hover:bg-amber-100 transition-all mb-5 disabled:opacity-60"
          >
            <Zap className="w-4 h-4" />
            {loading ? 'Signing in...' : '⚡ Quick Demo Login'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or sign in manually</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink-900 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-ink-900">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-primary-600 hover:text-primary-700">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3.5 rounded-full transition-all shadow-floating disabled:opacity-70 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-semibold hover:text-primary-700">
              Sign Up
            </Link>
          </p>
        </div>

        {/* Demo credentials hint card */}
        <div className="mt-4 bg-primary-50 border border-primary-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-primary-700 mb-1.5">📋 Demo Credentials</p>
          <p className="text-xs text-primary-600 font-mono">Email: {DEMO_EMAIL}</p>
          <p className="text-xs text-primary-600 font-mono">Password: {DEMO_PASSWORD}</p>
        </div>
      </div>
    </div>
  );
}
