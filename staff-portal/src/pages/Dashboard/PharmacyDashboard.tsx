import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  QrCode,
  ArrowRight,
  ExternalLink,
  History,
  ClipboardList
} from 'lucide-react';
import { useStore } from '../../store/useStore';

interface Prescription {
  id: string;
  patientName: string;
  doctorName: string;
  time: string;
  status: 'Pending' | 'Fulfilled' | 'Partially';
  items: string[];
  priority: 'Routine' | 'Urgent' | 'STAT';
}

const PharmacyDashboard: React.FC = () => {
  const { queue } = useStore();
  const [activeTab, setActiveTab] = useState<'pending' | 'fulfilled' | 'stock'>('pending');

  const orders: Prescription[] = [
    { 
      id: 'PR-9021', 
      patientName: 'Kunal Singhania', 
      doctorName: 'Dr. Sharma', 
      time: '10:45 AM', 
      status: 'Pending',
      items: ['Amoxicillin 500mg', 'Paracetamol 650mg'],
      priority: 'STAT'
    },
    { 
      id: 'PR-9025', 
      patientName: 'Ananya Iyer', 
      doctorName: 'Dr. Patel', 
      time: '11:05 AM', 
      status: 'Pending',
      items: ['Atorvastatin 20mg', 'Metformin 500mg'],
      priority: 'Routine'
    },
  ];

  return (
    <div className="min-h-screen p-6 space-y-8 animate-in fade-in duration-1000">
      {/* Header & Global Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-3">
            <Package className="text-blue-500" size={32} />
            PHARMACY <span className="text-blue-500/50">OPERATIONS</span>
          </h1>
          <p className="text-slate-400 font-medium mt-1 uppercase tracking-widest text-xs">AHP Digital Fulfillment Engine</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 flex items-center gap-3 border-blue-500/20">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Inventory: 98% Optimal</span>
          </div>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2">
            <QrCode size={18} />
            SCAN PRESCRIPTION
          </button>
        </div>
      </div>

      {/* Main Command Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Fulfillment Queue */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-slate-800 p-4 flex items-center justify-between bg-slate-900/30">
              <div className="flex items-center gap-6">
                {['pending', 'fulfilled', 'stock'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`text-xs font-black uppercase tracking-widest pb-1 transition-all ${
                      activeTab === tab ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Search size={16} className="text-slate-500" />
                <Filter size={16} className="text-slate-500" />
              </div>
            </div>

            <div className="p-0">
              {orders.map((order) => (
                <div key={order.id} className="group border-b border-slate-800/50 p-6 hover:bg-blue-500/5 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm ${
                      order.priority === 'STAT' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {order.id.split('-')[1]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{order.patientName}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                          order.priority === 'STAT' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {order.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Ordered by <span className="text-slate-300">{order.doctorName}</span> • <span className="text-slate-400 italic">{order.time}</span>
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Medications</p>
                      <div className="flex gap-2">
                        {order.items.map((item, idx) => (
                          <span key={idx} className="text-[11px] bg-slate-800 text-slate-300 px-2 py-1 rounded-lg border border-slate-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="p-3 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl transition-all">
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Intelligence */}
        <div className="space-y-6">
          {/* Stock Anomalies */}
          <div className="glass-card p-6 border-red-500/20">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-red-500" size={20} />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Critical Low Stock</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Insulin Glargine</span>
                <span className="text-xs font-bold text-red-500">2 Units</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Amlodipine 5mg</span>
                <span className="text-xs font-bold text-red-500">12 Units</span>
              </div>
              <button className="w-full mt-2 py-2 text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest border border-blue-500/20 rounded-lg">
                Automated Restock
              </button>
            </div>
          </div>

          {/* Fulfillment Stats */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-black text-white uppercase tracking-wider mb-6">Efficiency HUD</h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  <span>Avg Fulfillment Time</span>
                  <span className="text-blue-500">4.2 min</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-[85%] h-full bg-blue-500" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  <span>Error Rate</span>
                  <span className="text-green-500">0.02%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-[5%] h-full bg-green-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button className="glass-card p-4 flex flex-col items-center gap-2 hover:bg-blue-500/10 transition-all border-slate-800">
              <History size={20} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">History</span>
            </button>
            <button className="glass-card p-4 flex flex-col items-center gap-2 hover:bg-blue-500/10 transition-all border-slate-800">
              <ClipboardList size={20} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Logs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PharmacyDashboard;
