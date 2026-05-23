import React, { useState } from 'react';
import { 
  Building2, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle,
  FileCheck,
  Shield
} from 'lucide-react';
import apiClient from '../apiClient';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    facilityName: '',
    licenseNumber: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post(`/auth/register`, {
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: 'admin'
      });

      const { access_token, user } = response.data;
      
      // Store security credentials
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      if (user?.hospital_id) {
         localStorage.setItem('hospital_id', user.hospital_id);
      }
      localStorage.setItem('isAuthenticated', 'true');

      // The ProtectedRoute will automatically redirect them to /setup-services
      window.location.href = '/setup-services';
    } catch (err) {
      setError(err.response?.data?.detail || 'Authorization failed. Please verify the provided information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] flex flex-col items-center justify-center p-6 font-inter text-slate-200">
      <div className="w-full max-w-2xl bg-[#1a1d24] border border-slate-700/50 shadow-sm rounded-lg overflow-hidden">
        
        {/* Header Section */}
        <div className="px-8 py-6 border-b border-slate-700/50 bg-[#16181d]">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="text-blue-500" size={24} />
            <h1 className="text-xl font-semibold text-white tracking-tight">Hospyn Enterprise Provisioning</h1>
          </div>
          <p className="text-sm text-slate-400">
            Create an administrator account to authorize and configure your clinical workspace.
          </p>
        </div>

        {/* Form Section */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            
            {/* Administrator Details */}
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">1. Administrator Identity</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">First Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full bg-[#0f1115] border border-slate-700 rounded py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="e.g. Rahul"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full bg-[#0f1115] border border-slate-700 rounded py-2.5 px-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                    placeholder="e.g. Sharma"
                    required
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-700/50" />

            {/* Facility Details */}
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">2. Clinical Facility Details</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Official Facility Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Building2 size={16} />
                    </div>
                    <input
                      type="text"
                      name="facilityName"
                      value={formData.facilityName}
                      onChange={handleChange}
                      className="w-full bg-[#0f1115] border border-slate-700 rounded py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="e.g. Apollo Spectra Hospitals"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Govt. Registration / License Number (Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <FileCheck size={16} />
                    </div>
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={handleChange}
                      className="w-full bg-[#0f1115] border border-slate-700 rounded py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="e.g. NABH-2024-908"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Providing a valid NABH or state clinical license expedites verification.</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-700/50" />

            {/* Security Details */}
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">3. Security Credentials</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Secure Work Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-[#0f1115] border border-slate-700 rounded py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="admin@hospital.com"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Super-Admin Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock size={16} />
                    </div>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full bg-[#0f1115] border border-slate-700 rounded py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <Link to="/login" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Already have an account?
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 px-6 rounded flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">Processing <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span>
                ) : (
                  <>
                    <span>Authorize & Continue</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <div className="mt-8 text-center">
         <p className="text-[11px] text-slate-500 font-medium tracking-widest uppercase">
            Sovereign Medical Intelligence Platform &bull; End-to-End Encryption Active
         </p>
      </div>
    </div>
  );
};

export default Register;
