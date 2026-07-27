import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

// recordVetoOverrideVote: { stepInstanceId, votesFor, votesAgainst, absentCouncilorIds }
// Per consolidated ref Part 4.1/4.2: override succeeds at ≥ 8 of 12 (hardcoded server-side too).
export function VetoOverrideRecordingPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [votesFor, setVotesFor] = useState(0);
  const [votesAgainst, setVotesAgainst] = useState(0);

  const recordMutation = trpc.workflow.recordVetoOverrideVote.useMutation({
    onSuccess: () => {
      toast.success('Veto override vote recorded.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to record vote.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Veto Override Vote</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Override requires ≥ 8 of 12 SP members (RA 7160 §47). The server computes
          OVERRIDE_SUCCEEDED or OVERRIDE_FAILED from the vote counts.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Votes For</label>
            <Input
              type="number"
              min={0}
              max={12}
              value={votesFor}
              onChange={(e) => setVotesFor(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Votes Against</label>
            <Input
              type="number"
              min={0}
              max={12}
              value={votesAgainst}
              onChange={(e) => setVotesAgainst(Number(e.target.value))}
            />
          </div>
        </div>
        <Button
          onClick={() =>
            recordMutation.mutate({
              stepInstanceId: instance.currentStepInstanceId,
              votesFor,
              votesAgainst,
              absentCouncilorIds: [],
            })
          }
          disabled={recordMutation.isPending}
        >
          {recordMutation.isPending ? 'Recording...' : 'Record Vote'}
        </Button>
      </CardContent>
    </Card>
  );
}
