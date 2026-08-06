import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as auditSchema from '@batac/database/schema/audit.schema.js';
/**
 * Creates a dedicated Drizzle pool for the `batac_audit` PostgreSQL role.
 *
 * This pool is intentionally separate from the main `batac_app` pool:
 *   - `batac_audit` has INSERT on `audit.events` and SELECT for chain-hash reads.
 *   - `batac_app` does NOT have SELECT on `audit.events`.
 *   - Max 2 connections: audit writes are serial per sequence_number (FOR UPDATE lock).
 *
 * Never pass DATABASE_URL_APP to this factory. (I3 §16, Invariant #3)
 */
export function createAuditDb(databaseUrlAudit) {
    const pg = postgres(databaseUrlAudit, {
        max: 2,
        idle_timeout: 30,
    });
    return drizzle(pg, { schema: auditSchema });
}
