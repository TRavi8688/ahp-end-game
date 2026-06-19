import React, { useState, useEffect, useCallback } from 'react';
import { Package, Search, Plus, X, AlertTriangle } from 'lucide-react';
import apiClient from '../services/apiClient';

// EXECUTION FIX: this page rendered only a static "No Items Yet" empty
// state with non-functional buttons — it never called the backend. Wired to
// GET/POST /pharmacy/inventory, the same endpoints Dashboard.jsx's
// "Inventory" view uses.
export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    item_name: '', generic_name: '', batch_number: '',
    expiry_date: '', unit_price: '', stock_quantity: '',
  });

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/pharmacy/inventory');
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const filtered = items.filter((i) =>
    i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.generic_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddItem = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.item_name || !form.batch_number || !form.expiry_date) {
      setFormError('Item name, batch number, and expiry date are required.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/pharmacy/inventory', {
        ...form,
        unit_price: parseFloat(form.unit_price) || 0,
        stock_quantity: parseInt(form.stock_quantity, 10) || 0,
      });
      setShowAddForm(false);
      setForm({ item_name: '', generic_name: '', batch_number: '', expiry_date: '', unit_price: '', stock_quantity: '' });
      fetchInventory();
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.detail || 'Could not save item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">Manage medicine stock and pricing</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 justify-center hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Add Inventory Item</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Item name" value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
              className="px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            <input placeholder="Generic name" value={form.generic_name}
              onChange={(e) => setForm({ ...form, generic_name: e.target.value })}
              className="px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            <input required placeholder="Batch number" value={form.batch_number}
              onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
              className="px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            <input required type="date" placeholder="Expiry date" value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              className="px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            <input type="number" min="0" step="0.01" placeholder="Unit price (₹)" value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              className="px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            <input type="number" min="0" placeholder="Stock quantity" value={form.stock_quantity}
              onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
              className="px-3 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            <button type="submit" disabled={saving}
              className="sm:col-span-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Item'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicines..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading inventory...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Items Yet</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">Start adding your medical inventory here so it can be dispensed when patients scan your QR code.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Expiry</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const lowStock = item.stock_quantity <= item.reorder_level;
                  return (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{item.item_name}</div>
                        <div className="text-xs text-gray-400">{item.generic_name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.batch_number}</td>
                      <td className="px-4 py-3 text-gray-600">{item.expiry_date}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 font-semibold ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>
                          {lowStock && <AlertTriangle className="w-3.5 h-3.5" />}
                          {item.stock_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">₹{item.unit_price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
