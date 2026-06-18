import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Globe, Shield, Activity, ArrowRight, MousePointer2 } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-6 flex items-center gap-4 group hover:border-primary/30 transition-all duration-500"
  >
    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
      <Icon className="text-primary" size={24} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
      <p className="text-xl font-black outfit text-white">{value}</p>
    </div>
  </motion.div>
);

const Home = () => {
  return (
    <div className="relative min-h-screen">
      <div className="neural-grid fixed inset-0 z-0" />
      
      {/* Hero Section */}
      <section className="relative z-10 pt-44 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black tracking-[0.4em] text-primary uppercase mb-10"
        >
          Sovereign Healthcare Protocol v2.0
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-6xl md:text-8xl font-black outfit leading-[0.9] tracking-tighter mb-8 premium-gradient-text"
        >
          Connecting Healthcare <br /> Beyond Hospitals.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-slate-400 text-lg md:text-xl max-w-3xl mb-12 font-medium leading-relaxed"
        >
          Hospyn transforms fragmented medical data into one intelligent, connected ecosystem for patients, hospitals, doctors, and families. Built on a zero-latency clinical grid.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-6 mb-24"
        >
          <button className="btn-premium flex items-center gap-3">
             Explore Ecosystem <ArrowRight size={16} />
          </button>
          <button className="btn-outline">View Platform Portfolio</button>
        </motion.div>

        {/* Floating Mockup / Dashboard Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, type: 'spring', damping: 15 }}
          className="w-full relative aspect-[16/9] glass-card overflow-hidden group mb-32"
        >
           <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
           <img 
            src="https://img.freepik.com/free-photo/view-futuristic-healthcare-technology-medical-treatment_23-2151040003.jpg" 
            alt="AI Dashboard Visual" 
            className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2000ms]"
           />
           <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-3xl flex items-center justify-center animate-pulse-slow">
                 <MousePointer2 className="text-primary" size={32} />
              </div>
           </div>
        </motion.div>

        {/* Animated Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-32">
          <StatCard title="Patient Access" value="Faster Access" icon={Zap} delay={1.0} />
          <StatCard title="Hospital Flow" value="Reduced Delays" icon={Activity} delay={1.1} />
          <StatCard title="Data Integrity" value="Secure Records" icon={Shield} delay={1.2} />
          <StatCard title="Intelligence" value="AI-Powered" icon={Globe} delay={1.3} />
        </div>

        {/* Trust Indicators */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="flex flex-wrap justify-center gap-12 text-slate-600 font-black uppercase tracking-[0.3em] text-[9px]"
        >
          <div className="flex items-center gap-2"><Shield size={14} /> Privacy First</div>
          <div className="flex items-center gap-2"><Globe size={14} /> Global Node Network</div>
          <div className="flex items-center gap-2"><Zap size={14} /> Zero-Latency Sync</div>
          <div className="flex items-center gap-2"><Activity size={14} /> ISO 27001 Certified</div>
        </motion.div>
      </section>

      {/* Scroll Indicator */}
      <motion.div 
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-slate-500 opacity-50"
      >
        <span className="text-[9px] font-black uppercase tracking-widest">Scroll</span>
        <div className="w-0.5 h-10 bg-gradient-to-b from-primary to-transparent" />
      </motion.div>
    </div>
  );
};

export default Home;
