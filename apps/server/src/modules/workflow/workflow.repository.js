import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import { definitions, definitionVersions, steps, transitionRules, instances, stepInstances, workflowEvents, pendingCertifiedUrgentBypasses, committeeReports, spSessions, sessionAttendances, orderOfBusiness, orderOfBusinessItems, } from '@batac/database/schema/workflow.schema.js';
import { InvalidWorkflowTransitionError, DefinitionPublishValidationError, } from '../../errors/domain/workflow.js';
import { validateDefinitionForPublish } from './engine/definition-validator.js';
export class WorkflowRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async runInTransaction(cb) {
        return await this.db.transaction(async (tx) => {
            return await cb(tx);
        });
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Definitions & Definition Versions
    // ─────────────────────────────────────────────────────────────────────────────
    async getActiveDefinitionForDocumentType(documentTypeId, tx = this.db) {
        const result = await tx
            .select({
            definition: definitions,
            version: definitionVersions,
        })
            .from(definitions)
            .innerJoin(definitionVersions, and(eq(definitionVersions.definitionId, definitions.id), eq(definitionVersions.isCurrent, true)))
            .where(and(eq(definitions.documentTypeId, documentTypeId), eq(definitions.isActive, true), isNull(definitions.deletedAt)))
            .limit(1);
        if (!result[0])
            return null;
        return { definition: result[0].definition, currentVersion: result[0].version };
    }
    async createDefinition(data, tx = this.db) {
        const [row] = await tx.insert(definitions).values(data).returning();
        return row;
    }
    async createDefinitionVersion(data, tx = this.db) {
        const [row] = await tx.insert(definitionVersions).values(data).returning();
        return row;
    }
    async getDefinitionVersionWithSteps(versionId, tx = this.db) {
        const [version] = await tx
            .select()
            .from(definitionVersions)
            .where(eq(definitionVersions.id, versionId));
        if (!version)
            return null;
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
    async getStepsAndRulesForValidation(versionId, tx = this.db) {
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
    async publishDefinitionVersion(versionId, publishedBy, tx = this.db) {
        const validationResult = await validateDefinitionForPublish(versionId, { workflowRepository: this });
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
    async createInstance(data, tx = this.db) {
        const [row] = await tx.insert(instances).values(data).returning();
        return row;
    }
    async getInstanceById(id, tx = this.db) {
        const [row] = await tx
            .select()
            .from(instances)
            .where(and(eq(instances.id, id), isNull(instances.deletedAt)));
        return row || null;
    }
    async getActiveInstanceForDocument(documentId, tx = this.db) {
        const [row] = await tx
            .select()
            .from(instances)
            .where(and(eq(instances.documentId, documentId), eq(instances.status, 'active'), isNull(instances.deletedAt)))
            .orderBy(desc(instances.createdAt))
            .limit(1);
        return row || null;
    }
    async updateInstanceStatus(id, status, completedAt, tx = this.db) {
        // B4 Invariant #6: Guard against updates if current status is terminal
        const [current] = await tx
            .select({ status: instances.status })
            .from(instances)
            .where(eq(instances.id, id));
        if (!current)
            return;
        if (current.status === 'completed' || current.status === 'cancelled') {
            throw new InvalidWorkflowTransitionError(`Cannot update status of a ${current.status} workflow instance.`);
        }
        await tx
            .update(instances)
            .set({ status, completedAt })
            .where(eq(instances.id, id));
    }
    async updateInstanceContext(id, patch, tx = this.db) {
        // JSONB merge operator (||) is used rather than full payload replacement
        await tx
            .update(instances)
            .set({
            context: sql `${instances.context} || ${JSON.stringify(patch)}::jsonb`,
        })
            .where(eq(instances.id, id));
    }
    async migrateInstanceVersion(id, targetVersionId, tx = this.db) {
        // This is the ONLY function permitted to update definition_version_id
        await tx
            .update(instances)
            .set({ definitionVersionId: targetVersionId })
            .where(eq(instances.id, id));
    }
    async getActiveInstancesByDefinitionAndStepConfig(config, tx = this.db) {
        // Used by scheduler jobs
        let baseQuery = tx
            .select({
            instance: instances,
            stepInstance: stepInstances,
        })
            .from(instances)
            .innerJoin(stepInstances, and(eq(stepInstances.instanceId, instances.id), eq(stepInstances.status, 'active')))
            .innerJoin(steps, eq(stepInstances.stepId, steps.id))
            .where(and(eq(instances.status, 'active'), isNull(instances.deletedAt)))
            .$dynamic();
        if (config.stepType) {
            baseQuery = baseQuery.where(eq(steps.stepType, config.stepType));
        }
        if (config.configKey && config.configValue) {
            baseQuery = baseQuery.where(sql `${steps.config}->>${config.configKey} = ${config.configValue}`);
        }
        else if (config.configKey) {
            baseQuery = baseQuery.where(sql `${steps.config} ? ${config.configKey}`);
        }
        return await baseQuery;
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Step Instances
    // ─────────────────────────────────────────────────────────────────────────────
    async createStepInstance(data, tx = this.db) {
        const [row] = await tx.insert(stepInstances).values(data).returning();
        return row;
    }
    async getStepInstanceById(id, tx = this.db) {
        const [row] = await tx
            .select()
            .from(stepInstances)
            .where(and(eq(stepInstances.id, id), isNull(stepInstances.deletedAt)));
        return row || null;
    }
    async getMultiReferralStepInstanceForInstance(instanceId, tx = this.db) {
        const [row] = await tx
            .select({ stepInstance: stepInstances })
            .from(stepInstances)
            .innerJoin(steps, eq(stepInstances.stepId, steps.id))
            .where(and(eq(stepInstances.instanceId, instanceId), eq(steps.stepType, 'multi_referral'), isNull(stepInstances.deletedAt)))
            .limit(1);
        return row ? row.stepInstance : null;
    }
    async updateStepInstance(id, data, tx = this.db) {
        const [row] = await tx
            .update(stepInstances)
            .set(data)
            .where(eq(stepInstances.id, id))
            .returning();
        return row;
    }
    async getActiveStepInstancesForInstance(instanceId, tx = this.db) {
        return await tx
            .select()
            .from(stepInstances)
            .where(and(eq(stepInstances.instanceId, instanceId), eq(stepInstances.status, 'active'), isNull(stepInstances.deletedAt)));
    }
    async lockStepInstanceForUpdate(id, tx // tx is required for FOR UPDATE
    ) {
        const [row] = await tx
            .select()
            .from(stepInstances)
            .where(and(eq(stepInstances.id, id), isNull(stepInstances.deletedAt)))
            .for('update');
        return row || null;
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Workflow Events (Append-Only)
    // ─────────────────────────────────────────────────────────────────────────────
    async createWorkflowEvent(data, tx = this.db) {
        const [row] = await tx.insert(workflowEvents).values(data).returning();
        return row;
    }
    async getWorkflowEventsForInstance(instanceId) {
        return await this.db
            .select()
            .from(workflowEvents)
            .where(eq(workflowEvents.instanceId, instanceId))
            .orderBy(desc(workflowEvents.occurredAt));
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Pending Certified Urgent Bypasses
    // ─────────────────────────────────────────────────────────────────────────────
    async createPendingBypass(data, tx = this.db) {
        const [row] = await tx.insert(pendingCertifiedUrgentBypasses).values(data).returning();
        return row;
    }
    async getPendingBypassForInstance(instanceId, stepKey, tx = this.db) {
        const [row] = await tx
            .select()
            .from(pendingCertifiedUrgentBypasses)
            .where(and(eq(pendingCertifiedUrgentBypasses.instanceId, instanceId), eq(pendingCertifiedUrgentBypasses.stepKey, stepKey), isNull(pendingCertifiedUrgentBypasses.appliedAt), isNull(pendingCertifiedUrgentBypasses.deletedAt)))
            .limit(1);
        return row || null;
    }
    async markBypassApplied(bypassId, stepInstanceId, tx = this.db) {
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
    async createOrGetCommitteeReport(stepInstanceId, tx = this.db) {
        // Attempt to get first
        const [existing] = await tx
            .select()
            .from(committeeReports)
            .where(and(eq(committeeReports.stepInstanceId, stepInstanceId), isNull(committeeReports.deletedAt)));
        if (existing)
            return existing;
        const [row] = await tx
            .insert(committeeReports)
            .values({ stepInstanceId })
            .returning();
        return row;
    }
    async updateCommitteeReport(id, data, tx = this.db) {
        const [row] = await tx
            .update(committeeReports)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(committeeReports.id, id))
            .returning();
        return row;
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // SP Sessions & Order of Business
    // ─────────────────────────────────────────────────────────────────────────────
    async createSpSession(data, tx = this.db) {
        const [row] = await tx.insert(spSessions).values(data).returning();
        return row;
    }
    async upsertSessionAttendance(data, tx = this.db) {
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
    async createOrderOfBusiness(data, tx = this.db) {
        const [row] = await tx.insert(orderOfBusiness).values(data).returning();
        return row;
    }
    async getOrderOfBusinessWithItems(spSessionId) {
        const [oob] = await this.db
            .select()
            .from(orderOfBusiness)
            .where(and(eq(orderOfBusiness.spSessionId, spSessionId), isNull(orderOfBusiness.deletedAt)));
        if (!oob)
            return null;
        const items = await this.db
            .select()
            .from(orderOfBusinessItems)
            .where(and(eq(orderOfBusinessItems.orderOfBusinessId, oob.id), isNull(orderOfBusinessItems.deletedAt)));
        return { oob, items };
    }
    async upsertOrderOfBusinessItem(data, tx = this.db) {
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
//# sourceMappingURL=workflow.repository.js.map