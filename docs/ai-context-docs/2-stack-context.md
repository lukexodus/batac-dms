# Stack Context — Government Platform

---

## Monorepo Structure

```
/apps
  /web        — Vite + React SPA (internal authenticated app)
  /server     — Fastify backend (tRPC + REST routes, single process)
  /portal     — Next.js (public citizen portal — Phase 3 only)

/packages
  /shared     — Zod schemas, TypeScript types, API contracts, constants
  /ui         — Shared React component library (shadcn/ui + Tailwind)
  /config     — Shared ESLint, TypeScript, Prettier, tsconfig
  /database   — Drizzle schema, migrations, query helpers, seed data

/tools
  /scripts    — Deployment, DB seeding, maintenance, migration scripts
```

**Package manager:** pnpm workspaces (symlink isolation enforces dependency boundaries — a package cannot accidentally consume another package's undeclared deps).  
**Build orchestration:** Turborepo (remote caching; only rebuilds packages whose inputs changed).

---

## Stack Decisions

| Layer                   | Choice                                                                | Hard constraint                                                                         |
| ----------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Backend framework       | Fastify                                                               | Schema-first routes; plugin scope enforces module encapsulation                         |
| Internal API            | tRPC on Fastify                                                       | End-to-end type safety for `/web` — no REST for internal routes                         |
| External/public API     | Fastify REST + OpenAPI (`@fastify/swagger`)                           | Required for portal, mobile, third-party, or non-TS clients                             |
| Internal frontend       | Vite + React SPA                                                      | No SSR; internal app is fully authenticated — SSR adds zero value                       |
| Public portal           | Next.js (Phase 3)                                                     | SSG for SEO on citizen-facing document lookups                                          |
| Database                | PostgreSQL                                                            | JSONB, Row-Level Security, append-only audit grants — none exist in MySQL               |
| ORM                     | Drizzle ORM + Drizzle Kit                                             | Full PostgreSQL feature access with TypeScript inference                                |
| Validation / contracts  | Zod (shared package)                                                  | Single source of truth: backend validation, DB types, frontend forms                    |
| Server state (frontend) | TanStack Query                                                        | Cache invalidation, background refetch, optimistic updates                              |
| UI state (frontend)     | Zustand                                                               | Modals, sidebar, multi-step form state — not server state                               |
| Component library       | shadcn/ui + Radix UI primitives                                       | Owned source code; accessible by default; no version-lock risk                          |
| Search                  | Meilisearch (Phase 2+)                                                | Typo tolerance required for Filipino proper names; PostgreSQL FTS acceptable in Phase 1 |
| Real-time notifications | Server-Sent Events (SSE)                                              | One-directional push; no WebSocket infrastructure needed                                |
| File storage            | S3-compatible (streamed)                                              | Files never touch disk; app stays stateless                                             |
| Logging                 | Pino (built into Fastify) + pino-http                                 | Structured JSON; collected by log aggregator                                            |
| Error tracking          | Sentry                                                                | Unhandled exceptions are unacceptable in production from day one                        |
| Testing                 | Vitest (unit/integration) + Playwright (E2E)                          |                                                                                         |
| Email                   | Nodemailer + @react-email/components                                  | Works with any SMTP provider including LGU mail server                                  |
| Auth pattern            | Short-lived JWT + server-side refresh tokens + HTTP-only cookies      | Never localStorage; structured for future SSO migration                                 |
| Password hashing        | Argon2id                                                              | OWASP recommendation for new systems                                                    |
| PDF generation          | @react-pdf/renderer (templates) + pdf-lib (stamping)                  |                                                                                         |
| QR codes                | `qrcode` (server) + `html5-qrcode` or `zxing-wasm` (frontend scanner) |                                                                                         |
| Forms                   | React Hook Form + `@hookform/resolvers/zod`                           | Validates against shared Zod schemas                                                    |
| i18n                    | i18next + react-i18next                                               | Filipino, English, Ilocano                                                              |
| Rich text               | Tiptap                                                                | Comments and annotations                                                                |
| Data tables             | TanStack Table                                                        | Pairs with TanStack Query and shadcn/ui                                                 |
| Charts                  | Recharts                                                              | Dashboard panels                                                                        |
| Virtual lists           | TanStack Virtual                                                      | Long document lists                                                                     |
| PDF viewer              | react-pdf                                                             | In-browser rendering                                                                    |
| Date/time               | date-fns                                                              | Never moment.js                                                                         |
| Env config              | dotenv + Zod schema                                                   | Fail fast on missing required vars at startup                                           |
| Scheduling              | node-cron (simple) + pgboss (durable)                                 |                                                                                         |
| HTTP client             | native `fetch` (Node 18+) or `ky`                                     | Only for internal service calls; TanStack Query handles browser fetching                |
| Rate limiting           | @fastify/rate-limit                                                   | Auth and portal endpoints                                                               |
| CORS                    | @fastify/cors                                                         | Strict origin allowlist                                                                 |
| Security headers        | @fastify/helmet                                                       |                                                                                         |

---

## tRPC Architecture (Hybrid)

**Rule:** tRPC is used exclusively for `/web` (internal app) ↔ `/server`. The public portal and any external-facing interface use REST only.

```
/web  ──tRPC──▶  /server (Fastify)  ──REST/OpenAPI──▶  /portal, mobile, third-party
```

- tRPC procedures are defined in `/server`, consumed in `/web` with full type inference via TanStack Query (tRPC v11 uses TanStack Query as its data layer).
- REST routes are defined in `/server` with `@fastify/swagger` generating an OpenAPI 3.0 spec from route schemas.
- Both live in the same Fastify process; they are separated by plugin scope.

---

## Type Safety Chain

```
Drizzle schema (PostgreSQL)
  └─▶ drizzle-zod → Zod schemas
        └─▶ /packages/shared (single source of truth)
              ├─▶ Fastify route validation (fastify-type-provider-zod)
              ├─▶ tRPC procedure input validation
              ├─▶ React Hook Form validation (@hookform/resolvers/zod)
              └─▶ TanStack Query response types
```

A DB schema change propagates as a compile error to every layer. No runtime contract surprises.

---

## PostgreSQL Non-Negotiables

These features are the reason MySQL is excluded. Do not work around them.

- **JSONB** — Admin-configurable document metadata (variable fields per document type). Use GIN indexes. Query with `@>` operator and `->>` accessors.
- **Row-Level Security (RLS)** — Office-level data isolation enforced at the DB engine, not only in application middleware.
- **Append-only audit log** — Revoke `UPDATE` and `DELETE` on the audit schema from the application DB user. Only `INSERT` is permitted. This is enforced at the PostgreSQL grant level.
- **Check constraints for state transitions** — Enforce valid workflow state transitions at the DB level as a second line of defense.
- **Sequences for gapless document numbering** — Use PostgreSQL sequences with appropriate configuration per series per year.

---

## Search Strategy

|Phase|Tool|Reason|
|---|---|---|
|Phase 1|PostgreSQL FTS (`tsvector`/`tsquery`)|Zero extra infra; sufficient for initial document volume|
|Phase 2+|Meilisearch (Docker, self-hosted)|Typo tolerance for Filipino names; faceted filtering; synced from PostgreSQL|

Design the search interface as an abstraction layer in the application from day one so the underlying provider is swappable without touching call sites.

---

## Authentication Architecture

- Short-lived JWT access tokens (15–60 min)
- Long-lived refresh tokens stored server-side in PostgreSQL; rotated on every refresh
- Tokens delivered via HTTP-only, Secure, SameSite=Strict cookies — never localStorage or sessionStorage
- PKCE for the SPA (public client)
- Structure must remain compatible with future SSO or national identity provider integration

---

## Testing Priorities

Run tests in this order of value:

1. Workflow engine state machine — every valid and invalid state transition
2. API integration tests — all ABAC-protected Fastify routes (use Fastify's built-in `.inject()`)
3. E2E tests (Playwright) — the five or six most critical user journeys end-to-end

Do not chase high unit test coverage of CRUD modules. It is a poor return on investment.

---

## Migration Rules

- Every schema change produces a migration file committed to version control.
- Drizzle Kit generates SQL migrations from schema diffs. Review the SQL before applying.
- Never use reset-and-regenerate in production.
- Migrations must be readable, reviewable, and executable directly by `psql` if needed.

---

## Deployment Constraints

- On-premise deployable (VPS, not shared hosting)
- No cloud-vendor lock-in
- Application must be stateless (files to S3-compatible storage, sessions in PostgreSQL)
- Frontend (`/web`) is a static bundle served by Nginx/Caddy — no Node process required
- Meilisearch runs as a separate Docker container with S3 snapshot support