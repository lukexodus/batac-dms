# L2 — Docker and Docker Compose Specification · Pre-Development Reference

**Status:** Active — Part 13 decisions resolved June 2026 **Last updated:** June 2026 **Audience:** Development team (internal reference) **Companion documents:** D5 (Deployment Diagram), L1 (Environment Variable Catalog)

## Table of Contents

- [L31–L46] Overview — Scope boundaries and local host-execution versus production full-stack containerization architectural models.
- [L47–L80] File Layout — Monorepo file tree and compose filename conventions preventing accidental local production runs.
- [L81–L261] Part 1 — Local Development Compose (`compose.yml`) — Compose definitions for local development infrastructure services including PostgreSQL, MinIO, Mailpit, and Meilisearch.
  - [L234–L261] Developer quick reference — Docker Compose commands for starting services, viewing logs, resetting database volumes, and connecting to psql.
- [L262–L381] Part 2 — PostgreSQL Initialization Script — Superuser bash script creating the migrate, application, and insert-only audit database roles upon first startup.
  - [L313–L381] Post-migration grants (`packages/database/scripts/post-migrate-grants.sql`) — Idempotent SQL granting schema DML, revoking audit modifications, and giving pgboss ownership to batac_app.
- [L382–L612] Part 3 — Production / Staging Compose (`compose.prod.yml`) — Production compose spec detailing Nginx reverse-proxying, Fastify servers, and PostgreSQL primary-standby replication configuration.
- [L613–L740] Part 4 — Dockerfile: Fastify Server (`apps/server/Dockerfile`) — Multi-stage Fastify build using turbo prune, dumb-init PID 1, and unprivileged node user execution.
  - [L727–L740] OCR note — WASM-based OCR setup and instructions for offline language pack pre-bundling in the production image.
- [L741–L816] Part 5 — Dockerfile: Web SPA (`apps/web/Dockerfile`) — Multi-stage Vite build baking public environment variables into the final static frontend image.
- [L817–L952] Part 6 — Nginx Configuration (`nginx/batac.conf.template`) — Reverse proxy rules for SSL termination, static caching, server-sent events buffering overrides, and API routing.
  - [L937–L952] New file: `nginx/entrypoint.sh` — Shell script executing envsubst on batac.conf.template and starting Nginx reverse proxy at container boot.
- [L953–L971] Part 7 — Health Check Reference — Probe commands and intervals for service liveness, separating Fastify liveness from database readiness checks.
- [L972–L1006] Part 8 — Volume Strategy — Safety analysis of named volumes, bind mount mappings, and local database wipe-and-reset instructions.
- [L1007–L1082] Part 9 — Environment Variable Injection — Dotenv hierarchy, container runtime injection paths, build-time baking rules, and production secrets management guidelines.
- [L1083–L1187] Part 10 — Migration and Seed Entrypoint — Entrypoint orchestration for database migration execution and seed runs in development and staging environments.
  - [L1085–L1137] `apps/server/entrypoint.sh` — Shell script executing Drizzle migrations, running dev/staging seeds, and starting Fastify under dumb-init.
  - [L1138–L1187] Migration runner (`packages/database/scripts/migrate.ts`) — TypeScript runner applying Drizzle migrations and executing post-migrate SQL grants via the migration user role.
- [L1188–L1207] Part 11 — Native Dependencies — Native build tool requirements, Alpine binary compatibility risks for argon2, and tesseract WASM details.
- [L1208–L1243] Part 12 — Startup Dependency Order — Sequence graph mapping service startup check dependencies for local development and production environments.
- [L1244–L1264] Part 13 — Decision Register — All nine L2-01–L2-09 items resolved June 2026. See companion ADR files for full rationale.

---

## Overview

This document specifies Docker and Docker Compose configuration for all deployment contexts. It covers the local development infrastructure compose file, the production/staging full-stack compose file, Dockerfiles for the Fastify server and Vite SPA, the Nginx reverse proxy configuration, PostgreSQL role initialization scripts, health check definitions for all services, volume strategy, environment variable injection patterns referenced from L1, the migration and seed entrypoint, and the service startup dependency graph.

### Scope boundaries

The deployment topology is defined in D5. This document translates that topology into concrete file content. Environment variable definitions and Zod validation schemas live in L1 — this document references L1 sections by name rather than re-defining variables.

### Local vs. production development model

In local development, only infrastructure services run in Docker (PostgreSQL, MinIO, Mailpit, Meilisearch). The application code (`/apps/server` and `/apps/web`) runs directly on the host machine for hot-reload support. Running application servers inside Docker during active development adds layer-caching friction and slows the edit-compile-observe cycle without meaningful benefit.

In staging and production, the full stack is containerized. A single Nginx container terminates TLS, serves the `/apps/web` static bundle from disk, and proxies `/api/*` to the Fastify process. The Fastify process runs as a single Node.js container handling tRPC, REST + OpenAPI, SSE, pgboss workers, node-cron, OCR, QR generation, PDF generation, and Nodemailer. pgboss workers co-locate inside the Fastify process — no separate queue container is deployed.

---

## File Layout

```
/                                     ← monorepo root
├── compose.yml                       ← local dev infrastructure only
├── compose.prod.yml                  ← production / staging full stack
├── .env.example                      ← committed to version control; no secrets
├── .env                              ← git-ignored; developer local values
├── nginx/
│   ├── batac.conf.template           ← reverse proxy + static serving + SSE config (envsubst template — see [ADR-L2-04](l2-docker-and-docker-compose-specification-adrs/ADR-INF-004-nginx-domain-name-injection.md))
│   └── entrypoint.sh                 ← runs envsubst on batac.conf.template at container start
├── apps/
│   ├── server/
│   │   ├── Dockerfile                ← multi-stage; Fastify production image
│   │   └── entrypoint.sh             ← migrate → grant → seed → start
│   └── web/
│       └── Dockerfile                ← multi-stage; Vite build output
├── packages/
│   └── database/
│       ├── migrations/               ← Drizzle Kit generated SQL files
│       └── scripts/
│           ├── migrate.ts            ← runs migrations + post-migrate grants
│           ├── seed.ts               ← dev/staging seed data (idempotent)
│           └── post-migrate-grants.sql
└── tools/
    └── db/
        └── init/
            └── 01-create-roles.sh    ← PostgreSQL init; runs once on empty volume
```

**Naming convention for compose files:** `compose.yml` is the default filename Docker Compose resolves without a `-f` flag. `compose.prod.yml` requires `-f compose.prod.yml` explicitly. This prevents accidental production deployments during local development.

