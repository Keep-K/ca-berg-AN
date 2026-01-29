import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import axios from 'axios';

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_ENABLED_KEY = 'auth_enabled';

declare global {
  interface Window {
    __onUnauthorized?: () => void;
  }
}

interface AuthContextValue {
  token: string | null;
  authEnabled: boolean;
  setAuthEnabled: (enabled: boolean) => void;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseBooleanEnv(value: unknown, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const s = String(value).trim().toLowerCase();
  if (s === '') return defaultValue;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  return defaultValue;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [authEnabled, setAuthEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(AUTH_ENABLED_KEY);
    if (stored != null) return stored === '1';
    // Default: enabled (login required) unless explicitly turned off.
    return parseBooleanEnv((import.meta as any)?.env?.VITE_AUTH_ENABLED, true);
  });
  const [error, setError] = useState<string | null>(null);

  const setAuthEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(AUTH_ENABLED_KEY, enabled ? '1' : '0');
    setAuthEnabledState(enabled);
    // When switching modes, clear stale error messages.
    setError(null);
  }, []);

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
        authEnabled,
        setAuthEnabled,
        isAuthenticated: authEnabled ? !!token : true,
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
