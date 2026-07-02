import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import crypto from 'node:crypto';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import type { Context } from '../iam/iam.types.js';
import {
  type LifecycleState,
  type ClassificationLevel,
  CreateDocumentInputSchema,
  CreateDocumentOutputSchema,
  DocumentIdInputSchema,
  DocumentSelectSchema,
  AdminDocumentMetadataSchema,
  ListDocumentsInputSchema,
  ListDocumentsOutputSchema,
  SearchDocumentsInputSchema,
  SearchDocumentsOutputSchema,
  UpdateDocumentInputSchema,
  CancelDocumentInputSchema,
  RequestUploadUrlInputSchema,
  RequestUploadUrlOutputSchema,
  ConfirmUploadInputSchema,
  ConfirmUploadOutputSchema,
  VersionIdInputSchema,
  VersionSelectSchema,
  DownloadVersionInputSchema,
  DownloadVersionOutputSchema,
  OcrTextOutputSchema,
  ScanQualityIndicatorOutputSchema,
  FlagScannedBackInputSchema,
} from '@batac/shared';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { OcrService, StubOcrProvider } from './ocr.service.js';
import { StubPreviewProvider } from './preview.provider.js';
import type { DocumentsRepository, DocumentRow, DocumentTypeRow } from './documents.repository.js';
import type { DocumentPolicyGuard } from './documents.policy.js';
import type { DocumentsPublicAPI } from './documents.types.js';
import { createPanlalawiganProcedures } from './panlalawigan.router.js';

/**
 * documents.router.ts -- general CRUD (TASK-DOCS-011)
 *
 * Eight procedures: create, get, getMetadataForAdmin, list, search, update,
 * delete, cancel. Every procedure follows the ABAC enforcement pattern from
 * this task's brief: fetch the document row, fetch whatever resource
 * attributes the policy guard needs, call DocumentPolicyGuard, then act.
 *
 * [Unverified] This file was authored against the real types and schemas
 * already present in this repository (documents.repository.ts,
 * documents.service.ts, documents.types.ts, packages/shared/src/schemas),
 * but `pnpm typecheck` and `pnpm test` could not actually be executed in
 * this environment -- see the PR summary for why. Treat this as
 * [Inference]-level confidence, not a confirmed-passing build, until those
 * commands have been run for real.
 *
 * Several of the ABAC decisions below required reconciling I1
 * (ABAC policy spec) against I2 (role-permission matrix) and E1 (tRPC
 * catalog) where those documents didn't fully agree, or against gaps where
 * no document defines the answer at all (e.g. cross-office read grants).
 * Each such call is commented at the point it's made and logged in
 * docs/development-findings-log.md; the guard itself (documents.policy.ts)
 * carries the detailed sourcing.
 */

function getRepository(ctx: Context): DocumentsRepository {
  return ctx.req.server.documentsRepository;
}

function getPolicyGuard(ctx: Context): DocumentPolicyGuard {
  return ctx.req.server.documentsPolicyGuard;
}

function getService(ctx: Context): DocumentsPublicAPI {
  return ctx.req.server.documentsService;
}

function getOrgService(ctx: Context) {
  return ctx.req.server.organizationService;
}

const SuccessOutputSchema = z.object({ success: z.literal(true) });

/** I1's SP-office-attribution rule applies to exactly these three document types. */
const SP_DOCUMENT_TYPE_CODES = new Set(['SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE']);
/** Office code looked up via OrgService.getOfficeByCode, matching the
 * pattern already used in apps/server/src/database/seeds/number-series.seed.ts. */
const SP_SECRETARIAT_OFFICE_CODE = 'SPS';

let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: env.S3_REGION || 'ap-southeast-1',
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY || '',
        secretAccessKey: env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true,
    });
  }
  return _s3Client;
}

function getOcrService(ctx: Context): OcrService {
  return new OcrService(
    ctx.req.server.boss,
    new StubOcrProvider(),
    new StubPreviewProvider(),
    getS3Client() as any, // satisfies S3Client interface needed by OcrService
    env.S3_BUCKET || 'batac-dms',
    ctx.req.server.db as any
  );
}

