import { QueryClient } from '@tanstack/react-query';
import { isTRPCClientError } from '@trpc/client';

import type { AppRouter } from 'server/src/trpc/root.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isTRPCClientError<AppRouter>(error) && error.data?.code === 'UNAUTHORIZED') {
          // Do not retry at the query level, it's handled at the fetch level (trpc.ts)
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});
