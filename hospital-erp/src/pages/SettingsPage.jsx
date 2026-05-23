import React, { useState } from 'react';
import { Shield, Building, Users, CreditCard, Bell, Lock, Save, Plus, Trash2, Camera, Key, Check } from 'lucide-react';

const SettingsPage = () => {
  const [hospitalInfo, setHospitalInfo] = useState({
    name: 'Singapore Central Hospital',
    reg_no: 'SGP-1092-X',
    status: 'ACTIVE'
  });

  const [personalInfo, setPersonalInfo] = useState({
    name: 'Admin User',
    hospyn_id: 'HSP-SGP-001',
    phone: '+65 9123 4567'
  });

  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [otpStep, setOtpStep] = useState(1);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  // New states for Photo & Password
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [photoUrl, setPhotoUrl] = useState(null);

  const handlePhotoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setPhotoUrl(url);
    }
  };

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
              <Users className="text-indigo-500" /> Personal Profile
            </h2>
            
            <div className="flex items-center gap-6 mb-8">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center overflow-hidden">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={32} className="text-slate-500" />
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera size={24} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
              <div>
                <h3 className="font-bold text-lg">{personalInfo.name}</h3>
                <p className="text-slate-500 text-sm font-medium">Update your profile picture here.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Full Name</label>
                <input 
                  type="text" 
                  value={personalInfo.name}
                  onChange={(e) => setPersonalInfo({...personalInfo, name: e.target.value})}
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Sovereign Hospyn ID</label>
                <div className="w-full bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl font-mono font-bold text-indigo-400">
                  {personalInfo.hospyn_id}
                </div>
                <p className="text-[10px] text-slate-500">Locked permanently.</p>
              </div>
              <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Mobile Number</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={personalInfo.phone}
                    disabled
                    className="flex-1 bg-black/40 border border-white/5 p-4 rounded-2xl outline-none transition-all font-bold opacity-70" 
                  />
                  <button 
                    onClick={() => { setOtpStep(1); setNewPhone(''); setIsPhoneModalOpen(true); }}
                    className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-6 rounded-2xl font-bold hover:bg-indigo-600/40 transition-colors"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              <button className="bg-indigo-600 px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20">
                <Save size={18} />
                Save Profile
              </button>
              <button 
                onClick={() => setIsPasswordModalOpen(true)}
                className="text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                <Key size={16} />
                Change Password
              </button>
            </div>
          </div>

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
                  onChange={(e) => setHospitalInfo({...hospitalInfo, name: e.target.value})}
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Registration Number</label>
                <input 
                  type="text" 
                  value={hospitalInfo.reg_no}
                  onChange={(e) => setHospitalInfo({...hospitalInfo, reg_no: e.target.value})}
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold" 
                />
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

      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Update Mobile Number</h3>
            {otpStep === 1 ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Enter your new mobile number to receive a verification OTP.</p>
                <input 
                  type="text" 
                  placeholder="New mobile number" 
                  value={newPhone} 
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-black/40 border border-slate-700 p-4 rounded-2xl outline-none"
                />
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setIsPhoneModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                  <button onClick={() => { setPhoneLoading(true); setTimeout(() => { setPhoneLoading(false); setOtpStep(2); }, 1000); }} disabled={!newPhone || phoneLoading} className="bg-indigo-600 px-6 py-2 rounded-xl font-bold">
                    {phoneLoading ? 'Sending...' : 'Send OTP'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Enter the 6-digit OTP sent to {newPhone}.</p>
                <input 
                  type="text" 
                  placeholder="6-digit OTP" 
                  value={phoneOtp} 
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  className="w-full bg-black/40 border border-slate-700 p-4 rounded-2xl outline-none"
                />
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setIsPhoneModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                  <button onClick={() => { 
                    setPhoneLoading(true); 
                    setTimeout(() => { 
                      setPhoneLoading(false); 
                      setPersonalInfo({...personalInfo, phone: newPhone});
                      setIsPhoneModalOpen(false); 
                    }, 1000); 
                  }} disabled={!phoneOtp || phoneLoading} className="bg-indigo-600 px-6 py-2 rounded-xl font-bold">
                    {phoneLoading ? 'Verifying...' : 'Verify & Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Key className="text-indigo-500" /> Change Password
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Current Password</label>
                <input 
                  type="password" 
                  value={passwords.current}
                  onChange={e => setPasswords({...passwords, current: e.target.value})}
                  className="w-full bg-black/40 border border-slate-700 p-4 rounded-2xl outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">New Password</label>
                <input 
                  type="password" 
                  value={passwords.new}
                  onChange={e => setPasswords({...passwords, new: e.target.value})}
                  className="w-full bg-black/40 border border-slate-700 p-4 rounded-2xl outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Confirm New Password</label>
                <input 
                  type="password" 
                  value={passwords.confirm}
                  onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                  className="w-full bg-black/40 border border-slate-700 p-4 rounded-2xl outline-none"
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  onClick={() => setIsPasswordModalOpen(false)} 
                  className="px-4 py-2 text-slate-400 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setIsPasswordModalOpen(false)} 
                  className="bg-indigo-600 px-6 py-2 rounded-xl font-bold flex items-center gap-2"
                >
                  <Check size={18} /> Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