// ---------------------------------------------------------------------------
// Minimal JSON-Schema-subset validator for "second-pass JSONB validation"
// against document_type.metadata_schema (H2 stores real draft-07 JSON
// Schema documents). No JSON-Schema validation library (e.g. ajv) is
// present in this workspace's installed dependencies, and none could be
// added in this environment (no network access to fetch a new package --
// see PR summary). This supports: type (incl. nullable via a type array),
// enum, required, properties (recursive), additionalProperties: false, and
// array items. It does NOT support $ref, oneOf/anyOf/allOf, pattern,
// format, or numeric/string bounds. That is a deliberate scope limit, not
// an oversight -- flagged here and in the findings log rather than silently
// passed off as complete JSON-Schema support.
// ---------------------------------------------------------------------------

function jsonTypeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesJsonType(value: unknown, type: string): boolean {
  const actual = jsonTypeOf(value);
  if (type === 'integer') return actual === 'number' && Number.isInteger(value as number);
  return actual === type;
}

function validateMetadataNode(value: unknown, schema: unknown, path: string, errors: string[]): void {
  if (schema == null || typeof schema !== 'object') return;
  const s = schema as any;

  if ('type' in s) {
    const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
    if (!types.some((t) => matchesJsonType(value, t))) {
      errors.push(`${path}: expected type ${types.join(' | ')}, got ${jsonTypeOf(value)}`);
      return;
    }
  }

  if (Array.isArray(s.enum) && !s.enum.some((e: any) => JSON.stringify(e) === JSON.stringify(value))) {
    errors.push(`${path}: value not permitted by enum`);
  }

  if (jsonTypeOf(value) === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(s.required)) {
      for (const key of s.required as string[]) {
        if (!(key in obj)) errors.push(`${path}.${key}: required property missing`);
      }
    }
    if (s.properties && typeof s.properties === 'object') {
      for (const [key, propSchema] of Object.entries(s.properties as Record<string, unknown>)) {
        if (key in obj) validateMetadataNode(obj[key], propSchema, `${path}.${key}`, errors);
      }
    }
    if (s.additionalProperties === false && s.properties && typeof s.properties === 'object') {
      const allowed = new Set(Object.keys(s.properties as Record<string, unknown>));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) errors.push(`${path}.${key}: additional property not allowed by schema`);
      }
    }
  }

  if (jsonTypeOf(value) === 'array' && s.items) {
    (value as unknown[]).forEach((item, i) => validateMetadataNode(item, s.items, `${path}[${i}]`, errors));
  }
}

function validateMetadataAgainstSchema(
  metadata: Record<string, unknown>,
  schema: Record<string, unknown> | null | undefined,
): string[] {
  if (!schema || Object.keys(schema).length === 0) return [];
  const errors: string[] = [];
  validateMetadataNode(metadata, schema, 'metadata', errors);
  return errors;
}

// ---------------------------------------------------------------------------
// Row -> Zod-shape mappers
// ---------------------------------------------------------------------------

function toDocumentTypeSummary(type: DocumentTypeRow) {
  return {
    id: type.id,
    name: type.name,
    code: type.code,
    classificationDefault: type.classificationDefault as ClassificationLevel,
    preliminaryNumbering: type.hasPreliminaryNumbering,
  };
}

