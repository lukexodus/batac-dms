import React from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// logDocketingCompletion: input is { stepInstanceId } only.
export function DocketingPanel({ instance }: { instance: any }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const logMutation = trpc.workflow.logDocketingCompletion.useMutation({
    onSuccess: () => {
      toast.success('Docketing completed.');
      utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
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
        <p className="text-sm text-muted-foreground">
          Confirm that the document has been docketed (QR cover page printed, filed, and logged).
        </p>
        <Button
          onClick={() =>
            logMutation.mutate({ stepInstanceId: instance.currentStepInstanceId })
          }
          disabled={logMutation.isPending}
        >
          {logMutation.isPending ? 'Logging...' : 'Complete Docketing'}
        </Button>
      </CardContent>
    </Card>
  );
}
