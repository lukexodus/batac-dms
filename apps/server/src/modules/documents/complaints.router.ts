import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'node:crypto';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import {
  UuidSchema,
  TimestampSchema,
  PaginationInputSchema,
} from '@batac/shared/schemas/common';
import { LifecycleStateSchema } from '@batac/shared/schemas/documents';
import { documents, documentTypes } from '@batac/database/schema/documents.schema.js';
import type { Context } from '../iam/iam.types.js';

function getDb(ctx: Context) {
  return ctx.req.server.db;
}

function getRepository(ctx: Context) {
  return ctx.req.server.documentsRepository;
}

function getEventBus(ctx: Context) {
  return (ctx.req.server as any).eventBus;
}

// ---------------------------------------------------------------------------
// Output Schemas
// ---------------------------------------------------------------------------

const SuccessOutputSchema = z.object({ success: z.literal(true) });

const CreateComplaintOutputSchema = z.object({
  complaintId: UuidSchema,
});

const ComplaintListItemSchema = z.object({
  complaintId: UuidSchema,
  subjectMatter: z.string(),
  outcomeState: z.enum(['pending_hearing', 'received_seen', 'dismissed', 'resolved']),
  assignedOfficeId: UuidSchema.nullable(),
  createdAt: TimestampSchema,
});

const ListComplaintsOutputSchema = z.object({
  items: z.array(ComplaintListItemSchema),
  nextCursor: UuidSchema.nullable(),
});

const ComplaintDetailOutputSchema = ComplaintListItemSchema.extend({
  committeeReport: z.string().nullable(),
  respondent: z
    .object({
      name: z.string(),
      tricycleNumber: z.string().nullable(),
      contactNumber: z.string().nullable(),
      email: z.string().nullable(),
      notificationChannel: z.string().nullable(),
    })
    .nullable(),
  incidentDetails: z
    .object({
      date: z.string().nullable(),
      time: z.string().nullable(),
      place: z.string().nullable(),
      narrative: z.string().nullable(),
    })
    .nullable(),
  routingDecision: z.string().nullable(),
});

