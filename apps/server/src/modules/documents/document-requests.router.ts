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
 * `approval` step_instances in the Workflow Engine per ADR-EVT-001. Approval
 * actions are recorded via `workflowService.submitStepApprovalForDocument`
 * (engine-enforced sequencing + assignment gate), and approval state is read
 * back via `workflowService.getStepState`. See TASK-WF-025.
 *
 * Payment is OPTIONAL and does NOT block release in Phase 1 (Q-D04).
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'node:crypto';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import { eq, and, isNull, sql, or } from 'drizzle-orm';
import { UuidSchema, TimestampSchema, PaginationInputSchema } from '@batac/shared/schemas/common';
import { LifecycleStateSchema } from '@batac/shared/schemas/documents';
import type { LifecycleState } from '@batac/shared/schemas/documents';
import { documents, documentTypes } from '@batac/database/schema/documents.schema.js';
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

function getWorkflowService(ctx: Context) {
  return ctx.req.server.workflowService;
}

/**
 * Resolves the VM/SP approval flags for a document request from the Workflow
 * Engine (ADR-EVT-001). A step counts as approved only when its step instance
 * completed with outcome 'APPROVED'. Null-safe: returns false for documents
 * with no workflow instance or no matching step.
 */
async function getApprovalFlags(
  ctx: Context,
  documentId: string,
): Promise<{ vmApproved: boolean; spApproved: boolean }> {
  const workflowService = getWorkflowService(ctx);
  const [vm, sp] = await Promise.all([
    workflowService.getStepState(documentId, 'vm_approval'),
    workflowService.getStepState(documentId, 'sp_secretary_approval'),
  ]);
  return {
    vmApproved: vm?.status === 'completed' && vm?.outcome === 'APPROVED',
    spApproved: sp?.status === 'completed' && sp?.outcome === 'APPROVED',
  };
}

/**
 * Maps errors thrown by `workflowService.submitStepApprovalForDocument` to
 * tRPC errors. The engine signals failures with stable `Error.message` codes;
 * anything unrecognized is rethrown rather than swallowed.
 */
