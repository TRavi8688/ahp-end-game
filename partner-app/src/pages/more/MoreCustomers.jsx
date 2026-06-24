import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, User, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

function CustomerProfileModal({ customer, onClose }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/pharmacy/sales?limit=100').then((res) => {
      const all = res.data || [];
      const filtered = all.filter((s) =>
        (customer.type === 'patient' && s.patient_id === customer.id) ||
        (customer.type === 'walkin' && s.walkin_customer_id === customer.id)
      );
      setSales(filtered);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [customer]);

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <div className="px-5 py-4 flex items-center justify-between border-b border-lavender-100 sticky top-0 bg-white">
          <h2 className="font-bold text-ink-900">Customer Profile</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600"><User className="w-6 h-6" /></div>
            <div>
              <p className="font-bold text-ink-900">{customer.name}</p>
              <p className="text-xs text-gray-400">{customer.phone} {customer.code && `· ${customer.code}`}</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Purchase History ({sales.length} bills)</p>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading...</p>
          ) : sales.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No purchases yet.</p>
          ) : (
            <div className="space-y-2">
              {sales.map((s) => (
                <div key={s.id} className="bg-lavender-50 rounded-xl p-3 flex justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{s.invoice_number}</p>
                    <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <p className="font-bold text-primary-700 text-sm">₹{s.total.toFixed(0)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MoreCustomers() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [walkins, setWalkins] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (query.length < 2) { setPatients([]); setWalkins([]); return; }
    const t = setTimeout(() => {
      apiClient.get(`/patients/search?q=${encodeURIComponent(query)}`).then((res) => setPatients(res.data || [])).catch(() => setPatients([]));
      apiClient.get(`/pharmacy/walkin-customers/search?q=${encodeURIComponent(query)}`).then((res) => setWalkins(res.data || [])).catch(() => setWalkins([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="p-4 sm:p-6">
      <button onClick={() => navigate('/more')} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <h1 className="text-xl font-bold text-ink-900 mb-4">Customers</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or phone..."
          className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl text-sm shadow-card outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {query.length < 2 ? (
        <p className="text-sm text-gray-400 text-center py-12">Type at least 2 characters to search.</p>
      ) : (
        <div className="space-y-4">
          {patients.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">HOSPAIN Patients</p>
              <div className="space-y-2">
                {patients.map((p) => (
                  <button key={p.id} onClick={() => setSelected({ type: 'patient', id: p.id, name: `${p.first_name} ${p.last_name}`, phone: p.phone_number, code: p.hospain_id })}
                    className="w-full bg-white rounded-2xl shadow-card p-4 text-left flex justify-between items-center">
                    <div><p className="font-semibold text-ink-900 text-sm">{p.first_name} {p.last_name}</p><p className="text-xs text-gray-400">{p.phone_number}</p></div>
                    <span className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded-full font-semibold">HOSPAIN</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {walkins.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Walk-In Customers</p>
              <div className="space-y-2">
                {walkins.map((w) => (
                  <button key={w.id} onClick={() => setSelected({ type: 'walkin', id: w.id, name: w.name, phone: w.phone })}
                    className="w-full bg-white rounded-2xl shadow-card p-4 text-left flex justify-between items-center">
                    <div><p className="font-semibold text-ink-900 text-sm">{w.name}</p><p className="text-xs text-gray-400">{w.phone}</p></div>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-semibold">Walk-In</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {patients.length === 0 && walkins.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">No matches found.</p>
          )}
        </div>
      )}

      {selected && <CustomerProfileModal customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
