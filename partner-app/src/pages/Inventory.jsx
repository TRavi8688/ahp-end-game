import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Camera, AlertTriangle, Pill, Droplet, Syringe, X, Check, Package, Clock, PackageX, Plus, Edit2, Trash2 } from 'lucide-react';
import Webcam from 'react-webcam';
import apiClient from '../services/apiClient';

const CATEGORY_META = {
  Tablet: { label: 'Tablets', icon: Pill, color: 'text-primary-600 bg-primary-50' },
  Syrup: { label: 'Syrups', icon: Droplet, color: 'text-success-600 bg-success-50' },
  Injection: { label: 'Injections', icon: Syringe, color: 'text-blue-600 bg-blue-50' },
};

const todayPlus30 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
};

function AiScanModal({ onClose, onSaved }) {
  const webcamRef = useRef(null);
  const [stage, setStage] = useState('camera'); // camera | processing | review | saving
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const capture = async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    setStage('processing');
    setError('');
    try {
      const res = await apiClient.post('/pharmacy/ai-scan', { image_base64: imageSrc });
      setResult({ ...res.data, stock_quantity: 1 });
      setStage('review');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'AI scan failed. Try a clearer photo or enter details manually.');
      setStage('camera');
    }
  };

  const save = async () => {
    setStage('saving');
    try {
      await apiClient.post('/pharmacy/inventory', result);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Could not save item.');
      setStage('review');
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-lavender-100">
          <h2 className="font-bold text-ink-900">AI Scan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm mb-3">{error}</div>}

          {stage === 'camera' && (
            <>
              <div className="rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover" videoConstraints={{ facingMode: 'environment' }} />
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">Point your camera at the medicine strip or box label.</p>
              <button onClick={capture} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-full mt-4">
                Capture & Scan
              </button>
            </>
          )}

          {stage === 'processing' && (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Reading the label...</p>
            </div>
          )}

          {stage === 'review' && result && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Confidence: {Math.round((result.confidence || 0) * 100)}% — review before saving.</p>
              {['item_name', 'generic_name', 'batch_number', 'expiry_date', 'unit_price', 'stock_quantity'].map((field) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 capitalize">{field.replace('_', ' ')}</label>
                  <input
                    value={result[field] ?? ''}
                    onChange={(e) => setResult({ ...result, [field]: e.target.value })}
                    className="w-full px-3 py-2 bg-lavender-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
              <button onClick={save} className="w-full bg-success-600 hover:bg-success-700 text-white font-semibold py-3 rounded-full flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Save to Inventory
              </button>
            </div>
          )}

          {stage === 'saving' && <p className="text-center text-gray-500 py-12 text-sm">Saving...</p>}
        </div>
      </div>
    </div>
  );
}

// Screen 20: Add Medicine (manual form)
function AddMedicineModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ item_name: '', generic_name: '', category: 'Tablet', batch_number: '', expiry_date: '', unit_price: '', stock_quantity: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!form.item_name || !form.batch_number || !form.expiry_date) {
      setError('Name, batch number, and expiry date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/pharmacy/inventory', { ...form, unit_price: parseFloat(form.unit_price) || 0, stock_quantity: parseInt(form.stock_quantity, 10) || 0 });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 flex items-center justify-between border-b border-lavender-100 sticky top-0 bg-white">
          <h2 className="font-bold text-ink-900">Add Medicine</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
          <input required placeholder="Name" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm">
            <option value="Tablet">Tablet</option><option value="Syrup">Syrup</option><option value="Injection">Injection</option><option value="Other">Other</option>
          </select>
          <input required placeholder="Batch" value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input required type="number" placeholder="Quantity" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input required type="date" placeholder="Expiry" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input type="number" step="0.01" placeholder="Selling Price (MRP)" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <button type="submit" disabled={saving} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-full disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Medicine'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Screen 19: Medicine Details (Edit/Delete)
function MedicineDetailModal({ item, onClose, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...item });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/pharmacy/inventory/${item.id}`, {
        item_name: form.item_name, batch_number: form.batch_number, expiry_date: form.expiry_date,
        unit_price: parseFloat(form.unit_price), stock_quantity: parseInt(form.stock_quantity, 10),
      });
      onChanged();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${item.item_name}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/pharmacy/inventory/${item.id}`);
      onChanged();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete item.');
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-lavender-100">
          <h2 className="font-bold text-ink-900">{editing ? 'Edit Medicine' : 'Medicine Details'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5">
          {!editing ? (
            <>
              <p className="text-lg font-bold text-ink-900">{item.item_name}</p>
              <p className="text-sm text-gray-400 mb-4">{item.generic_name}</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[['Stock', item.stock_quantity], ['Batch', item.batch_number], ['Expiry', item.expiry_date], ['Selling Price', `₹${item.unit_price}`]].map(([k, v]) => (
                  <div key={k} className="bg-lavender-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">{k}</p>
                    <p className="font-bold text-ink-900 text-sm">{v}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setEditing(true)} className="bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button onClick={remove} className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" placeholder="Name" />
              <input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" placeholder="Batch" />
              <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
              <input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" placeholder="Stock" />
              <input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" placeholder="Price" />
              <button onClick={save} disabled={saving} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-full disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null); // low_stock | expiring | out_of_stock
  const [showAiScan, setShowAiScan] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

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

  const categoryCounts = items.reduce((acc, i) => {
    acc[i.category || 'Other'] = (acc[i.category || 'Other'] || 0) + 1;
    return acc;
  }, {});

  const lowStockCount = items.filter((i) => i.stock_quantity > 0 && i.stock_quantity <= i.reorder_level).length;
  const outOfStockCount = items.filter((i) => i.stock_quantity <= 0).length;
  const expiringCount = items.filter((i) => i.expiry_date && new Date(i.expiry_date) <= todayPlus30()).length;

  const filtered = items.filter((i) => {
    const matchesSearch =
      i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.batch_number?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || i.category === activeCategory;
    let matchesFilter = true;
    if (activeFilter === 'low_stock') matchesFilter = i.stock_quantity > 0 && i.stock_quantity <= i.reorder_level;
    if (activeFilter === 'out_of_stock') matchesFilter = i.stock_quantity <= 0;
    if (activeFilter === 'expiring') matchesFilter = i.expiry_date && new Date(i.expiry_date) <= todayPlus30();
    return matchesSearch && matchesCategory && matchesFilter;
  });

  const SUMMARY_CARDS = [
    { key: null, label: 'Total Medicines', count: items.length, icon: Package, color: 'text-primary-600 bg-primary-50' },
    { key: 'low_stock', label: 'Low Stock', count: lowStockCount, icon: AlertTriangle, color: 'text-warning-600 bg-warning-50' },
    { key: 'expiring', label: 'Expiring', count: expiringCount, icon: Clock, color: 'text-red-500 bg-red-50' },
    { key: 'out_of_stock', label: 'Out of Stock', count: outOfStockCount, icon: PackageX, color: 'text-gray-500 bg-gray-100' },
  ];

  return (
    <div className="p-4 sm:p-6 relative">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ink-900">Inventory</h1>
        <button onClick={() => setShowAddForm(true)} className="text-primary-600 font-semibold text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {SUMMARY_CARDS.map((c) => (
          <button key={c.label} onClick={() => setActiveFilter(activeFilter === c.key ? null : c.key)}
            className={`bg-white rounded-2xl p-2.5 shadow-card border-2 text-center ${activeFilter === c.key ? 'border-primary-400' : 'border-transparent'}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1 ${c.color}`}>
              <c.icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-sm font-extrabold text-ink-900">{c.count}</p>
            <p className="text-[9px] font-semibold text-gray-400 leading-tight">{c.label}</p>
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medicines, batch numbers..."
          className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl text-sm shadow-card outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const active = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(active ? null : key)}
              className={`bg-white rounded-2xl p-3 flex flex-col items-center gap-2 shadow-card border-2 transition-colors ${
                active ? 'border-primary-400' : 'border-transparent'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-ink-900">{meta.label}</p>
                <p className="text-[11px] text-gray-400">{categoryCounts[key] || 0} items</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-sm font-bold text-ink-900 mb-2">
        {activeFilter ? SUMMARY_CARDS.find((c) => c.key === activeFilter)?.label : 'Active Stock'} ({filtered.length} Items)
      </p>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading inventory...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          <p className="text-gray-500 text-sm">No items match. Try the AI Scan button to add your first item.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-20">
          {filtered.map((item) => {
            const lowStock = item.stock_quantity > 0 && item.stock_quantity <= item.reorder_level;
            const outOfStock = item.stock_quantity <= 0;
            return (
              <button key={item.id} onClick={() => setDetailItem(item)} className="w-full text-left bg-white rounded-2xl shadow-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-ink-900">{item.item_name}</p>
                    <p className="text-xs text-gray-400">Batch: {item.batch_number} &nbsp;Exp: {item.expiry_date}</p>
                  </div>
                  <p className="font-bold text-primary-700">{item.stock_quantity} <span className="text-xs font-normal text-gray-400">left</span></p>
                </div>
                {outOfStock ? (
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">Out of Stock</span>
                ) : lowStock ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-warning-600 bg-warning-50 px-2.5 py-1 rounded-full w-fit">
                    <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-success-600 bg-success-50 px-2.5 py-1 rounded-full">Available</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setShowAiScan(true)}
        className="fixed bottom-24 right-5 sm:right-[calc(50%-19rem)] bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 shadow-floating flex items-center justify-center z-20"
      >
        <Camera className="w-6 h-6" />
      </button>

      {showAiScan && <AiScanModal onClose={() => setShowAiScan(false)} onSaved={fetchInventory} />}
      {showAddForm && <AddMedicineModal onClose={() => setShowAddForm(false)} onSaved={fetchInventory} />}
      {detailItem && <MedicineDetailModal item={detailItem} onClose={() => setDetailItem(null)} onChanged={fetchInventory} />}
    </div>
  );
}
