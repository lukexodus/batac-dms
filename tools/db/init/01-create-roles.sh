#!/bin/bash
# tools/db/init/01-create-roles.sh
#
# Creates the five application database roles on first container start.
# This script runs automatically once — when the PostgreSQL container initialises
# against an empty postgres_data volume — via the
# /docker-entrypoint-initdb.d mechanism.
#
# Prerequisites:
#   Environment variables must be set before this script is invoked:
#     DB_MIGRATE_PASSWORD  — password for batac_migrate (LOGIN; DDL owner)
#     DB_APP_PASSWORD      — password for batac_app     (LOGIN; runtime DML)
#     DB_AUDIT_PASSWORD    — password for batac_audit   (LOGIN; audit only)
#
#   batac_it_admin and batac_readonly are NOLOGIN service roles with no
#   password; applications connect via batac_app and SET ROLE as needed.
#
# References: C1 Part 2; I3 §8.1; infra.md TASK-INFRA-005.
#
# Note: CREATE ROLE ... IF NOT EXISTS is not supported in PostgreSQL. Idempotency
# is achieved via DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ...) $$
# which is the standard PostgreSQL pattern for conditional role creation.
#
# batac_migrate is LOGIN because DATABASE_URL_MIGRATE is a direct connection
# string and NOLOGIN roles cannot authenticate. This is consistent across
# C1 Part 15 (resolved decision, 2026-06) and C5's "Migration-Owning Role
# Name" addendum, both of which specify LOGIN as of this writing.
# This script follows that resolution.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

psql -v ON_ERROR_STOP=1 \
     --username "${POSTGRES_USER:-postgres}" \
     --dbname "${POSTGRES_DB:-batac_lgu}" \
     <<-EOSQL

DO \$\$
BEGIN

  -- ── batac_migrate: DDL owner; migration runner (LOGIN) ──────────────────────
  -- LOGIN is required: DATABASE_URL_MIGRATE is a direct connection string.
  -- Password is set via ALTER ROLE, not embedded in CREATE ROLE DDL, so the
  -- credential never appears in pg_stat_activity query text.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_migrate') THEN
    CREATE ROLE batac_migrate WITH LOGIN;
  ELSE
    ALTER ROLE batac_migrate WITH LOGIN;
  END IF;
  ALTER ROLE batac_migrate PASSWORD '${DB_MIGRATE_PASSWORD:-migrate_devpassword}';
  GRANT ALL PRIVILEGES ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_migrate;
  -- PostgreSQL 15+ revokes CREATE on the public schema from PUBLIC by default;
  -- GRANT ALL PRIVILEGES ON DATABASE does not include this. batac_migrate owns
  -- public.fn_set_updated_at() (created in migration 0002), so it needs CREATE
  -- on public explicitly, or migration 0002 fails on a fresh database. (LOG-0012)
  GRANT CREATE ON SCHEMA public TO batac_migrate;

  -- ── batac_app: runtime application service account (LOGIN) ───────────────────
  -- Applications connect as this role; schema-level grants applied in
  -- post-migrate-grants.sql after migrations create the schemas.
  -- Full DML on all domain schemas EXCEPT the audit schema
  -- (B2 Prohibited Pattern P3 — zero audit access).
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_app') THEN
    CREATE ROLE batac_app WITH LOGIN;
  ELSE
    ALTER ROLE batac_app WITH LOGIN;
  END IF;
  ALTER ROLE batac_app PASSWORD '${DB_APP_PASSWORD:-app_devpassword}';
  GRANT CONNECT ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_app;

  -- ── batac_audit: audit log INSERT + chain-hash SELECT; no modifications (LOGIN)
  -- SELECT required by AuditRepository.fetchPreviousChainHash() (TASK-AUDIT-003)
  -- and AuditQueryService.queryEvents() (TASK-AUDIT-005).
  -- UPDATE and DELETE revoked explicitly at the grant layer (not just application
  -- code) per Invariant #3 and D-ABAC-04. Schema-level grants applied by
  -- post-migrate-grants.sql after each migration.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_audit') THEN
    CREATE ROLE batac_audit WITH LOGIN;
  ELSE
    ALTER ROLE batac_audit WITH LOGIN;
  END IF;
  ALTER ROLE batac_audit PASSWORD '${DB_AUDIT_PASSWORD:-audit_devpassword}';
  GRANT CONNECT ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_audit;

  -- ── batac_it_admin: IT Admin ops; metadata access; no document content ───────
  -- NOLOGIN; no password. Connected to via SET ROLE after batac_app login.
  -- Schema-level grants (SELECT, UPDATE on documents.documents; REVOKE ALL on
  -- documents.versions and documents.attachments) applied by
  -- post-migrate-grants.sql per Invariant #10.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_it_admin') THEN
    CREATE ROLE batac_it_admin WITH NOLOGIN;
  ELSE
    ALTER ROLE batac_it_admin WITH NOLOGIN;
  END IF;
  GRANT pg_monitor TO batac_it_admin;

  -- ── batac_readonly: read-only monitoring/reporting ───────────────────────────
  -- NOLOGIN; no password. Connected to via SET ROLE after batac_app login.
  -- Schema-level SELECT grants applied by post-migrate-grants.sql.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_readonly') THEN
    CREATE ROLE batac_readonly WITH NOLOGIN;
  ELSE
    ALTER ROLE batac_readonly WITH NOLOGIN;
  END IF;

END
\$\$;

EOSQL

echo "[01-create-roles] Roles batac_migrate, batac_app, batac_audit, batac_it_admin, batac_readonly created."
-- Allow batac_migrate to change owners of tables to batac_app
GRANT batac_app TO batac_migrate;
