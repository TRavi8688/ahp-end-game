import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill, Package, Plus, RefreshCw, AlertTriangle,
  CheckCircle, Clock, X, Loader2, ShoppingCart,
  Archive, IndianRupee, AlertCircle,
} from 'lucide-react';
import apiClient from '../../apiClient';

interface InventoryItem {
  id: string;
  item_name: string;
  generic_name?: string;
  category: string;
  batch_number: string;
  expiry_date?: string;
  stock_quantity?: number;
  quantity?: number;
  min_stock_level?: number;
  unit_price: number;
}

interface Prescription {
  id: string;
  patient_name?: string;
  patient_id?: string;
  doctor_name?: string;
  medicines: Array<{ name: string; dosage?: string; qty?: number }>;
  created_at?: string;
  status: string;
}

// FIXED: replaced undefined glass-panel CSS class everywhere with explicit Tailwind
const panel = 'bg-white/[0.02] border border-white/5 rounded-3xl';

const stockBadge = (qty: number, min?: number) =>
  qty <= (min ?? 10)
    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

// ── Add Medicine Modal ────────────────────────────────────────────────────────
const AddMedicineModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState({ item_name: '', generic_name: '', category: 'Antibiotic', batch_number: '', expiry_date: '', unit_price: '', stock_quantity: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null); // FIXED: replaced alert()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/pharmacy/inventory', {
        ...form,
        unit_price:     parseFloat(form.unit_price),
        stock_quantity: parseInt(form.stock_quantity, 10),
        expiry_date:    form.expiry_date ? new Date(form.expiry_date).toISOString() : undefined,
      });
      onSuccess(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error adding medicine. Check your permissions.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center p-8 border-b border-white/5">
          <h2 className="text-xl font-black tracking-tight uppercase">Add New Medicine</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/5"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-2 text-xs font-bold"><AlertCircle size={14} />{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Brand Name *</label>
              <input required className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} placeholder="Dolo 650" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Generic Name</label>
              <input className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.generic_name} onChange={e => setForm({ ...form, generic_name: e.target.value })} placeholder="Paracetamol" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Category</label>
              <select className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {['Antibiotic', 'Analgesic', 'Antacid', 'Supplement', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Batch No. *</label>
              <input required className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} placeholder="B1093" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Quantity *</label>
              <input required type="number" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} placeholder="500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Unit Price (₹) *</label>
              <input required type="number" step="0.1" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} placeholder="35.50" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Expiry Date</label>
            <input type="date" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-black uppercase tracking-wider transition-all">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Push to Ledger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Update Stock Modal ────────────────────────────────────────────────────────
