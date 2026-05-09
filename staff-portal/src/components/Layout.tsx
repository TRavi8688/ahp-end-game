import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  Building2,
  Calendar,
  Search,
  Bell,
  Cpu,
  Wifi,
  WifiOff,
  Package,
  Beaker
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useStore } from '../store/useStore';

interface LayoutProps {
  children: React.ReactNode;
  role: string;
}

const Layout: React.FC<LayoutProps> = ({ children, role }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { setQueue, addAlert, setSystemStatus } = useStore();
  const { isConnected, lastMessage } = useWebSocket(user?.hospital_id);

  // Handle WebSocket messages
  React.useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'QUEUE_UPDATE':
          setQueue(lastMessage.payload);
          break;
        case 'NEW_ALERT':
          addAlert(lastMessage.payload);
          break;
        case 'SYSTEM_HEALTH':
          setSystemStatus(lastMessage.payload);
          break;
        default:
          console.warn('Unknown WS event:', lastMessage.type);
      }
    }
  }, [lastMessage, setQueue, addAlert, setSystemStatus]);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: `/${role}`, roles: ['admin', 'doctor', 'nurse', 'owner', 'pharmacy', 'lab'] },
    { icon: Calendar, label: 'Queue', path: '/queue', roles: ['doctor', 'nurse', 'owner'] },
    { icon: Package, label: 'Pharmacy', path: '/pharmacy', roles: ['pharmacy', 'admin'] },
    { icon: Beaker, label: 'Diagnostic Lab', path: '/lab', roles: ['lab', 'admin'] },
    { icon: Users, label: 'Staff Roster', path: '/staff', roles: ['admin', 'owner'] },
    { icon: Building2, label: 'Infra Control', path: '/infra', roles: ['admin', 'owner'] },
    { icon: Settings, label: 'Settings', path: '/settings', roles: ['admin', 'doctor', 'nurse', 'owner', 'pharmacy', 'lab'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* Premium Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-[#020617] flex flex-col sticky top-0 h-screen z-50">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">A</div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter uppercase leading-none">Hospyn 2.0</span>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Enterprise Core</span>
            </div>
          </div>
          
          <nav className="space-y-2">
            {filteredMenu.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                  location.pathname === item.path 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-[inset_0_0_20px_rgba(37,99,235,0.05)]' 
                    : 'text-slate-500 hover:text-slate-100 hover:bg-white/5'
                }`}
              >
                <item.icon size={20} className={location.pathname === item.path ? 'text-blue-400' : 'group-hover:scale-110 transition-transform'} />
                <span className="font-bold text-sm uppercase tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5 bg-slate-900/10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-lg font-black text-white shadow-xl">
              {user?.name?.substring(0, 1) || 'D'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-black text-white truncate uppercase tracking-tighter">{user?.name || 'Demo User'}</span>
              <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{role.replace('_', ' ')}</span>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl text-red-500 bg-red-500/5 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all font-black text-xs uppercase tracking-widest"
          >
            <LogOut size={18} />
            <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* Main Command Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent">
        <header className="h-20 border-b border-white/5 bg-slate-950/40 backdrop-blur-3xl flex items-center justify-between px-10 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="h-8 w-[1px] bg-white/10" />
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {location.pathname.substring(1).replace('/', ' / ') || 'System Home'}
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border transition-all ${
              isConnected 
                ? 'bg-green-500/5 border-green-500/20 text-green-500' 
                : 'bg-orange-500/5 border-orange-500/20 text-orange-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-orange-500'
              }`} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isConnected ? 'Global Sync Active' : 'Relay Disconnected'}
              </span>
            </div>
            <div className="h-8 w-[1px] bg-white/10" />
            <div className="flex items-center gap-4 text-slate-500">
              <Cpu size={18} className="hover:text-blue-500 transition-colors cursor-pointer" />
              <Settings size={18} className="hover:text-blue-500 transition-colors cursor-pointer" />
            </div>
          </div>
        </header>
        
        <div className="flex-1 relative">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
