import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient, { setToken } from '../services/apiClient';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';

// Roles that are permitted to access the pharmacy partner portal
// Must match PHARMACY_ROLES in backend/healthcare-core/app/api/v1/pharmacy.py exactly:
// PHARMACY_ROLES = ("pharmacist", "admin", "hospital_admin", "owner")
// Any other role will receive 403 Forbidden on every pharmacy API call.
const ALLOWED_ROLES = new Set(['pharmacist', 'admin', 'hospital_admin', 'owner']);

function decodeTokenPayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { access_token } = response.data;

      // Verify the returned JWT belongs to a pharmacy partner role.
      // The real RBAC gate is server-side; this client-side check prevents
      // confusing "access denied" errors deep inside the app.
      const payload = decodeTokenPayload(access_token);
      const role = payload?.role || '';
      if (!ALLOWED_ROLES.has(role)) {
        setError(
          'This account does not have partner access. ' +
          'Please use your pharmacy staff credentials or contact support@hospain.in.'
        );
        return;
      }

      // Store token in sessionStorage — nothing written to localStorage.
      setToken(access_token);

      // Cache the user profile returned by the login response body.
      // This avoids a separate GET /auth/me call (that endpoint is internal-only).
      const userProfile = response.data.user || {};
      sessionStorage.setItem(
        'hospyn_partner_user',
        JSON.stringify({
          name:      userProfile.name  || '',
          email:     userProfile.email || '',
          role:      payload?.role     || role,
          user_id:   userProfile.id    || payload?.sub || '',
        })
      );

      onLogin();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setError(
          'Your account is pending verification. ' +
          "Check your registration status or contact support@hospain.in."
        );
      } else if (err.response?.status === 401) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(
          'Could not sign in. Check your connection and try again, ' +
          'or contact support@hospain.in.'
        );
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
          <p className="text-primary-600 font-semibold text-sm mt-1">HOSPAIN Partner Portal</p>
        </div>

        <div className="bg-white p-7 rounded-3xl shadow-card border border-lavender-100">
          <h2 className="text-2xl font-bold text-ink-900 mb-1">Sign In</h2>
          <p className="text-gray-500 text-sm mb-6">
            Access your partner account to manage pharmacy operations.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink-900 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-11 pr-4 py-3 bg-lavender-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all text-sm"
                  placeholder="you@pharmacy.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-ink-900">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
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
                  autoComplete="current-password"
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
              {loading ? 'Signing in…' : 'Sign In'}
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
