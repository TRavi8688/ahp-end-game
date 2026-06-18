// partner-app/src/components/layout/TopAppBar.tsx
//
// BUG FIX: Hardcoded "Apex Diagnostics / Verified Lab / Alex P. / Admin"
// had nothing to do with actual logged-in partner.
// Now reads from useAuth() context.

import React from 'react';
import { BadgeCheck, Bell, User, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const TopAppBar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-white/10 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40 shadow-sm">
      {/* Mobile: logo */}
      <div className="flex items-center space-x-3 md:hidden">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-white font-bold shadow-lg text-xs">
          PT
        </div>
        <span className="font-bold text-slate-100 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Partner
        </span>
      </div>

      {/* Desktop: real partner name */}
      <div className="hidden md:flex items-center space-x-3">
        <div className="flex flex-col">
          {/* BUG FIX: was "Apex Diagnostics" — now shows real partner name */}
          <span className="font-semibold text-slate-100">
            {user?.business_name ?? 'Partner Portal'}
          </span>
          {user?.verification_status === 'approved' && (
            <div className="flex items-center space-x-1 text-xs text-primary">
              <BadgeCheck className="w-3.5 h-3.5" />
              <span>Verified Partner</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3 md:space-x-4 ml-auto relative">
        <button className="p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900 animate-pulse" />
        </button>

        <div className="h-8 w-px bg-white/10 hidden sm:block" />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center space-x-2 p-1.5 pr-2 rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
              <User className="w-4 h-4 text-slate-300" />
            </div>
            <div className="hidden sm:flex flex-col items-start mr-1 text-left">
              {/* BUG FIX: was hardcoded "Alex P. / Admin" */}
              <span className="text-sm font-medium text-slate-200 leading-none mb-1">
                {user?.email?.split('@')[0] ?? 'Partner'}
              </span>
              <span className="text-[10px] text-slate-400 leading-none capitalize">
                {user?.business_type ?? 'partner'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 hidden sm:block transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-white text-sm font-medium truncate">{user?.business_name}</p>
                <p className="text-slate-400 text-xs truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
