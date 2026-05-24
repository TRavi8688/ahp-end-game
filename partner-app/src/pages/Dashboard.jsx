import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { Users, FileText, ClipboardList, Activity } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ referrals: 0, pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mocking an initial load until actual backend routes for partners are established
    setTimeout(() => {
      setStats({ referrals: 12, pending: 5, completed: 7 });
      setLoading(false);
    }, 800);
  }, []);

  const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5">
      <div className={`p-4 rounded-xl ${colorClass}`}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Partner Overview</h1>
        <p className="text-gray-500 mt-1">Manage incoming referrals and diagnostic workflows.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            title="Total Referrals" 
            value={stats.referrals} 
            icon={Users} 
            colorClass="bg-blue-50 text-blue-600" 
          />
          <StatCard 
            title="Pending Action" 
            value={stats.pending} 
            icon={ClipboardList} 
            colorClass="bg-amber-50 text-amber-600" 
          />
          <StatCard 
            title="Completed" 
            value={stats.completed} 
            icon={FileText} 
            colorClass="bg-green-50 text-green-600" 
          />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">Recent Referrals</h3>
          <button className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
            View All
          </button>
        </div>
        <div className="p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-1">No Active Referrals</h4>
          <p className="text-gray-500">When hospitals send patients to your facility, they will appear here.</p>
        </div>
      </div>
    </div>
  );
}
