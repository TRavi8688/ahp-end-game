// super-admin-dashboard/src/pages/Unauthorized.jsx
import { useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070b14' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-5">
          <ShieldOff size={28} className="text-rose-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-500 text-sm mb-6">Your account does not have permission to access this area.</p>
        <button onClick={() => navigate('/login', { replace: true })} className="btn-ghost">
          <ArrowLeft size={14} />Return to Login
        </button>
      </div>
    </div>
  );
}
