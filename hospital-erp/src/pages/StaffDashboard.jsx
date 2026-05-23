import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, ShieldCheck, Mail, Briefcase, ChevronRight, Activity, Building, X
} from 'lucide-react';
import apiClient from '../apiClient';
import { API_BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';

const StaffDashboard = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', role: 'doctor', department_id: '' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState({ type: '', message: '' });

  const fetchStaff = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await apiClient.get(`/staff/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaffList(res.data);
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteStatus({ type: '', message: '' });
    
    try {
      const token = localStorage.getItem('token');
      const payload = {
        email: inviteData.email,
        role: inviteData.role
      };
      if (inviteData.department_id) {
        payload.department_id = inviteData.department_id;
      }
      
      const res = await apiClient.post(`/staff/invites`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setInviteStatus({ type: 'success', message: `Invite sent to ${inviteData.email}!` });
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteData({ email: '', role: 'doctor', department_id: '' });
      }, 2000);
      
      fetchStaff();
    } catch (err) {
      setInviteStatus({ 
        type: 'error', 
        message: err.response?.data?.detail || 'Failed to send invite'
      });
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#020617] font-inter selection:bg-indigo-500/30">
      <Sidebar />

      <main className="flex-1 ml-80 p-12 relative bg-[#050810] min-h-screen">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              <span className="text-[10px] font-black text-indigo-500 tracking-[0.4em] uppercase">HR Module</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight outfit">Staff Directory</h1>
            <p className="text-slate-500 text-sm mt-1">Manage clinical and administrative personnel access.</p>
          </div>
          <button 
            onClick={() => { setInviteStatus({type:'', message:''}); setShowInviteModal(true); }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
          >
            <UserPlus size={18} />
            <span>Invite Staff</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-10">
          <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/5 flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Users size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Members</p>
              <p className="text-3xl font-black text-white outfit">{staffList.length}</p>
            </div>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/5 flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Active Credentials</p>
              <p className="text-3xl font-black text-white outfit">{staffList.length}</p>
            </div>
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-[#0f172a] rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
            <h2 className="text-lg font-bold text-white">Personnel Roster</h2>
            <div className="flex items-center gap-2 bg-[#050810] px-4 py-2 rounded-xl border border-white/5">
              <Search size={16} className="text-slate-500" />
              <input type="text" placeholder="Search name or role..." className="bg-transparent border-none outline-none text-sm text-white w-48" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Member</th>
                  <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role Authority</th>
                  <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Department</th>
                  <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="p-10 text-center text-slate-500">Loading personnel data...</td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-10 text-center text-slate-500 italic">No staff members found. Click "Invite Staff" to begin.</td>
                  </tr>
                ) : (
                  staffList.map((member) => (
                    <tr key={member.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                          {(member.user?.first_name?.[0] || member.user?.email?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">
                            {member.user?.first_name ? `${member.user.first_name} ${member.user.last_name || ''}` : member.user?.email}
                          </p>
                          <p className="text-slate-500 text-xs">{member.user?.email}</p>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-300">
                          {member.user?.role || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-5">
                        <span className="text-sm font-medium text-slate-400">
                          {member.department?.name || 'General'}
                        </span>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-bold text-emerald-500">ACTIVE</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-[#0f172a] w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white outfit">Invite Staff Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleInvite} className="p-6 space-y-5">
              {inviteStatus.message && (
                <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${inviteStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {inviteStatus.message}
                </div>
              )}
              
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="email" 
                    required
                    value={inviteData.email}
                    onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                    className="w-full bg-[#050810] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-indigo-500 transition-colors"
                    placeholder="doctor@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">System Role</label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <select 
                    value={inviteData.role}
                    onChange={(e) => setInviteData({...inviteData, role: e.target.value})}
                    className="w-full bg-[#050810] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-indigo-500 transition-colors appearance-none"
                  >
                    <option value="doctor">Doctor / Physician</option>
                    <option value="nurse">Nurse</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="hospital_admin">HR / Administrator</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={inviteLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                  {inviteLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail size={18} />
                      <span>Send Secure Invite</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;
