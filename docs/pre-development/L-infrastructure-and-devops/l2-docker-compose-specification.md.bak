# Docker and Docker Compose Specification

**Document:** L2
**Platform:** Batac City LGU Platform
**Status:** Pre-dev — should be finalized before any developer sets up a local environment and before the L3 CI/CD Pipeline Specification is built on top of it
**Last Updated:** June 2026
**Audience:** Development team, DevOps
**Source Documents:** `d5-deployment-diagram.md`; `l1-env-catalog.md`; `2-stack-context.md`; `consolidated-architecture-and-requirements-reference-iteration-3.md`
**Prerequisites (per document-list.md):** D5 — Deployment Diagram; L1 — Environment Variables Catalog

---

## About This Document

This document specifies the Docker Compose design for **local development**, plus the Dockerfile designs for `/apps/server` and `/apps/web` that are reused across local development, CI, and (in the case of the production build targets) staging and production. It covers:

- The local development service topology and how it maps to the production topology already defined in D5
- The complete `docker-compose.yml` for local development, including health checks, volumes, and service dependency ordering
- Multi-stage `Dockerfile` designs for the Fastify server and the Vite-built SPA
- The environment-variable injection strategy, reconciling L1's host-context `.env.example` with the container-context hostnames Compose requires
- The PostgreSQL role bootstrap mechanism and the seed/migration entrypoint scripts
- A developer quickstart and an optional production-preview override for validating the full D5 topology locally before deployment

**What this document does not cover:**

- The exact DDL, schema contents, or `GRANT`/`REVOKE` statements for the three database roles beyond their creation as login roles — that is C1 (Full Database Schema DDL) and C5 (Migration Strategy and Conventions)
- Migration file naming conventions, the SQL-review checklist, or the linting rules that enforce the architectural invariants — also C5
- CI/CD pipeline stages, Turborepo remote cache configuration, or deployment gates — that is L3 (CI/CD Pipeline Specification)
- Backup execution, PITR, replication setup, or DR drill procedures — that is L4 (Backup and DR Runbooks)
- Terraform/Pulumi cloud resource provisioning — out of scope for this document; the consolidated reference calls for IaC, but no IaC-specific document currently exists in the plan
- The actual seed *data* — role/permission rows, number series configuration, document type definitions, workflow definitions. This document specifies only the entrypoint mechanism that will load that data once H1, H2, H3, and I2 are produced
- Kubernetes or Swarm production manifests beyond what is needed to validate the single-host topology D5 already defines

**On design decisions:** D5 and L1 fix the topology and the variable catalog, but neither specifies a Compose file, a Dockerfile, or a database-role bootstrap script verbatim. Those artifacts are spec decisions made here. Where this document introduces something not derivable from the five source documents — a new environment variable, an image tag, a file path — it is called out explicitly. These decisions are authoritative for implementation unless revised through the normal spec review process.

---

## 1. Design Principles

**Local development must not diverge from the architecture D5 already fixed.** The Compose topology in this document is a development-scaled version of the same architecture: a single Fastify process serving tRPC, REST, SSE, and hosting pgboss workers; PostgreSQL as the only stateful data store; an S3-compatible object store reached exclusively through the `@aws-sdk/client-s3` client. Nothing in this document introduces an architectural element D5 does not already describe.

**pgboss has no container of its own.** D5 states this explicitly: pgboss workers run inside the Fastify process and use PostgreSQL as their job backing store, with no separate queue broker. The document-list's description of this deliverable mentions "pgboss" alongside PostgreSQL, MinIO, and Meilisearch as things the local Compose file should account for — this is satisfied by pgboss's tables living inside PostgreSQL (under the `pgboss` schema) and pgboss's worker code running as part of the `server` container's process, not by giving pgboss a service block of its own. Section 11.3 covers how the `pgboss` schema gets bootstrapped without granting the runtime role unnecessary DDL rights.

**MinIO stands in for S3 in every non-production environment, including local development.** Cloudflare R2 is the Phase 1 cloud provider, but a developer's laptop has no R2 credentials and should not need any. MinIO's S3-compatible API is wire-identical, so the application code is exercised the same way regardless of which one backs `S3_ENDPOINT`.

**Meilisearch is present but inert by default.** It is a Phase 2 component. The local Compose file defines it behind an opt-in profile so the default `docker compose up` matches the Phase 1 footprint exactly, while still letting a developer who wants to prototype Phase 2 search bring it up with one flag.

**The same Dockerfiles serve every environment.** A multi-stage Dockerfile with named build targets (`dev`, `build`, `production`) means local development, CI, and production all build from one file. Local development uses the `dev` target with source bind-mounted for hot reload; everything downstream of local development uses the `production` target, which contains no source bind mounts and no devDependencies.

