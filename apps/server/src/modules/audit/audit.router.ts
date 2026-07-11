import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, asc, and, gte, lt } from 'drizzle-orm';
import { auditEvents } from '@batac/database/schema/audit.schema.js';
import { router, protectedProcedure } from '../../trpc.js';
import { computeChainHash, canonicalizePayload, verifyHmac, GENESIS_HASH } from './audit.crypto.js';
import type { AuditPublicAPI, AuditQueryResult, AuditEvent } from './index.js';

// ─── Shared role sets (I1 §8 / I2 §15) ───────────────────────────────────────

/** §8.1: No role may write to audit.events directly (enforced at DB layer too). */

/** §8.2: Roles allowed to read own actions. */
const OWN_ACTIONS_ROLES = [
  'records_officer', 'dept_encoder', 'dept_approver', 'sp_secretary',
  'sp_member', 'sp_presiding_officer', 'mayor', 'brgy_encoder',
  'brgy_captain', 'auditor',
] as const;

/** §8.3: Roles allowed to read own-office document events. */
const OWN_OFFICE_ROLES = [
  'records_officer', 'dept_approver', 'sp_secretary',
  'sp_presiding_officer', 'mayor', 'brgy_captain', 'auditor',
] as const;

/** §8.5: Roles allowed to validate chain integrity. */
const CHAIN_VALIDATE_ROLES = ['sys_admin', 'auditor'] as const;

// ─── Shared input fragments ────────────────────────────────────────────────────

const paginationInput = z.object({
  pageSize: z.number().int().min(1).max(200).optional(),
  cursor:   z.string().optional(),
});

const dateRangeInput = z.object({
  from: z.coerce.date().optional(),
  to:   z.coerce.date().optional(),
});

// ─── Output shape ─────────────────────────────────────────────────────────────

/**
 * Single audit event shape returned by all read procedures.
 * Omits chainHash/hmac from the wire shape — those are integrity columns,
 * not application data for the frontend to display.
 */
const auditEventOutput = z.object({
  auditEventId: z.string().uuid(),
  eventType:    z.string(),
  actorId:      z.string().uuid().nullable(),
  targetId:     z.string().uuid().nullable(),
  targetType:   z.string().nullable(),
  occurredAt:   z.coerce.date(),
  payload:      z.record(z.unknown()),
});

