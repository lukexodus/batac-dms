import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { AppDb } from '../../db.js';
import { definitions, definitionVersions, steps, transitionRules, instances, stepInstances, workflowEvents, pendingCertifiedUrgentBypasses, committeeReports, spSessions, sessionAttendances, orderOfBusiness, orderOfBusinessItems } from '@batac/database/schema/workflow.schema.js';
type DefinitionRow = InferSelectModel<typeof definitions>;
type DefinitionVersionRow = InferSelectModel<typeof definitionVersions>;
type StepRow = InferSelectModel<typeof steps>;
type TransitionRuleRow = InferSelectModel<typeof transitionRules>;
type InstanceRow = InferSelectModel<typeof instances>;
type StepInstanceRow = InferSelectModel<typeof stepInstances>;
type WorkflowEventRow = InferSelectModel<typeof workflowEvents>;
type PendingBypassRow = InferSelectModel<typeof pendingCertifiedUrgentBypasses>;
type CommitteeReportRow = InferSelectModel<typeof committeeReports>;
type SpSessionRow = InferSelectModel<typeof spSessions>;
type OrderOfBusinessRow = InferSelectModel<typeof orderOfBusiness>;
type OrderOfBusinessItemRow = InferSelectModel<typeof orderOfBusinessItems>;
export declare class WorkflowRepository {
    private readonly db;
    constructor(db: AppDb);
    runInTransaction<T>(cb: (tx: AppDb) => Promise<T>): Promise<T>;
    getActiveDefinitionForDocumentType(documentTypeId: string, tx?: AppDb): Promise<{
        definition: DefinitionRow;
        currentVersion: DefinitionVersionRow;
    } | null>;
    createDefinition(data: InferInsertModel<typeof definitions>, tx?: AppDb): Promise<DefinitionRow>;
    createDefinitionVersion(data: InferInsertModel<typeof definitionVersions>, tx?: AppDb): Promise<DefinitionVersionRow>;
    getDefinitionVersionWithSteps(versionId: string, tx?: AppDb): Promise<{
        version: DefinitionVersionRow;
        steps: StepRow[];
        transitionRules: TransitionRuleRow[];
    } | null>;
    getStepsAndRulesForValidation(versionId: string, tx?: AppDb): Promise<{
        steps: StepRow[];
        transitionRules: TransitionRuleRow[];
    }>;
    publishDefinitionVersion(versionId: string, publishedBy: string, tx?: AppDb): Promise<void>;
    createInstance(data: InferInsertModel<typeof instances>, tx?: AppDb): Promise<InstanceRow>;
    getInstanceById(id: string, tx?: AppDb): Promise<InstanceRow | null>;
    getActiveInstanceForDocument(documentId: string, tx?: AppDb): Promise<InstanceRow | null>;
    updateInstanceStatus(id: string, status: 'active' | 'suspended' | 'stuck' | 'completed' | 'cancelled', completedAt?: Date, tx?: AppDb): Promise<void>;
    updateInstanceContext(id: string, patch: Record<string, unknown>, tx?: AppDb): Promise<void>;
    migrateInstanceVersion(id: string, targetVersionId: string, tx?: AppDb): Promise<void>;
    getActiveInstancesByDefinitionAndStepConfig(config: {
        stepType?: 'action' | 'approval' | 'multi_referral' | 'decision' | 'notification' | 'termination' | 'parallel_split' | 'parallel_join';
        configKey?: string;
        configValue?: string;
    }, tx?: AppDb): Promise<Array<{
        instance: InstanceRow;
        stepInstance: StepInstanceRow;
    }>>;
    createStepInstance(data: InferInsertModel<typeof stepInstances>, tx?: AppDb): Promise<StepInstanceRow>;
    getStepInstanceById(id: string, tx?: AppDb): Promise<StepInstanceRow | null>;
    getMultiReferralStepInstanceForInstance(instanceId: string, tx?: AppDb): Promise<StepInstanceRow | null>;
    updateStepInstance(id: string, data: Partial<InferInsertModel<typeof stepInstances>>, tx?: AppDb): Promise<StepInstanceRow>;
    getActiveStepInstancesForInstance(instanceId: string, tx?: AppDb): Promise<StepInstanceRow[]>;
    lockStepInstanceForUpdate(id: string, tx: AppDb): Promise<StepInstanceRow | null>;
    createWorkflowEvent(data: InferInsertModel<typeof workflowEvents>, tx?: AppDb): Promise<WorkflowEventRow>;
    getWorkflowEventsForInstance(instanceId: string): Promise<WorkflowEventRow[]>;
    createPendingBypass(data: InferInsertModel<typeof pendingCertifiedUrgentBypasses>, tx?: AppDb): Promise<PendingBypassRow>;
    getPendingBypassForInstance(instanceId: string, stepKey: string, tx?: AppDb): Promise<PendingBypassRow | null>;
    markBypassApplied(bypassId: string, stepInstanceId: string, tx?: AppDb): Promise<void>;
    createOrGetCommitteeReport(stepInstanceId: string, tx?: AppDb): Promise<CommitteeReportRow>;
    updateCommitteeReport(id: string, data: Partial<InferInsertModel<typeof committeeReports>>, tx?: AppDb): Promise<CommitteeReportRow>;
    createSpSession(data: InferInsertModel<typeof spSessions>, tx?: AppDb): Promise<SpSessionRow>;
    upsertSessionAttendance(data: InferInsertModel<typeof sessionAttendances>, tx?: AppDb): Promise<void>;
    createOrderOfBusiness(data: InferInsertModel<typeof orderOfBusiness>, tx?: AppDb): Promise<OrderOfBusinessRow>;
    getOrderOfBusinessWithItems(spSessionId: string): Promise<{
        oob: OrderOfBusinessRow;
        items: OrderOfBusinessItemRow[];
    } | null>;
    upsertOrderOfBusinessItem(data: InferInsertModel<typeof orderOfBusinessItems>, tx?: AppDb): Promise<void>;
}
export {};
//# sourceMappingURL=workflow.repository.d.ts.map