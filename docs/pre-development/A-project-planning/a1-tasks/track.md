# TASK LIST — Module: TRACK (Tracking)

Generated per `A1-AGENTS.md` §6 "Step 2 — Module passes."
Wave E — runs after DOCS (Wave D) task list is complete. Runs in parallel with WF.

**Documents loaded for this pass, in order:**
1. `docs/pre-development/A-project-planning/a1-skeleton.md` (v2.1)
2. `docs/pre-development/A-project-planning/a1-tasks/docs.md` (19 tasks + Module Summary)
3. `docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md` §tracking (Part 7, L1572–L1650) + Part 12 grants (L1912–L2026)
4. `docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md` §11.6 only (L1462–L1479)
5. `docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md` Module 5 (L1083–L1143)
6. `docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md` Module 5 (L708–L778), Published API Call Matrix (L1188–L1224), Module Dependency Map (L1225–L1308), Prohibited Patterns P1–P6 (L1310–L1328)

**Also read:** `packages/shared/src/events/event-payload-map.ts` and `domain-event.ts` to confirm event type stubs.

**Sourcing legend:**
- Unmarked — taken directly from one of the loaded sources.
- `[Inference]` — reasoned synthesis not stated verbatim in any loaded document.
- `[SPEC GAP]` — something a loaded source requires but no loaded document specifies clearly enough to write a self-contained AI Prompt for. Left for human resolution per `A1-AGENTS.md` §8.

---

## Table of Contents

