import React, { useState } from 'react';
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
import logoImg from '../assets/logo.png';

export default function MarketingLanding({ 
  appStatus, 
  setIsLoginModalOpen, 
  setIsWizardOpen, 
  handleVerifyBypass 
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeAiSlide, setActiveAiSlide] = useState(0);
  const [activePatientSlide, setActivePatientSlide] = useState(0);

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
                  className={`px-5 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all shadow-md ${appStatus === 'pending' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-primary text-white hover:bg-violet-755 shadow-violet-500/10'}`}
                >
                  {appStatus === 'pending' ? 'Verification Pending' : 'Register Console'}
                </button>
              </div>
            </div>
          </div>
        </motion.nav>
      )}

      {/* PUBLIC ECOSYSTEM MODE */}
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
                            <h3 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 font-outfit">
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
                                <div className="absolute top-0 bottom-0 bg-violet-650 w-full animate-[shimmer_2s_infinite]" style={{
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
                              <div className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-md relative">
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
                            <p className="text-slate-600 text-xs md:text-sm leading-relaxed font-semibold">
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
                                <p className="text-[8px] text-slate-400 mt-0.5">Delhi Branch Main Gate OPD Terminal 01</p>
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
                                  <p className="text-[8px] text-slate-400 mt-0.5">UPI Auto-pay settlement: success</p>
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
                    <span className="text-4xl font-black text-slate-200 font-outfit group-hover:text-violet-105 transition-colors">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-3 tracking-tight font-outfit">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{item.description}</p>
                </div>
              ))}
            </div>

            {/* Real-time simulated terminal process to show user how we do it */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 font-mono text-xs text-slate-350 shadow-xl space-y-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between text-slate-500 border-b border-slate-800 pb-4 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-450 ml-2">Live Sovereign Clinical Verification Pipeline</span>
                </div>
                <span className="px-2.5 py-0.5 rounded bg-violet-500/20 text-violet-450 font-bold uppercase text-[9px] tracking-wider">ACTIVE PIPELINE</span>
              </div>
              <p className="text-slate-550"># Initializing instant hospital node network handshakes...</p>
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
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50/70 text-[10px] font-black tracking-widest text-indigo-650 uppercase">
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
                <span className="text-[9px] font-black uppercase text-indigo-505 tracking-widest">Zero Compromise Assurance</span>
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
                <span className="text-[9px] font-black uppercase text-violet-505 tracking-widest">Multi-Branch Syncing</span>
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
                <span className="text-[9px] font-black uppercase text-purple-505 tracking-widest">Empathetic Patient Briefs</span>
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

    </div>
  );
}
