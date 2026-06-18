import React from 'react';
import { BadgeCheck, Bell, User, ChevronDown } from 'lucide-react';

export const TopAppBar: React.FC = () => {
  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-white/10 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40 shadow-sm">
      <div className="flex items-center space-x-3 md:hidden">
        {/* On mobile, show logo/name here since Sidebar is hidden */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20 text-xs">
          PT
        </div>
        <span className="font-bold text-slate-100 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Partner
        </span>
      </div>

      <div className="hidden md:flex items-center space-x-3">
        {/* On desktop, show lab info on the left */}
        <div className="flex flex-col">
          <span className="font-semibold text-slate-100">Apex Diagnostics</span>
          <div className="flex items-center space-x-1 text-xs text-primary">
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>Verified Lab</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3 md:space-x-4 ml-auto">
        <button className="p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900 animate-pulse"></span>
        </button>
        
        <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
        
        <button className="flex items-center space-x-2 p-1.5 pr-2 rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 overflow-hidden">
             {/* Replace with actual avatar image if available */}
            <User className="w-4 h-4 text-slate-300" />
          </div>
          <div className="hidden sm:flex flex-col items-start mr-1 text-left">
            <span className="text-sm font-medium text-slate-200 leading-none mb-1">Alex P.</span>
            <span className="text-[10px] text-slate-400 leading-none">Admin</span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
        </button>
      </div>
    </header>
  );
};
