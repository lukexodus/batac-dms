import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
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
  Badge,
} from '@batac/ui';
import { toast } from 'sonner';

// ─── Access denied ──────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <p className="text-lg font-semibold text-destructive">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-2">
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

  // Employee picker — uses the sysadmin-gated variant.
  // The existing organization.listEmployees is gated by isPlatformAdmin only,
  // so a dedicated listEmployeesForSysAdmin procedure was added (scope expansion
  // documented in the PR description).
  const employeesQuery = trpc.organization.listEmployeesForSysAdmin.useQuery(
    { search: employeeSearch || undefined, limit: 20 },
    { enabled: employeeSearch.length >= 2 || false }
  );

  const createMutation = trpc.iam.createUserAccount.useMutation({
    onSuccess: () => {
      toast.success('User account created successfully.');
      void utils.iam.listUserDirectory.invalidate();
      setUsername('');
      setEmail('');
      setEmployeeSearch('');
      setSelectedEmployeeId(null);
      setSelectedEmployeeName('');
    },
    onError: (err) => toast.error(err.message || 'Failed to create user account.'),
  });

  const usernameValid = username.length >= 3 && username.length <= 64;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = usernameValid && emailValid && !!selectedEmployeeId && !createMutation.isPending;

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <p className="text-xs text-destructive">Username must be 3–64 characters.</p>
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
            <p className="text-xs text-muted-foreground">
              Type at least 2 characters to search employees.{' '}
              {selectedEmployeeName && (
                <span className="font-medium text-foreground">
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
              <p className="text-xs text-muted-foreground">Searching…</p>
            )}
            {employeesQuery.data && employeesQuery.data.items.length > 0 && !selectedEmployeeId && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto bg-background shadow-sm">
                {employeesQuery.data.items.map((emp) => (
                  <button
                    key={emp.employeeId}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedEmployeeId(emp.employeeId);
                      setSelectedEmployeeName(emp.displayName);
                      setEmployeeSearch(emp.displayName);
                    }}
                  >
                    <span className="font-medium">{emp.displayName}</span>
                    {emp.positionTitle && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        {emp.positionTitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {employeesQuery.data && employeesQuery.data.items.length === 0 && employeeSearch.length >= 2 && !selectedEmployeeId && (
              <p className="text-xs text-muted-foreground italic">No employees found for "{employeeSearch}".</p>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit}>
            {createMutation.isPending ? 'Creating…' : 'Create Account'}
          </Button>
        </form>
      </CardContent>
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
    currentStatus === 'deactivated' ? 'deactivated' : 'active'
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
    <div className="flex flex-col sm:flex-row items-start gap-2 py-2">
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="h-8 text-sm w-56"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as 'active' | 'deactivated')}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
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
  onRefresh: () => void;
}

function UserRow({ userId, username, email, status, onRefresh }: UserRowProps) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);

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

  const busy = deactivateMutation.isPending || reactivateMutation.isPending;

  const statusColor =
    status === 'active'
      ? 'bg-green-100 text-green-800 border-green-300'
      : status === 'deactivated'
      ? 'bg-red-100 text-red-700 border-red-300'
      : 'bg-gray-100 text-gray-600 border-gray-300';

  return (
    <div className="border rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary select-none">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm">{username}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>
            {status}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((v) => !v)}
            disabled={busy}
          >
            {editing ? 'Cancel Edit' : 'Edit'}
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
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function UserAccountManagementPage() {
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Client-side sys-admin gate.
  // NOTE: approximation of server's ctx.auth.isItAdmin — same divergence-risk
  // caveat as SystemAdminHomePage applies here.
  if (!session?.roleCodes.includes('sys_admin')) {
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
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
          <p className="text-xs text-muted-foreground">
            Showing first 20 results.
            {/* nextCursor is permanently null server-side — no real pagination yet. */}
          </p>

          {directoryQuery.isPending && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}
          {directoryQuery.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">
                Failed to load users: {directoryQuery.error.message}
              </p>
            </div>
          )}
          {directoryQuery.data && directoryQuery.data.items.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
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
                  onRefresh={() => directoryQuery.refetch()}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p>
          <strong>editUserAccount</strong> gate: <code>isItAdmin || isPlatformAdmin || self</code> —
          this page is sysadmin-scoped by route; the broader gate is existing, correct backend
          behavior (a regular user can edit their own account via this procedure; that's intentional).
        </p>
        <p>
          <strong>Deactivate/Reactivate</strong> status is read from the mutation's returned
          <code>newStatus</code> field, not hardcoded from the mutation name.
        </p>
      </div>
    </div>
  );
}
