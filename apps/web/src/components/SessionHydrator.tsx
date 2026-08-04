import { useEffect } from 'react';

import { logger } from '../lib/logger.js';

import { useSessionStore } from '@/stores';

interface AuthResponseData {
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

interface AuthEnvelope {
  ok: true;
  data: AuthResponseData;
}

interface AuthErrorEnvelope {
  ok: false;
  error?: {
    traceId?: string;
  };
}

let hydrationPromise: Promise<void> | null = null;

export function SessionHydrator() {
  useEffect(() => {
    if (!hydrationPromise) {
      hydrationPromise = (async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });

          if (!response.ok) {
            let traceId: string | undefined;
            try {
              const errorBody = (await response.json()) as AuthErrorEnvelope;
              traceId = errorBody?.error?.traceId;
            } catch {
              // Response body wasn't valid JSON — proceed without a traceId
              // rather than let this throw and swallow the original failure.
            }
            logger.error('session_hydration_failed', {
              status: response.status,
              reason: 'http_error',
              traceId,
            });
            useSessionStore.getState().clearIdentity();
            useSessionStore.getState().setHydrated();
            return;
          }

          const envelope = (await response.json()) as AuthEnvelope;
          const data = envelope.data;
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
        } catch (error) {
          logger.error('session_hydration_failed', {
            reason: 'network_error',
            error: error instanceof Error ? error.message : String(error),
          });
          useSessionStore.getState().clearIdentity();
          useSessionStore.getState().setHydrated();
        }
      })();
    }
  }, []);

  return null; // Invisible mount-once component
}
