import React, { useState, useEffect } from 'react';
import { 
  Activity, Clock, LogOut, Bed, FlaskConical, Package, 
  CreditCard, BarChart3, Plus, ArrowUpRight, CheckCircle2,
  AlertCircle, Zap, Scissors, Calendar, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

const SurgeryDashboard = () => {
  const navigate = useNavigate();
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get(`${API_BASE_URL}/clinical/surgeries`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setSurgeries(resp.data);
    } catch (err) {
      console.error("Surgery Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const NavItem = ({ icon: Icon, label, active, danger, onClick }) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group relative ${
      active 
        ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40' 
        : danger 
          ? 'text-rose-500 hover:bg-rose-500/10' 
          : 'text-slate-500 hover:bg-white/5 hover:text-white'
    }`}>
      <Icon size={20} className={active ? 'text-white' : 'group-hover:scale-110 group-hover:text-indigo-400 transition-all'} />
      <span className="font-black text-xs uppercase tracking-widest">{label}</span>
      {active && <div className="absolute left-0 w-1.5 h-6 bg-white rounded-r-full" />}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#020617] font-outfit">
      {/* Sidebar */}
      <aside className="w-80 glass-card rounded-none border-y-0 border-l-0 p-8 flex flex-col fixed h-full z-30 shadow-2xl shadow-black">
        <div className="flex items-center gap-4 mb-14 px-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 rotate-3 group hover:rotate-0 transition-all">
            <Zap className="text-white fill-white" size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white leading-none">HOSPYN</h1>
            <span className="text-[10px] font-black text-indigo-500 tracking-[0.3em] uppercase">Intelligence</span>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          <NavItem icon={Activity} label="Consultations" onClick={() => navigate('/clinical')} />
          <NavItem icon={Bed} label="Ward & IPD" onClick={() => navigate('/ward')} />
          <NavItem icon={Scissors} label="OT Control" active />
          <NavItem icon={FlaskConical} label="Laboratory" onClick={() => navigate('/lab')} />
          <NavItem icon={Package} label="Pharmacy" onClick={() => navigate('/pharmacy')} />
          <NavItem icon={CreditCard} label="Billing" onClick={() => navigate('/billing')} />
          <NavItem icon={BarChart3} label="Intelligence" onClick={() => navigate('/analytics')} />
        </nav>

        <div className="pt-8 border-t border-white/5 mt-auto">
          <NavItem icon={LogOut} label="Terminate Session" danger />
        </div>
      </aside>

      {/* Main Command Center */}
      <main className="flex-1 ml-80 p-12 bg-transparent relative">
        <header className="flex justify-between items-end mb-14">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase">Surgical Services</span>
              </div>
              <span className="text-slate-600 text-xs font-bold">•</span>
              <span className="text-slate-400 text-xs font-bold">OT Resource Monitor</span>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter mb-2">OT Command Center</h1>
            <p className="text-slate-400 font-medium text-lg">Real-time surgery tracking and theatre scheduling.</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all tracking-widest uppercase mb-2">
            <Plus size={18} /> Schedule Surgery
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Surgery List */}
          <div className="lg:col-span-2 glass-card overflow-hidden border-white/10 shadow-2xl">
            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Scissors className="text-indigo-500" size={20} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Today's Schedule</h2>
              </div>
            </div>
            <div className="p-8 space-y-4">
               {surgeries.map(surgery => (
                 <div key={surgery.id} className="p-8 rounded-3xl bg-white/[0.01] border border-white/5 flex justify-between items-center hover:border-indigo-500/30 transition-all group">
                    <div className="flex-1">
                       <div className="flex items-center gap-3 mb-3">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${
                            surgery.status === 'SCHEDULED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            surgery.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' :
                            'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                            {surgery.status}
                          </span>
                          <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Surgery ID: {surgery.id.slice(0,8)}</span>
                       </div>
                       <h3 className="text-2xl font-black text-white mb-2">{surgery.surgery_name}</h3>
                       <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                             <Clock size={14} className="text-slate-500" />
                             <span className="text-slate-400 text-xs font-bold">{new Date(surgery.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <MapPin size={14} className="text-slate-500" />
                             <span className="text-slate-400 text-xs font-bold">Theatre {surgery.ot_id?.slice(0,4)}</span>
                          </div>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-white font-black text-lg mb-1">Dr. {surgery.surgeon_id?.slice(0,6)}</p>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lead Surgeon</p>
                    </div>
                 </div>
               ))}
               {surgeries.length === 0 && <p className="text-slate-600 text-sm font-bold text-center py-20">No surgeries scheduled for this period.</p>}
            </div>
          </div>

          {/* OT Status Sidebar */}
          <div className="space-y-6">
             <div className="glass-card p-10 border-white/10 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                     <Activity className="text-indigo-500" size={20} />
                   </div>
                   <h2 className="text-2xl font-black text-white tracking-tight">OT Health</h2>
                </div>
                <div className="space-y-4">
                   <OTStatusRow name="OT-1 (Main)" status="In Progress" color="bg-amber-500" />
                   <OTStatusRow name="OT-2 (Cardiac)" status="Ready" color="bg-emerald-500" />
                   <OTStatusRow name="OT-3 (Ortho)" status="Cleaning" color="bg-indigo-500" />
                </div>
             </div>
             
             <div className="glass-card p-10 border-white/10 shadow-2xl bg-indigo-600/5">
                <Calendar className="text-indigo-500 mb-6" size={32} />
                <h3 className="text-xl font-black text-white mb-2">Tomorrow's Load</h3>
                <p className="text-slate-400 text-sm mb-6 font-medium">8 Surgeries scheduled with 92% OT utilization.</p>
                <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all">Optimize Schedule</button>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const OTStatusRow = ({ name, status, color }) => (
  <div className="flex justify-between items-center p-5 rounded-2xl bg-white/[0.01] border border-white/5">
     <span className="text-white font-bold text-sm">{name}</span>
     <div className="flex items-center gap-3">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{status}</span>
        <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
     </div>
  </div>
);

export default SurgeryDashboard;
