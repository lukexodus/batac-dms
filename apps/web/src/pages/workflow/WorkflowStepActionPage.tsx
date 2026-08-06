import { FileText, Loader2 } from 'lucide-react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { AmendmentsLoggingPanel } from './panels/AmendmentsLoggingPanel';
import { CommitteeRevisionsDecisionPanel } from './panels/CommitteeRevisionsDecisionPanel';
import { DocketingPanel } from './panels/DocketingPanel';
import { FinalNumberAssignmentPanel } from './panels/FinalNumberAssignmentPanel';
import { GenericActionPanel } from './panels/GenericActionPanel';
import { GenericApprovalPanel } from './panels/GenericApprovalPanel';
import { LegalOfficeReviewDecisionPanel } from './panels/LegalOfficeReviewDecisionPanel';
import { MayorDecisionPanel } from './panels/MayorDecisionPanel';
import { MayorLapseConfirmationPanel } from './panels/MayorLapseConfirmationPanel';
import { MultiReferralPanel } from './panels/MultiReferralPanel';
import { OrderOfBusinessSchedulingPanel } from './panels/OrderOfBusinessSchedulingPanel';
import { PanlalawiganOutcomePanel } from './panels/PanlalawiganOutcomePanel';
import { PublicationDatePanel } from './panels/PublicationDatePanel';
import { ReturnedReviewDecisionPanel } from './panels/ReturnedReviewDecisionPanel';
import { SecretariatDecisionPanel } from './panels/SecretariatDecisionPanel';
import { TransmittalLetterPanel } from './panels/TransmittalLetterPanel';
import { ValidInPartDecisionPanel } from './panels/ValidInPartDecisionPanel';
import { VetoOverrideRecordingPanel } from './panels/VetoOverrideRecordingPanel';
import { VPCertificationPanel } from './panels/VPCertificationPanel';

import { hasRole } from '@/lib/auth-helpers';
import { trpc } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

export function WorkflowStepActionPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const identity = useSessionStore((s) => s.identity);

  const {
    data: instance,
    isLoading,
    error,
  } = trpc.workflow.getInstance.useQuery({ instanceId: instanceId! }, { enabled: !!instanceId });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Step</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error?.message || 'Instance not found.'}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/workflow/steps')}>
              Back to My Steps
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderPanel = () => {
    let canAct = false;

    switch (instance.panelHint) {
      case 'generic_action':
        canAct = hasRole(
          identity,
          'dept_encoder',
          'dept_approver',
          'sp_secretary',
          'sp_presiding_officer',
          'mayor',
          'brgy_encoder',
          'brgy_captain',
          'records_officer',
          'auditor',
        );
        if (canAct) return <GenericActionPanel instance={instance} />;
        break;
      case 'generic_approval':
        canAct = hasRole(identity, 'dept_approver', 'sp_secretary', 'mayor', 'brgy_captain');
        if (canAct) return <GenericApprovalPanel instance={instance} />;
        break;
      case 'secretariat_decision':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <SecretariatDecisionPanel instance={instance} />;
        break;
      case 'vp_certification':
        canAct = hasRole(identity, 'sp_presiding_officer');
        if (canAct) return <VPCertificationPanel instance={instance} />;
        break;
      case 'transmittal_letter':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <TransmittalLetterPanel instance={instance} />;
        break;
      case 'mayor_decision':
        canAct = hasRole(identity, 'mayor');
        if (canAct) return <MayorDecisionPanel instance={instance} />;
        break;
      case 'mayor_lapse_confirmation':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <MayorLapseConfirmationPanel instance={instance} />;
        break;
      case 'veto_override_recording':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <VetoOverrideRecordingPanel instance={instance} />;
        break;
      case 'multi_referral':
        canAct = hasRole(identity, 'sp_secretary', 'sp_member');
        if (canAct) return <MultiReferralPanel instance={instance} />;
        break;
      case 'docketing':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <DocketingPanel instance={instance} />;
        break;
      case 'panlalawigan_outcome':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <PanlalawiganOutcomePanel instance={instance} />;
        break;
      case 'publication_date':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <PublicationDatePanel instance={instance} />;
        break;
      case 'returned_review_decision':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <ReturnedReviewDecisionPanel instance={instance} />;
        break;
      case 'legal_office_review_decision':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <LegalOfficeReviewDecisionPanel instance={instance} />;
        break;
      case 'committee_revisions_decision':
        canAct = hasRole(identity, 'sp_member');
        if (canAct) return <CommitteeRevisionsDecisionPanel instance={instance} />;
        break;
      case 'valid_in_part_decision':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <ValidInPartDecisionPanel instance={instance} />;
        break;
      case 'order_of_business_scheduling':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <OrderOfBusinessSchedulingPanel instance={instance} />;
        break;
      case 'final_number_assignment':
        canAct = hasRole(identity, 'sp_secretary');
        if (canAct) return <FinalNumberAssignmentPanel instance={instance} />;
        break;
      case 'amendments_logging':
        canAct = hasRole(identity, 'sp_secretary', 'secretariat_staff');
        if (canAct) return <AmendmentsLoggingPanel instance={instance} />;
        break;
      default:
        break;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Step Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground mb-4 text-sm">
            {instance.status !== 'Active'
              ? 'This workflow instance is no longer active.'
              : 'You do not have actionable access to this step or no panel is defined for its state.'}
          </p>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <strong>Status:</strong> {instance.status}
            </div>
            <div>
              <strong>Current Step:</strong> {instance.currentStepName || instance.currentStepType}
            </div>
            {instance.currentAssigneeName && (
              <div>
                <strong>Assignee:</strong>{' '}
                {instance.currentAssigneeName}
              </div>
            )}
            {instance.slaDeadline && (
              <div>
                <strong>Deadline:</strong> {new Date(instance.slaDeadline).toLocaleString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Step Action</h1>
          <p className="text-muted-foreground mt-1 break-words text-sm">
            Document: <span className="font-medium text-foreground">{instance.documentTitle || 'Untitled Document'}</span>
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 self-start sm:self-auto"
          onClick={() => navigate(`/documents/${instance.documentId}`)}
        >
          <FileText className="mr-2 h-4 w-4" />
          View Document
        </Button>
      </div>

      {renderPanel()}
    </div>
  );
}
