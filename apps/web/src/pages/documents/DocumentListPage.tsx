import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { FileText, Loader2, Plus } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
import { useDocumentFilters } from '../../hooks/useDocumentFilters';
import { trpc } from '../../lib/trpc';

export function DocumentListPage() {
  const navigate = useNavigate();
  const { filters } = useDocumentFilters();
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const currentCursor = cursorHistory[cursorHistory.length - 1] || undefined;

  // Reset cursor history when filters change
  useEffect(() => {
    setCursorHistory([]);
  }, [filters]);

  const { data, isLoading } = trpc.documents.list.useQuery({
    ...filters,
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

  if (isLoading && cursorHistory.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isLoading && data?.items.length === 0 && cursorHistory.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          icon={FileText}
          heading="No documents available"
          body="There are no documents to display at this time. This could be due to your current access permissions or active filters."
          action={{
            label: "New Document",
            onClick: () => {
              navigate("/documents/new");
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <Button asChild>
          <Link to="/documents/new">
            <Plus className="mr-2 h-4 w-4" />
            New Document
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={!hasPrevPage}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!hasNextPage}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
