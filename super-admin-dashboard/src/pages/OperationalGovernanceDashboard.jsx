import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, Cloud, ShieldCheck, Zap, ArrowRight, AlertTriangle, CheckCircle2, DollarSign, Users, Building2, FileCheck, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const OperationalGovernanceDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMetrics(response.data.metrics);
      setAuditLogs(response.data.recent_audit_events);
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto">
      {/* Top Navigation Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 shadow-md z-10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="text-emerald-400" size={24} />
              Operational Governance
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Live telemetry of multi-tenant healthcare operations and platform compliance.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                {metrics?.system_health || 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
            <p className="text-slate-500 font-medium">Aggregating Global Operational Telemetry...</p>
          </div>
        ) : (
          <>
            {/* Top Row: Core Platform Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Hospitals</div>
                  <div className="text-2xl font-bold text-slate-900">{metrics?.active_hospitals || 0}</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                  <FileCheck size={24} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pending Verifications</div>
                  <div className="text-2xl font-bold text-slate-900">{metrics?.pending_verifications || 0}</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Users size={24} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Registered Staff</div>
                  <div className="text-2xl font-bold text-slate-900">{metrics?.registered_staff || 0}</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                  <Activity size={24} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Global Patients</div>
                  <div className="text-2xl font-bold text-slate-900">{metrics?.registered_patients || 0}</div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Audit Log Stream */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={18} className="text-indigo-600" />
                  Live Immutable Audit Stream
                </h2>
                <span className="text-xs font-mono bg-indigo-100 text-indigo-700 px-2 py-1 rounded">POSTGRESQL WAL</span>
              </div>
              <div className="flex-1 overflow-y-auto bg-slate-900 p-4 font-mono text-sm">
                {auditLogs.length === 0 ? (
                  <div className="text-slate-500 text-center py-12">No recent audit events detected in the ledger.</div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log, i) => (
                      <div key={log.id || i} className="flex gap-4 text-slate-300 border-b border-slate-800 pb-2 mb-2 hover:bg-slate-800/50 p-1 rounded transition-colors">
                        <span className="text-emerald-400 shrink-0">
                          {log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString()}
                        </span>
                        <span className="text-indigo-400 font-bold shrink-0 w-32">[{log.action}]</span>
                        <span className="text-slate-400">
                          ACTOR: {log.actor_id?.substring(0,8) || 'SYSTEM'} | 
                          RES: {log.resource_type} | 
                          IP: {log.ip_address || '127.0.0.1'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OperationalGovernanceDashboard;
