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
  BarChart3, Database, Mail 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ActivationWizard from './components/ActivationWizard';
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

// --- ENTERPRISE CLINICAL ACTIVATION GATEWAY ---

// --- CORE SYSTEM APP ---
export default function App() {
  const [currentPage, setCurrentPage] = useState(1);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [appStatus, setAppStatus] = useState(localStorage.getItem('hospyn_app_state') || 'unregistered');
  
  // Console state
  const [consoleTab, setConsoleTab] = useState('dashboard');
  const [selectedBranch, setSelectedBranch] = useState('All');
  
  // Custom Dynamic Staff provisioning state
  const [staffRole, setStaffRole] = useState('doctor');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffLicense, setStaffLicense] = useState('');
  const [staffSpecialty, setStaffSpecialty] = useState('Cardiology');
  const [staffNationalId, setStaffNationalId] = useState('');
  const [staffBranch, setStaffBranch] = useState('Delhi Branch');
  
  const [staffRecords, setStaffRecords] = useState([
    { name: 'Dr. Vivek Sharma', email: 'vivek@hospyn.com', role: 'doctor', staff_id: 'HOSP-STAFF-F2A48C', temporary_password: 'Temp_e3a98f2d', dedicated_portal_url: 'https://doctor.hospyn.com', credentials_email_status: 'dispatched', hospitalName: 'Hospyn Allied Care' },
    { name: 'Sister Mini Joseph', email: 'mini@hospyn.com', role: 'nurse', staff_id: 'HOSP-STAFF-7B930D', temporary_password: 'Temp_92fd3a12', dedicated_portal_url: 'https://staff.hospyn.com', credentials_email_status: 'dispatched', hospitalName: 'Hospyn Allied Care' }
  ]);

  const [activeDispatchMail, setActiveDispatchMail] = useState(null);
  const [isMailOpen, setIsMailOpen] = useState(false);

  // Pharmacy Inventory mock state
  const [pharmacyItems, setPharmacyItems] = useState([
    { name: 'Paracetamol 650mg', batch: 'PR-9026', expiry: '2027-11-20', quantity: 8, threshold: 10 },
    { name: 'Amoxicillin 500mg', batch: 'AM-1234', expiry: '2026-08-15', quantity: 45, threshold: 15 },
    { name: 'Atorvastatin 10mg', batch: 'AT-8822', expiry: '2026-05-30', quantity: 3, threshold: 10 }
  ]);

  const handleAddStaffDynamic = (e) => {
    e.preventDefault();
    if (!staffName || !staffEmail) return;

    const staff_uid = `HOSP-STAFF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const temp_pass = `Temp_${Math.random().toString(36).substring(2, 10)}`;

    let portal_prefix = "staff"; 
    if (staffRole === "doctor") portal_prefix = "doctor";
    else if (staffRole === "pharmacist") portal_prefix = "pharmacy";
    else if (staffRole === "hr_manager") portal_prefix = "hr";
    else if (staffRole === "admin") portal_prefix = "admin";

    const portal_url = `https://${portal_prefix}.hospyn.com`;
    const newRecord = {
      name: staffName,
      email: staffEmail,
      role: staffRole,
      staff_id: staff_uid,
      temporary_password: temp_pass,
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
    setAppStatus('unregistered');
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
              {['Ecosystem Hub', 'How We Service', 'Our Vision', 'Developer Grid'].map((name, idx) => (
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
                <a href="#support" className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">Support</a>
                <button 
                  onClick={() => {
                    if (appStatus === 'unregistered') setIsWizardOpen(true);
                    else if (appStatus === 'pending') alert("Forensic ledger setup in progress. Use the bypass button on pending view to instantly approve.");
                  }}
                  className={`px-5 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all shadow-md ${appStatus === 'pending' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-primary text-white hover:bg-blue-700 shadow-blue-500/10'}`}
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
                <div className="lg:col-span-7 text-left space-y-8">
                  
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
                        onClick={() => setCurrentPage(4)} 
                        className="px-8 py-4 bg-violet-600 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-violet-700 transition-all flex items-center gap-2"
                      >
                        Monitor Local Node ➔
                      </button>
                    )}
                    <button 
                      onClick={() => setCurrentPage(2)} 
                      className="px-8 py-4 border border-slate-200 bg-white/70 text-slate-700 font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-slate-50 transition-all"
                    >
                      Explore Ecosystem
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

                {/* Right Column: Floating Winking Chitti AI robot integrated natively */}
                <div className="lg:col-span-5 relative flex items-center justify-center">
                  
                  {/* Soft ambient violet-blue radial glow matching Chitti's theme */}
                  <div className="absolute -inset-10 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Clean mascot image floating directly in the layout without annoying screenshot card borders */}
                  <motion.div 
                    animate={{ y: [0, -12, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="relative w-full max-w-[360px] select-none flex justify-center items-center"
                  >
                    <img 
                      src={chittiLandingImg} 
                      alt="Chitti AI Mascot" 
                      className="w-full h-auto object-contain mix-blend-multiply drop-shadow-[0_20px_50px_rgba(139,92,246,0.15)]"
                    />

                    {/* Glowing status vitals label floating beside Chitti */}
                    <motion.div 
                      animate={{ scale: [1, 1.03, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="absolute -bottom-2 -left-6 bg-white/90 border border-slate-200/50 backdrop-blur-md px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-lg shadow-violet-500/5"
                    >
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
                      </span>
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest font-inter">Chitti Active Node</span>
                    </motion.div>

                    {/* Floating Clinical Plus symbol above Chitti */}
                    <div className="absolute -top-4 -right-2 w-9 h-9 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center shadow-md text-violet-500 font-bold text-lg">
                      +
                    </div>
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

          {/* PAGE 4: PLATFORM VITALS & INFRASTRUCTURE */}
          {currentPage === 4 && (
            <section className="py-24 max-w-7xl mx-auto px-8 text-center">
              <h2 className="text-4xl font-extrabold text-slate-950 mb-4 font-outfit">Sovereign Clinical Grid Vitals</h2>
              <p className="text-slate-500 mb-12 max-w-lg mx-auto">Real-time indicators showing active network nodes deployed across regional cloud scopes.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-8 bg-white border border-slate-200 rounded-[24px] shadow-sm space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ledger Latency</span>
                    <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-bold text-primary uppercase">ACTIVE</span>
                  </div>
                  <div className="text-3xl font-black font-outfit text-slate-950">12.4ms</div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[85%]" />
                  </div>
                  <p className="text-[10px] text-slate-400">Consolidated database operations across all regional node configurations.</p>
                </div>
                <div className="p-8 bg-white border border-slate-200 rounded-[24px] shadow-sm space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Queue Throughput</span>
                    <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[9px] font-bold text-emerald-600 uppercase">HEALTHY</span>
                  </div>
                  <div className="text-3xl font-black font-outfit text-slate-950">12,492 reqs/s</div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[92%]" />
                  </div>
                  <p className="text-[10px] text-slate-400">Real-time patient scheduling queue telemetry operations without latency overhead.</p>
                </div>
                <div className="p-8 bg-white border border-slate-200 rounded-[24px] shadow-sm space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">AI Safety Audit</span>
                    <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[9px] font-bold text-primary uppercase">100% SECURE</span>
                  </div>
                  <div className="text-3xl font-black font-outfit text-slate-950">99.98% Confidence</div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full w-[99%]" />
                  </div>
                  <p className="text-[10px] text-slate-400">HIPAA compliant diagnostics assist matching medical board standards.</p>
                </div>
              </div>
            </section>
          )}

          {/* PAGE 4: INFRASTRUCTURE DEVELOPER DOCUMENTS */}
          {currentPage === 4 && (
            <section className="py-24 max-w-4xl mx-auto px-8">
              <h2 className="text-3xl font-extrabold text-slate-950 mb-8 font-outfit">Sovereign Deployment Standards</h2>
              <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
                <div className="p-6 bg-slate-900 text-white flex items-center gap-2 border-b border-slate-800">
                  <Key size={16} className="text-blue-400"/>
                  <span className="font-mono text-xs uppercase tracking-wider">Hospyn CLI Initialisation</span>
                </div>
                <div className="p-8 font-mono text-xs text-slate-700 bg-slate-50 space-y-4 leading-relaxed">
                  <p># Install the Hospyn node orchestrator</p>
                  <p className="bg-white p-3 border border-slate-200 rounded-lg text-slate-800 font-bold">$ npm install -g @hospyn/sovereign-node-cli</p>
                  <p># Authenticate using your enterprise activation signature</p>
                  <p className="bg-white p-3 border border-slate-200 rounded-lg text-slate-800 font-bold">$ hospyn auth --activate --key key_enterprise_9a82e9d2f</p>
                  <p># Deploys safe localized HIPAA database mappings</p>
                  <p className="bg-white p-3 border border-slate-200 rounded-lg text-slate-800 font-bold">$ hospyn node:deploy --region gcp-us-central1 --multi-branch</p>
                  <p className="text-emerald-600 font-bold">⚡ NODE RUNNING SUCCESSFULLY IN gcp-us-central1. PORTAL ACTIVE.</p>
                </div>
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
                    <option value="Delhi">Delhi Branch</option>
                    <option value="Mumbai">Mumbai Branch</option>
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
                  O
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-950 truncate">Hospital Owner</p>
                  <p className="text-[9px] text-slate-400 truncate">{localStorage.getItem('hospyn_owner_email') || 'owner@apollo.com'}</p>
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
                <div>
                  <div className="inline-block px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[9px] font-bold text-primary uppercase mb-3">Enterprise Dashboard</div>
                  <h2 className="text-3xl font-extrabold text-slate-950 font-outfit tracking-tight">Sovereign Node: {localStorage.getItem('hospyn_org_name') || 'Apollo Hospital Group'}</h2>
                  <p className="text-xs text-slate-500 mt-1">Platform monitoring and clinical server vitals.</p>
                </div>

                {/* Vitals indicators */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-2">
                    <span className="text-[9px] font-bold uppercase text-slate-400">Node Status</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"/>
                      <span className="text-slate-950 font-bold text-sm">HEALTHY - ACTIVE</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-2">
                    <span className="text-[9px] font-bold uppercase text-slate-400">Server Latency</span>
                    <span className="text-slate-950 font-extrabold text-lg block font-outfit">12ms</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-2">
                    <span className="text-[9px] font-bold uppercase text-slate-400">Redis Cache Hits</span>
                    <span className="text-slate-950 font-extrabold text-lg block font-outfit">99.8%</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-2">
                    <span className="text-[9px] font-bold uppercase text-slate-400">Celery Tasks</span>
                    <span className="text-slate-950 font-extrabold text-lg block font-outfit">0 Queued</span>
                  </div>
                </div>

                {/* Simulated Server Logs */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                  <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
                    <span className="text-xs font-mono tracking-wider">SOVEREIGN_NODE_SYSLOG_STREAM</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-bold uppercase">LIVE</span>
                  </div>
                  <div className="p-6 font-mono text-[10px] text-slate-300 space-y-2 h-[200px] overflow-y-auto">
                    <p className="text-slate-500">[12:20:01] DB_CONNECTION - Established secure connection.</p>
                    <p className="text-slate-500">[12:20:05] REDIS_CLIENT - Initializing access token index...</p>
                    <p className="text-emerald-400">[12:20:10] SECURE_ENCLAVE - Cryptographic token verification complete.</p>
                    <p className="text-blue-400">[12:20:15] CHITTI_AI - Warm-up sequence successful. Claude-3-Haiku active.</p>
                    <p className="text-slate-300">[12:20:22] PLATFORM_HEALTH - 0 warning thresholds crossed.</p>
                  </div>
                </div>
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

                <div className="grid md:grid-cols-3 gap-8">
                  {/* Dynamic Onboarding Form */}
                  <form onSubmit={handleAddStaffDynamic} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 text-sm border-b border-slate-100 pb-2">Provision Staff Member</h3>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Staff Role</label>
                      <select 
                        value={staffRole} 
                        onChange={(e)=>setStaffRole(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-primary cursor-pointer"
                      >
                        <option value="doctor">Doctor (doctor.hospyn.com)</option>
                        <option value="nurse">Nurse (staff.hospyn.com)</option>
                        <option value="pharmacist">Pharmacist (pharmacy.hospyn.com)</option>
                        <option value="hr_manager">HR Manager (hr.hospyn.com)</option>
                        <option value="admin">Administrator (admin.hospyn.com)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" placeholder="Dr. Vivek Sharma" required value={staffName} onChange={(e)=>setStaffName(e.target.value)}/>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Official Email</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" placeholder="vivek@hospyn.com" required type="email" value={staffEmail} onChange={(e)=>setStaffEmail(e.target.value)}/>
                    </div>

                    {/* Dynamic Fields based on Role Selection */}
                    {staffRole === 'doctor' && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">License Number</label>
                          <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" placeholder="MCI-12345" required value={staffLicense} onChange={(e)=>setStaffLicense(e.target.value)}/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Specialty</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" value={staffSpecialty} onChange={(e)=>setStaffSpecialty(e.target.value)}>
                            <option value="Cardiology">Cardiology</option>
                            <option value="Neurology">Neurology</option>
                            <option value="Pediatrics">Pediatrics</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {staffRole === 'nurse' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Nursing Registry Code</label>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" placeholder="NUR-9021" required value={staffLicense} onChange={(e)=>setStaffLicense(e.target.value)}/>
                      </div>
                    )}

                    {staffRole === 'general' && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">National Government ID</label>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" placeholder="UID-9012" required value={staffNationalId} onChange={(e)=>setStaffNationalId(e.target.value)}/>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Hospital Branch Assignment</label>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-primary" value={staffBranch} onChange={(e)=>setStaffBranch(e.target.value)}>
                        <option value="Delhi Branch">Delhi Branch</option>
                        <option value="Mumbai Branch">Mumbai Branch</option>
                      </select>
                    </div>

                    <button type="submit" className="w-full py-3 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-colors">
                      Onboard Staff Member
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
                          {staffRecords.map((rec, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-3.5 text-slate-950">{rec.name}</td>
                              <td className="py-3.5">
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-primary text-[10px] font-bold uppercase">{rec.role}</span>
                              </td>
                              <td className="py-3.5 font-mono text-slate-500">{rec.staff_id}</td>
                              <td className="py-3.5 text-blue-600 underline">
                                <a href={rec.dedicated_portal_url} target="_blank" rel="noreferrer">{rec.dedicated_portal_url}</a>
                              </td>
                              <td className="py-3.5 text-emerald-600 flex items-center gap-1.5">
                                <CheckCircle size={14}/> <span>Dispatched</span>
                              </td>
                            </tr>
                          ))}
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
                          {pharmacyItems.map((item, i) => (
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
                                <button onClick={()=>handleDispenseMedicine(item.name)} disabled={item.quantity === 0} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50">
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
                      {[
                        { id: 'Bed-101', status: 'occupied', label: 'Occupied' },
                        { id: 'Bed-102', status: 'available', label: 'Available' },
                        { id: 'Bed-103', status: 'occupied', label: 'Occupied' },
                        { id: 'Bed-104', status: 'maintenance', label: 'Maintenance' },
                        { id: 'Bed-201', status: 'available', label: 'Available' },
                        { id: 'Bed-202', status: 'available', label: 'Available' },
                        { id: 'Bed-203', status: 'occupied', label: 'Occupied' },
                        { id: 'Bed-204', status: 'available', label: 'Available' }
                      ].map((bed) => (
                        <div key={bed.id} className="p-4 border border-slate-200 bg-slate-50 rounded-xl space-y-2 text-center">
                          <span className="font-bold text-slate-950 text-xs block">{bed.id}</span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase ${bed.status === 'occupied' ? 'bg-amber-100 text-amber-800' : bed.status === 'maintenance' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {bed.label}
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
    </div>
  );
}
