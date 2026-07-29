import React, { useState } from 'react';
import { toast } from 'sonner';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  Skeleton,
} from '@batac/ui';

import { trpc } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

// ─── Role code constants ────────────────────────────────────────────────────
// Sourced from iam.schemas.ts roleCodeEnum — 13 values, confirmed current.
const ROLE_CODES = [
  'sys_admin',
  'plat_admin',
  'records_officer',
  'dept_encoder',
  'dept_approver',
  'sp_secretary',
  'sp_member',
  'sp_presiding_officer',
  'mayor',
  'brgy_encoder',
  'brgy_captain',
  'auditor',
  'citizen',
] as const;

type RoleCode = (typeof ROLE_CODES)[number];

// Human-readable labels for the select options
const ROLE_LABELS: Record<RoleCode, string> = {
  sys_admin: 'System Administrator',
  plat_admin: 'Platform Administrator',
  records_officer: 'Records Officer',
  dept_encoder: 'Department Encoder',
  dept_approver: 'Department Approver',
  sp_secretary: 'SP Secretary',
  sp_member: 'SP Member',
  sp_presiding_officer: 'SP Presiding Officer',
  mayor: 'Mayor',
  brgy_encoder: 'Barangay Encoder',
  brgy_captain: 'Barangay Captain',
  auditor: 'Auditor',
  citizen: 'Citizen',
};

// ─── Access denied ──────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive text-lg font-semibold">Access Denied</p>
          <p className="text-muted-foreground mt-2 text-sm">
            This page requires Platform Administrator privileges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Per-user role row ───────────────────────────────────────────────────────
interface UserRoleRowProps {
  userId: string;
  username: string;
  email: string;
  status: string;
}

function UserRoleRow({ userId, username, email, status }: UserRoleRowProps) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleCode>('dept_encoder');
  const [officeScopeId, setOfficeScopeId] = useState('');

  // Lazy: only fetch when the row is expanded
  const assignmentsQuery = trpc.iam.listRoleAssignmentsByUser.useQuery(
    { userId },
    { enabled: expanded },
  );

  const assignRoleMutation = trpc.iam.assignRole.useMutation({
    onSuccess: () => {
      toast.success('Role assigned successfully.');
      void utils.iam.listUserDirectory.invalidate();
      void utils.iam.listRoleAssignmentsByUser.invalidate({ userId });
    },
    // NO fallback string — assignRole throws RoleCombinationForbiddenError with a
    // specific, meaningful message. That message must be surfaced verbatim.
    onError: (err) => toast.error(err.message),
  });

  const revokeRoleMutation = trpc.iam.revokeRole.useMutation({
    onSuccess: () => {
      toast.success('Role revoked successfully.');
      void utils.iam.listUserDirectory.invalidate();
      void utils.iam.listRoleAssignmentsByUser.invalidate({ userId });
    },
    onError: (err) => toast.error(err.message || 'Failed to revoke role.'),
  });

  const busy = assignRoleMutation.isPending || revokeRoleMutation.isPending;

  const handleAssign = () => {
    assignRoleMutation.mutate({
      userId,
      roleCode: selectedRole,
      officeScopeId: officeScopeId.trim() || undefined,
    });
  };

  const statusColor =
    status === 'active'
      ? 'bg-green-100 text-green-800 border-green-300'
      : 'bg-gray-100 text-gray-600 border-gray-300';

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Row header — always visible */}
      <button
        type="button"
        className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold select-none">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{username}</p>
            <p className="text-muted-foreground text-xs">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}>
            {status}
          </span>
          <span className="text-muted-foreground text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="bg-muted/20 space-y-4 border-t px-4 py-4">
          {/* Current assignments */}
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Current Role Assignments
            </p>
            {assignmentsQuery.isPending && (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            )}
            {assignmentsQuery.isError && (
              <p className="text-destructive text-xs">Failed to load assignments.</p>
            )}
            {assignmentsQuery.data && assignmentsQuery.data.length === 0 && (
              <p className="text-muted-foreground text-xs italic">No active role assignments.</p>
            )}
            {assignmentsQuery.data && assignmentsQuery.data.length > 0 && (
              <div className="space-y-2">
                {assignmentsQuery.data.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="bg-background flex items-center justify-between rounded border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {assignment.roleCode}
                      </Badge>
                      <span className="text-muted-foreground text-sm">{assignment.roleName}</span>
                      {assignment.officeScopeId && (
                        <span className="text-muted-foreground text-xs italic">
                          scope: {assignment.officeScopeId}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => revokeRoleMutation.mutate({ roleAssignmentId: assignment.id })}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign new role */}
          <div className="border-t pt-4">
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
              Assign New Role
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                id={`role-select-${userId}`}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as RoleCode)}
                className="border-input bg-background focus:ring-ring h-9 flex-1 rounded-md border px-3 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
                disabled={busy}
              >
                {ROLE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {ROLE_LABELS[code]} ({code})
                  </option>
                ))}
              </select>
              <Input
                id={`office-scope-${userId}`}
                placeholder="Office scope UUID (optional)"
                value={officeScopeId}
                onChange={(e) => setOfficeScopeId(e.target.value)}
                className="h-9 flex-1 font-mono text-sm"
                disabled={busy}
              />
              <Button onClick={handleAssign} disabled={busy} className="whitespace-nowrap">
                Assign Role
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function RoleAssignmentPage() {
  const identity = useSessionStore((s) => s.identity);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Client-side platform-admin gate.
  // NOTE: This is an approximation of the server's ctx.auth.isPlatformAdmin,
  // which is actually derived from the `is_platform_admin` boolean column on
  // the iam.roles table (not just the role code string). Currently equivalent
  // under the seed data (only 'plat_admin' has that flag set), but would
  // diverge if a custom role were ever created with a different code and
  // is_platform_admin = true, or if plat_admin's own flag were changed.
  if (!identity?.roleCodes.includes('plat_admin')) {
    return <AccessDenied />;
  }

  const directoryQuery = trpc.iam.listUserDirectory.useQuery({
    pageSize: 20,
    search: debouncedSearch || undefined,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    // Simple debounce via timeout — avoids a dependency on an external library
    const timer = setTimeout(() => setDebouncedSearch(val), 400);
    return () => clearTimeout(timer);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Role Assignment</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Assign or revoke roles for users in this city instance. Changes take effect on the user's
          next login (session token is refreshed on next request).
        </p>
      </div>

      {/* Search */}
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
            Showing first 20 results.{' '}
            {debouncedSearch ? (
              <>
                Filtered by: <span className="font-mono">{debouncedSearch}</span>
              </>
            ) : (
              'Use the search box to narrow results.'
            )}
            {/* nextCursor is permanently null server-side in the current implementation —
                pagination beyond 20 results is not yet functional. */}
          </p>

          {/* Directory list */}
          {directoryQuery.isPending && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}
          {directoryQuery.isError && (
            <div className="border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3">
              <p className="text-destructive text-sm">
                Failed to load user directory: {directoryQuery.error.message}
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
                <UserRoleRow
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
          <strong>Role assignment</strong> calls <code>iam.assignRole</code>. The server enforces
          role combination rules; if a combination is disallowed, the exact error message will be
          shown.
        </p>
        <p>
          <strong>Role revocation</strong> calls <code>iam.revokeRole</code> with the assignment ID.
          The assignment becomes inactive immediately server-side.
        </p>
        <p>
          <strong>Role definition</strong> (creating new roles or permission sets) is not available
          here — no such procedure exists in the current backend. This is a known gap, tracked
          separately.
        </p>
      </div>
    </div>
  );
}
