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
  Plus
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
    <div className="min-h-screen p-6 space-y-8 animate-in slide-in-from-bottom-8 duration-1000">
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <span className="text-blue-500"><Activity size={36} /></span>
            Nurse Triage Command
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase flex items-center gap-2">
            Ward: <span className="text-blue-400">Main OPD Block</span> • Staff ID: <span className="text-slate-300">N-4290</span>
          </p>
        </div>
        <button className="btn-cyber px-6 py-3 rounded-2xl flex items-center gap-2 text-sm">
          <Plus size={18} />
          <span>New Emergency Entry</span>
        </button>
      </div>

      {/* Vitals HUD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Heart Rate', value: '72', unit: 'BPM', icon: Heart, color: 'text-red-500', glow: 'hsla(0, 84.2%, 60.2%, 0.1)' },
          { label: 'Blood Oxygen', value: '98', unit: '%', icon: Wind, color: 'text-blue-500', glow: 'hsla(217, 91%, 60%, 0.1)' },
          { label: 'Body Temp', value: '98.6', unit: '°F', icon: Thermometer, color: 'text-orange-500', glow: 'hsla(38, 92%, 50%, 0.1)' },
          { label: 'Blood Pressure', value: '120/80', unit: 'mmHg', icon: Droplets, color: 'text-purple-500', glow: 'hsla(280, 91%, 60%, 0.1)' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-6 group hover:scale-105 transition-all cursor-pointer relative" style={{ background: stat.glow }}>
            <div className="flex justify-between items-start mb-4">
              <stat.icon className={`${stat.color} transition-transform group-hover:scale-110`} size={24} />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Feed</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-black tracking-tighter">{stat.value}</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label} • {stat.unit}</p>
            </div>
            <div className={`absolute bottom-0 left-0 h-1 transition-all group-hover:w-full w-0 ${stat.color.replace('text-', 'bg-')}`} />
          </div>
        ))}
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: Triage Matrix */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
              <ClipboardCheck size={20} className="text-blue-500" />
              Triage Matrix
            </h3>
            <span className="text-[10px] font-black text-slate-500 bg-slate-900 px-3 py-1 rounded-full uppercase tracking-widest">
              {triageQueue.length} Pending Vitals
            </span>
          </div>

          <div className="space-y-4">
            {triageQueue.map((p) => (
              <div key={p.id} className="glass-card-premium p-6 flex items-center justify-between group">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-all">
                    {p.name[0]}
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-white">{p.name}</h4>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">
                      ID: <span className="text-slate-300">{p.id}</span> • Checked In: <span className="text-blue-400">{p.time}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                    p.priority === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/20 pulse-emergency' : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {p.priority} Priority
                  </span>
                  <button className="btn-outline-cyber px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                    Initiate Vitals
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Bedside Task Grid */}
          <div className="mt-12 space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
              <AlertCircle size={20} className="text-orange-500" />
              Doctor Issued Bedside Tasks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bedsideTasks.map((task) => (
                <div key={task.id} className="glass-panel p-6 border-l-4 border-l-blue-600 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-white">{task.patient}</h4>
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{task.ward}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded ${
                      task.status === 'DUE NOW' ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-400 leading-relaxed italic">
                    "{task.instruction}"
                  </p>
                  <button className="w-full py-2.5 rounded-xl bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-slate-700 transition-all">
                    Mark as Completed
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Ward Stats & Occupancy */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="glass-panel p-8 space-y-6">
            <div className="flex items-center gap-3">
              <Bed className="text-blue-500" size={24} />
              <h3 className="font-black uppercase tracking-tighter text-xl">Ward Occupancy</h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-4xl font-black text-white">12 <span className="text-sm font-medium text-slate-600 tracking-normal uppercase">/ 15</span></span>
                <span className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">80% Capacity</span>
              </div>
              <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all duration-1000" style={{ width: '80%' }} />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3 pt-4">
              {[...Array(15)].map((_, i) => (
                <div 
                  key={i} 
                  className={`h-10 rounded-xl border transition-all duration-500 ${
                    i < 12 ? 'bg-blue-600/20 border-blue-600/30 shadow-[inset_0_0_10px_rgba(37,99,235,0.1)]' : 'bg-slate-900/50 border-slate-800'
                  }`}
                />
              ))}
            </div>

            <div className="pt-6 border-t border-slate-800/50 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Critical Beds Free</span>
                <span className="text-xs font-black text-red-500">01</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Isolation Rooms</span>
                <span className="text-xs font-black text-green-500">02</span>
              </div>
            </div>
          </div>

          {/* Nurse Shift Summary */}
          <div className="glass-panel p-6 bg-blue-600/5 border-blue-600/10">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Active Shift Intelligence</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-10 bg-green-500 rounded-full" />
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">On Schedule</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">0/4 Medication delays</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NurseDashboard;
