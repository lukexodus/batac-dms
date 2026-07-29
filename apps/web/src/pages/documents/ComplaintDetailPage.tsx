/**
 * ComplaintDetailPage — /complaints/:complaintId
 *
 * Route component for the Citizen Complaint Detail view (TASK-FE-DOCS-003).
 *
 * Read via `documents.getComplaint` — NOTE: fe.md's TASK-PRE-01 entry and this
 * task's own spec both describe the procedure as `complaints.get`, but the real,
 * already-shipped procedure in complaints.router.ts is named `getComplaint`
 * (flat-merged into the `documents` router alongside `listAllComplaints`, to
 * avoid a name collision in the merged namespace — same rationale documented
 * inline above `getComplaint` in the router file). TASK-PRE-01's functional
 * spec (input/output shape, ABAC condition) is otherwise implemented exactly
 * as described; only the name differs. See this session's findings-log entry.
 *
 * Callable-by roles: sp_secretary, sp_presiding_officer, auditor (unconditional
 * read); sp_member (committee-scoped read — same condition as enterCommitteeReport).
 * All role/committee enforcement for the read itself happens server-side in
 * `getComplaint`; this page does not attempt to replicate it before firing the
 * query (there is no committee-scoped route guard here, matching the pattern
 * documents.get / DocumentDetailPage.tsx uses — the query itself is the guard,
 * and a FORBIDDEN/NOT_FOUND response renders the existing not-found state).
 *
 * Committee-scoped VISIBILITY of the enterCommitteeReport control:
 * The frontend AuthSession now carries `committeeIds` (surfaced from the
 * backend's JWT claims — see LOG-0085 resolution). The `canEnterCommitteeReport`
 * helper below performs the real client-side check: sp_secretary sees the
 * control unconditionally; sp_member sees it only when their committeeIds
 * include the complaint's assignedOfficeId.
 */

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';