**Local infrastructure should require zero manual steps beyond copying `.env.example`.** A new developer should be able to clone the repository, copy the environment template, and run one command to reach a working, seeded local stack. Section 12 gives the exact command sequence for both a fully containerized path and a host-native path.

---

## 2. Prerequisites and Tooling

| Tool | Minimum Version | Why |
|---|---|---|
| Docker Engine | 25.x or later | BuildKit-by-default, multi-stage build cache mounts |
| Docker Compose CLI (`docker compose`, no hyphen) | v2.20 or later | The `service_completed_successfully` `depends_on` condition used throughout Section 5 requires this; earlier v2 releases only support `service_healthy` / `service_started` |
| Node.js (host, Option B only) | 22.x | Matches the `dev` build target's base image; the stack's native-`fetch` requirement floors at Node 18+, but the project standardizes on 22 |
| pnpm | Pinned via the root `package.json` `packageManager` field | Corepack activates the pinned version automatically inside every Dockerfile stage and on a developer's host |

The legacy hyphenated `docker-compose` binary (Compose V1) is not supported by anything in this document. All commands below use the V2 plugin form, `docker compose`.

---

## 3. Repository Layout Relevant to This Document

```
/docker-compose.yml
/docker-compose.prod-preview.yml      ← optional override, Section 13
/.dockerignore
/.env.example                          ← owned by L1; this doc adds three lines, Section 9.3

/apps
  /server
    Dockerfile
  /web
    Dockerfile
    nginx.conf.template
  /portal                              ← Phase 3; no Dockerfile until then

/packages
  /database                            ← drizzle-kit config, migrations, seed script live here

/tools
  /scripts
    /docker
      /postgres-init
        01-create-roles.sh
      entrypoint-migrate.sh
      entrypoint-seed.sh
```

This document assumes pnpm workspace package names follow the pattern `@batac/<name>` — `@batac/server`, `@batac/web`, `@batac/shared`, `@batac/database`, `@batac/ui`, `@batac/config`. None of the five source documents fix an exact naming scheme for `package.json` `name` fields; this is a spec decision made here so every command in this document is internally consistent. Confirm against J4 (Module Structure Template) once written, and rename uniformly if J4 chooses differently.

---

## 4. Local Development Topology

```mermaid
flowchart TD
    subgraph HOST["Developer Host"]
        BROWSER["Browser"]
    end

    subgraph DEFAULT["docker compose up — default services"]
        PG["postgres\nPostgreSQL 17 — :5432"]
        MINIO["minio\nS3-compatible — :9000 / :9001"]
        MAIL["mailpit\nSMTP catcher — :1025 / :8025"]
        SRV["server\nFastify, dev target — :3000\nsource bind-mounted, hot reload\npgboss workers run inside this process"]
    end

    subgraph OPTIONAL["opt-in via --profile"]
        MEILI["meilisearch\nprofile: phase2 — :7700"]
        WEBDEV["web\nprofile: containerized-web\nVite dev server — :5173"]
    end

    BROWSER -->|"HTTP :5173 — Option A\n(containerized) or Option B\n(host pnpm dev)"| WEBDEV
    BROWSER -->|"HTTP :3000 — direct API calls\nif no frontend dev server is running"| SRV
    WEBDEV -->|"Vite dev-server proxy\n/api → localhost:3000"| SRV

    SRV -->|"Drizzle ORM\nDATABASE_URL_APP / _AUDIT"| PG
    SRV -->|"S3 API\nS3_ENDPOINT=http://minio:9000"| MINIO
    SRV -->|"SMTP\nSMTP_HOST=mailpit"| MAIL
    SRV -. "profile: phase2 only" .-> MEILI
```

| Service | Default? | Maps to D5 component | Notes |
|---|---|---|---|
| `postgres` | Yes | PostgreSQL Primary | Single instance; no local standby. Replication is a production/D5 concern, not a local-dev one — see L4 once written. |
| `minio` | Yes | Cloudflare R2 (local stand-in) | Same S3 API; only `S3_ENDPOINT` differs between this and production. |
| `minio-init` | Yes (runs once, exits) | — | Creates buckets and enables versioning, since MinIO does not auto-create either. |
| `mailpit` | Yes | SMTP Server | *New addition — not named in the document-list's L2 description, but implied by L1's `.env.example`, which targets `localhost:1025`, Mailpit's default port. Flagged as a spec decision.* |
| `migrate` | Yes (runs once, exits) | — | Applies Drizzle migrations via `DATABASE_URL_MIGRATE`. |
| `seed` | Yes (runs once, exits) | — | Loads reference data via the seed entrypoint, Section 11. |
| `server` | Yes | Fastify (single process) | Hosts tRPC, REST, SSE, and pgboss workers, exactly as D5 describes. |
| `meilisearch` | No — `--profile phase2` | Meilisearch (Phase 2+ reserved slot) | Matches D5's "reserved slot" framing; not started by a bare `docker compose up`. |
| `web` | No — `--profile containerized-web` | `/apps/web` static bundle (dev-time stand-in) | Optional; see Section 12 for why host-native is the default recommendation instead. |

