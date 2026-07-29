import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuthActions } from '@/hooks/useAuthActions';
import { useSessionStore } from '@/stores';

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const identity = useSessionStore((s) => s.identity);
  const isHydrated = useSessionStore((s) => s.isHydrated);

  if (!isHydrated) {
    return <div className="flex min-h-screen w-full items-center justify-center">Loading...</div>;
  }

  if (!identity) {
    return <Navigate to="/login" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
