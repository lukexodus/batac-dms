import React, { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader, Card, CardContent, Button, Input, Skeleton } from '@batac/ui';

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

// ─── Inline active/inactive badge ───────────────────────────────────────────
// NOTE: StatusBadge from @batac/ui only accepts DocumentState values — it
// cannot be used for session active: boolean. Using an inline implementation.
function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      Inactive
    </span>
  );
}

// ─── Terminate session row action ───────────────────────────────────────────
interface TerminateRowProps {
  sessionId: string;
  onDone: () => void;
}

function TerminateRow({ sessionId, onDone }: TerminateRowProps) {
  const utils = trpc.useUtils();
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  const terminateMutation = trpc.iam.forceTerminateSession.useMutation({
    onSuccess: () => {
      toast.success('Session terminated.');
      void utils.iam.listAllActiveSessions.invalidate();
      setOpen(false);
      setReason('');
      onDone();
    },
    onError: (err) => toast.error(err.message || 'Failed to terminate identity.'),
  });

  if (!open) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Terminate
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        id={`terminate-reason-${sessionId}`}
        placeholder="Reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="h-8 w-48 text-sm"
        autoFocus
      />
      <Button
        variant="destructive"
        size="sm"
        // Client-side enforcement: button disabled when reason is empty.
        // Server-side also rejects empty reason (z.string().min(1)) — this is
        // the UX layer, not the only guard.
        disabled={!reason.trim() || terminateMutation.isPending}
        onClick={() => terminateMutation.mutate({ sessionId, reason: reason.trim() })}
      >
        Confirm
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(false);
          setReason('');
        }}
        disabled={terminateMutation.isPending}
      >
        Cancel
      </Button>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function ActiveSessionsPage() {
  const identity = useSessionStore((s) => s.identity);

  // Client-side sys-admin gate.
  // NOTE: approximation of server's ctx.auth.isItAdmin — see SystemAdminHomePage
  // for the full divergence-risk comment; same limitation applies here.
  if (!identity?.roleCodes.includes('sys_admin')) {
    return <AccessDenied />;
  }

  const sessionsQuery = trpc.iam.listAllActiveSessions.useQuery({ pageSize: 20 });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        title="Active Sessions"
        subtitle="View and force-terminate active user sessions."
      />

      <p className="text-muted-foreground text-xs">
        Showing first 20 active sessions.{' '}
        {/* nextCursor is permanently null server-side in the current implementation. */}
        Pagination beyond this page is not yet functional.
      </p>

      {sessionsQuery.isPending && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {sessionsQuery.isError && (
        <div className="border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3">
          <p className="text-destructive text-sm">
            Failed to load sessions: {sessionsQuery.error.message}
          </p>
        </div>
      )}

      {sessionsQuery.data && sessionsQuery.data.items.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm italic">
          No active sessions found.
        </p>
      )}

      {sessionsQuery.data && sessionsQuery.data.items.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                  User ID
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                  IP Address
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                  User Agent
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                  Last Activity
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                  Status
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessionsQuery.data.items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="text-muted-foreground max-w-[120px] truncate px-4 py-3 font-mono text-xs">
                    {s.userId}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.ipAddress ?? <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="text-muted-foreground max-w-[200px] truncate px-4 py-3 text-xs">
                    {s.userAgent ?? <span className="italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(s.lastActivityAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={s.active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* Only offer terminate for currently active sessions */}
                    {s.active ? (
                      <TerminateRow sessionId={s.id} onDone={() => sessionsQuery.refetch()} />
                    ) : (
                      <span className="text-muted-foreground text-xs italic">
                        Already terminated
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-muted/30 text-muted-foreground rounded-md border px-4 py-3 text-xs">
        <p>
          <strong>Note:</strong> Session token hashes are never displayed here — they are
          credential-adjacent values with no human-readable utility.
        </p>
        <p className="mt-1">
          Termination requires a non-empty reason, enforced both client-side (button remains
          disabled until a reason is entered) and server-side (Zod validation rejects empty strings
          before the role check runs).
        </p>
      </div>
    </div>
  );
}