---

## Part 1 — Local Development Compose (`compose.yml`)

Only infrastructure services are defined here. Application servers start on the host via `pnpm dev` (Turborepo) after the infrastructure is healthy.

```yaml
# compose.yml — local development infrastructure
# Start all services:    docker compose up -d
# With Meilisearch:      docker compose --profile search up -d
# Reset everything:      docker compose down -v

name: batac-dev

services:

  # ────────────────────────────────────────────────────────────────────────────
  # PostgreSQL 16 — single instance; no standby in local dev
  # Production primary + standby topology is in compose.prod.yml
  # ────────────────────────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-batac_lgu}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_SUPERUSER_PASSWORD:-postgres}
      # Passed through to tools/db/init/01-create-roles.sh
      DB_APP_PASSWORD: ${DB_APP_PASSWORD:-app_devpassword}
      DB_AUDIT_PASSWORD: ${DB_AUDIT_PASSWORD:-audit_devpassword}
      DB_MIGRATE_PASSWORD: ${DB_MIGRATE_PASSWORD:-migrate_devpassword}
      TZ: Asia/Manila
    ports:
      - "${DB_PORT_EXPOSED:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./tools/db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d ${DB_NAME:-batac_lgu}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 15s


  # ────────────────────────────────────────────────────────────────────────────
  # MinIO — S3-compatible object storage replacing Cloudflare R2 in local dev
  # S3 API:   http://localhost:9000   (set S3_ENDPOINT=http://localhost:9000)
  # Console:  http://localhost:9001
  # ────────────────────────────────────────────────────────────────────────────
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minio}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minio123456}
      TZ: Asia/Manila
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s


  # ────────────────────────────────────────────────────────────────────────────
  # MinIO init — creates required buckets on first run, then exits
  # Uses the MinIO Client (mc) image. Runs once; restart: no prevents retries.
  # ────────────────────────────────────────────────────────────────────────────
  minio-init:
    image: minio/mc:latest
    restart: no
    depends_on:
      minio:
        condition: service_healthy
    environment:
      # Passed to the container; shell reads them at runtime (hence $$VAR below
      # which prevents Docker Compose from consuming the $ at config-parse time)
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-minio}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-minio123456}
      S3_BUCKET: ${S3_BUCKET:-batac-documents}
      S3_BACKUP_BUCKET: ${S3_BACKUP_BUCKET:-batac-backups}
    entrypoint: >
      /bin/sh -c "
        mc alias set local http://minio:9000 $$S3_ACCESS_KEY $$S3_SECRET_KEY &&
        mc mb --ignore-existing local/$$S3_BUCKET &&
        mc mb --ignore-existing local/$$S3_BACKUP_BUCKET &&
        mc anonymous set none local/$$S3_BUCKET &&
        mc version enable local/$$S3_BUCKET &&
        echo '[minio-init] Buckets ready.'
      "


  # ────────────────────────────────────────────────────────────────────────────
  # Mailpit — local SMTP server and web UI for email preview
  # SMTP:    localhost:1025   (set SMTP_HOST=localhost, SMTP_PORT=1025)
  # Web UI:  http://localhost:8025
  # Set SMTP_REJECT_UNAUTHORIZED=false and SMTP_SECURE=false in .env
  # ────────────────────────────────────────────────────────────────────────────
  mailpit:
    image: axllent/mailpit:latest
    restart: unless-stopped
    ports:
      - "1025:1025"
      - "8025:8025"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:8025"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s


  # ────────────────────────────────────────────────────────────────────────────
  # Meilisearch — Phase 2 reserved slot; not required for Phase 1
  # Activate with:   docker compose --profile search up -d
  # Set FEATURE_MEILISEARCH_ENABLED=true and SEARCH_MEILISEARCH_URL=http://localhost:7700
  # ────────────────────────────────────────────────────────────────────────────
  meilisearch:
    image: getmeili/meilisearch:latest
    restart: unless-stopped
    profiles:
      - search
    environment:
      MEILI_MASTER_KEY: ${SEARCH_MEILISEARCH_MASTER_KEY:-meilisearch-dev-key-changeme}
      MEILI_NO_ANALYTICS: "true"
      MEILI_ENV: development
      TZ: Asia/Manila
    ports:
      - "7700:7700"
    volumes:
      - meilisearch_data:/meili_data
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:7700/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s


volumes:
  postgres_data:
    driver: local
  minio_data:
    driver: local
  meilisearch_data:
    driver: local
```

### Developer quick reference

```bash
# Start infrastructure (postgres, minio, mailpit):
docker compose up -d

# Include Meilisearch (Phase 2):
docker compose --profile search up -d

# Watch logs for a specific service:
docker compose logs -f postgres
docker compose logs -f minio

# Check all service health:
docker compose ps

# Stop without removing volumes (data is preserved):
docker compose down

# Full reset — stops containers and wipes all named volumes:
docker compose down -v

# Connect to PostgreSQL as superuser:
docker compose exec postgres psql -U postgres -d batac_lgu
```

---

## Part 2 — PostgreSQL Initialization Script

This script runs automatically the first time the PostgreSQL container starts against an **empty** `postgres_data` volume. It does not re-run on subsequent restarts. Its only purpose is to create the three application database roles. Schema creation and grants happen later via Drizzle migrations and `post-migrate-grants.sql`.

> PostgreSQL `docker-entrypoint-initdb.d` scripts are executed by the image's entrypoint as the superuser against the database named by `POSTGRES_DB`. Shell scripts in that directory can reference environment variables passed into the container.

```bash
#!/bin/bash
# tools/db/init/01-create-roles.sh
# Creates the three application database roles on first container start.
# Safe to inspect but not to re-run manually against a populated database —
# roles already exist on subsequent starts.

set -e

psql -v ON_ERROR_STOP=1 \
     --username "postgres" \
     --dbname "${POSTGRES_DB:-batac_lgu}" \
     <<-EOSQL

  -- ── Migration role ───────────────────────────────────────────────────────
  -- DDL privileges. Used by Drizzle Kit and the entrypoint migration runner.
  -- NEVER used by the running Fastify process.
  CREATE USER batac_migrate
    WITH ENCRYPTED PASSWORD '${DB_MIGRATE_PASSWORD:-migrate_devpassword}';
  GRANT ALL PRIVILEGES ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_migrate;

  -- ── Application runtime role ──────────────────────────────────────────────
  -- DML privileges on all schemas except audit.
  -- This is the role in DATABASE_URL_APP.
  CREATE USER batac_app
    WITH ENCRYPTED PASSWORD '${DB_APP_PASSWORD:-app_devpassword}';
  GRANT CONNECT ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_app;

  -- ── Audit log writer role ─────────────────────────────────────────────────
  -- INSERT-only on the audit schema.
  -- This is the role in DATABASE_URL_AUDIT.
  -- UPDATE and DELETE are deliberately not granted and must never be.
  CREATE USER batac_audit
    WITH ENCRYPTED PASSWORD '${DB_AUDIT_PASSWORD:-audit_devpassword}';
  GRANT CONNECT ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_audit;

  -- Schema-level grants are not applied here because schemas do not exist yet.
  -- They are created by Drizzle migrations and then granted in
  -- packages/database/scripts/post-migrate-grants.sql (run by entrypoint.sh).

EOSQL

echo "[01-create-roles] Roles batac_migrate, batac_app, batac_audit created."
```

