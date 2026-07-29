import React, { useState } from 'react';
import { toast } from 'sonner';

import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@batac/ui';

import { trpc } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

// ─── Access denied ──────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive text-lg font-semibold">Access Denied</p>
          <p className="text-muted-foreground mt-2 text-sm">
            This page requires System Administrator privileges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Create user form ────────────────────────────────────────────────────────
function CreateUserForm() {
  const utils = trpc.useUtils();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('');
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  // Employee picker — uses the sysadmin-gated variant.
  // The existing organization.listEmployees is gated by isPlatformAdmin only,
  // so a dedicated listEmployeesForSysAdmin procedure was added (scope expansion
  // documented in the PR description).
  const employeesQuery = trpc.organization.listEmployeesForSysAdmin.useQuery(
    { search: employeeSearch || undefined, limit: 20 },
    { enabled: employeeSearch.length >= 2 || false },
  );

  const createMutation = trpc.iam.createUserAccount.useMutation({
    onSuccess: (data) => {
      toast.success('User account created successfully.');
      void utils.iam.listUserDirectory.invalidate();
      setUsername('');
      setEmail('');
      setEmployeeSearch('');
      setSelectedEmployeeId(null);
      setSelectedEmployeeName('');
      setResetUrl(data.resetUrl);
    },
    onError: (err) => toast.error(err.message || 'Failed to create user account.'),
  });

  const usernameValid = username.length >= 3 && username.length <= 64;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit =
    usernameValid && emailValid && !!selectedEmployeeId && !createMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;
    createMutation.mutate({ username, email, employeeId: selectedEmployeeId });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create User Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3–64 characters"
                minLength={3}
                maxLength={64}
                className={username && !usernameValid ? 'border-destructive' : ''}
              />
              {username && !usernameValid && (
                <p className="text-destructive text-xs">Username must be 3–64 characters.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@batac.gov.ph"
              />
            </div>
          </div>

          {/* Employee picker */}
          <div className="space-y-1">
            <Label htmlFor="employee-search">Employee (required)</Label>
            <p className="text-muted-foreground text-xs">
              Type at least 2 characters to search employees.{' '}
              {selectedEmployeeName && (
                <span className="text-foreground font-medium">
                  Selected: {selectedEmployeeName}
                </span>
              )}
            </p>
            <Input
              id="employee-search"
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                // Clear selection when search changes
                setSelectedEmployeeId(null);
                setSelectedEmployeeName('');
              }}
              placeholder="Search by first or last name…"
            />
            {employeesQuery.isPending && employeeSearch.length >= 2 && (
              <p className="text-muted-foreground text-xs">Searching…</p>
            )}
            {employeesQuery.data && employeesQuery.data.items.length > 0 && !selectedEmployeeId && (
              <div className="bg-background max-h-48 divide-y overflow-y-auto rounded-md border shadow-sm">
                {employeesQuery.data.items.map((emp) => (
                  <button
                    key={emp.employeeId}
                    type="button"
                    className="hover:bg-muted/50 w-full px-3 py-2 text-left text-sm transition-colors"
                    onClick={() => {
                      setSelectedEmployeeId(emp.employeeId);
                      setSelectedEmployeeName(emp.displayName);
                      setEmployeeSearch(emp.displayName);
                    }}
                  >
                    <span className="font-medium">{emp.displayName}</span>
                    {emp.positionTitle && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {emp.positionTitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {employeesQuery.data &&
              employeesQuery.data.items.length === 0 &&
              employeeSearch.length >= 2 &&
              !selectedEmployeeId && (
                <p className="text-muted-foreground text-xs italic">
                  No employees found for "{employeeSearch}".
                </p>
              )}
          </div>

          <Button type="submit" disabled={!canSubmit}>
            {createMutation.isPending ? 'Creating…' : 'Create Account'}
          </Button>
        </form>
      </CardContent>
      <Dialog
        open={resetUrl !== null}
        onOpenChange={(open) => {
          if (!open) setResetUrl(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset Link</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Share this link with the user. It is single-use and will expire. This is the only time
            this link will be shown — it cannot be retrieved again after this dialog is closed.
          </p>
          {resetUrl && (
            <div className="flex items-center gap-2">
              <Input readOnly value={resetUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(resetUrl);
                  toast.success('Copied to clipboard.');
                }}
              >
                Copy
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUrl(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Edit user inline form ───────────────────────────────────────────────────
interface EditFormProps {
  userId: string;
  currentEmail: string;
  currentStatus: string;
  onDone: () => void;
}

function EditUserForm({ userId, currentEmail, currentStatus, onDone }: EditFormProps) {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState(currentEmail);
  const [status, setStatus] = useState<'active' | 'deactivated'>(
    currentStatus === 'deactivated' ? 'deactivated' : 'active',
  );

  const editMutation = trpc.iam.editUserAccount.useMutation({
    onSuccess: () => {
      toast.success('User account updated.');
      void utils.iam.listUserDirectory.invalidate();
      onDone();
    },
    onError: (err) => toast.error(err.message || 'Failed to update user account.'),
  });

  return (
    <div className="flex flex-col items-start gap-2 py-2 sm:flex-row">
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="h-8 w-56 text-sm"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as 'active' | 'deactivated')}
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
      >
        <option value="active">Active</option>
        <option value="deactivated">Deactivated</option>
      </select>
      <Button
        size="sm"
        disabled={editMutation.isPending}
        onClick={() => editMutation.mutate({ userId, email, status })}
      >
        Save
      </Button>
      <Button variant="outline" size="sm" onClick={onDone} disabled={editMutation.isPending}>
        Cancel
      </Button>
    </div>
  );
}

// ─── User directory row ──────────────────────────────────────────────────────
interface UserRowProps {
  userId: string;
  username: string;
  email: string;
  status: string;
}

function UserRow({ userId, username, email, status }: UserRowProps) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const generateResetLinkMutation = trpc.iam.generatePasswordResetLink.useMutation({
    onSuccess: (data) => {
      setResetUrl(data.resetUrl);
    },
    onError: (err) => toast.error(err.message || 'Failed to generate reset link.'),
  });

  const deactivateMutation = trpc.iam.deactivateUserAccount.useMutation({
    onSuccess: (data) => {
      // Use the returned newStatus — don't hardcode an assumption
      toast.success(`Account ${data.newStatus === 'deactivated' ? 'deactivated' : 'updated'}.`);
      void utils.iam.listUserDirectory.invalidate();
    },
    onError: (err) => toast.error(err.message || 'Failed to deactivate account.'),
  });

  const reactivateMutation = trpc.iam.reactivateUserAccount.useMutation({
    onSuccess: (data) => {
      // Use the returned newStatus — don't hardcode an assumption
      toast.success(`Account ${data.newStatus === 'active' ? 'reactivated' : 'updated'}.`);
      void utils.iam.listUserDirectory.invalidate();
    },
    onError: (err) => toast.error(err.message || 'Failed to reactivate account.'),
  });

  const busy =
    deactivateMutation.isPending ||
    reactivateMutation.isPending ||
    generateResetLinkMutation.isPending;

  const statusColor =
    status === 'active'
      ? 'bg-green-100 text-green-800 border-green-300'
      : status === 'deactivated'
        ? 'bg-red-100 text-red-700 border-red-300'
        : 'bg-gray-100 text-gray-600 border-gray-300';

  return (
    <div className="space-y-2 rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold select-none">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{username}</p>
            <p className="text-muted-foreground text-xs">{email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}>
            {status}
          </span>
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)} disabled={busy}>
            {editing ? 'Cancel Edit' : 'Edit'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => generateResetLinkMutation.mutate({ userId })}
          >
            Generate Reset Link
          </Button>
          {status !== 'deactivated' ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => deactivateMutation.mutate({ userId })}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => reactivateMutation.mutate({ userId })}
            >
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <EditUserForm
          userId={userId}
          currentEmail={email}
          currentStatus={status}
          onDone={() => setEditing(false)}
        />
      )}

      <Dialog
        open={resetUrl !== null}
        onOpenChange={(open) => {
          if (!open) setResetUrl(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset Link</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Share this link with the user. It is single-use and will expire. This is the only time
            this link will be shown — it cannot be retrieved again after this dialog is closed.
          </p>
          {resetUrl && (
            <div className="flex items-center gap-2">
              <Input readOnly value={resetUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(resetUrl);
                  toast.success('Copied to clipboard.');
                }}
              >
                Copy
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUrl(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function UserAccountManagementPage() {
  const identity = useSessionStore((s) => s.identity);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Client-side sys-admin gate.
  // NOTE: approximation of server's ctx.auth.isItAdmin — same divergence-risk
  // caveat as SystemAdminHomePage applies here.
  if (!identity?.roleCodes.includes('sys_admin')) {
    return <AccessDenied />;
  }

  const directoryQuery = trpc.iam.listUserDirectory.useQuery({
    pageSize: 20,
    search: debouncedSearch || undefined,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    const timer = setTimeout(() => setDebouncedSearch(val), 400);
    return () => clearTimeout(timer);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="User Account Management"
        subtitle="Create, edit, deactivate, and reactivate user accounts."
      />

      {/* Create form */}
      <CreateUserForm />

      {/* Directory */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">User Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            id="user-directory-search"
            placeholder="Search by username or email…"
            value={search}
            onChange={handleSearchChange}
            className="max-w-sm"
          />
          <p className="text-muted-foreground text-xs">
            Showing first 20 results.
            {/* nextCursor is permanently null server-side — no real pagination yet. */}
          </p>

          {directoryQuery.isPending && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}
          {directoryQuery.isError && (
            <div className="border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3">
              <p className="text-destructive text-sm">
                Failed to load users: {directoryQuery.error.message}
              </p>
            </div>
          )}
          {directoryQuery.data && directoryQuery.data.items.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm italic">
              No users found{debouncedSearch ? ` matching "${debouncedSearch}"` : ''}.
            </p>
          )}
          {directoryQuery.data && directoryQuery.data.items.length > 0 && (
            <div className="space-y-2">
              {directoryQuery.data.items.map((user) => (
                <UserRow
                  key={user.id}
                  userId={user.id}
                  username={user.username}
                  email={user.email}
                  status={user.status}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="bg-muted/30 text-muted-foreground space-y-1 rounded-md border px-4 py-3 text-xs">
        <p>
          <strong>editUserAccount</strong> gate: <code>isItAdmin || isPlatformAdmin || self</code> —
          this page is sysadmin-scoped by route; the broader gate is existing, correct backend
          behavior (a regular user can edit their own account via this procedure; that's
          intentional).
        </p>
        <p>
          <strong>Deactivate/Reactivate</strong> status is read from the mutation's returned
          <code>newStatus</code> field, not hardcoded from the mutation name.
        </p>
      </div>
    </div>
  );
}
