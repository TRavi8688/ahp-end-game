import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  role: 'doctor' | 'nurse' | 'admin' | 'hospital_admin' | 'owner';
  hospital_id?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          hospital_id: payload.hospital_id,
        });
      } catch (e) {
        console.error('Invalid token', e);
        logout();
      }
    }
    setIsLoading(false);
  }, [token]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      // MASTER DEMO BYPASS FOR VISUALIZATION
      if (email.endsWith('@ahp.com')) {
        const role = email.split('@')[0];
        const dummyToken = `demo.${btoa(JSON.stringify({ sub: 'demo-123', email, role, hospital_id: 'hosp-001' }))}.demo`;
        localStorage.setItem('token', dummyToken);
        setToken(dummyToken);
        return;
      }

      const response = await axios.post('/api/auth/login', { email, password: pass });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
    } catch (error) {
      console.error('Login failed', error);
      throw error;
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
