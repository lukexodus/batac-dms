# Batac City LGU Platform

A government operations platform for the Sangguniang Panlungsod (SP) of Batac City, Ilocos Norte, Philippines — covering document management, tracking, and workflow automation for the city's legislative and administrative processes.

Physical documents remain the legal source of truth. This platform is the **operational** source of truth: tracking, routing, numbering, deadlines, and audit history for documents as they move through the SP Secretariat, committees, the Mayor's Office, and Sangguniang Panlalawigan review.

This is a monorepo (`batac-dms`) built as a modular monolith — see [Architecture](#architecture) below.

---

## Status

This is Phase 1 of a multi-phase rollout. All backend modules targeted for Phase 1 (Infrastructure, Audit, IAM, Organization, Documents, Tracking, Workflow) are implemented, including the workflow engine's Vitest test suite. The frontend has its core flows built — secretary dashboard, assigned-steps queue, complaints intake, document requests, role assignment, committee management — with several admin and dashboard views (Mayor dashboard, `/sysadmin`, `/organization`, `/order-of-business`, `/sessions`) still outstanding.

The public citizen portal (`apps/portal`) is a Next.js scaffold only — routing and fonts are wired up, but it isn't a working app yet. It's slated for Phase 3.

## Phase 1 scope

Phase 1 delivers, end-to-end:

- **SP Resolution** workflow — two readings, Mayor signature, 10-day lapse rule, veto override, Panlalawigan review
- **SP Ordinance** and **Appropriation Ordinance** workflows — three readings, same downstream rules as above
- Two-stage document numbering (preliminary "Draft" number at Secretariat logging, final number after the last reading vote)
- QR code generation and tracking, assigned at Secretariat logging
- Certified Urgent path (same-session second reading on the Mayor's formal certification)
- Sangguniang Panlalawigan review tracking with an automated 30-day timer
- Public portal subset: title + first page of approved resolutions/ordinances; full copies via paid Document Request
- SP Secretary and Mayor dashboards
- Session attendance tracking (absences, reasons, quorum)
- Citizen Complaint module (three access modes)
- Append-only, hash-chained audit trail for every legislative step
- RA 11032 (ARTA) SLA tracking

**Deferred to Phase 1B:** Letters Received/Sent, Memos Incoming/Outgoing, Notices of Committee Hearing, Notices of Special Session, Designations, Barangay Resolutions.

**Out of scope entirely:** Franchise Ordinances (separate jurisdiction — read-only link to the Franchise Section's own system, no CRUD).

## Architecture

Modular monolith with an internal event bus, not microservices — appropriate for the platform's scale and team size, with a clean extraction path if that ever changes. A few rules are treated as non-negotiable:

1. Each module owns its own PostgreSQL schema. No cross-schema foreign keys.
2. Modules talk to each other only through the event bus or a published module API — never by reaching into another module's tables directly.
3. Audit writes go through the audit service only.
4. File references are UUID storage keys, never original filenames.
5. Infrastructure is defined in code; no manual cloud resource creation.

The domain modules envisioned for the platform are `iam`, `organization`, `documents`, `workflow`, `tracking`, `records`, `notifications`, `audit`, `search_meta`, `portal`, and `reporting`. Of these, **`iam`, `organization`, `documents`, `workflow`, `tracking`, and `audit`** exist as implemented code today (`apps/server/src/modules/`). `records` and `reporting` are Phase 2; `search_meta` and `portal` (as a backend module) are Phase 3.

## Monorepo layout

```
/apps
  /web        — Vite + React SPA, the internal authenticated app used by the Secretariat, Mayor's office, etc.
  /server     — Fastify backend: tRPC procedures for /web, REST + OpenAPI for everything external, one process
  /portal     — Next.js public citizen portal (Phase 3 — currently a scaffold, not a working app)

/packages
  /shared     — Zod schemas, TypeScript types, and API contracts shared across apps
  /ui         — Shared React component library (shadcn/ui + Radix primitives on Tailwind)
  /config     — Shared ESLint, TypeScript, and Prettier config
  /database   — Drizzle schema, migrations, query helpers, seed data

/tools
  /scripts    — Deployment, DB seeding, and maintenance scripts

/docs         — Requirements gathering, architecture (Groups B–L), ADRs, and ops runbooks.
                Start at AGENTS.md, not here — see "Working in this repo" below.
```

## Stack

| Layer | Choice |
|---|---|
| Backend framework | Fastify |
| Internal API | tRPC (on Fastify) — used between `/web` and `/server` |
| External/public API | Fastify REST + OpenAPI (`@fastify/swagger`) |
| Internal frontend | Vite + React SPA (no SSR — fully authenticated, so it adds nothing) |
| Public portal | Next.js, Phase 3 (SSG for citizen-facing document lookups) |
| Database | PostgreSQL (JSONB, Row-Level Security, append-only audit grants) |
| ORM | Drizzle ORM + Drizzle Kit |
| Validation / contracts | Zod, in `packages/shared`, shared by backend, DB types, and frontend forms |
| Server state (frontend) | TanStack Query |
| UI state (frontend) | Zustand |
| Component library | shadcn/ui + Radix UI (owned source, not a black-box dependency) |
| Search | PostgreSQL FTS in Phase 1; Meilisearch from Phase 2 |
| Real-time | Server-Sent Events |
| File storage | S3-compatible, streamed (files never touch local disk) |
| Logging | Pino |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| Auth | Short-lived JWT + server-side refresh tokens in HTTP-only cookies (never localStorage) |
| Password hashing | Argon2id |
| PDF | pdf-lib (stamping); `@react-pdf/renderer` for templates |
| QR codes | `qrcode` (server-side generation) |
| Forms | React Hook Form + `@hookform/resolvers/zod` |
| Data tables | TanStack Table |
| Charts | Recharts |
| Scheduling | node-cron (simple) + pg-boss (durable jobs, retries, dead-letter) |

Package manager: **pnpm workspaces**. Build orchestration: **Turborepo**.

## Getting started

Requires Node.js and pnpm (the repo pins `pnpm@9.15.4` via `packageManager` in `package.json`, so `corepack` will pick it up automatically), and Docker for local infra.

```bash
# 1. Install dependencies across the workspace
pnpm install

# 2. Copy the environment template and fill in real values
cp .env.example .env

# 3. Start local infrastructure — Postgres, MinIO (S3-compatible storage),
#    Mailpit (email testing), Meilisearch
docker compose -f compose.yml up -d

# 4. Run database migrations, then seed reference data
pnpm --filter @batac/database db:migrate   # check packages/database for the exact script name
pnpm db:seed

# 5. Start everything in dev mode (server + web, via Turborepo)
pnpm dev
```

`.env.example` documents every variable, including three separate database roles (`batac_app`, `batac_audit`, `batac_migrate`) that back the audit-isolation and RLS design — don't collapse them into one connection string.

Other root-level scripts, all Turborepo-orchestrated across the workspace:

```bash
pnpm build              # build all apps and packages
pnpm lint                pnpm typecheck
pnpm test:unit           pnpm test:integration
```

For production, `compose.prod.yml` and the Dockerfiles under `apps/server` and `apps/web` define the deployment images; `nginx/` holds the reverse proxy config.

## Working in this repo

This repo is developed with heavy AI-agent involvement, and the `docs/` tree reflects that: it's large, and not meant to be read start-to-front. **Read `AGENTS.md` at the repo root before opening anything under `docs/`.** It routes each type of task (writing a workflow step, adding a tRPC router, writing a migration, and so on) to the specific documents you need, in order, and explains the source-of-truth hierarchy for when documents disagree. `docs/pre-development/document-list.md` has the full document index if your task isn't covered by that routing table.

`docs/development-findings-log.md` is the append-only record of decisions made during implementation where no pre-development document had the answer — worth checking for your module before you guess at something yourself.