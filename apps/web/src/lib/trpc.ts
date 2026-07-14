import { createTRPCReact, httpBatchLink } from '@trpc/react-query';

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'server/src/trpc/root.js';
import { useSessionStore } from '@/stores';
import { logger } from './logger.js';

export const trpc = createTRPCReact<AppRouter>();
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function performSilentRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  return refreshPromise;
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL}/api/trpc`,
      async fetch(url, options) {
        const fetchOptions = {
          ...options,
          credentials: 'include' as const,
        } as RequestInit;
        let response = await fetch(url, fetchOptions);
        
        let traceId: string | undefined;
        try {
          if (!response.ok) {
            const cloned = response.clone();
            const json = await cloned.json();
            if (Array.isArray(json)) {
              traceId = json[0]?.error?.json?.data?.traceId;
            } else {
              traceId = json?.error?.json?.data?.traceId;
            }
          }
        } catch {
          // Ignore parsing errors; we just want traceId if available
        }
        
        if (response.status === 401) {
          logger.warn('trpc_401_unauthorized', { url, traceId });
          const success = await performSilentRefresh();
          if (success) {
            logger.info('session_refresh_success', { url });
            response = await fetch(url, fetchOptions);
          } else {
            logger.error('session_refresh_failed_redirecting', { url, traceId });
            window.location.href = '/login';
          }
        }
        
        if (response.status === 423) {
          logger.error('session_locked', { url, traceId });
          useSessionStore.getState().setIsLocked(true);
          return new Response(
            JSON.stringify({
              error: {
                message: 'Session is locked',
                code: -32001,
                data: {
                  code: 'UNAUTHORIZED',
                  httpStatus: 401,
                },
              },
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return response;
      },
    }),
  ],
});