const UpdateStockModal: React.FC<{ item: InventoryItem; onClose: () => void; onSuccess: () => void }> = ({ item, onClose, onSuccess }) => {
  const [form, setForm] = useState({ stock_quantity: String(item.stock_quantity ?? item.quantity ?? ''), unit_price: String(item.unit_price) });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null); // FIXED: replaced alert()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.put(`/pharmacy/inventory/${item.id}`, {
        stock_quantity: parseInt(form.stock_quantity, 10),
        unit_price:     form.unit_price ? parseFloat(form.unit_price) : undefined,
      });
      onSuccess(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error updating stock.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center p-8 border-b border-white/5">
          <div><h2 className="text-xl font-black tracking-tight uppercase">Update Stock</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{item.item_name}</p></div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/5"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-2 text-xs font-bold"><AlertCircle size={14} />{error}</div>}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">New Stock Quantity *</label>
            <input required type="number" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Unit Price ₹</label>
            <input type="number" step="0.1" className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-black uppercase tracking-wider transition-all">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Push Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const PharmacyDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'inventory'>('prescriptions');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [rxFilter, setRxFilter]   = useState<'pending' | 'dispensed' | 'all'>('pending');
  const [stats, setStats] = useState({ totalMeds: '—' as string | number, lowStock: '—' as string | number, pendingRx: '—' as string | number });
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingRx, setLoadingRx]   = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [updateItem, setUpdateItem]     = useState<InventoryItem | null>(null);
  const [dispensing, setDispensing]     = useState<string | null>(null);
  const [dispenseError, setDispenseError] = useState<string | null>(null); // FIXED: replaced alert()

  const fetchInventory = useCallback(async () => {
    try {
      setLoadingInv(true);
      const res  = await apiClient.get('/pharmacy/inventory');
      const list: InventoryItem[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setInventory(list);
      const low = list.filter(i => (i.stock_quantity ?? i.quantity ?? 0) <= (i.min_stock_level ?? 10)).length;
      setStats(prev => ({ ...prev, totalMeds: list.length, lowStock: low }));
    } catch (err) { console.error('Failed to fetch inventory', err); }
    finally { setLoadingInv(false); }
  }, []);

  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoadingRx(true);
      // FIXED: was /api/v1/pharmacy/prescriptions (double prefix) → /pharmacy/prescriptions
      const params = rxFilter !== 'all' ? `?status=${rxFilter}` : '';
      const res = await apiClient.get(`/pharmacy/prescriptions${params}`);
      const list: Prescription[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setPrescriptions(list);
      if (rxFilter === 'pending') setStats(prev => ({ ...prev, pendingRx: list.length }));
    } catch (err) { console.error('Failed to fetch prescriptions', err); setPrescriptions([]); }
    finally { setLoadingRx(false); }
  }, [rxFilter]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);
  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  const handleDispense = async (rxId: string) => {
    setDispenseError(null);
    setDispensing(rxId);
    try {
      // FIXED: was /api/v1/pharmacy/... → /pharmacy/...
      await apiClient.post(`/pharmacy/prescriptions/${rxId}/dispense`);
      await fetchPrescriptions();
    } catch (err: any) {
      setDispenseError(err.response?.data?.detail || 'Failed to dispense prescription.');
      setTimeout(() => setDispenseError(null), 4000);
    } finally { setDispensing(null); }
  };

  return (
    <div className="min-h-screen p-8 space-y-8 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase">
            <Pill size={36} className="text-blue-500" /> Pharmacy Command
          </h1>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase mt-2">Inventory · Prescriptions · Dispensing</p>
        </div>
        <div className="px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-full flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Sync</span>
        </div>
      </div>

      {dispenseError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 text-sm font-bold">
          <AlertCircle size={16} />{dispenseError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Medicines', value: stats.totalMeds, icon: Package,       color: 'text-blue-400' },
          { label: 'Low Stock Alerts',value: stats.lowStock,  icon: AlertTriangle, color: 'text-amber-400' },
          { label: 'Pending Rx',      value: stats.pendingRx, icon: Clock,         color: 'text-purple-400' },
        ].map((card, i) => (
          <div key={i} className={`${panel} p-6 space-y-4`}>
            <div className={`p-2 rounded-lg bg-slate-900 w-fit ${card.color}`}><card.icon size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{card.label}</p>
              <h2 className={`text-3xl font-black tracking-tighter ${card.color}`}>{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-900/50 border border-white/5 rounded-2xl w-fit">
        {([['prescriptions', 'Prescription Queue', ShoppingCart], ['inventory', 'Inventory', Archive]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === key ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Prescriptions Tab */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {(['pending', 'dispensed', 'all'] as const).map(f => (
              <button key={f} onClick={() => setRxFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${rxFilter === f ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
                {f}
              </button>
            ))}
            <button onClick={fetchPrescriptions} className="p-2 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-white transition"><RefreshCw size={14} /></button>
          </div>

          {loadingRx ? (
            <div className="flex items-center justify-center py-24 gap-4"><Loader2 size={32} className="text-blue-500 animate-spin" /><p className="text-slate-500 text-sm font-bold">Loading prescriptions...</p></div>
          ) : prescriptions.length === 0 ? (
            <div className={`${panel} p-16 text-center space-y-4`}><ShoppingCart size={40} className="text-slate-600 mx-auto" /><p className="text-slate-500 font-bold">No {rxFilter} prescriptions</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prescriptions.map(rx => (
                <div key={rx.id} className={`${panel} p-6 space-y-4 hover:border-blue-500/20 transition-all`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-[10px] text-slate-600">Rx #{rx.id.slice(0, 8).toUpperCase()}</p>
                      <h4 className="font-black text-white mt-1">{rx.patient_name ?? `Patient #${rx.patient_id?.slice(0, 8)}`}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Dr. {rx.doctor_name ?? 'Unknown'}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${rx.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : rx.status === 'dispensed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {rx.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(rx.medicines ?? []).slice(0, 4).map((med, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900/40 px-3 py-1.5 rounded-lg">
                        <span className="text-sm font-bold text-slate-300">{med.name}</span>
                        {med.dosage && <span className="text-[10px] text-slate-500 font-bold">{med.dosage}</span>}
                      </div>
                    ))}
                    {(rx.medicines?.length ?? 0) > 4 && <p className="text-[10px] text-slate-600 text-center">+{rx.medicines.length - 4} more</p>}
                  </div>
                  {rx.status === 'pending' && (
                    <button onClick={() => handleDispense(rx.id)} disabled={dispensing === rx.id}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                      {dispensing === rx.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : '✓ Mark as Dispensed'}
                    </button>
                  )}
                  {rx.status === 'dispensed' && (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle size={14} /><span className="text-xs font-black uppercase tracking-widest">Dispensed</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={fetchInventory} className="p-2 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-white transition"><RefreshCw size={14} /></button>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{inventory.length} items</span>
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              <Plus size={14} /> Add Medicine
            </button>
          </div>

          {loadingInv ? (
            <div className="flex items-center justify-center py-24 gap-4"><Loader2 size={32} className="text-blue-500 animate-spin" /><p className="text-slate-500 text-sm font-bold">Syncing live inventory...</p></div>
          ) : inventory.length === 0 ? (
            <div className={`${panel} p-16 text-center space-y-4`}><Package size={40} className="text-slate-600 mx-auto" /><p className="text-slate-500 font-bold">No inventory found for this hospital</p></div>
          ) : (
            <div className={`${panel} overflow-hidden border-slate-800/50`}>
              <div className="bg-slate-900/40 p-4 border-b border-slate-800/50 grid grid-cols-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span className="col-span-2">Item</span><span>Category</span><span>Batch</span><span>Stock</span><span>Actions</span>
              </div>
              <div className="divide-y divide-slate-800/50">
                {inventory.map(item => {
                  const qty = item.stock_quantity ?? item.quantity ?? 0;
                  return (
                    <div key={item.id} className="p-4 grid grid-cols-6 items-center hover:bg-white/[0.02] transition-all">
                      <div className="col-span-2">
                        <p className="font-bold text-sm text-white">{item.item_name}</p>
                        {item.generic_name && <p className="text-[10px] text-slate-500">{item.generic_name}</p>}
                      </div>
                      <span className="text-xs text-slate-400">{item.category}</span>
                      <span className="font-mono text-xs text-slate-500">{item.batch_number}</span>
                      <div>
                        <span className={`text-xs font-black px-2 py-1 rounded-lg ${stockBadge(qty, item.min_stock_level)}`}>{qty}</span>
                        <p className="text-[10px] text-slate-600 mt-0.5">₹{item.unit_price}/unit</p>
                      </div>
                      <button onClick={() => setUpdateItem(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-blue-600/10 hover:text-blue-400 border border-white/5 hover:border-blue-600/20 text-slate-500 text-[10px] font-black uppercase rounded-lg transition-all w-fit">
                        <RefreshCw size={10} /> Update
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showAddModal && <AddMedicineModal onClose={() => setShowAddModal(false)} onSuccess={fetchInventory} />}
      {updateItem && <UpdateStockModal item={updateItem} onClose={() => setUpdateItem(null)} onSuccess={fetchInventory} />}
    </div>
  );
};

export default PharmacyDashboard;
