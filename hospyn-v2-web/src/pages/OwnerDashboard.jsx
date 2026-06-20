/**
 * hospyn-v2-web/src/pages/OwnerDashboard.jsx
 *
 * COMPLETE REBUILD — zero mock data, zero hardcoded fallback numbers.
 *
 * Bugs removed from the original file:
 *  1. `mock_token_123` bypass block — entire fake hospital dataset, gone.
 *  2. Response shape bug — backend wraps data as { data: {...}, message }
 *     via success_response(). Old code did setDashboardData(data) directly,
 *     never unwrapping .data. Fixed: setDashboardData(json.data).
 *  3. Staff drilldown — was a hardcoded array of 8 fake doctors/nurses with
 *     fake clock-in times and patient counts. Now renders real
 *     dashboardData.staff (fields: id, name, role, department, specialty,
 *     status — exactly what GET /owner/dashboard actually returns).
 *  4. Pharmacy drilldown — was a hardcoded array of 12 fake medicines.
 *     Now fetches real data from GET /pharmacy/inventory.
 *  5. EHR tab — was 3 hardcoded fake patients with fake vitals.
 *     Now fetches from GET /owner/ehr-passports (used by SovereignConsole
 *     too, so the shape is already proven).
 *  6. Branch Analytics — removed `|| 4` / `|| 28` fake fallback numbers.
 *     Real zero is now shown as zero, not silently replaced with fiction.
 *  7. Bed/Staff counter cards — removed hardcoded "24 / 4 / 2" literals.
 *     Now computed from real dashboardData.staff and bed telemetry.
 *
 * All endpoints used are REAL and confirmed present in this codebase:
 *   GET /owner/dashboard           (owner.py)
 *   GET /owner/ehr-passports       (owner.py, used by SovereignConsole)
 *   GET /pharmacy/inventory        (pharmacy.py)
 *   POST /staff/invites            (staff.py)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, Brain, Users, Server,
  AlertTriangle, CheckCircle, X, RefreshCw, CreditCard,
  Activity, Layers, BarChart3, Database, Mail,
  ChevronRight, ArrowLeft, ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SqlBadge } from '../components/Modals';
import { get, post } from '../lib/api';
import logoImg from '../assets/logo.png';

export default function OwnerDashboard({ onLogout }) {
  const [consoleTab, setConsoleTab] = useState('dashboard');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [dashboardDrilldown, setDashboardDrilldown] = useState(null);

  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);

  const [activityFilterDate, setActivityFilterDate] = useState('');

  // Staff provisioning form
  const [staffRole, setStaffRole] = useState('doctor');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffLicense, setStaffLicense] = useState('');
  const [staffSpecialty, setStaffSpecialty] = useState('Cardiology');
  const [staffJobTitle, setStaffJobTitle] = useState('');
  const [staffBranch, setStaffBranch] = useState('');

  const [activeSpecialties] = useState(['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Medicine']);
  const [activeRoles] = useState(['doctor', 'nurse', 'receptionist', 'lab', 'pharmacist', 'hr_manager', 'admin']);

  const [staffRecords, setStaffRecords] = useState([]);
  const [activeDispatchMail, setActiveDispatchMail] = useState(null);
  const [isMailOpen, setIsMailOpen] = useState(false);

  // Lazy-loaded drilldown data — only fetched when the user opens that drilldown
  const [pharmacyInventory, setPharmacyInventory] = useState(null);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [pharmacyError, setPharmacyError] = useState(null);

  const [ehrPassports, setEhrPassports] = useState(null);
  const [ehrLoading, setEhrLoading] = useState(false);
  const [ehrError, setEhrError] = useState(null);

  // ── Fetch real dashboard data ────────────────────────────────────────────
  const fetchDashboard = useCallback(async (branchId) => {
    const token = localStorage.getItem('hospyn_owner_token');
    if (!token) {
      onLogout();
      return;
    }

    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const params = branchId && branchId !== 'All' ? { branch_id: branchId } : {};
      const json = await get('/owner/dashboard', { params });

      // Backend wraps the real payload as { data: {...}, message: "..." }
      // via success_response(). Unwrap it here — this was the silent bug
      // in the original file that meant dashboardData was shaped wrong
      // even outside the mock-token path.
      const payload = json?.data ?? json;
      setDashboardData(payload);
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem('hospyn_owner_token');
        onLogout();
        return;
      }
      setDashboardError(err.message || 'Failed to load dashboard data');
    } finally {
      setDashboardLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchDashboard(selectedBranch);
    const interval = setInterval(() => fetchDashboard(selectedBranch), 30000);
    return () => clearInterval(interval);
  }, [selectedBranch, fetchDashboard]);

  // ── Lazy-load pharmacy inventory when that drilldown opens ──────────────
  const fetchPharmacyInventory = useCallback(async () => {
    setPharmacyLoading(true);
    setPharmacyError(null);
    try {
      const data = await get('/pharmacy/inventory');
      setPharmacyInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      setPharmacyError(err.message || 'Failed to load pharmacy inventory');
      setPharmacyInventory([]);
    } finally {
      setPharmacyLoading(false);
    }
  }, []);

  // ── Lazy-load EHR passports when that tab opens ──────────────────────────
  const fetchEhrPassports = useCallback(async () => {
    setEhrLoading(true);
    setEhrError(null);
    try {
      const data = await get('/owner/ehr-passports');
      setEhrPassports(data?.passports || []);
    } catch (err) {
      setEhrError(err.message || 'Failed to load patient records');
      setEhrPassports([]);
    } finally {
      setEhrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dashboardDrilldown === 'pharmacy' && pharmacyInventory === null) {
      fetchPharmacyInventory();
    }
  }, [dashboardDrilldown, pharmacyInventory, fetchPharmacyInventory]);

  useEffect(() => {
    if (consoleTab === 'ehr' && ehrPassports === null) {
      fetchEhrPassports();
    }
  }, [consoleTab, ehrPassports, fetchEhrPassports]);

  // ── Staff provisioning ────────────────────────────────────────────────────
  const handleAddStaffDynamic = async (e) => {
    e.preventDefault();
    if (!staffName || !staffEmail) return;

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

      const data = await post('/staff/invites', {
        email: staffEmail,
        role: dbRole,
        full_name: staffName,
        phone_number: staffPhone,
        specialty: specialtyVal || undefined,
        job_title: jobTitleVal || undefined,
      });

      const ROLE_PORTALS = {
        doctor: 'https://doctor.hospin.com',
        nurse: 'https://staff.hospin.com',
        receptionist: 'https://staff.hospin.com',
        lab: 'https://staff.hospin.com',
        pharmacy: 'https://staff.hospin.com',
        hospital_admin: 'https://staff.hospin.com',
        admin: 'https://staff.hospin.com',
      };
      const portal_url = ROLE_PORTALS[dbRole] || 'https://staff.hospin.com';

      const newRecord = {
        name: staffName,
        email: staffEmail,
        role: dbRole,
        staff_id: data?.data?.staff_id || data?.staff_id || 'PENDING',
        temporary_password: data?.data?.temp_password || data?.temp_password || 'Sent via email',
        dedicated_portal_url: portal_url,
        credentials_email_status: 'dispatched',
        hospitalName: localStorage.getItem('hospyn_org_name') || dashboardData?.hospital_name || 'Your Hospital',
      };

      setStaffRecords(prev => [newRecord, ...prev]);
      setActiveDispatchMail(newRecord);
      setIsMailOpen(true);

      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffLicense('');
      setStaffJobTitle('');

      // Refresh dashboard so the new staff member shows in real counts
      fetchDashboard(selectedBranch);
    } catch (err) {
      alert('Error adding staff: ' + (err.message || 'Unknown error'));
    }
  };

  // ── Error state (no data loaded at all) ──────────────────────────────────
  if (dashboardError && !dashboardData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-slate-100">
        <div className="text-center space-y-4 max-w-sm px-6">
          <ShieldAlert size={48} className="text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Unable to Load Dashboard</h2>
          <p className="text-sm text-slate-400">{dashboardError}</p>
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

  const staffList = dashboardData?.staff || [];
  const activeStaffCount = staffList.filter(s => (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
  const onBreakCount = staffList.filter(s => (s.status || '').toUpperCase() === 'ON_BREAK' || (s.status || '').toUpperCase() === 'ON BREAK').length;
  const onLeaveCount = staffList.filter(s => (s.status || '').toUpperCase() === 'ON_LEAVE' || (s.status || '').toUpperCase() === 'ON LEAVE').length;

  return (
    <div className="flex min-h-screen text-slate-100 bg-[#0B0F19] font-inter">

      {/* SIDEBAR */}
      <div className="w-64 bg-[#0F1424] border-r border-slate-800/80 flex flex-col justify-between p-6">
        <div className="space-y-8">
          <div className="flex items-center gap-2 text-white font-extrabold text-xl tracking-tight">
            <img src={logoImg} alt="Hospin" className="w-7 h-7 object-contain" />
            <span>HOSPIN<span className="text-violet-500">.</span></span>
          </div>

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
              <ChevronDown className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" size={14} />
            </div>
          </div>

          <div className="space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard Cockpit', icon: BarChart3 },
              { id: 'branch-manager', label: 'Branch Analytics', icon: Layers },
              { id: 'staff', label: 'Staff Provisioner', icon: Users },
              { id: 'ehr', label: 'EHR Passports', icon: Database },
              { id: 'lab', label: 'LOINC Laboratory', icon: Activity },
              { id: 'opd', label: 'OPD & Bed Scheduler', icon: Server },
              { id: 'ai-governance', label: 'AI Safety Governance', icon: Brain },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setConsoleTab(item.id); setDashboardDrilldown(null); }}
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
            className="w-full py-2.5 border border-slate-800 hover:bg-[#182038] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            Logout Console
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-grow p-10 overflow-y-auto max-h-screen">

        {dashboardLoading && !dashboardData && (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Dashboard...</p>
          </div>
        )}

        {dashboardError && dashboardData && (
          <div className="mb-4 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <p className="text-xs text-rose-300 font-medium">{dashboardError} — showing last cached data</p>
            <button onClick={() => fetchDashboard(selectedBranch)} className="ml-auto text-xs text-rose-400 hover:text-rose-300 font-bold">Retry</button>
          </div>
        )}

        {dashboardData && (
          <div className="space-y-8 max-w-7xl mx-auto">

            <div className="flex justify-between items-end border-b border-slate-800/80 pb-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-white uppercase">
                  {consoleTab === 'dashboard' && (dashboardDrilldown ? `${dashboardDrilldown} Console` : 'Dashboard Cockpit')}
                  {consoleTab === 'branch-manager' && 'Branch Analytics'}
                  {consoleTab === 'staff' && 'Staff Provisioner'}
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

            {/* ═══ DASHBOARD TAB ═══ */}
            {consoleTab === 'dashboard' && (
              <>
                {!dashboardDrilldown ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">Revenue Today</span>
                          <span className="text-slate-500">💰</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          ₹{(dashboardData.telemetry?.income_today || 0).toLocaleString()}
                        </h2>
                        <button onClick={() => setDashboardDrilldown('ledger')} className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all">
                          View Ledger <ChevronRight size={12} />
                        </button>
                      </div>

                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-violet-500/5 blur-2xl group-hover:bg-violet-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-violet-400 tracking-wider">Workforce</span>
                          <span className="text-slate-500">👥</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">{staffList.length}</h2>
                        <button onClick={() => setDashboardDrilldown('staff')} className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all">
                          View staff <ChevronRight size={12} />
                        </button>
                      </div>

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
                        <button onClick={() => setDashboardDrilldown('beds')} className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all">
                          Ward layout <ChevronRight size={12} />
                        </button>
                      </div>

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
                        <button onClick={() => setDashboardDrilldown('pharmacy')} className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all">
                          View stock <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#0F1424] border border-slate-800/80 rounded-3xl p-6 shadow-xl">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live System Event Log</h3>
                        <button onClick={() => setDashboardDrilldown('activity')} className="text-[10px] font-bold text-violet-400 hover:underline">
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
                                {feed.action?.includes('PAYMENT') ? <CreditCard size={14} className="text-emerald-400" /> :
                                 feed.action?.includes('INTAKE') ? <Activity size={14} className="text-cyan-400" /> :
                                 <Layers size={14} className="text-violet-400" />}
                              </div>
                              <div className="flex-grow">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-100 uppercase tracking-tight">{feed.action?.replace(/_/g, ' ')}</span>
                                  <span className="text-[9px] text-slate-500 font-mono">{feed.timestamp ? new Date(feed.timestamp).toLocaleTimeString() : ''}</span>
                                </div>
                                <p className="text-slate-400 text-[10px] mt-1">{feed.actor_name} ({feed.actor_role}) · Patient: {feed.patient || 'N/A'}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button onClick={() => setDashboardDrilldown(null)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white border border-slate-800 rounded-lg px-4 py-2 bg-[#121A30] transition-all">
                      <ArrowLeft size={14} /> Back to Cockpit
                    </button>

                    {/* STAFF DRILLDOWN — real data only */}
                    {dashboardDrilldown === 'staff' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-6">
                          <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 text-center">
                            <span className="text-3xl font-black text-emerald-400">{activeStaffCount}</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Active Duty</p>
                          </div>
                          <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 text-center">
                            <span className="text-3xl font-black text-amber-400">{onBreakCount}</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">On Break</p>
                          </div>
                          <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 text-center">
                            <span className="text-3xl font-black text-slate-400">{onLeaveCount}</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">On Leave</p>
                          </div>
                        </div>
                        <div className="bg-[#0F1424] border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                          <div className="p-4 bg-[#131A30] border-b border-slate-800">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Staff Registry</h3>
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
                              {staffList.map((s, i) => (
                                <tr key={s.id || i} className="hover:bg-[#131A30]/50 text-slate-300">
                                  <td className="py-3 px-4 font-bold text-white">{s.name}</td>
                                  <td className="py-3 px-4 text-slate-400">{s.role}</td>
                                  <td className="py-3 px-4 text-slate-400">{s.department || s.specialty || '—'}</td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                                      (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>{s.status || 'ACTIVE'}</span>
                                  </td>
                                </tr>
                              ))}
                              {staffList.length === 0 && (
                                <tr><td colSpan={4} className="py-8 text-center text-slate-500 text-xs">No staff records found. Add staff from the Staff Provisioner tab.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* BEDS DRILLDOWN */}
                    {dashboardDrilldown === 'beds' && (
                      <div className="grid grid-cols-3 gap-6">
                        <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 text-center">
                          <span className="text-3xl font-black text-white">{dashboardData.telemetry?.beds_total || 0}</span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Total</p>
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

                    {/* PHARMACY DRILLDOWN — real data from /pharmacy/inventory */}
                    {dashboardDrilldown === 'pharmacy' && (
                      <div className="space-y-6">
                        <div className="bg-[#0F1424] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                          <div className="p-4 bg-[#131A30] border-b border-slate-800">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">A-Z Medical Inventory</h3>
                          </div>
                          {pharmacyLoading ? (
                            <div className="p-10 flex items-center justify-center gap-3">
                              <RefreshCw size={16} className="text-violet-400 animate-spin" />
                              <span className="text-xs text-slate-400 font-medium">Loading inventory...</span>
                            </div>
                          ) : pharmacyError ? (
                            <div className="p-10 text-center">
                              <p className="text-xs text-rose-400 font-medium mb-2">{pharmacyError}</p>
                              <button onClick={fetchPharmacyInventory} className="text-[10px] font-bold text-violet-400 hover:underline">Retry</button>
                            </div>
                          ) : (
                            <table className="w-full text-xs text-left">
                              <thead className="border-b border-slate-800 bg-[#0F1424]">
                                <tr className="text-slate-400">
                                  <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Medicine</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Category</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Stock</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Reorder Level</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50 font-medium">
                                {(pharmacyInventory || []).map((m) => {
                                  const isCritical = m.quantity_available <= 0;
                                  const isLow = !isCritical && m.quantity_available <= m.reorder_level;
                                  const status = isCritical ? 'Critical' : isLow ? 'Low' : 'Adequate';
                                  return (
                                    <tr key={m.id} className={`hover:bg-[#131A30]/50 text-slate-300 ${isCritical ? 'bg-rose-500/5' : isLow ? 'bg-amber-500/5' : ''}`}>
                                      <td className="py-3 px-4 font-bold text-white">{m.medicine_name}</td>
                                      <td className="py-3 px-4 text-slate-400">{m.category || '—'}</td>
                                      <td className="py-3 px-4 font-bold text-white font-mono">{m.quantity_available}</td>
                                      <td className="py-3 px-4 text-slate-400 font-mono">{m.reorder_level}</td>
                                      <td className="py-3 px-4">
                                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                                          status === 'Critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                          status === 'Low' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        }`}>{status}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {(pharmacyInventory || []).length === 0 && (
                                  <tr><td colSpan={5} className="py-8 text-center text-slate-500 text-xs">No inventory records found.</td></tr>
                                )}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    )}

                    {/* LEDGER DRILLDOWN */}
                    {dashboardDrilldown === 'ledger' && (
                      <div className="bg-[#0F1424] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 bg-[#131A30] border-b border-slate-800 flex items-center justify-between">
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Payment Ledger</h3>
                          <SqlBadge sql={dashboardData?.sql_sources?.ledger} />
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="border-b border-slate-800 bg-[#0F1424]">
                              <tr className="text-slate-400">
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Patient</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Invoice</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Amount</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Method</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 font-medium">
                              {(dashboardData.ledger || []).map((row, i) => (
                                <tr key={i} className="hover:bg-[#131A30]/50 text-slate-300">
                                  <td className="py-3 px-4 font-bold text-white">{row.patient_name}</td>
                                  <td className="py-3 px-4 font-mono text-slate-400 text-[10px]">{row.invoice_number}</td>
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
                                <tr><td colSpan={5} className="py-8 text-center text-slate-500 text-xs">No transactions yet</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ACTIVITY DRILLDOWN */}
                    {dashboardDrilldown === 'activity' && (
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Filter by Date (YYYY-MM-DD)..."
                          value={activityFilterDate}
                          onChange={(e) => setActivityFilterDate(e.target.value)}
                          className="bg-[#121A30] border border-slate-800 text-xs text-white rounded-lg px-3 py-2 outline-none focus:border-violet-500 w-64"
                        />
                        <div className="bg-[#0F1424] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="border-b border-slate-800 bg-[#0F1424]">
                              <tr className="text-slate-400">
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Time</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Action</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Operator</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Role</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 font-medium">
                              {(dashboardData.activity_feed || [])
                                .filter(feed => !activityFilterDate || (feed.timestamp || '').startsWith(activityFilterDate))
                                .map((feed, i) => (
                                  <tr key={i} className="hover:bg-[#131A30]/50 text-slate-300">
                                    <td className="py-3 px-4 font-mono text-slate-500 text-[10px]">{new Date(feed.timestamp || Date.now()).toLocaleString()}</td>
                                    <td className="py-3 px-4 font-bold text-white uppercase">{feed.action?.replace(/_/g, ' ')}</td>
                                    <td className="py-3 px-4 font-bold text-slate-200">{feed.actor_name}</td>
                                    <td className="py-3 px-4 text-violet-400">{feed.actor_role}</td>
                                  </tr>
                                ))}
                              {(dashboardData.activity_feed || []).length === 0 && (
                                <tr><td colSpan={4} className="py-8 text-center text-slate-500 text-xs">No activity logged yet</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ═══ STAFF IAM TAB ═══ */}
            {consoleTab === 'staff' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <form onSubmit={handleAddStaffDynamic} className="bg-[#0F1424] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 uppercase tracking-wide">Recruit Staff</h3>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Role *</label>
                    <select value={staffRole} onChange={(e) => { setStaffRole(e.target.value); setStaffJobTitle(''); }}
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

                  {(dashboardData?.branches || []).length > 1 && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Branch Assignment</label>
                      <select className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none font-bold"
                        value={staffBranch} onChange={(e) => setStaffBranch(e.target.value)}>
                        {dashboardData.branches.map(br => (
                          <option key={br.id} value={br.id}>{br.name}</option>
                        ))}
                      </select>
                    </div>
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
                    <tbody className="divide-y divide-slate-800/50 font-medium text-slate-300">
                      {[...staffRecords, ...staffList].map((rec, i) => (
                        <tr key={i} className="hover:bg-[#131A30]/50">
                          <td className="py-3.5 text-white font-bold">{rec.name}</td>
                          <td className="py-3.5">
                            <span className="px-2.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[9px] font-bold border border-violet-500/20 uppercase">
                              {rec.role}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono text-slate-400 text-[10px]">{rec.staff_id || rec.id || '—'}</td>
                          <td className="py-3.5">
                            <span className="text-emerald-400 flex items-center gap-1 text-[9px] font-bold uppercase">
                              <CheckCircle size={12} /> {rec.status || 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {staffRecords.length === 0 && staffList.length === 0 && (
                        <tr><td colSpan={4} className="py-8 text-center text-slate-500 text-xs">No staff yet. Use the form to recruit your first team member.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ BRANCH ANALYTICS TAB — no fake fallback numbers ═══ */}
            {consoleTab === 'branch-manager' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(dashboardData.branches || []).map((b) => (
                  <div key={b.id} className="bg-[#0F1424] border border-slate-800 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all">
                    <h3 className="font-extrabold text-white text-sm mb-4 border-b border-slate-800 pb-2 font-outfit uppercase tracking-wider">{b.name}</h3>
                    <div className="space-y-3.5 text-xs font-semibold">
                      <div className="flex justify-between text-slate-400"><span className="text-slate-500">Doctors on Duty:</span> <span className="text-white font-bold">{b.doctors_on_duty ?? 0}</span></div>
                      <div className="flex justify-between text-slate-400"><span className="text-slate-500">Patients Today:</span> <span className="text-white font-bold">{b.active_patients ?? 0}</span></div>
                      <div className="flex justify-between text-slate-400"><span className="text-slate-500">Emergency Queue:</span> <span className="text-rose-400 font-bold">{b.emergency_count ?? 0} Active</span></div>
                      <div className="flex justify-between text-slate-400"><span className="text-slate-500">Location:</span> <span className="text-cyan-400 font-mono text-[10px]">{b.city || '—'}</span></div>
                    </div>
                  </div>
                ))}
                {(dashboardData.branches || []).length === 0 && (
                  <p className="col-span-3 text-sm text-slate-500 text-center py-10">No branches configured yet.</p>
                )}
              </div>
            )}

            {/* ═══ EHR TAB — real data from /owner/ehr-passports ═══ */}
            {consoleTab === 'ehr' && (
              <div className="bg-[#0F1424] border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-4 bg-[#131A30] border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Patient EHR Passports</h3>
                  {ehrPassports && <button onClick={fetchEhrPassports} className="text-[10px] font-bold text-violet-400 hover:underline">Refresh</button>}
                </div>
                {ehrLoading ? (
                  <div className="p-10 flex items-center justify-center gap-3">
                    <RefreshCw size={16} className="text-violet-400 animate-spin" />
                    <span className="text-xs text-slate-400 font-medium">Loading patient records...</span>
                  </div>
                ) : ehrError ? (
                  <div className="p-10 text-center">
                    <p className="text-xs text-rose-400 font-medium mb-2">{ehrError}</p>
                    <button onClick={fetchEhrPassports} className="text-[10px] font-bold text-violet-400 hover:underline">Retry</button>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="p-4 font-bold uppercase tracking-wider">Patient Name</th>
                        <th className="p-4 font-bold uppercase tracking-wider">Health ID</th>
                        <th className="p-4 font-bold uppercase tracking-wider">Consent</th>
                        <th className="p-4 font-bold uppercase tracking-wider">Vitals</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-medium text-slate-300">
                      {(ehrPassports || []).map((p) => (
                        <tr key={p.patient_id || p.health_id} className="hover:bg-[#131A30]/50">
                          <td className="p-4 font-bold text-white">{p.name}</td>
                          <td className="p-4 font-mono text-slate-500 text-[10px]">{p.health_id}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 uppercase text-[9px]">
                              {p.dynamic_consent}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 font-mono text-[10px]">{p.vitals_state || '—'}</td>
                        </tr>
                      ))}
                      {(ehrPassports || []).length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-500 text-xs">No patient records yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ═══ PLACEHOLDER TABS — not yet wired to backend, honestly labeled ═══ */}
            {(consoleTab === 'lab' || consoleTab === 'opd' || consoleTab === 'ai-governance') && (
              <div className="bg-[#0F1424] border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center max-w-2xl mx-auto shadow-xl">
                <ShieldAlert size={48} className="text-violet-500/30 mb-4" />
                <h3 className="font-bold text-white text-lg uppercase tracking-wider">{consoleTab.replace('-', ' ').toUpperCase()} Module</h3>
                <p className="text-slate-400 text-xs max-w-md mt-2">This module is not yet connected to live backend data. Coming soon.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <CredentialsEmailModal isOpen={isMailOpen} onClose={() => setIsMailOpen(false)} staffRecord={activeDispatchMail} />
    </div>
  );
}

const CredentialsEmailModal = ({ isOpen, onClose, staffRecord }) => {
  if (!isOpen || !staffRecord) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl w-full bg-[#0F1424] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
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
          <button onClick={onClose} className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
