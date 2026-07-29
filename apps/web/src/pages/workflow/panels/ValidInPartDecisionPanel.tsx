import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, Textarea } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

export function ValidInPartDecisionPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [remarks, setRemarks] = useState('');

  const submitOutcomeMutation = trpc.workflow.submitApprovalOutcome.useMutation({
    onSuccess: () => {
      toast.success('Decision logged successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to log decision.'),
  });

  const mutate = (
    outcome: 'RESOLVED_IN_PLACE' | 'ROUTED_TO_LEGAL' | 'ROUTED_TO_COMMITTEE' | 'REVISED_DIRECTLY',
    requireRemarks: boolean,
  ) => {
    if (requireRemarks && !remarks) {
      toast.error('Remarks are required for this decision.');
      return;
    }
    submitOutcomeMutation.mutate({
      stepInstanceId: instance.currentStepInstanceId,
      outcome,
      comment: remarks || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>VALID-IN-PART — Resolution Path</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Remarks</label>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter remarks..."
          />
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => mutate('RESOLVED_IN_PLACE', true)} disabled={submitOutcomeMutation.isPending}>
            Resolve In Place
          </Button>
          <Button
            variant="outline"
            onClick={() => mutate('ROUTED_TO_LEGAL', false)}
            disabled={submitOutcomeMutation.isPending}
          >
            Route to Legal Office
          </Button>
          <Button
            variant="outline"
            onClick={() => mutate('ROUTED_TO_COMMITTEE', false)}
            disabled={submitOutcomeMutation.isPending}
          >
            Route to Committee
          </Button>
          <Button
            variant="outline"
            onClick={() => mutate('REVISED_DIRECTLY', true)}
            disabled={submitOutcomeMutation.isPending}
          >
            Revise Directly
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
