import React, { useState } from 'react';
import { Shield, Zap, Users, Activity, Plus, Database, Lock, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatCard = ({ icon: Icon, label, value, trend }) => (
  <div className="stat-card">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-slate-800 rounded-xl">
        <Icon className="text-amber-500" size={24} />
      </div>
      <span className="text-emerald-500 text-sm font-bold">{trend}</span>
    </div>
    <div className="text-slate-400 text-sm mb-1">{label}</div>
    <div className="text-3xl font-bold text-white">{value}</div>
  </div>
);

const SuperAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showInviteModal, setShowInviteModal] = useState(false);

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
          <button onClick={() => setActiveTab('hospitals')} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 ${activeTab === 'hospitals' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400'}`}>
            <Database size={20} /> Hospitals
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
            <p className="text-slate-400">Manage the global Hospyn clinical grid.</p>
          </div>
          <button onClick={() => setShowInviteModal(true)} className="invite-btn">
            <Plus size={20} /> Onboard New Hospital
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <StatCard icon={Users} label="Total Managed Patients" value="12,482" trend="+14%" />
          <StatCard icon={Database} label="Active Organizations" value="84" trend="+3" />
          <StatCard icon={Zap} label="System Latency" value="24ms" trend="Optimal" />
          <StatCard icon={Shield} label="Security Blocked" value="1,029" trend="Locked" />
        </div>

        {/* Forensic Stream */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="text-amber-500" size={20} /> Live Forensic Stream
          </h2>
          <div className="log-stream terminal-font">
            <div className="log-entry text-emerald-400">[11:09:42] SYSTEM: Audit Chain Integrity Verified. HMAC Checksums matching.</div>
            <div className="log-entry text-slate-400">[11:09:38] AUTH: New Hospital Invite Created (Target: city-clinic-92)</div>
            <div className="log-entry text-amber-400">[11:09:30] SECURITY: Blocked suspicious request from 182.xx.xx.xx (SQLi Probe)</div>
            <div className="log-entry text-slate-500">[11:09:25] OPS: Backup completed for Region: Mumbai-1</div>
          </div>
        </section>

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
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:border-amber-500 outline-none" placeholder="e.g., St. Mary's General" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Owner Email (Activation Link)</label>
                    <input type="email" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:border-amber-500 outline-none" placeholder="owner@hospital.com" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Hospyn ID (Global Unique)</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white focus:border-amber-500 outline-none font-mono" placeholder="HSP-MUM-001" />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button onClick={() => setShowInviteModal(false)} className="flex-1 p-3 rounded-xl border border-slate-800 text-slate-400 font-bold">Cancel</button>
                  <button className="flex-1 invite-btn justify-center">Generate Invite</button>
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
