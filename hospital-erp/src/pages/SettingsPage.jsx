import React, { useState } from 'react';
import { Shield, Building, Users, CreditCard, Bell, Lock, Save, Plus, Trash2 } from 'lucide-react';

const SettingsPage = () => {
  const [hospitalInfo, setHospitalInfo] = useState({
    name: 'Singapore Central Hospital',
    reg_no: 'SGP-1092-X',
    hospyn_id: 'HSP-SGP-001',
    status: 'ACTIVE'
  });

  return (
    <div className="p-12 bg-[#050810] min-h-screen text-white font-outfit">
      <header className="mb-12">
        <h1 className="text-4xl font-black tracking-tighter mb-2">System Governance</h1>
        <p className="text-slate-500 text-sm font-bold tracking-wide uppercase">Hospital Configuration & Sovereign Control</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Sidebar */}
        <div className="glass-card p-6 h-fit">
          <nav className="space-y-2">
            {[
              { icon: Building, label: 'Organization Profile', active: true },
              { icon: Users, label: 'Department Structure', active: false },
              { icon: Shield, label: 'Security & Auth', active: false },
              { icon: CreditCard, label: 'Subscription & Billing', active: false },
              { icon: Bell, label: 'Notifications', active: false },
              { icon: Lock, label: 'Privacy Settings', active: false },
            ].map((item, i) => (
              <button key={i} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${item.active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
                <item.icon size={20} />
                <span className="font-bold text-sm tracking-wide">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-10">
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
              <Building className="text-indigo-500" /> Organizational Metadata
            </h2>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Hospital Legal Name</label>
                <input 
                  type="text" 
                  value={hospitalInfo.name}
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Registration Number</label>
                <input 
                  type="text" 
                  value={hospitalInfo.reg_no}
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Sovereign Hospyn ID</label>
                <div className="w-full bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl font-mono font-bold text-indigo-400">
                  {hospitalInfo.hospyn_id}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Node Status</label>
                <div className="w-full bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl font-bold text-emerald-400 flex items-center gap-2">
                  <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                  {hospitalInfo.status}
                </div>
              </div>
            </div>

            <button className="bg-indigo-600 px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20">
              <Save size={18} />
              Save Changes
            </button>
          </div>

          <div className="glass-card p-10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <Users className="text-indigo-500" /> Departments
              </h2>
              <button className="p-2 bg-indigo-600 rounded-xl">
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {['Cardiology', 'Emergency', 'Pediatrics', 'Radiology'].map((dept, i) => (
                <div key={i} className="flex justify-between items-center p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-indigo-500/30 transition-all group">
                  <span className="font-bold tracking-wide">{dept}</span>
                  <button className="text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
