import { desc } from 'drizzle-orm';
import { auditEvents } from '@batac/database/schema/audit.schema.js';
import { GENESIS_HASH } from './audit.crypto.js';
import type { AuditDb } from './audit.db.js';

type AuditTx = Parameters<Parameters<AuditDb['transaction']>[0]>[0];

export interface AuditEventRow {
  id: string;
  cityId: string;
  eventType: string;
  actorId: string | null;
  targetId: string | null;
  targetType: string | null;
  resourceOfficeId: string | null;
  payload: Record<string, unknown>;
  chainHash: string;
  hmac: string;
  hmacKeyVersion: number;
  occurredAt: Date;
}

/**
 * AuditRepository — low-level DB access for the audit.events table.
 *
 * Uses the `batac_audit` role via the dedicated auditDb Drizzle instance.
 * Never uses DATABASE_URL_APP — the audit role has INSERT-only access to
 * audit.events and can SELECT for chain hash reads; batac_app cannot.
 *
 * Security Invariant #3 (I3 §16): This repository never issues UPDATE or DELETE.
 * Even if attempted, the batac_audit PostgreSQL role explicitly revokes those
 * privileges — the DB will reject such operations.
 */
export class AuditRepository {
  constructor(readonly db: AuditDb) {}

  /**
   * Fetch the chain_hash of the row with the highest sequence_number.
   * Returns GENESIS_HASH if no rows exist yet.
   *
   * IMPORTANT: Must be called within the same transaction as insertEvent().
   * The FOR UPDATE lock serializes concurrent writes so that two simultaneous
   * writeEvent() calls cannot produce the same sequence_number or compute
   * chain hashes against the same previous row.
   */
  async fetchPreviousChainHash(tx: AuditTx): Promise<string> {
    const result = await tx
      .select({ chainHash: auditEvents.chainHash })
      .from(auditEvents)
      .orderBy(desc(auditEvents.sequenceNumber))
      .limit(1)
      .for('update');
    return result[0]?.chainHash ?? GENESIS_HASH;
  }

  /**
   * Insert a new audit event row within the provided transaction.
   *
   * Note: sequence_number is auto-populated by the DB sequence
   * `audit.events_sequence_seq` via the column default.
   */
  async insertEvent(tx: AuditTx, row: AuditEventRow): Promise<void> {
    await tx.insert(auditEvents).values(row);
  }
}
