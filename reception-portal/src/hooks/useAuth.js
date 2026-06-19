import { createContext, useContext, useState, useCallback } from "react";
import { login as apiLogin } from "../services/receptionApi";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const stored = localStorage.getItem("staff_user");
  const [user, setUser] = useState(stored ? JSON.parse(stored) : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiLogin(email, password);
      localStorage.setItem("staff_token", res.access_token);
      localStorage.setItem("staff_user", JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("staff_token");
    localStorage.removeItem("staff_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
