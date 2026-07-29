import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { ClipboardList, Loader2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  Button,
} from '@batac/ui';

import { columns } from './columns';
import { hasRole } from '../../lib/auth-helpers';
import { trpc } from '../../lib/trpc';

import { useSessionStore } from '@/stores';

// ─── Role gate ────────────────────────────────────────────────────────────────
// Mirrors the local helper in DocumentDetailPage.tsx — not yet extracted to a
// shared location. Copied locally here (second consumer) because the codebase
// currently has no shared utility file for this; a future refactor can extract
// it once there are enough consumers to justify a shared module. See PR notes
// for TASK-WF-FE-001 for the explicit rationale.

// The 10-role set is sourced from workflow.router.ts lines 429-439
// (ground truth). F1 §8.1, E1, I2, and F4 previously listed 9 (omitting
// auditor) — that discrepancy is tracked in development-findings-log.md
// LOG-0069 and is being resolved separately. We build against the code.
const PAGE_ALLOWED_ROLES = [
  'dept_encoder',
  'dept_approver',
  'sp_secretary',
  'sp_member',
  'sp_presiding_officer',
  'mayor',
  'brgy_encoder',
  'brgy_captain',
  'records_officer',
  'auditor',
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyAssignedStepsPage() {
  const identity = useSessionStore((s) => s.identity);
  const roleCodes: string[] = identity?.roleCodes ?? [];

  // ── Role gate: render nothing (or a lightweight denial) for unauthorised
  //    users. Server also enforces this — the client gate is a UX measure only.
  if (!hasRole(identity, ...PAGE_ALLOWED_ROLES)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return <MyAssignedStepsContent />;
}

// Separated so hooks always run in a component where the role gate has already
// passed — avoids conditional-hook lint issues.
function MyAssignedStepsContent() {
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const currentCursor = cursorHistory[cursorHistory.length - 1] || undefined;

  // cursor/limit are the only inputs — no filter params exist server-side yet.
  // Keeping the query call clean / filter-free makes it easy to add a
  // filter param later if the server grows one (per TASK-WF-FE-001 spec note).
  const { data, isLoading } = trpc.workflow.listMyAssignedSteps.useQuery({
    cursor: currentCursor,
    limit: 20,
  });

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleNext = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, data.nextCursor!]);
    }
  };

  const handlePrev = () => {
    setCursorHistory((prev) => prev.slice(0, -1));
  };

  const hasNextPage = !!data?.nextCursor;
  const hasPrevPage = cursorHistory.length > 0;

  // True initial load only (not page-nav refetches)
  if (isLoading && cursorHistory.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Empty state — shown only on the true first page with no data
  if (!isLoading && data?.items.length === 0 && cursorHistory.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          icon={ClipboardList}
          heading="No assigned steps"
          body="You have no workflow steps currently assigned to you."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Assigned Steps</h1>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={handlePrev} disabled={!hasPrevPage}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasNextPage}>
          Next
        </Button>
      </div>
    </div>
  );
}
