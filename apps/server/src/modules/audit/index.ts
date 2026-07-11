import { AuditRepository } from './audit.repository.js';
import { AuditWriteService } from './audit.write-service.js';
import { AuditQueryService } from './audit.query-service.js';
import type { createAuditDb } from './audit.db.js';




// ─── Shared Types ─────────────────────────────────────────────────────────────

/**
 * Input interface for writing an audit event (B2 Module 8).
 */
export interface AuditEventInput {
  eventType: string;
  actorId: string | null; // null for system-generated events
  targetId?: string | null;
  targetType?: string | null; // e.g. 'document', 'user', 'delegation'
  /**
   * Denormalized owning-office UUID for ABAC gate I1 §8.3 (D-ABAC-04).
   * Supply the owning office UUID of the target resource at the time of the event;
   * pass null for session events, system events, or any resource type with no
   * single owning office. [CONFLICT 1 → RESOLVED]
   */
  resourceOfficeId?: string | null;
  payload: Record<string, unknown>;
  cityId: string;
}

/**
 * Filter parameters for querying audit events (B2 Module 8).
 */
export interface AuditQueryFilter {
  actorId?:           string;
  targetId?:          string;
  eventTypes?:        string[];
  from?:              Date;
  to?:                Date;
  pageSize?:          number;    // default 50; max 200
  cursor?:            string;    // opaque cursor = base64(String(sequence_number))
  cityId?:            string;    // tenant isolation — always set by the router
  resourceOfficeIds?: string[];  // for listOwnOfficeDocumentActions (I1 §8.3)
}

/**
 * A single audit event record returned by queryEvents.
 */
export interface AuditEvent {
  auditEventId: string;
  eventType:    string;
  actorId:      string | null;
  targetId:     string | null;
  targetType:   string | null;
  payload:      Record<string, unknown>;
  cityId:       string;
  occurredAt:   Date;
  chainHash:    string;
  hmac:         string;
}

/**
 * Result of a queryEvents call with chain validation status.
 */
export interface AuditQueryResult {
  events:                AuditEvent[];
  chainValidationStatus: 'intact' | 'broken';
  nextCursor?:           string;
}

// ─── Public API Interface ─────────────────────────────────────────────────────

/**
 * AuditPublicAPI — the contract this module exposes to the rest of the server
 * (B2 Module 8). Accessible via `fastify.auditService`.
 */
export interface AuditPublicAPI {
  /**
   * Write an audit event synchronously.
   * Use ONLY when the audit entry must be atomic with the calling operation
   * and a domain event on the bus would not provide that guarantee.
   * Confirmed callers (B2 Module 8):
   *   - Records.bulkOpHandler  (one call per item in a bulk operation)
   *   - Records.dispositionSvc (one call per disposition action)
   * Any additional direct caller must be documented in B2 Module 8 before merging.
   * All other modules reach the audit log via the event bus (TASK-AUDIT-004).
   */
  writeEvent(event: AuditEventInput): Promise<void>;

  /**
   * Query audit events with on-read chain validation.
   * Returns events with chainValidationStatus 'intact' | 'broken'.
   * 'broken' is a tamper indicator; surface it to the caller.
   * Implemented by TASK-AUDIT-005.
   */
  queryEvents(filter: AuditQueryFilter): Promise<AuditQueryResult>;
  /**
   * Internal dependencies exposed for background jobs (e.g. TSA export).
   * Not to be used by other domain modules.
   */
  _internal: {
    repo: AuditRepository;
    writeService: AuditWriteService;
  };
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createAuditModule(deps: {
  auditDb: ReturnType<typeof createAuditDb>;
  env: { AUDIT_HMAC_SECRET: string; AUDIT_CHAIN_VERIFY_ON_READ: boolean };
}): AuditPublicAPI {
  const repo = new AuditRepository(deps.auditDb);
  const writeService = new AuditWriteService(repo, deps.env);
  const queryService = new AuditQueryService(repo, deps.env);

  return {
    writeEvent:  (e) => writeService.writeEvent(e),
    queryEvents: (f) => queryService.queryEvents(f),
    _internal: {
      repo,
      writeService,
    },
  };
}
