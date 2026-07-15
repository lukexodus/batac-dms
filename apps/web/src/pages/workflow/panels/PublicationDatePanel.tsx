import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

// recordNewspaperPublicationDate: { documentId, publicationDate: Date, newspaperName? }
// Takes documentId (not stepInstanceId). Server looks up the active step internally.
export function PublicationDatePanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [publicationDate, setPublicationDate] = useState('');

  const recordMutation = trpc.workflow.recordNewspaperPublicationDate.useMutation({
    onSuccess: () => {
      toast.success('Publication date recorded.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to record publication date.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Newspaper Publication Date</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Required for penalty ordinances. Publication defaults to Ilocos Times unless changed on
          the server.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium">Publication Date</label>
          <Input
            type="date"
            value={publicationDate}
            onChange={(e) => setPublicationDate(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            if (!publicationDate) {
              toast.error('Publication date is required');
              return;
            }
            recordMutation.mutate({
              documentId: instance.documentId,
              publicationDate: new Date(publicationDate),
            });
          }}
          disabled={recordMutation.isPending}
        >
          {recordMutation.isPending ? 'Recording…' : 'Record Date'}
        </Button>
      </CardContent>
    </Card>
  );
}
