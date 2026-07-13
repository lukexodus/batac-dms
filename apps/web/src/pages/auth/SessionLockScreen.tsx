import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/stores/session.store';
import { Button, Input, Label, Alert, AlertDescription } from '@batac/ui';
import { useAuthActions } from '@/hooks/useAuthActions';
import { LockKeyhole, AlertCircle } from 'lucide-react';

export function SessionLockScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const identity = useSessionStore((state) => state.identity);
  const setIsLocked = useSessionStore((state) => state.setIsLocked);
  const { logout } = useAuthActions();
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'REFRESH_REQUIRED') {
          // Session expired beyond refresh capability
          await logout();
          navigate('/login', { replace: true, state: { message: data.message } });
          return;
        }
        throw new Error(data.message || 'Invalid password');
      }

      // Success
      setIsLocked(false);
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 pb-4 items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-2">
            <LockKeyhole className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="whitespace-nowrap tracking-tight text-2xl font-semibold leading-none">
            Session Locked
          </h3>
          <p className="text-sm text-muted-foreground pt-1">
            Welcome back, <span className="font-medium text-foreground">{identity.displayName}</span>
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
                <AlertDescription className="text-sm ml-2">{error}</AlertDescription>
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
