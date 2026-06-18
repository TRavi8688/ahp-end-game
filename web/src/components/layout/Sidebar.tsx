// src/components/layout/Sidebar.tsx
// Nav is business_type aware: pharmacy vs laboratory

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Scan,
  Users, Settings, LogOut, FlaskConical,
  ListOrdered, LifeBuoy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PHARMACY_NAV = [
  { name: 'Dashboard',  path: '/dashboard', icon: LayoutDashboard },
  { name: 'Live Queue', path: '/queue',      icon: ListOrdered },
  { name: 'Orders',     path: '/orders',     icon: ShoppingCart },
  { name: 'Inventory',  path: '/inventory',  icon: Package },
  { name: 'Scanner',    path: '/scanner',    icon: Scan },
  { name: 'Referrals',  path: '/referrals',  icon: Users },
  { name: 'Support',    path: '/support',    icon: LifeBuoy },
  { name: 'Settings',   path: '/settings',   icon: Settings },
];

const LAB_NAV = [
  { name: 'Dashboard',  path: '/dashboard', icon: LayoutDashboard },
  { name: 'Lab Orders', path: '/lab',        icon: FlaskConical },
  { name: 'Referrals',  path: '/referrals',  icon: Users },
  { name: 'Support',    path: '/support',    icon: LifeBuoy },
  { name: 'Settings',   path: '/settings',   icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = user?.business_type === 'laboratory' ? LAB_NAV : PHARMACY_NAV;

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <aside className="hidden md:flex flex-col w-64 h-full glass-panel border-r border-white/10 bg-slate-900/60 backdrop-blur-xl">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Hospyn Partner
        </h1>
        {user?.business_type && (
          <span className="text-xs text-slate-500 capitalize mt-1 block">{user.business_type}</span>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all text-sm ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        {user && (
          <div className="px-4 py-2 text-xs text-slate-400 mb-1">
            <p className="text-slate-300 font-medium truncate">{user.business_name}</p>
            <p className="truncate">{user.email}</p>
          </div>
        )}
        <button onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-2.5 w-full rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm">
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};
