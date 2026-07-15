import { useCallback } from 'react';
import { generatePkcePair } from '../lib/pkce.js';
import { useSessionStore } from '@/stores';

// Reusing the same shape expected from the legacy context migration
interface AuthResponse {
  user: {
    id: string;
    username: string;
  };
  sessionId: string;
  expiresAt: string;
  roleCodes: string[];
  officeScopeId: string | null;
  officeCode: string | null;
  committeeIds: string[];
}

export function useAuthActions() {
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

    const data = (await response.json()) as AuthResponse;
    useSessionStore.getState().setIdentity({
      userId: data.user.id,
      username: data.user.username,
      displayName: data.user.username, // Using fallback per TASK-WF-FE-006 notes
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
      roleCodes: data.roleCodes,
      officeScopeId: data.officeScopeId,
      officeCode: data.officeCode,
      committeeIds: data.committeeIds,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      useSessionStore.getState().clearIdentity();
    }
  }, []);

  return { login, logout };
}
