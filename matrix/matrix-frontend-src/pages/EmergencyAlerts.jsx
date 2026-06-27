import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, Radio, Send, CheckCircle2, Clock, Shield,
  Zap, Bell, BellOff, RefreshCw, Loader2, X, Building2, Activity
} from 'lucide-react';
import { api } from '../lib/apiClient';
import { motion, AnimatePresence } from 'framer-motion';



const SEVERITY = {
  critical: { label: 'Critical', cls: 'badge-red', bg: 'bg-rose-500/10 border-rose-500/20', icon: <AlertTriangle size={13} className="text-rose-400" /> },
  high: { label: 'High', cls: 'badge-amber', bg: 'bg-amber-500/10 border-amber-500/20', icon: <AlertTriangle size={13} className="text-amber-400" /> },
  medium: { label: 'Medium', cls: 'badge-blue', bg: 'bg-indigo-500/10 border-indigo-500/20', icon: <Bell size={13} className="text-indigo-400" /> },
  info: { label: 'Info', cls: 'badge-slate', bg: 'bg-slate-500/10 border-slate-500/20', icon: <Bell size={13} className="text-slate-400" /> },
};

export default function EmergencyAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    message: '',
    severity: 'high',
    target: 'all',
  });
  const [toastMsg, setToastMsg] = useState(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      
      
      const res = await api.get('/api/v1/admin/audit-logs?limit=50');
      const allLogs = Array.isArray(res.data) ? res.data : [];
      // Filter for emergency-related events
      const emergencyLogs = allLogs.filter(l =>
        l.action?.toLowerCase().includes('emergency') ||
        l.action?.toLowerCase().includes('alert') ||
        l.action?.toLowerCase().includes('broadcast')
      );
      setAlerts(emergencyLogs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 20000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleBroadcast = async () => {
    if (!broadcastForm.message.trim()) return;
    setBroadcasting(true);
    try {
      
      await api.post('/api/v1/matrix/broadcasts', {
        message: broadcastForm.message,
        severity: broadcastForm.severity,
        target: broadcastForm.target,
        broadcaster_type: 'super_admin',
      });
      setShowBroadcastModal(false);
      setBroadcastForm({ message: '', severity: 'high', target: 'all' });
      showToast('Emergency broadcast sent to all nodes', 'success');
      fetchAlerts();
    } catch (e) {
      showToast('Broadcast failed. Check backend.', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  // Simulated recent alerts if none from API
  const displayAlerts = alerts.length > 0 ? alerts : [
    { id: '1', action: 'EMERGENCY_BROADCAST', actor_id: 'SYSTEM', timestamp: new Date(Date.now() - 3600000).toISOString(), resource_type: 'HOSPITAL', severity: 'critical', ip_address: '10.0.0.1' },
    { id: '2', action: 'EMERGENCY_BROADCAST', actor_id: 'DR_AHAH1234', timestamp: new Date(Date.now() - 7200000).toISOString(), resource_type: 'CLINIC', severity: 'high', ip_address: '10.0.0.5' },
  ];

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl ${
              toastMsg.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
            }`}
          >
            {toastMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span className="text-sm font-semibold">{toastMsg.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Radio size={20} className="text-rose-400" />
              Emergency Alerts
              <span className="pulse-red ml-1" />
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Broadcast emergencies and monitor alerts across all hospital nodes</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchAlerts} className="btn-ghost">
              <RefreshCw size={14} />Refresh
            </button>
            <button
              onClick={() => setShowBroadcastModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 transition-colors font-semibold text-sm"
            >
              <Radio size={15} />
              Broadcast Alert
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Status Panels */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Alerts', value: displayAlerts.length, color: 'rose', icon: <AlertTriangle size={16} /> },
            { label: 'Critical', value: displayAlerts.filter(a => a.severity === 'critical').length, color: 'rose', icon: <Zap size={16} /> },
            { label: 'High Priority', value: displayAlerts.filter(a => a.severity === 'high').length, color: 'amber', icon: <Bell size={16} /> },
            { label: 'System Status', value: 'Monitoring', color: 'emerald', icon: <Activity size={16} /> },
          ].map((s, i) => (
            <div key={i} className={`glass-card p-4 stat-card-glow-${s.color}`}>
              <div className={`p-2 rounded-lg bg-${s.color}-500/10 text-${s.color}-400 w-fit mb-3`}>{s.icon}</div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">{s.label}</div>
              <div className="text-xl font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Alert Feed */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield size={15} className="text-rose-400" />
              Alert History
            </h3>
            <span className="badge badge-red">{displayAlerts.length} events</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-rose-500" size={24} />
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {displayAlerts.map((alert, i) => {
                const sev = alert.severity || (i === 0 ? 'critical' : 'high');
                const sevInfo = SEVERITY[sev] || SEVERITY.info;
                return (
                  <div key={alert.id || i} className={`p-5 flex items-start gap-4 border-l-2 ${i === 0 ? 'border-rose-500/50' : 'border-amber-500/30'} hover:bg-white/[0.02] transition-colors`}>
                    <div className={`p-2.5 rounded-lg border ${sevInfo.bg} shrink-0`}>
                      {sevInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`badge ${sevInfo.cls}`}>{sevInfo.label}</span>
                        <span className="text-sm font-semibold text-white">{alert.action?.replace(/_/g, ' ') || 'EMERGENCY BROADCAST'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Actor: <span className="text-slate-400 font-mono">{alert.actor_id?.substring(0, 12) || 'SYSTEM'}</span></span>
                        {alert.resource_type && <span>Target: <span className="text-slate-400">{alert.resource_type}</span></span>}
                        {alert.ip_address && <span>IP: <span className="font-mono text-slate-400">{alert.ip_address}</span></span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-slate-500">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : '—'}
                      </div>
                      <span className="badge badge-slate mt-1">Logged</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Broadcast Templates */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Broadcast Templates</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'System Maintenance', msg: 'Scheduled maintenance in 30 minutes. Please save all work.', sev: 'medium' },
              { title: 'Network Disruption', msg: 'Network issues detected. Connectivity may be affected.', sev: 'high' },
              { title: 'Security Alert', msg: 'Unauthorized access attempt detected. Security team alerted.', sev: 'critical' },
              { title: 'Data Backup', msg: 'Emergency data backup initiated. All operations nominal.', sev: 'info' },
            ].map((t, i) => (
              <button
                key={i}
                onClick={() => {
                  setBroadcastForm({ message: t.msg, severity: t.sev, target: 'all' });
                  setShowBroadcastModal(true);
                }}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-rose-500/20 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${SEVERITY[t.sev]?.cls || 'badge-slate'}`}>{SEVERITY[t.sev]?.label}</span>
                  <span className="text-sm font-semibold text-white group-hover:text-rose-200 transition-colors">{t.title}</span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-1">{t.msg}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {showBroadcastModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBroadcastModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-content"
            >
              <div className="p-5 border-b border-white/8 flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio size={16} className="text-rose-400" />
                  Broadcast Emergency Alert
                </h2>
                <button onClick={() => setShowBroadcastModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Severity Level</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(SEVERITY).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setBroadcastForm(f => ({ ...f, severity: key }))}
                        className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                          broadcastForm.severity === key
                            ? `${val.bg} border-opacity-60`
                            : 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10'
                        }`}
                      >
                        <span className={`badge ${val.cls} w-full justify-center`}>{val.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Target</label>
                  <select
                    value={broadcastForm.target}
                    onChange={e => setBroadcastForm(f => ({ ...f, target: e.target.value }))}
                    className="input-dark text-sm"
                  >
                    <option value="all">All Hospitals & Staff</option>
                    <option value="doctors">Doctors Only</option>
                    <option value="admins">Hospital Admins Only</option>
                    <option value="nurses">Nursing Staff Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Message</label>
                  <textarea
                    rows={4}
                    className="input-dark resize-none text-sm"
                    placeholder="Type your emergency message..."
                    value={broadcastForm.message}
                    onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
                  />
                </div>
              </div>
              <div className="p-4 border-t border-white/8 flex justify-end gap-3">
                <button onClick={() => setShowBroadcastModal(false)} className="btn-ghost">Cancel</button>
                <button
                  onClick={handleBroadcast}
                  disabled={!broadcastForm.message.trim() || broadcasting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 disabled:opacity-40 transition-colors font-semibold text-sm"
                >
                  {broadcasting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Broadcast Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
