/**
 * DocumentDetailPage — /documents/:documentId
 *
 * Route component for the Document Detail view. Composes six of the seven
 * F1 §7.3 procedure groups:
 *   Read, Lifecycle, Portal Visibility, File & OCR, Tracking, Workflow Link-out.
 *
 * The Records group ([SPEC-GAP-DOCS-023-01]) is entirely absent — no records.*
 * procedures, stubs, or disabled buttons exist on this page. A follow-up task
 * implementing the records.* router should add the Records action group here.
 *
 * Callable-by roles: records_officer, dept_encoder, dept_approver, sp_secretary,
 * sp_member, sp_presiding_officer, mayor, brgy_encoder, brgy_captain, auditor.
 * sys_admin is NOT in documents.get's callable-by list and must NOT reach this
 * page — sys_admin uses documents.getMetadataForAdmin from its own §13 area.
 *
 * Lifecycle state: uses the real 11-value enum (draft, submitted, in_workflow,
 * pending_mayor_action, pending_panlalawigan_review, completed, released,
 * archived, disposed, cancelled, superseded). The values under_review, approved,
 * and rejected do not exist in the real schema — see [SPEC GAP — DOCS-023-02].
 *
 * Secretariat decision: calls workflow.submitStepAction, not
 * documents.logSecretariatDecision (superseded per ADR-B2-3) —
 * [SPEC GAP — DOCS-023-03].
 */

import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Ban,
  EyeOff,
  FileText,
  Files,
  Globe,
  Hash,
  History,
  Printer,
  Route,
  Send,
  Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AllowedMimeTypeSchema, type AllowedMimeType } from '@batac/shared';
import {
  StatusBadge,
  WorkflowStepIndicator,
  RoutingHistoryTimeline,
  QRCodeDisplay,
  ScanQualityIndicator,
  DocumentNumberBadge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
  Label,
  Input,
  Badge,
} from '@batac/ui';
import { LogCertificationOfUrgencyDialog } from './dialogs/LogCertificationOfUrgencyDialog';
import { hasRole } from '../../lib/auth-helpers';

import type { WorkflowStep, RoutingEntry } from '@batac/ui';

import { useScanQualityPolling } from '@/hooks/useScanQualityPolling';
import { mapLifecycleStateToDocumentState } from '@/lib/status-mapping';
import { trpc, type RouterOutputs } from '@/lib/trpc';
import { useSessionStore, type ActiveUserIdentity } from '@/stores';

// ─── ABAC role helpers ──────────────────────────────────────────────────────
// Each helper corresponds to a specific procedure's callable-by list (sourced
// from the procedure definitions in the task spec and cross-referenced against
// E1). These are intentionally NOT the blanket 10-role page set.

/** documents.submit: callable-by dept_encoder, dept_approver, sp_secretary,
 *  sp_member, sp_presiding_officer, mayor, brgy_encoder, brgy_captain */
function canSubmit(identity: ActiveUserIdentity | null, lifecycleState: string): boolean {
  if (
    !hasRole(
      identity,
      'dept_encoder',
      'dept_approver',
      'sp_secretary',
      'sp_member',
      'sp_presiding_officer',
      'mayor',
      'brgy_encoder',
      'brgy_captain',
    )
  )
    return false;
  return lifecycleState === 'draft';
}

/** documents.assignPreliminaryNumber: callable-by sp_secretary only */
function canAssignPreliminaryNumber(
  identity: ActiveUserIdentity | null,
  lifecycleState: string,
  preliminaryNumber: string | null,
): boolean {
  if (!hasRole(identity, 'sp_secretary')) return false;
  return ['submitted', 'in_workflow'].includes(lifecycleState) && !preliminaryNumber;
}

/**
 * documents.assignFinalNumber: callable-by sp_secretary only.
 *
 * SP Resolutions receive their final number automatically when the
 * second_reading_vote or second_reading_amended_vote workflow step
 * completes with outcome APPROVED (TASK-WF-016). The manual button is
 * hidden for this document type to avoid a confusing double-assignment
 * click — this is a values-based frontend check mirroring the same
 * hardcoded step-key set the backend subscriber uses
 * (documents.plugin.ts's SP_RESOLUTION_FINAL_NUMBERING_STEP_KEYS), not a
 * schema-driven flag. No `hasFinalNumbering` field exists on the document
 * type yet — if one is added later, this check should be updated to use
 * it instead of the hardcoded documentTypeCode comparison below.
 */
