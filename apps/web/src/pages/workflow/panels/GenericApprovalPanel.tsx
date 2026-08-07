import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor } from '@batac/ui';

import { isRichTextEmpty } from '@/lib/rich-text';
import { trpc, type RouterOutputs } from '@/lib/trpc';

export function GenericApprovalPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState('');

  const approveMutation = trpc.workflow.approveStep.useMutation({
    onSuccess: () => {
      toast.success('Step approved.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      void utils.documents.list.invalidate();
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to approve.'),
  });

  const rejectMutation = trpc.workflow.rejectStep.useMutation({
    onSuccess: () => {
      toast.success('Step rejected.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to reject.'),
  });

  const returnMutation = trpc.workflow.returnStepForRevision.useMutation({
    onSuccess: () => {
      toast.success('Step returned for revision.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to return for revision.'),
  });

  const amendMutation = trpc.workflow.submitApprovalOutcome.useMutation({
    onSuccess: () => {
      toast.success('Step marked as amended.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to submit amendment.'),
  });

  const busy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    returnMutation.isPending ||
    amendMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{instance.currentStepName ? `Decision: ${instance.currentStepName}` : 'Approval Decision'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Please review the document and provide your approval decision.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Approve:</strong> Endorses the document and advances it to the next workflow step.</li>
            <li><strong>Reject:</strong> Disapproves the document. This terminates the current workflow. A comment is required.</li>
            <li><strong>Return for Revision:</strong> Sends the document back to the originator for necessary corrections. A comment is required.</li>
            <li><strong>Approve with Amendments:</strong> Approves the document subject to the specified amendments in your comment.</li>
          </ul>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Comment <span className="text-muted-foreground">(required for reject/return)</span>
          </label>
          <RichTextEditor
            value={comment}
            onChange={setComment}
            placeholder="Enter comment..."
          />
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() =>
              approveMutation.mutate({
                stepInstanceId: instance.currentStepInstanceId,
                comment: comment || undefined,
              })
            }
            disabled={busy}
          >
            Approve & Advance Workflow
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (isRichTextEmpty(comment)) {
                toast.error('A comment is required for rejection');
                return;
              }
              rejectMutation.mutate({ stepInstanceId: instance.currentStepInstanceId, comment });
            }}
            disabled={busy}
          >
            Reject & Terminate Workflow
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (isRichTextEmpty(comment)) {
                toast.error('A comment is required when returning for revision');
                return;
              }
              returnMutation.mutate({ stepInstanceId: instance.currentStepInstanceId, comment });
            }}
            disabled={busy}
          >
            Return for Revision
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              amendMutation.mutate({
                stepInstanceId: instance.currentStepInstanceId,
                outcome: 'AMENDED',
                comment: comment || undefined,
              });
            }}
            disabled={busy}
          >
            Approve with Amendments
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
