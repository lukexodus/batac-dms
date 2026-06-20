# Stack Context — Government Platform


## Table of Contents

- [L24–L46] Monorepo Structure — App and package directories under pnpm workspaces, utilizing Turborepo for build orchestration and caching.
- [L47–L91] Stack Decisions — Technology selection table mapping backend, frontend, database, ORM, state management, storage, search, and UI libraries.
- [L92–L105] tRPC Architecture (Hybrid) — Internal app integration via tRPC procedures and external access via Fastify REST/OpenAPI, living in the same process.
- [L106–L121] Type Safety Chain — Data flow schema propagation mapping Drizzle DB schemas through packages, routes, forms, and TanStack Query.
- [L122–L133] PostgreSQL Non-Negotiables — Mandatory database features including JSONB, Row-Level Security, append-only audit tables, constraints, and gapless sequences.
- [L134–L144] Search Strategy — Transition plan from Phase 1 PostgreSQL FTS to Phase 2+ Meilisearch via a service abstraction layer.
- [L145–L162] File Storage Strategy — S3-compatible API client constraints, UUID keys, client-direct streaming rules, and R2/MinIO configurations.
- [L163–L179] OCR Strategy — Selection criteria between tesseract.js and self-hosted cloud options, testing timeline, and service wrapper requirements.
- [L180–L195] Audit Log Integrity — Append-only database rules combined with application-level SHA-256 hash chaining, HMAC signatures, and RFC 3161 timestamping.
- [L196–L205] Authentication Architecture — Short-lived JWTs, rotated refresh tokens stored in cookies with PKCE, and SSO compatibility requirements.
- [L206–L217] Testing Priorities — Testing priority checklist prioritizing state machines, ABAC endpoints, and Playwright E2E over CRUD unit test coverage.
- [L218–L226] Migration Rules — Version-controlled SQL migrations generated from Drizzle schema diffs, prohibiting production database resets.
- [L227–L233] Deployment Constraints — On-premise VPS hosting requirements, stateless server designs, and Nginx/Caddy static asset serving configurations.

---

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

| Layer                   | Choice                                                                                                       | Hard constraint                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Backend framework       | Fastify                                                                                                      | Schema-first routes; plugin scope enforces module encapsulation                                                               |
| Internal API            | tRPC on Fastify                                                                                              | End-to-end type safety for `/web` — no REST for internal routes                                                               |
| External/public API     | Fastify REST + OpenAPI (`@fastify/swagger`)                                                                  | Required for portal, mobile, third-party, or non-TS clients                                                                   |
| Internal frontend       | Vite + React SPA                                                                                             | No SSR; internal app is fully authenticated — SSR adds zero value                                                             |
| Public portal           | Next.js (Phase 3)                                                                                            | SSG for SEO on citizen-facing document lookups                                                                                |
| Database                | PostgreSQL                                                                                                   | JSONB, Row-Level Security, append-only audit grants — none exist in MySQL                                                     |
| ORM                     | Drizzle ORM + Drizzle Kit                                                                                    | Full PostgreSQL feature access with TypeScript inference                                                                      |
| Validation / contracts  | Zod (shared package)                                                                                         | Single source of truth: backend validation, DB types, frontend forms                                                          |
| Server state (frontend) | TanStack Query                                                                                               | Cache invalidation, background refetch, optimistic updates                                                                    |
| UI state (frontend)     | Zustand                                                                                                      | Modals, sidebar, multi-step form state — not server state                                                                     |
| Component library       | shadcn/ui + Radix UI primitives                                                                              | Owned source code; accessible by default; no version-lock risk                                                                |
| Search                  | Meilisearch (Phase 2+)                                                                                       | Typo tolerance required for Filipino proper names; PostgreSQL FTS acceptable in Phase 1                                       |
| Real-time notifications | Server-Sent Events (SSE)                                                                                     | One-directional push; no WebSocket infrastructure needed                                                                      |
| File storage            | S3-compatible (streamed) — Cloudflare R2 (Phase 1); MinIO (on-premise path)                                  | Files never touch disk; app stays stateless; migration = endpoint URL change only; no provider-specific SDK imports permitted |
| OCR                     | **Open decision** — `tesseract.js` (preferred) or self-hosted cloud OCR alternative — see OCR Strategy below | Must be self-hostable; no cloud-vendor dependency; on-premise constraint applies; required Phase 1                            |
| Audit log crypto        | Node built-in `crypto` (SHA-256 hash chain + HMAC per entry)                                                 | No external library; runs server-side only; see Audit Log Integrity below                                                     |
| Logging                 | Pino (built into Fastify) + pino-http                                                                        | Structured JSON; collected by log aggregator                                                                                  |
| Error tracking          | Sentry                                                                                                       | Unhandled exceptions are unacceptable in production from day one                                                              |
| Testing                 | Vitest (unit/integration) + Playwright (E2E)                                                                 |                                                                                                                               |
| Email                   | Nodemailer + @react-email/components                                                                         | Works with any SMTP provider including LGU mail server                                                                        |
| Auth pattern            | Short-lived JWT + server-side refresh tokens + HTTP-only cookies                                             | Never localStorage; structured for future SSO migration                                                                       |
| Password hashing        | Argon2id                                                                                                     | OWASP recommendation for new systems                                                                                          |
| PDF generation          | @react-pdf/renderer (templates) + pdf-lib (stamping)                                                         |                                                                                                                               |
| QR codes                | `qrcode` (server) + `html5-qrcode` or `zxing-wasm` (frontend scanner)                                        |                                                                                                                               |
| Forms                   | React Hook Form + `@hookform/resolvers/zod`                                                                  | Validates against shared Zod schemas                                                                                          |
| i18n                    | i18next + react-i18next                                                                                      | Filipino, English, Ilocano                                                                                                    |
| Rich text               | Tiptap                                                                                                       | Comments and annotations                                                                                                      |
| Data tables             | TanStack Table                                                                                               | Pairs with TanStack Query and shadcn/ui                                                                                       |
| Charts                  | Recharts                                                                                                     | Dashboard panels                                                                                                              |
| Virtual lists           | TanStack Virtual                                                                                             | Long document lists                                                                                                           |
| PDF viewer              | react-pdf                                                                                                    | In-browser rendering                                                                                                          |
| Date/time               | date-fns                                                                                                     | Never moment.js                                                                                                               |
| Env config              | dotenv + Zod schema                                                                                          | Fail fast on missing required vars at startup                                                                                 |
| Scheduling              | node-cron (simple) + pgboss (durable)                                                                        |                                                                                                                               |
| HTTP client             | native `fetch` (Node 18+) or `ky`                                                                            | Only for internal service calls; TanStack Query handles browser fetching                                                      |
| Rate limiting           | @fastify/rate-limit                                                                                          | Auth and portal endpoints                                                                                                     |
| CORS                    | @fastify/cors                                                                                                | Strict origin allowlist                                                                                                       |
| Security headers        | @fastify/helmet                                                                                              |                                                                                                                               |

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