function mapWorkflowSubmitError(
  err: unknown,
  messages: { noActiveInstance: string; stepNotActive: string },
): TRPCError {
  const msg = err instanceof Error ? err.message : '';
  if (msg === 'NO_ACTIVE_INSTANCE') {
    return new TRPCError({ code: 'BAD_REQUEST', message: messages.noActiveInstance });
  }
  if (msg === 'STEP_NOT_ACTIVE' || msg === 'CONFLICT: step is not active') {
    return new TRPCError({ code: 'PRECONDITION_FAILED', message: messages.stepNotActive });
  }
  if (msg.startsWith('FORBIDDEN')) {
    return new TRPCError({ code: 'FORBIDDEN', message: msg });
  }
  if (msg.startsWith('VALIDATION_FAILED')) {
    return new TRPCError({ code: 'BAD_REQUEST', message: msg });
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Workflow step submission failed: ${msg || 'unknown error'}`,
  });
}

/** Document type code for all document-request rows. */
const DOCUMENT_REQUEST_FORM_CODE = 'DOCUMENT_REQUEST_FORM';

/**
 * Lifecycle states in which a document-request is still awaiting approval
 * (i.e. the presiding officer CAN act on it).
 */
const PRE_RELEASE_STATES = new Set(['draft', 'submitted', 'in_workflow', 'pending_mayor_action']);

// ---------------------------------------------------------------------------
// Output Schemas
// ---------------------------------------------------------------------------

const SuccessOutputSchema = z.object({ success: z.literal(true) });

const CreateDocumentRequestOutputSchema = z.object({
  requestId: UuidSchema,
});

const RequesterSchema = z
  .object({
    name: z.string(),
    agencyOrOrganization: z.string().nullable(),
    email: z.string().nullable(),
    contactNumber: z.string().nullable(),
    idTypePresented: z.string().nullable(),
    citizenUserId: z.string().nullable(),
  })
  .nullable();

const DocumentRequestedItemSchema = z.object({
  documentTitle: z.string(),
  documentId: z.string().nullable(),
  documentTypeLabel: z.string().nullable(),
  documentNumber: z.string().nullable(),
  numberOfPages: z.number().nullable(),
});

const PaymentSchema = z
  .object({
    orNumber: z.string().nullable(),
    collectingOfficer: z.string().nullable(),
    amountPaid: z.number().nullable(),
    paymentDate: z.string().nullable(),
  })
  .nullable();

const PrintableFormOutputSchema = z.object({
  requestId: UuidSchema,
  title: z.string(),
  lifecycleState: LifecycleStateSchema,
  createdAt: TimestampSchema,
  requester: RequesterSchema,
  documentsRequested: z.array(DocumentRequestedItemSchema),
  purpose: z.string().nullable(),
  accessMode: z.string().nullable(),
  payment: PaymentSchema,
  notificationChannel: z.string().nullable(),
});

const DocumentRequestListItemSchema = z.object({
  requestId: UuidSchema,
  title: z.string(),
  requesterName: z.string().nullable(),
  lifecycleState: LifecycleStateSchema,
  vmApproved: z.boolean(),
  spApproved: z.boolean(),
  accessMode: z.string().nullable(),
  createdAt: TimestampSchema,
});

const ListDocumentRequestsOutputSchema = z.object({
  items: z.array(DocumentRequestListItemSchema),
  nextCursor: UuidSchema.nullable(),
});

const DocumentRequestDetailOutputSchema = DocumentRequestListItemSchema.extend({
  documentsRequested: z.array(DocumentRequestedItemSchema),
  purpose: z.string().nullable(),
  payment: PaymentSchema,
  notificationChannel: z.string().nullable(),
});

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
              }),
            )
            .min(1),
          purpose: z.string().max(512).optional(),
        }),
      )
      .output(CreateDocumentRequestOutputSchema)
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

        // The workflow engine starts an instance from the document.created
        // event and transitions the lifecycle to 'in_workflow' inside its
        // own transaction. 'draft' cannot transition directly to
        // 'in_workflow', so step through 'submitted' exactly like
        // documents.submit does before emitting the event.
        const documentsService = ctx.req.server.documentsService;
        await documentsService.transitionState(
          document.id,
          'submitted',
          subject.userId,
          'Document request form logged — pending workflow approval',
        );

        const eventBus = ctx.req.server.eventBus;
        if (eventBus) {
          eventBus.emit('document.created', {
            eventId: crypto.randomUUID(),
            eventType: 'document.created',
            occurredAt: new Date().toISOString(),
            cityId: document.cityId,
            schemaVersion: 1,
            payload: {
              documentId: document.id,
              documentTypeId: document.documentTypeId,
              ownedByOfficeId: document.ownedByOfficeId,
              actorId: subject.userId,
              cityId: document.cityId,
            },
          });
        }

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
      .output(PrintableFormOutputSchema)
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
          .where(
            and(eq(documentTypes.id, document.documentTypeId), isNull(documentTypes.deletedAt)),
          )
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
          lifecycleState: document.lifecycleState as LifecycleState,
          createdAt: document.createdAt.toISOString(),
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
    // Business: completes the VM `approval` step in the Workflow Engine
    // (ADR-EVT-001). Engine-enforced sequencing means the SP Secretary step
    // only becomes active once this step is approved; the assignment gate
    // verifies the caller is a delegated presiding officer.
    // -----------------------------------------------------------------------
    approveAsPresidingOfficer: protectedProcedure
      .input(z.object({ requestId: z.string().uuid() }))
      .output(SuccessOutputSchema)
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
          .where(
            and(eq(documentTypes.id, document.documentTypeId), isNull(documentTypes.deletedAt)),
          )
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

        // Record the approval in the Workflow Engine. The audit trail is
        // written by the workflow.step.completed → audit consumer; no manual
        // metadata write or duplicate audit log here.
        const workflowService = getWorkflowService(ctx);
        try {
          await workflowService.submitStepApprovalForDocument(
            document.id,
            'vm_approval',
            subject.userId,
            'APPROVED',
            null,
          );
        } catch (err) {
          throw mapWorkflowSubmitError(err, {
            noActiveInstance: 'No active approval workflow for this request',
            stepNotActive: 'This request has already been acted on',
          });
        }

        return { success: true as const };
      }),

    // -----------------------------------------------------------------------
    // documentRequests.approveAsSecretary
    //
    // Callable by: sp_secretary ONLY
    // Business: completes the SP Secretary `approval` step in the Workflow
    //   Engine (ADR-EVT-001), then transitions lifecycle to 'completed'.
    //   The engine enforces the VM-approval-first sequencing (the SP step is
    //   only active once the VM step is approved), replacing the old
    //   metadata.vm_approved precondition check.
    // -----------------------------------------------------------------------
    approveAsSecretary: protectedProcedure
      .input(z.object({ requestId: z.string().uuid() }))
      .output(SuccessOutputSchema)
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
          .where(
            and(eq(documentTypes.id, document.documentTypeId), isNull(documentTypes.deletedAt)),
          )
          .limit(1);

        if (!docType || docType.code !== DOCUMENT_REQUEST_FORM_CODE) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        // Record the SP Secretary approval in the Workflow Engine. If the VM
        // has not approved yet, the sp_secretary_approval step is not active
        // and the engine throws STEP_NOT_ACTIVE — mapped to the same
        // PRECONDITION_FAILED the old metadata check produced.
        const workflowService = getWorkflowService(ctx);
        try {
          await workflowService.submitStepApprovalForDocument(
            document.id,
            'sp_secretary_approval',
            subject.userId,
            'APPROVED',
            null,
          );
        } catch (err) {
          throw mapWorkflowSubmitError(err, {
            noActiveInstance: 'No active approval workflow for this request',
            stepNotActive: 'Presiding officer approval required first',
          });
        }

        // Transition lifecycle_state → 'completed' (both approvals done).
        // The RELEASED_TO_REQUESTER termination step intentionally leaves the
        // lifecycle untouched (final_document_status: null) so this explicit
        // transition is what reaches 'completed' — keeping releaseCopy's
        // lifecycleState === 'completed' guard intact.
        const documentsService = ctx.req.server.documentsService;
        await documentsService.transitionState(
          document.id,
          'completed',
          subject.userId,
          'Dual approval complete — presiding officer and secretary both approved',
        );

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
        }),
      )
      .output(SuccessOutputSchema)
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
          .where(
            and(eq(documentTypes.id, document.documentTypeId), isNull(documentTypes.deletedAt)),
          )
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
          'Copy released to requester',
        );

        // Emit notification signal for requester pickup notification
        const eventBus = ctx.req.server.eventBus;
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
        }),
      )
      .output(ListDocumentRequestsOutputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // ABAC: allowed roles (I1 §13 pattern; I2 Section 13)
        const allowedRoles = ['sp_secretary', 'sp_presiding_officer', 'records_officer', 'auditor'];
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
            sql`lower(${documents.metadata}->>'requester'->>'name') LIKE lower(${'%' + input.requesterName + '%'})`,
          );
        }

        if (input.documentNumber) {
          // Search for document_number in any element of documentsRequested array
          conditions.push(
            sql`EXISTS (
              SELECT 1 FROM jsonb_array_elements(${documents.metadata}->'documentsRequested') AS elem
              WHERE lower(elem->>'documentNumber') LIKE lower(${'%' + input.documentNumber + '%'})
            )`,
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
              sql`(${documents.createdAt}, ${documents.id}) < (${cursorRow.createdAt}, ${input.cursor})`,
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

        const items = await Promise.all(
          rows.map(async (row) => {
            const meta = row.metadata as Record<string, any>;
            const { vmApproved, spApproved } = await getApprovalFlags(ctx, row.id);
            return {
              requestId: row.id,
              title: row.title,
              requesterName: meta['requester']?.name ?? null,
              lifecycleState: row.lifecycleState as LifecycleState,
              vmApproved,
              spApproved,
              accessMode: meta['accessMode'] ?? null,
              createdAt: row.createdAt.toISOString(),
            };
          }),
        );

        return { items, nextCursor };
      }),

    // -----------------------------------------------------------------------
    // documentRequests.getDocumentRequest
    //
    // Callable by: sp_secretary, sp_presiding_officer, records_officer, auditor
    //   — same role set as listAllDocumentRequests (line 550).
    // Business: single-record read for /document-requests/:requestId detail
    //   page (ADR-UI-005). Returns list-item shape (lines 625–637) plus
    //   detail-only fields from generatePrintableForm (lines 212–223).
    //   Named getDocumentRequest (not get) to avoid collision in the merged
    //   documents namespace — same convention as listAllDocumentRequests.
    // -----------------------------------------------------------------------
    getDocumentRequest: protectedProcedure
      .input(z.object({ requestId: z.string().uuid() }))
      .output(DocumentRequestDetailOutputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // ABAC: same role set as listAllDocumentRequests (I1 §13)
        const allowedRoles = ['sp_secretary', 'sp_presiding_officer', 'records_officer', 'auditor'];
        if (!allowedRoles.some((r) => subject.roles.includes(r))) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        const repo = getRepository(ctx);
        const document = await repo.findDocumentById(input.requestId);

        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document request not found' });
        }

        const meta = document.metadata as Record<string, any>;
        const { vmApproved, spApproved } = await getApprovalFlags(ctx, document.id);

        return {
          requestId: document.id,
          title: document.title,
          requesterName: meta['requester']?.name ?? null,
          lifecycleState: document.lifecycleState as LifecycleState,
          vmApproved,
          spApproved,
          accessMode: meta['accessMode'] ?? null,
          createdAt: document.createdAt.toISOString(),
          documentsRequested: meta['documentsRequested'] ?? [],
          purpose: meta['purpose'] ?? null,
          payment: meta['payment'] ?? null,
          notificationChannel: meta['notificationChannel'] ?? null,
        };
      }),
  });
}
