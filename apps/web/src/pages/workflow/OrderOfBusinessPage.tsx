/**
 * OrderOfBusinessPage — /order-of-business
 *
 * View roles : sp_secretary, sp_member, sp_presiding_officer, mayor, auditor
 * Manage roles: sp_secretary only
 *
 * Procedures used:
 *   session.getOrderOfBusiness           (query)
 *   session.scheduleDocumentForFirstReading (mutation, sp_secretary)
 *   session.enterCommitteeHearingDate       (mutation, sp_secretary)
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
 cn } from '@batac/ui';

import type { RouterOutputs } from '@/lib/trpc';

import { useAuth } from '@/lib/auth-context';
import { hasRole } from '@/lib/auth-helpers';
import { trpc } from '@/lib/trpc';

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
  const { session } = useAuth();
  const roleCodes = session?.roleCodes ?? [];

  if (!hasRole(roleCodes, ...VIEW_ROLES)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-text-muted">
        You do not have permission to view this page.
      </div>
    );
  }

  const isSecretary = hasRole(roleCodes, ...MANAGE_ROLES);

  return <OrderOfBusinessContent isSecretary={isSecretary} />;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function OrderOfBusinessContent({ isSecretary }: { isSecretary: boolean }) {
  // Optional date picker state; undefined = let server default to next Tuesday
  const [selectedDate, setSelectedDate] = useState<string>('');

  const queryInput = selectedDate
    ? { sessionDate: new Date(selectedDate) }
    : {};

  const { data, isLoading, isError, refetch } =
    trpc.session.getOrderOfBusiness.useQuery(queryInput);

  const redFlagged = data?.items.filter(
    (i) => i.committeeReportStatus === 'red_flagged',
  ) ?? [];

  const allSubmitted = data?.items.filter(
    (i) => i.committeeReportStatus === 'all_submitted',
  ) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* ─── Page header ─── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary-500" />
          Order of Business
        </h1>
        <p className="text-sm text-text-muted">
          Agenda items scheduled for the upcoming SP session.
        </p>
      </div>

      {/* ─── Date picker ─── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="oob-date-picker" className="text-xs text-text-muted">
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
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate('')}
              >
                Reset to next Tuesday
              </Button>
            )}
            <div className="ml-auto text-xs text-text-muted italic">
              {!selectedDate && 'Defaulting to next scheduled session (next Tuesday).'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Summary strip ─── */}
      {!isLoading && data && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-text-secondary">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(data.sessionDate).toLocaleDateString('en-PH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-text-secondary">
            {data.items.length} item{data.items.length !== 1 ? 's' : ''}
          </div>
          {allSubmitted.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-success-100 px-3 py-1 text-xs font-medium text-success-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {allSubmitted.length} reports ready
            </div>
          )}
          {redFlagged.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-danger-100 px-3 py-1 text-xs font-medium text-danger-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              {redFlagged.length} red-flagged
            </div>
          )}
        </div>
      )}

      {/* ─── Item list ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-text-primary">
            Agenda Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 flex items-center gap-2 text-sm text-danger-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Failed to load order of business. Please try again.
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              heading="No agenda items"
              body="No documents are scheduled for this session."
            />
          ) : (
            <div className="divide-y divide-neutral-100">
              {data.items.map((item, idx) => (
                <OobItemRow
                  key={item.documentId}
                  item={item}
                  agendaNumber={idx + 1}
                  isSecretary={isSecretary}
                  sessionDate={new Date(data.sessionDate)}
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
  sessionDate: Date;
  onMutationSuccess: () => void;
}

function OobItemRow({
  item,
  agendaNumber,
  isSecretary,
  sessionDate,
  onMutationSuccess,
}: OobItemRowProps) {
  const [expanded, setExpanded] = useState(false);

  const isRedFlagged = item.committeeReportStatus === 'red_flagged';
  const isAllSubmitted = item.committeeReportStatus === 'all_submitted';

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
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Agenda number */}
        <span className="font-mono text-sm text-text-muted w-7 shrink-0">
          {agendaNumber}.
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-medium truncate',
              isRedFlagged ? 'text-danger-800' : 'text-text-primary',
            )}
            title={item.title}
          >
            {item.title}
          </p>
          {item.preliminaryNumber && (
            <p className="text-xs text-text-muted mt-0.5">
              Preliminary #{item.preliminaryNumber}
            </p>
          )}
        </div>

        {/* Committee report status badge */}
        <CommitteeStatusBadge status={item.committeeReportStatus} />

        {/* Red flag icon */}
        {isRedFlagged && (
          <Flag
            className="h-4 w-4 text-danger-500 shrink-0"
            aria-label="Missing or pending committee report — red flagged"
          />
        )}

        {/* Expand chevron */}
        <span className="shrink-0 text-text-muted">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Assigned committees */}
          {item.assignedCommittees.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                Assigned Committees
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.assignedCommittees.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="text-xs"
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Secretary-only actions */}
          {isSecretary && (
            <SecretaryItemActions
              item={item}
              sessionDate={sessionDate}
              onSuccess={onMutationSuccess}
            />
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
      <span className="flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-800 shrink-0">
        <CheckCircle2 className="h-3 w-3" />
        Reports ready
      </span>
    );
  }
  if (status === 'red_flagged') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-danger-100 px-2 py-0.5 text-xs font-medium text-danger-800 shrink-0">
        <AlertTriangle className="h-3 w-3" />
        Red flagged
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 shrink-0">
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
  sessionDate: Date;
  onSuccess: () => void;
}) {
  const [hearingDateDialogOpen, setHearingDateDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2 pt-1 border-t border-neutral-100">
      <Button
        id={`btn-hearing-date-${item.documentId}`}
        variant="outline"
        size="sm"
        className="text-xs gap-1.5"
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
          className="text-xs gap-1.5 border-danger-200 text-danger-700 hover:bg-danger-50"
          onClick={() => setAdvanceDialogOpen(true)}
        >
          <ArrowRightCircle className="h-3.5 w-3.5" />
          Manually Advance Step
        </Button>
      )}

      <EnterHearingDateDialog
        open={hearingDateDialogOpen}
        onClose={() => setHearingDateDialogOpen(false)}
        documentTitle={item.title}
        onSuccess={onSuccess}
      />

      <ManuallyAdvanceDialog
        open={advanceDialogOpen}
        onClose={() => setAdvanceDialogOpen(false)}
        documentTitle={item.title}
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
  onSuccess: () => void;
}

