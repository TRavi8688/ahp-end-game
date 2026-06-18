import React, { useState } from 'react';
import { QrCode, Search, Scan, AlertCircle } from 'lucide-react';

const Scanner = () => {
  const [manualCode, setManualCode] = useState('');

  return (
    <div className="p-6 max-w-4xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
          <Scan className="w-8 h-8 text-indigo-500" />
          Scan Patient QR
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Scan the Hospyn app QR code to instantly pull up patient records and active prescriptions.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Scanner Area */}
        <div className="glass-panel p-8 h-full flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10" />
          
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 mb-8 overflow-hidden rounded-2xl bg-slate-900/5 dark:bg-slate-900/20 backdrop-blur-sm border border-white/20 dark:border-white/5">
            {/* Corner Markers */}
            <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl"></div>
            <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl"></div>
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl"></div>
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-indigo-500 rounded-br-xl"></div>
            
            {/* Scanning Animation line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-20" 
                 style={{ animation: 'scan 2.5s ease-in-out infinite' }}></div>
            
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <QrCode className="w-24 h-24 text-indigo-500/30 dark:text-indigo-400/30" />
            </div>
            
          </div>
          
          <div className="relative z-10 text-center bg-white/50 dark:bg-slate-800/50 px-6 py-4 rounded-2xl backdrop-blur-md border border-white/20 dark:border-white/10 shadow-xl">
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">
              Point at Patient's Hospyn QR Code
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-center gap-1 font-medium">
              <AlertCircle className="w-4 h-4" /> Align QR code within frame
            </p>
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scan {
              0% { top: 0%; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
          `}} />
        </div>

        {/* Fallback Entry */}
        <div className="glass-card p-8 h-full">
          <div className="flex flex-col h-full justify-center">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              <Search className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Manual Entry</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Scanner not working? Enter the patient's unique 8-digit code provided on their app to pull up their information.
            </p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Patient Code
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HOS-8X2M"
                    className="w-full px-4 py-4 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-xl outline-none text-slate-800 dark:text-white placeholder:text-slate-400 shadow-sm"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < manualCode.replace(/[^A-Z0-9]/g, '').length ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    ))}
                  </div>
                </div>
              </div>
              
              <button 
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-500/25 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                disabled={manualCode.length < 5}
              >
                Lookup Patient
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scanner;
