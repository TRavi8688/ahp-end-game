import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Clock, 
  CheckCircle, 
  MoreVertical, 
  UserPlus, 
  Plus, 
  Pill, 
  FileText, 
  ChevronRight,
  Activity,
  Calendar,
  Clipboard,
  FlaskConical,
  BarChart3
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';

const VisitDashboard = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePatient, setActivePatient] = useState(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [meds, setMeds] = useState([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');

  const fetchQueue = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/visit/queue`);
      setQueue(res.data);
    } catch (err) {
      console.error("Queue fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handlePrescribe = async () => {
    if (!activePatient) return;
    try {
      await axios.post(`${API_BASE_URL}/clinical/prescribe`, {
        patient_id: activePatient.patient_id,
        visit_id: activePatient.id,
        diagnosis,
        medications: meds.filter(m => m.name),
        notes
      });
      alert("Prescription Issued Successfully!");
      setShowPrescriptionModal(false);
      resetPrescriptionForm();
    } catch (err) {
      alert("Failed to issue prescription");
    }
  };

  const resetPrescriptionForm = () => {
    setMeds([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
    setDiagnosis('');
    setNotes('');
  };

  const addMedLine = () => {
    setMeds([...meds, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  };

  return (
    <div className="flex min-h-screen bg-[#020617] font-outfit selection:bg-indigo-500/30">
      {/* Side Navigation */}
      <Sidebar />

      <main className="flex-1 ml-80 p-12 relative bg-[#050810] min-h-screen">
        <div className="erp-header flex justify-between items-center mb-10">
          <div className="header-left flex gap-5 items-center">
            <div className="header-icon clinical w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-600/20">
              <Activity size={24} className="text-indigo-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Clinical Command Center</h1>
              <p className="text-slate-500 text-sm">Real-time OPD Queue & Medical Ordering</p>
            </div>
          </div>
          <div className="header-right">
            <div className="stat-pill bg-indigo-600/10 text-indigo-500 px-4 py-2 rounded-full border border-indigo-600/20 flex items-center gap-2 font-bold text-sm">
              <Users size={16} />
              <span>{queue.length} Waiting</span>
            </div>
          </div>
        </div>

        <div className="dashboard-grid grid grid-cols-[350px,1fr] gap-8 h-[calc(100vh-200px)]">
          {/* Left: Queue Sidebar */}
          <div className="queue-sidebar bg-[#0f172a] rounded-3xl border border-white/5 flex flex-col overflow-hidden">
            <div className="search-bar p-5 border-b border-white/5 flex gap-3 items-center text-slate-500">
              <Search size={18} />
              <input type="text" placeholder="Search queue..." className="bg-transparent border-none text-white flex-1 outline-none text-sm" />
            </div>

            <div className="queue-list flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="text-center py-10 text-indigo-500 font-bold animate-pulse">Initializing...</div>
              ) : queue.length > 0 ? (
                queue.map((visit, index) => (
                  <div 
                    key={visit.id} 
                    className={`queue-item p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all mb-2 border border-transparent ${activePatient?.id === visit.id ? 'bg-indigo-600/10 border-indigo-600/30' : 'hover:bg-white/2'}`}
                    onClick={() => setActivePatient(visit)}
                  >
                    <div className="token-circle w-8 h-8 rounded-full bg-[#1e293b] text-indigo-500 flex items-center justify-center font-bold text-xs">{index + 1}</div>
                    <div className="patient-info">
                      <h3 className="text-white text-sm font-bold">{visit.patient_name || 'Patient'}</h3>
                      <div className="meta flex items-center gap-2 text-slate-500 text-[10px]">
                        <Clock size={12} />
                        <span>{visit.visit_reason}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-500 text-sm italic">Queue is empty</div>
              )}
            </div>
          </div>

          {/* Right: Consultation Space */}
          <div className="consultation-space bg-[#0f172a] rounded-3xl border border-white/5 overflow-hidden">
            {activePatient ? (
              <div className="consult-card h-full flex flex-col">
                <div className="consult-header p-8 border-b border-white/5 flex justify-between items-center">
                  <div className="patient-hero flex gap-5 items-center">
                    <div className="avatar w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-indigo-600/20">{activePatient.patient_name?.[0] || 'P'}</div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{activePatient.patient_name}</h2>
                      <span className="text-slate-500 text-xs font-bold tracking-widest">HOSPYN-{activePatient.patient_id?.substring(0,6).toUpperCase()}</span>
                    </div>
                  </div>
                  <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 hover:scale-105 transition-transform" onClick={() => setShowPrescriptionModal(true)}>
                    <Pill size={18} />
                    <span>PRESCRIBE</span>
                  </button>
                </div>

                <div className="consult-body p-8 flex-1">
                  <div className="info-grid grid grid-cols-2 gap-5 mb-10">
                    <div className="info-box">
                      <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Visit Reason</label>
                      <p className="text-slate-200 text-lg">{activePatient.visit_reason}</p>
                    </div>
                    <div className="info-box">
                      <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Symptoms</label>
                      <p className="text-slate-200 text-lg">{activePatient.symptoms || 'None reported'}</p>
                    </div>
                  </div>

                  <div className="clinical-sections grid grid-cols-2 gap-4">
                    <div className="section-tab bg-white/2 p-5 rounded-2xl border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all">
                      <Clipboard size={18} className="text-indigo-500" />
                      <span className="flex-1 font-bold text-sm text-white">Clinical History</span>
                      <ChevronRight size={16} className="text-slate-600" />
                    </div>
                    <div className="section-tab bg-white/2 p-5 rounded-2xl border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all">
                      <FileText size={18} className="text-emerald-500" />
                      <span className="flex-1 font-bold text-sm text-white">Lab Results</span>
                      <ChevronRight size={16} className="text-slate-600" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center p-10 opacity-20">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <UserPlus size={48} className="text-white" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Ready for Consultation</h2>
                <p className="text-slate-400 max-w-xs">Select a patient from the queue to begin diagnosis and medical ordering.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Prescription Modal */}
      {showPrescriptionModal && (
        <div className="modal-overlay fixed inset-0 bg-black/80 flex justify-center items-center z-[1000] p-10">
          <div className="modal-content w-[800px] bg-[#0f172a] rounded-[32px] border border-white/10 p-10 max-h-full overflow-y-auto">
            <div className="modal-header flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white">Digital Prescription</h2>
              <button className="text-3xl text-slate-500 hover:text-white" onClick={() => setShowPrescriptionModal(false)}>&times;</button>
            </div>
            
            <div className="prescription-form">
              <div className="form-group mb-6">
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-3 tracking-widest">Diagnosis</label>
                <textarea 
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white min-h-[100px] outline-none focus:border-indigo-500 transition-colors"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Enter clinical diagnosis..."
                />
              </div>

              <div className="medication-list mb-8">
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-3 tracking-widest">Medications</label>
                {meds.map((med, index) => (
                  <div key={index} className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-3 mb-3">
                    <input className="bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-indigo-500" placeholder="Medication Name" value={med.name} onChange={(e) => { const n = [...meds]; n[index].name = e.target.value; setMeds(n); }} />
                    <input className="bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-indigo-500" placeholder="Dosage" value={med.dosage} onChange={(e) => { const n = [...meds]; n[index].dosage = e.target.value; setMeds(n); }} />
                    <input className="bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-indigo-500" placeholder="Freq" value={med.frequency} onChange={(e) => { const n = [...meds]; n[index].frequency = e.target.value; setMeds(n); }} />
                    <input className="bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-indigo-500" placeholder="Dur" value={med.duration} onChange={(e) => { const n = [...meds]; n[index].duration = e.target.value; setMeds(n); }} />
                  </div>
                ))}
                <button className="text-indigo-500 font-bold flex items-center gap-2 text-sm mt-4 hover:text-indigo-400" onClick={addMedLine}>
                  <Plus size={16} /> Add Medication
                </button>
              </div>

              <div className="form-group mb-10">
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-3 tracking-widest">Clinical Notes</label>
                <textarea 
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white min-h-[100px] outline-none focus:border-indigo-500 transition-colors"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional instructions for patient..."
                />
              </div>
            </div>

            <div className="modal-footer flex justify-end gap-4">
              <button className="px-8 py-3 rounded-xl font-bold text-slate-500 hover:text-white" onClick={() => setShowPrescriptionModal(false)}>CANCEL</button>
              <button className="bg-indigo-600 text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:scale-105 transition-transform" onClick={handlePrescribe}>SIGN & ISSUE</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .glass-sidebar { background: #0f172a; border-right: 1px solid rgba(255,255,255,0.05); }
        .nav-item { display: flex; align-items: center; gap: 15px; padding: 15px 20px; border-radius: 16px; color: #64748b; cursor: pointer; transition: all 0.2s; font-weight: bold; }
        .nav-item:hover { background: rgba(255,255,255,0.02); color: #fff; }
        .nav-item.active { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
        .white\/2 { background: rgba(255,255,255,0.02); }
        .white\/5 { background: rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
};

export default VisitDashboard;
