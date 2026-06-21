import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBarChart, Users, UserCog, Truck, ShoppingCart, Wallet, Settings as SettingsIcon, ChevronRight } from 'lucide-react';

const MENU = [
  { label: 'Reports', desc: 'Sales, profit, inventory & customer reports', icon: FileBarChart, path: '/more/reports' },
  { label: 'Customer Management', desc: 'Browse customers & purchase history', icon: Users, path: '/more/customers' },
  { label: 'Staff Management', desc: 'Manage your pharmacy team', icon: UserCog, path: '/more/staff' },
  { label: 'Supplier Management', desc: 'Suppliers & purchase history', icon: Truck, path: '/more/suppliers' },
  { label: 'Purchase Entry', desc: 'Record new stock from suppliers', icon: ShoppingCart, path: '/more/purchases' },
  { label: 'Finance', desc: 'Revenue, expenses, profit & GST', icon: Wallet, path: '/more/finance' },
  { label: 'Settings', desc: 'Pharmacy profile, QR code & logout', icon: SettingsIcon, path: '/more/settings' },
];

export default function More() {
  const navigate = useNavigate();
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-ink-900 mb-4">More</h1>
      <div className="space-y-2.5">
        {MENU.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full bg-white rounded-2xl shadow-card p-4 flex items-center gap-3 text-left hover:bg-lavender-50 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <item.icon className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-ink-900 text-sm">{item.label}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  );
}
