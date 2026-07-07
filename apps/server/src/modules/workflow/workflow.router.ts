import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';

const paginationInput = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
});

const dateRangeInput = z.object({
  from: z.coerce.date().nullish(),
  to: z.coerce.date().nullish(),
});

export function createWorkflowRouter() {
  return router({
    // Queries
    getInstance: protectedProcedure
      .input(z.object({ instanceId: z.string().uuid() }))
      .query(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'getInstance is not implemented.',
        });
      }),

    getActiveInstanceForDocument: protectedProcedure
      .input(z.object({ documentId: z.string().uuid() }))
      .query(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'getActiveInstanceForDocument is not implemented.',
        });
      }),

    listMyAssignedSteps: protectedProcedure
      .input(paginationInput)
      .query(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'listMyAssignedSteps is not implemented.',
        });
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
      .query(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'getSlaComplianceData is not implemented.',
        });
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
