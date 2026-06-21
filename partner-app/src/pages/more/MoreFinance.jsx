import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Wallet } from 'lucide-react';
import apiClient from '../../services/apiClient';

const CATEGORIES = ['rent', 'salaries', 'utilities', 'purchase', 'other'];

function AddExpenseModal({ onClose, onSaved }) {
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    try {
      await apiClient.post('/pharmacy/expenses', { category, description, amount: parseFloat(amount) });
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not save expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-900/60 z-30 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl">
        <div className="px-5 py-4 border-b border-lavender-100"><h2 className="font-bold text-ink-900">Add Expense</h2></div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm capitalize">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <input required type="number" step="0.01" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 bg-lavender-50 rounded-xl text-sm" />
          <button type="submit" disabled={saving} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-full disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
          <button type="button" onClick={onClose} className="w-full text-gray-400 text-sm py-1">Cancel</button>
        </form>
      </div>
    </div>
  );
}

export default function MoreFinance() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [report, setReport] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reportRes, expensesRes] = await Promise.all([
        apiClient.get(`/pharmacy/reports/sales?period=${period}`),
        apiClient.get('/pharmacy/expenses'),
      ]);
      setReport(reportRes.data);
      setExpenses(expensesRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="p-4 sm:p-6">
      <button onClick={() => navigate('/more')} className="flex items-center gap-1 text-sm text-gray-500 mb-3"><ChevronLeft className="w-4 h-4" /> Back</button>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ink-900">Finance</h1>
        <button onClick={() => setShowAdd(true)} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3.5 py-2 rounded-full flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Expense
        </button>
      </div>

      <div className="flex gap-1.5 mb-4">
        {['today', 'week', 'month'].map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize ${period === p ? 'bg-primary-600 text-white' : 'bg-white text-gray-400 shadow-card'}`}>{p}</button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-2xl shadow-card p-4"><p className="text-xs text-gray-400">Revenue</p><p className="text-xl font-extrabold text-primary-700">₹{report?.revenue?.toFixed(0) ?? 0}</p></div>
          <div className="bg-white rounded-2xl shadow-card p-4"><p className="text-xs text-gray-400">Expenses</p><p className="text-xl font-extrabold text-warning-600">₹{report?.expenses?.toFixed(0) ?? 0}</p></div>
          <div className="bg-white rounded-2xl shadow-card p-4 col-span-2"><p className="text-xs text-gray-400">Net Profit</p><p className="text-2xl font-extrabold text-success-600">₹{report?.profit?.toFixed(0) ?? 0}</p></div>
        </div>
      )}

      <p className="text-sm font-bold text-ink-900 mb-2">Recent Expenses</p>
      {expenses.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-6 text-center">
          <Wallet className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No expenses logged yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl shadow-card p-4 flex justify-between">
              <div>
                <p className="font-semibold text-ink-900 text-sm capitalize">{e.category}</p>
                <p className="text-xs text-gray-400">{e.description || '—'}</p>
              </div>
              <p className="font-bold text-warning-600">₹{e.amount.toFixed(0)}</p>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onSaved={fetchAll} />}
    </div>
  );
}
