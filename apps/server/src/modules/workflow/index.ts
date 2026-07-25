export { createWorkflowPublicAPI } from './workflow.public-api.js';
export interface WorkflowPublicAPI {
  getInstanceById(instanceId: string): Promise<WorkflowInstanceSummary | null>;
  getActiveInstanceForDocument(documentId: string): Promise<WorkflowInstanceSummary | null>;
  getWorkflowSLAData(filter: WorkflowSLAFilter): Promise<WorkflowSLAData[]>;
}

export interface WorkflowInstanceSummary {
  instanceId: string;
  documentId: string;
  definitionId: string;
  definitionVersionId: string; // pinned at creation; immutable except via migrateInstance
  currentStepType: WorkflowStepType;
  currentStepInstanceId: string;
  currentAssigneeUserId: string | null;
  status: 'Active' | 'Completed' | 'Cancelled'; // B2 Published API surface; maps from internal DB enum ('Running'→'Active', 'Paused'→'Active', 'Stuck'→'Active')
  slaDeadline: Date | null;
  lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null;
  createdAt: Date;
}

export type WorkflowStepType =
  | 'action'
  | 'approval'
  | 'multi_referral'
  | 'decision'
  | 'notification'
  | 'termination'
  | 'parallel_split'
  | 'parallel_join';

export interface WorkflowSLAFilter {
  officeId?: string;
  documentTypeId?: string;
  from?: Date;
  to?: Date;
  breachedOnly?: boolean;
}

export interface WorkflowSLAData {
  instanceId: string;
  documentId: string;
  documentTypeId: string;
  slaClassification: 'simple' | 'complex' | 'highly_technical';
  slaThresholdDays: number;
  elapsedWorkingDays: number;
  isBreached: boolean;
  breachedAt: Date | null;
  currentAssigneeOfficeId: string | null;
}
