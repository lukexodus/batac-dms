import { createColumnHelper } from '@tanstack/react-table';
import { FileText, Loader2, ArrowRight, Check, X } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  EmptyState,
  Button,
  StatusBadge,
} from '@batac/ui';

import { DataTable } from '../../components/DataTable';
import { mapLifecycleStateToDocumentState } from '../../lib/status-mapping';
import { trpc } from '../../lib/trpc';

import type { RouterOutputs } from '../../lib/trpc';

type DocumentRequestRow = RouterOutputs['documents']['listAllDocumentRequests']['items'][0];

const columnHelper = createColumnHelper<DocumentRequestRow>();

function ApprovalCheck({ label, approved }: { label: string; approved: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      {approved ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <X className="text-muted-foreground h-3.5 w-3.5" />
      )}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

const columns = [
  columnHelper.accessor('title', {
    header: 'Title',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  columnHelper.accessor('requesterName', {
    header: 'Requester',
    cell: (info) => info.getValue() ?? '—',
  }),
  columnHelper.accessor('lifecycleState', {
    header: 'Status',
    cell: (info) => {
      const docState = mapLifecycleStateToDocumentState(info.getValue());
      return <StatusBadge state={docState} />;
    },
  }),
  columnHelper.display({
    id: 'approval',
    header: 'Approval',
    cell: (info) => (
      <div className="flex flex-col gap-0.5">
        <ApprovalCheck label="VM" approved={info.row.original.vmApproved} />
        <ApprovalCheck label="SP" approved={info.row.original.spApproved} />
      </div>
    ),
  }),
  columnHelper.accessor('createdAt', {
    header: 'Date Filed',
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
          <Link to={`/document-requests/${info.row.original.requestId}`}>
            View Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    ),
  }),
];

export function DocumentRequestsListPage() {
  const [requesterName, setRequesterName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const currentCursor = cursorHistory[cursorHistory.length - 1] || undefined;

  const { data, isLoading } = trpc.documents.listAllDocumentRequests.useQuery({
    requesterName: requesterName || undefined,
    documentNumber: documentNumber || undefined,
    cursor: currentCursor,
    limit: 20,
  });

  const handleSortOrFilterChange = () => {
    setCursorHistory([]);
  };

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

  const resetFilters = () => {
    setRequesterName('');
    setDocumentNumber('');
    setCursorHistory([]);
  };

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Document Requests</h1>
      </div>

      <div className="flex items-center gap-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Requester:</span>
          <input
            type="text"
            value={requesterName}
            onChange={(e) => {
              setRequesterName(e.target.value);
              setCursorHistory([]);
            }}
            placeholder="Search by name…"
            className="focus:ring-ring h-9 w-[200px] rounded-md border bg-white px-3 text-sm outline-none focus:ring-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Document No.:</span>
          <input
            type="text"
            value={documentNumber}
            onChange={(e) => {
              setDocumentNumber(e.target.value);
              setCursorHistory([]);
            }}
            placeholder="Search by number…"
            className="focus:ring-ring h-9 w-[200px] rounded-md border bg-white px-3 text-sm outline-none focus:ring-2"
          />
        </div>
        {(requesterName || documentNumber) && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear
          </Button>
        )}
      </div>

      {isLoading && cursorHistory.length === 0 ? (
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : !isLoading && data?.items.length === 0 && cursorHistory.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={FileText}
            heading="No document requests found"
            body="There are no document requests matching the current filters."
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          globalFilterPlaceholder="Search requests…"
          onSortingChange={handleSortOrFilterChange}
          onGlobalFilterChange={handleSortOrFilterChange}
        />
      )}

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
