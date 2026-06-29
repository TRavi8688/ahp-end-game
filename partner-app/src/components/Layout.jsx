import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, ClipboardList, ShoppingBag, Package, Menu, Bell, LogOut } from 'lucide-react';
import Logo from './Logo';

// EXECUTION: nav restructured per the 32-screen spec — Walk-In is now its own
// tab (your most-used screen), Analytics/Profile content moved into More.
const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: HomeIcon },
  { path: '/orders', label: 'Orders', icon: ClipboardList },
  { path: '/walkin', label: 'Walk-In', icon: ShoppingBag },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/more', label: 'More', icon: Menu },
];

export default function Layout({ children, pharmacyName, onLogout }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-lavender-50 flex flex-col font-sans">
      <header className="bg-white/90 backdrop-blur border-b border-lavender-100 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <Logo variant="mark" className="w-9 h-9 rounded-xl" />
          <div className="leading-tight">
            <p className="font-bold text-ink-900 text-sm">HOSPAIN Partner</p>
            {pharmacyName && <p className="text-xs text-gray-500">{pharmacyName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/notifications" className="p-2 text-gray-400 hover:text-primary-600 transition-colors relative">
            <Bell className="w-5 h-5" />
          </Link>
          <button
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-24 max-w-2xl w-full mx-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-lavender-100 px-2 py-2 flex justify-around pb-safe z-10 max-w-2xl mx-auto sm:rounded-t-2xl sm:border sm:shadow-floating">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
