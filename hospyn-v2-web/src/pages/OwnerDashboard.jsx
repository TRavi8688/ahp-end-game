import React, { useState, useEffect } from 'react';
import {
  ChevronDown, Shield, Zap, Brain,
  Users, Heart, Cpu, Globe,
  TrendingUp, Lock, Server,
  AlertTriangle, CheckCircle,
  UploadCloud, X, Menu, Search,
  Filter, RefreshCw, Key, CreditCard,
  Camera, Activity, Layers, Plus,
  Compass, ShoppingBag, Eye, ShieldAlert,
  BarChart3, Database, Mail, ChevronRight, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SqlBadge } from '../components/Modals';

const API_BASE = '/api/v1';

export default function OwnerDashboard({ onLogout }) {
  const [consoleTab, setConsoleTab] = useState('dashboard');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [dashboardDrilldown, setDashboardDrilldown] = useState(null);

  // Live telemetry state
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  // Filter state
  const [activityFilterDate, setActivityFilterDate] = useState('');

  // Staff provisioning state
  const [staffRole, setStaffRole] = useState('doctor');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffLicense, setStaffLicense] = useState('');
  const [staffSpecialty, setStaffSpecialty] = useState('Cardiology');
  const [staffJobTitle, setStaffJobTitle] = useState('');
  const [staffNationalId, setStaffNationalId] = useState('');
  const [staffBranch, setStaffBranch] = useState('Delhi Branch');

  const [activeSpecialties, setActiveSpecialties] = useState(['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Medicine']);
  const [activeRoles, setActiveRoles] = useState(['doctor', 'nurse', 'receptionist', 'lab', 'pharmacist', 'hr_manager', 'admin']);

  const [staffRecords, setStaffRecords] = useState([]);
  const [activeDispatchMail, setActiveDispatchMail] = useState(null);
  const [isMailOpen, setIsMailOpen] = useState(false);

  // ── FIXED: Fetch real dashboard data — mock_token_123 bypass REMOVED ──────
  const fetchDashboard = async (branchId) => {
    const token = localStorage.getItem('hospyn_owner_token');
    if (!token) {
      onLogout();
      return;
    }

    setDashboardLoading(true);
    setDashboardError(null);

    try {
      let url = `${API_BASE}/owner/dashboard`;
      if (branchId && branchId !== 'All') url += `?branch_id=${branchId}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        // Token expired or invalid — force logout
        localStorage.removeItem('hospyn_owner_token');
        onLogout();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      // Handle both wrapped and unwrapped response formats
      setDashboardData(data.data || data);
    } catch (err) {
      setDashboardError(err.message || 'Failed to load dashboard data');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedBranch);
    const interval = setInterval(() => fetchDashboard(selectedBranch), 30000); // 30s refresh
    return () => clearInterval(interval);
  }, [selectedBranch]);

  const handleAddStaffDynamic = async (e) => {
    e.preventDefault();
    if (!staffName || !staffEmail) return;

    const token = localStorage.getItem('hospyn_owner_token');
    if (!token) { onLogout(); return; }

    try {
      let dbRole = 'nurse';
      let specialtyVal = '';
      let jobTitleVal = '';

      if (staffRole === 'doctor') {
        dbRole = 'doctor';
        specialtyVal = staffSpecialty;
        jobTitleVal = `${staffSpecialty} Specialist`;
      } else if (staffRole === 'nurse') {
        dbRole = 'nurse';
        jobTitleVal = staffJobTitle || 'General Nurse';
      } else if (staffRole === 'receptionist') {
        dbRole = 'receptionist';
        jobTitleVal = staffJobTitle || 'Front Desk Receptionist';
      } else if (staffRole === 'lab') {
        dbRole = 'lab';
        jobTitleVal = staffJobTitle || 'Lab Specialist';
      } else if (staffRole === 'pharmacist') {
        dbRole = 'pharmacy';
        jobTitleVal = 'Pharmacist';
      } else if (staffRole === 'admin') {
        dbRole = 'admin';
        jobTitleVal = 'Administrator';
      } else if (staffRole === 'hr_manager') {
        dbRole = 'hospital_admin';
        jobTitleVal = 'HR Manager';
      }

      const res = await fetch(`${API_BASE}/staff/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: staffEmail,
          role: dbRole,
          full_name: staffName,
          phone_number: staffPhone,
          specialty: specialtyVal || undefined,
          job_title: jobTitleVal || undefined
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to dispatch credentials');
      }

      const data = await res.json();

      let portal_url;
      if (dbRole === 'doctor') portal_url = 'https://doctor.hospyn.com';
      else if (dbRole === 'pharmacy') portal_url = 'https://staff.hospyn.com';
      else portal_url = 'https://staff.hospyn.com';

      const newRecord = {
        name: staffName,
        email: staffEmail,
        role: dbRole,
        staff_id: data.data?.staff_id || data.staff_id || 'GENERATED-BY-BACKEND',
        temporary_password: data.data?.temp_password || data.temp_password || 'Sent via Email',
        dedicated_portal_url: portal_url,
        credentials_email_status: 'dispatched',
        hospitalName: localStorage.getItem('hospyn_org_name') || dashboardData?.hospital_name || 'Hospyn Hospital'
      };

      setStaffRecords([newRecord, ...staffRecords]);
      setActiveDispatchMail(newRecord);
      setIsMailOpen(true);

      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffLicense('');
      setStaffNationalId('');
      setStaffJobTitle('');
    } catch (err) {
      alert('Error adding staff: ' + err.message);
    }
  };

  // ── Error state ───────────────────────────────────────────────
  if (dashboardError && !dashboardData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-slate-100">
        <div className="text-center space-y-4">
          <ShieldAlert size={48} className="text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Unable to Load Dashboard</h2>
          <p className="text-sm text-slate-400 max-w-sm">{dashboardError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fetchDashboard(selectedBranch)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition"
            >
              Retry
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 border border-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen text-slate-100 bg-[#0B0F19] font-inter">

      {/* LEFT SIDEBAR FRAME */}
      <div className="w-64 bg-[#0F1424] border-r border-slate-800/80 flex flex-col justify-between p-6">
        <div className="space-y-8">
          <div className="flex items-center gap-2 text-white font-extrabold text-xl tracking-tight">
            <Shield className="text-violet-500" size={24} />
            <span>HOSPYN<span className="text-violet-500">.</span></span>
          </div>

          {/* Active Node Branch Selector */}
          <div className="space-y-1">
            <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">Active Node</label>
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-[#182038] border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-slate-100 outline-none appearance-none cursor-pointer focus:border-violet-500"
              >
                <option value="All">All Branches</option>
                {(dashboardData?.branches || []).map((br) => (
                  <option key={br.id} value={br.id}>{br.name} ({br.city})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 text-slate-450 pointer-events-none" size={14} />
            </div>
          </div>

          {/* Sidebar Nav Items */}
          <div className="space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard Cockpit', icon: BarChart3 },
              { id: 'branch-manager', label: 'Branch Analytics', icon: Layers },
              { id: 'staff', label: 'Staff Provisioner (IAM)', icon: Users },
              { id: 'ehr', label: 'EHR Passports', icon: Database },
              { id: 'lab', label: 'LOINC Laboratory', icon: Activity },
              { id: 'opd', label: 'OPD & Bed Scheduler', icon: Server },
              { id: 'ai-governance', label: 'AI Safety Governance', icon: Brain }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setConsoleTab(item.id);
                  setDashboardDrilldown(null);
                }}
                className={`w-full flex gap-3 items-center p-3 rounded-xl text-xs font-bold tracking-tight transition-all ${
                  consoleTab === item.id
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10'
                    : 'text-slate-400 hover:bg-[#151C33] hover:text-slate-100'
                }`}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="p-3 bg-[#131A30] rounded-xl flex gap-3 items-center border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs uppercase">
              {(dashboardData?.hospital_name || 'H')[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-100 truncate">{dashboardData?.hospital_name || 'Loading...'}</p>
              <p className="text-[9px] text-slate-400 truncate">{localStorage.getItem('hospyn_owner_email') || '...'}</p>
              {dashboardData?.scale && (
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                  dashboardData.scale === 'High' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  dashboardData.scale === 'Mid' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>{dashboardData.scale}-Level Scope</span>
              )}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-2.5 border border-slate-800 hover:bg-[#182038] text-slate-350 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            Logout Console
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-grow p-10 overflow-y-auto max-h-screen">

        {/* Loading state */}
        {dashboardLoading && !dashboardData && (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Dashboard...</p>
          </div>
        )}

        {/* Inline error banner (data already loaded, refresh failed) */}
        {dashboardError && dashboardData && (
          <div className="mb-4 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <p className="text-xs text-rose-300 font-medium">{dashboardError} — showing last cached data</p>
            <button onClick={() => fetchDashboard(selectedBranch)} className="ml-auto text-xs text-rose-400 hover:text-rose-300 font-bold">Retry</button>
          </div>
        )}

        {dashboardData && (
          <div className="space-y-8 max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex justify-between items-end border-b border-slate-800/80 pb-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-white uppercase">
                  {consoleTab === 'dashboard' && (dashboardDrilldown ? `${dashboardDrilldown} Console` : 'Dashboard Cockpit')}
                  {consoleTab === 'branch-manager' && 'Branch Analytics'}
                  {consoleTab === 'staff' && 'Staff Provisioner (IAM)'}
                  {consoleTab === 'ehr' && 'EHR Passport Audits'}
                  {consoleTab === 'lab' && 'LOINC Laboratory'}
                  {consoleTab === 'opd' && 'OPD & Capacity Planner'}
                  {consoleTab === 'ai-governance' && 'AI Safety Governance'}
                </h1>
                <p className="text-xs font-medium text-slate-400 mt-1">
                  {dashboardData.hospital_name} · Live telemetry
                </p>
              </div>
              <div className="flex items-center gap-3">
                {dashboardLoading && dashboardData && (
                  <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                )}
                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE
                </div>
              </div>
            </div>

            {/* DASHBOARD TAB */}
            {consoleTab === 'dashboard' && (
              <>
                {!dashboardDrilldown ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                      {/* Revenue Card */}
                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">Revenue Today</span>
                          <span className="text-slate-500">💰</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          ₹{(dashboardData.telemetry?.income_today || 0).toLocaleString()}
                        </h2>
                        <button
                          onClick={() => setDashboardDrilldown('ledger')}
                          className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all"
                        >
                          View Ledger <ChevronRight size={12} />
                        </button>
                      </div>

                      {/* Staff Card */}
                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-violet-500/5 blur-2xl group-hover:bg-violet-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-violet-400 tracking-wider">Workforce</span>
                          <span className="text-slate-500">👥</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          {(dashboardData.staff || []).length}
                        </h2>
                        <button
                          onClick={() => setDashboardDrilldown('staff')}
                          className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all"
                        >
                          View staff <ChevronRight size={12} />
                        </button>
                      </div>

                      {/* Beds Card */}
                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-blue-400 tracking-wider">Bed Capacity</span>
                          <span className="text-slate-500">🏥</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          {dashboardData.telemetry?.beds_occupied || 0}{' '}
                          <span className="text-sm font-semibold text-slate-500">/ {dashboardData.telemetry?.beds_total || 0}</span>
                        </h2>
                        <button
                          onClick={() => setDashboardDrilldown('beds')}
                          className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all"
                        >
                          Ward layout <ChevronRight size={12} />
                        </button>
                      </div>

                      {/* Pharmacy Alerts */}
                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-amber-500/5 blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">Pharmacy Alerts</span>
                          <span className="text-slate-500">💊</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          {dashboardData.telemetry?.low_stock_count || 0}{' '}
                          <span className="text-sm font-semibold text-slate-500">Low Stock</span>
                        </h2>
                        <button
                          onClick={() => setDashboardDrilldown('pharmacy')}
                          className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all"
                        >
                          View stock <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Activity Feed */}
                    <div className="bg-[#0F1424] border border-slate-800/80 rounded-3xl p-6 shadow-xl">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live System Event Log</h3>
                        <button
                          onClick={() => setDashboardDrilldown('activity')}
                          className="text-[10px] font-bold text-violet-400 hover:underline"
                        >
                          Full log
                        </button>
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {(dashboardData.activity_feed || []).length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-8">No activity yet today</p>
                        ) : (
                          (dashboardData.activity_feed || []).map((feed, i) => (
                            <div key={i} className="flex gap-4 items-start text-xs border-b border-slate-800/50 pb-3 last:border-0">
                              <div className="p-2 bg-slate-800/80 rounded-xl text-slate-300 mt-0.5">
                                {feed.action?.includes('PAYMENT') ? (
                                  <CreditCard size={14} className="text-emerald-400" />
                                ) : feed.action?.includes('INTAKE') ? (
                                  <Activity size={14} className="text-cyan-400" />
                                ) : (
                                  <Layers size={14} className="text-violet-400" />
                                )}
                              </div>
                              <div className="flex-grow">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-100 uppercase tracking-tight">
                                    {feed.action?.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono">
                                    {feed.timestamp ? new Date(feed.timestamp).toLocaleTimeString() : ''}
                                  </span>
                                </div>
                                <p className="text-slate-400 text-[10px] mt-1">
                                  {feed.actor_name} ({feed.actor_role}) · Patient: {feed.patient || 'N/A'}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Drill-down views
                  <div className="space-y-6">
                    <button
                      onClick={() => setDashboardDrilldown(null)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white border border-slate-800 rounded-lg px-4 py-2 bg-[#121A30] transition-all"
                    >
                      <ArrowLeft size={14} /> Back to Cockpit
                    </button>

                    {/* STAFF DRILLDOWN */}
                    {dashboardDrilldown === 'staff' && (
                      <div className="bg-[#0F1424] border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 bg-[#131A30] border-b border-slate-800">
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Shift Board</h3>
                        </div>
                        <table className="w-full text-xs text-left">
                          <thead className="border-b border-slate-800 bg-[#0F1424]">
                            <tr className="text-slate-400">
                              <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Name</th>
                              <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Role</th>
                              <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Department</th>
                              <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50 font-medium">
                            {(dashboardData.staff || []).map((s, i) => (
                              <tr key={i} className="hover:bg-[#131A30]/50 text-slate-300">
                                <td className="py-3 px-4 font-bold text-white">{s.name || s.full_name}</td>
                                <td className="py-3 px-4 text-slate-400">{s.role}</td>
                                <td className="py-3 px-4 text-slate-400">{s.department || s.specialty || '—'}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                                    s.status === 'ACTIVE' || s.status === 'Active' ?
                                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>{s.status || 'Active'}</span>
                                </td>
                              </tr>
                            ))}
                            {(dashboardData.staff || []).length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">No staff records found</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* BEDS DRILLDOWN */}
                    {dashboardDrilldown === 'beds' && (
                      <div className="grid grid-cols-3 gap-6">
                        <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 text-center">
                          <span className="text-3xl font-black text-white">{dashboardData.telemetry?.beds_total || 0}</span>
                          <p className="text-[10px] font-bold text-slate-450 uppercase mt-1">Total</p>
                        </div>
                        <div className="bg-[#121A30] border border-rose-900/20 rounded-2xl p-5 text-center">
                          <span className="text-3xl font-black text-rose-500">{dashboardData.telemetry?.beds_occupied || 0}</span>
                          <p className="text-[10px] font-bold text-rose-400 uppercase mt-1">Occupied</p>
                        </div>
                        <div className="bg-[#121A30] border border-emerald-900/20 rounded-2xl p-5 text-center">
                          <span className="text-3xl font-black text-emerald-400">
                            {(dashboardData.telemetry?.beds_total || 0) - (dashboardData.telemetry?.beds_occupied || 0)}
                          </span>
                          <p className="text-[10px] font-bold text-emerald-400 uppercase mt-1">Available</p>
                        </div>
                      </div>
                    )}

                    {/* LEDGER DRILLDOWN */}
                    {dashboardDrilldown === 'ledger' && (
                      <div className="bg-[#0F1424] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 bg-[#131A30] border-b border-slate-800">
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Payment Ledger</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="border-b border-slate-800 bg-[#0F1424]">
                              <tr className="text-slate-450">
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Patient</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Invoice</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Amount</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Method</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 font-medium">
                              {(dashboardData.ledger || []).map((row, i) => (
                                <tr key={i} className="hover:bg-[#131A30]/50 text-slate-350">
                                  <td className="py-3 px-4 font-bold text-white">{row.patient_name}</td>
                                  <td className="py-3 px-4 font-mono text-slate-400 text-[10px]">{row.invoice_number || row.patient_hospyn_id}</td>
                                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">₹{(row.total_amount || 0).toFixed(2)}</td>
                                  <td className="py-3 px-4 font-mono uppercase text-[10px]">{row.payment_method || 'UPI'}</td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                      row.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                    }`}>{row.status || 'PENDING'}</span>
                                  </td>
                                </tr>
                              ))}
                              {(dashboardData.ledger || []).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">No transactions today</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ACTIVITY DRILLDOWN */}
                    {dashboardDrilldown === 'activity' && (
                      <div className="bg-[#0F1424] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 bg-[#131A30] border-b border-slate-800">
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Security Operations Log</h3>
                        </div>
                        <table className="w-full text-xs text-left">
                          <thead className="border-b border-slate-800 bg-[#0F1424]">
                            <tr className="text-slate-450">
                              <th className="py-3 px-4 font-bold uppercase text-[9px]">Time</th>
                              <th className="py-3 px-4 font-bold uppercase text-[9px]">Action</th>
                              <th className="py-3 px-4 font-bold uppercase text-[9px]">Operator</th>
                              <th className="py-3 px-4 font-bold uppercase text-[9px]">Role</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50 font-medium">
                            {(dashboardData.activity_feed || []).map((feed, i) => (
                              <tr key={i} className="hover:bg-[#131A30]/50 text-slate-350">
                                <td className="py-3 px-4 font-mono text-slate-500 text-[10px]">{new Date(feed.timestamp || Date.now()).toLocaleString()}</td>
                                <td className="py-3 px-4 font-bold text-white uppercase">{feed.action?.replace(/_/g, ' ')}</td>
                                <td className="py-3 px-4 font-bold text-slate-200">{feed.actor_name}</td>
                                <td className="py-3 px-4 text-violet-400">{feed.actor_role}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* STAFF IAM TAB */}
            {consoleTab === 'staff' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <form onSubmit={handleAddStaffDynamic} className="bg-[#0F1424] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 uppercase tracking-wide">Recruit Staff</h3>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Role *</label>
                    <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)}
                      className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-white outline-none cursor-pointer focus:border-violet-500">
                      {activeRoles.includes('doctor') && <option value="doctor">Doctor</option>}
                      {activeRoles.includes('nurse') && <option value="nurse">Nurse</option>}
                      {activeRoles.includes('receptionist') && <option value="receptionist">Receptionist</option>}
                      {activeRoles.includes('lab') && <option value="lab">Lab Specialist</option>}
                      {activeRoles.includes('pharmacist') && <option value="pharmacist">Pharmacist</option>}
                      {activeRoles.includes('hr_manager') && <option value="hr_manager">HR Manager</option>}
                      {activeRoles.includes('admin') && <option value="admin">Administrator</option>}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Full Name *</label>
                    <input className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-violet-500"
                      placeholder="Enter full name" required value={staffName} onChange={(e) => setStaffName(e.target.value)} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Email *</label>
                    <input className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-violet-500"
                      placeholder="Email address" required type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phone *</label>
                    <input className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-violet-500"
                      placeholder="+91 98765 43210" required value={staffPhone} onChange={(e) => setStaffPhone(e.target.value)} />
                  </div>

                  {staffRole === 'doctor' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">License Number *</label>
                        <input className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-violet-500 font-mono"
                          placeholder="MCI-XXXXXX" required value={staffLicense} onChange={(e) => setStaffLicense(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Specialty *</label>
                        <select className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-white outline-none"
                          value={staffSpecialty} onChange={(e) => setStaffSpecialty(e.target.value)}>
                          {activeSpecialties.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  <button type="submit"
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98]">
                    Dispatch Credentials
                  </button>
                </form>

                <div className="lg:col-span-2 bg-[#0F1424] border border-slate-800 rounded-3xl p-6 shadow-xl">
                  <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 uppercase tracking-wide mb-4">Staff Registry</h3>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="py-3 font-bold uppercase tracking-wider">Name</th>
                        <th className="py-3 font-bold uppercase tracking-wider">Role</th>
                        <th className="py-3 font-bold uppercase tracking-wider">Staff ID</th>
                        <th className="py-3 font-bold uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-medium text-slate-350">
                      {[...staffRecords, ...(dashboardData.staff || [])].map((rec, i) => (
                        <tr key={i} className="hover:bg-[#131A30]/50">
                          <td className="py-3.5 text-white font-bold">{rec.name || rec.full_name || rec.user_name}</td>
                          <td className="py-3.5">
                            <span className="px-2.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[9px] font-bold border border-violet-500/20 uppercase">
                              {rec.role || rec.role_name}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono text-slate-400 text-[10px]">{rec.staff_id || rec.hospyn_id || rec.id}</td>
                          <td className="py-3.5">
                            <span className="text-emerald-400 flex items-center gap-1 text-[9px] font-bold uppercase">
                              <CheckCircle size={12} /> Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Other tabs placeholder */}
            {(consoleTab === 'ehr' || consoleTab === 'lab' || consoleTab === 'opd' || consoleTab === 'ai-governance' || consoleTab === 'branch-manager') && (
              <div className="bg-[#0F1424] border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center max-w-2xl mx-auto shadow-xl">
                <ShieldAlert size={48} className="text-violet-500/30 mb-4" />
                <h3 className="font-bold text-white text-lg uppercase tracking-wider">{consoleTab.toUpperCase()} Module</h3>
                <p className="text-slate-400 text-xs max-w-md mt-2">This module is being wired to live backend data. Check back shortly.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Credentials Email Modal */}
      <CredentialsEmailModal
        isOpen={isMailOpen}
        onClose={() => setIsMailOpen(false)}
        staffRecord={activeDispatchMail}
      />
    </div>
  );
}

const CredentialsEmailModal = ({ isOpen, onClose, staffRecord }) => {
  if (!isOpen || !staffRecord) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl w-full bg-[#0F1424] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="text-violet-400" size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Credentials Dispatched</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-8 font-mono text-xs text-slate-300 space-y-4">
          <p><strong>To:</strong> {staffRecord.email}</p>
          <p><strong>Staff ID:</strong> <span className="text-violet-400 font-bold">{staffRecord.staff_id}</span></p>
          <p className="text-slate-400">Temporary credentials have been dispatched to the staff email. They will be prompted to set a new password on first login.</p>
        </div>
        <div className="p-6 flex justify-end">
          <button onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
