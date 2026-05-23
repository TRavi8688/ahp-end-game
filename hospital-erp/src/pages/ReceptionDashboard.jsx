import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, ClipboardList, Activity,
  Clock, ArrowRight, CheckCircle2
} from 'lucide-react';
import apiClient from '../apiClient';

const ReceptionDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
    gender: 'M',
    blood_group: 'O+'
  });
  
  const [queueData, setQueueData] = useState({
    visit_reason: '',
    symptoms: '',
    is_emergency: false
  });
  
  const [todayQueue, setTodayQueue] = useState([]);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await apiClient.get('/clinical/queue');
      setTodayQueue(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (val.length > 2) {
      try {
        const res = await apiClient.get(`/patients/search?q=${val}`);
        setSearchResults(res.data);
      } catch (err) {
        console.error(err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleRegister = async () => {
    try {
      const res = await apiClient.post('/patients/', newPatient);
      setSelectedPatient(res.data);
      setShowRegisterModal(false);
      setShowQueueModal(true); // Auto open queue modal after registration
    } catch (err) {
      alert('Registration Failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDispatchToQueue = async () => {
    try {
      await apiClient.post('/queue/', {
        patient_id: selectedPatient.id,
        is_emergency: queueData.is_emergency,
        visit_reason: queueData.visit_reason,
        symptoms: queueData.symptoms
      });
      setShowQueueModal(false);
      setQueueData({ visit_reason: '', symptoms: '', is_emergency: false });
      setSelectedPatient(null);
      setSearchTerm('');
      setSearchResults([]);
      fetchQueue(); // refresh waiting room
    } catch (err) {
      alert('Queue Dispatch Failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="flex min-h-screen bg-[#020617] font-outfit">
      <main className="flex-1 ml-64 p-10">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-5xl font-black text-white tracking-tighter mb-2">Reception Desk</h1>
            <p className="text-slate-400 font-medium text-lg">Patient Intake & Queue Dispatch Engine.</p>
          </div>
          <button 
            className="flex items-center gap-2 bg-indigo-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all tracking-widest uppercase mb-2"
            onClick={() => setShowRegisterModal(true)}
          >
            <UserPlus size={18} /> New Registration
          </button>
        </header>

        <div className="grid grid-cols-[1fr,400px] gap-8">
          
          {/* LEFT: Patient Search & Dispatch */}
          <div className="glass-card p-8 min-h-[500px]">
            <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest border-b border-white/5 pb-4">Patient Lookup</h2>
            
            <div className="relative mb-8">
              <Search className="absolute left-4 top-4 text-slate-500" size={20} />
              <input 
                type="text" 
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-lg font-medium outline-none focus:border-indigo-500 transition-all"
                placeholder="Search by Phone, Name, or Hospyn ID..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map(pt => (
                  <div key={pt.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex justify-between items-center hover:bg-white/10 transition-colors">
                    <div>
                      <h3 className="text-white font-bold text-lg">{pt.first_name} {pt.last_name}</h3>
                      <p className="text-slate-400 text-sm font-medium">Hospyn ID: {pt.hospyn_id} • Phone: {pt.phone_number}</p>
                    </div>
                    <button 
                      className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-6 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all"
                      onClick={() => {
                        setSelectedPatient(pt);
                        setShowQueueModal(true);
                      }}
                    >
                      Check-In
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {searchTerm.length > 2 && searchResults.length === 0 && (
              <div className="text-center py-10 opacity-50">
                <Users size={48} className="text-white mx-auto mb-4" />
                <p className="text-slate-300 font-medium text-lg">No patient found.</p>
                <button className="text-indigo-400 font-bold mt-2 hover:text-indigo-300" onClick={() => setShowRegisterModal(true)}>
                  Register New Patient Instead
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Live Waiting Room */}
          <div className="glass-card p-8">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
              <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Clock size={20} className="text-indigo-400" /> Waiting Room
              </h2>
              <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-xs font-black">{todayQueue.length} Waiting</span>
            </div>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {todayQueue.length === 0 ? (
                <div className="text-center py-10 opacity-30">
                  <Activity size={32} className="text-white mx-auto mb-2" />
                  <p className="text-sm font-bold tracking-widest uppercase text-white">Queue Empty</p>
                </div>
              ) : (
                todayQueue.map((q, idx) => (
                  <div key={q.id} className="bg-black/30 border border-white/5 rounded-xl p-4 flex gap-4 relative overflow-hidden group">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center font-black text-indigo-400 shrink-0">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-white font-bold">{q.patient_name}</h4>
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{q.visit_reason || 'General'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODALS */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[1000] p-10">
          <div className="bg-[#0f172a] rounded-[32px] border border-white/10 p-10 w-[600px]">
            <h2 className="text-2xl font-black text-white mb-8">Patient Registration</h2>
            <div className="grid grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-2">First Name</label>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500" value={newPatient.first_name} onChange={e => setNewPatient({...newPatient, first_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-2">Last Name</label>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500" value={newPatient.last_name} onChange={e => setNewPatient({...newPatient, last_name: e.target.value})} />
              </div>
            </div>
            <div className="mb-5">
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-2">Phone Number</label>
                <input type="tel" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500" value={newPatient.phone_number} onChange={e => setNewPatient({...newPatient, phone_number: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-5 mb-10">
              <div>
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-2">DOB (YYYY-MM-DD)</label>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500" value={newPatient.date_of_birth} onChange={e => setNewPatient({...newPatient, date_of_birth: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-2">Gender</label>
                <select className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500" value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 text-[10px] font-black uppercase mb-2">Blood</label>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-indigo-500" value={newPatient.blood_group} onChange={e => setNewPatient({...newPatient, blood_group: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-4">
              <button className="px-6 py-3 font-bold text-slate-500 hover:text-white" onClick={() => setShowRegisterModal(false)}>CANCEL</button>
              <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold" onClick={handleRegister}>REGISTER & CHECK-IN</button>
            </div>
          </div>
        </div>
      )}

      {showQueueModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[1000] p-10">
          <div className="bg-[#0f172a] rounded-[32px] border border-white/10 p-10 w-[500px]">
            <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
              <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center font-black text-2xl">
                {selectedPatient.first_name[0]}
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">{selectedPatient.first_name} {selectedPatient.last_name}</h2>
                <p className="text-slate-400 font-medium">Hospyn ID: {selectedPatient.hospyn_id}</p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-slate-500 text-[10px] font-black uppercase mb-2">Visit Reason</label>
              <input 
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500" 
                placeholder="e.g. Fever, Checkup, Pain"
                value={queueData.visit_reason} 
                onChange={e => setQueueData({...queueData, visit_reason: e.target.value})} 
              />
            </div>
            <div className="mb-6">
              <label className="block text-slate-500 text-[10px] font-black uppercase mb-2">Reported Symptoms</label>
              <textarea 
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500 min-h-[100px]" 
                placeholder="Briefly describe patient symptoms..."
                value={queueData.symptoms} 
                onChange={e => setQueueData({...queueData, symptoms: e.target.value})} 
              />
            </div>
            
            <div className="mb-10 flex items-center gap-3">
              <input type="checkbox" id="emergency" className="w-5 h-5 accent-rose-500" checked={queueData.is_emergency} onChange={e => setQueueData({...queueData, is_emergency: e.target.checked})} />
              <label htmlFor="emergency" className="text-rose-400 font-bold cursor-pointer">Mark as EMERGENCY (Moves to top of queue)</label>
            </div>

            <div className="flex justify-end gap-4">
              <button className="px-6 py-3 font-bold text-slate-500 hover:text-white" onClick={() => setShowQueueModal(false)}>CANCEL</button>
              <button className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2" onClick={handleDispatchToQueue}>
                DISPATCH TO DOCTOR <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .glass-card { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); border-radius: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
};

export default ReceptionDashboard;
