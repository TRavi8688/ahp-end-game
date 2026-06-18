import React from 'react';
import { motion } from 'framer-motion';
import { Target, Compass, Rocket, Shield, Lock, Globe, ArrowRight } from 'lucide-react';

const roadmap = [
  { year: '2026', title: 'Sovereign Launch', desc: 'Activating the first 500 clinical nodes across the primary grid.' },
  { year: '2027', title: 'AI Diagnostics', desc: 'Integrating predictive pathology and imaging stratification engines.' },
  { year: '2028', title: 'National Infrastructure', desc: 'Deploying the Hospyn protocol as a sovereign health backbone.' },
  { year: '2029', title: 'Predictive Emergency', desc: 'AI-assisted city-wide emergency response and coordination.' },
];

const Vision = () => {
  return (
    <div className="pt-44 pb-32 px-6 max-w-7xl mx-auto relative z-10">
      <header className="mb-24 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="badge-futuristic"
        >
          Our Deeper Purpose
        </motion.div>
        <h2 className="text-5xl md:text-7xl font-black outfit tracking-tighter premium-gradient-text mb-6">
          The Future of Health.
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
          Hospyn was built to reduce the chaos in modern healthcare and return the focus to what matters most: human life.
        </p>
      </header>

      {/* Story & Mission */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 mb-32">
         <div className="space-y-10">
            <div className="flex gap-6 items-start">
               <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Compass className="text-primary" />
               </div>
               <div>
                  <h3 className="text-2xl font-black outfit text-white mb-4">The Story Behind Hospyn</h3>
                  <p className="text-slate-500 leading-relaxed">Hospyn was born from a simple observation: Healthcare is broken because it is disconnected. We saw families struggle with paper records and doctors overwhelmed by fragmented systems. We decided to build a billion-dollar OS for life.</p>
               </div>
            </div>
            <div className="flex gap-6 items-start">
               <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                  <Target className="text-secondary" />
               </div>
               <div>
                  <h3 className="text-2xl font-black outfit text-white mb-4">Our Core Mission</h3>
                  <p className="text-slate-500 leading-relaxed">"Healthcare should feel connected, not complicated." Our mission is to synchronize the global medical infrastructure into a single, high-fidelity intelligence grid.</p>
               </div>
            </div>
         </div>
         <div className="glass-card p-12 flex flex-col justify-center">
            <h4 className="badge-futuristic mb-6">Privacy-First</h4>
            <h3 className="text-4xl font-black outfit text-white mb-8 tracking-tighter">Security & Trust.</h3>
            <div className="space-y-6">
               <div className="flex items-center gap-4 text-slate-300">
                  <Shield size={20} className="text-primary" />
                  <span>Enterprise-grade security architecture</span>
               </div>
               <div className="flex items-center gap-4 text-slate-300">
                  <Lock size={20} className="text-primary" />
                  <span>End-to-end medical data encryption</span>
               </div>
               <div className="flex items-center gap-4 text-slate-300">
                  <Globe size={20} className="text-primary" />
                  <span>Decentralized cloud node reliability</span>
               </div>
            </div>
         </div>
      </div>

      {/* Roadmap */}
      <div className="mb-44">
         <h3 className="text-4xl font-black outfit text-center text-white mb-20 tracking-tighter">The Roadmap Ahead.</h3>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {roadmap.map((item, i) => (
              <div key={i} className="relative pt-12 group">
                 <div className="absolute top-0 left-0 text-5xl font-black outfit text-white/5 group-hover:text-primary/10 transition-colors">{item.year}</div>
                 <div className="relative z-10">
                    <h5 className="text-lg font-black outfit text-white mb-3 group-hover:text-primary transition-colors">{item.title}</h5>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* Cinematic Ending */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        className="glass-card p-20 text-center relative overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5"
      >
         <div className="absolute inset-0 neural-grid opacity-30" />
         <div className="relative z-10">
            <h2 className="text-5xl md:text-7xl font-black outfit tracking-tighter text-white mb-8">
              The Future of Healthcare <br /> Starts with Connection.
            </h2>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto mb-12 font-medium">
              Hospyn is building the infrastructure for a smarter, faster, and more human healthcare future.
            </p>
            <button className="btn-premium flex items-center gap-3 mx-auto">
               Join the Revolution <ArrowRight size={16} />
            </button>
         </div>
      </motion.div>
    </div>
  );
};

export default Vision;
