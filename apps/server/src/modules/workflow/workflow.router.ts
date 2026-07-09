import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import {
  instances,
  stepInstances,
  steps,
  definitionVersions,
  workflowEvents,
} from '@batac/database/schema/workflow.schema.js';
import {
  documents,
  documentTypes,
} from '@batac/database/schema/documents.schema.js';
import { offices } from '@batac/database/schema/organization.schema.js';
import { eq, and, or, isNull, inArray, desc, gte, lte } from 'drizzle-orm';
import { SlaService } from './services/sla.service.js';
import { WorkflowRepository } from './workflow.repository.js';
import { submitStepAction } from './engine/step-handlers/action.handler.js';
import { submitStepApproval } from './engine/step-handlers/approval.handler.js';
import {
  submitCommitteeReport as engineSubmitCommitteeReport,
  submitStepMultiReferral,
} from './engine/step-handlers/multi-referral.handler.js';
import { workflowPolicy } from './workflow.policy.js';
import type { StepInstanceAttrs, WorkflowInstanceReadAttrs } from './workflow.policy.js';
import type { Context } from '../iam/iam.types.js';
import {
  cancelInstance,
  bypassStep,
  migrateInstance,
} from './engine/admin-operations.js';

const paginationInput = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
});

async function checkWorkflowInstanceReadPermission(
  ctx: Context,
  doc: any,
  tx: any = ctx.db
): Promise<boolean> {
  if (!ctx.auth) return false;
  const roles = ctx.auth.roles;
  const effRoles = ctx.auth.effectiveRoles || [];
  const userRoles = new Set([...roles, ...effRoles]);

  const allowedRoles = new Set([
    'dept_encoder',
    'dept_approver',
    'sp_secretary',
    'sp_member',
    'sp_presiding_officer',
    'mayor',
    'brgy_encoder',
    'brgy_captain',
    'records_officer',
    'auditor',
    'plat_admin',
  ]);
  const hasAllowedRole = [...userRoles].some((r) => allowedRoles.has(r));

  const effectiveOfficeIds = new Set(ctx.auth.effectiveOfficeIds || []);
  const isOwnOffice =
    effectiveOfficeIds.has(doc.ownedByOfficeId) ||
    effectiveOfficeIds.has(doc.originatingOfficeId);

  // 1. Own-office instances and has allowed role
  if (isOwnOffice && hasAllowedRole) {
    return true;
  }

  // 2. SP Secretary: all instances for SP Secretariat scope
  if (userRoles.has('sp_secretary')) {
    const [docOffice] = await tx
      .select({ code: offices.code })
      .from(offices)
      .where(eq(offices.id, doc.ownedByOfficeId))
      .limit(1);
    if (docOffice?.code === 'SP') {
      return true;
    }
  }

  // 3. Cross-office read
  const crossOfficeRoles = new Set(['records_officer', 'sp_presiding_officer', 'mayor', 'auditor']);
  const hasCrossRole = [...userRoles].some((r) => crossOfficeRoles.has(r));
  const isPublicOrInternal =
    doc.classificationLevel === 'public' || doc.classificationLevel === 'internal';

  if (hasCrossRole && isPublicOrInternal) {
    return true;
  }

  return false;
}

// ─── Step context fetch helper ───────────────────────────────────────────────

/**
 * Fetches a step_instances row with all attributes required by StepInstanceAttrs
 * (for WorkflowPolicyGuard) and the parent instance/document rows needed by the
 * engine handlers. Returns null when the step instance does not exist.
 *
 * Caller is responsible for throwing NOT_FOUND on a null result.
 *
 * `isFinalApprovalStep` is sourced from `steps.config['is_final_approval']`
 * (JSONB), consistent with how approval.handler.ts checks it.
 * [Finding — LOG-0049]
 */
