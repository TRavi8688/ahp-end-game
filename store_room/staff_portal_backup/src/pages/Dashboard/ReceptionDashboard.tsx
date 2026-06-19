import React, { useState } from 'react';
import { Shield, Search, UserPlus, CheckCircle, Activity, QrCode } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const ReceptionDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [hospynId, setHospynId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospynId.trim()) return;

    setIsLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await axios.post(
        'http://localhost:8000/api/v1/queue/checkin',
        { hospyn_id: hospynId.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(`Patient successfully checked in! Token number: ${response.data.token_number}`);
      setHospynId('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to check in patient. Ensure the Hospyn ID is correct.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reception Dashboard</h1>
          <p className="text-gray-500">Welcome back, {user?.first_name || 'Receptionist'}!</p>
        </div>
        <div className="bg-indigo-50 p-3 rounded-full">
          <Shield className="h-6 w-6 text-indigo-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <QrCode className="h-5 w-5 mr-2 text-indigo-600" />
            Patient Check-In
          </h2>
          <form onSubmit={handleCheckIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Hospyn ID / QR Data
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={hospynId}
                  onChange={(e) => setHospynId(e.target.value)}
                  placeholder="e.g. HOSP-1234-5678"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Type the Hospyn ID manually or use a connected QR Scanner to input the patient's ID.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            {success && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center justify-center disabled:bg-indigo-300"
            >
              {isLoading ? (
                'Processing...'
              ) : (
                <>
                  <UserPlus className="h-5 w-5 mr-2" />
                  Add to Live Queue
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Status Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-emerald-600" />
              Queue Status
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                <span className="text-gray-600 font-medium">Patients Currently Waiting</span>
                <span className="text-2xl font-bold text-gray-800">-</span>
              </div>
              <div className="p-4 bg-indigo-50 rounded-xl flex justify-between items-center border border-indigo-100">
                <span className="text-indigo-800 font-medium">Average Wait Time</span>
                <span className="text-lg font-bold text-indigo-800">~15 mins</span>
              </div>
            </div>
          </div>
          <button className="w-full mt-6 py-2 text-indigo-600 font-medium border border-indigo-200 rounded-xl hover:bg-indigo-50 transition">
            View Live Waitlist
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceptionDashboard;
