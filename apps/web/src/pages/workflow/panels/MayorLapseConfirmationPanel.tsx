import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

// logMayorLapseConfirmation: input is { stepInstanceId } only.
export function MayorLapseConfirmationPanel({ instance }: { instance: RouterOutputs['workflow']['getInstance'] }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const confirmMutation = trpc.workflow.logMayorLapseConfirmation.useMutation({
    onSuccess: () => {
      toast.success('10-day lapse confirmed.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to confirm lapse.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm Mayor Action Lapse (RA 7160 §47)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The 10-day review window has elapsed without action from the Mayor. Confirming will
          record the lapse and advance the workflow.
        </p>
        <Button
          onClick={() =>
            confirmMutation.mutate({ stepInstanceId: instance.currentStepInstanceId })
          }
          disabled={confirmMutation.isPending}
        >
          {confirmMutation.isPending ? 'Confirming...' : 'Confirm 10-Day Lapse'}
        </Button>
      </CardContent>
    </Card>
  );
}
