import React, { useState, useEffect } from 'react';
import {
  Shield, Users, UserPlus, Search, Key, Lock, Unlock,
  MoreVertical, X, Loader2, CheckCircle2, AlertTriangle,
  Building2, ChevronRight, RefreshCw, Copy, Eye, EyeOff,
  Clock, Mail, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ROLE_COLORS = {
  super_admin: 'badge-red',
  hospital_admin: 'badge-violet',
  doctor: 'badge-blue',
  nurse: 'badge-cyan',
  receptionist: 'badge-amber',
  lab: 'badge-emerald',
  pharmacy: 'badge-green',
  patient: 'badge-slate',
};

export default function IAMManagement() {
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'hospital_admin', enforce_mfa: true });
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const cfg = { headers: { Authorization: `Bearer ${token}` } };
      const [tenantRes, userRes] = await Promise.all([
        axios.get(`${API_BASE}/iam/tenants`, cfg),
        axios.get(`${API_BASE}/iam/users`, cfg),
      ]);
      const tenantList = Array.isArray(tenantRes.data) ? tenantRes.data : [];
      const userList = Array.isArray(userRes.data) ? userRes.data : [];
      setTenants(tenantList);
      setUsers(userList);
      if (tenantList.length > 0) setSelectedTenant(tenantList[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/iam/users/${userId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
      showToast(`User ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'} successfully`);
    } catch {
      showToast('Failed to update user status', 'error');
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/iam/invite`, {
        email: inviteForm.email,
        role: inviteForm.role,
        tenant_id: selectedTenant?.id,
        enforce_mfa: inviteForm.enforce_mfa,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'hospital_admin', enforce_mfa: true });
      fetchData();
      showToast(`Invitation sent to ${inviteForm.email}`);
    } catch {
      showToast('Failed to send invitation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const roles = ['all', 'super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist', 'lab', 'pharmacy'];

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl ${
              toastMsg.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
            }`}
          >
            {toastMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span className="text-sm font-semibold">{toastMsg.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield size={20} className="text-indigo-400" />
              Global Platform Access Control
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage all platform users, roles, and hospital-level access across the network</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="btn-ghost"><RefreshCw size={14} />Refresh</button>
            <button onClick={() => setShowInviteModal(true)} className="btn-primary">
              <UserPlus size={15} />Add Platform User
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Platform Users', value: users.length, color: 'indigo' },
            { label: 'Active', value: users.filter(u => u.status === 'ACTIVE').length, color: 'emerald' },
            { label: 'Suspended', value: users.filter(u => u.status === 'SUSPENDED').length, color: 'rose' },
            { label: 'MFA Enforced', value: users.filter(u => u.mfa_enabled).length, color: 'amber' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-3 flex items-center gap-3">
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{s.label}</div>
                <div className="text-xl font-bold text-white">{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Role Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              className="input-dark pl-9 py-2 text-xs"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {roles.map(r => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  filterRole === r
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                {r === 'all' ? 'All Roles' : r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-600 ml-auto shrink-0">{filtered.length} identities</span>
        </div>
      </div>

      {/* Users Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-indigo-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <Users size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No identities found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Identity</th>
                <th>Role</th>
                <th>Tenant</th>
                <th>Security</th>
                <th>Status</th>
                <th>Last Login</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id} className="group">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm">
                        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">{user.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-600 flex items-center gap-1">
                          <Mail size={10} />{user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${ROLE_COLORS[user.role] || 'badge-slate'} uppercase`}>
                      {(user.role || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 size={11} />
                      <span>{user.hospital_name || user.tenant_name || 'Platform'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Key size={13} className={user.mfa_enabled ? 'text-emerald-400' : 'text-amber-500'} />
                      <span className="text-xs text-slate-400">
                        {user.mfa_enabled ? 'MFA Active' : 'Standard'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.status === 'ACTIVE' ? 'badge-green' : 'badge-red'} flex items-center gap-1 w-fit`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {user.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={11} />
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggleStatus(user.id, user.status)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          user.status === 'ACTIVE'
                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? <><Lock size={12} />Suspend</> : <><Unlock size={12} />Activate</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInviteModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="modal-content"
            >
              <div className="p-5 border-b border-white/8 flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus size={16} className="text-indigo-400" />
                  Add New Platform User
                </h2>
                <button onClick={() => setShowInviteModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {selectedTenant && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <Building2 size={14} className="text-indigo-400" />
                    <span className="text-xs text-indigo-300">Provisioning to: <strong>{selectedTenant.name}</strong></span>
                    {tenants.length > 1 && (
                      <select
                        className="ml-auto bg-transparent border-none text-xs text-indigo-300 outline-none cursor-pointer"
                        value={selectedTenant?.id || ''}
                        onChange={e => setSelectedTenant(tenants.find(t => t.id === e.target.value))}
                      >
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    className="input-dark text-sm"
                    placeholder="staff@hospital.com"
                    value={inviteForm.email}
                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Assign RBAC Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['hospital_admin', 'doctor', 'nurse', 'receptionist', 'lab', 'pharmacy'].map(role => (
                      <button
                        key={role}
                        onClick={() => setInviteForm(f => ({ ...f, role }))}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all capitalize ${
                          inviteForm.role === role
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                            : 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10'
                        }`}
                      >
                        {role.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <input
                    type="checkbox"
                    checked={inviteForm.enforce_mfa}
                    onChange={e => setInviteForm(f => ({ ...f, enforce_mfa: e.target.checked }))}
                    className="w-4 h-4 accent-indigo-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-300">Enforce MFA on first login</div>
                    <div className="text-xs text-slate-600 mt-0.5">User must set up 2FA before accessing the platform</div>
                  </div>
                </label>
              </div>
              <div className="p-4 border-t border-white/8 flex justify-end gap-3">
                <button onClick={() => setShowInviteModal(false)} className="btn-ghost">Cancel</button>
                <button
                  onClick={handleInvite}
                  disabled={!inviteForm.email || submitting}
                  className="btn-primary disabled:opacity-40"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  Send Invitation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
