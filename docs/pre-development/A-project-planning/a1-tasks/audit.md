# A1 — Module Task List: AUDIT

Generated per `A1-AGENTS.md` §6 "Step 2 — Module passes," for the `AUDIT` module
(Wave B — depends on INFRA task list). This document contains tasks only; it is
not the assembled A1 (that is the Step 4 integration pass).

**Documents loaded for this pass, in order:** `a1-skeleton.md` (v2) →
`docs/pre-development/A-project-planning/a1-tasks/infra.md` →
`docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md` §audit (Part 10) →
`docs/pre-development/tech-stack.md` §"Audit Log Integrity" →
`docs/pre-development/I-security-and-authorization/i3-security-design-document.md`.
Additional supporting documents read for cross-reference only (not in the prescribed
load list but required to write self-contained AI Prompts per `A1-AGENTS.md` §7):
`b2-module-boundary-and-internal-api-contracts-v1.1.md` §Module 8;
`ADR-API-001-event-bus-implementation.md`; `ADR-API-002-audit-log-design.md`.
Per `A1-AGENTS.md` §6 Step 2's opening instruction, the consolidated reference §13
Phase 1 capability list for AUDIT was read first.

**Sourcing & confidence legend** (matching the convention established in
`a1-skeleton.md` v2):
- Unmarked statements are taken directly from one of the loaded documents.
- `[Inference]` — a reasoned synthesis not stated verbatim in a loaded document.
- `[SPEC GAP]` — something a source requires but no loaded document specifies
  clearly enough to write a self-contained AI Prompt for. Not invented; left for
  human resolution per `A1-AGENTS.md` §1 and §8.
- `[CONFLICT]` — an apparent disagreement between two loaded sources, flagged
  rather than resolved by guessing.

---

## Table of Contents

- [L46–L81]   Phase 1 AUDIT capabilities identified before task generation
- [L82–L208]  TASK-AUDIT-001 — [MIGRATION] Create audit schema Drizzle file and append-only events table migration
- [L209–L369]  TASK-AUDIT-002 — Implement audit crypto utility: SHA-256 hash chain and HMAC-SHA-256 signing
- [L370–L580]  TASK-AUDIT-003 — Implement audit write service, batac_audit connection pool, and public module API
- [L581–L719]  TASK-AUDIT-004 — [AUDIT] Register audit domain event bus consumer for all domain events
- [L720–L855] TASK-AUDIT-005 — Implement audit query service with on-read chain validation
- [L856–L974] TASK-AUDIT-006 — [ABAC] Implement audit tRPC router for sys_admin and auditor roles
- [L975–L1161] TASK-AUDIT-007 — Implement monthly RFC 3161 TSA export scheduled job and provider interface
- [L1162–L1242] Module Summary — AUDIT

---


## Phase 1 AUDIT capabilities identified before task generation

Per `A1-AGENTS.md` §6 Step 2: the consolidated reference §13 names the following
Phase 1 capabilities for the AUDIT module:

1. **Append-only audit log schema** — the `audit.events` table with SHA-256
   hash chaining, HMAC-SHA-256 signing, and `sequence_number` monotonic ordering.
   (`tech-stack.md` §"Audit Log Integrity"; C1 Part 10; I3 §8.4, §9.2.)