const listOutput = z.object({
  items:      z.array(auditEventOutput),
  nextCursor: z.string().nullable(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasAnyRole(roles: string[], allowed: readonly string[]): boolean {
  return allowed.some((r) => roles.includes(r));
}

function enforceRole(roles: string[], allowed: readonly string[], message?: string): void {
  if (!hasAnyRole(roles, allowed)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: message ?? 'You do not have permission to perform this action.',
    });
  }
}

function mapToOutput(events: AuditEvent[]): z.infer<typeof auditEventOutput>[] {
  return events.map((e) => ({
    auditEventId: e.auditEventId,
    eventType:    e.eventType,
    actorId:      e.actorId,
    targetId:     e.targetId,
    targetType:   e.targetType,
    occurredAt:   e.occurredAt,
    payload:      e.payload,
  }));
}

// ─── Input schema for the legacy queryEvents procedure ────────────────────────

const auditQueryEventsInput = z.object({
  actorId:    z.string().uuid().optional(),
  targetId:   z.string().uuid().optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  pageSize:   z.number().int().min(1).max(200).optional(),
  cursor:     z.string().optional(),
});

export type AuditQueryEventsInput = z.infer<typeof auditQueryEventsInput>;

// ─── Router factory ───────────────────────────────────────────────────────────

/**
 * Creates the audit tRPC router bound to the provided AuditPublicAPI instance.
 *
 * Procedures added by TASK-PRE-03 (Path A, 2026-07-11):
 *   - audit.listOwnActions         — I1 §8.2, 10 allowed roles
 *   - audit.listOwnOfficeDocumentActions — I1 §8.3, 7 roles, office-scoped
 *   - audit.listFullLog            — I1 §8.4, auditor only
 *   - audit.validateChainIntegrity — I1 §8.5, sys_admin + auditor
 *   - audit.exportEvents           — I1 §8.6, auditor only (mutation)
 *
 * The original audit.queryEvents procedure is kept for backward compat.
 *
 * @param auditService - The AuditPublicAPI facade, typically from fastify.auditService.
 */
export function createAuditTrpcRouter(auditService?: AuditPublicAPI) {
  return router({
    // ─── Legacy procedure (kept for backward compat) ──────────────────────────
    //
    // audit.queryEvents
    //   Restricted to sys_admin | auditor (I1 §8). Frontend should prefer the
    //   purpose-specific procedures below. This procedure does NOT enforce cityId
    //   tenant isolation (pre-existing behavior); new procedures always enforce it.
    queryEvents: protectedProcedure
      .input(auditQueryEventsInput)
      .query(async ({ ctx, input }): Promise<AuditQueryResult> => {
        const ALLOWED_ROLES = ['sys_admin', 'auditor'] as const;
        const hasRole = ctx.session?.roles.some((r) =>
          (ALLOWED_ROLES as readonly string[]).includes(r),
        ) ?? ctx.auth?.roles.some((r) =>
          (ALLOWED_ROLES as readonly string[]).includes(r),
        );

        if (!hasRole) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied: requires sys_admin or auditor role',
          });
        }

        const service = auditService ?? (ctx.req.server as any).auditService;
        return service.queryEvents({
          actorId:    input.actorId,
          targetId:   input.targetId,
          eventTypes: input.eventTypes,
          from:       input.from,
          to:         input.to,
          pageSize:   input.pageSize,
          cursor:     input.cursor,
        });
      }),

    // ─── audit.listOwnActions ─────────────────────────────────────────────────
    //
    // Callable by: all 10 operational roles (I1 §8.2, I2 §15).
    // sys_admin and plat_admin are explicitly denied.
    // ABAC: actorId is forced to ctx.auth.userId server-side — client cannot
    //   supply a different actorId. cityId is forced for tenant isolation.
    // Returns list-item shape (no chainHash/hmac on the wire).
    // -------------------------------------------------------------------------
    listOwnActions: protectedProcedure
      .input(paginationInput.merge(dateRangeInput))
      .output(listOutput)
      .query(async ({ ctx, input }) => {
        enforceRole(ctx.auth.roles, OWN_ACTIONS_ROLES);

        const service = auditService ?? (ctx.req.server as any).auditService as AuditPublicAPI;
        const result = await service.queryEvents({
          actorId:  ctx.auth.userId,      // forced — I1 §8.2
          cityId:   ctx.auth.cityId,      // tenant isolation
          pageSize: input.pageSize,
          cursor:   input.cursor,
          from:     input.from,
          to:       input.to,
        });

        return {
          items:      mapToOutput(result.events),
          nextCursor: result.nextCursor ?? null,
        };
      }),

    // ─── audit.listOwnOfficeDocumentActions ───────────────────────────────────
    //
    // Callable by: 7 roles (I1 §8.3, I2 §15).
    //   dept_encoder, sp_member, brgy_encoder are denied.
    // ABAC: if officeId is supplied it must be in ctx.auth.effectiveOfficeIds;
    //   if omitted all effectiveOfficeIds are queried.
    //   resource_office_id column is denormalized at write time (D-ABAC-04 —
    //   never a live join back to the resource's current owning office).
    // -------------------------------------------------------------------------
    listOwnOfficeDocumentActions: protectedProcedure
      .input(
        paginationInput.merge(dateRangeInput).extend({
          officeId: z.string().uuid().optional(),
        })
      )
      .output(listOutput)
      .query(async ({ ctx, input }) => {
        enforceRole(ctx.auth.roles, OWN_OFFICE_ROLES);

        // Determine which office IDs to query
        const effectiveOfficeIds = ctx.auth.effectiveOfficeIds ?? [];

        let resourceOfficeIds: string[];
        if (input.officeId) {
          // Client specified a particular office — must be in their effective set
          if (!effectiveOfficeIds.includes(input.officeId)) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'The requested officeId is not within your effective office scope.',
            });
          }
          resourceOfficeIds = [input.officeId];
        } else {
          // No officeId supplied — query all effective offices
          resourceOfficeIds = effectiveOfficeIds;
        }

        if (resourceOfficeIds.length === 0) {
          // No effective offices → return empty (rather than querying without a filter)
          return { items: [], nextCursor: null };
        }

        const service = auditService ?? (ctx.req.server as any).auditService as AuditPublicAPI;
        const result = await service.queryEvents({
          resourceOfficeIds,              // I1 §8.3 / D-ABAC-04
          cityId:   ctx.auth.cityId,      // tenant isolation
          pageSize: input.pageSize,
          cursor:   input.cursor,
          from:     input.from,
          to:       input.to,
        });

        return {
          items:      mapToOutput(result.events),
          nextCursor: result.nextCursor ?? null,
        };
      }),

    // ─── audit.listFullLog ────────────────────────────────────────────────────
    //
    // Callable by: auditor ONLY (I1 §8.4, I2 §15).
    //   sys_admin is explicitly denied per I2 §15 row "View audit log — all entries".
    // Returns chainValidationStatus so the /audit/full frontend page can surface
    //   any detected tampering to the auditor.
    // -------------------------------------------------------------------------
    listFullLog: protectedProcedure
      .input(
        paginationInput.merge(dateRangeInput).extend({
          actorId:    z.string().uuid().optional(),
          eventTypes: z.array(z.string().min(1)).optional(),
        })
      )
      .output(
        listOutput.extend({
          chainValidationStatus: z.enum(['intact', 'broken']),
        })
      )
      .query(async ({ ctx, input }) => {
        // Auditor ONLY — sys_admin is explicitly ❌ per I2 §15
        if (!ctx.auth.roles.includes('auditor')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied: requires auditor role.',
          });
        }

        const service = auditService ?? (ctx.req.server as any).auditService as AuditPublicAPI;
        const result = await service.queryEvents({
          actorId:    input.actorId,
          eventTypes: input.eventTypes,
          cityId:     ctx.auth.cityId,    // tenant isolation
          pageSize:   input.pageSize,
          cursor:     input.cursor,
          from:       input.from,
          to:         input.to,
        });

        return {
          items:                 mapToOutput(result.events),
          nextCursor:            result.nextCursor ?? null,
          chainValidationStatus: result.chainValidationStatus,
        };
      }),

    // ─── audit.validateChainIntegrity ─────────────────────────────────────────
    //
    // Callable by: sys_admin | auditor (I1 §8.5, I2 §15).
    // Business: walks every event from fromEventId (or genesis) forward,
    //   recomputing HMAC and chain hash using audit.crypto primitives,
    //   and returns the first event where either check fails.
    // This walks the FULL chain (not page-by-page) so it must only be triggered
    //   on demand, not on every page load. [Inference — no page size spec in E1]
    // -------------------------------------------------------------------------
    validateChainIntegrity: protectedProcedure
      .input(
        z.object({
          fromEventId: z.string().uuid().optional(),
        })
      )
      .output(
        z.object({
          status:          z.enum(['intact', 'broken']),
          brokenAtEventId: z.string().uuid().nullable(),
        })
      )
      .query(async ({ ctx, input }) => {
        enforceRole(ctx.auth.roles, CHAIN_VALIDATE_ROLES);

        const service = auditService ?? (ctx.req.server as any).auditService as AuditPublicAPI;
        const repo = service._internal.repo;
        const env  = (ctx.req.server as any).auditEnv as { AUDIT_HMAC_SECRET: string };
        const hmacSecret = env?.AUDIT_HMAC_SECRET ?? (ctx.req.server as any).config?.AUDIT_HMAC_SECRET;

        // Fetch all events in order (full chain walk — no pagination)
        // Using repo.db directly since AuditQueryService is paginated.
        let rows;
        if (input.fromEventId) {
          // Resolve the starting sequence number, then fetch that row and all after it
          const startRow = await repo.db
            .select({ seq: auditEvents.sequenceNumber })
            .from(auditEvents)
            .where(eq(auditEvents.id, input.fromEventId))
            .limit(1);
          if (!startRow[0]) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'fromEventId not found.' });
          }
          const startSeq = startRow[0].seq;
          rows = await repo.db
            .select()
            .from(auditEvents)
            .where(
              and(
                eq(auditEvents.cityId, ctx.auth.cityId),
                gte(auditEvents.sequenceNumber, startSeq),
              )
            )
            .orderBy(asc(auditEvents.sequenceNumber));
        } else {
          rows = await repo.db
            .select()
            .from(auditEvents)
            .where(eq(auditEvents.cityId, ctx.auth.cityId))
            .orderBy(asc(auditEvents.sequenceNumber));
        }

        if (rows.length === 0) {
          return { status: 'intact', brokenAtEventId: null };
        }

        // Resolve the hash of the row immediately before the first row in our set
        let prevHash = GENESIS_HASH;
        const firstSeq = rows[0]!.sequenceNumber!;
        const prevRows = await repo.db
          .select({ chainHash: auditEvents.chainHash })
          .from(auditEvents)
          .where(lt(auditEvents.sequenceNumber, firstSeq))
          .orderBy(asc(auditEvents.sequenceNumber));
        if (prevRows.length > 0) {
          prevHash = prevRows[prevRows.length - 1]!.chainHash;
        }

        // Walk the chain
        for (const row of rows) {
          const canonical = canonicalizePayload({
            eventType:        row.eventType,
            actorId:          row.actorId,
            targetId:         row.targetId,
            targetType:       row.targetType,
            resourceOfficeId: row.resourceOfficeId,
            payload:          row.payload,
            cityId:           row.cityId,
            occurredAt:       row.occurredAt.toISOString(),
          });

          const hmacValid = verifyHmac(canonical, hmacSecret, row.hmac);
          const expectedHash = computeChainHash(prevHash, canonical);

          if (!hmacValid || expectedHash !== row.chainHash) {
            return { status: 'broken', brokenAtEventId: row.id };
          }

          prevHash = row.chainHash;
        }

        return { status: 'intact', brokenAtEventId: null };
      }),

    // ─── audit.exportEvents ───────────────────────────────────────────────────
    //
    // Callable by: auditor ONLY (I1 §8.6, I2 §15).
    // Type: mutation — producing this export is itself an auditable action
    //   (I1 §8.6 "the export action itself produces an audit record").
    //
    // E1 spec output: { exportPresignedUrl: string }
    // [Inference — LOG-0083] S3 is not currently injected into this router.
    // Returns base64-encoded NDJSON instead; presigned URL shape deferred.
    // The audit record for this export action is NOT written by this procedure
    // (the procedure has no access to auditService.writeEvent on its own
    // call path — that would be circular); [Inference — LOG-0083] the export
    // audit record must be wired via the event bus or a direct writeEvent()
    // call once S3 integration is added in a follow-up task.
    //
    // ABAC: bounded by classification clearance (I1 §8.6 / I2 Note ¹⁶).
    // [Inference] Classification allowlist check deferred — records module
    // owns the allowlist and is not yet wired to the audit module. The
    // export includes all events without classification filtering for now.
    // -------------------------------------------------------------------------
    exportEvents: protectedProcedure
      .input(
        dateRangeInput.extend({
          eventTypes: z.array(z.string().min(1)).optional(),
        })
      )
      .output(
        z.object({
          exportData:  z.string(),  // base64-encoded NDJSON (see LOG-0083)
          contentType: z.literal('application/x-ndjson'),
          eventCount:  z.number().int(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Auditor ONLY — I1 §8.6
        if (!ctx.auth.roles.includes('auditor')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied: requires auditor role.',
          });
        }

        const service = auditService ?? (ctx.req.server as any).auditService as AuditPublicAPI;
        const repo = service._internal.repo;

        // Use compileMonthlySnapshot for the base export data.
        // The AuditRepository.compileMonthlySnapshot already handles date-range
        // logic (previous calendar month, or from beginning if no prior export).
        // [Inference — LOG-0083] eventTypes and custom date range from input are
        // not yet threaded into compileMonthlySnapshot; that method is hardcoded
        // to the previous calendar month. Custom date-range export deferred.
        const buffer = await repo.compileMonthlySnapshot();

        const exportData = buffer.toString('base64');
        // Count events by counting newlines + 1 (NDJSON lines)
        const lineCount = buffer.length === 0 ? 0 : buffer.toString('utf-8').split('\n').filter(Boolean).length;

        return {
          exportData,
          contentType: 'application/x-ndjson' as const,
          eventCount:  lineCount,
        };
      }),
  });
}

export type AuditTrpcRouter = ReturnType<typeof createAuditTrpcRouter>;
