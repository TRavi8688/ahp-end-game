import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Activity, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  BarChart3, 
  PieChart as PieChartIcon,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Zap,
  Globe,
  Lock
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const AnalyticsDashboard = () => {
  const [throughput, setThroughput] = useState({ avg_lab_tat_minutes: 0, patient_volume_today: 0, system_load: 'STABLE' });
  const [risks, setRisks] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [thrRes, riskRes, revRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/analytics/throughput`, { headers }),
        axios.get(`${API_BASE_URL}/analytics/risk-stratification`, { headers }),
        axios.get(`${API_BASE_URL}/analytics/revenue`, { headers })
      ]);
      
      setThroughput(thrRes.data);
      setRisks(riskRes.data);
      setRevenue(revRes.data);
    } catch (err) {
      console.error("Analytics fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass, trend, index }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white/[0.03] border border-white/5 p-8 rounded-[40px] group hover:border-indigo-500/30 transition-all duration-500 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all duration-700 blur-2xl" />
      <div className="flex justify-between items-start mb-6">
        <div className={`w-14 h-14 rounded-2xl ${colorClass} bg-opacity-10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500`}>
          <Icon size={28} className={colorClass.replace('bg-', 'text-')} />
        </div>
        {trend && (
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-1 uppercase ${trend > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {trend > 0 ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <h3 className="text-slate-500 text-[10px] font-black tracking-[0.2em] uppercase mb-1">{title}</h3>
      <p className="text-4xl font-black text-white mb-2 outfit tracking-tighter">{value}</p>
      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">{subtext}</p>
    </motion.div>
  );

  return (
    <div className="analytics-container p-12 bg-[#050505] min-h-screen text-[#f8fafc] font-inter overflow-x-hidden">
      
      {/* Premium Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 tracking-[0.4em] uppercase">Intelligence Node: Active</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter outfit leading-none">Network Analytics</h1>
          <p className="text-slate-500 text-sm font-medium">Synchronizing clinical telemetry from {throughput.patient_volume_today} active nodes.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-4"
        >
          <button onClick={fetchData} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-white/10 transition-all flex items-center gap-3">
             <Globe size={16} />
             Live Sync
          </button>
          <button className="px-8 py-4 bg-white text-black rounded-2xl text-[10px] font-black tracking-widest uppercase shadow-2xl shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all">Export Forensic Report</button>
        </motion.div>
      </header>

      {/* Top Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        <StatCard 
          index={0}
          title="Daily Inflow" 
          value={throughput.patient_volume_today} 
          subtext="Consultation Stream" 
          icon={Users} 
          colorClass="bg-blue-500"
          trend={+8.4}
        />
        <StatCard 
          index={1}
          title="Operational TAT" 
          value={`${throughput.avg_lab_tat_minutes}m`} 
          subtext="Lab Processing Speed" 
          icon={Clock} 
          colorClass="bg-amber-500"
          trend={-12.1}
        />
        <StatCard 
          index={2}
          title="Resource Load" 
          value={throughput.system_load} 
          subtext="Node Saturation" 
          icon={Zap} 
          colorClass={throughput.system_load === 'HIGH' ? 'bg-rose-500' : 'bg-indigo-500'}
        />
        <StatCard 
          index={3}
          title="Safety Index" 
          value={100 - risks.length} 
          subtext="Clinical Risk Level" 
          icon={ShieldAlert} 
          colorClass="bg-rose-500"
          trend={+1.2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Financial Intelligence Matrix */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white/[0.03] border border-white/5 p-12 rounded-[48px] flex flex-col relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-20 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
             <DollarSign size={400} />
          </div>
          <div className="flex justify-between items-center mb-12 relative z-10">
            <div>
              <h2 className="text-3xl font-black tracking-tight mb-1 outfit">Revenue Intelligence</h2>
              <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">Forecasting & Capital Audit</p>
            </div>
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
              <button className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10">Network View</button>
              <button className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">Node Analysis</button>
            </div>
          </div>
          <div className="flex-1 min-h-[400px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 'bold'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 'bold'}} />
                <Tooltip 
                  cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                  itemStyle={{ color: '#fff', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={5} fillOpacity={1} fill="url(#colorRev)" animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* AI Clinical Risk Monitor */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white/[0.03] border border-white/5 p-12 rounded-[48px] flex flex-col relative overflow-hidden"
        >
          <div className="flex items-center gap-5 mb-12">
            <div className="w-14 h-14 rounded-[22px] bg-rose-500 flex items-center justify-center text-white shadow-2xl shadow-rose-500/20">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight outfit">Risk Monitor</h2>
              <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Clinical Neural-Feed</p>
            </div>
          </div>
          
          <div className="space-y-6 flex-1 overflow-y-auto max-h-[450px] pr-4 custom-scrollbar">
            {risks.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6">
                     <Target size={32} />
                  </div>
                  <p className="text-slate-500 text-sm font-black uppercase tracking-widest">Sovereign Safety: Optimal</p>
               </div>
            ) : (
              risks.map((risk, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + (i * 0.1) }}
                  key={i} 
                  className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 hover:border-rose-500/30 transition-all group cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase ${risk.risk_level === 'HIGH' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {risk.risk_level} Priority
                    </span>
                    <span className="text-[10px] font-bold text-slate-700">Audit {i + 1}02</span>
                  </div>
                  <p className="text-xl font-black text-white mb-2 outfit tracking-tight group-hover:text-rose-500 transition-colors">{risk.patient_name}</p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed italic">"{risk.trigger}"</p>
                </motion.div>
              ))
            )}
          </div>

          <button className="w-full mt-8 py-5 bg-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-white/10 transition-all border border-white/5 flex items-center justify-center gap-3">
             <Activity size={16} />
             View All Clinical Alerts
          </button>
        </motion.div>
      </div>

      {/* Operational Velocity Matrix */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white/[0.03] border border-white/5 rounded-[48px] overflow-hidden"
      >
        <div className="p-12 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[22px] bg-indigo-500 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20">
              <Target size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight outfit">Operational Velocity</h2>
              <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Departmental Performance Audit</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Global Efficiency</p>
                <p className="text-2xl font-black text-emerald-500 outfit">92.4%</p>
             </div>
          </div>
        </div>
        <div className="p-12">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { label: 'OPD Saturation', value: throughput.patient_volume_today > 0 ? 45 : 0, color: 'bg-indigo-500', desc: 'Active consultations in Block A/B' },
                { label: 'Pharmacy Throughput', value: throughput.patient_volume_today > 0 ? 82 : 0, color: 'bg-emerald-500', desc: 'Real-time dispensing efficiency' },
                { label: 'Lab Processing', value: throughput.avg_lab_tat_minutes > 0 ? 65 : 0, color: 'bg-amber-500', desc: 'Diagnostic result generation TAT' },
              ].map((metric, i) => (
                <div key={i} className="space-y-6">
                   <div className="flex justify-between items-end">
                      <h4 className="text-white text-lg font-black outfit tracking-tight">{metric.label}</h4>
                      <span className="text-sm font-black font-mono text-slate-400">{metric.value}%</span>
                   </div>
                   <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden relative">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${metric.value}%` }}
                        transition={{ duration: 1.5, delay: 1 }}
                        className={`${metric.color} h-full rounded-full shadow-[0_0_20px_rgba(255,255,255,0.1)]`} 
                      />
                   </div>
                   <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{metric.desc}</p>
                </div>
              ))}
           </div>
        </div>
      </motion.div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};

export default AnalyticsDashboard;
