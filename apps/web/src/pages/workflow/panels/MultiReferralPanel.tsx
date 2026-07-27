import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
} from '@batac/ui';

import { useSessionStore } from '@/stores';
import { hasRole } from '@/lib/auth-helpers';
import { trpc, type RouterOutputs } from '@/lib/trpc';

// Per F1 §8.2 Multi-Referral role gates:
//   submitCommitteeReport  → sp_secretary OR sp_member (committee-scoped)
//   enterCommitteeHearingDate → sp_secretary only
//   manuallyAdvanceMultiReferralStep → sp_secretary only
//
// Per-action gating is intentional (not page-level) to avoid sp_member
// seeing sp_secretary-only controls.
export function MultiReferralPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const identity = useSessionStore((s) => s.identity);

  const roleCodes: string[] = identity?.roleCodes ?? [];
  const isSpSecretary = hasRole(identity, 'sp_secretary');
  const isSpMember = hasRole(identity, 'sp_member');

  // Committee report state
  const [committeeId, setCommitteeId] = useState('');
  const [reportText, setReportText] = useState('');

  // Hearing date state (sp_secretary only)
  const [hearingDate, setHearingDate] = useState('');

  // Manual advance state (sp_secretary only)
  const [mandatoryComment, setMandatoryComment] = useState('');

  const { data: committees } = trpc.organization.listCommittees.useQuery(undefined, {
    enabled: isSpSecretary || isSpMember,
  });

  const submitReportMutation = trpc.workflow.submitCommitteeReport.useMutation({
    onSuccess: () => {
      toast.success('Committee report submitted.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
    },
    onError: (err) => toast.error(err.message || 'Failed to submit report.'),
  });

  const hearingDateMutation = trpc.session.enterCommitteeHearingDate.useMutation({
    onSuccess: () => {
      toast.success('Hearing date recorded.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.session.getOrderOfBusiness.invalidate();
    },
    onError: (err) => toast.error(err.message || 'Failed to enter hearing date.'),
  });

  const advanceMutation = trpc.workflow.manuallyAdvanceMultiReferralStep.useMutation({
    onSuccess: () => {
      toast.success('Step advanced.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to advance step.'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Referral</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Submit Committee Report — sp_secretary or sp_member */}
        {(isSpSecretary || isSpMember) && (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Submit Committee Report</h3>
            <Select value={committeeId} onValueChange={setCommitteeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select committee…" />
              </SelectTrigger>
              <SelectContent>
                {(committees ?? []).map((c: { committeeId: string; name: string }) => (
                  <SelectItem key={c.committeeId} value={c.committeeId}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Report text (required)…"
            />
            <Button
              onClick={() => {
                if (!committeeId) {
                  toast.error('Select a committee');
                  return;
                }
                if (!reportText) {
                  toast.error('Report text is required');
                  return;
                }
                submitReportMutation.mutate({
                  stepInstanceId: instance.currentStepInstanceId,
                  committeeId,
                  reportText,
                });
              }}
              disabled={submitReportMutation.isPending}
            >
              Submit Report
            </Button>
          </div>
        )}

        {/* Enter Hearing Date — sp_secretary only */}
        {isSpSecretary && (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Enter Committee Hearing Date</h3>
            <Input
              type="date"
              value={hearingDate}
              onChange={(e) => setHearingDate(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!hearingDate) {
                  toast.error('Date is required');
                  return;
                }
                // hearingDate is a string from the date input; z.coerce.date() on the server handles it.
                hearingDateMutation.mutate({
                  stepInstanceId: instance.currentStepInstanceId,
                  hearingDate: new Date(hearingDate),
                });
              }}
              disabled={hearingDateMutation.isPending}
            >
              Set Hearing Date
            </Button>
          </div>
        )}

        {/* Manually Advance — sp_secretary only */}
        {isSpSecretary && (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Manually Advance Step</h3>
            <p className="text-muted-foreground text-xs">
              Use only when all committee reports have been received outside the system.
            </p>
            <Textarea
              value={mandatoryComment}
              onChange={(e) => setMandatoryComment(e.target.value)}
              placeholder="Reason for manual advance (required)…"
            />
            <Button
              variant="destructive"
              onClick={() => {
                if (!mandatoryComment) {
                  toast.error('A reason is required');
                  return;
                }
                advanceMutation.mutate({
                  stepInstanceId: instance.currentStepInstanceId,
                  mandatoryComment,
                });
              }}
              disabled={advanceMutation.isPending}
            >
              Advance Step
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
