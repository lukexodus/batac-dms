import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

export function ArchivePanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const logMutation = trpc.documents.archive.useMutation({
    onSuccess: () => {
      toast.success('Document archived.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to archive document.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Archive Document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Completing this step permanently archives the document.</p>
        </div>
        <Button
          onClick={() => logMutation.mutate({ documentId: instance.documentId })}
          disabled={logMutation.isPending}
        >
          {logMutation.isPending ? 'Archiving...' : 'Archive Document'}
        </Button>
      </CardContent>
    </Card>
  );
}
