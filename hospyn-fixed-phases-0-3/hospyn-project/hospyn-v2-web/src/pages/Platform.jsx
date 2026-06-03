import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Calendar, Database, Heart, Zap, Brain, LayoutDashboard, Lock, Bell, Globe, ArrowRight 
} from 'lucide-react';

const services = [
  { icon: Users, name: 'Patient Management', desc: 'Holistic profile orchestration for lifelong medical journey tracking.' },
  { icon: Calendar, name: 'Smart Appointment', desc: 'AI-driven queue optimization and zero-wait clinical scheduling.' },
  { icon: Database, name: 'Digital Medical Records', desc: 'Forensic-grade encryption for immutable medical history storage.' },
  { icon: Heart, name: 'Family Care Circle', desc: 'Integrated health monitoring for the entire household ecosystem.' },
  { icon: Zap, name: 'Emergency Access', desc: 'Instant node activation for critical life-saving coordination.' },
  { icon: Brain, name: 'AI Health Insights', desc: 'Predictive analytics engine for early risk stratification.' },
  { icon: LayoutDashboard, name: 'Workflow Automation', desc: 'Synchronizing staff, pharmacy, and lab operations.' },
  { icon: Lock, name: 'Secure Auth System', desc: 'Identity protection via sovereign clinical authentication.' },
  { icon: Bell, name: 'Real-Time Sync', desc: 'Zero-latency notifications across the global healthcare grid.' },
  { icon: Globe, name: 'Cloud Infrastructure', desc: 'Enterprise-grade reliability on a decentralized cloud mesh.' },
];

const ServiceCard = ({ service, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className="glass-card p-10 group hover:border-primary/50 relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
    <div className="w-16 h-16 rounded-[22px] bg-white/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
      <service.icon className="text-primary" size={28} />
    </div>
    <h3 className="text-2xl font-black outfit text-white mb-4 tracking-tight">{service.name}</h3>
    <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">{service.desc}</p>
    <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary group-hover:gap-4 transition-all">
       Details <ArrowRight size={14} />
    </button>
  </motion.div>
);

const Platform = () => {
  return (
    <div className="pt-44 pb-32 px-6 max-w-7xl mx-auto relative z-10">
      <header className="mb-24 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="badge-futuristic"
        >
          Operational Intelligence
        </motion.div>
        <h2 className="text-5xl md:text-7xl font-black outfit tracking-tighter premium-gradient-text mb-6">
          The Healthcare Engine.
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
          A multi-layered ecosystem designed for enterprise-grade hospital operations and patient-centric care.
        </p>
      </header>

      {/* Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32">
        {services.map((service, i) => (
          <ServiceCard key={i} service={service} index={i} />
        ))}
      </div>

      {/* Dashboard Previews */}
      <div className="space-y-32">
        {[
          { 
            title: 'Patient Intelligence', 
            subtitle: 'Patient App UI', 
            img: 'https://img.freepik.com/free-vector/health-app-interface-template-set_23-2148530368.jpg',
            desc: 'A futuristic mobile experience for families to track medical journey progress in real-time.'
          },
          { 
            title: 'Hospital Command', 
            subtitle: 'Admin Panel Portfolio', 
            img: 'https://img.freepik.com/free-vector/gradient-dashboard-ui-ux-design-template_23-2149176885.jpg',
            desc: 'Centralized oversight for hospital owners to manage staff, revenue, and clinical flow.'
          }
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            className={`flex flex-col lg:flex-row items-center gap-20 ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}
          >
            <div className="flex-1">
               <h4 className="badge-futuristic mb-6">{item.subtitle}</h4>
               <h3 className="text-4xl font-black outfit text-white mb-8 tracking-tighter">{item.title}</h3>
               <p className="text-slate-400 text-lg font-medium leading-relaxed mb-10">{item.desc}</p>
               <button className="btn-outline">Explore Interface Workflow</button>
            </div>
            <div className="flex-1 w-full glass-card overflow-hidden group">
               <img src={item.img} alt={item.title} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2000ms]" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Platform;
