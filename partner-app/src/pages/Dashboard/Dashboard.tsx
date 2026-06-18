import React, { useState } from 'react';
import { Clock, Loader, CheckCircle, DollarSign, Package } from 'lucide-react';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'processing'>('pending');

  const stats = [
    { title: 'Pending Orders', value: '24', icon: <Clock className="w-6 h-6 text-amber-500" />, trend: '+12% from yesterday' },
    { title: 'Processing', value: '12', icon: <Loader className="w-6 h-6 text-blue-500" />, trend: 'Steady' },
    { title: 'Completed Today', value: '156', icon: <CheckCircle className="w-6 h-6 text-emerald-500" />, trend: '+5% from yesterday' },
    { title: 'Revenue', value: '$4,250', icon: <DollarSign className="w-6 h-6 text-purple-500" />, trend: '+18% from last week' },
  ];

  const recentOrders = [
    { id: '#ORD-7829', patient: 'Sarah Jenkins', time: '10 mins ago', status: 'Pending', items: 3, total: '$45.00' },
    { id: '#ORD-7828', patient: 'Michael Chang', time: '15 mins ago', status: 'Pending', items: 1, total: '$12.50' },
    { id: '#ORD-7827', patient: 'Emma Watson', time: '22 mins ago', status: 'Pending', items: 5, total: '$120.00' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Partner Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Overview of your daily operations</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-card p-6 flex flex-col justify-between transition-transform hover:scale-[1.02]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</p>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{stat.value}</h3>
              </div>
              <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl shadow-sm">
                {stat.icon}
              </div>
            </div>
            <div className="mt-4 text-xs font-medium text-slate-400 dark:text-slate-500">
              {stat.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-500" />
              Recent Orders
            </h2>
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Pending
              </button>
              <button 
                onClick={() => setActiveTab('processing')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'processing' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Processing
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {recentOrders.map((order, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                    {order.patient.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white">{order.patient}</h4>
                    <p className="text-xs text-slate-500 flex gap-2">
                      <span>{order.id}</span>
                      <span>•</span>
                      <span>{order.items} items</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800 dark:text-white">{order.total}</p>
                  <p className="text-xs text-amber-500 font-medium">{order.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            View All Orders
          </button>
        </div>

        <div className="glass-panel p-6 flex flex-col">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4 flex-1">
            <button className="flex flex-col items-center justify-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                <Package className="w-6 h-6" />
              </div>
              <span className="font-medium text-sm">New Order</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                <CheckCircle className="w-6 h-6" />
              </div>
              <span className="font-medium text-sm">Verify Rx</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
