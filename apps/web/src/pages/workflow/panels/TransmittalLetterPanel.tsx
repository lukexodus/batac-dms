import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, RichTextEditor, Input } from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';

export function TransmittalLetterPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState('');
  const [recipientOffice, setRecipientOffice] = useState('Office of the Mayor');
  const [purpose, setPurpose] = useState('For appropriate action');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateMutation = trpc.workflow.generateTransmittalLetter.useMutation();
  const completeMutation = trpc.workflow.completeActionStep.useMutation();

  const handleTransmittal = async () => {
    if (!recipientOffice.trim() || !purpose.trim()) {
      toast.error('Recipient Office and Purpose are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Generate the document
      await generateMutation.mutateAsync({
        stepInstanceId: instance.currentStepInstanceId,
        recipientOfficeLabel: recipientOffice.trim(),
        purposeText: purpose.trim(),
      });

      // Step 2: Complete the action step
      await completeMutation.mutateAsync({
        stepInstanceId: instance.currentStepInstanceId,
        comment: comment || undefined,
      });

      toast.success('Transmittal letter generated and logged. Mayor review timer started.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete transmittal letter step.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transmittal Letter to Mayor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Generate and send the transmittal letter (SPS format) to the Office of the Mayor,
          forwarding the approved document for the Mayor's review.
        </p>
        <p className="text-sm font-medium text-amber-600">
          Completing this step starts the Mayor's 10-day review window.
        </p>
        
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Recipient Office</label>
            <Input 
              value={recipientOffice} 
              onChange={(e) => setRecipientOffice(e.target.value)} 
              placeholder="e.g. Office of the Mayor"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Purpose</label>
            <Input 
              value={purpose} 
              onChange={(e) => setPurpose(e.target.value)} 
              placeholder="e.g. For appropriate action"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Remarks (optional)</label>
          <RichTextEditor
            value={comment}
            onChange={setComment}
            placeholder="Enter any remarks about the transmittal..."
          />
        </div>
        <Button
          onClick={handleTransmittal}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Generating & Completing...' : 'Generate & Confirm Transmittal'}
        </Button>
      </CardContent>
    </Card>
  );
}
