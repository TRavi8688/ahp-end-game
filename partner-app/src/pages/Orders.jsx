import React, { useState, useEffect, useCallback } from 'react';
import { ListOrdered, Search, Plus, X, Check, User, Pill } from 'lucide-react';
import apiClient from '../services/apiClient';

const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

// ── Dispense detail screen (Image 8) ───────────────────────────────────────
function DispenseScreen({ initialPatient, initialMedications, onClose, onDispensed }) {
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patient, setPatient] = useState(initialPatient || null);
  const [inventory, setInventory] = useState([]);
  const [lines, setLines] = useState([]); // { key, label, inventory_item_id, unit_price, quantity, checked, matched }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/pharmacy/inventory').then((res) => setInventory(res.data || [])).catch(() => {});
  }, []);

  // Pre-fill checklist from a network order's prescribed medications, matching
  // each one against live inventory by name so a real price/stock item backs it.
  useEffect(() => {
    if (!initialMedications || inventory.length === 0) return;
    setLines(
      initialMedications.map((med, idx) => {
        const match = inventory.find((i) => i.item_name.toLowerCase().includes((med.name || '').toLowerCase()));
        return {
          key: `${idx}-${med.name}`,
          label: med.name,
          dosage: med.dosage,
          inventory_item_id: match?.id || '',
          unit_price: match?.unit_price || 0,
          quantity: 1,
          checked: !!match,
          matched: !!match,
        };
      })
    );
  }, [initialMedications, inventory]);

  useEffect(() => {
    if (patientQuery.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(() => {
      apiClient.get(`/patients/search?q=${encodeURIComponent(patientQuery)}`)
        .then((res) => setPatientResults(res.data || []))
        .catch(() => setPatientResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const addLine = (item) => {
    setLines((prev) => [
      ...prev,
      { key: item.id, label: item.item_name, inventory_item_id: item.id, unit_price: item.unit_price, quantity: 1, checked: true, matched: true },
    ]);
  };

  const updateLine = (key, patch) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const activeLines = lines.filter((l) => l.checked && l.inventory_item_id);
  const subtotal = activeLines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const gst = subtotal * 0.05;
  const total = subtotal + gst;

  const handleConfirm = async () => {
    setError('');
    if (!patient) { setError('Select a patient first.'); return; }
    if (activeLines.length === 0) { setError('Add at least one matched inventory item.'); return; }
    setSubmitting(true);
    try {
      await apiClient.post('/pharmacy/dispense', {
        patient_id: patient.id,
        items: activeLines.map((l) => ({ inventory_item_id: l.inventory_item_id, quantity: l.quantity })),
      });
      onDispensed?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Could not dispense. Check stock and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-lavender-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <div className="bg-white px-5 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-lavender-100">
          <h2 className="font-bold text-ink-900">Order Dispense</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}

          {/* Patient Details */}
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Patient Details</p>
            {patient ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-ink-900">{patient.first_name} {patient.last_name}</p>
                  <p className="text-xs text-gray-500">{patient.phone_number}</p>
                </div>
                {!initialPatient && (
                  <button onClick={() => setPatient(null)} className="text-xs text-primary-600 font-semibold">Change</button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Search patient by name or phone..."
                  className="w-full pl-9 pr-3 py-2.5 bg-lavender-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
                />
                {patientResults.length > 0 && (
                  <div className="mt-2 border border-lavender-100 rounded-xl overflow-hidden">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setPatient(p); setPatientResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-lavender-50 text-sm border-b border-lavender-50 last:border-0"
                      >
                        <span className="font-semibold text-ink-900">{p.first_name} {p.last_name}</span>{' '}
                        <span className="text-gray-400">{p.phone_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Medicines to Dispense */}
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Medicines to Dispense</p>
            <div className="space-y-3">
              {lines.map((line) => (
                <div key={line.key} className="flex items-start gap-3">
                  <button
                    onClick={() => updateLine(line.key, { checked: !line.checked })}
                    disabled={!line.matched}
                    className={`w-5 h-5 mt-0.5 rounded-full flex items-center justify-center shrink-0 ${
                      line.checked && line.matched ? 'bg-success-500 text-white' : 'border-2 border-gray-300'
                    } ${!line.matched ? 'opacity-40' : ''}`}
                  >
                    {line.checked && line.matched && <Check className="w-3 h-3" />}
                  </button>
                  <div className="flex-1">
                    <p className="font-semibold text-primary-700 text-sm">{line.label}</p>
                    {line.dosage && <p className="text-xs text-gray-400">{line.dosage}</p>}
                    {!line.matched && <p className="text-xs text-warning-600 mt-0.5">Not in stock — won't be dispensed</p>}
                  </div>
                  {line.matched && (
                    <div className="text-right shrink-0">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value, 10) || 1 })}
                        className="w-14 text-center bg-lavender-50 rounded-lg py-1 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">{fmt(line.unit_price)} each</p>
                    </div>
                  )}
                </div>
              ))}
              {lines.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No medicines added yet.</p>}
            </div>

            <InventoryQuickAdd inventory={inventory} onAdd={addLine} />
          </div>

          {/* Price Summary */}
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Price Summary</p>
            <div className="flex justify-between text-sm text-gray-600 py-1">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 py-1">
              <span>GST</span><span>5% - {fmt(gst)}</span>
            </div>
            <div className="flex justify-between font-bold text-ink-900 text-lg pt-2 border-t border-lavender-100 mt-1">
              <span>Total:</span><span>{fmt(total)}</span>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full bg-success-600 hover:bg-success-700 text-white font-semibold py-3.5 rounded-full transition-colors shadow-floating disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? 'Dispensing...' : 'Confirm & Dispense'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryQuickAdd({ inventory, onAdd }) {
  const [q, setQ] = useState('');
  const matches = q.length > 1 ? inventory.filter((i) => i.item_name.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  return (
    <div className="mt-3 pt-3 border-t border-lavender-50">
      <div className="relative">
        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Add another item from inventory..."
          className="w-full pl-9 pr-3 py-2 bg-lavender-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      {matches.map((m) => (
        <button
          key={m.id}
          onClick={() => { onAdd(m); setQ(''); }}
          className="w-full text-left px-3 py-2 text-sm hover:bg-lavender-50 rounded-lg flex justify-between"
        >
          <span>{m.item_name}</span><span className="text-gray-400">{fmt(m.unit_price)}</span>
        </button>
      ))}
    </div>
  );
}

// ── Orders list (network orders feed) ──────────────────────────────────────
export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispenseTarget, setDispenseTarget] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/pharmacy/network-orders');
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ink-900">Orders</h1>
        <button
          onClick={() => setDispenseTarget({ fresh: true })}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New Dispense
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          <div className="bg-primary-50 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <ListOrdered className="w-7 h-7 text-primary-500" />
          </div>
          <h3 className="font-bold text-ink-900 mb-1">No orders yet</h3>
          <p className="text-sm text-gray-500">Prescriptions patients share via your QR code will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-ink-900">{order.patient_name}</p>
                  <p className="text-xs text-gray-500">{order.patient_phone}</p>
                </div>
                <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">New</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(order.medications || []).map((m, idx) => (
                  <span key={idx} className="text-xs bg-lavender-50 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1">
                    <Pill className="w-3 h-3" /> {m.name}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setDispenseTarget({
                  patient: { id: order.patient_id, first_name: order.patient_name?.split(' ')[0] || '', last_name: order.patient_name?.split(' ').slice(1).join(' ') || '', phone_number: order.patient_phone },
                  medications: order.medications,
                })}
                className="w-full bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-2 rounded-xl text-sm transition-colors"
              >
                Process Order
              </button>
            </div>
          ))}
        </div>
      )}

      {dispenseTarget && (
        <DispenseScreen
          initialPatient={dispenseTarget.patient}
          initialMedications={dispenseTarget.medications}
          onClose={() => setDispenseTarget(null)}
          onDispensed={fetchOrders}
        />
      )}
    </div>
  );
}
