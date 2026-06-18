import React, { useState, useEffect } from 'react';
import { RefreshCw, Users, Clock, Printer } from 'lucide-react';
// FIXED: canonical apiClient
import apiClient from '../../apiClient';
import { printToken } from '../../utils/printToken';

interface WalkInRequest {
  id: string;
  queue_number: string;
  full_name: string;
  phone: string;
  age: number;
  gender: string;
  reason_for_visit: string;
  priority_level: string;
  created_at: string;
  doctor_name?: string;
  department?: string;
}

interface Doctor {
  id: string;
  full_name: string;
  specialization: string;
  active_load: number;
}

const QueueBoardPage: React.FC = () => {
  const [queue, setQueue]     = useState<WalkInRequest[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [qRes, dRes] = await Promise.all([
        apiClient.get('/reception/queue'),
        apiClient.get('/reception/doctors'),
      ]);
      setQueue(qRes.data.data.queue   || []);
      setDoctors(dRes.data.data       || []);
    } catch (err) {
      console.error('Failed to fetch queue board', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // FIXED: interval properly cleared on unmount
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, []);

  const priorityClass = (p: string) => {
    switch (p.toLowerCase()) {
      case 'emergency': return 'bg-red-500/10 border-red-500/20 text-red-500';
      case 'urgent':    return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'low':       return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      default:          return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    }
  };

  return (
    <div className="p-8 space-y-8 min-h-screen text-slate-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">Live Queue Board</h1>
          <p className="text-slate-400 text-sm">Monitors active patient queue and doctor workload</p>
        </div>
        <button onClick={fetchData} disabled={isLoading}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest text-slate-300">
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Sync Board
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Queue */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-[32px] p-6 space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="text-blue-500" size={20} />
              Waiting Patients ({queue.length})
            </h2>
          </div>

          {isLoading && queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RefreshCw className="animate-spin mb-4" size={32} />
              <span className="font-bold uppercase tracking-widest text-xs">Loading...</span>
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl text-slate-500">
              No patients currently waiting.
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map(p => (
                <div key={p.id} className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center font-black text-blue-400 text-lg">
                      {p.queue_number}
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{p.full_name}</h3>
                      <p className="text-xs text-slate-400">{p.gender} · {p.age}y · {p.phone}</p>
                      {p.reason_for_visit && <p className="text-xs text-slate-500 mt-0.5">Reason: {p.reason_for_visit}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${priorityClass(p.priority_level)}`}>
                      {p.priority_level}
                    </span>
                    <button
                      onClick={() => printToken({
                        token_number: p.queue_number,
                        patient_name: p.full_name,
                        doctor_name:  p.doctor_name,
                        department:   p.department,
                        type:         'walk_in',
                        issued_at:    p.created_at || new Date().toISOString(),
                      })}
                      className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                      title="Re-print Token"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Doctors */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 space-y-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="text-emerald-500" size={20} />
            Doctors on Duty
          </h2>
          <div className="space-y-3">
            {doctors.map(doc => (
              <div key={doc.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm">Dr. {doc.full_name}</h3>
                    <p className="text-xs text-slate-500">{doc.specialization}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Workload</span>
                  <span className="text-xs font-black text-white bg-blue-600/20 border border-blue-600/30 px-2.5 py-0.5 rounded-lg">
                    {doc.active_load} waiting
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// FIXED: both named + default export
export { QueueBoardPage };
export default QueueBoardPage;
