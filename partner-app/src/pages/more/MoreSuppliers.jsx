import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Truck, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

function AddSupplierModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', gstin: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      await apiClient.post('/pharmacy/suppliers', form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-lavender-100">
          <h2 className="font-bold text-ink-900">Add Supplier</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
          <input required placeholder="Supplier name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input placeholder="Contact person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input placeholder="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <button type="submit" disabled={saving} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-full disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Supplier'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MoreSuppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/pharmacy/suppliers');
      setSuppliers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  return (
    <div className="p-4 sm:p-6">
      <button onClick={() => navigate('/more')} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ink-900">Suppliers</h1>
        <button onClick={() => setShowAdd(true)} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3.5 py-2 rounded-full flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading...</p>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No suppliers yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl shadow-card p-4">
              <p className="font-bold text-ink-900">{s.name}</p>
              {s.contact_person && <p className="text-xs text-gray-500">{s.contact_person}</p>}
              <p className="text-xs text-gray-400">{s.phone} {s.email && `· ${s.email}`}</p>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddSupplierModal onClose={() => setShowAdd(false)} onSaved={fetchSuppliers} />}
    </div>
  );
}
