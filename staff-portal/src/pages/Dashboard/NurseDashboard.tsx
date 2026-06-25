import React, { useState, useEffect, useRef } from 'react';
import {
  HeartPulse, Activity, Play, CheckCircle,
  Thermometer, Wind, Droplets, AlertCircle,
} from 'lucide-react';
import apiClient from '../../apiClient';
import { useAuth } from '../../context/AuthContext';

interface TriagePatient {
  id: string;
  queue_number: number;
  full_name: string;
  age: number;
  gender: string;
  reason_for_visit: string;
  priority_level: string;
  queue_state: string;
  wait_minutes: number;
}

const NurseDashboard: React.FC = () => {
  const { user } = useAuth();
  const [queue, setQueue]               = useState<TriagePatient[]>([]);
  const [stats, setStats]               = useState({ total_pending: 0, total_in_triage: 0 });
  const [activePatient, setActivePatient] = useState<TriagePatient | null>(null);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const activePatientRef = useRef<TriagePatient | null>(null);
  activePatientRef.current = activePatient;

  const [vitals, setVitals] = useState({
    heart_rate: '', blood_pressure_systolic: '', blood_pressure_diastolic: '',
    temperature: '', spo2: '', respiratory_rate: '', weight_kg: '',
  });
  const [triageNotes, setTriageNotes] = useState('');
  const [emergencyOverride, setEmergencyOverride] = useState(false);

  // Mirrors triage_service.py's assess_priority_from_vitals() thresholds
  // exactly, so the colors shown here match what the backend will do with
  // the same numbers (auto-escalation on save). Kept in sync deliberately —
  // if those thresholds change server-side, update here too.
  type Severity = 'normal' | 'warning' | 'critical';
  const vitalSeverity = (field: keyof typeof vitals, raw: string): Severity => {
    const v = parseFloat(raw);
    if (raw === '' || Number.isNaN(v)) return 'normal';
    switch (field) {
      case 'spo2':
        return v < 90 ? 'critical' : v < 95 ? 'warning' : 'normal';
      case 'heart_rate':
        return (v > 150 || v < 40) ? 'critical' : (v > 120 || v < 50) ? 'warning' : 'normal';
      case 'blood_pressure_systolic':
        return (v > 180 || v < 80) ? 'warning' : 'normal';
      case 'temperature':
        return v > 104 ? 'warning' : v > 100.4 ? 'warning' : 'normal';
      default:
        return 'normal';
    }
  };
  const severityRing: Record<Severity, string> = {
    normal:   'border-white/10',
    warning:  'border-amber-500/60 ring-1 ring-amber-500/30',
    critical: 'border-rose-500/70 ring-1 ring-rose-500/40',
  };
  const anyCritical = (['spo2', 'heart_rate', 'blood_pressure_systolic', 'temperature'] as const)
    .some((f) => vitalSeverity(f, vitals[f]) === 'critical');

  const fetchQueue = async () => {
    try {
      const res = await apiClient.get('/nurse/queue');
      const q: TriagePatient[] = res.data.data.queue || [];
      setQueue(q);
      setStats({
        total_pending:   res.data.data.total_pending   || 0,
        total_in_triage: res.data.data.total_in_triage || 0,
      });
      // Auto-select first in_triage patient only if none is already selected
      if (!activePatientRef.current) {
        const inProgress = q.find((p) => p.queue_state === 'in_triage');
        if (inProgress) setActivePatient(inProgress);
      }
    } catch (err) {
      console.error('Failed to fetch triage queue', err);
    }
  };

  useEffect(() => {
    fetchQueue();
    // FIXED: was [activePatient] — that caused re-fetch on every patient selection,
    // which reset state mid-fill. Interval polls independently, ref keeps fresh value.
    const interval = setInterval(fetchQueue, 15_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartTriage = async (patient: TriagePatient) => {
    try {
      await apiClient.patch(`/nurse/queue/${patient.id}/start`);
      setActivePatient({ ...patient, queue_state: 'in_triage' });
      fetchQueue();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCompleteTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    setSubmitError(null);
    try {
      await apiClient.patch(`/nurse/queue/${activePatient.id}/complete`, {
        triage_notes: triageNotes,
        // Real backend field (TriageCompletePayload.priority_override) — lets
        // the nurse manually escalate regardless of what the vitals alone
        // would trigger. The backend ALSO auto-escalates from vitals via
        // assess_priority_from_vitals(), independent of this flag — this is
        // for cases the numbers don't fully capture (e.g. clinical judgment).
        priority_override: emergencyOverride ? 'emergency' : undefined,
        vitals: {
          heart_rate:               parseInt(vitals.heart_rate),
          blood_pressure_systolic:  parseInt(vitals.blood_pressure_systolic),
          blood_pressure_diastolic: parseInt(vitals.blood_pressure_diastolic),
          temperature:              parseFloat(vitals.temperature),
          spo2:                     parseInt(vitals.spo2),
          respiratory_rate:         parseInt(vitals.respiratory_rate),
          weight_kg:                parseFloat(vitals.weight_kg),
        },
      });
      setActivePatient(null);
      setVitals({ heart_rate: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', temperature: '', spo2: '', respiratory_rate: '', weight_kg: '' });
      setTriageNotes('');
      setEmergencyOverride(false);
      fetchQueue();
    } catch (err: any) {
      // FIXED: replaced alert() with inline error
      const msg = err.response?.data?.detail || 'Failed to submit triage data. Check vitals formatting.';
      setSubmitError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const priorityClass = (p: string) =>
    p === 'emergency' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
    : p === 'urgent'  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
    : 'bg-white/5 text-slate-400 border-white/10';

  return (
    <div className="min-h-screen p-10 bg-[#050505] text-[#f8fafc]">
      <header className="flex justify-between items-end mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[10px] font-black text-rose-500 tracking-[0.3em] uppercase">Triage Command Center</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter leading-none">Nursing</h1>
          <p className="text-slate-500 text-sm font-medium">
            Welcome back, {user?.name || user?.email}. Managing {stats.total_pending} pending triages.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">

        {/* Triage Queue */}
        <div className={`col-span-12 ${activePatient ? 'lg:col-span-5' : 'lg:col-span-12'} transition-all`}>
          <div className="bg-white/[0.03] border border-white/5 rounded-[40px] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <Activity className="text-rose-500" size={22} />
                <h3 className="text-xl font-black tracking-tight">Triage Queue</h3>
              </div>
              <span className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-xl text-[10px] font-black tracking-widest uppercase">
                {stats.total_pending} Waiting
              </span>
            </div>

            <div className="divide-y divide-white/5">
              {queue.length === 0 && (
                <div className="p-16 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                  Queue is empty
                </div>
              )}

              {queue.filter((p) => p.queue_state === 'in_triage').length > 0 && (
                <div className="px-6 pt-5 pb-1 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                  Active Triage
                </div>
              )}
              {queue.filter((p) => p.queue_state === 'in_triage').map((p) => (
                <NurseQueueRow key={p.id} p={p} activePatient={activePatient} setActivePatient={setActivePatient}
                  handleStartTriage={handleStartTriage} priorityClass={priorityClass} />
              ))}

              {queue.filter((p) => p.queue_state === 'waiting_triage').length > 0 && (
                <div className="px-6 pt-5 pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Waiting
                </div>
              )}
              {queue.filter((p) => p.queue_state === 'waiting_triage').map((p) => (
                <NurseQueueRow key={p.id} p={p} activePatient={activePatient} setActivePatient={setActivePatient}
                  handleStartTriage={handleStartTriage} priorityClass={priorityClass} />
              ))}
            </div>
          </div>
        </div>

        {/* Vitals Capture */}
        {activePatient && (
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="bg-white/[0.03] border border-rose-500/20 rounded-[40px] p-8 relative overflow-hidden shadow-[0_0_100px_rgba(244,63,94,0.05)]">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <HeartPulse size={150} />
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-white border border-white/10 rounded-2xl flex items-center justify-center text-2xl font-black text-black">
                  {activePatient.queue_number}
                </div>
                <div>
                  <h3 className="text-3xl font-black tracking-tighter text-white">{activePatient.full_name}</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                    Reason: {activePatient.reason_for_visit}
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 text-sm font-bold">
                  <AlertCircle size={16} /><span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleCompleteTriage} className="space-y-8 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: HeartPulse, color: 'rose',    field: 'heart_rate' as const,               unit: 'bpm',  label: 'Heart Rate',    step: undefined },
                    { icon: Droplets,   color: 'blue',    field: 'blood_pressure_systolic' as const,  unit: 'sys',  label: 'BP Systolic',   step: undefined },
                    { icon: Thermometer,color: 'amber',   field: 'temperature' as const,              unit: '°F',   label: 'Temperature',   step: '0.1' },
                    { icon: Wind,       color: 'emerald', field: 'spo2' as const,                     unit: '%',    label: 'SpO₂',          step: undefined },
                  ].map(({ icon: Icon, color, field, unit, label, step }) => {
                    const sev = vitalSeverity(field, vitals[field]);
                    return (
                    <div key={field} className={`bg-white/5 border rounded-2xl p-5 transition-all ${severityRing[sev]}`}>
                      <div className="flex items-center justify-between mb-3">
                        <Icon className={`text-${color}-500`} size={24} />
                        {sev !== 'normal' && (
                          <span className={`text-[9px] font-black uppercase tracking-widest ${sev === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>
                            {sev === 'critical' ? 'Critical' : 'Watch'}
                          </span>
                        )}
                      </div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</label>
                      <div className="flex items-end gap-2">
                        <input
                          required type="number" step={step} value={vitals[field]}
                          onChange={(e) => setVitals({ ...vitals, [field]: e.target.value })}
                          className="w-full bg-transparent text-3xl font-black text-white focus:outline-none placeholder-slate-800 p-0"
                          placeholder="—"
                        />
                        <span className="text-xs font-bold text-slate-600 mb-1">{unit}</span>
                      </div>
                    </div>
                  );})}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">BP Diastolic</label>
                    <input required type="number" value={vitals.blood_pressure_diastolic}
                      onChange={(e) => setVitals({ ...vitals, blood_pressure_diastolic: e.target.value })}
                      className="w-full bg-transparent text-xl font-black text-white focus:outline-none" placeholder="80" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Resp. Rate (breaths/min)</label>
                    <input required type="number" value={vitals.respiratory_rate}
                      onChange={(e) => setVitals({ ...vitals, respiratory_rate: e.target.value })}
                      className="w-full bg-transparent text-xl font-black text-white focus:outline-none" placeholder="16" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Weight (kg)</label>
                    <input required type="number" step="0.1" value={vitals.weight_kg}
                      onChange={(e) => setVitals({ ...vitals, weight_kg: e.target.value })}
                      className="w-full bg-transparent text-xl font-black text-white focus:outline-none" placeholder="70.5" />
                  </div>
                </div>

                {anyCritical && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-400 text-sm font-bold">
                    <AlertCircle size={18} className="flex-shrink-0" />
                    One or more vitals are in the critical range — the system will auto-escalate priority on save.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setEmergencyOverride((v) => !v)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    emergencyOverride
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-rose-500/40 hover:text-rose-400'
                  }`}
                >
                  <span className="flex items-center gap-2 font-black text-xs uppercase tracking-widest">
                    <AlertCircle size={16} /> Escalate to Emergency Priority
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    {emergencyOverride ? 'Will escalate on submit' : 'Tap to override'}
                  </span>
                </button>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Triage Notes</label>
                  <textarea
                    required value={triageNotes} onChange={(e) => setTriageNotes(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none h-24"
                    placeholder="Patient reports severe abdominal pain..."
                  />
                </div>

                <button type="submit"
                  className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(225,29,72,0.3)]">
                  <CheckCircle size={18} /> Submit Vitals & Route to Doctor
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NurseDashboard;

// Extracted so the same row markup can be reused for both the
// "Active Triage" and "Waiting" groups above without duplicating JSX.
const NurseQueueRow: React.FC<{
  p: TriagePatient;
  activePatient: TriagePatient | null;
  setActivePatient: (p: TriagePatient) => void;
  handleStartTriage: (p: TriagePatient) => void;
  priorityClass: (p: string) => string;
}> = ({ p, activePatient, setActivePatient, handleStartTriage, priorityClass }) => (
  <div
    className={`p-6 flex items-center justify-between transition-all cursor-pointer ${
      activePatient?.id === p.id
        ? 'bg-white/[0.05] border-l-4 border-l-rose-500'
        : 'hover:bg-white/[0.02]'
    }`}
    onClick={() => { if (p.queue_state === 'in_triage') setActivePatient(p); }}
  >
    <div className="flex items-center gap-6">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border ${priorityClass(p.priority_level)}`}>
        {p.queue_number}
      </div>
      <div className="space-y-1">
        <h4 className="text-lg font-black tracking-tight text-white">{p.full_name}</h4>
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <span>{p.age}y {p.gender[0]}</span>
          <div className="w-1 h-1 rounded-full bg-slate-800" />
          <span>Wait: {p.wait_minutes}m</span>
        </div>
        <p className="text-[10px] text-slate-600">{p.reason_for_visit}</p>
      </div>
    </div>

    {p.queue_state === 'waiting_triage' ? (
      <button
        onClick={(e) => { e.stopPropagation(); handleStartTriage(p); }}
        className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-4 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all flex items-center gap-2"
      >
        <Play size={14} /> Start
      </button>
    ) : (
      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">In Triage</span>
    )}
  </div>
);
