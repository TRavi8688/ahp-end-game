import React from 'react';
import { 
  Users, 
  Activity, 
  Clock, 
  ChevronRight, 
  Zap, 
  AlertCircle,
  Stethoscope,
  Search,
  Bell,
  Heart,
  Calendar,
  LayoutDashboard
} from 'lucide-react';

import { useStore } from '../../store/useStore';

const DoctorDashboard: React.FC = () => {
  const { queue, alerts } = useStore();
  
  const activePatients = queue.length > 0 ? queue : [
    { id: 'TK-102', name: 'Arjun Mehta', age: 58, priority: 120, status: 'CRITICAL', zone: 'ICU-1', wait: '2m', type: 'Emergency' },
    { id: 'TK-105', name: 'Sarah Khan', age: 34, priority: 85, status: 'STABLE', zone: 'OPD-B', wait: '12m', type: 'VIP' },
    { id: 'TK-108', name: 'Vikram Singh', age: 72, priority: 45, status: 'WAITING', zone: 'OPD-A', wait: '28m', type: 'Regular' },
  ];

  const clinicalInsights = alerts.length > 0 ? alerts : [
    { id: '1', type: 'critical', title: 'Cardiac Alert', message: "Abnormal heart rate spikes detected in Arjun Mehta. Neural analysis suggests tachycardia.", timestamp: '1m ago' },
    { id: '2', type: 'info', title: 'Lab Update', message: 'SARAH KHAN: Comprehensive Metabolic Panel processed. Normal ranges confirmed.', timestamp: '14m ago' }
  ];

  return (
    <div className="min-h-screen p-10 bg-[#050505] text-[#f8fafc] font-inter">
      
      {/* Premium Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase">Node Active: Clinical Core</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter outfit leading-none">Clinical Command</h1>
          <p className="text-slate-500 text-sm font-medium">Monitoring {activePatients.length} active consultations in real-time.</p>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search patient record..." 
                className="bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm w-80 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all font-medium"
              />
           </div>
           <button className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-all">
              <Bell size={20} className="text-slate-400" />
              <span className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#050505]" />
           </button>
        </div>
      </header>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Patient Queue', value: '18', sub: 'Consultations', icon: Users, color: 'text-blue-400' },
          { label: 'Avg. Wait Time', value: '14m', sub: 'Optimal Range', icon: Clock, color: 'text-amber-400' },
          { label: 'System Load', value: 'Light', sub: 'Resource Stable', icon: Activity, color: 'text-emerald-400' },
          { label: 'Critical Alerts', value: '02', sub: 'Immediate Action', icon: AlertCircle, color: 'text-rose-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-all group">
             <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
                   <stat.icon size={24} />
                </div>
                <ChevronRight size={16} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
             </div>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
             <h2 className="text-4xl font-black outfit tracking-tighter">{stat.value}</h2>
             <p className="text-[10px] font-bold text-slate-600 mt-2 uppercase tracking-tighter">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Patient Queue Matrix */}
        <div className="col-span-12 lg:col-span-8">
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                 <div className="flex items-center gap-3">
                    <LayoutDashboard className="text-blue-500" size={22} />
                    <h3 className="text-xl font-black outfit tracking-tight">Active Patient Stream</h3>
                 </div>
                 <div className="flex gap-2">
                    <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black tracking-widest uppercase text-slate-500">Triage: Priority</span>
                 </div>
              </div>
              
              <div className="divide-y divide-white/5">
                 {activePatients.map((p) => (
                    <div key={p.id} className="p-8 flex items-center justify-between group hover:bg-white/[0.02] transition-all cursor-pointer">
                       <div className="flex items-center gap-8">
                          <div className="relative">
                             <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center font-black text-2xl outfit transition-all ${
                                p.status === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.1)]' : 'bg-white/5 text-slate-400'
                             }`}>
                                {p.name[0]}
                             </div>
                             {p.status === 'CRITICAL' && <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-4 border-[#0a0a0a] animate-pulse" />}
                          </div>
                          
                          <div className="space-y-1">
                             <div className="flex items-center gap-3">
                                <h4 className="text-2xl font-black outfit tracking-tight text-white group-hover:text-blue-400 transition-colors">{p.name}</h4>
                                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border ${
                                   p.status === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                   p.type === 'VIP' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                   'bg-white/5 text-slate-500 border-white/10'
                                }`}>
                                   {p.status}
                                </span>
                             </div>
                             <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                <span className="font-mono text-slate-400">{p.id}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-800" />
                                <span>{p.age} Yrs</span>
                                <div className="w-1 h-1 rounded-full bg-slate-800" />
                                <span>ZONE: <span className="text-blue-500">{p.zone}</span></span>
                             </div>
                          </div>
                       </div>

                       <div className="flex items-center gap-12">
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Queue Depth</p>
                             <p className="text-2xl font-black outfit text-white">{p.wait}</p>
                          </div>
                          <button className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-all shadow-xl group-hover:shadow-blue-500/20">
                             <ChevronRight size={24} className="text-slate-600 group-hover:text-white" />
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Right Column: Insights & Alerts */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
           
           {/* Clinical Insights Feed */}
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-8 relative overflow-hidden group">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 rounded-[18px] bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30">
                    <Zap size={24} className="fill-white" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black outfit tracking-tight text-white">Clinical Insights</h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">Neural Network Audit</p>
                 </div>
              </div>

              <div className="space-y-5">
                 {clinicalInsights.map((alert) => (
                    <div key={alert.id} className={`p-6 rounded-3xl border transition-all ${
                       alert.type === 'critical' ? 'bg-rose-500/[0.03] border-rose-500/10 hover:border-rose-500/30' : 'bg-blue-500/[0.03] border-blue-500/10 hover:border-blue-500/30'
                    }`}>
                       <div className="flex justify-between items-center mb-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                             alert.type === 'critical' ? 'text-rose-500' : 'text-blue-500'
                          }`}>{alert.title}</span>
                          <span className="text-[10px] font-bold text-slate-600">{alert.timestamp}</span>
                       </div>
                       <p className={`text-sm font-medium leading-relaxed ${
                          alert.type === 'critical' ? 'text-slate-200' : 'text-slate-400'
                       }`}>
                          {alert.message}
                       </p>
                    </div>
                 ))}
              </div>

              <button className="w-full mt-8 py-5 bg-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-white/10 transition-all border border-white/5">
                 Expand Knowledge Base
              </button>
           </div>

           {/* Personal Schedule Brief */}
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-8">
              <div className="flex items-center gap-3 mb-8">
                 <Calendar className="text-blue-500" size={20} />
                 <h3 className="text-lg font-black outfit uppercase tracking-tight">Today's Schedule</h3>
              </div>
              
              <div className="space-y-6">
                 {[
                    { time: '14:30', event: 'Surgery Review', patient: 'Room 402' },
                    { time: '16:00', event: 'Grand Rounds', patient: 'Conference Hall' },
                 ].map((item, i) => (
                    <div key={i} className="flex items-start gap-5">
                       <span className="text-sm font-black text-blue-500 outfit">{item.time}</span>
                       <div className="space-y-0.5">
                          <p className="text-sm font-black text-white">{item.event}</p>
                          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{item.patient}</p>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
