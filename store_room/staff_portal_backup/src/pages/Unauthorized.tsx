import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
          <ShieldAlert size={40} className="text-red-500" />
        </div>
        
        <h1 className="text-4xl font-black text-white tracking-tight">Access Denied</h1>
        <p className="text-slate-400 font-medium">
          Your current security clearance level is insufficient to access this hospital department.
        </p>

        <div className="pt-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 mx-auto text-blue-500 font-bold hover:text-blue-400 transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
