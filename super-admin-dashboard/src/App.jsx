import React, { useState, useEffect } from 'react';
import { Shield, Zap, Users, Activity, Plus, Database, Lock, Search, RefreshCcw, Globe, BarChart3, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const StatCard = ({ icon: Icon, label, value, trend, loading, color }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="stat-card"
  >
    <div className="flex justify-between items-start mb-6">
      <div className={`p-4 rounded-2xl`} style={{ backgroundColor: `${color}10`, color: color }}>
        <Icon size={24} />
      </div>
      <div className="flex flex-col items-end">
        <span className="text-emerald-500 text-xs font-black tracking-widest">{trend}</span>
        <div className="h-1 w-12 bg-emerald-500/20 mt-1 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '70%' }}
            className="h-full bg-emerald-500"
          />
        </div>
      </div>
    </div>
    <div className="text-slate-400 text-xs font-bold tracking-widest mb-1 uppercase">{label}</div>
    {loading ? (
      <div className="h-10 w-32 bg-slate-800/50 animate-pulse rounded-lg"></div>
    ) : (
      <div className="text-4xl font-black text-white tracking-tighter outfit">{value}</div>
    )}
  </motion.div>
);

const SuperAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  const [newOrg, setNewOrg] = useState({ name: '', hospyn_id: '', registration_number: '' });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Polling for real-time forensics
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [statsRes, hospRes, auditRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/stats`, config),
        axios.get(`${API_BASE}/admin/hospitals`, config),
        axios.get(`${API_BASE}/admin/audit-logs`, config)
      ]);
      
      setStats(statsRes.data);
      // Backend returns { data: [...hospitals], pending: [...requests] }
      setHospitals(hospRes.data.data || []);
      setPendingRequests(hospRes.data.pending || []); 
      setAuditLogs(auditRes.data || []);
    } catch (err) {
      console.error("Governance sync failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (hospitalId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/onboarding/verify/${hospitalId}?approve=true`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedRequest(null);
      fetchData();
      alert("Node access granted. Hospital owner notified for payment.");
    } catch (err) {
      alert("Verification Failed");
    }
  };

  const handleOnboard = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/admin/hospitals`, newOrg, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowInviteModal(false);
      setNewOrg({ name: '', hospyn_id: '', registration_number: '' });
      fetchData();
    } catch (err) {
      alert("Onboarding Failed: Chain Rejection");
    }
  };

  return (
    <div className="control-panel">
      {/* Sidebar - Sovereign Navigation */}
      <aside className="sidebar">
        <div className="mb-12 flex items-center gap-4">
          <div className="p-2 bg-amber-500 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <Shield className="text-black" size={28} />
          </div>
          <span className="text-2xl font-black tracking-tighter outfit">HOSPYN <span className="text-amber-500">CORE</span></span>
        </div>

        <nav className="space-y-2 flex-1">
          {[
            { id: 'overview', icon: Globe, label: 'Global Overview' },
            { id: 'hospitals', icon: Database, label: 'Organization Nodes' },
            { id: 'analytics', icon: BarChart3, label: 'Network Intelligence' },
            { id: 'pending', icon: Activity, label: 'Pending Requests' },
            { id: 'forensics', icon: Lock, label: 'Forensic Ledger' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)} 
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span className="text-sm tracking-wide">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="pt-8 border-t border-white/5">
          <button className="w-full text-left p-4 rounded-2xl flex items-center gap-4 text-slate-500 hover:text-red-400 transition-colors">
            <Settings size={20} />
            <span className="font-bold text-sm tracking-wide">System Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Command View */}
      <main className="main-view">
        <header className="flex justify-between items-end mb-16">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase">Network Status: Operational</span>
            </div>
            <h1 className="text-5xl font-black tracking-tight mb-2 outfit">Network Governance</h1>
            <p className="text-slate-400 font-medium">Securing {hospitals.length} clinical nodes across the global infrastructure.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={fetchData} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-amber-500 hover:border-amber-500/50 transition-all">
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowInviteModal(true)} className="invite-btn">
              <Plus size={20} strokeWidth={3} />
              <span>ONBOARD NEW NODE</span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Stats Overview */}
            {activeTab === 'overview' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
                  <StatCard icon={Users} label="Global Patients" value={stats?.total_patients || '0'} trend="+14.2%" color="#f59e0b" loading={loading} />
                  <StatCard icon={Database} label="System Capacity" value={`${stats?.total_hospitals || 0} Nodes`} trend="Optimal" color="#10b981" loading={loading} />
                  <StatCard icon={Zap} label="AI Throughput" value="98.4%" trend="+2.1%" color="#6366f1" loading={loading} />
                  <StatCard icon={Shield} label="Trust Index" value="AAA+" trend="Verified" color="#ec4899" loading={loading} />
                </div>

                {/* Global Node Map */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                  <div className="lg:col-span-2 glass-card p-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-amber-500/10 transition-all duration-700" />
                    <div className="flex justify-between items-center mb-10">
                      <div>
                        <h2 className="text-2xl font-black outfit tracking-tight">Global Node Distribution</h2>
                        <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase mt-1">Live Infrastructure Map</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-black text-emerald-500">82 ONLINE</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="aspect-[21/9] bg-white/[0.02] border border-white/5 rounded-[40px] flex items-center justify-center relative overflow-hidden">
                      {/* Abstract Map Dots */}
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                      <div className="relative">
                        <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
                        <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-amber-500 rounded-full" />
                        <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                        <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-emerald-500 rounded-full" />
                        <div className="absolute bottom-1/4 right-1/4 w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
                        <div className="absolute bottom-1/4 right-1/4 w-3 h-3 bg-indigo-500 rounded-full" />
                      </div>
                      <p className="text-[10px] font-black text-slate-700 tracking-[0.5em] uppercase">Sovereign Data Fabric Active</p>
                    </div>
                  </div>

                  <div className="glass-card p-10 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-black outfit mb-1">Network Health</h3>
                      <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase">Real-time Latency Audit</p>
                    </div>
                    <div className="space-y-6">
                      {[
                        { label: 'API Gateway', val: '12ms', status: 'optimal' },
                        { label: 'Database Sync', val: '45ms', status: 'optimal' },
                        { label: 'AI Inference', val: '1.2s', status: 'warning' }
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-400">{item.label}</span>
                          <span className={`text-xs font-black tracking-widest ${item.status === 'optimal' ? 'text-emerald-500' : 'text-amber-500'}`}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                    <button className="w-full py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-white/10 transition-all">Deep Diagnostics</button>
                  </div>
                </div>

                <section className="glass-card">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black outfit tracking-tight flex items-center gap-3">
                      <Lock className="text-amber-500" /> Live Forensic Stream
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Real-time Ledger Sync</span>
                  </div>
                  <div className="log-stream h-[450px] overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="mb-4 border-b border-white/5 pb-4 group">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-500 font-bold terminal-font text-xs">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className="text-white font-black text-xs tracking-wider uppercase group-hover:text-amber-500 transition-colors">{log.action}</span>
                          </div>
                          <span className="text-[10px] text-slate-600 font-mono bg-white/5 px-2 py-1 rounded">SEAL: {log.signature.substring(0, 24)}...</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-slate-500 text-[10px] font-bold">RESOURCE: <span className="text-slate-400">{log.resource_type}</span></div>
                          <div className="text-slate-600 text-[10px] font-mono italic text-right">PREV: {log.prev_hash.substring(0, 24)}...</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeTab === 'hospitals' && (
              <section className="glass-card overflow-hidden !p-0">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/5">
                    <tr>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Organization Node</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Hospyn ID</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Node Type</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Status</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase text-right">Governance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {hospitals.map((h) => (
                      <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-6">
                          <div className="font-bold text-white mb-1">{h.name}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{h.registration_number}</div>
                        </td>
                        <td className="p-6 font-mono text-amber-500 text-sm font-bold">{h.hospyn_id}</td>
                        <td className="p-6 text-sm font-bold text-slate-400 capitalize">{h.org_type}</td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full ${h.subscription_status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className={`text-[10px] font-black tracking-widest ${h.subscription_status === 'active' ? 'text-emerald-500' : 'text-red-500'}`}>
                              {h.subscription_status.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          <button className="text-[10px] font-black px-4 py-2 rounded-xl border border-white/10 hover:border-amber-500/50 hover:text-amber-500 transition-all tracking-widest uppercase">
                            View Node Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {activeTab === 'pending' && (
              <section className="glass-card overflow-hidden !p-0">
                <div className="p-6 border-b border-white/5">
                  <h2 className="text-xl font-bold outfit">Hospital Registration Queue</h2>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/5">
                    <tr>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Hospital Details</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Staff Strength</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Status</th>
                      <th className="p-6 text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pendingRequests.map((req) => (
                      <tr 
                        key={req.id} 
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                        onClick={() => setSelectedRequest(req)}
                      >
                        <td className="p-6">
                          <div className="font-bold text-white mb-1">{req.name}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{req.registration_number}</div>
                        </td>
                        <td className="p-6 font-bold text-amber-500 outfit text-lg">{req.staff_count}</td>
                        <td className="p-6">
                          <span className="text-[10px] font-black px-2 py-1 bg-amber-500/10 text-amber-500 rounded border border-amber-500/20 uppercase tracking-widest">
                            {req.verification_status}
                          </span>
                        </td>
                        <td className="p-6 text-right">
                          <button className="p-3 bg-white/5 rounded-xl group-hover:bg-amber-500 group-hover:text-black transition-all">
                            <Search size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Forensic Detail Sidebar */}
        <AnimatePresence>
          {selectedRequest && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedRequest(null)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 w-[550px] h-full bg-[#0a0a0a] border-l border-white/10 shadow-2xl p-12 z-[70] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-12">
                  <div>
                    <h2 className="text-3xl font-black outfit tracking-tighter">Forensic Detail</h2>
                    <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase mt-1">Node ID: {selectedRequest.id.substring(0,8)}</p>
                  </div>
                  <button onClick={() => setSelectedRequest(null)} className="p-4 hover:bg-white/5 rounded-2xl transition-colors">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="p-8 bg-white/[0.03] border border-white/5 rounded-[40px]">
                    <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase block mb-6">Organizational Identity</label>
                    <h3 className="text-2xl font-black mb-2">{selectedRequest.name}</h3>
                    <div className="flex items-center gap-3 text-slate-400 font-mono text-sm">
                      <Database size={14} />
                      {selectedRequest.registration_number}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 bg-white/[0.03] border border-white/5 rounded-[40px]">
                      <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase block mb-3">Clinical Strength</label>
                      <div className="text-3xl font-black text-amber-500 outfit">{selectedRequest.staff_count} <span className="text-sm font-medium text-slate-600 ml-1">STAFF</span></div>
                    </div>
                    <div className="p-8 bg-white/[0.03] border border-white/5 rounded-[40px]">
                      <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase block mb-3">Network Tier</label>
                      <div className="text-sm font-black text-amber-500 uppercase tracking-widest">
                        {selectedRequest.staff_count > 5 ? 'ENTERPRISE NODE' : 'CLINIC NODE'}
                      </div>
                    </div>
                  </div>

                  <div className="p-8 bg-white/[0.03] border border-white/5 rounded-[40px]">
                    <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase block mb-6">Credential Evidence</label>
                    <div className="aspect-video bg-black/60 border border-white/5 rounded-3xl flex flex-col items-center justify-center relative group overflow-hidden cursor-pointer border-dashed border-2">
                      {selectedRequest.certificate_url ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4">
                           <Database className="text-amber-500 mb-2" size={32} />
                           <p className="text-[10px] font-black text-amber-500 tracking-[0.2em] uppercase">Document_Secure_Hash.pdf</p>
                           <div className="absolute inset-0 bg-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => window.open(`${API_BASE.replace('/api/v1', '')}/${selectedRequest.certificate_url}`, '_blank')}
                                className="bg-white text-black px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-2xl"
                              >
                                View Live Document
                              </button>
                           </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-4 bg-white/5 rounded-full mb-4">
                            <Database className="text-slate-500" size={32} />
                          </div>
                          <p className="text-[10px] font-black text-slate-600 tracking-[0.2em] uppercase">No Document Uploaded</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-10 flex gap-4">
                    <button 
                      onClick={() => handleApprove(selectedRequest.id)}
                      className="flex-1 bg-emerald-600 p-5 rounded-3xl font-black text-[10px] tracking-widest uppercase shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Approve Node Access
                    </button>
                    <button className="flex-1 bg-rose-600/10 text-rose-500 p-5 rounded-3xl font-black text-[10px] tracking-widest uppercase border border-rose-500/10 hover:bg-rose-600 hover:text-white transition-all">Reject Chain</button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
                    {pendingRequests.length === 0 && (
                      <tr>
                        <td colSpan="4" className="p-12 text-center text-slate-500 font-bold">No pending registration requests.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Invite Modal */}
        <AnimatePresence>
          {showInviteModal && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 40 }}
                className="bg-slate-900 border border-white/10 p-10 rounded-[2.5rem] w-full max-w-xl shadow-[0_0_100px_rgba(0,0,0,0.8)]"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-amber-500 rounded-2xl">
                    <Database className="text-black" size={24} />
                  </div>
                  <h2 className="text-3xl font-black outfit tracking-tight">Onboard Global Node</h2>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase mb-2">Hospital Legal Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white focus:border-amber-500 outline-none transition-all font-bold" 
                      placeholder="e.g., Singapore Central Hospital"
                      value={newOrg.name}
                      onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase mb-2">Reg Number</label>
                      <input 
                        type="text" 
                        className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white focus:border-amber-500 outline-none transition-all font-bold" 
                        placeholder="SGP-1092-X"
                        value={newOrg.registration_number}
                        onChange={(e) => setNewOrg({...newOrg, registration_number: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase mb-2">Sovereign Hospyn ID</label>
                      <input 
                        type="text" 
                        className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white focus:border-amber-500 outline-none transition-all font-mono font-bold text-amber-500" 
                        placeholder="HSP-SGP-001"
                        value={newOrg.hospyn_id}
                        onChange={(e) => setNewOrg({...newOrg, hospyn_id: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-12">
                  <button onClick={() => setShowInviteModal(false)} className="flex-1 p-4 rounded-2xl border border-white/10 text-slate-400 font-black tracking-widest text-xs hover:bg-white/5 transition-all">ABORT</button>
                  <button onClick={handleOnboard} className="flex-1 invite-btn justify-center text-xs tracking-widest">INITIALIZE NODE</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
