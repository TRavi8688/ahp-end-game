import React, { useState, useEffect } from 'react';
import { Shield, Building, Users, CreditCard, Bell, Lock, Save, Plus, Trash2, Camera, Key, Check } from 'lucide-react';
import apiClient from '../apiClient';

  const [activeTab, setActiveTab] = useState('Organization Profile');
  const [departments, setDepartments] = useState([]);

  const [hospitalInfo, setHospitalInfo] = useState({
    name: '',
    reg_no: '',
    status: 'ACTIVE'
  });

  const [personalInfo, setPersonalInfo] = useState({
    name: '',
    hospyn_id: '',
    phone: ''
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

  useEffect(() => {
    // Load initial user data from local storage
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setPersonalInfo({
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
          hospyn_id: user.hospyn_id || 'HSP-000-000',
          phone: user.email || '' // We are using email column for phone/email in MVP
        });
        if (user.profile_photo_url) {
          setPhotoUrl(user.profile_photo_url);
        }
      }
    } catch (e) {}

    fetchMetadata();
    fetchDepartments();
  }, []);

  const fetchMetadata = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await apiClient.get('/hospital-settings/metadata', { headers: { Authorization: `Bearer ${token}` } });
      setHospitalInfo({
        name: res.data.name || '',
        reg_no: res.data.registration_number || '',
        status: res.data.status || 'ACTIVE'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await apiClient.get('/hospital-settings/departments', { headers: { Authorization: `Bearer ${token}` } });
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveMetadata = async () => {
    try {
      const token = localStorage.getItem('token');
      await apiClient.put('/hospital-settings/metadata', {
        name: hospitalInfo.name,
        registration_number: hospitalInfo.reg_no
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Hospital metadata updated successfully!');
    } catch (err) {
      alert('Failed to update hospital metadata.');
    }
  };

  const handleAddDepartment = async () => {
    const name = prompt("Enter new department name:");
    if (!name) return;
    try {
      const token = localStorage.getItem('token');
      await apiClient.post('/hospital-settings/departments', { name }, { headers: { Authorization: `Bearer ${token}` } });
      fetchDepartments();
    } catch (err) {
      alert('Failed to add department. Are you an Admin?');
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this department?")) return;
    try {
      const token = localStorage.getItem('token');
      await apiClient.delete(`/hospital-settings/departments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchDepartments();
    } catch (err) {
      alert('Failed to delete department. Staff might be assigned to it.');
    }
  };

  const handlePhotoUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setPhotoUrl(url); // Optimistic UI update
      
      try {
        const token = localStorage.getItem('token');
        const res = await apiClient.post('/profile/photo', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Update local storage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.profile_photo_url = res.data.profile_photo_url;
          localStorage.setItem('user', JSON.stringify(user));
        }
        alert('Profile photo updated securely!');
      } catch (err) {
        console.error(err);
        alert('Failed to update photo.');
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const parts = personalInfo.name.trim().split(' ');
      const first_name = parts[0];
      const last_name = parts.slice(1).join(' ');
      
      await apiClient.put('/profile/profile', {
        first_name,
        last_name
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.first_name = first_name;
        user.last_name = last_name;
        localStorage.setItem('user', JSON.stringify(user));
      }
      alert('Profile updated securely!');
    } catch (err) {
      alert('Failed to update profile.');
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
              { icon: Building, label: 'Organization Profile' },
              { icon: Shield, label: 'Security & Auth' },
              { icon: Bell, label: 'Notifications' },
              { icon: Lock, label: 'Privacy Settings' },
            ].map((item, i) => (
              <button 
                key={i} 
                onClick={() => setActiveTab(item.label)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === item.label ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
              >
                <item.icon size={20} />
                <span className="font-bold text-sm tracking-wide">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-8">
          
          {activeTab === 'Security & Auth' && (
            <div className="glass-card p-10 animate-fade-in">
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
              <button 
                onClick={handleSaveProfile}
                className="bg-indigo-600 px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20"
              >
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
          )}

          {activeTab === 'Organization Profile' && (
            <>
          <div className="glass-card p-10 animate-fade-in">
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

            <button 
              onClick={handleSaveMetadata}
              className="bg-indigo-600 px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20"
            >
              <Save size={18} />
              Save Changes
            </button>
          </div>

          <div className="glass-card p-10 animate-fade-in">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <Users className="text-indigo-500" /> Departments
              </h2>
              <button onClick={handleAddDepartment} className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors">
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {departments.length === 0 && <p className="text-slate-500 italic">No departments configured.</p>}
              {departments.map((dept) => (
                <div key={dept.id} className="flex justify-between items-center p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-indigo-500/30 transition-all group">
                  <span className="font-bold tracking-wide">{dept.name}</span>
                  <button onClick={() => handleDeleteDepartment(dept.id)} className="text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
            </>
          )}

          {/* Placeholder for other tabs */}
          {['Notifications', 'Privacy Settings'].includes(activeTab) && (
            <div className="glass-card p-10 text-center text-slate-500 py-20 animate-fade-in">
              <p className="font-bold">This module is currently under development.</p>
            </div>
          )}
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
                  <button 
                    onClick={async () => { 
                      setPhoneLoading(true); 
                      try {
                        const token = localStorage.getItem('token');
                        await apiClient.post('/profile/phone/request-otp', { phone_number: newPhone }, { headers: { Authorization: `Bearer ${token}` } });
                        setOtpStep(2); 
                      } catch (err) {
                        alert('Failed to request OTP');
                      } finally {
                        setPhoneLoading(false);
                      }
                    }} 
                    disabled={!newPhone || phoneLoading} 
                    className="bg-indigo-600 px-6 py-2 rounded-xl font-bold"
                  >
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
                  <button 
                    onClick={async () => { 
                      setPhoneLoading(true); 
                      try {
                        const token = localStorage.getItem('token');
                        await apiClient.post('/profile/phone/verify-otp', { phone_number: newPhone, otp: phoneOtp }, { headers: { Authorization: `Bearer ${token}` } });
                        setPersonalInfo({...personalInfo, phone: newPhone});
                        
                        const userStr = localStorage.getItem('user');
                        if (userStr) {
                          const user = JSON.parse(userStr);
                          user.email = newPhone; // Using email field as main contact ID
                          localStorage.setItem('user', JSON.stringify(user));
                        }
                        
                        alert('Phone number verified securely!');
                        setIsPhoneModalOpen(false); 
                      } catch (err) {
                        alert('Invalid OTP');
                      } finally {
                        setPhoneLoading(false);
                      }
                    }} 
                    disabled={!phoneOtp || phoneLoading} 
                    className="bg-indigo-600 px-6 py-2 rounded-xl font-bold"
                  >
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
                  onClick={async () => {
                    if (passwords.new !== passwords.confirm) {
                      alert('New passwords do not match');
                      return;
                    }
                    try {
                      const token = localStorage.getItem('token');
                      await apiClient.put('/profile/password', {
                        current_password: passwords.current,
                        new_password: passwords.new
                      }, { headers: { Authorization: `Bearer ${token}` } });
                      
                      alert('Password updated securely!');
                      setIsPasswordModalOpen(false);
                      setPasswords({ current: '', new: '', confirm: '' });
                    } catch (err) {
                      alert('Failed to update password: ' + (err.response?.data?.detail || err.message));
                    }
                  }} 
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
