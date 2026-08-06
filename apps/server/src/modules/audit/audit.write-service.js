import { randomUUID } from 'node:crypto';
import { canonicalizePayload, computeChainHash, signHmac } from './audit.crypto.js';
/**
 * Monotonically increasing HMAC key version. Start at 1.
 * Updated during HMAC key rotation (deferred to Phase 2 operational procedure
 * per ADR-API-002) — rotation logic is not implemented in this task.
 */
const CURRENT_KEY_VERSION = 1;
/**
 * AuditWriteService — atomically writes a tamper-evident audit event.
 *
 * All steps happen inside a single database transaction (ADR-API-002):
 *   1. Generate UUID + timestamp
 *   2. Canonicalize the payload for deterministic hashing
 *   3. Acquire a FOR UPDATE lock on the latest row to fetch previous chain_hash
 *   4. Compute the chain hash and HMAC
 *   5. INSERT the new row
 *
 * The write path is INSERT-only. UPDATE and DELETE are never called here,
 * and are explicitly revoked at the PostgreSQL role level (I3 §16).
 *
 * Note: The audit log is tamper-evident, not tamper-proof. A sufficiently
 * privileged attacker holding both DB write access and the HMAC secret could
 * insert records that pass validation.
 */
export class AuditWriteService {
    repo;
    env;
    constructor(repo, env) {
        this.repo = repo;
        this.env = env;
    }
    async writeEvent(input) {
        await this.repo.db.transaction(async (tx) => {
            const id = randomUUID();
            const occurredAt = new Date();
            // Canonical form includes all input fields plus the wall-clock timestamp,
            // so the hash is tied to both the event content and its occurrence time.
            const canonical = canonicalizePayload({
                ...input,
                occurredAt: occurredAt.toISOString(),
            });
            // FOR UPDATE lock serializes concurrent writers — no two transactions can
            // compute a chain hash against the same "previous row" simultaneously.
            const prevHash = await this.repo.fetchPreviousChainHash(tx);
            const chainHash = computeChainHash(prevHash, canonical);
            const hmac = signHmac(canonical, this.env.AUDIT_HMAC_SECRET);
            await this.repo.insertEvent(tx, {
                id,
                cityId: input.cityId,
                eventType: input.eventType,
                actorId: input.actorId ?? null,
                targetId: input.targetId ?? null,
                targetType: input.targetType ?? null,
                resourceOfficeId: input.resourceOfficeId ?? null,
                payload: input.payload,
                chainHash,
                hmac,
                hmacKeyVersion: CURRENT_KEY_VERSION,
                occurredAt,
            });
        });
    }
}
