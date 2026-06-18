import React, { useState, useEffect } from 'react';
import { Search, UserCheck, ArrowRight, Printer, AlertCircle } from 'lucide-react';
// FIXED: import from canonical apiClient
import apiClient from '../../apiClient';
import { printToken } from '../../utils/printToken';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  known_allergies?: string;
  chronic_conditions?: string;
}

interface Doctor {
  id: string;
  full_name: string;
  specialization: string;
  active_load: number;
}

// FIXED: was only a named export — App.tsx does `import CheckInPage from ...` (default import)
const CheckInPage: React.FC = () => {
  const [query, setQuery]               = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching]   = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors]           = useState<Doctor[]>([]);
  const [form, setForm] = useState({
    reason_for_visit: '',
    symptoms:          '',
    priority_level:    'normal',
    assigned_doctor_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastToken, setLastToken]       = useState<any>(null);

  useEffect(() => {
    apiClient.get('/reception/doctors')
      .then(res => setDoctors(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get(`/reception/patients/search?q=${encodeURIComponent(query)}`);
        setSearchResults(res.data.data || []);
      } catch { /* swallow */ } finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setQuery('');
    setSearchResults([]);
    setForm(prev => ({
      ...prev,
      symptoms: p.known_allergies ? `Known Allergies: ${p.known_allergies}` : '',
    }));
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!form.reason_for_visit.trim()) { setError('Reason for visit is required'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post('/reception/queue/manual', {
        hospyn_id:        selectedPatient.id,
        first_name:       selectedPatient.first_name,
        last_name:        selectedPatient.last_name,
        phone:            selectedPatient.phone,
        age:              selectedPatient.age || 30,
        gender:           selectedPatient.gender || 'Male',
        reason_for_visit: form.reason_for_visit,
        symptoms:         form.symptoms || null,
        priority_level:   form.priority_level,
      });
      const data = res.data.data;

      if (form.assigned_doctor_id) {
        await apiClient.patch(`/reception/queue/${data.request_id}/accept`, {
          route_to:            'doctor',
          assigned_doctor_id:  form.assigned_doctor_id,
        });
      }

      const doc = doctors.find(d => d.id === form.assigned_doctor_id);
      setLastToken({
        token_number: data.queue_number,
        patient_name: data.patient_name || selectedPatient.full_name,
        doctor_name:  doc ? `Dr. ${doc.full_name}` : 'General OPD',
        department:   doc ? doc.specialization : 'OPD',
        type:         form.priority_level === 'emergency' ? 'emergency' : 'walk_in',
        issued_at:    new Date().toISOString(),
      });

      setSelectedPatient(null);
      setForm({ reason_for_visit: '', symptoms: '', priority_level: 'normal', assigned_doctor_id: '' });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Check-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 min-h-screen text-slate-100">
      <div>
        <h1 className="text-4xl font-black tracking-tighter mb-2">Patient Check-In</h1>
        <p className="text-slate-400 text-sm">Find existing patients and issue a queue token</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white/[0.02] border border-white/5 rounded-[32px] p-6 space-y-6">

          {/* Step 1: Find Patient */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2 text-blue-500">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-black">1</span>
              Find Patient
            </h2>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 pl-12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                placeholder="Search by name or phone..."
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedPatient(null); }}
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="bg-[#0b0f19] border border-white/10 rounded-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-white/5">
                {searchResults.map(p => (
                  <button key={p.id} onClick={() => handleSelectPatient(p)}
                    className="w-full text-left p-4 hover:bg-white/5 flex items-center justify-between gap-4 transition-all">
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{p.full_name}</h4>
                      <p className="text-xs text-slate-500">{p.phone} · {p.gender} · {p.age}y</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-500" />
                  </button>
                ))}
              </div>
            )}

            {selectedPatient && (
              <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base text-blue-400">{selectedPatient.full_name}</h3>
                  <p className="text-xs text-slate-400">{selectedPatient.phone} · {selectedPatient.gender} · {selectedPatient.age}y</p>
                </div>
                <button onClick={() => setSelectedPatient(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold uppercase text-slate-300">
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Visit details */}
          {selectedPatient && (
            <form onSubmit={handleCheckIn} className="space-y-5 pt-4 border-t border-white/5">
              <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-500">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-black">2</span>
                Visit Details
              </h2>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Chief Complaint *</label>
                <textarea rows={3} required value={form.reason_for_visit}
                  onChange={e => setForm(p => ({ ...p, reason_for_visit: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                  placeholder="e.g. Cough and cold, routine check-up" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Priority</label>
                  <select value={form.priority_level} onChange={e => setForm(p => ({ ...p, priority_level: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-all">
                    <option value="normal" className="bg-[#0b0f19]">Normal</option>
                    <option value="urgent" className="bg-[#0b0f19]">Urgent</option>
                    <option value="emergency" className="bg-[#0b0f19]">Emergency</option>
                    <option value="low" className="bg-[#0b0f19]">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Assign Doctor</label>
                  <select value={form.assigned_doctor_id} onChange={e => setForm(p => ({ ...p, assigned_doctor_id: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-all">
                    <option value="" className="bg-[#0b0f19]">General OPD</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id} className="bg-[#0b0f19]">Dr. {d.full_name} ({d.specialization})</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-white bg-emerald-600 hover:bg-emerald-500 transition-all font-black text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50">
                <UserCheck size={18} />
                {isSubmitting ? 'Checking In...' : 'Complete Check-In'}
              </button>
            </form>
          )}
        </div>

        {/* Token card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4 text-center">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Last Issued Token</h2>
            {lastToken ? (
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Token</span>
                  <div className="text-6xl font-black text-indigo-500 tracking-tighter mt-1">{lastToken.token_number}</div>
                </div>
                <div className="space-y-1 text-left border-t border-white/5 pt-3 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Patient</span><span className="font-bold">{lastToken.patient_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Doctor</span><span className="font-bold">{lastToken.doctor_name}</span></div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-slate-600 border border-dashed border-white/5 rounded-3xl flex flex-col items-center gap-3">
                <Printer size={28} />
                <span className="text-xs font-bold uppercase tracking-widest">No token yet</span>
              </div>
            )}
          </div>
          {lastToken && (
            <button onClick={() => printToken(lastToken)}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl text-slate-900 bg-white hover:bg-slate-100 transition-all font-black text-xs uppercase tracking-widest shadow-xl">
              <Printer size={16} /> Print Token Slip
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// FIXED: both named and default export so App.tsx `import CheckInPage from ...` works
export { CheckInPage };
export default CheckInPage;