export function createComplaintsRouter() {
  return router({
    createComplaintClerkAssisted: protectedProcedure
      .input(
        z.object({
          complainantName: z.string().min(1),
          complainantAddress: z.string().optional(),
          complainantContact: z.string().optional(),
          subjectCategory: z.string().min(1),
          incidentNarrative: z.string().min(1),
          respondentName: z.string().optional(),
          respondentEmail: z.string().email().optional(),
          respondentPhone: z.string().optional(),
        })
      )
      .output(CreateComplaintOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'SP Secretary role required' });
        }

        const db = getDb(ctx);
        const [docType] = await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.code, 'CITIZEN_COMPLAINT'))
          .limit(1);

        if (!docType) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'CITIZEN_COMPLAINT document type not found' });
        }

        const repo = getRepository(ctx);
        
        const metadata = {
          complainant: {
            name: input.complainantName,
            address: input.complainantAddress ?? null,
            contactNumber: input.complainantContact ?? null,
            email: null,
            citizenUserId: null,
          },
          subjectCategory: input.subjectCategory,
          violationType: null,
          incidentDetails: {
            date: null,
            time: null,
            place: null,
            narrative: input.incidentNarrative,
          },
          respondent: input.respondentName
            ? {
                name: input.respondentName,
                tricycleNumber: null,
                contactNumber: input.respondentPhone ?? null,
                email: input.respondentEmail ?? null,
                notificationChannel: null,
              }
            : null,
          accessMode: 'in_person_clerk',
          routingDecision: null,
          outcomeState: 'pending_hearing',
        };

        const title = `Citizen Complaint -- ${input.complainantName} -- ${new Date().toISOString().slice(0, 10)}`;

        const document = await repo.insertDocument({
          cityId: subject.cityId,
          documentTypeId: docType.id,
          title,
          lifecycleState: 'draft',
          originatingOfficeId: subject.officeId!,
          ownedByOfficeId: subject.officeId!,
          classificationLevel: 'internal',
          qrTrackingNumber: 'pending',
          retentionScheduleId: docType.retentionScheduleId!,
          metadata,
          createdBy: subject.userId,
        });

        return { complaintId: document.id };
      }),

    logAndAssign: protectedProcedure
      .input(
        z.object({
          complaintId: z.string().uuid(),
          assignedOfficeId: z.string().uuid(),
          routingNotes: z.string().max(512).optional(),
        })
      )
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'SP Secretary role required' });
        }

        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.complaintId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const metadata = document.metadata as Record<string, unknown>;
        await repo.updateDocumentMetadata(document.id, {
          ...metadata,
          routingDecision: input.routingNotes ?? null,
          assignedOfficeId: input.assignedOfficeId,
        });

        const service = ctx.req.server.documentsService;
        await service.transitionState(document.id, 'submitted', subject.userId, 'Complaint logged and assigned');

        return { success: true as const };
      }),

    enterCommitteeReport: protectedProcedure
      .input(
        z.object({
          complaintId: z.string().uuid(),
          reportText: z.string().min(1),
        })
      )
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        
        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.complaintId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const metadata = document.metadata as Record<string, any>;

        if (!subject.roles.includes('sp_secretary')) {
          if (!subject.roles.includes('sp_member')) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'SP Secretary or SP Member role required' });
          }
          if (!metadata['assignedOfficeId'] || !subject.committeeIds.includes(metadata['assignedOfficeId'] as string)) {
             throw new TRPCError({ code: 'FORBIDDEN', message: 'Not assigned to this committee' });
          }
        }

        await repo.updateDocumentMetadata(document.id, {
          ...metadata,
          committeeReport: input.reportText,
          outcomeState: 'received_seen',
        });

        return { success: true as const };
      }),

    setOutcome: protectedProcedure
      .input(
        z.object({
          complaintId: z.string().uuid(),
          outcome: z.enum(['dismissed', 'resolved']),
          notifyRespondentVia: z.enum(['contact_number', 'email']),
        })
      )
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'SP Secretary role required' });
        }

        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.complaintId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const metadata = document.metadata as Record<string, any>;

        await repo.updateDocumentMetadata(document.id, {
          ...metadata,
          outcomeState: input.outcome,
        });

        const eventBus = getEventBus(ctx);
        if (eventBus) {
           eventBus.emit('complaint.outcome_set', {
             eventId: crypto.randomUUID(),
             eventType: 'complaint.outcome_set',
             occurredAt: new Date().toISOString(),
             cityId: subject.cityId,
             schemaVersion: 1,
             payload: {
               complaintId: document.id,
               outcome: input.outcome,
               notifyRespondentVia: input.notifyRespondentVia,
             }
           });
        }

        const auditService = (ctx.req.server as any).auditService;
        if (auditService) {
           await auditService.logEvent({
             cityId: subject.cityId,
             actorId: subject.userId,
             action: `complaint.${input.outcome}`,
             resourceId: document.id,
             resourceType: 'document',
             metadata: { notifyRespondentVia: input.notifyRespondentVia },
           });
        }

        return { success: true as const };
      }),

    listAllComplaints: protectedProcedure
      .input(
        PaginationInputSchema.extend({
          outcomeState: z.enum(['pending_hearing', 'received_seen', 'dismissed', 'resolved']).optional(),
        })
      )
      .output(ListComplaintsOutputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        
        const hasUnconditionalAccess = 
          subject.roles.includes('sp_secretary') || 
          subject.roles.includes('sp_presiding_officer') || 
          subject.roles.includes('auditor');
          
        const isMember = subject.roles.includes('sp_member');

        if (!hasUnconditionalAccess && !isMember) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const db = getDb(ctx);
        const [docType] = await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.code, 'CITIZEN_COMPLAINT'))
          .limit(1);

        if (!docType) {
           return { items: [], nextCursor: null };
        }

        const conditions = [
           eq(documents.cityId, subject.cityId),
           eq(documents.documentTypeId, docType.id),
           isNull(documents.deletedAt)
        ];
        
        if (!hasUnconditionalAccess && isMember) {
           if (subject.committeeIds.length > 0) {
             conditions.push(
               inArray(sql`${documents.metadata}->>'assignedOfficeId'`, subject.committeeIds)
             );
           } else {
             return { items: [], nextCursor: null };
           }
        }
        
        if (input.outcomeState) {
          conditions.push(
            eq(sql`${documents.metadata}->>'outcomeState'`, input.outcomeState)
          );
        }

        const rows = await db
          .select()
          .from(documents)
          .where(and(...conditions))
          .orderBy(sql`${documents.createdAt} DESC`)
          .limit(input.limit + 1);

        let nextCursor: string | null = null;
        if (rows.length > input.limit) {
          const nextItem = rows.pop();
          nextCursor = nextItem?.id ?? null;
        }

        const items = rows.map((row) => {
          const meta = row.metadata as Record<string, any>;
          return {
            complaintId: row.id,
            subjectMatter: meta['subjectCategory'] || 'Unknown',
            outcomeState: meta['outcomeState'] || 'pending_hearing',
            assignedOfficeId: meta['assignedOfficeId'] || null,
            createdAt: row.createdAt.toISOString(),
          };
        });

        return { items, nextCursor };
      }),

    // -----------------------------------------------------------------------
    // complaints.getComplaint
    //
    // Callable by: sp_secretary, sp_presiding_officer, auditor (unconditional);
    //   sp_member (committee-scoped — same condition as enterCommitteeReport).
    // Business: single-record read for /complaints/:complaintId detail page
    //   (ADR-UI-005). Returns list-item shape plus four detail-only fields.
    //   Named getComplaint (not get) to avoid collision in the merged
    //   documents namespace — same convention as listAllComplaints.
    // -----------------------------------------------------------------------
    getComplaint: protectedProcedure
      .input(z.object({ complaintId: z.string().uuid() }))
      .output(ComplaintDetailOutputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.complaintId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const metadata = document.metadata as Record<string, any>;

        const hasUnconditionalAccess =
          subject.roles.includes('sp_secretary') ||
          subject.roles.includes('sp_presiding_officer') ||
          subject.roles.includes('auditor');

        if (!hasUnconditionalAccess) {
          if (!subject.roles.includes('sp_member')) {
            throw new TRPCError({ code: 'FORBIDDEN' });
          }
          if (!metadata['assignedOfficeId'] || !subject.committeeIds.includes(metadata['assignedOfficeId'] as string)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Not assigned to this committee' });
          }
        }

        return {
          complaintId: document.id,
          subjectMatter: metadata['subjectCategory'] || 'Unknown',
          outcomeState: metadata['outcomeState'] || 'pending_hearing',
          assignedOfficeId: metadata['assignedOfficeId'] || null,
          createdAt: document.createdAt.toISOString(),
          committeeReport: metadata['committeeReport'] ?? null,
          respondent: metadata['respondent'] ?? null,
          incidentDetails: metadata['incidentDetails'] ?? null,
          routingDecision: metadata['routingDecision'] ?? null,
        };
      }),
  });
}
