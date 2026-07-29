import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@batac/ui';

import { useAuthActions } from '@/hooks/useAuthActions';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { trpc } from '@/lib/trpc';
import { useUIStore } from '@/stores/ui.store';

export function IdleWarningModal() {
  const idleWarningOpen = useUIStore((state) => state.idleWarningOpen);
  const closeIdleWarning = useUIStore((state) => state.closeIdleWarning);
  const { resetTimers } = useIdleTimer();
  const { lock } = useAuthActions();
  const utils = trpc.useUtils();

  const handleStillHere = () => {
    resetTimers();
    void utils.iam.listActiveSessions.fetch();
  };

  const handleLockNow = () => {
    closeIdleWarning();
    void lock();
  };

  return (
    <Dialog open={idleWarningOpen} onOpenChange={(open) => { if (!open) closeIdleWarning(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            Your session will lock soon due to inactivity. Choose an action below to continue
            working or lock your session now.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleLockNow}>
            Lock now
          </Button>
          <Button onClick={handleStillHere}>
            I&apos;m still here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
