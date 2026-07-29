import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@batac/ui';

import { trpc } from '@/lib/trpc';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');

  // Base64url encoding (used for rawToken) does not include '.', so a naive split on the first '.' is safe here.
  const dotIndex = tokenParam ? tokenParam.indexOf('.') : -1;
  const tokenId = dotIndex !== -1 ? tokenParam!.slice(0, dotIndex) : null;
  const rawToken = dotIndex !== -1 ? tokenParam!.slice(dotIndex + 1) : null;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  const redeemMutation = trpc.iam.redeemPasswordResetToken.useMutation({
    onSuccess: () => {
      setClientError(null);
    },
  });

  if (!tokenParam || dotIndex === -1 || !tokenId || !rawToken) {
    return (
      <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Batac DMS</CardTitle>
            <CardDescription>Reset Password</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive text-sm font-medium">
              This password reset link is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (redeemMutation.isSuccess) {
    return (
      <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Batac DMS</CardTitle>
            <CardDescription>Password Reset Complete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">Your password has been reset. You can now log in.</p>
            <Button asChild className="w-full">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    if (password !== confirmPassword) {
      setClientError('Passwords do not match.');
      return;
    }
    redeemMutation.mutate({ tokenId, rawToken, newPassword: password });
  };

  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Batac DMS</CardTitle>
          <CardDescription>Enter your new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                autoFocus
              />
              <p className="text-muted-foreground text-xs">Minimum 12 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
              />
            </div>
            {(clientError || redeemMutation.error) && (
              <p className="text-destructive text-sm">
                {clientError || redeemMutation.error?.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={redeemMutation.isPending}>
              {redeemMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
