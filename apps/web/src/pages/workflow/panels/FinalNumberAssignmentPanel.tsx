import { CheckCircle2, Hash } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

export function FinalNumberAssignmentPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [assignedNumber, setAssignedNumber] = useState<string | null>(null);

  const { data: document } = trpc.documents.get.useQuery({
    documentId: instance.documentId,
  });

  const assignNumberMutation = trpc.documents.assignFinalNumber.useMutation();

  const completeMutation = trpc.workflow.completeActionStep.useMutation({
    onSuccess: () => {
      toast.success('Final number assigned and task completed.');
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

  const handleAssignAndComplete = async () => {
    try {
      let finalNum = document?.finalNumber || assignedNumber;

      // 1. Assign final number if not already assigned
      if (!finalNum) {
        const result = await assignNumberMutation.mutateAsync({
          documentId: instance.documentId,
        });
        finalNum = result.finalNumber;
        setAssignedNumber(finalNum);
      }

      // 2. Complete workflow step
      await completeMutation.mutateAsync({
        stepInstanceId: instance.currentStepInstanceId,
        comment: `Final number confirmed: ${finalNum}`,
      });
    } catch (err) {
      if (err instanceof Error && !completeMutation.isError) {
        toast.error(`Failed to assign final number: ${err.message}`);
      }
    }
  };

  const isSubmitting = assignNumberMutation.isPending || completeMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-primary-500" />
          Final Series Number Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {document?.finalNumber || assignedNumber ? (
          <div className="flex flex-col items-center justify-center p-6 bg-success-50 text-success-800 rounded-md border border-success-200">
            <CheckCircle2 className="h-8 w-8 mb-2" />
            <p className="text-sm font-medium">Official Number:</p>
            <p className="text-2xl font-bold">{document?.finalNumber || assignedNumber}</p>
            {completeMutation.isPending && (
              <p className="text-xs mt-2 text-success-600 animate-pulse">Completing task...</p>
            )}
            {!completeMutation.isSuccess && (
              <Button
                onClick={() => completeMutation.mutate({ stepInstanceId: instance.currentStepInstanceId, comment: `Final number confirmed: ${document?.finalNumber || assignedNumber}` })}
                disabled={completeMutation.isPending}
                className="mt-4"
              >
                {completeMutation.isPending ? 'Processing...' : 'Confirm & Advance Workflow'}
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This document has passed all required approvals. Click below to generate its official final series number and advance the workflow.
            </p>

            <Button
              onClick={handleAssignAndComplete}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? 'Processing...' : 'Generate Official Number'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
