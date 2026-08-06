import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

export function ReturnedReviewDecisionPanel({
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

  const mutate = (outcome: 'REPASS' | 'RESOLVED_DIRECTLY') => {
    if (!remarks) {
      toast.error('Remarks are required for this decision.');
      return;
    }
    submitOutcomeMutation.mutate({
      stepInstanceId: instance.currentStepInstanceId,
      outcome,
      comment: remarks,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Returned Review Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Remarks</label>
          <RichTextEditor
            value={remarks}
            onChange={setRemarks}
            placeholder="Enter remarks..."
          />
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => mutate('REPASS')} disabled={submitOutcomeMutation.isPending}>
            Repass to Drafting
          </Button>
          <Button
            onClick={() => mutate('RESOLVED_DIRECTLY')}
            disabled={submitOutcomeMutation.isPending}
          >
            Resolve Directly
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
