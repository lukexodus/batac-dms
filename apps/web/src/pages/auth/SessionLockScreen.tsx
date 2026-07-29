import { LockKeyhole, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Input, Label, Alert, AlertDescription } from '@batac/ui';

import { useAuthActions } from '@/hooks/useAuthActions';
import { useSessionStore } from '@/stores/session.store';

export function SessionLockScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const identity = useSessionStore((state) => state.identity);
  const { logout, unlock } = useAuthActions();
  const navigate = useNavigate();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await unlock(password);

      if (!result.ok) {
        if (result.code === 'REFRESH_REQUIRED') {
          // Session expired beyond refresh capability
          await logout();
          navigate('/login', { replace: true, state: { message: result.message } });
          return;
        }
        throw new Error(result.message || 'Invalid password');
      }

      // Success
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!identity) {
    return null;
  }

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-card text-card-foreground w-full max-w-md rounded-lg border shadow-sm">
        <div className="flex flex-col items-center justify-center space-y-1.5 p-6 pb-4 text-center">
          <div className="bg-muted mb-2 flex h-16 w-16 items-center justify-center rounded-full">
            <LockKeyhole className="text-muted-foreground h-8 w-8" />
          </div>
          <h3 className="text-2xl leading-none font-semibold tracking-tight whitespace-nowrap">
            Session Locked
          </h3>
          <p className="text-muted-foreground pt-1 text-sm">
            Welcome back,{' '}
            <span className="text-foreground font-medium">{identity.displayName}</span>
          </p>
        </div>

        <div className="p-6 pt-0">
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Enter password to unlock</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Unlocking...' : 'Unlock Session'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button variant="link" size="sm" onClick={handleLogoutClick} disabled={isSubmitting}>
              Not {identity.displayName}? Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
