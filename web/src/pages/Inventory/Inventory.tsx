// partner-app/src/pages/Inventory/Inventory.tsx
//
// BUG FIX: Page was a stub — showed "No inventory items found" always.
// No API calls, no search, no stock update. Now fully wired to Redux
// inventorySlice → GET /api/v1/partner/inventory + PATCH stock.

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Archive, Plus, Search, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { fetchInventory, updateStock, clearError } from '../../store/inventorySlice';

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

interface StockItem {
  id: string;
  item_name: string;
  generic_name: string;
  category: string;
  sku_code: string;
  batch_number: string;
  expiry_date: string;
  stock_quantity: number;
  reorder_level: number;
  unit_price: number;
  mrp: number;
  manufacturer: string;
  is_available: boolean;
}

const Inventory: React.FC = () => {
  const dispatch = useDispatch<any>();
  const { items, loading, error } = useSelector((s: any) => s.inventory);

  const [search,    setSearch]    = useState('');
  const [category,  setCategory]  = useState('');
  const [lowStock,  setLowStock]  = useState(false);
  const [restock,   setRestock]   = useState<StockItem | null>(null);
  const [newQty,    setNewQty]    = useState('');
  const [updating,  setUpdating]  = useState(false);

  const load = (overrides?: { s?: string; c?: string; l?: boolean }) => {
    dispatch(fetchInventory({
      search:   overrides?.s   ?? search,
      category: overrides?.c   ?? category,
      lowStock: overrides?.l   ?? lowStock,
    }));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (v: string) => { setSearch(v); load({ s: v }); };
  const handleCat    = (v: string) => { setCategory(v); load({ c: v }); };
  const handleLow    = (v: boolean) => { setLowStock(v); load({ l: v }); };

  const handleRestock = async () => {
    const qty = parseInt(newQty, 10);
    if (!restock || isNaN(qty) || qty < 0) return;
    setUpdating(true);
    await dispatch(updateStock({ id: restock.id, stock_quantity: qty, reason: 'manual_restock' }));
    setUpdating(false);
    setRestock(null);
    setNewQty('');
  };

  const categories = Array.from(new Set((items as StockItem[]).map((i) => i.category).filter(Boolean)));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Inventory Management</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} items · Track and manage your stock</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="glass-button-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => dispatch(clearError())} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="glass-panel p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text" value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or generic..."
              className="glass-input pl-10"
            />
          </div>
          <select
            value={category} onChange={(e) => handleCat(e.target.value)}
            className="glass-input w-40"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox" checked={lowStock}
              onChange={(e) => handleLow(e.target.checked)}
              className="accent-primary"
            />
            Low Stock Only
          </label>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Archive size={48} className="mx-auto mb-4 opacity-50" />
            <p>No inventory items found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {['Item', 'Category', 'Batch / Expiry', 'Stock', 'Price / MRP', 'Actions'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(items as StockItem[]).map((item) => {
                  const isLow     = item.stock_quantity <= item.reorder_level;
                  const daysExp   = item.expiry_date
                    ? Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000)
                    : null;
                  const isExpSoon = daysExp !== null && daysExp <= 30;
                  const rowBg     = isLow ? 'bg-red-500/5' : isExpSoon ? 'bg-amber-500/5' : '';

                  return (
                    <tr key={item.id}
                      className={`border-b border-slate-700/20 hover:bg-slate-800/40 transition-colors ${rowBg}`}>
                      <td className="py-3 px-4">
                        <p className="text-white font-semibold">{item.item_name}</p>
                        <p className="text-slate-400 text-xs">{item.generic_name}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{item.category || '—'}</td>
                      <td className="py-3 px-4">
                        <p className="text-slate-300 text-xs font-mono">{item.batch_number || '—'}</p>
                        {item.expiry_date && (
                          <p className={`text-xs ${isExpSoon ? 'text-amber-400' : 'text-slate-500'}`}>
                            Exp: {new Date(item.expiry_date).toLocaleDateString('en-IN')}
                            {isExpSoon && ` (${daysExp}d)`}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold text-lg ${isLow ? 'text-red-400' : 'text-white'}`}>
                          {item.stock_quantity}
                        </span>
                        <p className="text-slate-500 text-xs">Reorder: {item.reorder_level}</p>
                        {isLow && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Low
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs">
                        <p>{fmt(item.unit_price)} / unit</p>
                        <p className="text-slate-500">MRP: {fmt(item.mrp)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => { setRestock(item); setNewQty(String(item.stock_quantity)); }}
                          className="text-xs text-primary hover:text-blue-400 font-medium transition-colors border border-primary/30 hover:border-blue-400/50 px-3 py-1.5 rounded-lg"
                        >
                          Update Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {restock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Update Stock</h3>
              <button onClick={() => setRestock(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-primary font-semibold mb-1">{restock.item_name}</p>
            <p className="text-slate-400 text-sm mb-4">Current: {restock.stock_quantity} · Reorder level: {restock.reorder_level}</p>

            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">New Quantity</label>
            <input
              type="number" min="0" value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="glass-input text-center text-xl font-bold mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setRestock(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 hover:text-white transition-colors text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleRestock} disabled={updating}
                className="flex-1 glass-button py-2.5 text-sm">
                {updating ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