### Post-migration grants (`packages/database/scripts/post-migrate-grants.sql`)

Drizzle creates all schemas and tables. This SQL runs immediately after every migration pass — applied from within `migrate.ts` using the `batac_migrate` connection. It is written to be idempotent.

```sql
-- packages/database/scripts/post-migrate-grants.sql
-- Applied after every Drizzle migration run.
-- Grants the correct DML permissions to batac_app and batac_audit.
-- Idempotent: safe to re-apply on every container restart.

-- ── Application schemas — full DML for batac_app ──────────────────────────
DO $$
DECLARE
  s TEXT;
  app_schemas TEXT[] := ARRAY[
    'iam', 'organization', 'documents', 'workflow',
    'tracking', 'records', 'notifications',
    'search_meta', 'portal', 'reporting'
  ];
BEGIN
  FOREACH s IN ARRAY app_schemas LOOP
    EXECUTE format(
      'GRANT USAGE ON SCHEMA %I TO batac_app', s);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO batac_app', s);
    EXECUTE format(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO batac_app', s);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO batac_app', s);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I
       GRANT USAGE, SELECT ON SEQUENCES TO batac_app', s);
  END LOOP;
END
$$;

-- ── Audit schema — INSERT only ────────────────────────────────────────────
-- batac_app and batac_audit may only INSERT into the audit schema.
-- UPDATE and DELETE are explicitly revoked as a second layer of defense.
GRANT USAGE ON SCHEMA audit TO batac_app, batac_audit;
GRANT INSERT ON ALL TABLES IN SCHEMA audit TO batac_app, batac_audit;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit
  GRANT INSERT ON TABLES TO batac_app, batac_audit;
REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA audit
  FROM batac_app, batac_audit;

-- ── pgboss schema — full access for batac_app ─────────────────────────────
-- pgboss manages its own schema. batac_app needs ownership to run the
-- job queue. Grants all privileges on pgboss objects.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss') THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON SCHEMA pgboss TO batac_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pgboss TO batac_app';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pgboss TO batac_app';
    EXECUTE
      'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss
       GRANT ALL PRIVILEGES ON TABLES TO batac_app';
    EXECUTE
      'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss
       GRANT ALL PRIVILEGES ON SEQUENCES TO batac_app';
  END IF;
END
$$;
```

---

## Part 3 — Production / Staging Compose (`compose.prod.yml`)

This file describes the full containerized stack. Notable differences from local development:

- Nginx serves the static web bundle and proxies `/api/*` to Fastify
- The web app and server each run from their built Docker images
- PostgreSQL uses a primary + standby topology
- MinIO is gated behind the `onpremise` profile; cloud production points `S3_ENDPOINT` at Cloudflare R2 (an external service, not containerized)
- Meilisearch is gated behind the `search` profile (Phase 2)

> [Inference] The PostgreSQL replication approach below uses the `bitnami/postgresql:16` image. Bitnami's image handles streaming replication setup via environment variables, avoiding manual `pg_hba.conf` and recovery configuration. The official `postgres:16` image requires those files to be managed by init scripts. Either is functionally correct. Confirm this choice against the team's operational preferences before production deployment.

