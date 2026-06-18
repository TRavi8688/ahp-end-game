// super-admin-dashboard/src/pages/HospitalNetwork.jsx
// FIXED:
//   1. Removed localStorage.getItem('token') — uses api from lib/apiClient
//   2. onViewHospital prop removed — uses useNavigate internally
//   3. axios replaced with api client

import React, { useState, useEffect } from 'react';
import {
  Building2, Search, MapPin, Clock, Eye,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';

const STATUS_MAP = {
  verified:          { label: 'Verified',     cls: 'badge-green',  icon: <CheckCircle2 size={11} /> },
  submitted:         { label: 'Submitted',    cls: 'badge-cyan',   icon: <Clock size={11} />        },
  under_review:      { label: 'Under Review', cls: 'badge-violet', icon: <Eye size={11} />          },
  rejected:          { label: 'Rejected',     cls: 'badge-red',    icon: <XCircle size={11} />      },
  suspended:         { label: 'Suspended',    cls: 'badge-amber',  icon: <AlertTriangle size={11} />},
  request_more_info: { label: 'Info Needed',  cls: 'badge-amber',  icon: <AlertTriangle size={11} />},
};

export default function HospitalNetwork() {
  const navigate = useNavigate();
  const [hospitals, setHospitals]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats]               = useState({ total: 0, verified: 0, pending: 0, suspended: 0 });

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const [hospData, analyticsData] = await Promise.all([
        api.get('/api/v1/admin/hospitals'),
        api.get('/api/v1/admin/analytics/overview'),
      ]);
      const all = hospData?.data || hospData || [];
      setHospitals(all);
      const m = analyticsData?.metrics || {};
      setStats({
        total:     all.length,
        verified:  m.active_hospitals || 0,
        pending:   m.pending_verifications || 0,
        suspended: all.filter(h => h.status === 'suspended').length,
      });
    } catch (e) {
      console.error('HospitalNetwork fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHospitals(); }, []);

  const filtered = hospitals.filter(h => {
    const matchSearch = !search ||
      (h.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (h.short_code || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || (h.status || '') === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusInfo = (s) => STATUS_MAP[s] || { label: s || 'Unknown', cls: 'badge-slate', icon: null };

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 size={20} className="text-indigo-400" />
              Hospital Network
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">All registered clinical nodes across the Hospyn ecosystem</p>
          </div>
          <button onClick={fetchHospitals} className="btn-ghost">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Registered', value: stats.total     },
            { label: 'Verified & Active', value: stats.verified  },
            { label: 'Pending Review',    value: stats.pending   },
            { label: 'Suspended',         value: stats.suspended },
          ].map((s, i) => (
            <div key={i} className="glass-card p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</div>
              <div className="text-xl font-bold text-white mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-white/5 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            className="input-dark pl-9 py-2 text-xs"
            placeholder="Search by name, code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'verified', 'submitted', 'under_review', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === s
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10'
              }`}
            >
              {s === 'all' ? 'All' : statusInfo(s).label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} nodes</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-indigo-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600">
            <Building2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No hospitals found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Hospyn ID</th>
                <th>Location</th>
                <th>Status</th>
                <th>Registered</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const si = statusInfo(h.status);
                return (
                  <tr key={h.id} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                          {(h.name || 'H').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{h.name || '—'}</div>
                          <div className="text-xs text-slate-600">{h.email || 'No contact'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
                        {h.short_code || h.id?.substring(0, 10) || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <MapPin size={11} className="text-slate-600" />
                        {h.city || h.address || 'Not specified'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${si.cls} flex items-center gap-1 w-fit`}>
                        {si.icon}{si.label}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-500">
                        {h.created_at ? new Date(h.created_at).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/hospitals/${h.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/20 transition-colors"
                        >
                          <Eye size={12} />
                          Deep View
                        </button>
                      </div>
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
