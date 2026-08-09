import { AlertTriangle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@batac/ui';

import { trpc } from '@/lib/trpc';

interface LogCertificationOfUrgencyDialogProps {
  documentId: string;
}

export function LogCertificationOfUrgencyDialog({ documentId }: LogCertificationOfUrgencyDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedCertId, setSelectedCertId] = useState<string>('');

  const utils = trpc.useUtils();

  const { data: linkedCerts, isLoading } = trpc.documents.getLinkedCertifications.useQuery(
    { measureId: documentId },
    { enabled: open }
  );

  // Auto-select if there is exactly one linked certificate
  useEffect(() => {
    if (linkedCerts && linkedCerts.length === 1 && !selectedCertId) {
      setSelectedCertId(linkedCerts[0]!.id);
    }
  }, [linkedCerts, selectedCertId]);

  const logMutation = trpc.documents.logCertificationOfUrgency.useMutation({
    onSuccess: () => {
      toast.success('Certification of Urgency logged successfully. Bypassed committee referral.');
      void utils.documents.get.invalidate({ documentId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId });
      setOpen(false);
      setSelectedCertId('');
    },
    onError: (err) => {
      toast.error(`Failed to log Certification of Urgency: ${err.message}`);
    },
  });

  const handleLog = () => {
    if (!selectedCertId) {
      toast.error('Please select a Certification of Urgency document.');
      return;
    }
    logMutation.mutate({
      certifyingDocumentId: selectedCertId,
      associatedMeasureIds: [documentId],
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Log Certification of Urgency
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Certification of Urgency</DialogTitle>
          <DialogDescription>
            Select a Mayor-issued Certification of Urgency document that was linked to this measure. Doing so
            will bypass the committee referral step and advance the workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="mb-2 block text-sm font-medium">Certification Document</label>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Detecting linked certifications...</div>
          ) : !linkedCerts || linkedCerts.length === 0 ? (
            <div className="text-sm text-danger-500">
              No Certification of Urgency documents are linked to this measure. 
              Please create one via Document Intake and link it to this document first.
            </div>
          ) : (
            <Select value={selectedCertId} onValueChange={setSelectedCertId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a linked Certification..." />
              </SelectTrigger>
              <SelectContent>
                {linkedCerts.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.finalNumber || 'No Final Number'} - {doc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={logMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleLog}
            disabled={!selectedCertId || logMutation.isPending}
          >
            {logMutation.isPending ? 'Logging...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
