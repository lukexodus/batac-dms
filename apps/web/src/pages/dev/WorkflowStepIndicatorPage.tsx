import React from 'react';
import { WorkflowStepIndicator } from '@batac/ui/components/domain/WorkflowStepIndicator';
import type { WorkflowStep } from '@batac/ui/types/domain';

const standardSteps: WorkflowStep[] = [
  { id: 'intake_logging', label: 'Intake Logging', state: 'completed', completedAt: new Date('2026-05-06T09:00:00+08:00') },
  { id: 'order_of_business_scheduling', label: 'Order of Business Scheduling', state: 'completed', completedAt: new Date('2026-05-08T16:00:00+08:00') },
  { id: 'first_reading', label: 'First Reading', state: 'completed', completedAt: new Date('2026-05-13T10:00:00+08:00'), tooltip: 'Referred to Committee on Laws and Committee on Environment' },
  { id: 'committee_referral', label: 'Committee Referral', state: 'completed', completedAt: new Date('2026-06-05T14:00:00+08:00') },
  { id: 'second_reading_vote', label: 'Second Reading', state: 'completed', completedAt: new Date('2026-06-10T11:30:00+08:00') },
  { id: 'final_number_assignment', label: 'Final Number Assignment', state: 'completed', completedAt: new Date('2026-06-12T10:30:00+08:00'), tooltip: '7SP 2026-001 assigned' },
  { id: 'vp_certification', label: 'VP Certification', state: 'active', assigneeName: 'Hon. Albert D. Chua' },
  { id: 'transmittal_letter_to_mayor', label: 'Transmittal to Mayor', state: 'pending' },
  { id: 'mayor_review', label: 'Mayor Review', state: 'pending' },
  { id: 'docketing', label: 'Docketing', state: 'pending' },
];

const errorSteps: WorkflowStep[] = [
  { id: 'intake_logging', label: 'Intake Logging', state: 'completed', completedAt: new Date('2026-05-06T09:00:00+08:00') },
  { id: 'order_of_business_scheduling', label: 'Order of Business Scheduling', state: 'completed', completedAt: new Date('2026-05-08T16:00:00+08:00') },
  { id: 'first_reading', label: 'First Reading', state: 'skipped', tooltip: 'Skipped due to urgency' },
  { id: 'committee_referral', label: 'Committee Referral', state: 'error', tooltip: 'Failed to notify committee members' },
  { id: 'second_reading_vote', label: 'Second Reading', state: 'pending' },
];

export function WorkflowStepIndicatorPage() {
  return (
    <div className="p-8 space-y-12">
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Standard Flow (Horizontal)</h2>
        <p className="text-sm text-neutral-500">
          7SP 2026-001 at VP Certification (Horizontal &gt;=768px, Vertical &lt;768px)
        </p>
        <div className="p-6 border border-neutral-200 rounded-lg">
          <WorkflowStepIndicator steps={standardSteps} currentStepId="vp_certification" orientation="horizontal" />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Error & Skipped Flow (Horizontal)</h2>
        <p className="text-sm text-neutral-500">
          Exercising the skipped and error states.
        </p>
        <div className="p-6 border border-neutral-200 rounded-lg">
          <WorkflowStepIndicator steps={errorSteps} currentStepId="committee_referral" orientation="horizontal" />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Standard Flow (Vertical)</h2>
        <p className="text-sm text-neutral-500">
          Forced vertical orientation on all screen sizes.
        </p>
        <div className="p-6 border border-neutral-200 rounded-lg">
          <WorkflowStepIndicator steps={standardSteps} currentStepId="vp_certification" orientation="vertical" />
        </div>
      </div>
    </div>
  );
}

export default WorkflowStepIndicatorPage;
