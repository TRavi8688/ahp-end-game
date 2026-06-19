import React from 'react';
import { Users, FileText, Calendar, ArrowUpRight } from 'lucide-react';

export default function HRDashboard() {
  return (
    <div className="space-y-6 text-slate-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">HR Portal</h1>
        <p className="text-sm text-slate-400">Welcome to the Hospyn HR Management Dashboard.</p>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Staff Members</span>
            <h3 className="text-2xl font-bold text-white mt-1">48</h3>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Leave Requests (Pending)</span>
            <h3 className="text-2xl font-bold text-amber-500 mt-1">3</h3>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Shifts Today</span>
            <h3 className="text-2xl font-bold text-emerald-500 mt-1">14</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Calendar size={20} />
          </div>
        </div>
      </div>

      {/* Link to external portal card */}
      <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h4 className="text-base font-bold text-white">Full-Featured HR Management Portal</h4>
          <p className="text-xs text-indigo-200 mt-1 max-w-xl">
            For advanced operations such as payroll, roster generation, contract updates, and onboarding workflows,
            please access the dedicated HR Portal.
          </p>
        </div>
        <a 
          href="http://localhost:5174" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shrink-0"
        >
          Open HR Portal
          <ArrowUpRight size={14} />
        </a>
      </div>
    </div>
  );
}
