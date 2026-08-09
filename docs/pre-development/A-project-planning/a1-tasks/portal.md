# A1 — Module Task List: PORTAL

Generated per `A1-AGENTS.md` §6 "Step 2 — Module passes," for the `PORTAL` module
(Wave G — final wave; requires INFRA, UI, IAM, AUDIT, ORG, DOCS, WF, TRACK, REC,
NOTIF task lists to already exist so their TASK IDs can be referenced in
Prerequisites fields). This document contains tasks only; it is not the
assembled A1 (that is the Step 4 integration pass).

**Documents loaded for this pass, in order:** `a1-skeleton.md` (v2.1) →
`a1-tasks/infra.md` → `a1-tasks/ui.md` → `a1-tasks/iam.md` → `a1-tasks/audit.md`
→ `a1-tasks/org.md` → `a1-tasks/docs.md` → `a1-tasks/wf.md` → `a1-tasks/track.md`
→ `a1-tasks/rec.md` → `a1-tasks/notif.md` → E2 (REST API Specification, OpenAPI
3.0, read in full) → F1 §2 (cross-cutting notes) and §14 (Phase 1 public portal
subset) → `consolidated-architecture-and-requirements-reference-iteration-3.md`
Part 13 (Roadmap, all phases) plus Parts 11.18, 4.14, and 4.15 (Citizen Portal
and Identity; Citizen Complaint; Document and Records Request Form).

**A resolved conflict governs this entire document — read this before the
tasks below.** `A1-AGENTS.md` §2's Pass Types table lists this pass's
consolidated-reference load as "§13 Phase 3" — the only module row in that
table that names a specific phase at all. Taken literally, that would produce
title-only stub entries (per `A1-AGENTS.md` §6 Step 3), not the full-schema
tasks this file actually contains. Three independent, higher-specificity
sources contradict that literal reading and were followed instead:

1. `A1-AGENTS.md` §6 Step 2's own opening instruction, quoted verbatim by
   `a1-skeleton.md` §3: *"read the capability list for this module in
   consolidated ref §13 Phase 1... for every pass without exception."*
2. `a1-skeleton.md` §3's Phase Scope Table marks `PORTAL`'s Phase 1 column
   **"Full spec"** (Phase 3 is "Title only [†]") and §6's Task Count Estimate
   gives `PORTAL` a Phase 1 row of **8–12 tasks**, explicitly excluding it from
   the "zero Phase 1 capability" treatment given to `SEARCH`/`REPORT` (which
   have no row in that table at all).
3. Consolidated ref Part 13 Phase 1's own "Included" list names **"Public
   portal (Phase 1 subset: track by number + published documents with
   first-page preview)"** and **"Citizen Complaint module"** directly, and Part
   11.18 has a subsection literally titled **"Phase 1 public portal behavior
   confirmed"** enumerating exactly these capabilities plus document-request
   submission. Part 13 Phase 3 ("Citizen Portal (Months 13–18)") separately
   describes a *later, fuller* rollout — citizen accounts, SMS gateway, DPA
   compliance, barangay access, advanced dashboards — none of which this task
   list builds.

**Resolution applied:** this pass generates full-spec, `Phase: 1`-tagged tasks
for the four no-auth capabilities named above. `A1-AGENTS.md` §2's Pass Types
table row for `PORTAL` appears to contain a documentation error (`Phase 3`
where every other signal, including its own §6 rule, says `Phase 1`); this is
flagged here rather than silently corrected, per `A1-AGENTS.md` §1's "never
resolve a conflict by guessing" rule. E2 and F1 §14 were still read in full
exactly as instructed — they are the correct source for *how* to build these
endpoints regardless of which phase number labels them, and F1 §14's own route
table additionally documents the *later* Phase-3-proper citizen-account routes
(`/portal/register`, `/portal/login`, the two `:id/status` pages) and the
`/portal/announcements` route, none of which is backed by any endpoint in E2's
six-endpoint Phase 1 contract. Those routes are listed as `[DEFERRED]` in the
Module Summary rather than built here — inventing a REST contract E2 does not
define would violate `A1-AGENTS.md` §8's "do not invent content to fill a spec
gap" rule.

**Sourcing & confidence legend** (matching the convention established in
`a1-skeleton.md` v2 and every prior module pass):
- Unmarked statements are taken directly from one of the loaded documents.
- `[Inference]` — a reasoned synthesis not stated verbatim in a loaded document.
- `[SPEC GAP]` — something a source requires but no loaded document specifies
  clearly enough to write a self-contained AI Prompt for. Not invented; left
  for human resolution per `A1-AGENTS.md` §1 and §8.
- `[CONFLICT]` — an apparent disagreement between two loaded sources, flagged
  rather than resolved by guessing, per `A1-AGENTS.md` §1.

---

## Table of Contents

