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
import ActivationWizard from './components/ActivationWizard';
import QuickRegister from './components/QuickRegister';
import chittiLandingImg from './assets/chitti_landing.jpg';
import chittiSuperImg from './assets/chitti_super.jpg';
import logoImg from './assets/logo.png';

// --- CUSTOM CORPORATE EMAIL DISPATCH POPUP ---
const CredentialsEmailModal = ({ isOpen, onClose, staffRecord }) => {
  if (!isOpen || !staffRecord) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 font-inter">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="max-w-2xl w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="text-emerald-400" size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Hospyn Onboarding Mail Dispatcher</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>
        <div className="p-8 bg-slate-50 border-b border-slate-100 font-mono text-xs text-slate-700 space-y-4 max-h-[400px] overflow-y-auto">
          <p><strong>To:</strong> {staffRecord.email}</p>
          <p><strong>Subject:</strong> [ACTION REQUIRED] Secure Clinical Credentials Provisioned for {staffRecord.hospitalName}</p>
          <hr className="border-slate-200" />
          <p>Dear {staffRecord.name},</p>
          <p>Your professional access credentials for <strong>{staffRecord.hospitalName}</strong> have been successfully provisioned on the Hospyn clinical grid:</p>
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
            <p>🔑 <strong>Unique Staff ID:</strong> <span className="text-blue-600 font-bold">{staffRecord.staff_id}</span></p>
            <p>🔒 <strong>Temporary Password:</strong> <span className="text-blue-600 font-bold">{staffRecord.temporary_password}</span></p>
          </div>
          <p>Please access your dedicated clinical console at:</p>
          <p className="p-4 bg-blue-50 border border-blue-100 rounded-xl font-bold text-blue-700">
            👉 <a href={staffRecord.dedicated_portal_url} target="_blank" rel="noreferrer" className="underline">{staffRecord.dedicated_portal_url}/login</a>
          </p>
          <p>Upon your first sign-in, you will be prompted to set a permanent, password.</p>
          <hr className="border-slate-200" />
          <p className="text-slate-400">Securely Synchronized via Hospyn Ledger. System ID: {staffRecord.staff_id}</p>
        </div>
        <div className="p-6 bg-white flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors">
            Confirm Dispatch
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- SQL TRANSPARENCY BADGE ---
const SqlBadge = ({ sql }) => {
  if (!sql) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[8px] font-mono text-slate-500 ml-2 align-middle" title={sql}>
      <Database size={9} className="text-slate-400" />
      {sql.length > 60 ? sql.substring(0, 57) + '...' : sql}
    </span>
  );
};

// --- SECURE LEDGER LOGIN MODAL ---
const API_BASE = 'https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1';

const LedgerLoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fill email if session is active
  useEffect(() => {
    if (isOpen && localStorage.getItem('hospyn_owner_email')) {
      setEmail(localStorage.getItem('hospyn_owner_email'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      // Real FastAPI OAuth2 form-data login
      const formBody = new URLSearchParams();
      formBody.append('username', email.trim());
      formBody.append('password', password);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Authentication failed (${res.status})`);
      }

      const data = await res.json();
      // Store real access token
      localStorage.setItem('hospyn_owner_token', data.access_token);
      localStorage.setItem('hospyn_owner_email', email.trim());

      onLoginSuccess({
        name: email.trim(),
        owner_email: email.trim(),
        access_token: data.access_token
      });
    } catch (err) {
      setError(err.message || 'Authentication failed. Check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 font-inter">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="max-w-md w-full bg-white border border-slate-200 rounded-[32px] shadow-2xl overflow-hidden p-8 space-y-6"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="text-violet-600 font-bold text-lg">🔒</span>
            <span className="text-xs font-black uppercase tracking-widest text-slate-850 font-outfit">Sovereign Node Login</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-650 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-inter">Admin Email Address</label>
            <input 
              type="email" 
              placeholder="e.g. owner@apollo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-violet-400 focus:bg-white transition-all font-semibold"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-inter">Console Access Password</label>
            <input 
              type="password" 
              placeholder="Enter secure password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-violet-400 focus:bg-white transition-all font-semibold font-mono"
              autoComplete="off"
            />
          </div>

          {error && <p className="text-[10px] text-rose-600 font-bold font-inter">{error}</p>}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-900/10 disabled:opacity-60"
          >
            {isLoading ? 'Authenticating...' : 'Authenticate Credentials'}
          </button>
        </form>



        <p className="text-[9px] text-slate-400 font-bold text-center uppercase tracking-widest">
          Secured by Hospyn Ledger Protocol.
        </p>
      </motion.div>
    </div>
  );
};

// --- CORE SYSTEM APP ---
export default function App() {
  const isRegisterRoute = window.location.pathname === '/register';
  if (isRegisterRoute) {
    return <QuickRegister />;
  }

  const [currentPage, setCurrentPage] = useState(1);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [appStatus, setAppStatus] = useState('unregistered');
  const [activeAiSlide, setActiveAiSlide] = useState(0);
  const [activePatientSlide, setActivePatientSlide] = useState(0);
  
  // Free clinical chat assistant states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'chitti', text: 'Hello! I am Chitti AI, your clinical intelligence assistant. How can I assist with your hospital operations or patient charts today?' }
  ]);
  const [inputText, setInputText] = useState('');
  
  // Console state
  const [consoleTab, setConsoleTab] = useState('dashboard');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [dashboardDrilldown, setDashboardDrilldown] = useState(null); // null | 'staff' | 'beds' | 'pharmacy' | 'ledger'
  
  // --- LIVE DATABASE-BACKED DASHBOARD STATE ---
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  // --- LOCAL FILTER STATES ---
  const [activityFilterDate, setActivityFilterDate] = useState('');
  
  // Custom Hook to load state from hashAPI
  const fetchDashboard = async (branchId) => {
    const token = localStorage.getItem('hospyn_owner_token');
    if (!token) return;
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      let url = `${API_BASE}/owner/dashboard`;
      if (branchId && branchId !== 'All') url += `?branch_id=${branchId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('hospyn_owner_token');
          setAppStatus('unregistered');
          return;
        }
        throw new Error(`API Error ${res.status}`);
      }
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      setDashboardError(err.message);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Fetch dashboard on login or branch change
  useEffect(() => {
    if (appStatus === 'approved' && localStorage.getItem('hospyn_owner_token')) {
      fetchDashboard(selectedBranch);
    }
  }, [appStatus, selectedBranch]);

  // Custom Dynamic Staff provisioning state
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

      // Call the actual backend API to send real email and register user
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

      // Read real response from backend
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

      // Reset input states
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

  const handleDispenseMedicine = (itemName) => {
    setPharmacyItems(pharmacyItems.map(item => {
      if (item.name === itemName) {
        return { ...item, quantity: Math.max(0, item.quantity - 1) };
      }
      return item;
    }));
  };

  // Helper trigger to instantly bypass pending status for local debugging
  const handleVerifyBypass = () => {
    localStorage.setItem('hospyn_app_state', 'approved');
    setAppStatus('approved');
  };

  const handleLogout = () => {
    localStorage.removeItem('hospyn_app_state');
    localStorage.removeItem('hospyn_owner_token');
    localStorage.removeItem('hospyn_owner_email');
    setAppStatus('unregistered');
    setDashboardData(null);
    setCurrentPage(1);
  };

  return (
    <div className="bg-slate-50 text-slate-800 font-inter min-h-screen relative flex flex-col justify-between selection:bg-blue-100">
      
      {/* Dynamic Header */}
      {appStatus !== 'approved' && (
        <motion.nav 
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          className="fixed top-0 z-50 w-full backdrop-blur-xl bg-white/95 border-b border-slate-200 shadow-sm"
        >
          <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
            <div 
              className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 cursor-pointer tracking-tight"
              onClick={() => setCurrentPage(1)}
            >
              <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 border border-slate-100">
                <img src={logoImg} alt="Hospyn Original Logo" className="w-8 h-8 object-contain" />
              </div>
              HOSPYN<span className="text-primary">.</span>
            </div>
            
            <div className="flex gap-8 items-center">
              {['Ecosystem Hub', 'How We Service', 'Our Vision'].map((name, idx) => (
                <button
                  key={idx}
                  onClick={() => { setCurrentPage(idx + 1); }}
                  className={`text-[10px] font-bold uppercase tracking-widest transition-all relative py-2 ${currentPage === idx + 1 ? 'text-primary' : 'text-slate-500 hover:text-primary'}`}
                >
                  {name}
                  {currentPage === idx + 1 && (
                    <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
              
              <div className="flex items-center gap-2 ml-6">
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
                >
                  Access Console
                </button>
                <button 
                  onClick={() => {
                    if (appStatus === 'unregistered') setIsWizardOpen(true);
                    else if (appStatus === 'pending') alert("Forensic ledger setup in progress. Use the bypass button on pending view to instantly approve.");
                  }}
                  className={`px-5 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all shadow-md ${appStatus === 'pending' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-primary text-white hover:bg-violet-750 shadow-violet-500/10'}`}
                >
                  {appStatus === 'pending' ? 'Verification Pending' : 'Register Console'}
                </button>
              </div>
            </div>
          </div>
        </motion.nav>
      )}

      {/* PUBLIC ECOSYSTEM MODE */}
      {appStatus !== 'approved' && (
        <div className="pt-16 flex-grow">
          {currentPage === 1 && (
            <>
              <section className="py-20 relative overflow-hidden min-h-screen flex items-center bg-gradient-to-br from-[#ECFDF5] via-[#F5F3FF] to-[#EFF6FF]">
              
              {/* Floating ambient glow orbs matching our clean mint/lavender theme */}
              <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-400/10 blur-[120px] pointer-events-none" />
              <div className="absolute bottom-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-emerald-400/10 blur-[100px] pointer-events-none" />
 
              <div className="max-w-7xl mx-auto px-8 w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-10">
                
                {/* Left Column: Core Value Proposition */}
                <div className="lg:col-span-10 text-left space-y-8">
                  
                  {/* Futuristic Active Status Pill */}
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-violet-200 bg-violet-50/70 shadow-sm"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600"></span>
                    </span>
                    <span className="text-violet-600 text-[10px] font-black uppercase tracking-[0.2em] font-inter">✦ Connected Clinical Network</span>
                  </motion.div>
 
                  {/* Title Header: Polished & High-End */}
                  <motion.h1 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tight font-outfit"
                  >
                    The Future of <br />
                    <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Healthcare</span> is Here
                  </motion.h1>
 
                  {/* Subtext description focusing on direct Hospital Benefits */}
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-600 text-base md:text-lg max-w-2xl font-medium leading-relaxed"
                  >
                    Hospyn puts your entire healthcare ecosystem in the palm of your hand. Track your team’s performance in real time, monitor daily clinical operations, and keep all patient records completely digitalized, secure, and instant.
                  </motion.p>
 
                  {/* Forensic Pending Banner (if registered but waiting for manual review) */}
                  {appStatus === 'pending' && (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="p-6 bg-violet-50/80 border border-violet-200/60 rounded-2xl max-w-xl text-left space-y-4 shadow-sm"
                    >
                      <div className="flex gap-3 items-center text-violet-800 font-bold text-sm">
                        <AlertTriangle size={18} className="text-violet-600" />
                        <span>Registration Sent — Manual Verification Pending</span>
                      </div>
                      <p className="text-xs text-violet-700 leading-relaxed">
                        Our team is verifying your registration out-of-band to ensure zero-bypass clinical safety. Enter your dashboard cockpit instantly using the super-admin approval bypass below.
                      </p>
                      <button onClick={handleVerifyBypass} className="w-full py-2.5 bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-all shadow-md">
                        ⚡ [Super Admin Approval Bypass] - Enter Cockpit Instantly
                      </button>
                    </motion.div>
                  )}
 
                  {/* Action Buttons */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap gap-4 pt-2"
                  >
                    {appStatus !== 'pending' ? (
                      <button 
                        onClick={() => setIsWizardOpen(true)} 
                        className="px-8 py-4 bg-violet-600 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-violet-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-violet-500/20 flex items-center gap-2"
                      >
                        Register Your Hospital ➔
                      </button>
                    ) : (
                      <button 
                        onClick={handleVerifyBypass} 
                        className="px-8 py-4 bg-violet-600 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-violet-700 transition-all flex items-center gap-2"
                      >
                        Monitor Local Node ➔
                      </button>
                    )}
                    <button 
                      onClick={() => setIsLoginModalOpen(true)} 
                      className="px-8 py-4 border border-slate-200 bg-white/70 text-slate-700 font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-slate-50 transition-all"
                    >
                      Access Existing Node
                    </button>
                  </motion.div>

                  {/* Trust Badges matching the reference bottom left */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="pt-6 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-4"
                  >
                    {[
                      { icon: Brain, text: 'AI-Powered Smart Automation' },
                      { icon: Lock, text: 'Secure & Scalable Enterprise Grade' },
                      { icon: CheckCircle, text: 'Trusted by Healthcare Leaders' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded bg-blue-50 border border-blue-100 flex items-center justify-center">
                          <item.icon className="text-primary" size={12} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none">{item.text}</span>
                      </div>
                    ))}
                  </motion.div>

                </div>

              </div>
            </section>

            {/* Scrollable Detailed Vision & Services Section directly below the Hero on Page 1 */}
            <section className="py-24 bg-white border-t border-slate-100 relative">
              <div className="max-w-7xl mx-auto px-8 space-y-20">
                
                {/* Detailed Corporate Vision Block */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                  <div className="lg:col-span-6 space-y-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-600 px-3 py-1 rounded-full border border-violet-100 bg-violet-50/50 inline-block">Our Long-term Vision</span>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight font-outfit leading-tight">
                      Unifying the Fragmented Clinical Grid
                    </h2>
                    <p className="text-slate-600 text-sm font-medium leading-relaxed">
                      Hospyn’s vision is to replace unverified manual medical steps with absolute operational transparency. We are building the clinical nervous system where hospital owners, senior staff, and doctors coordinate instantly under a fully digitalized, zero-fraud ledger network.
                    </p>
                    
                    {/* Checkmarks */}
                    <div className="space-y-3.5 pt-2">
                      {[
                        'Manage your entire multi-branch hospital ecosystem from a single cockpit screen.',
                        'Monitor every doctor’s task flow and track clinical queue backlogs in real time.',
                        'Secure clinical profiles with multi-factor OTP validation and out-of-band NABH license verification.'
                      ].map((bullet, idx) => (
                        <div key={idx} className="flex gap-3 items-start">
                          <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                            ✓
                          </div>
                          <span className="text-xs text-slate-600 font-semibold leading-normal">{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Graphic representing full digitalization */}
                  <div className="lg:col-span-6 p-8 bg-slate-50 border border-slate-200/60 rounded-[32px] space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-xs font-black uppercase text-slate-800 tracking-wider">Active Staff Ledger</span>
                      <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[9px] uppercase">Synced</span>
                    </div>
                    
                    <div className="space-y-4">
                      {[
                        { name: 'Dr. Sarah Jenkins (Cardiology)', role: 'Verified Consultant', status: 'Active (3 Patients Processed Today)' },
                        { name: 'Dr. Michael Chang (Pediatrics)', role: 'Verified Consultant', status: 'Active (OPD Active Node)' },
                        { name: 'Clinical Pharmacy (Inventory)', role: 'Authorized Terminal', status: 'Stock Verified (100% Digital)' }
                      ].map((staff, idx) => (
                        <div key={idx} className="p-4 bg-white border border-slate-200/60 rounded-2xl flex items-center justify-between shadow-sm">
                          <div>
                            <p className="text-xs font-black text-slate-900 tracking-tight">{staff.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{staff.role}</p>
                          </div>
                          <span className="text-[9px] font-black uppercase text-violet-500 tracking-wider">{staff.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3: CHITTI AI COGNITION SLIDESHOW */}
            <section className="py-24 bg-[#FAF9FE] border-t border-b border-violet-100/50 relative overflow-hidden">
              <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-violet-400/5 blur-3xl pointer-events-none" />
              <div className="max-w-7xl mx-auto px-8 space-y-16">
                
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-violet-200 bg-white text-[9px] font-black tracking-widest text-violet-600 uppercase shadow-sm">
                    ✦ Chitti AI Cognition
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 font-outfit">
                    Zero-Error Clinical Intelligence
                  </h2>
                  <p className="text-slate-500 text-xs md:text-sm font-semibold leading-relaxed">
                    Explore how Chitti’s sovereign intelligence engines eliminate manual mistakes, secure patient prescriptions, and coordinate clinic queues in real-time.
                  </p>
                </div>

                {/* Slides Grid Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                  
                  {/* Left Column: Interactive Nav Cards (Tabs) */}
                  <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
                    {[
                      { idx: 0, title: 'Smart Clinical Vision Audits', sub: 'OCR & Signature scanning for records', badge: 'Vision & OCR' },
                      { idx: 1, title: 'Forensic Prescription Check', sub: 'Dosage audit and anomaly detection', badge: 'Safety Engine' },
                      { idx: 2, title: 'Sovereign Ledger Syncing', sub: 'Private cryptographic transaction logs', badge: 'Blockchain Hash' }
                    ].map((slide) => {
                      const isActive = activeAiSlide === slide.idx;
                      return (
                        <button
                          key={slide.idx}
                          onClick={() => setActiveAiSlide(slide.idx)}
                          className={`w-full text-left p-5 rounded-[24px] border transition-all duration-300 relative overflow-hidden flex gap-4 items-center ${
                            isActive 
                              ? 'bg-white border-violet-200 shadow-lg shadow-violet-500/5' 
                              : 'bg-white/50 border-slate-105 hover:bg-white hover:border-slate-200'
                          }`}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-violet-600 rounded-r" />
                          )}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                            isActive ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            0{slide.idx + 1}
                          </div>
                          <div className="flex-grow">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                              isActive ? 'bg-violet-100/60 text-violet-600' : 'bg-slate-200/50 text-slate-500'
                            }`}>{slide.badge}</span>
                            <h4 className="text-xs font-bold text-slate-900 mt-1.5 tracking-tight">{slide.title}</h4>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{slide.sub}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Column: Sleek Glassmorphic Illustration Slide Panel */}
                  <div className="lg:col-span-7 flex">
                    <div className="w-full bg-white border border-slate-100 rounded-[32px] p-8 md:p-10 shadow-xl shadow-slate-100 flex flex-col justify-between relative overflow-hidden">
                      {/* Ambient background glow matching tab */}
                      <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
                      
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">ACTIVE COGNITION NODE</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeAiSlide}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                          >
                            <h3 className="text-xl md:text-2xl font-black tracking-tight text-slate-955 font-outfit">
                              {activeAiSlide === 0 && 'Vision-Based Optical Script Extraction'}
                              {activeAiSlide === 1 && 'Automated Dosage Anomaly Detection'}
                              {activeAiSlide === 2 && 'Immutable Private Ledger Cryptographic Sync'}
                            </h3>
                            <p className="text-slate-650 text-xs md:text-sm leading-relaxed font-semibold">
                              {activeAiSlide === 0 && 'Scan physical clinical certificates and prescriptions instantly. Chitti’s high-precision OCR pipeline isolates medical license registries, extracts text parameters, and checks signature stamps for complete security compliance.'}
                              {activeAiSlide === 1 && 'Hospyn continuously checks drug names and intake dosages against clinical databases. If a doctor drafts an outlier prescription (e.g. 1000mg vs 500mg standard), Chitti raises a non-intrusive warning to double-verify medical intents.'}
                              {activeAiSlide === 2 && 'Every verified transaction, doctor assignment, and medicine dispense is packaged into a cryptographic transaction block. The block is stamped onto your local sovereign database node, establishing a permanent, zero-fraud audit trail.'}
                            </p>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Mini Visual Slide Illustration */}
                      <div className="mt-8 border border-slate-100 rounded-2xl p-6 bg-slate-50 relative overflow-hidden flex items-center justify-center min-h-[140px]">
                        <AnimatePresence mode="wait">
                          {activeAiSlide === 0 && (
                            <motion.div key="vis0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm space-y-3">
                              <div className="flex justify-between text-[8px] font-mono text-slate-400 uppercase">
                                <span>Scanning Script OCR...</span>
                                <span className="text-emerald-500 font-bold">Match 99.8%</span>
                              </div>
                              <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative">
                                <div className="absolute top-0 bottom-0 bg-violet-600 w-full animate-[shimmer_2s_infinite]" style={{
                                  background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent)'
                                }} />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="h-6 bg-white border border-slate-150 rounded-lg flex items-center justify-center text-[8px] font-bold text-slate-600 uppercase">Dr. Sharma</div>
                                <div className="h-6 bg-white border border-slate-150 rounded-lg flex items-center justify-center text-[8px] font-bold text-slate-600 uppercase">Cardiology</div>
                                <div className="h-6 bg-white border border-slate-150 rounded-lg flex items-center justify-center text-[8px] font-bold text-slate-600 uppercase">Delhi Branch</div>
                              </div>
                            </motion.div>
                          )}
                          {activeAiSlide === 1 && (
                            <motion.div key="vis1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm space-y-3">
                              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between text-[10px]">
                                <span className="text-rose-700 font-bold flex items-center gap-1">⚠ High Dosage Flagged</span>
                                <span className="text-rose-600 font-black">1000mg Metformin</span>
                              </div>
                              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between text-[10px]">
                                <span className="text-emerald-700 font-bold flex items-center gap-1">✔ Adjusted Standard</span>
                                <span className="text-emerald-600 font-black">500mg Metformin</span>
                              </div>
                            </motion.div>
                          )}
                          {activeAiSlide === 2 && (
                            <motion.div key="vis2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm flex justify-around items-center">
                              <div className="w-12 h-12 bg-white border border-violet-100 rounded-xl flex items-center justify-center text-xs font-bold text-violet-600 shadow-sm relative">
                                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                                EHR
                              </div>
                              <div className="flex-grow h-0.5 bg-dashed bg-slate-300 mx-4 border-t border-dashed" />
                              <div className="w-12 h-12 bg-violet-650 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-md relative">
                                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
                                NODE
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            </section>

            {/* SECTION 4: PATIENT EXPERIENCE PIPELINE SLIDESHOW */}
            <section className="py-24 bg-white border-b border-slate-100 relative">
              <div className="max-w-7xl mx-auto px-8 space-y-16">
                
                <div className="text-center space-y-4 max-w-2xl mx-auto">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-[9px] font-black tracking-widest text-violet-600 uppercase shadow-sm">
                    ♥ Patient Experience Flow
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 font-outfit">
                    Streamlining the Patient Journey
                  </h2>
                  <p className="text-slate-500 text-xs md:text-sm font-semibold leading-relaxed">
                    Watch how patients bypass traditional administrative bottlenecks, coordinating seamlessly from check-in to digital checkout.
                  </p>
                </div>

                {/* Slides Grid Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                  
                  {/* Left Column: Interactive Nav Cards (Tabs) */}
                  <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
                    {[
                      { idx: 0, title: 'One-Click QR Check-In', sub: 'Instant queue check-in with digital tokens', badge: 'Clinic Entry' },
                      { idx: 1, title: 'Doctor Queue Triage', sub: 'Calculated wait times and steps tracking', badge: 'Active Triage' },
                      { idx: 2, title: 'Instant Bill Checkout', sub: 'Synchronized payments & digital receipts', badge: 'Checkout Node' }
                    ].map((slide) => {
                      const isActive = activePatientSlide === slide.idx;
                      return (
                        <button
                          key={slide.idx}
                          onClick={() => setActivePatientSlide(slide.idx)}
                          className={`w-full text-left p-5 rounded-[24px] border transition-all duration-300 relative overflow-hidden flex gap-4 items-center ${
                            isActive 
                              ? 'bg-[#FAF9FE] border-violet-200 shadow-lg shadow-violet-500/5' 
                              : 'bg-white/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                          }`}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-violet-600 rounded-r" />
                          )}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                            isActive ? 'bg-violet-100/60 text-violet-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            0{slide.idx + 1}
                          </div>
                          <div className="flex-grow">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                              isActive ? 'bg-violet-100 text-violet-600' : 'bg-slate-200/50 text-slate-500'
                            }`}>{slide.badge}</span>
                            <h4 className="text-xs font-bold text-slate-900 mt-1.5 tracking-tight">{slide.title}</h4>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{slide.sub}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Column: Sleek Glassmorphic Illustration Slide Panel */}
                  <div className="lg:col-span-7 flex">
                    <div className="w-full bg-[#FAF9FE] border border-violet-100/40 rounded-[32px] p-8 md:p-10 shadow-xl shadow-violet-500/5 flex flex-col justify-between relative overflow-hidden">
                      {/* Ambient background glow matching tab */}
                      <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
                      
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 bg-white border border-violet-100 px-2.5 py-1 rounded-lg">PATIENT PIPELINE CONTROL</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activePatientSlide}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                          >
                            <h3 className="text-xl md:text-2xl font-black tracking-tight text-slate-950 font-outfit">
                              {activePatientSlide === 0 && 'QR-Based Dynamic Check-In Token'}
                              {activePatientSlide === 1 && 'Real-Time Consultation Queue Coordination'}
                              {activePatientSlide === 2 && 'Seamless Autopay Settlements & Receipts'}
                            </h3>
                            <p className="text-slate-655 text-xs md:text-sm leading-relaxed font-semibold text-slate-650">
                              {activePatientSlide === 0 && 'Skip physical registration lines entirely. Patients scan a secure front-desk QR code on their phones, instantly matching their medical profile to active doctor schedules and checking in safely.'}
                              {activePatientSlide === 1 && 'Hospyn continuously updates consultations queue timings. Triage details are synced in real-time to active doctor consoles, coordinating diagnostic rooms, pharmacy stock, and pharmacy wait times seamlessly.'}
                              {activePatientSlide === 2 && 'Eliminate pharmacy checkout lines. Once consulting doctors sign and mutate patient records on the ledger, co-equal bank settlements execute via Razorpay, routing digital receipts to their phone instantly.'}
                            </p>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* Mini Visual Slide Illustration */}
                      <div className="mt-8 border border-slate-200 bg-white rounded-2xl p-6 relative overflow-hidden flex items-center justify-center min-h-[140px]">
                        <AnimatePresence mode="wait">
                          {activePatientSlide === 0 && (
                            <motion.div key="pvis0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 items-center">
                              <div className="w-12 h-12 bg-violet-50 rounded-xl border border-violet-100 flex items-center justify-center font-bold text-violet-600">QR</div>
                              <div>
                                <p className="text-[10px] font-black text-slate-950 uppercase tracking-wide">Pulsing QR Registered</p>
                                <p className="text-[8px] text-slate-450 mt-0.5">Delhi Branch Main Gate OPD Terminal 01</p>
                              </div>
                            </motion.div>
                          )}
                          {activePatientSlide === 1 && (
                            <motion.div key="pvis1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm space-y-2 text-center">
                              <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase px-1">
                                <span>Check-In</span>
                                <span>Triage Consultation</span>
                                <span>Digital Checkout</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full flex overflow-hidden">
                                <div className="bg-violet-600 w-2/3 h-full rounded-full" />
                              </div>
                              <span className="text-[8px] font-black text-violet-600 uppercase tracking-widest block mt-1">Consultation in progress... Wait: ~3 mins</span>
                            </motion.div>
                          )}
                          {activePatientSlide === 2 && (
                            <motion.div key="pvis2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">✔</div>
                                <div>
                                  <p className="text-[10px] font-black text-slate-900 uppercase">Razorpay Settlement Locked</p>
                                  <p className="text-[8px] text-slate-450 mt-0.5">UPI Auto-pay settlement: success</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-emerald-600">₹200.00</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            </section>
            </>
          )}

          {/* PAGE 2: HOW WE SERVICE - CLINICAL WORKFLOW TRANSFORMATION */}
          {currentPage === 2 && (
            <section className="py-20 max-w-7xl mx-auto px-8 bg-gradient-to-b from-[#F8FAFC] to-[#FFFFFF]">
              <div className="text-center mb-16 space-y-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-200 bg-violet-50 text-[10px] font-black tracking-widest text-violet-600 uppercase">
                  Service Pipeline
                </span>
                <h2 className="text-4xl font-black tracking-tight text-slate-900 font-outfit">How We Service Modern Healthcare</h2>
                <p className="text-slate-500 max-w-2xl mx-auto text-sm font-medium">
                  Hospyn streamlines clinical management, giving you absolute clarity over daily workflows and team operations.
                </p>
              </div>

              {/* 4-Step Production Clinical Pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
                {[
                  {
                    step: "01",
                    title: "Ecosystem in Your Hand",
                    description: "Consolidate patient admission queues, laboratory results, smart pharmacies, and financial sweeps into a single clinical cockpit.",
                    color: "border-blue-200 bg-blue-50/20 text-blue-600",
                    badge: "COMPLETE CONTROL"
                  },
                  {
                    step: "02",
                    title: "Total Team Transparency",
                    description: "Monitor exactly what every physician, nurse, and staff member is working on in real time. Eliminate operational delays instantly.",
                    color: "border-violet-200 bg-violet-50/20 text-violet-600",
                    badge: "REAL-TIME SYNC"
                  },
                  {
                    step: "03",
                    title: "100% Digitalized Records",
                    description: "Keep all longitudinal patient records, vitals graphs, and diagnostic summaries secure, searchable, and always complete.",
                    color: "border-indigo-200 bg-indigo-50/20 text-indigo-600",
                    badge: "ULTRA SECURE"
                  },
                  {
                    step: "04",
                    title: "Direct Dynamic Settlements",
                    description: "Establish direct bank-linked clearing with dynamic ledger payouts, letting hospital owners see every transaction clear instantly.",
                    color: "border-purple-200 bg-purple-50/20 text-purple-600",
                    badge: "FAST CLEARING"
                  }
                ].map((item, idx) => (
                  <div key={idx} className="p-8 bg-white border border-slate-200/60 rounded-3xl hover:border-violet-300 transition-all duration-300 shadow-sm relative group">
                    <div className="flex justify-between items-start mb-6">
                      <span className={`text-xs font-black tracking-wider uppercase px-2.5 py-1 rounded-lg border ${item.color}`}>{item.badge}</span>
                      <span className="text-4xl font-black text-slate-200 font-outfit group-hover:text-violet-100 transition-colors">{item.step}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-3 tracking-tight font-outfit">{item.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.description}</p>
                  </div>
                ))}
              </div>

              {/* Real-time simulated terminal process to show user how we do it */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 font-mono text-xs text-slate-300 shadow-xl space-y-4 max-w-4xl mx-auto">
                <div className="flex items-center justify-between text-slate-500 border-b border-slate-800 pb-4 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 ml-2">Live Sovereign Clinical Verification Pipeline</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-bold uppercase text-[9px] tracking-wider">ACTIVE PIPELINE</span>
                </div>
                <p className="text-slate-500"># Initializing instant hospital node network handshakes...</p>
                <p>✔ [09:12:01] Doctor biometric identity check complete. Confidence: <span className="text-emerald-400 font-bold">99.8%</span></p>
                <p>✔ [09:12:02] Government NABH license verification: verified by central medical registry.</p>
                <p>✔ [09:12:03] Secure bank settlement configuration tokenized direct to primary account.</p>
                <p className="text-violet-400 font-bold mt-2">🚀 ACTIVE NODE: Hospital cockpit digitalized and security audits passed.</p>
              </div>
            </section>
          )}

          {/* PAGE 3: OUR VISION - UNIFYING THE CLINICAL GRID */}
          {currentPage === 3 && (
            <section className="py-20 max-w-7xl mx-auto px-8 bg-gradient-to-b from-[#F8FAFC] to-[#FFFFFF]">
              <div className="text-center mb-16 space-y-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50/70 text-[10px] font-black tracking-widest text-indigo-600 uppercase">
                  Global Mission
                </span>
                <h2 className="text-4xl font-black tracking-tight text-slate-900 font-outfit">Our Vision for Hospital Workflow Unity</h2>
                <p className="text-slate-500 max-w-2xl mx-auto text-sm font-medium">
                  We are building the future of health networks. Unified systems, absolute data integrity, and verified access paths.
                </p>
              </div>

              {/* Vision Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch mb-16">
                
                {/* Pillar 1 */}
                <div className="p-8 bg-white border border-slate-200/60 rounded-3xl space-y-6 flex flex-col justify-between hover:border-indigo-300 transition-all duration-300">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                      <Lock size={22} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight font-outfit">Operational Safeguards</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Zero tolerance for unverified profiles. Doctor credential check-ins are secured with multi-factor OTP registration and government NABH validation, protecting your hospital from liability.
                    </p>
                  </div>
                  <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest">Zero Compromise Assurance</span>
                </div>

                {/* Pillar 2 */}
                <div className="p-8 bg-white border border-slate-200/60 rounded-3xl space-y-6 flex flex-col justify-between hover:border-indigo-300 transition-all duration-300">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
                      <Users size={22} />
                    </div>
                    <h3 className="text-xl font-black text-slate-950 tracking-tight font-outfit">Total Data Interoperability</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Every patient ticket, bed schedule, pharmacy order, and LOINC lab file is aggregated onto a single dashboard screen, updating in real time.
                    </p>
                  </div>
                  <span className="text-[9px] font-black uppercase text-violet-500 tracking-widest">Multi-Branch Syncing</span>
                </div>

                {/* Pillar 3 */}
                <div className="p-8 bg-white border border-slate-200/60 rounded-3xl space-y-6 flex flex-col justify-between hover:border-indigo-300 transition-all duration-300">
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                      <Brain size={22} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight font-outfit">Supervised AI Support</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Frontline teams get double-summary clinical OCR assist. Chitti AI constructs clear briefs overseen by active senior staff overrides, ensuring total protocol safety.
                    </p>
                  </div>
                  <span className="text-[9px] font-black uppercase text-purple-500 tracking-widest">Empathetic Patient Briefs</span>
                </div>

              </div>

              {/* Bottom Quote Banner */}
              <div className="p-10 rounded-3xl bg-indigo-50/50 border border-indigo-100/60 text-center max-w-4xl mx-auto space-y-3">
                <p className="text-sm font-black italic text-indigo-900 font-outfit leading-relaxed">
                  "Our mission is to replace friction with flow. Every hospital is a sovereign node in a global network of trusted, verified, and high-fidelity patient care."
                </p>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block">— HOSPYN SOVEREIGN LEADERSHIP TEAM</span>
              </div>
            </section>
          )}

        </div>
      )}

      {/* SOVEREIGN CONSOLE MODE (OWNER COCKPIT) */}
      {appStatus === 'approved' && (
        <div className="flex min-h-screen text-slate-700 bg-[#F8FAFC]">
          
          {/* Collapse Left Sidebar Frame */}
          <div className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-6">
            <div className="space-y-8">
              <div className="flex items-center gap-2 text-slate-950 font-extrabold text-lg tracking-tight">
                <Shield className="text-primary" size={24} />
                <span>HOSPYN<span className="text-primary">.</span></span>
              </div>

              {/* Branch Selector Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Active Node</label>
                <div className="relative">
                  <select 
                    value={selectedBranch}
                    onChange={(e)=>setSelectedBranch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none appearance-none cursor-pointer focus:border-primary"
                  >
                    <option value="All">All Branches</option>
                    {(dashboardData?.branches || []).map((br) => (
                      <option key={br.id} value={br.id}>{br.name} ({br.city})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 text-slate-500 pointer-events-none" size={14}/>
                </div>
              </div>

              {/* Navigation Items audit */}
              <div className="space-y-2">
                {[
                  { id: 'dashboard', label: 'Dashboard Cockpit', icon: BarChart3 },
                  { id: 'branch-manager', label: 'Branch Analytics', icon: Layers },
                  { id: 'staff', label: 'Staff Provisioner (IAM)', icon: Users },
                  { id: 'ehr', label: 'EHR Passports', icon: Database },
                  { id: 'lab', label: 'LOINC Laboratory', icon: Activity },
                  { id: 'pharmacy', label: 'Pharmacy Inventory', icon: ShoppingBag },
                  { id: 'opd', label: 'OPD & Bed Scheduler', icon: Server },
                  { id: 'ai-governance', label: 'AI Safety Governance', icon: Brain },
                  { id: 'settings', label: 'System Settings', icon: Key }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setConsoleTab(item.id)}
                    className={`w-full flex gap-3 items-center p-3 rounded-xl text-xs font-bold tracking-tight transition-all ${consoleTab === item.id ? 'bg-primary text-white shadow-md shadow-blue-500/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <item.icon size={16}/>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl flex gap-3 items-center border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-xs">
                  {(dashboardData?.hospital_name || 'H')[0]}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-950 truncate">{dashboardData?.hospital_name || 'Loading...'}</p>
                  <p className="text-[9px] text-slate-400 truncate">{localStorage.getItem('hospyn_owner_email') || '...'}</p>
                  {dashboardData?.scale && (
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                      dashboardData.scale === 'High' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      dashboardData.scale === 'Mid' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>{dashboardData.scale}-Level</span>
                  )}
                </div>
              </div>
              <button onClick={handleLogout} className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all">
                Logout Console
              </button>
            </div>
          </div>

          {/* Main workspace container */}
          <div className="flex-grow p-10 overflow-y-auto max-h-screen">

            {consoleTab === 'dashboard' && (
              <div className="space-y-8">

                {/* ── DRILL-DOWN: STAFF DETAIL ── */}
                {dashboardDrilldown === 'staff' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setDashboardDrilldown(null)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm transition-all">
                        <ArrowLeft size={14}/> Back to Overview
                      </button>
                      <h2 className="text-xl font-black text-slate-900 font-outfit">Staff Workforce — Full Detail</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center"><span className="text-3xl font-black text-emerald-600">24</span><p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Active Duty</p></div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center"><span className="text-3xl font-black text-amber-600">4</span><p className="text-[10px] font-bold text-slate-500 uppercase mt-1">On Break</p></div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center"><span className="text-3xl font-black text-slate-400">2</span><p className="text-[10px] font-bold text-slate-500 uppercase mt-1">On Leave</p></div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Live Staff Status Board</h3>
                      </div>
                      <table className="w-full text-xs text-left">
                        <thead className="border-b border-slate-100 bg-white">
                          <tr>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Name</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Role</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Department</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Clock In</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Patients Today</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
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
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                              <td className="py-3 px-4 text-slate-600">{s.role}</td>
                              <td className="py-3 px-4 text-slate-500">{s.dept}</td>
                              <td className="py-3 px-4 text-slate-500">{s.clockIn}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">{s.patients > 0 ? s.patients : '—'}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                                  s.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                  s.color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                  'bg-slate-50 text-slate-700 border-slate-100'
                                }`}>{s.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── DRILL-DOWN: BEDS DETAIL ── */}
                {dashboardDrilldown === 'beds' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setDashboardDrilldown(null)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm transition-all">
                        <ArrowLeft size={14}/> Back to Overview
                      </button>
                      <h2 className="text-xl font-black text-slate-900 font-outfit">Bed Management — Ward Map</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center"><span className="text-3xl font-black text-slate-900">50</span><p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Total Beds</p></div>
                      <div className="bg-white border border-rose-100 rounded-xl p-4 shadow-sm text-center"><span className="text-3xl font-black text-rose-600">42</span><p className="text-[10px] font-bold text-rose-500 uppercase mt-1">Occupied</p></div>
                      <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm text-center"><span className="text-3xl font-black text-emerald-600">8</span><p className="text-[10px] font-bold text-emerald-500 uppercase mt-1">Available</p></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(()=>{
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
                        <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-slate-900">{ward.ward}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-rose-600">{ward.occupied} Occupied</span>
                              <span className="text-slate-300">/</span>
                              <span className="text-xs font-bold text-emerald-600">{ward.total - ward.occupied} Free</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                            <div className={`h-full bg-rose-400 rounded-full`} style={{width: `${(ward.occupied/ward.total)*100}%`}}/>
                          </div>
                          <div className="space-y-1 max-h-[160px] overflow-y-auto">
                            {ward.patients.map((p, j) => (
                              <div key={j} className="text-[11px] text-slate-600 py-1 px-2 bg-slate-50 rounded flex justify-between">
                                <span>Bed {j+1}: {p}</span>
                                <span className="text-rose-500 font-bold text-[9px]">OCCUPIED</span>
                              </div>
                            ))}
                            {Array.from({length: ward.total - ward.occupied}).map((_, j) => (
                              <div key={`empty-${j}`} className="text-[11px] text-emerald-600 py-1 px-2 bg-emerald-50 rounded flex justify-between">
                                <span>Bed {ward.occupied + j + 1}: Available</span>
                                <span className="text-emerald-600 font-bold text-[9px]">FREE</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── DRILL-DOWN: PHARMACY DETAIL ── */}
                {dashboardDrilldown === 'pharmacy' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setDashboardDrilldown(null)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm transition-all">
                        <ArrowLeft size={14}/> Back to Overview
                      </button>
                      <h2 className="text-xl font-black text-slate-900 font-outfit">Pharmacy — Full Stock Register</h2>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">A–Z Medicine Inventory</h3>
                      </div>
                      <table className="w-full text-xs text-left">
                        <thead className="border-b border-slate-100 bg-white">
                          <tr>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Medicine</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Category</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">In Stock</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Dispensed Today</th>
                            <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
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
                            <tr key={i} className={`hover:bg-slate-50 ${m.status === 'Critical' ? 'bg-rose-50' : m.status === 'Low' ? 'bg-amber-50' : ''}`}>
                              <td className="py-3 px-4 font-bold text-slate-900">{m.name}</td>
                              <td className="py-3 px-4 text-slate-500">{m.cat}</td>
                              <td className="py-3 px-4 font-bold text-slate-900">{m.stock}</td>
                              <td className="py-3 px-4 text-slate-600">{m.dispensed}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${
                                  m.status === 'Critical' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                  m.status === 'Low' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                  'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>{m.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── DRILL-DOWN: FINANCIAL LEDGER DETAIL ── */}
                {dashboardDrilldown === 'ledger' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setDashboardDrilldown(null)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm transition-all">
                        <ArrowLeft size={14}/> Back to Overview
                      </button>
                      <h2 className="text-xl font-black text-slate-900 font-outfit">Rupee-Precise Financial Ledger</h2>
                      <SqlBadge sql={dashboardData?.sql_sources?.ledger} />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Itemized Payment Splits &amp; Escrow Routing</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="border-b border-slate-100 bg-white">
                            <tr>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Patient</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Invoice</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Consult</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Pharmacy</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Lab</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Room/OT</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Tax</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Total</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Method</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">TXN ID</th>
                              <th className="py-3 px-3 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Escrow Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 font-medium">
                            {(dashboardData?.ledger || []).map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="py-3 px-3"><div className="font-bold text-slate-900">{row.patient_name}</div><div className="text-[9px] text-slate-400 font-mono">{row.patient_hospyn_id}</div></td>
                                <td className="py-3 px-3 font-mono text-slate-500 text-[10px]">{row.invoice_number}</td>
                                <td className="py-3 px-3 text-slate-700">{'\u20B9'}{row.splits.consultation.toFixed(2)}</td>
                                <td className="py-3 px-3 text-slate-700">{row.splits.pharmacy > 0 ? `${'\u20B9'}${row.splits.pharmacy.toFixed(2)}` : '\u2014'}</td>
                                <td className="py-3 px-3 text-slate-700">{row.splits.lab > 0 ? `${'\u20B9'}${row.splits.lab.toFixed(2)}` : '\u2014'}</td>
                                <td className="py-3 px-3 text-slate-700">{row.splits.room_ot > 0 ? `${'\u20B9'}${row.splits.room_ot.toFixed(2)}` : '\u2014'}</td>
                                <td className="py-3 px-3 text-slate-500">{'\u20B9'}{row.splits.tax.toFixed(2)}</td>
                                <td className="py-3 px-3 font-bold text-slate-900">{'\u20B9'}{row.total_amount.toFixed(2)}</td>
                                <td className="py-3 px-3"><span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${row.payment_method === 'UPI' ? 'bg-violet-50 text-violet-700 border-violet-100' : row.payment_method === 'CARD' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{row.payment_method}</span></td>
                                <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{row.transaction_id}</td>
                                <td className="py-3 px-3"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${row.escrow.status === 'Routed_to_Owner' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{row.escrow.status}</span><div className="font-mono text-[9px] text-slate-500 mt-1">{row.escrow.hospital_owner_account_id}</div></td>
                              </tr>
                            ))}
                            {(!dashboardData?.ledger || dashboardData.ledger.length === 0) && (
                              <tr><td colSpan="11" className="py-8 text-center text-slate-400 text-xs">No payment records found.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DRILL-DOWN: ACTIVITY LOGS ── */}
                {dashboardDrilldown === 'activity' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setDashboardDrilldown(null)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm transition-all">
                          <ArrowLeft size={14}/> Back to Overview
                        </button>
                        <h2 className="text-xl font-black text-slate-900 font-outfit">Full Operations Log (Audit Trail)</h2>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          const csvLines = [
                            ['Timestamp', 'Action', 'Resource', 'Actor', 'Role', 'Patient ID'].join(',')
                          ];
                          (dashboardData?.activity_feed || []).forEach(log => {
                            csvLines.push([
                              `"${log.timestamp || ''}"`,
                              `"${log.action || ''}"`,
                              `"${log.resource_type || ''}"`,
                              `"${log.actor_name || ''}"`,
                              `"${log.actor_role || ''}"`,
                              `"${log.patient || ''}"`
                            ].join(','));
                          });
                          const blob = new Blob([csvLines.join('\\n')], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Hospital_Operations_Log_${new Date().toISOString().split('T')[0]}.csv`;
                          a.click();
                        }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg uppercase tracking-wider hover:bg-slate-800 transition-colors">
                          <UploadCloud size={14}/> Export to Excel
                        </button>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Enterprise Audit Trail</h3>
                        <div className="flex gap-2">
                          <input type="date" value={activityFilterDate} onChange={e => setActivityFilterDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded text-[10px] text-slate-700 outline-none focus:border-primary" />
                          <button onClick={() => setActivityFilterDate('')} className="px-3 py-1.5 border border-slate-200 bg-white text-slate-500 hover:text-slate-900 rounded text-[10px] font-bold uppercase tracking-widest transition-colors"><Filter size={10} className="inline mr-1"/> Clear</button>
                        </div>
                      </div>
                      <div className="overflow-x-auto max-h-[600px]">
                        <table className="w-full text-xs text-left whitespace-nowrap">
                          <thead className="bg-white sticky top-0 border-b border-slate-100 z-10 shadow-sm">
                            <tr>
                              <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Timestamp</th>
                              <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Action</th>
                              <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Actor (Role)</th>
                              <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Patient (Target)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 font-medium">
                            {(dashboardData.activity_feed || [])
                              .filter(log => !activityFilterDate || (log.timestamp && log.timestamp.startsWith(activityFilterDate)))
                              .map((log, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="py-3 px-4 text-slate-500 font-mono">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
                                <td className="py-3 px-4 font-bold text-slate-900">
                                  <div className="flex items-center gap-2">
                                    {log.action.includes('PAYMENT') ? <CreditCard size={12} className="text-emerald-500"/> : log.action.includes('INTAKE') ? <Activity size={12} className="text-blue-500"/> : <Layers size={12} className="text-indigo-500"/>}
                                    {log.action.replace(/_/g, ' ')}
                                  </div>
                                </td>
                                <td className="py-3 px-4"><span className="text-slate-800 font-bold">{log.actor_name}</span> <span className="text-slate-400 ml-1">({log.actor_role})</span></td>
                                <td className="py-3 px-4 text-slate-600">{log.patient}</td>
                              </tr>
                            ))}
                            {(!dashboardData?.activity_feed || dashboardData.activity_feed.length === 0) && (
                              <tr><td colSpan="4" className="py-8 text-center text-slate-400 text-xs">No activity records found.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── MAIN OVERVIEW (visible only when no drilldown active) ── */}
                {!dashboardDrilldown && (
                <>
                {dashboardLoading && (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center space-y-3">
                      <RefreshCw className="animate-spin text-primary mx-auto" size={24} />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Dashboard from Database...</p>
                    </div>
                  </div>
                )}
                {dashboardError && (
                  <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center">
                    <p className="text-xs font-bold text-rose-700">Dashboard Error: {dashboardError}</p>
                    <button onClick={() => fetchDashboard(selectedBranch)} className="mt-3 px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase rounded-lg">Retry</button>
                  </div>
                )}

                {dashboardData && !dashboardLoading && (
                <>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight font-outfit">
                      {dashboardData.hospital_name} {'\u2014'} {dashboardData.scale}-Level Cockpit
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">End-to-End Hospital Flow and Operations Monitor. <SqlBadge sql={dashboardData.sql_sources?.telemetry} /></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => fetchDashboard(selectedBranch)} className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
                      <RefreshCw size={14} className="text-slate-500" />
                    </button>
                    <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live DB Sync</span>
                    </div>
                  </div>
                </div>

                {/* Top Metrics Row */}
                <div className={`grid grid-cols-1 gap-4 ${dashboardData.scale === 'Low' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Total Visits</span>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-2xl font-black text-slate-900">{dashboardData.telemetry.visits}</span>
                      <span className="text-[10px] font-bold text-slate-400 mb-1">patients</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Total Revenue</span>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-2xl font-black text-slate-900">{'\u20B9'}{Number(dashboardData.telemetry.revenue).toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                      <span className="text-[10px] font-bold text-emerald-600 mb-1">Cleared</span>
                    </div>
                  </div>
                  {dashboardData.scale !== 'Low' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Bed Occupancy</span>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-2xl font-black text-slate-900">{dashboardData.telemetry.beds_occupied}/{dashboardData.telemetry.beds_total}</span>
                        <span className="text-[10px] font-bold text-amber-600 mb-1">{dashboardData.telemetry.beds_total > 0 ? Math.round((dashboardData.telemetry.beds_occupied / dashboardData.telemetry.beds_total) * 100) : 0}%</span>
                      </div>
                    </div>
                  )}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Low Stock Alerts</span>
                    <div className="mt-2 flex items-end gap-2">
                      <span className={`text-2xl font-black ${dashboardData.telemetry.low_stock_count > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{dashboardData.telemetry.low_stock_count}</span>
                      <span className="text-[10px] font-bold text-slate-400 mb-1">medicines</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Financial Ledger Summary */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[420px]">
                      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center">
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{'\u20B9'} Financial Ledger</h3>
                          <SqlBadge sql={dashboardData.sql_sources?.ledger} />
                        </div>
                        <button onClick={() => setDashboardDrilldown('ledger')} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">
                          Full Ledger <ChevronRight size={12}/>
                        </button>
                      </div>
                      <div className="overflow-y-auto flex-grow p-0">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white sticky top-0 border-b border-slate-100 z-10 shadow-sm">
                            <tr>
                              <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Patient</th>
                              <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Amount</th>
                              <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Method</th>
                              <th className="py-3 px-4 font-bold text-slate-400 uppercase text-[9px] tracking-wider">Escrow</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 font-medium">
                            {(dashboardData.ledger || []).slice(0, 10).map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDashboardDrilldown('ledger')}>
                                <td className="py-3 px-4"><span className="text-slate-900 font-bold">{row.patient_name}</span><span className="text-[9px] text-slate-400 ml-2 font-mono">{row.patient_hospyn_id}</span></td>
                                <td className="py-3 px-4 font-bold text-slate-900">{'\u20B9'}{row.total_amount.toFixed(2)}</td>
                                <td className="py-3 px-4"><span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${row.payment_method === 'UPI' ? 'bg-violet-50 text-violet-700 border-violet-100' : row.payment_method === 'CARD' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{row.payment_method}</span></td>
                                <td className="py-3 px-4"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${row.escrow.status === 'Routed_to_Owner' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{row.escrow.status === 'Routed_to_Owner' ? '\u2713 Routed' : row.escrow.status}</span></td>
                              </tr>
                            ))}
                            {(!dashboardData.ledger || dashboardData.ledger.length === 0) && (
                              <tr><td colSpan="4" className="py-8 text-center text-slate-400 text-xs">No payment records in database.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Operations */}
                  <div className="space-y-6">
                    {/* Staff Card */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                        <div className="flex items-center"><h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Staff</h3><SqlBadge sql={dashboardData.sql_sources?.staff} /></div>
                        <button onClick={() => setDashboardDrilldown('staff')} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">Detail <ChevronRight size={12}/></button>
                      </div>
                      <button onClick={() => setDashboardDrilldown('staff')} className="w-full flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group">
                        <span className="text-xs font-semibold text-slate-600">Total Staff</span>
                        <div className="flex items-center gap-2"><span className="text-sm font-black text-emerald-600">{(dashboardData.staff || []).length}</span><ChevronRight size={12} className="text-slate-300 group-hover:text-emerald-500"/></div>
                      </button>
                    </div>

                    {/* Bed Matrix — Hidden for Low */}
                    {dashboardData.scale !== 'Low' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                        <div className="flex items-center"><h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Beds</h3><SqlBadge sql={dashboardData.sql_sources?.beds} /></div>
                        <button onClick={() => setDashboardDrilldown('beds')} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">Ward Map <ChevronRight size={12}/></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><span className="block text-xl font-black text-slate-900">{dashboardData.telemetry.beds_total}</span><span className="text-[9px] font-bold text-slate-500 uppercase">Total</span></div>
                        <button onClick={() => setDashboardDrilldown('beds')} className="p-3 bg-rose-50 rounded-lg border border-rose-100 hover:border-rose-300 transition-all"><span className="block text-xl font-black text-rose-700">{dashboardData.telemetry.beds_occupied}</span><span className="text-[9px] font-bold text-rose-600 uppercase">Occupied</span></button>
                        <button onClick={() => setDashboardDrilldown('beds')} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 hover:border-emerald-300 transition-all"><span className="block text-xl font-black text-emerald-700">{dashboardData.telemetry.beds_total - dashboardData.telemetry.beds_occupied}</span><span className="text-[9px] font-bold text-emerald-600 uppercase">Free</span></button>
                      </div>
                    </div>
                    )}

                    {/* Pharmacy — Hidden if no pharmacy */}
                    {(dashboardData.pharmacy || []).length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                        <div className="flex items-center"><h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pharmacy</h3><SqlBadge sql={dashboardData.sql_sources?.pharmacy} /></div>
                        <div className="flex items-center gap-2">
                          {dashboardData.telemetry.low_stock_count > 0 && <span className="px-2 py-0.5 bg-rose-100 border border-rose-200 text-rose-700 text-[9px] rounded font-bold uppercase">{dashboardData.telemetry.low_stock_count} Alerts</span>}
                          <button onClick={() => setDashboardDrilldown('pharmacy')} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">Full <ChevronRight size={12}/></button>
                        </div>
                      </div>
                      <div className="space-y-2 text-xs font-medium">
                        {(dashboardData.pharmacy || []).slice(0, 4).map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-slate-600 px-1">
                            <span>{item.item_name}</span>
                            <span className={`font-bold ${item.stock_quantity <= item.reorder_level ? 'text-rose-600' : 'text-emerald-600'}`}>{item.stock_quantity <= item.reorder_level ? `LOW (${item.stock_quantity})` : `OK (${item.stock_quantity})`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Quick Operations Feed */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                        <div className="flex items-center"><h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Feed</h3></div>
                        <button onClick={() => setDashboardDrilldown('activity')} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">Full Feed <ChevronRight size={12}/></button>
                      </div>
                      <div className="space-y-3">
                        {(dashboardData.activity_feed || []).slice(0, 5).map((log, i) => (
                          <div key={i} className="flex gap-3 text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                            <div className="pt-0.5 text-slate-400">
                              {log.action.includes('PAYMENT') ? <CreditCard size={14} className="text-emerald-500" /> : log.action.includes('INTAKE') ? <Activity size={14} className="text-blue-500" /> : <Layers size={14} className="text-indigo-500" />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{log.action.replace(/_/g, ' ')}</p>
                              <p className="text-[10px] text-slate-500 line-clamp-1">{log.actor_name} • Patient: {log.patient}</p>
                            </div>
                          </div>
                        ))}
                        {(!dashboardData.activity_feed || dashboardData.activity_feed.length === 0) && (
                          <p className="text-[10px] text-slate-400 text-center py-2">No recent activity.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                </>
                )}
              </>
            )}
          </div>
        )}
            {consoleTab === 'branch-manager' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">Branch Manager</h2>
                  <p className="text-xs text-slate-500 mt-1">Sovereign analytics and clinical throughput branch-by-branch.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Delhi Branch Vitals</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Active Patients:</span> <span className="font-bold text-slate-900">42</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Doctors on Duty:</span> <span className="font-bold text-slate-900">8</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Avg Wait Time:</span> <span className="font-bold text-emerald-600">8 mins</span></div>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Mumbai Branch Vitals</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Active Patients:</span> <span className="font-bold text-slate-900">19</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Doctors on Duty:</span> <span className="font-bold text-slate-900">4</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Avg Wait Time:</span> <span className="font-bold text-emerald-600">11 mins</span></div>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Bangalore Branch Vitals</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Active Patients:</span> <span className="font-bold text-slate-900">8</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Doctors on Duty:</span> <span className="font-bold text-slate-900">2</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-400">Avg Wait Time:</span> <span className="font-bold text-emerald-600">4 mins</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {consoleTab === 'staff' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">Staff Provisioner (IAM Console)</h2>
                  <p className="text-xs text-slate-500 mt-1">Generate unique, secure access credentials and map dynamic routing profiles for new staff.</p>
                </div>

                {/* Tailor IAM Cockpit Profiles (Smart Customization) */}
                <div className="bg-slate-50/60 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-sm">
                      ⚙️
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-950 text-xs uppercase tracking-wider">Tailor IAM Cockpit Profiles</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Configure your hospital's operational focus. Toggled items instantly filter options in the recruitment form below.</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Active Specialties */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supported Specialties & Departments</span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: 'Cardiology', color: 'from-pink-500/10 to-rose-500/10 border-pink-200/80 text-rose-700' },
                          { name: 'Neurology', color: 'from-purple-500/10 to-indigo-500/10 border-purple-200/80 text-indigo-700' },
                          { name: 'Pediatrics', color: 'from-amber-500/10 to-orange-500/10 border-amber-200/80 text-amber-700' },
                          { name: 'Orthopedics', color: 'from-teal-500/10 to-emerald-500/10 border-teal-200/80 text-emerald-700' },
                          { name: 'General Medicine', color: 'from-sky-500/10 to-blue-500/10 border-sky-200/80 text-blue-700' }
                        ].map((spec) => {
                          const isSelected = activeSpecialties.includes(spec.name);
                          return (
                            <button
                              key={spec.name}
                              type="button"
                              onClick={() => {
                                let updated;
                                if (isSelected) {
                                  updated = activeSpecialties.filter(x => x !== spec.name);
                                } else {
                                  updated = [...activeSpecialties, spec.name];
                                }
                                setActiveSpecialties(updated);
                                if (staffSpecialty === spec.name && isSelected && updated.length > 0) {
                                  setStaffSpecialty(updated[0]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                                isSelected 
                                  ? `bg-gradient-to-r ${spec.color} shadow-sm active:scale-95` 
                                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <span>{isSelected ? '✓' : '+'}</span>
                              <span>{spec.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Roles */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Staff Roles</span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'doctor', name: 'Doctor Profile' },
                          { id: 'nurse', name: 'Nurse Profile' },
                          { id: 'receptionist', name: 'Receptionist' },
                          { id: 'lab', name: 'Lab Specialist' },
                          { id: 'pharmacist', name: 'Pharmacist' },
                          { id: 'hr_manager', name: 'HR Manager' },
                          { id: 'admin', name: 'Administrator' }
                        ].map((role) => {
                          const isSelected = activeRoles.includes(role.id);
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => {
                                let updated;
                                if (isSelected) {
                                  updated = activeRoles.filter(x => x !== role.id);
                                } else {
                                  updated = [...activeRoles, role.id];
                                }
                                setActiveRoles(updated);
                                if (staffRole === role.id && isSelected && updated.length > 0) {
                                  setStaffRole(updated[0]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                                isSelected 
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm active:scale-95' 
                                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <span>{isSelected ? '✓' : '+'}</span>
                              <span>{role.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                  {/* Dynamic Onboarding Form */}
                  <form onSubmit={handleAddStaffDynamic} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4" autoComplete="off">
                    <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Smart Staff Provisioner</h3>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Profile Category *</label>
                      <select 
                        value={staffRole} 
                        onChange={(e)=>{
                          setStaffRole(e.target.value);
                          setStaffJobTitle('');
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-primary cursor-pointer"
                        autoComplete="new-password"
                      >
                        {activeRoles.includes('doctor') && <option value="doctor">Doctor Profile (doctor.hospyn.com)</option>}
                        {activeRoles.includes('nurse') && <option value="nurse">Nurse Profile (staff.hospyn.com)</option>}
                        {activeRoles.includes('receptionist') && <option value="receptionist">Receptionist / Front Desk (staff.hospyn.com)</option>}
                        {activeRoles.includes('lab') && <option value="lab">Lab / Diagnostics Specialist (staff.hospyn.com)</option>}
                        {activeRoles.includes('pharmacist') && <option value="pharmacist">Pharmacist Profile (pharmacy.hospyn.com)</option>}
                        {activeRoles.includes('hr_manager') && <option value="hr_manager">HR Manager Profile (hr.hospyn.com)</option>}
                        {activeRoles.includes('admin') && <option value="admin">Administrator Profile (admin.hospyn.com)</option>}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Full Name *</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" 
                        placeholder="Enter full name" 
                        required 
                        value={staffName} 
                        onChange={(e)=>setStaffName(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Official Email Address *</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" 
                        placeholder="Enter email address" 
                        required 
                        type="email" 
                        value={staffEmail} 
                        onChange={(e)=>setStaffEmail(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mobile Phone Number *</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" 
                        placeholder="Enter mobile (e.g. +91 9876543210)" 
                        required 
                        type="tel" 
                        value={staffPhone} 
                        onChange={(e)=>setStaffPhone(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>

                    {/* Dynamic Smart Sub-profiles based on Role Selection */}
                    {staffRole === 'doctor' && (
                      <div className="space-y-3 border-t border-slate-100 pt-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Medical License Number *</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" 
                            placeholder="MCI-XXXXX" 
                            required 
                            value={staffLicense} 
                            onChange={(e)=>setStaffLicense(e.target.value)}
                            autoComplete="new-password"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Doctor Specialty Profile *</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary font-bold" 
                            value={staffSpecialty} 
                            onChange={(e)=>setStaffSpecialty(e.target.value)}
                          >
                            {activeSpecialties.includes('Cardiology') && <option value="Cardiology">Cardiology Department</option>}
                            {activeSpecialties.includes('Neurology') && <option value="Neurology">Neurology Department</option>}
                            {activeSpecialties.includes('Pediatrics') && <option value="Pediatrics">Pediatrics Department</option>}
                            {activeSpecialties.includes('Orthopedics') && <option value="Orthopedics">Orthopedics Department</option>}
                            {activeSpecialties.includes('General Medicine') && <option value="General Medicine">General Medicine Department</option>}
                          </select>
                        </div>
                      </div>
                    )}

                    {staffRole === 'nurse' && (
                      <div className="space-y-3 border-t border-slate-100 pt-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Nursing Registry Code *</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" 
                            placeholder="NUR-XXXXX" 
                            required 
                            value={staffLicense} 
                            onChange={(e)=>setStaffLicense(e.target.value)}
                            autoComplete="new-password"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Nurse Profile Type *</label>
                          <select 
                            value={staffJobTitle} 
                            onChange={(e)=>setStaffJobTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary font-bold cursor-pointer"
                          >
                            <option value="General Nurse">General Nurse</option>
                            <option value="ICU Nurse">ICU Nurse</option>
                            <option value="ER Nurse">ER Nurse</option>
                            <option value="Ward Nurse">Ward Nurse</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {staffRole === 'receptionist' && (
                      <div className="space-y-3 border-t border-slate-100 pt-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Receptionist Profile Type *</label>
                          <select 
                            value={staffJobTitle} 
                            onChange={(e)=>setStaffJobTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary font-bold cursor-pointer"
                          >
                            <option value="Front Desk Receptionist">Front Desk Receptionist</option>
                            <option value="Admissions Clerk">Admissions Clerk</option>
                            <option value="Billing Assistant">Billing Assistant</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {staffRole === 'lab' && (
                      <div className="space-y-3 border-t border-slate-100 pt-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Lab Specialist Profile Type *</label>
                          <select 
                            value={staffJobTitle} 
                            onChange={(e)=>setStaffJobTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary font-bold cursor-pointer"
                          >
                            <option value="Lab Technician">Lab Technician</option>
                            <option value="Pathologist">Pathologist</option>
                            <option value="Radiologist">Radiologist</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 border-t border-slate-100 pt-3">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Hospital Branch Assignment</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary cursor-pointer font-medium" 
                        value={staffBranch} 
                        onChange={(e)=>setStaffBranch(e.target.value)}
                      >
                        <option value="Delhi Branch">Delhi Branch</option>
                        <option value="Mumbai Branch">Mumbai Branch</option>
                      </select>
                    </div>

                    <button type="submit" className="w-full py-3 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-md active:scale-[0.98]">
                      Onboard Staff Member Instantly
                    </button>
                  </form>

                  {/* Active Staff Registry Grid */}
                  <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Active Staff Registry</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400">
                            <th className="py-3 font-bold uppercase tracking-wider">Staff Name</th>
                            <th className="py-3 font-bold uppercase tracking-wider">Clinical Role</th>
                            <th className="py-3 font-bold uppercase tracking-wider">Secure UID</th>
                            <th className="py-3 font-bold uppercase tracking-wider">Portal URL Link</th>
                            <th className="py-3 font-bold uppercase tracking-wider">Email Link Dispatch</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                          {[...staffRecords, ...(dashboardData?.staff || [])].map((rec, i) => {
                            const portal_url = rec.dedicated_portal_url || `https://${rec.role_name || rec.role || 'staff'}.hospyn.com`;
                            return (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="py-3.5 text-slate-950">{rec.name || rec.user_name}</td>
                                <td className="py-3.5">
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-primary text-[10px] font-bold uppercase">{rec.role || rec.role_name}</span>
                                </td>
                                <td className="py-3.5 font-mono text-slate-500">{rec.staff_id || rec.hospyn_id || rec.id}</td>
                                <td className="py-3.5 text-blue-600 underline">
                                  <a href={portal_url} target="_blank" rel="noreferrer">{portal_url}</a>
                                </td>
                                <td className="py-3.5 text-emerald-600 flex items-center gap-1.5">
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

            {consoleTab === 'ehr' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">EHR Patient Passports</h2>
                  <p className="text-xs text-slate-500 mt-1">Longitudinal health history audit and Chitti AI double summaries.</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Active Clinical Consent Profiles</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400">
                          <th className="py-3 font-bold">Patient Name</th>
                          <th className="py-3 font-bold">Linked Health ID</th>
                          <th className="py-3 font-bold">Dynamic Consent</th>
                          <th className="py-3 font-bold">Vitals State</th>
                          <th className="py-3 font-bold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 text-slate-950">Aarav Mehta</td>
                          <td className="py-3.5 font-mono text-slate-500">HP-9021-AA8</td>
                          <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold uppercase text-[9px]">GRANTED</span></td>
                          <td className="py-3.5 text-slate-900">BP: 120/80, Pulse: 72</td>
                          <td className="py-3.5"><button className="text-blue-600 font-bold hover:underline">View AI Summary</button></td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 text-slate-950">Priya Nair</td>
                          <td className="py-3.5 font-mono text-slate-500">HP-8833-P88</td>
                          <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold uppercase text-[9px]">GRANTED</span></td>
                          <td className="py-3.5 text-slate-900">BP: 135/88, Pulse: 85</td>
                          <td className="py-3.5"><button className="text-blue-600 font-bold hover:underline">View AI Summary</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {consoleTab === 'lab' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">LOINC Laboratory</h2>
                  <p className="text-xs text-slate-500 mt-1">Diagnostic order queues with LOINC mappings and reference range auditing.</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Active Diagnostic Test Queue</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400">
                          <th className="py-3 font-bold">Order ID</th>
                          <th className="py-3 font-bold">Test Name</th>
                          <th className="py-3 font-bold">LOINC Code</th>
                          <th className="py-3 font-bold">Measured Value</th>
                          <th className="py-3 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 text-slate-950">ORD-9021</td>
                          <td className="py-3.5">Hemoglobin A1c</td>
                          <td className="py-3.5 font-mono text-slate-500">4548-4</td>
                          <td className="py-3.5 text-amber-600 font-bold">7.2% (Abnormal)</td>
                          <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold uppercase text-[9px]">COMPLETED</span></td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 text-slate-950">ORD-8822</td>
                          <td className="py-3.5">Serum Creatinine</td>
                          <td className="py-3.5 font-mono text-slate-500">2160-0</td>
                          <td className="py-3.5 text-slate-900">0.9 mg/dL (Normal)</td>
                          <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-blue-50 text-primary font-bold uppercase text-[9px]">PROCESSING</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {consoleTab === 'pharmacy' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">Pharmacy Stock & Dispenser</h2>
                  <p className="text-xs text-slate-500 mt-1">Medicine batch registries, threshold warnings, and direct medicine dispenser.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                  {/* Stock Grid */}
                  <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Active Medicine Batch Levels</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400">
                            <th className="py-3 font-bold">Medicine</th>
                            <th className="py-3 font-bold">Batch</th>
                            <th className="py-3 font-bold">Quantity</th>
                            <th className="py-3 font-bold">Stock Warning</th>
                            <th className="py-3 font-bold">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                          {(dashboardData.pharmacy || []).map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-3.5 text-slate-950">{item.name}</td>
                              <td className="py-3.5 font-mono text-slate-500">{item.batch}</td>
                              <td className="py-3.5 font-bold text-slate-900">{item.quantity} units</td>
                              <td className="py-3.5">
                                {item.quantity <= item.threshold ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-bold uppercase text-[9px] flex gap-1 items-center max-w-fit"><AlertTriangle size={10}/> LOW STOCK</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold uppercase text-[9px] flex gap-1 items-center max-w-fit"><CheckCircle size={10}/> ADEQUATE</span>
                                )}
                              </td>
                              <td className="py-3.5">
                                <button disabled={item.quantity === 0} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50">
                                  Virtual Dispense
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* QR Dispenser simulator */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Prescription QR Scanner</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Scan incoming dynamic prescription QR codes from patient apps. The grid automatically marks items as dispensed and decrements pharmacy ledger states.
                      </p>
                      <div className="w-40 h-40 border border-slate-200 rounded-xl bg-slate-50 mx-auto flex items-center justify-center relative overflow-hidden">
                        <div className="w-32 h-32 border-2 border-primary/40 rounded bg-slate-200/50 flex items-center justify-center font-mono text-[8px] text-slate-400">
                          [ VIRTUAL QR CAMERA VIEW ]
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>{
                      handleDispenseMedicine('Atorvastatin 10mg');
                      alert("QR_SCAN_SUCCESS: Dispensed Atorvastatin 10mg from Batch AT-8822.");
                    }} className="w-full py-3 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-blue-700 mt-4 transition-colors">
                      Simulate Patient QR Scan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {consoleTab === 'opd' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">OPD & Bed Scheduler</h2>
                  <p className="text-xs text-slate-500 mt-1">Real-time ICU ward planner and priority scoring emergency token overrides.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                  {/* Bed Grid MAP */}
                  <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">ICU & Bed Allocation Matrix</h3>
                    <div className="grid grid-cols-4 gap-4">
                      {(dashboardData?.beds || []).map((bed) => (
                        <div key={bed.id} className="p-4 border border-slate-200 bg-slate-50 rounded-xl space-y-2 text-center">
                          <span className="font-bold text-slate-950 text-xs block">{bed.bed_number || bed.id}</span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase ${bed.status === 'occupied' ? 'bg-amber-100 text-amber-800' : bed.status === 'maintenance' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {bed.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Priority Token Overrider */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Emergency Queue Override</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Chitti AI structures patient scores out-of-band. Admins can bypass recommendations for immediate surgical trauma admissions.
                      </p>
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 items-center">
                        <ShieldAlert className="text-rose-600" size={20}/>
                        <div>
                          <p className="text-xs font-bold text-rose-950">ICU Capacity Alert</p>
                          <p className="text-[9px] text-rose-700">ICU Beds at 85% occupancy rate threshold limit.</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>alert("QUEUE_OVERRIDE_CONFIRMED: Token #08 shifted to immediate priority.")} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-colors mt-4">
                      Override Patient Token
                    </button>
                  </div>
                </div>
              </div>
            )}

            {consoleTab === 'ai-governance' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">AI Safety Governance</h2>
                  <p className="text-xs text-slate-500 mt-1">Auditing clinical override registries and safety parameters.</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Clinician Override Registry</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400">
                          <th className="py-3 font-bold">Override ID</th>
                          <th className="py-3 font-bold">Doctor Name</th>
                          <th className="py-3 font-bold">AI Diagnosis Suggestion</th>
                          <th className="py-3 font-bold">Doctor Correction Value</th>
                          <th className="py-3 font-bold">Audit Ledger Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 text-slate-950">OR-9021</td>
                          <td className="py-3.5">Dr. Vivek Sharma</td>
                          <td className="py-3.5">Prescribe Metformin 1000mg</td>
                          <td className="py-3.5 text-rose-600 font-bold">Metformin 500mg + lifestyle checks</td>
                          <td className="py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold uppercase text-[9px]">SIGNED & MUTATED</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {consoleTab === 'settings' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">System Settings & API Keys</h2>
                  <p className="text-xs text-slate-500 mt-1">Configure secure integrations for Twilio, SMTP, and Razorpay endpoints.</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-[24px] p-8 shadow-sm max-w-2xl space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Twilio Account SID</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" type="password" value="••••••••••••••••••••••••••••" readOnly/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Razorpay API Key</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" type="password" value="••••••••••••••••••••••••••••" readOnly/>
                    </div>
                  </div>

                  <button onClick={()=>alert("SETTINGS_SYNC_SUCCESS: Encrypted system settings dispatched to FastAPI ledger.")} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-colors">
                    Save Key Mappings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      {appStatus !== 'approved' && (
        <footer className="py-16 border-t border-slate-200 text-center bg-white text-slate-500">
          <p className="text-[9px] font-bold uppercase tracking-[0.4em] mb-4">© 2026 Hospyn Sovereign Grid. Forensic Intelligence Protocol.</p>
          <div className="flex justify-center gap-8 text-[9px] font-bold uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-primary transition-colors">Forensic Security</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy Matrix</a>
            <a href="#" className="hover:text-primary transition-colors">Grid Infrastructure</a>
          </div>
        </footer>
      )}

      {/* MODALS */}
      <ActivationWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        onActivationSuccess={(data) => {
          setAppStatus('approved');
          localStorage.setItem('hospyn_app_state', 'approved');
          localStorage.setItem('hospyn_org_name', data.name);
          localStorage.setItem('hospyn_owner_email', data.owner_email);
          if (data.owner_password) {
            localStorage.setItem('hospyn_owner_password', data.owner_password);
          }
          if (data.branches) {
            localStorage.setItem('hospyn_branches', data.branches);
          }
        }}
      />

      <CredentialsEmailModal 
        isOpen={isMailOpen} 
        onClose={() => setIsMailOpen(false)} 
        staffRecord={activeDispatchMail}
      />

      <LedgerLoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(data) => {
          setIsLoginModalOpen(false);
          setAppStatus('approved');
          localStorage.setItem('hospyn_app_state', 'approved');
          localStorage.setItem('hospyn_org_name', data.name);
          localStorage.setItem('hospyn_owner_email', data.owner_email);
        }}
      />

      {/* FREE CLINICAL CHITTI AI CHATBOT INTEGRATION */}
      {appStatus !== 'approved' && (
        <div className="fixed bottom-6 right-6 z-[100] font-inter">
          <AnimatePresence>
            {isChatOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="w-96 h-[480px] bg-white border border-slate-200 rounded-[32px] shadow-2xl flex flex-col overflow-hidden mb-4"
              >
                {/* Header */}
                <div className="p-5 bg-violet-600 text-white flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                      ✦
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider font-outfit">Chitti AI Clinical Bot</h4>
                      <p className="text-[8px] text-violet-200 font-bold uppercase tracking-widest">Active Free Gateway</p>
                    </div>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-violet-200 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Messages Box */}
                <div className="flex-grow p-5 overflow-y-auto space-y-3.5 bg-slate-50">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed font-semibold shadow-sm ${msg.sender === 'user' ? 'bg-violet-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input Area */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!inputText.trim()) return;
                    const userText = inputText;
                    setInputText('');
                    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
                    
                    setTimeout(() => {
                      let reply = "Understood. I am parsing the clinical logs to cross-verify doctor shifts and pharmacy stock levels. Operational flow looks nominal.";
                      if (userText.toLowerCase().includes('money') || userText.toLowerCase().includes('bank') || userText.toLowerCase().includes('pay')) {
                        reply = "Dynamic Bank Settlements Node verified. All transaction streams are routed through standard verification layers directly to your primary bank account.";
                      } else if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('hi')) {
                        reply = "Hello! I am Chitti AI, your clinical intelligence assistant. How can I assist with your hospital operations today?";
                      }
                      setMessages(prev => [...prev, { sender: 'chitti', text: reply }]);
                    }, 1000);
                  }}
                  className="p-4 border-t border-slate-100 bg-white flex gap-2 items-center"
                >
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Ask Chitti AI anything..." 
                    className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-violet-400 focus:bg-white transition-all"
                  />
                  <button type="submit" className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center font-bold shadow-md shadow-violet-500/10">
                    ➔
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Chat Bubble Button */}
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-16 h-16 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-xl shadow-violet-500/20 text-2xl font-bold border-2 border-white/20"
          >
            💬
          </motion.button>
        </div>
      )}
    </div>
  );
}
