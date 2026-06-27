import { asc, gt, lt, eq, and, gte, lte, inArray } from 'drizzle-orm';
import { auditEvents } from '@batac/database/schema/audit.schema.js';
import {
  canonicalizePayload,
  computeChainHash,
  verifyHmac,
  GENESIS_HASH,
} from './audit.crypto.js';
import type { AuditRepository } from './audit.repository.js';
import type { AuditQueryFilter, AuditQueryResult } from './index.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Encode a sequence number as an opaque base64 cursor.
 */
function encodeCursor(sequenceNumber: bigint): string {
  return Buffer.from(String(sequenceNumber)).toString('base64');
}

/**
 * Decode a base64 cursor back to a sequence number.
 */
function decodeCursor(cursor: string): bigint {
  return BigInt(Buffer.from(cursor, 'base64').toString('ascii'));
}

interface AuditQueryServiceEnv {
  AUDIT_HMAC_SECRET: string;
  AUDIT_CHAIN_VERIFY_ON_READ: boolean;
}

/**
 * AuditQueryService — reads audit events and performs on-read chain validation
 * to detect tampering (I3 §9.4).
 *
 * Validation algorithm (four steps, per task spec):
 *   1. Canonicalize the stored payload fields.
 *   2. Verify the HMAC signature.
 *   3. Resolve the expected previous chain hash.
 *   4. Recompute and compare chain_hash.
 *
 * If any row fails either check, chainValidationStatus is 'broken'.
 * Only if ALL rows pass does it return 'intact'.
 *
 * Chain validation can be bypassed at runtime by setting
 * AUDIT_CHAIN_VERIFY_ON_READ=false (emergency flag only).
 */
export class AuditQueryService {
  constructor(
    private readonly repo: AuditRepository,
    private readonly env: AuditQueryServiceEnv,
  ) {}

  async queryEvents(filter: AuditQueryFilter): Promise<AuditQueryResult> {
    const pageSize = Math.min(
      filter.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    // Build WHERE conditions
    const conditions = [];

    if (filter.cursor) {
      const decoded = decodeCursor(filter.cursor);
      conditions.push(gt(auditEvents.sequenceNumber, decoded));
    }

    if (filter.actorId) {
      conditions.push(eq(auditEvents.actorId, filter.actorId));
    }

    if (filter.targetId) {
      conditions.push(eq(auditEvents.targetId, filter.targetId));
    }

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      conditions.push(inArray(auditEvents.eventType, filter.eventTypes));
    }

    if (filter.from) {
      conditions.push(gte(auditEvents.occurredAt, filter.from));
    }

    if (filter.to) {
      conditions.push(lte(auditEvents.occurredAt, filter.to));
    }

    // Fetch pageSize + 1 to determine if a next page exists
    const rows = await this.repo.db
      .select()
      .from(auditEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(auditEvents.sequenceNumber))
      .limit(pageSize + 1);

    // Determine pagination
    let nextCursor: string | undefined;
    let eventsSlice = rows;
    if (rows.length > pageSize) {
      eventsSlice = rows.slice(0, pageSize);
      const lastRow = eventsSlice[eventsSlice.length - 1];
      if (lastRow) {
        nextCursor = encodeCursor(lastRow.sequenceNumber!);
      }
    }

    // Skip chain validation if flag is false
    if (!this.env.AUDIT_CHAIN_VERIFY_ON_READ) {
      return {
        events: eventsSlice.map((row) => ({
          auditEventId: row.id,
          eventType: row.eventType,
          actorId: row.actorId ?? null,
          targetId: row.targetId ?? null,
          targetType: row.targetType ?? null,
          payload: row.payload,
          cityId: row.cityId,
          occurredAt: row.occurredAt,
          chainHash: row.chainHash,
          hmac: row.hmac,
        })),
        chainValidationStatus: 'intact',
        nextCursor,
      };
    }

    // Resolve the previous hash for the first row in this batch.
    // If the batch starts at the very beginning (no cursor), the previous
    // hash is GENESIS_HASH if no rows exist before the batch start.
    let prevHashForFirstRow = GENESIS_HASH;
    if (eventsSlice.length > 0) {
      const firstSeq = eventsSlice[0]!.sequenceNumber!;
      const prevRowResult = await this.repo.db
        .select({ chainHash: auditEvents.chainHash })
        .from(auditEvents)
        .where(lt(auditEvents.sequenceNumber, firstSeq))
        .orderBy(asc(auditEvents.sequenceNumber))
        .limit(1);
      // Use the last row before this batch if it exists
      if (prevRowResult.length > 0) {
        // Get the actual last row before the batch
        const lastBefore = await this.repo.db
          .select({ chainHash: auditEvents.chainHash })
          .from(auditEvents)
          .where(lt(auditEvents.sequenceNumber, firstSeq))
          .orderBy(asc(auditEvents.sequenceNumber));
        prevHashForFirstRow = lastBefore[lastBefore.length - 1]?.chainHash ?? GENESIS_HASH;
      }
    }

    // Validate each row
    let chainValidationStatus: 'intact' | 'broken' = 'intact';
    let prevHash = prevHashForFirstRow;

    const validatedEvents = eventsSlice.map((row) => {
      // Step 1: re-canonicalize using the stored fields.
      // IMPORTANT: Must match the exact fields used in AuditWriteService.writeEvent,
      // which does: canonicalizePayload({ ...input, occurredAt: occurredAt.toISOString() })
      // where `input` is the full AuditEventInput spread.
      //
      // Null fields: AuditEventInput may contain null values for optional fields
      // (e.g. resourceOfficeId: null). The write path includes those nulls in the
      // canonical object — JSON.stringify serializes null as "null", not omitted.
      // We must replicate that exactly: include all stored fields, including nulls.
      const canonical = canonicalizePayload({
        eventType: row.eventType,
        actorId: row.actorId,
        targetId: row.targetId,
        targetType: row.targetType,
        resourceOfficeId: row.resourceOfficeId,
        payload: row.payload,
        cityId: row.cityId,
        occurredAt: row.occurredAt.toISOString(),
      });

      // Step 2: verify HMAC
      const hmacValid = verifyHmac(canonical, this.env.AUDIT_HMAC_SECRET, row.hmac);
      if (!hmacValid) {
        chainValidationStatus = 'broken';
      }

      // Step 3 & 4: recompute chain hash and compare
      const expectedHash = computeChainHash(prevHash, canonical);
      if (expectedHash !== row.chainHash) {
        chainValidationStatus = 'broken';
      }

      // Advance prevHash to current row for the next iteration
      prevHash = row.chainHash;

      return {
        auditEventId: row.id,
        eventType: row.eventType,
        actorId: row.actorId ?? null,
        targetId: row.targetId ?? null,
        targetType: row.targetType ?? null,
        payload: row.payload,
        cityId: row.cityId,
        occurredAt: row.occurredAt,
        chainHash: row.chainHash,
        hmac: row.hmac,
      };
    });

    return {
      events: validatedEvents,
      chainValidationStatus,
      nextCursor,
    };
  }
}
