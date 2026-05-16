import React from 'react';
import { 
  Activity, 
  Bed, 
  ChevronRight, 
  Thermometer, 
  Droplets, 
  Heart, 
  Wind,
  ClipboardCheck,
  AlertCircle,
  Plus,
  Monitor,
  LayoutGrid
} from 'lucide-react';

import { useStore } from '../../store/useStore';

const NurseDashboard: React.FC = () => {
  const { queue } = useStore();
  
  const triageQueue = queue.length > 0 ? queue : [
    { id: 'TR-402', name: 'Rohan Deshmukh', priority: 'High', time: '10:05 AM', task: 'Vitals Entry' },
    { id: 'TR-405', name: 'Priya Verma', priority: 'Regular', time: '10:15 AM', task: 'Vitals Entry' },
  ];

  const bedsideTasks = [
    { id: 'TS-901', patient: 'Arjun Mehta', ward: 'ICU-1', instruction: 'Monitor SpO2 every 15m', status: 'DUE NOW' },
    { id: 'TS-904', patient: 'Sarah Khan', ward: 'OPD-B', instruction: 'Administer follow-up injection', status: 'PENDING' },
  ];

  return (
    <div className="min-h-screen p-10 bg-[#050505] text-[#f8fafc] font-inter">
      
      {/* Premium Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[10px] font-black text-blue-500 tracking-[0.3em] uppercase">Ward Active: Main Block 4</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter outfit leading-none">Nursing Command</h1>
          <p className="text-slate-500 text-sm font-medium">Coordinating care for {triageQueue.length} triage cases and active beds.</p>
        </div>

        <div className="flex items-center gap-4">
           <button className="bg-white text-black px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3">
              <Plus size={18} />
              New Admission
           </button>
        </div>
      </header>

      {/* Vitals Telemetry HUD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Heart Rate', value: '72', unit: 'BPM', icon: Heart, color: 'text-rose-500', trend: 'STABLE' },
          { label: 'SpO2 Level', value: '98', unit: '%', icon: Wind, color: 'text-blue-500', trend: 'OPTIMAL' },
          { label: 'Core Temp', value: '98.6', unit: '°F', icon: Thermometer, color: 'text-amber-500', trend: 'NORMAL' },
          { label: 'Pressure', value: '120/80', unit: 'mmHg', icon: Droplets, color: 'text-indigo-500', trend: 'SECURED' },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-all group relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                <stat.icon size={80} />
             </div>
             <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
                   <stat.icon size={24} />
                </div>
                <span className={`text-[10px] font-black tracking-widest ${stat.color}`}>{stat.trend}</span>
             </div>
             <h2 className="text-4xl font-black outfit tracking-tighter">{stat.value}<span className="text-sm font-medium text-slate-600 ml-1">{stat.unit}</span></h2>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Triage Matrix */}
        <div className="col-span-12 lg:col-span-8">
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                 <div className="flex items-center gap-3">
                    <ClipboardCheck className="text-blue-500" size={22} />
                    <h3 className="text-xl font-black outfit tracking-tight">Pending Triage Cases</h3>
                 </div>
                 <span className="px-4 py-2 bg-blue-500/10 text-blue-500 rounded-xl text-[10px] font-black tracking-widest uppercase">
                    {triageQueue.length} Active Requests
                 </span>
              </div>
              
              <div className="divide-y divide-white/5">
                 {triageQueue.map((p) => (
                    <div key={p.id} className="p-8 flex items-center justify-between group hover:bg-white/[0.02] transition-all">
                       <div className="flex items-center gap-8">
                          <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center font-black text-2xl outfit transition-all ${
                             p.priority === 'High' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.1)]' : 'bg-white/5 text-slate-500'
                          }`}>
                             {p.name[0]}
                          </div>
                          
                          <div className="space-y-1">
                             <div className="flex items-center gap-3">
                                <h4 className="text-2xl font-black outfit tracking-tight text-white">{p.name}</h4>
                                {p.priority === 'High' && (
                                   <span className="text-[10px] px-3 py-1 bg-rose-500/10 text-rose-500 rounded-full font-black uppercase tracking-widest border border-rose-500/20">URGENT</span>
                                )}
                             </div>
                             <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                <span className="font-mono text-slate-400">{p.id}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-800" />
                                <span>WAIT: <span className="text-blue-500">{p.time}</span></span>
                             </div>
                          </div>
                       </div>

                       <button className="bg-white/5 hover:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all">
                          Initiate Intake
                       </button>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Ward Intelligence */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
           
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-8">
              <div className="flex items-center gap-4 mb-10">
                 <div className="w-12 h-12 rounded-[18px] bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30">
                    <Bed size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black outfit tracking-tight text-white">Ward Capacity</h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">80% Occupancy</p>
                 </div>
              </div>

              <div className="grid grid-cols-5 gap-4 mb-8">
                 {[...Array(15)].map((_, i) => (
                    <div 
                       key={i} 
                       className={`h-12 rounded-xl border transition-all duration-500 ${
                          i < 12 ? 'bg-blue-500/20 border-blue-500/30' : 'bg-white/5 border-white/10'
                       }`}
                    />
                 ))}
              </div>

              <div className="space-y-4 pt-6 border-t border-white/5">
                 <div className="flex justify-between items-center text-[10px] font-black tracking-widest uppercase">
                    <span className="text-slate-500">Critical Care Beds</span>
                    <span className="text-rose-500">01 FREE</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-black tracking-widest uppercase">
                    <span className="text-slate-500">General Ward</span>
                    <span className="text-emerald-500">02 FREE</span>
                 </div>
              </div>
           </div>

           {/* Bedside Task Feed */}
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-8">
              <div className="flex items-center gap-3 mb-8">
                 <Monitor className="text-blue-500" size={20} />
                 <h3 className="text-lg font-black outfit uppercase tracking-tight text-white">Active Tasks</h3>
              </div>
              
              <div className="space-y-6">
                 {bedsideTasks.map((task) => (
                    <div key={task.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4 hover:border-blue-500/30 transition-all">
                       <div className="flex justify-between items-start">
                          <div>
                             <p className="text-sm font-black text-white">{task.patient}</p>
                             <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{task.ward}</p>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-1 rounded ${
                             task.status === 'DUE NOW' ? 'bg-rose-500/10 text-rose-500' : 'bg-white/5 text-slate-500'
                          }`}>
                             {task.status}
                          </span>
                       </div>
                       <p className="text-xs font-medium text-slate-400 italic leading-relaxed">
                          "{task.instruction}"
                       </p>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default NurseDashboard;
