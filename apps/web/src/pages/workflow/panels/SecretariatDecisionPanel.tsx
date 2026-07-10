import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent, Button, Textarea } from '@batac/ui';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// logSecretariatDecision requires sp_secretary role + stepInstanceId.
// The server-side auth check is roles-only (subject.roles.includes('sp_secretary')).
// The panelHint='secretariat_decision' is computed server-side via step config.assignee,
// which is the only stable proxy available without an extra office-lookup join.
// See LOG-0077 for the full reasoning.
export function SecretariatDecisionPanel({ instance }: { instance: any }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [remarks, setRemarks] = useState('');

  const logDecisionMutation = trpc.documents.logSecretariatDecision.useMutation({
    onSuccess: () => {
      toast.success('Decision logged successfully.');
      utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to log decision.'),
  });

  const mutate = (decision: 'approve' | 'reject' | 'amended', requireRemarks = false) => {
    if (requireRemarks && !remarks) {
      toast.error('Remarks are required for this decision.');
      return;
    }
    logDecisionMutation.mutate({
      documentId: instance.documentId,
      stepInstanceId: instance.currentStepInstanceId,
      decision,
      remarks: remarks || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Secretariat Decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Remarks</label>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter remarks..."
          />
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => mutate('approve')} disabled={logDecisionMutation.isPending}>
            Approve
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutate('reject', true)}
            disabled={logDecisionMutation.isPending}
          >
            Reject
          </Button>
          <Button
            variant="outline"
            onClick={() => mutate('amended', true)}
            disabled={logDecisionMutation.isPending}
          >
            Amended
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
