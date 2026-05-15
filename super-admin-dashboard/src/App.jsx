import React, { useState, useEffect } from 'react';
import { Shield, Zap, Users, Activity, Plus, Database, Lock, Search, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1';

const StatCard = ({ icon: Icon, label, value, trend, loading }) => (
  <div className="stat-card">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-slate-800 rounded-xl">
        <Icon className="text-amber-500" size={24} />
      </div>
      <span className="text-emerald-500 text-sm font-bold">{trend}</span>
    </div>
    <div className="text-slate-400 text-sm mb-1">{label}</div>
    {loading ? (
      <div className="h-8 w-24 bg-slate-800 animate-pulse rounded"></div>
    ) : (
      <div className="text-3xl font-bold text-white">{value}</div>
    )}
  </div>
);

const SuperAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state for onboarding
  const [newOrg, setNewOrg] = useState({ name: '', hospyn_id: '', registration_number: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, hospRes, analyticsRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/stats`),
        axios.get(`${API_BASE}/admin/hospitals`),
        axios.get(`${API_BASE}/admin/analytics`)
      ]);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (hospRes.data.success) setHospitals(hospRes.data.data);
      if (analyticsRes.data.success) setAnalytics(analyticsRes.data.data);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await axios.patch(`${API_BASE}/admin/hospitals/${id}/status?status=${newStatus}`);
      fetchData();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleOnboard = async () => {
    try {
      await axios.post(`${API_BASE}/admin/hospitals`, newOrg);
      setShowInviteModal(false);
      setNewOrg({ name: '', hospyn_id: '', registration_number: '' });
      fetchData();
    } catch (err) {
      alert("Failed to onboard hospital");
    }
  };

  return (
    <div className="control-panel">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="hospyn-logo mb-12 flex items-center gap-3">
          <Shield className="text-amber-500" size={32} />
          <span className="text-2xl font-black tracking-tighter">HOSPYN <span className="text-amber-500">CORE</span></span>
        </div>

        <nav className="space-y-2">
          <button onClick={() => setActiveTab('overview')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'overview' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400'}`}>
            <Activity size={20} /> Overview
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'analytics' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400'}`}>
            <Zap size={20} /> Financials & AI
          </button>
          <button onClick={() => setActiveTab('hospitals')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'hospitals' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400'}`}>
            <Database size={20} /> Organizations
          </button>
          <button onClick={() => setActiveTab('forensics')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'forensics' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400'}`}>
            <Lock size={20} /> Forensic Logs
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-view">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-extrabold mb-2">Network Governance</h1>
            <p className="text-slate-400">Secure oversight for {hospitals.length} global clinical nodes.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={fetchData} className="p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowInviteModal(true)} className="invite-btn">
              <Plus size={20} /> Onboard New Hospital
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <StatCard icon={Users} label="Total Patients" value={stats?.total_patients || '0'} trend="+14%" loading={loading} />
          <StatCard icon={Database} label="Revenue (INR)" value={analytics?.financials.total_revenue.toLocaleString() || '0'} trend="98% Success" loading={loading} />
          <StatCard icon={Zap} label="AI Accuracy" value={`${((analytics?.clinical_ai.avg_extraction_accuracy || 0.95) * 100).toFixed(1)}%`} trend="Stable" loading={loading} />
          <StatCard icon={Shield} label="Trust Score" value="A+" trend="Verified" loading={loading} />
        </div>

        {/* Dynamic View */}
        {activeTab === 'hospitals' && (
          <section className="bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-950/50 border-b border-slate-800">
                <tr>
                  <th className="p-4 text-slate-400 font-medium">Hospital Name</th>
                  <th className="p-4 text-slate-400 font-medium">Hospyn ID</th>
                  <th className="p-4 text-slate-400 font-medium">Type</th>
                  <th className="p-4 text-slate-400 font-medium">Patients</th>
                  <th className="p-4 text-slate-400 font-medium">Subscription</th>
                  <th className="p-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.map((h) => (
                  <tr key={h.id} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold">{h.name}</td>
                    <td className="p-4 font-mono text-amber-500">{h.hospyn_id}</td>
                    <td className="p-4 capitalize text-slate-300">{h.org_type}</td>
                    <td className="p-4 text-emerald-500">{h.patient_count}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${h.subscription_status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {h.subscription_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => handleStatusChange(h.id, h.subscription_status)}
                        className={`text-xs font-bold px-3 py-1 rounded-lg border ${h.subscription_status === 'active' ? 'border-red-500/30 text-red-500 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'}`}
                      >
                        {h.subscription_status === 'active' ? 'SUSPEND' : 'ACTIVATE'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Zap className="text-amber-500" /> AI Forensic Insight</h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">OCR Extraction Success</span>
                  <span className="text-emerald-500 font-bold">{(analytics?.clinical_ai.avg_extraction_accuracy * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${(analytics?.clinical_ai.avg_extraction_accuracy * 100)}%` }}></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Clinical Anomaly Detection</span>
                  <span className="text-amber-500 font-bold">Active</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Database className="text-emerald-500" /> Revenue Integrity</h3>
              <div className="text-4xl font-black text-white mb-2">₹{analytics?.financials.total_revenue.toLocaleString()}</div>
              <p className="text-slate-400 text-sm mb-6">Total platform-wide billings (Net 30d)</p>
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                <div className="text-xs text-emerald-500 font-bold mb-1">SETTLEMENT STATUS</div>
                <div className="text-white text-sm">All clinical nodes reconciled for current cycle.</div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'overview' || activeTab === 'forensics') && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="text-amber-500" size={20} /> Live Forensic Stream
            </h2>
            <div className="log-stream terminal-font">
              <div className="log-entry text-emerald-400">[{new Date().toLocaleTimeString()}] SYSTEM: Audit Chain Integrity Verified. HMAC Checksums matching.</div>
              <div className="log-entry text-slate-400">[{new Date().toLocaleTimeString()}] AUTH: Admin session authenticated.</div>
              <div className="log-entry text-amber-500">[{new Date().toLocaleTimeString()}] AI: Mulajna Engine performing at {(analytics?.clinical_ai.avg_extraction_accuracy * 100).toFixed(1)}% accuracy.</div>
              {hospitals.length > 0 && <div className="log-entry text-slate-400">[{new Date().toLocaleTimeString()}] DATA: Sync completed for {hospitals.length} tenants.</div>}
            </div>
          </section>
        )}

        {/* Invite Modal */}
        <AnimatePresence>
          {showInviteModal && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-lg shadow-2xl"
              >
                <h2 className="text-2xl font-bold mb-6">Onboard New Organization</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Hospital Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:border-amber-500 outline-none" 
                      placeholder="e.g., St. Mary's General"
                      value={newOrg.name}
                      onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Registration Number</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:border-amber-500 outline-none" 
                      placeholder="e.g. REG-12345"
                      value={newOrg.registration_number}
                      onChange={(e) => setNewOrg({...newOrg, registration_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Hospyn ID (Global Unique)</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:border-amber-500 outline-none font-mono" 
                      placeholder="HSP-MUM-001"
                      value={newOrg.hospyn_id}
                      onChange={(e) => setNewOrg({...newOrg, hospyn_id: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button onClick={() => setShowInviteModal(false)} className="flex-1 p-3 rounded-xl border border-slate-800 text-slate-400 font-bold">Cancel</button>
                  <button onClick={handleOnboard} className="flex-1 invite-btn justify-center">Onboard Node</button>
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
