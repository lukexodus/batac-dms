/**
 * OrderOfBusinessPage — /order-of-business
 *
 * View roles : sp_secretary, sp_member, sp_presiding_officer, mayor, auditor
 * Manage roles: sp_secretary only
 *
 * Procedures used:
 *   identity.getOrderOfBusiness           (query)
 *   identity.scheduleDocumentForFirstReading (mutation, sp_secretary)
 *   identity.enterCommitteeHearingDate       (mutation, sp_secretary)
 *   workflow.manuallyAdvanceMultiReferralStep (mutation, sp_secretary — different router)
 */

import {
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Flag,
  ChevronDown,
  ChevronUp,
  Calendar,
  ArrowRightCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  EmptyState,
  Button,
  Badge,
  Input,
  Label,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  cn,
} from '@batac/ui';


import type { RouterOutputs } from '@/lib/trpc';

import { DocumentPicker } from '@/components/DocumentPicker';
import { hasRole } from '@/lib/auth-helpers';
import { trpc } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

// ─── Role constants ───────────────────────────────────────────────────────────

const VIEW_ROLES = [
  'sp_secretary',
  'sp_member',
  'sp_presiding_officer',
  'mayor',
  'auditor',
] as const;

const MANAGE_ROLES = ['sp_secretary'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type OobItem = RouterOutputs['session']['getOrderOfBusiness']['items'][number];

// ─── Top-level page (gate) ────────────────────────────────────────────────────

export function OrderOfBusinessPage() {
  const identity = useSessionStore((s) => s.identity);

  if (!hasRole(identity, ...VIEW_ROLES)) {
    return (
      <div className="text-text-muted flex flex-col items-center justify-center p-8">
        You do not have permission to view this page.
      </div>
    );
  }

  const isSecretary = hasRole(identity, ...MANAGE_ROLES);

  return <OrderOfBusinessContent isSecretary={isSecretary} />;
}

function getNextTuesdayFormatted(now: Date = new Date()): string {
  const phtTime = new Date(now.getTime() + 8 * 3600 * 1000);
  let daysToTuesday = 2 - phtTime.getUTCDay();
  if (daysToTuesday < 0) daysToTuesday += 7;
  phtTime.setUTCDate(phtTime.getUTCDate() + daysToTuesday);
  const y = phtTime.getUTCFullYear();
  const m = String(phtTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(phtTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function OrderOfBusinessContent({ isSecretary }: { isSecretary: boolean }) {
  const defaultDate = getNextTuesdayFormatted();
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  const queryInput = selectedDate ? { sessionDate: new Date(selectedDate) } : {};

  const { data, isLoading, isError, refetch } =
    trpc.session.getOrderOfBusiness.useQuery(queryInput);

  const redFlagged = data?.items.filter((i) => i.committeeReportStatus === 'red_flagged') ?? [];

  const allSubmitted = data?.items.filter((i) => i.committeeReportStatus === 'all_submitted') ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      {/* ─── Page header ─── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-text-primary flex items-center gap-2 text-2xl font-bold">
          <CalendarDays className="text-primary-500 h-6 w-6" />
          Order of Business
        </h1>
        <p className="text-text-muted text-sm">
          Agenda items scheduled for the upcoming SP identity.
        </p>
      </div>

      {/* ─── Date picker ─── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="oob-date-picker" className="text-text-muted text-xs">
                Session Date
              </Label>
              <Input
                id="oob-date-picker"
                type="date"
                className="w-44"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            {selectedDate !== defaultDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(defaultDate)}>
                Reset to next Tuesday
              </Button>
            )}
            <div className="text-text-muted ml-auto text-xs italic">
              {selectedDate === defaultDate && 'Defaulting to scheduled session (Tuesday).'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Summary strip ─── */}
      {!isLoading && data && (
        <div className="flex flex-wrap gap-3">
          <div className="text-text-secondary flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(data.sessionDate).toLocaleDateString('en-PH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <div className="text-text-secondary flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
            {data.items.length} item{data.items.length !== 1 ? 's' : ''}
          </div>
          {allSubmitted.length > 0 && (
            <div className="bg-success-100 text-success-800 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {allSubmitted.length} reports ready
            </div>
          )}
          {redFlagged.length > 0 && (
            <div className="bg-danger-100 text-danger-800 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {redFlagged.length} red-flagged
            </div>
          )}
        </div>
      )}

      {/* ─── Item list ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-text-primary text-sm font-semibold">Agenda Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-3">
          {isLoading ? (
            <div className="space-y-2 px-6 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-danger-600 flex items-center gap-2 p-6 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Failed to load order of business. Please try again.
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              heading="No agenda items"
              body="No documents are scheduled for this identity."
            />
          ) : (
            <div className="divide-y divide-neutral-100">
              {data.items.map((item, idx) => (
                <OobItemRow
                  key={item.documentId}
                  item={item}
                  agendaNumber={idx + 1}
                  isSecretary={isSecretary}
                  sessionDate={data.sessionDate}
                  onMutationSuccess={() => void refetch()}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Secretary quick-schedule panel ─── */}
      {isSecretary && (
        <ScheduleForFirstReadingPanel
          {...(data ? { sessionDate: new Date(data.sessionDate) } : {})}
          onSuccess={() => void refetch()}
        />
      )}
    </div>
  );
}

// ─── OobItemRow ───────────────────────────────────────────────────────────────

interface OobItemRowProps {
  item: OobItem;
  agendaNumber: number;
  isSecretary: boolean;
  sessionDate: Date | string;
  onMutationSuccess: () => void;
}

function OobItemRow({ item, agendaNumber, isSecretary, sessionDate, onMutationSuccess }: OobItemRowProps) {
  const [expanded, setExpanded] = useState(false);

  const isRedFlagged = item.committeeReportStatus === 'red_flagged';

  return (
    <div
      className={cn(
        'transition-colors',
        isRedFlagged ? 'bg-danger-50' : 'bg-white hover:bg-neutral-50',
      )}
    >
      {/* ── Main row ── */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-6 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Agenda number */}
        <span className="text-text-muted w-7 shrink-0 font-mono text-sm">{agendaNumber}.</span>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium',
              isRedFlagged ? 'text-danger-800' : 'text-text-primary',
            )}
            title={item.title}
          >
            {item.title}
          </p>
          {item.preliminaryNumber && (
            <p className="text-text-muted mt-0.5 text-xs">Preliminary #{item.preliminaryNumber}</p>
          )}
        </div>

        {/* Committee report status badge */}
        <CommitteeStatusBadge status={item.committeeReportStatus} />

        {/* Red flag icon */}
        {isRedFlagged && (
          <Flag
            className="text-danger-500 h-4 w-4 shrink-0"
            aria-label="Missing or pending committee report — red flagged"
          />
        )}

        {/* Expand chevron */}
        <span className="text-text-muted shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="space-y-4 px-6 pb-4">
          {/* Assigned committees */}
          {item.assignedCommittees.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-text-muted text-xs font-semibold tracking-wide uppercase">
                Assigned Committees
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.assignedCommittees.map((name) => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Secretary-only actions */}
          {isSecretary && (
            <SecretaryItemActions item={item} sessionDate={sessionDate} onSuccess={onMutationSuccess} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── CommitteeStatusBadge ─────────────────────────────────────────────────────

function CommitteeStatusBadge({
  status,
}: {
  status: 'not_applicable' | 'all_submitted' | 'red_flagged';
}) {
  if (status === 'all_submitted') {
    return (
      <span className="bg-success-100 text-success-800 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" />
        Reports ready
      </span>
    );
  }
  if (status === 'red_flagged') {
    return (
      <span className="bg-danger-100 text-danger-800 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
        <AlertTriangle className="h-3 w-3" />
        Red flagged
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
      <MinusCircle className="h-3 w-3" />
      N/A
    </span>
  );
}

// ─── SecretaryItemActions ─────────────────────────────────────────────────────

/**
 * Renders the secretary-only mutation actions for an individual OOB item.
 * - Enter committee hearing date (stepInstanceId needed — shown as a form field the secretary provides)
 * - Manually advance multi-referral step (only for red_flagged items, requires mandatory comment)
 *
 * Note: stepInstanceId is not returned by getOrderOfBusiness — the secretary
 * must supply it from the workflow instance. We render an input to capture it.
 * The backend will validate it exists and belongs to the document.
 */
function SecretaryItemActions({
  item,
  sessionDate,
  onSuccess,
}: {
  item: OobItem;
  sessionDate: Date | string;
  onSuccess: () => void;
}) {
  const [hearingDateDialogOpen, setHearingDateDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-1">
      <Button
        id={`btn-hearing-date-${item.documentId}`}
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setHearingDateDialogOpen(true)}
      >
        <Calendar className="h-3.5 w-3.5" />
        Enter Hearing Date
      </Button>

      {item.committeeReportStatus === 'red_flagged' && (
        <Button
          id={`btn-advance-${item.documentId}`}
          variant="outline"
          size="sm"
          className="border-danger-200 text-danger-700 hover:bg-danger-50 gap-1.5 text-xs"
          onClick={() => setAdvanceDialogOpen(true)}
        >
          <ArrowRightCircle className="h-3.5 w-3.5" />
          Manually Advance Step
        </Button>
      )}

      <Button
        id={`btn-remove-${item.documentId}`}
        variant="destructive"
        size="sm"
        className="ml-auto gap-1.5 text-xs"
        onClick={() => setRemoveDialogOpen(true)}
      >
        <MinusCircle className="h-3.5 w-3.5" />
        Remove from Agenda
      </Button>

      <EnterHearingDateDialog
        open={hearingDateDialogOpen}
        onClose={() => setHearingDateDialogOpen(false)}
        documentTitle={item.title}
        stepInstanceId={item.stepInstanceId}
        onSuccess={onSuccess}
      />

      <ManuallyAdvanceDialog
        open={advanceDialogOpen}
        onClose={() => setAdvanceDialogOpen(false)}
        documentTitle={item.title}
        stepInstanceId={item.stepInstanceId}
        onSuccess={onSuccess}
      />

      <RemoveFromAgendaDialog
        open={removeDialogOpen}
        onClose={() => setRemoveDialogOpen(false)}
        documentId={item.documentId}
        documentTitle={item.title}
        sessionDate={sessionDate}
        workflowInstanceId={item.workflowInstanceId}
        onSuccess={onSuccess}
      />
    </div>
  );
}

// ─── EnterHearingDateDialog ───────────────────────────────────────────────────

interface EnterHearingDateDialogProps {
  open: boolean;
  onClose: () => void;
  documentTitle: string;
  stepInstanceId: string | null;
  onSuccess: () => void;
}

function EnterHearingDateDialog({
  open,
  onClose,
  documentTitle,
  stepInstanceId,
  onSuccess,
}: EnterHearingDateDialogProps) {
  const [hearingDate, setHearingDate] = useState('');

  const mutation = trpc.session.enterCommitteeHearingDate.useMutation({
    onSuccess() {
      toast.success('Hearing date updated successfully.');
      setHearingDate('');
      onClose();
      onSuccess();
    },
    onError(err) {
      toast.error(`Failed to update hearing date: ${err.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stepInstanceId) {
      toast.error('A step instance must be selected.');
      return;
    }
    mutation.mutate({
      stepInstanceId,
      // Send null explicitly when clearing, per acceptance criteria
      hearingDate: hearingDate ? new Date(hearingDate) : null,
    });
  }

  function handleClearDate() {
    if (!stepInstanceId) {
      toast.error('A step instance must be selected.');
      return;
    }
    mutation.mutate({
      stepInstanceId,
      hearingDate: null,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="text-primary-500 h-4 w-4" />
            Enter Committee Hearing Date
          </DialogTitle>
        </DialogHeader>

        <p className="text-text-muted -mt-2 mb-2 truncate text-xs" title={documentTitle}>
          Document: <span className="text-text-primary font-medium">{documentTitle}</span>
        </p>

        <form id="hearing-date-form" onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-1.5">
            <Label htmlFor="hearing-date-input" className="text-xs">
              Hearing Date{' '}
              <span className="text-text-muted font-normal">(leave blank to clear)</span>
            </Label>
            <Input
              id="hearing-date-input"
              type="date"
              value={hearingDate}
              onChange={(e) => setHearingDate(e.target.value)}
            />
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          {hearingDate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDate}
              disabled={mutation.isPending || !stepInstanceId}
              className="border-neutral-200"
            >
              Clear Date
            </Button>
          )}
          <Button
            form="hearing-date-form"
            type="submit"
            size="sm"
            disabled={mutation.isPending || !stepInstanceId}
          >
            {mutation.isPending ? 'Saving…' : 'Save Hearing Date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── RemoveFromAgendaDialog ───────────────────────────────────────────────────

interface RemoveFromAgendaDialogProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  sessionDate: Date | string;
  workflowInstanceId: string | null;
  onSuccess: () => void;
}

function RemoveFromAgendaDialog({
  open,
  onClose,
  documentId,
  documentTitle,
  sessionDate,
  workflowInstanceId,
  onSuccess,
}: RemoveFromAgendaDialogProps) {
  const navigate = useNavigate();
  const mutation = trpc.session.removeFromOrderOfBusiness.useMutation({
    onSuccess() {
      toast.success('Item removed from the agenda.', {
        action: workflowInstanceId
          ? {
              label: 'View in My Tasks',
              onClick: () => navigate(`/workflow/steps/${workflowInstanceId}`),
            }
          : undefined,
      });
      onClose();
      onSuccess();
    },
    onError(err) {
      toast.error(`Failed to remove item: ${err.message}`);
    },
  });

  function handleConfirm() {
    mutation.mutate({
      documentId,
      sessionDate: new Date(sessionDate),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MinusCircle className="text-danger-500 h-4 w-4" />
            Remove from Agenda
          </DialogTitle>
        </DialogHeader>

        <p className="text-text-secondary text-sm">
          Remove <span className="text-text-primary font-medium">{documentTitle}</span> from
          this session&apos;s Order of Business? This only removes the agenda entry — it does
          not change the document&apos;s current workflow step.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ManuallyAdvanceDialog ────────────────────────────────────────────────────

interface ManuallyAdvanceDialogProps {
  open: boolean;
  onClose: () => void;
  documentTitle: string;
  stepInstanceId: string | null;
  onSuccess: () => void;
}

function ManuallyAdvanceDialog({
  open,
  onClose,
  documentTitle,
  stepInstanceId,
  onSuccess,
}: ManuallyAdvanceDialogProps) {
  const [mandatoryComment, setMandatoryComment] = useState('');

  // workflow.manuallyAdvanceMultiReferralStep lives in the workflow router (not session)
  const mutation = trpc.workflow.manuallyAdvanceMultiReferralStep.useMutation({
    onSuccess() {
      toast.success('Step manually advanced. The workflow has moved forward.');
      setMandatoryComment('');
      onClose();
      onSuccess();
    },
    onError(err) {
      toast.error(`Failed to advance step: ${err.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stepInstanceId) {
      toast.error('A step instance must be selected.');
      return;
    }
    if (!mandatoryComment.trim()) {
      toast.error('A mandatory comment is required for audit purposes.');
      return;
    }
    mutation.mutate({ stepInstanceId, mandatoryComment });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-danger-700 flex items-center gap-2">
            <ArrowRightCircle className="h-4 w-4" />
            Manually Advance Multi-Referral Step
          </DialogTitle>
        </DialogHeader>

        <p className="text-text-muted -mt-2 mb-1 truncate text-xs" title={documentTitle}>
          Document: <span className="text-text-primary font-medium">{documentTitle}</span>
        </p>

        <div className="bg-warning-50 border-warning-200 text-warning-800 mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This override advances the workflow even though not all committee reports have been
            submitted. A mandatory comment is required for audit purposes.
          </span>
        </div>

        <form id="advance-step-form" onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-1.5">
            <Label htmlFor="advance-mandatory-comment" className="text-xs">
              Mandatory Comment <span className="text-danger-500">*</span>
            </Label>
            <Textarea
              id="advance-mandatory-comment"
              rows={3}
              placeholder="Reason for manual override (required for audit log)…"
              value={mandatoryComment}
              onChange={(e) => setMandatoryComment(e.target.value)}
              required
              minLength={1}
            />
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            form="advance-step-form"
            type="submit"
            size="sm"
            variant="destructive"
            disabled={mutation.isPending || !stepInstanceId || !mandatoryComment.trim()}
          >
            {mutation.isPending ? 'Advancing…' : 'Override & Advance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ScheduleForFirstReadingPanel ─────────────────────────────────────────────

/**
 * Secretary-only panel: schedule any document (by its UUID) for First Reading
 * on a target session date. The backend snaps to the correct Tuesday and applies
 * Thursday-cutoff logic — the frontend does NOT pre-validate "must be a Tuesday".
 */
function ScheduleForFirstReadingPanel({
  sessionDate,
  onSuccess,
}: {
  sessionDate?: Date;
  onSuccess: () => void;
}) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(
    sessionDate ? sessionDate.toISOString().substring(0, 10) : '',
  );

  const mutation = trpc.session.scheduleDocumentForFirstReading.useMutation({
    onSuccess() {
      toast.success(
        'Document scheduled for First Reading. The backend has resolved the actual session date.',
      );
      setDocumentId(null);
      onSuccess();
    },
    onError(err) {
      toast.error(`Failed to schedule document: ${err.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId) {
      toast.error('A document must be selected.');
      return;
    }
    if (!targetDate) {
      toast.error('Session date is required.');
      return;
    }
    // Submit as-is; backend will snap to the correct Tuesday and apply cutoff logic
    mutation.mutate({
      documentId,
      sessionDate: new Date(targetDate),
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="text-primary-500 h-4 w-4" />
          Schedule Document for First Reading
          <Badge variant="secondary" className="ml-auto text-xs font-normal">
            SP Secretary only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          id="schedule-first-reading-form"
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-4"
        >
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label className="text-xs">
              Document <span className="text-danger-500">*</span>
            </Label>
            <DocumentPicker
              value={documentId}
              onChange={setDocumentId}
              lifecycleState="in_workflow"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-session-date" className="text-xs">
              Requested Session Date <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="schedule-session-date"
              type="date"
              className="w-44"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
            />
            <p className="text-text-muted text-xs">
              The server will snap to the next valid Tuesday.
            </p>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !documentId || !targetDate}
          >
            {mutation.isPending ? 'Scheduling…' : 'Schedule for First Reading'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
