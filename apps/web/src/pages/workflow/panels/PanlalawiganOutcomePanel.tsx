import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Card, CardHeader, CardTitle, CardContent, Button, Textarea,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

// recordPanlalawiganOutcome: { stepInstanceId, outcome, controlNumber?, panlalawiganResolutionNumber?, dateReferred?, remarks? }
// resolveValidInPart: { documentId, resolutionPath, mandatoryComment }   ← takes documentId, NOT stepInstanceId
// confirmPanlalawiganDeemedApproved: { stepInstanceId }  only
export function PanlalawiganOutcomePanel({ instance }: { instance: RouterOutputs['workflow']['getInstance'] }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [outcome, setOutcome] = useState<'VALID' | 'VALID_IN_PART' | 'OPERATIVE_IN_ITS_ENTIRETY' | 'RETURNED' | ''>('');
  const [remarks, setRemarks] = useState('');

  const [resolutionPath, setResolutionPath] = useState<'resolve_as_is' | 'route_to_legal' | 'route_to_committee' | 'implement_directly'>('resolve_as_is');
  const [mandatoryComment, setMandatoryComment] = useState('');

  const recordMutation = trpc.workflow.recordPanlalawiganOutcome.useMutation({
    onSuccess: () => {
      toast.success('Outcome recorded.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to record outcome.'),
  });

  const resolveMutation = trpc.workflow.resolveValidInPart.useMutation({
    onSuccess: () => {
      toast.success('Valid-in-part resolved.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to resolve valid-in-part.'),
  });

  const confirmDeemedMutation = trpc.workflow.confirmPanlalawiganDeemedApproved.useMutation({
    onSuccess: () => {
      toast.success('Deemed approved confirmed.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
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

        {/* Record Outcome */}
        <div className="space-y-3 border p-4 rounded-md">
          <h3 className="font-medium text-sm">Record Outcome</h3>
          <Select value={outcome} onValueChange={(val: 'VALID' | 'VALID_IN_PART' | 'OPERATIVE_IN_ITS_ENTIRETY' | 'RETURNED' | '') => setOutcome(val)}>
            <SelectTrigger><SelectValue placeholder="Select outcome…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="VALID">Valid</SelectItem>
              <SelectItem value="VALID_IN_PART">Valid in Part</SelectItem>
              <SelectItem value="OPERATIVE_IN_ITS_ENTIRETY">Operative in its Entirety</SelectItem>
              <SelectItem value="RETURNED">Returned</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Remarks (optional)…"
          />
          <Button
            onClick={() => {
              if (!outcome) { toast.error('Outcome is required'); return; }
              recordMutation.mutate({
                stepInstanceId: instance.currentStepInstanceId,
                outcome,
                remarks: remarks || undefined,
              });
            }}
            disabled={recordMutation.isPending}
          >
            Record Outcome
          </Button>
        </div>

        {/* Resolve Valid in Part */}
        <div className="space-y-3 border p-4 rounded-md">
          <h3 className="font-medium text-sm">Resolve Valid in Part</h3>
          <Select value={resolutionPath} onValueChange={(val: 'resolve_as_is' | 'route_to_legal' | 'route_to_committee' | 'implement_directly') => setResolutionPath(val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="resolve_as_is">Resolve As-Is</SelectItem>
              <SelectItem value="route_to_legal">Route to Legal</SelectItem>
              <SelectItem value="route_to_committee">Route to Committee</SelectItem>
              <SelectItem value="implement_directly">Implement Directly</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={mandatoryComment}
            onChange={(e) => setMandatoryComment(e.target.value)}
            placeholder="Comment (required)…"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!mandatoryComment) { toast.error('Comment is required'); return; }
              resolveMutation.mutate({
                documentId: instance.documentId,
                resolutionPath,
                mandatoryComment,
              });
            }}
            disabled={resolveMutation.isPending}
          >
            Resolve
          </Button>
        </div>

        {/* Confirm 30-Day Deemed Approved */}
        <div className="flex items-center justify-between border p-4 rounded-md">
          <div>
            <h3 className="font-medium text-sm">Confirm 30-Day Deemed Approved</h3>
            <p className="text-xs text-muted-foreground">RA 7160 §56(d) — 30-day window elapsed.</p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              confirmDeemedMutation.mutate({ stepInstanceId: instance.currentStepInstanceId })
            }
            disabled={confirmDeemedMutation.isPending}
          >
            Confirm
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
