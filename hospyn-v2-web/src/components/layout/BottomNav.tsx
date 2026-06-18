import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ListOrdered, FlaskConical, LifeBuoy, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PHARMACY_ITEMS = [
  { name: 'Home',    path: '/dashboard', icon: LayoutDashboard },
  { name: 'Queue',   path: '/queue',      icon: ListOrdered },
  { name: 'Orders',  path: '/orders',     icon: ShoppingCart },
  { name: 'Stock',   path: '/inventory',  icon: Package },
  { name: 'Support', path: '/support',    icon: LifeBuoy },
];

const LAB_ITEMS = [
  { name: 'Home',    path: '/dashboard', icon: LayoutDashboard },
  { name: 'Lab',     path: '/lab',        icon: FlaskConical },
  { name: 'Support', path: '/support',    icon: LifeBuoy },
];

export const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const items = user?.business_type === 'laboratory' ? LAB_ITEMS : PHARMACY_ITEMS;
  return (
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 pb-safe">
      <div className="flex items-center justify-around w-full h-16 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-primary' : 'text-slate-400'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
