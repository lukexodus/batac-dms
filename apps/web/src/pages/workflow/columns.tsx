import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import type { RouterOutputs } from '../../lib/trpc';
import { Link } from 'react-router-dom';

type AssignedStepRow = RouterOutputs['workflow']['listMyAssignedSteps']['items'][number];

// ─── Step Type Badge ─────────────────────────────────────────────────────────
// No pre-development document specifies human-readable labels for the
// six stepType values — this choice is recorded in development-findings-log.md
// entry LOG-0071 (status: proposed) for human confirmation.
//
// Shape mirrors StatusBadge's pattern (typed prop → lookup → styled span)
// but is intentionally NOT extracted to packages/ui — it's a small local
// helper for this page only. See TASK-WF-FE-001 implementation notes.

type StepType = 'action' | 'approval' | 'multi_referral' | 'decision' | 'notification' | 'termination';

const STEP_TYPE_META: Record<
  StepType,
  { label: string; className: string }
> = {
  action: {
    label: 'Action',
    className:
      'inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700',
  },
  approval: {
    label: 'Approval',
    className:
      'inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700',
  },
  multi_referral: {
    label: 'Multi-Referral',
    className:
      'inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700',
  },
  decision: {
    label: 'Decision',
    className:
      'inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700',
  },
  notification: {
    label: 'Notification',
    className:
      'inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600',
  },
  termination: {
    label: 'Termination',
    className:
      'inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700',
  },
};

function StepTypeBadge({ stepType }: { stepType: string }) {
  const meta = STEP_TYPE_META[stepType as StepType];
  if (!meta) return null;
  return <span className={meta.className}>{meta.label}</span>;
}

// ─── Column Definitions ───────────────────────────────────────────────────────

export const columns: ColumnDef<AssignedStepRow>[] = [
  {
    accessorKey: 'documentTitle',
    header: 'Document',
    cell: ({ row }) => {
      // Route key is instanceId per ADR-UI-010: the detail page's loader
      // (workflow.getInstance) takes { instanceId } — routing on instanceId
      // allows the future detail page to load with a single read call.
      return (
        <Link
          to={`/workflow/steps/${row.original.instanceId}`}
          className="font-medium hover:underline text-primary"
        >
          {row.getValue('documentTitle')}
        </Link>
      );
    },
  },
  {
    accessorKey: 'stepType',
    header: 'Step Type',
    cell: ({ row }) => <StepTypeBadge stepType={row.original.stepType} />,
  },
  {
    accessorKey: 'assignedAt',
    header: 'Assigned',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {format(new Date(row.getValue('assignedAt')), 'PP')}
      </span>
    ),
  },
  {
    accessorKey: 'dueAt',
    header: 'Due',
    cell: ({ row }) => {
      const due = row.original.dueAt;
      if (!due) return <span className="text-muted-foreground">—</span>;
      const dueDate = new Date(due);
      const isOverdue = dueDate < new Date();
      return (
        <span
          className={
            isOverdue
              ? 'font-medium text-red-600'
              : 'text-muted-foreground'
          }
        >
          {format(dueDate, 'PP')}
        </span>
      );
    },
  },
];
