'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken, type User } from './api';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: User };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  // On first load, use the refresh cookie (if any) to restore the session.
  useEffect(() => {
    refreshSession().then((user) =>
      setState(user ? { status: 'authenticated', user } : { status: 'anonymous', user: null }),
    );
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ accessToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setAccessToken(data.accessToken);
    setState({ status: 'authenticated', user: data.user });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setState({ status: 'anonymous', user: null });
    }
  }, []);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Where each role lands after login.
export function homeFor(user: User) {
  return user.role === 'ADMIN' ? '/admin/approvals' : '/';
}
