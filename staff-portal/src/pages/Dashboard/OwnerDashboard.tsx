import React from 'react';
import { 
  TrendingUp, 
  Users, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart3, 
  Zap, 
  QrCode,
  DollarSign,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';

import { useStore } from '../../store/useStore';

const OwnerDashboard: React.FC = () => {
  const { queue, alerts, systemStatus } = useStore();
  
  const staffStatus = [
    { name: 'Dr. Sharma', role: 'Cardiologist', status: 'ACTIVE', load: 85, color: 'text-red-500' },
    { name: 'Dr. Patel', role: 'Gen. Physician', status: 'ACTIVE', load: 40, color: 'text-blue-500' },
    { name: 'Nurse Anjali', role: 'Staff Head', status: 'ON BREAK', load: 0, color: 'text-slate-500' },
  ];

  const recentAlerts = alerts.length > 0 ? alerts : [
    { id: '1', type: 'warning', title: 'Wait Time Anomaly', message: 'General OPD wait times are 40% higher than average. Consider re-routing non-emergency triage to Dr. Patel.' },
    { id: '2', type: 'info', title: 'Revenue Forecast', message: 'Pharmacy conversion is down 15%. Patients are fulfilling prescriptions externally. Review stock availability.' }
  ];

  return (
    <div className="min-h-screen p-6 space-y-8 animate-in zoom-in-95 duration-1000">
      
      {/* Revenue Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <span className="text-blue-500"><BarChart3 size={36} /></span>
            Hospital Intelligence Hub
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase flex items-center gap-2">
            Platform Status: <span className="text-green-500 font-black">PREMIUM ENTERPRISE</span>
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="glass-panel px-4 py-2 flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Global Revenue</p>
              <p className="text-lg font-black text-white">₹12.4M</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
              <ArrowUpRight size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* High-Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Daily Revenue', value: '₹42,500', trend: '+12.5%', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/5' },
          { label: 'Patient Footfall', value: '124', trend: '+8.0%', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/5' },
          { label: 'Bed Occupancy', value: '88%', trend: '-2.1%', icon: Building2, color: 'text-purple-500', bg: 'bg-purple-500/5' },
          { label: 'Wait Efficiency', value: '14m', trend: '+15.0%', icon: Activity, color: 'text-yellow-500', bg: 'bg-yellow-500/5' },
        ].map((kpi, i) => (
          <div key={i} className={`glass-card-premium p-6 ${kpi.bg} border-b-2 border-b-transparent hover:border-b-blue-500`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${kpi.bg.replace('/5', '/10')} ${kpi.color}`}>
                <kpi.icon size={24} />
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded ${kpi.trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {kpi.trend}
              </span>
            </div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{kpi.label}</p>
            <h2 className="text-3xl font-black tracking-tight text-white">{kpi.value}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: Revenue Analysis & Departments */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="glass-panel p-8 space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <TrendingUp size={24} className="text-blue-500" />
                Revenue Analytics Matrix
              </h3>
              <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                <button className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Weekly</button>
                <button className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg">Monthly</button>
              </div>
            </div>

            {/* Custom SVG Chart Area */}
            <div className="h-[250px] w-full flex items-end justify-between gap-4 px-4 border-b border-slate-800 pb-2">
              {[60, 45, 90, 65, 80, 50, 75, 40, 85, 60, 95, 70].map((h, i) => (
                <div key={i} className="flex-1 group relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">₹{h}k</div>
                  <div 
                    className="w-full bg-blue-600/10 border-t border-blue-600/30 rounded-t-lg transition-all duration-700 group-hover:bg-blue-600 group-hover:scale-y-105 origin-bottom cursor-pointer" 
                    style={{ height: `${h}%` }} 
                  />
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-3 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consultations</p>
                <p className="text-xl font-black text-white">₹2.4M</p>
                <div className="h-1 bg-blue-600/20 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[65%]" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pharmacy</p>
                <p className="text-xl font-black text-white">₹850k</p>
                <div className="h-1 bg-green-600/20 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-[45%]" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lab/Diagnostics</p>
                <p className="text-xl font-black text-white">₹1.2M</p>
                <div className="h-1 bg-purple-600/20 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 w-[80%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Department QR Command */}
          <div className="space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
              <QrCode size={20} className="text-blue-500" />
              Department Access Control
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['OPD Reception', 'Emergency', 'Pharmacy', 'Lab Services'].map((dept) => (
                <button key={dept} className="glass-card-premium p-6 flex flex-col items-center gap-4 hover:border-blue-500 group">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800 group-hover:border-blue-500 transition-all">
                    <QrCode size={32} className="text-slate-600 group-hover:text-blue-500" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{dept}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Staff & AI Insights */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Active Staff Feed */}
          <div className="glass-panel p-6 space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
              <Layers size={20} className="text-blue-500" />
              Operational Roster
            </h3>
            
            <div className="space-y-4">
              {staffStatus.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
                      {s.name[4]}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight">{s.name}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{s.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${s.color}`}>{s.status}</span>
                    <div className="w-20 h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full ${s.color.replace('text-', 'bg-')} transition-all duration-1000`} style={{ width: `${s.load}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full py-3 btn-outline-cyber rounded-xl text-[10px] font-black uppercase tracking-widest">
              View Full Shift Logs
            </button>
          </div>

          {/* AI Platform Insights */}
          <div className="glass-panel p-6 border-t-4 border-t-blue-600 bg-blue-600/5 space-y-6">
            <div className="flex items-center gap-3">
              <Zap size={20} className="text-blue-500 fill-blue-500" />
              <h3 className="font-black uppercase tracking-tighter text-lg">AI Business Insights</h3>
            </div>

            <div className="space-y-4">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-2">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${
                    alert.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                  }`}>{alert.title}</p>
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">
                    {alert.message}
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

export default OwnerDashboard;