```yaml
# compose.prod.yml — production and staging full stack
# Usage:  docker compose -f compose.prod.yml up -d
# On-premise with MinIO:
#   docker compose -f compose.prod.yml --profile onpremise up -d
# With Meilisearch (Phase 2):
#   docker compose -f compose.prod.yml --profile search up -d

name: batac-prod

services:

  # ────────────────────────────────────────────────────────────────────────────
  # web-build — copies the compiled SPA bundle into the web_static shared volume
  # Runs once at deploy time then exits. Nginx reads from the same volume.
  # ────────────────────────────────────────────────────────────────────────────
  web-build:
    image: ${CONTAINER_REGISTRY:-ghcr.io/batac-city}/web:${DOCKER_IMAGE_TAG:-latest}
    restart: no
    volumes:
      - web_static:/target
    entrypoint: >
      /bin/sh -c "
        cp -r /app/dist/. /target/ &&
        echo '[web-build] Bundle copied to web_static volume.'
      "


  # ────────────────────────────────────────────────────────────────────────────
  # Nginx — TLS termination, static bundle serving, /api/* reverse proxy
  # Starts only after the server passes its health check.
  # TLS certificates are host-managed (Certbot, pre-provisioned, or equivalent).
  # ────────────────────────────────────────────────────────────────────────────
  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      server:
        condition: service_healthy
      web-build:
        condition: service_completed_successfully
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - web_static:/usr/share/nginx/html:ro
      - ./nginx/batac.conf:/etc/nginx/conf.d/batac.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    environment:
      TZ: Asia/Manila
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s


  # ────────────────────────────────────────────────────────────────────────────
  # Fastify server — tRPC + REST + SSE + pgboss + node-cron + OCR + QR + PDF
  # ────────────────────────────────────────────────────────────────────────────
  server:
    image: ${CONTAINER_REGISTRY:-ghcr.io/batac-city}/server:${DOCKER_IMAGE_TAG:-latest}
    restart: unless-stopped
    depends_on:
      postgres-primary:
        condition: service_healthy
    env_file:
      - .env.production
    environment:
      # Override DB_HOST to use Docker internal network hostname.
      # DATABASE_URL_APP in .env.production should use this hostname.
      DB_HOST: postgres-primary
      APP_HOST: "0.0.0.0"
      TRUST_PROXY: "true"
      LOG_PRETTY: "false"
      TZ: Asia/Manila
      APP_INSTANCE_ID: server-01
    # Port 3000 is accessible inside the Docker network.
    # Nginx is the only external entry point; this mapping is for debugging only.
    # [Inference] Remove this port mapping in a hardened production deployment.
    ports:
      - "127.0.0.1:3000:3000"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider",
             "http://localhost:3000${HEALTH_CHECK_PATH:-/health}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s


  # ────────────────────────────────────────────────────────────────────────────
  # PostgreSQL Primary — streaming replication enabled
  # [Inference] Uses bitnami/postgresql:16 for simplified replication config
  # ────────────────────────────────────────────────────────────────────────────
  postgres-primary:
    image: bitnami/postgresql:16
    restart: unless-stopped
    environment:
      POSTGRESQL_REPLICATION_MODE: master
      POSTGRESQL_REPLICATION_USER: replicator
      POSTGRESQL_REPLICATION_PASSWORD: ${DB_REPLICATION_PASSWORD}
      POSTGRESQL_USERNAME: batac_app
      POSTGRESQL_PASSWORD: ${DB_APP_PASSWORD}
      POSTGRESQL_DATABASE: ${DB_NAME:-batac_lgu}
      POSTGRESQL_POSTGRES_PASSWORD: ${DB_SUPERUSER_PASSWORD}
      TZ: Asia/Manila
    volumes:
      - postgres_primary_data:/bitnami/postgresql
      # [Inference] Bitnami's postgresql image stores data at /bitnami/postgresql;
      # init scripts go in /docker-entrypoint-initdb.d as with the official image
      - ./tools/db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U batac_app -d ${DB_NAME:-batac_lgu}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 20s


  # ────────────────────────────────────────────────────────────────────────────
  # PostgreSQL Standby — hot standby; WAL streaming replication
  # Lag target ≤ 60 s per architecture constraint (D5)
  # [Inference] Bitnami slave mode handles recovery.conf and pg_hba.conf
  # ────────────────────────────────────────────────────────────────────────────
  postgres-standby:
    image: bitnami/postgresql:16
    restart: unless-stopped
    depends_on:
      postgres-primary:
        condition: service_healthy
    environment:
      POSTGRESQL_REPLICATION_MODE: slave
      POSTGRESQL_MASTER_HOST: postgres-primary
      POSTGRESQL_MASTER_PORT_NUMBER: "5432"
      POSTGRESQL_REPLICATION_USER: replicator
      POSTGRESQL_REPLICATION_PASSWORD: ${DB_REPLICATION_PASSWORD}
      POSTGRESQL_USERNAME: batac_app
      POSTGRESQL_PASSWORD: ${DB_APP_PASSWORD}
      TZ: Asia/Manila
    volumes:
      - postgres_standby_data:/bitnami/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U batac_app"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s


  # ────────────────────────────────────────────────────────────────────────────
  # MinIO — on-premise S3 storage path
  # Only active when --profile onpremise is passed.
  # In cloud production, set S3_ENDPOINT in .env.production to Cloudflare R2.
  # ────────────────────────────────────────────────────────────────────────────
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    profiles:
      - onpremise
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY}
      TZ: Asia/Manila
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s


  # ────────────────────────────────────────────────────────────────────────────
  # Meilisearch — Phase 2 reserved slot
  # Only active when --profile search is passed.
  # Requires FEATURE_MEILISEARCH_ENABLED=true and SEARCH_MEILISEARCH_* vars.
  # ────────────────────────────────────────────────────────────────────────────
  meilisearch:
    image: getmeili/meilisearch:latest
    restart: unless-stopped
    profiles:
      - search
    environment:
      MEILI_MASTER_KEY: ${SEARCH_MEILISEARCH_MASTER_KEY}
      MEILI_NO_ANALYTICS: "true"
      MEILI_ENV: production
      TZ: Asia/Manila
    volumes:
      - meilisearch_data:/meili_data
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:7700/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s


volumes:
  web_static:
    driver: local
  postgres_primary_data:
    driver: local
  postgres_standby_data:
    driver: local
  minio_data:
    driver: local
  meilisearch_data:
    driver: local
```

> **Port 3000 binding note:** The server's port mapping uses `127.0.0.1:3000:3000`, which binds only to the host's loopback interface rather than all interfaces. This prevents external direct access while still allowing debugging from the host machine. In a hardened deployment, remove the `ports:` mapping entirely and access the server exclusively through Nginx on the internal Docker network.

---

## Part 4 — Dockerfile: Fastify Server (`apps/server/Dockerfile`)

Multi-stage build. Uses `turbo prune` to produce a pruned monorepo snapshot containing only packages the server depends on, which stabilizes the dependency-install cache layer.

> [Inference] `turbo prune --scope=server --docker` is the standard Turborepo command for generating pruned Docker build context. It produces `out/json/` (package manifests only) and `out/full/` (full source). This pattern is documented in the Turborepo docs and is the recommended approach for monorepo Docker builds. Verify the exact command matches your Turborepo version before the first build.

```dockerfile
# apps/server/Dockerfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — pruner
# Runs turbo prune to extract only packages the server requires.
# The full monorepo is passed as build context but only the pruned output
# proceeds to subsequent stages.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS pruner

RUN corepack enable
WORKDIR /app
COPY . .
# Produces out/json/ (manifests) and out/full/ (source)
RUN pnpm dlx turbo prune --scope=server --docker


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — deps
# Installs all dependencies from the pruned package manifests.
# This layer is cached separately from source so it only rebuilds when
# package manifests change.
# No native build tools required. @node-rs/argon2 ships prebuilt musl binaries.
# See [ADR-L2-01](l2-docker-and-docker-compose-specification-adrs/ADR-INF-001-argon2-package-selection.md).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — builder
# Compiles TypeScript across the pruned packages.
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS builder

COPY --from=pruner /app/out/full/ .

RUN pnpm --filter @batac/shared build && \
    pnpm --filter @batac/database build && \
    pnpm --filter server build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 4 — production
# Lean runtime image. No build tools, no TypeScript source, no dev dependencies.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache \
    # wget: used by Docker health check probe
    wget \
    # dumb-init: proper PID 1; forwards signals correctly to Node.js
    dumb-init

RUN corepack enable
WORKDIR /app

# Install production dependencies only
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod

# Copy compiled artifacts
COPY --from=builder /app/apps/server/dist           ./apps/server/dist
COPY --from=builder /app/packages/shared/dist       ./packages/shared/dist
COPY --from=builder /app/packages/database/dist     ./packages/database/dist

# Copy migration files and post-migrate-grants SQL (needed at runtime by migrate.ts)
COPY --from=builder /app/packages/database/migrations \
                    ./packages/database/migrations
COPY --from=builder /app/packages/database/scripts/post-migrate-grants.sql \
                    ./packages/database/scripts/post-migrate-grants.sql

# Entrypoint script
COPY apps/server/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Asia/Manila timezone (L1 §18 confirms TZ must be set at OS level)
ENV TZ=Asia/Manila

# ── OCR language packs ────────────────────────────────────────────────────────
ENV TESSDATA_PREFIX=/app/tessdata
RUN mkdir -p /app/tessdata && \
    wget -q -O /app/tessdata/eng.traineddata.gz \
      https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz && \
    wget -q -O /app/tessdata/fil.traineddata.gz \
      https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/fil.traineddata.gz && \
    gunzip /app/tessdata/*.gz && \
    chown -R node:node /app/tessdata

# Run as the unprivileged node user (built into all official node: images)
USER node

EXPOSE 3000

# dumb-init as PID 1; CMD is the argument list passed to it
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./entrypoint.sh"]
```

