import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/stores/session.store';

// Default to 30 minutes if not provided via env
const INACTIVITY_TIMEOUT_MS = Number(
  import.meta.env['VITE_AUTH_SESSION_INACTIVITY_TIMEOUT_MS'] || 30 * 60 * 1000,
);

export function useIdleTimer() {
  const identity = useSessionStore((state) => state.identity);
  const isLocked = useSessionStore((state) => state.isLocked);
  const setIsLocked = useSessionStore((state) => state.setIsLocked);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Only run the timer if the user is authenticated and the session is not currently locked
    if (!identity || isLocked) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const handleLock = async () => {
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/auth/lock`, {
          method: 'POST',
          credentials: 'include',
        });
        setIsLocked(true);
      } catch (error) {
        console.error('Failed to lock session on idle timeout', error);
        // Even if the network call fails, we should lock the UI locally
        setIsLocked(true);
      }
    };

    const resetTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(handleLock, INACTIVITY_TIMEOUT_MS);
    };

    const handleActivity = () => {
      resetTimer();
    };

    // Initialize timer
    resetTimer();

    // Attach event listeners
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [identity, isLocked, setIsLocked]);
}
