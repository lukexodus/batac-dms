import { eq, and, or, sql, desc, isNull, inArray, isNotNull } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { TxOrDb } from '../../db.js';
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
  spSessions,
  sessionAttendances,
  orderOfBusiness,
  orderOfBusinessItems,
  adminApprovalGrants,
} from '@batac/database/schema/workflow.schema.js';
import {
  InvalidWorkflowTransitionError,
  DefinitionPublishValidationError,
} from '../../errors/domain/workflow.js';
import { validateDefinitionForPublish } from './engine/definition-validator.js';

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
type AdminApprovalGrantRow = InferSelectModel<typeof adminApprovalGrants>;

export class WorkflowRepository {
  constructor(private readonly db: TxOrDb) {}

  async runInTransaction<T>(cb: (tx: TxOrDb) => Promise<T>): Promise<T> {
    return await (this.db as any).transaction(async (tx: any) => {
      return await cb(tx as TxOrDb);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Definitions & Definition Versions
  // ─────────────────────────────────────────────────────────────────────────────

  async getActiveDefinitionForDocumentType(
    documentTypeId: string,
    tx: TxOrDb = this.db,
  ): Promise<{ definition: DefinitionRow; currentVersion: DefinitionVersionRow } | null> {
    const result = await tx
      .select({
        definition: definitions,
        version: definitionVersions,
      })
      .from(definitions)
      .innerJoin(
        definitionVersions,
        and(
          eq(definitionVersions.definitionId, definitions.id),
          eq(definitionVersions.isCurrent, true),
        ),
      )
      .where(
        and(
          eq(definitions.documentTypeId, documentTypeId),
          eq(definitions.isActive, true),
          isNull(definitions.deletedAt),
        ),
      )
      .limit(1);

    if (!result[0]) return null;
    return { definition: result[0].definition, currentVersion: result[0].version };
  }

  async createDefinition(
    data: InferInsertModel<typeof definitions>,
    tx: TxOrDb = this.db,
  ): Promise<DefinitionRow> {
    const [row] = await tx.insert(definitions).values(data).returning();
    return row!;
  }

  async createDefinitionVersion(
    data: InferInsertModel<typeof definitionVersions>,
    tx: TxOrDb = this.db,
  ): Promise<DefinitionVersionRow> {
    const [row] = await tx.insert(definitionVersions).values(data).returning();
    return row!;
  }

  async getDefinitionVersionWithSteps(
    versionId: string,
    tx: TxOrDb = this.db,
  ): Promise<{
    version: DefinitionVersionRow;
    steps: StepRow[];
    transitionRules: TransitionRuleRow[];
  } | null> {
    const [version] = await tx
      .select()
      .from(definitionVersions)
      .where(eq(definitionVersions.id, versionId));

    if (!version) return null;

    const versionSteps = await tx
      .select()
      .from(steps)
      .where(eq(steps.definitionVersionId, versionId));

    const rules = await tx
      .select()
      .from(transitionRules)
      .where(eq(transitionRules.definitionVersionId, versionId));

    return { version, steps: versionSteps, transitionRules: rules };
  }

  async getStepsAndRulesForValidation(
    versionId: string,
    tx: TxOrDb = this.db,
  ): Promise<{ steps: StepRow[]; transitionRules: TransitionRuleRow[] }> {
    const versionSteps = await tx
      .select()
      .from(steps)
      .where(and(eq(steps.definitionVersionId, versionId), isNull(steps.deletedAt)));

    const rules = await tx
      .select()
      .from(transitionRules)
      .where(eq(transitionRules.definitionVersionId, versionId));

    return { steps: versionSteps, transitionRules: rules };
  }

  async publishDefinitionVersion(
    versionId: string,
    publishedBy: string,
    tx: TxOrDb = this.db,
  ): Promise<void> {
    const validationResult = await validateDefinitionForPublish(versionId, {
      workflowRepository: this,
    });
    if (!validationResult.valid) {
      throw new DefinitionPublishValidationError(validationResult.errors);
    }

    // Application layer is expected to handle un-publishing other versions within a tx,
    // this simply marks the target as published.
    await tx
      .update(definitionVersions)
      .set({
        publishedAt: new Date(),
        publishedBy,
        isCurrent: true,
      })
      .where(eq(definitionVersions.id, versionId));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Instances
  // ─────────────────────────────────────────────────────────────────────────────

  async createInstance(
    data: InferInsertModel<typeof instances>,
    tx: TxOrDb = this.db,
  ): Promise<InstanceRow> {
    const [row] = await tx.insert(instances).values(data).returning();
    return row!;
  }

  async getInstanceById(id: string, tx: TxOrDb = this.db): Promise<InstanceRow | null> {
    const [row] = await tx
      .select()
      .from(instances)
      .where(and(eq(instances.id, id), isNull(instances.deletedAt)));
    return row || null;
  }

  async getDefinitionVersionByVersion(
    definitionId: string,
    versionNumber: number,
    tx: TxOrDb = this.db,
  ): Promise<DefinitionVersionRow | null> {
    const [row] = await tx
      .select()
      .from(definitionVersions)
      .where(
        and(
          eq(definitionVersions.definitionId, definitionId),
          eq(definitionVersions.versionNumber, versionNumber),
        ),
      )
      .limit(1);
    return row || null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin Approval Grants (LOG-0053)
  // ─────────────────────────────────────────────────────────────────────────────

  async getApprovalGrant(
    instanceId: string,
    newDefinitionVersionId: string,
    tx: TxOrDb = this.db,
  ): Promise<AdminApprovalGrantRow | null> {
    const now = new Date().toISOString();
    const [row] = await tx
      .select()
      .from(adminApprovalGrants)
      .where(
        and(
          eq(adminApprovalGrants.instanceId, instanceId),
          eq(adminApprovalGrants.newDefinitionVersionId, newDefinitionVersionId),
          isNull(adminApprovalGrants.usedAt),
          sql`${adminApprovalGrants.expiresAt} > ${now}::timestamp with time zone`,
        ),
      )
      .orderBy(desc(adminApprovalGrants.approvedAt)) // Get most recent if multiple
      .limit(1);

    return row || null;
  }

  async markApprovalGrantUsed(grantId: string, tx: TxOrDb = this.db): Promise<void> {
    await tx
      .update(adminApprovalGrants)
      .set({ usedAt: new Date() })
      .where(eq(adminApprovalGrants.id, grantId));
  }

  async getActiveInstanceForDocument(
    documentId: string,
    tx: TxOrDb = this.db,
  ): Promise<InstanceRow | null> {
    const [row] = await tx
      .select()
      .from(instances)
      .where(
        and(
          eq(instances.documentId, documentId),
          eq(instances.status, 'active'),
          isNull(instances.deletedAt),
        ),
      )
      .orderBy(desc(instances.createdAt))
      .limit(1);
    return row || null;
  }

  async updateInstanceStatus(
    id: string,
    status: 'active' | 'suspended' | 'stuck' | 'completed' | 'cancelled',
    completedAt?: Date,
    tx: TxOrDb = this.db,
  ): Promise<void> {
    // B4 Invariant #6: Guard against updates if current status is terminal
    const [current] = await tx
      .select({ status: instances.status })
      .from(instances)
      .where(eq(instances.id, id));

    if (!current) return;
    if (current.status === 'completed' || current.status === 'cancelled') {
      throw new InvalidWorkflowTransitionError(
        `Cannot update status of a ${current.status} workflow instance.`,
      );
    }

    await tx.update(instances).set({ status, completedAt }).where(eq(instances.id, id));
  }

  async updateInstanceContext(
    id: string,
    patch: Record<string, unknown>,
    tx: TxOrDb = this.db,
  ): Promise<void> {
    // JSONB merge operator (||) is used rather than full payload replacement
    await tx
      .update(instances)
      .set({
        context: sql`${instances.context} || ${JSON.stringify(patch)}::jsonb`,
      })
      .where(eq(instances.id, id));
  }

  async updateInstance(
    id: string,
    data: Partial<InferInsertModel<typeof instances>>,
    tx: TxOrDb = this.db,
  ): Promise<InstanceRow> {
    const [row] = await tx.update(instances).set(data).where(eq(instances.id, id)).returning();
    return row!;
  }

  async migrateInstanceVersion(
    id: string,
    targetVersionId: string,
    tx: TxOrDb = this.db,
  ): Promise<void> {
    // This is the ONLY function permitted to update definition_version_id
    await tx
      .update(instances)
      .set({ definitionVersionId: targetVersionId })
      .where(eq(instances.id, id));
  }

  async getActiveInstancesByDefinitionAndStepConfig(
    config: {
      stepType?:
        | 'action'
        | 'approval'
        | 'multi_referral'
        | 'decision'
        | 'notification'
        | 'termination'
        | 'parallel_split'
        | 'parallel_join';
      configKey?: string;
      configValue?: string;
    },
    tx: TxOrDb = this.db,
  ): Promise<Array<{ instance: InstanceRow; stepInstance: StepInstanceRow }>> {
    // Used by scheduler jobs
    let baseQuery = tx
      .select({
        instance: instances,
        stepInstance: stepInstances,
      })
      .from(instances)
      .innerJoin(
        stepInstances,
        and(eq(stepInstances.instanceId, instances.id), eq(stepInstances.status, 'active')),
      )
      .innerJoin(steps, eq(stepInstances.stepId, steps.id))
      .where(
        and(
          inArray(instances.status, ['active', 'suspended', 'stuck']),
          isNull(instances.deletedAt),
        ),
      )
      .$dynamic();

    if (config.stepType) {
      baseQuery = baseQuery.where(eq(steps.stepType, config.stepType));
    }
    if (config.configKey && config.configValue) {
      baseQuery = baseQuery.where(
        sql`${steps.config}->>${config.configKey} = ${config.configValue}`,
      );
    } else if (config.configKey) {
      baseQuery = baseQuery.where(sql`${steps.config} ? ${config.configKey}`);
    }

    return await baseQuery;
  }

  async getActiveInstancesWithSla(tx: TxOrDb = this.db): Promise<InstanceRow[]> {
    return await tx
      .select()
      .from(instances)
      .where(
        and(
          inArray(instances.status, ['active', 'suspended', 'stuck']),
          isNotNull(instances.slaDeadline),
          isNull(instances.deletedAt),
        ),
      );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step Instances
  // ─────────────────────────────────────────────────────────────────────────────

  async createStepInstance(
    data: InferInsertModel<typeof stepInstances>,
    tx: TxOrDb = this.db,
  ): Promise<StepInstanceRow> {
    const [row] = await tx.insert(stepInstances).values(data).returning();
    return row!;
  }

  async getStepInstanceById(id: string, tx: TxOrDb = this.db): Promise<StepInstanceRow | null> {
    const [row] = await tx
      .select()
      .from(stepInstances)
      .where(and(eq(stepInstances.id, id), isNull(stepInstances.deletedAt)));
    return row || null;
  }

  /**
   * Resolves a single step definition row by its ID. Added for TASK-WF-016
   * — `workflow.step.completed` event payloads carry `stepId` (a UUID) but
   * not `stepKey`, so any event subscriber that needs to know which named
   * step just completed must resolve it via this method (through
   * WorkflowPublicAPI.getStepKeyById) rather than reading this table
   * directly from outside the workflow module.
   */
  async getStepById(id: string, tx: TxOrDb = this.db): Promise<StepRow | null> {
    const [row] = await tx
      .select()
      .from(steps)
      .where(and(eq(steps.id, id), isNull(steps.deletedAt)));
    return row || null;
  }

  async getMultiReferralStepInstanceForInstance(
    instanceId: string,
    tx: TxOrDb = this.db,
  ): Promise<StepInstanceRow | null> {
    const [row] = await tx
      .select({ stepInstance: stepInstances })
      .from(stepInstances)
      .innerJoin(steps, eq(stepInstances.stepId, steps.id))
      .where(
        and(
          eq(stepInstances.instanceId, instanceId),
          eq(steps.stepType, 'multi_referral'),
          isNull(stepInstances.deletedAt),
        ),
      )
      .limit(1);
    return row ? row.stepInstance : null;
  }

  async updateStepInstance(
    id: string,
    data: Partial<InferInsertModel<typeof stepInstances>>,
    tx: TxOrDb = this.db,
  ): Promise<StepInstanceRow> {
    const [row] = await tx
      .update(stepInstances)
      .set(data)
      .where(eq(stepInstances.id, id))
      .returning();
    return row!;
  }

  async getActiveStepInstancesForInstance(
    instanceId: string,
    tx: TxOrDb = this.db,
  ): Promise<StepInstanceRow[]> {
    return await tx
      .select()
      .from(stepInstances)
      .where(
        and(
          eq(stepInstances.instanceId, instanceId),
          eq(stepInstances.status, 'active'),
          isNull(stepInstances.deletedAt),
        ),
      );
  }

  async cancelActiveAndPendingStepInstancesForInstance(
    instanceId: string,
    tx: TxOrDb, // required — must run in the same transaction as the instance status update
  ): Promise<void> {
    await tx
      .update(stepInstances)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(stepInstances.instanceId, instanceId),
          or(eq(stepInstances.status, 'active'), eq(stepInstances.status, 'pending')),
          isNull(stepInstances.deletedAt),
        ),
      );
  }

  async lockStepInstanceForUpdate(
    id: string,
    tx: TxOrDb, // tx is required for FOR UPDATE
  ): Promise<StepInstanceRow | null> {
    const [row] = await tx
      .select()
      .from(stepInstances)
      .where(and(eq(stepInstances.id, id), isNull(stepInstances.deletedAt)))
      .for('update');
    return row || null;
  }

  async lockInstanceForUpdate(
    id: string,
    tx: TxOrDb, // tx is required for FOR UPDATE
  ): Promise<InstanceRow | null> {
    const [row] = await tx
      .select()
      .from(instances)
      .where(and(eq(instances.id, id), isNull(instances.deletedAt)))
      .for('update');
    return row || null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Workflow Events (Append-Only)
  // ─────────────────────────────────────────────────────────────────────────────

  async createWorkflowEvent(
    data: InferInsertModel<typeof workflowEvents>,
    tx: TxOrDb = this.db,
  ): Promise<WorkflowEventRow> {
    const [row] = await tx.insert(workflowEvents).values(data).returning();
    return row!;
  }

  async getWorkflowEventsForInstance(instanceId: string): Promise<WorkflowEventRow[]> {
    return await this.db
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.instanceId, instanceId))
      .orderBy(desc(workflowEvents.occurredAt));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Pending Certified Urgent Bypasses
  // ─────────────────────────────────────────────────────────────────────────────

  async createPendingBypass(
    data: InferInsertModel<typeof pendingCertifiedUrgentBypasses>,
    tx: TxOrDb = this.db,
  ): Promise<PendingBypassRow> {
    const [row] = await tx.insert(pendingCertifiedUrgentBypasses).values(data).returning();
    return row!;
  }

  async getPendingBypassForInstance(
    instanceId: string,
    stepKey: string,
    tx: TxOrDb = this.db,
  ): Promise<PendingBypassRow | null> {
    const [row] = await tx
      .select()
      .from(pendingCertifiedUrgentBypasses)
      .where(
        and(
          eq(pendingCertifiedUrgentBypasses.instanceId, instanceId),
          eq(pendingCertifiedUrgentBypasses.stepKey, stepKey),
          isNull(pendingCertifiedUrgentBypasses.appliedAt),
          isNull(pendingCertifiedUrgentBypasses.deletedAt),
        ),
      )
      .limit(1);
    return row || null;
  }

  async markBypassApplied(
    bypassId: string,
    stepInstanceId: string,
    tx: TxOrDb = this.db,
  ): Promise<void> {
    await tx
      .update(pendingCertifiedUrgentBypasses)
      .set({
        appliedAt: new Date(),
        appliedToStepInstanceId: stepInstanceId,
      })
      .where(eq(pendingCertifiedUrgentBypasses.id, bypassId));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Committee Reports
  // ─────────────────────────────────────────────────────────────────────────────

  async createOrGetCommitteeReport(
    stepInstanceId: string,
    tx: TxOrDb = this.db,
  ): Promise<CommitteeReportRow> {
    // Attempt to get first
    const [existing] = await tx
      .select()
      .from(committeeReports)
      .where(
        and(
          eq(committeeReports.stepInstanceId, stepInstanceId),
          isNull(committeeReports.deletedAt),
        ),
      );
    if (existing) return existing;

    const [row] = await tx.insert(committeeReports).values({ stepInstanceId }).returning();
    return row!;
  }

  async updateCommitteeReport(
    id: string,
    data: Partial<InferInsertModel<typeof committeeReports>>,
    tx: TxOrDb = this.db,
  ): Promise<CommitteeReportRow> {
    const [row] = await tx
      .update(committeeReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(committeeReports.id, id))
      .returning();
    return row!;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SP Sessions & Order of Business
  // ─────────────────────────────────────────────────────────────────────────────

  async createSpSession(
    data: InferInsertModel<typeof spSessions>,
    tx: TxOrDb = this.db,
  ): Promise<SpSessionRow> {
    const [row] = await tx.insert(spSessions).values(data).returning();
    return row!;
  }

  async upsertSessionAttendance(
    data: InferInsertModel<typeof sessionAttendances>,
    tx: TxOrDb = this.db,
  ): Promise<void> {
    await tx
      .insert(sessionAttendances)
      .values(data)
      .onConflictDoUpdate({
        target: [sessionAttendances.spSessionId, sessionAttendances.employeeId],
        set: {
          isPresent: data.isPresent,
          absenceReason: data.absenceReason,
          recordedAt: data.recordedAt || new Date(),
        },
      });
  }

  async createOrderOfBusiness(
    data: InferInsertModel<typeof orderOfBusiness>,
    tx: TxOrDb = this.db,
  ): Promise<OrderOfBusinessRow> {
    const [row] = await tx.insert(orderOfBusiness).values(data).returning();
    return row!;
  }

  async getOrderOfBusinessWithItems(
    spSessionId: string,
  ): Promise<{ oob: OrderOfBusinessRow; items: OrderOfBusinessItemRow[] } | null> {
    const [oob] = await this.db
      .select()
      .from(orderOfBusiness)
      .where(and(eq(orderOfBusiness.spSessionId, spSessionId), isNull(orderOfBusiness.deletedAt)));

    if (!oob) return null;

    const items = await this.db
      .select()
      .from(orderOfBusinessItems)
      .where(
        and(
          eq(orderOfBusinessItems.orderOfBusinessId, oob.id),
          isNull(orderOfBusinessItems.deletedAt),
        ),
      );

    return { oob, items };
  }

  async upsertOrderOfBusinessItem(
    data: InferInsertModel<typeof orderOfBusinessItems>,
    tx: TxOrDb = this.db,
  ): Promise<void> {
    await tx
      .insert(orderOfBusinessItems)
      .values(data)
      .onConflictDoUpdate({
        target: [orderOfBusinessItems.orderOfBusinessId, orderOfBusinessItems.itemOrder],
        set: {
          documentId: data.documentId,
          itemType: data.itemType,
          isRedFlagged: data.isRedFlagged,
        },
      });
  }
}
