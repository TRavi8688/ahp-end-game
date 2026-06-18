import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Activity, ArrowRight, UserPlus, Loader2 } from 'lucide-react';
// FIXED: was importing from '../apiClient' (one level up, wrong for pages/WalkInPage.tsx)
import apiClient from '../apiClient';

const WalkInPage: React.FC = () => {
  const { signedToken } = useParams<{ signedToken: string }>();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    age: '',
    gender: 'Male',
    reason_for_visit: '',
    symptoms: '',
    is_emergency: false,
  });

  const [status, setStatus]           = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resultData, setResultData]   = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const payload = { ...formData, age: parseInt(formData.age, 10) };
      // FIXED: endpoint must be /walkin/join/:token — was correct, keeping it
      const response = await apiClient.post(`/walkin/join/${signedToken}`, payload);
      setResultData(response.data.data);
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      const detail = err.response?.data?.detail;
      setErrorMessage(
        typeof detail === 'string'
          ? detail
          : detail?.message || 'Failed to submit. Please try again.'
      );
    }
  };

  if (status === 'success' && resultData) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/[0.03] border border-white/5 rounded-[40px] p-10 text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
            <CheckCircle className="text-emerald-500 w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">You're in Queue</h1>
          <p className="text-slate-400 text-sm mb-10">{resultData.message}</p>

          <div className="space-y-4 mb-10 text-left">
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Queue Number</span>
              <span className="text-4xl font-black text-indigo-500">{resultData.queue_number}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Position</span>
                <span className="text-2xl font-black text-white">{resultData.position_in_queue}</span>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Est. Wait</span>
                <span className="text-2xl font-black text-white">
                  {resultData.estimated_wait_minutes}
                  <span className="text-sm font-medium text-slate-500 ml-1">min</span>
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
            {resultData.hospital_name}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 py-12">
      <div className="w-full max-w-xl bg-white/[0.03] border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-[18px] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <Activity className="text-indigo-500 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Hospyn Walk-In</h1>
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">QR Patient Intake</p>
          </div>
        </div>

        {status === 'error' && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-bold tracking-wide mb-8">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">First Name</label>
              <input type="text" required value={formData.first_name}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="John" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Last Name</label>
              <input type="text" required value={formData.last_name}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Doe" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Phone</label>
              <input type="tel" required value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="9876543210" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Age</label>
                <input type="number" required value={formData.age}
                  onChange={e => setFormData({ ...formData, age: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="30" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Gender</label>
                <select required value={formData.gender}
                  onChange={e => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Reason for Visit</label>
            <textarea required value={formData.reason_for_visit}
              onChange={e => setFormData({ ...formData, reason_for_visit: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-24"
              placeholder="Briefly describe why you are here..." />
          </div>

          <label className="flex items-center gap-3 p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl cursor-pointer hover:bg-rose-500/10 transition-all">
            <input type="checkbox" checked={formData.is_emergency}
              onChange={e => setFormData({ ...formData, is_emergency: e.target.checked })}
              className="w-5 h-5 rounded" />
            <div>
              <span className="block text-sm font-black text-rose-500 tracking-tight">This is an Emergency</span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">I need immediate medical attention</span>
            </div>
          </label>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_40px_rgba(79,70,229,0.3)] mt-8"
          >
            {status === 'submitting' ? (
              <><Loader2 size={16} className="animate-spin" /> Processing...</>
            ) : (
              <>Join Queue <ArrowRight size={16} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WalkInPage;