---

## 5. docker-compose.yml

### 5.1 Full File

```yaml
name: batac-lgu-platform

# Shared environment block for any service that runs the @batac/server
# image. Inside the Docker network, the three database roles and the
# S3-compatible endpoint must resolve by Compose service name rather than
# the "localhost" values that .env uses for host-native execution. See
# Section 9 for the full host-context vs. container-context explanation.
x-app-env: &app-env
  env_file:
    - .env
  environment:
    DATABASE_URL_APP: postgresql://app_user:${DB_APP_PASSWORD:-changeme}@postgres:5432/${DB_NAME:-batac_lgu}?sslmode=disable
    DATABASE_URL_AUDIT: postgresql://audit_user:${DB_AUDIT_PASSWORD:-changeme}@postgres:5432/${DB_NAME:-batac_lgu}?sslmode=disable
    DATABASE_URL_MIGRATE: postgresql://migrate_user:${DB_MIGRATE_PASSWORD:-changeme}@postgres:5432/${DB_NAME:-batac_lgu}?sslmode=disable
    S3_ENDPOINT: http://minio:9000
    S3_FORCE_PATH_STYLE: "true"
    SMTP_HOST: mailpit
    SMTP_PORT: "1025"
    SMTP_SECURE: "false"
    SEARCH_MEILISEARCH_URL: http://meilisearch:7700

services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_SUPERUSER_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-batac_lgu}
      DB_APP_PASSWORD: ${DB_APP_PASSWORD:-changeme}
      DB_AUDIT_PASSWORD: ${DB_AUDIT_PASSWORD:-changeme}
      DB_MIGRATE_PASSWORD: ${DB_MIGRATE_PASSWORD:-changeme}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./tools/scripts/docker/postgres-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      # Unescaped $ on purpose: this string is built once by Compose at
      # parse time from the host-side .env, not evaluated again inside
      # the container, so ordinary interpolation is what we want here.
      test: ["CMD-SHELL", "pg_isready -U postgres -d ${DB_NAME:-batac_lgu}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 5s

  minio-init:
    image: minio/mc:RELEASE.2025-04-08T15-39-49Z
    depends_on:
      minio:
        condition: service_healthy
    restart: "no"
    entrypoint: ["/bin/sh", "-c"]
    # Double $$ escapes Compose's own interpolation pass so these are
    # evaluated by the shell INSIDE the container, reading the
    # `environment:` block below — not by Compose reading the host .env.
    command:
      - |
        mc alias set local http://minio:9000 "$$S3_ACCESS_KEY" "$$S3_SECRET_KEY" &&
        mc mb --ignore-existing "local/$$S3_BUCKET" &&
        mc version enable "local/$$S3_BUCKET" &&
        mc mb --ignore-existing "local/$$S3_BACKUP_BUCKET"
    environment:
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-minioadmin}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-minioadmin}
      S3_BUCKET: ${S3_BUCKET:-batac-lgu-dev}
      S3_BACKUP_BUCKET: ${S3_BACKUP_BUCKET:-batac-lgu-backups-dev}

  mailpit:
    image: axllent/mailpit:latest
    restart: unless-stopped
    ports:
      - "1025:1025"
      - "8025:8025"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8025/livez"]
      interval: 5s
      timeout: 5s
      retries: 10

  meilisearch:
    image: getmeili/meilisearch:v1.10
    profiles: ["phase2"]
    restart: unless-stopped
    environment:
      MEILI_MASTER_KEY: ${SEARCH_MEILISEARCH_MASTER_KEY:-dev_only_meili_master_key_change_me}
      MEILI_ENV: development
    ports:
      - "7700:7700"
    volumes:
      - meilidata:/meili_data
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:7700/health"]
      interval: 5s
      timeout: 5s
      retries: 10

  migrate:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
      target: dev
    <<: *app-env
    volumes:
      - .:/app
      - server_root_modules:/app/node_modules
      - server_app_modules:/app/apps/server/node_modules
      - database_pkg_modules:/app/packages/database/node_modules
    depends_on:
      postgres:
        condition: service_healthy
    command: ["/app/tools/scripts/docker/entrypoint-migrate.sh"]
    restart: "no"

  seed:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
      target: dev
    <<: *app-env
    volumes:
      - .:/app
      - server_root_modules:/app/node_modules
      - server_app_modules:/app/apps/server/node_modules
      - database_pkg_modules:/app/packages/database/node_modules
    depends_on:
      migrate:
        condition: service_completed_successfully
    command: ["/app/tools/scripts/docker/entrypoint-seed.sh"]
    restart: "no"

  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
      target: dev
    <<: *app-env
    depends_on:
      postgres:
        condition: service_healthy
      minio-init:
        condition: service_completed_successfully
      seed:
        condition: service_completed_successfully
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - server_root_modules:/app/node_modules
      - server_app_modules:/app/apps/server/node_modules
      - shared_pkg_modules:/app/packages/shared/node_modules
      - database_pkg_modules:/app/packages/database/node_modules
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  web:
    profiles: ["containerized-web"]
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: dev
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_APP_URL: http://localhost:5173
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - web_root_modules:/app/node_modules
      - web_app_modules:/app/apps/web/node_modules
      - shared_pkg_modules:/app/packages/shared/node_modules
      - ui_pkg_modules:/app/packages/ui/node_modules
    depends_on:
      - server
    restart: unless-stopped

volumes:
  pgdata:
  miniodata:
  meilidata:
  server_root_modules:
  server_app_modules:
  shared_pkg_modules:
  database_pkg_modules:
  web_root_modules:
  web_app_modules:
  ui_pkg_modules:
```

