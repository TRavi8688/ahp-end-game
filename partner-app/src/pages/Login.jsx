import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // EXECUTION FIX: backend's POST /auth/login reads `body: dict` — i.e. a
      // plain JSON body with email/username + password — not an OAuth2
      // x-www-form-urlencoded form. The previous code sent form-encoded
      // username/password/grant_type, which the backend's `body.get(...)`
      // calls would never see, so login could never succeed regardless of
      // credentials.
      const response = await apiClient.post('/auth/login', {
        email: email,
        password: password,
      });

      // EXECUTION FIX: stored under 'partner_token', but Dashboard.jsx and
      // apiClient.js both read 'token' — the dashboard's QR code, dispense
      // flow, and every authenticated request were silently broken even on
      // a successful login. Standardized to 'token' everywhere.
      localStorage.setItem('token', response.data.access_token);
      onLogin();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setError('Your account is still pending verification. Check your status to see what\'s left.');
      } else {
        setError('Invalid credentials or unauthorized partner account.');
      }
    } finally {
      setLoading(false);
    }
  };

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
      </div>
    </div>
  );
}
