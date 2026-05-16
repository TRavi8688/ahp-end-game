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
import Sidebar from '../components/Sidebar';

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';

const chartData = []; // Purged: System waiting for real-time velocity data

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
  const [prescriptions, setPrescriptions] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, invRes, presRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/pharmacy/stats`, { headers }),
        axios.get(`${API_BASE_URL}/pharmacy/inventory`, { headers }),
        axios.get(`${API_BASE_URL}/clinical/prescriptions`, { headers })
      ]);
      
      setStats(statsRes.data);
      setInventory(invRes.data);
      setPrescriptions(presRes.data.filter(p => p.status === 'pending'));
    } catch (error) {
      console.error("DATA_FETCH_FAILURE:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
      {/* Sidebar */}
      <Sidebar />

      {/* Main Command Center */}
      <main className="flex-1 ml-80 p-12 bg-transparent relative">
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
            <button 
                onClick={() => setIsDispenseModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-emerald-700 shadow-2xl shadow-emerald-500/30 transition-all tracking-widest uppercase scale-100 hover:scale-105 active:scale-95"
            >
              <ShoppingCart size={18} /> Dispense Medicine
            </button>
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all tracking-widest uppercase scale-100 hover:scale-105 active:scale-95"
            >
              <Plus size={18} /> Add Stock
            </button>
          </div>
        </header>

        {isAddModalOpen && <AddStockModal onClose={() => setIsAddModalOpen(false)} onCreated={fetchData} />}
        {isDispenseModalOpen && (
          <DispenseModal 
            inventory={inventory} 
            initialPatientId={selectedPrescription?.patient_id}
            initialMeds={selectedPrescription?.medications}
            onClose={() => { setIsDispenseModalOpen(false); setSelectedPrescription(null); }} 
            onDispensed={fetchData} 
          />
        )}

        {/* Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <div className="lg:col-span-2 glass-card p-8 h-[400px]">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-black text-white tracking-tight">Stock Velocity Trend</h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                            <span className="text-[10px] font-black text-slate-500 uppercase">Stock</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                            <span className="text-[10px] font-black text-slate-500 uppercase">Demand</span>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    {chartData.length > 0 ? (
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="#475569" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                            <Area type="monotone" dataKey="stock" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" />
                            <Area type="monotone" dataKey="demand" stroke="#10b981" strokeWidth={3} fillOpacity={0} />
                        </AreaChart>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                            <TrendingUp size={48} className="opacity-20" />
                            <span className="text-xs font-black tracking-widest uppercase opacity-40">Awaiting Real-time Velocity Data</span>
                        </div>
                    )}
                </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
                <StatCard title="Total SKU" value={stats.totalItems} icon={Package} colorClass="bg-indigo-500" trend={+4} delay={0} />
                <StatCard title="Critical Stock" value={stats.lowStock} icon={AlertTriangle} colorClass="bg-amber-500" trend={-2} delay={100} />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <StatCard title="Near Expiry" value={stats.nearExpiry} icon={Clock} colorClass="bg-rose-500" delay={200} />
          <StatCard title="Daily Intake" value={stats.todaySales} icon={TrendingUp} colorClass="bg-emerald-500" trend={+12} delay={300} />
        </div>

        {/* Prescription Queue */}
        <div className="glass-card overflow-hidden animate-fade-in border-white/10 shadow-2xl mb-12" style={{ animationDelay: '350ms' }}>
          <div className="p-10 border-b border-white/5 flex justify-between items-center bg-indigo-500/[0.02]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <ClipboardList className="text-indigo-500" size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Clinical Prescription Queue</h2>
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-1">Pending orders from clinical staff</p>
              </div>
            </div>
            <div className="bg-indigo-500/10 text-indigo-500 px-4 py-2 rounded-xl text-xs font-black">
              {prescriptions.length} PENDING ORDERS
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prescriptions.length === 0 && <p className="text-slate-600 text-sm font-bold p-10 col-span-3 text-center">No pending prescriptions in the queue.</p>}
            {prescriptions.map(pres => (
              <div key={pres.id} className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-white font-black text-lg">{pres.diagnosis || 'General Order'}</p>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(pres.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="space-y-2 mb-6">
                    {pres.medications.slice(0, 2).map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                        <div className="w-1 h-1 bg-indigo-500 rounded-full" />
                        {m.name} ({m.dosage})
                      </div>
                    ))}
                    {pres.medications.length > 2 && <p className="text-[10px] text-slate-600 font-bold">+{pres.medications.length - 2} MORE</p>}
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedPrescription(pres); setIsDispenseModalOpen(true); }}
                  className="w-full bg-indigo-600/10 text-indigo-500 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-indigo-600 hover:text-white transition-all"
                >
                  Fulfill Order
                </button>
              </div>
            ))}
          </div>
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
                {inventory.length === 0 && (
                    <tr>
                        <td colSpan="5" className="px-10 py-20 text-center text-slate-600 text-xs font-black uppercase tracking-widest">
                            No active stock found in dispensary
                        </td>
                    </tr>
                )}
                {inventory.map((item) => {
                  const isLow = item.stock_quantity <= item.reorder_level;
                  const expiryDate = new Date(item.expiry_date);
                  const isExpiring = expiryDate <= new Date(new Date().setDate(new Date().getDate() + 30));
                  
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            isExpiring ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'
                          }`}>
                            <FlaskConical size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-lg leading-none">{item.item_name}</span>
                            <span className="text-slate-500 text-[10px] font-black uppercase mt-2 tracking-widest">
                                {item.generic_name || 'N/A'} • Exp: {expiryDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <span className="px-4 py-1.5 bg-indigo-500/5 border border-indigo-500/20 rounded-lg text-indigo-400 font-mono text-xs font-black tracking-widest">
                          {item.batch_number}
                        </span>
                      </td>
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-lg ${isLow ? 'text-amber-500' : 'text-white'}`}>{item.stock_quantity}</span>
                          <span className="text-slate-600 text-xs font-bold uppercase tracking-widest">Units</span>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${
                          !isLow && !isExpiring ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                          isLow ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                          'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            !isLow && !isExpiring ? 'bg-emerald-500' : 
                            isLow ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {!isLow && !isExpiring ? 'Healthy' : isLow ? 'Low Stock' : 'Near Expiry'}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <button className="text-slate-500 hover:text-white transition-colors">
                          <ChevronRight size={24} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

const AddStockModal = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    item_name: '', generic_name: '', batch_number: '', 
    expiry_date: '', stock_quantity: 0, unit_price: 0, 
    reorder_level: 10, hsn_code: '', tax_percent: 12
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/pharmacy/inventory`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onCreated();
      onClose();
    } catch (err) { alert("Failed to add stock."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden animate-modal-in">
        <div className="p-10">
          <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Stock Procurement</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
            <input type="text" placeholder="Medication Name" required className="col-span-2 p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} />
            <input type="text" placeholder="Batch Number" required className="p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none" value={formData.batch_number} onChange={e => setFormData({...formData, batch_number: e.target.value})} />
            <input type="date" placeholder="Expiry Date" required className="p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none" value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} />
            <input type="number" placeholder="Quantity" required className="p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: parseFloat(e.target.value)})} />
            <input type="number" placeholder="Unit Price (₹)" required className="p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none" value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: parseFloat(e.target.value)})} />
            <button type="submit" className="col-span-2 py-5 bg-indigo-600 rounded-2xl text-white font-black tracking-widest uppercase hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20">Add to Inventory</button>
          </form>
        </div>
      </div>
    </div>
  );
};

