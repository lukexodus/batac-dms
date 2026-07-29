import React, { useState, useEffect, useRef } from 'react';

import { PageHeader, Card, CardContent, Button, Input } from '@batac/ui';

import { trpc } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

// Client-side sys-admin gate.
// NOTE: This is an approximation of the server's ctx.auth.isItAdmin,
// see SystemAdminHomePage for the full divergence-risk comment.
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

export function SystemLogsPage() {
  const identity = useSessionStore((s) => s.identity);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<any>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (!identity?.roleCodes.includes('sys_admin')) {
    return <AccessDenied />;
  }

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isError,
    error,
    refetch,
  } = trpc.audit.queryRuntimeLogs.useInfiniteQuery(
    {
      limit: 100,
      search: search || undefined,
      level: level || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: autoScroll ? 3000 : false,
    }
  );

  const logs = data?.pages.flatMap((p) => p.items) || [];

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollHeight - scrollTop > clientHeight + 50) {
      if (autoScroll) setAutoScroll(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        title="System Runtime Logs"
        subtitle="View and query system logs from the telemetry backend."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm"
          />
          <select
            className="flex h-10 w-40 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">All Levels</option>
            <option value="trace">Trace</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="fatal">Fatal</option>
          </select>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoScroll ? 'default' : 'outline'}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          </Button>
        </div>
      </div>

      {isError && (
        <div className="border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3">
          <p className="text-destructive text-sm">
            Failed to query logs: {error?.message}
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-[600px] overflow-y-auto bg-slate-950 font-mono text-xs text-slate-300"
          >
            {logs.length === 0 && !isFetching && (
              <div className="flex h-full items-center justify-center p-8 text-slate-500 italic">
                No logs found matching criteria.
              </div>
            )}
            <div className="divide-y divide-slate-800">
              {logs.map((log: any, i) => (
                <div key={i} className="flex gap-4 p-2 hover:bg-slate-900">
                  <span className="w-40 shrink-0 text-slate-500">
                    {new Date((log._timestamp || log.timestamp || Date.now()) / 1000).toLocaleString()}
                  </span>
                  <span
                    className={`w-16 shrink-0 font-semibold ${
                      log.level === 'error' || log.level === 'fatal'
                        ? 'text-red-400'
                        : log.level === 'warn'
                        ? 'text-yellow-400'
                        : log.level === 'info'
                        ? 'text-blue-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {(log.level || 'INFO').toUpperCase()}
                  </span>
                  <span className="break-all">{log.message || log.msg || JSON.stringify(log)}</span>
                </div>
              ))}
              {hasNextPage && (
                <div className="p-2 text-center">
                  <Button variant="link" size="sm" onClick={() => fetchNextPage()} disabled={isFetching}>
                    {isFetching ? 'Loading...' : 'Load older logs'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
