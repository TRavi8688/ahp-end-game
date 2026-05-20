import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Activity, 
  Bed, 
  FlaskConical, 
  Package, 
  CreditCard, 
  Users, 
  GitBranch, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import { useNavigate } from 'react-router-dom';

const SetupServices = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Module selections
  const [modules, setModules] = useState({
    enable_pharmacy: false,
    enable_labs: false,
    enable_inpatient_beds: false,
    enable_hr: false,
    enable_billing: true,
    max_beds_configured: 0,
    has_multiple_branches: false,
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/hospital-settings/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // If settings already exist and are configured, pre-populate
        if (res.data && res.data.id) {
          setModules({
            enable_pharmacy: res.data.enable_pharmacy,
            enable_labs: res.data.enable_labs,
            enable_inpatient_beds: res.data.enable_inpatient_beds,
            enable_hr: res.data.enable_hr,
            enable_billing: res.data.enable_billing,
            max_beds_configured: res.data.max_beds_configured,
            has_multiple_branches: res.data.has_multiple_branches,
          });
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
        setError("Unable to retrieve current settings. You can still set them up below.");
      } finally {
        setFetching(false);
      }
    };

    if (token) {
      fetchSettings();
    } else {
      navigate('/login');
    }
  }, [token, navigate]);

  const handleToggle = (key) => {
    setModules(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleBedChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setModules(prev => ({
      ...prev,
      max_beds_configured: val
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/hospital-settings/`, modules, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Store in localStorage for instant retrieval across the app
      localStorage.setItem('hospitalSettings', JSON.stringify(res.data));
      setSuccess(true);
      
      // Redirect after showing success state
      setTimeout(() => {
        navigate('/clinical');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update hospital settings.");
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 }
  };

  const appCards = [
    {
      key: 'enable_billing',
      title: 'Financial Ledger & Billing',
      desc: 'Process invoices, record digital payments, track credit and tax operations.',
      icon: CreditCard,
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30',
      activeColor: 'bg-emerald-500/15 border-emerald-500 text-emerald-400',
      tag: 'FINANCIAL'
    },
    {
      key: 'enable_pharmacy',
      title: 'Pharmacy & Dispensary Stock',
      desc: 'Track batches, low stock warnings, drug expiry dates and handle sales.',
      icon: Package,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30',
      activeColor: 'bg-amber-500/15 border-amber-500 text-amber-400',
      tag: 'INVENTORY'
    },
    {
      key: 'enable_labs',
      title: 'Diagnostic Labs',
      desc: 'Manage diagnostic testing orders, upload results, and sync clinical records.',
      icon: FlaskConical,
      color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30',
      activeColor: 'bg-cyan-500/15 border-cyan-500 text-cyan-400',
      tag: 'DIAGNOSTIC'
    },
    {
      key: 'enable_inpatient_beds',
      title: 'Inpatient Beds & Ward Management',
      desc: 'Monitor ward occupancy, assign admissions, manage bed cleanings.',
      icon: Bed,
      color: 'from-indigo-500/20 to-violet-500/10 border-indigo-500/30',
      activeColor: 'bg-indigo-500/15 border-indigo-500 text-indigo-400',
      tag: 'CLINICAL'
    },
    {
      key: 'enable_hr',
      title: 'Human Resources & Rosters',
      desc: 'Invite medical staff, assign roles, schedule duties, and track profiles.',
      icon: Users,
      color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30',
      activeColor: 'bg-purple-500/15 border-purple-500 text-purple-400',
      tag: 'MANAGEMENT'
    }
  ];

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">Initializing Setup Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white font-outfit p-8 relative overflow-hidden flex items-center justify-center">
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/5 rounded-full blur-[140px]" />
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-5xl relative z-10 my-8"
      >
        <div className="flex items-center gap-4 mb-10 justify-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 rotate-3">
            <Zap className="text-white fill-white" size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter leading-none">HOSPYN</h1>
            <span className="text-[10px] font-black text-indigo-500 tracking-[0.3em] uppercase">Intelligence Setup</span>
          </div>
        </div>

        <div className="text-center mb-12">
          <h2 className="text-4xl font-black tracking-tight text-white mb-3">Configure Your Facility Modules</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Select the services your clinic or hospital operates. We'll dynamically construct your workspace, hide unused features, and provision access controls.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {appCards.map((card) => {
              const IconComponent = card.icon;
              const isActive = modules[card.key];
              
              return (
                <motion.div
                  key={card.key}
                  variants={itemVariants}
                  whileHover={{ y: -5 }}
                  onClick={() => handleToggle(card.key)}
                  className={`glass-card p-6 border cursor-pointer rounded-[2rem] transition-all flex flex-col justify-between min-h-[220px] ${
                    isActive 
                      ? card.activeColor 
                      : `bg-slate-900/30 border-white/5 hover:border-white/10 hover:bg-slate-900/50`
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-2xl ${isActive ? 'bg-white/10' : 'bg-white/5 border border-white/5'}`}>
                        <IconComponent size={20} className={isActive ? 'text-white' : 'text-slate-400'} />
                      </div>
                      <span className={`text-[8px] font-black tracking-widest px-2.5 py-1 rounded-full ${
                        isActive ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {card.tag}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/20'
                    }`}>
                      {isActive && <CheckCircle2 size={14} className="fill-white text-indigo-600" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Extra configuration settings block */}
            <motion.div
              variants={itemVariants}
              className="glass-card p-6 bg-slate-900/30 border border-white/5 rounded-[2rem] flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                    <GitBranch size={20} className="text-slate-400" />
                  </div>
                  <span className="text-[8px] font-black tracking-widest px-2.5 py-1 rounded-full bg-slate-800 text-slate-500">
                    NETWORK
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">Branches & Scale</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Operate multiple clinics or branches? Enable multi-tenant routing for staff and resource sharing.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Multi-Branch Mode</span>
                <button
                  type="button"
                  onClick={() => handleToggle('has_multiple_branches')}
                  className={`w-11 h-6 rounded-full p-1 transition-all ${
                    modules.has_multiple_branches ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                    modules.has_multiple_branches ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Conditional Bed Configuration */}
          <AnimatePresence>
            {modules.enable_inpatient_beds && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="glass-card p-8 bg-indigo-950/20 border border-indigo-500/20 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Inpatient Capacity Provisioning</h3>
                    <p className="text-xs text-indigo-300 max-w-xl">
                      Define the limit of total physical beds configurable in your wards. You can scale this up at any time.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] font-black text-indigo-400 tracking-wider uppercase">Beds Limit</label>
                    <input 
                      type="number" 
                      min="0"
                      value={modules.max_beds_configured}
                      onChange={handleBedChange}
                      className="w-28 bg-black/40 border border-indigo-500/30 rounded-xl py-3 px-4 text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 text-center font-bold" 
                      placeholder="e.g. 50"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-center pt-6 gap-6 border-t border-white/5">
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise Architecture Security</span>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-10 rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : success ? (
                <>
                  <span>Workspace Ready!</span>
                  <CheckCircle2 size={16} />
                </>
              ) : (
                <>
                  <span>Build My Workspace</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SetupServices;