## File Storage Strategy

|Phase|Provider|Reason|
|---|---|---|
|Phase 1 (cloud)|Cloudflare R2|No egress fees; S3-compatible API; straightforward setup|
|On-premise / future|MinIO|Full S3-compatible API; self-hostable; migration = endpoint URL change only|

**Non-negotiable rules:**

- Use the S3-compatible API exclusively. No Cloudflare-specific or MinIO-specific SDK imports are permitted anywhere in the codebase. The only allowed import is an S3-compatible client (e.g., `@aws-sdk/client-s3` pointed at the configured endpoint).
- File keys are UUIDs only — never original filenames. Original filename stored as metadata in PostgreSQL.
- S3 object versioning enabled on the bucket.
- Files are streamed directly between client and storage — they never touch the application server's local disk.
- Switching providers requires only an environment variable change (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`). No code changes.
- Supported formats: PDF, DOCX, XLSX, PNG, JPG. Maximum file size: 25 MB per file (configurable via env).

---

## OCR Strategy

OCR is a confirmed Phase 1 requirement. All uploaded documents are scanned automatically on upload and a scan quality indicator is always shown to the user so they can decide whether to re-scan before the document is formally logged.

**Open technical decision:** The specific OCR library has not been confirmed. Evaluate in this order:

1. **`tesseract.js`** — Pure Node.js; no native system dependencies; self-hostable; no cloud vendor required. Preferred given the on-premise deployment constraint. Primary concern: accuracy on scanned Filipino government documents, which may have variable scan quality and mixed-language text (Filipino/English/Ilocano).
2. **Self-hosted cloud OCR alternative** — Only if `tesseract.js` accuracy is found to be insufficient after testing against real SP Secretariat document samples. Must still be self-hostable with no external API calls. Cloud OCR services that send data off-premise are excluded — RA 10173 (Data Privacy Act) compliance and LGU data sovereignty requirements prohibit sending citizen document content to external vendors.

**Decision trigger:** Test `tesseract.js` against a representative sample of scanned SP Secretariat documents (letters, memos, resolutions) before the first OCR-dependent feature is implemented. If accuracy meets the threshold required for reliable full-text search indexing, the decision is closed. If not, evaluate alternatives under the self-hostable constraint.

**Architectural requirement regardless of library chosen:** The OCR processing call must be wrapped behind a service interface in `/server` so the underlying library is swappable without touching call sites. Do not call the OCR library directly from upload handlers.

**Phase 4 note:** Basic OCR with quality indicator is Phase 1. Advanced OCR capabilities (bulk historical processing, quality improvement workflows for legacy scanned content) are Phase 4.

---

## Audit Log Integrity

The audit log is append-only at the database permission level (`INSERT` only; `UPDATE` and `DELETE` revoked from the application DB user). The application layer adds a second integrity layer: hash chaining and HMAC.

**Implementation uses Node built-in `crypto` only** — no external library.

**Hash chain:** Each audit event record stores `SHA-256(previous_event_hash + current_event_payload)` as its `chain_hash` column. The first record in a series uses a known genesis hash. The chain is validated at retrieval time — a broken chain is flagged as a tamper indicator.

**HMAC:** Each event payload is signed with `HMAC-SHA-256` using a secret key held by the application (stored in environment variable, not in the database). This prevents an attacker with direct DB write access from inserting a record and computing a valid chain hash without the key.

**Claim boundary:** The audit log is **tamper-evident, not tamper-proof.** Evidence of tampering can be detected. Prevention of tampering by a sufficiently privileged attacker (one who has both the DB write access and the HMAC secret) is outside the scope of this implementation. This distinction must be documented in the ADR for the audit log design.

**External timestamp:** Monthly export to an RFC 3161 timestamp authority (TSA). Provider to be confirmed. This extends the tamper-evidence guarantee to cover bulk deletion of recent records.

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
