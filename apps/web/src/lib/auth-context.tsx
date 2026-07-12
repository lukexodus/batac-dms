import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

import { generatePkcePair } from './pkce.js';

import type { ReactNode } from 'react';

export interface AuthSession {
  user: {
    id: string;
    username: string;
    email: string;
    cityId: string;
    status: string;
    mfaEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  };
  sessionId: string;
  expiresAt: string;
  roleCodes: string[];
  officeScopeId: string | null;
  officeCode: string | null;
  committeeIds: string[];
}

interface AuthContextValue {
  session: AuthSession | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setSession(null);
        return;
      }
      // The refresh endpoint's response body is not runtime-validated against
      // a schema (no Zod schema for AuthSession exists in @batac/shared or
      // elsewhere); this assertion trusts the server contract to return the
      // AuthSession shape, the same trust boundary already relied on by the
      // login flow below. `.json()` is typed `Promise<any>` by the DOM lib
      // itself (a structural TS limitation, not a project misconfiguration).
      const data = await response.json() as AuthSession;
      setSession(data);
    } catch {
      setSession(null);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { verifier, challenge } = await generatePkcePair();

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        password,
        code_verifier: verifier,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    // Same trust boundary as refresh() above: no runtime schema validates
    // this response, the assertion trusts the server contract's shape.
    const data = await response.json() as AuthSession;
    setSession(data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setSession(null);
    }
  }, []);

  // Restore session after reload using a silent refresh
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ session, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
