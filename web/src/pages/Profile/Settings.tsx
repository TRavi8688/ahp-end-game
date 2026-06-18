// partner-app/src/pages/Profile/Settings.tsx
//
// BUG FIX: Business name and email were hardcoded strings.
// "Save Changes" button did nothing.
// Now wired to useAuth() for real data + PATCH /api/v1/partner/auth/me.
// Also exposes logout action properly.

import React, { useState, useEffect } from 'react';
import { User, Shield, Bell, CreditCard, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/apiClient';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();

  const [tab, setTab] = useState<'profile' | 'security' | 'notifications' | 'payouts'>('profile');

  // Profile state
  const [businessName, setBusinessName] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saveOk, setSaveOk]     = useState(false);
  const [saveErr, setSaveErr]   = useState('');

  useEffect(() => {
    if (user?.business_name) setBusinessName(user.business_name);
  }, [user]);

  const handleSave = async () => {
    setSaving(true); setSaveOk(false); setSaveErr('');
    try {
      await apiClient.patch('/api/v1/partner/auth/me', { name: businessName });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err: any) {
      setSaveErr(err?.response?.data?.detail || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const navItems = [
    { id: 'profile',       label: 'Profile Details',  icon: <User size={18} />       },
    { id: 'security',      label: 'Security',          icon: <Shield size={18} />     },
    { id: 'notifications', label: 'Notifications',     icon: <Bell size={18} />       },
    { id: 'payouts',       label: 'Payouts',           icon: <CreditCard size={18} /> },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-white">Business Profile</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your partner account settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Nav */}
        <div className="space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                tab === item.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-white/10">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-medium text-sm"
            >
              ← Logout
            </button>
          </div>
        </div>

        {/* Content Panel */}
        <div className="col-span-2 glass-panel p-6 space-y-6">
          {tab === 'profile' && (
            <>
              <h2 className="text-xl font-bold text-white mb-4">Profile Information</h2>

              {saveErr && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {saveErr}
                </div>
              )}
              {saveOk && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Changes saved successfully.
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="glass-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email Address</label>
                  {/* Email is immutable — show read-only */}
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                    className="glass-input opacity-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Contact support to change your email.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Partner Code</label>
                  <input
                    type="text"
                    value={user?.partner_code ?? '—'}
                    disabled
                    className="glass-input opacity-50 cursor-not-allowed font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Verification Status</label>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    user?.verification_status === 'approved'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : user?.verification_status === 'rejected'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {user?.verification_status === 'approved' && <CheckCircle2 className="w-4 h-4" />}
                    {(user?.verification_status ?? 'pending').charAt(0).toUpperCase() + (user?.verification_status ?? 'pending').slice(1)}
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="glass-button w-full mt-4 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
                </button>
              </div>
            </>
          )}

          {tab === 'security' && (
            <>
              <h2 className="text-xl font-bold text-white mb-4">Security</h2>
              <p className="text-slate-400 text-sm">
                Password change and two-factor authentication settings will be available in the next release.
                For urgent security concerns, contact <span className="text-primary">support@hospyn.in</span>.
              </p>
            </>
          )}

          {tab === 'notifications' && (
            <>
              <h2 className="text-xl font-bold text-white mb-4">Notifications</h2>
              <p className="text-slate-400 text-sm">
                Notification preferences (email, SMS, push) will be configurable in an upcoming update.
              </p>
            </>
          )}

          {tab === 'payouts' && (
            <>
              <h2 className="text-xl font-bold text-white mb-4">Payout Settings</h2>
              <p className="text-slate-400 text-sm">
                Configure your bank account for commission payouts.
                View your payout history on the{' '}
                <a href="/referrals" className="text-primary hover:underline">Referrals page</a>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
