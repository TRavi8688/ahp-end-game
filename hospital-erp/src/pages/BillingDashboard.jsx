import React, { useState } from 'react';
import { 
  CreditCard, ShieldCheck, FileText, 
  Search, ExternalLink, CheckCircle2, 
  Clock, XCircle, DollarSign, ArrowUpRight, ArrowDownRight, Plus, Filter, TrendingUp,
  LayoutDashboard, ShoppingCart, Users, Settings, LogOut, ChevronRight, Zap,
  BarChart3, Receipt, Activity, FlaskConical, Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import axios from 'axios';
import { API_BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';

const BillingDashboard = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pendingVisits, setPendingVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [stats, setStats] = useState({
    totalCollections: "₹0",
    pendingClaims: 0,
    unpaidInvoices: 0,
    settlementRate: "0%"
  });

  // REAL-TIME DATA SYNC
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [invResp, payResp, pendResp] = await Promise.all([
        axios.get(`${API_BASE_URL}/billing/invoices`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/billing/payments`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/billing/pending-visits`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setInvoices(invResp.data);
      setPayments(payResp.data);
      setPendingVisits(pendResp.data);
      
      const paid = invResp.data.filter(inv => inv.status === 'PAID');
      const total = paid.reduce((acc, inv) => acc + inv.paid_amount, 0);
      
      setStats({
        totalCollections: `₹${(total / 1000).toFixed(1)}K`,
        pendingClaims: payResp.data.filter(p => p.status === 'PENDING').length,
        unpaidInvoices: invResp.data.filter(inv => inv.status === 'PENDING').length,
        settlementRate: invResp.data.length ? `${Math.round((paid.length / invResp.data.length) * 100)}%` : "0%"
      });
    } catch (err) {
      console.error("Billing Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      <Sidebar />

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
          <button 
            onClick={() => { setSelectedVisit(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 px-8 py-4 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all tracking-widest uppercase scale-100 hover:scale-105 active:scale-95 mb-2"
          >
            <Plus size={18} /> Generate Invoice
          </button>
        </header>

        {isModalOpen && (
          <CreateInvoiceModal 
            defaultPatientId={selectedVisit?.patient_id} 
            defaultVisitId={selectedVisit?.visit_id}
            onClose={() => setIsModalOpen(false)} 
            onCreated={() => fetchData()} 
          />
        )}

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
                    <td className="px-10 py-7 font-mono text-sm text-indigo-400 font-black tracking-widest">{inv.invoice_number}</td>
                    <td className="px-10 py-7">
                        <span className="text-white font-bold text-lg leading-none">Patient ID: {inv.patient_id.slice(0,8)}...</span>
                        <span className="block text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">{inv.created_at.split('T')[0]}</span>
                    </td>
                    <td className="px-10 py-7">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-black text-xl">₹{inv.payable_amount.toLocaleString()}</span>
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
                      <button 
                        onClick={() => window.open(`${API_BASE_URL}/billing/invoices/${inv.id}/pdf?token=${localStorage.getItem('token')}`, '_blank')}
                        className="text-slate-500 hover:text-indigo-400 transition-colors p-2 hover:bg-white/5 rounded-xl"
                      >
                        <FileText size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pending Billing Queue */}
          <div className="lg:col-span-2 glass-card overflow-hidden animate-fade-in border-white/10 shadow-2xl mt-8" style={{ animationDelay: '450ms' }}>
             <div className="p-10 border-b border-white/5 flex justify-between items-center bg-rose-500/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <TrendingUp className="text-rose-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Pending Billing Queue</h2>
                    <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-1">Action required to recover revenue</p>
                  </div>
                </div>
                <div className="bg-rose-500/10 text-rose-500 px-4 py-2 rounded-xl text-xs font-black">
                  {pendingVisits.length} PATIENTS WAITING
                </div>
             </div>
             <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingVisits.length === 0 && <p className="text-slate-600 text-sm font-bold p-10 col-span-2 text-center">Revenue fully reconciled. No pending visits.</p>}
                {pendingVisits.map(visit => (
                  <div key={visit.visit_id} className="p-6 rounded-3xl bg-white/[0.01] border border-white/5 flex justify-between items-center hover:border-rose-500/30 transition-all">
                     <div>
                        <p className="text-white font-black text-lg">{visit.visit_reason}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{visit.department} • {new Date(visit.created_at).toLocaleTimeString()}</p>
                     </div>
                     <button 
                        onClick={() => { setSelectedVisit(visit); setIsModalOpen(true); }}
                        className="bg-rose-600/10 text-rose-500 px-6 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-rose-600 hover:text-white transition-all"
                     >
                        Bill Now
                     </button>
                  </div>
                ))}
             </div>
          </div>

          {/* Live Payment Activity Feed */}
          <div className="glass-card p-10 animate-fade-in border-white/10 shadow-2xl flex flex-col" style={{ animationDelay: '500ms' }}>
            <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Clock className="text-indigo-500" size={20} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">Activity Feed</h2>
            </div>
            
            <div className="space-y-6 flex-1 overflow-y-auto max-h-[600px] pr-2">
              {payments.length === 0 && <p className="text-slate-600 text-xs font-bold text-center mt-10">No recent activity</p>}
              {payments.map(pay => (
                <div key={pay.id} className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all group">
                   <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${
                           pay.status === 'PAID' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                           pay.status === 'FAILED' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 
                           'bg-amber-500 animate-pulse'
                         }`} />
                         <span className="text-[10px] font-black text-white uppercase tracking-widest">{pay.status}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-700">{pay.payment_method}</span>
                   </div>
                   <div className="flex justify-between items-end">
                      <div>
                        <p className="text-white font-black text-lg">₹{pay.amount.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-600 font-bold mt-1 uppercase tracking-tighter">ID: {pay.id.slice(0,8)}</p>
                      </div>
                      <span className="text-[10px] text-slate-500">{new Date(pay.payment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   </div>
                </div>
              ))}
            </div>

            <button 
              onClick={fetchData}
              className="w-full mt-10 py-5 border border-white/10 text-white text-[10px] font-black tracking-[0.3em] uppercase rounded-2xl hover:bg-white/5 hover:border-indigo-500/30 transition-all"
            >
              Sync Activity Feed
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


const CreateInvoiceModal = ({ onClose, onCreated, defaultPatientId = '', defaultVisitId = null }) => {
  const [patientId, setPatientId] = useState(defaultPatientId);
  const [visitId, setVisitId] = useState(defaultVisitId);
  const [items, setItems] = useState([{ item_name: '', item_category: 'Consultation', quantity: 1, unit_price: 0, tax_percent: 5 }]);
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (defaultPatientId) setPatientId(defaultPatientId);
    if (defaultVisitId) setVisitId(defaultVisitId);
  }, [defaultPatientId, defaultVisitId]);

  const addItem = () => setItems([...items, { item_name: '', item_category: 'Consultation', quantity: 1, unit_price: 0, tax_percent: 5 }]);
  
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/billing/invoices`, {
        patient_id: patientId,
        visit_id: visitId,
        items,
        discount_amount: parseFloat(discount)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onCreated();
      onClose();
    } catch (err) {
      alert("Failed to generate invoice. Please check patient ID and items.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const tax = items.reduce((acc, item) => acc + (item.quantity * item.unit_price * (item.tax_percent / 100)), 0);
    return subtotal + tax - parseFloat(discount || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(79,70,229,0.2)] border-white/10">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-indigo-600/10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">Generate Clinical Invoice</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Revenue Cycle Entry</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-slate-400 transition-colors"><XCircle size={24} /></button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 space-y-8">
          {/* Patient Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Patient Identity (UUID)</label>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="Enter Patient UUID..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold focus:border-indigo-500/50 outline-none transition-all"
              />
            </div>
          </div>

          {/* Bill Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Billable Items</label>
              <button onClick={addItem} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors">
                <Plus size={14} /> Add Line Item
              </button>
            </div>
            
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl animate-in slide-in-from-right-4 duration-300">
                  <div className="col-span-5">
                    <input 
                      placeholder="Item Name (e.g. CBC Test)"
                      value={item.item_name}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].item_name = e.target.value;
                        setItems(newItems);
                      }}
                      className="w-full bg-transparent text-white font-bold outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].quantity = parseFloat(e.target.value);
                        setItems(newItems);
                      }}
                      className="w-full bg-transparent text-white font-bold outline-none border-l border-white/5 pl-3"
                    />
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].unit_price = parseFloat(e.target.value);
                        setItems(newItems);
                      }}
                      className="w-full bg-transparent text-white font-bold outline-none border-l border-white/5 pl-3"
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-white font-black text-sm">₹{(item.quantity * item.unit_price).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="pt-8 border-t border-white/5 grid grid-cols-2 gap-8">
            <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Discount (₹)</label>
                <input 
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white font-bold focus:border-rose-500/50 outline-none transition-all"
                    placeholder="0.00"
                />
            </div>
            <div className="bg-indigo-600/10 p-8 rounded-3xl border border-indigo-500/20 flex flex-col justify-center items-end">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Net Payable Amount</span>
                <span className="text-4xl font-black text-white tracking-tighter">₹{calculateTotal().toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="p-8 bg-white/[0.01] border-t border-white/5 flex gap-4">
          <button onClick={onClose} className="flex-1 py-5 rounded-2xl border border-white/10 text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-white/5 transition-all">Cancel</button>
          <button 
            disabled={isSubmitting || !patientId}
            onClick={handleSubmit}
            className="flex-[2] py-5 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40 hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : 'Authorize & Generate Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;
