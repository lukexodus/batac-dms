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
import { documents, documentTypes } from '@batac/database/schema/documents.schema.js';
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
import { workflowPolicy, MAYOR_STEP_KEYS } from './workflow.policy.js';
import type { StepInstanceAttrs, WorkflowInstanceReadAttrs } from './workflow.policy.js';
import type { Context } from '../iam/iam.types.js';
import { cancelInstance, bypassStep, migrateInstance } from './engine/admin-operations.js';

const paginationInput = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
});

const SP_SECRETARIAT_OFFICE_CODE = 'SPS';

function getOrgService(ctx: Context) {
  return ctx.req.server.organizationService;
}

async function checkWorkflowInstanceReadPermission(
  ctx: Context,
  doc: any,
  tx: any = ctx.db,
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
    effectiveOfficeIds.has(doc.ownedByOfficeId) || effectiveOfficeIds.has(doc.originatingOfficeId);

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
  ctx: Context,
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
    .where(and(eq(stepInstances.id, stepInstanceId), isNull(stepInstances.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const { stepInstance, step, instance, doc } = row;

  // Extract assignee from JSONB array (first element, per policy guard contract).
  // assigned_to is stored as [{ user_id?: string, office_id?: string }, ...]
  const assignedTo =
    (stepInstance.assignedTo as Array<{ user_id?: string; office_id?: string }>) ?? [];
  const assigneeUserId = assignedTo[0]?.user_id ?? null;
  const assigneeOfficeId = assignedTo[0]?.office_id ?? null;

  // Extract assigned committees from metadata (for multi_referral step ABAC)
  const metadata = (stepInstance.metadata as Record<string, any>) ?? {};
  const assignedCommittees =
    (metadata['assigned_committees'] as Array<{ committee_id: string }>) ?? [];
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

export function computeMayorPanelHint(
  mayorActionDeadline: string | null | undefined,
  lapseConfirmedAt: unknown,
): 'mayor_decision' | 'mayor_lapse_confirmation' {
  if (mayorActionDeadline) {
    const deadline = new Date(mayorActionDeadline);
    const lapseConfirmed = !!lapseConfirmedAt;
    if (Date.now() > deadline.getTime() && !lapseConfirmed) {
      return 'mayor_lapse_confirmation';
    }
  }
  return 'mayor_decision';
}

function computePanelHint(
  status: 'Active' | 'Completed' | 'Cancelled',
  currentStepType: string,
  currentStep: any,
  instance: any,
  spsOfficeId?: string,
):
  | 'multi_referral'
  | 'vp_certification'
  | 'mayor_decision'
  | 'mayor_lapse_confirmation'
  | 'veto_override_recording'
  | 'docketing'
  | 'panlalawigan_outcome'
  | 'publication_date'
  | 'secretariat_decision'
  | 'generic_action'
  | 'generic_approval'
  | null {
  if (status !== 'Active' || !currentStep) return null;

  const { stepKey, metadata, config } = currentStep;
  const instanceContext = (instance.context as Record<string, any>) || {};
  const stepMetadata = (metadata as Record<string, any>) || {};

  if (currentStepType === 'multi_referral') {
    return 'multi_referral';
  } else if (stepKey === 'vp_certification') {
    return 'vp_certification';
  } else if (stepKey === 'mayor_review' || stepKey === 'mayor_signature') {
    return computeMayorPanelHint(
      instanceContext['mayor_action_deadline'],
      stepMetadata['lapse_confirmed_at'],
    );
  } else if (stepKey === 'veto_override_vote') {
    return 'veto_override_recording';
  } else if (stepKey === 'docketing') {
    return 'docketing';
  } else if (stepKey === 'panlalawigan_review') {
    return 'panlalawigan_outcome';
  } else if (stepKey === 'newspaper_publication') {
    return 'publication_date';
  } else if (
    (currentStepType === 'action' || currentStepType === 'approval') &&
    spsOfficeId &&
    (currentStep.assignedTo as Array<any>)?.[0]?.office_id === spsOfficeId
  ) {
    return 'secretariat_decision';
  } else if (currentStepType === 'action') {
    return 'generic_action';
  } else if (currentStepType === 'approval') {
    return 'generic_approval';
  }

  return null;
}

export function createWorkflowRouter() {
  return router({
    // Queries
    getInstance: protectedProcedure
      .input(z.object({ instanceId: z.string().uuid() }))
      .output(
        z.object({
          instanceId: z.string().uuid(),
          documentId: z.string().uuid(),
          definitionVersionId: z.string().uuid(),
          currentStepType: z.enum([
            'action',
            'approval',
            'multi_referral',
            'decision',
            'notification',
            'termination',
            'parallel_split',
            'parallel_join',
          ]),
          currentStepInstanceId: z.string().uuid(),
          currentAssigneeUserId: z.string().uuid().nullable(),
          status: z.enum(['Active', 'Completed', 'Cancelled']),
          slaDeadline: z.coerce.date().nullable(),
          lapseStatus: z.enum(['mayor_10_day_lapsed', 'panlalawigan_30_day_deemed']).nullable(),
          panelHint: z
            .enum([
              'multi_referral',
              'vp_certification',
              'mayor_decision',
              'mayor_lapse_confirmation',
              'veto_override_recording',
              'docketing',
              'panlalawigan_outcome',
              'publication_date',
              'secretariat_decision',
              'generic_action',
              'generic_approval',
            ])
            .nullable(),
        }),
      )
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
            stepKey: steps.stepKey,
            metadata: stepInstances.metadata,
            config: steps.config,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(and(eq(stepInstances.instanceId, instanceId), isNull(stepInstances.deletedAt)))
          .orderBy(desc(stepInstances.createdAt))
          .limit(1);

        const currentStep = currentSteps[0];
        const assignedUsers = (currentStep?.assignedTo as Array<{ user_id: string }>) || [];
        const currentAssigneeUserId = assignedUsers[0]?.user_id || null;

        let lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null = null;
        const allSteps = await ctx.db
          .select({ outcome: stepInstances.outcome })
          .from(stepInstances)
          .where(and(eq(stepInstances.instanceId, instanceId), isNull(stepInstances.deletedAt)));

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

        const validStepTypes = new Set<
          | 'action'
          | 'approval'
          | 'multi_referral'
          | 'decision'
          | 'notification'
          | 'termination'
          | 'parallel_split'
          | 'parallel_join'
        >([
          'action',
          'approval',
          'multi_referral',
          'decision',
          'notification',
          'termination',
          'parallel_split',
          'parallel_join',
        ]);
        const currentStepType =
          currentStep && validStepTypes.has(currentStep.stepType) ? currentStep.stepType : 'action';

        const spsOffice = await getOrgService(ctx).getOfficeByCode(
          SP_SECRETARIAT_OFFICE_CODE,
          ctx.auth!.cityId,
        );
        const panelHint = computePanelHint(
          status,
          currentStepType,
          currentStep,
          instance,
          spsOffice?.officeId,
        );

        return {
          instanceId: instance.id,
          documentId: instance.documentId,
          definitionVersionId: instance.definitionVersionId,
          currentStepType,
          currentStepInstanceId: currentStep
            ? currentStep.stepInstanceId
            : '00000000-0000-0000-0000-000000000000',
          currentAssigneeUserId,
          status,
          slaDeadline: instance.slaDeadline,
          lapseStatus,
          panelHint,
        };
      }),

    getActiveInstanceForDocument: protectedProcedure
      .input(z.object({ documentId: z.string().uuid() }))
      .output(
        z
          .object({
            instanceId: z.string().uuid(),
            documentId: z.string().uuid(),
            definitionVersionId: z.string().uuid(),
            currentStepType: z.enum([
              'action',
              'approval',
              'multi_referral',
              'decision',
              'notification',
              'termination',
              'parallel_split',
              'parallel_join',
            ]),
            currentStepInstanceId: z.string().uuid(),
            currentAssigneeUserId: z.string().uuid().nullable(),
            status: z.enum(['Active', 'Completed', 'Cancelled']),
            slaDeadline: z.coerce.date().nullable(),
            lapseStatus: z.enum(['mayor_10_day_lapsed', 'panlalawigan_30_day_deemed']).nullable(),
            panelHint: z
              .enum([
                'multi_referral',
                'vp_certification',
                'mayor_decision',
                'mayor_lapse_confirmation',
                'veto_override_recording',
                'docketing',
                'panlalawigan_outcome',
                'publication_date',
                'secretariat_decision',
                'generic_action',
                'generic_approval',
              ])
              .nullable(),
          })
          .nullable(),
      )
      .query(async ({ input, ctx }) => {
        const { documentId } = input;

        const [instance] = await ctx.db
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
            stepKey: steps.stepKey,
            metadata: stepInstances.metadata,
            config: steps.config,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(and(eq(stepInstances.instanceId, instance.id), isNull(stepInstances.deletedAt)))
          .orderBy(desc(stepInstances.createdAt))
          .limit(1);

        const currentStep = currentSteps[0];
        const assignedUsers = (currentStep?.assignedTo as Array<{ user_id: string }>) || [];
        const currentAssigneeUserId = assignedUsers[0]?.user_id || null;

        let lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null = null;
        const allSteps = await ctx.db
          .select({ outcome: stepInstances.outcome })
          .from(stepInstances)
          .where(and(eq(stepInstances.instanceId, instance.id), isNull(stepInstances.deletedAt)));

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

        const validStepTypes = new Set<
          | 'action'
          | 'approval'
          | 'multi_referral'
          | 'decision'
          | 'notification'
          | 'termination'
          | 'parallel_split'
          | 'parallel_join'
        >([
          'action',
          'approval',
          'multi_referral',
          'decision',
          'notification',
          'termination',
          'parallel_split',
          'parallel_join',
        ]);
        const currentStepType =
          currentStep && validStepTypes.has(currentStep.stepType) ? currentStep.stepType : 'action';

        const spsOffice = await getOrgService(ctx).getOfficeByCode(
          SP_SECRETARIAT_OFFICE_CODE,
          ctx.auth!.cityId,
        );
        const panelHint = computePanelHint(
          status,
          currentStepType,
          currentStep,
          instance,
          spsOffice?.officeId,
        );

        return {
          instanceId: instance.id,
          documentId: instance.documentId,
          definitionVersionId: instance.definitionVersionId,
          currentStepType,
          currentStepInstanceId: currentStep
            ? currentStep.stepInstanceId
            : '00000000-0000-0000-0000-000000000000',
          currentAssigneeUserId,
          status,
          slaDeadline: instance.slaDeadline,
          lapseStatus,
          panelHint,
        };
      }),

    listMyAssignedSteps: protectedProcedure
      .input(paginationInput.extend({ stepKeyIn: z.array(z.string()).optional() }))
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
            stepKey: steps.stepKey,
            assignedTo: stepInstances.assignedTo,
            createdAt: stepInstances.createdAt,
            slaDeadline: stepInstances.slaDeadline,
            documentOfficeId: documents.ownedByOfficeId,
            instanceContext: instances.context,
            stepMetadata: stepInstances.metadata,
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
              isNull(instances.deletedAt),
            ),
          )
          .orderBy(desc(stepInstances.createdAt));

        const allOffices = await ctx.db
          .select({ id: offices.id, code: offices.code })
          .from(offices)
          .where(eq(offices.cityId, ctx.auth.cityId));
        const spOfficeIds = new Set(
          allOffices
            .filter((o) => o.code === 'SP' || o.code === 'SPS' || o.code === 'OVM')
            .map((o) => o.id),
        );

        const subjectUserId = ctx.auth.userId;
        const effectiveOfficeIds = new Set(ctx.auth.effectiveOfficeIds || []);

        const filtered = rows.filter((row) => {
          const assigned =
            (row.assignedTo as Array<{ user_id?: string; office_id?: string }>) || [];

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

        const stepKeyFiltered =
          input.stepKeyIn && input.stepKeyIn.length > 0
            ? filtered.filter((row) => input.stepKeyIn!.includes(row.stepKey))
            : filtered;

        const limit = input.limit ?? 50;
        const startIndex = input.cursor ? parseInt(input.cursor, 10) : 0;
        const paginated = stepKeyFiltered.slice(startIndex, startIndex + limit);
        const nextCursor =
          startIndex + limit < stepKeyFiltered.length ? String(startIndex + limit) : null;

        const items = paginated.map((item) => {
          const validStepTypes = new Set<
            | 'action'
            | 'approval'
            | 'multi_referral'
            | 'decision'
            | 'notification'
            | 'termination'
            | 'parallel_split'
            | 'parallel_join'
          >(['action', 'approval', 'multi_referral', 'decision', 'notification', 'termination']);
          const stepType = validStepTypes.has(item.stepType) ? item.stepType : 'action';

          const context = (item.instanceContext as Record<string, any>) || {};
          const metadata = (item.stepMetadata as Record<string, any>) || {};
          const panelHint = MAYOR_STEP_KEYS.has(item.stepKey)
            ? computeMayorPanelHint(
                context['mayor_action_deadline'],
                metadata['lapse_confirmed_at'],
              )
            : null;

          return {
            stepInstanceId: item.stepInstanceId,
            instanceId: item.instanceId,
            documentId: item.documentId,
            documentTitle: item.documentTitle,
            stepType,
            stepKey: item.stepKey,
            assignedAt: item.createdAt,
            dueAt: item.slaDeadline,
            panelHint,
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
        }),
      )
      .query(async ({ input, ctx }) => {
        workflowPolicy.canAccessSlaData(ctx.auth);

        const conditions = [eq(instances.cityId, ctx.auth.cityId), isNull(instances.deletedAt)];

        if (input.documentTypeId) {
          conditions.push(eq(documents.documentTypeId, input.documentTypeId));
        }

        if (input.officeId) {
          conditions.push(
            or(
              eq(documents.ownedByOfficeId, input.officeId)!,
              eq(documents.originatingOfficeId, input.officeId)!,
            )!,
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
        }),
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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepAction(
            instance,
            stepInstance,
            ctx.auth!.userId,
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        // Emit to event bus so audit consumer can create an audit log entry.
        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} DONE`,
              cityId: ctx.auth!.cityId,
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
        }),
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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'APPROVED',
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} APPROVED`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    logSecretariatDecision: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          stepInstanceId: z.string().uuid(),
          decision: z.enum(['approve', 'reject', 'amended']),
          remarks: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, decision, remarks = null } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        // ABAC: SP Secretary + Office check
        const spsOffice = await getOrgService(ctx).getOfficeByCode(
          SP_SECRETARIAT_OFFICE_CODE,
          ctx.auth.cityId,
        );
        const isSpSecretariatOffice = spsOffice
          ? stepAttrs.assigneeOfficeId === spsOffice.officeId
          : false;

        workflowPolicy.canLogSecretariatDecision(ctx.auth, { isSpSecretariatOffice });

        const outcomeMap: Record<string, string> = {
          approve: 'APPROVED',
          reject: 'REJECTED',
          amended: 'AMENDED',
        };
        const outcome = outcomeMap[decision];

        if (!outcome) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid decision outcome.' });
        }

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            outcome,
            remarks,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              outcome,
              comment: remarks,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} DONE`,
              cityId: ctx.auth!.cityId,
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
        }),
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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'REJECTED',
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} REJECTED`,
              cityId: ctx.auth!.cityId,
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
        }),
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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'RETURNED_FOR_REVISION',
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} RETURNED_FOR_REVISION`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    /**
     * `workflow.submitApprovalOutcome`
     *
     * Generic outcome-submission procedure for `approval`-type steps whose
     * `allowed_outcomes` do not match any of the hardcoded-outcome procedures
     * (`approveStep`, `rejectStep`, `returnStepForRevision`, `logSecretariatDecision`).
     * The outcome string is validated against the step's own
     * `config.allowed_outcomes` by `submitStepApproval` itself — this procedure
     * does not hardcode or restrict which outcome strings are acceptable beyond
     * requiring a non-empty string; the workflow engine is the source of truth
     * for what's valid on a given step.
     *
     * ABAC: identical to `approveStep`/`rejectStep`/`returnStepForRevision` —
     * reuses `workflowPolicy.canApproveStep` unchanged (role + step-type +
     * step-status + assignment gates; step-key-agnostic).
     *
     * Added by TASK-WF-FE-019 to cover `returned_review`, `legal_office_review`,
     * and `committee_revisions_review`, none of which fit any existing procedure's
     * hardcoded outcome set.
     */
    submitApprovalOutcome: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          outcome: z.string().min(1),
          comment: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, outcome, comment = null } = input;

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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            outcome,
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              outcome,
              comment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} ${outcome}`,
              cityId: ctx.auth!.cityId,
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
        }),
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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        // As per E1, we pass a generated UUID for contributionDocId since the engine
        // only records it as a reference in the metadata array.
        const contributionDocId = randomUUID();

        let isCompleted = false;

        await ctx.db.transaction(async (tx) => {
          const txWorkflowRepo = new WorkflowRepository(tx);

          await engineSubmitCommitteeReport(
            instance,
            stepInstance,
            committeeId,
            ctx.auth!.userId,
            contributionDocId,
            { ...deps, db: tx, workflowRepository: txWorkflowRepo },
            tx,
          );

          // After submitting, check if all committees have submitted.
          // The engine handler updates stepInstance in DB, so we must fetch the fresh row
          // inside this transaction to check the updated submissions array.
          const freshStepInstance = await txWorkflowRepo.getStepInstanceById(
            stepInstanceId,
            tx,
          );
          if (!freshStepInstance) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve fresh step instance.',
            });
          }

          const freshMetadata = (freshStepInstance.metadata as Record<string, any>) ?? {};
          const assigned =
            (freshMetadata['assigned_committees'] as Array<{ committee_id: string }>) ?? [];
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
        }),
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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txWorkflowRepo = new WorkflowRepository(tx);

          const freshStepInstance = await txWorkflowRepo.getStepInstanceById(
            stepInstanceId,
            tx,
          );
          if (!freshStepInstance) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve fresh step instance.',
            });
          }

          const freshMetadata = (freshStepInstance.metadata as Record<string, any>) ?? {};

          freshMetadata['unified_report_document_id'] = unifiedReportDocumentId;
          await txWorkflowRepo.updateStepInstance(
            stepInstanceId,
            { metadata: freshMetadata },
            tx,
          );

          await submitStepMultiReferral(
            instance,
            { ...freshStepInstance, metadata: freshMetadata },
            ctx.auth!.userId,
            'user',
            'REPORT_ACCEPTED',
            null,
            { ...deps, db: tx, workflowRepository: txWorkflowRepo },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${found.step.stepType} REPORT_ACCEPTED`,
              cityId: ctx.auth!.cityId,
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
        }),
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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepMultiReferral(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'SECRETARY_ADVANCED',
            mandatoryComment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} SECRETARY_ADVANCED`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    certifyAsPresidingOfficer: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        const found = await fetchStepContext(input.stepInstanceId, ctx);
        if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        const { stepInstance, step, instance, stepAttrs } = found;

        if (step.stepType !== 'approval' || step.stepKey !== 'vp_certification') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid step type or key.' });
        }

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        const hasRole = ctx.auth.effectiveRoles.includes('sp_presiding_officer');
        if (!hasRole)
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Requires sp_presiding_officer role.',
          });

        const isAssignee = stepAttrs.assigneeUserId === ctx.auth.userId;
        let isActingViaDelegation = false;
        const delegationSummary = await deps.orgService.getActiveDelegationForUser(ctx.auth.userId);
        if (delegationSummary) {
          const grant = await deps.delegationService.getDelegationGrantById(delegationSummary.id);
          if (grant?.scope?.roles?.includes('sp_presiding_officer')) {
            isActingViaDelegation = true;
          }
        }

        if (!isAssignee && !isActingViaDelegation) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Must be direct assignee or hold active delegation.',
          });
        }

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth.userId,
            'user',
            'SIGNED',
            null,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: input.stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'SIGNED',
              comment: null,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} SIGNED`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    mayorSign: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        const found = await fetchStepContext(input.stepInstanceId, ctx);
        if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        const { stepInstance, step, instance, stepAttrs } = found;

        if (step.stepKey !== 'mayor_review' && step.stepKey !== 'mayor_signature') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid step key.' });
        }

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        const hasRole = ctx.auth.effectiveRoles.includes('mayor');
        if (!hasRole) throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires mayor role.' });

        const isAssignee = stepAttrs.assigneeUserId === ctx.auth.userId;
        let isActingViaDelegation = false;
        const delegationSummary = await deps.orgService.getActiveDelegationForUser(ctx.auth.userId);
        if (delegationSummary) {
          const grant = await deps.delegationService.getDelegationGrantById(delegationSummary.id);
          if (grant?.scope?.roles?.includes('mayor')) {
            isActingViaDelegation = true;
          }
        }

        if (!isAssignee && !isActingViaDelegation) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Must be direct assignee or hold active delegation.',
          });
        }

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth.userId,
            'user',
            'SIGNED',
            null,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: input.stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'SIGNED',
              comment: null,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} SIGNED`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    mayorVeto: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          objectionsText: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const found = await fetchStepContext(input.stepInstanceId, ctx);
        if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        const { stepInstance, step, instance, stepAttrs } = found;

        if (step.stepKey !== 'mayor_review' && step.stepKey !== 'mayor_signature') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid step key.' });
        }

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        const hasRole = ctx.auth.effectiveRoles.includes('mayor');
        if (!hasRole) throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires mayor role.' });

        const isAssignee = stepAttrs.assigneeUserId === ctx.auth.userId;
        let isActingViaDelegation = false;
        const delegationSummary = await deps.orgService.getActiveDelegationForUser(ctx.auth.userId);
        if (delegationSummary) {
          const grant = await deps.delegationService.getDelegationGrantById(delegationSummary.id);
          if (grant?.scope?.roles?.includes('mayor')) {
            isActingViaDelegation = true;
          }
        }

        if (!isAssignee && !isActingViaDelegation) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Must be direct assignee or hold active delegation.',
          });
        }

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth.userId,
            'user',
            'VETOED',
            input.objectionsText,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: input.stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'VETOED',
              comment: input.objectionsText,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${step.stepType} VETOED`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
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

        // Idempotency check: Repeated manual confirmation calls are treated as a no-op to
        // prevent duplicate audit trail logging. Rationale: The SP Secretary's acknowledgment
        // that the lapse occurred is distinguished from the scheduler-set status using the
        // presence of the lapse_confirmed_at key in the step instance's metadata.

        return await ctx.db.transaction(async (tx) => {
          // Re-fetch with lock to prevent race conditions
          const txRepo = new WorkflowRepository(tx);
          const lockedStepInstance = await txRepo.lockStepInstanceForUpdate(
            stepInstance.id,
            tx,
          );
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
            tx,
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
            tx,
          );

          const server = ctx.req.server as any;
          if (ctx.req.server.eventBus) {
            ctx.req.server.eventBus.emit('workflow.step.completed', {
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
                documentId: instance.documentId,
                actorId: ctx.auth!.userId,
                fromOfficeId: null,
                toOfficeId: null,
                actionDescription: `${stepContext.step.stepType} ${'LAPSED_CONFIRMED'}`,
                cityId: ctx.auth!.cityId,
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
        }),
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        // 2/3 of 12 SP members = 8. Hardcoded per consolidated reference Part 4.1/4.2
        // ("Override vote: 2/3 = 8 of 12") — not a judgment call, not configurable.
        const outcome = input.votesFor >= 8 ? 'OVERRIDE_SUCCEEDED' : 'OVERRIDE_FAILED';

        const server4 = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server4.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server4.organizationService,
          delegationService: server4.delegationService,
          iamService: server4.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          const patch: Record<string, any> = {
            veto_override_votes_for: input.votesFor,
            veto_override_votes_against: input.votesAgainst,
            veto_override_absent_councilor_ids: input.absentCouncilorIds,
          };

          await txDeps.workflowRepository.updateInstanceContext(
            stepContext.instance.id,
            patch,
            tx,
          );

          const updatedInstance = await txDeps.workflowRepository.getInstanceById(
            stepContext.instance.id,
            tx,
          );
          if (!updatedInstance) throw new Error('Instance not found');

          await submitStepApproval(
            updatedInstance,
            stepContext.stepInstance,
            ctx.auth.userId,
            'user',
            outcome,
            null, // comment — require_comment_on: [] for this step
            txDeps,
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              outcome,
              comment: null,
              documentId: stepContext.instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${stepContext.step.stepType} DONE`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
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
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          await submitStepAction(
            stepContext.instance,
            stepContext.stepInstance,
            ctx.auth.userId,
            null, // comment
            txDeps,
            tx,
          );

          // Docketing is the precondition for Panlalawigan transmission
          // (see apps/server/src/modules/documents/panlalawigan.router.ts,
          // initiatePanlalawiganTransmittal's precondition check). Without
          // this call, that procedure always throws PRECONDITION_FAILED.
          await deps.documentsService.transitionState(
            stepContext.instance.documentId,
            'pending_panlalawigan_review',
            ctx.auth.userId,
            'Docketing completed; document transmitted for Panlalawigan review',
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              documentId: stepContext.instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${stepContext.step.stepType} DONE`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
      }),

    recordPanlalawiganOutcome: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          outcome: z.enum(['VALID', 'VALID_IN_PART', 'RETURNED', 'OPERATIVE_IN_ITS_ENTIRETY']),
          controlNumber: z.string().optional(),
          panlalawiganResolutionNumber: z.string().optional(),
          remarks: z.string().optional(),
        }),
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
          eventBus: ctx.req.server.eventBus,
          orgService: server2.organizationService,
          delegationService: server2.delegationService,
          iamService: server2.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          const patch: Record<string, any> = {
            panlalawigan_outcome: input.outcome,
          };
          if (input.controlNumber !== undefined)
            patch['panlalawigan_control_number'] = input.controlNumber;
          if (input.panlalawiganResolutionNumber !== undefined)
            patch['panlalawigan_resolution_number'] = input.panlalawiganResolutionNumber;
          if (input.remarks !== undefined) patch['panlalawigan_remarks'] = input.remarks;

          await txDeps.workflowRepository.updateInstanceContext(instance.id, patch, tx);

          // Refresh instance to get updated context
          const updatedInstance = await txDeps.workflowRepository.getInstanceById(
            instance.id,
            tx,
          );
          if (!updatedInstance) throw new Error('Instance not found');

          await submitStepApproval(
            updatedInstance,
            stepInstance,
            ctx.auth.userId,
            'user',
            input.outcome,
            input.remarks ?? null,
            txDeps,
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${stepContext.step.stepType} ${input.outcome}`,
              cityId: ctx.auth!.cityId,
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
        }),
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const workflowRepository = new WorkflowRepository(ctx.db);
        const instance = await workflowRepository.getActiveInstanceForDocument(input.documentId);
        if (!instance) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Active workflow instance not found for document',
          });
        }

        const rows = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(stepInstances.instanceId, instance.id),
              eq(steps.stepKey, 'valid_in_part_decision'),
              inArray(stepInstances.status, ['pending', 'active']),
              isNull(stepInstances.deletedAt),
            ),
          )
          .limit(1);

        if (rows.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No active valid_in_part_decision step found',
          });
        }

        const stepContext = await fetchStepContext(rows[0]!.stepInstanceId, ctx);
        if (!stepContext)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });

        workflowPolicy.canResolveValidInPart(ctx.auth);

        const server3 = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server3.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server3.organizationService,
          delegationService: server3.delegationService,
          iamService: server3.iamService,
        };

        // Map resolutionPath to engine outcome string
        let outcome = 'RESOLVED_IN_PLACE';
        if (input.resolutionPath === 'route_to_legal') outcome = 'ROUTED_TO_LEGAL';
        else if (input.resolutionPath === 'route_to_committee') outcome = 'ROUTED_TO_COMMITTEE';
        else if (input.resolutionPath === 'implement_directly') outcome = 'REVISED_DIRECTLY';

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          if (input.resolutionPath === 'route_to_committee') {
            // Find the original committee referral step instance to get the committee ID
            const committeeRows = await tx
              .select({ metadata: stepInstances.metadata })
              .from(stepInstances)
              .innerJoin(steps, eq(stepInstances.stepId, steps.id))
              .where(
                and(
                  eq(stepInstances.instanceId, instance.id),
                  eq(steps.stepKey, 'committee_referral'),
                  isNull(stepInstances.deletedAt),
                ),
              )
              .orderBy(desc(stepInstances.createdAt))
              .limit(1);

            if (committeeRows.length === 0) {
              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'No committee referral found in this workflow instance to route back to.',
              });
            }

            const metadata = (committeeRows[0]!.metadata as Record<string, any>) || {};
            const assignedCommittees = metadata['assigned_committees'] as
              | Array<{ committee_id: string }>
              | undefined;

            if (!assignedCommittees || assignedCommittees.length === 0) {
              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'No committees were assigned during the referral step.',
              });
            }

            const primaryCommitteeId = assignedCommittees[0]!.committee_id;
            const chair = await txDeps.orgService.getCommitteeChair(primaryCommitteeId);

            if (chair) {
              await txDeps.workflowRepository.updateInstanceContext(
                instance.id,
                {
                  referred_committee_chair_id: chair.userId,
                },
                tx,
              );
            }
          }

          // Refresh instance to get updated context (e.g. if we set referred_committee_chair_id)
          const updatedInstance = await txDeps.workflowRepository.getInstanceById(
            instance.id,
            tx,
          );
          if (!updatedInstance) throw new Error('Instance not found');

          await submitStepApproval(
            updatedInstance,
            stepContext.stepInstance,
            ctx.auth.userId,
            'user',
            outcome,
            input.mandatoryComment,
            txDeps,
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              outcome,
              comment: input.mandatoryComment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${stepContext.step.stepType} DONE`,
              cityId: ctx.auth!.cityId,
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
          const txRepo = new WorkflowRepository(tx);
          const lockedStepInstance = await txRepo.lockStepInstanceForUpdate(
            stepInstance.id,
            tx,
          );
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
            tx,
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
            tx,
          );

          if (ctx.req.server.eventBus) {
            ctx.req.server.eventBus.emit('workflow.step.completed', {
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
                documentId: instance.documentId,
                actorId: ctx.auth!.userId,
                fromOfficeId: null,
                toOfficeId: null,
                actionDescription: `${stepContext.step.stepType} ${'DEEMED_APPROVED_CONFIRMED'}`,
                cityId: ctx.auth!.cityId,
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
        }),
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const workflowRepository = new WorkflowRepository(ctx.db);
        const instance = await workflowRepository.getActiveInstanceForDocument(input.documentId);
        if (!instance) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Active workflow instance not found for document',
          });
        }

        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        // Fetch document type and metadata to verify constraint
        const docRows = await ctx.db
          .select({
            code: documentTypes.code,
            metadata: documents.metadata,
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

        // Add penalty clause check
        const docMetadata = (docRows[0]!.metadata as Record<string, any>) || {};
        const hasPenalty =
          docMetadata['has_penalty_provision'] === true ||
          docMetadata['has_penalty_provision'] === 'true';
        if (!hasPenalty) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Only ordinances with a penalty provision require newspaper publication.',
          });
        }

        // Query active step instance for 'newspaper_publication'
        const rows = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(stepInstances.instanceId, instance.id),
              eq(steps.stepKey, 'newspaper_publication'),
              inArray(stepInstances.status, ['pending', 'active']),
              isNull(stepInstances.deletedAt),
            ),
          )
          .limit(1);

        if (rows.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No active newspaper_publication step found for this instance',
          });
        }

        const stepContext = await fetchStepContext(rows[0]!.stepInstanceId, ctx);
        if (!stepContext)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          await txDeps.workflowRepository.updateInstanceContext(
            instance.id,
            {
              publication_date: input.publicationDate.toISOString().split('T')[0],
              publication_newspaper: input.newspaperName,
            },
            tx,
          );

          await submitStepAction(
            instance,
            stepContext.stepInstance,
            ctx.auth.userId,
            null, // comment
            txDeps,
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
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
              outcome: 'DONE',
              comment: null,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: `${stepContext.step.stepType} DONE`,
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
      }),

    cancelInstance: protectedProcedure
      .input(
        z.object({
          instanceId: z.string().uuid(),
          reason: z.string().min(1),
        }),
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
          classificationLevel: doc.classificationLevel as
            | 'public'
            | 'internal'
            | 'confidential'
            | 'restricted',
        };

        workflowPolicy.canCancelInstance(ctx.auth, attrs);

        const server = ctx.req.server as any;
        await ctx.db.transaction(async (tx) => {
          const deps = {
            db: tx,
            workflowRepository: new WorkflowRepository(tx),
            documentsService: server.documentsService,
            eventBus: ctx.req.server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            getApprovalGrant: (instanceId: string, versionId: string) =>
              deps.workflowRepository.getApprovalGrant(instanceId, versionId),
            markApprovalGrantUsed: (grantId: string) =>
              deps.workflowRepository.markApprovalGrantUsed(grantId),
          };
          await cancelInstance(input.instanceId, ctx.auth!.userId, input.reason, deps);
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.instance.cancelled', {
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
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        workflowPolicy.canBypassStep(ctx.auth);

        const server = ctx.req.server as any;
        await ctx.db.transaction(async (tx) => {
          const deps = {
            db: tx,
            workflowRepository: new WorkflowRepository(tx),
            documentsService: server.documentsService,
            eventBus: ctx.req.server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            iamService: server.iamService,
            getApprovalGrant: (instanceId: string, versionId: string) =>
              deps.workflowRepository.getApprovalGrant(instanceId, versionId),
            markApprovalGrantUsed: (grantId: string) =>
              deps.workflowRepository.markApprovalGrantUsed(grantId),
          };
          await bypassStep(
            input.stepInstanceId,
            ctx.auth!.userId,
            input.bypassReason,
            input.comment,
            input.outcomeCode,
            deps,
          );
        });

        const [stepInstance] = await ctx.db
          .select({ instanceId: stepInstances.instanceId })
          .from(stepInstances)
          .where(eq(stepInstances.id, input.stepInstanceId))
          .limit(1);

        if (ctx.req.server.eventBus && stepInstance) {
          ctx.req.server.eventBus.emit('workflow.step.bypassed', {
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
        }),
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
            db: tx,
            workflowRepository: new WorkflowRepository(tx),
            documentsService: server.documentsService,
            eventBus: ctx.req.server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            getApprovalGrant: (instanceId: string, versionId: string) =>
              deps.workflowRepository.getApprovalGrant(instanceId, versionId),
            markApprovalGrantUsed: (grantId: string) =>
              deps.workflowRepository.markApprovalGrantUsed(grantId),
          };
          result = await migrateInstance(
            input.instanceId,
            input.newDefinitionVersionId,
            ctx.auth!.userId,
            input.mandatoryReason,
            deps,
          );
        });

        if (ctx.req.server.eventBus) {
          const [startedEvent] = await ctx.db
            .select()
            .from(workflowEvents)
            .where(
              and(
                eq(workflowEvents.instanceId, input.instanceId),
                eq(workflowEvents.eventType, 'workflow.instance.migration.started'),
              ),
            )
            .orderBy(desc(workflowEvents.occurredAt))
            .limit(1);

          if (startedEvent) {
            ctx.req.server.eventBus.emit('workflow.instance.migration.started', {
              eventId: randomUUID(),
              eventType: 'workflow.instance.migration.started',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: startedEvent.payload as Record<string, unknown>,
            });
          }

          const [completedEvent] = await ctx.db
            .select()
            .from(workflowEvents)
            .where(
              and(
                eq(workflowEvents.instanceId, input.instanceId),
                eq(workflowEvents.eventType, 'workflow.instance.migration.completed'),
              ),
            )
            .orderBy(desc(workflowEvents.occurredAt))
            .limit(1);

          if (completedEvent) {
            ctx.req.server.eventBus.emit('workflow.instance.migration.completed', {
              eventId: randomUUID(),
              eventType: 'workflow.instance.migration.completed',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: completedEvent.payload as Record<string, unknown>,
            });
          }
        }

        return result!;
      }),
  });
}

export const workflowRouter = createWorkflowRouter();
