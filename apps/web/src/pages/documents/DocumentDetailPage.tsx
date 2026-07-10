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

import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
  Separator,
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
import type { WorkflowStep, RoutingEntry } from '@batac/ui';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { mapLifecycleStateToDocumentState } from '@/lib/status-mapping';
import { useScanQualityPolling } from '@/hooks/useScanQualityPolling';
import type { LifecycleState } from '@batac/shared';

// ─── ABAC role helpers ──────────────────────────────────────────────────────
// Each helper corresponds to a specific procedure's callable-by list (sourced
// from the procedure definitions in the task spec and cross-referenced against
// E1). These are intentionally NOT the blanket 10-role page set.

function hasRole(roles: string[], ...allowed: string[]): boolean {
  return allowed.some((r) => roles.includes(r));
}

const SP_ROLES = ['sp_secretary', 'sp_member', 'sp_presiding_officer'];

/** documents.update: callable-by dept_encoder, dept_approver, sp_secretary,
 *  sp_presiding_officer, mayor, brgy_encoder, brgy_captain, sp_member */
function canUpdate(roles: string[], lifecycleState: string): boolean {
  if (!hasRole(roles, 'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain', 'sp_member')) return false;
  return lifecycleState === 'draft';
}

/** documents.submit: callable-by dept_encoder, dept_approver, sp_secretary,
 *  sp_member, sp_presiding_officer, mayor, brgy_encoder, brgy_captain */
function canSubmit(roles: string[], lifecycleState: string): boolean {
  if (!hasRole(roles, 'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member', 'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain')) return false;
  return lifecycleState === 'draft';
}

/** documents.assignPreliminaryNumber: callable-by sp_secretary only */
function canAssignPreliminaryNumber(roles: string[], lifecycleState: string, preliminaryNumber: string | null): boolean {
  if (!roles.includes('sp_secretary')) return false;
  return ['submitted', 'in_workflow'].includes(lifecycleState) && !preliminaryNumber;
}

/** documents.assignFinalNumber: callable-by sp_secretary only */
function canAssignFinalNumber(roles: string[], preliminaryNumber: string | null, finalNumber: string | null): boolean {
  if (!roles.includes('sp_secretary')) return false;
  return !!preliminaryNumber && !finalNumber;
}

/** documents.cancel: callable-by dept_approver, sp_secretary, sp_presiding_officer,
 *  mayor, brgy_captain unconditionally; dept_encoder/brgy_encoder conditionally */
function canCancel(roles: string[], lifecycleState: string, workflowInstanceId: string | null | undefined): boolean {
  if (['superseded', 'cancelled'].includes(lifecycleState)) return false;
  if (hasRole(roles, 'dept_approver', 'sp_secretary', 'sp_presiding_officer', 'mayor', 'brgy_captain')) return true;
  if (hasRole(roles, 'dept_encoder', 'brgy_encoder')) {
    return ['draft', 'submitted'].includes(lifecycleState) && !workflowInstanceId;
  }
  return false;
}

/** documents.delete: callable-by dept_encoder, dept_approver, sp_secretary,
 *  sp_presiding_officer, mayor, brgy_encoder, brgy_captain */
function canDelete(roles: string[], lifecycleState: string, workflowInstanceId: string | null | undefined): boolean {
  if (!hasRole(roles, 'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain')) return false;
  return ['draft', 'submitted'].includes(lifecycleState) && !workflowInstanceId;
}

/** documents.archive: callable-by records_officer, sp_secretary */
function canArchive(roles: string[], lifecycleState: string): boolean {
  if (!hasRole(roles, 'records_officer', 'sp_secretary')) return false;
  return ['completed', 'released'].includes(lifecycleState);
}

/** documents.logCertificationOfUrgency: callable-by sp_secretary only */
function canLogCertificationOfUrgency(roles: string[]): boolean {
  return roles.includes('sp_secretary');
}

/** documents.publishToPortal / unpublishFromPortal: callable-by sp_secretary only */
function canPublishToPortal(roles: string[], lifecycleState: string): boolean {
  if (!roles.includes('sp_secretary')) return false;
  return ['released', 'superseded'].includes(lifecycleState);
}

