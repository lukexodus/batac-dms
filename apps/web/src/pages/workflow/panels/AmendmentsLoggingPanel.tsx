import { Edit3 } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor } from '@batac/ui';

import { isRichTextEmpty } from '@/lib/rich-text';
import { trpc, type RouterOutputs } from '@/lib/trpc';

export function AmendmentsLoggingPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState('');

  const completeMutation = trpc.workflow.completeActionStep.useMutation({
    onSuccess: () => {
      toast.success('Amendments logged successfully.');
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
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="h-5 w-5 text-primary-500" />
          Amendments Logging
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>This document was approved with amendments during its reading. Before it can advance, the specific amendments must be logged into the system.</p>
          <p>Enter the exact text of the amendments below. This will be recorded in the document's history and applied to the final version.</p>
        </div>
        
        <div>
          <label className="mb-1 block text-sm font-medium">Amendments Detail <span className="text-danger-500">*</span></label>
          <RichTextEditor
            value={comment}
            onChange={setComment}
            placeholder="Describe the amendments made to the document..."
          />
        </div>
        
        <Button
          onClick={() =>
            completeMutation.mutate({
              stepInstanceId: instance.currentStepInstanceId,
              comment: comment,
            })
          }
          disabled={completeMutation.isPending || isRichTextEmpty(comment)}
        >
          {completeMutation.isPending ? 'Completing...' : 'Log Amendments & Advance Workflow'}
        </Button>
      </CardContent>
    </Card>
  );
}
