import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

export function PortalPublicationPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const completeMutation = trpc.workflow.completePortalPublicationStep.useMutation({
    onSuccess: () => {
      toast.success('Document published to the public portal.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => {
      if (err.data?.code === 'PRECONDITION_FAILED') {
        toast.error(
          'This document cannot be published yet — it may not have completed an earlier required step.',
        );
        return;
      }
      toast.error(err.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish to Public Portal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Completing this step will make the document&apos;s title and first page publicly visible
            on the portal.
          </p>
          <p>Confirm that the document is ready for public release before continuing.</p>
        </div>
        <Button
          onClick={() =>
            completeMutation.mutate({
              stepInstanceId: instance.currentStepInstanceId,
              comment: undefined,
            })
          }
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending ? 'Publishing...' : 'Publish to Public Portal'}
        </Button>
      </CardContent>
    </Card>
  );
}