- [L83–L107] TASK-TRACK-001 — `[MIGRATION]` Create tracking schema Drizzle definitions and DDL migration
- [L108–L123] Project-wide DDL conventions
- [L124–L203] Table definitions — implement exactly as shown (C1 Part 7)
- [L204–L246] Sequence helper function and 2026 sequence (C1 Part 7 footer — append after table DDL)
- [L247–L261] Grant script (C1 Part 12 — append to migration after generated DDL)
- [L262–L265] No RLS policies
- [L266–L310] Drizzle schema file skeleton
- [L311–L339] TASK-TRACK-002 — Scaffold TRACK module file structure with typed stubs
- [L340–L342] Module location
- [L343–L385] Published API interface (B2 Module 5 — define in index.ts, implement in tracking.service.ts)
- [L386–L399] tRPC router stub — five procedure names (exact names from E1 Module 5)
- [L400–L416] Fastify plugin stub
- [L417–L430] Cross-module import rule (B2 Prohibited Pattern P2)
- [L431–L452] TASK-TRACK-003 — Implement TRACK repository layer — all three tracking.* tables
- [L453–L483] Table column reference (from tracking schema migration — TASK-TRACK-001)
- [L484–L540] Method signatures and key implementations
- [L541–L561] getRoutingHistory join — must match RoutingEntry interface from B2
- [L562–L594] getNextTrackingNumber — DTS-{YEAR}-{SEQUENCE} formatting [RESOLVED -- SPEC-GAP-TRACK-01]
- [L595–L616] TASK-TRACK-004 — Implement QR code generation service (UUID assignment, DTS tracking number, QR image, S3 upload)
- [L617–L627] Two distinct identifiers — do not confuse them
- [L628–L643] Business rules (consolidated ref §11.6 — enforce exactly)
- [L644–L650] S3 key convention
- [L651–L655] S3 client
- [L656–L668] QR image generation
- [L669–L702] generateAndStore full flow
- [L703–L725] TASK-TRACK-005 — Implement TRACK event consumers (document.created → QR record; workflow.step_completed → routing entry)
- [L726–L737] Event envelope (packages/shared/src/events/domain-event.ts)
- [L738–L788] Handler 1: handleDocumentCreated
- [L789–L840] Handler 2: handleWorkflowStepCompleted
- [L841–L854] Error propagation
- [L855–L876] TASK-TRACK-006 — Implement TRACK Published API (getTrackingRecordForDocument, getRoutingHistory)
- [L877–L885] Published API interface (B2 Module 5 — implement exactly)
- [L886–L896] Authorization boundary
- [L897–L914] Implementation
- [L915–L928] Callers registered in B2 API Call Matrix
- [L929–L949] TASK-TRACK-007 — `[ABAC]` Implement tracking tRPC router — five procedures + QR cover sheet PDF generator
- [L950–L973] Procedure 1: tracking.getTrackingRecord
- [L974–L1004] Procedure 2: tracking.printQrCoverSheet
- [L1005–L1030] Procedure 3: tracking.getRoutingHistory
- [L1031–L1050] Procedure 4: tracking.logRoutingEntry
- [L1051–L1083] Procedure 5: tracking.scanQrCodeAuthenticated
- [L1084–L1117] @react-pdf/renderer cover sheet (printQrCoverSheet)
- [L1118–L1138] TASK-TRACK-008 — Implement public QR scan REST endpoint (publicLookupHandler — unauthenticated)
- [L1139–L1143] Route
- [L1144–L1153] Business rules (consolidated ref §11.6 + B2 Module 5)
- [L1154–L1168] Response shape
- [L1169–L1185] firstPageImageUrl — S3 key convention [RESOLVED — SPEC-GAP-TRACK-02, 2026-06-30]
- [L1186–L1244] Handler factory
- [L1245–L1261] Cross-module dependency note (B2 Law #2 compliance)
- [L1262–L1284] TASK-TRACK-009 — Wire TRACK Fastify plugin, register event consumers, inject Published API
- [L1285–L1353] Plugin structure
- [L1354–L1365] Registration order in app.ts
- [L1366–L1376] B2 API Call Matrix update (required in same PR — Prohibited Pattern P5 violation if omitted)
- [L1377–L1391] Fastify type declarations
- [L1392–L1471] Module Summary — TRACK

---

## TASK-TRACK-001

Phase:          1
Module:         TRACK
Title:          [MIGRATION] Create tracking schema Drizzle definitions and DDL migration
Prerequisites:  [TASK-DOCS-001, CROSS-MODULE REF: INFRA — DB initialization and schema creation task; exact TASK-INFRA-NNN not identifiable from TASK-DOCS list alone; resolve at integration pass]
Deliverables:
  - /packages/database/src/schema/tracking.ts — Drizzle ORM table definitions for all three tracking.* tables (qr_codes, tracking_records, routing_entries) using pgSchema('tracking') and pgTable; all constraints, unique indexes, and regular indexes represented; named exports re-exported from /packages/database/src/schema/index.ts. No updated_at column on any tracking table — explicitly omitted per C1 Part 1.4 (tracking.routing_entries is append-only; tracking.qr_codes and tracking.tracking_records carry no updated_at per the C1 DDL). No fn_set_updated_at trigger on any tracking table.
  - /apps/server/src/database/migrations/{timestamp}_create_tracking_schema.sql — SQL migration generated by `pnpm db:generate`, then manually extended with: (a) the `tracking.fn_get_next_tracking_number(year)` SECURITY DEFINER function and pre-created `tracking.dts_2026_seq` sequence for the DTS-{YEAR}-{SEQUENCE} tracking number (C1 Part 7 footer + Part 11 — [RESOLVED — SPEC-GAP-TRACK-01, 2026-06-30]); (b) GRANT statements from C1 Part 12 for tracking schema (batac_app: SELECT/INSERT/UPDATE on all tables; routing_entries additionally has UPDATE/DELETE revoked; batac_readonly: SELECT; batac_it_admin: no USAGE grant on tracking schema); (c) explicit REVOKE UPDATE, DELETE ON tracking.routing_entries FROM batac_app (append-only enforcement at grant level). No RLS policies on any tracking table — C1 Part 12 defines no RLS for the tracking schema.
Acceptance Criteria:
  - [ ] `pnpm db:generate` produces a migration file that, when applied via `pnpm db:migrate`, creates all three tracking.* tables with zero errors on a database that already has iam, organization, and documents schemas applied
  - [ ] `SELECT table_name FROM information_schema.tables WHERE table_schema = 'tracking' ORDER BY table_name` returns exactly: qr_codes, routing_entries, tracking_records
  - [ ] `SELECT indexname FROM pg_indexes WHERE schemaname = 'tracking' ORDER BY indexname` returns idx_routing_entries_occurred_at, idx_routing_entries_tracking_record, idx_tracking_records_qr_code, plus unique index names uq_qr_codes_tracking_id, uq_qr_codes_document, uq_qr_codes_tracking_number, and uq_tracking_records_document
  - [ ] `SELECT relname FROM pg_class WHERE relkind='S' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='tracking')` returns dts_2026_seq
  - [ ] `SELECT proname FROM pg_proc WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='tracking')` returns fn_get_next_tracking_number
  - [ ] A second INSERT into tracking.qr_codes with a duplicate tracking_id raises a unique constraint violation
  - [ ] A second INSERT into tracking.qr_codes with a duplicate tracking_number raises a unique constraint violation
  - [ ] `UPDATE tracking.routing_entries SET action_description = 'x' WHERE id = '...'` fails with a permissions error (UPDATE revoked on routing_entries for batac_app)
  - [ ] `pnpm typecheck` passes at the workspace root
  - [ ] `pnpm db:migrate` is idempotent — running twice on the same database does not fail
AI Prompt: |
  You are implementing the Drizzle ORM schema for the `tracking` PostgreSQL schema and
  generating the corresponding SQL migration for the Batac City LGU document-management
  platform.

  ## Project-wide DDL conventions
  - Every table: `id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()`
  - Every table: `city_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid`
  - All temporal columns: TIMESTAMPTZ
  - Soft delete only: `deleted_at TIMESTAMPTZ NULL` and `deleted_by UUID NULL` on every table.
    No table may ever receive a SQL DELETE — DELETE is revoked at the PostgreSQL grant level.
  - **CRITICAL:** `updated_at` and `fn_set_updated_at()` triggers are OMITTED from ALL three
    tracking tables. This is an explicit C1 Part 1.4 design decision — tracking.routing_entries
    is listed by name in C1's "Omitted on append-only / write-once tables" note. The qr_codes
    and tracking_records tables also carry no updated_at per the C1 DDL shown below.
    Do NOT add updated_at or any trigger to any tracking table.
  - No FOREIGN KEY constraints across schema boundaries. Cross-schema references are plain UUID
    columns with comment: `-- logical FK -> <schema>.<table>.<column> (cross-schema)`
  - Drizzle: use `drizzle-orm/pg-core`, `pgSchema`, `pgTable`, `uuid`, `text`, `timestamp`,
    `index`, `uniqueIndex` helpers. Schema file: `/packages/database/src/schema/tracking.ts`.

  ## Table definitions — implement exactly as shown (C1 Part 7)

  ### tracking.qr_codes
  ```sql
  -- tracking_id holds the same UUID value as documents.documents.qr_tracking_number
  -- (D4 Relationship Note 9). Assigned at secretariat logging, before the preliminary number.
  CREATE TABLE tracking.qr_codes (
      id                UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id           UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      -- document_id: logical FK -> documents.documents.id (cross-schema) NOT NULL
      document_id       UUID        NOT NULL,
      tracking_id       UUID        NOT NULL,  -- UUID encoded in the physical QR image
      -- tracking_number: human-readable display label e.g. 'DTS-2026-0001'.
      -- Populated via tracking.fn_get_next_tracking_number(year) at QR
      -- assignment time (per-year auto-creating sequence; see function below).
      -- §11.6: "Tracking number format: Configurable; default: DTS-{YEAR}-{SEQUENCE}"
      -- [RESOLVED -- SPEC-GAP-TRACK-01, 2026-06-30]
      tracking_number   TEXT        NOT NULL,
      qr_image_file_key UUID        NULL,
      assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- generated_by: logical FK -> iam.users.id (cross-schema)
      generated_by      UUID        NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at        TIMESTAMPTZ NULL,
      deleted_by        UUID        NULL,
      CONSTRAINT uq_qr_codes_tracking_id     UNIQUE (tracking_id),
      CONSTRAINT uq_qr_codes_document        UNIQUE (document_id),
      CONSTRAINT uq_qr_codes_tracking_number UNIQUE (tracking_number)
  );
  ```

  ### tracking.tracking_records
  ```sql
  -- current_status is intentionally free TEXT — not CHECK-constrained against
  -- documents.lifecycle_state. Physical custody is a separate state machine.
  CREATE TABLE tracking.tracking_records (
      id                          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id                     UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      -- document_id: logical FK -> documents.documents.id (cross-schema) NOT NULL
      document_id                 UUID        NOT NULL,
      qr_code_id                  UUID        NOT NULL REFERENCES tracking.qr_codes(id),
      current_status              TEXT        NULL,
      -- current_custodian_office_id: logical FK -> organization.offices.id (cross-schema)
      -- NULL if document is with an external party.
      current_custodian_office_id UUID        NULL,
      physical_location           TEXT        NULL,
      last_moved_at               TIMESTAMPTZ NULL,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at                  TIMESTAMPTZ NULL,
      deleted_by                  UUID        NULL,
      CONSTRAINT uq_tracking_records_document UNIQUE (document_id)
  );

  CREATE INDEX idx_tracking_records_qr_code ON tracking.tracking_records(qr_code_id);
  ```

  ### tracking.routing_entries
  ```sql
  -- Append-only: no updated_at. Field shape follows B2 Module 5 RoutingEntry interface.
  CREATE TABLE tracking.routing_entries (
      id                  UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id             UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      tracking_record_id  UUID        NOT NULL REFERENCES tracking.tracking_records(id),
      -- from_office_id: logical FK -> organization.offices.id (cross-schema); NULL at first entry
      from_office_id      UUID        NULL,
      -- to_office_id: logical FK -> organization.offices.id (cross-schema); NULL when external
      to_office_id        UUID        NULL,
      -- actor_id: logical FK -> iam.users.id (cross-schema); NULL = system action
      actor_id            UUID        NULL,
      action_description  TEXT        NOT NULL,
      occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at          TIMESTAMPTZ NULL,
      deleted_by          UUID        NULL
  );

  CREATE INDEX idx_routing_entries_tracking_record ON tracking.routing_entries(tracking_record_id);
  CREATE INDEX idx_routing_entries_occurred_at     ON tracking.routing_entries(occurred_at);
  ```

  ## Sequence helper function and 2026 sequence (C1 Part 7 footer — append after table DDL)
  ```sql
  -- Per-year auto-creating sequence for the DTS-{YEAR}-{SEQUENCE} tracking number.
  -- Mirrors documents.fn_get_next_sequence_value()'s on-demand-creation pattern so
  -- {SEQUENCE} resets to 1 each calendar year, consistent with document final numbers.
  -- SECURITY DEFINER owned by batac_migrate so batac_app can CREATE SEQUENCE without
  -- DDL privileges. [RESOLVED -- SPEC-GAP-TRACK-01, 2026-06-30]
  CREATE OR REPLACE FUNCTION tracking.fn_get_next_tracking_number(
      p_year INTEGER
  )
  RETURNS TABLE (sequence_value BIGINT, was_created BOOLEAN)
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $fn$
  DECLARE
      v_seq_name TEXT;
      v_next     BIGINT;
      v_created  BOOLEAN := false;
  BEGIN
      v_seq_name := 'tracking.dts_' || p_year::text || '_seq';
      BEGIN
          EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
      EXCEPTION WHEN undefined_table THEN
          EXECUTE format(
              'CREATE SEQUENCE IF NOT EXISTS %s AS INTEGER INCREMENT 1 START 1',
              v_seq_name
          );
          EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
          v_created := true;
      END;
      RETURN QUERY SELECT v_next, v_created;
  END;
  $fn$;

  REVOKE ALL ON FUNCTION tracking.fn_get_next_tracking_number(INTEGER) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION tracking.fn_get_next_tracking_number(INTEGER) TO batac_app;
  ALTER FUNCTION tracking.fn_get_next_tracking_number(INTEGER) OWNER TO batac_migrate;

  -- Pre-create the current year's sequence (C1 Part 11 pattern) — the function
  -- above is the on-demand safety net, not the expected creation path.
  CREATE SEQUENCE IF NOT EXISTS tracking.dts_2026_seq AS INTEGER INCREMENT 1 START 1;
  ```

  ## Grant script (C1 Part 12 — append to migration after generated DDL)
  ```sql
  -- batac_app: runtime application service account
  GRANT USAGE ON SCHEMA tracking TO batac_app;
  GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tracking TO batac_app;
  -- routing_entries is append-only: revoke UPDATE and DELETE for all roles
  REVOKE UPDATE, DELETE ON tracking.routing_entries FROM batac_app;

  -- batac_readonly: monitoring/reporting
  GRANT USAGE ON SCHEMA tracking TO batac_readonly;
  GRANT SELECT ON ALL TABLES IN SCHEMA tracking TO batac_readonly;

  -- batac_it_admin: NO USAGE grant on tracking schema (not listed in C1 Part 12 IT admin grants)
  ```

  ## No RLS policies
  C1 Part 12 defines RLS only on documents.documents and iam.sessions. Do NOT add any
  ALTER TABLE ... ENABLE ROW LEVEL SECURITY or CREATE POLICY statements for any tracking table.

  ## Drizzle schema file skeleton
  ```typescript
  // /packages/database/src/schema/tracking.ts
  import { pgSchema, pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

  export const trackingSchema = pgSchema('tracking');

  export const qrCodes = trackingSchema.table('qr_codes', {
    id:              uuid('id').primaryKey().defaultRandom(),
    cityId:          uuid('city_id').notNull().default('00000000-0000-4000-8000-000000000001'),
    documentId:      uuid('document_id').notNull(), // logical FK -> documents.documents.id
    trackingId:      uuid('tracking_id').notNull(), // UUID encoded in physical QR image
    // trackingNumber: human-readable DTS-YYYY-NNNN label, populated via
    // tracking.fn_get_next_tracking_number(year) at insert time [RESOLVED -- SPEC-GAP-TRACK-01]
    trackingNumber:  text('tracking_number').notNull(),
    qrImageFileKey:  uuid('qr_image_file_key'),
    assignedAt:      timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    generatedBy:     uuid('generated_by'),           // logical FK -> iam.users.id
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt:       timestamp('deleted_at', { withTimezone: true }),
    deletedBy:       uuid('deleted_by'),
  }, (t) => ({
    uqTrackingId:     uniqueIndex('uq_qr_codes_tracking_id').on(t.trackingId),
    uqDocument:       uniqueIndex('uq_qr_codes_document').on(t.documentId),
    uqTrackingNumber: uniqueIndex('uq_qr_codes_tracking_number').on(t.trackingNumber),
  }));

  // trackingRecords and routingEntries — follow same pattern from DDL above
  // Re-export all three from /packages/database/src/schema/index.ts
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm db:generate` produces a migration file that, when applied via `pnpm db:migrate`, creates all three tracking.* tables with zero errors on a database that already has iam, organization, and documents schemas applied
  - [ ] `SELECT table_name FROM information_schema.tables WHERE table_schema = 'tracking' ORDER BY table_name` returns exactly: qr_codes, routing_entries, tracking_records
  - [ ] `SELECT indexname FROM pg_indexes WHERE schemaname = 'tracking' ORDER BY indexname` returns idx_routing_entries_occurred_at, idx_routing_entries_tracking_record, idx_tracking_records_qr_code, plus unique index names uq_qr_codes_tracking_id, uq_qr_codes_document, uq_qr_codes_tracking_number, and uq_tracking_records_document
  - [ ] `SELECT relname FROM pg_class WHERE relkind='S' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='tracking')` returns dts_2026_seq
  - [ ] `SELECT proname FROM pg_proc WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='tracking')` returns fn_get_next_tracking_number
  - [ ] A second INSERT into tracking.qr_codes with a duplicate tracking_id raises a unique constraint violation
  - [ ] A second INSERT into tracking.qr_codes with a duplicate tracking_number raises a unique constraint violation
  - [ ] `UPDATE tracking.routing_entries SET action_description = 'x' WHERE id = '...'` fails with a permissions error (UPDATE revoked on routing_entries for batac_app)
  - [ ] `pnpm typecheck` passes at the workspace root
  - [ ] `pnpm db:migrate` is idempotent — running twice on the same database does not fail

---

## TASK-TRACK-002

Phase:          1
Module:         TRACK
Title:          Scaffold TRACK module file structure with typed stubs
Prerequisites:  [TASK-TRACK-001]
Deliverables:
  - /apps/server/src/modules/tracking/index.ts — barrel file exporting the TrackingPublicAPI interface, TrackingRecordSummary and RoutingEntry types (matching B2 Module 5 exactly), and the plugin default export
  - /apps/server/src/modules/tracking/tracking.db.ts — re-exports the three Drizzle table handles (qrCodes, trackingRecords, routingEntries) from packages/database for use within the module
  - /apps/server/src/modules/tracking/tracking.repository.ts — TrackingRepository class stub with correct method signatures; all bodies `throw new Error('not implemented')`
  - /apps/server/src/modules/tracking/tracking.qr-service.ts — QrCodeService stub (generateAndStore and generateCoverSheetPdf signatures only)
  - /apps/server/src/modules/tracking/tracking.event-consumer.ts — TrackingEventConsumer stub with handleDocumentCreated and handleWorkflowStepCompleted signatures
  - /apps/server/src/modules/tracking/tracking.service.ts — createTrackingService factory stub returning a TrackingPublicAPI with `throw new Error('not implemented')` bodies
  - /apps/server/src/modules/tracking/tracking.router.ts — trackingRouter tRPC router stub with five named procedure stubs (getTrackingRecord, printQrCoverSheet, getRoutingHistory, logRoutingEntry, scanQrCodeAuthenticated); all input/output z.unknown() at this stage
  - /apps/server/src/modules/tracking/tracking.public-handler.ts — publicLookupHandler Fastify route handler stub returning 501 Not Implemented
  - /apps/server/src/modules/tracking/tracking.plugin.ts — Fastify plugin stub (logs 'tracking.module.stub', no wiring yet); declares dependency on 'documents-plugin'
  - /apps/server/src/modules/tracking/__tests__/.gitkeep — empty placeholder; test files added by later tasks
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes with all stubs in place
  - [ ] The TrackingPublicAPI interface in index.ts has exactly two methods: `getTrackingRecordForDocument(documentId: string): Promise<TrackingRecordSummary | null>` and `getRoutingHistory(documentId: string, actorId: string): Promise<RoutingEntry[]>`
  - [ ] The TrackingRecordSummary type in index.ts has exactly these fields: `{ trackingId: string; documentId: string; trackingNumber: string; qrCodeS3Key: string; assignedAt: Date; physicalLocation: string | null; }`
  - [ ] The RoutingEntry type in index.ts has exactly these fields: `{ entryId: string; trackingId: string; fromOfficeId: string | null; toOfficeId: string | null; actorId: string; actionDescription: string; timestamp: Date; }`
  - [ ] `import trackingPlugin from './tracking.plugin'` compiles without error
AI Prompt: |
  You are scaffolding the TRACK (Tracking) module for the Batac City LGU document-management
  platform. This task creates all files with correct type signatures and stub bodies.
  No business logic is implemented yet. The TypeScript interface shapes must match their
  source documents exactly so later tasks can implement against a stable contract.

  ## Module location
  `/apps/server/src/modules/tracking/`

  ## Published API interface (B2 Module 5 — define in index.ts, implement in tracking.service.ts)
  ```typescript
  export interface TrackingPublicAPI {
    /**
     * Get the QR tracking record for a document.
     * Used by Documents cover sheet generator. Returns null if not yet assigned.
     */
    getTrackingRecordForDocument(
      documentId: string
    ): Promise<TrackingRecordSummary | null>;

    /**
     * Get the full routing history for a document.
     * Used by the Documents Router for the authenticated internal routing history view.
     * The public unauthenticated scan is served by the REST publicLookupHandler, not this.
     * Caller must perform authorization before calling.
     */
    getRoutingHistory(
      documentId: string,
      actorId: string
    ): Promise<RoutingEntry[]>;
  }

  export interface TrackingRecordSummary {
    trackingId: string;      // qr_codes.tracking_id UUID — immutable for document lifetime
    documentId: string;
    trackingNumber: string;  // human-readable label e.g. 'DTS-2026-0001' [RESOLVED — SPEC-GAP-TRACK-01]
    qrCodeS3Key: string;     // qr_codes.qr_image_file_key (UUID key, not a full URL)
    assignedAt: Date;
    physicalLocation: string | null;
  }

  export interface RoutingEntry {
    entryId: string;
    trackingId: string;      // qr_codes.tracking_id of the parent tracking record
    fromOfficeId: string | null;
    toOfficeId: string | null;
    actorId: string;
    actionDescription: string;
    timestamp: Date;
  }
  ```

  ## tRPC router stub — five procedure names (exact names from E1 Module 5)
  ```typescript
  // tracking.router.ts
  export const trackingRouter = router({
    getTrackingRecord:         publicProcedure.input(z.unknown()).query(async () => { throw new Error('not implemented'); }),
    printQrCoverSheet:         publicProcedure.input(z.unknown()).query(async () => { throw new Error('not implemented'); }),
    getRoutingHistory:         publicProcedure.input(z.unknown()).query(async () => { throw new Error('not implemented'); }),
    logRoutingEntry:           publicProcedure.input(z.unknown()).mutation(async () => { throw new Error('not implemented'); }),
    scanQrCodeAuthenticated:   publicProcedure.input(z.unknown()).query(async () => { throw new Error('not implemented'); }),
  });
  ```
  Use the tRPC `router` and `publicProcedure` from the existing tRPC setup in the project
  (follow the same import pattern as the documents router from TASK-DOCS-002).

  ## Fastify plugin stub
  ```typescript
  // tracking.plugin.ts
  import fp from 'fastify-plugin';
  import type { FastifyPluginAsync } from 'fastify';

  const trackingPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.log.info('tracking.module.stub');
    // Full wiring in TASK-TRACK-009
  };

  export default fp(trackingPlugin, {
    name: 'tracking-plugin',
    dependencies: ['documents-plugin'],
  });
  ```

  ## Cross-module import rule (B2 Prohibited Pattern P2)
  No import from `../documents/src/...` or any other module's src directory.
  Only barrel imports (`../documents/index.ts`) are permitted. At this stub stage,
  no cross-module imports are required.

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes with all stubs in place
  - [ ] The TrackingPublicAPI interface in index.ts has exactly two methods: `getTrackingRecordForDocument(documentId: string): Promise<TrackingRecordSummary | null>` and `getRoutingHistory(documentId: string, actorId: string): Promise<RoutingEntry[]>`
  - [ ] The TrackingRecordSummary type in index.ts has exactly these fields: `{ trackingId: string; documentId: string; trackingNumber: string; qrCodeS3Key: string; assignedAt: Date; physicalLocation: string | null; }`
  - [ ] The RoutingEntry type in index.ts has exactly these fields: `{ entryId: string; trackingId: string; fromOfficeId: string | null; toOfficeId: string | null; actorId: string; actionDescription: string; timestamp: Date; }`
  - [ ] `import trackingPlugin from './tracking.plugin'` compiles without error

---

## TASK-TRACK-003

Phase:          1
Module:         TRACK
Title:          Implement TRACK repository layer — all three tracking.* tables
Prerequisites:  [TASK-TRACK-002]
Deliverables:
  - /apps/server/src/modules/tracking/tracking.repository.ts — TrackingRepository class replacing the stub with full implementations for: createQrCode, updateQrImageKey, createTrackingRecord, updateTrackingRecordCustodian, appendRoutingEntry, findTrackingRecordByDocumentId (returns TrackingRecordSummary | null, including trackingNumber), findQrCodeByTrackingId (returns qrCodes row | null — lookup by the UUID encoded in the physical QR code), getNextTrackingNumber (returns a formatted 'DTS-{YEAR}-{NNNN}' string via tracking.fn_get_next_tracking_number — [RESOLVED — SPEC-GAP-TRACK-01]), getRoutingHistory (returns RoutingEntry[] joined tracking_records + qr_codes, ordered occurred_at ASC). All methods accept a Drizzle db client to support transactions.
  - /apps/server/src/modules/tracking/__tests__/tracking.repository.test.ts — Vitest integration tests: createQrCode inserts and returns the correct row; duplicate tracking_id raises unique constraint; duplicate tracking_number raises unique constraint; appendRoutingEntry inserts and cannot be updated (UPDATE rejected by DB); findQrCodeByTrackingId returns null on miss; getNextTrackingNumber returns sequential DTS-{YEAR}-{NNNN} values across repeated calls; getRoutingHistory returns entries ordered ASC
Acceptance Criteria:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.repository.test.ts` passes
  - [ ] `appendRoutingEntry` has no sibling method `updateRoutingEntry` or `deleteRoutingEntry` — the class exposes no mutation on already-inserted routing entries
  - [ ] `findQrCodeByTrackingId` returns null (never throws) when the UUID is not present
  - [ ] `getNextTrackingNumber(2026)` called twice in sequence returns two distinct values matching `/^DTS-2026-\d{4}$/`, the second one numerically greater than the first
  - [ ] `getRoutingHistory` results are ordered ascending by `occurred_at`
  - [ ] `pnpm typecheck` passes
AI Prompt: |
  You are implementing the repository layer for the TRACK module of the Batac City LGU
  document-management platform. The repository wraps all three tracking.* tables using
  Drizzle ORM and enforces the append-only constraint on routing_entries at the application
  layer in addition to the DB-level REVOKE.

  ## Table column reference (from tracking schema migration — TASK-TRACK-001)

  ### tracking.qr_codes
  id UUID PK | city_id UUID | document_id UUID (logical FK -> documents.documents.id) |
  tracking_id UUID UNIQUE (UUID encoded in physical QR image) |
  tracking_number TEXT NOT NULL UNIQUE (human-readable DTS-YYYY-NNNN [RESOLVED — SPEC-GAP-TRACK-01]) |
  qr_image_file_key UUID NULL |
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now() | generated_by UUID NULL (logical FK -> iam.users.id) |
  created_at TIMESTAMPTZ | deleted_at TIMESTAMPTZ NULL | deleted_by UUID NULL
  Unique constraints: uq_qr_codes_tracking_id, uq_qr_codes_document, uq_qr_codes_tracking_number

  ### tracking.tracking_records
  id UUID PK | city_id UUID | document_id UUID (logical FK -> documents.documents.id) |
  qr_code_id UUID NOT NULL REFERENCES tracking.qr_codes(id) |
  current_status TEXT NULL (free text — NOT constrained to document lifecycle states) |
  current_custodian_office_id UUID NULL (logical FK -> organization.offices.id) |
  physical_location TEXT NULL | last_moved_at TIMESTAMPTZ NULL |
  created_at TIMESTAMPTZ | deleted_at TIMESTAMPTZ NULL | deleted_by UUID NULL
  Unique constraint: uq_tracking_records_document. Index: idx_tracking_records_qr_code

  ### tracking.routing_entries
  id UUID PK | city_id UUID | tracking_record_id UUID NOT NULL REFERENCES tracking.tracking_records(id) |
  from_office_id UUID NULL (logical FK -> organization.offices.id; NULL at first entry) |
  to_office_id UUID NULL (logical FK -> organization.offices.id; NULL when external) |
  actor_id UUID NULL (logical FK -> iam.users.id; NULL = system action) |
  action_description TEXT NOT NULL | occurred_at TIMESTAMPTZ NOT NULL DEFAULT now() |
  created_at TIMESTAMPTZ | deleted_at TIMESTAMPTZ NULL | deleted_by UUID NULL
  Indexes: idx_routing_entries_tracking_record, idx_routing_entries_occurred_at
  APPEND-ONLY: UPDATE and DELETE are revoked at the DB grant level. Do not expose any
  method that updates or deletes a routing entry row.

  ## Method signatures and key implementations

  ```typescript
  export class TrackingRepository {
    constructor(private readonly db: PostgresJsDatabase) {}

    async createQrCode(input: {
      documentId: string;
      trackingId: string;        // UUID to encode in QR image; must be unique
      trackingNumber: string;    // human-readable DTS-YYYY-NNNN; computed by caller [RESOLVED — SPEC-GAP-TRACK-01]
      generatedBy: string | null;
      cityId?: string;
    }): Promise<typeof qrCodes.$inferSelect>

    // updateQrImageKey: only mutable update on qr_codes — sets the S3 key after image upload
    async updateQrImageKey(qrCodeId: string, qrImageFileKey: string): Promise<void>

    async createTrackingRecord(input: {
      documentId: string;
      qrCodeId: string;
      currentCustodianOfficeId: string | null;
      currentStatus?: string;
      cityId?: string;
    }): Promise<typeof trackingRecords.$inferSelect>

    // updateTrackingRecordCustodian: called by event consumer on workflow.step_completed
    async updateTrackingRecordCustodian(
      trackingRecordId: string,
      currentCustodianOfficeId: string | null,
      lastMovedAt: Date
    ): Promise<void>

    async appendRoutingEntry(input: {
      trackingRecordId: string;
      fromOfficeId: string | null;
      toOfficeId: string | null;
      actorId: string | null;
      actionDescription: string;
      cityId?: string;
    }): Promise<typeof routingEntries.$inferSelect>

    async findTrackingRecordByDocumentId(
      documentId: string
    ): Promise<TrackingRecordSummary | null>   // returns null on miss; TrackingRecordSummary includes trackingNumber [SPEC-GAP-TRACK-01 resolved]

    async findQrCodeByTrackingId(
      trackingId: string                        // UUID encoded in physical QR image
    ): Promise<typeof qrCodes.$inferSelect | null>  // null on miss

    // getNextTrackingNumber: calls tracking.fn_get_next_tracking_number(year) and
    // formats the result as 'DTS-{YEAR}-{NNNN}'. [RESOLVED -- SPEC-GAP-TRACK-01]
    async getNextTrackingNumber(year: number): Promise<string>

    async getRoutingHistory(documentId: string): Promise<RoutingEntry[]>
  }
  ```

  ## getRoutingHistory join — must match RoutingEntry interface from B2
  ```typescript
  const rows = await this.db
    .select({
      entryId:           routingEntries.id,
      trackingId:        qrCodes.trackingId,   // the UUID from qr_codes, not the entry id
      fromOfficeId:      routingEntries.fromOfficeId,
      toOfficeId:        routingEntries.toOfficeId,
      actorId:           routingEntries.actorId,
      actionDescription: routingEntries.actionDescription,
      timestamp:         routingEntries.occurredAt,
    })
    .from(routingEntries)
    .innerJoin(trackingRecords, eq(routingEntries.trackingRecordId, trackingRecords.id))
    .innerJoin(qrCodes, eq(trackingRecords.qrCodeId, qrCodes.id))
    .where(
      and(eq(trackingRecords.documentId, documentId), isNull(routingEntries.deletedAt))
    )
    .orderBy(asc(routingEntries.occurredAt));
  ```

  ## getNextTrackingNumber — DTS-{YEAR}-{SEQUENCE} formatting [RESOLVED -- SPEC-GAP-TRACK-01]
  Calls the `tracking.fn_get_next_tracking_number(year)` SECURITY DEFINER function
  (created in TASK-TRACK-001's migration) and formats the result. Use Drizzle's
  `sql` tagged template for the raw function call — this is a stored procedure
  call, not a table query, so the query builder does not apply here.
  ```typescript
  import { sql } from 'drizzle-orm';

  async getNextTrackingNumber(year: number): Promise<string> {
    const result = await this.db.execute<{ sequence_value: number; was_created: boolean }>(
      sql`SELECT * FROM tracking.fn_get_next_tracking_number(${year})`
    );
    const { sequence_value, was_created } = result.rows[0];
    if (was_created) {
      // Structured log warning only (not an audit/domain event) -- same pattern
      // as documents.fn_get_next_sequence_value's was_created signal.
      this.logger?.warn({ year }, 'tracking: dts_{year}_seq auto-created on demand');
    }
    const padded = String(sequence_value).padStart(4, '0'); // [Inference] 4-digit padding -- see C1 Part 7 comment
    return `DTS-${year}-${padded}`;
  }
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.repository.test.ts` passes
  - [ ] `appendRoutingEntry` has no sibling method `updateRoutingEntry` or `deleteRoutingEntry` — the class exposes no mutation on already-inserted routing entries
  - [ ] `findQrCodeByTrackingId` returns null (never throws) when the UUID is not present
  - [ ] `getNextTrackingNumber(2026)` returns a string matching `/^DTS-2026-\d{4}$/`; calling it twice returns two different, sequential values
  - [ ] `getRoutingHistory` results are ordered ascending by `occurred_at`
  - [ ] `pnpm typecheck` passes

---

## TASK-TRACK-004

Phase:          1
Module:         TRACK
Title:          Implement QR code generation service (UUID assignment, DTS tracking number, QR image, S3 upload)
Prerequisites:  [TASK-TRACK-003, TASK-INFRA-005, CROSS-MODULE REF: INFRA — MinIO/S3 bucket initialization task; exact TASK-INFRA-NNN not identifiable from TASK-DOCS list alone; resolve at integration pass]
Deliverables:
  - /apps/server/src/modules/tracking/tracking.qr-service.ts — QrCodeService class with generateAndStore(documentId, actorId, db): generates a new UUID tracking_id via crypto.randomUUID(); calls TrackingRepository.getNextTrackingNumber(currentYear) to obtain a DTS-{YEAR}-{NNNN} human-readable label (— [RESOLVED — SPEC-GAP-TRACK-01]); encodes the UUID into a QR image using the `qrcode` npm package (content: the raw UUID string only — no URL prefix, no tracking number, per consolidated ref §11.6); uploads the PNG to S3 at key `tracking/qr/{trackingId}.png`; calls TrackingRepository.createQrCode with both trackingId and trackingNumber; calls TrackingRepository.updateQrImageKey with the S3 key; returns the persisted qr_codes row. NOTE: this task no longer produces a `generateCoverSheetPdf` method — the cover sheet PDF is generated directly in TASK-TRACK-007's `printQrCoverSheet` tRPC procedure using `@react-pdf/renderer`, now that SPEC-GAP-TRACK-01 is resolved and the real trackingNumber field exists; an unused stub method here would be dead code.
  - /apps/server/src/modules/tracking/__tests__/tracking.qr-service.test.ts — Vitest unit tests (mock S3 and repository): generateAndStore produces a UUID tracking_id, calls repository.getNextTrackingNumber with the current year, calls S3 putObject with key format `tracking/qr/{uuid}.png` (QR image content is the UUID only, never the tracking number), calls repository.createQrCode with both the generated trackingId and the trackingNumber returned by getNextTrackingNumber
Acceptance Criteria:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.qr-service.test.ts` passes
  - [ ] The QR code image encodes only the raw UUID string — no URL prefix, no document content, no tracking number (per §11.6 "QR content: Unique tracking ID only, not a URL, not document content")
  - [ ] S3 object key follows format `tracking/qr/{trackingId}.png`
  - [ ] `generateAndStore` calls `repository.getNextTrackingNumber()` exactly once and passes its return value as `trackingNumber` to `repository.createQrCode()`
  - [ ] `generateAndStore` returns the persisted qr_codes row (including qr_image_file_key set to the trackingId UUID, and trackingNumber matching the DTS-{YEAR}-{NNNN} pattern)
  - [ ] `pnpm typecheck` passes
AI Prompt: |
  You are implementing the QR code generation service for the TRACK module of the Batac
  City LGU document-management platform. This service generates QR tracking identifiers
  (an immutable UUID) and human-readable DTS-{YEAR}-{SEQUENCE} tracking numbers, creates
  QR code images encoding only the raw UUID, and stores them in S3 (MinIO in dev).

  ## Two distinct identifiers — do not confuse them
  - `trackingId` (UUID): the value encoded INSIDE the QR image. Immutable, opaque,
    system-generated via crypto.randomUUID(). This is what a scanner reads.
  - `trackingNumber` (TEXT, e.g. 'DTS-2026-0001'): the human-readable label shown on the
    cover sheet and scan-result pages next to the QR code. Generated via
    TrackingRepository.getNextTrackingNumber(year), which calls the
    `tracking.fn_get_next_tracking_number(year)` DB function (TASK-TRACK-001).
    [RESOLVED — SPEC-GAP-TRACK-01, 2026-06-30] Both are assigned together, at the same
    secretariat-logging moment, and both are immutable thereafter — neither is ever
    regenerated for a given document.

  ## Business rules (consolidated ref §11.6 — enforce exactly)
  - "QR content: Unique tracking ID only — not a URL, not document content."
    Encode the raw UUID string bare (e.g. `550e8400-e29b-41d4-a716-446655440000`).
    Do NOT wrap it in a URL. Do NOT include document content. Do NOT encode the
    trackingNumber — the QR image content is the UUID only.
  - "Tracking number format: Configurable; default: DTS-{YEAR}-{SEQUENCE}" — this is
    the trackingNumber, a separate display label from the QR-encoded UUID.
  - "Assignment sequence: Secretariat logs document → QR tracking number assigned (first)
    → Preliminary Draft number assigned → Workflow instance created."
    The QR (and its accompanying trackingNumber) are the first thing assigned — before
    any document number.
  - "QR tracking number never changes after assignment" — both trackingId and
    trackingNumber are immutable once created.
  - "QR code survives throughout entire document lifecycle."
  - "Physical custody tracked separately from digital workflow status."

  ## S3 key convention
  Object key format: `tracking/qr/{trackingId}.png`
  The trackingId IS the qr_image_file_key stored in tracking.qr_codes.qr_image_file_key.
  (The column is UUID type in the schema — store the UUID value of trackingId as the key.)
  This key is keyed by trackingId (UUID), NOT by trackingNumber — trackingNumber is
  purely a display label and is never used in storage paths.

  ## S3 client
  Injected as constructor parameter. The Fastify instance exposes `fastify.s3Client` once
  INFRA plugin is registered. Env vars (already validated by TASK-INFRA-005):
  S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY.

  ## QR image generation
  ```typescript
  import QRCode from 'qrcode';  // npm package: qrcode

  const pngBuffer = await QRCode.toBuffer(trackingId, {
    type: 'png',
    errorCorrectionLevel: 'M',
    width: 200,
  });
  // trackingId is the raw UUID string — no URL prefix, no trackingNumber embedded
  ```
  Then upload: `await s3Client.putObject({ Bucket, Key: `tracking/qr/${trackingId}.png`, Body: pngBuffer, ContentType: 'image/png' })`

  ## generateAndStore full flow
  ```typescript
  async generateAndStore(documentId: string, actorId: string | null, db: PostgresJsDatabase) {
    const trackingId = crypto.randomUUID();
    const currentYear = new Date().getFullYear();
    // [RESOLVED -- SPEC-GAP-TRACK-01] human-readable label, independent generation
    // from the UUID -- both happen in the same logging transaction but are not
    // derived from one another.
    const trackingNumber = await this.repository.getNextTrackingNumber(currentYear);

    const pngBuffer = await QRCode.toBuffer(trackingId, { type: 'png', errorCorrectionLevel: 'M', width: 200 });
    await this.s3.putObject({ Bucket: this.bucket, Key: `tracking/qr/${trackingId}.png`, Body: pngBuffer, ContentType: 'image/png' });

    const qrRow = await this.repository.createQrCode({
      documentId,
      trackingId,
      trackingNumber,
      generatedBy: actorId,
    });
    await this.repository.updateQrImageKey(qrRow.id, trackingId); // store the UUID as the file key
    return qrRow;
  }
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.qr-service.test.ts` passes
  - [ ] The QR code image encodes only the raw UUID string — no URL prefix, no document content, no tracking number (per §11.6 "QR content: Unique tracking ID only, not a URL, not document content")
  - [ ] S3 object key follows format `tracking/qr/{trackingId}.png`
  - [ ] `generateAndStore` calls `repository.getNextTrackingNumber()` exactly once and passes its return value as `trackingNumber` to `repository.createQrCode()`
  - [ ] `generateAndStore` returns the persisted qr_codes row (including qr_image_file_key set to the trackingId UUID, and trackingNumber matching the DTS-{YEAR}-{NNNN} pattern)
  - [ ] `pnpm typecheck` passes

---

## TASK-TRACK-005

Phase:          1
Module:         TRACK
Title:          Implement TRACK event consumers (document.created → QR record; workflow.step_completed → routing entry)
Prerequisites:  [TASK-TRACK-003, TASK-TRACK-004]
Deliverables:
  - /apps/server/src/modules/tracking/tracking.event-consumer.ts — TrackingEventConsumer class with two handlers: (1) handleDocumentCreated(event: DomainEvent): idempotency-guarded — checks for existing tracking_record by documentId before acting; if none, calls QrCodeService.generateAndStore, then TrackingRepository.createTrackingRecord with initial currentCustodianOfficeId from payload.ownedByOfficeId and currentStatus = 'Received by SP Secretariat', then TrackingRepository.appendRoutingEntry with the initial receipt entry. (2) handleWorkflowStepCompleted(event: DomainEvent): resolves tracking_record by documentId (logs warning and returns if not found); calls TrackingRepository.appendRoutingEntry with from/to/actor/actionDescription from event payload; calls TrackingRepository.updateTrackingRecordCustodian with toOfficeId and now(). Errors propagate without being swallowed.
  - /apps/server/src/modules/tracking/__tests__/tracking.event-consumer.test.ts — Vitest unit tests (mock repository and QrCodeService): handleDocumentCreated creates tracking record on first call; idempotent on second call with same documentId; handleWorkflowStepCompleted appends routing entry; missing tracking record logs warning and returns cleanly
Acceptance Criteria:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.event-consumer.test.ts` passes
  - [ ] `handleDocumentCreated` called twice with the same documentId creates only one qr_codes row and one tracking_records row
  - [ ] `handleWorkflowStepCompleted` with a documentId that has no tracking_record logs a warning and returns without throwing
  - [ ] Neither handler catches and swallows errors — DB failures propagate to the caller
  - [ ] `pnpm typecheck` passes
AI Prompt: |
  You are implementing the event consumer handlers for the TRACK module of the Batac City
  LGU document-management platform. TRACK consumes exactly two domain events and emits none
  (pure consumer module per B2 Module 5). The event bus type stubs are in
  packages/shared/src/events/event-payload-map.ts — both 'document.created' and
  'workflow.step_completed' are currently typed as `Record<string, unknown>` stubs.
  Cast the event payload to the expected shape with a type assertion in each handler.

  ## Event envelope (packages/shared/src/events/domain-event.ts)
  ```typescript
  interface DomainEvent<TPayload = unknown> {
    eventId: string;      // UUID v4 — unique per event instance
    eventType: string;    // 'document.created' | 'workflow.step_completed' | ...
    occurredAt: string;   // ISO 8601
    cityId: string;       // UUID — Batac City UUID in Phase 1
    schemaVersion: number;
    payload: TPayload;
  }
  ```

  ## Handler 1: handleDocumentCreated
  Fired when the SP Secretariat formally logs a document (at submit time, not at draft creation).
  This is the first event in the confirmed sequencing:
  **QR assigned (here) → Preliminary number → Workflow instance created**

  Expected payload shape (cast with type assertion; concretized by TASK-DOCS-012):
  ```typescript
  interface DocumentCreatedPayload {
    documentId: string;         // documents.documents.id
    documentTypeId: string;     // documents.document_types.id
    ownedByOfficeId: string;    // the SP Secretariat office — initial custodian
    actorId: string;            // the SP Secretary who logged the document
    cityId: string;
  }
  ```

  Handler logic:
  ```typescript
  async handleDocumentCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload as DocumentCreatedPayload;

    // 1. Idempotency guard
    const existing = await this.repository.findTrackingRecordByDocumentId(payload.documentId);
    if (existing) {
      this.logger.info({ documentId: payload.documentId, eventId: event.eventId },
        'tracking: document.created duplicate — tracking record already exists, skipping');
      return;
    }

    // 2. Generate QR code and create qr_codes row
    const qrRow = await this.qrService.generateAndStore(payload.documentId, payload.actorId, this.db);

    // 3. Create tracking_records row
    const trackingRecord = await this.repository.createTrackingRecord({
      documentId: payload.documentId,
      qrCodeId: qrRow.id,
      currentCustodianOfficeId: payload.ownedByOfficeId,
      currentStatus: 'Received by SP Secretariat',
    });

    // 4. Append initial routing entry
    await this.repository.appendRoutingEntry({
      trackingRecordId: trackingRecord.id,
      fromOfficeId: null,          // no prior office at first receipt
      toOfficeId: payload.ownedByOfficeId,
      actorId: payload.actorId,
      actionDescription: 'Document logged and QR tracking number assigned',
    });
  }
  ```

  ## Handler 2: handleWorkflowStepCompleted
  Fired when a workflow step completes. TRACK appends a routing entry recording the movement.

  Expected payload shape (cast with type assertion; concretized by WF module):
  ```typescript
  interface WorkflowStepCompletedPayload {
    documentId: string;
    instanceId: string;
    stepId: string;
    stepType: string;
    fromOfficeId: string | null;
    toOfficeId: string | null;
    actorId: string;
    actionDescription: string;
    cityId: string;
  }
  ```

  Handler logic:
  ```typescript
  async handleWorkflowStepCompleted(event: DomainEvent): Promise<void> {
    const payload = event.payload as WorkflowStepCompletedPayload;

    const trackingRecord = await this.repository.findTrackingRecordByDocumentId(payload.documentId);
    if (!trackingRecord) {
      this.logger.warn({ documentId: payload.documentId, eventId: event.eventId },
        'tracking: workflow.step_completed — no tracking record found for document, skipping');
      return;  // not an error — may be a document type without tracking
    }

    await this.repository.appendRoutingEntry({
      trackingRecordId: trackingRecord.trackingId,  // resolve the actual tracking_records.id
      fromOfficeId: payload.fromOfficeId,
      toOfficeId: payload.toOfficeId,
      actorId: payload.actorId,
      actionDescription: payload.actionDescription,
    });

    if (payload.toOfficeId) {
      await this.repository.updateTrackingRecordCustodian(
        trackingRecord.trackingId,  // tracking_records.id
        payload.toOfficeId,
        new Date()
      );
    }
  }
  ```
  Note: `findTrackingRecordByDocumentId` returns TrackingRecordSummary which has `trackingId`
  (the UUID in the QR code). You need the tracking_records.id to call appendRoutingEntry.
  Adjust the repository to return the tracking_records.id alongside the summary, or add a
  separate lookup method if needed — keep `pnpm typecheck` passing.

  ## Error propagation
  Do NOT wrap handlers in try/catch that swallows errors. The shared event bus infrastructure
  (INFRA pgboss dead-letter task) handles retry on failure. Log errors before re-throwing
  if you add any logging, but do not swallow.

  Before submitting this PR, confirm each item:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.event-consumer.test.ts` passes
  - [ ] `handleDocumentCreated` called twice with the same documentId creates only one qr_codes row and one tracking_records row
  - [ ] `handleWorkflowStepCompleted` with a documentId that has no tracking_record logs a warning and returns without throwing
  - [ ] Neither handler catches and swallows errors — DB failures propagate to the caller
  - [ ] `pnpm typecheck` passes

