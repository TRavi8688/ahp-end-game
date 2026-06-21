import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, UserCog, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

function InviteStaffModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', role: 'staff', department: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/staff/invites', form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send invite.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-lavender-100">
          <h2 className="font-bold text-ink-900">Invite Staff</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input required placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input required placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input placeholder="Department (optional)" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <button type="submit" disabled={saving} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-full disabled:opacity-60">
            {saving ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MoreStaff() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/staff/list');
      setStaff(res.data?.data?.staff || res.data?.staff || []);
    } catch (err) {
      console.error(err);
      setError('Could not load staff directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  return (
    <div className="p-4 sm:p-6">
      <button onClick={() => navigate('/more')} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ink-900">Staff</h1>
        <button onClick={() => setShowInvite(true)} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3.5 py-2 rounded-full flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Invite
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading...</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          <UserCog className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No staff added yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {staff.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink-900 text-sm">{s.full_name}</p>
                <p className="text-xs text-gray-400 capitalize">{s.role} {s.department && `· ${s.department}`}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.status === 'ACTIVE' ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-500'}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {showInvite && <InviteStaffModal onClose={() => setShowInvite(false)} onSaved={fetchStaff} />}
    </div>
  );
}
