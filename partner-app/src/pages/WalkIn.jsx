import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, User, Phone, Camera, Upload, SkipForward, Search, Trash2, Banknote, Smartphone, CreditCard, Check, Printer, Download, Share2, ChevronLeft, Receipt } from 'lucide-react';
import apiClient from '../services/apiClient';

const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

// ── Walk-In Dashboard (Screen 10) ───────────────────────────────────────────
function WalkInDashboard({ onStart }) {
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/pharmacy/sales?limit=10')
      .then((res) => setRecentBills(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-ink-900 mb-4">Walk-In</h1>

      <button
        onClick={onStart}
        className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-bold py-5 rounded-3xl shadow-floating flex items-center justify-center gap-2 mb-6"
      >
        <Plus className="w-6 h-6" /> Create New Bill
      </button>

      <p className="text-sm font-bold text-ink-900 mb-2">Recent Bills</p>
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Loading...</p>
      ) : recentBills.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No bills yet today.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {recentBills.map((bill) => (
            <div key={bill.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink-900 text-sm">{bill.invoice_number}</p>
                <p className="text-xs text-gray-400">{new Date(bill.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</p>
              </div>
              <p className="font-bold text-primary-700">{fmt(bill.total)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 1: Customer Details (Screen 11) ────────────────────────────────────
function CustomerStep({ onNext, onSkip }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    setError('');
    setSaving(true);
    try {
      if (name || phone) {
        const res = await apiClient.post('/pharmacy/walkin-customers', { name: name || 'Walk-In Customer', phone: phone || '' });
        onNext({ walkin_customer_id: res.data.id, customer: res.data });
      } else {
        onNext({ walkin_customer_id: null, customer: null });
      }
    } catch (err) {
      console.error(err);
      setError('Could not save customer. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-lg font-bold text-ink-900 mb-1">Customer Details</h2>
      <p className="text-sm text-gray-500 mb-5">Optional — leave blank for a quick anonymous sale.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm mb-4">{error}</div>}

      <div className="bg-white rounded-2xl shadow-card p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink-900 mb-1.5">Name</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name"
              className="w-full pl-10 pr-4 py-3 bg-lavender-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink-900 mb-1.5">Mobile Number</label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210"
              className="w-full pl-10 pr-4 py-3 bg-lavender-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </div>

      <button onClick={handleContinue} disabled={saving} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-full mt-5 disabled:opacity-60">
        {saving ? 'Saving...' : 'Continue'}
      </button>
    </div>
  );
}

// ── Step 2: Prescription Upload (Screen 12) ─────────────────────────────────
function PrescriptionUploadStep({ onNext, onBack }) {
  const fileInputRef = useRef(null);
  const [photo, setPhoto] = useState(null);

  return (
    <div className="p-4 sm:p-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <h2 className="text-lg font-bold text-ink-900 mb-1">Prescription</h2>
      <p className="text-sm text-gray-500 mb-5">Attach a photo for the record, or skip for OTC sales.</p>

      <div className="bg-white rounded-2xl shadow-card p-6 text-center">
        {photo ? (
          <img src={photo} alt="Prescription" className="w-full rounded-xl mb-4 max-h-64 object-contain" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-lavender-50 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-7 h-7 text-primary-400" />
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPhoto(URL.createObjectURL(file));
          }} />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
            <Camera className="w-4 h-4" /> Take Photo
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
            <Upload className="w-4 h-4" /> Upload Photo
          </button>
        </div>
      </div>

      <button onClick={() => onNext({ photo })} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-full mt-5">
        {photo ? 'Continue' : 'Continue'}
      </button>
      <button onClick={() => onNext({ photo: null })} className="w-full text-gray-400 font-semibold py-2 mt-1 text-sm flex items-center justify-center gap-1">
        <SkipForward className="w-4 h-4" /> Skip
      </button>
    </div>
  );
}

// ── Step 3: Medicine Entry (Screen 13) ──────────────────────────────────────
function MedicineEntryStep({ cart, setCart, onNext, onBack }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [allInventory, setAllInventory] = useState([]);

  useEffect(() => {
    apiClient.get('/pharmacy/inventory').then((res) => setAllInventory(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    setResults(allInventory.filter((i) => i.item_name.toLowerCase().includes(query.toLowerCase())).slice(0, 8));
  }, [query, allInventory]);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.inventory_item_id === item.id);
      if (existing) {
        return prev.map((l) => (l.inventory_item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { inventory_item_id: item.id, name: item.item_name, unit_price: item.unit_price, stock: item.stock_quantity, quantity: 1 }];
    });
    setQuery('');
  };

  return (
    <div className="p-4 sm:p-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <h2 className="text-lg font-bold text-ink-900 mb-3">Add Medicines</h2>

      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Medicine"
          className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl text-sm shadow-card outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card mb-4 overflow-hidden">
          {results.map((item) => (
            <button key={item.id} onClick={() => addToCart(item)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-lavender-50 border-b border-lavender-50 last:border-0">
              <div className="text-left">
                <p className="font-semibold text-ink-900 text-sm">{item.item_name}</p>
                <p className="text-xs text-gray-400">Stock {item.stock_quantity}</p>
              </div>
              <span className="text-primary-600 font-bold text-sm">{fmt(item.unit_price)}</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-sm font-bold text-ink-900 mb-2">Cart ({cart.length})</p>
      {cart.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No medicines added yet.</p>
      ) : (
        <div className="space-y-2 mb-5">
          {cart.map((line) => (
            <div key={line.inventory_item_id} className="bg-white rounded-xl shadow-card p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink-900 text-sm">{line.name}</p>
                <p className="text-xs text-gray-400">{fmt(line.unit_price)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={line.stock} value={line.quantity}
                  onChange={(e) => setCart((prev) => prev.map((l) => l.inventory_item_id === line.inventory_item_id ? { ...l, quantity: parseInt(e.target.value, 10) || 1 } : l))}
                  className="w-12 text-center bg-lavender-50 rounded-lg py-1 text-sm" />
                <button onClick={() => setCart((prev) => prev.filter((l) => l.inventory_item_id !== line.inventory_item_id))} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onNext} disabled={cart.length === 0} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-full disabled:opacity-50">
        Review Bill
      </button>
    </div>
  );
}

// ── Step 4: Billing Cart (Screen 14) ────────────────────────────────────────
function BillingCartStep({ cart, onNext, onBack }) {
  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const gst = subtotal * 0.05;
  const total = subtotal + gst;

  return (
    <div className="p-4 sm:p-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <h2 className="text-lg font-bold text-ink-900 mb-3">Billing Cart</h2>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs border-b border-lavender-50">
            <th className="px-4 py-2.5 font-semibold">Medicine</th><th className="px-2 py-2.5 font-semibold">Qty</th><th className="px-4 py-2.5 font-semibold text-right">Price</th>
          </tr></thead>
          <tbody>
            {cart.map((l) => (
              <tr key={l.inventory_item_id} className="border-b border-lavender-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink-900">{l.name}</td>
                <td className="px-2 py-2.5 text-gray-500">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{fmt(l.unit_price * l.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 mb-5">
        <div className="flex justify-between text-sm text-gray-600 py-1"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
        <div className="flex justify-between text-sm text-gray-600 py-1"><span>GST (5%)</span><span>{fmt(gst)}</span></div>
        <div className="flex justify-between font-bold text-ink-900 text-lg pt-2 border-t border-lavender-100 mt-1"><span>Total:</span><span>{fmt(total)}</span></div>
      </div>

      <button onClick={onNext} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-full">
        Generate Bill
      </button>
    </div>
  );
}

// ── Step 5: Payment (Screen 15) ─────────────────────────────────────────────
function PaymentStep({ cart, customerState, onComplete, onBack }) {
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const total = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0) * 1.05;

  const handleComplete = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.post('/pharmacy/sales', {
        walkin_customer_id: customerState.walkin_customer_id,
        items: cart.map((l) => ({ inventory_item_id: l.inventory_item_id, quantity: l.quantity })),
        payment_method: method,
      });
      onComplete(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Payment could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const methods = [
    { key: 'cash', label: 'Cash', icon: Banknote },
    { key: 'upi', label: 'UPI', icon: Smartphone },
    { key: 'card', label: 'Card', icon: CreditCard },
  ];

  return (
    <div className="p-4 sm:p-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <h2 className="text-lg font-bold text-ink-900 mb-1">Payment</h2>
      <p className="text-2xl font-extrabold text-primary-700 mb-5">{fmt(total)}</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-3 gap-3 mb-6">
        {methods.map((m) => (
          <button key={m.key} onClick={() => setMethod(m.key)}
            className={`bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-card border-2 ${method === m.key ? 'border-primary-500' : 'border-transparent'}`}>
            <m.icon className={`w-6 h-6 ${method === m.key ? 'text-primary-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-bold ${method === m.key ? 'text-primary-700' : 'text-gray-500'}`}>{m.label}</span>
          </button>
        ))}
      </div>

      <button onClick={handleComplete} disabled={submitting} className="w-full bg-success-600 hover:bg-success-700 text-white font-bold py-4 rounded-full shadow-floating disabled:opacity-60">
        {submitting ? 'Processing...' : 'Complete Sale'}
      </button>
    </div>
  );
}

// ── Step 6: Bill Success (Screen 16) ────────────────────────────────────────
function BillSuccessStep({ sale, onDone }) {
  const handleWhatsApp = () => {
    const pharmacyName = (() => {
      try {
        const token = localStorage.getItem('token');
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.hospital_name || 'HOSPAIN Partner Pharmacy';
      } catch { return 'HOSPAIN Partner Pharmacy'; }
    })();
    const itemsList = (sale.items || []).map(i => `  • ${i.medicine_name} × ${i.quantity} — ₹${i.line_total?.toFixed(2) || '0.00'}`).join('\n');
    const text = encodeURIComponent(
      `🏥 *${pharmacyName}*\n` +
      `_Powered by HOSPAIN — Care Beyond Today_\n\n` +
      `*Invoice:* ${sale.invoice_number}\n` +
      `*Date:* ${new Date().toLocaleDateString('en-IN')}\n\n` +
      `*Items:*\n${itemsList}\n\n` +
      `*Total Paid:* ₹${sale.total?.toFixed(2) || '0.00'}\n\n` +
      `Thank you for choosing us! 🙏\nFor queries: support@hospain.in`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };
  const handlePdf = () => {
    apiClient.get(`/pharmacy/sales/${sale.id}/pdf`, { responseType: 'blob' }).then((res) => {
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${sale.invoice_number}.pdf`; a.click();
    }).catch(() => alert('Could not generate PDF.'));
  };

  return (
    <div className="p-4 sm:p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4 mt-4">
        <Check className="w-8 h-8 text-success-600" />
      </div>
      <h2 className="text-xl font-bold text-ink-900">Bill Generated</h2>
      <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
      <p className="text-lg font-bold text-primary-700 mb-6">{sale.invoice_number}</p>

      <div className="bg-white rounded-2xl shadow-card p-4 mb-6 text-left">
        {sale.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm py-1.5 border-b border-lavender-50 last:border-0">
            <span className="text-gray-700">{item.medicine_name} × {item.quantity}</span>
            <span className="font-medium text-ink-900">{fmt(item.line_total)}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-ink-900 pt-2 mt-1"><span>Total</span><span>{fmt(sale.total)}</span></div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <button onClick={() => window.print()} className="bg-white shadow-card rounded-xl py-3 flex flex-col items-center gap-1.5 text-xs font-semibold text-ink-900">
          <Printer className="w-5 h-5 text-primary-600" /> Print
        </button>
        <button onClick={handleWhatsApp} className="bg-white shadow-card rounded-xl py-3 flex flex-col items-center gap-1.5 text-xs font-semibold text-ink-900">
          <Share2 className="w-5 h-5 text-success-600" /> WhatsApp
        </button>
        <button onClick={handlePdf} className="bg-white shadow-card rounded-xl py-3 flex flex-col items-center gap-1.5 text-xs font-semibold text-ink-900">
          <Download className="w-5 h-5 text-primary-600" /> PDF
        </button>
      </div>

      <button onClick={onDone} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-full">
        New Bill
      </button>
    </div>
  );
}

// ── Orchestrator ─────────────────────────────────────────────────────────────
export default function WalkIn() {
  const [stage, setStage] = useState('dashboard'); // dashboard | customer | prescription | medicines | cart | payment | success
  const [customerState, setCustomerState] = useState({});
  const [cart, setCart] = useState([]);
  const [completedSale, setCompletedSale] = useState(null);

  const reset = () => {
    setStage('dashboard');
    setCustomerState({});
    setCart([]);
    setCompletedSale(null);
  };

  if (stage === 'dashboard') return <WalkInDashboard onStart={() => setStage('customer')} />;
  if (stage === 'customer') return <CustomerStep onNext={(s) => { setCustomerState(s); setStage('prescription'); }} />;
  if (stage === 'prescription') return <PrescriptionUploadStep onNext={() => setStage('medicines')} onBack={() => setStage('customer')} />;
  if (stage === 'medicines') return <MedicineEntryStep cart={cart} setCart={setCart} onNext={() => setStage('cart')} onBack={() => setStage('prescription')} />;
  if (stage === 'cart') return <BillingCartStep cart={cart} onNext={() => setStage('payment')} onBack={() => setStage('medicines')} />;
  if (stage === 'payment') return <PaymentStep cart={cart} customerState={customerState} onComplete={(sale) => { setCompletedSale(sale); setStage('success'); }} onBack={() => setStage('cart')} />;
  if (stage === 'success') return <BillSuccessStep sale={completedSale} onDone={reset} />;
  return null;
}