function EnterHearingDateDialog({
  open,
  onClose,
  documentTitle,
  onSuccess,
}: EnterHearingDateDialogProps) {
  const [stepInstanceId, setStepInstanceId] = useState('');
  const [hearingDate, setHearingDate] = useState('');

  const mutation = trpc.session.enterCommitteeHearingDate.useMutation({
    onSuccess() {
      toast.success('Hearing date updated successfully.');
      setStepInstanceId('');
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
    if (!stepInstanceId.trim()) {
      toast.error('Step Instance ID is required.');
      return;
    }
    mutation.mutate({
      stepInstanceId,
      // Send null explicitly when clearing, per acceptance criteria
      hearingDate: hearingDate ? new Date(hearingDate) : null,
    });
  }

  function handleClearDate() {
    if (!stepInstanceId.trim()) {
      toast.error('Step Instance ID is required.');
      return;
    }
    mutation.mutate({
      stepInstanceId,
      hearingDate: null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary-500" />
            Enter Committee Hearing Date
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-text-muted -mt-2 mb-2 truncate" title={documentTitle}>
          Document: <span className="font-medium text-text-primary">{documentTitle}</span>
        </p>

        <form id="hearing-date-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hearing-step-instance-id" className="text-xs">
              Step Instance ID <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="hearing-step-instance-id"
              placeholder="UUID of the active multi-referral step instance"
              value={stepInstanceId}
              onChange={(e) => setStepInstanceId(e.target.value)}
              required
            />
            <p className="text-xs text-text-muted">
              Find this in the workflow step action page for this document.
            </p>
          </div>

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
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          {hearingDate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDate}
              disabled={mutation.isPending || !stepInstanceId.trim()}
              className="border-neutral-200"
            >
              Clear Date
            </Button>
          )}
          <Button
            form="hearing-date-form"
            type="submit"
            size="sm"
            disabled={mutation.isPending || !stepInstanceId.trim()}
          >
            {mutation.isPending ? 'Saving…' : 'Save Hearing Date'}
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
  onSuccess: () => void;
}

function ManuallyAdvanceDialog({
  open,
  onClose,
  documentTitle,
  onSuccess,
}: ManuallyAdvanceDialogProps) {
  const [stepInstanceId, setStepInstanceId] = useState('');
  const [mandatoryComment, setMandatoryComment] = useState('');

  // workflow.manuallyAdvanceMultiReferralStep lives in the workflow router (not session)
  const mutation = trpc.workflow.manuallyAdvanceMultiReferralStep.useMutation({
    onSuccess() {
      toast.success('Step manually advanced. The workflow has moved forward.');
      setStepInstanceId('');
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
    if (!stepInstanceId.trim()) {
      toast.error('Step Instance ID is required.');
      return;
    }
    if (!mandatoryComment.trim()) {
      toast.error('A mandatory comment is required for audit purposes.');
      return;
    }
    mutation.mutate({ stepInstanceId, mandatoryComment });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-danger-700">
            <ArrowRightCircle className="h-4 w-4" />
            Manually Advance Multi-Referral Step
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-text-muted -mt-2 mb-1 truncate" title={documentTitle}>
          Document: <span className="font-medium text-text-primary">{documentTitle}</span>
        </p>

        <div className="rounded-md bg-warning-50 border border-warning-200 px-3 py-2 text-xs text-warning-800 flex items-start gap-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            This override advances the workflow even though not all committee reports have
            been submitted. A mandatory comment is required for audit purposes.
          </span>
        </div>

        <form id="advance-step-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="advance-step-instance-id" className="text-xs">
              Step Instance ID <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="advance-step-instance-id"
              placeholder="UUID of the active multi-referral step instance"
              value={stepInstanceId}
              onChange={(e) => setStepInstanceId(e.target.value)}
              required
            />
          </div>

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
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            form="advance-step-form"
            type="submit"
            size="sm"
            variant="destructive"
            disabled={
              mutation.isPending ||
              !stepInstanceId.trim() ||
              !mandatoryComment.trim()
            }
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
  const [documentId, setDocumentId] = useState('');
  const [targetDate, setTargetDate] = useState(
    sessionDate
      ? sessionDate.toISOString().substring(0, 10)
      : '',
  );

  const mutation = trpc.session.scheduleDocumentForFirstReading.useMutation({
    onSuccess() {
      toast.success('Document scheduled for First Reading. The backend has resolved the actual session date.');
      setDocumentId('');
      onSuccess();
    },
    onError(err) {
      toast.error(`Failed to schedule document: ${err.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId.trim()) {
      toast.error('Document ID is required.');
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
        <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary-500" />
          Schedule Document for First Reading
          <Badge variant="secondary" className="text-xs ml-auto font-normal">
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
          <div className="flex flex-col gap-1.5 flex-1 min-w-48">
            <Label htmlFor="schedule-doc-id" className="text-xs">
              Document ID (UUID) <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="schedule-doc-id"
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              required
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
            <p className="text-xs text-text-muted">
              The server will snap to the next valid Tuesday.
            </p>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !documentId.trim() || !targetDate}
          >
            {mutation.isPending ? 'Scheduling…' : 'Schedule for First Reading'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
