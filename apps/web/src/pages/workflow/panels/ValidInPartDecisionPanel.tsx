import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor } from '@batac/ui';

import { isRichTextEmpty } from '@/lib/rich-text';
import { trpc, type RouterOutputs } from '@/lib/trpc';

export function ValidInPartDecisionPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [mandatoryComment, setMandatoryComment] = useState('');

  const resolveMutation = trpc.workflow.resolveValidInPart.useMutation({
    onSuccess: () => {
      toast.success('Decision logged successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to log decision.'),
  });

  const mutate = (
    resolutionPath: 'resolve_as_is' | 'route_to_legal' | 'route_to_committee' | 'implement_directly',
  ) => {
    if (isRichTextEmpty(mandatoryComment)) {
      toast.error('A comment is required for this decision.');
      return;
    }
    resolveMutation.mutate({
      documentId: instance.documentId,
      resolutionPath,
      mandatoryComment,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>VALID-IN-PART — Resolution Path</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Comment</label>
          <RichTextEditor
            value={mandatoryComment}
            onChange={setMandatoryComment}
            placeholder="Enter a comment..."
          />
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => mutate('resolve_as_is')} disabled={resolveMutation.isPending}>
            Resolve In Place
          </Button>
          <Button
            variant="outline"
            onClick={() => mutate('route_to_legal')}
            disabled={resolveMutation.isPending}
          >
            Route to Legal Office
          </Button>
          <Button
            variant="outline"
            onClick={() => mutate('route_to_committee')}
            disabled={resolveMutation.isPending}
          >
            Route to Committee
          </Button>
          <Button
            variant="outline"
            onClick={() => mutate('implement_directly')}
            disabled={resolveMutation.isPending}
          >
            Revise Directly
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
