import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../apiClient';
import { ShieldCheck, User, Lock, Activity } from 'lucide-react';
import { API_BASE_URL } from '../api';

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });
  
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Invalid or missing invitation token.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setStatus('error');
      setErrorMsg('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setStatus('error');
      setErrorMsg('Password must be at least 8 characters');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await apiClient.post(`/auth/activate-onboarding`, {
        token: token,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName
      });

      setStatus('success');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.detail || 'Failed to activate account. The link may have expired.');
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] font-inter flex items-center justify-center p-6 selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0f172a] rounded-[32px] border border-white/5 shadow-2xl relative z-10 overflow-hidden">
        <div className="p-8 border-b border-white/5 bg-white/[0.02]">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <ShieldCheck size={32} className="text-indigo-400" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-center text-white outfit tracking-tight">Activate Your Profile</h2>
          <p className="text-center text-slate-500 text-sm mt-2 font-medium">Hospyn Clinical Intelligence Grid</p>
        </div>

        <div className="p-8">
          {status === 'success' ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Activity size={36} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Account Provisioned</h3>
              <p className="text-slate-400 text-sm">Your secure credentials have been generated. Redirecting to terminal...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {status === 'error' && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-bold text-center">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">First Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      type="text" 
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full bg-[#050810] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-indigo-500 transition-colors text-sm"
                      placeholder="Jane"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Last Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="w-full bg-[#050810] border border-white/5 rounded-xl py-3 px-4 text-white outline-none focus:border-indigo-500 transition-colors text-sm"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Secure Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="password" 
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-[#050810] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-indigo-500 transition-colors text-sm font-mono"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="password" 
                    required
                    minLength={8}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full bg-[#050810] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-indigo-500 transition-colors text-sm font-mono"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={status === 'loading' || !token}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all mt-4"
              >
                {status === 'loading' ? 'Provisioning...' : 'Activate Credentials'}
              </button>

            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
