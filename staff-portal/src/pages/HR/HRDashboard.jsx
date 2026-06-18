/**
 * hr-portal/src/App.jsx
 *
 * PHASE 3 FIX — HR Portal with real backend API calls.
 * Previously: static hardcoded data only (5% complete)
 * Now: Staff Directory, Shift Roster, and Leave Requests all wired to live API.
 *
 * Requires hr-portal/.env with VITE_API_BASE_URL set.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, ShieldCheck, Calendar,
  Activity, LogOut, Search, Bell, MoreVertical,
  CheckCircle2, Clock, XCircle, Loader2,
  AlertCircle, RefreshCw, ChevronDown,
  Check, X
} from 'lucide-react';

// ── API client ────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

const getToken = () => localStorage.getItem('hr_access_token');

const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem('hr_access_token');
    window.location.href = '/login';
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `Error ${res.status}`);
  }
  return res.json();
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ activeTab, setActiveTab, onLogout }) => (
  <aside className="sidebar">
    <div className="sidebar-logo outfit">
      <div className="p-2 bg-primary rounded-xl">
        <Activity className="text-white" size={24} />
      </div>
      <span>HOSPYN <span className="text-primary">HR</span></span>
    </div>

    <nav className="flex-1">
      {[
        { id: 'directory', icon: Users, label: 'Staff Directory' },
        { id: 'roster', icon: Calendar, label: 'Shift Roster' },
        { id: 'leaves', icon: Clock, label: 'Leave Requests' },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`nav-item w-full text-left ${activeTab === item.id ? 'active' : ''}`}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>

    <div className="pt-8 border-t border-white/5">
      <button
        onClick={onLogout}
        className="nav-item w-full text-left text-slate-500 hover:text-red-400"
      >
        <LogOut size={20} />
        <span>Exit Portal</span>
      </button>
    </div>
  </aside>
);

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    ACTIVE: 'status-active',
    Active: 'status-active',
    ON_LEAVE: 'status-on-leave',
    'On Leave': 'status-on-leave',
    INACTIVE: 'status-inactive',
    PENDING: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    APPROVED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  };
  return (
    <span className={`status-badge text-[10px] font-bold uppercase px-2 py-0.5 rounded ${map[status] || 'bg-slate-800 text-slate-400'}`}>
      {status}
    </span>
  );
};

// ── Loading State ─────────────────────────────────────────────────────────────
const LoadingSpinner = ({ text = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <Loader2 size={32} className="text-primary animate-spin" />
    <p className="text-slate-400 text-sm font-medium">{text}</p>
  </div>
);

// ── Error State ───────────────────────────────────────────────────────────────
const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <AlertCircle size={32} className="text-rose-500" />
    <p className="text-rose-400 text-sm font-medium">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn-primary flex items-center gap-2 text-sm">
        <RefreshCw size={16} /> Retry
      </button>
    )}
  </div>
);

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
    <Users size={32} />
    <p className="text-sm font-medium">{message}</p>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// STAFF DIRECTORY TAB
// ══════════════════════════════════════════════════════════════════════════════
const StaffDirectory = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, on_leave: 0 });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const data = await apiFetch(`/staff/list?${params.toString()}`);
      if (!data) return;

      const list = data.data?.staff || data.staff || [];
      setStaff(list);
      setStats({
        total: data.data?.total_count || list.length,
        active: list.filter(s => s.status === 'ACTIVE' || s.status === 'Active').length,
        on_leave: list.filter(s => s.status === 'ON_LEAVE' || s.status === 'On Leave').length,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchStaff, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchStaff]);

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="stat-grid">
        <div className="glass-card stat-card">
          <div className="flex justify-between mb-4">
            <Users className="text-primary" />
            <span className="text-emerald-500 text-xs font-bold">Total</span>
          </div>
          <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Workforce</div>
          <div className="text-4xl font-black outfit">{stats.total}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="flex justify-between mb-4">
            <CheckCircle2 className="text-emerald-500" />
            <span className="text-emerald-500 text-xs font-bold">On duty</span>
          </div>
          <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Active</div>
          <div className="text-4xl font-black outfit text-emerald-400">{stats.active}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="flex justify-between mb-4">
            <Clock className="text-amber-500" />
            <span className="text-amber-500 text-xs font-bold">Away</span>
          </div>
          <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">On Leave</div>
          <div className="text-4xl font-black outfit text-amber-400">{stats.on_leave}</div>
        </div>
      </div>

      {/* Table */}
      <section className="glass-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h2 className="text-2xl font-black outfit tracking-tight">Staff Directory</h2>
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-xl border border-white/5">
              <Search size={16} className="text-slate-500" />
              <input
                type="text"
                placeholder="Search name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-white w-48"
              />
            </div>
            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-black/20 border border-white/5 text-slate-300 text-sm rounded-xl px-3 py-2 outline-none"
            >
              <option value="">All Roles</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="receptionist">Receptionist</option>
              <option value="lab">Lab</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-black/20 border border-white/5 text-slate-300 text-sm rounded-xl px-3 py-2 outline-none"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <button onClick={fetchStaff} className="p-2 bg-black/20 border border-white/5 rounded-xl text-slate-400 hover:text-white transition">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && <LoadingSpinner text="Loading staff directory..." />}
        {error && <ErrorState message={error} onRetry={fetchStaff} />}
        {!loading && !error && staff.length === 0 && <EmptyState message="No staff members found" />}

        {!loading && !error && staff.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-container w-full">
              <thead>
                <tr>
                  <th>Clinical Member</th>
                  <th>Department</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td>
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-primary shrink-0">
                          {(s.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white">{s.full_name}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {s.job_title || s.role}
                            {s.specialty ? ` · ${s.specialty}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm font-medium text-slate-400">{s.department || '—'}</td>
                    <td className="text-sm text-slate-400">
                      <div>{s.email}</div>
                      {s.phone_number && <div className="text-xs text-slate-500">{s.phone_number}</div>}
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="text-sm text-slate-500 font-medium">{s.joined_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SHIFT ROSTER TAB
// ══════════════════════════════════════════════════════════════════════════════
const ShiftRoster = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split('T')[0];
  });

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/staff/shifts?week_start=${weekStart}`);
      if (!data) return;
      setShifts(data.data?.shifts || data.shifts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  // Build 7-day grid
  const weekDays = [];
  const startDate = new Date(weekStart + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    weekDays.push(d);
  }

  const shiftsByDate = shifts.reduce((acc, s) => {
    const key = s.shift_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const shiftColors = {
    MORNING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    AFTERNOON: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    NIGHT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    ON_CALL: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-8">
      <div className="glass-card">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black outfit tracking-tight">Clinical Roster</h2>
          <div className="flex items-center gap-3">
            <button onClick={prevWeek} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition">← Prev</button>
            <span className="text-sm font-bold text-slate-300">{weekStart}</span>
            <button onClick={nextWeek} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition">Next →</button>
            <button onClick={fetchShifts} className="p-2 bg-black/20 border border-white/5 rounded-xl text-slate-400 hover:text-white transition">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && <LoadingSpinner text="Loading shift roster..." />}
        {error && <ErrorState message={error} onRetry={fetchShifts} />}

        {!loading && !error && (
          <div className="grid grid-cols-7 gap-3">
            {weekDays.map(day => {
              const dateKey = day.toISOString().split('T')[0];
              const dayShifts = shiftsByDate[dateKey] || [];
              const isToday = dateKey === new Date().toISOString().split('T')[0];
              return (
                <div key={dateKey}
                  className={`rounded-2xl p-3 border min-h-[140px] ${isToday ? 'border-primary/50 bg-primary/5' : 'border-white/5 bg-white/[0.02]'}`}
                >
                  <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isToday ? 'text-primary' : 'text-slate-500'}`}>
                    {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </div>
                  <div className={`text-xl font-black mb-3 ${isToday ? 'text-white' : 'text-slate-400'}`}>
                    {day.getDate()}
                  </div>
                  {dayShifts.length === 0 && (
                    <div className="text-[10px] text-slate-600 text-center mt-4">No shifts</div>
                  )}
                  {dayShifts.map((shift, i) => (
                    <div key={i}
                      className={`text-[9px] font-bold border rounded-lg px-2 py-1 mb-1 truncate ${shiftColors[shift.shift_type] || 'bg-slate-800 text-slate-400 border-slate-700'}`}
                      title={`${shift.staff_name} — ${shift.shift_type}`}
                    >
                      {shift.staff_name?.split(' ').slice(-1)[0] || 'Staff'}
                      <span className="block text-[8px] opacity-70">{shift.shift_type}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// LEAVE REQUESTS TAB
// ══════════════════════════════════════════════════════════════════════════════
const LeaveRequests = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const data = await apiFetch(`/staff/leaves${params}`);
      if (!data) return;
      setLeaves(data.data?.leave_requests || data.leave_requests || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const handleAction = async (leaveId, action) => {
    setActionLoading(leaveId + action);
    try {
      await apiFetch(`/staff/leaves/${leaveId}/${action}`, {
        method: 'PATCH',
        body: JSON.stringify({ remarks: action === 'approve' ? 'Approved by HR' : 'Rejected by HR' }),
      });
      await fetchLeaves();
    } catch (e) {
      alert(`Failed to ${action} leave: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = leaves.filter(l => l.status === 'PENDING').length;

  return (
    <div className="space-y-8">
      <section className="glass-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black outfit tracking-tight">Leave Requests</h2>
            {pendingCount > 0 && statusFilter === 'PENDING' && (
              <p className="text-amber-400 text-sm font-bold mt-1">{pendingCount} request{pendingCount > 1 ? 's' : ''} awaiting review</p>
            )}
          </div>
          <div className="flex gap-3">
            {['PENDING', 'APPROVED', 'REJECTED', ''].map(s => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition ${statusFilter === s
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-white/5 text-slate-500 hover:text-white'}`}
              >
                {s || 'All'}
              </button>
            ))}
            <button onClick={fetchLeaves} className="p-2 bg-black/20 border border-white/5 rounded-xl text-slate-400 hover:text-white transition">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && <LoadingSpinner text="Loading leave requests..." />}
        {error && <ErrorState message={error} onRetry={fetchLeaves} />}
        {!loading && !error && leaves.length === 0 && <EmptyState message={`No ${statusFilter.toLowerCase() || ''} leave requests`} />}

        {!loading && !error && leaves.length > 0 && (
          <div className="space-y-4">
            {leaves.map(leave => (
              <div key={leave.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-primary shrink-0">
                    {(leave.staff_name || 'S').charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white">{leave.staff_name}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">
                      {leave.role} {leave.department ? `· ${leave.department}` : ''}
                    </div>
                    <div className="text-sm text-slate-300">
                      <span className="font-bold text-slate-200">{leave.leave_type}</span> leave ·{' '}
                      {leave.from_date} → {leave.to_date}
                    </div>
                    {leave.reason && (
                      <p className="text-xs text-slate-400 mt-1 max-w-md">{leave.reason}</p>
                    )}
                    {leave.remarks && leave.status !== 'PENDING' && (
                      <p className="text-xs text-slate-500 mt-1 italic">Remarks: {leave.remarks}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={leave.status} />
                  {leave.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleAction(leave.id, 'approve')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl transition"
                      >
                        {actionLoading === leave.id + 'approve' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(leave.id, 'reject')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition"
                      >
                        {actionLoading === leave.id + 'reject' ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
function App() {
  const [activeTab, setActiveTab] = useState('directory');

  const handleLogout = () => {
    localStorage.removeItem('hr_access_token');
    window.location.href = '/login';
  };

  const tabTitles = {
    directory: 'Staff Directory',
    roster: 'Shift Roster',
    leaves: 'Leave Requests',
  };

  return (
    <div className="hr-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      <main className="main-content">
        <header className="flex justify-between items-end mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 bg-emerald-500 rounded-full" />
              <span className="text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase">
                Enterprise Mode: Active
              </span>
            </div>
            <h1 className="text-5xl font-black tracking-tight mb-2 outfit">{tabTitles[activeTab]}</h1>
            <p className="text-slate-400 font-medium">Hospital HR Management Portal</p>
          </div>

          <div className="flex gap-4">
            <button className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
              <Bell size={20} />
            </button>
          </div>
        </header>

        {activeTab === 'directory' && <StaffDirectory />}
        {activeTab === 'roster' && <ShiftRoster />}
        {activeTab === 'leaves' && <LeaveRequests />}
      </main>
    </div>
  );
}

export default App;
