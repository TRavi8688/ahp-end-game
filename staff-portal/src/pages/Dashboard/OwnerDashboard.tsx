import React, { useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  Building2, 
  ArrowUpRight, 
  BarChart3, 
  Zap, 
  QrCode,
  DollarSign,
  Activity,
  Layers,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Lock,
  Clock
} from 'lucide-react';

import { useStore } from '../../store/useStore';
import { useAuth } from '../../context/AuthContext';

const OwnerDashboard: React.FC = () => {
  const { queue, alerts, systemStatus } = useStore();
  const { user } = useAuth();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // --- SUB-COMPONENT: VERIFICATION PENDING ---
  const VerificationPending = () => (
    <div className="min-h-screen flex items-center justify-center p-10 bg-[#050505]">
      <div className="max-w-3xl w-full">
        <div className="bg-white/[0.03] border border-white/5 rounded-[48px] p-16 text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 p-20 opacity-[0.02]">
              <ShieldCheck size={300} />
           </div>
           
           <div className="w-24 h-24 bg-amber-500/10 rounded-[32px] flex items-center justify-center mx-auto mb-10 text-amber-500 border border-amber-500/20">
              <Clock size={48} className="animate-pulse" />
           </div>
           
           <h1 className="text-5xl font-black tracking-tighter outfit mb-6 text-white">Verification in Progress</h1>
           <p className="text-slate-500 text-lg font-medium mb-12 max-w-lg mx-auto">
              Our clinical governance team is currently reviewing your hospital's credentials. This typically takes 2-4 hours.
           </p>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[
                { label: 'Identity Check', status: 'Completed', icon: CheckCircle2, color: 'text-emerald-500' },
                { label: 'License Audit', status: 'In Progress', icon: Activity, color: 'text-amber-500' },
                { label: 'Node Provision', status: 'Pending', icon: Lock, color: 'text-slate-700' },
              ].map((step, i) => (
                <div key={i} className="bg-white/5 rounded-3xl p-6 border border-white/5">
                   <step.icon className={`${step.color} mx-auto mb-3`} size={24} />
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{step.label}</p>
                   <p className={`text-xs font-bold ${step.color}`}>{step.status}</p>
                </div>
              ))}
           </div>
           
           <div className="p-6 bg-white/5 rounded-2xl border border-white/5 inline-flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Forensic Ledger Hash: 0x4f6...a92b</span>
           </div>
        </div>
      </div>
    </div>
  );

  // --- SUB-COMPONENT: PAYMENT REQUIRED ---
  const PaymentRequired = () => (
    <div className="min-h-screen flex items-center justify-center p-10 bg-[#050505]">
      <div className="max-w-3xl w-full">
        <div className="bg-white/[0.03] border border-white/5 rounded-[48px] p-16 text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 p-20 opacity-[0.02]">
              <CreditCard size={300} />
           </div>
           
           <div className="w-24 h-24 bg-emerald-500/10 rounded-[32px] flex items-center justify-center mx-auto mb-10 text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 size={48} />
           </div>
           
           <h1 className="text-5xl font-black tracking-tighter outfit mb-6 text-white">Credentials Verified</h1>
           <p className="text-slate-500 text-lg font-medium mb-12 max-w-lg mx-auto">
              Your hospital has been approved. To activate your sovereign clinical node, please complete the one-time verification fee of ₹1.
           </p>
           
           <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[40px] mb-12 text-left">
              <div className="flex justify-between items-center mb-6">
                 <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Verification Fee</span>
                 <span className="text-3xl font-black outfit text-white">₹1.00</span>
              </div>
              <div className="h-px bg-white/5 mb-6" />
              <div className="flex items-center gap-4 text-slate-500 text-sm font-medium">
                 <Lock size={16} />
                 <span>Secured by Razorpay Enterprise Encryption</span>
              </div>
           </div>
           
           <button 
             onClick={() => {/* Trigger Razorpay Flow */}}
             className="w-full py-6 bg-white text-black rounded-3xl font-black text-xs tracking-[0.2em] uppercase hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-white/10"
           >
              Initialize Sovereign Activation
           </button>
        </div>
      </div>
    </div>
  );

  // --- ACTUAL OPERATIONAL DASHBOARD ---
  if (user?.hospital_status === 'pending') return <VerificationPending />;
  if (user?.hospital_status === 'verified_awaiting_payment') return <PaymentRequired />;

  const staffStatus = [
    { name: 'Dr. Sharma', role: 'Cardiologist', status: 'ACTIVE', load: 85, color: 'text-rose-500' },
    { name: 'Dr. Patel', role: 'Gen. Physician', status: 'ACTIVE', load: 40, color: 'text-blue-500' },
    { name: 'Nurse Anjali', role: 'Staff Head', status: 'ON BREAK', load: 0, color: 'text-slate-500' },
  ];

  const recentAlerts = alerts.length > 0 ? alerts : [
    { id: '1', type: 'warning', title: 'Efficiency Delta', message: 'OPD wait times are 40% higher than baseline. Suggest re-allocating Block B triage.' },
    { id: '2', type: 'info', title: 'Revenue Optimization', message: 'Pharmacy conversion increased by 12% following AI inventory re-stock.' }
  ];

  return (
    <div className="min-h-screen p-10 bg-[#050505] text-[#f8fafc] font-inter">
      
      {/* Premium Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase">Status: Enterprise Node Operational</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter outfit leading-none">Intelligence Hub</h1>
          <p className="text-slate-500 text-sm font-medium">Global oversight for {user?.email.split('@')[0].toUpperCase()} Medical Center.</p>
        </div>

        <div className="flex gap-4">
           <div className="bg-white/[0.03] border border-white/5 rounded-2xl px-6 py-4 flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Today's Yield</p>
                <p className="text-xl font-black text-white">₹42.5k</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <TrendingUp size={20} />
              </div>
           </div>
        </div>
      </header>

      {/* High-Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Monthly Revenue', value: '₹12.4M', trend: '+12.5%', icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Patient Inflow', value: '1,240', trend: '+8.0%', icon: Users, color: 'text-blue-400' },
          { label: 'Bed Utilization', value: '88%', trend: 'Optimal', icon: Building2, color: 'text-indigo-400' },
          { label: 'Response Time', value: '14m', trend: '+15.0%', icon: Activity, color: 'text-amber-400' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-xl bg-white/5 ${kpi.color}`}>
                <kpi.icon size={24} />
              </div>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full bg-white/5 text-slate-400`}>
                {kpi.trend}
              </span>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{kpi.label}</p>
            <h2 className="text-4xl font-black outfit tracking-tighter text-white">{kpi.value}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: Revenue Analysis */}
        <div className="col-span-12 lg:col-span-8">
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-10 space-y-10">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <BarChart3 className="text-blue-500" size={24} />
                    <h3 className="text-2xl font-black outfit tracking-tight">Financial Matrix</h3>
                 </div>
                 <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    <button className="px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">Weekly</button>
                    <button className="px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white text-black shadow-lg">Monthly</button>
                 </div>
              </div>

              {/* Bar Chart Visualization */}
              <div className="h-[300px] w-full flex items-end justify-between gap-6 px-4">
                 {[60, 45, 90, 65, 80, 50, 75, 40, 85, 60, 95, 70].map((h, i) => (
                    <div key={i} className="flex-1 group relative">
                       <div 
                         className="w-full bg-blue-600/10 border-t border-blue-600/30 rounded-t-xl transition-all duration-700 group-hover:bg-blue-600 group-hover:shadow-[0_0_40px_rgba(37,99,235,0.3)] origin-bottom cursor-pointer" 
                         style={{ height: `${h}%` }} 
                       />
                       <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl">
                          ₹{h}k
                       </div>
                    </div>
                 ))}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pt-4">
                 {[
                    { label: 'Consultations', val: '₹2.4M', color: 'bg-blue-500', width: '65%' },
                    { label: 'Pharmacy', val: '₹850k', color: 'bg-emerald-500', width: '45%' },
                    { label: 'Diagnostics', val: '₹1.2M', color: 'bg-indigo-500', width: '80%' }
                 ].map((item, i) => (
                    <div key={i} className="space-y-3">
                       <div className="flex justify-between items-end">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                          <p className="text-lg font-black text-white outfit">{item.val}</p>
                       </div>
                       <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} transition-all duration-1000`} style={{ width: item.width }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Right Column: Staff & AI Insights */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
           
           {/* Operational Roster */}
           <div className="bg-white/[0.03] border border-white/5 rounded-[40px] p-8 space-y-8">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-[18px] bg-white/5 flex items-center justify-center text-blue-500 border border-white/5">
                    <Layers size={24} />
                 </div>
                 <h3 className="text-xl font-black outfit tracking-tight text-white">Active Roster</h3>
              </div>
              
              <div className="space-y-4">
                 {staffStatus.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-white/[0.02] rounded-[24px] border border-white/5 hover:border-white/10 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black text-slate-500 outfit">
                             {s.name[4]}
                          </div>
                          <div>
                             <h4 className="text-sm font-black text-white uppercase tracking-tight">{s.name}</h4>
                             <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{s.role}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${s.color}`}>{s.status}</span>
                          <div className="w-16 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                             <div className={`h-full ${s.color.replace('text-', 'bg-')} transition-all duration-1000`} style={{ width: `${s.load}%` }} />
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
              
              <button className="w-full py-5 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5">
                 Expand Staff Directory
              </button>
           </div>

           {/* AI Platform Insights */}
           <div className="bg-blue-600/[0.03] border border-blue-600/10 rounded-[40px] p-8 relative overflow-hidden">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 rounded-[18px] bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30">
                    <Zap size={24} className="fill-white" />
                 </div>
                 <h3 className="text-xl font-black outfit tracking-tight text-white">Business Intelligence</h3>
              </div>

              <div className="space-y-5">
                 {recentAlerts.map((alert) => (
                    <div key={alert.id} className="p-6 bg-white/[0.02] rounded-[28px] border border-white/5 space-y-3">
                       <p className={`text-[10px] font-black uppercase tracking-widest ${
                          alert.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                       }`}>{alert.title}</p>
                       <p className="text-sm font-medium text-slate-400 leading-relaxed">
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
