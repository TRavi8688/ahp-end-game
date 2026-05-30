import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Clock,
  CheckCircle,
  FileText,
  Activity,
  Pill,
  MoreVertical
} from 'lucide-react';
import apiClient from '../../apiClient';
import { useAuth } from '../../context/AuthContext';

interface ConsultationPatient {
  id: string;
  queue_number: number;
  full_name: string;
  age: number;
  gender: string;
  reason_for_visit: string;
  symptoms: string;
  priority_level: string;
  queue_state: string;
  wait_minutes: number;
  triage_vitals_json: any;
  triage_notes: string;
  assigned_to_me: boolean;
}

const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<ConsultationPatient[]>([]);
  const [stats, setStats] = useState({ total_waiting: 0, total_in_consultation: 0 });
  const [activePatient, setActivePatient] = useState<ConsultationPatient | null>(null);
  
  // Clinical Notes Form State
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');

  const fetchQueue = async () => {
    try {
      const res = await apiClient.get('/doctor/queue');
      setQueue(res.data.data.queue);
      setStats({
        total_waiting: res.data.data.total_waiting,
        total_in_consultation: res.data.data.total_in_consultation
      });
      // Auto-select first in_consultation patient if none selected
      if (!activePatient) {
        const inProgress = res.data.data.queue.find((p: any) => p.queue_state === 'in_consultation' && p.assigned_to_me);
        if (inProgress) setActivePatient(inProgress);
      }
    } catch (err) {
      console.error('Failed to fetch doctor queue', err);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [activePatient]);

  const handleStartConsultation = async (patient: ConsultationPatient) => {
    try {
      await apiClient.patch(`/doctor/queue/${patient.id}/start`);
      setActivePatient({ ...patient, queue_state: 'in_consultation', assigned_to_me: true });
      setChiefComplaint(patient.reason_for_visit || '');
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient) return;
    try {
      await apiClient.patch(`/doctor/queue/${activePatient.id}/complete`, {
        chief_complaint: chiefComplaint,
        clinical_notes: clinicalNotes,
        diagnosis: diagnosis,
        prescription: prescription
      });
      setActivePatient(null);
      setChiefComplaint('');
      setClinicalNotes('');
      setDiagnosis('');
      setPrescription('');
      fetchQueue();
    } catch (err) {
      alert('Failed to submit consultation data.');
    }
  };

  return (
    <div className="min-h-screen p-10 bg-[#050505] text-[#f8fafc] font-inter">
      <header className="flex justify-between items-end mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[10px] font-black text-blue-500 tracking-[0.3em] uppercase">Consultation Suite</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter outfit leading-none">Doctor</h1>
          <p className="text-slate-500 text-sm font-medium">Dr. {(user as any)?.name || user?.email}. {stats.total_waiting} patients waiting.</p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Doctor Queue List */}
        <div className={`col-span-12 ${activePatient ? 'lg:col-span-4' : 'lg:col-span-12'} transition-all`}>
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                 <div className="flex items-center gap-3">
                    <Stethoscope className="text-blue-500" size={22} />
                    <h3 className="text-xl font-black outfit tracking-tight">Patient Queue</h3>
                 </div>
                 <span className="px-4 py-2 bg-blue-500/10 text-blue-500 rounded-xl text-[10px] font-black tracking-widest uppercase">
                    {stats.total_waiting} Waiting
                 </span>
              </div>
              
              <div className="divide-y divide-white/5">
                 {queue.length === 0 && <div className="p-16 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">Queue is empty</div>}
                 
                 {queue.map((p) => (
                    <div key={p.id} className={`p-6 flex flex-col gap-4 transition-all cursor-pointer ${
                      activePatient?.id === p.id ? 'bg-white/[0.05] border-l-4 border-l-blue-500' : 'hover:bg-white/[0.02]'
                    }`}
                    onClick={() => {
                      if (p.queue_state === 'in_consultation' && p.assigned_to_me) setActivePatient(p);
                    }}>
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg outfit border ${
                               p.priority_level === 'emergency' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 
                               p.priority_level === 'urgent' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 
                               'bg-white/5 text-slate-400 border-white/10'
                            }`}>
                               {p.queue_number}
                            </div>
                            <div className="space-y-1">
                               <h4 className="text-lg font-black outfit tracking-tight text-white">{p.full_name}</h4>
                               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                  <span>{p.age}y {p.gender[0]}</span>
                                  <div className="w-1 h-1 rounded-full bg-slate-800" />
                                  <span>Wait: {p.wait_minutes}m</span>
                               </div>
                            </div>
                         </div>
                         {p.queue_state === 'waiting_doctor' && (
                           <button onClick={(e) => { e.stopPropagation(); handleStartConsultation(p); }} className="bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white px-4 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all">
                              Start
                           </button>
                         )}
                         {p.queue_state === 'in_consultation' && p.assigned_to_me && (
                           <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest animate-pulse">In Session</span>
                         )}
                         {p.queue_state === 'in_consultation' && !p.assigned_to_me && (
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">With Another Doc</span>
                         )}
                       </div>
                       
                       {/* Brief triage preview if available */}
                       {p.triage_vitals_json && (
                         <div className="flex gap-4 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                           <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                             HR: <span className="text-white font-black ml-1">{p.triage_vitals_json.heart_rate}</span>
                           </div>
                           <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                             BP: <span className="text-white font-black ml-1">{p.triage_vitals_json.blood_pressure_systolic}/{p.triage_vitals_json.blood_pressure_diastolic}</span>
                           </div>
                           <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                             SpO2: <span className="text-white font-black ml-1">{p.triage_vitals_json.spo2}%</span>
                           </div>
                         </div>
                       )}
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Clinical Notes Pane */}
        {activePatient && (
          <div className="col-span-12 lg:col-span-8 space-y-6">
             <div className="bg-white/[0.03] border border-blue-500/20 rounded-[40px] p-8 relative overflow-hidden shadow-[0_0_100px_rgba(59,130,246,0.05)]">
                
                <div className="flex items-start justify-between mb-8 pb-8 border-b border-white/10">
                   <div>
                     <div className="flex items-center gap-4 mb-2">
                       <h3 className="text-4xl font-black outfit tracking-tighter text-white">{activePatient.full_name}</h3>
                       <span className="px-3 py-1 bg-white/10 rounded-lg text-xs font-black uppercase tracking-widest text-white">{activePatient.age}y {activePatient.gender}</span>
                     </div>
                     <p className="text-sm font-medium text-slate-400">Chief Complaint: {activePatient.reason_for_visit}</p>
                   </div>
                   
                   {/* Nurse Notes Snapshot */}
                   {activePatient.triage_notes && (
                     <div className="max-w-xs bg-rose-500/5 border border-rose-500/10 p-4 rounded-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1 flex items-center gap-1"><Activity size={12}/> Nurse Triage Notes</p>
                        <p className="text-xs font-medium text-slate-300">{activePatient.triage_notes}</p>
                     </div>
                   )}
                </div>

                <form onSubmit={handleCompleteConsultation} className="space-y-6 relative z-10">
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"><FileText size={14}/> Clinical Notes</label>
                    <textarea required value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-40" placeholder="Patient presented with..." />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"><Activity size={14}/> Diagnosis</label>
                    <input required type="text" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Primary diagnosis (e.g., Acute Viral Pharyngitis)" />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"><Pill size={14}/> Prescription / Treatment Plan</label>
                    <textarea value={prescription} onChange={e => setPrescription(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-32" placeholder="1. Paracetamol 500mg BID..." />
                  </div>

                  <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(59,130,246,0.3)] hover:shadow-[0_0_60px_rgba(59,130,246,0.5)] mt-4">
                    <CheckCircle size={18} /> Complete Consultation & Discharge
                  </button>
                </form>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard;
