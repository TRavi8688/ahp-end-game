import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { setAuthFailureCallback } from './services/apiClient';
import { Activity } from 'lucide-react';

// Placeholders for screens
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('partner_token'));
  const navigate = useNavigate();

  useEffect(() => {
    setAuthFailureCallback(() => {
      setIsAuthenticated(false);
      navigate('/login');
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary-500 p-2 rounded-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Hospyn Partner Network</h1>
        </div>
        {isAuthenticated && (
          <button 
            onClick={() => {
              localStorage.removeItem('partner_token');
              setIsAuthenticated(false);
            }}
            className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
          >
            Sign Out
          </button>
        )}
      </header>

      <main className="flex-1 overflow-auto">
        <Routes>
          <Route 
            path="/login" 
            element={!isAuthenticated ? <Login onLogin={() => setIsAuthenticated(true)} /> : <Navigate to="/dashboard" />} 
          />
          <Route 
            path="/dashboard" 
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
          />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
