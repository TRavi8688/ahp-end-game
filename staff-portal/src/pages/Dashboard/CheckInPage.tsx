import React, { useState, useEffect } from 'react';
import { Search, UserCheck, ArrowRight, Printer, AlertCircle } from 'lucide-react';
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

export const CheckInPage: React.FC = () => {
  // Search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selection & Form
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState({
    reason_for_visit: '',
    symptoms: '',
    priority_level: 'normal',
    assigned_doctor_id: '',
  });

  // Flow & Results
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<any>(null);

  // Fetch doctors on mount
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await apiClient.get('/reception/doctors');
        setDoctors(res.data.data || []);
      } catch (err) {
        console.error('Failed to load doctors', err);
      }
    };
    fetchDoctors();
  }, []);

  // Search autocomplete hook
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get(`/reception/patients/search?q=${query}`);
        setSearchResults(res.data.data || []);
      } catch (err) {
        console.error('Patient search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setQuery('');
    setSearchResults([]);
    setForm((prev) => ({
      ...prev,
      symptoms: patient.known_allergies ? `Known Allergies: ${patient.known_allergies}` : '',
    }));
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!form.reason_for_visit.trim()) {
      setError('Reason for visit is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Create manual intake
      const payload = {
        hospyn_id: selectedPatient.id,
        first_name: selectedPatient.first_name,
        last_name: selectedPatient.last_name,
        phone: selectedPatient.phone,
        age: selectedPatient.age || 30,
        gender: selectedPatient.gender || 'Male',
        reason_for_visit: form.reason_for_visit,
        symptoms: form.symptoms || null,
        priority_level: form.priority_level,
      };

      const intakeRes = await apiClient.post('/reception/queue/manual', payload);
      const requestData = intakeRes.data.data;

      // Step 2: Route to doctor if selected
      if (form.assigned_doctor_id) {
        await apiClient.patch(`/reception/queue/${requestData.request_id}/accept`, {
          route_to: 'doctor',
          assigned_doctor_id: form.assigned_doctor_id,
        });
      }

      const assignedDoc = doctors.find((d) => d.id === form.assigned_doctor_id);

      setLastToken({
        token_number: requestData.queue_number,
        patient_name: requestData.patient_name,
        doctor_name: assignedDoc ? `Dr. ${assignedDoc.full_name}` : 'General OPD',
        department: assignedDoc ? assignedDoc.specialization : 'OPD',
        type: form.priority_level === 'emergency' ? 'emergency' : 'walk_in',
        issued_at: new Date().toISOString(),
      });

      // Reset Form
      setSelectedPatient(null);
      setForm({
        reason_for_visit: '',
        symptoms: '',
        priority_level: 'normal',
        assigned_doctor_id: '',
      });
    } catch (err: any) {
      console.error('Check-in failed', err);
      setError(err.response?.data?.detail || 'Failed to check in patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!lastToken) return;
    printToken(lastToken);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 min-h-screen text-slate-100 font-sans">
      <div>
        <h1 className="text-4xl font-black outfit tracking-tighter mb-2">Patient Check-In</h1>
        <p className="text-slate-400 font-medium text-sm">Find existing patients and register their visit to issue a token</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Check-In Card */}
        <div className="md:col-span-2 bg-white/[0.02] border border-white/5 rounded-[32px] p-6 space-y-6">
          {/* Step 1: Find Patient */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold outfit flex items-center gap-2 text-blue-500">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-black">1</span>
              <span>Find Patient</span>
            </h2>

            <div className="relative">
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 pl-12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all font-bold"
                placeholder="Search patient by name or phone..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedPatient(null);
                }}
              />
              <Search className="absolute left-4 top-4 text-slate-500" size={18} />
              {isSearching && (
                <div className="absolute right-4 top-4">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Results dropdown */}
            {searchResults.length > 0 && (
              <div className="bg-[#0b0f19] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto divide-y divide-white/5">
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="w-full text-left p-4 hover:bg-white/5 flex items-center justify-between gap-4 transition-all"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{patient.full_name}</h4>
                      <p className="text-xs text-slate-500">{patient.phone} · {patient.gender} · {patient.age}y</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-500" />
                  </button>
                ))}
              </div>
            )}

            {/* Selected Patient display */}
            {selectedPatient && (
              <div className="bg-blue-600/5 border border-blue-600/20 rounded-2xl p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base text-blue-400">{selectedPatient.full_name}</h3>
                  <p className="text-xs text-slate-400">{selectedPatient.phone} · {selectedPatient.gender} · {selectedPatient.age}y</p>
                </div>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-wider text-slate-300"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Visit Details */}
          {selectedPatient && (
            <form onSubmit={handleCheckIn} className="space-y-6 pt-4 border-t border-white/5">
              <h2 className="text-lg font-bold outfit flex items-center gap-2 text-emerald-500">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-black">2</span>
                <span>Visit Details</span>
              </h2>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Chief Complaint / Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={form.reason_for_visit}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason_for_visit: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all font-medium"
                  placeholder="e.g. Cough and cold, regular check-up"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Priority Level</label>
                  <select
                    value={form.priority_level}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority_level: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-all font-bold"
                  >
                    <option value="normal" className="bg-[#0b0f19]">Normal</option>
                    <option value="urgent" className="bg-[#0b0f19]">Urgent</option>
                    <option value="emergency" className="bg-[#0b0f19]">Emergency</option>
                    <option value="low" className="bg-[#0b0f19]">Low</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Assign Doctor</label>
                  <select
                    value={form.assigned_doctor_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, assigned_doctor_id: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-all font-bold"
                  >
                    <option value="" className="bg-[#0b0f19]">General OPD (No assignment)</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#0b0f19]">
                        Dr. {d.full_name} ({d.specialization})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-white bg-emerald-600 hover:bg-emerald-500 transition-all font-black text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50"
              >
                <UserCheck size={18} />
                <span>{isSubmitting ? 'Checking In...' : 'Complete Check-In'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Token Output Card */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4 text-center">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Last Issued Token</h2>
            {lastToken ? (
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Token Number</span>
                  <div className="text-6xl font-black outfit text-indigo-500 tracking-tighter mt-1">{lastToken.token_number}</div>
                </div>
                <div className="space-y-2 text-left border-t border-white/5 pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase">Patient</span>
                    <span className="font-bold text-slate-200">{lastToken.patient_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold uppercase">Doctor</span>
                    <span className="font-bold text-slate-200">{lastToken.doctor_name}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-slate-600 border border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3">
                <Printer size={32} />
                <span className="text-xs font-bold uppercase tracking-widest">No token issued yet</span>
              </div>
            )}
          </div>

          {lastToken && (
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl text-slate-900 bg-white hover:bg-slate-100 transition-all font-black text-xs uppercase tracking-widest shadow-xl"
            >
              <Printer size={16} />
              <span>Print Token Slip</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckInPage;
