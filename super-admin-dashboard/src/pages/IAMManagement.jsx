import React, { useState, useEffect } from 'react';
import { Users, Shield, Building2, UserPlus, ChevronRight, Search, Key, Settings, MoreVertical, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const IAMManagement = () => {
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("hospital_admin");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchIAMData();
  }, []);

  const fetchIAMData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [tenantRes, userRes] = await Promise.all([
        axios.get(`${API_BASE}/iam/tenants`, config),
        axios.get(`${API_BASE}/iam/users`, config)
      ]);
      
      setTenants(tenantRes.data);
      setUsers(userRes.data);
      if (tenantRes.data.length > 0) {
        setSelectedTenant(tenantRes.data[0]);
      }
    } catch (err) {
      console.error("Failed to load IAM data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !selectedTenant) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/iam/invite`, {
        email: inviteEmail,
        role: inviteRole,
        tenant_id: selectedTenant.id,
        enforce_mfa: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowInviteModal(false);
      setInviteEmail("");
      fetchIAMData(); // Refresh list
    } catch (err) {
      console.error("Failed to invite", err);
      alert("Failed to invite user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/iam/users/${userId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh UI optimistically or by re-fetching
      fetchIAMData();
    } catch (err) {
      alert("Failed to update user status.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Top Header: IAM Context Switcher */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Shield className="text-indigo-600" size={24} />
              Identity & Access Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">Manage users, roles, and polymorphic tenant access across the infrastructure.</p>
          </div>
          <button 
            onClick={() => setShowInviteModal(true)}
            className="enterprise-btn-primary flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            <UserPlus size={18} />
            <span>Invite User</span>
          </button>
        </div>

        {/* Tenant Breadcrumb Switcher */}
        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 overflow-x-auto">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 shrink-0">
            <Building2 size={16} className="text-slate-400" />
            <select 
              className="bg-transparent border-none outline-none cursor-pointer focus:ring-0 font-semibold"
              value={selectedTenant?.id || ""}
              onChange={(e) => setSelectedTenant(tenants.find(t => t.id === e.target.value))}
            >
              {tenants.filter(t => t.type === 'ORGANIZATION').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <ChevronRight size={16} className="text-slate-400 shrink-0" />
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 shrink-0">
            <select className="bg-transparent border-none outline-none cursor-pointer focus:ring-0 text-slate-500">
              <option value="">Global Context</option>
              {tenants.filter(t => t.type === 'BRANCH').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Analytics & Search Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Users</span>
              <span className="text-xl font-bold text-slate-900">{users.length}</span>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">System Status</span>
              <span className="text-xl font-bold text-emerald-600">Online</span>
            </div>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search users by name, email, or role..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Identity</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Role</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Security</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Activity</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="animate-spin mx-auto mb-2 text-indigo-500" size={24} />
                    Syncing IAM State from Core...
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm uppercase">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{user.name}</div>
                        <div className="text-slate-500 text-xs">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <Key size={14} className={user.mfa_enabled ? "text-emerald-500" : "text-amber-500"} />
                      <span className="text-xs font-medium text-slate-600">
                        {user.mfa_enabled ? "MFA Active" : "Standard Auth"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                      user.status === 'ACTIVE' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleToggleStatus(user.id, user.status)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors border ${
                        user.status === 'ACTIVE' 
                          ? 'text-red-600 bg-white border-red-200 hover:bg-red-50' 
                          : 'text-emerald-600 bg-white border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal Overlay */}
      {showInviteModal && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
          >
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Provision New Identity</h2>
              <p className="text-sm text-slate-500 mt-1">
                Inviting user to <span className="font-semibold text-slate-700">{selectedTenant.name}</span>
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" 
                  placeholder="admin@hospital.com" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Assign RBAC Role</label>
                <select 
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="hospital_admin">Hospital Administrator</option>
                  <option value="doctor">Medical Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="receptionist">Receptionist</option>
                </select>
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Enforce immediate MFA setup on first login</span>
                </label>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowInviteModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleInviteUser}
                disabled={isSubmitting || !inviteEmail}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Send Invitation
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default IAMManagement;
