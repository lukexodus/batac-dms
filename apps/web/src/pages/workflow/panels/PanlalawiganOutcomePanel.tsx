import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  RichTextEditor,
} from '@batac/ui';

import { isRichTextEmpty } from '@/lib/rich-text';
import { trpc, type RouterOutputs } from '@/lib/trpc';

// recordPanlalawiganOutcome: { stepInstanceId, outcome, controlNumber?, panlalawiganResolutionNumber?, dateReferred?, remarks? }
// resolveValidInPart: { documentId, resolutionPath, mandatoryComment }   ← takes documentId, NOT stepInstanceId
// confirmPanlalawiganDeemedApproved: { stepInstanceId }  only
export function PanlalawiganOutcomePanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [outcome, setOutcome] = useState<
    'VALID' | 'VALID_IN_PART' | 'OPERATIVE_IN_ITS_ENTIRETY' | 'RETURNED' | ''
  >('');
  const [remarks, setRemarks] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const panlalawiganActionDeadline = instance.panlalawiganActionDeadline;
  useEffect(() => {
    if (!panlalawiganActionDeadline) return;

    const remainingMs = new Date(panlalawiganActionDeadline).getTime() - Date.now();
    if (remainingMs <= 0) {
      setNow(Date.now());
      return;
    }

    const timer = window.setTimeout(() => setNow(Date.now()), remainingMs);
    return () => window.clearTimeout(timer);
  }, [panlalawiganActionDeadline]);

  const deemedApprovedWindowElapsed =
    instance.panlalawiganActionDeadlineElapsed &&
    !!panlalawiganActionDeadline &&
    now >= new Date(panlalawiganActionDeadline).getTime();

  const [resolutionPath, setResolutionPath] = useState<
    'resolve_as_is' | 'route_to_legal' | 'route_to_committee' | 'implement_directly'
  >('resolve_as_is');
  const [mandatoryComment, setMandatoryComment] = useState('');
  const canResolveValidInPart = outcome === 'VALID_IN_PART';

  const recordMutation = trpc.workflow.recordPanlalawiganOutcome.useMutation({
    onSuccess: () => {
      toast.success('Outcome recorded.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to record outcome.'),
  });

  const resolveMutation = trpc.workflow.resolveValidInPart.useMutation({
    onSuccess: () => {
      toast.success('Valid-in-part resolved.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to resolve valid-in-part.'),
  });

  const confirmDeemedMutation = trpc.workflow.confirmPanlalawiganDeemedApproved.useMutation({
    onSuccess: () => {
      toast.success('Deemed approved confirmed.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.documents.list.invalidate();
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to confirm deemed approved.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Panlalawigan Outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground space-y-2 mb-4">
          <p>Record the review outcome from the Sangguniang Panlalawigan (Provincial Board).</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Valid / Operative in its Entirety:</strong> The document is fully approved.</li>
            <li><strong>Valid in Part:</strong> Some provisions were invalidated. You must select a resolution path (e.g., Route to Legal, Implement Directly).</li>
            <li><strong>Returned:</strong> The document was returned for revisions.</li>
            <li><strong>30-Day Deemed Approved:</strong> Under RA 7160 §56(d), if no action is taken within 30 days, it is deemed approved.</li>
          </ul>
        </div>
        {/* Record Outcome */}
        <div className="space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-medium">Record Outcome</h3>
          <Select
            value={outcome}
            onValueChange={(
              val: 'VALID' | 'VALID_IN_PART' | 'OPERATIVE_IN_ITS_ENTIRETY' | 'RETURNED' | '',
            ) => setOutcome(val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select outcome…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VALID">Valid</SelectItem>
              <SelectItem value="VALID_IN_PART">Valid in Part</SelectItem>
              {instance.documentTypeCode === 'appropriation_ordinance' && (
                <SelectItem value="OPERATIVE_IN_ITS_ENTIRETY">Operative in its Entirety</SelectItem>
              )}
              <SelectItem value="RETURNED">Returned</SelectItem>
            </SelectContent>
          </Select>
          <RichTextEditor
            value={remarks}
            onChange={setRemarks}
            placeholder="Remarks (optional)…"
          />
          <Button
            onClick={() => {
              if (!outcome) {
                toast.error('Outcome is required');
                return;
              }
              recordMutation.mutate({
                stepInstanceId: instance.currentStepInstanceId,
                outcome,
                remarks: remarks || undefined,
              });
            }}
            disabled={recordMutation.isPending}
          >
            Record Outcome & Advance Workflow
          </Button>
        </div>

        {/* Resolve Valid in Part */}
        <div
          className={`space-y-3 rounded-md border p-4 ${
            canResolveValidInPart ? '' : 'opacity-60'
          }`}
          aria-disabled={!canResolveValidInPart}
        >
          <h3 className="text-sm font-medium">Resolve Valid in Part</h3>
          {!canResolveValidInPart && (
            <p className="text-xs text-muted-foreground">
              Select “Valid in Part” under Record Outcome to enable this section.
            </p>
          )}
          <Select
            value={resolutionPath}
            disabled={!canResolveValidInPart}
            onValueChange={(
              val: 'resolve_as_is' | 'route_to_legal' | 'route_to_committee' | 'implement_directly',
            ) => setResolutionPath(val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resolve_as_is">Resolve As-Is</SelectItem>
              <SelectItem value="route_to_legal">Route to Legal</SelectItem>
              <SelectItem value="route_to_committee">Route to Committee</SelectItem>
              <SelectItem value="implement_directly">Implement Directly</SelectItem>
            </SelectContent>
          </Select>
          <RichTextEditor
            value={mandatoryComment}
            onChange={setMandatoryComment}
            placeholder="Comment (required)…"
            disabled={!canResolveValidInPart}
          />
          <Button
            variant="outline"
            onClick={() => {
              if (isRichTextEmpty(mandatoryComment)) {
                toast.error('Comment is required');
                return;
              }
              resolveMutation.mutate({
                documentId: instance.documentId,
                resolutionPath,
                mandatoryComment,
              });
            }}
            disabled={!canResolveValidInPart || resolveMutation.isPending}
          >
            Resolve Valid in Part & Route
          </Button>
        </div>

        {/* Confirm 30-Day Deemed Approved */}
        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <h3 className="text-sm font-medium">Confirm 30-Day Deemed Approved</h3>
            <p className="text-muted-foreground text-xs">
              RA 7160 §56(d) —{' '}
              {deemedApprovedWindowElapsed ? '30-day window elapsed.' : 'Available after the 30-day window.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={() =>
                confirmDeemedMutation.mutate({ stepInstanceId: instance.currentStepInstanceId })
              }
              disabled={confirmDeemedMutation.isPending || !deemedApprovedWindowElapsed}
            >
              Confirm Deemed Approved
            </Button>
            <p className="text-xs text-muted-foreground">
              {deemedApprovedWindowElapsed
                ? 'Records an acknowledgment; the timer job advances the workflow.'
                : 'Confirmation is disabled until the deadline.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