---

## TASK-TRACK-006

Phase:          1
Module:         TRACK
Title:          Implement TRACK Published API (getTrackingRecordForDocument, getRoutingHistory)
Prerequisites:  [TASK-TRACK-003]
Deliverables:
  - /apps/server/src/modules/tracking/tracking.service.ts — createTrackingService factory returning a real implementation of TrackingPublicAPI: getTrackingRecordForDocument delegates to TrackingRepository.findTrackingRecordByDocumentId; getRoutingHistory delegates to TrackingRepository.getRoutingHistory. No authorization logic in the service — callers (Documents cover sheet generator, Documents Router) are responsible for ABAC before calling.
  - /apps/server/src/modules/tracking/__tests__/tracking.service.test.ts — Vitest unit tests (mock repository): getTrackingRecordForDocument returns null on miss; returns correct TrackingRecordSummary shape on hit; getRoutingHistory returns RoutingEntry[] in occurred_at ASC order
Acceptance Criteria:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.service.test.ts` passes
  - [ ] `getTrackingRecordForDocument` returns null (not throws) when no tracking record exists
  - [ ] `getRoutingHistory` return type is RoutingEntry[] matching the B2 Module 5 interface exactly
  - [ ] The service contains no call to IAM.evaluatePolicy — authorization is the caller's responsibility
  - [ ] `pnpm typecheck` passes
AI Prompt: |
  You are implementing the Published API (service layer) for the TRACK module of the Batac
  City LGU document-management platform. The Published API is the only interface other modules
  use to interact with TRACK — they must never query tracking.* tables directly (B2 Law #2,
  Prohibited Pattern P1). This is a thin delegation layer: the service calls repository methods
  and returns typed results matching the Published API interface.

  ## Published API interface (B2 Module 5 — implement exactly)
  ```typescript
  // From index.ts — implement in tracking.service.ts
  export interface TrackingPublicAPI {
    getTrackingRecordForDocument(documentId: string): Promise<TrackingRecordSummary | null>;
    getRoutingHistory(documentId: string, actorId: string): Promise<RoutingEntry[]>;
  }
  ```

  ## Authorization boundary
  This service layer performs NO authorization. The B2 Published API Call Matrix lists
  two callers in Phase 1:
  - Documents (cover sheet generator) → getTrackingRecordForDocument(): caller performs its
    own ABAC before invoking this service
  - Documents Router → getRoutingHistory(): the tracking.getRoutingHistory tRPC procedure
    (TASK-TRACK-007) performs ABAC via IAM.evaluatePolicy before calling this service

  The actorId parameter in getRoutingHistory is passed for logging and traceability —
  the service does not filter results by actorId and does not call IAM.

  ## Implementation
  ```typescript
  export function createTrackingService(
    repository: TrackingRepository
  ): TrackingPublicAPI {
    return {
      async getTrackingRecordForDocument(documentId: string) {
        return repository.findTrackingRecordByDocumentId(documentId);
        // returns null on miss — never throws
      },
      async getRoutingHistory(documentId: string, actorId: string) {
        // actorId received for logging traceability; repository filters by documentId only
        return repository.getRoutingHistory(documentId);
      },
    };
  }
  ```

  ## Callers registered in B2 API Call Matrix
  - Documents (cover sheet generator) → Tracking.getTrackingRecordForDocument()
  - Documents Router → Tracking.getRoutingHistory()
  - Portal (Phase 3) → Tracking.getTrackingRecordForDocument() [future; not yet implemented]

  Before submitting this PR, confirm each item:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.service.test.ts` passes
  - [ ] `getTrackingRecordForDocument` returns null (not throws) when no tracking record exists
  - [ ] `getRoutingHistory` return type is RoutingEntry[] matching the B2 Module 5 interface exactly
  - [ ] The service contains no call to IAM.evaluatePolicy — authorization is the caller's responsibility
  - [ ] `pnpm typecheck` passes

