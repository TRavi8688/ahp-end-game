import React from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  Settings, 
  Globe, 
  Database, 
  Cpu, 
  Lock, 
  Activity, 
  ChevronRight,
  Server,
  Key,
  ShieldAlert
} from 'lucide-react';

import { useStore } from '../../store/useStore';

const AdminDashboard: React.FC = () => {
  const { systemStatus } = useStore();
  
  const stats = [
    { label: 'API Latency', value: systemStatus.latency, icon: Activity, color: 'text-blue-400', load: parseInt(systemStatus.latency) || 0 },
    { label: 'Database Load', value: systemStatus.dbLoad, icon: Database, color: 'text-green-400', load: parseInt(systemStatus.dbLoad) || 0 },
    { label: 'Cluster CPU', value: systemStatus.cpu, icon: Cpu, color: 'text-purple-400', load: parseInt(systemStatus.cpu) || 0 },
    { label: 'WAF Protection', value: 'ACTIVE', icon: ShieldCheck, color: 'text-blue-500', load: 100 },
  ];

  const securityLogs = [
    { id: 'EV-1001', event: 'JWT_RS256_VERIFY', identity: 'Dr. Sharma', status: 'SECURED', latency: '2ms' },
    { id: 'EV-1002', event: 'AES_GCM_ENCRYPT', identity: 'System::Kernel', status: 'SUCCESS', latency: '1ms' },
    { id: 'EV-1003', event: 'TENANT_LOAD_BALANCER', identity: 'Nginx::Edge', status: 'OPTIMAL', latency: '4ms' },
  ];

  return (
    <div className="min-h-screen p-6 space-y-8 animate-in slide-in-from-left-8 duration-1000">
      
      {/* Infrastructure Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <span className="text-blue-500"><Server size={36} /></span>
            Infrastructure Console
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase flex items-center gap-2">
            Environment: <span className="text-blue-400">Production-Hardened</span> • Cluster: <span className="text-slate-300">GCP-Asia-South1</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 glass-panel border-green-500/20 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 pulse-emergency" />
            <span className="text-xs font-black text-green-500 uppercase tracking-widest">Uptime: 99.99%</span>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="glass-panel p-6 space-y-4 group hover:border-blue-500/30 transition-all">
            <div className="flex justify-between items-center">
              <div className={`p-2 rounded-lg bg-slate-900 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Real-time</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <h2 className={`text-3xl font-black tracking-tighter ${stat.color}`}>{stat.value}</h2>
            </div>
            <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-1000 ${stat.color.replace('text-', 'bg-')}`} style={{ width: `${stat.load}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: Security Logs */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
              <Terminal size={20} className="text-blue-500" />
              Security Engine Audit Feed
            </h3>
            <button className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 hover:text-white transition-all">Export Logs</button>
          </div>

          <div className="glass-panel overflow-hidden border-slate-800/50">
            <div className="bg-slate-900/40 p-4 border-b border-slate-800/50 grid grid-cols-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span>Event ID / Action</span>
              <span>Identity Service</span>
              <span>Security Status</span>
              <span className="text-right">Latency</span>
            </div>
            <div className="divide-y divide-slate-800/50">
              {securityLogs.map((log) => (
                <div key={log.id} className="p-4 grid grid-cols-4 items-center group hover:bg-white/[0.02] transition-all font-mono text-xs">
                  <div className="flex flex-col">
                    <span className="text-blue-500 font-bold">{log.event}</span>
                    <span className="text-[10px] text-slate-600">{log.id}</span>
                  </div>
                  <span className="text-slate-400">{log.identity}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-green-500 font-bold">{log.status}</span>
                  </div>
                  <span className="text-right text-slate-500 font-bold">{log.latency}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tenant Configuration Grid */}
          <div className="mt-12 space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
              <Globe size={20} className="text-blue-500" />
              Active Hospital Tenants
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { name: 'City General Hospital', slug: 'city-gen', status: 'Operational', users: 124 },
                { name: 'Metropolis Care', slug: 'metrop-care', status: 'Operational', users: 89 },
              ].map((tenant, i) => (
                <div key={i} className="glass-card-premium p-6 flex justify-between items-center group">
                  <div className="space-y-1">
                    <h4 className="font-black text-white uppercase tracking-tight">{tenant.name}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Slug: {tenant.slug} • {tenant.users} Users</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">{tenant.status}</span>
                    <button className="p-2 rounded-lg bg-slate-900 group-hover:bg-blue-600 transition-all">
                      <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Governance & Security */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Key Management */}
          <div className="glass-panel p-6 space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
              <Key size={20} className="text-blue-500" />
              Cryptographic Control
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400">RS256 Private Key</span>
                  <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-widest">Rotated</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 w-[100%]" />
                </div>
                <p className="text-[10px] font-mono text-slate-600 break-all leading-tight">
                  SHA256: f46383b...24bbd99_SECURE_ROTATION_ENABLED
                </p>
              </div>

              <button className="w-full py-3 btn-cyber rounded-xl text-[10px]">
                Initiate Key Rotation
              </button>
            </div>
          </div>

          {/* Security Lockdown Panel */}
          <div className="glass-panel p-6 border-t-4 border-t-red-600 bg-red-600/5 space-y-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-red-500 pulse-emergency" size={24} />
              <h3 className="font-black uppercase tracking-tighter text-lg text-red-500">Security Lockdown</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-600/10 rounded-2xl border border-red-500/20">
                <span className="text-xs font-black text-red-500 uppercase tracking-widest">Global API Block</span>
                <div className="w-10 h-5 bg-slate-800 rounded-full relative cursor-pointer group">
                  <div className="absolute left-1 top-1 w-3 h-3 bg-slate-600 rounded-full group-hover:bg-red-500 transition-all" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed italic text-center">
                Activating lockdown will instantly revoke all JWT tokens and block incoming traffic at the WAF layer.
              </p>
            </div>
          </div>

          {/* System Performance AI */}
          <div className="glass-panel p-6 bg-blue-600/5 border-blue-600/10">
            <div className="flex items-center gap-2 mb-4">
              <Settings size={16} className="text-blue-500" />
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SRE Automation Insight</h4>
            </div>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">
              Auto-scaling event detected. Cluster expanded by <span className="text-blue-500 font-black">2 nodes</span> to handle increased peak-hour traffic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
