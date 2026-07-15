import type { InferSelectModel } from 'drizzle-orm';
import {
  definitions,
  definitionVersions,
  steps,
  transitionRules,
  instances,
  stepInstances,
  workflowEvents,
  pendingCertifiedUrgentBypasses,
  committeeReports,
  committeeReportSignatures,
  spSessions,
  sessionAttendances,
  orderOfBusiness,
  orderOfBusinessItems,
} from '../workflow.db.js';

export type DefinitionRow = InferSelectModel<typeof definitions>;
export type DefinitionVersionRow = InferSelectModel<typeof definitionVersions>;
export type StepRow = InferSelectModel<typeof steps>;
export type TransitionRuleRow = InferSelectModel<typeof transitionRules>;
export type InstanceRow = InferSelectModel<typeof instances>;
export type StepInstanceRow = InferSelectModel<typeof stepInstances>;
export type WorkflowEventRow = InferSelectModel<typeof workflowEvents>;
export type PendingCertifiedUrgentBypassRow = InferSelectModel<
  typeof pendingCertifiedUrgentBypasses
>;
export type CommitteeReportRow = InferSelectModel<typeof committeeReports>;
export type CommitteeReportSignatureRow = InferSelectModel<typeof committeeReportSignatures>;
export type SpSessionRow = InferSelectModel<typeof spSessions>;
export type SessionAttendanceRow = InferSelectModel<typeof sessionAttendances>;
export type OrderOfBusinessRow = InferSelectModel<typeof orderOfBusiness>;
export type OrderOfBusinessItemRow = InferSelectModel<typeof orderOfBusinessItems>;

export type WorkflowInstance = InstanceRow;
export type WorkflowStepInstance = StepInstanceRow;

// Instance and step status enums (D3-authoritative)
export type WorkflowInstanceStatus = 'Running' | 'Paused' | 'Stuck' | 'Completed' | 'Cancelled';
export type WorkflowStepStatus =
  | 'Pending'
  | 'Active'
  | 'Completed'
  | 'Skipped'
  | 'Returned'
  | 'Failed'
  | 'Cancelled';
