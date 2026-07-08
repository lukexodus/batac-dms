import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import {
  instances,
  stepInstances,
  steps,
  definitionVersions,
} from '@batac/database/schema/workflow.schema.js';
import {
  documents,
  documentTypes,
} from '@batac/database/schema/documents.schema.js';
import { offices } from '@batac/database/schema/organization.schema.js';
import { eq, and, or, isNull, inArray, desc, gte, lte } from 'drizzle-orm';
import { SlaService } from './services/sla.service.js';
import type { Context } from '../iam/iam.types.js';

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
    completeActionStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().optional(),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'completeActionStep is not implemented.',
        });
      }),

    approveStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().optional(),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'approveStep is not implemented.',
        });
      }),

    rejectStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().min(1),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'rejectStep is not implemented.',
        });
      }),

    returnStepForRevision: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().min(1),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'returnStepForRevision is not implemented.',
        });
      }),

    submitCommitteeReport: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          committeeId: z.string().uuid(),
          reportText: z.string().min(1),
          reportAttachmentS3Key: z.string().uuid().optional(),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'submitCommitteeReport is not implemented.',
        });
      }),

    manuallyAdvanceMultiReferralStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          mandatoryComment: z.string().min(1),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'manuallyAdvanceMultiReferralStep is not implemented.',
        });
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
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'logMayorLapseConfirmation is not implemented.',
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
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'logDocketingCompletion is not implemented.',
        });
      }),

    recordPanlalawiganOutcome: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          outcome: z.enum([
            'valid',
            'valid_in_part',
            'returned',
            'operative_in_its_entirety',
          ]),
          controlNumber: z.string().optional(),
          panlalawiganResolutionNumber: z.string().optional(),
          dateReferred: z.coerce.date().optional(),
          remarks: z.string().optional(),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'recordPanlalawiganOutcome is not implemented.',
        });
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
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'resolveValidInPart is not implemented.',
        });
      }),

    confirmPanlalawiganDeemedApproved: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'confirmPanlalawiganDeemedApproved is not implemented.',
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
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'recordNewspaperPublicationDate is not implemented.',
        });
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
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'migrateInstanceToNewDefinitionVersion is not implemented.',
        });
      }),
  });
}

export const workflowRouter = createWorkflowRouter();
