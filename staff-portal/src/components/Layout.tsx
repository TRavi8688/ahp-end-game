import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Building2,
  Calendar,
  Bell,
  Cpu,
  Package,
  Beaker,
  CreditCard,
  UserCheck,
  Clock,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useStore } from '../store/useStore';

interface LayoutProps {
  children: React.ReactNode;
  role: string;
}

/**
 * FIXES:
 * 1. Added 'Walk-In Register' nav item for receptionist (/reception/walkin)
 * 2. Removed /staff and /infra from nav — those routes don't exist in App.tsx (were dead links)
 * 3. Settings link removed from nav (no /settings route defined)
 * 4. WebSocket handler safely checks lastMessage before switching
 */
const Layout: React.FC<LayoutProps> = ({ children, role }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout, user } = useAuth();
  const { setQueue, addAlert, setSystemStatus } = useStore();
  const { isConnected, lastMessage } = useWebSocket(user?.hospital_id);

  React.useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'QUEUE_UPDATE':  setQueue(lastMessage.payload);       break;
      case 'NEW_ALERT':     addAlert(lastMessage.payload);       break;
      case 'SYSTEM_HEALTH': setSystemStatus(lastMessage.payload); break;
    }
  }, [lastMessage, setQueue, addAlert, setSystemStatus]);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard',        path: `/${role}`,                    roles: ['admin', 'doctor', 'nurse', 'owner', 'pharmacy', 'lab', 'receptionist'] },
    // Reception
    { icon: UserCheck,       label: 'Check-In',         path: '/reception/checkin',           roles: ['receptionist', 'admin'] },
    { icon: UserPlus,        label: 'Walk-In Register', path: '/reception/walkin',            roles: ['receptionist', 'admin'] },
    { icon: Clock,           label: 'Queue Board',      path: '/reception/queue',             roles: ['receptionist', 'admin'] },
    { icon: Calendar,        label: 'Appointments',     path: '/reception/appointments',      roles: ['receptionist', 'admin'] },
    { icon: CreditCard,      label: 'Billing',          path: '/reception/billing',           roles: ['receptionist', 'admin'] },
    // Other staff
    { icon: Package,         label: 'Pharmacy',         path: '/pharmacy',                    roles: ['pharmacy', 'admin'] },
    { icon: Beaker,          label: 'Diagnostic Lab',   path: '/lab',                         roles: ['lab', 'admin'] },
    { icon: Users,           label: 'Staff Roster',     path: '/owner',                       roles: ['owner'] },
    { icon: Building2,       label: 'Hospital Control', path: '/admin',                       roles: ['admin'] },
  ];

  const filteredMenu = menuItems.filter((item) => item.roles.includes(role));

  const displayName =
    user?.first_name
      ? `${user.first_name} ${user.last_name || ''}`.trim()
      : user?.email || 'Staff';

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-[#020617] flex flex-col sticky top-0 h-screen z-50">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              H
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter uppercase leading-none">Hospyn 2.0</span>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Enterprise Core</span>
            </div>
          </div>

          <nav className="space-y-1">
            {filteredMenu.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== `/${role}` && location.pathname.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
                      : 'text-slate-500 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  <item.icon
                    size={18}
                    className={isActive ? 'text-blue-400' : 'group-hover:scale-110 transition-transform'}
                  />
                  <span className="font-bold text-sm uppercase tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-sm font-black text-white">
              {displayName[0]?.toUpperCase() || 'S'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-black text-white truncate uppercase tracking-tighter">
                {displayName}
              </span>
              <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">
                {role.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* WS status */}
          <div className={`flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
            isConnected
              ? 'bg-green-500/5 border-green-500/20 text-green-500'
              : 'bg-orange-500/5 border-orange-500/20 text-orange-500'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
            {isConnected ? 'Live Sync' : 'Offline'}
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl text-red-500 bg-red-500/5 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all font-black text-xs uppercase tracking-widest"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/5 bg-slate-950/40 backdrop-blur-xl flex items-center px-8 sticky top-0 z-40">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
            {location.pathname.substring(1).replace(/\//g, ' / ') || 'Dashboard'}
          </h2>
        </header>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
