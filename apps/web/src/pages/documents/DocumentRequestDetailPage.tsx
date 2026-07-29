/**
 * DocumentRequestDetailPage — /document-requests/:requestId
 *
 * Read roles : sp_secretary, sp_presiding_officer, records_officer, auditor
 *
 * Manage actions (role-gated):
 *   approveAsPresidingOfficer  — sp_presiding_officer only
 *                                Enabled while lifecycleState ∈ PRE_RELEASE_STATES
 *                                (draft | submitted | in_workflow | pending_mayor_action)
 *   approveAsSecretary         — sp_secretary only
 *                                Backend PRECONDITION_FAILED if vmApproved !== true first.
 *                                Frontend: enable only when vmApproved === true AND
 *                                lifecycleState ∈ PRE_RELEASE_STATES (not yet 'completed').
 *   releaseCopy                — sp_secretary only
 *                                Enabled when lifecycleState === 'completed' (both approvals done).
 *                                orNumber / collectingOfficer / amountPaid are ALL optional —
 *                                payment does NOT gate release in Phase 1 (Q-D04).
 *
 * Note: This entire router is marked "Phase 1 stub" — dual-approval tracking via
 * JSONB metadata (vm_approved / sp_approved) is temporary pending WF integration.
 * The frontend builds normally against the current contract.
 */

import {
  FileText,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Send,
  Loader2,
  AlertTriangle,
  User,
  Banknote,
} from 'lucide-react';
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  Input,
  Label,
  StatusBadge,
  cn,
} from '@batac/ui';

import { hasRole } from '@/lib/auth-helpers';
import { mapLifecycleStateToDocumentState } from '@/lib/status-mapping';
import { trpc, type RouterOutputs } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

// ─── Constants mirroring backend ─────────────────────────────────────────────

/** Mirrors PRE_RELEASE_STATES in document-requests.router.ts line 60 */
const PRE_RELEASE_STATES = new Set(['draft', 'submitted', 'in_workflow', 'pending_mayor_action']);

// ─── Role sets ────────────────────────────────────────────────────────────────

