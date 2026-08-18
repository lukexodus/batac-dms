import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor } from '@batac/ui';

import { isRichTextEmpty } from '@/lib/rich-text';
import { trpc, type RouterOutputs } from '@/lib/trpc';

type ProvisionEntry = {
  id: string;
  identifier: string;
  reason: string;
};

function createProvisionEntry(): ProvisionEntry {
  return { id: crypto.randomUUID(), identifier: '', reason: '' };
}

export function GenericActionPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState('');
  const [provisions, setProvisions] = useState<ProvisionEntry[]>([createProvisionEntry()]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const updateProvision = (id: string, field: 'identifier' | 'reason', value: string) => {
    setProvisions((current) =>
      current.map((provision) =>
        provision.id === id ? { ...provision, [field]: value } : provision,
      ),
    );
  };

  const serializeProvisionsComment = () => {
    const completeProvisions = provisions
      .filter(({ identifier, reason }) => identifier.trim() && reason.trim())
      .map(({ identifier, reason }) => `- ${identifier.trim()}: ${reason.trim()}`);
    const provisionComment = completeProvisions.length
      ? `Invalidated provisions:\n${completeProvisions.join('\n')}`
      : '';

    return isRichTextEmpty(additionalNotes)
      ? provisionComment
      : [provisionComment, additionalNotes].filter(Boolean).join('\n\n');
  };

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
        {instance.currentStepKey === 'valid_in_part_action' ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Invalidated provisions</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setProvisions((current) => [...current, createProvisionEntry()])}
                >
                  Add provision
                </Button>
              </div>
              {provisions.map((provision, index) => (
                <div
                  key={provision.id}
                  className="grid gap-3 border-t pt-3 md:grid-cols-[1fr_2fr_auto] md:items-start"
                >
                  <div>
                    <label
                      htmlFor={`provision-identifier-${provision.id}`}
                      className="mb-1 block text-sm font-medium"
                    >
                      Identifier
                    </label>
                    <input
                      id={`provision-identifier-${provision.id}`}
                      type="text"
                      value={provision.identifier}
                      onChange={(event) =>
                        updateProvision(provision.id, 'identifier', event.target.value)
                      }
                      placeholder="e.g., Section 4.2"
                      className="focus:ring-ring h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`provision-reason-${provision.id}`}
                      className="mb-1 block text-sm font-medium"
                    >
                      Reason
                    </label>
                    <textarea
                      id={`provision-reason-${provision.id}`}
                      value={provision.reason}
                      onChange={(event) =>
                        updateProvision(provision.id, 'reason', event.target.value)
                      }
                      placeholder="Why was this provision invalidated?"
                      rows={2}
                      className="focus:ring-ring w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6"
                    onClick={() =>
                      setProvisions((current) => current.filter(({ id }) => id !== provision.id))
                    }
                    disabled={provisions.length === 1}
                    aria-label={`Remove provision ${index + 1}`}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Additional notes (optional)</label>
              <RichTextEditor
                value={additionalNotes}
                onChange={setAdditionalNotes}
                placeholder="Enter any additional notes..."
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">
              Comment ({instance.currentStepKey === 'valid_in_part_action' ? 'required' : 'optional'})
            </label>
            <RichTextEditor
              value={comment}
              onChange={setComment}
              placeholder="Enter any comments..."
            />
          </div>
        )}
        <Button
          onClick={() =>
            completeMutation.mutate({
              stepInstanceId: instance.currentStepInstanceId,
              comment:
                (instance.currentStepKey === 'valid_in_part_action'
                  ? serializeProvisionsComment()
                  : comment) || undefined,
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
