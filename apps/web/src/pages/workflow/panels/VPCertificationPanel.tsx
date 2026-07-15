import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

// certifyAsPresidingOfficer: input is { stepInstanceId } only — no comment field.
export function VPCertificationPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const certifyMutation = trpc.workflow.certifyAsPresidingOfficer.useMutation({
    onSuccess: () => {
      toast.success('Document certified successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to certify.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>VP Certification</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => certifyMutation.mutate({ stepInstanceId: instance.currentStepInstanceId })}
          disabled={certifyMutation.isPending}
        >
          {certifyMutation.isPending ? 'Certifying...' : 'Certify Document'}
        </Button>
      </CardContent>
    </Card>
  );
}
