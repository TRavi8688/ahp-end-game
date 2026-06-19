/**
 * hospin-v2-web/src/pages/MarketingLanding.jsx
 * Hospin brand identity. Formal, trustworthy, fresh.
 * Tabs: Ecosystem Hub | How We Service | Our Vision
 *
 * REBRAND CHANGES:
 *  - Hospyn → Hospin everywhere
 *  - Tagline: "Care beyond today"
 *  - Hero restructured to 2-column: left = value prop, right = interactive
 *    Chitti AI avatar with floating icon animation
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, Activity, Brain, Lock, CheckCircle,
  ArrowRight, Zap, Globe, BarChart3, Heart, Clock,
  TrendingUp, AlertCircle, Server, Star, ChevronRight,
  Phone, Mail, Building2, Award, Eye, Layers, Cpu, Database
} from 'lucide-react';
import logoImg from '../assets/logo.png';
import chittiImg from '../assets/chitti_landing.jpg';

const STATS = [
  { value: '2,400+', label: 'Hospitals Onboarded' },
  { value: '98.7%', label: 'Uptime SLA' },
  { value: '₹480Cr+', label: 'Transactions Processed' },
  { value: '4.2M+', label: 'Patient Records Secured' },
];

const FEATURES = [
  { icon: BarChart3, color: 'violet', title: 'Complete Hospital Control', desc: 'Every doctor, nurse, patient, bed, pharmacy, and billing line — one cockpit. Real-time, always accurate.' },
  { icon: Users, color: 'indigo', title: 'Staff & Access Management', desc: 'Add, revoke, suspend any staff member instantly. Control who sees what across every branch.' },
  { icon: Brain, color: 'purple', title: 'Chitti AI Intelligence', desc: 'OCR prescription scanning, dosage anomaly detection, automated clinical briefs — supervised by your senior staff.' },
  { icon: Lock, color: 'emerald', title: 'Zero-Breach Security', desc: 'Government-grade NSDL + UIDAI verification. Every login, action, and transaction — immutably audited.' },
  { icon: Activity, color: 'blue', title: 'Live Patient Flow', desc: 'Walk-in queue → triage → consultation → discharge. Every step visible, every delay caught before it happens.' },
  { icon: TrendingUp, color: 'amber', title: 'Financial Transparency', desc: 'Direct bank-linked clearing with real-time split ledgers. Know exactly where every rupee went, instantly.' },
];

const HOW_STEPS = [
  { num: '01', badge: 'REGISTER', color: 'violet', title: 'Verify & Onboard', desc: 'Submit your NABH license, PAN, and director biometrics. Our team reviews and activates your node within 24 hours. No shortcuts — we verify every hospital manually.', sub: 'NSDL + UIDAI + NABH triple verification' },
  { num: '02', badge: 'CONFIGURE', color: 'indigo', title: 'Set Up Your Hospital', desc: 'Add branches, departments, doctors, nurses, reception staff. Configure bed wards, OPD queues, pharmacy inventory — everything from one admin seat.', sub: 'Multi-branch support from day one' },
  { num: '03', badge: 'OPERATE', color: 'blue', title: 'Run Daily Operations', desc: 'Staff log into their dedicated portals. Patients walk in via QR code. Watch your entire hospital move from your owner dashboard — live, second by second.', sub: 'Real-time sync across all devices' },
  { num: '04', badge: 'GROW', color: 'emerald', title: 'Scale Without Friction', desc: 'Add a new branch in minutes. Every new location inherits your full configuration. Your dashboard expands automatically — zero manual setup.', sub: 'Unlimited branches, one dashboard' },
];

const VISION_PILLARS = [
  { icon: Shield, title: 'Every Hospital, Fully Verified', desc: 'We do not sell software to anyone who asks. Every hospital on Hospin is triple-verified against government registries. This protects you, your staff, and every patient who walks through your door.', tag: 'Zero-Compromise Verification' },
  { icon: Globe, title: 'One Network, Every Hospital', desc: 'We are building the clinical nervous system of India. A unified grid where patient data, staff credentials, and financial records move securely between verified nodes — with your consent, always.', tag: 'National Health Network' },
  { icon: Heart, title: 'Technology That Disappears', desc: 'The best hospital software is the kind nobody notices. Your doctors focus on patients. Your nurses track care. You run the hospital. Hospin runs silently in the background — handling everything else.', tag: 'Invisible Infrastructure' },
];

export default function MarketingLanding({ setIsLoginModalOpen, setIsWizardOpen }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeAiSlide, setActiveAiSlide] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setActiveAiSlide(i => (i + 1) % 3), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="bg-white text-slate-800 font-inter min-h-screen flex flex-col">

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-300 ${scrolled ? 'bg-white/98 shadow-sm backdrop-blur-xl border-b border-slate-100' : 'bg-white border-b border-slate-100'}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-16">

          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setCurrentPage(1); window.scrollTo(0,0); }}>
            <img src={logoImg} alt="Hospin" className="w-8 h-8 object-contain" />
            <span className="font-black text-slate-900 text-lg tracking-tight" style={{ fontFamily: 'system-ui, sans-serif' }}>
              HOSPIN<span className="text-violet-600">.</span>
            </span>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-violet-600 bg-violet-50 border border-violet-100">
              Enterprise
            </span>
          </div>

          <div className="hidden md:flex items-center bg-slate-50 rounded-xl p-1 gap-0.5">
            {[['Ecosystem Hub', 1], ['How We Service', 2], ['Our Vision', 3]].map(([label, page]) => (
              <button
                key={page}
                onClick={() => { setCurrentPage(page); window.scrollTo(0, 0); }}
                className={`px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${
                  currentPage === page ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsLoginModalOpen(true)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-all">
              Owner Login
            </button>
            <button onClick={() => setIsWizardOpen(true)} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-violet-500/25 flex items-center gap-1.5">
              Register Hospital <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-16 flex-grow">

        {/* ══════════════════════════════════════════════════════════════
            PAGE 1 — ECOSYSTEM HUB
        ══════════════════════════════════════════════════════════════ */}
        {currentPage === 1 && (
          <>
            {/* HERO */}
            <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white min-h-[90vh] flex items-center">
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(124,58,237,0.06) 0%, transparent 60%), radial-gradient(circle at 10% 80%, rgba(99,102,241,0.05) 0%, transparent 50%)' }} />
              <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(#8B5CF6 1px, transparent 1px), linear-gradient(90deg, #8B5CF6 1px, transparent 1px)', backgroundSize: '56px 56px' }} />

              <div className="max-w-7xl mx-auto px-6 lg:px-10 w-full py-20 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                  <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="lg:col-span-7 space-y-8">

                    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Care beyond today</span>
                    </div>

                    <div className="space-y-5">
                      <h1 className="text-[3.4rem] lg:text-[4rem] font-black text-slate-900 leading-[1.02] tracking-tight" style={{ fontFamily: 'system-ui, sans-serif' }}>
                        Your Entire<br />
                        Hospital.<br />
                        <span className="text-violet-600">One Dashboard.</span>
                      </h1>
                      <p className="text-slate-500 text-base font-medium leading-relaxed max-w-lg">
                        Hospin gives hospital owners complete, real-time control over every doctor, every nurse, every patient, and every rupee — from a single verified console.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {['NABH Verified', 'DPDPA Compliant', 'ABDM Ready'].map(t => (
                        <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                          <CheckCircle size={11} /> {t}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button onClick={() => setIsWizardOpen(true)} className="px-7 py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-[11px] tracking-widest uppercase rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-violet-500/25 flex items-center gap-2">
                        Register Your Hospital <ArrowRight size={14} />
                      </button>
                      <button onClick={() => setIsLoginModalOpen(true)} className="px-7 py-3.5 border border-slate-200 bg-white text-slate-700 font-bold text-[11px] tracking-widest uppercase rounded-xl hover:bg-slate-50 transition-all">
                        Access Console
                      </button>
                    </div>

                    <div className="pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-6">
                      {STATS.map((s, i) => (
                        <div key={i}>
                          <p className="text-2xl font-black text-slate-900" style={{ fontFamily: 'system-ui, sans-serif' }}>{s.value}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Chitti AI Avatar — interactive, floating */}
                  <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.65, delay: 0.15 }} className="hidden lg:flex lg:col-span-5 items-center justify-center relative">

                    {/* Background glow */}
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(139,92,246,0.18) 0%, transparent 65%)' }} />

                    {/* Floating avatar container */}
                    <motion.div
                      animate={{ y: [0, -16, 0] }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative z-10"
                    >
                      <div className="relative w-[320px] h-[320px] rounded-[40px] overflow-hidden border border-white/40 shadow-2xl backdrop-blur-sm" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.2))' }}>
                        <img src={chittiImg} alt="Chitti AI" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 rounded-[40px] ring-1 ring-inset ring-white/50" />
                      </div>

                      {/* Floating icon: Brain */}
                      <motion.div
                        animate={{ y: [0, -14, 0], rotate: [0, 6, 0] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -top-6 -left-8 w-12 h-12 bg-white rounded-2xl shadow-xl border border-violet-100 flex items-center justify-center"
                      >
                        <Brain size={20} className="text-violet-600" />
                      </motion.div>

                      {/* Floating icon: Cpu */}
                      <motion.div
                        animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
                        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                        className="absolute top-6 -right-10 w-11 h-11 bg-white rounded-2xl shadow-xl border border-indigo-100 flex items-center justify-center"
                      >
                        <Cpu size={18} className="text-indigo-600" />
                      </motion.div>

                      {/* Floating icon: Activity */}
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 4.1, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                        className="absolute bottom-10 -left-10 w-11 h-11 bg-white rounded-2xl shadow-xl border border-cyan-100 flex items-center justify-center"
                      >
                        <Activity size={18} className="text-cyan-600" />
                      </motion.div>

                      {/* Floating icon: Database */}
                      <motion.div
                        animate={{ y: [0, 14, 0], rotate: [0, 8, 0] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
                        className="absolute -bottom-6 right-2 w-12 h-12 bg-white rounded-2xl shadow-xl border border-blue-100 flex items-center justify-center"
                      >
                        <Database size={19} className="text-blue-600" />
                      </motion.div>

                      {/* Floating icon: Shield */}
                      <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 3.0, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                        className="absolute top-1/2 -right-14 w-10 h-10 bg-white rounded-2xl shadow-xl border border-emerald-100 flex items-center justify-center"
                      >
                        <Shield size={16} className="text-emerald-600" />
                      </motion.div>
                    </motion.div>

                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-lg flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Chitti AI — Active</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </section>

            {/* TRUST BAND */}
            <div className="bg-slate-900 py-4 border-y border-slate-800">
              <div className="max-w-7xl mx-auto px-10 flex items-center justify-between flex-wrap gap-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Certified & Compliant With</span>
                {['NABH Certified', 'NHA Compliant', 'DPDPA Ready', 'ISO 27001', 'ABDM Linked'].map(t => (
                  <span key={t} className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-3 py-1 rounded border border-slate-700 bg-slate-800">{t}</span>
                ))}
              </div>
            </div>

            {/* FEATURES */}
            <section className="py-24 bg-white">
              <div className="max-w-7xl mx-auto px-6 lg:px-10">
                <div className="text-center mb-16 space-y-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full border border-violet-100 bg-violet-50 text-[10px] font-black tracking-widest text-violet-600 uppercase">Built for Hospital Owners</span>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'system-ui' }}>Everything to Run a Hospital</h2>
                  <p className="text-slate-500 max-w-2xl mx-auto text-sm font-medium">Not a template. Not a demo. A complete clinical operations platform built from the ground up for Indian hospitals.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {FEATURES.map((f, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                      className="group p-7 bg-white border border-slate-100 rounded-3xl hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-${f.color}-50 border border-${f.color}-100`}>
                        <f.icon size={22} className={`text-${f.color}-600`} />
                      </div>
                      <h3 className="font-black text-slate-900 text-base mb-2 tracking-tight">{f.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed font-medium">{f.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* CHITTI AI */}
            <section className="py-24 bg-slate-50 border-t border-slate-100">
              <div className="max-w-7xl mx-auto px-6 lg:px-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div className="space-y-7">
                    <div>
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-200 bg-white text-[10px] font-black tracking-widest text-violet-600 uppercase shadow-sm">✦ Chitti AI</span>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tight mt-4 leading-tight" style={{ fontFamily: 'system-ui' }}>Clinical Intelligence.<br />Human Oversight. Always.</h2>
                      <p className="text-slate-500 text-sm mt-4 leading-relaxed font-medium">Chitti AI assists your senior staff — it never overrides them. Every suggestion is reviewed by a human before it acts. That's not a limitation. That's how we keep patients safe.</p>
                    </div>
                    <div className="space-y-3">
                      {[
                        { title: 'OCR Prescription Scanning', desc: 'Extracts and verifies drug names, dosages, and doctor signatures from physical prescriptions instantly.' },
                        { title: 'Dosage Anomaly Detection', desc: 'Flags unusual prescriptions before they reach the pharmacy — with zero false block rate on standard doses.' },
                        { title: 'Immutable Audit Trail', desc: 'Every AI action is logged, timestamped, and cryptographically sealed. No edits. No deletes. Ever.' },
                      ].map((item, i) => (
                        <button key={i} onClick={() => setActiveAiSlide(i)}
                          className={`w-full text-left p-5 rounded-2xl border transition-all ${activeAiSlide === i ? 'bg-white border-violet-200 shadow-md shadow-violet-500/5' : 'bg-white/60 border-slate-100 hover:bg-white hover:border-slate-200'}`}>
                          <div className="flex items-start gap-4">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 transition-all ${activeAiSlide === i ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              {String(i + 1).padStart(2, '0')}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5 font-medium leading-relaxed">{item.desc}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 space-y-6 min-h-[320px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">Chitti Active</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={activeAiSlide} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                        {activeAiSlide === 0 && <>
                          <h3 className="text-xl font-black text-slate-900">Script Extraction Engine</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-500 font-medium"><span>PAN OCR Confidence</span><span className="text-violet-600 font-black">99.8%</span></div>
                            <div className="h-2 bg-violet-100 rounded-full overflow-hidden"><div className="h-full bg-violet-500 rounded-full" style={{ width: '99.8%' }} /></div>
                            <div className="grid grid-cols-3 gap-2 mt-4">
                              {['Dr. Sharma', 'Cardiology', 'Delhi OPD'].map(v => (
                                <div key={v} className="h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[9px] font-black text-slate-600 uppercase tracking-wide">{v}</div>
                              ))}
                            </div>
                            <p className="text-[11px] font-black text-emerald-600 mt-2 flex items-center gap-1.5"><CheckCircle size={12} /> Verified — Forwarded to Pharmacy Queue</p>
                          </div>
                        </>}
                        {activeAiSlide === 1 && <>
                          <h3 className="text-xl font-black text-slate-900">Dosage Safety Check</h3>
                          <div className="space-y-3">
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
                              <span className="text-rose-700 font-bold text-xs flex items-center gap-1.5"><AlertCircle size={13} /> High Dosage Flagged</span>
                              <span className="text-rose-600 font-black text-xs font-mono">1000mg Metformin</span>
                            </div>
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                              <span className="text-emerald-700 font-bold text-xs flex items-center gap-1.5"><CheckCircle size={13} /> Standard Confirmed</span>
                              <span className="text-emerald-600 font-black text-xs font-mono">500mg Metformin</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold text-center">Senior physician notified before dispensing</p>
                          </div>
                        </>}
                        {activeAiSlide === 2 && <>
                          <h3 className="text-xl font-black text-slate-900">Immutable Audit Block</h3>
                          <div className="p-5 bg-slate-900 rounded-2xl font-mono text-[10px] text-slate-300 space-y-2">
                            <p className="text-emerald-400">✔ Block #09142 Sealed</p>
                            <p><span className="text-slate-500">tx_hash:</span> a4f9c2e8...1b</p>
                            <p><span className="text-slate-500">timestamp:</span> {new Date().toISOString()}</p>
                            <p><span className="text-slate-500">actor:</span> chitti_ai_v3</p>
                            <p className="text-violet-400 mt-2">→ Forwarded to NABH Audit Registry</p>
                          </div>
                        </>}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-slate-900">
              <div className="max-w-4xl mx-auto px-10 text-center space-y-8">
                <h2 className="text-4xl font-black text-white tracking-tight leading-tight" style={{ fontFamily: 'system-ui' }}>Ready to Run Your Hospital the Right Way?</h2>
                <p className="text-slate-400 text-base font-medium max-w-2xl mx-auto leading-relaxed">Join 2,400+ hospitals on the Hospin network. Verification takes 24 hours. Setup takes minutes.</p>
                <div className="flex flex-wrap justify-center gap-4">
                  <button onClick={() => setIsWizardOpen(true)} className="px-10 py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs tracking-widest uppercase rounded-xl transition-all shadow-xl shadow-violet-500/20 flex items-center gap-2">Register Your Hospital <ArrowRight size={14} /></button>
                  <button onClick={() => setIsLoginModalOpen(true)} className="px-10 py-4 border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white font-bold text-xs tracking-widest uppercase rounded-xl transition-all">Access Existing Console</button>
                </div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No subscription until your hospital is fully verified and live.</p>
              </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-slate-950 border-t border-slate-800 py-12">
              <div className="max-w-7xl mx-auto px-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10 border-b border-slate-800">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <img src={logoImg} alt="Hospin" className="w-8 h-8 object-contain" />
                      <span className="font-black text-white text-lg" style={{ fontFamily: 'system-ui' }}>HOSPIN<span className="text-violet-500">.</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">Clinical-grade hospital management infrastructure for verified Indian healthcare providers.</p>
                  </div>
                  {[
                    { title: 'Product', links: ['Owner Dashboard', 'Staff Management', 'Patient Flow', 'Chitti AI', 'Billing & Ledger'] },
                    { title: 'Company', links: ['About Us', 'Our Vision', 'Careers', 'Press', 'Partners'] },
                    { title: 'Legal & Support', links: ['Privacy Policy', 'Terms of Service', 'DPDPA Compliance', 'NABH Guidelines', 'Contact Support'] },
                  ].map(col => (
                    <div key={col.title} className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{col.title}</p>
                      <div className="space-y-2">{col.links.map(link => <p key={link} className="text-xs text-slate-400 font-medium hover:text-slate-200 cursor-pointer transition-colors">{link}</p>)}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">© 2026 Hospin Technologies Pvt. Ltd. All Rights Reserved.</p>
                  <div className="flex gap-3">
                    {['ISO 27001', 'NABH', 'NHA', 'ABDM'].map(b => <span key={b} className="text-[9px] font-black uppercase tracking-wider text-slate-600 border border-slate-800 rounded px-2 py-0.5">{b}</span>)}
                  </div>
                </div>
              </div>
            </footer>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PAGE 2 — HOW WE SERVICE
        ══════════════════════════════════════════════════════════════ */}
        {currentPage === 2 && (
          <section className="min-h-screen bg-white py-24">
            <div className="max-w-7xl mx-auto px-6 lg:px-10 space-y-20">
              <div className="text-center space-y-4 max-w-3xl mx-auto">
                <span className="inline-flex items-center px-3 py-1 rounded-full border border-violet-100 bg-violet-50 text-[10px] font-black tracking-widest text-violet-600 uppercase">The Hospin Process</span>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'system-ui' }}>How We Transform a Hospital Into a Verified Network Node</h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">From registration to daily operations — every step is deliberate, verified, and designed to make your hospital run better.</p>
              </div>

              <div className="space-y-5">
                {HOW_STEPS.map((step, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-8 bg-white border border-slate-100 rounded-3xl hover:border-violet-100 hover:shadow-xl hover:shadow-violet-500/5 transition-all">
                    <div className="lg:col-span-2 flex items-center gap-3">
                      <span className="text-5xl font-black text-slate-100" style={{ fontFamily: 'system-ui' }}>{step.num}</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-${step.color}-50 text-${step.color}-600 border border-${step.color}-100`}>{step.badge}</span>
                    </div>
                    <div className="lg:col-span-7 space-y-2">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">{step.title}</h3>
                      <p className="text-slate-500 text-sm font-medium leading-relaxed">{step.desc}</p>
                    </div>
                    <div className="lg:col-span-3">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{step.sub}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 font-mono text-xs text-slate-300 shadow-2xl max-w-4xl mx-auto space-y-3">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" /><div className="w-3 h-3 rounded-full bg-amber-400" /><div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Live Hospital Activation Pipeline</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-black text-[9px] uppercase tracking-wider">Active</span>
                </div>
                <p className="text-slate-500"># Initializing hospital node verification...</p>
                <p>✔ [09:12:01] NABH license <span className="text-emerald-400 font-bold">verified</span> — Central Medical Registry</p>
                <p>✔ [09:12:02] Director PAN <span className="text-emerald-400 font-bold">confirmed</span> — NSDL live lookup</p>
                <p>✔ [09:12:03] Biometric selfie <span className="text-emerald-400 font-bold">matched</span> — Confidence: 99.4%</p>
                <p>✔ [09:12:04] ₹2 security hold <span className="text-emerald-400 font-bold">authorized</span> — UPI mandate registered</p>
                <p className="text-violet-400 font-bold mt-2">🏥 Node ACTIVE — Owner dashboard provisioned. Manual review complete.</p>
              </div>

              <div className="text-center pt-8">
                <button onClick={() => setIsWizardOpen(true)} className="px-10 py-4 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs tracking-widest uppercase rounded-xl transition-all shadow-xl shadow-violet-500/20 flex items-center gap-2 mx-auto">
                  Start Your Hospital Registration <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PAGE 3 — OUR VISION
        ══════════════════════════════════════════════════════════════ */}
        {currentPage === 3 && (
          <section className="min-h-screen bg-white py-24">
            <div className="max-w-7xl mx-auto px-6 lg:px-10 space-y-20">
              <div className="text-center space-y-4 max-w-3xl mx-auto">
                <span className="inline-flex items-center px-3 py-1 rounded-full border border-indigo-100 bg-indigo-50 text-[10px] font-black tracking-widest text-indigo-600 uppercase">Why Hospin Exists</span>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight" style={{ fontFamily: 'system-ui' }}>We Are Building the Clinical Infrastructure India Never Had</h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">India has 1.2 lakh hospitals. Most run on WhatsApp groups, paper registers, and Excel sheets. We are changing that — hospital by hospital, verified by verified.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
                {VISION_PILLARS.map((p, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                    className="p-8 bg-white border border-slate-100 rounded-3xl hover:border-violet-100 hover:shadow-xl hover:shadow-violet-500/5 transition-all space-y-5">
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                      <p.icon size={26} className="text-violet-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{p.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed font-medium">{p.desc}</p>
                    <span className="text-[9px] font-black uppercase tracking-widest text-violet-500 block">{p.tag}</span>
                  </motion.div>
                ))}
              </div>

              <div className="bg-slate-900 rounded-3xl p-12 text-center space-y-6 max-w-4xl mx-auto">
                <p className="text-2xl font-black text-white leading-relaxed italic" style={{ fontFamily: 'system-ui' }}>
                  "Our mission is to replace friction with flow. Every verified hospital is a node in a national network of safe, trusted, and dignified patient care."
                </p>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">— Hospin Leadership Team</span>
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <button onClick={() => setIsWizardOpen(true)} className="px-8 py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-violet-500/20">Join the Network →</button>
                  <button onClick={() => setIsLoginModalOpen(true)} className="px-8 py-3.5 border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white font-bold text-xs tracking-widest uppercase rounded-xl transition-all">Access Your Console →</button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
