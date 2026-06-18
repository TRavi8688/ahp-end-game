// partner-app/src/context/AuthContext.tsx
//
// FIX: Standardized localStorage key from "partner_token" to
// "partner_access_token" to match api/apiClient.ts and services/apiClient.js.
// Before this fix, login wrote "partner_access_token" but AuthContext read
// "partner_token" — so isAuthenticated was always false after page refresh.

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/apiClient';

interface PartnerUser {
  id: string;
  email: string;
  business_name: string;
  business_type: 'pharmacy' | 'lab';
  verification_status: 'pending' | 'approved' | 'rejected';
  partner_code?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: PartnerUser | null;
  loading: boolean;
  login: (token: string, userData: PartnerUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// FIX: Consistent token key across all files
const TOKEN_KEY = 'partner_access_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<PartnerUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      // FIX: Read from "partner_access_token" (was "partner_token")
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          // Check token expiry
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('partner_refresh_token');
            setLoading(false);
            return;
          }
          setIsAuthenticated(true);
          setUser({
            id: payload.sub || payload.id || 'partner-123',
            email: payload.email || '',
            business_name: payload.business_name || 'Hospyn Partner',
            business_type: payload.business_type || 'pharmacy',
            verification_status: payload.verification_status || 'approved',
            partner_code: payload.partner_code,
          });
        } catch (error) {
          console.error('Invalid token on init', error);
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (token: string, userData: PartnerUser) => {
    // FIX: Write to "partner_access_token" (was "partner_token")
    localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('partner_refresh_token');
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
