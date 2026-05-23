import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Settings, 
  Bed, 
  FlaskConical, 
  Package, 
  CreditCard, 
  Users, 
  GitBranch, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import apiClient from '../apiClient';
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
        const res = await apiClient.get(`/hospital-settings/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
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
      const res = await apiClient.post(`/hospital-settings/`, modules, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      localStorage.setItem('hospitalSettings', JSON.stringify(res.data));
      setSuccess(true);
      
      setTimeout(() => {
        navigate('/clinical');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update hospital settings.");
    } finally {
      setLoading(false);
    }
  };

  const appRows = [
    {
      key: 'enable_billing',
      title: 'Financial Ledger & Billing',
      desc: 'Process invoices, record digital payments, track credit and tax operations.',
      icon: CreditCard,
    },
    {
      key: 'enable_pharmacy',
      title: 'Pharmacy & Dispensary Stock',
      desc: 'Track batches, low stock warnings, drug expiry dates and handle sales.',
      icon: Package,
    },
    {
      key: 'enable_labs',
      title: 'Diagnostic Labs',
      desc: 'Manage diagnostic testing orders, upload results, and sync clinical records.',
      icon: FlaskConical,
    },
    {
      key: 'enable_inpatient_beds',
      title: 'Inpatient Beds & Ward Management',
      desc: 'Monitor ward occupancy, assign admissions, manage bed cleanings.',
      icon: Bed,
    },
    {
      key: 'enable_hr',
      title: 'Human Resources & Rosters',
      desc: 'Invite medical staff, assign roles, schedule duties, and track profiles.',
      icon: Users,
    }
  ];

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center font-inter">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-xs font-medium">Loading workspace settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200 font-inter py-12 px-6 flex justify-center">
      <div className="w-full max-w-4xl">
        
        {/* Header */}
        <div className="mb-8 border-b border-slate-700/50 pb-6 flex items-center gap-4">
          <div className="p-3 bg-blue-600/10 rounded-lg border border-blue-600/20 text-blue-500">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Service Provisioning Matrix</h1>
            <p className="text-sm text-slate-400 mt-1">Configure your facility's operational modules. Unused modules will be hidden from staff.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {error && (
            <div className="p-4 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-[#1a1d24] border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-[#16181d] border-b border-slate-700/50 flex justify-between items-center">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Core Clinical & Operational Modules</h2>
              <span className="text-xs text-slate-500">Check to Provision</span>
            </div>
            
            <div className="divide-y divide-slate-700/50">
              {appRows.map((row) => {
                const IconComponent = row.icon;
                const isActive = modules[row.key];
                
                return (
                  <div 
                    key={row.key}
                    onClick={() => handleToggle(row.key)}
                    className={`flex items-center px-6 py-5 cursor-pointer transition-colors ${isActive ? 'bg-blue-600/5' : 'hover:bg-slate-800/30'}`}
                  >
                    <div className="flex-shrink-0 mr-4">
                      <div className={`p-2 rounded border ${isActive ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-[#0f1115] border-slate-700 text-slate-500'}`}>
                        <IconComponent size={20} />
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-sm font-medium text-white">{row.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{row.desc}</p>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-600 bg-[#0f1115] text-blue-600 focus:ring-blue-500/50 focus:ring-offset-0 pointer-events-none"
                        checked={isActive}
                        readOnly
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conditional Inpatient Config */}
          {modules.enable_inpatient_beds && (
            <div className="bg-[#1a1d24] border border-blue-500/30 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Inpatient Capacity Provisioning</h3>
                <p className="text-xs text-slate-400 mt-1">Specify the maximum number of physical beds across all wards.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Authorized Capacity</label>
                <input 
                  type="number" 
                  min="0"
                  value={modules.max_beds_configured}
                  onChange={handleBedChange}
                  className="w-24 bg-[#0f1115] border border-slate-700 rounded py-2 px-3 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-center"
                />
              </div>
            </div>
          )}

          {/* Infrastructure config */}
          <div className="bg-[#1a1d24] border border-slate-700/50 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded border bg-[#0f1115] border-slate-700 text-slate-500">
                <GitBranch size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Multi-Branch Architecture</h3>
                <p className="text-xs text-slate-400 mt-1">Enable multi-tenant routing for staff and resources across different physical locations.</p>
              </div>
            </div>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={modules.has_multiple_branches}
                  onChange={() => handleToggle('has_multiple_branches')}
                />
                <div className="w-11 h-6 bg-[#0f1115] border border-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:after:bg-white"></div>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-700/50 pt-6 flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Back to Login
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 px-8 rounded flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">Configuring <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span>
              ) : success ? (
                <>
                  <span>Workspace Ready</span>
                  <CheckCircle2 size={16} />
                </>
              ) : (
                <>
                  <span>Provision Workspace</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetupServices;
