import React from 'react';
import { ListOrdered, Bell, CheckCircle2 } from 'lucide-react';

export default function Orders() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incoming Orders</h1>
          <p className="text-sm text-gray-500">Live feed of patient prescriptions</p>
        </div>
        <div className="relative">
          <Bell className="w-6 h-6 text-gray-400" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-gray-50 rounded-full"></span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Placeholder for when no orders exist */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-4">
          <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ListOrdered className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Awaiting Orders</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            When a patient scans your QR code and shares their prescription, it will pop up here instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