/** documents.requestUploadUrl / confirmUpload: callable-by dept_encoder, dept_approver,
 *  sp_secretary, sp_member (own-authored), sp_presiding_officer, mayor, brgy_encoder,
 *  brgy_captain */
function canUploadVersion(roles: string[]): boolean {
  return hasRole(roles, 'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member', 'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain');
}

/** documents.triggerManualReOcr: callable-by records_officer, sp_secretary */
function canTriggerReOcr(roles: string[]): boolean {
  return hasRole(roles, 'records_officer', 'sp_secretary');
}

/** documents.flagScannedBackForVerification: callable-by records_officer only */
function canFlagScannedBack(roles: string[]): boolean {
  return roles.includes('records_officer');
}

/** documents.acceptScannedBackAsOfficial: callable-by records_officer, sp_secretary */
function canAcceptScannedBack(roles: string[]): boolean {
  return hasRole(roles, 'records_officer', 'sp_secretary');
}

/** tracking.logRoutingEntry: callable-by sp_secretary only */
function canLogRoutingEntry(roles: string[]): boolean {
  return roles.includes('sp_secretary');
}

/** tracking.printQrCoverSheet: callable-by sp_secretary only */
function canPrintQrCoverSheet(roles: string[]): boolean {
  return roles.includes('sp_secretary');
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const roles = session?.roleCodes ?? [];

  // ── Read group: documents.get ──────────────────────────────────────────────
  const {
    data: document,
    isLoading,
    isError,
    refetch: refetchDocument,
  } = trpc.documents.get.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId },
  );

  // ── Read group: documents.getVersionHistory ────────────────────────────────
  const { data: versions, refetch: refetchVersions } =
    trpc.documents.getVersionHistory.useQuery(
      { documentId: documentId! },
      { enabled: !!documentId },
    );

  // Resolve the latest version's ID for scan quality polling and download
  const latestVersion = versions && versions.length > 0
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
  const { data: workflowInstance } =
    trpc.workflow.getActiveInstanceForDocument.useQuery(
      { documentId: documentId! },
      { enabled: !!documentId },
    );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const submitMutation = trpc.documents.submit.useMutation({
    onSuccess: () => {
      toast.success('Document submitted');
      refetchDocument();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignPreliminaryMutation = trpc.documents.assignPreliminaryNumber.useMutation({
    onSuccess: () => {
      toast.success('Preliminary number assigned');
      refetchDocument();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignFinalMutation = trpc.documents.assignFinalNumber.useMutation({
    onSuccess: () => {
      toast.success('Final number assigned');
      refetchDocument();
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveMutation = trpc.documents.archive.useMutation({
    onSuccess: () => {
      toast.success('Document archived');
      refetchDocument();
    },
    onError: (e) => toast.error(e.message),
  });

  const publishMutation = trpc.documents.publishToPortal.useMutation({
    onSuccess: () => {
      toast.success('Published to portal');
      refetchDocument();
    },
    onError: (e) => toast.error(e.message),
  });

  const unpublishMutation = trpc.documents.unpublishFromPortal.useMutation({
    onSuccess: () => {
      toast.success('Unpublished from portal');
      refetchDocument();
    },
    onError: (e) => toast.error(e.message),
  });

  const triggerReOcrMutation = trpc.documents.triggerManualReOcr.useMutation({
    onSuccess: () => {
      toast.success('Re-OCR queued');
      refetchVersions();
    },
    onError: (e) => toast.error(e.message),
  });

  const flagScannedBackMutation = trpc.documents.flagScannedBackForVerification.useMutation({
    onSuccess: () => {
      toast.success('Flagged for manual verification');
      setShowFlagDialog(false);
      setFlagReason('');
      refetchVersions();
    },
    onError: (e) => toast.error(e.message),
  });

  const acceptScannedBackMutation = trpc.documents.acceptScannedBackAsOfficial.useMutation({
    onSuccess: () => {
      toast.success('Accepted as official scanned back');
      refetchVersions();
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
      refetchDocument();
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
      refetchDocument();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success('Document deleted');
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
    onSuccess: () => {
      toast.success('New version uploaded — OCR is running in the background');
      setUploadFile(null);
      refetchVersions();
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Loading / error states ────────────────────────────────────────────────
  if (!documentId) {
    return (
      <div className="container py-8">
        <p className="text-danger-600">Invalid document URL — no document ID provided.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <div className="container py-8 space-y-4">
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
  const lifecycleState = document.lifecycleState as LifecycleState;
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
  const routingEntries: RoutingEntry[] = (routingHistory ?? []).map((e: any) => ({
    id: e.entryId ?? e.id,
    actorName: e.actorDisplayName ?? e.actorId,
    actorOfficeName: e.fromOfficeId ?? '',
    action: 'Logged' as const, // actionDescription is free text; map to nearest RoutingAction
    timestamp: new Date(e.timestamp),
    notes: e.actionDescription,
    ...(e.fromOfficeId && { fromOfficeName: e.fromOfficeId }),
    ...(e.toOfficeId && { toOfficeName: e.toOfficeId }),
  }));

  // ── Workflow → WorkflowStep list ───────────────────────────────────────────
  // workflow.getActiveInstanceForDocument returns a single instance record, not
  // a step list. Build a minimal single-step indicator from it.
  const workflowSteps: WorkflowStep[] = workflowInstance
    ? [
        {
          id: workflowInstance.currentStepInstanceId,
          label: workflowInstance.currentStepType,
          state: workflowInstance.status === 'Active' ? 'active' : 'completed',
          ...(workflowInstance.currentAssigneeUserId && {
            assigneeName: workflowInstance.currentAssigneeUserId,
          }),
        },
      ]
    : [];

  // ── Upload file handler ────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) { setUploadFile(null); return; }
    const MAX = 26214400; // 25 MiB
    if (selected.size > MAX) {
      setUploadFileError('File exceeds 25 MiB limit');
      setUploadFile(null);
      return;
    }
    const VALID = ['application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!VALID.includes(selected.type)) {
      setUploadFileError('Unsupported file type');
      setUploadFile(null);
      return;
    }
    setUploadFileError(null);
    setUploadFile(selected);
  };

  const handleUpload = async () => {
    if (!uploadFile || !documentId) return;
    const { uploadUrl, s3Key } = await requestUploadUrlMutation.mutateAsync({
      documentId,
      mimeType: uploadFile.type as any,
    });
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: uploadFile,
      headers: { 'Content-Type': uploadFile.type },
    });
    if (!res.ok) { toast.error('File upload to storage failed'); return; }
    await confirmUploadMutation.mutateAsync({
      documentId,
      s3Key,
      originalFilename: uploadFile.name,
      mimeType: uploadFile.type as any,
      fileSizeBytes: uploadFile.size,
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="text-sm text-text-muted">
        <Link to="/documents" className="hover:underline text-primary">Documents</Link>
        <span className="mx-2">›</span>
        <span>{document.title}</span>
      </div>

      {/* ── Header card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-xl font-semibold leading-tight truncate">
                {document.title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <StatusBadge state={documentState} />
                {displayNumber && (
                  <DocumentNumberBadge number={displayNumber} variant={numberVariant} />
                )}
                <span className="text-xs text-text-muted font-mono">
                  {documentTypeName}
                </span>
                <Badge variant="outline" className="text-xs capitalize">
                  {document.classificationLevel}
                </Badge>
              </div>
            </div>

            {/* Workflow link-out */}
            {workflowInstance && workflowInstance.status === 'Active' && (
              <Link
                to={`/workflow/steps/${workflowInstance.instanceId}`}
                className="text-sm text-primary underline whitespace-nowrap"
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

      {/* ── Action buttons ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">

            {/* Submit */}
            {canSubmit(roles, lifecycleState) && (
              <Button
                size="sm"
                onClick={() => submitMutation.mutate({ documentId })}
                disabled={submitMutation.isPending}
              >
                Submit
              </Button>
            )}

            {/* Assign Preliminary Number */}
            {canAssignPreliminaryNumber(roles, lifecycleState, document.preliminaryNumber ?? null) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignPreliminaryMutation.mutate({ documentId })}
                disabled={assignPreliminaryMutation.isPending}
              >
                Assign Preliminary Number
              </Button>
            )}

            {/* Assign Final Number */}
            {canAssignFinalNumber(roles, document.preliminaryNumber ?? null, document.finalNumber ?? null) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignFinalMutation.mutate({ documentId })}
                disabled={assignFinalMutation.isPending}
              >
                Finalize Number
              </Button>
            )}

            {/* Archive */}
            {canArchive(roles, lifecycleState) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => archiveMutation.mutate({ documentId })}
                disabled={archiveMutation.isPending}
              >
                Archive
              </Button>
            )}

            {/* Publish / Unpublish Portal */}
            {canPublishToPortal(roles, lifecycleState) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => publishMutation.mutate({ documentId })}
                  disabled={publishMutation.isPending}
                >
                  Publish to Portal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unpublishMutation.mutate({ documentId })}
                  disabled={unpublishMutation.isPending}
                >
                  Unpublish from Portal
                </Button>
              </>
            )}

            {/* Certification of Urgency — sp_secretary only */}
            {canLogCertificationOfUrgency(roles) && (
              <Button size="sm" variant="outline" disabled>
                Log Certification of Urgency
              </Button>
            )}

            {/* Cancel */}
            {canCancel(roles, lifecycleState, document.workflowInstanceId) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel
              </Button>
            )}

            {/* Delete */}
            {canDelete(roles, lifecycleState, document.workflowInstanceId) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm('Permanently delete this document? This cannot be undone.')) {
                    deleteMutation.mutate({ documentId });
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}

            {/* Print QR Cover Sheet — sp_secretary only */}
            {canPrintQrCoverSheet(roles) && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  // printQrCoverSheet is typed as a query but issues a side-effecting
                  // presigned URL request — call via trpc utility client directly.
                  try {
                    const result = await utils.tracking.printQrCoverSheet.fetch({
                      documentIds: [documentId],
                      layout: 'single',
                    });
                    window.open((result as any).pdfPresignedUrl, '_blank');
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              >
                Print QR Cover Sheet
              </Button>
            )}

            {/* Log Routing Entry — sp_secretary only */}
            {canLogRoutingEntry(roles) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRoutingDialog(true)}
              >
                Log Routing Entry
              </Button>
            )}
          </div>

          {/* Cancel dialog (inline) */}
          {showCancelDialog && (
            <div className="mt-4 border rounded-md p-4 bg-danger-50 space-y-3">
              <p className="text-sm font-medium text-danger-700">
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
                  onClick={() => { setShowCancelDialog(false); setCancelReason(''); }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Routing entry dialog (inline) */}
          {showRoutingDialog && (
            <div className="mt-4 border rounded-md p-4 bg-info-50 space-y-3">
              <p className="text-sm font-medium text-info-700">Log a routing entry:</p>
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
                <Button size="sm" variant="outline" onClick={() => setShowRoutingDialog(false)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── QR Code + tracking info ── */}
      {trackingRecord && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tracking</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-6">
            <div className="w-40 shrink-0">
              <QRCodeDisplay
                trackingId={(trackingRecord as any).qrCodeS3Key ?? (trackingRecord as any).trackingId}
                documentNumber={displayNumber ?? (trackingRecord as any).trackingNumber}
                title={document.title}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-text-muted">Tracking Number:</span>{' '}
                <span className="font-mono">{(trackingRecord as any).trackingNumber}</span>
              </div>
              {(trackingRecord as any).physicalLocation && (
                <div>
                  <span className="font-medium text-text-muted">Physical Location:</span>{' '}
                  {(trackingRecord as any).physicalLocation}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabs: Detail / Files & OCR / Routing History ── */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Document Details</TabsTrigger>
          <TabsTrigger value="files">Files & OCR</TabsTrigger>
          <TabsTrigger value="history">Routing History</TabsTrigger>
        </TabsList>

        {/* Details tab */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <span className="font-medium text-text-muted">Lifecycle State</span>
                  <p className="font-mono">{lifecycleState}</p>
                </div>
                <div>
                  <span className="font-medium text-text-muted">Classification</span>
                  <p className="capitalize">{document.classificationLevel}</p>
                </div>
                {document.preliminaryNumber && (
                  <div>
                    <span className="font-medium text-text-muted">Preliminary Number</span>
                    <p className="font-mono">{document.preliminaryNumber}</p>
                  </div>
                )}
                {document.finalNumber && (
                  <div>
                    <span className="font-medium text-text-muted">Final Number</span>
                    <p className="font-mono">{document.finalNumber}</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-text-muted">Office (owner)</span>
                  {/* ownedByOfficeId is a bare UUID — label it as such; name resolution
                      would require a cross-module lookup which is out of scope here */}
                  <p className="font-mono text-xs">{document.ownedByOfficeId}</p>
                </div>
                <div>
                  <span className="font-medium text-text-muted">Created By</span>
                  <p className="font-mono text-xs">{document.createdBy}</p>
                </div>
                <div>
                  <span className="font-medium text-text-muted">Created At</span>
                  <p>{new Date(document.createdAt).toLocaleString()}</p>
                </div>
                {document.supersededBy && (
                  <div>
                    <span className="font-medium text-text-muted">Superseded By</span>
                    <Link
                      to={`/documents/${document.supersededBy}`}
                      className="text-primary underline text-xs font-mono"
                    >
                      {document.supersededBy}
                    </Link>
                  </div>
                )}
                {document.closureReason && (
                  <div className="col-span-2">
                    <span className="font-medium text-text-muted">Closure Reason</span>
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
          {canUploadVersion(roles) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Upload New Version</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="version-file">File (PDF, DOCX, XLSX, JPEG, PNG — max 25 MiB)</Label>
                  <Input
                    id="version-file"
                    type="file"
                    accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {uploadFileError && (
                    <p className="text-xs text-danger-600">{uploadFileError}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={!uploadFile || confirmUploadMutation.isPending || requestUploadUrlMutation.isPending}
                >
                  {confirmUploadMutation.isPending ? 'Uploading…' : 'Upload Version'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Version list */}
          {(versions ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">No file versions yet.</p>
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
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">
                              Version {v.versionNumber}
                              {isLatest && (
                                <Badge className="ml-2 text-xs" variant="secondary">Latest</Badge>
                              )}
                            </p>
                            <p className="text-xs text-text-muted font-mono">
                              {v.originalFilename ?? 'Unnamed file'} · {v.mimeType}
                            </p>
                            <p className="text-xs text-text-muted">
                              {(v.fileSizeBytes / 1024).toFixed(1)} KB
                            </p>

                            {/* Scan quality — sourced only from polling, never from confirmUpload */}
                            {isLatest && (
                              <div className="mt-1">
                                {scanData?.scanQualityCategory == null ? (
                                  <span className="text-xs text-text-muted italic">
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
                            {canTriggerReOcr(roles) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  triggerReOcrMutation.mutate({ versionId: v.id })
                                }
                                disabled={triggerReOcrMutation.isPending}
                              >
                                Re-run OCR
                              </Button>
                            )}

                            {/* Flag scanned back — records_officer only */}
                            {canFlagScannedBack(roles) && (
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
                            {canAcceptScannedBack(roles) && (
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
            <div className="mt-4 border rounded-md p-4 bg-warning-50 space-y-3">
              <p className="text-sm font-medium text-warning-700">
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
                    flagScannedBackMutation.mutate({ versionId: flagVersionId, reason: flagReason.trim() })
                  }
                  disabled={!flagReason.trim() || flagScannedBackMutation.isPending}
                >
                  Confirm Flag
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowFlagDialog(false); setFlagReason(''); setFlagVersionId(null); }}
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
                <p className="text-sm text-text-muted">No routing history yet.</p>
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
