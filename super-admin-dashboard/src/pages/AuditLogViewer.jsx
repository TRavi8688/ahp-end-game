// super-admin-dashboard/src/pages/AuditLogViewer.jsx
// PHASE H – New page: Audit logs with pagination, date range + action type filters
// GET /api/v1/admin/audit-logs?page={n}&user_id={optional}&from={date}&to={date}&action={type}
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList, Search, Filter, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, User, Clock, Globe, Tag,
  AlertTriangle
} from 'lucide-react';
import apiClient from '../services/apiClient';

/* ── API ── */
const fetchAuditLogs = async ({ page, userId, actionType, from, to }) => {
  const params = new URLSearchParams({ page, limit: 50 });
  if (userId)     params.append('user_id', userId);
  if (actionType && actionType !== 'all') params.append('action', actionType);
  if (from)       params.append('from', from);
  if (to)         params.append('to', to);
  const res = await apiClient.get(`/api/v1/admin/audit-logs?${params}`);
  return {
    logs:  Array.isArray(res.data) ? res.data : res.data?.logs || res.data?.data || [],
    total: res.data?.total ?? (Array.isArray(res.data) ? res.data.length : 0),
    pages: res.data?.pages ?? 1,
  };
};

/* ── Severity color by action ── */
const actionColor = (action = '') => {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('reject') || a.includes('suspend')) return 'badge-red';
  if (a.includes('create') || a.includes('approve') || a.includes('register'))  return 'badge-green';
  if (a.includes('update') || a.includes('verify') || a.includes('patch'))      return 'badge-cyan';
  if (a.includes('login')  || a.includes('logout'))                              return 'badge-violet';
  if (a.includes('export') || a.includes('download'))                            return 'badge-amber';
  return 'badge-slate';
};

const ACTION_TYPES = [
  'all', 'create', 'update', 'delete', 'login', 'logout',
  'approve', 'reject', 'verify', 'export', 'broadcast',
];

/* ── Log row ── */
function LogRow({ log }) {
  return (
    <tr>
      <td>
        <div className="font-mono text-xs text-slate-300">
          {log.timestamp || log.created_at
            ? new Date(log.timestamp || log.created_at).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })
            : '—'}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
            {(log.user_name || log.user_email || log.user_id || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="text-xs text-white font-medium">{log.user_name || log.user_email || '—'}</div>
            <div className="text-xs text-slate-600 font-mono">{(log.user_id || '').substring(0, 12)}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={`badge ${actionColor(log.action)} text-xs`}>{log.action || '—'}</span>
      </td>
      <td>
        <div className="text-xs text-slate-300">{log.resource_type || log.resource || '—'}</div>
        {log.resource_id && (
          <div className="font-mono text-xs text-slate-600 truncate max-w-[120px]">{(log.resource_id || '').substring(0, 14)}</div>
        )}
      </td>
      <td>
        <div className="font-mono text-xs text-slate-500">{log.ip_address || log.ip || '—'}</div>
      </td>
      <td>
        <div className="text-xs text-slate-500 truncate max-w-[160px]">
          {log.details || log.metadata ? JSON.stringify(log.details || log.metadata).substring(0, 60) : '—'}
        </div>
      </td>
    </tr>
  );
}

export default function AuditLogViewer() {
  const [page, setPage]             = useState(1);
  const [userId, setUserId]         = useState('');
  const [actionType, setActionType] = useState('all');
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');

  const queryKey = ['audit-logs', page, userId, actionType, from, to];

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchAuditLogs({ page, userId, actionType, from, to }),
    staleTime: 30 * 1000,
    keepPreviousData: true,
  });

  const logs   = data?.logs  || [];
  const total  = data?.total || 0;
  const pages  = data?.pages || 1;

  const handleFilterChange = () => setPage(1);

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardList size={20} className="text-violet-400" />
              Audit Log Viewer
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Complete action trail across all system users and resources</p>
          </div>
          <button onClick={() => refetch()} className="btn-ghost" disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* User filter */}
          <div className="relative">
            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              className="input-dark pl-8 py-2 text-xs w-48"
              placeholder="Filter by user ID..."
              value={userId}
              onChange={e => { setUserId(e.target.value); handleFilterChange(); }}
            />
          </div>

          {/* Action type */}
          <select
            className="input-dark py-2 text-xs w-40"
            value={actionType}
            onChange={e => { setActionType(e.target.value); handleFilterChange(); }}
          >
            {ACTION_TYPES.map(a => (
              <option key={a} value={a}>{a === 'all' ? 'All Actions' : a.charAt(0).toUpperCase() + a.slice(1)}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="date"
                className="input-dark pl-8 py-2 text-xs w-40"
                value={from}
                onChange={e => { setFrom(e.target.value); handleFilterChange(); }}
              />
            </div>
            <span className="text-slate-600 text-xs">to</span>
            <input
              type="date"
              className="input-dark py-2 text-xs w-36"
              value={to}
              onChange={e => { setTo(e.target.value); handleFilterChange(); }}
            />
          </div>

          {/* Clear */}
          {(userId || actionType !== 'all' || from || to) && (
            <button
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              onClick={() => { setUserId(''); setActionType('all'); setFrom(''); setTo(''); setPage(1); }}
            >
              Clear filters
            </button>
          )}

          <span className="text-xs text-slate-600 ml-auto">{total.toLocaleString()} total logs</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-violet-500" size={28} />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-rose-400">
            <AlertTriangle size={32} className="mb-2 opacity-40" />
            <p className="text-sm">Failed to load audit logs</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <ClipboardList size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No audit logs found for the selected filters</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th><Clock size={11} className="inline mr-1" />Timestamp</th>
                <th><User size={11} className="inline mr-1" />User</th>
                <th><Tag size={11} className="inline mr-1" />Action</th>
                <th>Resource</th>
                <th><Globe size={11} className="inline mr-1" />IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <LogRow key={log.id || `${log.timestamp}-${idx}`} log={log} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="p-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Page {page} of {pages} ({total.toLocaleString()} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost py-1.5 px-3 text-xs"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
            >
              <ChevronLeft size={14} />Prev
            </button>
            {/* Page numbers — show ±2 around current */}
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const p = Math.max(1, Math.min(pages - 4, page - 2)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    p === page
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="btn-ghost py-1.5 px-3 text-xs"
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages || isFetching}
            >
              Next<ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
