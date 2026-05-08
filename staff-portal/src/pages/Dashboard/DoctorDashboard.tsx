import React from 'react';
import { 
  Users, 
  Activity, 
  Clock, 
  Shield, 
  ChevronRight, 
  Zap, 
  AlertTriangle,
  Stethoscope,
  Search,
  Bell,
  MoreVertical,
  Fingerprint
} from 'lucide-react';

import { useStore } from '../../store/useStore';

const DoctorDashboard: React.FC = () => {
  const { queue, alerts } = useStore();
  
  // Use store queue or fallback to mock if empty (for initial UI)
  const activePatients = queue.length > 0 ? queue : [
    { id: 'TK-102', name: 'Arjun Mehta', age: 58, priority: 120, status: 'CRITICAL', zone: 'ICU-1', wait: '2m', type: 'Emergency' },
    { id: 'TK-105', name: 'Sarah Khan', age: 34, priority: 85, status: 'STABLE', zone: 'OPD-B', wait: '12m', type: 'VIP' },
    { id: 'TK-108', name: 'Vikram Singh', age: 72, priority: 45, status: 'WAITING', zone: 'OPD-A', wait: '28m', type: 'Regular' },
  ];

  const recentAlerts = alerts.length > 0 ? alerts : [
    { id: '1', type: 'critical', title: 'Urgent Finding', message: "Abnormal spikes detected in Arjun Mehta's heart rate. Neural model suggests early signs of tachycardia.", timestamp: '1m ago' },
    { id: '2', type: 'info', title: 'Report Analysis', message: 'Lab reports for Sarah Khan processed. AI-summarized findings available for review.', timestamp: '14m ago' }
  ];

  return (
    <div className="min-h-screen p-6 space-y-8 animate-in fade-in duration-1000">
      {/* Top Command Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <span className="text-blue-500"><Stethoscope size={36} /></span>
            Clinical Command Center
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 pulse-emergency" />
            Live Sync • All Systems Operational
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search Patient ID / Name..." 
              className="w-full bg-slate-900/40 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <button className="p-2.5 glass-panel hover:bg-slate-800 transition-all relative">
            <Bell size={20} className="text-slate-400" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-950" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: Stats & Queue */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          {/* Real-time Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-card-premium p-6 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start mb-4">
                <Users className="text-blue-500" size={24} />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">Active</span>
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Queue Load</p>
              <h2 className="text-4xl font-black mt-1">18 <span className="text-sm font-medium text-slate-600">Patients</span></h2>
            </div>

            <div className="glass-card-premium p-6 border-l-4 border-l-orange-500">
              <div className="flex justify-between items-start mb-4">
                <Clock className="text-orange-500" size={24} />
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded">Warning</span>
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Avg. Response</p>
              <h2 className="text-4xl font-black mt-1">14 <span className="text-sm font-medium text-slate-600">Min</span></h2>
            </div>

            <div className="glass-card-premium p-6 border-l-4 border-l-green-500">
              <div className="flex justify-between items-start mb-4">
                <Shield className="text-green-500" size={24} />
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded">Secured</span>
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Data Integrity</p>
              <h2 className="text-4xl font-black mt-1">100<span className="text-sm font-medium text-slate-600">%</span></h2>
            </div>
          </div>

          {/* Live Patient Matrix */}
          <div className="glass-panel overflow-hidden border-slate-800/50">
            <div className="p-6 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/20">
              <div className="flex items-center gap-3">
                <Zap className="text-yellow-500 fill-yellow-500" size={20} />
                <h3 className="font-black uppercase tracking-tighter text-lg">Priority Triage Matrix</h3>
              </div>
              <button className="text-xs font-bold text-blue-500 uppercase hover:underline">Manage All</button>
            </div>
            
            <div className="divide-y divide-slate-800/50">
              {activePatients.map((p) => (
                <div key={p.id} className="p-6 flex items-center justify-between group hover:bg-white/[0.02] transition-all">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${
                        p.priority >= 100 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {p.name[0]}
                      </div>
                      {p.priority >= 100 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-4 border-slate-950 animate-pulse" />}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-black text-xl tracking-tight text-white">{p.name}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest border ${
                          p.type === 'Emergency' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          p.type === 'VIP' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {p.type}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 flex items-center gap-3 uppercase tracking-tighter">
                        <span className="text-slate-300">{p.id}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        Age: {p.age}
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        Zone: <span className="text-blue-500">{p.zone}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Queue Wait</p>
                      <p className="text-xl font-black text-slate-100">{p.wait}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Priority</p>
                      <p className={`text-xl font-black ${p.priority >= 100 ? 'text-red-500 text-glow-emergency' : 'text-slate-300'}`}>
                        {p.priority}
                      </p>
                    </div>
                    <button className="w-12 h-12 glass-panel flex items-center justify-center hover:bg-blue-600 transition-all hover:scale-110 group/btn">
                      <ChevronRight size={24} className="text-slate-400 group-hover/btn:text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI & Notifications */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* AI Clinical Insights */}
          <div className="glass-panel p-6 border-t-4 border-t-blue-600 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={100} />
            </div>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <Zap size={20} className="fill-white" />
              </div>
              <h3 className="font-black uppercase tracking-tighter text-lg">AI Clinical Neural-Feed</h3>
            </div>

            <div className="space-y-4">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-2xl border space-y-2 ${
                  alert.type === 'critical' ? 'bg-red-600/5 border-red-600/10' : 'bg-blue-600/5 border-blue-600/10'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      alert.type === 'critical' ? 'text-red-500' : 'text-blue-500'
                    }`}>{alert.title}</span>
                    <span className="text-[10px] font-bold text-slate-500">{alert.timestamp}</span>
                  </div>
                  <p className={`text-sm font-medium leading-relaxed ${
                    alert.type === 'critical' ? 'text-slate-200' : 'text-slate-400'
                  }`}>
                    {alert.message}
                  </p>
                </div>
              ))}
            </div>

            <button className="w-full mt-6 py-3 btn-outline-cyber rounded-xl font-bold text-xs">
              View All Intelligence
            </button>
          </div>

          {/* Critical Alerts */}
          <div className="glass-panel p-6 border-t-4 border-t-red-600 bg-red-600/5">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="text-red-500 pulse-emergency" size={24} />
              <h3 className="font-black uppercase tracking-tighter text-lg text-red-500">Critical Alerts</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-1.5 h-12 bg-red-600 rounded-full" />
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">ICU Bed Shortage</p>
                  <p className="text-xs text-slate-500 leading-tight mt-1">Only 1 Critical Care bed remaining in Block C.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Secure Biometric Status */}
          <div className="glass-panel p-6 bg-slate-900/20 border-slate-800/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Fingerprint size={20} className="text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Security Engine</span>
              </div>
              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Authenticated</span>
            </div>
            <p className="text-[10px] font-mono text-slate-600 break-all leading-tight">
              RS256::VERIFIED_IDENT_HASH: f46383b...24bbd99
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
