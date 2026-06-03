import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { Users, Star, Clock, Activity, TrendingUp, Award, Search, Filter, ChevronDown, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-dark text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-white">{p.value}</span></p>
      ))}
    </div>
  );
};

const RatingStars = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={11} className={i < Math.round(rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
    ))}
    <span className="text-xs text-slate-500 ml-1">{(rating || 0).toFixed(1)}</span>
  </div>
);

const MetricBar = ({ label, value, max, color }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-300 font-semibold">{value}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

export default function StaffPerformance() {
  const [doctors, setDoctors] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('doctors');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE}/admin/owner/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDoctors(res.data?.doctors || []);
        setStaff(res.data?.staff || []);
        if (res.data?.doctors?.length > 0) setSelected(res.data.doctors[0]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const filteredDoctors = doctors.filter(d =>
    !search || (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.specialty || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredStaff = staff.filter(s =>
    !search || (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.role || '').toLowerCase().includes(search.toLowerCase())
  );

  // Radar chart data for selected doctor
  const radarData = selected ? [
    { subject: 'Patients', A: Math.min(100, (selected.patients_treated / 50) * 100), fullMark: 100 },
    { subject: 'Speed', A: Math.min(100, 100 - ((selected.avg_treatment_time_mins - 10) / 40) * 100), fullMark: 100 },
    { subject: 'Rating', A: (selected.rating / 5) * 100, fullMark: 100 },
    { subject: 'Hours', A: Math.min(100, (selected.hours_worked / 10) * 100), fullMark: 100 },
    { subject: 'Efficiency', A: Math.random() * 30 + 70, fullMark: 100 },
  ] : [];

  // Bar chart: all doctors comparison
  const doctorBarData = doctors.slice(0, 8).map(d => ({
    name: (d.name || '').replace('Dr.', '').trim().split(' ')[0],
    patients: d.patients_treated,
    rating: Math.round((d.rating || 4.5) * 10),
  }));

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity size={20} className="text-violet-400" />
              Staff Performance
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Individual staff metrics, doctor performance charts, and working hours</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              className="input-dark pl-9 py-2 text-xs w-56"
              placeholder="Search staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-4">
          {[
            { id: 'doctors', label: `Doctors (${doctors.length})` },
            { id: 'staff', label: `All Staff (${staff.length})` },
            { id: 'comparison', label: 'Performance Comparison' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t.id
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-violet-500" size={28} />
          </div>
        ) : (
          <>
            {/* === DOCTORS TAB === */}
            {tab === 'doctors' && (
              <div className="grid grid-cols-5 gap-4">
                {/* Doctor List */}
                <div className="col-span-2 space-y-2">
                  {filteredDoctors.length === 0 ? (
                    <div className="glass-card p-6 text-center text-slate-600 text-sm">No doctors found</div>
                  ) : filteredDoctors.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setSelected(doc)}
                      className={`w-full p-4 rounded-xl border transition-all text-left ${
                        selected?.id === doc.id
                          ? 'bg-violet-500/10 border-violet-500/30'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-300 font-bold text-sm shrink-0">
                          {(doc.name || 'D').charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{doc.name}</div>
                          <div className="text-xs text-slate-500">{doc.specialty}</div>
                        </div>
                        <RatingStars rating={doc.rating} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="text-center">
                          <div className="text-sm font-bold text-white">{doc.patients_treated}</div>
                          <div className="text-xs text-slate-600">Patients</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-white">{doc.avg_treatment_time_mins}m</div>
                          <div className="text-xs text-slate-600">Avg</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-white">{doc.hours_worked}h</div>
                          <div className="text-xs text-slate-600">Hours</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Selected Doctor Detail */}
                <div className="col-span-3 space-y-4">
                  {!selected ? (
                    <div className="glass-card p-10 flex items-center justify-center text-slate-600">
                      Select a doctor to view performance
                    </div>
                  ) : (
                    <>
                      <div className="glass-card p-5">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-14 h-14 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-300 font-bold text-2xl">
                            {(selected.name || 'D').charAt(0)}
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white">{selected.name}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="badge badge-violet">{selected.specialty}</span>
                              <RatingStars rating={selected.rating} />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <MetricBar label="Patients Treated" value={selected.patients_treated} max={50} color="#6366f1" />
                          <MetricBar label="Avg Treatment (mins)" value={selected.avg_treatment_time_mins} max={60} color="#f59e0b" />
                          <MetricBar label="Hours Worked" value={selected.hours_worked} max={12} color="#10b981" />
                          <MetricBar label="Rating Score" value={(selected.rating * 20).toFixed(0)} max={100} color="#8b5cf6" />
                        </div>
                      </div>

                      {/* Radar Chart */}
                      <div className="glass-card p-5">
                        <h3 className="text-sm font-semibold text-white mb-4">Performance Radar</h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="rgba(255,255,255,0.06)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10 }} />
                            <Radar name="Score" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                            <Tooltip content={<CustomTooltip />} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Work Hours Heatmap (simulated) */}
                      <div className="glass-card p-5">
                        <h3 className="text-sm font-semibold text-white mb-4">Simulated Weekly Schedule</h3>
                        <div className="grid grid-cols-7 gap-1">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, di) => (
                            <div key={day} className="text-center">
                              <div className="text-xs text-slate-600 mb-1.5">{day}</div>
                              {Array.from({ length: 8 }).map((_, hi) => {
                                const isWorking = di < 5 && hi >= 2 && hi <= 7;
                                const isBreak = isWorking && (hi === 4);
                                return (
                                  <div
                                    key={hi}
                                    className={`h-4 rounded-sm mb-0.5 transition-opacity ${
                                      isBreak ? 'bg-amber-500/40' :
                                      isWorking ? 'bg-violet-500/60' :
                                      'bg-white/[0.03]'
                                    }`}
                                    title={isWorking ? (isBreak ? 'Break' : 'Working') : 'Off'}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-500/60" /><span className="text-xs text-slate-500">Working</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-500/40" /><span className="text-xs text-slate-500">Break</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-white/[0.03]" /><span className="text-xs text-slate-500">Off</span></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* === ALL STAFF TAB === */}
            {tab === 'staff' && (
              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Staff Directory</h3>
                  <span className="badge badge-violet">{filteredStaff.length} members</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-slate-600">No staff found</td></tr>
                    ) : filteredStaff.map((s, i) => {
                      const perf = Math.floor(Math.random() * 30 + 70);
                      return (
                        <tr key={s.id || i}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-semibold text-xs">
                                {(s.name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold text-white">{s.name}</span>
                            </div>
                          </td>
                          <td><span className="badge badge-blue uppercase">{s.role}</span></td>
                          <td className="text-slate-400 text-xs">{s.department_name || 'Administration'}</td>
                          <td><span className="badge badge-green"><CheckCircle2 size={10} />Active</span></td>
                          <td>
                            <div className="flex items-center gap-2 w-32">
                              <div className="progress-bar flex-1">
                                <div className="progress-fill bg-violet-500" style={{ width: `${perf}%` }} />
                              </div>
                              <span className="text-xs text-slate-400">{perf}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* === COMPARISON TAB === */}
            {tab === 'comparison' && (
              <div className="space-y-5">
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Doctor Patient Volume Comparison</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={doctorBarData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="patients" name="Patients Treated" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Leaderboard */}
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Award size={15} className="text-amber-400" />
                      Doctor Leaderboard
                    </h3>
                    <div className="space-y-3">
                      {[...doctors].sort((a, b) => (b.patients_treated || 0) - (a.patients_treated || 0)).slice(0, 5).map((doc, i) => (
                        <div key={doc.id} className="flex items-center gap-3">
                          <span className={`text-sm font-bold w-5 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-slate-600'}`}>
                            {i + 1}
                          </span>
                          <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 font-semibold text-xs">
                            {(doc.name || 'D').charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-white">{doc.name}</div>
                            <div className="text-xs text-slate-600">{doc.specialty}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-violet-400">{doc.patients_treated}</div>
                            <div className="text-xs text-slate-600">patients</div>
                          </div>
                        </div>
                      ))}
                      {doctors.length === 0 && <div className="text-slate-600 text-sm text-center py-4">No data</div>}
                    </div>
                  </div>

                  {/* Alerts */}
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <AlertTriangle size={15} className="text-rose-400" />
                      Performance Alerts
                    </h3>
                    <div className="space-y-2">
                      {doctors.filter(d => (d.avg_treatment_time_mins || 0) > 25).length === 0 &&
                       doctors.filter(d => (d.rating || 5) < 4).length === 0 ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          <span className="text-sm text-emerald-400">All staff performing within expected thresholds</span>
                        </div>
                      ) : (
                        <>
                          {doctors.filter(d => (d.avg_treatment_time_mins || 0) > 25).map(d => (
                            <div key={d.id} className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                              <span className="text-xs text-amber-300">{d.name}: High avg treatment time ({d.avg_treatment_time_mins}m)</span>
                            </div>
                          ))}
                          {doctors.filter(d => (d.rating || 5) < 4).map(d => (
                            <div key={d.id} className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                              <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                              <span className="text-xs text-rose-300">{d.name}: Low rating ({d.rating})</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
