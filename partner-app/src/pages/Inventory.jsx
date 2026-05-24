import React from 'react';
import { Package, Search, Plus, Filter } from 'lucide-react';

export default function Inventory() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">Manage medicine stock and pricing</p>
        </div>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 justify-center hover:bg-primary-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search medicines..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button className="px-4 py-2 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
        
        <div className="p-12 text-center">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Items Yet</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">Start adding your medical inventory here so it can be dispensed when patients scan your QR code.</p>
        </div>
      </div>
    </div>
  );
}
