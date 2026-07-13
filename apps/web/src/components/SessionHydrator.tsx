import { useEffect } from 'react';
import { useSessionStore } from '@/stores';

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

export function SessionHydrator() {
  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          if (mounted) {
            useSessionStore.getState().clearIdentity();
            useSessionStore.getState().setHydrated();
          }
          return;
        }

        const data = await response.json() as AuthResponse;
        if (mounted) {
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
          useSessionStore.getState().setHydrated();
        }
      } catch {
        if (mounted) {
          useSessionStore.getState().clearIdentity();
          useSessionStore.getState().setHydrated();
        }
      }
    }

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  return null; // Invisible mount-once component
}
