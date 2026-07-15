import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { FileText, Loader2, Plus, ArrowRight } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  Button,
  StatusBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@batac/ui';

import { trpc } from '../../lib/trpc';

import type { RouterOutputs } from '../../lib/trpc';
import type { DocumentState } from '@batac/ui/types/domain';

type ComplaintRow = RouterOutputs['documents']['listAllComplaints']['items'][0];

const columnHelper = createColumnHelper<ComplaintRow>();

const columns = [
  columnHelper.accessor('subjectMatter', {
    header: 'Subject Matter',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('outcomeState', {
    header: 'Status',
    cell: (info) => {
      const val = info.getValue() as string;
      const docState = val.toUpperCase() as DocumentState;
      return <StatusBadge state={docState} />;
    },
  }),
  columnHelper.accessor('createdAt', {
    header: 'Date Logged',
    cell: (info) => {
      const date = info.getValue();
      return new Date(date).toLocaleDateString();
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    cell: (info) => (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/complaints/${info.row.original.complaintId}`}>
            View Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    ),
  }),
];

export function ComplaintsListPage() {
  const [outcomeState, setOutcomeState] = useState<string>('all');
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const currentCursor = cursorHistory[cursorHistory.length - 1] || undefined;

  const validOutcomeState =
    outcomeState !== 'all'
      ? (outcomeState as 'pending_hearing' | 'received_seen' | 'dismissed' | 'resolved')
      : undefined;

  const { data, isLoading } = trpc.documents.listAllComplaints.useQuery({
    outcomeState: validOutcomeState,
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

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Citizen Complaints</h1>
        <Button asChild>
          <Link to="/complaints/new">
            <Plus className="mr-2 h-4 w-4" />
            New Complaint
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter by Status:</span>
          <Select
            value={outcomeState}
            onValueChange={(val) => {
              setOutcomeState(val);
              setCursorHistory([]); // reset pagination on filter change
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_hearing">Pending Hearing</SelectItem>
              <SelectItem value="received_seen">Received / Seen</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        {isLoading && cursorHistory.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : !isLoading && data?.items.length === 0 && cursorHistory.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={FileText}
              heading="No complaints found"
              body="There are no citizen complaints matching the current filters."
            />
          </div>
        ) : (
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
        )}
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
