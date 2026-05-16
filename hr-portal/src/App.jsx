import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Calendar, 
  Activity, 
  Settings, 
  LogOut, 
  Search,
  Bell,
  MoreVertical,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ activeTab, setActiveTab }) => (
  <aside className="sidebar">
    <div className="sidebar-logo outfit">
      <div className="p-2 bg-primary rounded-xl">
        <Activity className="text-white" size={24} />
      </div>
      <span>HOSPYN <span className="text-primary">HR</span></span>
    </div>

    <nav className="flex-1">
      {[
        { id: 'directory', icon: Users, label: 'Staff Directory' },
        { id: 'roster', icon: Calendar, label: 'Shift Roster' },
        { id: 'credentials', icon: ShieldCheck, label: 'Credentials' },
        { id: 'onboarding', icon: UserPlus, label: 'Onboarding' },
        { id: 'analytics', icon: Activity, label: 'HR Insights' },
      ].map((item) => (
        <button 
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`nav-item w-full text-left ${activeTab === item.id ? 'active' : ''}`}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>

    <div className="pt-8 border-t border-white/5">
      <button className="nav-item w-full text-left text-slate-500 hover:text-red-400">
        <LogOut size={20} />
        <span>Exit Portal</span>
      </button>
    </div>
  </aside>
);

const StaffCard = ({ name, role, dept, status, joined }) => (
  <tr className="hover:bg-white/[0.02] transition-colors">
    <td className="flex items-center gap-4">
      <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-primary">
        {name.charAt(0)}
      </div>
      <div>
        <div className="font-bold">{name}</div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{role}</div>
      </div>
    </td>
    <td className="text-sm font-medium text-slate-400">{dept}</td>
    <td>
      <span className={`status-badge ${status === 'Active' ? 'status-active' : 'status-on-leave'}`}>
        {status}
      </span>
    </td>
    <td className="text-sm text-slate-500 font-medium">{joined}</td>
    <td className="text-right">
      <button className="text-slate-600 hover:text-white transition-colors">
        <MoreVertical size={20} />
      </button>
    </td>
  </tr>
);

function App() {
  const [activeTab, setActiveTab] = useState('directory');

  return (
    <div className="hr-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="main-content">
        <header className="flex justify-between items-end mb-16">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 bg-emerald-500 rounded-full" />
              <span className="text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase">Enterprise Mode: Active</span>
            </div>
            <h1 className="text-5xl font-black tracking-tight mb-2 outfit">Human Capital</h1>
            <p className="text-slate-400 font-medium">Managing 128 clinical staff members across 12 departments.</p>
          </div>
          
          <div className="flex gap-4">
            <button className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
              <Bell size={20} />
            </button>
            <button className="btn-primary flex items-center gap-2">
              <UserPlus size={20} />
              <span>ONBOARD STAFF</span>
            </button>
          </div>
        </header>

        <div className="stat-grid">
          <div className="glass-card stat-card">
            <div className="flex justify-between mb-4">
              <Users className="text-primary" />
              <span className="text-emerald-500 text-xs font-bold">+4 this month</span>
            </div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total Workforce</div>
            <div className="text-4xl font-black outfit">128</div>
          </div>
          <div className="glass-card stat-card">
            <div className="flex justify-between mb-4">
              <Clock className="text-accent" />
              <span className="text-slate-500 text-xs font-bold">Today</span>
            </div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">On Shift</div>
            <div className="text-4xl font-black outfit">42</div>
          </div>
          <div className="glass-card stat-card">
            <div className="flex justify-between mb-4">
              <ShieldCheck className="text-emerald-500" />
              <span className="text-emerald-500 text-xs font-bold">100% Secure</span>
            </div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Credentials Valid</div>
            <div className="text-4xl font-black outfit">128</div>
          </div>
        </div>

        {activeTab === 'directory' && (
          <section className="glass-card">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black outfit tracking-tight">Staff Directory</h2>
              <div className="flex items-center gap-4 bg-black/20 p-2 rounded-xl border border-white/5">
                <Search size={18} className="text-slate-500" />
                <input type="text" placeholder="Search staff..." className="bg-transparent border-none outline-none text-sm text-white" />
              </div>
            </div>

            <table className="table-container">
              <thead>
                <tr>
                  <th>Clinical Member</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <StaffCard name="Dr. Sarah Johnson" role="Senior Cardiologist" dept="Cardiology" status="Active" joined="12 May 2024" />
                <StaffCard name="Nurse Michael Chen" role="Head Nurse" dept="Emergency" status="Active" joined="05 Jan 2024" />
                <StaffCard name="Dr. James Wilson" role="Surgeon" dept="Surgery" status="On Leave" joined="20 Feb 2024" />
                <StaffCard name="Dr. Emily Blunt" role="Pediatrician" dept="Pediatrics" status="Active" joined="15 Mar 2024" />
              </tbody>
            </table>
          </section>
        )}

        {activeTab === 'roster' && (
          <div className="space-y-8">
            <div className="glass-card p-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black outfit tracking-tighter">Clinical Roster</h2>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500">Weekly</button>
                  <button className="px-4 py-2 bg-primary/10 rounded-xl text-xs font-bold uppercase tracking-widest text-primary">Monthly</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-4">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-center text-[10px] font-black text-slate-500 tracking-widest uppercase mb-4">{day}</div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between group hover:border-primary/50 transition-all cursor-pointer">
                    <span className="text-xs font-bold text-slate-500">{i + 1}</span>
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-500 border-2 border-black" />
                      <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-black" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass-card p-10">
              <h3 className="text-xl font-black outfit mb-6">Staffing Density</h3>
              <div className="space-y-6">
                {[
                  { dept: 'Emergency', load: 85, color: 'bg-rose-500' },
                  { dept: 'Cardiology', load: 45, color: 'bg-indigo-500' },
                  { dept: 'Surgery', load: 60, color: 'bg-emerald-500' }
                ].map(item => (
                  <div key={item.dept}>
                    <div className="flex justify-between text-[10px] font-black tracking-widest uppercase mb-2">
                      <span>{item.dept}</span>
                      <span>{item.load}% Load</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={`${item.color} h-full`} style={{ width: `${item.load}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="glass-card p-10">
              <h3 className="text-xl font-black outfit mb-6">Credential Expiry</h3>
              <div className="space-y-4">
                {[
                  { name: 'Dr. Sarah Johnson', doc: 'BLS Certification', days: 12 },
                  { name: 'Nurse Michael Chen', doc: 'Medical License', days: 45 }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div>
                      <div className="font-bold text-sm">{item.name}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">{item.doc}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest ${item.days < 15 ? 'text-rose-500 bg-rose-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
                      {item.days} DAYS LEFT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
