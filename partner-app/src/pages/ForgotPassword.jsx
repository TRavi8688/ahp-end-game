import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import apiClient from '../services/apiClient';
import Logo from '../components/Logo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/forgot-password/request', { email });
      setSent(true);
    } catch (err) {
      console.error(err);
      // Always show success to avoid email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-lavender-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo variant="full" className="w-48 mb-1" />
        </div>

        <div className="bg-white p-7 rounded-3xl shadow-card border border-lavender-100">
          <Link
            to="/login"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-4 -ml-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Sign In
          </Link>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-success-600" />
              </div>
              <h2 className="text-xl font-bold text-ink-900 mb-2">Check Your Email</h2>
              <p className="text-sm text-gray-500">
                If an account exists for <span className="font-semibold text-ink-900">{email}</span>,
                we've sent a password reset link. Check your spam folder if it doesn't arrive within
                a few minutes.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-ink-900 mb-1">Reset Password</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enter the email address linked to your account. We'll send you a reset link.
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3.5 rounded-full transition-all shadow-floating disabled:opacity-70 mt-2"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
