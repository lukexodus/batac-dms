import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent, Button, Textarea } from '@batac/ui';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function GenericActionPanel({ instance }: { instance: any }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState('');

  const completeMutation = trpc.workflow.completeActionStep.useMutation({
    onSuccess: () => {
      toast.success('Action step completed successfully.');
      utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      navigate('/workflow/steps');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to complete action step.');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Task</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Comment (optional)</label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Enter any comments..."
          />
        </div>
        <Button
          onClick={() =>
            completeMutation.mutate({
              stepInstanceId: instance.currentStepInstanceId,
              comment: comment || undefined,
            })
          }
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending ? 'Completing...' : 'Complete Task'}
        </Button>
      </CardContent>
    </Card>
  );
}