function canAssignFinalNumber(
  identity: ActiveUserIdentity | null,
  preliminaryNumber: string | null,
  finalNumber: string | null,
  documentTypeCode: string,
): boolean {
  if (!hasRole(identity, 'sp_secretary')) return false;
  if (documentTypeCode === 'SP_RESOLUTION') return false;
  return !!preliminaryNumber && !finalNumber;
}

/** documents.cancel: callable-by dept_approver, sp_secretary, sp_presiding_officer,
 *  mayor, brgy_captain unconditionally; dept_encoder/brgy_encoder conditionally */
function canCancel(
  identity: ActiveUserIdentity | null,
  lifecycleState: string,
  workflowInstanceId: string | null | undefined,
): boolean {
  if (['superseded', 'cancelled'].includes(lifecycleState)) return false;
  if (
    hasRole(
      identity,
      'dept_approver',
      'sp_secretary',
      'sp_presiding_officer',
      'mayor',
      'brgy_captain',
    )
  )
    return true;
  if (hasRole(identity, 'dept_encoder', 'brgy_encoder')) {
    return ['draft', 'submitted'].includes(lifecycleState) && !workflowInstanceId;
  }
  return false;
}

/** documents.delete: callable-by dept_encoder, dept_approver, sp_secretary,
 *  sp_presiding_officer, mayor, brgy_encoder, brgy_captain */
function canDelete(
  identity: ActiveUserIdentity | null,
  lifecycleState: string,
  workflowInstanceId: string | null | undefined,
): boolean {
  if (
    !hasRole(
      identity,
      'dept_encoder',
      'dept_approver',
      'sp_secretary',
      'sp_presiding_officer',
      'mayor',
      'brgy_encoder',
      'brgy_captain',
    )
  )
    return false;
  return ['draft', 'submitted'].includes(lifecycleState) && !workflowInstanceId;
}

/** documents.archive: callable-by records_officer, sp_secretary */
function canArchive(identity: ActiveUserIdentity | null, lifecycleState: string): boolean {
  if (!hasRole(identity, 'records_officer', 'sp_secretary')) return false;
  return ['completed', 'released'].includes(lifecycleState);
}

/** documents.logCertificationOfUrgency: callable-by sp_secretary only */
function canLogCertificationOfUrgency(identity: ActiveUserIdentity | null): boolean {
  return hasRole(identity, 'sp_secretary');
}

/** documents.publishToPortal / unpublishFromPortal: callable-by sp_secretary only */
function canPublishToPortal(identity: ActiveUserIdentity | null, lifecycleState: string): boolean {
  if (!hasRole(identity, 'sp_secretary')) return false;
  return ['released', 'superseded'].includes(lifecycleState);
}

/** documents.requestUploadUrl / confirmUpload: callable-by dept_encoder, dept_approver,
 *  sp_secretary, sp_member (own-authored), sp_presiding_officer, mayor, brgy_encoder,
 *  brgy_captain */
function canUploadVersion(identity: ActiveUserIdentity | null): boolean {
  return hasRole(
    identity,
    'dept_encoder',
    'dept_approver',
    'sp_secretary',
    'sp_member',
    'sp_presiding_officer',
    'mayor',
    'brgy_encoder',
    'brgy_captain',
  );
}

/** documents.triggerManualReOcr: callable-by records_officer, sp_secretary */
function canTriggerReOcr(identity: ActiveUserIdentity | null): boolean {
  return hasRole(identity, 'records_officer', 'sp_secretary');
}

/** documents.flagScannedBackForVerification: callable-by records_officer only */
function canFlagScannedBack(identity: ActiveUserIdentity | null): boolean {
  return hasRole(identity, 'records_officer');
}

/** documents.acceptScannedBackAsOfficial: callable-by records_officer, sp_secretary */
function canAcceptScannedBack(identity: ActiveUserIdentity | null): boolean {
  return hasRole(identity, 'records_officer', 'sp_secretary');
}

/** tracking.logRoutingEntry: callable-by sp_secretary only */
function canLogRoutingEntry(identity: ActiveUserIdentity | null): boolean {
  return hasRole(identity, 'sp_secretary');
}

/** tracking.printQrCoverSheet: callable-by sp_secretary only */
function canPrintQrCoverSheet(identity: ActiveUserIdentity | null): boolean {
  return hasRole(identity, 'sp_secretary');
}

