import { format } from 'date-fns';
import { Link } from 'react-router-dom';

import { StatusBadge, DocumentNumberBadge } from '@batac/ui';

import { mapLifecycleStateToDocumentState } from '../../lib/status-mapping';

import type { RouterOutputs } from '../../lib/trpc';
import type { ColumnDef } from '@tanstack/react-table';

type DocumentSummary = RouterOutputs['documents']['list']['items'][number];

export const columns: ColumnDef<DocumentSummary>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => {
      // Placeholder link to a detail page that doesn't exist yet
      return (
        <Link
          to={`/documents/${row.original.id}`}
          className="text-primary font-medium hover:underline"
        >
          {row.getValue('title')}
        </Link>
      );
    },
  },
  {
    accessorKey: 'documentTypeCode',
    header: 'Type',
    cell: ({ row }) => {
      return <span>{row.original.documentTypeCode}</span>;
    },
  },
  {
    accessorKey: 'lifecycleState',
    header: 'Status',
    cell: ({ row }) => {
      const state = mapLifecycleStateToDocumentState(row.original.lifecycleState);
      return <StatusBadge state={state} />;
    },
  },
  {
    id: 'number',
    header: 'Number',
    cell: ({ row }) => {
      const doc = row.original;
      const number = doc.finalNumber ?? doc.preliminaryNumber ?? 'Draft';
      const variant = doc.finalNumber ? 'final' : 'preliminary';
      return <DocumentNumberBadge number={number} variant={variant} />;
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => {
      return (
        <span className="text-muted-foreground">
          {format(new Date(row.getValue('createdAt')), 'PP')}
        </span>
      );
    },
  },
];
