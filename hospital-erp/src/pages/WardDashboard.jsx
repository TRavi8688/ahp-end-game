import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, Bed, Clock, LogOut, LayoutDashboard, 
  FlaskConical, Package, BarChart3, Settings, Receipt, 
  CreditCard, Search, Filter, Plus, ArrowUpRight, CheckCircle2,
  AlertCircle, MapPin, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';

const WardDashboard = () => {
  const navigate = useNavigate();
  const [admissions, setAdmissions] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    occupancyRate: "0%"
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [admResp, bedResp] = await Promise.all([
        axios.get(`${API_BASE_URL}/clinical/admissions`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/clinical/beds`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setAdmissions(admResp.data);
      setBeds(bedResp.data);
      
      const occupied = bedResp.data.filter(b => b.status === 'OCCUPIED').length;
      const total = bedResp.data.length;
      
      setStats({
        totalBeds: total,
        occupiedBeds: occupied,
        availableBeds: total - occupied,
        occupancyRate: total ? `${Math.round((occupied / total) * 100)}%` : "0%"
      });
    } catch (err) {
      console.error("Ward Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const StatCard = ({ title, value, icon: Icon, colorClass, trend, subtext, delay }) => (
    <div className="glass-card p-6 animate-fade-in group hover:border-indigo-500/50 transition-all duration-500" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-4 rounded-2xl ${colorClass} bg-opacity-10 flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
        </div>
        {trend && (
          <div className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg text-[10px] font-black tracking-tighter flex items-center gap-1">
            <ArrowUpRight size={12} /> {trend}
          </div>
        )}
      </div>
      <h3 className="text-slate-500 text-xs font-black tracking-widest uppercase mb-1">{title}</h3>
      <p className="text-3xl font-black text-white">{value}</p>
      {subtext && <p className={`text-[10px] font-black tracking-widest uppercase mt-3 text-slate-600`}>{subtext}</p>}
    </div>
  );


  return (
    <div className="flex min-h-screen bg-[#020617] font-outfit">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 ml-80 p-12 bg-transparent relative">
        <header className="flex justify-between items-end mb-14">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase">Ward Management</span>
              </div>
              <span className="text-slate-600 text-xs font-bold">•</span>
              <span className="text-slate-400 text-xs font-bold">IPD Occupancy Monitor</span>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter mb-2">Ward Control Center</h1>
            <p className="text-slate-400 font-medium text-lg">Real-time bed availability and patient admission flow.</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all tracking-widest uppercase mb-2">
            <Plus size={18} /> New Admission
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard title="Total Beds" value={stats.totalBeds} icon={Bed} colorClass="bg-indigo-500" delay={0} />
          <StatCard title="Occupied" value={stats.occupiedBeds} icon={AlertCircle} colorClass="bg-amber-500" subtext="Action Required" delay={100} />
          <StatCard title="Available" value={stats.availableBeds} icon={CheckCircle2} colorClass="bg-emerald-500" subtext="Ready for Intake" delay={200} />
          <StatCard title="Occupancy" value={stats.occupancyRate} icon={Activity} colorClass="bg-rose-500" subtext="Hospital Load" delay={300} trend="+5%" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Admissions Table */}
          <div className="lg:col-span-2 glass-card overflow-hidden border-white/10 shadow-2xl">
            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Users className="text-indigo-500" size={20} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Current Admissions</h2>
              </div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-10 py-6">Patient</th>
                  <th className="px-10 py-6">Ward / Bed</th>
                  <th className="px-10 py-6">Status</th>
                  <th className="px-10 py-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {admissions.map(adm => (
                  <tr key={adm.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-10 py-7">
                        <span className="text-white font-bold text-lg leading-none">{adm.patient_id.slice(0,13)}...</span>
                        <span className="block text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">Admitted: {new Date(adm.admission_date).toLocaleDateString()}</span>
                    </td>
                    <td className="px-10 py-7">
                        <div className="flex items-center gap-2">
                           <MapPin size={14} className="text-indigo-500" />
                           <span className="text-white font-black text-sm uppercase">General Ward - Bed {adm.bed_id?.slice(0,4)}</span>
                        </div>
                    </td>
                    <td className="px-10 py-7">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border ${
                        adm.status === 'ADMITTED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                        'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}>
                        {adm.status}
                      </span>
                    </td>
                    <td className="px-10 py-7 text-right">
                       <button className="bg-rose-600/10 text-rose-500 px-6 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-rose-600 hover:text-white transition-all">Discharge</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Bed Map */}
          <div className="glass-card p-10 border-white/10 shadow-2xl flex flex-col">
            <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Bed className="text-indigo-500" size={20} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Bed Map</h2>
            </div>
            <div className="grid grid-cols-4 gap-4 overflow-y-auto max-h-[500px]">
               {beds.map(bed => (
                 <div key={bed.id} className={`p-4 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                   bed.status === 'AVAILABLE' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
                 }`}>
                   <span className="text-[10px] font-black text-white mb-2">{bed.bed_number}</span>
                   <div className={`w-3 h-3 rounded-full ${bed.status === 'AVAILABLE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                 </div>
               ))}
            </div>
            <button 
              onClick={fetchData}
              className="w-full mt-10 py-5 border border-white/10 text-white text-[10px] font-black tracking-[0.3em] uppercase rounded-2xl hover:bg-white/5 transition-all"
            >
              Sync Bed Status
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WardDashboard;
