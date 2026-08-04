import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, Textarea } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

export function TransmittalLetterPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState('');

  const completeMutation = trpc.workflow.completeActionStep.useMutation({
    onSuccess: () => {
      toast.success('Transmittal letter logged. Mayor review timer started.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to complete transmittal letter step.');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transmittal Letter to Mayor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Generate and send the transmittal letter (SPS format) to the Office of the Mayor,
          forwarding the approved document for the Mayor's review.
        </p>
        <p className="text-sm font-medium text-amber-600">
          Completing this step starts the Mayor's 10-day review window.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium">Remarks (optional)</label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Enter any remarks about the transmittal..."
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
          {completeMutation.isPending ? 'Completing...' : 'Confirm Transmittal Sent'}
        </Button>
      </CardContent>
    </Card>
  );
}
