import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { GenericActionPanel } from './panels/GenericActionPanel';
import { GenericApprovalPanel } from './panels/GenericApprovalPanel';
import { SecretariatDecisionPanel } from './panels/SecretariatDecisionPanel';
import { VPCertificationPanel } from './panels/VPCertificationPanel';
import { MayorDecisionPanel } from './panels/MayorDecisionPanel';
import { MayorLapseConfirmationPanel } from './panels/MayorLapseConfirmationPanel';
import { VetoOverrideRecordingPanel } from './panels/VetoOverrideRecordingPanel';
import { MultiReferralPanel } from './panels/MultiReferralPanel';
import { DocketingPanel } from './panels/DocketingPanel';
import { PanlalawiganOutcomePanel } from './panels/PanlalawiganOutcomePanel';
import { PublicationDatePanel } from './panels/PublicationDatePanel';

export function WorkflowStepActionPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();

  const { data: instance, isLoading, error } = trpc.workflow.getInstance.useQuery(
    { instanceId: instanceId! },
    { enabled: !!instanceId }
  );

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
    switch (instance.panelHint) {
      case 'generic_action':
        return <GenericActionPanel instance={instance} />;
      case 'generic_approval':
        return <GenericApprovalPanel instance={instance} />;
      case 'secretariat_decision':
        return <SecretariatDecisionPanel instance={instance} />;
      case 'vp_certification':
        return <VPCertificationPanel instance={instance} />;
      case 'mayor_decision':
        return <MayorDecisionPanel instance={instance} />;
      case 'mayor_lapse_confirmation':
        return <MayorLapseConfirmationPanel instance={instance} />;
      case 'veto_override_recording':
        return <VetoOverrideRecordingPanel instance={instance} />;
      case 'multi_referral':
        return <MultiReferralPanel instance={instance} />;
      case 'docketing':
        return <DocketingPanel instance={instance} />;
      case 'panlalawigan_outcome':
        return <PanlalawiganOutcomePanel instance={instance} />;
      case 'publication_date':
        return <PublicationDatePanel instance={instance} />;
      default:
        return (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">No action panel is available for this step state.</p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Step Action</h1>
          <p className="text-muted-foreground mt-1">
            Instance: {instance.instanceId}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/documents/${instance.documentId}`)}>
          View Document
        </Button>
      </div>

      {renderPanel()}
    </div>
  );
}