2. **Audit crypto layer** — SHA-256 chain hash computation using Node built-in
   `crypto` only; HMAC-SHA-256 per-event signing with `AUDIT_HMAC_SECRET`;
   genesis hash constant; chain validation on read. (`tech-stack.md` §"Audit Log
   Integrity"; ADR-API-002; I3 §9.2, §9.4.)
3. **Audit write service** — `AuditWriteService.writeEvent()` using the
   `batac_audit` DB role connection; chain hash + HMAC computed and INSERTed in
   the same transaction. Published API: `writeEvent()` (synchronous) and
   `queryEvents()`. (B2 Module 8; ADR-API-002.)
4. **Domain event bus consumer** — subscribes to all domain events from all
   modules via the in-process typed EventEmitter bus; converts each event envelope
   to `AuditEventInput` and calls `writeEvent()`. (B2 Module 8 §Events Consumed;
   ADR-API-001; I3 §9.1.)
5. **Audit query service with chain validation** — `queryEvents()` fetching
   paginated events in `sequence_number` order and recomputing chain hash and HMAC
   at retrieval time; returns `chainValidationStatus: 'intact' | 'broken'`. (B2
   Module 8; I3 §9.4.)
6. **Audit tRPC router** — `audit.queryEvents` procedure restricted to `sys_admin`
   and `auditor` roles. (I3 §9.4; `A1-AGENTS.md` §3 `[ABAC]` tag.)
7. **Monthly RFC 3161 TSA export job** — pgboss monthly scheduled job; provider-
   swappable `RfcTsaClient` interface; stub implementation pending vendor selection
   (D-AUTH-08 open); export itself recorded as an audit event. (ADR-API-002;
   `tech-stack.md` §"Audit Log Integrity"; I3 §9.2.)

No Phase 1B, 2, 3, 4, or 5 capability is generated below. Deferred capabilities
are listed in the Module Summary.

---

## TASK-AUDIT-001

Phase:          1
Module:         AUDIT
Title:          [MIGRATION] Create audit schema Drizzle file and events table
Prerequisites:  [TASK-INFRA-005, TASK-INFRA-006, TASK-INFRA-007]
Deliverables:
  - /packages/database/schema/audit.schema.ts — Drizzle schema for audit.events table and audit.events_sequence_seq; matches C1 Part 10 DDL exactly
  - /packages/database/migrations/<timestamp>_create_audit_schema.sql — generated by `pnpm --filter @batac/database db:generate`; not hand-edited
Acceptance Criteria:
  - [ ] `pnpm --filter @batac/database db:generate` produces a migration that, when inspected, contains `CREATE SEQUENCE audit.events_sequence_seq`, `CREATE TABLE audit.events (...)`, all four standard indexes, and the partial index on `resource_office_id`
  - [ ] `pnpm --filter @batac/database db:migrate` applies the migration to a fresh local Postgres instance without error
  - [ ] `pnpm --filter @batac/database db:migrate` run a second time is idempotent (reports zero pending migrations)
  - [ ] `pnpm typecheck` (workspace root) passes with the new schema file in place
  - [ ] `pnpm --filter @batac/scripts lint:migrations` passes — UUID PK, TIMESTAMPTZ column, no cross-schema FK on `audit.events`
  - [ ] Manual: reviewer confirms the Drizzle schema file includes a `resource_office_id UUID NULL` column and the partial index `ON audit.events(resource_office_id) WHERE resource_office_id IS NOT NULL` ([CONFLICT 1 → RESOLVED]; see Module Summary)
AI Prompt:
  > Implement the Drizzle schema file and database migration for the `audit`
  > schema. The audit schema is the tamper-evident append-only log for all
  > system activity on the Batac City LGU Platform.
  >
  > ---
  >
  > ## Directory conventions (from TASK-INFRA-006)
  >
  > - Schema files: `/packages/database/schema/`
  > - Migration output: `/packages/database/migrations/` (Drizzle Kit generates
  >   these; never hand-edit the migration SQL or Drizzle's snapshot metadata)
  > - Generate: `pnpm --filter @batac/database db:generate`
  > - Apply: `pnpm --filter @batac/database db:migrate`
  >
  > ---
  >
  > ## DDL to reproduce (C1 Part 10 — updated 2026-06-24)
  >
  > Create `/packages/database/schema/audit.schema.ts` as a Drizzle schema file
  > that produces exactly the following SQL when generated:
  >
  > ```sql
  > -- Monotonic sequence for unambiguous "previous record" pointer,
  > -- independent of wall-clock timestamp ordering.
  > CREATE SEQUENCE audit.events_sequence_seq AS BIGINT INCREMENT 1 START 1;
  >
  > CREATE TABLE audit.events (
  >     id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  >     city_id          UUID        NOT NULL
  >                        DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  >     sequence_number  BIGINT      NOT NULL
  >                        DEFAULT nextval('audit.events_sequence_seq'),
  >     event_type       TEXT        NOT NULL,
  >     -- actor_id: logical FK to iam.users.id (cross-schema); null for system events
  >     actor_id         UUID        NULL,
  >     target_id        UUID        NULL,
  >     target_type      TEXT        NULL,
  >     -- resource_office_id: denormalized owning office for ABAC gate I1 §8.3.
  >     -- Populated by audit write service at write time (not a live join).
  >     -- NULL for resource types with no single owning office (e.g. session events).
  >     -- Decision D-ABAC-04 (I3 §18.1 / I1 §8.3). [CONFLICT 1 → RESOLVED]
  >     resource_office_id UUID      NULL,
  >     payload          JSONB       NOT NULL,
  >     chain_hash       TEXT        NOT NULL
  >                        CHECK (chain_hash ~ '^[a-f0-9]{64}$'),
  >     hmac             TEXT        NOT NULL
  >                        CHECK (hmac ~ '^[a-f0-9]{64}$'),
  >     hmac_key_version INTEGER     NOT NULL DEFAULT 1,
  >     occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  > );
  >
  > CREATE UNIQUE INDEX uq_audit_events_sequence
  >     ON audit.events(sequence_number);
  > CREATE INDEX idx_audit_events_city_occurred
  >     ON audit.events(city_id, occurred_at);
  > CREATE INDEX idx_audit_events_actor
  >     ON audit.events(actor_id);
  > CREATE INDEX idx_audit_events_target
  >     ON audit.events(target_id);
  > -- Partial index: NULL rows (session/system events) excluded;
  > -- office-scoped ABAC reads (I1 §8.3) only query non-null rows.
  > CREATE INDEX idx_audit_events_resource_office
  >     ON audit.events(resource_office_id)
  >     WHERE resource_office_id IS NOT NULL;
  > ```
  >
  > Column notes:
  > - No `deleted_at`/`deleted_by` or `updated_at` columns — audit.events is
  >   append-only; these are omitted by design (C1 §1.5 exceptions list).
  > - No `REFERENCES` clause on actor_id, target_id, or resource_office_id —
  >   these are logical FKs only (cross-schema FK prohibition; Invariant #1
  >   in I3 §16).
  > - `resource_office_id UUID NULL` — denormalized at write time by the audit
  >   write service (TASK-AUDIT-003); value is the owning office UUID of the
  >   target resource at the moment the event occurs, or NULL for resource types
  >   with no single owning office. Used by I1 §8.3 ABAC gate. [D-ABAC-04,
  >   CONFLICT 1 → RESOLVED 2026-06-24]
  > - No RLS policy on this table — access control is enforced entirely at the
  >   PostgreSQL role-grant level (post-migrate-grants.sql from TASK-INFRA-005).
  >
  > ---
  >
  > ## Migration invariants (enforced by TASK-INFRA-007 lint:migrations)
  >
  > The generated migration must satisfy all linter invariants or CI will fail:
  > - Primary key is UUID type: `id UUID NOT NULL PRIMARY KEY`. ✓
  > - All timestamp columns are TIMESTAMPTZ (not TIMESTAMP). ✓ (`occurred_at`)
  > - No REFERENCES clause pointing to another schema. ✓
  > - `city_id UUID NOT NULL` present on the table. ✓
  >
  > ---
  >
  > ## DB role grants (context only — applied by post-migrate-grants.sql)
  >
  > These grants are applied automatically by TASK-INFRA-005's
  > `post-migrate-grants.sql` after every migration run. Do not replicate them
  > inside the migration file itself:
  >
  > - `GRANT USAGE ON SCHEMA audit TO batac_audit;`
  > - `GRANT SELECT, INSERT ON audit.events TO batac_audit;`
  >   (SELECT required by `fetchPreviousChainHash()` and `queryEvents()`;
  >   INSERT is the only write permitted — UPDATE/DELETE revoked)
  > - `REVOKE UPDATE, DELETE ON audit.events FROM batac_audit;`
  > - `GRANT USAGE ON SEQUENCE audit.events_sequence_seq TO batac_audit;`
  >
  > `batac_app` has zero access to the `audit` schema (B2 Prohibited Pattern P3;
  > [CONFLICT 2 → RESOLVED]). All audit reads and writes go through
  > `DATABASE_URL_AUDIT` / `batac_audit` only.
  >
  > ---
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `db:generate` produces a migration containing the sequence, table, all four standard indexes, and the partial index on `resource_office_id`
  > - [ ] `db:migrate` applies cleanly to a fresh local Postgres; second run is idempotent
  > - [ ] `pnpm typecheck` passes
  > - [ ] `lint:migrations` passes (UUID PK, TIMESTAMPTZ, no cross-schema FK)
  > - [ ] The schema file includes `resource_office_id UUID NULL` ([CONFLICT 1 → RESOLVED])
  > A reviewer will verify each one independently.

---

## TASK-AUDIT-002

Phase:          1
Module:         AUDIT
Title:          Implement audit crypto utility: SHA-256 chain hash and HMAC-SHA-256
Prerequisites:  [TASK-AUDIT-001]
Deliverables:
  - /apps/server/src/modules/audit/audit.crypto.ts — exports GENESIS_HASH constant, canonicalizePayload(), computeChainHash(), signHmac(), verifyHmac(); uses Node built-in `node:crypto` exclusively; no third-party dependency
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes for the new file
  - [ ] Unit test: `computeChainHash(GENESIS_HASH, '{}')` returns a 64-character lowercase hex string matching `/^[a-f0-9]{64}$/`
  - [ ] Unit test: `signHmac('payload', 'secret')` returns a 64-character hex string; `verifyHmac('payload', 'secret', storedHmac)` returns `true` for the matching signature and `false` for any modified payload or secret
  - [ ] Unit test: `computeChainHash(hash_n, payload_a)` produces a value that differs from `computeChainHash(hash_n, payload_b)` when `payload_a !== payload_b` — chain hash is payload-sensitive
  - [ ] Unit test: `canonicalizePayload()` with the same fields in different input object key orders produces identical output strings (deterministic serialization)
  - [ ] Manual: reviewer confirms the only `from 'node:crypto'` import; no third-party crypto package in package.json
AI Prompt:
  > Implement the pure-crypto utility module for the audit log at
  > `/apps/server/src/modules/audit/audit.crypto.ts`.
  >
  > This module is the foundation of the audit log's tamper-evidence layer.
  > It uses Node.js built-in `node:crypto` only — no external library is
  > permitted (tech-stack.md §"Audit Log Integrity": "Implementation uses
  > Node built-in `crypto` only — no external library").
  >
  > ---
  >
  > ## Hash chain algorithm (ADR-API-002; tech-stack.md §"Audit Log Integrity")
  >
  > Each audit event record stores:
  >
  >   chain_hash = SHA-256(previous_chain_hash + canonical_payload)
  >
  > where:
  > - `previous_chain_hash` is the `chain_hash` of the immediately preceding
  >   record (by `sequence_number`), fetched from the DB within the same
  >   INSERT transaction.
  > - `canonical_payload` is the deterministic JSON serialization of the
  >   following fields in fixed key order (ADR-API-002): `eventType`, `actorId`,
  >   `targetId`, `targetType`, `payload`, `cityId`, `occurredAt` (ISO 8601).
  > - Concatenation: `previous_chain_hash` (64-char hex string) +
  >   `canonical_payload` (JSON string), concatenated as plain strings before
  >   hashing. No separator character between them.
  >
  > Genesis hash: the first record uses `AUDIT_GENESIS_HASH` from env
  > (defaults to 64 ASCII zeros). This is a known constant, not a secret
  > (ADR-API-002: "a constant defined in the Audit module's source, not
  > derived from any secret").
  >
  > ---
  >
  > ## HMAC signing (ADR-API-002; tech-stack.md §"Audit Log Integrity")
  >
  > Each event payload is additionally signed:
  >
  >   hmac = HMAC-SHA-256(canonical_payload, AUDIT_HMAC_SECRET)
  >
  > - `AUDIT_HMAC_SECRET` is read from `process.env.AUDIT_HMAC_SECRET`.
  >   Never store it in the DB, never log it, never include it in any payload.
  > - The HMAC prevents a DB-level attacker from inserting a record that
  >   passes chain validation without the application key.
  >
  > ---
  >
  > ## Implementation
  >
  > ```typescript
  > // /apps/server/src/modules/audit/audit.crypto.ts
  > import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
  >
  > /** Previous-chain-hash for the very first record in the sequence. */
  > export const GENESIS_HASH: string =
  >   process.env.AUDIT_GENESIS_HASH ?? '0'.repeat(64);
  >
  > export interface CanonicalFields {
  >   eventType:   string;
  >   actorId:     string | null;
  >   targetId?:   string | null;
  >   targetType?: string | null;
  >   payload:     Record<string, unknown>;
  >   cityId:      string;
  >   occurredAt:  string; // ISO 8601
  > }
  >
  > /**
  >  * Serialize audit event fields to a canonical, deterministic JSON string.
  >  * Field order is fixed so the same inputs always produce the same bytes.
  >  */
  > export function canonicalizePayload(fields: CanonicalFields): string {
  >   return JSON.stringify({
  >     eventType:  fields.eventType,
  >     actorId:    fields.actorId    ?? null,
  >     targetId:   fields.targetId   ?? null,
  >     targetType: fields.targetType ?? null,
  >     payload:    fields.payload,
  >     cityId:     fields.cityId,
  >     occurredAt: fields.occurredAt,
  >   });
  > }
  >
  > /**
  >  * Compute SHA-256(previousChainHash + canonicalPayload).
  >  * Returns a 64-character lowercase hex string.
  >  */
  > export function computeChainHash(
  >   previousChainHash: string,
  >   canonicalPayload: string,
  > ): string {
  >   return createHash('sha256')
  >     .update(previousChainHash + canonicalPayload)
  >     .digest('hex');
  > }
  >
  > /**
  >  * Sign canonicalPayload with HMAC-SHA-256 using the provided secret.
  >  * Returns a 64-character lowercase hex string.
  >  */
  > export function signHmac(canonicalPayload: string, secret: string): string {
  >   return createHmac('sha256', secret).update(canonicalPayload).digest('hex');
  > }
  >
  > /**
  >  * Verify a stored HMAC using timingSafeEqual to prevent timing attacks.
  >  * Returns true only if storedHmac matches HMAC-SHA-256(canonicalPayload, secret).
  >  */
  > export function verifyHmac(
  >   canonicalPayload: string,
  >   secret: string,
  >   storedHmac: string,
  > ): boolean {
  >   const expected = signHmac(canonicalPayload, secret);
  >   if (expected.length !== storedHmac.length) return false;
  >   return timingSafeEqual(
  >     Buffer.from(expected, 'hex'),
  >     Buffer.from(storedHmac, 'hex'),
  >   );
  > }
  > ```
  >
  > ---
  >
  > ## Tamper-evidence boundary — must NOT be overstated
  >
  > This module implements tamper-evidence, not tamper-proof protection.
  > Verbatim from ADR-API-002 (must not be paraphrased away in comments):
  > "The audit log is tamper-evident, not tamper-proof. A sufficiently
  > privileged attacker holding both DB write access and the HMAC secret key
  > could insert records that pass validation." Do not claim tamper-proof in
  > any comment, log line, or error message in this file.
  >
  > ---
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `computeChainHash(GENESIS_HASH, '{}')` returns a 64-char lowercase hex string
  > - [ ] `signHmac` and `verifyHmac` round-trip correctly; `verifyHmac` returns `false` for tampered payload or wrong secret
  > - [ ] `canonicalizePayload` output is identical regardless of input key order
  > - [ ] Only `node:crypto` imported; no third-party crypto dependency
  > - [ ] `pnpm typecheck` passes
  > A reviewer will verify each one independently.

---

## TASK-AUDIT-003

Phase:          1
Module:         AUDIT
Title:          Implement audit write service, batac_audit pool, and public module API
Prerequisites:  [TASK-AUDIT-001, TASK-AUDIT-002, TASK-INFRA-005]
Deliverables:
  - /apps/server/src/modules/audit/audit.repository.ts — AuditRepository using the auditDb Drizzle instance (DATABASE_URL_AUDIT / batac_audit role); exposes fetchPreviousChainHash() and insertEvent() for use within a single transaction
  - /apps/server/src/modules/audit/audit.write-service.ts — AuditWriteService.writeEvent(input: AuditEventInput): Promise<void>; atomically fetches previous chain hash, computes chain_hash and hmac, INSERTs in one DB transaction
  - /apps/server/src/modules/audit/index.ts — public module API: exports createAuditModule(), AuditPublicAPI interface, and shared types AuditEventInput / AuditQueryFilter / AuditQueryResult
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Integration test: `writeEvent({ eventType: 'login_success', actorId: '<uuid>', resourceOfficeId: null, payload: {}, cityId: '<uuid>' })` inserts one row into `audit.events` with non-null `chain_hash` and `hmac` both matching `/^[a-f0-9]{64}$/`, and `resource_office_id` IS NULL
  - [ ] Integration test: `writeEvent({ ..., resourceOfficeId: '<office-uuid>' })` inserts a row with `resource_office_id` equal to the supplied UUID ([CONFLICT 1 → RESOLVED])
  - [ ] Integration test: two sequential `writeEvent()` calls produce two rows where `row2.chain_hash === computeChainHash(row1.chain_hash, canonicalizePayload({ ..., occurredAt: row2.occurredAt.toISOString() }))`
  - [ ] Integration test: if the INSERT is rolled back (forced constraint violation), no partial row persists and the sequence_number is not consumed in the chain
  - [ ] Manual: reviewer confirms `audit.repository.ts` opens its Drizzle client with `DATABASE_URL_AUDIT`, never `DATABASE_URL_APP`
  - [ ] Manual: reviewer confirms `index.ts` exports exactly the `AuditPublicAPI` interface from B2 Module 8 (writeEvent + queryEvents); no extra or missing methods
AI Prompt:
  > Implement the audit write path: the DB repository (batac_audit role),
  > the write service (atomic chain-hash + HMAC + INSERT), and the public
  > module API at `/apps/server/src/modules/audit/index.ts`.
  >
  > ---
  >
  > ## Security constraint: use DATABASE_URL_AUDIT (batac_audit role)
  >
  > The audit write service MUST use `DATABASE_URL_AUDIT` — the connection
  > string for the `batac_audit` DB role. Never use `DATABASE_URL_APP` for
  > audit writes. Reason: `batac_audit` has INSERT on `audit.events` with
  > UPDATE/DELETE explicitly revoked (Invariant #3, I3 §16). `batac_app`
  > does not have SELECT on `audit.events`, which is required to fetch the
  > previous `chain_hash` within the write transaction.
  >
  > Initialize a dedicated Drizzle pool at server startup:
  >
  > ```typescript
  > import postgres from 'postgres';
  > import { drizzle } from 'drizzle-orm/postgres-js';
  > import * as auditSchema from '@batac/database/schema/audit.schema';
  >
  > export function createAuditDb(databaseUrlAudit: string) {
  >   const pg = postgres(databaseUrlAudit, {
  >     max: 2,           // audit writes are serial per sequence_number
  >     idle_timeout: 30,
  >   });
  >   return drizzle(pg, { schema: auditSchema });
  > }
  > ```
  >
  > Pass this `auditDb` instance into AuditRepository and AuditQueryService
  > (TASK-AUDIT-005). Do not share it with the main application Drizzle instance.
  >
  > ---
  >
  > ## AuditEventInput interface (B2 Module 8)
  >
  > ```typescript
  > export interface AuditEventInput {
  >   eventType:         string;
  >   actorId:           string | null;   // null for system-generated events
  >   targetId?:         string | null;
  >   targetType?:       string | null;   // e.g. 'document', 'user', 'delegation'
  >   /** Denormalized owning-office UUID for ABAC gate I1 §8.3 (D-ABAC-04).
  >    *  Supply the owning office UUID of the target resource at the time
  >    *  of the event; pass null for session events, system events, or any
  >    *  resource type with no single owning office. [CONFLICT 1 → RESOLVED] */
  >   resourceOfficeId?: string | null;
  >   payload:           Record<string, unknown>;
  >   cityId:            string;
  > }
  > ```
  >
  > ---
  >
  > ## AuditRepository (audit.repository.ts)
  >
  > ```typescript
  > import { desc, sql } from 'drizzle-orm';
  > import { auditEvents } from '@batac/database/schema/audit.schema';
  > import { GENESIS_HASH } from './audit.crypto';
  >
  > export class AuditRepository {
  >   constructor(private readonly db: ReturnType<typeof createAuditDb>) {}
  >
  >   /** Fetch chain_hash of the row with the highest sequence_number.
  >    *  Returns GENESIS_HASH if no rows exist yet.
  >    *  Must be called within the same transaction as insertEvent(). */
  >   async fetchPreviousChainHash(
  >     tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
  >   ): Promise<string> {
  >     const result = await tx
  >       .select({ chainHash: auditEvents.chainHash })
  >       .from(auditEvents)
  >       .orderBy(desc(auditEvents.sequenceNumber))
  >       .limit(1)
  >       .for('update');               // row-level lock on the latest row
  >     return result[0]?.chainHash ?? GENESIS_HASH;
  >   }
  >
  >   async insertEvent(
  >     tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
  >     row: {
  >       id: string; cityId: string; eventType: string;
  >       actorId: string | null; targetId: string | null; targetType: string | null;
  >       resourceOfficeId: string | null;
  >       payload: Record<string, unknown>; chainHash: string;
  >       hmac: string; hmacKeyVersion: number; occurredAt: Date;
  >     },
  >   ): Promise<void> {
  >     await tx.insert(auditEvents).values(row);
  >   }
  > }
  > ```
  >
  > The `FOR UPDATE` lock on `fetchPreviousChainHash` serializes concurrent writes
  > so that two simultaneous `writeEvent()` calls do not produce the same
  > `sequence_number` or compute chain hashes against the same previous row.
  >
  > ---
  >
  > ## AuditWriteService.writeEvent() — atomic transaction flow
  >
  > The following steps execute inside a single `auditDb.transaction()` call
  > (ADR-API-002: "Chain hash computation and the INSERT into `audit.events`
  > occur within the same database transaction"):
  >
  > ```
  > auditDb.transaction(async (tx) => {
  >   1. id         = crypto.randomUUID()
  >   2. occurredAt = new Date()
  >   3. canonical  = canonicalizePayload({ ...input, occurredAt: occurredAt.toISOString() })
  >   4. prevHash   = await repo.fetchPreviousChainHash(tx)   // FOR UPDATE
  >   5. chainHash  = computeChainHash(prevHash, canonical)
  >   6. hmac       = signHmac(canonical, env.AUDIT_HMAC_SECRET)
  >   7. await repo.insertEvent(tx, {
  >        id, cityId: input.cityId, eventType: input.eventType,
  >        actorId: input.actorId ?? null,
  >        targetId: input.targetId ?? null,
  >        targetType: input.targetType ?? null,
  >        resourceOfficeId: input.resourceOfficeId ?? null,   // D-ABAC-04 [CONFLICT 1 → RESOLVED]
  >        payload: input.payload, chainHash, hmac,
  >        hmacKeyVersion: CURRENT_KEY_VERSION,   // module-level constant = 1 initially
  >        occurredAt,
  >      })
  > })
  > ```
  >
  > `CURRENT_KEY_VERSION` is a module-level constant initialized to `1`. It is
  > updated during HMAC key rotation (deferred to Phase 2 operational procedure
  > per ADR-API-002) — do not implement rotation logic in this task.
  >
  > ---
  >
  > ## Public module API (B2 Module 8 — reproduce exactly)
  >
  > `/apps/server/src/modules/audit/index.ts`:
  >
  > ```typescript
  > export interface AuditPublicAPI {
  >   /**
  >    * Write an audit event synchronously.
  >    * Use ONLY when the audit entry must be atomic with the calling operation
  >    * and a domain event on the bus would not provide that guarantee.
  >    * Confirmed callers (B2 Module 8):
  >    *   - Records.bulkOpHandler  (one call per item in a bulk operation)
  >    *   - Records.dispositionSvc (one call per disposition action)
  >    * Any additional direct caller must be documented in B2 Module 8 before merging.
  >    * All other modules reach the audit log via the event bus (TASK-AUDIT-004).
  >    */
  >   writeEvent(event: AuditEventInput): Promise<void>;
  >
  >   /**
  >    * Query audit events with on-read chain validation.
  >    * Returns events with chainValidationStatus 'intact' | 'broken'.
  >    * 'broken' is a tamper indicator; surface it to the caller.
  >    * Implemented by TASK-AUDIT-005.
  >    */
  >   queryEvents(filter: AuditQueryFilter): Promise<AuditQueryResult>;
  > }
  >
  > export function createAuditModule(deps: {
  >   auditDb: ReturnType<typeof createAuditDb>;
  >   env: { AUDIT_HMAC_SECRET: string; AUDIT_CHAIN_VERIFY_ON_READ: boolean };
  > }): AuditPublicAPI {
  >   const repo         = new AuditRepository(deps.auditDb);
  >   const writeService = new AuditWriteService(repo, deps.env);
  >   return {
  >     writeEvent:  (e) => writeService.writeEvent(e),
  >     queryEvents: async () => { throw new Error('Not implemented — see TASK-AUDIT-005'); },
  >   };
  > }
  >
  > export type { AuditEventInput, AuditQueryFilter, AuditQueryResult };
  > ```
  >
  > TASK-AUDIT-005 replaces the `queryEvents` stub with the real implementation.
  >
  > ---
  >
  > ## Security Invariant #3 (I3 §16)
  >
  > "Audit Log INSERT-Only at DB Role Level — The audit log's evidentiary value
  > depends on its inviolability." The `AuditWriteService` must never call
  > UPDATE or DELETE on `audit.events`. The `batac_audit` role cannot do so
  > even if attempted — PostgreSQL rejects it.
  >
  > ---
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `writeEvent()` inserts a row with valid `chain_hash` and `hmac` (both 64-char hex)
  > - [ ] Two sequential calls produce a correctly linked chain (row2.chain_hash is derived from row1.chain_hash)
  > - [ ] `audit.repository.ts` uses `DATABASE_URL_AUDIT`, never `DATABASE_URL_APP`
  > - [ ] `index.ts` exports match `AuditPublicAPI` exactly (writeEvent + queryEvents)
  > - [ ] `pnpm typecheck` passes
  > A reviewer will verify each one independently.

---

## TASK-AUDIT-004

Phase:          1
Module:         AUDIT
Title:          [AUDIT] Register audit domain event bus consumer for all events
Prerequisites:  [TASK-AUDIT-003, TASK-INFRA-001, TASK-INFRA-023]
Deliverables:
  - /apps/server/src/modules/audit/audit.event-consumer.ts — registerAuditEventConsumer(bus, writeService) subscribes one typed handler per event type on the shared EventBus; converts each DomainEvent envelope to AuditEventInput and calls AuditWriteService.writeEvent()
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes — every `bus.on(...)` call uses a typed key from `EventPayloadMap`; no string cast on event types
  - [ ] Integration test: emitting a `user.login` event on the EventBus causes one row to appear in `audit.events` with `event_type = 'user.login'`
  - [ ] Integration test: spot-check 3 event types from different source modules (e.g. `document.created`, `delegation.granted`, `workflow.step_completed`) each produce a corresponding row in `audit.events`
  - [ ] Integration test: a handler that throws does not prevent the emitting module's call from completing (subscriber isolation per ADR-API-001)
  - [ ] Manual: reviewer confirms a handler exists for all 18 event types listed in the AI Prompt's Events Consumed table
AI Prompt:
  > Implement the audit domain event consumer at
  > `/apps/server/src/modules/audit/audit.event-consumer.ts`.
  >
  > The audit event consumer is the Audit module's primary write path: it
  > subscribes to every domain event on the shared in-process EventBus and
  > writes each event to the audit log via `AuditWriteService.writeEvent()`.
  >
  > ---
  >
  > ## EventBus infrastructure dependency
  >
  > This task depends on the shared EventBus class and `EventPayloadMap` type
  > map (ADR-API-001). These are delivered by `TASK-INFRA-023` and live at:
  > - `/packages/shared/src/event-bus.ts` — typed wrapper around Node EventEmitter
  > - `/packages/shared/src/events/event-payload-map.ts` — `EventPayloadMap` type
  >
  > TASK-INFRA-023 must be merged before this task can be started.
  > The EventBus is a single instance passed to all modules at Fastify server
  > startup. [SPEC GAP → RESOLVED; was tentative TASK-INFRA-022 in earlier
  > drafts — renumbered TASK-INFRA-023 per infra.md Module Summary 2026-06-24.]
  >
  > ---
  >
  > ## All confirmed event subscriptions (B2 Module 8 — Events Consumed table)
  >
  > Register a handler for every one of these 18 event types:
  >
  > | eventType                           | Source module | Notes                                                                              |
  > |-------------------------------------|---------------|------------------------------------------------------------------------------------|
  > | user.login                          | IAM           |                                                                                    |
  > | user.logout                         | IAM           |                                                                                    |
  > | session.terminated                  | IAM           | Includes forced logout by IT Admin                                                 |
  > | role.assigned                       | IAM           |                                                                                    |
  > | role.revoked                        | IAM           |                                                                                    |
  > | delegation.granted                  | Organization  |                                                                                    |
  > | delegation.expired                  | Organization  |                                                                                    |
  > | delegation.revoked                  | Organization  |                                                                                    |
  > | document.created                    | Documents     |                                                                                    |
  > | document.state_changed              | Documents     |                                                                                    |
  > | document.number_assigned            | Documents     | Both preliminary and final number assignment events                                |
  > | workflow.step_assigned              | Workflow      |                                                                                    |
  > | workflow.step_completed             | Workflow      | Also carries Approve/Reject/Amended for Secretariat decisions (ADR-B2-3); no separate document.secretariat_decision event exists |
  > | workflow.lapsed                     | Workflow      |                                                                                    |
  > | workflow.escalated                  | Workflow      |                                                                                    |
  > | workflow.certified_urgent_applied   | Workflow      |                                                                                    |
  > | workflow.manually_advanced          | Workflow      |                                                                                    |
  > | workflow.completed                  | Workflow      |                                                                                    |
  >
  > Rule (B2 Module 8, enforced by ADR-API-001): Any new domain event added to
  > the event bus MUST be registered with the Audit Event Consumer in the same PR
  > that introduces the event. No event type may ship without an Audit subscription.
  > The `EventPayloadMap` in `/packages/shared` is the compile-time enforcement.
  >
  > ---
  >
  > ## Handler pattern
  >
  > ```typescript
  > import type { EventBus, DomainEvent } from '@batac/shared/event-bus';
  > import type { AuditWriteService }     from './audit.write-service';
  > import type { Logger }                from 'pino';
  >
  > export function registerAuditEventConsumer(
  >   bus: EventBus,
  >   writeService: AuditWriteService,
  >   logger: Logger,
  > ): void {
  >
  >   function makeHandler<K extends keyof EventPayloadMap>(
  >     eventType: K,
  >     toInput: (envelope: DomainEvent<EventPayloadMap[K]>) => AuditEventInput,
  >   ) {
  >     bus.on(eventType, async (envelope) => {
  >       try {
  >         await writeService.writeEvent(toInput(envelope));
  >       } catch (err) {
  >         logger.error({ err, envelope, eventType },
  >           '[audit] Failed to write audit event — routing to dead-letter');
  >         throw err; // re-throw so EventBus dead-letter routing fires
  >       }
  >     });
  >   }
  >
  >   makeHandler('user.login', (e) => ({
  >     eventType:        'user.login',
  >     actorId:          e.payload.userId ?? null,
  >     targetId:         e.payload.userId ?? null,
  >     targetType:       'user',
  >     resourceOfficeId: null,  // session events have no owning office (D-ABAC-04)
  >     payload:          e.payload,
  >     cityId:           e.cityId,
  >   }));
  >
  >   // Repeat makeHandler() for all 17 remaining event types above.
  >   // actorId is the UUID of the user who performed the action, drawn from
  >   // envelope.payload (each event type's payload carries the relevant actor ID).
  >   // For system-generated events (delegation.expired, workflow.lapsed),
  >   // set actorId: null.
  >   //
  >   // resourceOfficeId (D-ABAC-04, [CONFLICT 1 → RESOLVED]):
  >   // - document.* and workflow.* events: supply the owning office UUID of
  >   //   the document from envelope.payload (e.g. e.payload.officeId).
  >   // - role.assigned / role.revoked: supply the office UUID the role is
  >   //   scoped to, if the role is office-scoped; null otherwise.
  >   // - delegation.* events: null (cross-office grants have no single owner).
  >   // - session events (user.login, user.logout, session.terminated): null.
  > }
  > ```
  >
  > Call `registerAuditEventConsumer(bus, auditWriteService, logger)` from the
  > Fastify server's plugin registration sequence, before any domain module
  > that emits events is initialized.
  >
  > ---
  >
  > ## Subscriber isolation (ADR-API-001)
  >
  > The EventBus wrapper catches and logs errors per handler. A failure in the
  > Audit handler is treated as a priority alert (Sentry-reported per ADR-API-001)
  > because it represents a potential silent gap in the tamper-evident log.
  > Re-throw after logging so EventBus infrastructure routes to the dead-letter
  > table. The emitting module's call always completes regardless of subscriber
  > outcome — this is enforced by the EventBus wrapper, not by this handler.
  >
  > ---
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes; all `bus.on()` calls use typed keys from `EventPayloadMap`
  > - [ ] `user.login` event produces one `audit.events` row in integration test
  > - [ ] Handlers exist for all 18 event types in the table above (manual reviewer check)
  > A reviewer will verify each one independently.

---

## TASK-AUDIT-005

Phase:          1
Module:         AUDIT
Title:          Implement audit query service with on-read chain validation
Prerequisites:  [TASK-AUDIT-002, TASK-AUDIT-003]
Deliverables:
  - /apps/server/src/modules/audit/audit.query-service.ts — AuditQueryService.queryEvents(filter: AuditQueryFilter): Promise<AuditQueryResult>; fetches events in sequence_number ascending order; recomputes chain_hash and verifies HMAC per record; returns chainValidationStatus 'intact' | 'broken'
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Integration test: after inserting three correctly linked audit events, `queryEvents({})` returns `chainValidationStatus: 'intact'` and all three events
  - [ ] Integration test: after directly SQL-updating one row's `chain_hash` in the test DB (simulating tampering), `queryEvents({})` returns `chainValidationStatus: 'broken'`
  - [ ] Integration test: after directly SQL-updating one row's `hmac`, `queryEvents({})` returns `chainValidationStatus: 'broken'`
  - [ ] Integration test: `queryEvents({ actorId: '<uuid>' })` returns only rows where `actor_id = '<uuid>'`
  - [ ] Integration test: `queryEvents({ pageSize: 2 })` returns 2 events and a non-null `nextCursor`; calling with that cursor returns remaining events and no further `nextCursor`
  - [ ] Manual: with `env.AUDIT_CHAIN_VERIFY_ON_READ = false`, `queryEvents` returns `chainValidationStatus: 'intact'` unconditionally and emits a `warn`-level log at startup
AI Prompt:
  > Implement the audit query service at
  > `/apps/server/src/modules/audit/audit.query-service.ts`.
  >
  > The query service reads audit events and performs on-read chain validation
  > to detect tampering (I3 §9.4). It implements the `queryEvents()` method
  > of `AuditPublicAPI` and replaces the stub from TASK-AUDIT-003.
  >
  > ---
  >
  > ## Input / output types (B2 Module 8)
  >
  > ```typescript
  > export interface AuditQueryFilter {
  >   actorId?:    string;
  >   targetId?:   string;
  >   eventTypes?: string[];
  >   from?:       Date;
  >   to?:         Date;
  >   pageSize?:   number;   // default 50; max 200
  >   cursor?:     string;   // opaque cursor = base64(String(sequence_number))
  > }
  >
  > export interface AuditEvent {
  >   auditEventId: string;
  >   eventType:    string;
  >   actorId:      string | null;
  >   targetId:     string | null;
  >   targetType:   string | null;
  >   payload:      Record<string, unknown>;
  >   cityId:       string;
  >   occurredAt:   Date;
  >   chainHash:    string;
  >   hmac:         string;
  > }
  >
  > export interface AuditQueryResult {
  >   events:                AuditEvent[];
  >   chainValidationStatus: 'intact' | 'broken';
  >   nextCursor?:           string;
  > }
  > ```
  >
  > ---
  >
  > ## DB access
  >
  > Use the same `auditDb` Drizzle instance (batac_audit role connection) as
  > AuditWriteService. The batac_audit role has SELECT on `audit.events` via
  > post-migrate-grants.sql from TASK-INFRA-005.
  >
  > ---
  >
  > ## Pagination (cursor-based on sequence_number)
  >
  > - Encode cursor: `Buffer.from(String(sequence_number)).toString('base64')`
  > - Decode cursor: `Number(Buffer.from(cursor, 'base64').toString('ascii'))`
  > - Filter: `WHERE sequence_number > :decodedCursor` for forward pagination
  > - Fetch `pageSize + 1` rows; if `rows.length > pageSize`, a next page exists:
  >   slice to `pageSize` and set `nextCursor` to the last row's encoded sequence_number
  >
  > ---
  >
  > ## Chain validation algorithm (I3 §9.4 — four steps)
  >
  > Perform validation after fetching rows in `sequence_number` ascending order:
  >
  > 1. For each row, re-serialize the canonical payload:
  >    `canonical = canonicalizePayload({ eventType, actorId, targetId, targetType, payload, cityId, occurredAt: row.occurredAt.toISOString() })`
  >
  > 2. Verify HMAC: `verifyHmac(canonical, env.AUDIT_HMAC_SECRET, row.hmac)`.
  >    If false → `chainValidationStatus = 'broken'`. Continue to next row.
  >
  > 3. Determine the expected previous chain hash:
  >    - For the first row in the batch: fetch the `chain_hash` of the row
  >      immediately before this batch (sequence_number just below the batch start),
  >      using a separate SELECT. If no such row exists, use `GENESIS_HASH`.
  >    - For subsequent rows: use the previous row's `chain_hash` from the batch.
  >
  > 4. Recompute: `expected = computeChainHash(prevHash, canonical)`.
  >    If `expected !== row.chainHash` → `chainValidationStatus = 'broken'`.
  >
  > Set `chainValidationStatus = 'intact'` only if every row passes both checks.
  >
  > ---
  >
  > ## Performance gate (AUDIT_CHAIN_VERIFY_ON_READ env flag)
  >
  > If `env.AUDIT_CHAIN_VERIFY_ON_READ === false`, skip steps 1–4 and return
  > `chainValidationStatus: 'intact'` unconditionally. Log a `warn`-level message
  > at server startup if this flag is false in production. This flag exists for
  > emergency use only.
  >
  > ---
  >
  > ## Wire into public module API
  >
  > Update `createAuditModule()` in `index.ts` to replace the stub:
  >
  > ```typescript
  > const queryService = new AuditQueryService(repo, deps.env);
  > return {
  >   writeEvent:  (e) => writeService.writeEvent(e),
  >   queryEvents: (f) => queryService.queryEvents(f),
  > };
  > ```
  >
  > ---
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `queryEvents({})` on 3 correctly linked events returns `chainValidationStatus: 'intact'`
  > - [ ] Tampering with a stored `chain_hash` returns `chainValidationStatus: 'broken'`
  > - [ ] Tampering with a stored `hmac` returns `chainValidationStatus: 'broken'`
  > - [ ] Cursor pagination returns correct pages and `nextCursor`
  > - [ ] `AUDIT_CHAIN_VERIFY_ON_READ=false` returns `'intact'` unconditionally and logs a warning
  > - [ ] `pnpm typecheck` passes
  > A reviewer will verify each one independently.

---

## TASK-AUDIT-006

Phase:          1
Module:         AUDIT
Title:          [ABAC] Implement audit tRPC router for sys_admin and auditor roles
Prerequisites:  [TASK-AUDIT-005, CROSS-MODULE REF: IAM — task list not yet supplied]
Deliverables:
  - /apps/server/src/modules/audit/audit.router.ts — tRPC router exposing audit.queryEvents procedure; restricted to sys_admin and auditor roles via session-context role check; passes validated input to AuditQueryService.queryEvents()
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Integration test: `audit.queryEvents` called with a valid `sys_admin` session context returns AuditQueryResult with events and chainValidationStatus
  - [ ] Integration test: `audit.queryEvents` called with a valid `auditor` session context returns AuditQueryResult
  - [ ] Integration test: `audit.queryEvents` called with any other role (e.g. `sp_secretary`) returns tRPC error code `FORBIDDEN`
  - [ ] Integration test: `audit.queryEvents` called with no session token returns tRPC error code `UNAUTHORIZED`
  - [ ] Manual: reviewer confirms role check reads `ctx.session.roles` (populated by IAM session middleware) and performs no additional DB query for role data
AI Prompt:
  > Implement the audit tRPC router at
  > `/apps/server/src/modules/audit/audit.router.ts`.
  >
  > This router exposes the `audit.queryEvents` tRPC procedure. Access is
  > restricted to `sys_admin` and `auditor` roles only, implementing Security
  > Objective SO-02 (tamper-evident audit trails for compliance) from I3.
  >
  > ---
  >
  > ## Role restriction (I3 §9.4; I3 §4.3)
  >
  > I3 §9.4: chain validation is "available to `sys_admin` and `auditor` roles."
  > Role codes (I3 §4.3):
  > - `sys_admin`  — System Administrator; full platform administrative access
  > - `auditor`    — City Auditor; can read audit events and validate the chain
  >
  > No other role may call this procedure.
  >
  > ---
  >
  > ## Procedure definition
  >
  > ```typescript
  > // /apps/server/src/modules/audit/audit.router.ts
  > import { z }           from 'zod';
  > import { router, protectedProcedure } from '@batac/trpc';
  > import { TRPCError }   from '@trpc/server';
  > import type { AuditPublicAPI } from './index';
  >
  > const AuditQueryFilterInput = z.object({
  >   actorId:    z.string().uuid().optional(),
  >   targetId:   z.string().uuid().optional(),
  >   eventTypes: z.array(z.string()).optional(),
  >   from:       z.coerce.date().optional(),
  >   to:         z.coerce.date().optional(),
  >   pageSize:   z.number().int().min(1).max(200).default(50),
  >   cursor:     z.string().optional(),
  > });
  >
  > const ALLOWED_ROLES = ['sys_admin', 'auditor'] as const;
  >
  > export function createAuditRouter(audit: AuditPublicAPI) {
  >   return router({
  >     queryEvents: protectedProcedure
  >       .input(AuditQueryFilterInput)
  >       .query(async ({ input, ctx }) => {
  >         const hasRole = ctx.session.roles.some(
  >           (r: string) => (ALLOWED_ROLES as readonly string[]).includes(r),
  >         );
  >         if (!hasRole) {
  >           throw new TRPCError({
  >             code:    'FORBIDDEN',
  >             message: 'audit.queryEvents requires sys_admin or auditor role',
  >           });
  >         }
  >         return audit.queryEvents(input);
  >       }),
  >   });
  > }
  > ```
  >
  > `ctx.session.roles` is an array of role code strings populated by the IAM
  > module's Fastify session middleware upstream of all `protectedProcedure`
  > calls. If the IAM session middleware does not yet exist when this task runs,
  > add `[CROSS-MODULE REF: IAM session middleware]` as a PR comment and leave
  > a TODO in the role-check line — do not bypass the role check.
  >
  > ---
  >
  > ## ABAC note (for future IAM module alignment)
  >
  > The role check above is a simplified guard. Once the IAM ABAC engine
  > (TASK-IAM-*) is complete, the role check should be updated to call the
  > ABAC policy evaluator for action `audit_event:validate_chain` (I3 §9.4)
  > rather than hard-coding role names here. The tRPC procedure signature
  > and output type do not change; only the authorization check inside the
  > procedure body is updated in that follow-on task.
  >
  > ---
  >
  > ## Mount on root router
  >
  > ```typescript
  > // /apps/server/src/router.ts (root tRPC router)
  > import { createAuditRouter } from './modules/audit/audit.router';
  > export const appRouter = router({
  >   audit: createAuditRouter(auditModule),
  >   // ... other module routers
  > });
  > ```
  >
  > ---
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `audit.queryEvents` returns AuditQueryResult for `sys_admin` sessions
  > - [ ] `audit.queryEvents` returns AuditQueryResult for `auditor` sessions
  > - [ ] Any other role receives `FORBIDDEN`; no session receives `UNAUTHORIZED`
  > - [ ] Role check reads `ctx.session.roles`, no extra DB query
  > - [ ] `pnpm typecheck` passes
  > A reviewer will verify each one independently.

---

## TASK-AUDIT-007

Phase:          1
Module:         AUDIT
Title:          Implement monthly RFC 3161 TSA export scheduled job and provider interface
Prerequisites:  [TASK-AUDIT-003, TASK-INFRA-004]
Deliverables:
  - /apps/server/src/modules/audit/tsa.interface.ts — RfcTsaClient interface (RFC 3161-compliant; provider-swappable; transmits only SHA-256 digest, never raw data)
  - /apps/server/src/modules/audit/tsa.stub.ts — StubTsaClient: no-op implementation used when AUDIT_TSA_ENABLED=false; logs the snapshot digest
  - /apps/server/src/modules/audit/audit.tsa-export.ts — registerTsaExportJob(): registers a pgboss monthly scheduled job (cron 0 0 1 * *) that compiles a snapshot, hashes it, submits to RfcTsaClient, and writes an audit_log_exported event via AuditWriteService
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Integration test: with `AUDIT_TSA_ENABLED=false`, the pgboss job fires, logs the snapshot SHA-256 digest, inserts one `audit_log_exported` row in `audit.events`, and exits without error or network call
  - [ ] The `audit_log_exported` row's `payload.snapshotDigest` is a 64-char hex string matching the SHA-256 of the compiled snapshot
  - [ ] The pgboss job is registered with name `audit:monthly-tsa-export` and cron `0 0 1 * *`
  - [ ] Manual: reviewer confirms no raw event payload data is included in the TSA submission — only `digest: Buffer` (32 bytes) is passed to `tsaClient.timestamp(digest)` 
  - [ ] Manual: reviewer confirms no TSA provider URL or SDK is hardcoded — D-AUTH-08 (provider TBD) must remain an open item
AI Prompt:
  > Implement the monthly TSA export job for the audit log at
  > `/apps/server/src/modules/audit/audit.tsa-export.ts`.
  >
  > This job extends the audit log's tamper-evidence guarantee to cover bulk
  > deletion of recent records (ADR-API-002; tech-stack.md §"Audit Log Integrity";
  > I3 §9.2). Monthly external anchoring means a deletion between two anchor
  > points is detectable by comparing the chain against the TSA timestamp.
  >
  > ---
  >
  > ## D-AUTH-08 is entirely unresolved (I3 §18.2)
  >
  > The RFC 3161 TSA provider has not been selected. This is a
  > vendor/procurement decision requiring research outside the development team's
  > scope. Build against the RfcTsaClient interface so any compliant provider
  > can be substituted without code changes. The stub is the correct Phase 1
  > default. DO NOT hardcode any TSA provider URL, SDK, or library.
  >
  > ---
  >
  > ## TSA provider selection criteria (ADR-API-002 — fixed by this decision record)
  >
  > When a provider is eventually selected, it must meet all three criteria:
  > 1. RFC 3161-compliant timestamp tokens.
  > 2. Digest-only submission — raw audit payload data and citizen PII must
  >    never leave the LGU server (RA 10173 data-sovereignty requirement).
  > 3. Independent verifiability — the LGU must not depend solely on the
  >    provider's own verification API.
  >
  > ---
  >
  > ## RfcTsaClient interface (tsa.interface.ts)
  >
  > ```typescript
  > export interface TsaTimestampToken {
  >   token:        Buffer;   // Raw DER-encoded RFC 3161 timestamp token
  >   serialNumber: string;   // Token serial number for verification records
  >   tsaUrl:       string;   // TSA URL used
  > }
  >
  > export interface RfcTsaClient {
  >   /**
  >    * Submit a SHA-256 digest to the TSA and receive a timestamp token.
  >    * MUST transmit only the digest — never the raw snapshot payload.
  >    * @param digest 32-byte SHA-256 digest of the monthly audit snapshot
  >    */
  >   timestamp(digest: Buffer): Promise<TsaTimestampToken>;
  > }
  > ```
  >
  > ---
  >
  > ## StubTsaClient (tsa.stub.ts)
  >
  > ```typescript
  > import type { RfcTsaClient, TsaTimestampToken } from './tsa.interface';
  >
  > /** No-op TSA client used when AUDIT_TSA_ENABLED=false or D-AUTH-08 unresolved. */
  > export class StubTsaClient implements RfcTsaClient {
  >   async timestamp(digest: Buffer): Promise<TsaTimestampToken> {
  >     console.warn(
  >       '[audit:tsa] TSA submission skipped (AUDIT_TSA_ENABLED=false / D-AUTH-08 open). ' +
  >       'Snapshot digest (hex):', digest.toString('hex'),
  >     );
  >     return {
  >       token:        Buffer.alloc(0),
  >       serialNumber: 'STUB-' + Date.now(),
  >       tsaUrl:       'stub://disabled',
  >     };
  >   }
  > }
  > ```
  >
  > ---
  >
  > ## Monthly export job (audit.tsa-export.ts)
  >
  > ```typescript
  > import { createHash } from 'node:crypto';
  > import type PgBoss            from 'pg-boss';
  > import type { AuditWriteService } from './audit.write-service';
  > import type { AuditRepository }   from './audit.repository';
  > import { StubTsaClient }          from './tsa.stub';
  > import type { RfcTsaClient }      from './tsa.interface';
  >
  > export const TSA_JOB_NAME = 'audit:monthly-tsa-export';
  > export const TSA_CRON     = '0 0 1 * *'; // first of each month, midnight UTC
  >
  > export async function registerTsaExportJob(deps: {
  >   boss:         PgBoss;
  >   repo:         AuditRepository;
  >   writeService: AuditWriteService;
  >   env: {
  >     AUDIT_TSA_ENABLED:  boolean;
  >     AUDIT_TSA_URL?:     string;
  >     AUDIT_EXPORT_ENABLED: boolean;
  >     CITY_ID:            string;
  >   };
  > }): Promise<void> {
  >   const { boss, repo, writeService, env } = deps;
  >
  >   // Provider selection: stub until D-AUTH-08 is resolved.
  >   // Replace StubTsaClient with real client when provider is confirmed.
  >   const tsaClient: RfcTsaClient = new StubTsaClient();
  >
  >   await boss.schedule(TSA_JOB_NAME, TSA_CRON, {}, { tz: 'UTC' });
  >
  >   await boss.work<void>(TSA_JOB_NAME, async () => {
  >     // 1. Compile the monthly snapshot.
  >     //    compileMonthlySnapshot() fetches all audit.events rows from the
  >     //    previous calendar month (or all rows if no prior export event exists),
  >     //    serialized as newline-delimited JSON in sequence_number ASC order.
  >     //    Output must be deterministic: same rows → same bytes.
  >     const snapshotJson = await repo.compileMonthlySnapshot();
  >
  >     // 2. Hash the snapshot. Only the digest is transmitted externally.
  >     const digest = createHash('sha256').update(snapshotJson).digest();
  >
  >     // 3. Submit to TSA (stub no-ops when AUDIT_TSA_ENABLED=false).
  >     const token = await tsaClient.timestamp(digest);
  >
  >     // 4. Record the export as an audit event so it becomes part of the
  >     //    tamper-evident chain (ADR-API-002: "The export itself is recorded
  >     //    as an audit event, so the act of exporting becomes part of the
  >     //    chain it is meant to protect").
  >     await writeService.writeEvent({
  >       eventType:  'audit_log_exported',
  >       actorId:    null,   // system event
  >       targetType: 'audit_snapshot',
  >       payload: {
  >         snapshotDigest:  digest.toString('hex'),
  >         tsaSerialNumber: token.serialNumber,
  >         tsaUrl:          token.tsaUrl,
  >         exportedAt:      new Date().toISOString(),
  >       },
  >       cityId: env.CITY_ID,
  >     });
  >   });
  > }
  > ```
  >
  > Implement `repo.compileMonthlySnapshot()` in `AuditRepository`: fetches all
  > `audit.events` rows from the previous calendar month (WHERE occurred_at
  > BETWEEN first_of_prev_month AND last_of_prev_month), serialized as a
  > newline-delimited JSON array in sequence_number ASC order. If no prior
  > `audit_log_exported` event exists, fetch all rows from the beginning.
  >
  > ---
  >
  > ## Startup registration
  >
  > Call `registerTsaExportJob({ boss, repo, writeService, env })` after the
  > pgboss instance is started at Fastify server startup. pgboss uses
  > `DATABASE_URL_APP` (pgboss owns its own schema; `batac_app` has full access
  > to the `pgboss` schema per TASK-INFRA-005).
  >
  > ---
  >
  > Before submitting this PR, confirm each item:
  > - [ ] With `AUDIT_TSA_ENABLED=false`: job runs, logs digest, writes `audit_log_exported` row, no network call
  > - [ ] pgboss job registered with name `audit:monthly-tsa-export` and cron `0 0 1 * *`
  > - [ ] `audit_log_exported` row appears in `audit.events` after job execution
  > - [ ] No raw audit payload data is transmitted — only `Buffer` (32 bytes) to `tsaClient.timestamp()`
  > - [ ] No TSA provider URL or SDK is hardcoded
  > - [ ] `pnpm typecheck` passes
  > A reviewer will verify each one independently.

---

## Module Summary — AUDIT

**Total tasks:** 7 (`TASK-AUDIT-001` through `TASK-AUDIT-007`)

**First executable task:** `TASK-AUDIT-001` (Prerequisites: `[TASK-INFRA-005,
TASK-INFRA-006, TASK-INFRA-007]` — all INFRA; no AUDIT-internal prerequisites)

**Special tags used:**
- `[MIGRATION]` — TASK-AUDIT-001 (creates the `audit` schema and `events` table migration)
- `[AUDIT]` — TASK-AUDIT-004 (the event consumer that writes every domain event to the audit schema)
- `[ABAC]` — TASK-AUDIT-006 (tRPC procedure with role-restricted access guard)

---

**Spec gaps — all resolved:**

`[SPEC GAP → RESOLVED — 2026-06-24]`
`TASK-INFRA-023` has been written in `infra.md` covering all five EventBus
deliverables. Because `TASK-INFRA-022` was already reserved in `infra.md`'s
Module Summary for the Pulumi `/infra/` program (L5 source document, still
pending its own A1 pass), the EventBus task is numbered `TASK-INFRA-023`.
`TASK-AUDIT-004` prerequisites updated from `[CROSS-MODULE REF: INFRA — EventBus
task not yet generated]` to `[TASK-INFRA-023]`. The "(See Module Summary SPEC
GAP)" reference in `TASK-AUDIT-004`'s AI Prompt has been removed.

---

**Deferred capabilities:**

- `[DEFERRED — Phase 2: HMAC key rotation operational runbook]` ADR-API-002
  specifies an annual key rotation procedure (manual, documented runbook;
  `hmac_key_version` incremented; rotation itself recorded as an audit event;
  prior-version keys retained indefinitely for historical chain re-validation).
  The `hmac_key_version` column exists in the Phase 1 schema (TASK-AUDIT-001)
  and is written by the Phase 1 write service (TASK-AUDIT-003). The rotation
  runbook itself is a Phase 2 operational concern — no code changes needed
  in Phase 1 for the column to be present and correct.
- `[DEFERRED — Phase 3: DPA compliance features]` RA 10173 PII erasure actions
  and Data Privacy Act compliance controls are assigned to AUDIT Phase 3 per
  `a1-skeleton.md` v2 §3.

---

**Document conflicts — all resolved:**

`[CONFLICT 1 → RESOLVED — 2026-06-24]`
`C1 Part 10 DDL vs. I3 §18.1 D-ABAC-04 — missing resource_office_id column`

Both I1 §8.3 and I3 §18.1 had already formally decided D-ABAC-04 and marked it
`[Resolved — D-ABAC-04]`. C1 Part 10 simply failed to incorporate the column.
Resolution: **follow I1/I3 (the more recent and more specific authority)**.
Three documents updated:
1. `c1-full-database-schema-ddl-v3.md` Part 10 — `resource_office_id UUID NULL`
   column and `CREATE INDEX idx_audit_events_resource_office ON audit.events
   (resource_office_id) WHERE resource_office_id IS NOT NULL` added to the
   `audit.events` DDL.
2. `TASK-AUDIT-001` — DDL in AI Prompt updated; acceptance criteria updated
   (now requires the column; removes the former "do NOT include" criterion).
3. `TASK-AUDIT-003` — `AuditEventInput.resourceOfficeId?: string | null` added;
   `AuditRepository.insertEvent()` row type updated; `writeEvent()` step 7
   passes `resourceOfficeId: input.resourceOfficeId ?? null`.
4. `TASK-AUDIT-004` — `makeHandler('user.login', ...)` stub updated with
   `resourceOfficeId: null`; guidance added for all 18 handler types.
The `[DEFERRED — Phase 3: resource_office_id column on audit.events]` deferral
entry has been removed — the column is now a Phase 1 deliverable.
Consequence cleared: the I1 §8.3 ABAC gate for office-scoped audit reads is
now unblocked once `TASK-AUDIT-001` and `TASK-AUDIT-003` are implemented.

---

`[CONFLICT 2 → RESOLVED — 2026-06-24]`
`TASK-INFRA-005 post-migrate-grants.sql vs. C1 Part 12 — batac_app audit schema access;
batac_audit missing SELECT`

Resolution: **follow C1 Part 12 and B2 Prohibited Pattern P3**.
Additionally, a related defect was found: `batac_audit` was never granted
`SELECT` on `audit.events`, which would have caused `fetchPreviousChainHash()`
and `queryEvents()` to fail with a permission-denied error at runtime.
Three documents updated:
1. `TASK-INFRA-005` (infra.md) — three corrections:
   (a) `batac_app` removed from all audit schema grants in `post-migrate-grants.sql`
   (`USAGE ON SCHEMA audit`, `INSERT ON ALL TABLES IN SCHEMA audit`, and
   `ALTER DEFAULT PRIVILEGES` entries all removed for `batac_app`); `shared`
   schema added to `app_schemas` array for the new `shared.event_bus_dead_letters`
   table (TASK-INFRA-023). (b) `batac_audit` grant changed from `INSERT` only
   to `SELECT, INSERT` on `audit.events`. (c) Acceptance criteria corrected:
   `batac_app` audit INSERT test flipped to assert failure; new criterion
   added asserting `batac_audit` can SELECT and INSERT but not UPDATE/DELETE.
2. `c1-full-database-schema-ddl-v3.md` Part 12 — `batac_audit` grant comment
   corrected: `REVOKE SELECT, UPDATE, DELETE` changed to
   `GRANT SELECT, INSERT` + `REVOKE UPDATE, DELETE`; resolution note added
   inline. (The `batac_app` section of C1 Part 12 was already correct —
   it did not list the `audit` schema — so no change needed there.)
3. `infra.md` Module Summary Document conflicts — item 6 added documenting
   this resolution.
Consequence cleared: B2 Prohibited Pattern P3 ("Direct write to the audit
schema") is now enforced at the database-role level, not application-layer-only.
`fetchPreviousChainHash()` and `queryEvents()` are unblocked.