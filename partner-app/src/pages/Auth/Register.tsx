import React, { useState } from 'react';
import { UploadCloud, Building2, Mail, Phone, Lock, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'pharmacy',
    email: '',
    phone: '',
    password: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Registration Data:', formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-4xl animate-slide-up">
        <div className="glass-panel p-8 sm:p-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">Join Hospyn Partner Network</h1>
            <p className="text-slate-400 text-lg">Expand your reach and streamline operations by joining our unified healthcare ecosystem.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Business Details */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Business Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Business Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-slate-500" />
                    </div>
                    <input 
                      type="text" 
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      className="glass-input pl-11" 
                      placeholder="e.g. HealthPlus Pharmacy" 
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Business Type</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Activity className="h-5 w-5 text-slate-500" />
                    </div>
                    <select 
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleChange}
                      className="glass-input pl-11 appearance-none bg-slate-950" 
                    >
                      <option value="pharmacy">Pharmacy</option>
                      <option value="laboratory">Laboratory</option>
                      <option value="clinic">Clinic</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Contact & Auth Details */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Contact & Account Details
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-500" />
                    </div>
                    <input 
                      type="email" 
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="glass-input pl-11" 
                      placeholder="admin@business.com" 
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-500" />
                    </div>
                    <input 
                      type="tel" 
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="glass-input pl-11" 
                      placeholder="+1 (555) 000-0000" 
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500" />
                    </div>
                    <input 
                      type="password" 
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="glass-input pl-11" 
                      placeholder="Create a strong password" 
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Document Verification */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Document Verification
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Zone 1 */}
                <div className="glass-card p-6 border-dashed border-2 border-slate-700 hover:border-primary/50 flex flex-col items-center justify-center text-center cursor-pointer group">
                  <div className="h-14 w-14 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                    <UploadCloud className="h-7 w-7 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">Medical License / Permit</h3>
                  <p className="text-xs text-slate-400">PDF, JPG or PNG (Max 5MB)</p>
                  <button type="button" className="mt-4 text-xs text-primary font-medium bg-primary/10 px-4 py-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                    Browse Files
                  </button>
                </div>

                {/* Upload Zone 2 */}
                <div className="glass-card p-6 border-dashed border-2 border-slate-700 hover:border-primary/50 flex flex-col items-center justify-center text-center cursor-pointer group">
                  <div className="h-14 w-14 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                    <UploadCloud className="h-7 w-7 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">Government ID of Owner</h3>
                  <p className="text-xs text-slate-400">PDF, JPG or PNG (Max 5MB)</p>
                  <button type="button" className="mt-4 text-xs text-primary font-medium bg-primary/10 px-4 py-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                    Browse Files
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <button type="submit" className="glass-button w-full text-lg py-4 flex items-center justify-center gap-2">
                Submit Registration
                <CheckCircle2 className="h-6 w-6" />
              </button>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  Already a partner?{' '}
                  <Link to="/login" className="text-primary font-medium hover:text-primary-400 hover:underline transition-all">
                    Sign in to your account
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Simple mock for Activity icon if it's missing in imports above
const Activity = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);

export default Register;
