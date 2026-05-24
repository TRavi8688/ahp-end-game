import React, { useState, useEffect } from 'react';
import { Users, FileText, QrCode, ScanLine } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function Dashboard() {
  const [stats, setStats] = useState({ revenue: 0, pending: 0, completed: 0 });
  const [partnerId, setPartnerId] = useState('PARTNER-8688-XX'); // Mock for now
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setStats({ revenue: 12500, pending: 5, completed: 32 });
      setLoading(false);
    }, 800);
  }, []);

  const StatCard = ({ title, value, prefix = "", colorClass }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex-1">
      <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
      <h3 className={`text-2xl font-bold ${colorClass}`}>
        {prefix}{value}
      </h3>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back,</h1>
        <p className="text-sm text-gray-500">CityCare Pharmacy</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 snap-x">
          <div className="snap-start min-w-[140px]">
            <StatCard title="Today's Revenue" value={stats.revenue.toLocaleString()} prefix="₹" colorClass="text-green-600" />
          </div>
          <div className="snap-start min-w-[140px]">
            <StatCard title="Pending Orders" value={stats.pending} colorClass="text-amber-600" />
          </div>
          <div className="snap-start min-w-[140px]">
            <StatCard title="Total Dispensed" value={stats.completed} colorClass="text-primary-600" />
          </div>
        </div>
      )}

      {/* QR Code Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative isolate">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-primary-50 opacity-50 -z-10"></div>
        
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <ScanLine className="w-6 h-6 text-primary-600" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">Receive Prescriptions</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-8">
            Ask patients to scan this QR code using their Hospyn app to securely beam their prescription to your screen.
          </p>

          <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-gray-100 mb-4 inline-block">
            <QRCodeSVG 
              value={`hospyn://partner/${partnerId}`} 
              size={200}
              level="H"
              includeMargin={false}
              fgColor="#111827"
            />
          </div>

          <div className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 mt-2">
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Your Hospyn ID</p>
            <p className="text-lg font-mono font-bold text-gray-900 tracking-widest">{partnerId}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
