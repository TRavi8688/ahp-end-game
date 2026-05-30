import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Users, Shield, BedDouble, ArrowRight, ShieldAlert, FileText, Settings, Key, UserCheck, Stethoscope } from 'lucide-react';

const API_BASE = '/api/v1';

export default function SovereignConsole({ onLogout }) {
  const [activeTab, setActiveTab] = useState('branch');
  const [data, setData] = useState({ branches: [], passports: [], beds: [], ledger: [] });
  const [loading, setLoading] = useState(true);

  const fetchLiveData = async () => {
    const token = localStorage.getItem('hospyn_owner_token');
    if (!token) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      
      const [branchRes, ehrRes, bedRes, auditRes] = await Promise.all([
        axios.get(`${API_BASE}/owner/branch-metrics`, { headers }),
        axios.get(`${API_BASE}/owner/ehr-passports`, { headers }),
        axios.get(`${API_BASE}/owner/bed-matrix`, { headers }),
        axios.get(`${API_BASE}/owner/audit-ledger`, { headers })
      ]);
      
      setData({
        branches: branchRes.data.branches || [],
        passports: ehrRes.data.passports || [],
        beds: bedRes.data.beds || [],
        ledger: auditRes.data.ledger || []
      });
    } catch (err) {
      console.error("Live Data Fetch Failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 10000); // Live refresh
    return () => clearInterval(interval);
  }, []);

  const TabButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
        activeTab === id ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-inter overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col p-6 shadow-sm z-10">
        <div className="flex items-center gap-2 font-extrabold text-xl tracking-tight mb-8">
          <Shield className="text-primary" size={28} />
          <span>HOSPYN<span className="text-primary">.</span></span>
        </div>
        
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Hospital Management</div>
        <nav className="flex-1 space-y-2">
          <TabButton id="branch" icon={Activity} label="Branch Analytics" />
          <TabButton id="ehr" icon={FileText} label="EHR Passports" />
          <TabButton id="beds" icon={BedDouble} label="Bed Scheduler" />
          <TabButton id="audit" icon={ShieldAlert} label="Audit Ledger" />
          <TabButton id="staff" icon={Users} label="Staff Management" />
        </nav>

        <button onClick={onLogout} className="mt-auto px-4 py-3 bg-red-50 text-red-600 font-bold text-xs rounded-xl hover:bg-red-100 transition-colors">
          Secure Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-10">
        {loading && data.branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading Hospital Data...</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
            
            <header className="flex justify-between items-end border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight font-outfit text-slate-900">
                  {activeTab === 'branch' && "Branch Manager"}
                  {activeTab === 'ehr' && "EHR Patient Passports"}
                  {activeTab === 'beds' && "OPD & Bed Scheduler"}
                  {activeTab === 'audit' && "AI Safety & Audit Ledger"}
                  {activeTab === 'staff' && "Staff Management"}
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  {activeTab === 'branch' && "Branch performance analytics and clinical throughput."}
                  {activeTab === 'ehr' && "Longitudinal health history audit and dynamic consent."}
                  {activeTab === 'beds' && "Real-time ICU ward planner and capacity status."}
                  {activeTab === 'audit' && "Auditing clinical override registries and secure access logs."}
                  {activeTab === 'staff' && "Manage and invite staff members for your hospital."}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-xs font-bold">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                LIVE SYNC
              </div>
            </header>

            {/* TAB CONTENT: BRANCH METRICS */}
            {activeTab === 'branch' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data.branches.length === 0 && <p className="text-sm text-slate-500">No branches configured.</p>}
                {data.branches.map(b => (
                  <div key={b.branch_id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                    <h3 className="font-bold text-slate-900 text-sm mb-4 border-b border-slate-100 pb-2">{b.name} Vitals</h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between font-medium text-slate-500"><span className="text-slate-400">Active Patients:</span> <span className="text-slate-900 font-bold">{b.active_patients}</span></div>
                      <div className="flex justify-between font-medium text-slate-500"><span className="text-slate-400">Doctors on Duty:</span> <span className="text-slate-900 font-bold">{b.doctors_on_duty}</span></div>
                      <div className="flex justify-between font-medium text-slate-500"><span className="text-slate-400">Avg Wait Time:</span> <span className="text-emerald-600 font-bold">{b.avg_wait_time}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: EHR PASSPORTS */}
            {activeTab === 'ehr' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-4 font-bold uppercase tracking-wider text-slate-500">Patient Name</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-slate-500">Health ID</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-slate-500">Consent</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-slate-500">Vitals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.passports.length === 0 && (
                      <tr><td colSpan="4" className="p-8 text-center text-slate-400">No patients registered yet.</td></tr>
                    )}
                    {data.passports.map(p => (
                      <tr key={p.patient_id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-medium text-slate-900">{p.name}</td>
                        <td className="p-4 font-mono text-slate-500">{p.health_id}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black tracking-widest">{p.dynamic_consent}</span>
                        </td>
                        <td className="p-4 text-slate-600">{p.vitals_state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: BED MATRIX */}
            {activeTab === 'beds' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data.beds.length === 0 && <p className="col-span-4 text-sm text-slate-500">No beds configured.</p>}
                {data.beds.map(bed => (
                  <div key={bed.id} className="bg-white border border-slate-200 rounded-xl p-4 text-center flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-900">{bed.bed_number}</span>
                    <span className={`mt-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                      bed.status === 'available' ? 'bg-emerald-50 text-emerald-600' :
                      bed.status === 'occupied' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {bed.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: AUDIT LEDGER */}
            {activeTab === 'audit' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-4 font-bold uppercase tracking-wider text-slate-500">Timestamp</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-slate-500">Actor</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-slate-500">Action</th>
                      <th className="p-4 font-bold uppercase tracking-wider text-slate-500">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.ledger.length === 0 && (
                      <tr><td colSpan="4" className="p-8 text-center text-slate-400">No audit logs found.</td></tr>
                    )}
                    {data.ledger.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-4 font-medium text-slate-900">{log.actor} <span className="text-slate-400">({log.actor_email})</span></td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[9px] font-black tracking-widest ${
                            log.action.includes('OVERRIDE') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 max-w-xs truncate">{JSON.stringify(log.details)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* TAB CONTENT: STAFF PROVISIONING (Redirect) */}
            {activeTab === 'staff' && (
               <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center">
                 <ShieldAlert size={48} className="text-slate-300 mb-4" />
                 <h3 className="font-bold text-slate-900 text-lg">Staff Management</h3>
                 <p className="text-slate-500 text-sm max-w-md mt-2 mb-6">
                   Invite and manage Doctors, Nurses, and Managers for your hospital through the operations portal.
                 </p>
                 <a href="https://hospyn-erp-portal.web.app/login" target="_blank" rel="noreferrer" className="px-6 py-3 bg-primary text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors">
                   Open ERP Portal
                 </a>
               </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
