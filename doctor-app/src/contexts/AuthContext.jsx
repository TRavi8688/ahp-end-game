import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [doctorId, setDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on initial load
    const storedAuth = localStorage.getItem('isAuthenticated') === 'true';
    const storedToken = localStorage.getItem('token');
    const storedDoctorId = localStorage.getItem('doctorId');

    if (storedAuth && storedToken) {
      setIsAuthenticated(true);
      setToken(storedToken);
      setDoctorId(storedDoctorId);
    }
    setLoading(false);
  }, []);

  const login = (newToken, newDoctorId) => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('token', newToken);
    if (newDoctorId) localStorage.setItem('doctorId', newDoctorId);
    
    setIsAuthenticated(true);
    setToken(newToken);
    setDoctorId(newDoctorId);
  };

  const logout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('doctorId');
    
    setIsAuthenticated(false);
    setToken(null);
    setDoctorId(null);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, doctorId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
