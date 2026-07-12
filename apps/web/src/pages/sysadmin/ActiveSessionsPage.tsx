import React, { useState } from 'react';
import { toast } from 'sonner';

import {
  PageHeader,
  Card,
  CardContent,
  Button,
  Input,
  Skeleton,
} from '@batac/ui';

import { useAuth } from '@/lib/auth-context';
import { trpc } from '@/lib/trpc';


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

// ─── Inline active/inactive badge ───────────────────────────────────────────
// NOTE: StatusBadge from @batac/ui only accepts DocumentState values — it
// cannot be used for session active: boolean. Using an inline implementation.
function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
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
    onError: (err) => toast.error(err.message || 'Failed to terminate session.'),
  });

  if (!open) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
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
        className="h-8 text-sm w-48"
        autoFocus
      />
      <Button
        variant="destructive"
        size="sm"
        // Client-side enforcement: button disabled when reason is empty.
        // Server-side also rejects empty reason (z.string().min(1)) — this is
        // the UX layer, not the only guard.
        disabled={!reason.trim() || terminateMutation.isPending}
        onClick={() =>
          terminateMutation.mutate({ sessionId, reason: reason.trim() })
        }
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
  const { session } = useAuth();

  // Client-side sys-admin gate.
  // NOTE: approximation of server's ctx.auth.isItAdmin — see SystemAdminHomePage
  // for the full divergence-risk comment; same limitation applies here.
  if (!session?.roleCodes.includes('sys_admin')) {
    return <AccessDenied />;
  }

  const sessionsQuery = trpc.iam.listAllActiveSessions.useQuery({ pageSize: 20 });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <PageHeader
        title="Active Sessions"
        subtitle="View and force-terminate active user sessions."
      />

      <p className="text-xs text-muted-foreground">
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
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">
            Failed to load sessions: {sessionsQuery.error.message}
          </p>
        </div>
      )}

      {sessionsQuery.data && sessionsQuery.data.items.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-8">
          No active sessions found.
        </p>
      )}

      {sessionsQuery.data && sessionsQuery.data.items.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  User ID
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  User Agent
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  Last Activity
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessionsQuery.data.items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                    {s.userId}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {s.ipAddress ?? <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]">
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
                      <TerminateRow
                        sessionId={s.id}
                        onDone={() => sessionsQuery.refetch()}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Already terminated</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <p>
          <strong>Note:</strong> Session token hashes are never displayed here — they are
          credential-adjacent values with no human-readable utility.
        </p>
        <p className="mt-1">
          Termination requires a non-empty reason, enforced both client-side (button remains
          disabled until a reason is entered) and server-side (Zod validation rejects empty
          strings before the role check runs).
        </p>
      </div>
    </div>
  );
}
