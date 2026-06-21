import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, ShoppingCart } from 'lucide-react';
import apiClient from '../../services/apiClient';

export default function MorePurchases() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lines, setLines] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAll = () => {
    apiClient.get('/pharmacy/suppliers').then((res) => setSuppliers(res.data || [])).catch(() => {});
    apiClient.get('/pharmacy/inventory').then((res) => setInventory(res.data || [])).catch(() => {});
    apiClient.get('/pharmacy/purchase-orders').then((res) => setRecentOrders(res.data || [])).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []);

  const addLine = () => setLines((p) => [...p, { inventory_item_id: '', medicine_name: '', quantity: 1, unit_cost: 0 }]);
  const updateLine = (idx, patch) => setLines((p) => p.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx) => setLines((p) => p.filter((_, i) => i !== idx));

  const handleExistingSelect = (idx, itemId) => {
    const item = inventory.find((i) => i.id === itemId);
    updateLine(idx, { inventory_item_id: itemId, medicine_name: item?.item_name || '' });
  };

  const submit = async () => {
    setError('');
    if (!supplierId) { setError('Choose a supplier.'); return; }
    if (lines.length === 0 || lines.some((l) => !l.medicine_name || !l.quantity)) { setError('Add at least one valid item.'); return; }
    setSaving(true);
    try {
      await apiClient.post('/pharmacy/purchase-orders', {
        supplier_id: supplierId, invoice_number: invoiceNumber || null,
        items: lines.map((l) => ({ ...l, quantity: parseInt(l.quantity, 10), unit_cost: parseFloat(l.unit_cost) })),
      });
      setLines([]);
      setInvoiceNumber('');
      loadAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save purchase order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <button onClick={() => navigate('/more')} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <h1 className="text-xl font-bold text-ink-900 mb-4">Purchase Entry</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm mb-3">{error}</div>}

      <div className="bg-white rounded-2xl shadow-card p-4 mb-4 space-y-3">
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm">
          <option value="">Select supplier...</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input placeholder="Supplier invoice number (optional)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />

        {lines.map((line, idx) => (
          <div key={idx} className="bg-lavender-50 rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              <select value={line.inventory_item_id} onChange={(e) => handleExistingSelect(idx, e.target.value)} className="flex-1 px-2 py-2 bg-white rounded-lg text-xs">
                <option value="">New / existing item...</option>
                {inventory.map((i) => <option key={i.id} value={i.id}>{i.item_name}</option>)}
              </select>
              <button onClick={() => removeLine(idx)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
            <input placeholder="Medicine name" value={line.medicine_name} onChange={(e) => updateLine(idx, { medicine_name: e.target.value })} className="w-full px-2 py-1.5 bg-white rounded-lg text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} className="px-2 py-1.5 bg-white rounded-lg text-xs" />
              <input type="number" step="0.01" placeholder="Unit Cost" value={line.unit_cost} onChange={(e) => updateLine(idx, { unit_cost: e.target.value })} className="px-2 py-1.5 bg-white rounded-lg text-xs" />
            </div>
          </div>
        ))}
        <button onClick={addLine} className="w-full bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-2 rounded-xl text-sm flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      <button onClick={submit} disabled={saving} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-full mb-6 disabled:opacity-60">
        {saving ? 'Saving...' : 'Record Purchase'}
      </button>

      <p className="text-sm font-bold text-ink-900 mb-2">Recent Purchases</p>
      {recentOrders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-6 text-center">
          <ShoppingCart className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No purchases recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentOrders.map((po) => (
            <div key={po.id} className="bg-white rounded-2xl shadow-card p-4 flex justify-between">
              <div>
                <p className="font-semibold text-ink-900 text-sm">{po.supplier_name}</p>
                <p className="text-xs text-gray-400">{po.items.length} item(s) {po.invoice_number && `· ${po.invoice_number}`}</p>
              </div>
              <p className="font-bold text-primary-700">₹{po.total_amount.toFixed(0)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
