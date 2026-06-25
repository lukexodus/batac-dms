-- packages/database/scripts/post-migrate-grants.sql
--
-- Applied after every Drizzle migration run, from migrate.ts (TASK-INFRA-006),
-- using the batac_migrate connection. Must be idempotent — running this file
-- twice against the same database must produce no errors on the second run.
--
-- Execution context: batac_migrate (DDL owner; LOGIN).
--
-- Design: all grants use pg_namespace / information_schema checks so this
-- file is safe to run against a freshly initialised database (no schemas yet)
-- as well as against a fully migrated one. Schemas are created by Drizzle
-- migrations (TASK-INFRA-006); this file is re-run after each migration batch.
--
-- References:
--   C1 Part 12       — Authoritative grants and RLS policies
--   infra.md         — TASK-INFRA-005 conflict resolutions (2026-06-24)
--   B2 P3            — batac_app has ZERO access to the audit schema
--   TASK-AUDIT-003   — AuditRepository.fetchPreviousChainHash() requires SELECT on audit
--   TASK-AUDIT-005   — AuditQueryService.queryEvents() requires SELECT on audit
--   TASK-INFRA-023   — shared.event_bus_dead_letters table (shared schema entry below)

-- ── batac_app: DML on all domain schemas; zero access to audit ───────────────
--
-- SELECT, INSERT, UPDATE only — no DELETE (Invariant #2: no hard deletes).
-- DELETE is intentionally omitted; no explicit REVOKE needed since it was
-- never granted (noted here for documentation clarity, per C1 Part 12).
--
-- Phase 1 domain schemas + reserved Phase 2/3 schemas that batac_app may
-- eventually need. The 'shared' entry covers shared.event_bus_dead_letters
-- (TASK-INFRA-023). search_meta, portal, reporting are reserved namespaces
-- (C1 Part 13); granting here is safe — no tables exist yet, and
-- ALTER DEFAULT PRIVILEGES will take effect when Phase 2/3 tables are added.

DO $$
DECLARE
  s TEXT;
  app_schemas TEXT[] := ARRAY[
    'iam', 'organization', 'documents', 'workflow',
    'tracking', 'records', 'notifications',
    'search_meta', 'portal', 'reporting', 'shared'
  ];
BEGIN
  FOREACH s IN ARRAY app_schemas LOOP
    -- Only grant if the schema exists (schemas are created by Drizzle migrations).
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = s) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO batac_app', s);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO batac_app', s);
      EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO batac_app', s);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE ON TABLES TO batac_app', s);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO batac_app', s);
    END IF;
  END LOOP;
END
$$;

-- workflow.workflow_events is append-only (B4): explicitly revoke UPDATE/DELETE.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'workflow' AND table_name = 'workflow_events'
  ) THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON workflow.workflow_events FROM batac_app';
  END IF;
END
$$;

-- ── audit schema: batac_audit ONLY — batac_app has ZERO access (B2 P3) ────────
--
-- [CONFLICT 2 → RESOLVED 2026-06-24]: The original draft incorrectly granted
-- batac_app INSERT on the audit schema. batac_app has no USAGE on audit.
-- See infra.md module summary conflict #6 for the full resolution record.
--
-- batac_audit requires:
--   SELECT — for AuditRepository.fetchPreviousChainHash() (TASK-AUDIT-003)
--             and AuditQueryService.queryEvents() (TASK-AUDIT-005)
--   INSERT — write path for new audit events
-- UPDATE and DELETE are explicitly revoked (Invariant #3: append-only audit log).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'audit') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA audit TO batac_audit';
    EXECUTE 'GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO batac_audit';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT SELECT, INSERT ON TABLES TO batac_audit';
    EXECUTE 'REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA audit FROM batac_audit';
  END IF;
END
$$;

-- Sequence for audit event ordering (C1 L1884).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.sequences
    WHERE sequence_schema = 'audit' AND sequence_name = 'events_sequence_seq'
  ) THEN
    EXECUTE 'GRANT USAGE ON SEQUENCE audit.events_sequence_seq TO batac_audit';
  END IF;
END
$$;

-- ── batac_it_admin: IT Admin ops; no document file content (Invariant #10) ───

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'documents' AND table_name = 'documents'
  ) THEN
    EXECUTE 'GRANT USAGE ON SCHEMA documents TO batac_it_admin';
    EXECUTE 'GRANT SELECT, UPDATE ON documents.documents TO batac_it_admin';
    -- Invariant #10: IT admin has no document file content access — not even
    -- for public documents. Revoke explicitly to block inheritance.
    EXECUTE 'REVOKE ALL ON documents.versions FROM batac_it_admin';
    EXECUTE 'REVOKE ALL ON documents.attachments FROM batac_it_admin';
  END IF;
END
$$;

-- ── batac_readonly: monitoring/reporting read-only access ────────────────────

DO $$
DECLARE
  s TEXT;
  readable_schemas TEXT[] := ARRAY[
    'iam', 'organization', 'documents', 'workflow',
    'tracking', 'records', 'notifications'
  ];
BEGIN
  FOREACH s IN ARRAY readable_schemas LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = s) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO batac_readonly', s);
      EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO batac_readonly', s);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO batac_readonly', s);
    END IF;
  END LOOP;
END
$$;

-- ── pgboss schema: batac_app needs full access for pg-boss job queue ─────────
-- pg-boss creates and manages its own schema. Conditional so the SQL is safe
-- to run before pg-boss has initialised.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON SCHEMA pgboss TO batac_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pgboss TO batac_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pgboss TO batac_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT ALL PRIVILEGES ON TABLES TO batac_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT ALL PRIVILEGES ON SEQUENCES TO batac_app';
  END IF;
END
$$;
