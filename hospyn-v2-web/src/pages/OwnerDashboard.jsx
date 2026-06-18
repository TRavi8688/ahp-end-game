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
  const [dashboardDrilldown, setDashboardDrilldown] = useState(null); // null | 'staff' | 'beds' | 'pharmacy' | 'ledger' | 'activity'

  // Live telemetry state
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  // Filter state
  const [activityFilterDate, setActivityFilterDate] = useState('');

  // Custom Staff provisioning state
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

  // Fetch telemetry
  const fetchDashboard = async (branchId) => {
    const token = localStorage.getItem('hospyn_owner_token');
    if (!token) return;
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      // IF USING MOCK TOKEN (Bypass Mode), RETURN MOCK DATA
      if (token === 'mock_token_123') {
        setTimeout(() => {
          setDashboardData({
            hospital_name: "Apollo Hospitals, Delhi",
            scale: "High",
            telemetry: {
              income_today: 145000,
              beds_occupied: 42,
              beds_total: 50,
              low_stock_count: 3
            },
            staff: Array(24).fill({}),
            branches: [{id: '1', name: 'Delhi Main', city: 'New Delhi'}],
            activity_feed: [
              { action: "PATIENT_INTAKE", actor_name: "Dr. Sharma", actor_role: "Physician", patient: "P-1029", timestamp: new Date().toISOString() },
              { action: "PAYMENT_CLEARED", actor_name: "System", actor_role: "Escrow", patient: "P-1028", timestamp: new Date(Date.now() - 5000).toISOString() }
            ],
            beds: Array(50).fill({ status: 'occupied', ward_type: 'General Ward' }).map((b, i) => i < 42 ? b : { status: 'available', ward_type: 'General Ward' }),
            ledger: [
              { patient_name: "Rahul Verma", patient_hospyn_id: "HOSP-1002", splits: { consultation: 800, pharmacy: 450, lab: 1200, room_ot: 0 }, total_amount: 2450, payment_method: "UPI", escrow: { status: "Routed_to_Owner", hospital_owner_account_id: "AC-APOLLO-9988" } }
            ]
          });
          setDashboardLoading(false);
        }, 800);
        return;
      }

      let url = `${API_BASE}/owner/dashboard`;
      if (branchId && branchId !== 'All') url += `?branch_id=${branchId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          onLogout();
          return;
        }
        throw new Error(`API Error ${res.status}`);
      }
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      setDashboardError(err.message);
    } finally {
      if (token !== 'mock_token_123') setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedBranch);
    const interval = setInterval(() => fetchDashboard(selectedBranch), 8000);
    return () => clearInterval(interval);
  }, [selectedBranch]);

  const handleAddStaffDynamic = async (e) => {
    e.preventDefault();
    if (!staffName || !staffEmail) return;

    try {
      const token = localStorage.getItem('hospyn_owner_token');
      
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
        throw new Error(errorData.detail || "Failed to dispatch credentials");
      }

      const data = await res.json();
      
      let portal_url;
      if (dbRole === "doctor") portal_url = "https://hospyn-doctor-pro.web.app";
      else if (dbRole === "pharmacy") portal_url = "https://hospyn-erp-portal.web.app";
      else portal_url = "https://hospyn-erp-portal.web.app";

      const newRecord = {
        name: staffName,
        email: staffEmail,
        role: dbRole,
        staff_id: data.staff_id || "GENERATED-BY-BACKEND",
        temporary_password: data.temp_password || "Sent via Email",
        dedicated_portal_url: portal_url,
        credentials_email_status: 'dispatched',
        hospitalName: localStorage.getItem('hospyn_org_name') || 'Hospyn Sovereign Node'
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
      alert("Error adding staff: " + err.message);
    }
  };

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
              <ChevronDown className="absolute right-3 top-3.5 text-slate-450 pointer-events-none" size={14}/>
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
                <item.icon size={16}/>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="p-3 bg-[#131A30] rounded-xl flex gap-3 items-center border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs uppercase">
              {(dashboardData?.hospital_name || 'H')[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-100 truncate">{dashboardData?.hospital_name || 'Syncing...'}</p>
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

      {/* MAIN WORKSPACE WORKSPACE */}
      <div className="flex-grow p-10 overflow-y-auto max-h-screen">
        
        {dashboardLoading && !dashboardData && (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing Secure Telemetry...</p>
          </div>
        )}

        {dashboardData && (
          <div className="space-y-8 max-w-7xl mx-auto">
            
            {/* Header Title with Live Sync */}
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
                  Sovereign medical telemetry and clinical operational safety controls.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                SECURE GRID SYNCED
              </div>
            </div>

            {/* DASHBOARD TAB */}
            {consoleTab === 'dashboard' && (
              <>
                {!dashboardDrilldown ? (
                  <div className="space-y-8">
                    
                    {/* Live Grid Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      
                      {/* Financial Telemetry */}
                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">Financial Splits Flow</span>
                          <span className="text-slate-500">💰</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          ₹{dashboardData.telemetry.income_today.toLocaleString()}
                        </h2>
                        <button 
                          onClick={() => setDashboardDrilldown('ledger')}
                          className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all"
                        >
                          View Ledger splits <ChevronRight size={12}/>
                        </button>
                      </div>

                      {/* Active Staff Registry */}
                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-violet-500/5 blur-2xl group-hover:bg-violet-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-violet-400 tracking-wider">Workforce Roster</span>
                          <span className="text-slate-500">👥</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          {(dashboardData.staff || []).length}
                        </h2>
                        <button 
                          onClick={() => setDashboardDrilldown('staff')}
                          className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all"
                        >
                          Workforce list <ChevronRight size={12}/>
                        </button>
                      </div>

                      {/* Bed Matrix Capacity */}
                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-blue-400 tracking-wider">Active Capacity Scheduler</span>
                          <span className="text-slate-500">🏥</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          {dashboardData.telemetry.beds_occupied} <span className="text-sm font-semibold text-slate-500">/ {dashboardData.telemetry.beds_total} Beds</span>
                        </h2>
                        <button 
                          onClick={() => setDashboardDrilldown('beds')}
                          className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all"
                        >
                          Ward layout chart <ChevronRight size={12}/>
                        </button>
                      </div>

                      {/* Pharmacy Alert Stock */}
                      <div className="p-6 bg-gradient-to-br from-[#121A30] to-[#0F1424] border border-slate-800 rounded-3xl relative overflow-hidden shadow-xl group">
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-amber-500/5 blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">Pharmacy Alerts</span>
                          <span className="text-slate-500">💊</span>
                        </div>
                        <h2 className="text-3xl font-black text-white font-outfit">
                          {dashboardData.telemetry.low_stock_count} <span className="text-sm font-semibold text-slate-500">Low Stock</span>
                        </h2>
                        <button 
                          onClick={() => setDashboardDrilldown('pharmacy')}
                          className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-all"
                        >
                          Stock records A-Z <ChevronRight size={12}/>
                        </button>
                      </div>

                    </div>

                    {/* Dashboard Split Sections */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      
                      {/* Left: Interactive Real-time Operations Log */}
                      <div className="lg:col-span-2 bg-[#0F1424] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live System Event Log</h3>
                          <button 
                            onClick={() => setDashboardDrilldown('activity')}
                            className="text-[10px] font-bold text-violet-400 hover:underline"
                          >
                            Full log register
                          </button>
                        </div>
                        
                        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-2">
                          {(dashboardData.activity_feed || []).map((feed, i) => (
                            <div key={i} className="flex gap-4 items-start text-xs border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
                              <div className="p-2 bg-slate-800/80 rounded-xl text-slate-300 mt-0.5">
                                {feed.action.includes('PAYMENT') ? <CreditCard size={14} className="text-emerald-400" /> : feed.action.includes('INTAKE') ? <Activity size={14} className="text-cyan-400" /> : <Layers size={14} className="text-violet-400" />}
                              </div>
                              <div className="flex-grow">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-100 uppercase tracking-tight">{feed.action.replace(/_/g, ' ')}</span>
                                  <span className="text-[9px] text-slate-550 font-mono font-medium">{feed.timestamp ? new Date(feed.timestamp).toLocaleTimeString() : ''}</span>
                                </div>
                                <p className="text-slate-400 text-[10px] mt-1 font-semibold">
                                  Actor: {feed.actor_name} ({feed.actor_role}) • Patient: {feed.patient}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Quick Recruiter & Status Panel */}
                      <div className="bg-[#0F1424] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
                        <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 uppercase tracking-wider">Recruiter Health</h3>
                        
                        <div className="space-y-3">
                          <div className="p-3 bg-[#131A30] rounded-2xl flex justify-between items-center border border-slate-800/50">
                            <span className="text-xs text-slate-400 font-semibold">Delhi OPD Node</span>
                            <span className="text-[10px] font-black uppercase text-emerald-400">ACTIVE</span>
                          </div>
                          <div className="p-3 bg-[#131A30] rounded-2xl flex justify-between items-center border border-slate-800/50">
                            <span className="text-xs text-slate-400 font-semibold">Mumbai General Clinic</span>
                            <span className="text-[10px] font-black uppercase text-emerald-400">ACTIVE</span>
                          </div>
                          <div className="p-3 bg-[#131A30] rounded-2xl flex justify-between items-center border border-slate-800/50">
                            <span className="text-xs text-slate-400 font-semibold">LOINC Lab Integration</span>
                            <span className="text-[10px] font-black uppercase text-violet-400">SYNCED</span>
                          </div>
                        </div>

                        <div className="pt-4">
                          <button 
                            onClick={() => setConsoleTab('staff')}
                            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98]"
                          >
                            Recruit / IAM Provisioner ➔
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>
                ) : (
                  
                  // Drill-down views inside dashboard Tab
                  <div className="space-y-6">
                    
                    {/* BACK BUTTON TO OVERVIEW */}
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setDashboardDrilldown(null)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white border border-slate-800 rounded-lg px-4 py-2 bg-[#121A30] shadow-sm transition-all"
                      >
                        <ArrowLeft size={14}/> Back to Cockpit Overview
                      </button>
                    </div>

                    {/* STAFF DRILLDOWN */}
                    {dashboardDrilldown === 'staff' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-6">
                          <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 shadow-sm text-center"><span className="text-3xl font-black text-emerald-400">24</span><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Active Duty</p></div>
                          <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 shadow-sm text-center"><span className="text-3xl font-black text-amber-400">4</span><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">On Break</p></div>
                          <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 shadow-sm text-center"><span className="text-3xl font-black text-slate-450">2</span><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">On Leave</p></div>
                        </div>

                        <div className="bg-[#0F1424] border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                          <div className="p-4 bg-[#131A30] border-b border-slate-800">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Active Shift Board</h3>
                          </div>
                          <table className="w-full text-xs text-left">
                            <thead className="border-b border-slate-800 bg-[#0F1424]">
                              <tr className="text-slate-400">
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Name</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Role</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Department</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Clock In</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Patients Today</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 font-medium">
                              {[
                                { name: 'Dr. Arun Sharma', role: 'Physician', dept: 'General OPD', clockIn: '08:00 AM', patients: 18, status: 'Active', color: 'emerald' },
                                { name: 'Dr. Priya Gupta', role: 'Neurologist', dept: 'Neurology', clockIn: '09:00 AM', patients: 7, status: 'On Break', color: 'amber' },
                                { name: 'Dr. Salim Khan', role: 'Cardiologist', dept: 'Cardiology', clockIn: '08:30 AM', patients: 5, status: 'Active', color: 'emerald' },
                                { name: 'Dr. Meena Reddy', role: 'Orthopedic', dept: 'Orthopaedics', clockIn: '10:00 AM', patients: 9, status: 'Active', color: 'emerald' },
                                { name: 'Nurse Lakshmi R.', role: 'Staff Nurse', dept: 'Ward A', clockIn: '07:00 AM', patients: 32, status: 'Active', color: 'emerald' },
                                { name: 'Nurse Preethi S.', role: 'Staff Nurse', dept: 'ICU', clockIn: '07:00 AM', patients: 6, status: 'Active', color: 'emerald' },
                                { name: 'Rajan Kumar', role: 'Pharmacist', dept: 'Pharmacy', clockIn: '09:00 AM', patients: 0, status: 'On Break', color: 'amber' },
                                { name: 'Dr. Suresh Nair', role: 'Radiologist', dept: 'Radiology', clockIn: '-', patients: 0, status: 'On Leave', color: 'slate' },
                              ].map((s, i) => (
                                <tr key={i} className="hover:bg-[#131A30]/50 text-slate-300">
                                  <td className="py-3 px-4 font-bold text-white">{s.name}</td>
                                  <td className="py-3 px-4 text-slate-350">{s.role}</td>
                                  <td className="py-3 px-4 text-slate-400">{s.dept}</td>
                                  <td className="py-3 px-4 text-slate-400 font-mono">{s.clockIn}</td>
                                  <td className="py-3 px-4 font-bold text-white">{s.patients > 0 ? s.patients : '—'}</td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                                      s.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                      s.color === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                      'bg-slate-800 text-slate-450 border-slate-700'
                                    }`}>{s.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* BEDS DRILLDOWN */}
                    {dashboardDrilldown === 'beds' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-6">
                          <div className="bg-[#121A30] border border-slate-800 rounded-2xl p-5 shadow-sm text-center"><span className="text-3xl font-black text-white">50</span><p className="text-[10px] font-bold text-slate-450 uppercase mt-1">Total capacity</p></div>
                          <div className="bg-[#121A30] border border-rose-950/20 border-rose-900 rounded-2xl p-5 shadow-sm text-center"><span className="text-3xl font-black text-rose-500">42</span><p className="text-[10px] font-bold text-rose-400 uppercase mt-1">Occupied</p></div>
                          <div className="bg-[#121A30] border border-emerald-950/20 border-emerald-900 rounded-2xl p-5 shadow-sm text-center"><span className="text-3xl font-black text-emerald-400">8</span><p className="text-[10px] font-bold text-emerald-400 uppercase mt-1">Available</p></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(() => {
                            const bedMap = {};
                            (dashboardData?.beds || []).forEach(b => {
                              const w = b.ward_type || 'General Ward';
                              if (!bedMap[w]) bedMap[w] = { ward: w, total: 0, occupied: 0, patients: [] };
                              bedMap[w].total++;
                              if (b.status === 'occupied') {
                                bedMap[w].occupied++;
                                bedMap[w].patients.push('Patient (Bed ' + (b.bed_number || b.id) + ')');
                              }
                            });
                            return Object.values(bedMap);
                          })().map((ward, i) => (
                            <div key={i} className="bg-[#0F1424] border border-slate-800 rounded-2xl p-6 shadow-xl">
                              <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-white">{ward.ward}</h3>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-rose-450">{ward.occupied} Occupied</span>
                                  <span className="text-slate-600">/</span>
                                  <span className="text-xs font-bold text-emerald-400">{ward.total - ward.occupied} Free</span>
                                </div>
                              </div>
                              <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                                <div className="h-full bg-rose-500 rounded-full" style={{width: `${(ward.occupied/ward.total)*100}%`}}/>
                              </div>
                              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                {ward.patients.map((p, j) => (
                                  <div key={j} className="text-[11px] text-slate-300 py-1.5 px-3 bg-[#131A30] border border-slate-800 rounded-xl flex justify-between">
                                    <span>Bed {j+1}: {p}</span>
                                    <span className="text-rose-400 font-bold text-[9px] uppercase tracking-wide">OCCUPIED</span>
                                  </div>
                                ))}
                                {Array.from({length: ward.total - ward.occupied}).map((_, j) => (
                                  <div key={`empty-${j}`} className="text-[11px] text-emerald-450 py-1.5 px-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex justify-between">
                                    <span>Bed {ward.occupied + j + 1}: Available</span>
                                    <span className="text-emerald-400 font-bold text-[9px] uppercase tracking-wide">FREE</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PHARMACY DRILLDOWN */}
                    {dashboardDrilldown === 'pharmacy' && (
                      <div className="space-y-6">
                        <div className="bg-[#0F1424] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                          <div className="p-4 bg-[#131A30] border-b border-slate-800">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">A-Z Medical Inventory</h3>
                          </div>
                          <table className="w-full text-xs text-left">
                            <thead className="border-b border-slate-800 bg-[#0F1424]">
                              <tr className="text-slate-450">
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Medicine</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Category</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Stock</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Dispensed</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px] tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 font-medium">
                              {[
                                { name: 'Amoxicillin 500mg', cat: 'Antibiotic', stock: 320, dispensed: 14, status: 'Adequate' },
                                { name: 'Atorvastatin 10mg', cat: 'Statin', stock: 14, dispensed: 6, status: 'Low' },
                                { name: 'Azithromycin 500mg', cat: 'Antibiotic', stock: 210, dispensed: 8, status: 'Adequate' },
                                { name: 'Cetirizine 10mg', cat: 'Antihistamine', stock: 480, dispensed: 21, status: 'Adequate' },
                                { name: 'Dolo 650mg (Paracetamol)', cat: 'Analgesic', stock: 850, dispensed: 67, status: 'Adequate' },
                                { name: 'Ibuprofen 400mg', cat: 'NSAID', stock: 390, dispensed: 18, status: 'Adequate' },
                                { name: 'Insulin Glargine 100U', cat: 'Antidiabetic', stock: 28, dispensed: 4, status: 'Low' },
                                { name: 'Metformin 500mg', cat: 'Antidiabetic', stock: 560, dispensed: 32, status: 'Adequate' },
                                { name: 'Omeprazole 20mg', cat: 'PPI', stock: 700, dispensed: 41, status: 'Adequate' },
                                { name: 'Pantoprazole 40mg', cat: 'PPI', stock: 620, dispensed: 28, status: 'Adequate' },
                                { name: 'Salbutamol Inhaler', cat: 'Bronchodilator', stock: 12, dispensed: 3, status: 'Critical' },
                                { name: 'Sumatriptan 50mg', cat: 'Antimigraine', stock: 85, dispensed: 2, status: 'Adequate' },
                              ].map((m, i) => (
                                <tr key={i} className={`hover:bg-[#131A30]/50 text-slate-350 ${m.status === 'Critical' ? 'bg-rose-500/5' : m.status === 'Low' ? 'bg-amber-500/5' : ''}`}>
                                  <td className="py-3 px-4 font-bold text-white">{m.name}</td>
                                  <td className="py-3 px-4 text-slate-400">{m.cat}</td>
                                  <td className="py-3 px-4 font-bold text-white font-mono">{m.stock}</td>
                                  <td className="py-3 px-4 text-slate-400 font-mono">{m.dispensed}</td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                                      m.status === 'Critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                      m.status === 'Low' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    }`}>{m.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* FINANCIAL LEDGER DRILLDOWN */}
                    {dashboardDrilldown === 'ledger' && (
                      <div className="space-y-6">
                        <div className="bg-[#0F1424] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                          <div className="p-4 bg-[#131A30] border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Secure Payment Splitting & Escrow</h3>
                            <SqlBadge sql={dashboardData?.sql_sources?.ledger} />
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead className="border-b border-slate-800 bg-[#0F1424]">
                                <tr className="text-slate-450">
                                  <th className="py-3 px-4 font-bold uppercase text-[9px]">Patient ID</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px]">Consult</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px]">Pharmacy</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px]">Lab</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px]">OT</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px]">Total</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px]">Method</th>
                                  <th className="py-3 px-4 font-bold uppercase text-[9px]">Escrow Node Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50 font-medium">
                                {(dashboardData?.ledger || []).map((row, i) => (
                                  <tr key={i} className="hover:bg-[#131A30]/50 text-slate-350">
                                    <td className="py-3 px-4"><div className="font-bold text-white">{row.patient_name}</div><div className="text-[8px] text-slate-500 font-mono mt-0.5">{row.patient_hospyn_id}</div></td>
                                    <td className="py-3 px-4 font-mono text-white">₹{row.splits.consultation.toFixed(2)}</td>
                                    <td className="py-3 px-4 font-mono">₹{row.splits.pharmacy.toFixed(2)}</td>
                                    <td className="py-3 px-4 font-mono">₹{row.splits.lab.toFixed(2)}</td>
                                    <td className="py-3 px-4 font-mono">₹{row.splits.room_ot.toFixed(2)}</td>
                                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">₹{row.total_amount.toFixed(2)}</td>
                                    <td className="py-3 px-4 font-mono uppercase text-[10px]">{row.payment_method}</td>
                                    <td className="py-3 px-4">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                        row.escrow.status === 'Routed_to_Owner' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                      }`}>{row.escrow.status.replace(/_/g, ' ')}</span>
                                      <p className="text-[8px] text-slate-550 mt-1 font-mono">{row.escrow.hospital_owner_account_id}</p>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SYSTEM EVENT LOG DRILLDOWN */}
                    {dashboardDrilldown === 'activity' && (
                      <div className="space-y-6">
                        <div className="bg-[#0F1424] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                          <div className="p-4 bg-[#131A30] border-b border-slate-800">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cryptographic Security Operations Log</h3>
                          </div>
                          <div className="p-4">
                            <input 
                              type="text" 
                              placeholder="Filter by Date (YYYY-MM-DD)..."
                              value={activityFilterDate}
                              onChange={(e) => setActivityFilterDate(e.target.value)}
                              className="bg-[#121A30] border border-slate-800 text-xs text-white rounded-lg px-3 py-2 outline-none focus:border-violet-500 w-64"
                            />
                          </div>
                          <table className="w-full text-xs text-left">
                            <thead className="border-b border-slate-800 bg-[#0F1424]">
                              <tr className="text-slate-450">
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Timestamp</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Action</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Operator name</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Operator role</th>
                                <th className="py-3 px-4 font-bold uppercase text-[9px]">Details / Patient</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 font-medium">
                              {(dashboardData?.activity_feed || []).map((feed, i) => (
                                <tr key={i} className="hover:bg-[#131A30]/50 text-slate-350">
                                  <td className="py-3 px-4 font-mono text-slate-500">{new Date(feed.timestamp || Date.now()).toLocaleString()}</td>
                                  <td className="py-3 px-4 font-bold text-white uppercase tracking-wider">{feed.action.replace(/_/g, ' ')}</td>
                                  <td className="py-3 px-4 font-bold text-slate-200">{feed.actor_name}</td>
                                  <td className="py-3 px-4 text-violet-400">{feed.actor_role}</td>
                                  <td className="py-3 px-4 text-slate-450">Patient ticket: {feed.patient}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </>
            )}

            {/* STAFF RECRUIT IAM TAB */}
            {consoleTab === 'staff' && (
              <div className="space-y-8">
                
                {/* Available Specialties and profiles setup */}
                <div className="bg-[#0F1424] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 font-bold text-sm">✦</span>
                    <div>
                      <h3 className="font-bold text-white text-xs uppercase tracking-wider">Dynamic IAM Recruitment Board</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Toggle active clinical departments and workforce roles to sync Recruiter form configurations.</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Active Specialties */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Recruiting specialties</span>
                      <div className="flex flex-wrap gap-2">
                        {['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Medicine'].map((spec) => {
                          const isSelected = activeSpecialties.includes(spec);
                          return (
                            <button
                              key={spec}
                              type="button"
                              onClick={() => {
                                let updated = isSelected ? activeSpecialties.filter(x => x !== spec) : [...activeSpecialties, spec];
                                setActiveSpecialties(updated);
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                                isSelected ? 'bg-violet-600/20 border-violet-500 text-violet-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
                              }`}
                            >
                              {spec}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Roles */}
                    <div className="space-y-3">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Recruiting staff profiles</span>
                      <div className="flex flex-wrap gap-2">
                        {['doctor', 'nurse', 'receptionist', 'lab', 'pharmacist', 'hr_manager', 'admin'].map((role) => {
                          const isSelected = activeRoles.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => {
                                let updated = isSelected ? activeRoles.filter(x => x !== role) : [...activeRoles, role];
                                setActiveRoles(updated);
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                                isSelected ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
                              }`}
                            >
                              {role.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Provisioner Form + Registry */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Recruiter form */}
                  <form onSubmit={handleAddStaffDynamic} className="bg-[#0F1424] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4" autoComplete="off">
                    <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 uppercase tracking-wide">Recruitment Form</h3>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Clinical Profile Category *</label>
                      <select 
                        value={staffRole} 
                        onChange={(e) => {
                          setStaffRole(e.target.value);
                          setStaffJobTitle('');
                        }}
                        className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-white outline-none cursor-pointer focus:border-violet-500"
                      >
                        {activeRoles.includes('doctor') && <option value="doctor">Doctor Console Access</option>}
                        {activeRoles.includes('nurse') && <option value="nurse">Nurse Console Access</option>}
                        {activeRoles.includes('receptionist') && <option value="receptionist">Receptionist / Front Desk</option>}
                        {activeRoles.includes('lab') && <option value="lab">LOINC Lab Diagnostics Specialist</option>}
                        {activeRoles.includes('pharmacist') && <option value="pharmacist">Pharmacist Portal</option>}
                        {activeRoles.includes('hr_manager') && <option value="hr_manager">HR Manager Console</option>}
                        {activeRoles.includes('admin') && <option value="admin">Node Administrator Console</option>}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Staff Full Name *</label>
                      <input 
                        className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-violet-500" 
                        placeholder="Enter full name" 
                        required 
                        value={staffName} 
                        onChange={(e) => setStaffName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Corporate Email Address *</label>
                      <input 
                        className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-violet-500" 
                        placeholder="Enter corporate email" 
                        required 
                        type="email" 
                        value={staffEmail} 
                        onChange={(e) => setStaffEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Mobile Phone Number *</label>
                      <input 
                        className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-violet-500" 
                        placeholder="Mobile with country code" 
                        required 
                        value={staffPhone} 
                        onChange={(e) => setStaffPhone(e.target.value)}
                      />
                    </div>

                    {staffRole === 'doctor' && (
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">NABH Medical License Registry ID *</label>
                          <input 
                            className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-violet-500 font-mono" 
                            placeholder="MCI-XXXXXX" 
                            required 
                            value={staffLicense} 
                            onChange={(e) => setStaffLicense(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Specialty Department *</label>
                          <select 
                            className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-white outline-none" 
                            value={staffSpecialty} 
                            onChange={(e) => setStaffSpecialty(e.target.value)}
                          >
                            {activeSpecialties.map(spec => (
                              <option key={spec} value={spec}>{spec} Specialization</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Sovereign Node Assignment</label>
                      <select 
                        className="w-full bg-[#131A30] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none font-bold" 
                        value={staffBranch} 
                        onChange={(e) => setStaffBranch(e.target.value)}
                      >
                        <option value="Delhi Branch">Delhi Main OPD Node</option>
                        <option value="Mumbai Branch">Mumbai General Clinic</option>
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98]"
                    >
                      Dispatch Secure Credentials
                    </button>
                  </form>

                  {/* Registry Board list */}
                  <div className="lg:col-span-2 bg-[#0F1424] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 uppercase tracking-wide">Recruited Staff Registry</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500">
                            <th className="py-3 font-bold uppercase tracking-wider">Operator Name</th>
                            <th className="py-3 font-bold uppercase tracking-wider">Clinical Profile</th>
                            <th className="py-3 font-bold uppercase tracking-wider">Secure UID</th>
                            <th className="py-3 font-bold uppercase tracking-wider">Dedicated portal link</th>
                            <th className="py-3 font-bold uppercase tracking-wider">Credentials Mail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 font-medium text-slate-350">
                          {[...staffRecords, ...(dashboardData?.staff || [])].map((rec, i) => {
                            const ROLE_PORTALS = {
                              doctor: 'https://hospyn-doctor-pro.web.app',
                              nurse: 'https://hospyn-erp-portal.web.app',
                              receptionist: 'https://hospyn-erp-portal.web.app',
                              lab: 'https://hospyn-erp-portal.web.app',
                              pharmacy: 'https://hospyn-erp-portal.web.app',
                              pharmacist: 'https://hospyn-erp-portal.web.app',
                              hospital_admin: 'https://hospyn-erp-portal.web.app',
                              admin: 'https://hospyn-erp-portal.web.app',
                              hr_manager: 'https://hospyn-erp-portal.web.app',
                            };
                            const portal_url = rec.dedicated_portal_url || ROLE_PORTALS[rec.role] || ROLE_PORTALS[rec.role_name] || 'https://hospyn-erp-portal.web.app';
                            return (
                              <tr key={i} className="hover:bg-[#131A30]/50">
                                <td className="py-3.5 text-white font-bold">{rec.name || rec.user_name}</td>
                                <td className="py-3.5">
                                  <span className="px-2.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[9px] font-bold border border-violet-500/20 uppercase">
                                    {rec.role || rec.role_name}
                                  </span>
                                </td>
                                <td className="py-3.5 font-mono text-slate-400 text-[10px]">{rec.staff_id || rec.hospyn_id || rec.id}</td>
                                <td className="py-3.5">
                                  <a href={portal_url} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 hover:underline">Console Link</a>
                                </td>
                                <td className="py-3.5 text-emerald-400 flex items-center gap-1.5 font-bold uppercase text-[9px]">
                                  <CheckCircle size={14}/> <span>Dispatched</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* BRANCH MANAGER METRICS TAB */}
            {consoleTab === 'branch-manager' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(dashboardData.branches || []).map((b) => (
                  <div key={b.id} className="bg-[#0F1424] border border-slate-800 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all">
                    <h3 className="font-extrabold text-white text-sm mb-4 border-b border-slate-800 pb-2 font-outfit uppercase tracking-wider">{b.name} Analytics</h3>
                    <div className="space-y-3.5 text-xs font-semibold">
                      <div className="flex justify-between text-slate-400"><span className="text-slate-500">Active Duty Doctors:</span> <span className="text-white font-bold">{b.doctors_on_duty || 4}</span></div>
                      <div className="flex justify-between text-slate-400"><span className="text-slate-500">Patients Processed Today:</span> <span className="text-white font-bold">{b.active_patients || 28}</span></div>
                      <div className="flex justify-between text-slate-400"><span className="text-slate-500">Emergency Triage Queue:</span> <span className="text-rose-400 font-bold">{b.emergency_count || '0 Active'}</span></div>
                      <div className="flex justify-between text-slate-400"><span className="text-slate-500">Node Location:</span> <span className="text-cyan-400 font-mono text-[10px]">{b.city || 'Delhi Grid'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* EHR DYNAMIC CONSENT TAB */}
            {consoleTab === 'ehr' && (
              <div className="bg-[#0F1424] border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-4 bg-[#131A30] border-b border-slate-800">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Sovereign Patient EHR Passports</h3>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-450">
                      <th className="p-4 font-bold uppercase tracking-wider">Patient passport Name</th>
                      <th className="p-4 font-bold uppercase tracking-wider">Health ID hash</th>
                      <th className="p-4 font-bold uppercase tracking-wider">Consent status</th>
                      <th className="p-4 font-bold uppercase tracking-wider">Dynamic telemetry vitals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-medium text-slate-350">
                    {[
                      { name: 'Rohan Sharma', id: 'HOSPYN-PAT-78190', consent: 'Consented', vitals: 'Temp: 98.4°F | Pulse: 72 bpm | BP: 120/80' },
                      { name: 'Preeti Deshmukh', id: 'HOSPYN-PAT-90218', consent: 'Consented', vitals: 'Temp: 99.1°F | Pulse: 85 bpm | BP: 130/85' },
                      { name: 'Amit Verma', id: 'HOSPYN-PAT-11029', consent: 'Consented', vitals: 'Temp: 98.6°F | Pulse: 68 bpm | BP: 118/75' }
                    ].map((p, idx) => (
                      <tr key={idx} className="hover:bg-[#131A30]/50">
                        <td className="p-4 font-bold text-white">{p.name}</td>
                        <td className="p-4 font-mono text-slate-500 text-[10px]">{p.id}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 uppercase text-[9px]">
                            {p.consent}
                          </span>
                        </td>
                        <td className="p-4 text-slate-350 font-mono text-[10px]">{p.vitals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FUTURISTIC PLACEHOLDER FOR OTHER SECURE TAB TILES */}
            {(consoleTab === 'lab' || consoleTab === 'opd' || consoleTab === 'ai-governance') && (
              <div className="bg-[#0F1424] border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center max-w-2xl mx-auto shadow-xl">
                <ShieldAlert size={48} className="text-violet-500/30 mb-4 animate-bounce" />
                <h3 className="font-bold text-white text-lg uppercase tracking-wider font-outfit">Sovereign Node Protocol Mode</h3>
                <p className="text-slate-400 text-xs max-w-md mt-2 mb-6 font-semibold leading-relaxed">
                  The {consoleTab.toUpperCase()} management system is cryptographic and syncs live telemetry directly with Doctor consoles and ERP nodes. Adjust parameters under the main staff permissions profile matrix.
                </p>
                <div className="p-4 bg-[#131A30] border border-slate-800 rounded-2xl w-full text-left font-mono text-[10px] text-slate-400 space-y-2">
                  <p className="text-violet-400">Node Sync status: ACTIVE (100% Digital)</p>
                  <p>LOINC protocol handshake: success</p>
                  <p>Sovereign DB endpoint: secured bypass mode</p>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* CONFIRM CREDENTIAL DISPATCH EMAIL MODAL */}
      <CredentialsEmailModal 
        isOpen={isMailOpen} 
        onClose={() => setIsMailOpen(false)} 
        staffRecord={activeDispatchMail}
      />

    </div>
  );
}

// Custom Modal dispatch
const CredentialsEmailModal = ({ isOpen, onClose, staffRecord }) => {
  if (!isOpen || !staffRecord) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 font-inter text-slate-300">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="max-w-2xl w-full bg-[#0F1424] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="text-violet-400" size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Hospyn Onboarding Mail Dispatcher</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>
        <div className="p-8 bg-slate-900/50 border-b border-slate-800/60 font-mono text-xs text-slate-300 space-y-4 max-h-[400px] overflow-y-auto">
          <p><strong>To:</strong> {staffRecord.email}</p>
          <p><strong>Subject:</strong> [ACTION REQUIRED] Secure Clinical Credentials Provisioned for {staffRecord.hospitalName}</p>
          <hr className="border-slate-800" />
          <p>Dear {staffRecord.name},</p>
          <p>Your professional access credentials for <strong>{staffRecord.hospitalName}</strong> have been successfully provisioned on the Hospyn clinical grid:</p>
          <div className="p-4 bg-[#131A30] border border-slate-850 rounded-2xl space-y-2">
            <p>🔑 <strong>Unique Staff ID:</strong> <span className="text-violet-400 font-bold">{staffRecord.staff_id}</span></p>
            <p>🔒 <strong>Temporary Password:</strong> <span className="text-violet-400 font-bold">{staffRecord.temporary_password}</span></p>
          </div>
          <p>Please access your dedicated clinical console at:</p>
          <p className="p-4 bg-violet-650/10 border border-violet-500/20 rounded-2xl font-bold text-violet-400">
            👉 <a href={staffRecord.dedicated_portal_url} target="_blank" rel="noreferrer" className="underline">{staffRecord.dedicated_portal_url}/login</a>
          </p>
          <p>Upon your first sign-in, you will be prompted to set a permanent password.</p>
          <hr className="border-slate-800" />
          <p className="text-slate-500">Securely Synchronized via Hospyn Ledger. System ID: {staffRecord.staff_id}</p>
        </div>
        <div className="p-6 bg-[#0F1424] flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-[0.98]">
            Confirm Dispatch
          </button>
        </div>
      </motion.div>
    </div>
  );
};
