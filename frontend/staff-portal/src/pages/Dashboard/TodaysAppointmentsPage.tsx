import React, { useState, useEffect } from 'react';
import { Calendar, Clock, UserCheck, RefreshCw, AlertCircle, Search, ArrowRight, CheckCircle } from 'lucide-react';
import apiClient from '../../apiClient';
import { useAuth } from '../../context/AuthContext';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  status: string;
  chief_complaint?: string;
  patient_name?: string;
  patient_phone?: string;
  doctor_name?: string;
  department?: string;
}

/**
 * FIXES:
 * 1. alert() on check-in replaced with inline per-row success/error state.
 * 2. useEffect dependency was [user] — changed to [] so it doesn't re-fetch on every auth re-render.
 */
export default function TodaysAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkedInId, setCheckedInId]   = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/appointments/', {
        params: { page: 1, page_size: 100 },
      });
      const allAppts: Appointment[] = res.data.data.items || [];
      const todayStr = new Date().toDateString();
      setAppointments(allAppts.filter((a) => new Date(a.scheduled_at).toDateString() === todayStr));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch today's appointments.");
    } finally {
      setLoading(false);
    }
  };

  // FIXED: was [user] which caused refetch on every unrelated auth state change
  useEffect(() => { fetchAppointments(); }, []);

  const handleCheckIn = async (appt: Appointment) => {
    setCheckingInId(appt.id);
    setCheckInError(null);
    setCheckedInId(null);
    try {
      await apiClient.post(`/appointments/${appt.id}/checkin`);
      setAppointments((prev) =>
        prev.map((a) => (a.id === appt.id ? { ...a, status: 'confirmed' } : a))
      );
      setCheckedInId(appt.id);
      setTimeout(() => setCheckedInId(null), 3000);
    } catch (err: any) {
      setCheckInError(err.response?.data?.detail || 'Failed to check in appointment.');
      setTimeout(() => setCheckInError(null), 4000);
    } finally {
      setCheckingInId(null);
    }
  };

  const statusColorMap: Record<string, string> = {
    scheduled:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    confirmed:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    in_progress:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    completed:    'bg-slate-500/10 text-slate-400 border-slate-500/20',
    cancelled:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const statusLabelMap: Record<string, string> = {
    scheduled:   'Scheduled',
    confirmed:   'Checked In',
    in_progress: 'In Progress',
    completed:   'Completed',
    cancelled:   'Cancelled',
  };

  const filteredAppts = appointments.filter((appt) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      appt.patient_name?.toLowerCase().includes(q) ||
      appt.patient_phone?.includes(q) ||
      appt.doctor_name?.toLowerCase().includes(q)
    );
  });

  const morningList   = filteredAppts.filter((a) => new Date(a.scheduled_at).getHours() < 12);
  const afternoonList = filteredAppts.filter((a) => { const h = new Date(a.scheduled_at).getHours(); return h >= 12 && h < 17; });
  const eveningList   = filteredAppts.filter((a) => new Date(a.scheduled_at).getHours() >= 17);

  return (
    <div className="min-h-screen p-6 md:p-10 bg-[#050508] text-[#f8fafc] overflow-x-hidden">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase text-blue-500">
              Check-In Operations
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter leading-none text-white">Today's Appointments</h1>
          <p className="text-slate-500 text-sm font-medium">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={fetchAppointments} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3.5 rounded-2xl font-bold text-[11px] tracking-wider uppercase transition-all flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh List
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-12">
        {[
          { label: 'Total Appts',       value: appointments.length,                                  color: 'text-blue-500',    bg: 'from-blue-500/10' },
          { label: 'Pending Scheduled', value: appointments.filter(a => a.status === 'scheduled').length,  color: 'text-amber-500',   bg: 'from-amber-500/10' },
          { label: 'Checked In',        value: appointments.filter(a => a.status === 'confirmed').length,  color: 'text-emerald-500', bg: 'from-emerald-500/10' },
        ].map((s, i) => (
          <div key={i} className={`bg-gradient-to-br ${s.bg} to-transparent bg-white/[0.02] border border-white/5 rounded-[28px] p-6`}>
            <h2 className={`text-4xl font-black tracking-tighter ${s.color}`}>{s.value}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by patient name, phone, or doctor..."
          className="w-full bg-white/[0.03] border border-white/5 focus:border-blue-500 rounded-[20px] pl-14 pr-6 py-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all" />
      </div>

      {/* Inline errors */}
      {error && (
        <div className="p-5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-3xl text-sm flex items-center gap-3 mb-8">
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}
      {checkInError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm flex items-center gap-3 mb-6">
          <AlertCircle size={16} /><span>{checkInError}</span>
        </div>
      )}
      {checkedInId && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-sm flex items-center gap-3 mb-6">
          <CheckCircle size={16} /><span>Patient checked in successfully. They are now in the waiting queue.</span>
        </div>
      )}

      {loading ? (
        <div className="p-24 text-center">
          <RefreshCw className="animate-spin text-blue-500 mx-auto mb-4" size={36} />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Loading bookings...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white/[0.01] border border-white/5 rounded-[32px] p-16 text-center text-slate-500">
          <Calendar className="mx-auto mb-4 opacity-10 text-blue-500" size={64} />
          <p className="text-sm font-bold uppercase tracking-widest">No appointments booked for today</p>
        </div>
      ) : (
        <div className="space-y-10">
          {[
            { title: 'Morning Blocks',   list: morningList },
            { title: 'Afternoon Blocks', list: afternoonList },
            { title: 'Evening Blocks',   list: eveningList },
          ].map(({ title, list }) => {
            if (list.length === 0) return null;
            return (
              <div key={title} className="space-y-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                  {title} · {list.length}
                </h3>
                <div className="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden divide-y divide-white/5">
                  {list.map((appt) => (
                    <div key={appt.id} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.01] transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center font-bold text-xs text-blue-400">
                          <Clock size={16} className="mb-0.5" />
                          {new Date(appt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-lg font-bold text-white tracking-tight leading-none">
                              {appt.patient_name || 'Anonymous Patient'}
                            </h4>
                            <span className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase tracking-widest ${statusColorMap[appt.status] || 'border-white/10 text-white/50'}`}>
                              {statusLabelMap[appt.status] || appt.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                            <span>{appt.patient_phone || 'No Phone'}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                            <span>Dr. {appt.doctor_name || 'Staff'} ({appt.department || 'General'})</span>
                          </div>
                          {appt.chief_complaint && (
                            <p className="text-xs text-slate-500 mt-2">Reason: {appt.chief_complaint}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        {appt.status === 'scheduled' ? (
                          <button
                            onClick={() => handleCheckIn(appt)}
                            disabled={checkingInId === appt.id}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-6 py-3.5 rounded-xl font-bold text-[10px] tracking-widest uppercase transition-all flex items-center gap-2"
                          >
                            {checkingInId === appt.id ? 'Checking In...' : 'Verify & Check In'}
                            <ArrowRight size={12} />
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-black tracking-widest uppercase">
                            <UserCheck size={14} /> Checked In
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
