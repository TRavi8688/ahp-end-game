/**
 * hospain-v2-web/src/components/QuickRegister.jsx
 *
 * FIXES:
 *  1. Uses api.js get/post helpers (env-driven base URL, no hardcoded /api/v1)
 *  2. Endpoint: GET /onboarding/hospital-public-info/:id  (new backend route)
 *  3. Endpoint: POST /walkin/public/quick-register        (new backend route)
 *  4. Removed bare window.location.search — uses URLSearchParams properly
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Activity, User, Calendar, MapPin, CheckCircle, ArrowRight } from 'lucide-react';
import { get, post } from '../lib/api';

const QuickRegister = () => {
  const urlParams   = new URLSearchParams(window.location.search);
  const hospitalId  = urlParams.get('hospital_id') || '';

  const [formData, setFormData] = useState({ name: '', age: '', phone: '', reason: '' });
  const [status,       setStatus]      = useState('idle');
  const [errorMsg,     setErrorMsg]    = useState('');
  const [hospitalInfo, setHospitalInfo] = useState(null);

  useEffect(() => {
    if (!hospitalId) return;
    get(`/onboarding/hospital-public-info/${hospitalId}`)
      .then(setHospitalInfo)
      .catch((err) => console.error('Could not fetch hospital info', err));
  }, [hospitalId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hospitalId) {
      setErrorMsg('Invalid QR Code: Missing Hospital ID.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    try {
      await post('/walkin/public/quick-register', {
        hospital_id: hospitalId,
        name:        formData.name,
        phone:       formData.phone || '0000000000',
        age:         parseInt(formData.age, 10),
        reason:      formData.reason,
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'An error occurred during check-in.');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-inter">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={48} className="text-emerald-500" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit">Checked In!</h1>
          <p className="text-slate-500 font-medium leading-relaxed">
            Your digital token has been sent directly to the doctor's screen. Please take a seat in the waiting area.
          </p>
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Queue Status</span>
            <span className="text-indigo-600 font-black tracking-widest uppercase">Active on Console</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-inter p-6 flex flex-col items-center">
      <div className="w-full max-w-md text-center pt-8 pb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full mb-6">
          <ShieldCheck size={16} className="text-indigo-600" />
          <span className="text-[10px] font-black tracking-widest uppercase text-indigo-700">Hospain Secure Check-in</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit mb-3">
          Patient Registration
        </h1>
        {hospitalInfo ? (
          <p className="text-slate-500 font-semibold flex items-center justify-center gap-2">
            <MapPin size={16} className="text-slate-400" />
            {hospitalInfo.hospital_name || 'Hospain Partner Clinic'}
          </p>
        ) : (
          <p className="text-slate-500 text-sm font-medium">Scan successful. Please enter your details.</p>
        )}
      </div>

      <div className="w-full max-w-md bg-white rounded-[32px] shadow-xl border border-slate-100 p-8">
        {status === 'error' && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-2xl flex items-center gap-3">
            <Activity size={20} className="shrink-0" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Full Name</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                placeholder="Enter your name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Age</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  required
                  min="0"
                  max="120"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="e.g. 34"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Phone (Optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-900 font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                placeholder="Number"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Reason for Visit</label>
            <textarea
              required
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-slate-900 font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all min-h-[120px] resize-none"
              placeholder="Briefly describe your symptoms (e.g. Fever, Headache, Routine Checkup)..."
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-[0_8px_30px_rgb(79,70,229,0.3)] transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              {status === 'loading' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Generate Digital Token</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mt-8">
          Powered by Hospain Immutable Ledger
        </p>
      </div>
    </div>
  );
};

export default QuickRegister;
