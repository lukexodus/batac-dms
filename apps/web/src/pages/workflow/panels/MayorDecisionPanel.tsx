import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor } from '@batac/ui';

import { isRichTextEmpty } from '@/lib/rich-text';
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
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            The Sangguniang Panlungsod has passed this document and transmitted it for the Mayor's decision.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Sign & Approve:</strong> Enacts the document. It will advance to the next stage (e.g., Sangguniang Panlalawigan review for ordinances).</li>
            <li><strong>Veto:</strong> Rejects the document. You must provide specific objections. It will be returned to the Sangguniang Panlungsod for a potential override vote.</li>
          </ul>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Objections <span className="text-muted-foreground">(required for veto)</span>
          </label>
          <RichTextEditor
            value={objectionsText}
            onChange={setObjectionsText}
            placeholder="Describe objections..."
          />
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => signMutation.mutate({ stepInstanceId: instance.currentStepInstanceId })}
            disabled={busy}
          >
            Sign & Approve Document
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (isRichTextEmpty(objectionsText)) {
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
            Veto & Return to Sanggunian
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
