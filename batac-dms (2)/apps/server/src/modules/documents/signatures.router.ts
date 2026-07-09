import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import type { Context } from '../iam/iam.types.js';
import {
  type LifecycleState,
  type ClassificationLevel,
} from '@batac/shared';
import {
  LogSignatureInputSchema,
  SignatureSelectSchema,
} from '@batac/shared/schemas/documents';
import type { DocumentsRepository } from './documents.repository.js';
import type { DocumentsPublicAPI } from './documents.types.js';
import { DocumentPolicyGuard } from './documents.policy.js';

function getRepository(ctx: Context): DocumentsRepository {
  return ctx.req.server.documentsRepository;
}

function getService(ctx: Context): DocumentsPublicAPI {
  return ctx.req.server.documentsService;
}

function getPolicyGuard(ctx: Context): DocumentPolicyGuard {
  return ctx.req.server.documentsPolicyGuard;
}

const SuccessOutputSchema = z.object({ success: z.literal(true) });

export function createSignatureProcedures() {
  return {
    logSignature: protectedProcedure
      .input(LogSignatureInputSchema)
      .output(SignatureSelectSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        // 1. Verify caller role
        if (!guard.canLogSignature(subject)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Forbidden: Insufficient roles to log signature' });
        }

        // 2. Find parent document
        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        }

        // 3. Insert signature record
        const signatureRow = await repo.insertSignature({
          cityId: subject.cityId,
          documentId: input.documentId,
          signedByEmployeeId: input.signedByEmployeeId,
          signedByDisplayName: input.signedByDisplayName,
          signatureType: input.signatureType,
          signedAt: new Date(input.signedAt),
          isWetInk: input.isWetInk,
          signatureImageS3Key: input.signatureImageS3Key || null,
        });

        return {
          id: signatureRow.id,
          documentId: signatureRow.documentId,
          signedByEmployeeId: signatureRow.signedByEmployeeId,
          signedByDisplayName: signatureRow.signedByDisplayName!,
          signatureType: signatureRow.signatureType as any,
          signedAt: signatureRow.signedAt.toISOString(),
          isWetInk: signatureRow.isWetInk,
          signatureImageS3Key: signatureRow.signatureImageS3Key,
          createdAt: signatureRow.createdAt.toISOString(),
        };
      }),

    uploadSignatureImage: protectedProcedure
      .input(
        z.object({
          signatureId: z.string().uuid(),
          s3Key: z.string().uuid(),
        }),
      )
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        // 1. Fetch signature
        const signature = await repo.findSignatureById(input.signatureId);
        if (!signature || signature.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Signature record not found' });
        }

        // 2. Fetch parent document
        const document = await repo.findDocumentById(signature.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent document not found' });
        }

        // 3. Verify ABAC
        if (!guard.canUploadSignatureImage(subject, { ownedByOfficeId: document.ownedByOfficeId })) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Forbidden: Insufficient privileges to upload signature image',
          });
        }

        // 4. Update image key
        await repo.updateSignatureImageKey(signature.id, input.s3Key);

        return { success: true as const };
      }),

    getSignatureRecords: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
        }),
      )
      .output(z.array(SignatureSelectSchema))
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        // 1. Verify caller role
        if (!guard.canGetSignatureRecords(subject)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Forbidden: Insufficient roles to view signatures' });
        }

        // 2. Fetch parent document
        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        }

        // 3. Fetch signatures (already ordered by signedAt ASC in repository method)
        const signatures = await repo.findSignaturesByDocument(input.documentId);

        return signatures.map((sig) => ({
          id: sig.id,
          documentId: sig.documentId,
          signedByEmployeeId: sig.signedByEmployeeId,
          signedByDisplayName: sig.signedByDisplayName!,
          signatureType: sig.signatureType as any,
          signedAt: sig.signedAt.toISOString(),
          isWetInk: sig.isWetInk,
          signatureImageS3Key: sig.signatureImageS3Key,
          createdAt: sig.createdAt.toISOString(),
        }));
      }),
  };
}
