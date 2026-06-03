import React, { useState, useEffect } from 'react';
import { X, Mail, Database } from 'lucide-react';
import { motion } from 'framer-motion';

// --- CUSTOM CORPORATE EMAIL DISPATCH POPUP ---
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
            <span className="text-xs font-bold uppercase tracking-wider">Hospyn Onboarding Mail Dispatcher</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>
        <div className="p-8 bg-slate-50 border-b border-slate-100 font-mono text-xs text-slate-700 space-y-4 max-h-[400px] overflow-y-auto">
          <p><strong>To:</strong> {staffRecord.email}</p>
          <p><strong>Subject:</strong> [ACTION REQUIRED] Secure Clinical Credentials Provisioned for {staffRecord.hospitalName}</p>
          <hr className="border-slate-200" />
          <p>Dear {staffRecord.name},</p>
          <p>Your professional access credentials for <strong>{staffRecord.hospitalName}</strong> have been successfully provisioned on the Hospyn clinical grid:</p>
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
            <p>🔑 <strong>Unique Staff ID:</strong> <span className="text-blue-600 font-bold">{staffRecord.staff_id}</span></p>
            <p>🔒 <strong>Temporary Password:</strong> <span className="text-blue-600 font-bold">{staffRecord.temporary_password}</span></p>
          </div>
          <p>Please access your dedicated clinical console at:</p>
          <p className="p-4 bg-blue-50 border border-blue-100 rounded-xl font-bold text-blue-700">
            👉 <a href={staffRecord.dedicated_portal_url} target="_blank" rel="noreferrer" className="underline">{staffRecord.dedicated_portal_url}/login</a>
          </p>
          <p>Upon your first sign-in, you will be prompted to set a permanent, password.</p>
          <hr className="border-slate-200" />
          <p className="text-slate-400">Securely Synchronized via Hospyn Ledger. System ID: {staffRecord.staff_id}</p>
        </div>
        <div className="p-6 bg-white flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors">
            Confirm Dispatch
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- SQL TRANSPARENCY BADGE ---
export const SqlBadge = ({ sql }) => {
  if (!sql) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[8px] font-mono text-slate-500 ml-2 align-middle" title={sql}>
      <Database size={9} className="text-slate-400" />
      {sql.length > 60 ? sql.substring(0, 57) + '...' : sql}
    </span>
  );
};

// --- SECURE LEDGER LOGIN MODAL ---
const API_BASE = '/api/v1';

export const LedgerLoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fill email if session is active
  useEffect(() => {
    if (isOpen && localStorage.getItem('hospyn_owner_email')) {
      setEmail(localStorage.getItem('hospyn_owner_email'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      if (email.trim() === 'owner@apollo.com') {
        // BYPASS LOGIN FOR LOCAL TESTING
        localStorage.setItem('hospyn_owner_token', 'mock_token_123');
        localStorage.setItem('hospyn_owner_email', email.trim());
        onLoginSuccess({
          name: email.trim(),
          owner_email: email.trim(),
          access_token: 'mock_token_123'
        });
        setIsLoading(false);
        return;
      }

      // Real FastAPI OAuth2 form-data login
      const formBody = new URLSearchParams();
      formBody.append('username', email.trim());
      formBody.append('password', password);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Authentication failed (${res.status})`);
      }

      const data = await res.json();
      // Store real access token
      localStorage.setItem('hospyn_owner_token', data.access_token);
      localStorage.setItem('hospyn_owner_email', email.trim());

      onLoginSuccess({
        name: email.trim(),
        owner_email: email.trim(),
        access_token: data.access_token
      });
    } catch (err) {
      setError(err.message || 'Authentication failed. Check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 font-inter">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="max-w-md w-full bg-white border border-slate-200 rounded-[32px] shadow-2xl overflow-hidden p-8 space-y-6"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="text-violet-600 font-bold text-lg">🔒</span>
            <span className="text-xs font-black uppercase tracking-widest text-slate-800 font-outfit">Hospital Owner Login</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-inter">Hospital Owner Email</label>
            <input 
              type="email" 
              placeholder="e.g. owner@apollo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-violet-400 focus:bg-white transition-all font-semibold"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-inter">Owner Password</label>
            <input 
              type="password" 
              placeholder="Enter secure password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-violet-400 focus:bg-white transition-all font-semibold font-mono"
              autoComplete="off"
            />
          </div>

          {error && <p className="text-[10px] text-rose-600 font-bold font-inter">{error}</p>}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-900/10 disabled:opacity-60"
          >
            {isLoading ? 'Authenticating...' : 'Authenticate Credentials'}
          </button>
        </form>

        <p className="text-[9px] text-slate-400 font-bold text-center uppercase tracking-widest">
          Secured by Hospyn Healthcare Platform.
        </p>
      </motion.div>
    </div>
  );
};
