import { format } from 'date-fns';
import React, { useState } from 'react';

import { PageHeader, Card, CardContent, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button } from '@batac/ui';

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

export function SecurityAuditLedgerPage() {
  const identity = useSessionStore((s) => s.identity);
  
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [actorIdFilter, setActorIdFilter] = useState('');

  if (!identity?.roleCodes.includes('sys_admin')) {
    return <AccessDenied />;
  }

  const { data: eventTypesRaw } = trpc.audit.getSecurityLedgerEventTypes.useQuery();
  const eventTypes = (eventTypesRaw ?? []) as string[];

  const { data, isPending, fetchNextPage, hasNextPage } = trpc.audit.listSecurityLedger.useInfiniteQuery(
    {
      eventType: eventTypeFilter === 'ALL' ? undefined : eventTypeFilter,
      actorId: actorIdFilter || undefined,
      pageSize: 50,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const flatItems = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        title="Security Audit Ledger"
        subtitle="Append-only log of system security events. Deletion and modification are blocked by database-level constraints."
      />

      <Card>
        <CardContent className="flex items-end gap-4 pt-6">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Event Type</label>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Events</SelectItem>
                {eventTypes?.map((et) => (
                  <SelectItem key={et} value={et}>
                    {et}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Actor ID (UUID)</label>
            <Input 
              placeholder="Filter by Actor UUID..." 
              value={actorIdFilter}
              onChange={(e) => setActorIdFilter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Timestamp</th>
                  <th className="px-4 py-3 text-left">Event Type</th>
                  <th className="px-4 py-3 text-left">Actor ID</th>
                  <th className="px-4 py-3 text-left">Target ID</th>
                  <th className="px-4 py-3 text-left">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isPending && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">Loading...</td>
                  </tr>
                )}
                {!isPending && flatItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">No events found</td>
                  </tr>
                )}
                {flatItems.map((item) => (
                  <tr key={item.auditEventId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{format(new Date(item.occurredAt), 'PP pp')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.eventType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.actorId || 'SYSTEM'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.targetId || '-'}</td>
                    <td className="px-4 py-3">
                      <pre className="text-[10px] bg-muted/30 p-2 rounded overflow-x-auto max-w-sm">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {hasNextPage && (
            <div className="p-4 border-t flex justify-center">
              <Button variant="outline" onClick={() => fetchNextPage()}>
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
