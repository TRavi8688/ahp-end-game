/**
 * hospyn-v2-web/src/components/Modals.jsx
 *
 * FIXES:
 *  1. LedgerLoginModal — removed hardcoded mock bypass (owner@apollo.com / mock_token_123)
 *  2. Login sends JSON body — matches auth-service /api/v1/auth/login expectation
 *  3. Uses api.js post() — env-driven base URL, no hardcoded /api/v1
 *  4. Saves full session data returned from backend
 */

import React, { useState, useEffect } from 'react';
import { X, Mail, Database, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { post } from '../lib/api';

// ── Credentials email preview modal ──────────────────────────────────────────
export const CredentialsEmailModal = ({ isOpen, onClose, staffRecord }) => {
  if (!isOpen || !staffRecord) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 font-inter">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="text-emerald-400" size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Hospin Onboarding Mail Dispatcher</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 bg-slate-50 border-b border-slate-100 font-mono text-xs text-slate-700 space-y-4 max-h-[400px] overflow-y-auto">
          <p><strong>To:</strong> {staffRecord.email}</p>
          <p><strong>Subject:</strong> [ACTION REQUIRED] Secure Clinical Credentials Provisioned for {staffRecord.hospitalName}</p>
          <hr className="border-slate-200" />
          <p>Dear {staffRecord.name},</p>
          <p>Your access credentials for <strong>{staffRecord.hospitalName}</strong> have been provisioned on the Hospin clinical grid:</p>
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
            <p>🔑 <strong>Unique Staff ID:</strong> <span className="text-blue-600 font-bold">{staffRecord.staff_id}</span></p>
            <p>🔒 <strong>Temporary Password:</strong> <span className="text-blue-600 font-bold">{staffRecord.temporary_password}</span></p>
          </div>
          <p>Access your clinical console at:</p>
          <p className="p-4 bg-blue-50 border border-blue-100 rounded-xl font-bold text-blue-700">
            👉 <a href={staffRecord.dedicated_portal_url} target="_blank" rel="noreferrer" className="underline">
              {staffRecord.dedicated_portal_url}/login
            </a>
          </p>
          <p>You will be prompted to set a permanent password on first sign-in.</p>
          <hr className="border-slate-200" />
          <p className="text-slate-400">Securely Synchronized via Hospin Ledger. System ID: {staffRecord.staff_id}</p>
        </div>
        <div className="p-6 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors"
          >
            Confirm Dispatch
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── SQL transparency badge ────────────────────────────────────────────────────
export const SqlBadge = ({ sql }) => {
  if (!sql) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[8px] font-mono text-slate-500 ml-2 align-middle"
      title={sql}
    >
      <Database size={9} className="text-slate-400" />
      {sql.length > 60 ? sql.substring(0, 57) + '...' : sql}
    </span>
  );
};

// ── Ledger Login Modal ────────────────────────────────────────────────────────
export const LedgerLoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [error,     setError]     = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fill email from last session if available
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('hospyn_owner_email');
      if (saved) setEmail(saved);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password)     { setError('Password is required.'); return; }

    setIsLoading(true);
    setError('');

    try {
      /**
       * auth-service /api/v1/auth/login expects JSON:
       *   { "username": "<email>", "password": "<password>" }
       *
       * Vite proxy + nginx both route /api/v1/auth/* → auth-service.
       *
       * Returns:
       *   { "access_token": "...", "token_type": "bearer",
       *     "user": { "id": ..., "role": "hospital_admin", "email": ... } }
       */
      const data = await post('/auth/login', {
        username: email.trim(),
        password,
      });

      onLoginSuccess({
        access_token: data.access_token,
        name:         data.user?.name || email.trim(),
        owner_email:  data.user?.email || email.trim(),
      });
    } catch (err) {
      setError(err.message || 'Authentication failed. Check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 font-inter">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white border border-slate-100 rounded-[28px] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">🔒</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                Hospital Owner Login
              </span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <X size={18} />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-2 ml-10">
            Access your hospital's management console
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Hospital Owner Email
            </label>
            <input
              type="email"
              placeholder="e.g. owner@yourhospital.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-violet-400 focus:bg-white transition-all font-medium"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm outline-none focus:border-violet-400 focus:bg-white transition-all font-medium pr-10"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
              <p className="text-[11px] text-rose-700 font-bold">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-900/10 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Authenticating…
              </>
            ) : 'Authenticate Credentials'}
          </button>
        </form>

        <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest pb-6">
          Secured by Hospin Healthcare Platform
        </p>
      </motion.div>
    </div>
  );
};
