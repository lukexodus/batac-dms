import { useCallback, useEffect, useRef } from 'react';
import { useSessionStore } from '@/stores/session.store';
import { useUIStore } from '@/stores/ui.store';
import { useAuthActions } from '@/hooks/useAuthActions';

const WARNING_AT_MS = Number(
  import.meta.env['VITE_AUTH_SESSION_WARNING_MS'] || 25 * 60 * 1000,
);
const LOCK_AT_MS = Number(
  import.meta.env['VITE_AUTH_SESSION_INACTIVITY_TIMEOUT_MS'] || 30 * 60 * 1000,
);

export function useIdleTimer() {
  const identity = useSessionStore((state) => state.identity);
  const isLocked = useSessionStore((state) => state.isLocked);
  const { lock } = useAuthActions();
  const openIdleWarning = useUIStore((state) => state.openIdleWarning);
  const closeIdleWarning = useUIStore((state) => state.closeIdleWarning);

  const warningTimerRef = useRef<number | null>(null);
  const lockTimerRef = useRef<number | null>(null);

  const resetTimers = useCallback(() => {
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
    closeIdleWarning();
    warningTimerRef.current = window.setTimeout(() => {
      openIdleWarning();
    }, WARNING_AT_MS);
    lockTimerRef.current = window.setTimeout(() => {
      closeIdleWarning();
      void lock();
    }, LOCK_AT_MS);
  }, [lock, openIdleWarning, closeIdleWarning]);

  useEffect(() => {
    if (!identity || isLocked) {
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
      warningTimerRef.current = null;
      lockTimerRef.current = null;
      return;
    }

    const handleActivity = () => {
      resetTimers();
    };

    resetTimers();

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    return () => {
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [identity, isLocked, resetTimers]);

  return { resetTimers };
}
