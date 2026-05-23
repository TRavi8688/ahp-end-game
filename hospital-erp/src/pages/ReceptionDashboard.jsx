import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, ClipboardList, Activity,
  Clock, ArrowRight, CheckCircle2, ChevronDown, IndianRupee, QrCode, LogOut, Settings, Stethoscope, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
    is_emergency: false,
    op_fee: '',
    payment_method: 'CASH'
  });
  
  const [todayQueue, setTodayQueue] = useState([]);
  const [opCollection, setOpCollection] = useState(0);
  
  // Staff Break Status
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [staffStatus, setStaffStatus] = useState('ACTIVE');
  const STATUS_OPTIONS = [
    { label: 'ACTIVE', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { label: 'BIO BREAK', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { label: 'LUNCH BREAK', color: 'text-orange-400', bg: 'bg-orange-500/20' },
    { label: 'IN MEETING', color: 'text-rose-400', bg: 'bg-rose-500/20' }
  ];

  // Dummy Doctor Matrix
  const doctors = [
    { name: 'Dr. Sarah Jenkins', dept: 'Cardiology', status: 'AVAILABLE' },
    { name: 'Dr. Rajesh Kumar', dept: 'General', status: 'WITH PATIENT' },
    { name: 'Dr. Emily Chen', dept: 'Pediatrics', status: 'ON BREAK' }
  ];

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
        symptoms: queueData.symptoms,
        op_fee: queueData.op_fee,
        payment_method: queueData.payment_method
      });
      setOpCollection(prev => prev + (Number(queueData.op_fee) || 0));
      setShowQueueModal(false);
      setQueueData({ visit_reason: '', symptoms: '', is_emergency: false, op_fee: '', payment_method: 'CASH' });
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
          <div className="flex items-center gap-6">
            
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400"><IndianRupee size={20} /></div>
              <div>
                <p className="text-[10px] text-emerald-500/70 font-black uppercase tracking-widest">Today's OP Revenue</p>
                <p className="text-white font-bold text-xl">₹{opCollection}</p>
              </div>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-3 bg-black/40 border border-white/10 px-6 py-4 rounded-2xl hover:bg-white/5 transition-all"
              >
                <div className={`w-3 h-3 rounded-full ${STATUS_OPTIONS.find(s => s.label === staffStatus).bg.replace('/20','')} animate-pulse`} />
                <span className={`text-xs font-black tracking-widest uppercase ${STATUS_OPTIONS.find(s => s.label === staffStatus).color}`}>
                  {staffStatus}
                </span>
                <ChevronDown size={16} className="text-slate-500" />
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden z-50">
                  {STATUS_OPTIONS.map(opt => (
                    <button 
                      key={opt.label}
                      onClick={() => { setStaffStatus(opt.label); setShowStatusDropdown(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors flex items-center gap-3"
                    >
                      <div className={`w-2 h-2 rounded-full ${opt.bg.replace('/20','')}`} />
                      <span className="text-xs font-bold text-white tracking-wider">{opt.label}</span>
                    </button>
                  ))}
                  <div className="border-t border-slate-700 my-1" />
                  <Link to="/settings" className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors flex items-center gap-3 text-slate-400">
                    <Settings size={14} /> <span className="text-xs font-bold tracking-wider">SETTINGS</span>
                  </Link>
                </div>
              )}
            </div>

            <button 
              className="flex items-center gap-2 bg-indigo-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all tracking-widest uppercase"
              onClick={() => setShowRegisterModal(true)}
            >
              <UserPlus size={18} /> New Registration
            </button>
          </div>
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
                todayQueue.map((q, idx) => {
                  const waitMins = q.wait_time || Math.floor(Math.random() * 45); // Simulated if backend lacks it
                  const isLate = waitMins > 30;
                  return (
                  <div key={q.id} className={`bg-black/30 border ${isLate ? 'border-rose-500/30' : 'border-white/5'} rounded-xl p-4 flex gap-4 relative overflow-hidden group`}>
                    <div className={`w-10 h-10 rounded-full ${isLate ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'} flex items-center justify-center font-black shrink-0`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold">{q.patient_name}</h4>
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{q.visit_reason || 'General'}</p>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                      <div className={`flex items-center gap-1 text-xs font-black ${isLate ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                        <Clock size={12} /> {waitMins}m
                      </div>
                      {isLate && <span className="text-[9px] text-rose-500 font-bold uppercase">Delayed</span>}
                    </div>
                  </div>
                )})
              )}
            </div>

            {/* DOCTOR AVAILABILITY MATRIX */}
            <div className="mt-8 border-t border-white/5 pt-6">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Stethoscope size={16} /> Doctor Status Grid
              </h2>
              <div className="space-y-2">
                {doctors.map(doc => (
                  <div key={doc.name} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                    <div>
                      <p className="text-white text-sm font-bold">{doc.name}</p>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{doc.dept}</p>
                    </div>
                    <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-md ${doc.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400' : doc.status === 'WITH PATIENT' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
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
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500 min-h-[80px]" 
                placeholder="Briefly describe patient symptoms..."
                value={queueData.symptoms} 
                onChange={e => setQueueData({...queueData, symptoms: e.target.value})} 
              />
            </div>

            <div className="mb-8 border-t border-white/10 pt-6">
              <label className="block text-slate-500 text-[10px] font-black uppercase mb-4">OPD Consultation Fee</label>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="number" 
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white font-black text-xl outline-none focus:border-emerald-500" 
                    placeholder="0.00"
                    value={queueData.op_fee}
                    onChange={e => setQueueData({...queueData, op_fee: e.target.value})}
                  />
                </div>
                <div className="flex bg-black/30 border border-white/10 rounded-xl p-1">
                  <button 
                    className={`px-6 rounded-lg font-black tracking-widest text-xs transition-all ${queueData.payment_method === 'CASH' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}
                    onClick={() => setQueueData({...queueData, payment_method: 'CASH'})}
                  >CASH</button>
                  <button 
                    className={`px-6 rounded-lg font-black tracking-widest text-xs flex items-center gap-2 transition-all ${queueData.payment_method === 'UPI' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                    onClick={() => setQueueData({...queueData, payment_method: 'UPI'})}
                  ><QrCode size={14}/> UPI</button>
                </div>
              </div>

              {queueData.payment_method === 'UPI' && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6 flex items-center justify-between animate-fade-in">
                  <div>
                    <h4 className="text-indigo-400 font-black text-sm uppercase tracking-widest mb-1">Hospital Global UPI</h4>
                    <p className="text-slate-400 text-xs font-medium">Scan to pay ₹{queueData.op_fee || '0'} instantly.</p>
                  </div>
                  <div className="bg-white p-2 rounded-xl">
                    {/* Placeholder for real QR code image */}
                    <div className="w-20 h-20 bg-black flex items-center justify-center">
                       <QrCode size={40} className="text-white"/>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mb-8 flex items-center gap-3">
              <input type="checkbox" id="emergency" className="w-5 h-5 accent-rose-500" checked={queueData.is_emergency} onChange={e => setQueueData({...queueData, is_emergency: e.target.checked})} />
              <label htmlFor="emergency" className="text-rose-400 font-bold cursor-pointer">Mark as EMERGENCY (Moves to top of queue)</label>
            </div>

            <div className="flex justify-end gap-4">
              <button className="px-6 py-3 font-bold text-slate-500 hover:text-white" onClick={() => setShowQueueModal(false)}>CANCEL</button>
              <button className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20" onClick={handleDispatchToQueue}>
                COMPLETE & DISPATCH <ArrowRight size={18} />
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
