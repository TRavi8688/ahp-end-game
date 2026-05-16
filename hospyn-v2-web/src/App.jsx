import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, Shield, Zap, Brain, 
  Users, Heart, Cpu, Globe, 
  TrendingUp, Lock, Server, 
  AlertTriangle, CheckCircle, 
  UploadCloud, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// --- ACTIVATION WIZARD COMPONENT (PROVISIONING CONSOLE) ---
const ActivationWizard = ({ isOpen, onClose, onRegisterSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', license: null });
  const [file, setFile] = useState(null);

  const handleRegistration = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Real-world sync simulation with forensic delay
      await new Promise(resolve => setTimeout(resolve, 2500));
      localStorage.setItem('hospyn_app_state', 'pending');
      onRegisterSuccess();
      setStep(3);
    } catch (err) {
      alert("LEDGER_SYNC_ERROR: Clinical grid unreachable.");
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 font-outfit"
        >
          <div className="max-w-4xl w-full grid md:grid-cols-2 bg-[#0A0F1E] border border-cyan-500/20 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.1)]">
            <div className="p-12 bg-gradient-to-br from-cyan-900/20 to-transparent">
              <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-6">Provisioning Console</div>
              <h2 className="text-4xl font-black mb-6 leading-tight text-white">Activate Your <br/> Clinical Node.</h2>
              <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium">Provisioning a sovereign clinical node ensures end-to-end ledger integrity. This process is irreversible and forensic.</p>
              <div className="space-y-6">
                <div className="flex gap-4 items-center opacity-80"><Shield className="text-cyan-400" size={20}/><span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Clinical Audit Ready</span></div>
                <div className="flex gap-4 items-center opacity-80"><Zap className="text-emerald-400" size={20}/><span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Real-time Node Sync</span></div>
              </div>
            </div>
            <div className="p-12 relative flex flex-col justify-center">
               <button onClick={onClose} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
               {step === 1 && (
                 <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hospital Entity</label>
                        <input className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-cyan-500 outline-none transition-all" placeholder="Legal Healthcare Name" required onChange={(e)=>setFormData({...formData, name: e.target.value})}/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Administrator Contact</label>
                        <input className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-cyan-500 outline-none" placeholder="Official Gmail" required type="email" onChange={(e)=>setFormData({...formData, email: e.target.value})}/>
                    </div>
                    <button className="w-full py-5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-cyan-500/20 mt-4">Next: Forensic Evidence</button>
                 </form>
               )}
               {step === 2 && (
                 <div className="space-y-6">
                    <div onClick={()=>document.getElementById('file').click()} className="border-2 border-dashed border-cyan-500/20 rounded-[32px] p-12 text-center cursor-pointer hover:bg-cyan-500/5 transition-all group">
                       <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <UploadCloud className="text-cyan-400" size={32}/>
                       </div>
                       <p className="text-[10px] font-black text-white uppercase tracking-widest">Upload License Proof</p>
                       <p className="text-[10px] text-slate-500 mt-1 uppercase">NABH / ISO / MEDICAL LICENSE</p>
                       <input id="file" type="file" className="hidden" onChange={(e)=>setFile(e.target.files[0])}/>
                       {file && <div className="mt-4 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl inline-block text-[10px] font-black text-emerald-400 uppercase tracking-widest">{file.name}</div>}
                    </div>
                    <button onClick={handleRegistration} disabled={!file || loading} className="w-full py-5 bg-emerald-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-[1.02] disabled:opacity-50 transition-all shadow-xl shadow-emerald-500/20">
                       {loading ? 'INITIALIZING CLINICAL GRID...' : 'Activate Sovereign Node'}
                    </button>
                 </div>
               )}
               {step === 3 && (
                 <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
                        <CheckCircle className="text-emerald-400" size={48}/>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-4 leading-tight">Clinical Node Initialized.</h3>
                    <p className="text-slate-400 text-sm mb-10 font-medium px-4">Forensic data sent to the global governance network. Activation typically completes within 2-4 standard business hours.</p>
                    <button onClick={onClose} className="px-10 py-4 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/5 transition-all">Close Console</button>
                 </div>
               )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- MAIN PORTFOLIO ECOSYSTEM ---
export default function App() {
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollY, setScrollY] = useState(0);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [appStatus, setAppStatus] = useState(localStorage.getItem('hospyn_app_state') || 'unregistered');

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCta = () => {
    if (appStatus === 'unregistered') {
      setIsWizardOpen(true);
    } else {
      alert("NODE_STATUS_LOCKED: Your clinical node is undergoing forensic validation by the governance layer.");
    }
  };

  return (
    <div className="bg-[#020617] text-white overflow-hidden font-outfit selection:bg-cyan-500/30">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 z-50 w-full backdrop-blur-xl bg-black/40 border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <motion.div 
            className="text-3xl font-black bg-gradient-to-r from-cyan-400 via-white to-emerald-400 bg-clip-text text-transparent flex items-center gap-3 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            onClick={() => setCurrentPage(1)}
          >
            <Shield className="text-cyan-400" size={32}/> HOSPYN<span className="text-cyan-400">.</span>
          </motion.div>
          
          <div className="flex gap-10 items-center">
            {['Hero', 'Services', 'Network', 'Vision'].map((name, idx) => (
              <motion.button
                key={idx}
                onClick={() => { setCurrentPage(idx + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`text-[10px] font-black uppercase tracking-[0.3em] transition-all relative py-2 ${currentPage === idx + 1 ? 'text-cyan-400' : 'text-slate-500 hover:text-cyan-300'}`}
              >
                {name}
                {currentPage === idx + 1 && (
                    <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
                )}
              </motion.button>
            ))}
            <button 
              onClick={handleCta}
              className={`ml-6 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 ${appStatus === 'pending' ? 'bg-emerald-500 text-black shadow-emerald-500/20' : 'bg-white text-black hover:bg-cyan-400 shadow-white/10'}`}
            >
              {appStatus === 'pending' ? 'Tracking Node' : 'Activate Node'}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* PAGE 1: HERO (REFINED) */}
      {currentPage === 1 && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 relative overflow-hidden flex items-center">
          {/* Neural Grid Overlay */}
          <div className="absolute inset-0 z-0">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse-slow" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#06b6d4 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-8 py-20 text-center">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block px-5 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 mb-10 shadow-lg shadow-cyan-500/5"
            >
              <span className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.4em]">Sovereign Healthcare Grid v2.0</span>
            </motion.div>

            <motion.h1 
                className="text-[5rem] md:text-[8rem] font-black mb-10 leading-[0.85] tracking-[-0.05em] outfit"
                initial={{ opacity: 0, y: 50 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
              <span className="bg-gradient-to-r from-white via-cyan-100 to-emerald-200 bg-clip-text text-transparent">Connecting Healthcare</span><br/>
              <span className="text-slate-700">Beyond Hospitals.</span>
            </motion.h1>

            <motion.p 
                className="text-xl text-slate-400 max-w-3xl mx-auto mb-16 font-medium leading-relaxed"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
              Hospyn transforms fragmented medical data into one intelligent connected ecosystem for patients, hospitals, doctors, and families. Built on a zero-latency clinical grid for the future of human longevity.
            </motion.p>

            <motion.div 
                className="flex flex-col sm:flex-row gap-6 justify-center mb-24"
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
            >
              <button onClick={handleCta} className="px-12 py-6 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-2xl font-black text-xs tracking-[0.2em] uppercase hover:shadow-[0_0_50px_rgba(6,182,212,0.4)] transition-all hover:scale-105 active:scale-95 text-black">
                {appStatus === 'pending' ? 'Monitor Activation' : 'Initialize Ecosystem'}
              </button>
              <button className="px-12 py-6 border border-white/10 rounded-2xl font-black text-xs tracking-[0.2em] uppercase hover:bg-white/5 transition-all text-white backdrop-blur-md">
                View Infrastructure
              </button>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-5xl mx-auto">
               {[
                 { label: 'Latency', value: '<100ms' },
                 { label: 'Ecosystem', value: 'Unified' },
                 { label: 'Privacy', value: 'Forensic' },
                 { label: 'Security', value: 'RS256' }
               ].map((stat, idx) => (
                 <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + (idx * 0.1) }}
                    className="p-10 rounded-[32px] border border-white/5 bg-white/[0.01] backdrop-blur-3xl group hover:border-cyan-500/20 transition-all"
                 >
                    <p className="text-3xl font-black text-white mb-2 outfit tracking-tighter group-hover:text-cyan-400 transition-colors">{stat.value}</p>
                    <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                 </motion.div>
               ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* PAGE 2: SERVICES (REFINED) */}
      {currentPage === 2 && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-40 pb-20 px-8 max-w-7xl mx-auto">
          <div className="text-center mb-24">
             <div className="px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-cyan-400 inline-block mb-6 uppercase tracking-[0.3em]">Operational Intelligence</div>
             <h2 className="text-6xl font-black mb-8 tracking-tighter outfit leading-[1.1]">Inside the <br/> Healthcare Engine.</h2>
             <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">A complete architecture of interconnected clinical protocols designed for maximum throughput and medical accuracy.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Users, title: 'Patient Grid', desc: 'Unified profiles with high-fidelity forensic history and digital passport auth.', color: 'text-cyan-400' },
              { icon: Zap, title: 'Clinical Scheduler', desc: 'AI-optimized resource allocation across surgical and OPD departments.', color: 'text-amber-400' },
              { icon: Shield, title: 'Medical Ledger', desc: 'Secure, immutable access to clinical documents via Secure Enclave technology.', color: 'text-emerald-400' },
              { icon: Heart, title: 'Care Circles', desc: 'Decentralized family coordination layers for real-time health updates.', color: 'text-rose-400' },
              { icon: Brain, title: 'AI Triage', desc: 'Neural-pathway diagnostic assistance for clinical decision support.', color: 'text-indigo-400' },
              { icon: Server, title: 'Sovereign Node', desc: 'Global cloud scalability with zero-trust clinical data isolation.', color: 'text-slate-400' }
            ].map((service, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group p-12 rounded-[40px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] hover:border-cyan-500/20 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform ${service.color}`}>
                    <service.icon size={28} />
                </div>
                <h3 className="text-2xl font-black mb-4 outfit">{service.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-10 font-medium">{service.desc}</p>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                   <motion.div className={`h-full bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)]`} initial={{ width: 0 }} whileInView={{ width: '100%' }} transition={{ duration: 1.5, delay: 0.5 }}/>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* PAGE 3: NETWORK (THE LIVING HEALTHCARE NETWORK - MERGED FROM DOWNLOADS) */}
      {currentPage === 3 && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-40 pb-20 px-8 max-w-7xl mx-auto">
           <div className="text-center mb-24">
              <h2 className="text-7xl font-black mb-10 tracking-tighter outfit bg-gradient-to-r from-emerald-400 via-white to-cyan-400 bg-clip-text text-transparent">The Living Healthcare Network.</h2>
              <p className="text-slate-500 text-lg font-medium">Every clinical participant synchronized in real-time via the Hospyn Grid.</p>
           </div>
           
           <div className="glass-card p-20 rounded-[60px] border border-white/5 bg-white/[0.01] relative overflow-hidden min-h-[600px] flex items-center justify-center">
              <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#06b6d4 2px, transparent 2px)', backgroundSize: '40px 40px' }} />
              
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 600">
                <defs>
                  <filter id="node-glow">
                    <feGaussianBlur stdDeviation="8" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
                  </linearGradient>
                </defs>

                {/* Central Protocol Node */}
                <motion.circle 
                    cx="500" cy="300" r="80" fill="#06b6d4" fillOpacity="0.05" stroke="#06b6d4" strokeWidth="1" strokeDasharray="10 5"
                    animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                />
                <circle cx="500" cy="300" r="60" fill="#06b6d4" fillOpacity="0.1" filter="url(#node-glow)" />
                <text x="500" y="308" textAnchor="middle" fill="#06b6d4" className="text-[12px] font-black tracking-[0.5em] uppercase" style={{ fontSize: '10px' }}>HOSPYN</text>

                {/* Connected Clinical Pillars */}
                {[
                  { x: 150, y: 150, label: 'Patients', icon: Users, color: '#06b6d4' },
                  { x: 850, y: 150, label: 'Hospitals', icon: Globe, color: '#10b981' },
                  { x: 200, y: 450, label: 'Doctors', icon: Activity, color: '#06b6d4' },
                  { x: 800, y: 450, label: 'Families', icon: Heart, color: '#10b981' },
                  { x: 500, y: 80, label: 'Diagnostics', icon: Brain, color: '#06b6d4' },
                  { x: 500, y: 520, label: 'Pharmacy', icon: Server, color: '#10b981' },
                ].map((node, idx) => (
                  <g key={idx}>
                    {/* Dynamic Connection Lines */}
                    <motion.line
                      x1="500" y1="300"
                      x2={node.x} y2={node.y}
                      stroke="url(#line-grad)"
                      strokeWidth="2"
                      initial={{ pathLength: 0, opacity: 0 }}
                      whileInView={{ pathLength: 1, opacity: 0.3 }}
                      transition={{ delay: idx * 0.2, duration: 2 }}
                    />
                    
                    {/* Node Visuals */}
                    <motion.circle 
                        cx={node.x} cy={node.y} r="50" fill={node.color} fillOpacity="0.03" stroke={node.color} strokeWidth="1"
                        whileHover={{ scale: 1.1, fillOpacity: 0.1 }}
                    />
                    <circle cx={node.x} cy={node.y} r="40" fill="none" stroke={node.color} strokeWidth="2" strokeOpacity="0.2" />
                    <text x={node.x} y={node.y + 5} textAnchor="middle" fill={node.color} className="text-[10px] font-black uppercase tracking-widest" style={{ fontSize: '9px' }}>{node.label}</text>
                    
                    {/* Animated Data Packets */}
                    <motion.circle
                        r="3" fill={node.color}
                        animate={{
                          cx: [500, node.x, 500],
                          cy: [300, node.y, 300],
                          opacity: [0, 1, 0]
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          delay: idx * 0.8,
                          ease: 'easeInOut'
                        }}
                    />
                  </g>
                ))}
              </svg>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-12 relative z-10 w-full px-12 mt-[450px]">
                  {[
                    { label: 'Patient Access', val: 'Direct' },
                    { label: 'Node Sync', val: 'Global' },
                    { label: 'Latency', val: '10ms' },
                    { label: 'Uptime', val: '99.99%' }
                  ].map((stat, i) => (
                      <div key={i} className="text-center">
                          <p className="text-2xl font-black text-white mb-1 outfit">{stat.val}</p>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
                      </div>
                  ))}
              </div>
           </div>
        </motion.section>
      )}

      {/* PAGE 4: VISION (REFINED) */}
      {currentPage === 4 && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-40 pb-20 px-8 max-w-7xl mx-auto">
           <div className="grid lg:grid-cols-2 gap-20 mb-32 items-center">
              <div className="p-16 rounded-[60px] border border-white/5 bg-white/[0.01] backdrop-blur-3xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
                 <h2 className="text-5xl font-black mb-10 tracking-tighter outfit leading-tight">The Story <br/> Behind Hospyn.</h2>
                 <p className="text-slate-400 text-lg leading-relaxed mb-8 font-medium">Healthcare systems were built in fragments. Hospitals operate in silos. Doctors lack real-time context. Families are left in the dark during clinical transitions.</p>
                 <p className="text-white text-2xl font-black outfit leading-relaxed">Hospyn was born from a singular mission: to create a forensic clinical grid that connects every participant, every decision, and every medical life.</p>
              </div>
              
              <div className="space-y-8">
                 {[
                   { year: '2025', title: 'Forensic Ledger', desc: 'Implementation of the first immutable clinical audit trail for global hospitals.' },
                   { year: '2026', title: 'Neural Triage', desc: 'Predictive health analytics enabling pre-hospital intervention protocols.' },
                   { year: '2027', title: 'National Infrastructure', desc: 'Unified cross-border clinical data exchange nodes for sovereign health.' }
                 ].map((item, idx) => (
                   <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.2 }}
                    className="p-10 rounded-[40px] border border-white/5 bg-white/[0.01] hover:border-emerald-500/30 transition-all group"
                   >
                      <p className="text-emerald-400 font-black text-xs mb-4 tracking-[0.4em]">{item.year} MILESTONE</p>
                      <h4 className="text-2xl font-black mb-3 outfit">{item.title}</h4>
                      <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
                   </motion.div>
                 ))}
              </div>
           </div>

           <motion.div 
            className="p-24 rounded-[80px] border border-cyan-500/40 bg-gradient-to-br from-cyan-500/20 via-black to-emerald-500/20 text-center relative overflow-hidden group shadow-2xl shadow-cyan-500/10" 
            whileInView={{ scale: 1 }} initial={{ scale: 0.95 }}
           >
              <div className="absolute inset-0 bg-black opacity-40 group-hover:opacity-20 transition-opacity" />
              <div className="relative z-10">
                 <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-10 border border-white/10 group-hover:scale-110 transition-transform">
                    <Zap className="text-cyan-400" size={40} />
                 </div>
                 <h2 className="text-7xl font-black mb-8 tracking-tighter outfit">The Future of <br/> Healthcare Starts Here.</h2>
                 <p className="text-slate-400 text-xl mb-16 max-w-3xl mx-auto font-medium">Infrastructure for a smarter, faster, and more human medical future. Initialize your sovereign node today.</p>
                 <button onClick={handleCta} className="px-16 py-8 bg-white text-black font-black uppercase tracking-[0.4em] text-[12px] rounded-[32px] hover:bg-cyan-400 transition-all hover:scale-110 active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                   {appStatus === 'pending' ? 'Tracking Node Activation' : 'Initialize Clinical Node'}
                 </button>
              </div>
           </motion.div>
        </motion.section>
      )}

      {/* PROVISIONING MODAL */}
      <ActivationWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        onRegisterSuccess={() => setAppStatus('pending')}
      />

      <footer className="py-24 border-t border-white/5 text-center relative overflow-hidden bg-black">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-20" />
         <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-500 mb-8">© 2026 Hospyn Sovereign Grid. Forensic Intelligence Protocol.</p>
         <div className="flex justify-center gap-12 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
            <a href="#" className="hover:text-cyan-400 transition-colors">Forensic Security</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Privacy Matrix</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Grid Infrastructure</a>
         </div>
      </footer>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;500;900&display=swap');
        .outfit { font-family: 'Outfit', sans-serif; }
        .animate-pulse-slow { animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.1; scale: 1; } 50% { opacity: 0.3; scale: 1.1; } }
      `}</style>
    </div>
  );
}

// Custom Activity Icon
const Activity = (props) => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
