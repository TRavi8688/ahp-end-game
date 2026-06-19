import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, XCircle, Zap, Users, Globe, Activity, Heart, ArrowRight } from 'lucide-react';

const Network = () => {
  return (
    <div className="pt-44 pb-32 px-6 max-w-7xl mx-auto relative z-10">
      <header className="mb-24 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="badge-futuristic"
        >
          Sovereign Connectivity
        </motion.div>
        <h2 className="text-5xl md:text-7xl font-black outfit tracking-tighter premium-gradient-text mb-6">
          The Living Network.
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
          Hospyn creates a living healthcare network where every participant is synchronized via a forensic clinical grid.
        </p>
      </header>

      {/* Ecosystem Map Visualization */}
      <div className="relative h-[600px] glass-card mb-32 flex items-center justify-center overflow-hidden">
         <div className="absolute inset-0 neural-grid opacity-20" />
         <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            {[
              { icon: Users, label: 'Patients' },
              { icon: Globe, label: 'Hospitals' },
              { icon: Activity, label: 'Doctors' },
              { icon: Heart, label: 'Families' },
            ].map((node, i) => (
              <motion.div 
                key={i}
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, delay: i * 0.5 }}
                className="flex flex-col items-center gap-4"
              >
                 <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <node.icon className="text-primary" size={32} />
                 </div>
                 <span className="text-sm font-black outfit text-white uppercase tracking-widest">{node.label}</span>
              </motion.div>
            ))}
         </div>
         {/* Simulated connection lines */}
         <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <motion.path 
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              transition={{ duration: 2 }}
              d="M 300 300 Q 400 100 500 300" 
              stroke="rgba(0, 242, 255, 0.2)" 
              strokeWidth="2" 
              fill="none" 
            />
         </svg>
      </div>

      {/* Comparison Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-32">
         <div className="glass-card p-12 bg-rose-500/[0.02] border-rose-500/10">
            <h3 className="text-3xl font-black outfit text-rose-500 mb-8 tracking-tighter">Traditional Fragmentation</h3>
            <div className="space-y-6">
               {[
                 'Disconnected medical records',
                 'Extended waiting times for audit',
                 'Poor clinical communication flow',
                 'Delayed emergency response signals'
               ].map((text, i) => (
                 <div key={i} className="flex items-center gap-4 text-slate-500">
                    <XCircle size={18} className="text-rose-500/50" />
                    <span className="text-sm font-medium">{text}</span>
                 </div>
               ))}
            </div>
         </div>
         <div className="glass-card p-12 bg-primary/[0.02] border-primary/10">
            <h3 className="text-3xl font-black outfit text-primary mb-8 tracking-tighter">Hospyn Sovereign Grid</h3>
            <div className="space-y-6">
               {[
                 'Unified healthcare intelligence',
                 'Instant medical record activation',
                 'Secure real-time node coordination',
                 'AI-assisted emergency workflows'
               ].map((text, i) => (
                 <div key={i} className="flex items-center gap-4 text-slate-200">
                    <ShieldCheck size={18} className="text-primary" />
                    <span className="text-sm font-medium">{text}</span>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Scenario Storytelling */}
      <div className="space-y-8">
         <h4 className="badge-futuristic mx-auto">Network Scenarios</h4>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Emergency Response', desc: 'Instant node activation when a family member triggers a SOS signal.' },
              { title: 'Family Coordination', desc: 'Real-time updates to the Care Circle during critical surgery phases.' },
              { title: 'Smart Referral', desc: 'Seamless data flow between rural clinics and specialized medical centers.' },
            ].map((scen, i) => (
              <div key={i} className="glass-card p-8 hover:bg-white/5 transition-colors">
                 <h5 className="text-lg font-black outfit text-white mb-4">{scen.title}</h5>
                 <p className="text-slate-500 text-sm leading-relaxed">{scen.desc}</p>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default Network;
