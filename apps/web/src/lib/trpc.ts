import { createTRPCReact, httpBatchLink } from '@trpc/react-query';

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'server/src/trpc/root.js';
import { useSessionStore } from '@/stores';

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
        
        if (response.status === 401) {
          const success = await performSilentRefresh();
          if (success) {
            response = await fetch(url, fetchOptions);
          } else {
            window.location.href = '/login';
          }
        }
        
        if (response.status === 423) {
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
