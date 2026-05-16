import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CreditCard, Zap, X, UploadCloud, CheckCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ActivationWizard = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    owner_email: '',
    registration_number: '',
    staff_count: ''
  });
  const [file, setFile] = useState(null);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    if (file) data.append('certificate', file);

    try {
      await axios.post(`${API_BASE_URL}/onboarding/register`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStep(3);
    } catch (err) {
      alert("Synchronization Failure: Network disruption in clinical grid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-xl overflow-y-auto"
        >
          <button 
            onClick={onClose}
            className="fixed top-10 right-10 text-white/50 hover:text-white transition-colors z-[2100]"
          >
            <X size={48} strokeWidth={1} />
          </button>

          <div className="min-h-screen flex">
            {/* Left Sidebar */}
            <div className="hidden lg:flex flex-col justify-center p-24 w-[45%] border-r border-white/5">
                <motion.div
                   initial={{ opacity: 0, x: -30 }}
                   animate={{ opacity: 1, x: 0 }}
                >
                  <div className="badge-futuristic mb-6">Node Provisioning Console</div>
                  <h2 className="text-6xl font-black outfit text-white leading-tight mb-8">
                    Activate Your <br /> Sovereign Node.
                  </h2>
                  <p className="text-slate-500 text-xl leading-relaxed mb-12">
                    To maintain clinical grid integrity, we require forensic identification and clinical verification.
                  </p>

                  <div className="space-y-10">
                    <div className="flex gap-6 items-center">
                       <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${step >= 1 ? 'bg-primary text-black' : 'bg-white/5 text-white/20'}`}>
                          <Shield size={20} />
                       </div>
                       <div>
                          <p className="font-black outfit text-white uppercase tracking-widest text-xs">Clinical Audit</p>
                          <p className="text-slate-500 text-sm">NABH / Medical License Verification</p>
                       </div>
                    </div>
                    <div className="flex gap-6 items-center">
                       <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${step >= 2 ? 'bg-primary text-black' : 'bg-white/5 text-white/20'}`}>
                          <CreditCard size={20} />
                       </div>
                       <div>
                          <p className="font-black outfit text-white uppercase tracking-widest text-xs">Identity Sync</p>
                          <p className="text-slate-500 text-sm">One-time ₹1 Security Activation</p>
                       </div>
                    </div>
                  </div>
                </motion.div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col justify-center p-10 lg:p-24 relative overflow-hidden">
               <div className="neural-grid absolute inset-0 opacity-10" />
               
               <motion.div 
                 key={step}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="relative z-10 max-w-xl w-full mx-auto"
               >
                  {step === 1 && (
                    <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <input id="name" onChange={handleInputChange} type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:border-primary outline-none transition-all" placeholder="Hospital Name" required />
                        <input id="staff_count" onChange={handleInputChange} type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:border-primary outline-none transition-all" placeholder="Staff Count" required />
                      </div>
                      <input id="owner_email" onChange={handleInputChange} type="email" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:border-primary outline-none transition-all" placeholder="Admin Gmail" required />
                      <input id="registration_number" onChange={handleInputChange} type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white focus:border-primary outline-none transition-all" placeholder="Gov Registration Number" required />

                      <button type="submit" className="btn-premium w-full !py-6 text-base">Continue to Evidence Audit</button>
                    </form>
                  )}

                  {step === 2 && (
                    <div className="space-y-8">
                       <div 
                         onClick={() => document.getElementById('fileInput').click()}
                         className="border-2 border-dashed border-white/10 rounded-3xl p-16 text-center cursor-pointer hover:border-primary/50 transition-all group"
                       >
                          <UploadCloud className="mx-auto text-slate-500 group-hover:text-primary transition-colors mb-4" size={48} />
                          <p className="text-white font-black outfit uppercase tracking-widest text-sm mb-2">Upload Clinical Evidence</p>
                          <p className="text-slate-500 text-xs">PDF or Image of Hospital Registration Certificate</p>
                          <input id="fileInput" type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                          {file && <p className="mt-4 text-primary font-black text-xs uppercase tracking-widest">Selected: {file.name}</p>}
                       </div>
                       <button 
                        onClick={handleRegistration}
                        disabled={!file || loading}
                        className="btn-premium w-full !py-6 text-base disabled:opacity-50"
                       >
                          {loading ? 'SYNCHRONIZING WITH LEDGER...' : 'Initialize Activation'}
                       </button>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="text-center">
                       <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-8 border border-accent/30"
                       >
                          <CheckCircle className="text-accent" size={48} />
                       </motion.div>
                       <h3 className="text-4xl font-black outfit text-white mb-6 tracking-tighter">Node Initialized.</h3>
                       <p className="text-slate-500 text-lg leading-relaxed mb-10">Your clinical application has been sent to the Super Admin Audit queue. Provisioning will begin in 2-4 hours.</p>
                       <button onClick={onClose} className="btn-premium">Return to Ecosystem</button>
                    </div>
                  )}
               </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ActivationWizard;