async function toDocumentSelect(ctx: Context, row: DocumentRow, documentType: DocumentTypeRow) {
  const office = await getOrgService(ctx).getOfficeById(row.originatingOfficeId);
  if (!office) {
    // Deliberately not fabricating a placeholder office summary here --
    // this would only happen from a genuine data-integrity problem
    // (originating_office_id pointing at a deleted/missing office), and
    // synthesizing fake name/type data for it would misrepresent real data.
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'originating office referenced by this document could not be resolved',
    });
  }
  return {
    id: row.id,
    documentTypeId: row.documentTypeId,
    documentType: toDocumentTypeSummary(documentType),
    title: row.title,
    lifecycleState: row.lifecycleState as LifecycleState,
    classificationLevel: row.classificationLevel as ClassificationLevel,
    qrTrackingNumber: row.qrTrackingNumber,
    preliminaryNumber: row.preliminaryNumber,
    finalNumber: row.finalNumber,
    controlNumber: row.controlNumber,
    originatingOfficeId: row.originatingOfficeId,
    originatingOffice: {
      ...office,
      type: office.type as any,
    },
    ownedByOfficeId: row.ownedByOfficeId,
    createdBy: row.createdBy,
    workflowInstanceId: row.workflowInstanceId,
    versionNumber: row.versionNumber,
    metadata: row.metadata as Record<string, unknown>,
    supersededBy: row.supersededBy,
    supersededAt: row.supersededAt ? row.supersededAt.toISOString() : null,
    closureReason: row.closureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDocumentSummary(row: DocumentRow, documentTypeCode: string) {
  return {
    id: row.id,
    title: row.title,
    documentTypeCode,
    lifecycleState: row.lifecycleState as LifecycleState,
    preliminaryNumber: row.preliminaryNumber,
    finalNumber: row.finalNumber,
    qrTrackingNumber: row.qrTrackingNumber,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Gate 4: role_code = ANY(subject.roles), not just the primary role. */
async function hasAnyAllowlistEntry(
  repo: DocumentsRepository,
  documentTypeId: string,
  roles: string[],
  cityId: string,
): Promise<boolean> {
  if (roles.length === 0) return false;
  const results = await Promise.all(
    roles.map((role) => repo.hasClassificationAllowlistEntry(documentTypeId, role, cityId)),
  );
  return results.some(Boolean);
}

export function createDocumentsRouter() {
  return router({
    ...createPanlalawiganProcedures(),
    
    // -----------------------------------------------------------------
    // documents.create
    // -----------------------------------------------------------------
    create: protectedProcedure
      .input(CreateDocumentInputSchema)
      .output(CreateDocumentOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const documentType = await repo.findDocumentTypeById(input.documentTypeId);
        if (!documentType || !documentType.isActive) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document type not found or inactive.' });
        }

        if (!guard.canCreate(subject, { documentTypeCode: documentType.code })) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Your role cannot create documents.' });
        }

        const metadataErrors = validateMetadataAgainstSchema(input.metadata, documentType.metadataSchema as Record<string, unknown>);
        if (metadataErrors.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `metadata failed document type validation: ${metadataErrors.join('; ')}`,
          });
        }

        // [Unverified — TASK-DOCS-011] "override only if subject has
        // write-classification permission" (this task's own brief) has no
        // defined implementation anywhere else in this repository: no
        // permission-string registry, no role mapping, and
        // AuthContext.permissions is never populated with a concrete value
        // in any code path this snapshot contains. records.classification_rules
        // (C2) is a related but distinct Tier-2 admin-configured
        // auto-escalation mechanism, not a per-user override permission.
        // Conservatively, nobody can override document_type.classification_default
        // in this PR -- input.classificationLevel is accepted (so the Zod
        // contract matches the task spec) but the server-computed default
        // always wins. See docs/development-findings-log.md.
        const classificationLevel = documentType.classificationDefault as ClassificationLevel;

        let originatingOfficeId: string;
        let ownedByOfficeId: string;
        if (SP_DOCUMENT_TYPE_CODES.has(documentType.code)) {
          const spOffice = await getOrgService(ctx).getOfficeByCode(SP_SECRETARIAT_OFFICE_CODE, subject.cityId);
          if (!spOffice) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'SP Secretariat office (code SPS) is not configured for this city.',
            });
          }
          originatingOfficeId = spOffice.officeId;
          ownedByOfficeId = spOffice.officeId;
        } else {
          if (!subject.officeId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Your account has no office assigned.' });
          }
          originatingOfficeId = subject.officeId;
          ownedByOfficeId = subject.officeId;
        }

        if (!documentType.retentionScheduleId) {
          // Guarded structurally by ck_document_types_retention_before_activation
          // (isActive implies retention_schedule_id IS NOT NULL), so this
          // should be unreachable given the isActive check above -- kept as
          // a defensive check rather than a non-null assertion.
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Active document type is missing a retention schedule.',
          });
        }

        const created = await repo.insertDocument({
          cityId: subject.cityId,
          documentTypeId: documentType.id,
          title: input.title,
          lifecycleState: 'draft',
          classificationLevel,
          // qr_tracking_number is NOT NULL + UNIQUE at the DB level (see
          // documents.schema.ts), so a value must be written now even
          // though, per this task's business rule, it is not yet
          // "assigned" in the product sense -- it is not returned from this
          // procedure (CreateDocumentOutputSchema has no qrTrackingNumber
          // field) or surfaced anywhere until the submit step allocates the
          // real one. [Inference — TASK-DOCS-011].
          qrTrackingNumber: crypto.randomUUID(),
          originatingOfficeId,
          ownedByOfficeId,
          createdBy: subject.userId,
          versionNumber: 1,
          metadata: input.metadata,
          retentionScheduleId: documentType.retentionScheduleId,
        });

        // No domain event or audit event at draft creation -- the
        // event-worthy moment is submit (per this task's brief, B2).

        return { documentId: created.id, lifecycleState: 'draft' as const };
      }),

    // -----------------------------------------------------------------
    // documents.get
    // -----------------------------------------------------------------
    get: protectedProcedure
      .input(DocumentIdInputSchema)
      .output(DocumentSelectSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;

        // I2 §5 denies sys_admin on every "view document metadata" row;
        // this task's brief additionally asks for an explicit redirect
        // rather than a generic deny. See documents.policy.ts's
        // canReadMetadata doc comment for the fuller reasoning.
        if (subject.roles.includes('sys_admin')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'sys_admin cannot call documents.get; use documents.getMetadataForAdmin instead.',
          });
        }

        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const hasAllowlistEntry = await hasAnyAllowlistEntry(
          repo,
          document.documentTypeId,
          subject.roles,
          subject.cityId,
        );

        const allowed = guard.canReadMetadata(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          classificationLevel: document.classificationLevel as ClassificationLevel,
          // [Unverified — TASK-DOCS-011] No OrgService method currently
          // computes has_cross_office_read_grant(); always false until one
          // exists. See documents.policy.ts and the findings log.
          hasCrossOfficeGrant: false,
          hasAllowlistEntry,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        const documentType = await repo.findDocumentTypeById(document.documentTypeId);
        if (!documentType) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'document type referenced by this document no longer exists',
          });
        }

        return toDocumentSelect(ctx, document, documentType);
      }),

    // -----------------------------------------------------------------
    // documents.getMetadataForAdmin
    // -----------------------------------------------------------------
    getMetadataForAdmin: protectedProcedure
      .input(DocumentIdInputSchema)
      .output(AdminDocumentMetadataSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        if (!subject.roles.includes('sys_admin')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'documents.getMetadataForAdmin is sys_admin only.' });
        }

        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const allowed = guard.canReadMetadataAdmin(subject, {
          classificationLevel: document.classificationLevel as ClassificationLevel,
        });
        if (!allowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Confidential and Restricted documents are not visible in the admin metadata view (Gate 2).',
          });
        }

        return {
          documentId: document.id,
          title: document.title,
          lifecycleState: document.lifecycleState as LifecycleState,
          finalNumber: document.finalNumber,
          classificationLevel: document.classificationLevel as ClassificationLevel,
        };
      }),

    // -----------------------------------------------------------------
    // documents.list
    // -----------------------------------------------------------------
    list: protectedProcedure
      .input(ListDocumentsInputSchema)
      .output(ListDocumentsOutputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        // ABAC applied as a WHERE-filter scope; RLS on documents.documents
        // is the intended second, DB-level layer per this task's brief --
        // this router does not attempt to verify RLS session variables are
        // wired up, since that is a connection/middleware-layer concern
        // outside documents.router.ts.
        const scope = guard.getListScope(subject);

        const rows = await repo.listDocuments({
          cityId: subject.cityId,
          scope,
          callerRoles: subject.roles,
          documentTypeId: input.documentTypeId,
          lifecycleState: input.lifecycleState,
          officeId: input.officeId,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          cursor: input.cursor,
          limit: input.limit,
        });

        const hasMore = rows.length > input.limit;
        const page = hasMore ? rows.slice(0, input.limit) : rows;

        const typeIds = [...new Set(page.map((r) => r.documentTypeId))];
        const types = await Promise.all(typeIds.map((id) => repo.findDocumentTypeById(id)));
        const typeCodeById = new Map<string, string>();
        for (const t of types) if (t) typeCodeById.set(t.id, t.code);

        return {
          items: page.map((row) => toDocumentSummary(row, typeCodeById.get(row.documentTypeId) ?? '')),
          nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
        };
      }),

    // -----------------------------------------------------------------
    // documents.search
    // -----------------------------------------------------------------
    search: protectedProcedure
      .input(SearchDocumentsInputSchema)
      .output(SearchDocumentsOutputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const scope = guard.getSearchScope(subject);

        const rows = await repo.searchDocuments({
          cityId: subject.cityId,
          scope,
          callerRoles: subject.roles,
          queryText: input.queryText,
          documentTypeIds: input.documentTypeIds,
          classificationLevels: input.classificationLevels,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          cursor: input.cursor,
          limit: input.limit,
        });

        const hasMore = rows.length > input.limit;
        const page = hasMore ? rows.slice(0, input.limit) : rows;

        return {
          items: page.map((row) => ({
            documentId: row.id,
            title: row.title,
            documentTypeName: row.documentTypeName,
            finalNumber: row.finalNumber,
            currentState: row.lifecycleState as LifecycleState,
          })),
          nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
        };
      }),

    // -----------------------------------------------------------------
    // documents.update
    // -----------------------------------------------------------------
    update: protectedProcedure
      .input(UpdateDocumentInputSchema)
      .output(DocumentSelectSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        if (input.title === undefined && input.metadata === undefined) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Provide at least one of title or metadata.' });
        }

        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        // checkStateActionCompatibility('update', state): I1 §17's matrix
        // allows 'update' only for lifecycle_state = 'draft', which is
        // exactly what canUpdate already enforces as its first condition --
        // implemented as one check rather than two redundant ones.
        const allowed = guard.canUpdate(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          lifecycleState: document.lifecycleState as LifecycleState,
          createdBy: document.createdBy,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        let documentType: DocumentTypeRow | null = null;
        if (input.metadata !== undefined) {
          documentType = await repo.findDocumentTypeById(document.documentTypeId);
          const metadataErrors = validateMetadataAgainstSchema(
            input.metadata,
            documentType?.metadataSchema as Record<string, unknown> | undefined,
          );
          if (metadataErrors.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `metadata failed document type validation: ${metadataErrors.join('; ')}`,
            });
          }
        }

        const updated = await repo.updateDocumentFields(input.documentId, {
          title: input.title,
          metadata: input.metadata,
        });
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

        if (!documentType) {
          documentType = await repo.findDocumentTypeById(updated.documentTypeId);
        }
        if (!documentType) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'document type referenced by this document no longer exists',
          });
        }

        return toDocumentSelect(ctx, updated, documentType);
      }),

    // -----------------------------------------------------------------
    // documents.delete (soft delete only -- Invariant #2, never hard delete)
    // -----------------------------------------------------------------
    delete: protectedProcedure
      .input(DocumentIdInputSchema)
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const allowed = guard.canSoftDelete(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          lifecycleState: document.lifecycleState as LifecycleState,
          workflowInstanceId: document.workflowInstanceId,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        await repo.softDeleteDocument(input.documentId, subject.userId);

        return { success: true as const };
      }),

    // -----------------------------------------------------------------
    // documents.cancel
    // -----------------------------------------------------------------
    cancel: protectedProcedure
      .input(CancelDocumentInputSchema)
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);
        const service = getService(ctx);

        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        // checkStateActionCompatibility('cancel', state): I1 §17's matrix
        // and I1 §3.6's ALLOW block agree (blocked only for
        // archived/disposed/cancelled); canCancel already enforces this as
        // its first condition, so a disposed document is rejected here
        // (FORBIDDEN) before documentsService.transitionState would
        // independently reject it too (its VALID_TRANSITIONS map has no
        // outgoing transitions from 'disposed').
        const allowed = guard.canCancel(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          lifecycleState: document.lifecycleState as LifecycleState,
          workflowInstanceId: document.workflowInstanceId,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        // Audit event: transitionState() emits a `document.state_changed`
        // domain event (toState: 'cancelled', reason included in the
        // payload, mandatory per CancelDocumentInputSchema's min-length
        // constraint); audit.event-consumer.ts persists that as the
        // audit-log entry I1 §3.6 / consolidated-reference Part 11.11
        // requires. No distinct "DOCUMENT_CANCELLED" event type is
        // registered in packages/shared/src/events/event-payload-map.ts or
        // b3-internal-domain-event-catalog-v1.3.md -- see findings log.
        // This procedure deliberately does not call auditService.writeEvent
        // directly: apps/server/src/modules/audit/index.ts documents that
        // direct writeEvent callers are limited to two confirmed call sites
        // (Records bulk-op handler and disposition service, per B2 Module
        // 8); Documents is not one of them, so the event-bus path is the
        // correct, already-covered mechanism here.
        try {
          await service.transitionState(input.documentId, 'cancelled', subject.userId, input.reason);
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('Document not found')) {
            throw new TRPCError({ code: 'NOT_FOUND' });
          }
          if (err instanceof Error && err.message.startsWith('invalid state transition')) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
          }
          throw err;
        }

        return { success: true as const };
      }),

    // -----------------------------------------------------------------
    // documents.requestUploadUrl
    // -----------------------------------------------------------------
    requestUploadUrl: protectedProcedure
      .input(RequestUploadUrlInputSchema)
      .output(RequestUploadUrlOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const allowed = guard.canCreateVersion(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          createdBy: document.createdBy,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        const s3Key = crypto.randomUUID();
        const command = new PutObjectCommand({
          Bucket: env.S3_BUCKET || 'batac-dms',
          Key: s3Key,
          ContentType: input.mimeType,
        });

        const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: env.S3_SIGNED_URL_EXPIRES_S || 900 });

        return {
          s3Key,
          uploadUrl,
        };
      }),

    // -----------------------------------------------------------------
    // documents.confirmUpload
    // -----------------------------------------------------------------
    confirmUpload: protectedProcedure
      .input(ConfirmUploadInputSchema)
      .output(ConfirmUploadOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const allowed = guard.canCreateVersion(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          createdBy: document.createdBy,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        const newVersionNumber = document.versionNumber + 1;

        const version = await repo.insertVersion({
          cityId: subject.cityId,
          documentId: input.documentId,
          versionNumber: newVersionNumber,
          fileKey: input.s3Key,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
          createdBy: subject.userId,
          pageCount: null, // extracted later by OCR
          scanQualityScore: null,
          scanQualityCategory: null,
          ocrProcessed: false,
          requiresManualVerification: false,
        });

        await repo.updateDocumentFields(input.documentId, {
          versionNumber: newVersionNumber,
        });

        // Enqueue OCR extraction
        const ocrService = getOcrService(ctx);
        await ocrService.enqueueOcrJob(version.id, input.s3Key, input.documentId);

        return { versionId: version.id };
      }),

    // -----------------------------------------------------------------
    // documents.getVersionHistory
    // -----------------------------------------------------------------
    getVersionHistory: protectedProcedure
      .input(DocumentIdInputSchema)
      .output(z.array(VersionSelectSchema))
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const document = await repo.findDocumentById(input.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const hasAllowlistEntry = await hasAnyAllowlistEntry(
          repo,
          document.documentTypeId,
          subject.roles,
          subject.cityId,
        );

        const allowed = guard.canReadMetadata(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          classificationLevel: document.classificationLevel as ClassificationLevel,
          hasCrossOfficeGrant: false,
          hasAllowlistEntry,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        const versions = await repo.findVersionsByDocument(input.documentId);
        return versions.map((v) => ({
          id: v.id,
          documentId: v.documentId,
          versionNumber: v.versionNumber,
          s3Key: v.fileKey,
          originalFilename: v.originalFilename,
          mimeType: v.mimeType,
          fileSizeBytes: v.fileSizeBytes ?? 0,
          pageCount: v.pageCount,
          scanQualityScore: v.scanQualityScore ? Number(v.scanQualityScore) : null,
          scanQualityCategory: v.scanQualityCategory as any,
          ocrProcessed: v.ocrProcessed,
          uploadedBy: v.createdBy,
          createdAt: v.createdAt.toISOString(),
        }));
      }),

    // -----------------------------------------------------------------
    // documents.downloadVersion
    // -----------------------------------------------------------------
    downloadVersion: protectedProcedure
      .input(DownloadVersionInputSchema)
      .output(DownloadVersionOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const version = await repo.findVersionById(input.versionId);
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const document = await repo.findDocumentById(version.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const hasAllowlistEntry = await hasAnyAllowlistEntry(
          repo,
          document.documentTypeId,
          subject.roles,
          subject.cityId,
        );

        const allowed = guard.canReadVersionContent(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          classificationLevel: document.classificationLevel as ClassificationLevel,
          hasAllowlistEntry,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        const expiresIn = env.S3_SIGNED_URL_EXPIRES_S || 900;
        const command = new GetObjectCommand({
          Bucket: env.S3_BUCKET || 'batac-dms',
          Key: version.fileKey,
        });

        const downloadUrl = await getSignedUrl(getS3Client(), command, { expiresIn });

        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        return {
          downloadUrl,
          expiresAt: expiresAt.toISOString(),
        };
      }),

    // -----------------------------------------------------------------
    // documents.getOcrText
    // -----------------------------------------------------------------
    getOcrText: protectedProcedure
      .input(VersionIdInputSchema)
      .output(OcrTextOutputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const version = await repo.findVersionById(input.versionId);
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const document = await repo.findDocumentById(version.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const hasAllowlistEntry = await hasAnyAllowlistEntry(
          repo,
          document.documentTypeId,
          subject.roles,
          subject.cityId,
        );

        const allowed = guard.canReadOcrText(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          classificationLevel: document.classificationLevel as ClassificationLevel,
          hasAllowlistEntry,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        return { ocrText: version.ocrText };
      }),

    // -----------------------------------------------------------------
    // documents.getScanQualityIndicator
    // -----------------------------------------------------------------
    getScanQualityIndicator: protectedProcedure
      .input(VersionIdInputSchema)
      .output(ScanQualityIndicatorOutputSchema)
      .query(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const version = await repo.findVersionById(input.versionId);
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const document = await repo.findDocumentById(version.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const allowed = guard.canReadScanQuality(subject, {
          ownedByOfficeId: document.ownedByOfficeId,
          createdBy: document.createdBy,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        return {
          scanQualityCategory: (version.scanQualityCategory as any) || null,
          scanQualityScore: version.scanQualityScore ? Number(version.scanQualityScore) : null,
          requiresManualVerification: version.requiresManualVerification,
        };
      }),

    // -----------------------------------------------------------------
    // documents.triggerManualReOcr
    // -----------------------------------------------------------------
    triggerManualReOcr: protectedProcedure
      .input(VersionIdInputSchema)
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const version = await repo.findVersionById(input.versionId);
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const document = await repo.findDocumentById(version.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const allowed = guard.canUpdate(subject, {
          lifecycleState: document.lifecycleState as LifecycleState,
          ownedByOfficeId: document.ownedByOfficeId,
          createdBy: document.createdBy,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN', message: 'You must have update rights to trigger Re-OCR.' });

        const ocrService = getOcrService(ctx);
        await ocrService.enqueueManualReOcrJob(input.versionId);

        return { success: true as const };
      }),

    // -----------------------------------------------------------------
    // documents.flagScannedBackForVerification
    // -----------------------------------------------------------------
    flagScannedBackForVerification: protectedProcedure
      .input(FlagScannedBackInputSchema)
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const version = await repo.findVersionById(input.versionId);
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const document = await repo.findDocumentById(version.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        // Same access requirement as Re-OCR (must be able to update)
        const allowed = guard.canUpdate(subject, {
          lifecycleState: document.lifecycleState as LifecycleState,
          ownedByOfficeId: document.ownedByOfficeId,
          createdBy: document.createdBy,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        await repo.updateVersionFields(input.versionId, {
          requiresManualVerification: true,
          // We don't store the reason column on the version yet, but we could log an audit event
        });

        return { success: true as const };
      }),

    // -----------------------------------------------------------------
    // documents.acceptScannedBackAsOfficial
    // -----------------------------------------------------------------
    acceptScannedBackAsOfficial: protectedProcedure
      .input(VersionIdInputSchema)
      .output(SuccessOutputSchema)
      .mutation(async ({ ctx, input }) => {
        const subject = ctx.auth;
        const repo = getRepository(ctx);
        const guard = getPolicyGuard(ctx);

        const version = await repo.findVersionById(input.versionId);
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const document = await repo.findDocumentById(version.documentId);
        if (!document || document.cityId !== subject.cityId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }

        const allowed = guard.canUpdate(subject, {
          lifecycleState: document.lifecycleState as LifecycleState,
          ownedByOfficeId: document.ownedByOfficeId,
          createdBy: document.createdBy,
        });
        if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });

        await repo.updateVersionFields(input.versionId, {
          requiresManualVerification: false,
        });

        return { success: true as const };
      }),
  });
}
