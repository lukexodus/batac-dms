/**
 * document-requests.router.ts
 *
 * Internal SP Secretariat tRPC router for Document Request Forms.
 *
 * Phase 1 storage: requests are stored as `documents.documents` rows with
 * `document_type_code = DOCUMENT_REQUEST_FORM` and all request-specific data
 * in the `metadata` JSONB column.  There is no `portal.citizen_requests` table
 * in Phase 1 (C1 Part 13). [CONFLICT noted: C1 Part 13 followed over E1
 * Module 11 schema reference per AGENTS.md §1.]
 *
 * Dual approval (Vice Mayor + SP Secretary) is modelled as two sequential
 * `approval` step_instances in the Workflow Engine per ADR-EVT-001.  In Phase 1
 * (before the WF module is live) approval state is tracked via temporary JSONB
 * fields `vm_approved` / `sp_approved`.  Every such site carries a
 * TODO(WF-INTEGRATION) comment to replace them with workflow step queries.
 *
 * Payment is OPTIONAL and does NOT block release in Phase 1 (Q-D04).
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'node:crypto';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import { eq, and, isNull, sql, or } from 'drizzle-orm';
import { PaginationInputSchema } from '@batac/shared/schemas/common';
import {
  documents,
  documentTypes,
} from '@batac/database/schema/documents.schema.js';
import type { Context } from '../iam/iam.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDb(ctx: Context) {
  return ctx.req.server.db;
}

function getRepository(ctx: Context) {
  return ctx.req.server.documentsRepository;
}

function getEventBus(ctx: Context) {
  return (ctx.req.server as any).eventBus;
}

function getAuditService(ctx: Context) {
  return (ctx.req.server as any).auditService;
}

/** Document type code for all document-request rows. */
const DOCUMENT_REQUEST_FORM_CODE = 'DOCUMENT_REQUEST_FORM';

/**
 * Lifecycle states in which a document-request is still awaiting approval
 * (i.e. the presiding officer CAN act on it).
 */
