import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Package, Clock, FileText, Bell } from 'lucide-react';
import apiClient from '../services/apiClient';

const TYPE_META = {
  new_prescription: { icon: FileText, color: 'text-primary-600 bg-primary-50' },
  low_stock: { icon: Package, color: 'text-warning-600 bg-warning-50' },
  expiry: { icon: Clock, color: 'text-red-600 bg-red-50' },
};

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/pharmacy/notifications')
      .then((res) => setItems(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 mb-3">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-bold text-ink-900 mb-4">Notifications</h1>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Loading...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">You're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((n, idx) => {
            const meta = TYPE_META[n.type] || TYPE_META.new_prescription;
            const Icon = meta.icon;
            return (
              <div key={idx} className="bg-white rounded-2xl shadow-card p-4 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="font-semibold text-ink-900 text-sm">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