async function fetchStepContext(
  stepInstanceId: string,
  ctx: Context
): Promise<{
  stepInstance: typeof stepInstances.$inferSelect;
  step: typeof steps.$inferSelect;
  instance: typeof instances.$inferSelect;
  doc: typeof documents.$inferSelect;
  stepAttrs: StepInstanceAttrs;
} | null> {
  const db = ctx.db;

  const rows = await db
    .select({
      stepInstance: stepInstances,
      step: steps,
      instance: instances,
      doc: documents,
    })
    .from(stepInstances)
    .innerJoin(steps, eq(stepInstances.stepId, steps.id))
    .innerJoin(instances, eq(stepInstances.instanceId, instances.id))
    .innerJoin(documents, eq(instances.documentId, documents.id))
    .where(
      and(
        eq(stepInstances.id, stepInstanceId),
        isNull(stepInstances.deletedAt)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const { stepInstance, step, instance, doc } = row;

  // Extract assignee from JSONB array (first element, per policy guard contract).
  // assigned_to is stored as [{ user_id?: string, office_id?: string }, ...]
  const assignedTo = (stepInstance.assignedTo as Array<{ user_id?: string; office_id?: string }>) ?? [];
  const assigneeUserId = assignedTo[0]?.user_id ?? null;
  const assigneeOfficeId = assignedTo[0]?.office_id ?? null;

  // Extract assigned committees from metadata (for multi_referral step ABAC)
  const metadata = (stepInstance.metadata as Record<string, any>) ?? {};
  const assignedCommittees = (metadata['assigned_committees'] as Array<{ committee_id: string }>) ?? [];
  const assignedCommitteeIds = assignedCommittees.map((c) => c.committee_id);

  // isFinalApprovalStep lives in steps.config['is_final_approval'] (JSONB)
  const config = (step.config as Record<string, any>) ?? {};
  const isFinalApprovalStep = config['is_final_approval'] === true;

  const stepAttrs: StepInstanceAttrs = {
    stepStatus: stepInstance.status as StepInstanceAttrs['stepStatus'],
    stepType: step.stepType as StepInstanceAttrs['stepType'],
    stepKey: step.stepKey,
    isFinalApprovalStep,
    assigneeUserId,
    assigneeOfficeId,
    assignedCommitteeIds,
    instanceCreatedBy: instance.createdBy,
    documentCreatedBy: doc.createdBy,
  };

  return { stepInstance, step, instance, doc, stepAttrs };
}

function enforceRoles(ctx: Context, allowedRoles: string[]) {
  const roles = ctx.auth?.roles || [];
  const effRoles = ctx.auth?.effectiveRoles || [];
  const userRoles = new Set([...roles, ...effRoles]);

  const hasRole = allowedRoles.some((r) => userRoles.has(r));
  if (!hasRole) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  }
}

// TODO: Temporary placeholder pending the real schema (see LOG-0053).
// This stub ensures type safety for AdminOperationsDeps but fails closed by always returning null.
async function stubGetApprovalGrant() {
  return null;
}

// TODO: Temporary placeholder. No-op because stubGetApprovalGrant always returns null.
async function stubMarkApprovalGrantUsed() {}

export function createWorkflowRouter() {
  return router({
    // Queries
    getInstance: protectedProcedure
      .input(z.object({ instanceId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        const { instanceId } = input;

        const [instance] = await ctx.db
          .select()
          .from(instances)
          .where(and(eq(instances.id, instanceId), isNull(instances.deletedAt)))
          .limit(1);

        if (!instance) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Workflow instance not found',
          });
        }

        const [doc] = await ctx.db
          .select()
          .from(documents)
          .where(eq(documents.id, instance.documentId))
          .limit(1);

        if (!doc) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent document not found',
          });
        }

        const isAllowed = await checkWorkflowInstanceReadPermission(ctx, doc);
        if (!isAllowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this workflow instance.',
          });
        }

        const currentSteps = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
            stepType: steps.stepType,
            assignedTo: stepInstances.assignedTo,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(stepInstances.instanceId, instanceId),
              isNull(stepInstances.deletedAt)
            )
          )
          .orderBy(desc(stepInstances.createdAt))
          .limit(1);

        const currentStep = currentSteps[0];
        const assignedUsers = (currentStep?.assignedTo as Array<{ user_id: string }>) || [];
        const currentAssigneeUserId = assignedUsers[0]?.user_id || null;

        let lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null = null;
        const allSteps = await ctx.db
          .select({ outcome: stepInstances.outcome })
          .from(stepInstances)
          .where(
            and(
              eq(stepInstances.instanceId, instanceId),
              isNull(stepInstances.deletedAt)
            )
          );

        if (allSteps.some((s) => s.outcome === 'LAPSED')) {
          lapseStatus = 'mayor_10_day_lapsed';
        } else if (allSteps.some((s) => s.outcome === 'DEEMED_APPROVED')) {
          lapseStatus = 'panlalawigan_30_day_deemed';
        }

        const statusMap: Record<string, 'Active' | 'Completed' | 'Cancelled'> = {
          completed: 'Completed',
          cancelled: 'Cancelled',
        };
        const status = statusMap[instance.status] || 'Active';

        const validStepTypes = new Set([
          'action',
          'approval',
          'multi_referral',
          'decision',
          'notification',
          'termination',
          'parallel_split',
          'parallel_join',
        ]);
        const currentStepType = currentStep && validStepTypes.has(currentStep.stepType)
          ? (currentStep.stepType as any)
          : 'action';

        return {
          instanceId: instance.id,
          documentId: instance.documentId,
          definitionVersionId: instance.definitionVersionId,
          currentStepType,
          currentStepInstanceId: currentStep ? currentStep.stepInstanceId : '00000000-0000-0000-0000-000000000000',
          currentAssigneeUserId,
          status,
          slaDeadline: instance.slaDeadline,
          lapseStatus,
        };
      }),

    getActiveInstanceForDocument: protectedProcedure
      .input(z.object({ documentId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        const { documentId } = input;

        const [instance] = await ctx.db
          .select()
          .from(instances)
          .where(
            and(
              eq(instances.documentId, documentId),
              eq(instances.status, 'active'),
              isNull(instances.deletedAt)
            )
          )
          .orderBy(desc(instances.createdAt))
          .limit(1);

        if (!instance) {
          return null;
        }

        const [doc] = await ctx.db
          .select()
          .from(documents)
          .where(eq(documents.id, documentId))
          .limit(1);

        if (!doc) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent document not found',
          });
        }

        const isAllowed = await checkWorkflowInstanceReadPermission(ctx, doc);
        if (!isAllowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this workflow instance.',
          });
        }

        const currentSteps = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
            stepType: steps.stepType,
            assignedTo: stepInstances.assignedTo,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(stepInstances.instanceId, instance.id),
              isNull(stepInstances.deletedAt)
            )
          )
          .orderBy(desc(stepInstances.createdAt))
          .limit(1);

        const currentStep = currentSteps[0];
        const assignedUsers = (currentStep?.assignedTo as Array<{ user_id: string }>) || [];
        const currentAssigneeUserId = assignedUsers[0]?.user_id || null;

        let lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null = null;
        const allSteps = await ctx.db
          .select({ outcome: stepInstances.outcome })
          .from(stepInstances)
          .where(
            and(
              eq(stepInstances.instanceId, instance.id),
              isNull(stepInstances.deletedAt)
            )
          );

        if (allSteps.some((s) => s.outcome === 'LAPSED')) {
          lapseStatus = 'mayor_10_day_lapsed';
        } else if (allSteps.some((s) => s.outcome === 'DEEMED_APPROVED')) {
          lapseStatus = 'panlalawigan_30_day_deemed';
        }

        const statusMap: Record<string, 'Active' | 'Completed' | 'Cancelled'> = {
          completed: 'Completed',
          cancelled: 'Cancelled',
        };
        const status = statusMap[instance.status] || 'Active';

        const validStepTypes = new Set([
          'action',
          'approval',
          'multi_referral',
          'decision',
          'notification',
          'termination',
          'parallel_split',
          'parallel_join',
        ]);
        const currentStepType = currentStep && validStepTypes.has(currentStep.stepType)
          ? (currentStep.stepType as any)
          : 'action';

        return {
          instanceId: instance.id,
          documentId: instance.documentId,
          definitionVersionId: instance.definitionVersionId,
          currentStepType,
          currentStepInstanceId: currentStep ? currentStep.stepInstanceId : '00000000-0000-0000-0000-000000000000',
          currentAssigneeUserId,
          status,
          slaDeadline: instance.slaDeadline,
          lapseStatus,
        };
      }),

    listMyAssignedSteps: protectedProcedure
      .input(paginationInput)
      .query(async ({ input, ctx }) => {
        const roles = ctx.auth.roles;
        const effRoles = ctx.auth.effectiveRoles || [];
        const userRoles = new Set([...roles, ...effRoles]);

        const allowedOperationalRoles = new Set([
          'dept_encoder',
          'dept_approver',
          'sp_secretary',
          'sp_member',
          'sp_presiding_officer',
          'mayor',
          'brgy_encoder',
          'brgy_captain',
          'records_officer',
          'auditor',
        ]);
        const hasOperationalRole = [...userRoles].some((r) => allowedOperationalRoles.has(r));
        const seniorRoles = new Set(['sp_presiding_officer', 'mayor', 'auditor']);
        const hasSeniorRole = [...userRoles].some((r) => seniorRoles.has(r));

        const rows = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
            instanceId: stepInstances.instanceId,
            documentId: instances.documentId,
            documentTitle: documents.title,
            stepType: steps.stepType,
            assignedTo: stepInstances.assignedTo,
            createdAt: stepInstances.createdAt,
            slaDeadline: stepInstances.slaDeadline,
            documentOfficeId: documents.ownedByOfficeId,
          })
          .from(stepInstances)
          .innerJoin(instances, eq(stepInstances.instanceId, instances.id))
          .innerJoin(documents, eq(instances.documentId, documents.id))
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(stepInstances.cityId, ctx.auth.cityId),
              inArray(stepInstances.status, ['active', 'pending']),
              isNull(stepInstances.deletedAt),
              isNull(instances.deletedAt)
            )
          )
          .orderBy(desc(stepInstances.createdAt));

        const allOffices = await ctx.db
          .select({ id: offices.id, code: offices.code })
          .from(offices)
          .where(eq(offices.cityId, ctx.auth.cityId));
        const spOfficeIds = new Set(
          allOffices
            .filter((o) => o.code === 'SP' || o.code === 'SPS' || o.code === 'OVM')
            .map((o) => o.id)
        );

        const subjectUserId = ctx.auth.userId;
        const effectiveOfficeIds = new Set(ctx.auth.effectiveOfficeIds || []);

        const filtered = rows.filter((row) => {
          const assigned = (row.assignedTo as Array<{ user_id?: string; office_id?: string }>) || [];

          if (assigned.some((a) => a.user_id === subjectUserId)) {
            return true;
          }

          if (hasOperationalRole) {
            if (assigned.some((a) => a.office_id && effectiveOfficeIds.has(a.office_id))) {
              return true;
            }
          }

          if (userRoles.has('sp_secretary') && spOfficeIds.has(row.documentOfficeId)) {
            return true;
          }

          if (hasSeniorRole) {
            return true;
          }

          return false;
        });

        const limit = input.limit ?? 50;
        const startIndex = input.cursor ? parseInt(input.cursor, 10) : 0;
        const paginated = filtered.slice(startIndex, startIndex + limit);
        const nextCursor = startIndex + limit < filtered.length ? String(startIndex + limit) : null;

        const items = paginated.map((item) => {
          const validStepTypes = new Set([
            'action',
            'approval',
            'multi_referral',
            'decision',
            'notification',
            'termination',
          ]);
          const stepType = validStepTypes.has(item.stepType)
            ? (item.stepType as any)
            : 'action';

          return {
            stepInstanceId: item.stepInstanceId,
            instanceId: item.instanceId,
            documentId: item.documentId,
            documentTitle: item.documentTitle,
            stepType,
            assignedAt: item.createdAt,
            dueAt: item.slaDeadline,
          };
        });

        return {
          items,
          nextCursor,
        };
      }),

    getSlaComplianceData: protectedProcedure
      .input(
        z.object({
          officeId: z.string().uuid().optional(),
          documentTypeId: z.string().uuid().optional(),
          breachedOnly: z.boolean().default(false),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        enforceRoles(ctx, [
          'records_officer',
          'sp_secretary',
          'sp_presiding_officer',
          'mayor',
          'auditor',
        ]);

        const conditions = [
          eq(instances.cityId, ctx.auth.cityId),
          isNull(instances.deletedAt)
        ];

        if (input.documentTypeId) {
          conditions.push(eq(documents.documentTypeId, input.documentTypeId));
        }

        if (input.officeId) {
          conditions.push(
            or(
              eq(documents.ownedByOfficeId, input.officeId)!,
              eq(documents.originatingOfficeId, input.officeId)!
            )!
          );
        }

        if (input.from) {
          conditions.push(gte(instances.startedAt, input.from));
        }

        if (input.to) {
          conditions.push(lte(instances.startedAt, input.to));
        }

        const rows = await ctx.db
          .select({
            instanceId: instances.id,
            documentId: instances.documentId,
            status: instances.status,
            context: instances.context,
            slaDeadline: instances.slaDeadline,
            slaBreachedAt: instances.slaBreachedAt,
            startedAt: instances.startedAt,
            completedAt: instances.completedAt,
            documentTypeCode: documentTypes.code,
          })
          .from(instances)
          .innerJoin(documents, eq(instances.documentId, documents.id))
          .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
          .where(and(...conditions));

        const slaService = new SlaService();
        const result = [];

        for (const row of rows) {
          const context = (row.context as Record<string, any>) || {};
          let slaClassification: 'simple' | 'complex' | 'highly_technical' = 'simple';
          let slaThresholdDays = 3;

          if (context['sla_classification']) {
            slaClassification = context['sla_classification'];
          } else if (
            row.documentTypeCode === 'SP_RESOLUTION' ||
            row.documentTypeCode === 'SP_ORDINANCE' ||
            row.documentTypeCode === 'SP_APPROPRIATION_ORDINANCE'
          ) {
            slaClassification = 'complex';
          }

          if (context['sla_threshold_days']) {
            slaThresholdDays = context['sla_threshold_days'];
          } else {
            if (slaClassification === 'simple') slaThresholdDays = 3;
            else if (slaClassification === 'complex') slaThresholdDays = 7;
            else if (slaClassification === 'highly_technical') slaThresholdDays = 20;
          }

          const endDate = row.completedAt || new Date();
          const elapsedWorkingDays = await slaService.elapsedWorkingDays(row.startedAt, endDate);

          const isBreached =
            !!row.slaBreachedAt ||
            (row.status === 'active' && !!row.slaDeadline && new Date() > row.slaDeadline);
          const breachedAt = row.slaBreachedAt || (isBreached ? row.slaDeadline : null);

          if (input.breachedOnly && !isBreached) {
            continue;
          }

          result.push({
            instanceId: row.instanceId,
            documentId: row.documentId,
            slaClassification,
            slaThresholdDays,
            elapsedWorkingDays,
            isBreached,
            breachedAt,
          });
        }

        return result;
      }),

    // Mutations

    /**
     * `workflow.completeActionStep`
     *
     * Marks an `action` step as completed and advances the workflow instance.
     * ABAC: I1 §6.2 (role gate + encoder restriction + assignment gate).
     * Emits `workflow.step.completed` to the event bus for downstream audit.
     *
     * Source: E1 §916; I1 §6.2; I2 §6 ("Complete an assigned action step").
     */
    completeActionStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, comment = null } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        // ABAC: delegates all role/assignment/encoder-restriction checks to guard.
        workflowPolicy.canCompleteActionStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepAction(
            instance,
            stepInstance,
            ctx.auth!.userId,
            comment,
            { ...deps, workflowRepository: new WorkflowRepository(tx as any) },
            tx as any
          );
        });

        // Emit to event bus so audit consumer can create an audit log entry.
        if (server.eventBus) {
          server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'DONE',
              comment,
            },
          });
        }

        return { success: true as const, nextStepType: null };
      }),

    /**
     * `workflow.approveStep`
     *
     * Approves an `approval` step and advances the workflow instance.
     * ABAC: I1 §6.3 (role gate + assignment gate + Invariant #13).
     * Emits `workflow.step.completed` to the event bus for downstream audit.
     *
     * Source: E1 §927; I1 §6.3; I2 §6 ("Complete an assigned approval step (Approve)").
     */
    approveStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, comment = null } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        // ABAC: role gate + assignment gate + Invariant #13 (encoder ≠ final approver).
        workflowPolicy.canApproveStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'APPROVED',
            comment,
            { ...deps, workflowRepository: new WorkflowRepository(tx as any) },
            tx as any
          );
        });

        if (server.eventBus) {
          server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'APPROVED',
              comment,
            },
          });
        }

        return { success: true as const };
      }),

    /**
     * `workflow.rejectStep`
     *
     * Rejects an `approval` step (mandatory comment) and advances the workflow.
     * ABAC: I1 §6.3.
     *
     * Source: E1 §927; I1 §6.3; I2 §6 ("Complete an assigned approval step (Reject)").
     */
    rejectStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, comment } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        workflowPolicy.canApproveStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'REJECTED',
            comment,
            { ...deps, workflowRepository: new WorkflowRepository(tx as any) },
            tx as any
          );
        });

        if (server.eventBus) {
          server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'REJECTED',
              comment,
            },
          });
        }

        return { success: true as const };
      }),

    /**
     * `workflow.returnStepForRevision`
     *
     * Returns an `approval` step for revision (mandatory comment).
     * ABAC: I1 §6.3.
     *
     * Source: E1 §927; I1 §6.3; I2 §6 ("Complete an assigned approval step (Return for revision)").
     */
    returnStepForRevision: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, comment } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        workflowPolicy.canApproveStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'RETURNED_FOR_REVISION',
            comment,
            { ...deps, workflowRepository: new WorkflowRepository(tx as any) },
            tx as any
          );
        });

        if (server.eventBus) {
          server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'RETURNED_FOR_REVISION',
              comment,
            },
          });
        }

        return { success: true as const };
      }),

    /**
     * `workflow.submitCommitteeReport`
     *
     * Submits a committee report contribution for a multi-referral step.
     * ABAC: I1 §6.6 (committee-scoped `sp_member`, or `sp_secretary`).
     * If all assigned committees have submitted, this orchestrates completion of the step.
     *
     * Source: E1 §938; I1 §6.6
     */
    submitCommitteeReport: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          committeeId: z.string().uuid(),
          reportText: z.string().min(1),
          reportAttachmentS3Key: z.string().uuid().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, committeeId } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, instance, stepAttrs } = found;

        // ABAC: committee scoped check
        workflowPolicy.canSubmitCommitteeReport(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
        };

        // As per E1, we pass a generated UUID for contributionDocId since the engine
        // only records it as a reference in the metadata array.
        const contributionDocId = randomUUID();

        let isCompleted = false;

        await ctx.db.transaction(async (tx) => {
          const txWorkflowRepo = new WorkflowRepository(tx as any);
          
          await engineSubmitCommitteeReport(
            instance,
            stepInstance,
            committeeId,
            ctx.auth!.userId,
            contributionDocId,
            { ...deps, workflowRepository: txWorkflowRepo },
            tx as any
          );

          // After submitting, check if all committees have submitted.
          // The engine handler updates stepInstance in DB, so we must fetch the fresh row
          // inside this transaction to check the updated submissions array.
          const freshStepInstance = await txWorkflowRepo.getStepInstanceById(stepInstanceId, tx as any);
          if (!freshStepInstance) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve fresh step instance.' });
          }

          const freshMetadata = (freshStepInstance.metadata as Record<string, any>) ?? {};
          const assigned = (freshMetadata['assigned_committees'] as Array<{ committee_id: string }>) ?? [];
          const submissions = (freshMetadata['submissions'] as Array<any>) ?? [];

          if (submissions.length >= assigned.length) {
            isCompleted = true; // All assigned committees have submitted
          }
        });

        return { allCommitteesSubmitted: isCompleted };
      }),

    /**
     * `workflow.acceptUnifiedReport`
     *
     * SP Secretary accepts the unified committee report after all committees have submitted.
     * ABAC: I1 §6.8 (sp_secretary only).
     */
    acceptUnifiedReport: protectedProcedure
      .input(
        z.object({
          instanceId: z.string().uuid(),
          stepInstanceId: z.string().uuid(),
          unifiedReportDocumentId: z.string().uuid(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }
        const { instanceId, stepInstanceId, unifiedReportDocumentId } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }
        
        const { stepInstance, instance } = found;

        if (instance.id !== instanceId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Instance ID mismatch.' });
        }

        workflowPolicy.canAcceptUnifiedReport(ctx.auth);

        if (found.step.stepType !== 'multi_referral') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a multi-referral step.' });
        }

        if (stepInstance.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Step is not active.' });
        }

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
        };

        await ctx.db.transaction(async (tx) => {
          const txWorkflowRepo = new WorkflowRepository(tx as any);
          
          const freshStepInstance = await txWorkflowRepo.getStepInstanceById(stepInstanceId, tx as any);
          if (!freshStepInstance) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve fresh step instance.' });
          }

          const freshMetadata = (freshStepInstance.metadata as Record<string, any>) ?? {};
          
          freshMetadata['unified_report_document_id'] = unifiedReportDocumentId;
          await txWorkflowRepo.updateStepInstance(stepInstanceId, { metadata: freshMetadata }, tx as any);

          await submitStepMultiReferral(
            instance,
            { ...freshStepInstance, metadata: freshMetadata },
            ctx.auth!.userId,
            'user',
            'REPORT_ACCEPTED',
            null,
            { ...deps, workflowRepository: txWorkflowRepo },
            tx as any
          );
        });

        if (server.eventBus) {
          server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId,
              stepInstanceId,
              stepId: found.step.id,
              stepType: found.step.stepType,
              outcome: 'REPORT_ACCEPTED',
              comment: null,
            },
          });
        }

        return { success: true };
      }),

    /**
     * `workflow.manuallyAdvanceMultiReferralStep`
     *
     * SP Secretary override to advance a multi-referral step before all committees have submitted.
     * ABAC: I1 §6.7 (sp_secretary only).
     *
     * Source: E1 §949; I1 §6.7
     */
    manuallyAdvanceMultiReferralStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          mandatoryComment: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, mandatoryComment } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        workflowPolicy.canManuallyAdvanceMultiReferral(ctx.auth);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepMultiReferral(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'SECRETARY_ADVANCED',
            mandatoryComment,
            { ...deps, workflowRepository: new WorkflowRepository(tx as any) },
            tx as any
          );
        });

        if (server.eventBus) {
          server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'SECRETARY_ADVANCED',
              comment: mandatoryComment,
            },
          });
        }

        return { success: true as const };
      }),

    certifyAsPresidingOfficer: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'certifyAsPresidingOfficer is not implemented.',
        });
      }),

    mayorSign: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          objectionsText: z.string().optional(),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'mayorSign is not implemented.',
        });
      }),

    mayorVeto: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          objectionsText: z.string().min(1),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'mayorVeto is not implemented.',
        });
      }),

    logMayorLapseConfirmation: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .output(z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S47') }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        const { instance, stepInstance, stepAttrs } = stepContext;

        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        // Ambiguity resolution: Verify we are actually on a step that lapses.
        const contextObj = (instance.context as Record<string, any>) || {};
        if (!contextObj['mayor_action_deadline']) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Step is not subject to a mayor lapse timer (no deadline set).',
          });
        }

        // Idempotency check: if the scheduler already completed the lapse, just return success
        // Note: the manual confirmation is an acknowledgment that the lapse *did* occur.
        // It does not change the step outcome if it's already LAPSED.
        // Wait, the scheduler evaluates it and sets outcome = LAPSED. 
        // We need to write an audit log that the Secretary *confirmed* it, unless already confirmed.
        // However, there is no "confirmed" boolean. The prompt says "second call after lapse already recorded is a no-op".
        // Wait, the spec says: "idempotent; repeated calls create no duplicate audit entry".
        // If the Secretary clicks "Confirm Lapse", this procedure writes the audit event.
        // What event type? 'workflow.step.completed' with outcome = 'LAPSED_CONFIRMED' or similar?
        // Wait, the audit says: "If already lapsed... return no-op".
        // Actually, if it's already LAPSED and this procedure was already called, how do we distinguish between "Scheduler set it to LAPSED" and "Secretary confirmed it"?
        // Let's use `stepInstance.metadata['lapse_confirmed_at']` to track idempotency.
        
        return await ctx.db.transaction(async (tx) => {
          // Re-fetch with lock to prevent race conditions
          const txRepo = new WorkflowRepository(tx as any);
          const lockedStepInstance = await txRepo.lockStepInstanceForUpdate(stepInstance.id, tx as any);
          if (!lockedStepInstance) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
          }

          const lockedMetadata = (lockedStepInstance.metadata as Record<string, any>) || {};
          
          if (lockedMetadata['lapse_confirmed_at']) {
             return { success: true, legalBasis: 'RA7160_S47' };
          }

          lockedMetadata['lapse_confirmed_at'] = new Date().toISOString();
          lockedMetadata['lapse_confirmed_by'] = ctx.auth.userId;

          await txRepo.updateStepInstance(
            lockedStepInstance.id,
            { metadata: lockedMetadata },
            tx as any
          );

          await txRepo.createWorkflowEvent(
            {
              instanceId: instance.id,
              eventType: 'workflow.step.completed', // Event type mapped in shared
              actorType: 'user',
              actorId: ctx.auth.userId,
              payload: {
                instanceId: instance.id,
                stepInstanceId: lockedStepInstance.id,
                stepId: stepContext.step.id,
                stepType: stepContext.step.stepType,
                outcome: 'LAPSED_CONFIRMED',
                comment: 'Mayor lapse confirmed by SP Secretary',
              },
            },
            tx as any
          );
          
          const server = ctx.req.server as any;
          if (server.eventBus) {
            server.eventBus.emit('workflow.step.completed', {
              eventId: randomUUID(),
              eventType: 'workflow.step.completed',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: {
                instanceId: instance.id,
                stepInstanceId: lockedStepInstance.id,
                stepId: stepContext.step.id,
                stepType: stepContext.step.stepType,
                outcome: 'LAPSED_CONFIRMED',
                comment: 'Mayor lapse confirmed by SP Secretary',
              },
            });
          }

          return { success: true, legalBasis: 'RA7160_S47' };
        });
      }),

    recordVetoOverrideVote: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          votesFor: z.number().int().min(0).max(12),
          votesAgainst: z.number().int().min(0).max(12),
          absentCouncilorIds: z.array(z.string().uuid()),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'recordVetoOverrideVote is not implemented.',
        });
      }),

    logDocketingCompletion: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server.documentsService,
          eventBus: server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
        };

        const { submitStepAction } = await import('./engine/step-handlers/action.handler.js');

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx as any),
          };

          await submitStepAction(
            stepContext.instance,
            stepContext.stepInstance,
            ctx.auth.userId,
            null, // comment
            txDeps,
            tx as any
          );
        });

        if (server.eventBus) {
          server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: stepContext.instance.id,
              stepInstanceId: stepContext.stepInstance.id,
              stepId: stepContext.step.id,
              stepType: stepContext.step.stepType,
              outcome: 'DONE',
              comment: null,
            },
          });
        }

        return { success: true };
      }),

    recordPanlalawiganOutcome: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          outcome: z.enum([
            'VALID',
            'VALID_IN_PART',
            'RETURNED',
            'OPERATIVE_IN_ITS_ENTIRETY',
          ]),
          controlNumber: z.string().optional(),
          panlalawiganResolutionNumber: z.string().optional(),
          dateReferred: z.coerce.date().optional(),
          remarks: z.string().optional(),
        })
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        const { instance, stepInstance, stepAttrs } = stepContext;

        workflowPolicy.canLogPanlalawiganAction(ctx.auth, stepAttrs);

        const server2 = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server2.documentsService,
          eventBus: server2.eventBus,
          orgService: server2.organizationService,
          delegationService: server2.delegationService,
        };

        const { submitStepApproval } = await import('./engine/step-handlers/approval.handler.js');

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx as any),
          };

          const patch: Record<string, any> = {
            panlalawigan_outcome: input.outcome,
          };
          if (input.controlNumber !== undefined) patch['panlalawigan_control_number'] = input.controlNumber;
          if (input.panlalawiganResolutionNumber !== undefined) patch['panlalawigan_resolution_number'] = input.panlalawiganResolutionNumber;
          if (input.dateReferred !== undefined) patch['panlalawigan_date_referred'] = input.dateReferred.toISOString();
          if (input.remarks !== undefined) patch['panlalawigan_remarks'] = input.remarks;

          await txDeps.workflowRepository.updateInstanceContext(instance.id, patch, tx as any);
          
          // Refresh instance to get updated context
          const updatedInstance = await txDeps.workflowRepository.getInstanceById(instance.id, tx as any);
          if (!updatedInstance) throw new Error('Instance not found');

          await submitStepApproval(
            updatedInstance,
            stepInstance,
            ctx.auth.userId,
            'user',
            input.outcome,
            input.remarks ?? null,
            txDeps,
            tx as any
          );
        });

        if (server2.eventBus) {
          server2.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: stepContext.instance.id,
              stepInstanceId: stepContext.stepInstance.id,
              stepId: stepContext.step.id,
              stepType: stepContext.step.stepType,
              outcome: input.outcome,
              comment: input.remarks ?? null,
            },
          });
        }

        return { success: true };
      }),

    resolveValidInPart: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          resolutionPath: z.enum([
            'resolve_as_is',
            'route_to_legal',
            'route_to_committee',
            'implement_directly',
          ]),
          mandatoryComment: z.string().min(1),
        })
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const workflowRepository = new WorkflowRepository(ctx.db);
        const instance = await workflowRepository.getActiveInstanceForDocument(input.documentId);
        if (!instance) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Active workflow instance not found for document' });
        }
        
        const rows = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(and(
            eq(stepInstances.instanceId, instance.id),
            eq(steps.stepKey, 'valid_in_part_decision'),
            inArray(stepInstances.status, ['pending', 'active']),
            isNull(stepInstances.deletedAt)
          ))
          .limit(1);

        if (rows.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No active valid_in_part_decision step found' });
        }

        const stepContext = await fetchStepContext(rows[0]!.stepInstanceId, ctx);
        if (!stepContext) throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        
        workflowPolicy.canResolveValidInPart(ctx.auth);

        const server3 = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server3.documentsService,
          eventBus: server3.eventBus,
          orgService: server3.organizationService,
          delegationService: server3.delegationService,
        };

        const { submitStepApproval } = await import('./engine/step-handlers/approval.handler.js');

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx as any),
          };

          if (input.resolutionPath === 'route_to_committee') {
            // Find the original committee referral step instance to get the committee ID
            const committeeRows = await tx
              .select({ metadata: stepInstances.metadata })
              .from(stepInstances)
              .innerJoin(steps, eq(stepInstances.stepId, steps.id))
              .where(and(
                eq(stepInstances.instanceId, instance.id),
                eq(steps.stepKey, 'committee_referral'),
                isNull(stepInstances.deletedAt)
              ))
              .orderBy(desc(stepInstances.createdAt))
              .limit(1);

            if (committeeRows.length === 0) {
              throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No committee referral found in this workflow instance to route back to.' });
            }

            const metadata = (committeeRows[0]!.metadata as Record<string, any>) || {};
            const assignedCommittees = metadata['assigned_committees'] as Array<{ committee_id: string }> | undefined;
            
            if (!assignedCommittees || assignedCommittees.length === 0) {
              throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No committees were assigned during the referral step.' });
            }

            const primaryCommitteeId = assignedCommittees[0]!.committee_id;
            const chair = await txDeps.orgService.getCommitteeChair(primaryCommitteeId);
            
            if (chair) {
               await txDeps.workflowRepository.updateInstanceContext(instance.id, {
                 referred_committee_chair_id: chair.userId
               }, tx as any);
            }
          }

          // Map resolutionPath to engine outcome string
          let outcome = 'RESOLVE_AS_IS';
          if (input.resolutionPath === 'route_to_legal') outcome = 'ROUTE_TO_LEGAL';
          else if (input.resolutionPath === 'route_to_committee') outcome = 'ROUTE_TO_COMMITTEE';
          else if (input.resolutionPath === 'implement_directly') outcome = 'IMPLEMENT_DIRECTLY';

          // Refresh instance to get updated context (e.g. if we set referred_committee_chair_id)
          const updatedInstance = await txDeps.workflowRepository.getInstanceById(instance.id, tx as any);
          if (!updatedInstance) throw new Error('Instance not found');

          await submitStepApproval(
            updatedInstance,
            stepContext.stepInstance,
            ctx.auth.userId,
            'user',
            outcome,
            input.mandatoryComment,
            txDeps,
            tx as any
          );
        });

        if (server3.eventBus) {
          server3.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: stepContext.stepInstance.id,
              stepId: stepContext.step.id,
              stepType: stepContext.step.stepType,
              outcome: input.resolutionPath.toUpperCase(),
              comment: input.mandatoryComment,
            },
          });
        }

        return { success: true };
      }),

    confirmPanlalawiganDeemedApproved: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .output(z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S56D') }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        const { instance, stepInstance, stepAttrs } = stepContext;

        workflowPolicy.canLogPanlalawiganAction(ctx.auth, stepAttrs);

        const contextObj = (instance.context as Record<string, any>) || {};
        const deadlineStr = contextObj['panlalawigan_action_deadline'];
        
        if (!deadlineStr) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'No Panlalawigan action deadline is set.',
          });
        }

        const deadline = new Date(deadlineStr);
        if (new Date() < deadline) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: '30-day window has not yet elapsed.',
          });
        }

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        return await ctx.db.transaction(async (tx) => {
          const txRepo = new WorkflowRepository(tx as any);
          const lockedStepInstance = await txRepo.lockStepInstanceForUpdate(stepInstance.id, tx as any);
          if (!lockedStepInstance) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
          }

          const lockedMetadata = (lockedStepInstance.metadata as Record<string, any>) || {};
          if (lockedMetadata['deemed_approved_confirmed_at']) {
            return { success: true, legalBasis: 'RA7160_S56D' } as const;
          }

          lockedMetadata['deemed_approved_confirmed_at'] = new Date().toISOString();
          lockedMetadata['deemed_approved_confirmed_by'] = ctx.auth.userId;

          await txRepo.updateStepInstance(
            lockedStepInstance.id,
            { metadata: lockedMetadata },
            tx as any
          );

          await txRepo.createWorkflowEvent(
            {
              instanceId: instance.id,
              eventType: 'workflow.step.completed',
              actorType: 'user',
              actorId: ctx.auth.userId,
              payload: {
                instanceId: instance.id,
                stepInstanceId: lockedStepInstance.id,
                stepId: stepContext.step.id,
                stepType: stepContext.step.stepType,
                outcome: 'DEEMED_APPROVED_CONFIRMED',
                comment: 'Panlalawigan deemed approval confirmed by SP Secretary',
              },
            },
            tx as any
          );

          if (server.eventBus) {
            server.eventBus.emit('workflow.step.completed', {
              eventId: randomUUID(),
              eventType: 'workflow.step.completed',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: {
                instanceId: instance.id,
                stepInstanceId: lockedStepInstance.id,
                stepId: stepContext.step.id,
                stepType: stepContext.step.stepType,
                outcome: 'DEEMED_APPROVED_CONFIRMED',
                comment: 'Panlalawigan deemed approval confirmed by SP Secretary',
              },
            });
          }

          return { success: true, legalBasis: 'RA7160_S56D' } as const;
        });
      }),

    recordNewspaperPublicationDate: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          publicationDate: z.coerce.date(),
          newspaperName: z.string().default('Ilocos Times'),
        })
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const workflowRepository = new WorkflowRepository(ctx.db);
        const instance = await workflowRepository.getActiveInstanceForDocument(input.documentId);
        if (!instance) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Active workflow instance not found for document' });
        }
        
        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        // Fetch document type to verify constraint
        const docRows = await ctx.db
          .select({
            code: documentTypes.code,
          })
          .from(documents)
          .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
          .where(eq(documents.id, input.documentId))
          .limit(1);

        if (docRows.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        }

        const docType = docRows[0]!.code;
        if (docType !== 'SP_ORDINANCE' && docType !== 'SP_APPROPRIATION_ORDINANCE') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Only Ordinances and Appropriation Ordinances require newspaper publication.',
          });
        }

        await ctx.db.transaction(async (tx) => {
          const txRepo = new WorkflowRepository(tx as any);
          await txRepo.updateInstanceContext(
            instance.id,
            {
              publication_date: input.publicationDate.toISOString().split('T')[0],
              publication_newspaper: input.newspaperName,
            },
            tx as any
          );
        });

        return { success: true };
      }),

    cancelInstance: protectedProcedure
      .input(
        z.object({
          instanceId: z.string().uuid(),
          reason: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const [instance] = await ctx.db
          .select()
          .from(instances)
          .where(and(eq(instances.id, input.instanceId), isNull(instances.deletedAt)))
          .limit(1);

        if (!instance) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow instance not found.' });
        }

        const [doc] = await ctx.db
          .select()
          .from(documents)
          .where(eq(documents.id, instance.documentId))
          .limit(1);

        if (!doc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent document not found.' });
        }

        const attrs: WorkflowInstanceReadAttrs = {
          documentOfficeId: doc.ownedByOfficeId,
          classificationLevel: doc.classificationLevel as 'public' | 'internal' | 'confidential' | 'restricted',
        };

        workflowPolicy.canCancelInstance(ctx.auth, attrs);

        const server = ctx.req.server as any;
        await ctx.db.transaction(async (tx) => {
          const deps = {
            db: tx as any,
            workflowRepository: new WorkflowRepository(tx as any),
            documentsService: server.documentsService,
            eventBus: server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            getApprovalGrant: stubGetApprovalGrant,
            markApprovalGrantUsed: stubMarkApprovalGrantUsed,
          };
          await cancelInstance(input.instanceId, ctx.auth!.userId, input.reason, deps);
        });

        if (server.eventBus) {
          server.eventBus.emit('workflow.instance.cancelled', {
            eventId: randomUUID(),
            eventType: 'workflow.instance.cancelled',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: input.instanceId,
              cancelledBy: ctx.auth.userId,
              cancellationReason: input.reason,
            },
          });
        }

        return { success: true as const };
      }),

    bypassStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          bypassReason: z.string().min(1),
          comment: z.string().min(1),
          outcomeCode: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        workflowPolicy.canBypassStep(ctx.auth);

        const server = ctx.req.server as any;
        await ctx.db.transaction(async (tx) => {
          const deps = {
            db: tx as any,
            workflowRepository: new WorkflowRepository(tx as any),
            documentsService: server.documentsService,
            eventBus: server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            getApprovalGrant: stubGetApprovalGrant,
            markApprovalGrantUsed: stubMarkApprovalGrantUsed,
          };
          await bypassStep(input.stepInstanceId, ctx.auth!.userId, input.bypassReason, input.comment, input.outcomeCode, deps);
        });

        const [stepInstance] = await ctx.db
          .select({ instanceId: stepInstances.instanceId })
          .from(stepInstances)
          .where(eq(stepInstances.id, input.stepInstanceId))
          .limit(1);

        if (server.eventBus && stepInstance) {
          server.eventBus.emit('workflow.step.bypassed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.bypassed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: stepInstance.instanceId,
              stepInstanceId: input.stepInstanceId,
              bypassReason: input.bypassReason,
              bypassedBy: ctx.auth.userId,
              comment: input.comment,
            },
          });
        }

        return { success: true as const };
      }),

    migrateInstanceToNewDefinitionVersion: protectedProcedure
      .input(
        z.object({
          instanceId: z.string().uuid(),
          newDefinitionVersionId: z.string().uuid(),
          mandatoryReason: z.string().min(1),
          secondLevelApproverUserId: z.string().uuid(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        workflowPolicy.canMigrateInstance(ctx.auth);

        const server = ctx.req.server as any;
        let result: { migrationId: string; reversibleUntil: Date };

        await ctx.db.transaction(async (tx) => {
          const deps = {
            db: tx as any,
            workflowRepository: new WorkflowRepository(tx as any),
            documentsService: server.documentsService,
            eventBus: server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            getApprovalGrant: stubGetApprovalGrant,
            markApprovalGrantUsed: stubMarkApprovalGrantUsed,
          };
          result = await migrateInstance(
            input.instanceId,
            input.newDefinitionVersionId,
            ctx.auth!.userId,
            input.mandatoryReason,
            deps
          );
        });

        if (server.eventBus) {
          const [startedEvent] = await ctx.db
            .select()
            .from(workflowEvents)
            .where(
              and(
                eq(workflowEvents.instanceId, input.instanceId),
                eq(workflowEvents.eventType, 'workflow.instance.migration.started')
              )
            )
            .orderBy(desc(workflowEvents.occurredAt))
            .limit(1);

          if (startedEvent) {
            server.eventBus.emit('workflow.instance.migration.started', {
              eventId: randomUUID(),
              eventType: 'workflow.instance.migration.started',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: startedEvent.payload,
            });
          }

          const [completedEvent] = await ctx.db
            .select()
            .from(workflowEvents)
            .where(
              and(
                eq(workflowEvents.instanceId, input.instanceId),
                eq(workflowEvents.eventType, 'workflow.instance.migration.completed')
              )
            )
            .orderBy(desc(workflowEvents.occurredAt))
            .limit(1);

          if (completedEvent) {
            server.eventBus.emit('workflow.instance.migration.completed', {
              eventId: randomUUID(),
              eventType: 'workflow.instance.migration.completed',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: completedEvent.payload,
            });
          }
        }

        return result!;
      }),
  });
}

export const workflowRouter = createWorkflowRouter();