- [Phase 1 PORTAL capabilities identified before task generation]
- [TASK-PORTAL-001] — Scaffold `/apps/portal` Next.js application, environment validation, and typed REST client foundation.
- [TASK-PORTAL-002] — Implement shared Zod schemas for all six public REST contracts and common envelope types.
- [TASK-PORTAL-003] — `[Inference][MIGRATION]` Extend DOCS Published API with an unauthenticated citizen-submission write method; seed two new number series.
- [TASK-PORTAL-004] — `[Inference]` Extend DOCS Published API with public-document list and detail read methods.
- [TASK-PORTAL-005] — Implement `GET /v1/public/documents` and `GET /v1/public/documents/{documentId}`.
- [TASK-PORTAL-006] — `[AUDIT]` Implement `POST /v1/public/complaints`.
- [TASK-PORTAL-007] — `[AUDIT]` Implement `POST /v1/public/document-requests`.
- [TASK-PORTAL-008] — Register `@fastify/swagger`, rate limiting, and CORS; wire all public routes (including TRACK's existing endpoint) into one OpenAPI contract.
- [TASK-PORTAL-009] — Frontend: home, tracking lookup, and published-documents list/detail pages.
- [TASK-PORTAL-010] — Frontend: citizen complaint submission form.
- [TASK-PORTAL-011] — Frontend: Document and Records Request Form submission.
- [Module Summary — PORTAL]

---

## Phase 1 PORTAL capabilities identified before task generation

Per `A1-AGENTS.md` §6 Step 2's instruction to identify the complete capability
set before writing any task, cross-checked across all three sources named in
the resolved-conflict note above:

1. **Document status lookup by QR tracking number** — already fully
   implemented by `TASK-TRACK-008` (`publicLookupHandler`, unauthenticated
   REST). This module does not rebuild it; it (a) gives it a public-facing
   `/portal/lookup` page and (b) folds it into the same OpenAPI contract as
   the other five endpoints, since E2 treats all six as one spec and TRACK's
   pass predates E2's existence in any module's reading list.
2. **Published legislative documents — list and detail** — net-new REST (`GET
   /v1/public/documents`, `GET /v1/public/documents/{documentId}`) and
   frontend pages. Read-only; consumes DOCS's existing Published API.
3. **Citizen complaint submission** — net-new REST (`POST
   /v1/public/complaints`) and frontend form. Requires a new DOCS write path
   (`TASK-PORTAL-003`).
4. **Document and Records Request Form submission** — net-new REST (`POST
   /v1/public/document-requests`) and frontend form. Same new DOCS write path
   as (3). Payment collection is explicitly out of scope (consolidated ref
   Part 4.15: "Payment system: Deferred to stages later than the currently
   planned phases. Not Phase 1 or Phase 1B.").

**Not in this list, and not built by this task list — see Module Summary
Deferred Capabilities:** citizen registration/login/OTP, authenticated
request/complaint status-tracking pages, `/portal/announcements`, payment
processing, and everything named under consolidated ref Part 13's true Phase 3
("Citizen Portal (Months 13–18)") — SMS gateway, DPA compliance features,
barangay official access, advanced executive dashboards, and the
`portal.complaints` / `portal.citizen_requests` schema tables DOCS's own
Module Summary (`CONFLICT-DOCS-01`) reserves for "when the full PORTAL module
ships" as a later, separate effort.

---
## TASK-PORTAL-001

Phase:          1
Module:         PORTAL
Title:          Scaffold `/apps/portal` Next.js application and environment validation
Prerequisites:  [TASK-INFRA-001]
Deliverables:
  - /apps/portal/package.json — `@batac/portal` workspace package; Next.js 15 (App Router), React 18, `@batac/ui` and `@batac/shared` as workspace dependencies; scripts: `dev`, `build`, `start`, `lint`, `typecheck`
  - /apps/portal/next.config.ts — Next.js config; `transpilePackages: ['@batac/ui', '@batac/shared']` so the workspace packages' TypeScript sources are compiled correctly; `output: 'standalone'` for the Docker build pattern matching `apps/web`
  - /apps/portal/tsconfig.json — extends `@batac/config/tsconfig.base.json`; `@/*` path alias to `./src/*`
  - /apps/portal/src/config/env.portal.ts — Zod-validated environment schema, fail-fast on missing/invalid values, mirroring the pattern in `apps/web/src/config/env.client.ts`
  - /apps/portal/src/lib/api-client.ts — typed `fetch` wrapper for the six public REST endpoints; base URL from `env.portal.ts`; unwraps the `{ data, meta? }` envelope; throws a typed `PortalApiError` on non-2xx responses carrying the `ErrorResponse`/`ValidationErrorResponse` shape
  - /apps/portal/.env.example — placeholder values for every key in `env.portal.ts`
  - /apps/portal/tailwind.config.ts — re-exports `@batac/config`'s Tailwind preset (mirrors `apps/web`'s config; no local token overrides)
Acceptance Criteria:
  - [ ] `pnpm --filter @batac/portal typecheck` passes with zero errors
  - [ ] `pnpm --filter @batac/portal build` completes with exit code 0 on a clean checkout with `.env.example` copied to `.env.local`
  - [ ] Starting the dev server and requesting `/` returns a 200 (a placeholder page is acceptable; the home page itself is not a deliverable of this task — see TASK-PORTAL-009)
  - [ ] Omitting `NEXT_PUBLIC_API_URL` from the environment causes the process to fail fast at startup with a Zod validation error identifying the missing key, not a runtime crash on first request
  - [ ] Manual: `apps/portal/src/app/layout.tsx` and `apps/portal/src/lib/fonts.ts` (already present in the repository) are left unmodified — this task adds files around them, not to them
AI Prompt:
  > Scaffold the `/apps/portal` Next.js application — the public, unauthenticated
  > citizen-facing site for the Batac City LGU Platform. You have no
  > pre-development documents available — all required values are below.
  >
  > **Two files already exist in this app and must not be modified:**
  > `/apps/portal/src/app/layout.tsx` (root layout — imports fonts and
  > `@batac/ui/styles/globals.css`) and `/apps/portal/src/lib/fonts.ts`
  > (next/font configuration for Inter, JetBrains Mono, and Lora, matching
  > `/apps/web`'s typography exactly). Build around them.
  >
  > **package.json** — name `@batac/portal`, private, Next.js `^15.0.0`,
  > `react`/`react-dom` `^18.3.0`, `zod` (workspace-pinned version — check
  > the root `package.json` / other apps for the exact pin), `@batac/ui` and
  > `@batac/shared` as `workspace:*` dependencies. Scripts: `"dev": "next dev"`,
  > `"build": "next build"`, `"start": "next start"`, `"lint": "eslint ."`,
  > `"typecheck": "tsc --noEmit"`.
  >
  > **next.config.ts:**
  > ```typescript
  > import type { NextConfig } from 'next';
  >
  > const nextConfig: NextConfig = {
  >   output: 'standalone',
  >   transpilePackages: ['@batac/ui', '@batac/shared'],
  >   images: {
  >     remotePatterns: [
  >       { protocol: 'https', hostname: 'r2.batac.gov.ph' },
  >     ],
  >   },
  > };
  >
  > export default nextConfig;
  > ```
  > The `images.remotePatterns` entry is required because first-page preview
  > images are served from presigned `r2.batac.gov.ph` URLs (see
  > TASK-PORTAL-005); Next.js's `<Image>` component rejects unlisted remote
  > hosts at build time.
  >
  > **tsconfig.json** — extend `@batac/config/tsconfig.base.json` (the shared
  > base config every other app in this monorepo extends), add Next.js's
  > required `"plugins": [{ "name": "next" }]` and `"paths": { "@/*": ["./src/*"] }`.
  >
  > **Environment schema** (`src/config/env.portal.ts`) — Next.js exposes only
  > `NEXT_PUBLIC_`-prefixed variables to the browser; unprefixed variables are
  > server-only (used only in Server Components / Route Handlers, never in this
  > app's case since it calls the REST API directly from the client per
  > TASK-PORTAL-009/010/011). All values below are safe for client exposure —
  > none are secrets:
  > ```typescript
  > import { z } from 'zod';
  >
  > const envSchema = z.object({
  >   NEXT_PUBLIC_API_URL: z.string().url(),
  >   NEXT_PUBLIC_APP_URL: z.string().url(),
  >   NEXT_PUBLIC_APP_NAME: z.string().default('Batac City LGU — Public Portal'),
  >   NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  >   NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
  > });
  >
  > export const env = envSchema.parse({
  >   NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  >   NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
  >   NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'],
  >   NEXT_PUBLIC_SENTRY_DSN: process.env['NEXT_PUBLIC_SENTRY_DSN'],
  >   NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env['NEXT_PUBLIC_SENTRY_ENVIRONMENT'],
  > });
  > ```
  > `NEXT_PUBLIC_API_URL` points at the same Fastify server `/apps/web` calls,
  > e.g. `http://localhost:3000/v1` in development (note the `/v1` prefix — see
  > E2's Base URL and Versioning convention). This module does not define its
  > own backend; it is a REST client of the same `/apps/server` process that
  > `/apps/web` and `/apps/portal` both talk to, over different protocols
  > (tRPC internally, REST here).
  >
  > **API client** (`src/lib/api-client.ts`) — a thin typed wrapper, not a
  > full library (no React Query dependency needed at this layer; data
  > fetching hooks are added per-page in later tasks). Shape:
  > ```typescript
  > import { env } from '@/config/env.portal';
  >
  > export class PortalApiError extends Error {
  >   constructor(
  >     public statusCode: number,
  >     public errorType: string,
  >     message: string,
  >     public details?: Array<{ field: string; message: string; code?: string }>
  >   ) {
  >     super(message);
  >   }
  > }
  >
  > export async function portalFetch<T>(
  >   path: string,
  >   init?: RequestInit
  > ): Promise<T> {
  >   const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
  >     ...init,
  >     headers: { 'Content-Type': 'application/json', ...init?.headers },
  >   });
  >   const body = await res.json();
  >   if (!res.ok) {
  >     throw new PortalApiError(
  >       body.statusCode ?? res.status,
  >       body.error ?? 'Error',
  >       body.message ?? 'Request failed.',
  >       body.details
  >     );
  >   }
  >   return body as T; // caller destructures .data / .meta per E2's response envelope
  > }
  > ```
  >
  > **Tailwind config** — re-export the shared preset rather than duplicating
  > token definitions:
  > ```typescript
  > import type { Config } from 'tailwindcss';
  > import sharedPreset from '@batac/config/tailwind-preset';
  >
  > const config: Config = {
  >   presets: [sharedPreset],
  >   content: [
  >     './src/**/*.{ts,tsx}',
  >     '../../packages/ui/src/**/*.{ts,tsx}',
  >   ],
  > };
  >
  > export default config;
  > ```
  > `[SPEC GAP]`: no loaded document confirms `@batac/config` actually exports a
  > `tailwind-preset` entry point (its `package.json` was not part of this
  > pass's reading list — `@batac/config` is an INFRA deliverable, and this
  > pass's Load list does not include `infra.md`'s file-by-file content beyond
  > its Table of Contents). If no such export exists, inline the token
  > `@theme` values directly from `packages/ui/src/styles/globals.css` instead
  > (`layout.tsx` already imports that stylesheet globally, so duplication may
  > not even be necessary — confirm before adding a second token source).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter @batac/portal typecheck` passes with zero errors
  > - [ ] `pnpm --filter @batac/portal build` completes with exit code 0 on a clean checkout with `.env.example` copied to `.env.local`
  > - [ ] Starting the dev server and requesting `/` returns a 200
  > - [ ] Omitting `NEXT_PUBLIC_API_URL` causes fail-fast startup with a clear Zod error
  > - [ ] `layout.tsx` and `fonts.ts` are unmodified
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-002

Phase:          1
Module:         PORTAL
Title:          Implement shared Zod schemas for all six public REST contracts
Prerequisites:  [TASK-INFRA-001]
Deliverables:
  - /packages/shared/src/schemas/common/errors.ts — `ErrorResponseSchema`, `ValidationErrorResponseSchema`
  - /packages/shared/src/schemas/common/pagination.ts — `PaginationMetaSchema`
  - /packages/shared/src/schemas/common/presigned-image.ts — `PresignedImageRefSchema`
  - /packages/shared/src/schemas/common/health.ts — `HealthResponseSchema`
  - /packages/shared/src/schemas/public/tracking.ts — `RoutingHistoryEntrySchema`, `TrackingLookupDataSchema`, `TrackingLookupResponseSchema`
  - /packages/shared/src/schemas/public/documents.ts — `PublishedDocumentTypeSchema`, `PanlalawiganOutcomeSchema`, `PublishedDocumentSummarySchema`, `PublishedDocumentDetailSchema`, `PublishedDocumentListResponseSchema`, `PublishedDocumentDetailResponseSchema`
  - /packages/shared/src/schemas/public/complaints.ts — `ComplaintViolationTypeSchema`, `ComplaintAccessModeSchema`, `ComplaintSubmissionRequestSchema`, `ComplaintSubmissionResultSchema`, `ComplaintSubmissionResponseSchema`
  - /packages/shared/src/schemas/public/document-requests.ts — `DocumentRequestAccessModeSchema`, `DocumentRequestSubmissionRequestSchema`, `DocumentRequestSubmissionResultSchema`, `DocumentRequestSubmissionResponseSchema`
  - /packages/shared/src/schemas/public/index.ts — barrel re-export of all schemas above
Acceptance Criteria:
  - [ ] `pnpm --filter @batac/shared typecheck` passes with zero errors
  - [ ] `pnpm --filter @batac/shared test:unit` passes a new schema-parsing test file that feeds each of the four example payloads from E2 (the `transportation_overcharging` and `general_lgu` complaint examples, the document-request example, and the tracking-lookup response example) through the matching schema and asserts success
  - [ ] Every field name, `required` list, `maxLength`, `pattern`, and `enum` value below matches E2's OpenAPI spec exactly — a reviewer diffs this file against the E2 component definitions field-by-field
  - [ ] Manual: `ComplaintSubmissionRequestSchema` rejects a payload with `violationType: 'other'` and no `violationTypeOther`, and rejects `incidentTime: '2:30 PM'` (must be 24-hour `HH:MM`)
AI Prompt:
  > Implement the shared Zod schemas backing the Batac City LGU Platform's
  > public REST API. These schemas are the single source of truth referenced
  > by every route's Fastify `schema` option (request validation, response
  > serialization, and `@fastify/swagger`'s auto-generated OpenAPI spec all
  > derive from them) — see the Route Schema Definition Pattern below for how
  > they get consumed.
  >
  > **Common schemas** (`schemas/common/`):
  > ```typescript
  > // errors.ts
  > import { z } from 'zod';
  >
  > export const ErrorResponseSchema = z.object({
  >   statusCode: z.number().int(),
  >   error: z.string(),
  >   message: z.string(),
  > });
  >
  > export const ValidationErrorResponseSchema = ErrorResponseSchema.extend({
  >   details: z.array(
  >     z.object({
  >       field: z.string(),
  >       message: z.string(),
  >       code: z.string().optional(),
  >     })
  >   ).optional(),
  > });
  >
  > // pagination.ts
  > export const PaginationMetaSchema = z.object({
  >   total: z.number().int().min(0),
  >   page: z.number().int().min(1),
  >   limit: z.number().int().min(1).max(100),
  >   totalPages: z.number().int().min(0),
  >   hasNextPage: z.boolean(),
  >   hasPrevPage: z.boolean(),
  > });
  >
  > // presigned-image.ts
  > export const PresignedImageRefSchema = z.object({
  >   url: z.string().url(),
  >   expiresAt: z.string().datetime({ offset: true }),
  >   widthPx: z.number().int().nullable().optional(),
  >   heightPx: z.number().int().nullable().optional(),
  > });
  >
  > // health.ts
  > export const HealthResponseSchema = z.object({
  >   status: z.enum(['ok', 'degraded', 'unavailable']),
  >   version: z.string(),
  >   timestamp: z.string().datetime({ offset: true }),
  > });
  > ```
  >
  > **Tracking schemas** (`schemas/public/tracking.ts`) — this backs TRACK's
  > already-implemented `TASK-TRACK-007`/`TASK-TRACK-008`, not a new endpoint
  > this module builds; it is defined here because this pass is the first to
  > load E2 in full and TRACK's own pass predates E2 in every module's reading
  > list, so no shared-package version of this contract exists yet:
  > ```typescript
  > import { z } from 'zod';
  > import { PresignedImageRefSchema } from '../common/presigned-image';
  >
  > export const RoutingHistoryEntrySchema = z.object({
  >   timestamp: z.string().datetime({ offset: true }),
  >   action: z.string(),
  >   fromOfficeName: z.string().nullable(),
  >   toOfficeName: z.string().nullable(),
  >   actorDisplayName: z.string().nullable(),
  > });
  >
  > export const TrackingLookupDataSchema = z.object({
  >   trackingNumber: z.string().uuid(),
  >   documentId: z.string().uuid(),
  >   documentType: z.string(),
  >   documentTypeName: z.string(),
  >   title: z.string(),
  >   preliminaryNumber: z.string().nullable(),
  >   finalNumber: z.string().nullable(),
  >   lifecycleStatus: z.string(),
  >   remarks: z.string().nullable().optional(),
  >   routingHistory: z.array(RoutingHistoryEntrySchema),
  >   firstPagePreview: PresignedImageRefSchema,
  >   documentRequestUrl: z.string().url(),
  >   supersededBy: z.string().uuid().nullable().optional(),
  >   supersededAt: z.string().datetime({ offset: true }).nullable().optional(),
  >   closureReason: z.string().nullable().optional(),
  > });
  >
  > export const TrackingLookupResponseSchema = z.object({
  >   data: TrackingLookupDataSchema,
  > });
  > ```
  >
  > **Published documents schemas** (`schemas/public/documents.ts`):
  > ```typescript
  > import { z } from 'zod';
  > import { PresignedImageRefSchema } from '../common/presigned-image';
  > import { PaginationMetaSchema } from '../common/pagination';
  >
  > export const PublishedDocumentTypeSchema = z.enum([
  >   'SP_RESOLUTION',
  >   'SP_ORDINANCE',
  >   'APPROPRIATION_ORDINANCE',
  > ]);
  >
  > export const PanlalawiganOutcomeSchema = z.enum([
  >   'valid',
  >   'valid_in_part',
  >   'returned',
  >   'operative_in_its_entirety',
  >   'deemed_approved',
  > ]).nullable();
  >
  > export const PublishedDocumentSummarySchema = z.object({
  >   documentId: z.string().uuid(),
  >   documentType: PublishedDocumentTypeSchema,
  >   documentTypeName: z.string(),
  >   title: z.string(),
  >   finalNumber: z.string(),
  >   approvedAt: z.string(), // date, not date-time — "2026-02-18"
  >   releasedAt: z.string().datetime({ offset: true }),
  >   trackingNumber: z.string().uuid(),
  >   firstPagePreview: PresignedImageRefSchema,
  >   documentRequestUrl: z.string().url(),
  >   supersededBy: z.string().uuid().nullable().optional(),
  >   supersededAt: z.string().datetime({ offset: true }).nullable().optional(),
  >   closureReason: z.string().nullable().optional(),
  > });
  >
  > export const PublishedDocumentDetailSchema = PublishedDocumentSummarySchema.extend({
  >   authors: z.array(z.string()),
  >   sponsors: z.array(z.string()),
  >   committees: z.array(z.string()),
  >   panlalawiganOutcome: PanlalawiganOutcomeSchema,
  >   panlalawiganOutcomeDate: z.string().nullable(),
  >   hasNewspaperPublication: z.boolean(),
  >   newspaperPublicationDate: z.string().nullable(),
  > });
  >
  > export const PublishedDocumentListResponseSchema = z.object({
  >   data: z.array(PublishedDocumentSummarySchema),
  >   meta: PaginationMetaSchema,
  > });
  >
  > export const PublishedDocumentDetailResponseSchema = z.object({
  >   data: PublishedDocumentDetailSchema,
  > });
  > ```
  >
  > **Complaint schemas** (`schemas/public/complaints.ts`) — the
  > `violationTypeOther`-required-when-`violationType`-is-`'other'` rule is a
  > cross-field refinement E2's flat JSON Schema cannot express but Zod can;
  > implement it with `.superRefine`:
  > ```typescript
  > import { z } from 'zod';
  >
  > export const ComplaintViolationTypeSchema = z.enum([
  >   'overcharging',
  >   'trip_cutting',
  >   'refused_to_convey',
  >   'discourtesy',
  >   'other',
  > ]);
  >
  > export const ComplaintAccessModeSchema = z.enum(['digital_form', 'clerk_assisted']);
  >
  > export const ComplaintSubmissionRequestSchema = z
  >   .object({
  >     violationType: ComplaintViolationTypeSchema,
  >     violationTypeOther: z.string().max(500).nullable().optional(),
  >     tricycleNumber: z.string().max(50).nullable().optional(),
  >     incidentDate: z.string(), // date
  >     incidentTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
  >       message: 'Must be in 24-hour HH:MM format (e.g. "14:30")',
  >     }),
  >     place: z.string().max(500),
  >     remarks: z.string().max(2000).nullable().optional(),
  >     complainantName: z.string().max(200),
  >     complainantAddress: z.string().max(500),
  >     complainantContact: z.string().max(50),
  >     complainantEmail: z.string().email().max(254).nullable().optional(),
  >     respondentName: z.string().max(200).nullable().optional(),
  >     respondentContact: z.string().max(50).nullable().optional(),
  >     respondentEmail: z.string().email().max(254).nullable().optional(),
  >     accessMode: ComplaintAccessModeSchema,
  >   })
  >   .superRefine((val, ctx) => {
  >     if (val.violationType === 'other' && !val.violationTypeOther) {
  >       ctx.addIssue({
  >         code: z.ZodIssueCode.too_small,
  >         minimum: 1,
  >         type: 'string',
  >         inclusive: true,
  >         path: ['violationTypeOther'],
  >         message: 'Required when violationType is "other"',
  >       });
  >     }
  >   });
  >
  > export const ComplaintSubmissionResultSchema = z.object({
  >   complaintId: z.string().uuid(),
  >   referenceCode: z.string(),
  >   submittedAt: z.string().datetime({ offset: true }),
  >   status: z.literal('pending_hearing'),
  >   message: z.string(),
  >   printableFormUrl: z.string().url().nullable().optional(),
  > });
  >
  > export const ComplaintSubmissionResponseSchema = z.object({
  >   data: ComplaintSubmissionResultSchema,
  > });
  > ```
  >
  > **Document request schemas** (`schemas/public/document-requests.ts`):
  > ```typescript
  > import { z } from 'zod';
  > import { PublishedDocumentTypeSchema } from './documents';
  >
  > export const DocumentRequestAccessModeSchema = z.enum(['digital_form', 'clerk_assisted']);
  >
  > export const DocumentRequestSubmissionRequestSchema = z.object({
  >   requesterName: z.string().max(200),
  >   requesterAgency: z.string().max(300).nullable().optional(),
  >   requesterEmail: z.string().email().max(254),
  >   requesterPhone: z.string().max(50).nullable().optional(),
  >   documentType: PublishedDocumentTypeSchema,
  >   documentTitle: z.string().max(1000),
  >   documentNumber: z.string().max(50).nullable().optional(),
  >   numberOfPagesCopied: z.number().int().min(1).nullable().optional(),
  >   purpose: z.string().max(1000),
  >   idType: z.string().max(100),
  >   accessMode: DocumentRequestAccessModeSchema,
  > });
  >
  > export const DocumentRequestSubmissionResultSchema = z.object({
  >   requestId: z.string().uuid(),
  >   referenceCode: z.string(),
  >   submittedAt: z.string().datetime({ offset: true }),
  >   message: z.string(),
  >   estimatedWorkingDays: z.number().int().nullable().optional(),
  >   printableFormUrl: z.string().url().nullable().optional(),
  > });
  >
  > export const DocumentRequestSubmissionResponseSchema = z.object({
  >   data: DocumentRequestSubmissionResultSchema,
  > });
  > ```
  >
  > Create `schemas/public/index.ts` re-exporting every named export above.
  > Do not add these schemas to `schemas/common/index.ts` if one already exists
  > with unrelated internal-API exports — keep the public REST surface's barrel
  > separate, matching E2's own `public/` vs `common/` folder split (Shared
  > Package Schema Location section).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter @batac/shared typecheck` passes with zero errors
  > - [ ] All four E2 example payloads parse successfully through their matching schema in a new test file
  > - [ ] Every field/required/maxLength/pattern/enum matches E2 exactly
  > - [ ] `violationType: 'other'` without `violationTypeOther`, and a non-24-hour `incidentTime`, both fail validation
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-003

Phase:          1
Module:         PORTAL
Title:          `[Inference][MIGRATION]` Extend DOCS Published API with an unauthenticated citizen-submission write method
Prerequisites:  [TASK-DOCS-005, TASK-DOCS-006, TASK-DOCS-008, TASK-DOCS-019]
Deliverables:
  - /packages/database/migrations/{NNN}_docs_seed_public_number_series.sql — two new `documents.number_series` rows: `CITIZEN_COMPLAINT_REF` (prefix `COMP`) and `DOCUMENT_REQUEST_REF` (prefix `DREQ`), following the exact row shape `TASK-DOCS-008` used for the existing 11 series
  - /apps/server/src/modules/documents/documents.public-submission.service.ts — `createPublicSubmission()`, the new Published API method this task adds
  - /apps/server/src/modules/documents/index.ts — add `createPublicSubmission` to the module's existing Published API export object (edit, not replace — the five methods `TASK-DOCS-006` already exports must remain untouched)
Acceptance Criteria:
  - [ ] `pnpm db:migrate` applies the new migration cleanly on top of the existing `documents` schema
  - [ ] `pnpm --filter server typecheck` passes with zero errors
  - [ ] A new Vitest integration test calls `documentsService.createPublicSubmission()` twice with `documentType: 'CITIZEN_COMPLAINT'` in the same year and asserts the two `referenceCode` values are `COMP-{year}-0001` and `COMP-{year}-0002` — sequential, zero-padded to 4 digits, matching E2's documented format exactly
  - [ ] The same test repeated for `documentType: 'DOCUMENT_REQUEST_FORM'` produces `DREQ-{year}-0001`
  - [ ] Calling `createPublicSubmission()` with any `documentType` other than `CITIZEN_COMPLAINT` or `DOCUMENT_REQUEST_FORM` throws a typed error at the TypeScript level (the parameter is a two-member literal union, not a bare string)
  - [ ] Manual: the resulting `documents.documents` row has `preliminary_number` and `final_number` both `NULL` — these two document types have no series-number lifecycle, only the new reference-code format, per `TrackingLookupData`'s own schema note ("Null for document types with no series numbering (e.g. CITIZEN_COMPLAINT, DOCUMENT_REQUEST_FORM)")
AI Prompt:
  > **Read this note before implementing.** No pre-development document defines
  > this method — it is a gap this task closes, `[Inference]`-labeled
  > throughout, in the `documents` module (`apps/server/src/modules/documents/`).
  > `documents.documents` is owned by that module's schema; per the
  > "no cross-schema reference, even informally" architectural law, only code
  > inside that module directory may write to it. This task's deliverables
  > therefore live there, extending the Published API surface
  > `TASK-DOCS-006` already established, using the exact same
  > export-object pattern — add one key, do not restructure the file.
  >
  > **Why this method is needed:** the public REST endpoints `POST
  > /v1/public/complaints` and `POST /v1/public/document-requests`
  > (`TASK-PORTAL-006`, `TASK-PORTAL-007`) are unauthenticated and must return
  > a reference code (e.g. `COMP-2026-0042`) to the citizen in the same HTTP
  > response — this rules out an event-bus (async) approach per this
  > project's own sync-vs-async rule ("Use the Published API (sync) when the
  > caller needs a return value to proceed"). `documents.documents` is where
  > these records live in Phase 1 — confirmed by `docs.md`'s own Module
  > Summary (`CONFLICT-DOCS-01`): "In Phase 1, CITIZEN_COMPLAINT and
  > DOCUMENT_REQUEST_FORM records are stored in `documents.documents` with
  > JSONB metadata... `portal.complaints` and `portal.citizen_requests` are
  > Phase 3 additions when the full PORTAL module ships" — that later,
  > separate effort is not this task.
  >
  > **Numbering:** `TASK-DOCS-005` already implements a numbering service
  > wrapping a `fn_get_next_sequence_value(seriesCode, year)`-style database
  > function (per-series, per-year sequence, matching the pattern
  > `TASK-TRACK-001`'s `tracking.fn_get_next_tracking_number(year)` also
  > follows for its own DTS numbers). `TASK-DOCS-008` seeded 11
  > `number_series` rows for the Phase 1 active legislative series; neither a
  > citizen-complaint nor a document-request series was among them, because
  > neither existed as a public-facing capability at the time `TASK-DOCS-008`
  > was written. Add two more rows following that exact same seed shape (this
  > task does not have the literal column list for `number_series` — it was
  > not part of this pass's reading list — so mirror `TASK-DOCS-008`'s
  > existing rows structurally rather than inventing new columns):
  > `series_code: 'CITIZEN_COMPLAINT_REF'`, `prefix: 'COMP'`, and
  > `series_code: 'DOCUMENT_REQUEST_REF'`, `prefix: 'DREQ'`. The resulting
  > reference code format is `{prefix}-{year}-{sequence, zero-padded to 4
  > digits}`, e.g. `COMP-2026-0042` — this exact format is confirmed (not
  > inferred) in E2's `ComplaintSubmissionResult.referenceCode` and
  > `DocumentRequestSubmissionResult.referenceCode` field descriptions.
  >
  > **Service method:**
  > ```typescript
  > // documents.public-submission.service.ts
  > export type PublicSubmissionDocumentType =
  >   | 'CITIZEN_COMPLAINT'
  >   | 'DOCUMENT_REQUEST_FORM';
  >
  > export interface CreatePublicSubmissionInput {
  >   documentType: PublicSubmissionDocumentType;
  >   metadata: Record<string, unknown>; // the citizen-submitted form fields, stored verbatim as JSONB
  >   cityId: string;
  > }
  >
  > export interface CreatePublicSubmissionResult {
  >   documentId: string;
  >   referenceCode: string;
  >   submittedAt: string; // ISO 8601, Asia/Manila
  > }
  >
  > export async function createPublicSubmission(
  >   deps: { db: DrizzleClient; numberingService: NumberingService },
  >   input: CreatePublicSubmissionInput
  > ): Promise<CreatePublicSubmissionResult> {
  >   const seriesCode =
  >     input.documentType === 'CITIZEN_COMPLAINT'
  >       ? 'CITIZEN_COMPLAINT_REF'
  >       : 'DOCUMENT_REQUEST_REF';
  >   return deps.db.transaction(async (tx) => {
  >     // 1. Look up the document_types row for input.documentType (already
  >     //    seeded by TASK-DOCS-007) to get its document_type_id.
  >     // 2. Reserve the next sequence value via the existing numbering
  >     //    service (deps.numberingService), scoped to seriesCode + current
  >     //    year, inside this same transaction.
  >     // 3. INSERT into documents.documents: document_type_id from step 1,
  >     //    preliminary_number = NULL, final_number = NULL (this document
  >     //    type has no series-number lifecycle — see Acceptance Criteria),
  >     //    lifecycle_state = 'draft' (no workflow instance drives these
  >     //    types in Phase 1 — no workflow.definitions row exists for either
  >     //    CITIZEN_COMPLAINT or DOCUMENT_REQUEST_FORM; see wf.md's
  >     //    TASK-WF-016 scope note for the latter), metadata = a JSONB
  >     //    object containing input.metadata plus { referenceCode,
  >     //    accessMode } so the Secretariat-side TASK-DOCS-016/017
  >     //    procedures can read it back, qr_tracking_number = generate a new
  >     //    UUID (mirrors the assignment-order rule in consolidated ref Part
  >     //    11.6 — QR UUID is assigned at logging, before any series number —
  >     //    even though these two types have no series number at all, the
  >     //    QR UUID still lets TASK-TRACK-008's existing public lookup
  >     //    endpoint resolve these submissions the same way it resolves
  >     //    everything else).
  >     // 4. Return { documentId, referenceCode: `${prefix}-${year}-${String(seq).padStart(4, '0')}`, submittedAt: new Date().toISOString() }.
  >   });
  > }
  > ```
  > `[SPEC GAP]`: whether a `document.created` event should be emitted for
  > these two document types is genuinely unresolved. `TASK-WF-024`'s own
  > notes (per `wf.md`'s Module Summary) already anticipate a DRF
  > `document.created` event hitting `NO_ACTIVE_VERSION` in Phase 1 and treat
  > it as "an inert, expected failure mode, not a defect" — but that note
  > addresses the *version* subsystem, not whether emitting the event at all
  > is correct for a document type with no workflow definition to instantiate.
  > `TASK-NOTIF-007`'s `document.state_changed` subscriber is a separate
  > concern (state changes, not creation) and is not affected either way.
  > Emit `document.created` for consistency with every other document type
  > (`[Inference]` — the safer default, since AUDIT's event consumer
  > (`TASK-AUDIT-004`) is scoped to 18 known domain event types and silently
  > dropping a creation event would leave these citizen submissions outside
  > the tamper-evident audit chain, which Section 11.11/Architectural Law #3
  > requires for every state-mutating action) but flag this explicitly in the
  > PR description for a human to confirm before merge.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm db:migrate` applies cleanly
  > - [ ] `pnpm --filter server typecheck` passes
  > - [ ] Sequential `createPublicSubmission()` calls produce `COMP-{year}-0001`, `COMP-{year}-0002` for complaints and the `DREQ-` equivalent for document requests
  > - [ ] An invalid `documentType` is a compile-time type error, not a runtime check
  > - [ ] The resulting row has `preliminary_number` and `final_number` both `NULL`
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-004

Phase:          1
Module:         PORTAL
Title:          `[Inference]` Extend DOCS Published API with public-document list and detail read methods
Prerequisites:  [TASK-DOCS-001, TASK-DOCS-006, TASK-DOCS-010, TASK-DOCS-019]
Deliverables:
  - /apps/server/src/modules/documents/documents.public-read.service.ts — `listPublishedDocuments()` and `getPublishedDocumentDetail()`, the two new Published API methods this task adds
  - /apps/server/src/modules/documents/index.ts — add both methods to the module's existing Published API export object (edit, not replace)
Acceptance Criteria:
  - [ ] `pnpm --filter server typecheck` passes with zero errors
  - [ ] A new Vitest integration test seeds one document per `public_visibility_rule` value and asserts `listPublishedDocuments()` returns only the `title_and_first_page_public` one
  - [ ] The same test asserts a document still `under_review` (not yet `released`) is excluded regardless of its visibility rule
  - [ ] `listPublishedDocuments({ q: '<partial title text>' })` returns the matching document via `tsvector`/`tsquery`, and returns an empty array for a query string with no match
  - [ ] `listPublishedDocuments({ documentType: 'SP_ORDINANCE' })` and `{ year: 2026 }` and `{ number: '7SP 2026-03' }` each filter correctly in isolation; `number` takes precedence when combined with the others, returning at most one result
  - [ ] `getPublishedDocumentDetail()` on a document whose `public_visibility_rule` is not `title_and_first_page_public` returns `null` (the REST handler in `TASK-PORTAL-005` maps this to `404`, not this method's job to format an HTTP response)
  - [ ] Manual: results are ordered by final-number assignment date, descending, matching E2's documented default sort
AI Prompt:
  > **Read this note before implementing.** Like `TASK-PORTAL-003`, no
  > pre-development document defines these two methods — this task closes a
  > second gap in the `documents` module's already-finalized Published API
  > (`TASK-DOCS-006` exports `getDocumentById`, `getDocumentType`,
  > `transitionState`, `assignFinalNumber`, `getAttachmentRefs` — none support
  > a filtered, paginated, publicly-visible-only document listing).
  > `[Inference]`-labeled throughout; lives inside
  > `apps/server/src/modules/documents/` because `documents.documents` is that
  > module's schema and the "no cross-schema reference, even informally"
  > architectural law applies regardless of which task list identifies the
  > need.
  >
  > **On the one existing cross-schema search exception — do not reuse it.**
  > A `documents.tsvector` column exists specifically for the future `SEARCH`
  > module's Meilisearch sync, and B2's Enforcement Mechanisms carve out
  > exactly one named cross-schema-read exception for it (`ADR-B2-5`,
  > referenced in `iam.md`'s Module Summary while resolving an unrelated IAM
  > question). That exception is scoped to `SEARCH`, which this pass does not
  > build (deferred to a future Phase 2 A1 round per `A1-AGENTS.md` §2) — it
  > is not a general license for any module to query `documents.tsvector`
  > directly. This task's full-text search instead goes through the new
  > Published API method below, staying inside the `documents` module exactly
  > like every other read.
  >
  > **Public visibility rule:** per E2's `listPublishedDocuments` and
  > `getPublishedDocument` descriptions and consolidated ref Part 11.18's
  > "Phase 1 public portal behavior confirmed" note ("First page of uploaded
  > documents visible publicly; body is blurred. Title only shown in public
  > listings."), a document is eligible only if ALL of the following hold:
  > `lifecycle_state = 'released'` AND `public_visibility_rule =
  > 'title_and_first_page_public'` AND `document_type IN ('SP_RESOLUTION',
  > 'SP_ORDINANCE', 'APPROPRIATION_ORDINANCE')` (E2's Phase 1 Endpoint
  > Summary: "Phase 1 document types returned"). `[SPEC GAP]`: the exact
  > column name and enum values for `public_visibility_rule` are not
  > confirmed by any document loaded in this pass — `C1` was not part of this
  > pass's reading list (E2 cites it as a source for its own schema types but
  > this pass does not load `C1` directly, per `A1-AGENTS.md` §9's "request
  > only the sections you need" discipline, and no `§documents` C1 excerpt was
  > supplied here). The value `title_and_first_page_public` is confirmed
  > (E2 uses this exact string); the column name `public_visibility_rule` is
  > `[Inference]` from E2's own prose, which refers to it by that name
  > consistently but never shows its literal DDL. Confirm the exact column
  > name against `C1 §documents` before merging.
  >
  > **Methods:**
  > ```typescript
  > // documents.public-read.service.ts
  > import type { PublishedDocumentType } from '@batac/shared';
  >
  > export interface ListPublishedDocumentsInput {
  >   documentType?: PublishedDocumentType;
  >   year?: number;
  >   number?: string; // exact final_number match; takes precedence over other filters
  >   q?: string; // full-text search against title, min 2 chars
  >   page: number;
  >   limit: number;
  > }
  >
  > export interface PublishedDocumentSummaryRow {
  >   documentId: string;
  >   documentType: PublishedDocumentType;
  >   documentTypeName: string;
  >   title: string;
  >   finalNumber: string;
  >   approvedAt: string;
  >   releasedAt: string;
  >   trackingNumber: string;
  >   supersededBy: string | null;
  >   supersededAt: string | null;
  >   closureReason: string | null;
  >   // first-page preview and documentRequestUrl are NOT included here —
  >   // those are presentation concerns (presigned URL generation, portal
  >   // base URL) that belong in TASK-PORTAL-005's REST handler, not this
  >   // data-access method. Keep this method's return shape data-only.
  > }
  >
  > export async function listPublishedDocuments(
  >   deps: { db: DrizzleClient },
  >   input: ListPublishedDocumentsInput
  > ): Promise<{ rows: PublishedDocumentSummaryRow[]; total: number }> {
  >   // WHERE lifecycle_state = 'released'
  >   //   AND public_visibility_rule = 'title_and_first_page_public'
  >   //   AND document_type_id IN (the three Phase 1 public type IDs)
  >   //   AND (input.number is set
  >   //          ? final_number = input.number  -- precedence rule, ignore other filters
  >   //          : (input.documentType is unset OR document type matches)
  >   //            AND (input.year is unset OR EXTRACT(YEAR FROM final number assignment date) = input.year)
  >   //            AND (input.q is unset OR title_tsvector @@ plainto_tsquery('simple', input.q)))
  >   // ORDER BY final number assignment date DESC
  >   // LIMIT input.limit OFFSET (input.page - 1) * input.limit
  >   // Also return a COUNT(*) (no LIMIT/OFFSET) for `total`.
  > }
  >
  > export interface PublishedDocumentDetailRow extends PublishedDocumentSummaryRow {
  >   authors: string[];
  >   sponsors: string[];
  >   committees: string[];
  >   panlalawiganOutcome: string | null;
  >   panlalawiganOutcomeDate: string | null;
  >   hasNewspaperPublication: boolean;
  >   newspaperPublicationDate: string | null;
  > }
  >
  > export async function getPublishedDocumentDetail(
  >   deps: { db: DrizzleClient },
  >   documentId: string
  > ): Promise<PublishedDocumentDetailRow | null> {
  >   // Same three-condition WHERE clause as listPublishedDocuments, scoped
  >   // to a single documentId. Return null (not a thrown error) on no match
  >   // or a visibility-rule failure — the caller (TASK-PORTAL-005) maps
  >   // both cases to an identical 404, and per E2's description this is
  >   // deliberate: "Returns 404 if: the document does not exist / has not
  >   // been released / [visibility rule fails]" — a public API must not
  >   // distinguish "doesn't exist" from "exists but you can't see it," since
  >   // that distinction itself would leak information about non-public
  >   // documents.
  >   // authors/sponsors/committees source: `[SPEC GAP]` — no loaded document
  >   // in this pass specifies which documents.documents columns or related
  >   // tables hold authorship/sponsorship/committee-assignment data (C1
  >   // §documents was not loaded here). Confirm against C1 before
  >   // implementing this part; the query shape above is otherwise complete.
  > }
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter server typecheck` passes
  > - [ ] Visibility-rule filtering excludes non-`title_and_first_page_public` documents
  > - [ ] Non-`released` documents are excluded regardless of visibility rule
  > - [ ] Full-text search matches and non-matches both behave correctly
  > - [ ] `documentType`/`year`/`number` filters work in isolation; `number` takes precedence
  > - [ ] `getPublishedDocumentDetail()` returns `null` for an ineligible document, not a thrown error
  > - [ ] Default sort is final-number-assignment-date descending
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-005

Phase:          1
Module:         PORTAL
Title:          Implement `GET /v1/public/documents` and `GET /v1/public/documents/{documentId}`
Prerequisites:  [TASK-PORTAL-002, TASK-PORTAL-004]
Deliverables:
  - /apps/server/src/modules/portal/routes/list-documents.ts — `GET /public/documents` route handler
  - /apps/server/src/modules/portal/routes/get-document.ts — `GET /public/documents/:documentId` route handler
  - /apps/server/src/modules/portal/lib/presign-first-page.ts — shared helper constructing the S3 key and presigned URL for a document's first-page preview
Acceptance Criteria:
  - [ ] `pnpm --filter server typecheck` passes with zero errors
  - [ ] Integration test: `GET /public/documents` with no query params returns `200` with a `PublishedDocumentListResponse`-shaped body, `meta.page = 1`, `meta.limit = 20`
  - [ ] Integration test: `GET /public/documents?documentType=SP_ORDINANCE&year=2026` returns only matching, publicly-visible documents
  - [ ] Integration test: `GET /public/documents?limit=500` is rejected `400` (exceeds the schema's `max(100)`)
  - [ ] Integration test: `GET /public/documents/{documentId}` for a real, publicly-visible document returns `200` with a `PublishedDocumentDetailResponse` body whose `firstPagePreview.expiresAt` is exactly 15 minutes (`PRESIGNED_URL_TTL_SECONDS`) after the response is generated
  - [ ] Integration test: `GET /public/documents/{documentId}` for a document that exists but is not publicly visible, and for a UUID with no matching document at all, both return an identical `404` body shape — no field lets a client distinguish the two cases
  - [ ] Manual: response headers include `X-Request-ID` and the three `X-RateLimit-*` headers on every response, per E2
AI Prompt:
  > Implement two read-only public REST routes using the Fastify + Zod +
  > `@fastify/swagger` pattern (full setup is `TASK-PORTAL-008`; this task
  > only needs to define the route handlers with their `schema` blocks —
  > `TASK-PORTAL-008` registers the plugin that mounts them).
  >
  > **List handler:**
  > ```typescript
  > // routes/list-documents.ts
  > import { z } from 'zod';
  > import {
  >   PublishedDocumentListResponseSchema,
  >   ValidationErrorResponseSchema,
  >   ErrorResponseSchema,
  > } from '@batac/shared';
  > import { presignFirstPage } from '../lib/presign-first-page';
  >
  > const querySchema = z.object({
  >   documentType: z.enum(['SP_RESOLUTION', 'SP_ORDINANCE', 'APPROPRIATION_ORDINANCE']).optional(),
  >   year: z.coerce.number().int().min(2000).max(2099).optional(),
  >   number: z.string().max(50).optional(),
  >   q: z.string().min(2).max(200).optional(),
  >   page: z.coerce.number().int().min(1).default(1),
  >   limit: z.coerce.number().int().min(1).max(100).default(20),
  > });
  >
  > export default async function listDocumentsRoute(fastify: FastifyInstance) {
  >   fastify.get(
  >     '/public/documents',
  >     {
  >       schema: {
  >         tags: ['documents'],
  >         summary: 'List published legislative documents',
  >         querystring: querySchema,
  >         response: {
  >           200: PublishedDocumentListResponseSchema,
  >           400: ValidationErrorResponseSchema,
  >           429: ErrorResponseSchema,
  >           500: ErrorResponseSchema,
  >         },
  >       },
  >       config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  >     },
  >     async (request, reply) => {
  >       const { rows, total } = await fastify.documentsService.listPublishedDocuments(request.query);
  >       const data = await Promise.all(
  >         rows.map(async (row) => ({
  >           ...row,
  >           firstPagePreview: await presignFirstPage(row.documentId),
  >           documentRequestUrl: `${process.env['PORTAL_BASE_URL']}/document-requests?ref=${encodeURIComponent(row.finalNumber)}`,
  >         }))
  >       );
  >       const { page, limit } = request.query;
  >       const totalPages = Math.ceil(total / limit);
  >       return reply.send({
  >         data,
  >         meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  >       });
  >     }
  >   );
  > }
  > ```
  > `documentRequestUrl` uses `PORTAL_BASE_URL` (add to `apps/server`'s own env
  > schema if not already present — not `apps/portal`'s `env.portal.ts`, since
  > this value is consumed server-side when building the response, not by the
  > portal frontend itself) rather than a hardcoded `portal.batac.gov.ph`, so
  > staging/local environments link correctly. `[Inference]`: the exact query
  > string shape (`?ref={finalNumber}`) matches E2's own examples verbatim
  > (`documentRequestUrl: 'https://portal.batac.gov.ph/document-requests?ref=7SP+2026-04'`).
  >
  > **Detail handler:**
  > ```typescript
  > // routes/get-document.ts
  > fastify.get(
  >   '/public/documents/:documentId',
  >   {
  >     schema: {
  >       tags: ['documents'],
  >       summary: 'Get a single published document',
  >       params: z.object({ documentId: z.string().uuid() }),
  >       response: {
  >         200: PublishedDocumentDetailResponseSchema,
  >         404: ErrorResponseSchema,
  >         429: ErrorResponseSchema,
  >         500: ErrorResponseSchema,
  >       },
  >     },
  >     config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  >   },
  >   async (request, reply) => {
  >     const detail = await fastify.documentsService.getPublishedDocumentDetail(request.params.documentId);
  >     if (!detail) {
  >       return reply.status(404).send({
  >         statusCode: 404,
  >         error: 'Not Found',
  >         message: 'Document not found or not yet available on the public portal.',
  >       });
  >     }
  >     return reply.send({
  >       data: {
  >         ...detail,
  >         firstPagePreview: await presignFirstPage(detail.documentId),
  >         documentRequestUrl: `${process.env['PORTAL_BASE_URL']}/document-requests?ref=${encodeURIComponent(detail.finalNumber)}`,
  >       },
  >     });
  >   }
  > );
  > ```
  >
  > **Presigned first-page helper** — reuses the exact S3 key convention
  > `TASK-DOCS-010` and `TASK-TRACK-008` already established
  > (`documents/previews/{documentId}/page-1.webp`, resolved in
  > `track.md`'s `SPEC-GAP-TRACK-02`):
  > ```typescript
  > // lib/presign-first-page.ts
  > import { getPresignedGetUrl } from '../../infrastructure/s3-client'; // exact import path per TASK-INFRA's S3 client module — verify against that task's actual file location
  >
  > export async function presignFirstPage(documentId: string) {
  >   const key = `documents/previews/${documentId}/page-1.webp`;
  >   const ttlSeconds = Number(process.env['PRESIGNED_URL_TTL_SECONDS'] ?? 900);
  >   const url = await getPresignedGetUrl(key, ttlSeconds);
  >   return {
  >     url,
  >     expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  >     widthPx: null,
  >     heightPx: null,
  >   };
  > }
  > ```
  > `[SPEC GAP]`: `widthPx`/`heightPx` are hardcoded `null` here.
  > `TASK-DOCS-010`'s `OcrService.generateFirstPagePreview()` may or may not
  > persist the rendered image's pixel dimensions alongside the S3 key — this
  > pass's reading list does not include enough of `docs.md`'s
  > `TASK-DOCS-010` body to confirm either way. If the dimensions are
  > available (e.g. on the document version row), read and return them
  > instead of `null`.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter server typecheck` passes
  > - [ ] No-params list request returns correct defaults
  > - [ ] Filter combination works as specified
  > - [ ] `limit=500` is rejected `400`
  > - [ ] Detail request `expiresAt` is exactly 15 minutes out
  > - [ ] Non-existent and non-visible documents return identical `404` bodies
  > - [ ] `X-Request-ID` and rate-limit headers present on every response
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-006

Phase:          1
Module:         PORTAL
Title:          `[AUDIT]` Implement `POST /v1/public/complaints`
Prerequisites:  [TASK-PORTAL-002, TASK-PORTAL-003]
Deliverables:
  - /apps/server/src/modules/portal/routes/submit-complaint.ts — `POST /public/complaints` route handler
  - /apps/server/src/modules/portal/lib/generate-printable-form.tsx — shared `@react-pdf/renderer` component generating a printable, pre-populated form PDF for either submission type
Acceptance Criteria:
  - [ ] `pnpm --filter server typecheck` passes with zero errors
  - [ ] Integration test: posting the `transportation_overcharging` example payload from E2 returns `201` with `status: 'pending_hearing'` and a `referenceCode` matching `^COMP-\d{4}-\d{4}$`
  - [ ] Integration test: posting with `violationType: 'other'` and no `violationTypeOther` returns `400` with a `details` entry for `violationTypeOther`
  - [ ] Integration test: posting with `incidentTime: '2:30 PM'` returns `400` citing the 24-hour format requirement
  - [ ] Integration test: two consecutive valid submissions in the same year receive sequential reference codes (`COMP-{year}-0001`, `COMP-{year}-0002`)
  - [ ] Integration test: an audit event is recorded for the submission (this task's `[AUDIT]` tag — every state-mutating public write must be traceable per Architectural Law #3)
  - [ ] Manual: `accessMode: 'digital_form'` produces a non-null `printableFormUrl`; `accessMode: 'clerk_assisted'` produces `printableFormUrl: null` (no printable copy needed — a clerk enters this in person, per E2's access-mode description)
  - [ ] Manual: 21 requests from the same IP within one hour — the 21st receives `429` with a `Retry-After` header
AI Prompt:
  > Implement `POST /public/complaints`. Business rules below are copied
  > verbatim from consolidated ref Part 4.14, since `A1-AGENTS.md` §7
  > requires business-rule paragraphs to be pasted inline, not summarized:
  >
  > > Complaints addressed to the Sangguniang Panlungsod. Not limited to
  > > transportation subjects — any LGU-related complaint can be filed.
  > > Routing: the SP Secretariat decides routing — to committee directly, or
  > > to Vice Mayor, depending on the nature of the complaint. No fixed
  > > routing rule. Respondent notification: if respondent has an email
  > > address, notification AND the formal written notice sent by email; if
  > > only a contact number, notification sent by SMS/phone and the
  > > respondent must claim the formal written notice in person. Outcome
  > > states: Pending Hearing (initial) → Received/Seen → Dismissed or
  > > Resolved.
  >
  > This route's job is narrow: validate, create the record via the new
  > Published API method, generate a printable form when applicable, and
  > return the confirmation. It does **not** implement routing, respondent
  > notification, or outcome transitions — those are the already-built
  > internal Secretariat-side procedures (`TASK-DOCS-016`), operating on the
  > record this route creates.
  >
  > ```typescript
  > // routes/submit-complaint.ts
  > import { z } from 'zod';
  > import {
  >   ComplaintSubmissionRequestSchema,
  >   ComplaintSubmissionResponseSchema,
  >   ValidationErrorResponseSchema,
  >   ErrorResponseSchema,
  > } from '@batac/shared';
  > import { generatePrintableForm } from '../lib/generate-printable-form';
  >
  > export default async function submitComplaintRoute(fastify: FastifyInstance) {
  >   fastify.post(
  >     '/public/complaints',
  >     {
  >       schema: {
  >         tags: ['complaints'],
  >         summary: 'Submit a citizen complaint',
  >         body: ComplaintSubmissionRequestSchema,
  >         response: {
  >           201: ComplaintSubmissionResponseSchema,
  >           400: ValidationErrorResponseSchema,
  >           429: ErrorResponseSchema,
  >           500: ErrorResponseSchema,
  >         },
  >       },
  >       config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  >     },
  >     async (request, reply) => {
  >       const { documentId, referenceCode, submittedAt } =
  >         await fastify.documentsService.createPublicSubmission({
  >           documentType: 'CITIZEN_COMPLAINT',
  >           metadata: request.body,
  >           cityId: fastify.config.CITY_ID,
  >         });
  >
  >       let printableFormUrl: string | null = null;
  >       if (request.body.accessMode === 'digital_form') {
  >         printableFormUrl = await generatePrintableForm({
  >           formType: 'complaint',
  >           referenceCode,
  >           data: request.body,
  >         });
  >       }
  >
  >       return reply.status(201).send({
  >         data: {
  >           complaintId: documentId,
  >           referenceCode,
  >           submittedAt,
  >           status: 'pending_hearing',
  >           message: `Your complaint has been received by the SP Secretariat (reference: ${referenceCode}). It will be reviewed and routed to the appropriate committee. You will be notified of the outcome via your contact number.`,
  >           printableFormUrl,
  >         },
  >       });
  >     }
  >   );
  > }
  > ```
  >
  > **Printable form generation** — mirror `TASK-TRACK-007`'s
  > `@react-pdf/renderer` cover-sheet pattern (Procedure 2,
  > `printQrCoverSheet`) rather than introducing a second PDF library. Output
  > is uploaded to S3 at a token-scoped key and a presigned URL returned,
  > matching E2's documented shape
  > (`.../public/generated-forms/{referenceCode}.pdf?token=...`) and its
  > stated 24-hour validity:
  > ```typescript
  > // lib/generate-printable-form.tsx
  > export async function generatePrintableForm(input: {
  >   formType: 'complaint' | 'document-request';
  >   referenceCode: string;
  >   data: Record<string, unknown>;
  > }): Promise<string> {
  >   // Render a @react-pdf/renderer <Document> populated with input.data's
  >   // fields (layout: `[SPEC GAP]` — no loaded document specifies the exact
  >   // visual layout of either printable form; render all submitted fields
  >   // legibly with the referenceCode prominent at the top as an interim
  >   // layout, and flag for design review before this ships).
  >   // Upload the resulting buffer to S3 at
  >   // `generated-forms/${input.referenceCode}.pdf`, presign a GET URL with
  >   // a 24-hour TTL, and return it.
  > }
  > ```
  >
  > **`[AUDIT]` tag:** this route mutates state (creates a new document
  > record) and must be traceable per Architectural Law #3. Confirm
  > `TASK-PORTAL-003`'s `createPublicSubmission()` emits a `document.created`
  > event (see that task's `[SPEC GAP]` note) so `TASK-AUDIT-004`'s existing
  > 18-event-type consumer captures it — this route does not call the audit
  > service directly, consistent with every other module's pattern of
  > writing audit events only through that consumer.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter server typecheck` passes
  > - [ ] Valid submission returns `201` with a correctly-formatted `referenceCode`
  > - [ ] Missing `violationTypeOther` when required, and malformed `incidentTime`, both return `400`
  > - [ ] Sequential submissions get sequential reference codes
  > - [ ] The submission is auditable
  > - [ ] `printableFormUrl` is present only for `digital_form`
  > - [ ] Rate limit enforced at 20/hour with `429` + `Retry-After`
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-007

Phase:          1
Module:         PORTAL
Title:          `[AUDIT]` Implement `POST /v1/public/document-requests`
Prerequisites:  [TASK-PORTAL-002, TASK-PORTAL-003, TASK-PORTAL-006]
Deliverables:
  - /apps/server/src/modules/portal/routes/submit-document-request.ts — `POST /public/document-requests` route handler
Acceptance Criteria:
  - [ ] `pnpm --filter server typecheck` passes with zero errors
  - [ ] Integration test: posting E2's example payload returns `201` with `estimatedWorkingDays: 3` and a `referenceCode` matching `^DREQ-\d{4}-\d{4}$`
  - [ ] Integration test: omitting `requesterEmail` (a required field) returns `400`
  - [ ] Integration test: two consecutive valid submissions in the same year receive sequential reference codes (`DREQ-{year}-0001`, `DREQ-{year}-0002`) — independent of the `COMP-` sequence `TASK-PORTAL-006` verifies, confirming the two series don't share a counter
  - [ ] Integration test: an audit event is recorded for the submission
  - [ ] Manual: `accessMode: 'digital_form'` produces a non-null `printableFormUrl` reusing `TASK-PORTAL-006`'s `generatePrintableForm` helper with `formType: 'document-request'`
  - [ ] Manual: 21 requests from the same IP within one hour — the 21st receives `429`
AI Prompt:
  > Implement `POST /public/document-requests`. Business rules below are
  > copied verbatim from consolidated ref Part 4.15:
  >
  > > Fee-based process for copies of SP documents. Approval requires both
  > > Vice Mayor AND SP Secretary signature. Fee structure: Secretary's Fees
  > > under Ordinance No. 3SP 2014-05, per-page. Payment collected in person
  > > at the Secretariat after approval — payment processing via this API is
  > > deferred to a future phase, not Phase 1 or Phase 1B. Post-approval
  > > notifications: the requester is notified via contact number (primary
  > > channel) once approved. Identity verification: the requester presents a
  > > valid government-issued ID when submitting the signed physical form
  > > (government employee ID, birth certificate, barangay residency
  > > certificate, or any government-issued photo ID).
  >
  > This route creates the record and returns an SLA estimate; it does not
  > implement approval, payment, or release — those are the already-built
  > internal Secretariat-side procedures (`TASK-DOCS-017`).
  >
  > ```typescript
  > // routes/submit-document-request.ts
  > import { z } from 'zod';
  > import {
  >   DocumentRequestSubmissionRequestSchema,
  >   DocumentRequestSubmissionResponseSchema,
  >   ValidationErrorResponseSchema,
  >   ErrorResponseSchema,
  > } from '@batac/shared';
  > import { generatePrintableForm } from '../lib/generate-printable-form';
  >
  > export default async function submitDocumentRequestRoute(fastify: FastifyInstance) {
  >   fastify.post(
  >     '/public/document-requests',
  >     {
  >       schema: {
  >         tags: ['document-requests'],
  >         summary: 'Submit a Document and Records Request Form',
  >         body: DocumentRequestSubmissionRequestSchema,
  >         response: {
  >           201: DocumentRequestSubmissionResponseSchema,
  >           400: ValidationErrorResponseSchema,
  >           429: ErrorResponseSchema,
  >           500: ErrorResponseSchema,
  >         },
  >       },
  >       config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  >     },
  >     async (request, reply) => {
  >       const { documentId, referenceCode, submittedAt } =
  >         await fastify.documentsService.createPublicSubmission({
  >           documentType: 'DOCUMENT_REQUEST_FORM',
  >           metadata: request.body,
  >           cityId: fastify.config.CITY_ID,
  >         });
  >
  >       let printableFormUrl: string | null = null;
  >       if (request.body.accessMode === 'digital_form') {
  >         printableFormUrl = await generatePrintableForm({
  >           formType: 'document-request',
  >           referenceCode,
  >           data: request.body,
  >         });
  >       }
  >
  >       return reply.status(201).send({
  >         data: {
  >           requestId: documentId,
  >           referenceCode,
  >           submittedAt,
  >           message: `Your document request has been received (reference: ${referenceCode}). It will be reviewed by the Vice Mayor and SP Secretary. You will be contacted via phone when your request is approved and ready for payment.`,
  >           estimatedWorkingDays: 3,
  >           printableFormUrl,
  >         },
  >       });
  >     }
  >   );
  > }
  > ```
  > `estimatedWorkingDays: 3` is hardcoded per E2's own example and its field
  > description ("RA 11032 (ARTA) default SLA thresholds. Simple
  > transactions: ≤3 working days"), and consolidated ref Part 11.19 confirms
  > ARTA SLA tracking is a Phase 1 legal requirement with "configurable
  > thresholds." `[SPEC GAP]`: no loaded document specifies where that
  > threshold is configured (an env var, a database row, a hardcoded
  > constant) — hardcode `3` for this task and flag the configurability
  > question for a human decision; do not invent a configuration mechanism
  > `TASK-WF`'s own SLA escalation system (`TASK-WF-014`) may already provide
  > one, but that task list was not read closely enough by this pass to
  > confirm whether it's reusable here for a document type with no workflow
  > instance.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter server typecheck` passes
  > - [ ] Valid submission returns `201` with correct `referenceCode` format and `estimatedWorkingDays: 3`
  > - [ ] Missing `requesterEmail` returns `400`
  > - [ ] `DREQ-` and `COMP-` sequences are independent
  > - [ ] The submission is auditable
  > - [ ] `printableFormUrl` present only for `digital_form`
  > - [ ] Rate limit enforced at 20/hour
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-008

Phase:          1
Module:         PORTAL
Title:          Register OpenAPI, rate limiting, and CORS; wire all six public routes into one contract
Prerequisites:  [TASK-PORTAL-005, TASK-PORTAL-006, TASK-PORTAL-007, TASK-TRACK-008, TASK-TRACK-009, TASK-INFRA-011]
Deliverables:
  - /apps/server/src/plugins/openapi.ts — `@fastify/swagger` + `@fastify/swagger-ui` registration
  - /apps/server/src/plugins/rate-limit.ts — `@fastify/rate-limit` registration (global default; per-route overrides already set in each route's `config.rateLimit`)
  - /apps/server/src/plugins/cors.ts — `@fastify/cors` registration
  - /apps/server/src/modules/portal/portal.plugin.ts — Fastify plugin registering the four Portal-owned routes under the `/v1` prefix
  - /apps/server/src/modules/tracking/routes/public-lookup.ts — edit (not rewrite): wrap `TASK-TRACK-008`'s existing handler in the same `schema` block pattern so it participates in the same generated OpenAPI spec
  - /apps/server/src/app.ts — edit: register the three new plugins and the portal plugin, in the order specified below
Acceptance Criteria:
  - [ ] `pnpm --filter server typecheck` passes with zero errors
  - [ ] `GET /v1/docs` (Swagger UI, non-production only) renders and lists all six public endpoints under their correct tags
  - [ ] A contract test fetches the auto-generated spec from `@fastify/swagger` and asserts it matches E2's documented path list exactly: `/health`, `/public/tracking/{trackingNumber}`, `/public/documents`, `/public/documents/{documentId}`, `/public/complaints`, `/public/document-requests` — six paths, no more, no fewer
  - [ ] Integration test: a request from `Origin: https://portal.batac.gov.ph` succeeds; a request from an unlisted origin is rejected by CORS
  - [ ] Manual: `GET /v1/health` remains unaffected by the new rate-limit plugin (E2: "No limit — load balancer health checks must never be blocked")
  - [ ] Manual: `/v1/docs` returns `404` when `NODE_ENV=production`
AI Prompt:
  > Wire the public REST API together. This is the only task in this module
  > that touches a file outside `apps/server/src/modules/portal/` other than
  > the two `[Inference]` Published API extensions (`TASK-PORTAL-003`,
  > `TASK-PORTAL-004`) — edit `tracking/routes/public-lookup.ts` and `app.ts`
  > carefully, changing only what's specified below.
  >
  > **`plugins/openapi.ts`** — exact registration from E2's own
  > "@fastify/swagger Integration" section:
  > ```typescript
  > import fp from 'fastify-plugin';
  > import swagger from '@fastify/swagger';
  > import swaggerUi from '@fastify/swagger-ui';
  >
  > export default fp(async (fastify) => {
  >   await fastify.register(swagger, {
  >     openapi: {
  >       openapi: '3.0.3',
  >       info: { title: 'Batac City LGU Platform — Public REST API', version: '1.0.0' },
  >       servers: [{ url: process.env['API_BASE_URL'] ?? 'http://localhost:3000/v1' }],
  >       tags: [
  >         { name: 'health' }, { name: 'tracking' }, { name: 'documents' },
  >         { name: 'complaints' }, { name: 'document-requests' },
  >       ],
  >       components: { securitySchemes: {} },
  >     },
  >   });
  >   if (process.env['NODE_ENV'] !== 'production') {
  >     await fastify.register(swaggerUi, {
  >       routePrefix: '/v1/docs',
  >       uiConfig: { docExpansion: 'list' },
  >     });
  >   }
  > });
  > ```
  > Confirm `apps/server/src/app.ts` already sets `withTypeProvider<ZodTypeProvider>()`
  > and calls `setValidatorCompiler`/`setSerializerCompiler` — if some earlier
  > task already did this for internal tRPC routes, this task only needs to
  > confirm it, not duplicate it. `[SPEC GAP]`: whether the Zod type provider
  > is already globally configured is unconfirmed — no task in `infra.md`'s or
  > `iam.md`'s Table of Contents names this setup explicitly. Check
  > `app.ts`'s current content before assuming either way.
  >
  > **`plugins/rate-limit.ts`** — global default plus the per-endpoint table
  > from E2's Rate Limiting Configuration section (each route already sets its
  > own `config.rateLimit` per-route override in `TASK-PORTAL-005`/`006`/`007`
  > and in the edited tracking route below; this plugin just registers
  > `@fastify/rate-limit` itself with a sane global default and the trusted-proxy
  > key resolution E2 specifies):
  > ```typescript
  > import fp from 'fastify-plugin';
  > import rateLimit from '@fastify/rate-limit';
  >
  > export default fp(async (fastify) => {
  >   await fastify.register(rateLimit, {
  >     global: false, // per-route config.rateLimit blocks opt in individually
  >     max: 100,
  >     timeWindow: '1 minute',
  >     keyGenerator: (request) => request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? request.ip,
  >   });
  > });
  > ```
  >
  > **`plugins/cors.ts`** — strict allowlist per E2's CORS Configuration:
  > ```typescript
  > import fp from 'fastify-plugin';
  > import cors from '@fastify/cors';
  >
  > export default fp(async (fastify) => {
  >   const allowedOrigins = (process.env['CORS_ALLOWED_ORIGINS'] ?? '').split(',').filter(Boolean);
  >   await fastify.register(cors, {
  >     origin: allowedOrigins,
  >     credentials: false,
  >     methods: ['GET', 'POST', 'OPTIONS'],
  >     maxAge: 600,
  >   });
  > });
  > ```
  > `CORS_ALLOWED_ORIGINS` should already include `https://sp.batac.gov.ph` and
  > `https://portal.batac.gov.ph` per E2's Phase 1 allowlist table — confirm
  > against the env catalog (L1) rather than hardcoding either origin here;
  > if the env var doesn't exist yet, add it, since no prior task's Table of
  > Contents entry names `@fastify/cors` or `CORS_ALLOWED_ORIGINS` explicitly.
  >
  > **`portal.plugin.ts`** — registers the four routes this module owns:
  > ```typescript
  > import fp from 'fastify-plugin';
  > import listDocumentsRoute from './routes/list-documents';
  > import getDocumentRoute from './routes/get-document';
  > import submitComplaintRoute from './routes/submit-complaint';
  > import submitDocumentRequestRoute from './routes/submit-document-request';
  >
  > export default fp(async (fastify) => {
  >   await fastify.register(listDocumentsRoute);
  >   await fastify.register(getDocumentRoute);
  >   await fastify.register(submitComplaintRoute);
  >   await fastify.register(submitDocumentRequestRoute);
  > });
  > ```
  >
  > **Retrofit `tracking/routes/public-lookup.ts`** — `TASK-TRACK-008`
  > implemented this route before E2 existed in any module's reading list, so
  > it almost certainly registered as a bare Fastify route without a `schema`
  > block. Add one (do not change the handler logic itself):
  > ```typescript
  > schema: {
  >   tags: ['tracking'],
  >   summary: 'Document status lookup by QR tracking number',
  >   params: z.object({ trackingNumber: z.string().uuid() }),
  >   response: {
  >     200: TrackingLookupResponseSchema,
  >     404: ErrorResponseSchema,
  >     429: ErrorResponseSchema,
  >     500: ErrorResponseSchema,
  >   },
  > },
  > config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  > ```
  > If `TASK-TRACK-008`'s handler already has a differently-shaped `schema`
  > block (rather than none at all), reconcile field-by-field against
  > `TrackingLookupResponseSchema` rather than assuming — this task's
  > Acceptance Criteria requires the contract test to pass regardless of
  > which starting state is actually in the repository.
  >
  > **`app.ts` registration order** — plugins before routes; `openapi` before
  > `rate-limit`/`cors` (so route schemas are captured before requests are
  > filtered); portal plugin after `documentsService` and `trackingService`
  > are both available on the Fastify instance (i.e., after `TASK-DOCS-019`
  > and `TASK-TRACK-009`'s existing registrations, unchanged by this task):
  > ```typescript
  > await fastify.register(openapiPlugin);
  > await fastify.register(rateLimitPlugin);
  > await fastify.register(corsPlugin);
  > // ... existing plugin registrations (documents, tracking, etc.) ...
  > await fastify.register(portalPlugin);
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter server typecheck` passes
  > - [ ] `/v1/docs` renders all six endpoints under correct tags
  > - [ ] Auto-generated spec's path list matches E2 exactly — six paths
  > - [ ] CORS allows `portal.batac.gov.ph`, rejects unlisted origins
  > - [ ] `/v1/health` is never rate-limited
  > - [ ] `/v1/docs` is `404` in production
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-009

Phase:          1
Module:         PORTAL
Title:          Frontend: home, tracking lookup, and published-documents list/detail pages
Prerequisites:  [TASK-PORTAL-001, TASK-PORTAL-008]
Deliverables:
  - /apps/portal/src/app/page.tsx — `PortalHomePage`
  - /apps/portal/src/app/lookup/page.tsx — `PortalTrackingLookupPage`
  - /apps/portal/src/app/documents/page.tsx — `PortalDocumentsListPage`
  - /apps/portal/src/app/documents/[documentId]/page.tsx — `PortalDocumentViewPage`
Acceptance Criteria:
  - [ ] `pnpm --filter @batac/portal typecheck` and `build` both pass
  - [ ] `/lookup`: entering a valid tracking number (UUID) navigates to or renders the matching status; an invalid/unmatched one shows a not-found state without a raw error dump
  - [ ] `/documents`: renders a paginated grid/list from `GET /public/documents`; type, year, and search filters each update the query string and re-fetch
  - [ ] `/documents/[documentId]`: renders full detail for a valid, publicly-visible document; a 404 response renders a not-found page, not a crash
  - [ ] Manual: first-page preview images render via `next/image` using the presigned URL's `remotePatterns`-allowed host (confirms `TASK-PORTAL-001`'s `next.config.ts` entry is correct)
  - [ ] Manual: page body text (not just alt text) is legible to a screen reader — this is a public government service; no icon-only interactive element lacks an accessible label
AI Prompt:
  > Build four pages for `/apps/portal`. Route paths and component names below
  > follow F1 §14.2 where F1 names them; two deviations from F1's literal
  > table are made and flagged explicitly — read this note before choosing
  > paths, since guessing wrong here would misalign the frontend with the
  > REST contract these pages must call.
  >
  > **Deviation 1 — added routes not in F1's table.** F1 §14.2 names no
  > `/portal` home route and no plain `/portal/documents` (list, no
  > parameter) route — only a single detail route. F1's own text admits why:
  > *"Primary data dependencies for every row above: REST, not catalogued in
  > any tRPC source... no REST endpoint catalogue exists to cross-reference,
  > so no endpoint names are stated here"* — F1 was written before E2 existed
  > for any module to load. E2 defines a fully paginated, filterable,
  > searchable `GET /v1/public/documents` list endpoint (`TASK-PORTAL-004`,
  > `TASK-PORTAL-005`); a search/filter/pagination contract with no browsable
  > list page to drive it would be dead code, so this task adds `/documents`
  > (component `PortalDocumentsListPage`, name chosen for consistency with
  > F1's `PortalDocumentViewPage`/`PortalTrackingLookupPage` naming pattern,
  > not itself confirmed by any source) and a bare `/` home page linking to
  > `/lookup`, `/documents`, `/complaints/new`, and `/requests/new` (component
  > `PortalHomePage` — no data dependency of its own, matching the precedent
  > F1 §13.1 sets for other pure-navigation home pages: *"No data of its own;
  > links to its children"*).
  >
  > **Deviation 2 — route parameter name.** F1 §14.2 names the detail route
  > `/portal/documents/:trackingNumber`, with the note *"Shows a document
  > only after `documents.publishToPortal` has been called from
  > `/documents/:documentId`"* — but E2's actual backend endpoint
  > (`TASK-PORTAL-005`) takes `documentId` as its path parameter, not
  > `trackingNumber`; there is no REST endpoint that resolves a bare tracking
  > number to a published-document detail (only `/public/tracking/{trackingNumber}`,
  > which returns `TrackingLookupData`, a different, narrower shape than
  > `PublishedDocumentDetail`). Building the page around `:trackingNumber` as
  > F1 literally states would require an extra, unspecified resolution step
  > this pass has no contract for. This task uses `[documentId]` instead —
  > `[CONFLICT]`, resolved in the direction of the actual wire contract (E2)
  > over a route table that predates it and admits as much. Every place a
  > document is linked (the list page below, and `TASK-PORTAL-005`'s
  > `documentRequestUrl`/`firstPagePreview` construction) already has
  > `documentId` on hand from the API response, so this costs nothing in
  > practice — it only matters if a human elsewhere expects `trackingNumber`
  > in the URL bar specifically for citizen memorability, which no loaded
  > document confirms one way or the other.
  >
  > One note worth carrying forward, not resolved by this task: F1's mention
  > of `documents.publishToPortal` (an internal, presumably `DOCS`-owned tRPC
  > procedure gating whether a document is publicly visible at all) was not
  > confirmed against `docs.md`'s actual `TASK-DOCS-011`–`013` procedure lists
  > in this pass — only their Table-of-Contents one-line summaries were read,
  > which don't enumerate individual procedure names. `TASK-PORTAL-004`
  > assumes this action is what sets `public_visibility_rule =
  > 'title_and_first_page_public'`; confirm that assumption against `docs.md`
  > or E1 directly before relying on it further.
  >
  > **Home page** (`app/page.tsx`) — simple, four links, matching the tone
  > already set by `layout.tsx`'s metadata ("Search and verify ordinances,
  > resolutions, and legislative documents enacted by the Sangguniang
  > Panlungsod ng Lungsod ng Batac"). No data fetching.
  >
  > **Lookup page** (`app/lookup/page.tsx`, `PortalTrackingLookupPage`) — a
  > single UUID input, calling `GET /public/tracking/{trackingNumber}` via
  > `TASK-PORTAL-001`'s `portalFetch` client. On success, render
  > `TrackingLookupData`'s fields (status, routing history, first-page
  > preview). On a `404`, render an inline not-found message — do not
  > `throw` and rely on Next.js's generic error boundary, since a wrong or
  > mistyped tracking number is an expected, common user action here, not an
  > exceptional one.
  >
  > **List page** (`app/documents/page.tsx`, `PortalDocumentsListPage`) —
  > read `documentType`/`year`/`q`/`page` from `useSearchParams()`, call `GET
  > /public/documents` with them, render `PublishedDocumentSummary` cards
  > (title, type, final number, approval date, first-page preview thumbnail
  > via `next/image`, link to `/documents/${documentId}`), and pagination
  > controls driven by the response's `meta`.
  >
  > **Detail page** (`app/documents/[documentId]/page.tsx`,
  > `PortalDocumentViewPage`) — fetch `GET /public/documents/${documentId}`
  > server-side (a Next.js Server Component, since `documentId` is known at
  > request time and this avoids a client-side loading flash for a page
  > that's likely to be shared/linked directly). On a `404` response, call
  > Next.js's `notFound()`. Render every `PublishedDocumentDetail` field;
  > include a prominent link to `documentRequestUrl` for citizens who want a
  > full copy.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter @batac/portal typecheck` and `build` both pass
  > - [ ] Lookup handles both valid and invalid/unmatched tracking numbers gracefully
  > - [ ] List filters (type/year/search) all work and update the URL
  > - [ ] Detail page 404s correctly for an ineligible/nonexistent document
  > - [ ] Preview images render via the allowed remote host
  > - [ ] No icon-only control lacks an accessible label
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-010

Phase:          1
Module:         PORTAL
Title:          Frontend: citizen complaint submission form
Prerequisites:  [TASK-PORTAL-001, TASK-PORTAL-002, TASK-PORTAL-006]
Deliverables:
  - /apps/portal/src/app/complaints/new/page.tsx — `PortalComplaintFormPage`
  - /apps/portal/src/app/complaints/new/confirmation.tsx — confirmation view shown after a successful submission
Acceptance Criteria:
  - [ ] `pnpm --filter @batac/portal typecheck` and `build` both pass
  - [ ] Selecting `violationType: 'other'` reveals a required "please specify" field client-side, matching `TASK-PORTAL-002`'s server-side `superRefine` rule — the same rule enforced in two places, not two different rules
  - [ ] `incidentTime` is entered via a time picker that cannot produce a non-24-hour-format value, rather than a free-text field a citizen could mistype
  - [ ] Submitting a valid form shows the confirmation view with the returned `referenceCode` and, when `accessMode: 'digital_form'` was selected, a download link for `printableFormUrl`
  - [ ] A `400` response's `details` array is mapped back onto the matching form fields, not shown as a single generic error banner
  - [ ] A `429` response shows a clear "too many submissions, try again later" message, not a raw error
  - [ ] Manual: the form is fully usable via keyboard alone (tab order, no keyboard trap), and every field has a visible label — not placeholder-only, per standard government-accessibility practice
AI Prompt:
  > Build `/complaints/new` — F1 §14.3's confirmed no-login rationale applies
  > directly: *"the physical signature, not the digital account, is what is
  > legally operative"* for this form, so build no auth gate of any kind here.
  >
  > Two access modes, both real (from `ComplaintAccessModeSchema`):
  > `digital_form` (the citizen fills the whole form now, gets a printable PDF
  > back) and `clerk_assisted` (a shorter path — the citizen intends to file
  > in person with a clerk's help; capture minimal identifying info and skip
  > the printable-form step). Let the citizen choose this at the top of the
  > form, before the rest of the fields — it changes what's required below it
  > (per `TASK-PORTAL-002`'s schema, `accessMode` doesn't change field
  > *requiredness* itself, but it changes what happens after submission, so
  > surface the choice early for a coherent experience even though the schema
  > doesn't strictly require it up front).
  >
  > Use a form library already present in the monorepo if `TASK-UI`'s work
  > established one for `/apps/web` (check `packages/ui/package.json`'s
  > dependencies before adding a second one) — react-hook-form + a Zod
  > resolver is the common pairing for this stack and works well with the
  > exact schemas `TASK-PORTAL-002` already exports (`import {
  > ComplaintSubmissionRequestSchema } from '@batac/shared'` gives you both
  > client-side and server-side validation from one definition, with the
  > `violationTypeOther`-required-when-`'other'` rule enforced identically in
  > both places since it's the same Zod schema).
  >
  > Field-by-field, from `ComplaintSubmissionRequestSchema`
  > (`TASK-PORTAL-002`): violation type (select, with an "other" free-text
  > reveal), tricycle number (optional text — only meaningful for
  > transportation-related violation types; consider conditionally showing
  > it), incident date (date picker) and time (24-hour time picker — do not
  > use a free-text input a citizen could type "2:30 PM" into, since the
  > schema rejects that format and a citizen shouldn't discover why at
  > submission time), place, remarks (optional, multi-line), complainant name
  > /address/contact (required) and email (optional), respondent name/contact
  > /email (all optional — per consolidated ref Part 4.14, notification
  > channel depends on whichever the respondent info actually provides).
  >
  > On submit: `POST /public/complaints` via `TASK-PORTAL-001`'s
  > `portalFetch`. On `201`, navigate to (or render) the confirmation view
  > with `referenceCode`, `message`, and — when present — a download link for
  > `printableFormUrl`. On `400` (a `ValidationErrorResponse`), map each
  > `details[].field` back onto the corresponding form field's error state
  > using react-hook-form's `setError`, rather than a generic banner — the
  > citizen should see exactly which field needs fixing. On `429`, show a
  > clear rate-limit message with no technical detail.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter @batac/portal typecheck` and `build` both pass
  > - [ ] "Other" violation type reveals and requires the specify field, client-side, matching the server rule
  > - [ ] Time entry cannot produce a non-24-hour value
  > - [ ] Successful submission shows reference code + conditional download link
  > - [ ] `400` errors map to the correct fields; `429` shows a clear message
  > - [ ] Fully keyboard-navigable with visible (non-placeholder-only) labels
  > A reviewer will verify each one independently.

---
## TASK-PORTAL-011

Phase:          1
Module:         PORTAL
Title:          Frontend: Document and Records Request Form submission
Prerequisites:  [TASK-PORTAL-001, TASK-PORTAL-002, TASK-PORTAL-007]
Deliverables:
  - /apps/portal/src/app/requests/new/page.tsx — `PortalDocumentRequestFormPage`
  - /apps/portal/src/app/requests/new/confirmation.tsx — confirmation view shown after a successful submission
Acceptance Criteria:
  - [ ] `pnpm --filter @batac/portal typecheck` and `build` both pass
  - [ ] Arriving at the page via a `?ref=` query parameter (the link `TASK-PORTAL-005`'s `documentRequestUrl` produces) pre-fills `documentTitle`/`documentNumber` from it
  - [ ] Submitting a valid form shows the confirmation view with `referenceCode`, `estimatedWorkingDays`, and — when applicable — `printableFormUrl`
  - [ ] The confirmation view states plainly that payment is collected in person and identity must be verified with a government-issued ID at pickup, per consolidated ref Part 4.15 — this is not optional messaging, since a citizen who shows up expecting instant online completion is a real support-burden risk this task is responsible for preventing
  - [ ] A `400` response's `details` array is mapped back onto the matching form fields
  - [ ] Manual: fully keyboard-navigable with visible labels
AI Prompt:
  > Build `/requests/new` — same no-login basis as `TASK-PORTAL-010`
  > (F1 §14.3, [ADR-UI-009]). Reuse the same form-library choice
  > `TASK-PORTAL-010` made rather than introducing a second pattern.
  >
  > **Deep-link pre-fill:** `TASK-PORTAL-005`'s list/detail handlers build
  > `documentRequestUrl` as `${PORTAL_BASE_URL}/document-requests?ref=${finalNumber}`
  > — note the path there is `/document-requests`, while F1 §14.2 names this
  > page's route `/requests/new`. `[CONFLICT]`, unresolved by any loaded
  > document (E2's own examples use `/document-requests?ref=...` verbatim in
  > its `documentRequestUrl` field description; F1 §14.2's table independently
  > says `/portal/requests/new`). This task builds the page at `/requests/new`
  > per F1 (a route-map document is the more direct authority for frontend
  > paths than a REST spec's illustrative example string), but
  > `TASK-PORTAL-005`'s `documentRequestUrl`-construction logic should be
  > revisited to point at `/requests/new?ref=...` instead of
  > `/document-requests?ref=...` so the two tasks actually agree — flagging
  > here rather than silently fixing `TASK-PORTAL-005` after the fact, since
  > that task has already been written above and this task list does not
  > re-edit earlier tasks once written (`A1-AGENTS.md` §8's "do not edit"
  > discipline applied to this document's own internal consistency, not just
  > to other pre-dev documents). On arrival, read `ref` from
  > `useSearchParams()` and pre-fill `documentTitle`/`documentNumber` if
  > present — treat it as an optional convenience, not a required flow (a
  > citizen may also arrive here directly, with no prior document in mind,
  > e.g. requesting a copy of something found via `/documents` search).
  >
  > Field-by-field, from `DocumentRequestSubmissionRequestSchema`
  > (`TASK-PORTAL-002`): requester name (required), agency/organization
  > (optional), email (required — the schema requires it even though phone is
  > the primary post-approval contact channel per consolidated ref Part 4.15;
  > keep both), phone (optional), document type (select, three values),
  > document title (required), document number (optional, pre-filled from
  > `?ref=` when present), number of pages to copy (optional, numeric),
  > purpose (required, multi-line), ID type (required — free text is
  > acceptable per the schema, but consider a select with the four ID types
  > consolidated ref Part 4.15 names as an option set, plus an "other" text
  > fallback, for a better citizen experience than a blank text box), access
  > mode (same `digital_form` / `clerk_assisted` choice as
  > `TASK-PORTAL-010`).
  >
  > On submit: `POST /public/document-requests`. On `201`, show the
  > confirmation view — critically, this must state that **payment is
  > collected in person after approval** and **a government-issued ID is
  > required at pickup** (consolidated ref Part 4.15, quoted in full in
  > `TASK-PORTAL-007`'s AI Prompt) — a citizen who submits this form and
  > believes the transaction is complete, with nothing further required of
  > them, has been actively misled by this page, not merely under-informed.
  > On `400`, map field errors as in `TASK-PORTAL-010`.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter @batac/portal typecheck` and `build` both pass
  > - [ ] `?ref=` pre-fills correctly when present
  > - [ ] Successful submission shows reference code, SLA estimate, and conditional download link
  > - [ ] Confirmation view clearly states in-person payment + ID requirement
  > - [ ] `400` errors map to the correct fields
  > - [ ] Fully keyboard-navigable with visible labels
  > A reviewer will verify each one independently.

---
## Module Summary — PORTAL

**Total tasks:** 11 (`TASK-PORTAL-001` through `TASK-PORTAL-011`) — within
`a1-skeleton.md` §6's estimated 8–12 range for this module.

**First executable task:** `TASK-PORTAL-001` and `TASK-PORTAL-002` share the
same single prerequisite (`TASK-INFRA-001`) and can run in parallel; every
other task in this file depends on one or both, directly or transitively.

**Structural note:** unlike every other Phase-1 module in this A1 generation
round, `PORTAL` owns zero database tables. `docs.md`'s Module Summary
(`CONFLICT-DOCS-01`) confirms `portal.complaints` and `portal.citizen_requests`
are reserved for a later, separate effort ("Phase 3 additions when the full
PORTAL module ships" — meaning the true master-roadmap Phase 3 rollout, not
this pass). Every task in this file is REST/frontend code, or a narrowly-scoped
extension to `DOCS`'s existing schema-owning module — never a new schema of
`PORTAL`'s own.

### Conflict — this pass's phase assignment (see also the note at the top of this document)

`A1-AGENTS.md` §2's Pass Types table names this pass's consolidated-reference
load as "§13 Phase 3" — the only module row that names a phase at all. Three
independent sources contradict a literal reading of that cell: `A1-AGENTS.md`
§6's own Step 2 instruction ("read the capability list... Phase 1... for every
pass without exception"), `a1-skeleton.md` §3's Phase Scope Table (`PORTAL`
Phase 1 = "Full spec," Phase 3 = "Title only"), and consolidated ref Part
11.18's own subsection heading, "Phase 1 public portal behavior confirmed."
**Followed:** Phase 1, full spec, for the four capabilities all three sources
name. Flagged rather than silently corrected, per `A1-AGENTS.md` §1.

### `[Inference]` — two new DOCS Published API methods (companion edit needed)

`TASK-PORTAL-003` and `TASK-PORTAL-004` each add a method to
`apps/server/src/modules/documents/index.ts`'s Published API export —
`createPublicSubmission()` (write) and `listPublishedDocuments()` /
`getPublishedDocumentDetail()` (read) — because the five methods `TASK-DOCS-006`
already shipped (`getDocumentById`, `getDocumentType`, `transitionState`,
`assignFinalNumber`, `getAttachmentRefs`) cover neither. `docs.md`'s own
Module Summary anticipated only `getDocumentById`/`getDocumentType` reads for
`PORTAL` ("Downstream consumers... PORTAL (Wave G): calls getDocumentById,
getDocumentType") — written before this pass identified the write-path need
and the list/search need. `TASK-PORTAL-003` also seeds two new
`number_series` rows (`CITIZEN_COMPLAINT_REF`, `DOCUMENT_REQUEST_REF`)
alongside the 11 `TASK-DOCS-008` already seeded.

**Recommendation for a human integrator:** these three deliverables belong,
by schema ownership, in `docs.md` — as `TASK-DOCS-024` (submission write path
+ number series) and `TASK-DOCS-025` (public read/list path) — mirroring
exactly how `TASK-INFRA-023` was retroactively added to `infra.md` after
`audit.md` surfaced an EventBus gap in an already-finalized module. This pass
does not perform that move itself (its only authorized output is this file);
`TASK-PORTAL-003`/`004` are fully self-contained as written so implementation
is not blocked on the rename, but the two tasks are logically `DOCS`-owned
work product.

### Conflicts between F1 and E2 (F1 predates E2 in every module's reading list)

F1 §14.2 itself states its route table was written with *"no REST endpoint
catalogue exists to cross-reference."* Two concrete disagreements with E2
followed from that:

1. F1 names the document-detail route `/portal/documents/:trackingNumber`;
   E2's actual endpoint takes `documentId`. `TASK-PORTAL-009` builds
   `/documents/[documentId]`, matching the wire contract over the route
   table. `[SPEC GAP]`, separately: F1's note that this page shows a document
   "only after `documents.publishToPortal` has been called" references an
   internal procedure this pass could not confirm against `docs.md`'s actual
   `TASK-DOCS-011`–`013` content (only Table-of-Contents summaries were
   read) — `TASK-PORTAL-004` assumes this action is what sets
   `public_visibility_rule = 'title_and_first_page_public'`, unconfirmed.
2. E2's own `documentRequestUrl` example uses path `/document-requests?ref=...`;
   F1 §14.2 names the same page's route `/requests/new`. `TASK-PORTAL-011`
   builds at `/requests/new` (F1) and flags that `TASK-PORTAL-005`'s URL
   construction should be revisited to match — not fixed retroactively in
   this document, per `A1-AGENTS.md` §8's edit discipline applied to this
   file's own internal consistency.

F1 also names no `/portal` home route and no bare `/documents` list route.
Given E2 defines a full paginated/searchable list endpoint, `TASK-PORTAL-009`
adds both, clearly flagged as additions beyond F1's literal table rather than
sourced from it.

### Other `[SPEC GAP]` items left for human resolution

- `public_visibility_rule`'s exact column name/enum values (E2's prose
  names it consistently; no loaded document shows its literal DDL — `C1` was
  not in this pass's reading list).
- Which columns hold authorship/sponsorship/committee-assignment data for
  `PublishedDocumentDetail` (same cause).
- Whether document-version rows persist first-page preview pixel dimensions
  (`TASK-PORTAL-005`'s `widthPx`/`heightPx` default to `null` pending this).
- Printable complaint/document-request form PDF visual layout — no loaded
  document specifies one; `TASK-PORTAL-006` renders an interim legible
  layout pending design review.
- Where the ARTA SLA threshold (`estimatedWorkingDays: 3`) should be
  configured long-term — hardcoded for now.
- Whether `@fastify/swagger`'s Zod type provider is already globally
  configured in `app.ts`, and whether `@fastify/cors`/`@fastify/rate-limit`
  are already registered anywhere — no module's Table of Contents names
  either explicitly; `TASK-PORTAL-008` checks rather than assumes.
- Whether `@batac/config` exports a reusable Tailwind preset
  (`TASK-PORTAL-001`) — that package's own contents were outside this pass's
  reading list.

### Deferred capabilities — not built by this pass

Per `A1-AGENTS.md` §5, all of the following carry real Phase 3 (or later)
capability per consolidated ref Part 13 and are explicitly out of scope here:

- `[DEFERRED — Phase 3: citizen registration/login]` `/portal/register`,
  `/portal/login` — OTP-based phone + email flow; E2's own Non-Scope section
  reserves the schema and defers the endpoints.
- `[DEFERRED — Phase 3: authenticated status tracking]`
  `/portal/requests/:requestId/status`, `/portal/complaints/:complaintId/status`
  — both require an authenticated citizen session per F1 §14.2, which does
  not exist in this pass's scope.
- `[DEFERRED — Phase 3: public-portal announcements]` `/portal/announcements`
  and its staff-side `/admin/announcements` counterpart — F1 §14.4 says
  "built now" per [ADR-UI-006], but no REST or tRPC contract for it exists in
  any document loaded by this pass (E2 is silent on it); building it would
  mean inventing a contract, which `A1-AGENTS.md` §8 prohibits.
- `[DEFERRED — Phase 3+: payment processing]` consolidated ref Part 4.15:
  "deferred to stages later than the currently planned phases."
- `[DEFERRED — true Phase 3 (Months 13–18)]` everything consolidated ref
  Part 13's actual Phase 3 section names beyond this pass's four
  capabilities: SMS gateway, DPA compliance features, barangay official
  access, advanced executive dashboards, and the `portal.complaints`/
  `portal.citizen_requests` schema tables.

### Downstream consumers

None. `PORTAL` is Wave G, the final wave in this generation round, and
exposes no Published API of its own — it is purely a REST/frontend consumer
of `DOCS` and `TRACK`. No later module in this pass depends on it.

### Sourcing summary

Of this file's content: two tasks (`TASK-PORTAL-003`, `TASK-PORTAL-004`) are
`[Inference]`-labeled in full, being new capability designs rather than
sourced specs; every other task is sourced directly from E2, F1 §14, or
consolidated ref Parts 4.14/4.15/11.18/13, with `[Inference]` and `[SPEC GAP]`
markers scoped inline to the specific sub-points listed above rather than
whole tasks. No content in this file was invented to paper over a gap without
a flag — where a loaded document didn't say, this file says so.