---

## TASK-TRACK-007

Phase:          1
Module:         TRACK
Title:          [ABAC] Implement tracking tRPC router — five procedures + QR cover sheet PDF generator
Prerequisites:  [TASK-TRACK-006, TASK-IAM-004]
Deliverables:
  - /apps/server/src/modules/tracking/tracking.router.ts — trackingRouter with full implementations of all five E1 Module 5 procedures using real Zod input/output schemas and ABAC enforcement. Each access-controlled procedure calls the IAM PolicyGuard (established by TASK-IAM-004) with the correct SubjectContext before executing. printQrCoverSheet uses @react-pdf/renderer to generate the QR cover sheet PDF with exactly three fields per consolidated ref Q-B02: (1) QR code image, (2) Tracking Number from tracking.trackingNumber [RESOLVED — SPEC-GAP-TRACK-01], (3) Series Number from documentsService.getDocumentById. Uploads to S3, returns presigned URL.
  - /apps/server/src/modules/tracking/__tests__/tracking.router.test.ts — Vitest tests: ABAC enforcement on each gated procedure (unauthorized role → UNAUTHORIZED error), logRoutingEntry rejects non-sp_secretary callers, scanQrCodeAuthenticated succeeds for any authenticated non-citizen role, printQrCoverSheet returns a pdfPresignedUrl