### 5.2 Compose Profiles Reference

| Profile flag | Adds | When to use |
|---|---|---|
| *(none — default)* | postgres, minio, minio-init, mailpit, migrate, seed, server | Day-to-day backend development. Pair with host-native `pnpm dev` for the frontend (Option B, Section 12.2). |
| `--profile phase2` | meilisearch | Prototyping Phase 2 search work ahead of schedule. Not part of the Phase 1 footprint. |
| `--profile containerized-web` | web (Vite dev server, containerized) | Machines without a working host Node/pnpm setup, or to keep the entire stack inside Docker for parity testing. |

Profiles combine: `docker compose --profile phase2 --profile containerized-web up`.

---

## 6. Dockerfiles

### 6.1 `apps/server/Dockerfile`

```dockerfile
# apps/server/Dockerfile
# Build from the repository root: docker build -f apps/server/Dockerfile .
# Targets: dev | build | production

# ── base ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────
# Only manifest files are copied here so this layer is cached until a
# package.json or the lockfile actually changes — source edits never
# invalidate the install step.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ── dev ──────────────────────────────────────────────────────────────────
# Used by docker-compose's `server`, `migrate`, and `seed` services. The
# COPY below is a fallback for `docker build` outside Compose (e.g. a CI
# sanity build); Compose itself overlays the bind mount from Section 5.1
# on top of this at runtime, so day-to-day source edits never require a
# rebuild of this stage.
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@batac/server", "dev"]

# ── build ────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm turbo run build --filter=@batac/server...
# `pnpm deploy` assembles a self-contained, production-only directory for
# @batac/server — its own files plus a pruned, hoisted node_modules — at
# /app/deploy/server. This is the modern pnpm-native alternative to a
# separate "prod-deps" stage with a second `pnpm install --prod` pass.
RUN pnpm --filter=@batac/server deploy --prod /app/deploy/server

# ── production ───────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/deploy/server ./
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD wget --spider -q http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

Secret-file hydration (reading `/run/secrets/*` into `process.env` for Docker Secrets/Swarm deployments) is deliberately **not** implemented as a shell step in this Dockerfile. L1 §23.3 already specifies a `loadDockerSecrets()` function invoked as the first statement of the server's TypeScript bootstrap, before the Zod schema in `env.ts` parses `process.env`. Duplicating that logic in shell here would create two competing mechanisms for the same job; the `production` target's `CMD` execs `node` directly and lets the application handle it, consistent with L1.

### 6.2 `apps/web/Dockerfile`

```dockerfile
# apps/web/Dockerfile
# Targets: dev | build | production

# ── base ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ── dev ──────────────────────────────────────────────────────────────────
# Only used under the optional `containerized-web` profile. Source is
# bind-mounted over this at runtime by Compose, same pattern as the
# server's dev target.
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["pnpm", "--filter", "@batac/web", "dev", "--", "--host", "0.0.0.0"]

# ── build ────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm turbo run build --filter=@batac/web...
# Output: /app/apps/web/dist — a static bundle, no Node process required.

# ── production ───────────────────────────────────────────────────────────
# Per D5, the same Nginx node both serves the static SPA bundle AND
# reverse-proxies /api/* to Fastify. This stage produces that single
# component, not two separate containers.
FROM nginx:1.27-alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
ENV FASTIFY_UPSTREAM=server:3000
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget --spider -q http://localhost/ || exit 1
```

The `production` target relies on the official Nginx image's automatic `envsubst` pass over `/etc/nginx/templates/*.template`, which writes the substituted result to `/etc/nginx/conf.d/` on container start. This lets `FASTIFY_UPSTREAM` differ between the local prod-preview override (Section 13, where it resolves to the `server` Compose service) and a real production deployment (where it might resolve to a different internal hostname) without touching the Dockerfile.

### 6.3 `apps/web/nginx.conf.template`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SSE: buffering must be disabled or in-app real-time notifications
    # stall behind Nginx's response buffer instead of streaming immediately.
    location /api/events {
        proxy_pass http://${FASTIFY_UPSTREAM}/api/events;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    # Everything else under /api/* — tRPC and REST both — per D5's
    # "Proxies /api/* to Fastify" rule.
    location /api/ {
        proxy_pass http://${FASTIFY_UPSTREAM}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:css|js|svg|png|jpg|jpeg|gif|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

This file is consumed only by the `production` build target. The `dev` target (Vite's own dev server) does not use Nginx at all — Vite's dev server proxy config handles the equivalent forwarding for hot-reload development:

```ts
// apps/web/vite.config.ts (relevant excerpt)
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
```

---

## 7. Health Check Configuration

| Service | Check | Interval | Notes |
|---|---|---|---|
| `postgres` | `pg_isready -U postgres -d $DB_NAME` | 5s | Bundled with the official image; no extra tooling needed. |
| `minio` | `curl -f http://localhost:9000/minio/health/live` | 5s | MinIO's documented liveness endpoint. |
| `mailpit` | `wget --spider http://localhost:8025/livez` | 5s | Convenience-only service. If the pinned image variant ships without a shell/`wget`, switch to a TCP-only check (`nc -z localhost 8025`) or drop the healthcheck entirely — confirm at implementation time. |
| `meilisearch` | `wget --spider http://localhost:7700/health` | 5s | Phase 2 only; same shell-availability caveat as mailpit applies if a minimal image variant is later adopted. |
| `server` | `wget --spider http://localhost:3000/health` | 10s, `start_period: 15s` | Path matches `HEALTH_CHECK_PATH` default from L1 §13.3. The 15s start period covers cold start plus the dependency chain (DB/bucket/seed) already having completed by the time this container's own process begins. |
| `web` (production target) | `wget --spider http://localhost/` | 10s | Defined via Dockerfile `HEALTHCHECK`, not Compose, since this target is only exercised under the prod-preview override (Section 13). |

General note: every healthcheck above assumes the pinned base image includes the referenced binary (`pg_isready`, `curl`, `wget`). Minimal or distroless image variants occasionally drop shell utilities between releases — confirm against the exact tag in Section 15 before relying on these in CI.

---

## 8. Volume Mounts and the pnpm/Docker Bind-Mount Problem

Two distinct volume categories appear in Section 5.1:

**Named volumes for stateful data** — `pgdata`, `miniodata`, `meilidata`. These persist across `docker compose down` (but not `docker compose down -v`) so a developer's seeded local data survives routine restarts.

**Named volumes shadowing `node_modules`.** This is the less obvious one. The `server` and `web` services bind-mount the entire repository (`.:/app`) so source edits are visible inside the container without a rebuild. But pnpm builds each workspace package's `node_modules` as a tree of symlinks into a central content-addressable store, resolved at `pnpm install` time *inside the image*. If the host's `node_modules` directories (which may not exist, or may hold macOS/Windows-arch native binaries built for a different OS than the Linux container) get bind-mounted on top of the container's own `node_modules`, the symlinks break or the wrong native binaries get loaded.

The fix is the standard one: declare a named volume at every `node_modules` path that would otherwise be shadowed, so Docker mounts that specific sub-path with higher specificity than the parent bind mount and the container's own pnpm-installed tree survives underneath the source bind mount. Section 5.1 does this for the root `node_modules` plus every workspace package each service actually depends on at runtime (`apps/server`, `packages/shared`, `packages/database` for `server`/`migrate`/`seed`; `apps/web`, `packages/shared`, `packages/ui` for `web`). If a future workspace package is added as a runtime dependency of either app, extend this same pattern — one named volume per package's `node_modules` path — rather than omitting it and hitting broken symlinks.

---

## 9. Environment Variable Injection Strategy

### 9.1 Two Execution Contexts

L1's `.env.example` is written from the **host's** point of view: `DATABASE_URL_APP=postgresql://app_user:changeme@localhost:5432/batac_lgu`, `S3_ENDPOINT=http://localhost:9000`, and so on. This is exactly correct for **Option B** (Section 12.2): a developer running `pnpm dev` directly on their host, reaching Postgres and MinIO through the ports Compose publishes to `localhost`.

It is *not* correct for any process running **inside** the Docker network (Option A's `server`, `migrate`, `seed`, and the optional `web`), because containers resolve each other by Compose service name, not `localhost`. Rather than maintaining two separate `.env` files, the `x-app-env` anchor in Section 5.1 overrides exactly the variables that differ between contexts at the Compose service level, which Compose applies on top of whatever `env_file: .env` already loaded. One `.env` file serves both workflows unmodified.

### 9.2 Variables Overridden for the Containerized Context

| Variable | Host-context value (from `.env`) | Container-context value (Compose override) | Why it must change |
|---|---|---|---|
| `DATABASE_URL_APP` | `...@localhost:5432/...` | `...@postgres:5432/...` | Postgres is reachable inside the network only by its service name. |
| `DATABASE_URL_AUDIT` | `...@localhost:5432/...` | `...@postgres:5432/...` | Same. |
| `DATABASE_URL_MIGRATE` | `...@localhost:5432/...` | `...@postgres:5432/...` | Same. |
| `S3_ENDPOINT` | `http://localhost:9000` | `http://minio:9000` | MinIO is reachable inside the network only by its service name. |
| `SMTP_HOST` | `localhost` | `mailpit` | Same principle, for the local SMTP catcher. |
| `SEARCH_MEILISEARCH_URL` | `http://localhost:7700` | `http://meilisearch:7700` | Only relevant under the `phase2` profile. |

`APP_URL`, `API_URL`, `VITE_API_URL`, and `CORS_ALLOWED_ORIGINS` are deliberately **not** in this table — they stay at their `localhost`-based values from `.env` in both contexts, because they describe URLs the *browser on the host machine* uses, not container-to-container calls. Overriding these to a Compose service name would break them, since the host's browser cannot resolve Compose's internal DNS names.

### 9.3 New Variables Introduced by This Document

L1 remains the single source of truth for the application's own environment schema (`serverEnvSchema` in L1 §21.2). The three variables below exist only to parametrize the local PostgreSQL bootstrap script in Section 10 — the Fastify application itself never reads them; it reads the three `DATABASE_URL_*` connection strings directly.

```dotenv
# ─── Added by L2: local Postgres role bootstrap ───────────────────────────
# Consumed only by tools/scripts/docker/postgres-init/*.sh at first
# container boot. Not part of the Zod-validated server environment.
POSTGRES_SUPERUSER_PASSWORD=postgres
DB_APP_PASSWORD=changeme
DB_AUDIT_PASSWORD=changeme
DB_MIGRATE_PASSWORD=changeme
```

`DB_APP_PASSWORD` reuses a name L1 §5.1 already lists as a fallback variable, though L1's own Zod schema dump (§21.2) does not actually wire that fallback path into validation — only the three full `DATABASE_URL_*` strings are validated there. This document's `DB_APP_PASSWORD` is consumed differently: by the init script in Section 10, not by the application. `DB_AUDIT_PASSWORD`, `DB_MIGRATE_PASSWORD`, and `POSTGRES_SUPERUSER_PASSWORD` are net-new. Recommend folding all three into L1's catalog as a housekeeping addendum, the same way M1 folds stack-context additions into `2-stack-context.md`.

All four default to weak, shared placeholder values, consistent with L1 §1.2's stated philosophy that development secrets may be weak. They are never used outside `docker-entrypoint-initdb.d` on a developer's own machine.

### 9.4 Staging and Production

This document's `.env` + Compose-override mechanism is local-development-only. Staging injects secrets via CI/CD pipeline variables; production injects them via Docker Secrets or a self-hosted Vault instance, exactly as L1 §23 specifies, using the `loadDockerSecrets()` mechanism referenced in Section 6.1. Nothing in this document's Compose file is intended to run unmodified in either of those environments — Section 13's prod-preview override exists specifically to validate the production Dockerfile *targets* locally without claiming to be a production deployment mechanism itself.

---

## 10. Database Role Bootstrap

`tools/scripts/docker/postgres-init/01-create-roles.sh` runs automatically on the **first** boot of the `postgres` container (i.e., only when its data volume is empty), via the official Postgres image's `/docker-entrypoint-initdb.d/` convention. A `.sh` script is used rather than a raw `.sql` file specifically because `.sh` scripts in that directory run with the container's environment available, which a plain `.sql` file does not get without extra `psql -v` plumbing.

```bash
#!/bin/bash
# tools/scripts/docker/postgres-init/01-create-roles.sh
#
# Creates the three least-privilege login roles the platform's connection
# strings authenticate as. This script provisions ROLES ONLY. Schemas,
# tables, and the schema-level GRANT/REVOKE statements that actually
# enforce least privilege (e.g. audit_user being INSERT-only) are applied
# later by Drizzle migrations against migrate_user — see C1 and C5.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'migrate_user') THEN
      CREATE ROLE migrate_user WITH LOGIN PASSWORD '${DB_MIGRATE_PASSWORD}' CREATEDB;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
      CREATE ROLE app_user WITH LOGIN PASSWORD '${DB_APP_PASSWORD}';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audit_user') THEN
      CREATE ROLE audit_user WITH LOGIN PASSWORD '${DB_AUDIT_PASSWORD}';
    END IF;
  END
  \$\$;

  ALTER DATABASE "${POSTGRES_DB}" OWNER TO migrate_user;
  GRANT ALL PRIVILEGES ON DATABASE "${POSTGRES_DB}" TO migrate_user;
SQL

echo "[postgres-init] Roles created: migrate_user, app_user, audit_user."
echo "[postgres-init] Schema-level grants (app_user CRUD on all non-audit"
echo "[postgres-init] schemas; audit_user INSERT-only on the audit schema)"
echo "[postgres-init] are applied by the Drizzle migration set, not here."
```

---

## 11. Seed and Migration Entrypoint

### 11.1 Scripts

```bash
#!/bin/sh
# tools/scripts/docker/entrypoint-migrate.sh
set -e

echo "[migrate] Applying Drizzle Kit migrations via DATABASE_URL_MIGRATE..."
pnpm --filter @batac/database exec drizzle-kit migrate

echo "[migrate] Bootstrapping the pgboss schema (idempotent; first run only)..."
pnpm --filter @batac/database run bootstrap:pgboss

echo "[migrate] Migration complete."
```

```bash
#!/bin/sh
# tools/scripts/docker/entrypoint-seed.sh
set -e

echo "[seed] Seeding reference data..."
pnpm --filter @batac/database run seed

echo "[seed] Seed complete."
```

### 11.2 Execution Order

```
postgres (healthy)
  └─▶ migrate   — drizzle-kit migrate, then pgboss schema bootstrap
        └─▶ seed     — reference data
              └─▶ server  — only starts once seed has exited 0
minio (healthy)
  └─▶ minio-init — bucket creation + versioning
        └─▶ server  — also waits on this
```

Both `migrate` and `seed` run on **every** `docker compose up`, not only the first one — Compose re-runs one-shot containers on each invocation rather than remembering a prior successful exit indefinitely. This is intentional and requires both scripts to be idempotent: `drizzle-kit migrate` only applies pending migration files by design, and the seed script must use upsert semantics (`ON CONFLICT DO NOTHING` or equivalent, keyed on a natural key such as the city UUID or a series code) rather than blind `INSERT`s, so repeated runs never fail or duplicate rows.

### 11.3 The pgboss Schema and the Least-Privilege Boundary

pgboss's Node library self-creates its job-queue schema and tables the first time it starts against a connection that has DDL rights — but `app_user` (the role the running `server` process authenticates as) deliberately has no DDL rights, by the same least-privilege principle that scopes `audit_user` to INSERT-only. Resolving this is a spec decision made here: the `bootstrap:pgboss` step inside `entrypoint-migrate.sh` starts a throwaway pgboss instance against `DATABASE_URL_MIGRATE` (which does have DDL rights), lets it self-create the `pgboss` schema and tables, stops it immediately, and then issues `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO app_user` — DML only, no DDL. The long-running pgboss workers inside the `server` process subsequently connect via `DATABASE_URL_APP` and find the schema already in place. The exact pgboss API calls this wraps are an implementation detail of the `@batac/database` package, not specified further here.

### 11.4 What Gets Seeded Here vs. Deferred Elsewhere

The seed entrypoint is a generic runner. The specific payloads it loads are owned by other documents and are referenced here only at the level of "this mechanism is where that data gets loaded":

- The `CITY_ID` tenant row, using the UUID from L1's `CITY_ID` variable
- A minimal bootstrap Platform Administrator account, sufficient for first login (credentials read from env in development; never auto-generated with a printed password in any non-development `APP_ENV`)
- Once available: the full role/permission matrix (I2), number series configuration (H3), and document type catalog (H2) — each as its own seed module invoked from the same entrypoint, added incrementally as those documents are produced

---

## 12. Developer Quickstart

### 12.1 Option A — Fully Dockerized

No host Node or pnpm installation required beyond Docker itself.

```bash
cp .env.example .env
docker compose up
# postgres, minio, minio-init, mailpit, migrate, and seed all run and
# settle before `server` starts. API is reachable at localhost:3000.
```

To also run the frontend without installing anything on the host:

```bash
docker compose --profile containerized-web up
# Frontend at localhost:5173, hot-reloading via the bind-mounted source.
```

### 12.2 Option B — Host-Native (Recommended Default)

Fastest iteration, full IDE integration, no container rebuild for dependency changes.

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres minio minio-init mailpit
pnpm db:migrate
pnpm db:seed
pnpm dev   # Turborepo runs @batac/server and @batac/web dev tasks concurrently
```

Because `.env` is written from the host's perspective (Section 9.1), no edits are needed to switch between the two options — only which command sequence is run.

### 12.3 Convenience Scripts

Add to the root `package.json`:

```json
{
  "scripts": {
    "dev:infra": "docker compose up -d postgres minio minio-init mailpit",
    "dev:migrate": "docker compose run --rm migrate",
    "dev:seed": "docker compose run --rm seed",
    "dev:reset": "docker compose down -v && pnpm dev:infra && pnpm dev:migrate && pnpm dev:seed",
    "dev:logs": "docker compose logs -f"
  }
}
```

`pnpm dev:reset` is the "start completely clean" command — it drops the named volumes (wiping Postgres and MinIO data) before re-provisioning, which is the fastest way to recover from a corrupted local migration state.

---

## 13. Production-Preview Override (Optional)

A second compose file lets a developer validate the actual D5 topology — the `production` Dockerfile targets, the Nginx reverse proxy serving the built SPA — without deploying anywhere. It is deliberately **not** named `docker-compose.override.yml`, since Compose auto-merges a file with that exact name on every invocation with no flag required; an explicit name forces an explicit `-f` flag, so a developer can never end up running the prod-preview configuration by accident.

```yaml
# docker-compose.prod-preview.yml
# Usage: docker compose -f docker-compose.yml -f docker-compose.prod-preview.yml up --build
services:
  server:
    build:
      target: production
    volumes: !reset []
    environment:
      NODE_ENV: production

  web:
    profiles: []
    build:
      dockerfile: apps/web/Dockerfile
      target: production
    environment:
      FASTIFY_UPSTREAM: server:3000
    ports:
      - "8080:80"
    volumes: !reset []
    depends_on:
      - server
```

`volumes: !reset []` clears the dev-target bind mounts inherited from the base file (the Compose Specification's `!reset` YAML tag empties a previously-defined list rather than appending to it), since the `production` target needs none of them — it runs entirely from what was baked into the image at build time. Note `web`'s `profiles: []` resets it out of the `containerized-web` opt-in so it runs unconditionally under this override, on port 8080 to avoid colliding with a Vite dev server a developer might still have running on 5173.

---

## 14. .dockerignore

```
node_modules
**/node_modules
**/dist
**/.turbo
.git
.env
.env.*
!.env.example
*.log
.DS_Store
coverage
```

Keeping `node_modules` out of the build context is what makes the `deps` stage's Docker layer caching effective — without this, every build would send gigabytes of host `node_modules` into the build context before Docker even gets to decide a cached layer could have been reused.

---

## 15. Image Versioning Policy

| Image | Tag used in this spec | Pin policy |
|---|---|---|
| `postgres` | `17-alpine` | Pin the exact patch digest in CI; a minor-version bump should be a reviewed, deliberate change, not a silent `docker compose pull`. |
| `minio/minio` | `RELEASE.2025-04-22T22-12-26Z` | Representative tag — replace with the actual current stable release before first use. Never run `:latest` for this image beyond a single developer's throwaway environment. |
| `minio/mc` | `RELEASE.2025-04-08T15-39-49Z` | Same caveat; pair with a release known compatible with the `minio/minio` tag above. |
| `getmeili/meilisearch` | `v1.10` | Phase 2 only. Confirm against whatever version is actually current when Phase 2 begins. |
| `axllent/mailpit` | `latest` | Local-development convenience tool only; never deployed. Pin only if reproducibility across the team becomes an actual problem. |
| `node` | `22-alpine` | Matches the Node 18+ floor from `2-stack-context.md`'s `fetch` requirement; 22 is the version this project standardizes on. |
| `nginx` | `1.27-alpine` | Used only by the `web` Dockerfile's `production` target and the prod-preview override. |

---

## 16. Constraints and Invariants

| # | Constraint | How this document enforces it |
|---|---|---|
| 1 | No provider-specific S3 SDK or endpoint hardcoded anywhere | Local dev exercises the exact same `@aws-sdk/client-s3` + `S3_ENDPOINT` path as production, just pointed at MinIO instead of R2 — the only difference is one environment variable, proving the abstraction holds. |
| 2 | `audit_user` never receives DDL or UPDATE/DELETE rights | The bootstrap script in Section 10 creates the role with no privileges beyond LOGIN; all grants are applied later by migrations against `migrate_user`, never by this script. |
| 3 | The running application process never holds DDL rights | `server`'s Compose environment carries `DATABASE_URL_APP` only. `DATABASE_URL_MIGRATE` is injected only into the one-shot `migrate` service, which exits before `server` ever starts. |
| 4 | pgboss workers are not a separate deployable unit | No `pgboss` service block exists in Section 5.1; its tables live in PostgreSQL and its worker code runs inside `server`, exactly matching D5. |
| 5 | Production containers are stateless | The `production` build target (Section 6.1, 6.2) defines no volumes; only the `dev` targets used in local development bind-mount source for hot reload. |
| 6 | Switching S3 providers requires no code change | Demonstrated by this document itself — local development is the on-premise-style MinIO path D5 describes as the long-term migration target, reached purely through `S3_ENDPOINT`. |

---

_This document is part of the L-series infrastructure reference set. Update it after any change to the monorepo structure, the Dockerfile stage names, or the Compose service topology described here — and before L3 (CI/CD Pipeline Specification) is written, since L3 builds its pipeline stages directly on the `dev`/`build`/`production` targets defined in Section 6._