import {
  StatusBadge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Textarea,
  Label,
  Input,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@batac/ui';

import { hasRole } from '../../lib/auth-helpers';
import { trpc } from '../../lib/trpc';

import type { DocumentState } from '@batac/ui/types/domain';

import { useSessionStore, type ActiveUserIdentity } from '@/stores';

// ─── ABAC role helpers ──────────────────────────────────────────────────────
// Each helper corresponds to a specific procedure's callable-by list, matching
// the local canX(roles, ...) + hasRole() pattern established in
// DocumentDetailPage.tsx. hasRole() itself is the shared apps/web/src/lib/
// auth-helpers.ts implementation — not reimplemented here.

/** documents.logAndAssign: callable-by sp_secretary only */
function canLogAndAssign(identity: ActiveUserIdentity | null): boolean {
  return hasRole(identity, 'sp_secretary');
}

/**
 * documents.enterCommitteeReport: callable-by sp_secretary unconditionally, or
 * sp_member if their committeeIds include the complaint's assignedOfficeId.
 * The sp_member committee-membership check is now performed client-side using
 * the session's committeeIds (surfaced from the backend via LOG-0085).
 */
function canEnterCommitteeReport(
  identity: ActiveUserIdentity | null,
  committeeIds: string[],
  assignedOfficeId: string | null,
): boolean {
  if (hasRole(identity, 'sp_secretary')) return true;
  if (!hasRole(identity, 'sp_member')) return false;
  return !!assignedOfficeId && committeeIds.includes(assignedOfficeId);
}

/**
 * documents.setOutcome: callable-by sp_secretary only. Additionally gated here
 * on a committee report already existing — this is a client-side UX guard only:
 * setOutcome's real implementation does not itself enforce this ordering as a
 * precondition (confirmed by direct read of complaints.router.ts's setOutcome),
 * so this check prevents a confusing premature action rather than closing a
 * security gap.
 */
function canSetOutcome(
  identity: ActiveUserIdentity | null,
  committeeReport: string | null,
): boolean {
  if (!hasRole(identity, 'sp_secretary')) return false;
  return !!committeeReport && committeeReport.trim().length > 0;
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ComplaintDetailPage() {
  const { complaintId } = useParams<{ complaintId: string }>();
  const identity = useSessionStore((s) => s.identity);
  const roles = identity?.roleCodes ?? [];

  // ── Read: documents.getComplaint ────────────────────────────────────────
  const {
    data: complaint,
    isLoading,
    isError,
    refetch: refetchComplaint,
  } = trpc.documents.getComplaint.useQuery(
    { complaintId: complaintId! },
    { enabled: !!complaintId },
  );

  // ── Log and Assign dialog state ─────────────────────────────────────────
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignedOfficeId, setAssignedOfficeId] = useState('');
  const [routingNotes, setRoutingNotes] = useState('');

  const logAndAssignMutation = trpc.documents.logAndAssign.useMutation({
    onSuccess: () => {
      toast.success('Complaint logged and assigned');
      setShowAssignDialog(false);
      setAssignedOfficeId('');
      setRoutingNotes('');
      void refetchComplaint();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Enter Committee Report state ────────────────────────────────────────
  const [reportText, setReportText] = useState('');

  const enterCommitteeReportMutation = trpc.documents.enterCommitteeReport.useMutation({
    onSuccess: () => {
      toast.success('Committee report submitted');
      setReportText('');
      void refetchComplaint();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Set Outcome dialog state ────────────────────────────────────────────
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [outcome, setOutcome] = useState<'dismissed' | 'resolved' | ''>('');
  const [notifyRespondentVia, setNotifyRespondentVia] = useState<'contact_number' | 'email' | ''>(
    '',
  );

  const setOutcomeMutation = trpc.documents.setOutcome.useMutation({
    onSuccess: () => {
      toast.success('Outcome recorded');
      setShowOutcomeDialog(false);
      setOutcome('');
      setNotifyRespondentVia('');
      void refetchComplaint();
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Loading / error states ──────────────────────────────────────────────
  if (!complaintId) {
    return (
      <div className="container py-8">
        <p className="text-danger-600">Invalid complaint URL — no complaint ID provided.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl space-y-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !complaint) {
    return (
      <div className="container space-y-4 py-8">
        <p className="text-danger-600">
          Complaint not found or you do not have permission to view it.
        </p>
        <Link to="/complaints" className="text-primary underline">
          ← Back to Complaints
        </Link>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const OUTCOME_TO_DOCUMENT_STATE = {
    pending_hearing: 'PENDING_HEARING',
    received_seen: 'RECEIVED_SEEN',
    dismissed: 'DISMISSED',
    resolved: 'RESOLVED',
  } as const satisfies Record<string, DocumentState>;

  const docState = OUTCOME_TO_DOCUMENT_STATE[complaint.outcomeState];
  const respondent = complaint.respondent;
  const incidentDetails = complaint.incidentDetails;

  const handleLogAndAssign = () => {
    if (!assignedOfficeId.trim()) return;
    logAndAssignMutation.mutate({
      complaintId,
      assignedOfficeId: assignedOfficeId.trim(),
      routingNotes: routingNotes.trim() || undefined,
    });
  };

  const handleEnterCommitteeReport = () => {
    if (!reportText.trim()) return;
    enterCommitteeReportMutation.mutate({
      complaintId,
      reportText: reportText.trim(),
    });
  };

  const handleSetOutcome = () => {
    if (!outcome || !notifyRespondentVia) return;
    setOutcomeMutation.mutate({
      complaintId,
      outcome,
      notifyRespondentVia,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      {/* ── Breadcrumb ── */}
      <div className="text-text-muted text-sm">
        <Link to="/complaints" className="text-primary hover:underline">
          Complaints
        </Link>
        <span className="mx-2">›</span>
        <span>{complaint.subjectMatter}</span>
      </div>

      {/* ── Header card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="truncate text-xl leading-tight font-semibold">
                {complaint.subjectMatter}
              </CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge state={docState} />
                {complaint.assignedOfficeId && (
                  <Badge variant="outline" className="font-mono text-xs">
                    Assigned: {complaint.assignedOfficeId}
                  </Badge>
                )}
                <span className="text-text-muted text-xs">
                  Logged {new Date(complaint.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Complaint details ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Complaint Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {incidentDetails?.narrative && (
            <div>
              <p className="text-text-muted mb-1 text-xs font-medium">Incident Narrative</p>
              <p className="text-sm whitespace-pre-wrap">{incidentDetails.narrative}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-6">
            {incidentDetails?.date && (
              <div>
                <p className="text-text-muted text-xs font-medium">Date</p>
                <p className="text-sm">{incidentDetails.date}</p>
              </div>
            )}
            {incidentDetails?.place && (
              <div>
                <p className="text-text-muted text-xs font-medium">Place</p>
                <p className="text-sm">{incidentDetails.place}</p>
              </div>
            )}
          </div>
          {respondent?.name && (
            <div>
              <p className="text-text-muted mb-1 text-xs font-medium">Respondent</p>
              <p className="text-sm">{respondent.name}</p>
              {respondent.contactNumber && (
                <p className="text-text-muted text-xs">{respondent.contactNumber}</p>
              )}
              {respondent.email && <p className="text-text-muted text-xs">{respondent.email}</p>}
            </div>
          )}
          {complaint.routingDecision && (
            <div>
              <p className="text-text-muted mb-1 text-xs font-medium">Routing Notes</p>
              <p className="text-sm whitespace-pre-wrap">{complaint.routingDecision}</p>
            </div>
          )}
          {complaint.committeeReport && (
            <div>
              <p className="text-text-muted mb-1 text-xs font-medium">Committee Report</p>
              <p className="text-sm whitespace-pre-wrap">{complaint.committeeReport}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {/* Log and Assign — sp_secretary only */}
            {canLogAndAssign(identity) && (
              <Button
                size="sm"
                onClick={() => setShowAssignDialog(true)}
                disabled={logAndAssignMutation.isPending}
              >
                Log and Assign
              </Button>
            )}

            {/* Set Outcome — sp_secretary only, enabled once a committee report exists */}
            {hasRole(identity, 'sp_secretary') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowOutcomeDialog(true)}
                disabled={
                  !canSetOutcome(identity, complaint.committeeReport) ||
                  setOutcomeMutation.isPending
                }
                title={
                  !complaint.committeeReport
                    ? 'A committee report must be entered before setting an outcome'
                    : undefined
                }
              >
                Set Outcome
              </Button>
            )}
          </div>

          {/* Log and Assign inline form */}
          {showAssignDialog && canLogAndAssign(identity) && (
            <div className="space-y-3 rounded-md border bg-neutral-50 p-4">
              <p className="text-sm font-medium">Log and Assign</p>
              <div className="space-y-1">
                <Label htmlFor="assigned-office-id">Assigned Office ID (required)</Label>
                <Input
                  id="assigned-office-id"
                  value={assignedOfficeId}
                  onChange={(e) => setAssignedOfficeId(e.target.value)}
                  placeholder="Committee / office UUID"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="routing-notes">Routing Notes (optional)</Label>
                <Textarea
                  id="routing-notes"
                  value={routingNotes}
                  onChange={(e) => setRoutingNotes(e.target.value)}
                  placeholder="Any notes about this routing decision"
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleLogAndAssign}
                  disabled={!assignedOfficeId.trim() || logAndAssignMutation.isPending}
                >
                  {logAndAssignMutation.isPending ? 'Submitting…' : 'Confirm'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAssignDialog(false);
                    setAssignedOfficeId('');
                    setRoutingNotes('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Enter Committee Report — sp_secretary unconditionally, sp_member
              committee-scoped (client-side check via identity.committeeIds) */}
          {canEnterCommitteeReport(
            identity,
            identity?.committeeIds ?? [],
            complaint.assignedOfficeId,
          ) && (
            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">Enter Committee Report</p>
              <Textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Committee findings and recommendation"
                className="min-h-[100px]"
              />
              <Button
                size="sm"
                onClick={handleEnterCommitteeReport}
                disabled={!reportText.trim() || enterCommitteeReportMutation.isPending}
              >
                {enterCommitteeReportMutation.isPending ? 'Submitting…' : 'Submit Report'}
              </Button>
            </div>
          )}

          {/* Set Outcome inline form */}
          {showOutcomeDialog && hasRole(identity, 'sp_secretary') && (
            <div className="space-y-3 rounded-md border bg-neutral-50 p-4">
              <p className="text-sm font-medium">Set Outcome</p>
              <div className="space-y-1">
                <Label htmlFor="outcome-select">Outcome (required)</Label>
                <Select
                  value={outcome}
                  onValueChange={(v) => setOutcome(v as 'dismissed' | 'resolved')}
                >
                  <SelectTrigger id="outcome-select">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="notify-select">Notify Respondent Via (required)</Label>
                <Select
                  value={notifyRespondentVia}
                  onValueChange={(v) => setNotifyRespondentVia(v as 'contact_number' | 'email')}
                >
                  <SelectTrigger id="notify-select">
                    <SelectValue placeholder="Select notification channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact_number">Contact Number</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSetOutcome}
                  disabled={!outcome || !notifyRespondentVia || setOutcomeMutation.isPending}
                >
                  {setOutcomeMutation.isPending ? 'Submitting…' : 'Confirm Outcome'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowOutcomeDialog(false);
                    setOutcome('');
                    setNotifyRespondentVia('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
