import type { TxOrDb } from '../../db.js';

export interface WorkflowPublicAPI {
  getInstanceById(instanceId: string): Promise<WorkflowInstanceSummary | null>;
  getActiveInstanceForDocument(documentId: string): Promise<WorkflowInstanceSummary | null>;
  getWorkflowSLAData(filter: WorkflowSLAFilter): Promise<WorkflowSLAData[]>;
  /**
   * Finds the document's active workflow instance, locates its currently
   * active step instance matching `stepKey`, and completes that step
   * (system-driven — see TASK-WF-017's decision record for why
   * autoCompleteActionStep was chosen over submitStepAction). Returns
   * `{ resolved: false }` gracefully — does not throw — if there is no
   * active instance for the document, or no active step instance matching
   * `stepKey` within it. This is a deliberate design choice: workflow-step
   * resolution is a secondary side effect of whatever primary action the
   * caller is taking (e.g. documents.archive's lifecycle transition); it
   * must not block that primary action if there is nothing to resolve.
   */
  archiveStepForDocument(
    documentId: string,
    stepKey: string,
    tx?: TxOrDb,
  ): Promise<{ resolved: boolean }>;
  /**
   * Resolves a step's `stepKey` from its `stepId`. Added for TASK-WF-016.
   * `tx`, when supplied, participates in the caller's transaction (Option B
   * pattern, see TASK-WF-016's decision record); omit it for a standalone
   * read against the live connection — this is the expected usage for an
   * event-bus subscriber, since by the time `workflow.step.completed`
   * fires, the originating transaction has already committed.
   */
  getStepKeyById(stepId: string, tx?: TxOrDb): Promise<string | null>;
  /**
   * Retrieves summary details of a step instance for event consumers.
   * Added for TASK-NOTIF-008.
   */
  getStepInstanceSummary(
    stepId: string,
  ): Promise<{ instanceId: string; assignedTo: any } | null>;
  /**
   * Retrieves the escalation configuration from the definition snapshot of the
   * specified workflow instance. Added for TASK-NOTIF-008.
   */
  getEscalationConfigForInstance(
    instanceId: string,
  ): Promise<{ supervisor_role: string; records_officer_role: string } | null>;
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