// Runtime type guard bridging File.type (string) to the AllowedMimeType literal union.
// Derives from AllowedMimeTypeSchema directly so this stays correct if the
// schema's accepted MIME types ever change — no separate array to maintain.
function isAllowedMimeType(value: string): value is AllowedMimeType {
  return AllowedMimeTypeSchema.safeParse(value).success;
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const identity = useSessionStore((s) => s.identity);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  // ── Read group: documents.get ──────────────────────────────────────────────
  const {
    data: document,
    isLoading,
    isError,
  } = trpc.documents.get.useQuery({ documentId: documentId! }, { enabled: !!documentId });

  // ── Read group: documents.getVersionHistory ────────────────────────────────
  const { data: versions } = trpc.documents.getVersionHistory.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId },
  );

  // Resolve the latest version's ID for scan quality polling and download
  const latestVersion =
    versions && versions.length > 0
      ? versions.reduce((prev, curr) => (curr.versionNumber > prev.versionNumber ? curr : prev))
      : null;

  // ── File & OCR group: scan-quality polling (stops once resolved) ───────────
  const { data: scanQuality } = useScanQualityPolling(latestVersion?.id);

  // ── Tracking group: routing history ───────────────────────────────────────
  const { data: routingHistory } = trpc.tracking.getRoutingHistory.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId },
  );

  // ── Tracking group: tracking record (QR cover sheet data) ─────────────────
  const { data: trackingRecord } = trpc.tracking.getTrackingRecord.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId },
  );

  // ── Workflow link-out: active instance ────────────────────────────────────
  const { data: workflowInstance } = trpc.workflow.getActiveInstanceForDocument.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId },
  );

  const { data: offices } = trpc.organization.listAllOffices.useQuery(undefined, {
    staleTime: Infinity,
  });
  
  const { data: users } = trpc.iam.listAllUsers.useQuery(undefined, {
    staleTime: Infinity,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const submitMutation = trpc.documents.submit.useMutation({
    onSuccess: () => {
      toast.success('Document submitted');
      void utils.documents.get.invalidate({ documentId: documentId! });
      void utils.documents.list.invalidate();
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: documentId! });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.tracking.getTrackingRecord.invalidate({ documentId: documentId! });
      void utils.session.getOrderOfBusiness.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignPreliminaryMutation = trpc.documents.assignPreliminaryNumber.useMutation({
    onSuccess: () => {
      toast.success('Preliminary number assigned');
      void utils.documents.get.invalidate({ documentId: documentId! });
      void utils.documents.list.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignFinalMutation = trpc.documents.assignFinalNumber.useMutation({
    onSuccess: () => {
      toast.success('Final number assigned');
      void utils.documents.get.invalidate({ documentId: documentId! });
      void utils.documents.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveMutation = trpc.documents.archive.useMutation({
    onSuccess: () => {
      toast.success('Document archived');
      void utils.documents.get.invalidate({ documentId: documentId! });
      void utils.documents.list.invalidate();
      // F3 (docs/pre-development/F-frontend-architecture/f3-tanstack-query-key-factory-specification.md,
      // Document Mutations table, L728) also specifies recordsKeys.legalHold(documentId) as a
      // cross-module invalidation target here. Intentionally omitted: no `records` router is
      // registered in apps/server/src/trpc/root.ts, and no `records.isUnderLegalHold` or
      // `records.getRetentionSchedule` procedure exists anywhere under apps/server/src — the
      // backing feature has not been built yet. There is nothing to invalidate. Logged as
      // docs/development-findings-log.md [LOG-0160]. Do not add a call to
      // utils.records.isUnderLegalHold.invalidate(...) or anything similar until that router exists.
    },
    onError: (e) => toast.error(e.message),
  });

  const publishMutation = trpc.documents.publishToPortal.useMutation({
    onSuccess: () => {
      toast.success('Published to portal');
      void utils.documents.get.invalidate({ documentId: documentId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const unpublishMutation = trpc.documents.unpublishFromPortal.useMutation({
    onSuccess: () => {
      toast.success('Unpublished from portal');
      void utils.documents.get.invalidate({ documentId: documentId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const triggerReOcrMutation = trpc.documents.triggerManualReOcr.useMutation({
    onSuccess: () => {
      toast.success('Re-OCR queued');
      void utils.documents.getOcrText.invalidate();
      void utils.documents.getScanQualityIndicator.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const flagScannedBackMutation = trpc.documents.flagScannedBackForVerification.useMutation({
    onSuccess: () => {
      toast.success('Flagged for manual verification');
      setShowFlagDialog(false);
      setFlagReason('');
      void utils.documents.getVersionHistory.invalidate({ documentId: documentId! });
      void utils.documents.get.invalidate({ documentId: documentId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const acceptScannedBackMutation = trpc.documents.acceptScannedBackAsOfficial.useMutation({
    onSuccess: () => {
      toast.success('Accepted as official scanned back');
      void utils.documents.getVersionHistory.invalidate({ documentId: documentId! });
      void utils.documents.get.invalidate({ documentId: documentId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const downloadMutation = trpc.documents.downloadVersion.useMutation({
    onSuccess: (data) => {
      window.open(data.downloadUrl, '_blank');
    },
    onError: (e) => toast.error(e.message),
  });

  const logRoutingEntryMutation = trpc.tracking.logRoutingEntry.useMutation({
    onSuccess: () => {
      toast.success('Routing entry logged');
      void utils.tracking.getRoutingHistory.invalidate({ documentId: documentId! });
      void utils.tracking.getTrackingRecord.invalidate({ documentId: documentId! });
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Cancel dialog state ────────────────────────────────────────────────────
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // ── Flag Scanned Back dialog state ─────────────────────────────────────────
  const [flagReason, setFlagReason] = useState('');
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagVersionId, setFlagVersionId] = useState<string | null>(null);

  const cancelMutation = trpc.documents.cancel.useMutation({
    onSuccess: () => {
      toast.success('Document cancelled');
      setShowCancelDialog(false);
      setCancelReason('');
      void utils.documents.get.invalidate({ documentId: documentId! });
      void utils.documents.list.invalidate();
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: documentId! });
      void utils.workflow.listMyAssignedSteps.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success('Document deleted');
      void utils.documents.get.invalidate({ documentId: documentId! });
      void utils.documents.list.invalidate();
      navigate('/documents');
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Routing entry dialog state ─────────────────────────────────────────────
  const [routingActionDesc, setRoutingActionDesc] = useState('');
  const [showRoutingDialog, setShowRoutingDialog] = useState(false);

  // ── Upload state ───────────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const requestUploadUrlMutation = trpc.documents.requestUploadUrl.useMutation();
  const confirmUploadMutation = trpc.documents.confirmUpload.useMutation({
    onSuccess: (data) => {
      toast.success('New version uploaded — OCR is running in the background');
      setUploadFile(null);
      void utils.documents.getVersionHistory.invalidate({ documentId: documentId! });
      void utils.documents.getScanQualityIndicator.invalidate({ versionId: data.versionId });
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Loading / error states ────────────────────────────────────────────────
  if (!documentId) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-danger-600">Invalid document URL — no document ID provided.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-4 py-8">
        <p className="text-danger-600">
          Document not found or you do not have permission to view it.
        </p>
        <Link to="/documents" className="text-primary underline">
          ← Back to Documents
        </Link>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const lifecycleState = document.lifecycleState;
  const documentState = mapLifecycleStateToDocumentState(lifecycleState);
  const displayNumber = document.finalNumber ?? document.preliminaryNumber ?? null;
  const numberVariant = document.finalNumber
    ? 'final'
    : document.preliminaryNumber
      ? 'preliminary'
      : 'preliminary';
  // documentType is a nested object: { id, name, code, classificationDefault, preliminaryNumbering }
  const documentTypeName = document.documentType?.name ?? document.documentTypeId;

  // ── Routing history → RoutingHistoryTimeline entries ──────────────────────
  // The tracking.getRoutingHistory output uses snake_case / different shape from
  // RoutingEntry (the UI type). Map defensively.
  //
  // The server now emits user-friendly actionDescription strings (e.g.
  // "Mayor Review -- approved") instead of raw "stepType DONE" payloads.
  // We derive a RoutingAction from the text for color-coding only; the
  // timeline component uses actionDescription as the primary display label.

  const STEP_TYPE_LABELS: Record<string, string> = {
    action: 'Action',
    approval: 'Approval',
    multi_referral: 'Multi-Referral',
    decision: 'Decision',
    notification: 'Notification',
    termination: 'Termination',
  };
  const OUTCOME_LABELS: Record<string, string> = {
    DONE: 'completed',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    RETURNED_FOR_REVISION: 'returned for revision',
    SIGNED: 'signed',
    VETOED: 'vetoed',
    REPORT_ACCEPTED: 'committee report accepted',
    SECRETARY_ADVANCED: 'manually advanced by SP Secretary',
    LAPSED_CONFIRMED: 'mayor lapse confirmed',
    DEEMED_APPROVED_CONFIRMED: 'panlalawigan deemed approval confirmed',
    VALID: 'affirmed in entirety',
    VALID_IN_PART: 'approved with partial invalidity',
    RETURNED: 'returned with objections',
  };

  /** Normalize legacy "stepType OUTCOME" strings to readable labels. */
  function formatActionDescription(raw: string): string {
    const match = raw.match(/^(\w+)\s+(\w+)$/);
    if (match && match[1] && match[2]) {
      const stepType = match[1];
      const outcome = match[2];
      const stepLabel = STEP_TYPE_LABELS[stepType] ?? stepType;
      const outcomeLabel = OUTCOME_LABELS[outcome] ?? outcome.toLowerCase().replace(/_/g, ' ');
      return `${stepLabel} -- ${outcomeLabel}`;
    }
    return raw;
  }

  function deriveRoutingAction(description: string): RoutingEntry['action'] {
    const lower = description.toLowerCase();
    if (lower.includes('vetoed')) return 'Vetoed';
    if (lower.includes('signed')) return 'SignedByMayor';
    if (lower.includes('deemed approval')) return 'DeemedApproved';
    if (lower.includes('approved')) return 'DeemedApproved';
    if (lower.includes('certified')) return 'VPCertified';
    if (lower.includes('transmitted')) return 'Transmitted';
    if (lower.includes('returned')) return 'Vetoed';
    if (lower.includes('released')) return 'Released';
    if (lower.includes('archived')) return 'Archived';
    if (lower.includes('lapsed')) return 'Lapsed';
    if (lower.includes('logged') || lower.includes('assigned')) return 'Logged';
    return 'Logged';
  }

  const routingEntries: RoutingEntry[] = (routingHistory ?? []).map(
    (e: RouterOutputs['tracking']['getRoutingHistory'][number]) => ({
      id: e.entryId,
      actorName: e.actorDisplayName ?? e.actorId,
      actorOfficeName: e.fromOfficeName ?? '',
      action: deriveRoutingAction(e.actionDescription),
      timestamp: new Date(e.timestamp),
      notes: formatActionDescription(e.actionDescription),
      ...(e.fromOfficeName && { fromOfficeName: e.fromOfficeName }),
      ...(e.toOfficeName && { toOfficeName: e.toOfficeName }),
    }),
  );

  // ── Workflow → WorkflowStep list ───────────────────────────────────────────
  // workflow.getActiveInstanceForDocument returns a single instance record, not
  // a step list. Build a minimal single-step indicator from it.
  const workflowSteps: WorkflowStep[] = workflowInstance
    ? [
        {
          id: workflowInstance.currentStepInstanceId,
          label: workflowInstance.currentStepName ?? workflowInstance.currentStepType,
          state: workflowInstance.status === 'Active' ? 'active' : 'completed',
          ...(workflowInstance.currentAssigneeUserId && {
            assigneeName:
              users?.find((u) => u.id === workflowInstance.currentAssigneeUserId)?.displayName ??
              users?.find((u) => u.id === workflowInstance.currentAssigneeUserId)?.username ??
              workflowInstance.currentAssigneeUserId,
          }),
        },
      ]
    : [];

  // ── Upload file handler ────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setUploadFile(null);
      return;
    }
    const MAX = 26214400; // 25 MiB
    if (selected.size > MAX) {
      setUploadFileError('File exceeds 25 MiB limit');
      setUploadFile(null);
      return;
    }
    if (!isAllowedMimeType(selected.type)) {
      setUploadFileError('Unsupported file type');
      setUploadFile(null);
      return;
    }
    setUploadFileError(null);
    setUploadFile(selected);
  };

  const handleUpload = async () => {
    if (!uploadFile || !documentId) return;
    if (!isAllowedMimeType(uploadFile.type)) {
      toast.error('Unsupported file type');
      return;
    }
    const { uploadUrl, s3Key } = await requestUploadUrlMutation.mutateAsync({
      documentId,
      mimeType: uploadFile.type,
    });
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: uploadFile,
      headers: { 'Content-Type': uploadFile.type },
    });
    if (!res.ok) {
      toast.error('File upload to storage failed');
      return;
    }
    await confirmUploadMutation.mutateAsync({
      documentId,
      s3Key,
      originalFilename: uploadFile.name,
      mimeType: uploadFile.type,
      fileSizeBytes: uploadFile.size,
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-6 py-8">
      {/* ── Breadcrumb ── */}
      <div className="text-text-muted text-sm">
        <Link to="/documents" className="text-primary hover:underline">
          Documents
        </Link>
        <span className="mx-2">›</span>
        <span>{document.title}</span>
      </div>

      {/* ── Header card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="truncate text-xl leading-tight font-semibold">
                {document.title}
              </CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge state={documentState} />
                {displayNumber && (
                  <DocumentNumberBadge number={displayNumber} variant={numberVariant} />
                )}
                <span className="text-text-muted font-mono text-xs">{documentTypeName}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {document.classificationLevel}
                </Badge>
              </div>
            </div>

            {/* Workflow link-out */}
            {workflowInstance && workflowInstance.status === 'Active' && (
              <Link
                to={`/workflow/steps/${workflowInstance.instanceId}`}
                className="text-primary text-sm whitespace-nowrap underline"
              >
                View workflow step →
              </Link>
            )}
          </div>
        </CardHeader>

        {/* Workflow step indicator — only rendered when an active instance exists */}
        {workflowSteps.length > 0 && (
          <CardContent className="pt-0">
            <WorkflowStepIndicator
              steps={workflowSteps}
              currentStepId={workflowInstance?.currentStepInstanceId ?? ''}
              orientation="horizontal"
            />
          </CardContent>
        )}
      </Card>

      {/* ── Actions & Tracking panels (2-column layout on large screens when tracking exists) ── */}
      <div className={trackingRecord ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start' : ''}>
        {/* ── Action buttons ── */}
        {(() => {
          const showSubmit = canSubmit(identity, lifecycleState);
          const showAssignPrelim = canAssignPreliminaryNumber(
            identity,
            lifecycleState,
            document.preliminaryNumber ?? null,
          );
          const showAssignFinal = canAssignFinalNumber(
            identity,
            document.preliminaryNumber ?? null,
            document.finalNumber ?? null,
            document.documentType?.code ?? '',
          );
          const showArchive = canArchive(identity, lifecycleState);
          const showPublish = canPublishToPortal(identity, lifecycleState);
          const showCertUrgency = canLogCertificationOfUrgency(identity);
          const showCancel = canCancel(identity, lifecycleState, document.workflowInstanceId);
          const showDelete = canDelete(identity, lifecycleState, document.workflowInstanceId);
          const showPrintQr = canPrintQrCoverSheet(identity);
          const showLogRouting = canLogRoutingEntry(identity);

          const hasWorkflowGroup = showSubmit || showCertUrgency;
          const hasNumberingGroup = showAssignPrelim || showAssignFinal;
          const hasTrackingGroup = showPrintQr || showLogRouting;
          const hasPortalGroup = showPublish || showArchive;
          const hasDangerGroup = showCancel || showDelete;

          const hasAnyActions =
            hasWorkflowGroup ||
            hasNumberingGroup ||
            hasTrackingGroup ||
            hasPortalGroup ||
            hasDangerGroup;

          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasAnyActions && (
                  <p className="text-xs text-text-muted italic">
                    No actions available for this document state and user role.
                  </p>
                )}

                {/* Group 1: Workflow & Lifecycle */}
                {hasWorkflowGroup && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Workflow &amp; Lifecycle
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {showSubmit && (
                        <Button
                          size="sm"
                          onClick={() => submitMutation.mutate({ documentId })}
                          disabled={submitMutation.isPending}
                        >
                          <Send />
                          Submit
                        </Button>
                      )}
                      {showCertUrgency && (
                        <LogCertificationOfUrgencyDialog documentId={documentId} />
                      )}
                    </div>
                  </div>
                )}

                {/* Group 2: Document Numbering */}
                {hasNumberingGroup && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Document Numbering
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {showAssignPrelim && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => assignPreliminaryMutation.mutate({ documentId })}
                          disabled={assignPreliminaryMutation.isPending}
                        >
                          <Hash />
                          Assign Preliminary Number
                        </Button>
                      )}
                      {showAssignFinal && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => assignFinalMutation.mutate({ documentId })}
                          disabled={assignFinalMutation.isPending}
                        >
                          <BadgeCheck />
                          Finalize Number
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Group 3: Tracking & Routing */}
                {hasTrackingGroup && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Tracking &amp; Routing
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {showPrintQr && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!trackingRecord}
                          onClick={async () => {
                            try {
                              const result = await utils.tracking.printQrCoverSheet.fetch({
                                documentIds: [documentId],
                                layout: 'single',
                              });
                              window.open(result.pdfPresignedUrl, '_blank');
                            } catch (e) {
                              toast.error(
                                e instanceof Error
                                  ? e.message
                                  : 'Failed to print QR cover sheet',
                              );
                            }
                          }}
                        >
                          <Printer />
                          Print QR Cover Sheet
                        </Button>
                      )}
                      {showLogRouting && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRoutingDialog(true)}
                        >
                          <Route />
                          Log Routing Entry
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Group 4: Portal & Archiving */}
                {hasPortalGroup && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Portal &amp; Archiving
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {showPublish && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => publishMutation.mutate({ documentId })}
                            disabled={publishMutation.isPending}
                          >
                            <Globe />
                            Publish to Portal
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unpublishMutation.mutate({ documentId })}
                            disabled={unpublishMutation.isPending}
                          >
                            <EyeOff />
                            Unpublish from Portal
                          </Button>
                        </>
                      )}
                      {showArchive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => archiveMutation.mutate({ documentId })}
                          disabled={archiveMutation.isPending}
                        >
                          <Archive />
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Group 5: Destructive Actions */}
                {hasDangerGroup && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-danger-600">
                      Danger Zone
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {showCancel && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setShowCancelDialog(true)}
                        >
                          <Ban />
                          Cancel
                        </Button>
                      )}
                      {showDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (
                              confirm(
                                'Permanently delete this document? This cannot be undone.',
                              )
                            ) {
                              deleteMutation.mutate({ documentId });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Cancel dialog (inline) */}
                {showCancelDialog && (
                  <div className="bg-danger-50 mt-4 space-y-3 rounded-md border p-4">
                    <p className="text-danger-700 text-sm font-medium">
                      Provide a cancellation reason (required):
                    </p>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason for cancellation"
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          cancelReason.trim() &&
                          cancelMutation.mutate({ documentId, reason: cancelReason.trim() })
                        }
                        disabled={!cancelReason.trim() || cancelMutation.isPending}
                      >
                        Confirm Cancellation
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowCancelDialog(false);
                          setCancelReason('');
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                {/* Routing entry dialog (inline) */}
                {showRoutingDialog && (
                  <div className="bg-info-50 mt-4 space-y-3 rounded-md border p-4">
                    <p className="text-info-700 text-sm font-medium">Log a routing entry:</p>
                    <Input
                      value={routingActionDesc}
                      onChange={(e) => setRoutingActionDesc(e.target.value)}
                      placeholder="Action description (e.g. Transmitted to SP Office)"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!routingActionDesc.trim()) return;
                          logRoutingEntryMutation.mutate({
                            documentId,
                            toOfficeId: null,
                            actionDescription: routingActionDesc.trim(),
                          });
                          setShowRoutingDialog(false);
                          setRoutingActionDesc('');
                        }}
                        disabled={!routingActionDesc.trim() || logRoutingEntryMutation.isPending}
                      >
                        Save Entry
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRoutingDialog(false)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* ── QR Code + tracking info ── */}
        {trackingRecord && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tracking</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 sm:flex-row">
              <div className="w-40 shrink-0">
                <QRCodeDisplay
                  trackingId={trackingRecord.qrCodeS3Key ?? trackingRecord.trackingId}
                  documentNumber={displayNumber ?? trackingRecord.trackingNumber}
                  title={document.title}
                />
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-text-muted font-medium">Tracking Number:</span>{' '}
                  <span className="font-mono">{trackingRecord.trackingNumber}</span>
                </div>
                {trackingRecord.physicalLocation && (
                  <div>
                    <span className="text-text-muted font-medium">Physical Location:</span>{' '}
                    {trackingRecord.physicalLocation}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Tabs: Detail / Files & OCR / Routing History ── */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" className="gap-2">
            <FileText className="h-4 w-4" />
            Document Details
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <Files className="h-4 w-4" />
            Files &amp; OCR
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Routing History
          </TabsTrigger>
        </TabsList>

        {/* Details tab */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="space-y-3 pt-4 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <span className="text-text-muted font-medium">Lifecycle State</span>
                  <p className="font-mono">{lifecycleState}</p>
                </div>
                <div>
                  <span className="text-text-muted font-medium">Classification</span>
                  <p className="capitalize">{document.classificationLevel}</p>
                </div>
                {document.preliminaryNumber && (
                  <div>
                    <span className="text-text-muted font-medium">Preliminary Number</span>
                    <p className="font-mono">{document.preliminaryNumber}</p>
                  </div>
                )}
                {document.finalNumber && (
                  <div>
                    <span className="text-text-muted font-medium">Final Number</span>
                    <p className="font-mono">{document.finalNumber}</p>
                  </div>
                )}
                <div>
                  <span className="text-text-muted font-medium">Office (owner)</span>
                  <p className="text-sm">
                    {offices?.find(o => o.id === document.ownedByOfficeId)?.name ?? (
                      <span className="font-mono text-xs">{document.ownedByOfficeId}</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-text-muted font-medium">Created By</span>
                  <p className="text-sm">
                    {users?.find(u => u.id === document.createdBy)?.displayName ?? (
                      <span className="font-mono text-xs">{document.createdBy}</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-text-muted font-medium">Created At</span>
                  <p>{new Date(document.createdAt).toLocaleString()}</p>
                </div>
                {document.supersededBy && (
                  <div>
                    <span className="text-text-muted font-medium">Superseded By</span>
                    <Link
                      to={`/documents/${document.supersededBy}`}
                      className="text-primary font-mono text-xs underline"
                    >
                      {document.supersededBy}
                    </Link>
                  </div>
                )}
                {document.closureReason && (
                  <div className="col-span-2">
                    <span className="text-text-muted font-medium">Closure Reason</span>
                    <p>{document.closureReason}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files & OCR tab */}
        <TabsContent value="files" className="mt-4 space-y-4">
          {/* Upload new version — shown only to roles that can upload */}
          {canUploadVersion(identity) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Upload New Version</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="version-file">
                    File (PDF, DOCX, XLSX, JPEG, PNG — max 25 MiB)
                  </Label>
                  <Input
                    id="version-file"
                    type="file"
                    accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {uploadFileError && <p className="text-danger-600 text-xs">{uploadFileError}</p>}
                </div>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={
                    !uploadFile ||
                    confirmUploadMutation.isPending ||
                    requestUploadUrlMutation.isPending
                  }
                >
                  {confirmUploadMutation.isPending ? 'Uploading…' : 'Upload Version'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Version list */}
          {(versions ?? []).length === 0 ? (
            <p className="text-text-muted text-sm">No file versions yet.</p>
          ) : (
            <div className="space-y-3">
              {[...(versions ?? [])]
                .sort((a, b) => b.versionNumber - a.versionNumber)
                .map((v) => {
                  const isLatest = v.id === latestVersion?.id;
                  const scanData = isLatest ? scanQuality : null;
                  const scanScore = scanData?.scanQualityScore ?? null;

                  return (
                    <Card key={v.id}>
                      <CardContent className="pt-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Version {v.versionNumber}
                              {isLatest && (
                                <Badge className="ml-2 text-xs" variant="secondary">
                                  Latest
                                </Badge>
                              )}
                            </p>
                            <p className="text-text-muted font-mono text-xs">
                              {v.originalFilename ?? 'Unnamed file'} · {v.mimeType}
                            </p>
                            <p className="text-text-muted text-xs">
                              {(v.fileSizeBytes / 1024).toFixed(1)} KB
                            </p>

                            {/* Scan quality — sourced only from polling, never from confirmUpload */}
                            {isLatest && (
                              <div className="mt-1">
                                {scanData?.scanQualityCategory == null ? (
                                  <span className="text-text-muted text-xs italic">
                                    OCR processing… (auto-refresh active)
                                  </span>
                                ) : scanScore != null ? (
                                  <ScanQualityIndicator
                                    score={Math.round(scanScore * 100)}
                                    showLabel
                                  />
                                ) : null}
                              </div>
                            )}
                          </div>

                          {/* Per-version actions */}
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadMutation.mutate({ versionId: v.id })}
                              disabled={downloadMutation.isPending}
                            >
                              Download
                            </Button>

                            {/* Re-OCR — records_officer / sp_secretary */}
                            {canTriggerReOcr(identity) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => triggerReOcrMutation.mutate({ versionId: v.id })}
                                disabled={triggerReOcrMutation.isPending}
                              >
                                Re-run OCR
                              </Button>
                            )}

                            {/* Flag scanned back — records_officer only */}
                            {canFlagScannedBack(identity) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setFlagVersionId(v.id);
                                  setShowFlagDialog(true);
                                }}
                                disabled={flagScannedBackMutation.isPending}
                              >
                                Flag for Verification
                              </Button>
                            )}

                            {/* Accept scanned back — records_officer / sp_secretary */}
                            {canAcceptScannedBack(identity) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  acceptScannedBackMutation.mutate({ versionId: v.id })
                                }
                                disabled={acceptScannedBackMutation.isPending}
                              >
                                Accept as Official
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}

          {/* Flag dialog (inline) */}
          {showFlagDialog && flagVersionId && (
            <div className="bg-warning-50 mt-4 space-y-3 rounded-md border p-4">
              <p className="text-warning-700 text-sm font-medium">
                Provide a reason for flagging this version (required):
              </p>
              <Textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Reason for flagging (e.g. illegible scan, missing pages)"
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() =>
                    flagReason.trim() &&
                    flagScannedBackMutation.mutate({
                      versionId: flagVersionId,
                      reason: flagReason.trim(),
                    })
                  }
                  disabled={!flagReason.trim() || flagScannedBackMutation.isPending}
                >
                  Confirm Flag
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowFlagDialog(false);
                    setFlagReason('');
                    setFlagVersionId(null);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Routing History tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {routingEntries.length === 0 ? (
                <p className="text-text-muted text-sm">No routing history yet.</p>
              ) : (
                <RoutingHistoryTimeline entries={routingEntries} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