const DispenseModal = ({ inventory, onClose, onDispensed, initialPatientId, initialMeds }) => {
  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [selectedItem, setSelectedItem] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/pharmacy/dispense`, {
        patient_id: patientId,
        items: [{ inventory_item_id: selectedItem, transaction_type: 'SALE', quantity: qty }]
      }, { headers: { Authorization: `Bearer ${token}` } });
      onDispensed();
      onClose();
    } catch (err) { alert("Dispensing failed. Check stock levels."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0F172A] border border-white/10 rounded-[40px] shadow-2xl animate-modal-in">
        <div className="p-10">
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Dispense Medication</h2>
          {initialMeds && (
            <div className="mb-6 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Prescribed Items</p>
              {initialMeds.map((m, i) => (
                <p key={i} className="text-xs text-slate-400 font-medium">• {m.name} - {m.dosage} ({m.frequency})</p>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <input type="text" placeholder="Patient UUID" required className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none" value={patientId} onChange={e => setPatientId(e.target.value)} />
            <select className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
              <option value="">Select Medication</option>
              {inventory.map(item => <option key={item.id} value={item.id}>{item.item_name} (Batch: {item.batch_number})</option>)}
            </select>
            <input type="number" placeholder="Quantity" className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none" value={qty} onChange={e => setQty(parseInt(e.target.value))} />
            <button type="submit" className="w-full py-5 bg-emerald-600 rounded-2xl text-white font-black tracking-widest uppercase hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20">Finalize Sale</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PharmacyDashboard;