Acceptance Criteria:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.router.test.ts` passes
  - [ ] `getTrackingRecord` called by platform_admin (not in callable-by list) throws UNAUTHORIZED
  - [ ] `logRoutingEntry` called by dept_encoder throws UNAUTHORIZED (sp_secretary only)
  - [ ] `scanQrCodeAuthenticated` called by auditor succeeds (no classification gate for authenticated roles)
  - [ ] `printQrCoverSheet` returns `{ pdfPresignedUrl: z.string().url() }` pointing to S3
  - [ ] `pnpm typecheck` passes
AI Prompt: |
  You are implementing the tRPC router for the TRACK module of the Batac City LGU
  document-management platform. This router exposes five procedures from E1 Module 5
  with ABAC enforcement per I1 §7.1–§7.5.

  ## Procedure 1: tracking.getTrackingRecord
  ```
  Type:    query
  Input:   z.object({ documentId: z.string().uuid() })
  Output:  z.object({
             trackingId: z.string().uuid(),
             documentId: z.string().uuid(),
             trackingNumber: z.string(),
             qrCodeS3Key: z.string(),
             assignedAt: z.coerce.date(),
             physicalLocation: z.string().nullable()
           })
  Callable by: records_officer, dept_encoder, dept_approver, sp_secretary, sp_member,
               sp_presiding_officer, mayor, brgy_encoder, brgy_captain, auditor
  ABAC: Own-office or cross-office-with-grant. The tracking record inherits its access
        control from its parent document's office/classification (not an independent
        classification). Enforce the same pattern as documents.get: check that
        subject.officeId matches the document's ownedByOfficeId, OR that a cross-office
        grant exists. Use IAM.evaluatePolicy with resourceType='document', action='read'.
  Business: Calls trackingService.getTrackingRecordForDocument(). Throws NOT_FOUND if null.
    trackingNumber (e.g. 'DTS-2026-0001') passes through directly from the
    TrackingRecordSummary returned by the Published API. [RESOLVED — SPEC-GAP-TRACK-01]
  ```

  ## Procedure 2: tracking.printQrCoverSheet
  ```
  Type:    query (returns render-ready payload, no DB write from the tRPC layer)
  Input:   z.object({
             documentIds: z.array(z.string().uuid()).min(1),
             layout: z.enum(['single','multi_per_page']).default('multi_per_page')
           })
  Output:  z.object({ pdfPresignedUrl: z.string().url() })
  Callable by: sp_secretary only
  ABAC: Documents must be in the SP Secretariat's scope (I1 §7.5 — office ownership check).
  Business:
    For each documentId:
      - Get tracking record: trackingService.getTrackingRecordForDocument(documentId)
        — Tracking → IAM call only; no second Tracking → Documents call needed for this step.
      - Get document info: documentsService.getDocumentById(documentId)
        (preliminary_number for the Series Number field)
        [RESOLVED — SPEC-GAP-TRACK-03, 2026-06-30] This caller is now listed in B2's
        Published API Call Matrix and Module Dependency Map (Tracking → Documents).
      - Get QR image presigned URL from S3 using qrCodeS3Key
    Generate PDF using @react-pdf/renderer with EXACTLY THREE FIELDS per cover sheet
    (consolidated ref Q-B02 decision — enforced):
      1. QR Code (rendered as image from presigned S3 URL)
      2. Tracking Number — tracking.trackingNumber from the TrackingRecordSummary
         (e.g. 'DTS-2026-0001'). [RESOLVED — SPEC-GAP-TRACK-01, 2026-06-30] No longer
         a raw UUID placeholder; the real human-readable field now exists in the schema.
      3. Series Number (document.preliminary_number from documentsService.getDocumentById)
    multi_per_page layout: arrange multiple horizontal-rectangle cover sheets per A4 page.
    Upload the PDF to S3 at `tracking/cover-sheets/{uuid}.pdf`.
    Return a presigned GET URL with expiry from env var (default 900s).
  ```

  ## Procedure 3: tracking.getRoutingHistory
  ```
  Type:    query
  Input:   z.object({ documentId: z.string().uuid() })
  Output:  z.array(z.object({
             entryId: z.string().uuid(),
             fromOfficeId: z.string().uuid().nullable(),
             toOfficeId: z.string().uuid().nullable(),
             actorId: z.string().uuid(),
             actorDisplayName: z.string(),
             actionDescription: z.string(),
             timestamp: z.coerce.date()
           }))
  Callable by (own-office, unconditional):
    records_officer, dept_encoder, dept_approver, sp_secretary, sp_member,
    sp_presiding_officer, mayor, brgy_encoder, brgy_captain, auditor
  Callable by (cross-office, classification-gated — classification IN ('public','internal')):
    sp_secretary, sp_presiding_officer, mayor, records_officer, auditor
  ABAC (I1 §7.1 exactly):
    If subject.officeId === document.ownedByOfficeId → allow unconditionally.
    If cross-office → check document classification; allow only if 'public' or 'internal'.
  Business: Calls trackingService.getRoutingHistory(). Resolves actorDisplayName via
    IAM.getUserById() for each unique actorId. The public unauthenticated scan result is
    served by the publicLookupHandler REST endpoint (TASK-TRACK-008), NOT this procedure.
  ```

  ## Procedure 4: tracking.logRoutingEntry
  ```
  Type:    mutation
  Input:   z.object({
             documentId: z.string().uuid(),
             toOfficeId: z.string().uuid().nullable(),
             actionDescription: z.string().min(1)
           })
  Output:  z.object({ entryId: z.string().uuid() })
  Callable by: sp_secretary only
  ABAC (I1 §7.2): Document must be an SP Secretariat document (ownership check).
    Physical routing logging by other offices is DEFERRED TO PHASE 2 per B2 Module 5
    and I1 §7.2 explicit Phase 1 scoping. Do not extend this procedure to other roles.
  Business:
    Find tracking_record by documentId.
    fromOfficeId = tracking_record.current_custodian_office_id (current holder before move).
    Append routing_entry with fromOfficeId, toOfficeId, actor_id = ctx.userId, actionDescription.
    Update tracking_record.current_custodian_office_id = toOfficeId, last_moved_at = now().
  ```

  ## Procedure 5: tracking.scanQrCodeAuthenticated
  ```
  Type:    query
  Input:   z.object({ qrTrackingNumber: z.string().uuid() })
  Output:  z.object({
             documentType: z.string(),
             remarks: z.string().nullable(),
             fullRoutingHistory: z.array(z.object({
               actionDescription: z.string(),
               actorDisplayName: z.string(),
               timestamp: z.coerce.date()
             })),
             firstPageImageUrl: z.string().url(),
             getCopyAvailable: z.literal(true)
           })
  Callable by: records_officer, dept_encoder, dept_approver, sp_secretary, sp_member,
               sp_presiding_officer, mayor, brgy_encoder, brgy_captain, auditor
  ABAC (I1 §7.3): None beyond Global Gates — any authenticated non-citizen, non-system role.
  Business:
    Find qr_codes row by qrTrackingNumber (tracking_id). Throw NOT_FOUND if absent.
    Call documentsService.getDocumentById() for documentType and remarks.
    Call trackingService.getRoutingHistory() for the full routing history.
    Resolve actorDisplayName via IAM.getUserById() for each entry.
    firstPageImageUrl: [RESOLVED — SPEC-GAP-TRACK-02, 2026-06-30]
      Construct S3 key `documents/previews/{qrCode.documentId}/page-1.webp`
      (canonical convention set by TASK-DOCS-010's generateFirstPagePreview; changing
      this key requires updating TASK-DOCS-010 in lockstep). Generate a presigned
      S3 GET URL using this key with expiry from env var PREVIEW_URL_EXPIRY_SECONDS
      (default 3600). No classification gate on URL generation — this is authenticated
      staff; I1 §7.3 confirms no additional ABAC beyond Global Gates.
    getCopyAvailable: always literal true (points user toward Document Request Form).
  ```

  ## @react-pdf/renderer cover sheet (printQrCoverSheet)
  ```typescript
  import { Document, Page, View, Text, Image, pdf } from '@react-pdf/renderer';

  const CoverSheet = ({ tracking, docInfo, qrImageUrl, layout }) => (
    <Document>
      <Page size="A4" orientation={layout === 'multi_per_page' ? 'landscape' : 'portrait'}>
        {/* Each cover sheet: horizontal rectangle, takes only the space it needs */}
        <View style={{ flexDirection: 'row', margin: 10, border: '1px solid black', padding: 8 }}>
          <Image src={qrImageUrl} style={{ width: 80, height: 80 }} />
          <View style={{ marginLeft: 10 }}>
            {/* Field 2: Tracking Number — tracking.trackingNumber e.g. 'DTS-2026-0001' [RESOLVED — SPEC-GAP-TRACK-01] */}
            <Text style={{ fontSize: 10 }}>Tracking No: {tracking.trackingId}</Text>
            {/* Field 2: Series Number (preliminary_number) */}
            <Text style={{ fontSize: 10 }}>Series No: {docInfo.preliminaryNumber ?? 'N/A'}</Text>
          </View>
        </View>
        {/* multi_per_page: repeat the View block for each document */}
      </Page>
    </Document>
  );
  const pdfBuffer = await pdf(<CoverSheet ... />).toBuffer();
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.router.test.ts` passes
  - [ ] `getTrackingRecord` called by platform_admin (not in callable-by list) throws UNAUTHORIZED
  - [ ] `logRoutingEntry` called by dept_encoder throws UNAUTHORIZED (sp_secretary only)
  - [ ] `scanQrCodeAuthenticated` called by auditor succeeds (no classification gate for authenticated roles)
  - [ ] `printQrCoverSheet` returns `{ pdfPresignedUrl: z.string().url() }` pointing to S3
  - [ ] `pnpm typecheck` passes

---

## TASK-TRACK-008

Phase:          1
Module:         TRACK
Title:          Implement public QR scan REST endpoint (publicLookupHandler — unauthenticated)
Prerequisites:  [TASK-TRACK-006, TASK-DOCS-006]
Deliverables:
  - /apps/server/src/modules/tracking/tracking.public-handler.ts — createPublicLookupHandler factory producing a Fastify route handler for `GET /track/:trackingId`. Unauthenticated — no JWT required, no Global Gates, no IAM.evaluatePolicy call. Accepts a UUID in the path, resolves via repository.findQrCodeByTrackingId, calls documentsService.getDocumentById() for document type and remarks ([RESOLVED — SPEC-GAP-TRACK-03, 2026-06-30]: this caller is now in B2's Published API Call Matrix), calls trackingService.getRoutingHistory() for the routing history. Constructs firstPageImageUrl from the canonical S3 key `documents/previews/{documentId}/page-1.webp` and generates a presigned GET URL ([RESOLVED — SPEC-GAP-TRACK-02, 2026-06-30]: key convention set by TASK-DOCS-010's generateFirstPagePreview). Returns 404 for unknown tracking UUID. Never returns a full document file URL in any field of the response.
  - /apps/server/src/modules/tracking/__tests__/tracking.public-handler.test.ts — Vitest integration tests: valid UUID → 200 with correct shape; unknown UUID → 404; firstPageImageUrl is a presigned S3 URL (not a stub URL); response body contains no field whose value is a documents.versions file URL; endpoint accessible without Authorization header
Acceptance Criteria:
  - [ ] `GET /track/{valid-uuid}` returns HTTP 200 with `{ documentType, remarks, routingHistory, firstPageImageUrl, getCopyUrl }` shape
  - [ ] `GET /track/{unknown-uuid}` returns HTTP 404
  - [ ] `firstPageImageUrl` is a presigned S3 GET URL for key `documents/previews/{documentId}/page-1.webp` — not a stub URL
  - [ ] The response contains no direct document file URL (only the first-page pre-rendered image URL per §11.6)
  - [ ] The endpoint is accessible with NO Authorization header and NO session cookie — purely public
  - [ ] `pnpm typecheck` passes
AI Prompt: |
  You are implementing the public QR scan REST endpoint for the TRACK module of the Batac
  City LGU document-management platform. This unauthenticated Fastify GET route serves the
  scan result when anyone scans a QR code from a physical document.

  ## Route
  `GET /track/:trackingId`
  Registered directly on the Fastify instance (not under the tRPC /trpc prefix).
  This is an explicitly public route — NO authorization header, NO JWT, NO session cookie required.

  ## Business rules (consolidated ref §11.6 + B2 Module 5)
  - QR codes encode only a raw UUID. The :trackingId param IS that UUID.
  - Scan result: document type, remarks, routing history from draft, **first page visible;
    ALL other pages blurred**. Blurring is enforced server-side: never return a full file URL
    or attachment URL beyond the first-page pre-rendered image.
  - "Get a copy" affordance: a getCopyUrl pointing to the Document Request Form route.
    Physical full copy requires Document Request Form + VM + SP Secretary approval + payment.
  - This REST endpoint is the public path. The authenticated tRPC path (scanQrCodeAuthenticated)
    is separate and returns more detail (full routing history with actor names, getCopyAvailable flag).

  ## Response shape
  ```typescript
  interface PublicScanResult {
    documentType: string;        // e.g. "SP Resolution", "SP Ordinance"
    remarks: string | null;
    routingHistory: Array<{
      actionDescription: string;
      timestamp: string;         // ISO 8601
      // actorDisplayName omitted for public endpoint — privacy
    }>;
    firstPageImageUrl: string;   // presigned S3 URL for first-page WebP image
    getCopyUrl: string;          // link to Document Request Form
  }
  ```

  ## firstPageImageUrl — S3 key convention [RESOLVED — SPEC-GAP-TRACK-02, 2026-06-30]
  The first-page preview WebP is generated by TASK-DOCS-010's OcrService.generateFirstPagePreview()
  at document upload time and stored at a canonical key. Construct the key and generate a
  presigned GET URL — do NOT make an API call to the Documents module for this:
  ```typescript
  const previewKey = `documents/previews/${qrCode.documentId}/page-1.webp`;
  const firstPageImageUrl = await deps.s3Client.getSignedUrlPromise('getObject', {
    Bucket: deps.s3Bucket,
    Key: previewKey,
    Expires: parseInt(process.env.PREVIEW_URL_EXPIRY_SECONDS ?? '3600', 10),
  });
  ```
  IMPORTANT: This key convention is the inter-module contract between DOCS and TRACK.
  If TASK-DOCS-010 ever changes its storage path, this file MUST be updated in lockstep.
  There is no runtime API call between modules for this — the convention is documented
  here and in TASK-DOCS-010.

  ## Handler factory
  ```typescript
  export function createPublicLookupHandler(deps: {
    repository: TrackingRepository;
    trackingService: TrackingPublicAPI;
    documentsService: DocumentsPublicAPI; // injected — Documents Published API (TASK-DOCS-006)
    s3Client: S3Client;
    s3Bucket: string;
    config: { APP_BASE_URL: string; PREVIEW_URL_EXPIRY_SECONDS?: string };
  }) {
    return async function publicLookupHandler(
      request: FastifyRequest<{ Params: { trackingId: string } }>,
      reply: FastifyReply
    ) {
      const { trackingId } = request.params;

      // Validate UUID format (the QR content is always a UUID)
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(trackingId)) {
        return reply.status(400).send({ error: 'Invalid tracking ID format' });
      }

      const qrCode = await deps.repository.findQrCodeByTrackingId(trackingId);
      if (!qrCode) return reply.status(404).send({ error: 'Tracking ID not found' });

      // Cross-module call: Documents Published API
      // [RESOLVED — SPEC-GAP-TRACK-03, 2026-06-30] This caller is now in B2's
      // Published API Call Matrix and Module Dependency Map (Tracking → Documents).
      const document = await deps.documentsService.getDocumentById(qrCode.documentId);
      if (!document) return reply.status(404).send({ error: 'Document not found' });

      const history = await deps.trackingService.getRoutingHistory(qrCode.documentId, 'public-scan');

      // [RESOLVED — SPEC-GAP-TRACK-02, 2026-06-30]
      // Canonical S3 key set by TASK-DOCS-010's generateFirstPagePreview.
      // No API call — TRACK constructs the key directly from documentId.
      const previewKey = `documents/previews/${qrCode.documentId}/page-1.webp`;
      const expirySeconds = parseInt(deps.config.PREVIEW_URL_EXPIRY_SECONDS ?? '3600', 10);
      const firstPageImageUrl = await deps.s3Client.getSignedUrlPromise('getObject', {
        Bucket: deps.s3Bucket,
        Key: previewKey,
        Expires: expirySeconds,
      });

      return reply.send({
        documentType: document.documentTypeName ?? 'Document',
        remarks: document.remarks ?? null,
        routingHistory: history.map(e => ({
          actionDescription: e.actionDescription,
          timestamp: e.timestamp.toISOString(),
          // actorDisplayName intentionally omitted from public endpoint
        })),
        firstPageImageUrl,
        getCopyUrl: `${deps.config.APP_BASE_URL}/request-copy?documentId=${qrCode.documentId}`,
      });
    };
  }
  ```

  ## Cross-module dependency note (B2 Law #2 compliance)
  The call to `documentsService.getDocumentById()` is a Published API call (Law #2 compliant —
  goes through the barrel, not directly into the documents schema). The Fastify-injected
  `documentsService` is available at `fastify.documentsService` once the documents plugin is
  registered (TASK-DOCS-019). This caller is now in B2's Published API Call Matrix
  [RESOLVED — SPEC-GAP-TRACK-03, 2026-06-30].

  Before submitting this PR, confirm each item:
  - [ ] `GET /track/{valid-uuid}` returns HTTP 200 with `{ documentType, remarks, routingHistory, firstPageImageUrl, getCopyUrl }` shape
  - [ ] `GET /track/{unknown-uuid}` returns HTTP 404
  - [ ] `firstPageImageUrl` is a presigned S3 GET URL for key `documents/previews/{documentId}/page-1.webp` — not a stub URL
  - [ ] The response contains no direct document file URL (only the first-page pre-rendered image URL per §11.6)
  - [ ] The endpoint is accessible with NO Authorization header and NO session cookie — purely public
  - [ ] `pnpm typecheck` passes

---

## TASK-TRACK-009

Phase:          1
Module:         TRACK
Title:          Wire TRACK Fastify plugin, register event consumers, inject Published API
Prerequisites:  [TASK-TRACK-005, TASK-TRACK-007, TASK-TRACK-008, TASK-DOCS-019, CROSS-MODULE REF: INFRA — event bus/pgboss initialization task; exact TASK-INFRA-NNN not identifiable from TASK-DOCS list alone; resolve at integration pass]
Deliverables:
  - /apps/server/src/modules/tracking/tracking.plugin.ts — production Fastify plugin that: (1) instantiates TrackingRepository, QrCodeService, TrackingEventConsumer, and creates the trackingService Published API via createTrackingService; (2) subscribes to 'document.created' and 'workflow.step_completed' on the shared event bus, routing each to the TrackingEventConsumer handlers with error logging on failure; (3) registers the trackingRouter as a named member of the app's merged tRPC router; (4) registers the publicLookupHandler at `GET /track/:trackingId` on the Fastify instance (outside the tRPC prefix); (5) decorates the Fastify instance with `fastify.trackingService` (the Published API, needed by Documents cover sheet generator and Phase 3 Portal); (6) emits 'tracking.module.ready' log at plugin ready.
  - /apps/server/src/app.ts (edit) — registers trackingPlugin AFTER documentsPlugin and BEFORE workflowPlugin and notificationsPlugin; ordering: iamPlugin → organizationPlugin → documentsPlugin → trackingPlugin → [workflowPlugin stub] → [notificationsPlugin stub].
  - /apps/server/src/modules/tracking/__tests__/tracking.plugin.test.ts — Vitest smoke test: plugin registers without error on a test Fastify instance; fastify.trackingService is defined; GET /track/:trackingId route exists; 'tracking.module.ready' is logged.
  - [PRE-APPLIED — SPEC-GAP-TRACK-03 resolved 2026-06-30] /docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md — the two rows (Tracking → Documents for public scan handler and for printQrCoverSheet) were added to the Published API Call Matrix, and the Module Dependency Map Tracking entry was updated to list Documents (getDocumentById), during the spec-gap resolution pass before TASK-TRACK-009 was scheduled. No B2 edits are required at TASK-TRACK-009 execution time.
Acceptance Criteria:
  - [ ] `pnpm dev` starts without error; 'tracking.module.ready' log line appears after 'documents.module.ready'
  - [ ] `fastify.trackingService` is defined (not undefined) on the Fastify instance after plugin registration
  - [ ] `GET /track/{any-uuid}` returns 200 or 404 (never 500) from a running `pnpm dev` server
  - [ ] `curl -X POST .../trpc/tracking.logRoutingEntry` without auth returns UNAUTHORIZED (not 500)
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.plugin.test.ts` passes
AI Prompt: |
  You are wiring the complete TRACK module as a production Fastify plugin for the Batac
  City LGU document-management platform. This is the final integration task that connects
  all TRACK module components into a running server plugin.

  ## Plugin structure
  ```typescript
  import fp from 'fastify-plugin';
  import type { FastifyPluginAsync } from 'fastify';

  const trackingPlugin: FastifyPluginAsync = async (fastify) => {
    // 1. Instantiate infrastructure
    const repository = new TrackingRepository(fastify.db);
    const qrService  = new QrCodeService(repository, fastify.s3Client, fastify.config.S3_BUCKET);
    const eventConsumer = new TrackingEventConsumer(repository, qrService, fastify.log);

    // 2. Create Published API
    const trackingService = createTrackingService(repository);

    // 3. Subscribe to domain events (B2 Module 5 — exactly these two events)
    fastify.eventBus.on('document.created', (event) => {
      eventConsumer.handleDocumentCreated(event).catch((err) => {
        fastify.log.error({ err, eventId: event.eventId }, 'tracking: document.created handler failed');
        // dead-letter handling is owned by the INFRA pgboss dead-letter task
      });
    });
    fastify.eventBus.on('workflow.step_completed', (event) => {
      eventConsumer.handleWorkflowStepCompleted(event).catch((err) => {
        fastify.log.error({ err, eventId: event.eventId }, 'tracking: workflow.step_completed handler failed');
      });
    });

    // 4. Build tRPC router and register on app root
    const trackingRouter = createTrackingRouter({
      repository,
      trackingService,
      qrService,
      documentsService: fastify.documentsService,   // from documents plugin (TASK-DOCS-019)
      iamService:       fastify.iamService,          // from IAM plugin
      s3Client:         fastify.s3Client,
      s3Bucket:         fastify.config.S3_BUCKET,
      logger:           fastify.log,
    });
    fastify.decorate('trackingTrpcRouter', trackingRouter);
    // The app's root tRPC router merges trackingRouter under the 'tracking' namespace
    // in the same pattern used by documentsAppRouter in TASK-DOCS-019.

    // 5. Register public REST route (unauthenticated — outside tRPC prefix)
    const publicHandler = createPublicLookupHandler({
      repository,
      trackingService,
      documentsService: fastify.documentsService,
      s3Client:         fastify.s3Client,
      s3Bucket:         fastify.config.S3_BUCKET,
      config:           { APP_BASE_URL: fastify.config.APP_BASE_URL },
    });
    fastify.get('/track/:trackingId', publicHandler);

    // 6. Expose Published API for downstream modules
    fastify.decorate('trackingService', trackingService);

    // 7. TODO stubs for Phase 3 consumers (registered as reminders, not active handlers)
    // TODO(PORTAL-INTEGRATION): Portal (Phase 3) will call trackingService.getTrackingRecordForDocument()
    //   for the public scan display on the citizen portal.

    fastify.log.info('tracking.module.ready');
  };

  export default fp(trackingPlugin, {
    name: 'tracking-plugin',
    dependencies: ['documents-plugin', 'iam-plugin'],
  });
  ```

  ## Registration order in app.ts
  ```typescript
  // app.ts registration order after TASK-TRACK-009:
  await app.register(iamPlugin);
  await app.register(organizationPlugin);
  await app.register(documentsPlugin);
  await app.register(trackingPlugin);     // ADD HERE — after documentsPlugin
  // Future (stubs already present as comments):
  // await app.register(workflowPlugin);
  // await app.register(notificationsPlugin);
  ```

  ## B2 API Call Matrix update (required in same PR — Prohibited Pattern P5 violation if omitted)
  Add to the Published API Call Matrix table in b2-module-boundary-and-internal-api-contracts-v1.1.md:
  ```
  PRE-APPLIED — these rows were added during spec-gap resolution (2026-06-30) before
  TASK-TRACK-009 was scheduled. Verify they exist; do NOT add them a second time.
  | Tracking (public scan handler) | Documents | getDocumentById() | Get document type and remarks for public QR scan result display | [RESOLVED — SPEC-GAP-TRACK-03, 2026-06-30; TASK-TRACK-008] |
  | Tracking (tRPC printQrCoverSheet) | Documents | getDocumentById() | Get preliminary_number for cover sheet Series Number field | [RESOLVED — SPEC-GAP-TRACK-03, 2026-06-30; TASK-TRACK-007] |
  ```
  The Module Dependency Map Tracking block was also pre-updated. Verify the Tracking
  entry already lists Documents (getDocumentById) in its Calls list.

  ## Fastify type declarations
  If `fastify.trackingService` and `fastify.trackingTrpcRouter` are not already in the
  Fastify TypeScript declaration merge, add them following the same pattern used by
  `fastify.documentsService` and `fastify.documentsTrpcRouter` from TASK-DOCS-019.

  Before submitting this PR, confirm each item:
  - [ ] `pnpm dev` starts without error; 'tracking.module.ready' log line appears after 'documents.module.ready'
  - [ ] `fastify.trackingService` is defined (not undefined) on the Fastify instance after plugin registration
  - [ ] `GET /track/{any-uuid}` returns 200 or 404 (never 500) from a running `pnpm dev` server
  - [ ] `curl -X POST .../trpc/tracking.logRoutingEntry` without auth returns UNAUTHORIZED (not 500)
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm test apps/server/src/modules/tracking/__tests__/tracking.plugin.test.ts` passes

---

## Module Summary — TRACK

```
Module Summary — TRACK
Total tasks: 9
First executable task: TASK-TRACK-001 (prerequisite on TASK-DOCS-001 is resolvable;
  prerequisite on CROSS-MODULE REF: INFRA DB initialization task must be resolved at
  the Step 4 integration pass when the INFRA task list is loaded)
