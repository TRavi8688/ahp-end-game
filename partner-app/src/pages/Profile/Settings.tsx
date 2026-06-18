import React from 'react';
import { User, Shield, Bell, CreditCard } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-white">Business Profile</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your partner account settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-xl font-bold">
            <User size={18} /> Profile Details
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-white/5 rounded-xl transition-all">
            <Shield size={18} /> Security
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-white/5 rounded-xl transition-all">
            <Bell size={18} /> Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-white/5 rounded-xl transition-all">
            <CreditCard size={18} /> Payouts
          </button>
        </div>

        <div className="col-span-2 glass-panel p-6 space-y-6">
          <h2 className="text-xl font-bold text-white mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Business Name</label>
              <input type="text" className="glass-input" defaultValue="Hospyn Demo Partner" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email Address</label>
              <input type="email" className="glass-input" defaultValue="partner@hospyn.com" disabled />
            </div>
            <button className="glass-button w-full mt-4">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
