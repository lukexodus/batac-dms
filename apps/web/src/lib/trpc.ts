import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from 'server/src/trpc/root.js';

export const trpc = createTRPCReact<AppRouter>();

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
        
        return response;
      },
    }),
  ],
});
