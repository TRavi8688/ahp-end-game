import React from 'react';
import { Archive, Plus, Search } from 'lucide-react';

const Inventory: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Inventory Management</h1>
          <p className="text-slate-400 text-sm mt-1">Track and manage your stock</p>
        </div>
        <button className="glass-button flex items-center gap-2">
          <Plus size={18} /> Add New Item
        </button>
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="text" placeholder="Search inventory..." className="glass-input pl-10" />
          </div>
        </div>
        
        <div className="text-center py-20 text-slate-500">
          <Archive size={48} className="mx-auto mb-4 opacity-50" />
          <p>No inventory items found. Add your first item!</p>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
