import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Calendar, Clock, IndianRupee, Activity,
  TrendingUp, Check, X, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, BarChart3, Building2,
} from 'lucide-react';
import apiClient from '../../apiClient';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  status: string;
  email?: string;
  phone_number?: string; // backend field — was looking for "phone"/"contact", neither exists
}

interface ShiftEntry {
  id: string;
  staff_name: string;
  role: string;
  shift_date: string; // ISO date — backend has no separate "day" field
  shift_type: string; // MORNING / EVENING / NIGHT — no start_time/end_time exist
}

interface LeaveRequest {
  id: string;
  staff_name: string;
  role: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
}

type HRTab = 'directory' | 'shifts' | 'leaves';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v);

const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDateISO = (d: Date) => d.toISOString().split('T')[0];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Shared panel class — FIXED: replaced undefined glass-panel CSS class
const panel = 'bg-white/[0.02] border border-white/5 rounded-3xl';

const OwnerDashboard: React.FC = () => {
  const [revenue, setRevenue]           = useState(0);
  const [patientsToday, setPatientsToday] = useState(0);
  const [activeStaff, setActiveStaff]   = useState(0);
  const [pendingLabs, setPendingLabs]   = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError]     = useState('');
  const [leaveToast, setLeaveToast]     = useState<string | null>(null);

  const [activeTab, setActiveTab]   = useState<HRTab>('directory');
  const [staffList, setStaffList]   = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  const [weekStart, setWeekStart]   = useState<Date>(getMonday(new Date()));
  const [shifts, setShifts]         = useState<ShiftEntry[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftsError, setShiftsError]     = useState('');

  const [leaves, setLeaves]             = useState<LeaveRequest[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesError, setLeavesError]   = useState('');
  const [actioningId, setActioningId]   = useState<string | null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      // FIXED: was 4 separate calls to endpoints that either don't exist
      // (/analytics/revenue, /analytics/patients — there is no per-hospital
      // analytics route, only a platform-wide super_admin one) or weren't
      // the right scope (/staff/list and /lab/orders just for two numbers).
      // owner.py already has a single, real, hospital-scoped endpoint
      // built for exactly this screen — it just wasn't being called.
      const { data } = await apiClient.get('/owner/dashboard');
      const telemetry = data?.data?.telemetry || {};
      setRevenue(telemetry.income_today ?? 0);
      // NOTE: there's no real "patients today" count in this payload — the
      // closest real number is the live queue size. Showing that instead
      // of fabricating a patients-today figure.
      setPatientsToday(telemetry.active_queue_count ?? 0);
      setActiveStaff((data?.data?.staff || []).length);
      setPendingLabs(telemetry.pending_lab_orders ?? 0);
    } catch {
      setStatsError('Failed to load dashboard statistics.');
    } finally { setStatsLoading(false); }
  }, []);

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true); setStaffError('');
    try {
      // FIXED: backend wraps everything as {success, message, data: {...}}.
      // staff list lives at data.data.staff, not data.staff — the old
      // fallback chain (data.staff ?? data.data ?? []) bottomed out at the
      // *object* data.data (not an array), which would have crashed the
      // .map() call below.
      const { data } = await apiClient.get('/staff/list');
      setStaffList(data?.data?.staff ?? []);
    } catch { setStaffError('Unable to load staff directory.'); }
    finally { setStaffLoading(false); }
  }, []);

  const fetchShifts = useCallback(async () => {
    setShiftsLoading(true); setShiftsError('');
    try {
      const { data } = await apiClient.get('/staff/shifts', { params: { week_start: formatDateISO(weekStart) } });
      // FIXED: same unwrap issue as fetchStaff — shifts live at data.data.shifts
      setShifts(data?.data?.shifts ?? []);
    } catch { setShiftsError('Unable to load shift roster.'); }
    finally { setShiftsLoading(false); }
  }, [weekStart]);

  const fetchLeaves = useCallback(async () => {
    setLeavesLoading(true); setLeavesError('');
    try {
      const { data } = await apiClient.get('/staff/leaves', { params: { status: 'PENDING' } });
      // FIXED: backend key is "leave_requests", not "leaves" — old code's
      // `data.leaves` was always undefined even before the unwrap issue.
      setLeaves(data?.data?.leave_requests ?? []);
    } catch { setLeavesError('Unable to load leave requests.'); }
    finally { setLeavesLoading(false); }
  }, []);

  // FIXED: removed alert() — now uses inline toast
  const handleLeaveAction = useCallback(async (id: string, action: 'approve' | 'reject') => {
    setActioningId(id);
    try {
      await apiClient.patch(`/staff/leaves/${id}/${action}`);
      setLeaves((prev) => prev.filter((l) => l.id !== id));
      setLeaveToast(`Leave ${action}d successfully.`);
      setTimeout(() => setLeaveToast(null), 3000);
    } catch (err: any) {
      setLeaveToast(`Failed to ${action}: ${err.response?.data?.detail || 'Server error'}`);
      setTimeout(() => setLeaveToast(null), 4000);
    } finally { setActioningId(null); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    if (activeTab === 'directory') fetchStaff();
    if (activeTab === 'shifts')    fetchShifts();
    if (activeTab === 'leaves')    fetchLeaves();
  }, [activeTab, fetchStaff, fetchShifts, fetchLeaves]);
  useEffect(() => { if (activeTab === 'shifts') fetchShifts(); }, [weekStart, activeTab, fetchShifts]);

  const prevWeek = () => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
  const nextWeek = () => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });

  // ── Sub-renderers ──────────────────────────────────────────────────────────

  const renderStaffDirectory = () => {
    if (staffLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
    if (staffError)   return <div className="text-center py-16"><p className="text-red-400 text-sm font-bold">{staffError}</p><button onClick={fetchStaff} className="mt-4 text-xs font-black uppercase tracking-widest text-blue-500">Retry</button></div>;
    if (staffList.length === 0) return <div className="text-center py-16"><Users size={40} className="text-slate-700 mx-auto mb-3" /><p className="text-slate-500 text-sm font-bold">No staff members found.</p></div>;

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/40 border-b border-slate-800/50">
              {['Name', 'Role', 'Department', 'Status', 'Contact'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {staffList.map((s) => (
              <tr key={s.id} className="hover:bg-white/[0.02] transition-all">
                <td className="px-5 py-4 text-sm font-bold text-white">{s.name}</td>
                <td className="px-5 py-4 text-xs text-slate-400">{s.role}</td>
                <td className="px-5 py-4 text-xs text-slate-400">{s.department}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                    ['active', 'on_duty'].includes(s.status?.toLowerCase()) ? 'bg-emerald-500/10 text-emerald-500' :
                    s.status?.toLowerCase() === 'on_leave' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-700/30 text-slate-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      ['active', 'on_duty'].includes(s.status?.toLowerCase()) ? 'bg-emerald-500' :
                      s.status?.toLowerCase() === 'on_leave' ? 'bg-amber-500' : 'bg-slate-600'
                    }`} />
                    {s.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-slate-400 font-mono">{s.phone_number || s.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderShiftRoster = () => {
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    if (shiftsLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
    if (shiftsError) return <div className="text-center py-16"><p className="text-red-400 text-sm font-bold">{shiftsError}</p><button onClick={fetchShifts} className="mt-4 text-xs font-black uppercase text-blue-500">Retry</button></div>;

    return (
      <>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/50 bg-slate-900/30">
          <button onClick={prevWeek} className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800"><ChevronLeft size={16} className="text-slate-400" /></button>
          <span className="text-xs font-black text-white uppercase tracking-widest">{formatDateISO(weekStart)} — {formatDateISO(weekEnd)}</span>
          <button onClick={nextWeek} className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800"><ChevronRight size={16} className="text-slate-400" /></button>
        </div>
        {shifts.length === 0 ? (
          <div className="text-center py-16"><Calendar size={40} className="text-slate-700 mx-auto mb-3" /><p className="text-slate-500 text-sm font-bold">No shifts scheduled for this week.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[700px]">
              {DAY_LABELS.map((day) => (
                <div key={day} className="border-r border-slate-800/50 last:border-r-0">
                  <div className="px-3 py-3 bg-slate-900/40 border-b border-slate-800/50 text-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{day}</span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[140px]">
                    {shifts.filter((s) => {
                      // FIXED: backend sends shift_date (an ISO date), not a
                      // "day" field — derive the weekday label from it instead.
                      if (!s.shift_date) return false;
                      const d = new Date(s.shift_date);
                      const label = DAY_LABELS[(d.getDay() + 6) % 7]; // getDay(): Sun=0 -> align to Mon-first DAY_LABELS
                      return label === day;
                    }).map((s) => (
                      <div key={s.id} className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                        <p className="text-[10px] font-black text-blue-400 truncate">{s.staff_name}</p>
                        {/* FIXED: backend has no start_time/end_time fields — only shift_type */}
                        <p className="text-[9px] text-slate-500">{s.role}</p>
                        <span className="inline-block text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{s.shift_type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  const renderLeaveRequests = () => {
    if (leavesLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
    if (leavesError) return <div className="text-center py-16"><p className="text-red-400 text-sm font-bold">{leavesError}</p><button onClick={fetchLeaves} className="mt-4 text-xs font-black uppercase text-blue-500">Retry</button></div>;
    if (leaves.length === 0) return <div className="text-center py-16"><Check size={40} className="text-emerald-600 mx-auto mb-3" /><p className="text-slate-500 text-sm font-bold">All leave requests processed.</p></div>;

    return (
      <div className="divide-y divide-slate-800/50">
        {leaves.map((l) => (
          <div key={l.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-all">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-bold text-white">{l.staff_name}</h4>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{l.role}</span>
              </div>
              <p className="text-xs text-slate-400"><span className="font-bold text-blue-400">{l.leave_type}</span> · {l.from_date} → {l.to_date}</p>
              {l.reason && <p className="text-[11px] text-slate-500 italic">"{l.reason}"</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button disabled={actioningId === l.id} onClick={() => handleLeaveAction(l.id, 'approve')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-600/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
                {actioningId === l.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
              </button>
              <button disabled={actioningId === l.id} onClick={() => handleLeaveAction(l.id, 'reject')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
                {actioningId === l.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const hrTabs: { key: HRTab; label: string; icon: React.ElementType }[] = [
    { key: 'directory', label: 'Staff Directory', icon: Users },
    { key: 'shifts',    label: 'Shift Roster',    icon: Calendar },
    { key: 'leaves',    label: 'Leave Requests',  icon: Clock },
  ];

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* Leave action toast */}
      {leaveToast && (
        <div className="fixed top-6 right-6 z-50 px-6 py-4 bg-blue-600 border border-blue-500 text-white rounded-2xl text-sm font-bold shadow-2xl">
          {leaveToast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <Building2 size={36} className="text-blue-500" /> Owner Command Center
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase flex items-center gap-2">
            Hospital Operations · <span className="text-blue-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </p>
        </div>
        <button onClick={fetchStats} disabled={statsLoading}
          className="px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl flex items-center gap-2.5 hover:border-blue-500/40 transition-all group">
          <RefreshCw size={14} className={`text-blue-500 ${statsLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">Refresh Data</span>
        </button>
      </div>

      {statsError && (
        <div className="bg-red-600/5 border border-red-500/20 px-5 py-3 rounded-2xl flex items-center gap-3">
          <X size={16} className="text-red-500" /><p className="text-xs font-bold text-red-400">{statsError}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: IndianRupee, label: "Today's Revenue",  value: `₹${formatCurrency(revenue)}`, trend: undefined, trendUp: true,  color: 'text-emerald-400' },
          { icon: Users,       label: 'Active Queue',   value: patientsToday,                  trend: undefined,               color: 'text-blue-400' },
          { icon: Activity,    label: 'Staff On Duty',    value: activeStaff,                    trend: undefined,               color: 'text-purple-400' },
          { icon: Clock,       label: 'Pending Lab Orders', value: pendingLabs,                  trend: undefined,               color: 'text-amber-400' },
        ].map((card, i) => (
          <div key={i} className={`${panel} p-6 space-y-4`}>
            <div className="flex justify-between items-center">
              <div className={`p-2.5 rounded-lg bg-slate-900 ${card.color}`}><card.icon size={20} /></div>
              {card.trend && (
                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${card.trendUp ? 'text-emerald-500' : 'text-red-400'}`}>
                  <TrendingUp size={12} className={card.trendUp ? '' : 'rotate-180'} />{card.trend}
                </span>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{card.label}</p>
              {statsLoading ? <Loader2 size={28} className="text-slate-600 animate-spin" /> : <h2 className={`text-3xl font-black tracking-tighter ${card.color}`}>{card.value}</h2>}
            </div>
          </div>
        ))}
      </div>

      {/* HR Panel */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-5">
          <Users size={20} className="text-blue-500" />
          <h3 className="text-lg font-black uppercase tracking-tighter text-white">HR Management</h3>
        </div>
        <div className={`${panel} overflow-hidden`}>
          <div className="flex border-b border-slate-800/50 bg-slate-900/30">
            {hrTabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === tab.key ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
                }`}>
                <tab.icon size={14} />{tab.label}
              </button>
            ))}
          </div>
          <div>
            {activeTab === 'directory' && renderStaffDirectory()}
            {activeTab === 'shifts'    && renderShiftRoster()}
            {activeTab === 'leaves'    && renderLeaveRequests()}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-blue-500" />
          <h3 className="text-lg font-black uppercase tracking-tighter text-white">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: BarChart3,   title: 'Full Revenue Report',  desc: 'View detailed financial analytics & trends', accent: 'emerald' },
            { icon: Building2,   title: 'Manage Inventory',     desc: 'Track stock levels, orders & supplies',     accent: 'blue' },
            { icon: Activity,    title: 'System Settings',      desc: 'Configure hospital modules & preferences',  accent: 'purple' },
          ].map((action, i) => (
            <button key={i} className={`${panel} p-6 flex items-center gap-5 group text-left w-full hover:border-white/10 transition-all`}>
              <div className={`p-3 rounded-xl bg-${action.accent}-500/10 border border-${action.accent}-500/20 group-hover:bg-${action.accent}-600/20 transition-all`}>
                <action.icon size={22} className={`text-${action.accent}-500`} />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-black text-white uppercase tracking-tight text-sm">{action.title}</h4>
                <p className="text-[10px] text-slate-500 font-bold tracking-wide">{action.desc}</p>
              </div>
              <ChevronRight size={18} className="text-slate-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
