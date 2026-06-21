import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Camera, AlertTriangle, Pill, Droplet, Syringe, X, Check } from 'lucide-react';
import Webcam from 'react-webcam';
import apiClient from '../services/apiClient';

const CATEGORY_META = {
  Tablet: { label: 'Tablets', icon: Pill, color: 'text-primary-600 bg-primary-50' },
  Syrup: { label: 'Syrups', icon: Droplet, color: 'text-success-600 bg-success-50' },
  Injection: { label: 'Injections', icon: Syringe, color: 'text-blue-600 bg-blue-50' },
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

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [showAiScan, setShowAiScan] = useState(false);

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

  const filtered = items.filter((i) => {
    const matchesSearch =
      i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.batch_number?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || i.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4 sm:p-6 relative">
      <h1 className="text-xl font-bold text-ink-900 mb-4">Inventory</h1>

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

      <p className="text-sm font-bold text-ink-900 mb-2">Active Stock ({items.length} Items)</p>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading inventory...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          <p className="text-gray-500 text-sm">No items match. Try the AI Scan button to add your first item.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-20">
          {filtered.map((item) => {
            const lowStock = item.stock_quantity <= item.reorder_level;
            return (
              <div key={item.id} className="bg-white rounded-2xl shadow-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-ink-900">{item.item_name}</p>
                    <p className="text-xs text-gray-400">Batch: {item.batch_number} &nbsp;Exp: {item.expiry_date}</p>
                  </div>
                  <p className="font-bold text-primary-700">{item.stock_quantity} <span className="text-xs font-normal text-gray-400">left</span></p>
                </div>
                {lowStock ? (
                  <div className="flex items-center justify-between mt-2">
                    <span className="flex items-center gap-1 text-xs font-semibold text-warning-600 bg-warning-50 px-2.5 py-1 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-success-600 bg-success-50 px-2.5 py-1 rounded-full">Available</span>
                )}
              </div>
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
    </div>
  );
}
