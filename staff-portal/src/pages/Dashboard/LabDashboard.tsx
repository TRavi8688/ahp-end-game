import React, { useState } from 'react';
import { 
  Beaker, 
  Upload, 
  FileText, 
  Zap, 
  Search, 
  Trello, 
  CheckCircle2, 
  Clock, 
  Dna,
  ShieldCheck,
  BrainCircuit,
  MoreVertical
} from 'lucide-react';

const LabDashboard: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);

  const activeTests = [
    { id: 'LAB-772', patient: 'Rajesh Kumar', test: 'Full Blood Count', status: 'Processing', risk: 'Low', time: '12 min left' },
    { id: 'LAB-775', patient: 'Meera Singh', test: 'Lipid Profile', status: 'Analyzing', risk: 'High', time: '3 min left' },
    { id: 'LAB-778', patient: 'Vikram Seth', test: 'Thyroid Panel', status: 'Pending Sample', risk: 'Routine', time: 'Waiting' },
  ];

  return (
    <div className="min-h-screen p-6 space-y-8 animate-in fade-in duration-1000">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-3">
            <Beaker className="text-purple-500" size={32} />
            DIAGNOSTIC <span className="text-purple-500/50">LAB</span>
          </h1>
          <p className="text-slate-400 font-medium mt-1 uppercase tracking-widest text-xs">AI-Augmented Pathology Suite</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="glass-card px-4 py-2 flex items-center gap-3 border-purple-500/20">
            <BrainCircuit className="text-purple-500" size={18} />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Neural Engine: Active</span>
          </div>
          <button className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2">
            <Upload size={18} />
            NEW SAMPLE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Bulk Report Upload Zone */}
        <div className="lg:col-span-1 space-y-6">
          <div 
            className={`glass-card p-12 border-dashed border-2 transition-all flex flex-col items-center justify-center text-center space-y-4 ${
              dragActive ? 'border-purple-500 bg-purple-500/5' : 'border-slate-800'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={() => setDragActive(false)}
          >
            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center">
              <Upload className="text-purple-500" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Bulk Report Upload</h3>
              <p className="text-xs text-slate-500 mt-2">Drag and drop lab PDFs here.<br />Hospyn Neural Engine will auto-parse all values.</p>
            </div>
            <button className="mt-4 px-8 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-700 transition-all border border-slate-700">
              Select Files
            </button>
          </div>

          <div className="glass-card p-6 space-y-6">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">AI Analysis Pipeline</h2>
            <div className="space-y-4">
              {[
                { name: 'OCR Text Extraction', progress: 100, status: 'Done' },
                { name: 'Range Validation', progress: 100, status: 'Done' },
                { name: 'Risk Scoring', progress: 45, status: 'In Progress' }
              ].map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-medium">{item.name}</span>
                    <span className="text-[10px] font-black text-purple-500 uppercase">{item.status}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Diagnostics Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                Live Diagnostics Queue
              </h2>
              <div className="flex gap-2">
                <button className="p-2 bg-slate-800 text-slate-400 rounded-lg"><Search size={16} /></button>
                <button className="p-2 bg-slate-800 text-slate-400 rounded-lg"><Trello size={16} /></button>
              </div>
            </div>

            <div className="p-0">
              {activeTests.map((test) => (
                <div key={test.id} className="p-6 border-b border-slate-800/50 hover:bg-purple-500/5 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm ${
                      test.risk === 'High' ? 'bg-red-500/10 text-red-500' : 'bg-purple-500/10 text-purple-500'
                    }`}>
                      {test.id.split('-')[1]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">{test.patient}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                          test.risk === 'High' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {test.risk} Risk
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Order: <span className="text-slate-300 font-bold">{test.test}</span> • <span className="text-purple-400 italic">{test.status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Time Remaining</p>
                      <p className="text-sm font-mono text-slate-300">{test.time}</p>
                    </div>
                    <button className="p-2 text-slate-500 hover:text-white transition-colors">
                      <MoreVertical size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Telemetry */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 border-slate-800 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quality Control</p>
                <p className="text-xl font-black text-white">99.9%</p>
              </div>
            </div>
            <div className="glass-card p-6 border-slate-800 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                <Dna size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Daily Scans</p>
                <p className="text-xl font-black text-white">1,248</p>
              </div>
            </div>
            <div className="glass-card p-6 border-slate-800 flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Avg TAT</p>
                <p className="text-xl font-black text-white">2.5 hrs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabDashboard;
