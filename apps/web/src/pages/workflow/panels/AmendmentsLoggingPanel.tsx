import { Edit3 } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor } from '@batac/ui';

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
        <p className="text-sm text-muted-foreground">
          This document was approved with amendments during the Second Reading. Please log the specifics of the amendments below.
        </p>
        
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
          disabled={completeMutation.isPending || !comment.trim()}
        >
          {completeMutation.isPending ? 'Completing...' : 'Log Amendments & Complete Task'}
        </Button>
      </CardContent>
    </Card>
  );
}
