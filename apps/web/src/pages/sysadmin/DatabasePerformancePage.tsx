import React from 'react';

import { PageHeader, Card, CardContent } from '@batac/ui';

import { trpc } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive text-lg font-semibold">Access Denied</p>
          <p className="text-muted-foreground mt-2 text-sm">
            This section requires System Administrator privileges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function DatabasePerformancePage() {
  const identity = useSessionStore((s) => s.identity);

  if (!identity?.roleCodes.includes('sys_admin')) {
    return <AccessDenied />;
  }

  // Poll every 10 seconds for real-time connection telemetry per requirements
  const { data, isPending, isError, error } = trpc.audit.getDatabasePerformanceSnapshot.useQuery(
    { activeOnly: true },
    { refetchInterval: 10000, retry: false }
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        title="Database Performance View"
        subtitle="Live snapshot of database activity and connection health."
      />

      {isPending && (
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-full rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 w-full rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      )}

      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-destructive font-semibold">System Configuration Error</h3>
              <p className="text-destructive/90 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardContent className="p-0">
            {/* Table layout implemented but unreachable due to backend blocking finding */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">PID</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">State</th>
                    <th className="px-4 py-3 text-left">Duration (ms)</th>
                    <th className="px-4 py-3 text-left">Wait Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* Dynamic rendering to be implemented when connection path is resolved */}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
