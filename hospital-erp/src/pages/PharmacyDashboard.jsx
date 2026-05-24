import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package, AlertTriangle, TrendingUp, Clock, Search, Plus, Filter, Download,
  LayoutDashboard, ShoppingCart, Users, LogOut, ChevronRight, Zap, FlaskConical,
  ClipboardList, Camera, UploadCloud, X, CheckCircle2, FileText, ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import apiClient from '../apiClient';
import Sidebar from '../components/Sidebar';

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n) => Number(n).toLocaleString('en-IN');

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const [view, setView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Data States
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, nearExpiry: 0, todaySales: "₹0" });
  const [inventory, setInventory] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [networkOrders, setNetworkOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Modals
  const [showAiModal, setShowAiModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  
  // AI Flow State
  const webcamRef = useRef(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  
  // Dispense Flow State
  const [dispenseReq, setDispenseReq] = useState({ patient_id: '', items: [] });
  const [dispenseSearch, setDispenseSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState([]);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  const showMsg = (msg, type='success') => { setToast({msg, type}); setTimeout(() => setToast(null), 3500); };

  const fetchOverview = async () => {
    try {
      const r = await apiClient.get('/pharmacy/stats', { headers: headers() });
      setStats(r.data);
    } catch(e) { console.error(e); }
  };

  const fetchInventory = async () => {
    try {
      const r = await apiClient.get('/pharmacy/inventory', { headers: headers() });
      setInventory(r.data || []);
    } catch(e) { console.error(e); }
  };

  const fetchQueue = async () => {
    try {
      const r = await apiClient.get('/clinical/prescriptions', { headers: headers() });
      setPrescriptions((r.data || []).filter(p => p.status === 'pending'));
    } catch(e) { console.error(e); }
  };

  const fetchLedger = async () => {
    try {
      const r = await apiClient.get('/pharmacy/transactions', { headers: headers() });
      setTransactions(r.data || []);
    } catch(e) { console.error(e); }
  };

  const fetchNetworkOrders = async () => {
    try {
      const r = await apiClient.get('/pharmacy/network-orders', { headers: headers() });
      setNetworkOrders(r.data || []);
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    fetchOverview();
    fetchInventory();
    setLoading(false);
  }, []);

  useEffect(() => {
    if (view === 'inventory') fetchInventory();
    if (view === 'queue') fetchQueue();
    if (view === 'network') fetchNetworkOrders();
    if (view === 'ledger') fetchLedger();
    if (view === 'overview') fetchOverview();
  }, [view]);

  // --- AI SCANNER FLOW ---
  const handleCapture = async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    setIsAiProcessing(true);
    try {
      const res = await apiClient.post('/pharmacy/ai-scan', { image_base64: imageSrc }, { headers: headers() });
      setAiResult({ ...res.data, stock_quantity: 1 }); // pre-fill qty
    } catch (e) {
      showMsg('Failed to process image. Try again.', 'error');
    }
    setIsAiProcessing(false);
  };

  const saveAiResult = async () => {
    try {
      await apiClient.post('/pharmacy/inventory', aiResult, { headers: headers() });
      showMsg(`Successfully added ${aiResult.item_name} to inventory!`);
      setShowAiModal(false);
      setAiResult(null);
      fetchInventory();
    } catch (e) { showMsg('Failed to save', 'error'); }
  };

  // --- CSV UPLOAD FLOW ---
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const payload = results.data.map(row => ({
            item_name: row.item_name || row.Name || 'Unknown',
            generic_name: row.generic_name || row.Salt || '',
            batch_number: row.batch_number || row.Batch || `BNO-${Date.now()}`,
            expiry_date: row.expiry_date ? new Date(row.expiry_date).toISOString() : new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString(),
            stock_quantity: parseFloat(row.stock_quantity || row.Qty || 0),
            unit_price: parseFloat(row.unit_price || row.MRP || 0),
            tax_percent: 12.0
          }));
          const r = await apiClient.post('/pharmacy/bulk-upload', payload, { headers: headers() });
          showMsg(`Successfully uploaded ${r.data.items_added} items!`);
          setShowCsvModal(false);
          if (view === 'inventory') fetchInventory();
        } catch (e) { showMsg('Upload failed. Check CSV format.', 'error'); }
      }
    });
  }, [view]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

  // --- PATIENT SEARCH (For POS) ---
  useEffect(() => {
    if (patientSearch.length < 3) { setPatients([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await apiClient.get(`/patients/search?q=${encodeURIComponent(patientSearch)}`, { headers: headers() });
        setPatients(r.data || []);
      } catch (e) {}
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  const handleDispense = async () => {
    if (!dispenseReq.patient_id || dispenseReq.items.length === 0) {
      showMsg('Select patient and items first.', 'error'); return;
    }
    try {
      await apiClient.post('/pharmacy/dispense', dispenseReq, { headers: headers() });
      showMsg('Invoice generated successfully!');
      setShowDispenseModal(false);
      setDispenseReq({ patient_id: '', items: [] });
      fetchInventory();
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Dispense failed. Check stock.', 'error');
    }
  };

  const navItem = (id, icon, label) => (
    <button onClick={() => setView(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${view === id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
      {icon} {label}
    </button>
  );

  if (loading) return <div className="flex items-center justify-center h-screen bg-[#020917]"><Zap className="text-indigo-500 animate-pulse" size={40} /></div>;

  return (
    <div className="flex h-screen bg-[#020917] font-outfit text-slate-300 overflow-hidden selection:bg-indigo-500/30">
      
      {/* Toast */}
      {toast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in flex items-center gap-2 px-6 py-3 rounded-full shadow-2xl border border-white/10 backdrop-blur-xl bg-[#080f1e]/90">
          {toast.type === 'error' ? <AlertTriangle size={16} className="text-rose-500"/> : <CheckCircle2 size={16} className="text-emerald-500"/>}
          <span className={`text-sm font-bold ${toast.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{toast.msg}</span>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar />

      {/* Pharmacy Sub-Sidebar */}
      <div className="w-64 ml-80 bg-[#050b14] border-r border-white/5 flex flex-col z-10 relative hidden md:flex">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center">
              <FlaskConical size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">HOSPYN.</h1>
          </div>
          <p className="text-[10px] font-black text-indigo-400 tracking-widest uppercase ml-11">Enterprise Pharmacy</p>
        </div>
        
        <div className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto pb-4">
          {navItem('overview', <LayoutDashboard size={18}/>, 'Command Center')}
          {navItem('inventory', <Package size={18}/>, 'Medicine Master')}
          {navItem('queue', <ClipboardList size={18}/>, 'Clinical Queue')}
          {navItem('network', <Zap size={18}/>, 'Network Orders')}
          {navItem('ledger', <FileText size={18}/>, 'Transactions Ledger')}
          <div className="my-6 border-t border-white/5" />
          <button onClick={() => setShowDispenseModal(true)} className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 rounded-xl text-white font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/20">
             <ShoppingCart size={14} /> Quick Dispense
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col bg-[#020917]">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-10 relative z-10">
          
          {/* OVERVIEW VIEW */}
          {view === 'overview' && (
            <div className="animate-fade-in max-w-6xl mx-auto">
              <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Command Center</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[ 
                  { label: 'Total SKUs', val: stats.totalItems, icon: <Package size={20}/>, c: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  { label: 'Low Stock', val: stats.lowStock, icon: <AlertTriangle size={20}/>, c: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { label: 'Near Expiry', val: stats.nearExpiry, icon: <Clock size={20}/>, c: 'text-rose-400', bg: 'bg-rose-500/10' },
                  { label: 'Today Revenue', val: stats.todaySales, icon: <TrendingUp size={20}/>, c: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map((s, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-3 rounded-2xl ${s.bg} ${s.c}`}>{s.icon}</div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.label}</span>
                    </div>
                    <div className="text-4xl font-black text-white">{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 h-[400px]">
                 <h3 className="text-sm font-bold text-slate-400 mb-6">Stock Velocity (Placeholder)</h3>
                 <div className="flex flex-col items-center justify-center h-full text-slate-700 opacity-50">
                    <TrendingUp size={48} className="mb-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Awaiting Real-time Data</span>
                 </div>
              </div>
            </div>
          )}

          {/* MEDICINE MASTER VIEW */}
          {view === 'inventory' && (
            <div className="animate-fade-in max-w-7xl mx-auto">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Medicine Master</h2>
                  <p className="text-slate-500 text-sm mt-1">Core inventory management & smart procurement.</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setShowAiModal(true)} className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-indigo-500 hover:text-white transition-all shadow-lg hover:shadow-indigo-500/30">
                    <Camera size={16}/> AI Scan
                  </button>
                  <button onClick={() => setShowCsvModal(true)} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase hover:bg-emerald-500 hover:text-white transition-all shadow-lg hover:shadow-emerald-500/30">
                    <UploadCloud size={16}/> Bulk CSV
                  </button>
                </div>
              </div>

              <div className="bg-[#080f1e]/80 backdrop-blur-xl border border-white/10 rounded-[30px] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/[0.02] border-b border-white/5">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">SKU Details</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Batch & Exp</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Stock Level</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Pricing (MRP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {inventory.length === 0 && (
                      <tr><td colSpan="4" className="text-center py-10 text-sm text-slate-500">No inventory found. Use AI Scan or CSV Upload.</td></tr>
                    )}
                    {inventory.map(i => {
                      const isLow = i.stock_quantity <= i.reorder_level;
                      return (
                        <tr key={i.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-8 py-5">
                            <div className="text-sm font-bold text-white">{i.item_name}</div>
                            <div className="text-[10px] text-slate-500 uppercase mt-1">{i.generic_name}</div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-sm font-mono text-slate-300">{i.batch_number}</div>
                            <div className="text-[10px] text-slate-500 uppercase mt-1">EXP: {new Date(i.expiry_date).toLocaleDateString()}</div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`px-3 py-1 rounded-lg text-xs font-black ${isLow ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                              {i.stock_quantity} Units
                            </span>
                          </td>
                          <td className="px-8 py-5 text-sm font-bold text-white">₹{fmt(i.unit_price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* QUEUE */}
          {view === 'queue' && (
            <div className="animate-fade-in max-w-6xl mx-auto">
              <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Clinical Queue</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {prescriptions.length===0 ? <p className="text-slate-500 text-sm">No pending prescriptions.</p> :
                 prescriptions.map(p => (
                   <div key={p.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
                     <h3 className="text-lg font-bold text-white">{p.diagnosis || 'General Order'}</h3>
                     <div className="text-xs text-slate-400 mt-2 space-y-1">
                        {p.medications.map((m,i)=><p key={i}>• {m.name} ({m.dosage})</p>)}
                     </div>
                     <button onClick={() => { setShowDispenseModal(true); setDispenseReq({...dispenseReq, patient_id: p.patient_id}); }} className="mt-4 w-full py-2 bg-indigo-500/10 text-indigo-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all">Fulfill Order</button>
                   </div>
                 ))
                }
              </div>
            </div>
          )}

          {/* NETWORK ORDERS */}
          {view === 'network' && (
            <div className="animate-fade-in max-w-6xl mx-auto">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Zap size={28} className="text-emerald-400" />
                    Network Orders
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">Prescriptions shared by patients via the Universal QR Network.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {networkOrders.length===0 ? <p className="text-slate-500 text-sm">No external orders yet.</p> :
                 networkOrders.map(o => (
                   <div key={o.id} className="bg-emerald-900/10 border border-emerald-500/20 p-6 rounded-3xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 px-4 py-1 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">
                       New Shared Order
                     </div>
                     <h3 className="text-lg font-bold text-emerald-400 mb-1">{o.patient_name}</h3>
                     <p className="text-xs text-slate-500 mb-4">{o.patient_phone} • Shared {new Date(o.shared_at).toLocaleTimeString()}</p>
                     
                     <div className="text-sm font-bold text-white mb-2">{o.diagnosis || 'Prescription Details'}</div>
                     <div className="text-xs text-slate-400 mt-2 space-y-1">
                        {Object.values(o.medications || {}).map((m,i)=><p key={i}>• {m.name} ({m.dosage}) - {m.duration}</p>)}
                     </div>
                     
                     <button onClick={() => { setShowDispenseModal(true); setDispenseReq({...dispenseReq, patient_id: o.patient_id}); }} className="mt-6 w-full py-3 bg-emerald-600 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20">
                       Accept & Fulfill Order
                     </button>
                   </div>
                 ))
                }
              </div>
            </div>
          )}

          {/* LEDGER */}
          {view === 'ledger' && (
            <div className="animate-fade-in max-w-7xl mx-auto">
               <h2 className="text-3xl font-black text-white mb-8 tracking-tight">Transactions Ledger</h2>
               <div className="bg-[#080f1e]/80 backdrop-blur-xl border border-white/10 rounded-[30px] overflow-hidden shadow-2xl">
                 <table className="w-full text-left">
                   <thead className="bg-white/[0.02] border-b border-white/5">
                     <tr><th className="px-6 py-4 text-xs font-bold text-slate-500">Date</th><th className="px-6 py-4 text-xs font-bold text-slate-500">Type</th><th className="px-6 py-4 text-xs font-bold text-slate-500">Item</th><th className="px-6 py-4 text-xs font-bold text-slate-500">Qty</th></tr>
                   </thead>
                   <tbody>
                     {transactions.map(t => (
                       <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                           <td className="px-6 py-4 text-sm text-slate-300">{new Date(t.created_at).toLocaleString()}</td>
                           <td className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md">{t.transaction_type}</span></td>
                           <td className="px-6 py-4 text-sm text-white">{inventory.find(i=>i.id===t.inventory_item_id)?.item_name || 'Deleted Item'}</td>
                           <td className={`px-6 py-4 text-sm font-bold ${t.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* AI SCANNER MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowAiModal(false)} />
          <div className="relative w-full max-w-4xl bg-[#0F172A] border border-indigo-500/30 rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row">
            
            {/* Camera Side */}
            <div className="flex-1 bg-black relative flex flex-col items-center justify-center p-6 min-h-[400px]">
              {!aiResult && (
                <>
                  <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="rounded-2xl w-full h-full object-cover mb-4" />
                  <button onClick={handleCapture} disabled={isAiProcessing} className="absolute bottom-10 px-8 py-4 bg-indigo-600 rounded-full text-white font-black tracking-widest uppercase hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/50">
                    {isAiProcessing ? 'Processing...' : 'Snap & Extract'}
                  </button>
                  <div className="absolute inset-0 pointer-events-none border-[4px] border-indigo-500/30 rounded-2xl m-6">
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 border-indigo-400/50 rounded-xl" />
                  </div>
                </>
              )}
              {aiResult && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
                  <h3 className="text-2xl font-black text-white">Extraction Success!</h3>
                  <p className="text-slate-400 mt-2">AI detected {aiResult.item_name} with {(aiResult.confidence*100).toFixed(0)}% confidence.</p>
                  <button onClick={()=>setAiResult(null)} className="mt-8 text-indigo-400 font-bold hover:text-white">Scan Another</button>
                </div>
              )}
            </div>

            {/* Form Side */}
            <div className="flex-1 p-10 bg-[#0F172A] overflow-y-auto">
              <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Extracted Details</h3>
              <p className="text-sm text-slate-500 mb-8">Review the AI extracted data and confirm to add stock.</p>
              
              {aiResult ? (
                <div className="space-y-4">
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white" value={aiResult.item_name} onChange={e=>setAiResult({...aiResult, item_name: e.target.value})} placeholder="Item Name"/>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white" value={aiResult.generic_name} onChange={e=>setAiResult({...aiResult, generic_name: e.target.value})} placeholder="Generic Name"/>
                  <div className="grid grid-cols-2 gap-4">
                    <input className="bg-white/5 border border-white/10 rounded-xl p-4 text-white font-mono" value={aiResult.batch_number} onChange={e=>setAiResult({...aiResult, batch_number: e.target.value})} placeholder="Batch No"/>
                    <input type="date" className="bg-white/5 border border-white/10 rounded-xl p-4 text-white" value={aiResult.expiry_date} onChange={e=>setAiResult({...aiResult, expiry_date: e.target.value})}/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" className="bg-white/5 border border-white/10 rounded-xl p-4 text-emerald-400 font-bold" value={aiResult.unit_price} onChange={e=>setAiResult({...aiResult, unit_price: parseFloat(e.target.value)})} placeholder="MRP"/>
                    <input type="number" className="bg-white/5 border border-indigo-500/30 rounded-xl p-4 text-white font-bold" value={aiResult.stock_quantity} onChange={e=>setAiResult({...aiResult, stock_quantity: parseFloat(e.target.value)})} placeholder="Qty Received"/>
                  </div>
                  <button onClick={saveAiResult} className="w-full py-4 mt-4 bg-emerald-600 rounded-xl text-white font-black uppercase tracking-widest hover:bg-emerald-500 shadow-xl shadow-emerald-500/20">Confirm & Add Stock</button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 space-y-4 py-20">
                   <Zap size={48}/>
                   <span className="text-xs font-black uppercase tracking-widest">Waiting for Scan</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSV UPLOAD MODAL */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowCsvModal(false)} />
          <div className="relative w-full max-w-lg bg-[#0F172A] border border-white/10 rounded-[40px] shadow-2xl p-10">
             <h2 className="text-2xl font-black text-white mb-2">Bulk CSV Ingestion</h2>
             <p className="text-sm text-slate-500 mb-8">Drop your distributor's Excel or CSV file here to map thousands of records instantly.</p>
             <div {...getRootProps()} className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] hover:border-indigo-500/50'}`}>
                <input {...getInputProps()} />
                <UploadCloud size={48} className="mx-auto text-slate-500 mb-4" />
                <p className="text-white font-bold">Drag & Drop CSV File</p>
                <p className="text-xs text-slate-500 mt-2">Must contain headers: item_name, batch_number, stock_quantity, unit_price</p>
             </div>
          </div>
        </div>
      )}

      {/* DISPENSE MODAL */}
      {showDispenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowDispenseModal(false)} />
          <div className="relative w-full max-w-2xl bg-[#0F172A] border border-emerald-500/30 rounded-[40px] shadow-2xl p-10 overflow-hidden">
             <h2 className="text-3xl font-black text-white mb-6">Checkout & Dispense</h2>
             
             {/* Patient Search */}
             <div className="mb-6 relative">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Link to Patient</label>
               {dispenseReq.patient_id ? (
                 <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex justify-between items-center">
                    <span className="text-emerald-400 font-bold">Patient Linked ({dispenseReq.patient_id.substring(0,8)}...)</span>
                    <button onClick={()=>setDispenseReq({...dispenseReq, patient_id: ''})}><X size={16} className="text-slate-400"/></button>
                 </div>
               ) : (
                 <>
                   <Search className="absolute left-4 top-10 text-slate-500" size={18}/>
                   <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Search patient by name or phone..." value={patientSearch} onChange={e=>setPatientSearch(e.target.value)} />
                   {patients.length > 0 && (
                     <div className="absolute w-full mt-2 bg-[#1e293b] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                       {patients.map(pt => (
                         <button key={pt.id} onClick={()=>{ setDispenseReq({...dispenseReq, patient_id: pt.id}); setPatients([]); setPatientSearch(''); }} className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm text-white flex justify-between">
                           <span>{pt.first_name} {pt.last_name}</span><span className="text-slate-500">{pt.phone_number}</span>
                         </button>
                       ))}
                     </div>
                   )}
                 </>
               )}
             </div>

             <div className="space-y-4 mb-8">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Select Medication</label>
               <select onChange={e => {
                 if(e.target.value) setDispenseReq({...dispenseReq, items: [{ inventory_item_id: e.target.value, quantity: 1 }]});
               }} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none">
                 <option value="">Select from inventory...</option>
                 {inventory.filter(i=>i.stock_quantity>0).map(i => <option key={i.id} value={i.id}>{i.item_name} (Stock: {i.stock_quantity}) - ₹{i.unit_price}</option>)}
               </select>
               {dispenseReq.items.length > 0 && (
                 <div className="flex items-center gap-4">
                   <input type="number" min="1" className="w-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white" placeholder="Qty" value={dispenseReq.items[0].quantity} onChange={e=>setDispenseReq({...dispenseReq, items: [{...dispenseReq.items[0], quantity: parseInt(e.target.value)}]})} />
                   <span className="text-slate-400 text-sm font-bold">Qty to dispense</span>
                 </div>
               )}
             </div>

             <button onClick={handleDispense} className="w-full py-4 bg-emerald-600 rounded-xl text-white font-black uppercase tracking-widest hover:bg-emerald-500 shadow-xl shadow-emerald-500/20">Generate Bill</button>
          </div>
        </div>
      )}

    </div>
  );
}
