// partner-app/src/pages/Auth/Register.tsx
//
// BUG FIX: handleSubmit only did console.log. It never called the backend.
// BUG FIX: 'Activity' icon used but not imported from lucide-react (runtime crash).
// Now wired to POST /api/v1/partner/auth/register with proper error handling.

import React, { useState } from 'react';
import { UploadCloud, Building2, Mail, Phone, Lock, FileText, ArrowRight, CheckCircle2, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'pharmacy',
    email: '',
    phone: '',
    password: '',
  });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // BUG FIX: Was console.log only. Now calls backend.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.post('/api/v1/partner/auth/register', {
        name:           formData.businessName,
        email:          formData.email,
        password:       formData.password,
        phone:          formData.phone,
        business_type:  formData.businessType,
      });
      setSuccess(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center glass-panel p-10 animate-slide-up">
          <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-3">Application Submitted!</h2>
          <p className="text-slate-400 mb-8">
            Our team will review your application and contact you within 1–2 business days.
          </p>
          <button onClick={() => navigate('/login')} className="glass-button w-full">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-4xl animate-slide-up">
        <div className="glass-panel p-8 sm:p-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">Join Hospyn Partner Network</h1>
            <p className="text-slate-400 text-lg">Expand your reach and streamline operations by joining our unified healthcare ecosystem.</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Business Details */}
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
                    <input type="text" name="businessName" value={formData.businessName} onChange={handleChange}
                      className="glass-input pl-11" placeholder="e.g. HealthPlus Pharmacy" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Business Type</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Activity className="h-5 w-5 text-slate-500" />  {/* BUG FIX: now properly imported */}
                    </div>
                    <select name="businessType" value={formData.businessType} onChange={handleChange}
                      className="glass-input pl-11 appearance-none bg-slate-950">
                      <option value="pharmacy">Pharmacy</option>
                      <option value="laboratory">Laboratory</option>
                      <option value="clinic">Clinic</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact & Auth */}
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
                    <input type="email" name="email" value={formData.email} onChange={handleChange}
                      className="glass-input pl-11" placeholder="admin@business.com" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-500" />
                    </div>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                      className="glass-input pl-11" placeholder="+91 98765 43210" required />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider pl-1">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500" />
                    </div>
                    <input type="password" name="password" value={formData.password} onChange={handleChange}
                      className="glass-input pl-11" placeholder="Create a strong password (min 8 chars)"
                      minLength={8} required />
                  </div>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Document Verification
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Medical License / Permit',  desc: 'PDF, JPG or PNG (Max 5MB)' },
                  { label: 'Government ID of Owner',    desc: 'PDF, JPG or PNG (Max 5MB)' },
                ].map(({ label, desc }) => (
                  <div key={label}
                    className="glass-card p-6 border-dashed border-2 border-slate-700 hover:border-primary/50 flex flex-col items-center justify-center text-center cursor-pointer group">
                    <div className="h-14 w-14 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                      <UploadCloud className="h-7 w-7 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">{label}</h3>
                    <p className="text-xs text-slate-400">{desc}</p>
                    <button type="button" className="mt-4 text-xs text-primary font-medium bg-primary/10 px-4 py-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                      Browse Files
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <button type="submit" disabled={loading}
                className="glass-button w-full text-lg py-4 flex items-center justify-center gap-2">
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</>
                ) : (
                  <>Submit Registration <CheckCircle2 className="h-6 w-6" /></>
                )}
              </button>
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  Already a partner?{' '}
                  <Link to="/login" className="text-primary font-medium hover:text-blue-400 hover:underline transition-all">
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

export default Register;
