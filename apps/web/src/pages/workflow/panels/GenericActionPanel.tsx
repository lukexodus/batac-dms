import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

export function GenericActionPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState('');

  const completeMutation = trpc.workflow.completeActionStep.useMutation({
    onSuccess: () => {
      toast.success('Action step completed successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to complete action step.');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{instance.currentStepName ? `Complete Task: ${instance.currentStepName}` : 'Complete Task'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {instance.currentStepKey === 'final_number_assignment' ? (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>The final series number for this document has already been assigned automatically.</p>
            <p>Complete this step to advance the workflow.</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Please review the document and complete the required tasks for this step.</p>
            <p>Completing this action will advance the document to the next stage of its workflow.</p>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Comment (optional)</label>
          <RichTextEditor
            value={comment}
            onChange={setComment}
            placeholder="Enter any comments..."
          />
        </div>
        <Button
          onClick={() =>
            completeMutation.mutate({
              stepInstanceId: instance.currentStepInstanceId,
              comment: comment || undefined,
            })
          }
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending ? 'Completing...' : `Advance Workflow: ${instance.currentStepName || 'Complete Task'}`}
        </Button>
      </CardContent>
    </Card>
  );
}
