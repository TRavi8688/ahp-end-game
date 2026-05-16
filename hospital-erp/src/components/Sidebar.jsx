import React from 'react';
import { 
  CreditCard, Activity, FlaskConical, Package, 
  BarChart3, Settings, LogOut, Zap, Bed, Scissors, Users
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const NavItem = ({ icon: Icon, label, path, danger }) => {
    const active = location.pathname === path;
    
    return (
      <button 
        onClick={() => navigate(path)}
        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group relative ${
        active 
          ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40' 
          : danger 
            ? 'text-rose-500 hover:bg-rose-500/10' 
            : 'text-slate-500 hover:bg-white/5 hover:text-white'
      }`}>
        <Icon size={20} className={active ? 'text-white' : 'group-hover:scale-110 group-hover:text-indigo-400 transition-all'} />
        <span className="font-black text-xs uppercase tracking-widest">{label}</span>
        {active && (
            <div className="absolute left-0 w-1.5 h-6 bg-white rounded-r-full" />
        )}
      </button>
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <aside className="w-80 glass-card rounded-none border-y-0 border-l-0 p-8 flex flex-col fixed h-full z-30 shadow-2xl shadow-black">
      <div className="flex items-center gap-4 mb-14 px-2">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 rotate-3 group hover:rotate-0 transition-all">
          <Zap className="text-white fill-white" size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white leading-none">HOSPYN</h1>
          <span className="text-[10px] font-black text-indigo-500 tracking-[0.3em] uppercase">Intelligence</span>
        </div>
      </div>

      <nav className="flex-1 space-y-3">
        <NavItem icon={Activity} label="Consultations" path="/clinical" />
        <NavItem icon={Bed} label="Ward & IPD" path="/ward" />
        <NavItem icon={Scissors} label="OT Control" path="/surgery" />
        <NavItem icon={FlaskConical} label="Laboratory" path="/lab" />
        <NavItem icon={Package} label="Pharmacy" path="/pharmacy" />
        <NavItem icon={CreditCard} label="Billing" path="/billing" />
        <NavItem icon={BarChart3} label="Intelligence" path="/analytics" />
        <NavItem icon={Settings} label="Settings" path="/settings" />
      </nav>

      <div className="pt-8 border-t border-white/5 mt-auto">
        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mb-6">
          <p className="text-[10px] font-black text-indigo-400 tracking-widest uppercase mb-2">Cloud Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-white">Live Production</span>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full">
           <NavItem icon={LogOut} label="Terminate Session" path="/logout" danger />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
