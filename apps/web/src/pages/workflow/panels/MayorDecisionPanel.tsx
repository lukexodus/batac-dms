import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, Textarea } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

// mayorSign: { stepInstanceId } only.
// mayorVeto: { stepInstanceId, objectionsText: string (required) }.
export function MayorDecisionPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [objectionsText, setObjectionsText] = useState('');

  const signMutation = trpc.workflow.mayorSign.useMutation({
    onSuccess: () => {
      toast.success('Document signed.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.documents.list.invalidate();
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to sign.'),
  });

  const vetoMutation = trpc.workflow.mayorVeto.useMutation({
    onSuccess: () => {
      toast.success('Document vetoed.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to veto.'),
  });

  const busy = signMutation.isPending || vetoMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mayor Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Objections <span className="text-muted-foreground">(required for veto)</span>
          </label>
          <Textarea
            value={objectionsText}
            onChange={(e) => setObjectionsText(e.target.value)}
            placeholder="Describe objections..."
          />
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => signMutation.mutate({ stepInstanceId: instance.currentStepInstanceId })}
            disabled={busy}
          >
            Sign
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!objectionsText) {
                toast.error('Objections text is required to veto');
                return;
              }
              vetoMutation.mutate({
                stepInstanceId: instance.currentStepInstanceId,
                objectionsText,
              });
            }}
            disabled={busy}
          >
            Veto
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