### OCR note

> **OCR language packs — always bundled ([ADR-L2-03](l2-docker-and-docker-compose-specification-adrs/ADR-INF-003-ocr-language-pack-building-strategy.md))**
>
> `tesseract.js` is pure JavaScript/WebAssembly (`OCR_ENGINE=tesseract`, the L1 default). No system `tesseract` binary or `apk add` is required.
>
> Language packs (`eng`, `fil`) are unconditionally bundled into the production image. This supports both cloud and on-premise (no guaranteed internet) deployment targets from a single image. Runtime network fetching is not used in any deployment context.
>
> **[Inference]** `TESSDATA_PREFIX=/app/tessdata` is the configured path. Confirm against the `tesseract.js` scheduler API in `OcrService` before the OCR feature is implemented. If the path differs, update both the `ENV` and `RUN` lines above.
>
> If additional language packs are needed (e.g., Ilocano), add corresponding `wget` lines to the same `RUN` block. Confirm availability in the `naptha/tessdata` repository first — Ilocano support is [Unverified].

---

## Part 5 — Dockerfile: Web SPA (`apps/web/Dockerfile`)

Builds the Vite SPA. The output image contains only the compiled `/app/dist` directory. In `compose.prod.yml`, the `web-build` service runs this image once and copies `dist` into the `web_static` Docker volume, which Nginx then serves.

