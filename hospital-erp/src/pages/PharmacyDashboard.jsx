import React, { useState, useEffect } from 'react';
import { 
  Package, AlertTriangle, TrendingUp, 
  ArrowUpRight, ArrowDownRight, Clock,
  Search, Plus, Filter, Download, 
  LayoutDashboard, ShoppingCart, CreditCard, 
  Users, Settings, LogOut, ChevronRight, Zap,
  FlaskConical, ClipboardList, ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

const PharmacyDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStock: 0,
    nearExpiry: 0,
    todaySales: "₹0"
  });

  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        const [statsRes, invRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/pharmacy/stats`, { headers }),
          axios.get(`${API_BASE_URL}/pharmacy/inventory`, { headers })
        ]);
        
        setStats(statsRes.data);
        setInventory(invRes.data);
      } catch (error) {
        console.error("DATA_FETCH_FAILURE:", error);
        // Fallback to mocks if API fails for demo
        setInventory([
          { id: 1, name: "Paracetamol 500mg", batch: "B921", stock: 1240, status: "Healthy", expiry: "2025-12", price: "₹120" },
          { id: 2, name: "Amoxicillin 250mg", batch: "A402", stock: 42, status: "Low Stock", expiry: "2024-08", price: "₹450" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const StatCard = ({ title, value, icon: Icon, colorClass, trend, delay }) => (
    <div className="glass-card p-6 animate-fade-in group hover:border-indigo-500/50 transition-all duration-500" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-4 rounded-2xl ${colorClass} bg-opacity-10 flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black tracking-tighter ${trend > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <h3 className="text-slate-500 text-xs font-black tracking-widest uppercase mb-1">{title}</h3>
      <p className="text-3xl font-black text-white">{value}</p>
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
          <NavItem icon={LayoutDashboard} label="Operations" onClick={() => navigate('/pharmacy')} active />
          <NavItem icon={ShoppingCart} label="Inventory" onClick={() => navigate('/pharmacy')} />
          <NavItem icon={CreditCard} label="Billing" onClick={() => navigate('/billing')} />
          <NavItem icon={Users} label="Patient Roster" />
          <NavItem icon={ShieldAlert} label="Security" />
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
        <div className="fixed bottom-0 left-80 w-[400px] h-[400px] bg-emerald-600/5 blur-[120px] -z-10 rounded-full" />

        <header className="flex justify-between items-end mb-14">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase">Clinical ERP v4.0</span>
              </div>
              <span className="text-slate-600 text-xs font-bold">•</span>
              <span className="text-slate-400 text-xs font-bold">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter mb-2">Pharmacy Command</h1>
            <p className="text-slate-400 font-medium text-lg">Real-time inventory intelligence & logistics monitor.</p>
          </div>
          <div className="flex gap-4 mb-2">
            <button className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl text-xs font-black text-white hover:bg-white/10 transition-all tracking-widest uppercase">
              <Download size={16} /> Export Intel
            </button>
            <button className="flex items-center gap-2 bg-indigo-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all tracking-widest uppercase scale-100 hover:scale-105 active:scale-95">
              <Plus size={18} /> Add Entry
            </button>
          </div>
        </header>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard title="Total SKU" value={stats.totalItems} icon={Package} colorClass="bg-indigo-500" trend={+4} delay={0} />
          <StatCard title="Critical Stock" value={stats.lowStock} icon={AlertTriangle} colorClass="bg-amber-500" trend={-2} delay={100} />
          <StatCard title="Near Expiry" value={stats.nearExpiry} icon={Clock} colorClass="bg-rose-500" delay={200} />
          <StatCard title="Daily Intake" value={stats.todaySales} icon={TrendingUp} colorClass="bg-emerald-500" trend={+12} delay={300} />
        </div>

        {/* Inventory Ledger */}
        <div className="glass-card overflow-hidden animate-fade-in border-white/10 shadow-2xl" style={{ animationDelay: '400ms' }}>
          <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <ClipboardList className="text-indigo-500" size={20} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Active Stock Ledger</h2>
            </div>
            <div className="flex gap-4">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Query medication, batch, or status..." 
                  className="pl-14 pr-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none w-96 transition-all font-medium"
                />
              </div>
              <button className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 text-white transition-all">
                <Filter size={20} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-10 py-6">Clinical Identifier</th>
                  <th className="px-10 py-6">Batch Tracking</th>
                  <th className="px-10 py-6">Stock Level</th>
                  <th className="px-10 py-6">Health Index</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-10 py-7">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <FlaskConical size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-bold text-lg leading-none">{item.name}</span>
                          <span className="text-slate-500 text-[10px] font-black uppercase mt-2 tracking-widest">{item.price} • {item.expiry}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-7">
                      <span className="px-4 py-1.5 bg-indigo-500/5 border border-indigo-500/20 rounded-lg text-indigo-400 font-mono text-xs font-black tracking-widest">
                        {item.batch}
                      </span>
                    </td>
                    <td className="px-10 py-7">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-black text-lg">{item.stock}</span>
                        <span className="text-slate-600 text-xs font-bold uppercase tracking-widest">Units</span>
                      </div>
                    </td>
                    <td className="px-10 py-7">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${
                        item.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                        item.status === 'Low Stock' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                        'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          item.status === 'Healthy' ? 'bg-emerald-500' : 
                          item.status === 'Low Stock' ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{item.status}</span>
                      </div>
                    </td>
                    <td className="px-10 py-7 text-right">
                      <button className="text-slate-500 hover:text-white transition-colors">
                        <ChevronRight size={24} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

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

export default PharmacyDashboard;
