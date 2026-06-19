// staff-portal/src/context/AuthContext.tsx
//
// WHAT CHANGED vs existing file:
//  - role type: added 'pharmacist' (was 'pharmacy' — JWT issues 'pharmacist', not 'pharmacy')
//  - role type: added 'hr' (was missing — HR staff got 403 on every request)
//  - ROLE_REDIRECT_MAP: pharmacy → pharmacist, added hr → /hr
//  - Token storage: sessionStorage instead of localStorage (PHI requirement)
//  - login() sends body.phone (not body.username) — backend reads body.get("phone")
//  - Also sends body.email for email-based logins
//  - user object now reads user.name from response (backend returns full_name)

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../apiClient';

// FIXED: Added pharmacist, hr — were missing, caused 403 for those roles
export type UserRole =
  | 'doctor'
  | 'nurse'
  | 'admin'
  | 'hospital_admin'
  | 'owner'
  | 'receptionist'
  | 'pharmacist'   // FIXED: was 'pharmacy' — JWT role is 'pharmacist'
  | 'lab'
  | 'hr'           // FIXED: was missing
  | 'super_admin';

export interface AuthUser {
  id:            string;
  role:          UserRole;
  name?:         string;
  email?:        string;
  phone?:        string;
  hospital_id?:  string;
}

interface AuthContextType {
  user:            AuthUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  login:           (identifier: string, password: string) => Promise<void>;
  logout:          () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// FIXED: pharmacist (not pharmacy), hr added
export const ROLE_REDIRECT_MAP: Record<string, string> = {
  hospital_admin: '/admin',
  admin:          '/admin',
  doctor:         '/doctor',
  nurse:          '/nurse',
  owner:          '/owner',
  pharmacist:     '/pharmacy',  // FIXED: was 'pharmacy', JWT issues 'pharmacist'
  lab:            '/lab',
  receptionist:   '/reception',
  hr:             '/hr',        // FIXED: was missing
  super_admin:    '/admin',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [token,     setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // FIXED: Read from sessionStorage (was localStorage — PHI risk)
  useEffect(() => {
    const storedToken = sessionStorage.getItem('hospyn_access_token');
    const storedUser  = sessionStorage.getItem('hospyn_user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        sessionStorage.removeItem('hospyn_access_token');
        sessionStorage.removeItem('hospyn_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      // Determine if identifier is email or phone
      const isEmail = identifier.includes('@');
      const body = isEmail
        ? { email: identifier, password }
        : { phone: identifier, password };

      const response = await apiClient.post('/auth/login', body);
      const data = response.data;

      if (!data.access_token) throw new Error('No token received');

      const userData: AuthUser = {
        id:          data.user?.id    || data.user_id,
        role:        (data.user?.role || data.role) as UserRole,
        name:        data.user?.name  || data.user?.full_name || '',
        email:       data.user?.email || '',
        phone:       data.user?.phone || '',
        hospital_id: data.user?.hospital_id || '',
      };

      // FIXED: sessionStorage only — never localStorage for PHI
      sessionStorage.setItem('hospyn_access_token', data.access_token);
      sessionStorage.setItem('hospyn_user', JSON.stringify(userData));

      setToken(data.access_token);
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('hospyn_access_token');
    sessionStorage.removeItem('hospyn_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
