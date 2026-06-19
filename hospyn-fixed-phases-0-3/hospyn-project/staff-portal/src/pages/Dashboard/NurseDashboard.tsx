import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, 
  Activity,
  AlertTriangle,
  Play,
  CheckCircle,
  Thermometer,
  Wind,
  Droplets,
  MoreVertical
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
  const [queue, setQueue] = useState<TriagePatient[]>([]);
  const [stats, setStats] = useState({ total_pending: 0, total_in_triage: 0 });
  const [activePatient, setActivePatient] = useState<TriagePatient | null>(null);
  
  // Vitals Form State
  const [vitals, setVitals] = useState({
    heart_rate: '', blood_pressure_systolic: '', blood_pressure_diastolic: '',
    temperature: '', spo2: '', respiratory_rate: '', weight_kg: ''
  });
  const [triageNotes, setTriageNotes] = useState('');

  const fetchQueue = async () => {
    try {
      const res = await apiClient.get('/nurse/queue');
      setQueue(res.data.data.queue);
      setStats({
        total_pending: res.data.data.total_pending,
        total_in_triage: res.data.data.total_in_triage
      });
      // Auto-select first in_triage patient if none selected
      if (!activePatient) {
        const inProgress = res.data.data.queue.find((p: any) => p.queue_state === 'in_triage');
        if (inProgress) setActivePatient(inProgress);
      }
    } catch (err) {
      console.error('Failed to fetch triage queue', err);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [activePatient]);

  const handleStartTriage = async (patient: TriagePatient) => {
    try {
      await apiClient.patch(`/nurse/queue/${patient.id}/start`);
      setActivePatient({ ...patient, queue_state: 'in_triage' });
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    try {
      await apiClient.patch(`/nurse/queue/${activePatient.id}/complete`, {
        triage_notes: triageNotes,
        vitals: {
          heart_rate: parseInt(vitals.heart_rate),
          blood_pressure_systolic: parseInt(vitals.blood_pressure_systolic),
          blood_pressure_diastolic: parseInt(vitals.blood_pressure_diastolic),
          temperature: parseFloat(vitals.temperature),
          spo2: parseInt(vitals.spo2),
          respiratory_rate: parseInt(vitals.respiratory_rate),
          weight_kg: parseFloat(vitals.weight_kg)
        }
      });
      setActivePatient(null);
      setVitals({ heart_rate: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', temperature: '', spo2: '', respiratory_rate: '', weight_kg: '' });
      setTriageNotes('');
      fetchQueue();
    } catch (err) {
      alert('Failed to submit triage data. Check vitals formatting.');
    }
  };

  return (
    <div className="min-h-screen p-10 bg-[#050505] text-[#f8fafc] font-inter">
      <header className="flex justify-between items-end mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
             <span className="text-[10px] font-black text-rose-500 tracking-[0.3em] uppercase">Triage Command Center</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter outfit leading-none">Nursing</h1>
          <p className="text-slate-500 text-sm font-medium">Welcome back, {(user as any)?.name || user?.email}. Managing {stats.total_pending} pending triages.</p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Triage Queue List */}
        <div className={`col-span-12 ${activePatient ? 'lg:col-span-5' : 'lg:col-span-12'} transition-all`}>
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                 <div className="flex items-center gap-3">
                    <Activity className="text-rose-500" size={22} />
                    <h3 className="text-xl font-black outfit tracking-tight">Triage Queue</h3>
                 </div>
                 <span className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-xl text-[10px] font-black tracking-widest uppercase">
                    {stats.total_pending} Waiting
                 </span>
              </div>
              
              <div className="divide-y divide-white/5">
                 {queue.length === 0 && <div className="p-16 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">Queue is empty</div>}
                 
                 {queue.map((p) => (
                    <div key={p.id} className={`p-6 flex items-center justify-between transition-all cursor-pointer ${
                      activePatient?.id === p.id ? 'bg-white/[0.05] border-l-4 border-l-rose-500' : 'hover:bg-white/[0.02]'
                    }`}
                    onClick={() => {
                      if (p.queue_state === 'in_triage') setActivePatient(p);
                    }}>
                       <div className="flex items-center gap-6">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl outfit border ${
                             p.priority_level === 'emergency' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 
                             p.priority_level === 'urgent' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 
                             'bg-white/5 text-slate-400 border-white/10'
                          }`}>
                             {p.queue_number}
                          </div>
                          <div className="space-y-1">
                             <div className="flex items-center gap-3">
                                <h4 className="text-lg font-black outfit tracking-tight text-white">{p.full_name}</h4>
                             </div>
                             <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <span>{p.age}y {p.gender[0]}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-800" />
                                <span>Wait: {p.wait_minutes}m</span>
                             </div>
                          </div>
                       </div>

                       {p.queue_state === 'waiting_triage' ? (
                         <button onClick={(e) => { e.stopPropagation(); handleStartTriage(p); }} className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-4 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all flex items-center gap-2">
                            <Play size={14} /> Start
                         </button>
                       ) : (
                         <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">In Triage</span>
                       )}
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Vitals Capture Matrix */}
        {activePatient && (
          <div className="col-span-12 lg:col-span-7 space-y-6">
             <div className="bg-white/[0.03] border border-rose-500/20 rounded-[40px] p-8 relative overflow-hidden shadow-[0_0_100px_rgba(244,63,94,0.05)]">
                <div className="absolute top-0 right-0 p-6 opacity-5"><HeartPulse size={150} /></div>
                
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-16 h-16 bg-white border border-white/10 rounded-2xl flex items-center justify-center text-2xl font-black text-black">
                     {activePatient.queue_number}
                   </div>
                   <div>
                     <h3 className="text-3xl font-black outfit tracking-tighter text-white">{activePatient.full_name}</h3>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Reason: {activePatient.reason_for_visit}</p>
                   </div>
                </div>

                <form onSubmit={handleCompleteTriage} className="space-y-8 relative z-10">
                  {/* Vitals Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-5 group hover:border-rose-500/50 transition-all">
                       <HeartPulse className="text-rose-500 mb-3" size={24} />
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Heart Rate</label>
                       <div className="flex items-end gap-2">
                         <input required type="number" value={vitals.heart_rate} onChange={e => setVitals({...vitals, heart_rate: e.target.value})} className="w-full bg-transparent text-3xl font-black outfit text-white focus:outline-none placeholder-slate-800 p-0" placeholder="00" />
                         <span className="text-xs font-bold text-slate-600 mb-1">bpm</span>
                       </div>
                     </div>
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-5 group hover:border-blue-500/50 transition-all">
                       <Droplets className="text-blue-500 mb-3" size={24} />
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Blood Pressure</label>
                       <div className="flex items-end gap-1">
                         <input required type="number" value={vitals.blood_pressure_systolic} onChange={e => setVitals({...vitals, blood_pressure_systolic: e.target.value})} className="w-full bg-transparent text-2xl font-black outfit text-white focus:outline-none placeholder-slate-800 p-0 text-center" placeholder="120" />
                         <span className="text-2xl font-black text-slate-700">/</span>
                         <input required type="number" value={vitals.blood_pressure_diastolic} onChange={e => setVitals({...vitals, blood_pressure_diastolic: e.target.value})} className="w-full bg-transparent text-2xl font-black outfit text-white focus:outline-none placeholder-slate-800 p-0 text-center" placeholder="80" />
                       </div>
                     </div>
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-5 group hover:border-amber-500/50 transition-all">
                       <Thermometer className="text-amber-500 mb-3" size={24} />
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Temperature</label>
                       <div className="flex items-end gap-2">
                         <input required type="number" step="0.1" value={vitals.temperature} onChange={e => setVitals({...vitals, temperature: e.target.value})} className="w-full bg-transparent text-3xl font-black outfit text-white focus:outline-none placeholder-slate-800 p-0" placeholder="00.0" />
                         <span className="text-xs font-bold text-slate-600 mb-1">°F</span>
                       </div>
                     </div>
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-5 group hover:border-emerald-500/50 transition-all">
                       <Wind className="text-emerald-500 mb-3" size={24} />
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">SpO2</label>
                       <div className="flex items-end gap-2">
                         <input required type="number" value={vitals.spo2} onChange={e => setVitals({...vitals, spo2: e.target.value})} className="w-full bg-transparent text-3xl font-black outfit text-white focus:outline-none placeholder-slate-800 p-0" placeholder="00" />
                         <span className="text-xs font-bold text-slate-600 mb-1">%</span>
                       </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Respiratory Rate (breaths/min)</label>
                       <input required type="number" value={vitals.respiratory_rate} onChange={e => setVitals({...vitals, respiratory_rate: e.target.value})} className="w-full bg-transparent text-xl font-black text-white focus:outline-none" placeholder="16" />
                     </div>
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Weight (kg)</label>
                       <input required type="number" step="0.1" value={vitals.weight_kg} onChange={e => setVitals({...vitals, weight_kg: e.target.value})} className="w-full bg-transparent text-xl font-black text-white focus:outline-none" placeholder="70.5" />
                     </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Triage Notes</label>
                    <textarea required value={triageNotes} onChange={e => setTriageNotes(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none h-24" placeholder="Patient reports severe abdominal pain..." />
                  </div>

                  <button type="submit" className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(225,29,72,0.3)] hover:shadow-[0_0_60px_rgba(225,29,72,0.5)]">
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
