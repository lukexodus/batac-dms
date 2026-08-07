import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

// logDocketingCompletion: input is { stepInstanceId } only.
export function DocketingPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const logMutation = trpc.workflow.logDocketingCompletion.useMutation({
    onSuccess: () => {
      toast.success('Docketing completed.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to complete docketing.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Docketing Completion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Docketing is the final step where the physical document is officially filed in the records.</p>
          <p>Ensure the QR cover page has been printed and attached to the physical copy, and it has been stored in the designated filing cabinet.</p>
        </div>
        <Button
          onClick={() => logMutation.mutate({ stepInstanceId: instance.currentStepInstanceId })}
          disabled={logMutation.isPending}
        >
          {logMutation.isPending ? 'Logging...' : 'Complete Docketing'}
        </Button>
      </CardContent>
    </Card>
  );
}
