import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../apiClient';

// FIXED: Added 'receptionist' to role union (was already in ProtectedRoute allowedRoles but missing here)
export type UserRole =
  | 'doctor'
  | 'nurse'
  | 'admin'
  | 'hospital_admin'
  | 'owner'
  | 'receptionist'
  | 'pharmacy'
  | 'lab';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  hospital_id?: string;
  hospital_status?: string;
  first_name?: string;
  last_name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// FIXED: role → redirect map moved here from Login page (single source of truth)
export const ROLE_REDIRECT_MAP: Record<string, string> = {
  hospital_admin: '/admin',
  admin:          '/admin',
  doctor:         '/doctor',
  nurse:          '/nurse',
  owner:          '/owner',
  pharmacy:       '/pharmacy',
  lab:            '/lab',
  receptionist:   '/reception',
};

function parseToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;                   // FIXED: reject non-JWT tokens (demo bypass used 2-part tokens)
    const payload = JSON.parse(atob(parts[1]));
    return {
      id:               payload.sub,
      email:            payload.email,
      role:             payload.role,
      hospital_id:      payload.hospital_id,
      hospital_status:  payload.hospital_status || 'active',
      first_name:       payload.first_name,
      last_name:        payload.last_name,
    };
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [token, setToken]     = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const parsed = parseToken(token);
      if (parsed) {
        setUser(parsed);
      } else {
        // FIXED: invalid or demo token — clear it instead of crash-looping
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    }
    setIsLoading(false);
  }, [token]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      // FIXED: removed @hospyn.com demo bypass — backend login only
      const response = await apiClient.post('/auth/login', {
        username: email,
        password: pass,
      });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