```

### Spec gaps — resolved 2026-06-30

**[RESOLVED — SPEC-GAP-TRACK-01] DTS-{YEAR}-{SEQUENCE} tracking number format**
- Decision: Option (a) — `tracking_number TEXT NOT NULL` column added to `tracking.qr_codes`;
  per-year auto-creating sequence `tracking.dts_{YEAR}_seq` (pattern matches Part 5's
  `fn_get_next_sequence_value` convention; sequence resets at year boundary, consistent
  with document final numbers). Helper function `tracking.fn_get_next_tracking_number(year)`
  is a SECURITY DEFINER function owned by `batac_migrate`, auto-creating the year sequence
  on demand as a safety net. [Inference] 4-digit padding (DTS-2026-0001) chosen as safer
  ceiling than 2–3 digits used for individual document series, since tracking numbers span
  ALL document types combined — confirm digit width with SP Secretariat before finalizing
  (H3's own precedent: H3 footnotes 1–3 for series-specific padding decisions).
- Files updated: C1 DDL (Part 7 table + function + Part 11 sequence), B2 TrackingRecordSummary
  interface (added `trackingNumber: string`), E1 getTrackingRecord output schema, TASK-TRACK-001
  (Drizzle schema, migration, grant script, AC), TASK-TRACK-002 (TrackingRecordSummary stub
  type), TASK-TRACK-003 (createQrCode signature, repository method getNextTrackingNumber,
  new AC), TASK-TRACK-004 (full rewrite — generateAndStore now calls getNextTrackingNumber
  and passes trackingNumber to createQrCode; dead generateCoverSheetPdf stub removed),
  TASK-TRACK-007 Procedure 2 (printQrCoverSheet now uses tracking.trackingNumber, not UUID).

**[RESOLVED — SPEC-GAP-TRACK-02] First-page image URL derivation**
- Decision: Option (a) — known S3 key convention `documents/previews/{documentId}/page-1.webp`.
  TASK-DOCS-010's `OcrService.generateFirstPagePreview()` generates the WebP unconditionally
  for every document version (NOT gated by public_visibility_rule — generation is a technical
  capability; access control is TRACK's responsibility at URL delivery time). TRACK constructs
  the key directly from `documentId` and generates a presigned GET URL; no new Documents
  Published API method needed.
- Files updated: TASK-DOCS-010 (new PreviewProvider interface + StubPreviewProvider, updated
  OCR flow, unconditional generation, AC), TASK-TRACK-007 Procedure 5 (scanQrCodeAuthenticated
  now constructs key and presigns URL), TASK-TRACK-008 (full deliverable/AC/AI Prompt rewrite
  — stub URL removed, presigned URL from S3 key convention).

**[RESOLVED — SPEC-GAP-TRACK-03] Two Tracking → Documents API calls missing from B2**
- Both `printQrCoverSheet → getDocumentById` and `publicLookupHandler → getDocumentById`
  are Law #2-compliant. Confirmed acceptable; added to B2 pre-execution rather than gating
  on TASK-TRACK-009 (a caller not in the matrix before code ships would be a P6 violation).
- Files updated: B2 v1.1 Published API Call Matrix (two new rows), B2 Module Dependency Map
  Tracking entry (added Documents to Calls list). TASK-TRACK-009 deliverable for B2 edit
  marked PRE-APPLIED.

### Deferred capabilities

**[DEFERRED — Phase 2: Physical routing logging by non-SP-Secretariat offices]**
B2 Module 5 and I1 §7.2 explicitly scope Phase 1 `tracking.logRoutingEntry` to `sp_secretary`
only. Phase 2 extends routing logging to `dept_encoder`, `dept_approver`, and other offices
that physically move documents between units. No Phase 1 task is generated for this scope.

### Cross-module dependency map

| Dependency | Used by | Task |
|---|---|---|
| TASK-DOCS-001 (documents schema migration) | tracking tables reference documents.documents.id as a logical cross-schema FK; migration applied after documents schema exists | TASK-TRACK-001 |
| TASK-DOCS-006 (DOCS Published API) | publicLookupHandler and printQrCoverSheet call getDocumentById() | TASK-TRACK-007, TASK-TRACK-008 |
| TASK-DOCS-019 (DOCS plugin wire) | fastify.documentsService available at tracking plugin init time | TASK-TRACK-009 |
| TASK-IAM-004 (IAM PolicyGuard + PolicyEvaluator) | SubjectContext type + ABAC guard pattern used by tRPC procedures | TASK-TRACK-007 |
| TASK-INFRA-005 (env validation) | S3 env vars required by QR image upload and cover sheet PDF upload | TASK-TRACK-004, TASK-TRACK-009 |
| CROSS-MODULE REF: INFRA — DB initialization | CREATE SCHEMA tracking is a Part 2 task owned by INFRA; resolve at integration pass | TASK-TRACK-001 |
| CROSS-MODULE REF: INFRA — MinIO/S3 bucket init | QR code images stored in S3-compatible bucket; bucket must exist before first upload | TASK-TRACK-004 |
| CROSS-MODULE REF: INFRA — pgboss/event bus init | event consumer subscriptions registered at plugin startup; event bus must be initialized | TASK-TRACK-009 |

### Downstream consumers of TRACK Published API

Per B2 Module Dependency Map and API Call Matrix:
- **DOCUMENTS** (cover sheet generator) → `getTrackingRecordForDocument()`: to include QR
  code image and tracking number on the printed document cover sheet. This call path becomes
  active as soon as both plugins are registered. Documents is Wave D (TASK-DOCS-019 already
  live); Tracking is Wave E — so the documents plugin will stub this call until tracking plugin
  is registered.
- **PORTAL** (Phase 3) → `getTrackingRecordForDocument()`: for the citizen-facing public scan
  display in the Phase 3 portal. Not yet built; registered as a TODO stub in TASK-TRACK-009.