const VIEW_ROLES = ['sp_secretary', 'sp_presiding_officer', 'records_officer', 'auditor'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestDetail = RouterOutputs['documents']['getDocumentRequest'];

// ─── Page root (role gate) ────────────────────────────────────────────────────

export function DocumentRequestDetailPage() {
  const identity = useSessionStore((s) => s.identity);

  if (!hasRole(identity, ...VIEW_ROLES)) {
    return (
      <div className="text-text-muted flex flex-col items-center justify-center p-8">
        You do not have permission to view this page.
      </div>
    );
  }

  return <DocumentRequestDetailContent />;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function DocumentRequestDetailContent() {
  const { requestId } = useParams<{ requestId: string }>();
  const identity = useSessionStore((s) => s.identity);

  const isSecretary = hasRole(identity, 'sp_secretary');
  const isPresidingOfficer = hasRole(identity, 'sp_presiding_officer');

  const { data, isLoading, isError, refetch } = trpc.documents.getDocumentRequest.useQuery(
    { requestId: requestId! },
    { enabled: !!requestId },
  );

  if (!requestId) {
    return <div className="text-text-muted p-8 text-sm">No request ID found in URL.</div>;
  }

  if (isLoading) {
    return <DocumentRequestDetailSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="text-danger-600 flex flex-col items-center gap-2 p-8 text-sm">
        <AlertTriangle className="h-5 w-5" />
        Document request not found or you do not have access.
        <Link
          to="/document-requests"
          className="text-primary-600 mt-2 flex items-center gap-1 text-xs hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      {/* ─── Breadcrumb back link ─── */}
      <Link
        to="/document-requests"
        className="text-text-muted hover:text-primary-600 flex w-fit items-center gap-1 text-xs"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Document Requests
      </Link>

      {/* ─── Page header ─── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-text-primary flex min-w-0 items-center gap-2 text-2xl font-bold">
            <FileText className="text-primary-500 h-6 w-6 shrink-0" />
            <span className="truncate">{data.title}</span>
          </h1>
          <p className="text-text-muted text-xs">Request ID: {data.requestId}</p>
        </div>
        <StatusBadge state={mapLifecycleStateToDocumentState(data.lifecycleState)} />
      </div>

      {/* ─── Approval status strip ─── */}
      <ApprovalStatusStrip vmApproved={data.vmApproved} spApproved={data.spApproved} />

      {/* ─── Request details ─── */}
      <RequestDetailsCard data={data} />

      {/* ─── Documents requested ─── */}
      {data.documentsRequested && data.documentsRequested.length > 0 && (
        <DocumentsRequestedCard items={data.documentsRequested} />
      )}

      {/* ─── Payment info (if already recorded) ─── */}
      {data.payment && <PaymentInfoCard payment={data.payment} />}

      {/* ─── Action panel ─── */}
      <ActionsCard
        data={data}
        isSecretary={isSecretary}
        isPresidingOfficer={isPresidingOfficer}
        onSuccess={() => void refetch()}
      />
    </div>
  );
}

// ─── ApprovalStatusStrip ──────────────────────────────────────────────────────

function ApprovalStatusStrip({
  vmApproved,
  spApproved,
}: {
  vmApproved: boolean;
  spApproved: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-neutral-50 px-4 py-3">
      <p className="text-text-muted mr-2 text-xs font-semibold tracking-wide uppercase">
        Approvals
      </p>

      {/* Step 1 — Presiding Officer (Vice Mayor) */}
      <div className="flex items-center gap-1.5">
        {vmApproved ? (
          <CheckCircle2 className="text-success-600 h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4 text-neutral-300" />
        )}
        <span
          className={cn('text-xs font-medium', vmApproved ? 'text-success-700' : 'text-text-muted')}
        >
          Presiding Officer (VM)
        </span>
      </div>

      <span className="text-xs text-neutral-300">→</span>

      {/* Step 2 — SP Secretary */}
      <div className="flex items-center gap-1.5">
        {spApproved ? (
          <CheckCircle2 className="text-success-600 h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4 text-neutral-300" />
        )}
        <span
          className={cn('text-xs font-medium', spApproved ? 'text-success-700' : 'text-text-muted')}
        >
          SP Secretary
        </span>
      </div>
    </div>
  );
}

// ─── RequestDetailsCard ───────────────────────────────────────────────────────

function RequestDetailsCard({ data }: { data: RequestDetail }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <User className="text-text-muted h-4 w-4" />
          Request Details
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <DetailRow label="Requester" value={data.requesterName ?? '—'} />
        <DetailRow
          label="Access Mode"
          value={data.accessMode ? String(data.accessMode).replace(/_/g, ' ') : '—'}
        />
        <DetailRow
          label="Filed"
          value={new Date(data.createdAt).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        />
        {data.purpose && (
          <div className="col-span-full">
            <DetailRow label="Purpose" value={data.purpose} />
          </div>
        )}
        {data.notificationChannel && (
          <DetailRow label="Notification Channel" value={String(data.notificationChannel)} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── DocumentsRequestedCard ───────────────────────────────────────────────────

function DocumentsRequestedCard({
  items,
}: {
  items: Array<{
    documentTitle?: string;
    documentNumber?: string | null;
    numberOfPages?: number | null;
    documentTypeLabel?: string | null;
  }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <FileText className="text-text-muted h-4 w-4" />
          Documents Requested
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-neutral-100">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="text-text-muted w-5 shrink-0 font-mono text-xs">{idx + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="text-text-primary truncate font-medium">
                  {item.documentTitle ?? '—'}
                </p>
                {item.documentNumber && (
                  <p className="text-text-muted text-xs">No. {item.documentNumber}</p>
                )}
              </div>
              {item.numberOfPages != null && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {item.numberOfPages}p
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── PaymentInfoCard ──────────────────────────────────────────────────────────

function PaymentInfoCard({
  payment,
}: {
  payment: {
    orNumber?: string | null;
    collectingOfficer?: string | null;
    amountPaid?: number | null;
    paymentDate?: string | null;
  };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <Banknote className="text-text-muted h-4 w-4" />
          Payment (Recorded)
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <DetailRow label="OR Number" value={payment.orNumber ?? '—'} />
        <DetailRow label="Collecting Officer" value={payment.collectingOfficer ?? '—'} />
        <DetailRow
          label="Amount Paid"
          value={payment.amountPaid != null ? `₱${payment.amountPaid.toFixed(2)}` : '—'}
        />
        {payment.paymentDate && <DetailRow label="Payment Date" value={payment.paymentDate} />}
      </CardContent>
    </Card>
  );
}

// ─── ActionsCard ──────────────────────────────────────────────────────────────

function ActionsCard({
  data,
  isSecretary,
  isPresidingOfficer,
  onSuccess,
}: {
  data: RequestDetail;
  isSecretary: boolean;
  isPresidingOfficer: boolean;
  onSuccess: () => void;
}) {
  const canSeeActions = isSecretary || isPresidingOfficer;
  if (!canSeeActions) return null;

  const inPreReleaseState = PRE_RELEASE_STATES.has(data.lifecycleState);
  const isCompleted = data.lifecycleState === 'completed';
  const isReleased = data.lifecycleState === 'released';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <Send className="text-text-muted h-4 w-4" />
          Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* ── Step 1: Presiding Officer approval ── */}
        {isPresidingOfficer && (
          <PresidingOfficerApproveButton
            requestId={data.requestId}
            alreadyApproved={data.vmApproved}
            inPreReleaseState={inPreReleaseState}
            onSuccess={onSuccess}
          />
        )}

        {/* ── Step 2: Secretary approval ── */}
        {isSecretary && !isCompleted && !isReleased && (
          <>
            <hr className="my-1 border-neutral-100" />
            <SecretaryApproveButton
              requestId={data.requestId}
              vmApproved={data.vmApproved}
              alreadyApproved={data.spApproved}
              inPreReleaseState={inPreReleaseState}
              onSuccess={onSuccess}
            />
          </>
        )}

        {/* ── Step 3: Release ── */}
        {isSecretary && (
          <>
            <hr className="my-1 border-neutral-100" />
            <ReleaseCopyPanel
              requestId={data.requestId}
              isCompleted={isCompleted}
              isReleased={isReleased}
              onSuccess={onSuccess}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PresidingOfficerApproveButton ────────────────────────────────────────────

function PresidingOfficerApproveButton({
  requestId,
  alreadyApproved,
  inPreReleaseState,
  onSuccess,
}: {
  requestId: string;
  alreadyApproved: boolean;
  inPreReleaseState: boolean;
  onSuccess: () => void;
}) {
  const mutation = trpc.documents.approveAsPresidingOfficer.useMutation({
    onSuccess() {
      toast.success('Presiding Officer approval recorded.');
      onSuccess();
    },
    onError(err) {
      toast.error(`Approval failed: ${err.message}`);
    },
  });

  // Disabled once already approved OR lifecycleState has passed PRE_RELEASE_STATES
  const disabled = alreadyApproved || !inPreReleaseState || mutation.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-text-primary text-sm font-medium">
            Step 1 — Presiding Officer Approval
          </p>
          <p className="text-text-muted text-xs">
            {alreadyApproved
              ? 'Already approved by presiding officer.'
              : inPreReleaseState
                ? 'Approve this request as Presiding Officer (Vice Mayor).'
                : 'Request has moved past the approval stage.'}
          </p>
        </div>
        <Button
          id={`btn-po-approve-${requestId}`}
          size="sm"
          variant={alreadyApproved ? 'outline' : 'default'}
          disabled={disabled}
          onClick={() => mutation.mutate({ requestId })}
          className={cn(alreadyApproved && 'border-success-300 text-success-700')}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : alreadyApproved ? (
            <>
              <CheckCircle2 className="text-success-600 mr-1.5 h-4 w-4" />
              Approved
            </>
          ) : (
            'Approve as Presiding Officer'
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── SecretaryApproveButton ───────────────────────────────────────────────────

/**
 * Enable only when:
 *  - vmApproved === true   (backend throws PRECONDITION_FAILED otherwise — confirmed by reading
 *                           approveAsSecretary's full body at lines 335–424 of document-requests.router.ts)
 *  - inPreReleaseState     (not yet 'completed'; secretary approval transitions to 'completed')
 *  - not already approved  (spApproved === false)
 */
function SecretaryApproveButton({
  requestId,
  vmApproved,
  alreadyApproved,
  inPreReleaseState,
  onSuccess,
}: {
  requestId: string;
  vmApproved: boolean;
  alreadyApproved: boolean;
  inPreReleaseState: boolean;
  onSuccess: () => void;
}) {
  const mutation = trpc.documents.approveAsSecretary.useMutation({
    onSuccess() {
      toast.success('Secretary approval recorded. Request is now completed.');
      onSuccess();
    },
    onError(err) {
      toast.error(`Approval failed: ${err.message}`);
    },
  });

  const disabled = alreadyApproved || !vmApproved || !inPreReleaseState || mutation.isPending;

  let hint: string;
  if (alreadyApproved) {
    hint = 'Already approved by SP Secretary.';
  } else if (!vmApproved) {
    hint = 'Waiting for Presiding Officer approval first.';
  } else if (!inPreReleaseState) {
    hint = 'Request has moved past the approval stage.';
  } else {
    hint = 'Both approvals complete this request and transition it to "completed".';
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-text-primary text-sm font-medium">Step 2 — SP Secretary Approval</p>
          <p className="text-text-muted text-xs">{hint}</p>
        </div>
        <Button
          id={`btn-sec-approve-${requestId}`}
          size="sm"
          variant={alreadyApproved ? 'outline' : 'default'}
          disabled={disabled}
          onClick={() => mutation.mutate({ requestId })}
          className={cn(alreadyApproved && 'border-success-300 text-success-700')}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : alreadyApproved ? (
            <>
              <CheckCircle2 className="text-success-600 mr-1.5 h-4 w-4" />
              Approved
            </>
          ) : (
            'Approve as Secretary'
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── ReleaseCopyPanel ─────────────────────────────────────────────────────────

/**
 * Release is enabled when lifecycleState === 'completed' (both approvals done).
 * Payment fields (orNumber, collectingOfficer, amountPaid) are ALL optional —
 * they do NOT block release per Q-D04 / Phase 1 stub comment in router.
 */
function ReleaseCopyPanel({
  requestId,
  isCompleted,
  isReleased,
  onSuccess,
}: {
  requestId: string;
  isCompleted: boolean;
  isReleased: boolean;
  onSuccess: () => void;
}) {
  const [orNumber, setOrNumber] = useState('');
  const [collectingOfficer, setCollectingOfficer] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  const mutation = trpc.documents.releaseCopy.useMutation({
    onSuccess() {
      toast.success('Copy released to requester.');
      setOrNumber('');
      setCollectingOfficer('');
      setAmountPaid('');
      onSuccess();
    },
    onError(err) {
      toast.error(`Release failed: ${err.message}`);
    },
  });

  function handleRelease() {
    const parsedAmount = amountPaid ? parseFloat(amountPaid) : undefined;
    mutation.mutate({
      requestId,
      orNumber: orNumber || undefined,
      collectingOfficer: collectingOfficer || undefined,
      amountPaid: parsedAmount && parsedAmount > 0 ? parsedAmount : undefined,
    });
  }

  if (isReleased) {
    return (
      <div className="bg-success-50 border-success-200 text-success-700 flex items-center gap-2 rounded-md border px-4 py-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        This request has been released.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-text-primary text-sm font-medium">Step 3 — Release Copy to Requester</p>
        <p className="text-text-muted text-xs">
          {isCompleted
            ? 'Both approvals complete. Payment details are optional (Phase 1 — payment system deferred to Phase 2).'
            : 'Awaiting both approvals before release is available.'}
        </p>
      </div>

      {/* Payment fields — optional, never block release */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`or-number-${requestId}`} className="text-xs">
            OR Number <span className="text-text-muted font-normal">(optional)</span>
          </Label>
          <Input
            id={`or-number-${requestId}`}
            placeholder="e.g. 12345678"
            value={orNumber}
            onChange={(e) => setOrNumber(e.target.value)}
            disabled={!isCompleted || mutation.isPending}
            maxLength={64}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`collecting-officer-${requestId}`} className="text-xs">
            Collecting Officer <span className="text-text-muted font-normal">(optional)</span>
          </Label>
          <Input
            id={`collecting-officer-${requestId}`}
            placeholder="Officer name"
            value={collectingOfficer}
            onChange={(e) => setCollectingOfficer(e.target.value)}
            disabled={!isCompleted || mutation.isPending}
            maxLength={256}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`amount-paid-${requestId}`} className="text-xs">
            Amount Paid (₱) <span className="text-text-muted font-normal">(optional)</span>
          </Label>
          <Input
            id={`amount-paid-${requestId}`}
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            disabled={!isCompleted || mutation.isPending}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          id={`btn-release-${requestId}`}
          size="sm"
          // Enable when completed, regardless of whether any payment field is filled
          disabled={!isCompleted || mutation.isPending}
          onClick={handleRelease}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Releasing…
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-4 w-4" />
              Release Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── DocumentRequestDetailSkeleton ────────────────────────────────────────────

function DocumentRequestDetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// ─── DetailRow ────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-text-muted text-xs">{label}</p>
      <p className="text-text-primary text-sm">{value}</p>
    </div>
  );
}
