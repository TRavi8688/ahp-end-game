import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { setAuthFailureCallback } from './services/apiClient';
import { Activity, Home, ListOrdered, Package, LogOut } from 'lucide-react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';

function Layout({ children, onLogout }) {
  const location = useLocation();
  
  const navItems = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/orders', label: 'Orders', icon: ListOrdered },
    { path: '/inventory', label: 'Inventory', icon: Package }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary-600 p-2 rounded-xl">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Partner</h1>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around pb-safe z-10">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'fill-primary-50' : ''}`} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('partner_token'));
  const navigate = useNavigate();

  useEffect(() => {
    setAuthFailureCallback(() => {
      setIsAuthenticated(false);
      navigate('/login');
    });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    setIsAuthenticated(false);
  };

  return (
    <Routes>
      <Route 
        path="/login" 
        element={!isAuthenticated ? <Login onLogin={() => setIsAuthenticated(true)} /> : <Navigate to="/dashboard" />} 
      />
      <Route 
        path="/dashboard" 
        element={isAuthenticated ? <Layout onLogout={handleLogout}><Dashboard /></Layout> : <Navigate to="/login" />} 
      />
      <Route 
        path="/orders" 
        element={isAuthenticated ? <Layout onLogout={handleLogout}><Orders /></Layout> : <Navigate to="/login" />} 
      />
      <Route 
        path="/inventory" 
        element={isAuthenticated ? <Layout onLogout={handleLogout}><Inventory /></Layout> : <Navigate to="/login" />} 
      />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

export default App;
