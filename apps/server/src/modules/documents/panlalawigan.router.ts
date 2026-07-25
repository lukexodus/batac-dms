import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'node:crypto';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import type { Context } from '../iam/iam.types.js';
import { type LifecycleState } from '@batac/shared';
import {
  DocumentIdInputSchema,
  InitiatePanlalawiganTransmittalInputSchema,
  LogPanlalawiganOutcomeInputSchema,
  PanlalawiganReviewSelectSchema,
} from '@batac/shared/schemas/documents';
import type { DocumentsRepository } from './documents.repository.js';
import type { DocumentsPublicAPI } from './documents.types.js';
import type { NumberingService } from './numbering.service.js';

function getRepository(ctx: Context): DocumentsRepository {
  return ctx.req.server.documentsRepository;
}

function getService(ctx: Context): DocumentsPublicAPI {
  return ctx.req.server.documentsService;
}

function getNumberingService(ctx: Context): NumberingService {
  return ctx.req.server.numberingService;
}

function getEventBus(ctx: Context): any {
  return ctx.req.server.eventBus;
}

const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000';

export function createPanlalawiganProcedures() {
  return {
    initiatePanlalawiganTransmittal: protectedProcedure
      .input(InitiatePanlalawiganTransmittalInputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // Callable by: sp_secretary ONLY
        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only SP Secretary can initiate transmittal',
          });
        }

        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.documentId);

        if (!document) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        }

        // Precondition: document.lifecycle_state MUST BE 'pending_panlalawigan_review'
        if (document.lifecycleState !== 'pending_panlalawigan_review') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Document lifecycle state must be pending_panlalawigan_review',
          });
        }

        // action_deadline = transmittedAt + INTERVAL '30 days'
        const actionDeadline = new Date(input.transmittedAt);
        actionDeadline.setDate(actionDeadline.getDate() + 30);

        // Assign panlalawigan_review_log series control number
        const numberingService = getNumberingService(ctx);
        const year = new Date(input.transmittedAt).getFullYear();

        // As per task instructions: series_key='panlalawigan_review_log'
        const controlNumberObj = await numberingService.assignControlNumber(
          input.documentId,
          'panlalawigan_review_log',
          subject.cityId,
          subject.userId,
        );

        const review = await repo.insertPanlalawiganReview({
          documentId: input.documentId,
          cityId: subject.cityId,
          transmittedAt: new Date(input.transmittedAt),
          actionDeadline,
          controlNo: controlNumberObj.numberValue,
          subject: input.subject ?? null,
        });

        const eventBus = getEventBus(ctx);
        if (eventBus) {
          const now = new Date();
          eventBus.emit('audit.document.panlalawigan_transmitted', {
            eventId: crypto.randomUUID(),
            eventType: 'audit.document.panlalawigan_transmitted',
            occurredAt: now.toISOString(),
            cityId: subject.cityId,
            schemaVersion: 1,
            payload: {
              documentId: input.documentId,
              actorId: subject.userId,
              cityId: subject.cityId,
              timestamp: now,
            },
          });
        }

        return { success: true, controlNumber: controlNumberObj.numberValue };
      }),

    logPanlalawiganOutcome: protectedProcedure
      .input(LogPanlalawiganOutcomeInputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // Callable by: sp_secretary ONLY
        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only SP Secretary can log outcome' });
        }

        if (input.outcome === 'deemed_approved') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'deemed_approved is set by the system only',
          });
        }

        const repo = getRepository(ctx);
        const review = await repo.findPanlalawiganReviewByDocument(input.documentId);

        if (!review) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Panlalawigan review not found for this document',
          });
        }

        if (review.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        await repo.updatePanlalawiganReview(input.documentId, {
          outcome: input.outcome,
          responseDate: new Date(input.receivedAt),
          resolutionNumber: input.panlalawiganResolutionNumber ?? null,
          remarks: input.remarks ?? null,
        });

        // Transition document state based on outcome
        const service = getService(ctx);
        let nextState: LifecycleState | null = null;
        if (['valid', 'valid_in_part', 'operative_in_its_entirety'].includes(input.outcome)) {
          nextState = 'completed';
        } else if (input.outcome === 'returned') {
          nextState = 'in_workflow';
        }

        if (nextState) {
          await service.transitionState(
            input.documentId,
            nextState,
            subject.userId,
            'Panlalawigan review outcome logged',
          );
        }

        const eventBus = getEventBus(ctx);
        if (eventBus) {
          const now = new Date();
          eventBus.emit('audit.document.panlalawigan_outcome_logged', {
            eventId: crypto.randomUUID(),
            eventType: 'audit.document.panlalawigan_outcome_logged',
            occurredAt: now.toISOString(),
            cityId: subject.cityId,
            schemaVersion: 1,
            payload: {
              documentId: input.documentId,
              outcome: input.outcome,
              actorId: subject.userId,
              cityId: subject.cityId,
              timestamp: now,
            },
          });
        }

        return { success: true };
      }),

    getPanlalawiganReview: protectedProcedure
      .input(DocumentIdInputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const allowedRoles = [
          'sp_secretary',
          'sp_presiding_officer',
          'records_officer',
          'auditor',
          'mayor',
        ];

        if (!subject.roles.some((r) => allowedRoles.includes(r))) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to view Panlalawigan reviews',
          });
        }

        const repo = getRepository(ctx);
        const review = await repo.findPanlalawiganReviewByDocument(input.documentId);

        if (!review || review.cityId !== subject.cityId) {
          return null;
        }

        return {
          documentId: review.documentId,
          transmittedAt: review.transmittedAt!.toISOString(),
          actionDeadline: review.actionDeadline?.toISOString() ?? null,
          controlNumber: review.controlNo,
          subject: review.subject,
          outcome: review.outcome as any,
          responseDate: review.responseDate?.toISOString() ?? null,
          resolutionNumber: review.resolutionNumber,
          remarks: review.remarks,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
          receivedAt: review.receivedAt?.toISOString() ?? null,
          panlalawiganResolutionNumber: review.resolutionNumber,
          daysElapsed: review.daysElapsed,
        };
      }),
  };
}
