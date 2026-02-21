'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as api from './api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check localStorage for existing session
  useEffect(() => {
    const stored = localStorage.getItem('varyn_token');
    const storedUser = localStorage.getItem('varyn_user');
    if (stored && storedUser) {
      try {
        setToken(stored);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('varyn_token');
        localStorage.removeItem('varyn_user');
      }
    }
    setIsLoading(false);
  }, []);

  const handleAuth = useCallback((res: { token: string; user: User }) => {
    localStorage.setItem('varyn_token', res.token);
    localStorage.setItem('varyn_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  }, []);

  const loginFn = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    handleAuth(res);
  }, [handleAuth]);

  const signupFn = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.signup({ email, password, name });
    handleAuth(res);
  }, [handleAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem('varyn_token');
    localStorage.removeItem('varyn_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login: loginFn, signup: signupFn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
