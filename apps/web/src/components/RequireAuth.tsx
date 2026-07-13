import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen w-full items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
