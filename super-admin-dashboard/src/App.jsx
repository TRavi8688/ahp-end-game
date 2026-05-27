import React, { useState, useEffect } from 'react';
import { Shield, Zap, Users, Activity, Plus, Database, Lock, Search, RefreshCcw, Globe, BarChart3, Settings, LogOut, LayoutDashboard, ClipboardCheck, Terminal, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import VerificationQueue from './pages/VerificationQueue';
import VerificationDetail from './pages/VerificationDetail';
import OperationalGovernanceDashboard from './pages/OperationalGovernanceDashboard';
import IAMManagement from './pages/IAMManagement';
import Login from './pages/Login';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const StatCard = ({ icon, title, value, trend, loading }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-700">
        {icon}
      </div>
      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{trend}</span>
    </div>
    <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</div>
    {loading ? (
      <div className="h-8 w-24 bg-slate-200 animate-pulse rounded-md"></div>
    ) : (
      <div className="text-3xl font-bold text-slate-900">{value}</div>
    )}
  </div>
);

function App() {
  const [currentView, setCurrentView] = useState('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [globalStats, setGlobalStats] = useState({ totalHospitals: 0, totalPatients: 0, activeNodes: 0, activeSessions: 0 });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      fetchData();
      const interval = setInterval(fetchData, 10000); 
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_id');
    setIsAuthenticated(false);
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [statsRes, auditRes] = await Promise.all([
        axios.get(`${API_BASE}/analytics/overview`, config),
        axios.get(`${API_BASE}/admin/audit-logs`, config)
      ]);
      
      setGlobalStats({
        totalHospitals: statsRes.data.metrics.active_hospitals || 0,
        totalPatients: statsRes.data.metrics.registered_patients || 0,
        activeNodes: 1,
        activeSessions: statsRes.data.metrics.registered_staff || 0
      });
      setAuditLogs(auditRes.data || []);
    } catch (err) {
      console.error("Governance sync failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    axios.get(`${API_BASE}/analytics/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setGlobalStats({
      totalHospitals: res.data.metrics.active_hospitals || 0,
      totalPatients: res.data.metrics.registered_patients || 0,
      activeNodes: 1, 
      activeSessions: res.data.metrics.registered_staff || 0
    })).catch(err => console.error("Stats error:", err));
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      <aside className="w-64 bg-slate-900 text-white flex flex-col z-10 shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="p-1.5 bg-indigo-500 rounded-lg">
            <Shield className="text-white" size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">Hospyn<span className="text-indigo-400">Core</span></span>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <button 
            onClick={() => setCurrentView('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentView === 'overview' ? 'bg-indigo-600 shadow-md shadow-indigo-500/20 text-white font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setCurrentView('pending')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentView === 'pending' || currentView === 'detail' ? 'bg-indigo-600 shadow-md shadow-indigo-500/20 text-white font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <ClipboardCheck size={20} /> Verification Queue
          </button>
          <button 
            onClick={() => setCurrentView('iam')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentView === 'iam' ? 'bg-indigo-600 shadow-md shadow-indigo-500/20 text-white font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Shield size={20} /> IAM Governance
          </button>
          <button 
            onClick={() => setCurrentView('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentView === 'analytics' ? 'bg-indigo-600 shadow-md shadow-indigo-500/20 text-white font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Activity size={20} /> Operational Metrics
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden relative">
        {currentView === 'overview' && (
          <div className="absolute inset-0 overflow-y-auto p-8 space-y-8">
            <header className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Platform Overview</h1>
              <p className="text-slate-500 text-lg">Centralized governance for the Hospyn healthcare ecosystem.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon={<Building2 className="text-indigo-600"/>} title="Verified Hospitals" value={globalStats.totalHospitals.toLocaleString()} trend="Active" loading={loading} />
              <StatCard icon={<Users className="text-emerald-600"/>} title="Global Patients" value={globalStats.totalPatients.toLocaleString()} trend="Active" loading={loading} />
              <StatCard icon={<Shield className="text-amber-600"/>} title="Registered Staff" value={globalStats.activeSessions.toLocaleString()} trend="Active" loading={loading} />
              <StatCard icon={<Activity className="text-rose-600"/>} title="System Load" value="Optimal" trend="Zero lag detected" loading={loading} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Activity className="text-indigo-600" size={20} /> Live Ecosystem Traffic
                  </h2>
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <p className="text-slate-500 font-medium text-sm">Traffic graph visualization pending...</p>
                  </div>
              </div>
              
              <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-6 flex flex-col relative overflow-hidden h-[400px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-6 flex items-center gap-2 relative z-10">
                    <Terminal className="text-indigo-400" size={16} /> Immutable Audit Logs
                  </h2>
                  <div className="flex-1 space-y-3 relative z-10 overflow-y-auto">
                    {auditLogs.map(log => (
                      <div key={log.id} className="text-xs font-mono bg-slate-800/50 p-3 rounded text-slate-300 border border-slate-700/50">
                        <div className="text-indigo-400 mb-1">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</div>
                        <div className="font-semibold text-white">[{log.action}]</div>
                        <div className="text-slate-400 mt-1 truncate">Actor: {log.actor_id?.substring(0,8) || 'SYSTEM'}</div>
                      </div>
                    ))}
                  </div>
              </div>
            </div>
          </div>
        )}
        {currentView === 'pending' && <VerificationQueue onSelect={id => {setSelectedHospital(id); setCurrentView('detail')}} />}
        {currentView === 'detail' && <VerificationDetail hospitalId={selectedHospital} onBack={() => setCurrentView('pending')} />}
        {currentView === 'iam' && <IAMManagement />}
        {currentView === 'analytics' && <OperationalGovernanceDashboard />}
      </main>
    </div>
  );
}

export default App;
