import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Search, Filter, Clock, AlertTriangle, Eye,
  ChevronRight, Loader2, RefreshCw, CheckCircle2, XCircle
} from 'lucide-react';
import { api } from '../lib/apiClient';



const STATUS_INFO = {
  submitted: { label: 'Submitted', cls: 'badge-cyan' },
  under_review: { label: 'Under Review', cls: 'badge-violet' },
  request_more_info: { label: 'Info Needed', cls: 'badge-amber' },
  approved: { label: 'Approved', cls: 'badge-green' },
  rejected: { label: 'Rejected', cls: 'badge-red' },
};

export default function VerificationQueue({ onSelect }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const handleSelect = (hospitalId) => {
    if (onSelect) {
      onSelect(hospitalId);
    } else {
      navigate(`/verifications/${hospitalId}`);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/admin/verification/queue');
      const rawQueue = res.data?.queue || [];
      const mapped = rawQueue.map(q => ({
        id: q.id,
        hospital_id: q.id,
        name: q.name,
        email: q.email,
        city: q.city,
        status: q.verification_status === 'pending_verification' ? 'submitted' : q.verification_status,
        created_at: q.submitted_at,
        assigned_verifier_id: q.verified_by,
        priority: q.fraud_signals > 2 ? 'critical' : 'normal',
      }));
      setTasks(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const filtered = tasks.filter(t => {
    const matchSearch = !search || (t.hospital_id || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-amber-400" />
              Verification Queue
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Review and approve hospital registration submissions</p>
          </div>
          <button onClick={fetchTasks} className="btn-ghost"><RefreshCw size={14} />Refresh</button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Pending', value: tasks.length, color: 'amber' },
            { label: 'Under Review', value: tasks.filter(t => t.status === 'under_review').length, color: 'violet' },
            { label: 'Info Requested', value: tasks.filter(t => t.status === 'request_more_info').length, color: 'rose' },
            { label: 'New Today', value: tasks.filter(t => t.created_at && new Date(t.created_at) > new Date(Date.now() - 86400000)).length, color: 'indigo' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-4">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">{s.label}</div>
              <div className="text-xl font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              className="input-dark pl-9 py-2 text-xs"
              placeholder="Search by hospital ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            {['all', 'submitted', 'under_review', 'request_more_info'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterStatus === s
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_INFO[s]?.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-600 ml-auto">{filtered.length} items</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-amber-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <ShieldCheck size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No verification tasks found</p>
            <p className="text-xs mt-1">All hospitals may already be verified</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Hospital Entity</th>
                <th>Submitted</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assignee</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const si = STATUS_INFO[task.status] || { label: task.status, cls: 'badge-slate' };
                const isCritical = task.priority === 'critical';
                return (
                  <tr key={task.id} className="group cursor-pointer" onClick={() => handleSelect(task.hospital_id)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                          H
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm font-mono">
                            {task.hospital_id?.substring(0, 14)}...
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                            {isCritical
                              ? <><AlertTriangle size={10} className="text-rose-400" /><span className="text-rose-400">Critical SLA</span></>
                              : <><Clock size={10} /><span>Standard SLA</span></>
                            }
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-slate-400">
                        {task.created_at ? new Date(task.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                    <td>
                      {isCritical
                        ? <span className="badge badge-red"><AlertTriangle size={10} />Critical</span>
                        : <span className="badge badge-slate">Standard</span>
                      }
                    </td>
                    <td><span className={`badge ${si.cls}`}>{si.label}</span></td>
                    <td>
                      {task.assigned_verifier_id ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-semibold text-xs">
                            {task.assigned_verifier_id.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-400 font-mono">{task.assigned_verifier_id.substring(0, 8)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={e => { e.stopPropagation(); handleSelect(task.hospital_id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors ml-auto opacity-0 group-hover:opacity-100"
                      >
                        <Eye size={12} />Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
