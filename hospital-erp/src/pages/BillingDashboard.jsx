import React, { useState } from 'react';
import { 
  CreditCard, ShieldCheck, FileText, 
  Search, ExternalLink, CheckCircle2, 
  Clock, XCircle, DollarSign, ArrowUpRight, ArrowDownRight, Plus, Filter, TrendingUp,
  LayoutDashboard, ShoppingCart, Users, Settings, LogOut, ChevronRight, Zap,
  BarChart3, Receipt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BillingDashboard = () => {
  const navigate = useNavigate();
  const [stats] = useState({
    totalCollections: "₹12.4L",
    pendingClaims: 24,
    unpaidInvoices: 42,
    settlementRate: "94%"
  });

  const [invoices] = useState([
    { id: "INV-8821", patient: "Rahul Sharma", amount: "₹4,200", status: "PAID", method: "Razorpay", date: "2024-05-14" },
    { id: "INV-8822", patient: "Anita Devi", amount: "₹12,800", status: "PENDING", method: "Insurance", date: "2024-05-14" },
    { id: "INV-8823", patient: "John Doe", amount: "₹1,500", status: "FAILED", method: "UPI", date: "2024-05-13" },
    { id: "INV-8824", patient: "Suresh Gupta", amount: "₹8,900", status: "PAID", method: "Cash", date: "2024-05-13" },
  ]);

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
      {subtext && <p className={`text-[10px] font-black tracking-widest uppercase mt-3 ${subtext.includes('Risk') ? 'text-rose-500' : 'text-slate-600'}`}>{subtext}</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#020617] font-outfit selection:bg-indigo-500/30">
      {/* Premium Side Navigation */}
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
          <NavItem icon={LayoutDashboard} label="Operations" onClick={() => navigate('/pharmacy')} />
          <NavItem icon={ShoppingCart} label="Inventory" onClick={() => navigate('/pharmacy')} />
          <NavItem icon={CreditCard} label="Billing" onClick={() => navigate('/billing')} active />
          <NavItem icon={Users} label="Patient Roster" />
          <NavItem icon={BarChart3} label="Revenue Analytics" />
          <NavItem icon={Settings} label="System Config" />
        </nav>

        <div className="pt-8 border-t border-white/5 mt-auto">
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mb-6">
            <p className="text-[10px] font-black text-indigo-400 tracking-widest uppercase mb-2">Cloud Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-white">Live Production</span>
            </div>
          </div>
          <NavItem icon={LogOut} label="Terminate Session" danger />
        </div>
      </aside>

      {/* Main Command Center */}
      <main className="flex-1 ml-80 p-12 bg-transparent relative">
        {/* Background Gradients */}
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] -z-10 rounded-full" />
        <div className="fixed bottom-0 left-80 w-[400px] h-[400px] bg-rose-600/5 blur-[120px] -z-10 rounded-full" />

        <header className="flex justify-between items-end mb-14">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase">Clinical ERP v4.0</span>
              </div>
              <span className="text-slate-600 text-xs font-bold">•</span>
              <span className="text-slate-400 text-xs font-bold">Revenue Cycle Management</span>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter mb-2">Billing Dashboard</h1>
            <p className="text-slate-400 font-medium text-lg">Financial integrity & insurance settlement monitor.</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all tracking-widest uppercase scale-100 hover:scale-105 active:scale-95 mb-2">
            <Plus size={18} /> Generate Invoice
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard title="Total Collections" value={stats.totalCollections} icon={DollarSign} colorClass="bg-indigo-500" trend="+18%" delay={0} />
          <StatCard title="Pending Claims" value={stats.pendingClaims} icon={ShieldCheck} colorClass="bg-amber-500" subtext="₹4.2L At Risk" delay={100} />
          <StatCard title="Unpaid Invoices" value={stats.unpaidInvoices} icon={FileText} colorClass="bg-rose-500" subtext="Needs Follow-up" delay={200} />
          <StatCard title="Settlement Rate" value={stats.settlementRate} icon={CheckCircle2} colorClass="bg-emerald-500" subtext="Above Target" delay={300} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Invoices Table */}
          <div className="lg:col-span-2 glass-card overflow-hidden animate-fade-in border-white/10 shadow-2xl" style={{ animationDelay: '400ms' }}>
            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Receipt className="text-indigo-500" size={20} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Recent Transactions</h2>
              </div>
              <div className="flex gap-4">
                 <button className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 text-white transition-all"><Search size={20} /></button>
                 <button className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 text-white transition-all"><Filter size={20} /></button>
              </div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-10 py-6">Invoice ID</th>
                  <th className="px-10 py-6">Patient Node</th>
                  <th className="px-10 py-6">Amount</th>
                  <th className="px-10 py-6">Status</th>
                  <th className="px-10 py-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-10 py-7 font-mono text-sm text-indigo-400 font-black tracking-widest">{inv.id}</td>
                    <td className="px-10 py-7">
                        <span className="text-white font-bold text-lg leading-none">{inv.patient}</span>
                        <span className="block text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">{inv.method} • {inv.date}</span>
                    </td>
                    <td className="px-10 py-7">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-black text-xl">{inv.amount}</span>
                      </div>
                    </td>
                    <td className="px-10 py-7">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border ${
                        inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                        inv.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                        'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-10 py-7 text-right">
                      <button className="text-slate-500 hover:text-white transition-colors"><ExternalLink size={20} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insurance Claims Sidebar */}
          <div className="glass-card p-10 animate-fade-in border-white/10 shadow-2xl flex flex-col" style={{ animationDelay: '500ms' }}>
            <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ShieldCheck className="text-emerald-500" size={20} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Claim Tracker</h2>
            </div>
            <div className="space-y-6 flex-1">
              <ClaimItem tpa="Star Health" id="CLM-401" patient="Anita Devi" amount="₹12,800" status="SUBMITTED" colorClass="text-amber-500" />
              <ClaimItem tpa="HDFC Ergo" id="CLM-402" patient="Suresh Kumar" amount="₹45,000" status="APPROVED" colorClass="text-emerald-500" />
              <ClaimItem tpa="Niva Bupa" id="CLM-403" patient="Vikram Singh" amount="₹8,200" status="QUERY" colorClass="text-rose-500" />
            </div>
            <button className="w-full mt-10 py-5 border border-white/10 text-white text-[10px] font-black tracking-[0.3em] uppercase rounded-2xl hover:bg-white/5 hover:border-indigo-500/30 transition-all">
              Launch Settlement Engine
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

const ClaimItem = ({ tpa, id, patient, amount, status, colorClass }) => (
    <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{tpa}</span>
        <span className="text-[10px] font-bold text-slate-700 font-mono">{id}</span>
      </div>
      <p className="text-white font-black text-lg mb-6 group-hover:text-indigo-400 transition-colors">{patient}</p>
      <div className="flex justify-between items-center pt-4 border-t border-white/5">
        <span className="text-xl font-black text-white">{amount}</span>
        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${colorClass}`}>
          <div className={`w-1.5 h-1.5 rounded-full bg-current`} /> {status}
        </div>
      </div>
    </div>
);

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
    {active && (
        <div className="absolute left-0 w-1.5 h-6 bg-white rounded-r-full" />
    )}
  </button>
);

export default BillingDashboard;
