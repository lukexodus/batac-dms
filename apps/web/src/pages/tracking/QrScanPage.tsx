import { Scanner } from '@yudiel/react-qr-scanner';
import { Camera, Search, AlertCircle, FileText, Download } from 'lucide-react';
import React, { useState } from 'react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Skeleton,
  RoutingHistoryTimeline,
} from '@batac/ui';

import type { RoutingEntry } from '@batac/ui';

import { hasRole } from '@/lib/auth-helpers';
import { trpc, type RouterOutputs } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

const PAGE_ALLOWED_ROLES = [
  'records_officer',
  'dept_encoder',
  'dept_approver',
  'sp_secretary',
  'sp_member',
  'sp_presiding_officer',
  'mayor',
  'brgy_encoder',
  'brgy_captain',
  'auditor',
] as const;

export function QrScanPage() {
  const identity = useSessionStore((s) => s.identity);

  if (!hasRole(identity, ...PAGE_ALLOWED_ROLES)) {
    return (
      <div className="text-text-muted flex flex-col items-center justify-center p-8">
        You do not have permission to view this page.
      </div>
    );
  }

  return <QrScanContent />;
}

function formatActionDescription(raw: string): string {
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

function QrScanContent() {
  const [trackingIdInput, setTrackingIdInput] = useState('');
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);

  const handleScan = (result: string) => {
    if (result) {
      setTrackingIdInput(result);
      setActiveTrackingId(result);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingIdInput.trim()) {
      setActiveTrackingId(trackingIdInput.trim());
    }
  };

  const {
    data: scanResult,
    error: scanError,
    isLoading: isScanLoading,
  } = trpc.tracking.scanQrCodeAuthenticated.useQuery(
    { qrTrackingNumber: activeTrackingId! },
    { enabled: !!activeTrackingId, retry: false }
  );

  const isNotFound = scanError?.data?.code === 'NOT_FOUND';

  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-6 py-8">
      <div>
        <h1 className="text-text-primary text-2xl font-bold">Scan Document QR</h1>
        <p className="text-text-muted text-sm">
          Scan a document's QR code or enter its tracking number to view its details.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5" /> Camera Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg overflow-hidden border bg-gray-50 aspect-video flex items-center justify-center">
              <Scanner 
                onScan={(detectedCodes) => {
                  const code = detectedCodes[0];
                  if (code) {
                     handleScan(code.rawValue);
                  }
                }}
                onError={(err) => {
                  // eslint-disable-next-line no-console
                  console.error(err);
                }}
              />
            </div>
            
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Enter tracking ID..."
                value={trackingIdInput}
                onChange={(e) => setTrackingIdInput(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
                <Search className="h-4 w-4 mr-2" /> Search
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!activeTrackingId && (
            <div className="border border-dashed rounded-lg p-12 text-center text-text-muted">
              Point your camera at a document QR code or enter a tracking ID to begin.
            </div>
          )}

          {isScanLoading && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          )}

          {isNotFound && (
            <Card className="border-danger-200 bg-danger-50">
              <CardContent className="p-6 text-center space-y-2 text-danger-700">
                <AlertCircle className="h-8 w-8 mx-auto text-danger-500" />
                <h3 className="font-semibold text-lg">Invalid Tracking ID</h3>
                <p className="text-sm">
                  The QR code or tracking number '{activeTrackingId}' was not found or is invalid.
                </p>
              </CardContent>
            </Card>
          )}

          {scanResult && <ScanResultView result={scanResult} />}
        </div>
      </div>
    </div>
  );
}

function ScanResultView({ result }: { result: RouterOutputs['tracking']['scanQrCodeAuthenticated'] }) {
  const documentId = result.documentId;

  const { data: docData, isLoading: isDocLoading } = trpc.documents.get.useQuery(
    { documentId },
    { enabled: !!documentId }
  );

  const { data: workflowData, isLoading: isWorkflowLoading } = trpc.workflow.getActiveInstanceForDocument.useQuery(
    { documentId },
    { enabled: !!documentId }
  );

  const { data: users } = trpc.iam.listAllUsers.useQuery(undefined, {
    staleTime: Infinity,
  });

  if (isDocLoading || isWorkflowLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
           <Skeleton className="h-6 w-1/3" />
           <Skeleton className="h-4 w-1/2" />
           <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const createdByUserId = docData?.createdBy;
  const createdByUser = users?.find(u => u.id === createdByUserId);
  const loggedByName = createdByUser?.displayName ?? (createdByUserId ? createdByUserId.slice(0, 8) : 'Unknown');

  const metadata = docData?.metadata as Record<string, unknown> | undefined;
  const sponsors = Array.isArray(metadata?.['sponsors']) && metadata?.['sponsors'].length > 0 ? (metadata?.['sponsors'] as { name: string }[]) : null;
  const authoredBy = sponsors ? sponsors.map(s => s.name).join(', ') : null;

  const routingEntries: RoutingEntry[] = result.fullRoutingHistory.map((e, index) => ({
    id: `scan-history-${index}`,
    actorName: e.actorDisplayName,
    actorOfficeName: '',
    action: deriveRoutingAction(e.actionDescription),
    timestamp: new Date(e.timestamp),
    notes: formatActionDescription(e.actionDescription)
  }));

  let wfStepDisplay = "Not yet in workflow";
  if (workflowData !== null) {
    let assigneeName = "Unassigned";
    if (workflowData?.currentAssigneeUserId) {
      const foundUser = users?.find(u => u.id === workflowData.currentAssigneeUserId);
      assigneeName = foundUser?.displayName ?? foundUser?.username ?? workflowData.currentAssigneeUserId;
    }
    const stepName = workflowData?.currentStepName ?? workflowData?.currentStepType;
    wfStepDisplay = `${stepName} — ${assigneeName}`;
  }

  return (
    <div className="space-y-6">
      <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <FileText className="h-5 w-5" /> Document Found
           </CardTitle>
         </CardHeader>
         <CardContent className="space-y-6">
            
            {result.firstPageImageUrl && (
              <div className="aspect-[3/4] max-w-sm rounded-lg border overflow-hidden bg-gray-100">
                <img src={result.firstPageImageUrl} alt="Document first page preview" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div className="text-text-muted">Type</div>
              <div className="font-medium">{result.documentType}</div>
              
              <div className="text-text-muted">Logged by</div>
              <div className="font-medium">{loggedByName}</div>

              {authoredBy && (
                <>
                  <div className="text-text-muted">Authored by</div>
                  <div className="font-medium">{authoredBy}</div>
                </>
              )}

              <div className="text-text-muted">Workflow Step</div>
              <div className="font-medium">{wfStepDisplay}</div>
            </div>

            {result.getCopyAvailable && (
               <Button className="w-full">
                 <Download className="mr-2 w-4 h-4" /> Get a copy
               </Button>
            )}
         </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routing History</CardTitle>
        </CardHeader>
        <CardContent>
          <RoutingHistoryTimeline entries={routingEntries} />
        </CardContent>
      </Card>
    </div>
  );
}
