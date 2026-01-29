import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import axios from 'axios';

export const AUTH_TOKEN_KEY = 'auth_token';

declare global {
  interface Window {
    __onUnauthorized?: () => void;
  }
}

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      const t = res.data?.token;
      if (t) {
        localStorage.setItem(AUTH_TOKEN_KEY, t);
        setToken(t);
      } else {
        setError('Login failed: no token received');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Login failed';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setError(null);
  }, []);

  useEffect(() => {
    window.__onUnauthorized = logout;
    return () => {
      delete window.__onUnauthorized;
    };
  }, [logout]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        login,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
