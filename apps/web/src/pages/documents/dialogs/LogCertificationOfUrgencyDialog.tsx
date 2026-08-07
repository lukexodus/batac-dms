import { AlertTriangle } from 'lucide-react';
import React, { useState } from 'react';
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
  Input,
} from '@batac/ui';

import { trpc } from '@/lib/trpc';

interface LogCertificationOfUrgencyDialogProps {
  documentId: string;
}

export function LogCertificationOfUrgencyDialog({ documentId }: LogCertificationOfUrgencyDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedCertId, setSelectedCertId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('cert');

  const utils = trpc.useUtils();

  // 1. Find the ID of the CERTIFICATION_OF_URGENCY document type
  const { data: documentTypes } = trpc.documents.documentTypes.useQuery(undefined, {
    staleTime: Infinity,
  });
  const certUrgencyType = documentTypes?.find((t) => t.code === 'CERTIFICATION_OF_URGENCY');

  // 2. Fetch the available Certification of Urgency documents
  const { data: searchResult, isLoading: isSearchLoading } = trpc.documents.search.useQuery(
    {
      queryText: searchQuery,
      documentTypeIds: certUrgencyType ? [certUrgencyType.id] : [],
      limit: 50,
    },
    {
      enabled: !!certUrgencyType,
    },
  );

  // 3. The mutation to log the certification
  const logMutation = trpc.documents.logCertificationOfUrgency.useMutation({
    onSuccess: () => {
      toast.success('Certification of Urgency logged successfully. Bypassed committee referral.');
      void utils.documents.get.invalidate({ documentId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId });
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
            Select a Mayor-issued Certification of Urgency document to attach to this measure. Doing so
            will bypass the committee referral step and advance the workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="mb-2 block text-sm font-medium">Certification Document</label>
          <div className="mb-4">
            <Input 
              placeholder="Search by title or number..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isSearchLoading ? (
            <div className="text-sm text-muted-foreground">Loading certifications...</div>
          ) : !certUrgencyType ? (
            <div className="text-sm text-danger-500">
              Error: CERTIFICATION_OF_URGENCY document type not found.
            </div>
          ) : searchResult?.items.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No Certification of Urgency documents found in the system. Log one via Intake first.
            </div>
          ) : (
            <Select value={selectedCertId} onValueChange={setSelectedCertId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a Certification..." />
              </SelectTrigger>
              <SelectContent>
                {searchResult?.items.map((doc) => (
                  <SelectItem key={doc.documentId} value={doc.documentId}>
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