`VITE_*` variables confirmed in L1 §21.4 (`VITE_APP_NAME`, `VITE_API_URL`, `VITE_APP_URL`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`) are baked into the bundle at build time. They cannot be changed at runtime without rebuilding the image.

```dockerfile
# apps/web/Dockerfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — pruner
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS pruner

RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune --scope=web --docker


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — deps
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — builder
# All VITE_* variables confirmed in L1 §21.4 are declared as build args.
# They must be supplied at image build time by the CI pipeline.
# Never prefix a secret with VITE_ — it will appear in the browser bundle.
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS builder

COPY --from=pruner /app/out/full/ .

ARG VITE_APP_NAME="Batac City LGU"
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT

ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT

RUN pnpm --filter @batac/shared build && \
    pnpm --filter @batac/ui build && \
    pnpm --filter web build

# Output: /app/apps/web/dist


# ─────────────────────────────────────────────────────────────────────────────
# Stage 4 — production
# Minimal image containing only the compiled dist output.
# The sole purpose of this image is to seed the web_static volume in compose.
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:3.20 AS production

COPY --from=builder /app/apps/web/dist /app/dist
```

> **Build-time baking:** `VITE_API_URL` is the URL the browser calls for API requests. It must be the public-facing URL Nginx exposes (e.g., `https://dms.batac.gov.ph`), not the internal Docker hostname. This value must be known at image build time. Building a staging image with a different `VITE_API_URL` than the production image is the correct pattern — the two builds are different artifacts.

---

## Part 6 — Nginx Configuration (`nginx/batac.conf.template`)

Serves as both the static bundle server and the reverse proxy. Key concerns:

- SSE (Server-Sent Events) require `proxy_buffering off` and a long `proxy_read_timeout`. Without these, Nginx buffers SSE chunks and the browser's notification feed stalls.
- `Connection ''` clears any `Connection: upgrade` header that Nginx might otherwise forward. SSE uses a standard long-lived HTTP response and does not require a protocol upgrade.
- Static JS/CSS assets have content-hashed filenames (Vite default), so they receive long-lived `Cache-Control: immutable` headers. The HTML entry point receives `no-cache` so clients always fetch the latest.

```nginx
# nginx/batac.conf.template
# Mount at /etc/nginx/templates/batac.conf.template inside the Nginx container.
# Companion to compose.prod.yml.

# ── HTTP → HTTPS redirect ─────────────────────────────────────────────────
server {
    listen 80;
    server_name _;

    location / {
        return 301 https://$host$request_uri;
    }
}


# ── HTTPS main server ─────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    # Replace APP_DOMAIN with the actual domain at deployment time.
    # [Inference] Nginx does not support environment variable substitution
    # natively in config files; use envsubst in a Docker entrypoint, or
    # hardcode the domain in a deployment-specific config file.
    server_name ${APP_DOMAIN};

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;

    # SPA bundle root — populated by the web-build container into web_static volume
    root  /usr/share/nginx/html;
    index index.html;


    # ── Static bundle serving ──────────────────────────────────────────────
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Content-hashed assets (Vite default output): cache aggressively
    location ~* \.(js|css|woff2?|ttf|eot|svg|png|ico)$ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # HTML entry point: always revalidate
    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }


    # ── Health check — proxied directly to Fastify /health ─────────────────
    # Also used by Nginx's own health check probe in compose.prod.yml.
    # HEALTH_CHECK_PATH defaults to /health per L1 §13.3.
    location = /health {
        proxy_pass http://server:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }


    # ── API reverse proxy ─────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://server:3000;
        proxy_http_version 1.1;

        proxy_set_header Host               $host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  $scheme;

        # ── SSE-specific settings ─────────────────────────────────────────
        # Server-Sent Events require buffering disabled and a long timeout.
        # Without proxy_buffering off, Nginx holds chunks until the buffer
        # fills, breaking the real-time notification feed.
        proxy_set_header   Connection    '';   # prevent upgrade-header forwarding
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 3600s;             # keep SSE connections alive (1 hour)
        proxy_send_timeout 3600s;

        # Standard connect timeout for non-SSE API calls
        proxy_connect_timeout 10s;
    }


    # ── Gzip compression ──────────────────────────────────────────────────
    gzip            on;
    gzip_vary       on;
    gzip_proxied    any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/x-javascript
        image/svg+xml;
}
```

> **Domain injection — resolved (ADR-L2-04):** `nginx/batac.conf.template` uses `${APP_DOMAIN}` as the substitution variable. A custom entrypoint script (`nginx/entrypoint.sh`) runs `envsubst '${APP_DOMAIN}'` at container start and writes the resolved config to `/etc/nginx/conf.d/batac.conf`. The `APP_DOMAIN` variable is injected from `.env.production` via `compose.prod.yml`. See [ADR-L2-04](l2-docker-and-docker-compose-specification-adrs/ADR-INF-004-nginx-domain-name-injection.md) for full implementation details including the `envsubst` variable-quoting requirement.
>
> **TLS — resolved ([ADR-L2-05](l2-docker-and-docker-compose-specification-adrs/ADR-INF-005-tls-certificate-provisioning.md)):** Cert and key are mounted from Docker secrets to fixed paths `/etc/nginx/certs/fullchain.pem` and `/etc/nginx/certs/privkey.pem`. Let's Encrypt / Certbot is not used. See [ADR-L2-05](l2-docker-and-docker-compose-specification-adrs/ADR-INF-005-tls-certificate-provisioning.md) for rotation procedure.

### New file: `nginx/entrypoint.sh`

```sh
#!/bin/sh
# nginx/entrypoint.sh
# Substitutes ${APP_DOMAIN} in the Nginx config template and starts Nginx.
# The explicit variable list prevents envsubst from expanding Nginx's own
# $host, $request_uri, $scheme, etc. references.
set -e
envsubst '${APP_DOMAIN}' < /etc/nginx/templates/batac.conf.template \
  > /etc/nginx/conf.d/batac.conf
exec nginx -g 'daemon off;'
```

---

## Part 7 — Health Check Reference

|Service|Probe command|Interval|Start period|Retries|Notes|
|---|---|---|---|---|---|
|`postgres` (dev)|`pg_isready -U postgres -d batac_lgu`|5s|15s|10|PostgreSQL initializes slowly on first start (empty volume)|
|`postgres-primary` (prod)|`pg_isready -U batac_app -d batac_lgu`|5s|20s|10|Bitnami image; longer init for WAL setup|
|`postgres-standby` (prod)|`pg_isready -U batac_app`|10s|30s|10|Standby waits for primary; allow extra time|
|`minio`|`curl -f http://localhost:9000/minio/health/live`|10s|15s|5|MinIO live endpoint returns HTTP 200 when ready|
|`meilisearch`|`wget --spider http://localhost:7700/health`|10s|20s|5|Phase 2 only; activate with `--profile search`|
|`mailpit`|`wget --spider http://localhost:8025`|10s|5s|5|Dev only; fast startup|
|`server` (Fastify)|`wget --spider http://localhost:3000/health`|10s|40s|5|Allows 40s for migrations to complete on restart|
|`nginx` (prod)|`wget --spider http://localhost/health`|10s|10s|5|Proxies to server; server must be healthy first|

**The `/health` endpoint** (path configured via `HEALTH_CHECK_PATH` in L1 §13.3, default `/health`) must be implemented in Fastify as a lightweight liveness probe returning `HTTP 200` with `{ "status": "ok", "version": "...", "uptime": ... }`. It must not query the database on every call — that conflates liveness with readiness. A separate `/ready` endpoint that checks database connectivity may be added later for Kubernetes-style deployments but is not required for Docker Compose.

The 40-second `start_period` for the server service accommodates migration execution on container restart. Drizzle migrations are fast for small schemas, but the start period should be adjusted upward during later phases when the schema grows.

---

## Part 8 — Volume Strategy

### Named volumes

|Volume|Used by|Contents|Safe to wipe?|
|---|---|---|---|
|`postgres_data`|`postgres` (dev)|PostgreSQL data directory|Yes in dev only; wipe clears all data and triggers re-init|
|`postgres_primary_data`|`postgres-primary` (prod)|PostgreSQL primary data|Never wipe in production|
|`postgres_standby_data`|`postgres-standby` (prod)|WAL replica data|Can be rebuilt from primary; never wipe while primary is live|
|`minio_data`|`minio`|Document files and backup archives|Never wipe; treat as production data|
|`meilisearch_data`|`meilisearch`|Search index|Safe to wipe; index can be rebuilt from PostgreSQL|
|`web_static`|`web-build`, `nginx`|Compiled Vite SPA bundle|Safe to wipe; repopulated on every deployment by `web-build`|

### Bind mounts

Bind mounts in `compose.yml` (local dev):

|Host path|Container path|Mode|Purpose|
|---|---|---|---|
|`./tools/db/init`|`/docker-entrypoint-initdb.d`|read-only|PostgreSQL role creation scripts|

In `compose.prod.yml`, bind mounts cover TLS certificates and the Nginx config file only. All application data uses named volumes.

### Local development reset workflow

Wiping `postgres_data` resets the database to a clean state. The init scripts re-run on next `docker compose up`, creating roles. Drizzle migrations must then be re-run manually:

```bash
docker compose down -v          # stop and wipe all named volumes
docker compose up -d            # restart; init scripts run again on empty volume
pnpm --filter @batac/database migrate   # re-apply Drizzle migrations from the host
```

---

## Part 9 — Environment Variable Injection

### File hierarchy

|File|Committed|Purpose|
|---|---|---|
|`.env.example`|Yes|Template with all variables, documentation, and safe placeholder values. The only env file in version control.|
|`.env`|No|Developer's local values. Docker Compose loads this automatically from the directory where `docker compose` is invoked.|
|`.env.staging`|No|Staging values. Injected by CI/CD. Not committed.|
|`.env.production`|No|Production values. Injected by CI/CD or secrets manager. Not committed.|

### How variables reach containers

```
Developer's .env  (git-ignored)
    │
    ├─ Docker Compose interpolates ${VAR:-default} references in compose.yml
    │  when resolving service configuration (environment:, ports:, etc.)
    │
    └─ env_file: - .env  in a service definition passes variables directly
       into that container's environment, unmodified
```

For the server container in production, `env_file: - .env.production` passes all L1-defined server-side variables into the Fastify process. The Zod startup schema (L1 §21.2) validates them on boot and exits with a formatted error if any required variable is missing.

### Build-time vs. runtime

|Class|Injection method|Examples|
|---|---|---|
|Server runtime|`env_file:` or `environment:` in compose|`DATABASE_URL_APP`, `AUTH_JWT_ACCESS_SECRET`, `TZ`|
|Vite build-time (`VITE_*`)|`--build-arg` at `docker build` time|`VITE_API_URL`, `VITE_APP_URL` (L1 §21.4)|
|Next.js build-time (`NEXT_PUBLIC_*`)|`--build-arg` at build time|Phase 3 only|

`VITE_*` variables are consumed by Vite at build time and embedded in the JavaScript bundle. They are not available at container runtime. This is expected behavior — the bundle is a static artifact. A changed `VITE_API_URL` requires a new image build, not a container restart.

### `TZ` is an OS-level variable

L1 §18 confirms: `TZ=Asia/Manila` must be set as an OS-level environment variable, not only in dotenv. In Docker, this is achieved via:

- `ENV TZ=Asia/Manila` in each Dockerfile (production stage), and
- `environment: TZ: Asia/Manila` in each compose service

Both are set in the files above. All cron-based timers (`CRON_MAYOR_LAPSE_CHECK`, `CRON_PANLALAWIGAN_TIMER_CHECK`, etc.) depend on this being correct.

### MinIO-specific variables for local dev

When using MinIO instead of Cloudflare R2, the following overrides are required in `.env`:

```bash
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true          # Required for MinIO (L1 §8)
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123456
S3_REGION=us-east-1               # Conventional placeholder for MinIO
```

### Secret handling in production

Variables classified `SEC` in L1 must not appear in `.env` files committed to version control. In production:

- CI/CD pipelines inject them as environment variables at container start time
- Docker Secrets (`secrets:` in compose) provide file-based injection for environments that support it
> **Phase 1 secrets approach — resolved ([ADR-L2-06](l2-docker-and-docker-compose-specification-adrs/ADR-INF-006-production-secrets-management.md)):** Production `SEC`-classified string variables are injected via `.env.production` (not committed; managed by LGU IT Office on the production host, `root:root 600`). File-format secrets (TLS cert and key) use Docker `secrets:` mounts. No external secrets manager is used in Phase 1. Rotation of string secrets requires a container restart — accepted as a known constraint. Re-evaluate at Phase 2 planning. See [ADR-L2-06](l2-docker-and-docker-compose-specification-adrs/ADR-INF-006-production-secrets-management.md).

### New `.env.example` entries

Add the following entries to `.env.example` (under a new `# Nginx / Deployment` section):

```bash
# ── Nginx / Deployment ────────────────────────────────────────────────────────
# Domain name injected into nginx/batac.conf.template at container start ([ADR-L2-04](l2-docker-and-docker-compose-specification-adrs/ADR-INF-004-nginx-domain-name-injection.md))
APP_DOMAIN=dms.batac.gov.ph
```

---

## Part 10 — Migration and Seed Entrypoint

### `apps/server/entrypoint.sh`

The server container's CMD. Runs on every container start. Migrations are idempotent (Drizzle tracks applied migrations in its `__drizzle_migrations` table). Seeds must be written as idempotent operations (`INSERT ... ON CONFLICT DO NOTHING` or equivalent) since this script runs on every restart in development.

```bash
#!/bin/sh
# apps/server/entrypoint.sh
# Executes on every container start.
# Order: migrate → seed (dev/staging only) → start Fastify.

set -e

echo "[entrypoint] APP_ENV=${APP_ENV}"
echo "[entrypoint] DB_HOST=${DB_HOST:-localhost}"

# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Run Drizzle migrations and apply post-migration grants
# migrate.js handles both: applies pending Drizzle SQL migrations, then
# executes post-migrate-grants.sql via DATABASE_URL_MIGRATE.
# Idempotent; already-applied migrations are skipped.
# DATABASE_URL_MIGRATE is optional in the Zod schema (L1 §21.2) but required
# here for the grant step. The script will fail with a clear error if unset.
# ─────────────────────────────────────────────────────────────────────────────
echo "[entrypoint] Running database migrations..."
node ./packages/database/dist/migrate.js
echo "[entrypoint] Migrations complete."


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Seed data — development and staging only
# Seeds create: Platform Administrator user, default roles, document type
# configurations, number series definitions, standing committee records,
# and (staging) sample documents for QA.
# Never runs in production.
# ─────────────────────────────────────────────────────────────────────────────
if [ "$APP_ENV" = "development" ] || [ "$APP_ENV" = "staging" ]; then
  echo "[entrypoint] Seeding database (${APP_ENV})..."
  node ./packages/database/dist/seed.js
  echo "[entrypoint] Seed complete."
else
  echo "[entrypoint] Skipping seed (APP_ENV=${APP_ENV})."
fi


# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Start Fastify server
# exec replaces the shell process so dumb-init (PID 1) forwards SIGTERM
# directly to Node.js, allowing graceful shutdown.
# ─────────────────────────────────────────────────────────────────────────────
echo "[entrypoint] Starting server on port ${APP_PORT:-3000}..."
exec node ./apps/server/dist/index.js
```

### Migration runner (`packages/database/scripts/migrate.ts`)

The migrate script applies pending Drizzle migrations and then applies post-migrate grants using the `batac_migrate` connection. No `psql` binary is required in the Docker image — everything runs through the `postgres` npm package (which Drizzle ORM uses).

```typescript
// packages/database/scripts/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL_MIGRATE) {
  console.error(
    '[migrate] DATABASE_URL_MIGRATE is not set. ' +
    'This variable is required for migrations and post-migrate grants.'
  );
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL_MIGRATE, {
  max: 1,
  onnotice: () => {},  // suppress advisory notice output
});

const db = drizzle(client);

console.log('[migrate] Applying Drizzle migrations...');
await migrate(db, {
  migrationsFolder: join(__dirname, '../migrations'),
});

console.log('[migrate] Applying post-migrate grants...');
const grantsSQL = readFileSync(
  join(__dirname, './post-migrate-grants.sql'),
  'utf-8'
);
await client.unsafe(grantsSQL);
await client.end();

console.log('[migrate] Done.');
```

> `DATABASE_URL_MIGRATE` is defined in the Zod schema (L1 §21.2) as `z.string().url().optional()`. It is marked optional because the running Fastify server does not need it at runtime. The entrypoint explicitly validates its presence and exits with a clear error if it is missing, so the optional Zod declaration does not create ambiguity in practice.

---

## Part 11 — Native Dependencies

### @node-rs/argon2 (resolved — [ADR-L2-01](l2-docker-and-docker-compose-specification-adrs/ADR-INF-001-argon2-package-selection.md))

`@node-rs/argon2` is used for Argon2id password hashing (L1 §6.4). It ships precompiled NAPI-RS binaries per platform, including `linux-x64-musl` for Alpine. No build toolchain (`python3`, `make`, `g++`) is required in any Dockerfile stage.

The `argon2` native build package is not used. The build tools block previously noted in the `deps` stage has been removed.

API: `import { hash, verify } from '@node-rs/argon2'`. Drop-in replacement for the `argon2` package API. OWASP parameters (L1 §6.4 — memory cost 65,536 KiB, time cost 3, parallelism 1) apply identically.

### argon2 OWASP parameters

L1 §6.4 confirms: memory cost 65,536 KiB, time cost 3, parallelism 1. These are tuned at runtime via environment variables; no Dockerfile changes are needed to adjust them.

### No system-level Tesseract binary required

`tesseract.js` (`OCR_ENGINE=tesseract`, the L1 default) is pure JavaScript/WebAssembly. It does not call the system `tesseract` binary. No `apk add tesseract-ocr` is needed in the Docker image. See Part 4 for language pack bundling guidance for offline deployments.

---

## Part 12 — Startup Dependency Order

```
LOCAL DEVELOPMENT

postgres ──[healthy]──────────────────────────────────────────────▶ (server starts on host)
minio ──[healthy]──▶ minio-init ──[completed]
mailpit ──────────────────────── (no dependencies; starts immediately)
meilisearch ─────────── (profile: search; no dependencies)


PRODUCTION

postgres-primary ──[healthy]──▶ postgres-standby
                │
                └──[healthy]──▶ server ──[runs migrations]──[healthy]──▶ nginx
                                    │
web-build ──[completed successfully]──┘ (nginx also waits for web-build)

minio ─────────── (profile: onpremise; no dependencies)
meilisearch ────── (profile: search; no dependencies)
```

The critical path in production is:

```
postgres-primary healthy
  → server starts (entrypoint: migrate → grant → seed → fastify)
  → server healthy (after ~40s start period)
  → nginx starts (proxying live; static bundle already in web_static volume)
```

Nginx is the last service to become active. Until the server passes its health check, `depends_on: condition: service_healthy` holds Nginx back. Static files can be served from the `web_static` volume as soon as Nginx starts — the server does not need to be running for that. API calls will fail until the server is healthy, and the SPA will display an error state for those requests.

---

## Part 13 — Decision Register

All items resolved June 2026. Companion ADRs contain full rationale and implementation details.

| ID    | Item                                                  | Status    | ADR           | Resolution summary |
| ----- | ----------------------------------------------------- | --------- | ------------- | ------------------ |
| L2-01 | `argon2` vs. `@node-rs/argon2`                        | Resolved  | [ADR-L2-01](l2-docker-and-docker-compose-specification-adrs/ADR-INF-001-argon2-package-selection.md) | Use `@node-rs/argon2`. Ships prebuilt `linux-x64-musl` binary; no build toolchain required. Remove `apk add python3 make g++` from `deps` stage. |
| L2-02 | Bitnami vs. official PostgreSQL image for replication | Resolved  | [ADR-L2-02](l2-docker-and-docker-compose-specification-adrs/ADR-INF-002-postgresql-docker-image-bitnami-vs-official.md) | Confirm `bitnami/postgresql:16` for production primary and standby. Official `postgres:16-alpine` retained for local dev (single instance, no replication). Pin to minor version tag before first production deployment. |
| L2-03 | OCR language pack bundling                            | Resolved  | [ADR-L2-03](l2-docker-and-docker-compose-specification-adrs/ADR-INF-003-ocr-language-pack-building-strategy.md) | Bundle `eng` and `fil` language packs unconditionally in all production builds. Both cloud and on-premise deployment targets served from a single image. `TESSDATA_PREFIX` path is `[Inference]` — confirm against `tesseract.js` OcrService before OCR feature is implemented. |
| L2-04 | Nginx domain name injection                           | Resolved  | [ADR-L2-04](l2-docker-and-docker-compose-specification-adrs/ADR-INF-004-nginx-domain-name-injection.md) | `envsubst` in a custom Nginx entrypoint (`nginx/entrypoint.sh`). `nginx/batac.conf` renamed to `nginx/batac.conf.template`. `${APP_DOMAIN}` substituted at container start. `APP_DOMAIN` injected from `.env.production`. |
| L2-05 | TLS certificate provisioning                          | Resolved  | [ADR-L2-05](l2-docker-and-docker-compose-specification-adrs/ADR-INF-005-tls-certificate-provisioning.md) | Pre-provisioned wildcard cert mounted via Docker secrets to fixed paths `/etc/nginx/certs/`. Certbot and Let's Encrypt not used — ACME requires outbound internet, incompatible with on-premise deployment. Manual renewal runbook with 60-day advance reminder. |
| L2-06 | Production secrets manager                            | Resolved (Phase 1) | [ADR-L2-06](l2-docker-and-docker-compose-specification-adrs/ADR-INF-006-production-secrets-management.md) | Docker secrets (file-format) + `.env.production` (string-format), managed by LGU IT Office. No external secrets manager in Phase 1. Rotation requires container restart — accepted. Revisit at Phase 2. |
| L2-07 | Node.js version                                       | Resolved  | [ADR-L2-07](l2-docker-and-docker-compose-specification-adrs/ADR-INF-007-nodejs-runtime-version.md) | Node.js 22 LTS (`node:22-alpine`). Node 20 entered Maintenance LTS April 2026. All Dockerfile stages updated. |
| L2-08 | `pnpm` version pinning                                | Resolved  | [ADR-L2-08](l2-docker-and-docker-compose-specification-adrs/ADR-INF-008-pnpm-version-pinning-via-corepack.md) | `packageManager` field required in root `package.json` (e.g., `"packageManager": "pnpm@9.15.4"`). Set via `corepack use pnpm@<version>`. Update atomically with lockfile on intentional upgrades. |
| L2-09 | `BACKUP_RESTORE_TEST_ENABLED` container               | Resolved (Phase 1 dormant) | [ADR-L2-09](l2-docker-and-docker-compose-specification-adrs/ADR-INF-009-backup-restore-test-container.md) | Flag remains `false` in Phase 1. Scratch PostgreSQL container not added to `compose.prod.yml`. Infrastructure gap documented in [ADR-L2-09](l2-docker-and-docker-compose-specification-adrs/ADR-INF-009-backup-restore-test-container.md) with a full activation checklist. |

Full ADRs: `./l2-docker-and-docker-compose-specification-adrs/*`

---

_This document is part of the L-series pre-development reference set (infrastructure layer). Update when Dockerfile structure, compose service definitions, migration entrypoint logic, or volume strategy changes. Companion documents: D5 (deployment topology), L1 (environment variable catalog)._
