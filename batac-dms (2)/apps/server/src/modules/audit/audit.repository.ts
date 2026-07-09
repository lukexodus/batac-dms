import { desc, sql, eq, asc, between, lte } from 'drizzle-orm';
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
    // Acquire transaction-level advisory lock to serialize writes.
    // We cannot use .for('update') because the batac_audit role does not
    // have UPDATE privileges on audit.events (Security Invariant #3).
    await tx.execute(sql`SELECT pg_advisory_xact_lock('audit.events'::regclass::integer)`);

    const result = await tx
      .select({ chainHash: auditEvents.chainHash })
      .from(auditEvents)
      .orderBy(desc(auditEvents.sequenceNumber))
      .limit(1);
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

  /**
   * Fetch all audit events from the previous calendar month, or from the
   * beginning of time if no prior export exists. Output is newline-delimited JSON.
   */
  async compileMonthlySnapshot(): Promise<Buffer> {
    // 1. Find the last audit_log_exported event
    const lastExportResult = await this.db
      .select({ occurredAt: auditEvents.occurredAt })
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'audit_log_exported'))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(1);

    const hasPriorExport = lastExportResult.length > 0;

    const now = new Date();
    // Previous calendar month in UTC
    const firstOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

    let conditions;
    if (hasPriorExport) {
      conditions = between(auditEvents.occurredAt, firstOfPrevMonth, lastOfPrevMonth);
    } else {
      conditions = lte(auditEvents.occurredAt, lastOfPrevMonth);
    }

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(conditions)
      .orderBy(asc(auditEvents.sequenceNumber));

    // Serialize as newline-delimited JSON
    // We convert bigint to string if present, though JSON.stringify handles basic types,
    // we need a replacer for BigInt because sequenceNumber is bigint
    const ndjson = rows.map(row => JSON.stringify(row, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )).join('\n');

    return Buffer.from(ndjson, 'utf-8');
  }
}
