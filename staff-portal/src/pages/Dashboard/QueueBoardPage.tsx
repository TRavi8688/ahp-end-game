import React, { useState, useEffect } from 'react';
import { RefreshCw, Users, Clock, Printer } from 'lucide-react';
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

export const QueueBoardPage: React.FC = () => {
  const [queue, setQueue] = useState<WalkInRequest[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [queueRes, docsRes] = await Promise.all([
        apiClient.get('/reception/queue'),
        apiClient.get('/reception/doctors')
      ]);
      setQueue(queueRes.data.data.queue || []);
      setDoctors(docsRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch queue board data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'emergency':
        return 'bg-red-500/10 border-red-500/20 text-red-500';
      case 'urgent':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'low':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
      default:
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    }
  };

  return (
    <div className="p-8 space-y-8 min-h-screen text-slate-100 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black outfit tracking-tighter mb-2">Live Queue Board</h1>
          <p className="text-slate-400 font-medium text-sm">Monitors active patient queue and doctor workload</p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest text-slate-300"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Sync Board</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Live Queue Column */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-[32px] p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold outfit flex items-center gap-2">
              <Users className="text-blue-500" size={20} />
              <span>Waiting Patients ({queue.length})</span>
            </h2>
          </div>

          {isLoading && queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RefreshCw className="animate-spin mb-4" size={32} />
              <span className="font-bold uppercase tracking-widest text-xs">Loading queue...</span>
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl text-slate-500">
              No patients currently waiting in the reception queue.
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((patient) => (
                <div
                  key={patient.id}
                  className="bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center font-black text-blue-400 text-lg">
                      {patient.queue_number}
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{patient.full_name}</h3>
                      <p className="text-xs text-slate-400">
                        {patient.gender} · {patient.age} years · {patient.phone}
                      </p>
                      {patient.reason_for_visit && (
                        <p className="text-xs text-slate-500 mt-1">
                          Reason: <span className="text-slate-400 font-medium">{patient.reason_for_visit}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getPriorityBadgeClass(patient.priority_level)}`}>
                      {patient.priority_level}
                    </span>
                    <button
                      onClick={() =>
                        printToken({
                          token_number: patient.queue_number,
                          patient_name: patient.full_name,
                          doctor_name: patient.doctor_name,
                          department: patient.department,
                          type: 'walk_in',
                          issued_at: patient.created_at || new Date().toISOString(),
                        })
                      }
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

        {/* Doctor Availability Column */}
        <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 space-y-6">
          <h2 className="text-xl font-bold outfit flex items-center gap-2">
            <Clock className="text-emerald-500" size={20} />
            <span>Doctors on Duty</span>
          </h2>

          <div className="space-y-4">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm">Dr. {doctor.full_name}</h3>
                    <p className="text-xs text-slate-500">{doctor.specialization}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Queue Workload</span>
                  <span className="text-xs font-black text-white bg-blue-600/20 border border-blue-600/30 px-2.5 py-0.5 rounded-lg">
                    {doctor.active_load} waiting
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

export default QueueBoardPage;
