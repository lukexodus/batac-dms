import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, Textarea } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

// logSecretariatDecision requires sp_secretary role + stepInstanceId.
// The server-side auth check is roles-only (subject.roles.includes('sp_secretary')).
// The panelHint='secretariat_decision' is computed server-side in computePanelHint
// (workflow.router.ts) via a direct comparison of the step's assigned office_id
// against the SP Secretariat office's ID (resolved via getOfficeByCode).
// See LOG-0092 for the correction (supersedes LOG-0077/LOG-0078's role-based-proxy description).
export function SecretariatDecisionPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [remarks, setRemarks] = useState('');

  const logDecisionMutation = trpc.workflow.logSecretariatDecision.useMutation({
    onSuccess: () => {
      toast.success('Decision logged successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.documents.list.invalidate();
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
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
          <label className="mb-1 block text-sm font-medium">Remarks</label>
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
