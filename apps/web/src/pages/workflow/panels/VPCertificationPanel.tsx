import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@batac/ui';

import { trpc, type RouterOutputs } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

// certifyAsPresidingOfficer: input is { stepInstanceId } only — no comment field.
export function VPCertificationPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const identity = useSessionStore((s) => s.identity);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [typedName, setTypedName] = React.useState('');

  const certifyMutation = trpc.workflow.certifyAsPresidingOfficer.useMutation({
    onSuccess: () => {
      toast.success('Document certified successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to certify.'),
  });

  const confirmTargets = React.useMemo(() => {
    const targets = new Set<string>();
    if (identity?.username) targets.add(identity.username.trim().toLowerCase());
    if (identity?.displayName) targets.add(identity.displayName.trim().toLowerCase());
    return targets;
  }, [identity]);

  const isConfirmed = confirmTargets.has(typedName.trim().toLowerCase());

  const openConfirm = () => {
    setTypedName('');
    setConfirmOpen(true);
  };

  const handleCertify = () => {
    if (!isConfirmed) {
      toast.error('Entered user name does not match the current user.');
      return;
    }
    setConfirmOpen(false);
    certifyMutation.mutate({ stepInstanceId: instance.currentStepInstanceId });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>VP Certification</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={openConfirm} disabled={certifyMutation.isPending}>
          {certifyMutation.isPending ? 'Certifying...' : 'Certify Document'}
        </Button>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Certification</DialogTitle>
            <DialogDescription>
              You are about to certify this document as SP Presiding Officer. Type your user name or
              username to confirm your signing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="vp-cert-confirm">User name or username</Label>
            <Input
              id="vp-cert-confirm"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type your name or username"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isConfirmed) handleCertify();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={certifyMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleCertify} disabled={!isConfirmed || certifyMutation.isPending}>
              {certifyMutation.isPending ? 'Certifying...' : 'Confirm & Certify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