const PRE_RELEASE_STATES = new Set(['draft', 'submitted', 'in_workflow', 'pending_mayor_action']);

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createDocumentRequestsRouter() {
  return router({

    // -----------------------------------------------------------------------
    // documentRequests.createClerkAssisted
    //
    // Callable by: sp_secretary ONLY
    // Business: clerk fills form on behalf of walk-in requester (access_mode 3
    //   = in_person_clerk). Inserts a documents.documents row with
    //   lifecycle_state='draft' and the request metadata.
    // -----------------------------------------------------------------------
    createDocumentRequestClerkAssisted: protectedProcedure
      .input(
        z.object({
          requesterName: z.string().min(1),
          requesterContact: z.string().optional(),
          documentsRequested: z
            .array(
              z.object({
                documentTitle: z.string().min(1),
                documentNumber: z.string().optional(),
              })
            )
            .min(1),
          purpose: z.string().max(512).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // ABAC: sp_secretary only (I1 §13.2)
        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'SP Secretary role required',
          });
        }

        const db = getDb(ctx);

        // Resolve DOCUMENT_REQUEST_FORM document type
        const [docType] = await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.code, DOCUMENT_REQUEST_FORM_CODE))
          .limit(1);

        if (!docType) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `${DOCUMENT_REQUEST_FORM_CODE} document type not found — run db:seed first`,
          });
        }

        const repo = getRepository(ctx);

        // Build metadata per H2 §6 DOCUMENT_REQUEST_FORM schema.
        // access_mode is hardcoded to 'in_person_clerk' for clerk-assisted
        // creation (Part 4.15 access mode 3).
        const metadata = {
          requester: {
            name: input.requesterName,
            agencyOrOrganization: null,
            email: null,
            contactNumber: input.requesterContact ?? null,
            idTypePresented: null,
            citizenUserId: null,
          },
          documentsRequested: input.documentsRequested.map((d) => ({
            documentTitle: d.documentTitle,
            documentId: null,
            documentTypeLabel: null,
            documentNumber: d.documentNumber ?? null,
            numberOfPages: null,
          })),
          purpose: input.purpose ?? null,
          accessMode: 'in_person_clerk',
          payment: null,
          notificationChannel: null,
        };

        const title = `Document Request -- ${input.requesterName}`;

        const document = await repo.insertDocument({
          cityId: subject.cityId,
          documentTypeId: docType.id,
          title,
          lifecycleState: 'draft',
          originatingOfficeId: subject.officeId!,
          ownedByOfficeId: subject.officeId!,
          classificationLevel: 'internal',
          // qr_tracking_number NOT NULL — assign a UUID placeholder at
          // secretariat logging (proper QR assignment is a separate step).
          qrTrackingNumber: crypto.randomUUID(),
          retentionScheduleId: docType.retentionScheduleId!,
          metadata,
          createdBy: subject.userId,
        });

        return { requestId: document.id };
      }),

    // -----------------------------------------------------------------------
    // documentRequests.generatePrintableForm
    //
    // Callable by: sp_secretary
    // Business: return the full request metadata formatted for the staff to
    //   print. PDF generation is a separate concern (out of Phase 1 scope).
    // -----------------------------------------------------------------------
    generatePrintableForm: protectedProcedure
      .input(z.object({ requestId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // ABAC: sp_secretary only
        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'SP Secretary role required',
          });
        }

        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.requestId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        // Verify the row really is a document-request form
        const db = getDb(ctx);
        const [docType] = await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.id, document.documentTypeId))
          .limit(1);

        if (!docType || docType.code !== DOCUMENT_REQUEST_FORM_CODE) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        const meta = document.metadata as Record<string, any>;

        // Return structured printable-form data.
        // (PDF rendering is a separate concern — this procedure provides the
        //  data; the frontend renders the print layout.)
        return {
          requestId: document.id,
          title: document.title,
          lifecycleState: document.lifecycleState,
          createdAt: document.createdAt,
          requester: meta['requester'] ?? null,
          documentsRequested: meta['documentsRequested'] ?? [],
          purpose: meta['purpose'] ?? null,
          accessMode: meta['accessMode'] ?? null,
          payment: meta['payment'] ?? null,
          notificationChannel: meta['notificationChannel'] ?? null,
        };
      }),

    // -----------------------------------------------------------------------
    // documentRequests.approveAsPresidingOfficer   [Vice Mayor step]
    //
    // Callable by: sp_presiding_officer ONLY (Vice Mayor per LGC).
    // Business (Phase 1 stub): merge vm_approved fields into metadata.
    //
    // TODO(WF-INTEGRATION): replace metadata.vm_approved check with
    //   workflow.submitStepAction for the VM approval step when the Workflow
    //   Engine module (TASK-WF-NNN) is complete.  At that point, remove the
    //   vm_approved / vm_approved_at / vm_approved_by JSONB fields from this
    //   procedure and from approveAsSecretary's precondition check.
    // -----------------------------------------------------------------------
    approveAsPresidingOfficer: protectedProcedure
      .input(z.object({ requestId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // ABAC: sp_presiding_officer ONLY (I1 §13.3)
        if (!subject.roles.includes('sp_presiding_officer')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Presiding Officer role required',
          });
        }

        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.requestId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        // Verify the document is a DOCUMENT_REQUEST_FORM
        const db = getDb(ctx);
        const [docType] = await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.id, document.documentTypeId))
          .limit(1);

        if (!docType || docType.code !== DOCUMENT_REQUEST_FORM_CODE) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        // Guard: cannot approve a request that is already past the approval stage
        if (!PRE_RELEASE_STATES.has(document.lifecycleState)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot approve a request in lifecycle state '${document.lifecycleState}'`,
          });
        }

        const existingMeta = document.metadata as Record<string, unknown>;

        // TODO(WF-INTEGRATION): replace with workflow.getStepState(...) once
        // TASK-WF-NNN completes.  The check below reads from metadata JSONB
        // as a Phase 1 stub only.
        const mergedMeta = {
          ...existingMeta,
          vm_approved: true,
          vm_approved_at: new Date().toISOString(),
          vm_approved_by: subject.userId,
        };

        await repo.updateDocumentMetadata(document.id, mergedMeta);

        // Emit audit event
        const eventBus = getEventBus(ctx);
        if (eventBus) {
          eventBus.emit('document_request.presiding_officer_approved', {
            eventId: crypto.randomUUID(),
            eventType: 'document_request.presiding_officer_approved',
            occurredAt: new Date().toISOString(),
            cityId: subject.cityId,
            schemaVersion: 1,
            payload: {
              requestId: document.id,
              approvedBy: subject.userId,
            },
          });
        }

        const auditService = getAuditService(ctx);
        if (auditService) {
          await auditService.logEvent({
            cityId: subject.cityId,
            actorId: subject.userId,
            action: 'document_request.presiding_officer_approved',
            resourceId: document.id,
            resourceType: 'document',
            metadata: {},
          });
        }

        return { success: true as const };
      }),

    // -----------------------------------------------------------------------
    // documentRequests.approveAsSecretary
    //
    // Callable by: sp_secretary ONLY
    // Business (Phase 1 stub): check presiding officer approved, merge
    //   sp_approved fields, transition lifecycle to 'completed'.
    //
    // TODO(WF-INTEGRATION): replace with workflow.submitStepAction for the
    //   SP Secretary approval step when TASK-WF-NNN completes.  At that
    //   point query workflow.step_instances for VM approval state instead of
    //   metadata.vm_approved.
    // -----------------------------------------------------------------------
    approveAsSecretary: protectedProcedure
      .input(z.object({ requestId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // ABAC: sp_secretary only (I1 §13.4)
        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'SP Secretary role required',
          });
        }

        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.requestId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        // Verify the document is a DOCUMENT_REQUEST_FORM
        const db = getDb(ctx);
        const [docType] = await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.id, document.documentTypeId))
          .limit(1);

        if (!docType || docType.code !== DOCUMENT_REQUEST_FORM_CODE) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        const existingMeta = document.metadata as Record<string, unknown>;

        // TODO(WF-INTEGRATION): replace metadata.vm_approved check with
        //   workflow.getStepState(...) when TASK-WF-NNN completes.
        if (!existingMeta['vm_approved']) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Presiding officer approval required first',
          });
        }

        const mergedMeta = {
          ...existingMeta,
          sp_approved: true,
          sp_approved_at: new Date().toISOString(),
          sp_approved_by: subject.userId,
        };

        await repo.updateDocumentMetadata(document.id, mergedMeta);

        // Transition lifecycle_state → 'completed' (both approvals done)
        const documentsService = ctx.req.server.documentsService;
        await documentsService.transitionState(
          document.id,
          'completed',
          subject.userId,
          'Dual approval complete — presiding officer and secretary both approved'
        );

        // Emit audit event
        const eventBus = getEventBus(ctx);
        if (eventBus) {
          eventBus.emit('document_request.secretary_approved', {
            eventId: crypto.randomUUID(),
            eventType: 'document_request.secretary_approved',
            occurredAt: new Date().toISOString(),
            cityId: subject.cityId,
            schemaVersion: 1,
            payload: {
              requestId: document.id,
              approvedBy: subject.userId,
            },
          });
        }

        const auditService = getAuditService(ctx);
        if (auditService) {
          await auditService.logEvent({
            cityId: subject.cityId,
            actorId: subject.userId,
            action: 'document_request.secretary_approved',
            resourceId: document.id,
            resourceType: 'document',
            metadata: {},
          });
        }

        return { success: true as const };
      }),

    // -----------------------------------------------------------------------
    // documentRequests.releaseCopy
    //
    // Callable by: sp_secretary only
    // Business: mark request released; record OR number if provided.
    //   Payment is OPTIONAL and does NOT block release (Q-D04 — payment
    //   system is deferred to Phase 2).
    // -----------------------------------------------------------------------
    releaseCopy: protectedProcedure
      .input(
        z.object({
          requestId: z.string().uuid(),
          orNumber: z.string().max(64).optional(),
          collectingOfficer: z.string().max(256).optional(),
          amountPaid: z.number().positive().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // ABAC: sp_secretary only (I1 §13.5)
        if (!subject.roles.includes('sp_secretary')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'SP Secretary role required',
          });
        }

        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.requestId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        // Verify the document is a DOCUMENT_REQUEST_FORM
        const db = getDb(ctx);
        const [docType] = await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.id, document.documentTypeId))
          .limit(1);

        if (!docType || docType.code !== DOCUMENT_REQUEST_FORM_CODE) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        // Guard: must be in 'completed' state (both approvals done) before release
        if (document.lifecycleState !== 'completed') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Cannot release a request in lifecycle state '${document.lifecycleState}' — both approvals must be complete first`,
          });
        }

        const existingMeta = document.metadata as Record<string, unknown>;

        // Record payment details if provided (optional per Q-D04)
        let updatedMeta = { ...existingMeta };
        if (input.orNumber) {
          updatedMeta = {
            ...updatedMeta,
            payment: {
              orNumber: input.orNumber,
              collectingOfficer: input.collectingOfficer ?? null,
              amountPaid: input.amountPaid ?? null,
              paymentDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
            },
          };
        }

        await repo.updateDocumentMetadata(document.id, updatedMeta);

        // Transition lifecycle_state → 'released'
        const documentsService = ctx.req.server.documentsService;
        await documentsService.transitionState(
          document.id,
          'released',
          subject.userId,
          'Copy released to requester'
        );

        // Emit notification signal for requester pickup notification
        const eventBus = getEventBus(ctx);
        if (eventBus) {
          const meta = updatedMeta as Record<string, any>;
          eventBus.emit('document_request.released', {
            eventId: crypto.randomUUID(),
            eventType: 'document_request.released',
            occurredAt: new Date().toISOString(),
            cityId: subject.cityId,
            schemaVersion: 1,
            payload: {
              requestId: document.id,
              releasedBy: subject.userId,
              notificationChannel: meta['notificationChannel'] ?? null,
              requesterContact: meta['requester']?.contactNumber ?? null,
              requesterEmail: meta['requester']?.email ?? null,
            },
          });
        }

        return { success: true as const };
      }),

    // -----------------------------------------------------------------------
    // documentRequests.listAll
    //
    // Callable by: sp_secretary, sp_presiding_officer, records_officer, auditor
    // Business: paginated list of all document requests (cityId-scoped).
    //   Optional filter by requester name or document number via JSONB text.
    // -----------------------------------------------------------------------
    listAllDocumentRequests: protectedProcedure
      .input(
        PaginationInputSchema.extend({
          requesterName: z.string().optional(),
          documentNumber: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // ABAC: allowed roles (I1 §13 pattern; I2 Section 13)
        const allowedRoles = [
          'sp_secretary',
          'sp_presiding_officer',
          'records_officer',
          'auditor',
        ];
        const hasAccess = allowedRoles.some((r) => subject.roles.includes(r));
        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const db = getDb(ctx);

        // Resolve the document type id for DOCUMENT_REQUEST_FORM
        const [docType] = await db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.code, DOCUMENT_REQUEST_FORM_CODE))
          .limit(1);

        if (!docType) {
          return { items: [], nextCursor: null };
        }

        // Build conditions
        const conditions = [
          eq(documents.cityId, subject.cityId),
          eq(documents.documentTypeId, docType.id),
          isNull(documents.deletedAt),
        ];

        // Optional JSONB text filters
        if (input.requesterName) {
          conditions.push(
            sql`lower(${documents.metadata}->>'requester'->>'name') LIKE lower(${'%' + input.requesterName + '%'})`
          );
        }

        if (input.documentNumber) {
          // Search for document_number in any element of documentsRequested array
          conditions.push(
            sql`EXISTS (
              SELECT 1 FROM jsonb_array_elements(${documents.metadata}->'documentsRequested') AS elem
              WHERE lower(elem->>'documentNumber') LIKE lower(${'%' + input.documentNumber + '%'})
            )`
          );
        }

        // Cursor pagination (created_at DESC, id DESC tiebreaker — same
        // pattern as documents.repository.ts listDocuments)
        if (input.cursor) {
          const [cursorRow] = await db
            .select({ createdAt: documents.createdAt })
            .from(documents)
            .where(eq(documents.id, input.cursor));
          if (cursorRow) {
            conditions.push(
              sql`(${documents.createdAt}, ${documents.id}) < (${cursorRow.createdAt}, ${input.cursor})`
            );
          }
        }

        const rows = await db
          .select()
          .from(documents)
          .where(and(...conditions))
          .orderBy(sql`${documents.createdAt} DESC, ${documents.id} DESC`)
          .limit(input.limit + 1);

        let nextCursor: string | null = null;
        if (rows.length > input.limit) {
          const nextItem = rows.pop();
          nextCursor = nextItem?.id ?? null;
        }

        const items = rows.map((row) => {
          const meta = row.metadata as Record<string, any>;
          return {
            requestId: row.id,
            title: row.title,
            requesterName: meta['requester']?.name ?? null,
            lifecycleState: row.lifecycleState,
            vmApproved: meta['vm_approved'] ?? false,
            spApproved: meta['sp_approved'] ?? false,
            accessMode: meta['accessMode'] ?? null,
            createdAt: row.createdAt,
          };
        });

        return { items, nextCursor };
      }),
  });
}
