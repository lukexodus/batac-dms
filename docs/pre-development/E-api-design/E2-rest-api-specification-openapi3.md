# E2 — REST API Specification (OpenAPI 3.0) — Pre-Development Baseline

**Document:** E2
**Platform:** Batac City LGU Platform
**Status:** BLOCKING for Portal (Phase 3) and any third-party consumer of the public API. Non-blocking for Phase 1 internal workflow development, which uses tRPC exclusively.
**Last Updated:** June 2026
**Audience:** Backend development team; frontend portal team; LGU IT Office
**Source Documents:**

- `consolidated-architecture-and-requirements-reference-iteration-3.md` — Parts 2, 4, 9, 11 (scope, document types, stack, design decisions)
- `2-stack-context.md` — tRPC hybrid architecture; Fastify REST + OpenAPI rule; rate limiting; CORS
- `b2-module-boundary-and-internal-api-contracts.md` — Module 5 (Tracking), Module 10 (Portal); Published API contracts; event bus
- `c1-full-database-schema-ddl.md` — Schema types for `documents`, `tracking`, `portal` (column names, enums, constraints)

---

## About This Document

### Scope

This document is the authoritative OpenAPI 3.0 design specification for all **public REST endpoints** of the Batac City LGU Platform. "Public" means callable by any HTTP client without authentication. Phase 1 public endpoints are:

1. **Document status lookup by QR tracking number** — the endpoint QR code scans resolve to
2. **Published legislative documents listing** — paginated, searchable list of released documents with first-page preview
3. **Published document detail** — metadata and first-page preview for a single released document
4. **Citizen complaint submission** — any LGU-related complaint; not limited to transportation
5. **Document Request Form submission** — request a copy of an SP document (fee-based; payment deferred)
6. **Service health check** — operational/monitoring use

A companion specification document (E2-internal, out of scope here) will document authenticated staff-facing REST endpoints if any are ever added. Phase 1 internal staff operations use **tRPC exclusively** and are not documented in OpenAPI format.

### Non-Scope

The following are explicitly not in this document:

- **tRPC procedures** — consumed exclusively by `/apps/web` (internal SPA). Not REST; no OpenAPI spec applies.
- **Citizen authentication endpoints** (Phase 3) — OTP-based phone + email flow. Schema reserved; endpoints deferred.
- **Phase 1B, 2, 3 REST additions** — Letters, Memos, Designations endpoints; citizen account management; SMS gateway. Each phase will add an addendum to this document.
- **Webhook or SSE push endpoints** — Real-time notifications for internal users are Server-Sent Events routed through the internal tRPC layer, not public REST.
- **Admin configuration endpoints** — Workflow definitions, numbering series, retention schedules. Admin-only; authenticated internal API only.

### Relationship to Other Documents

| Dependency | Direction | Notes |
|---|---|---|
| `2-stack-context.md` | Source | Stack choices: Fastify, `@fastify/swagger`, `fastify-type-provider-zod`, `@fastify/rate-limit`, `@fastify/cors`, `@fastify/helmet` |
| `b2-module-boundary-and-internal-api-contracts.md` | Source | Module 5 Tracking `publicLookupHandler`; Module 10 Portal endpoint responsibilities |
| `c1-full-database-schema-ddl.md` | Source | Enums, column names, constraint rules used to derive schema definitions here |
| `C3` (RLS Policies) | Downstream | RLS policies must permit the `app_user` role to SELECT from `documents`, `tracking`, and `portal` schemas for the rows these endpoints expose |
| `H2` (Document Type Catalog) | Source | Document type codes and public visibility rules; first-page-only visibility rule for SP_RESOLUTION, SP_ORDINANCE, APPROPRIATION_ORDINANCE |
| `I1` (ABAC Policy Catalog) | Downstream | ABAC policy for "unauthenticated public read" must exist for public-visibility-eligible documents before public endpoints go live |

### A Note on `@fastify/swagger` and This Document

`@fastify/swagger` **generates** an OpenAPI spec from route schemas at runtime. This document defines the **target state** of that generated spec: what it must look like. The implementation must ensure the auto-generated spec matches this document exactly. Any divergence (a Zod schema that produces a subtly different JSON Schema, a missing example, an incorrect response status code) must be reconciled before the endpoint ships.

The authoritative source of truth for request/response shapes is the Zod schemas in `/packages/shared`. This document is the **contract expression** of those shapes, readable by clients and reviewers who do not read TypeScript.

The route-level integration pattern is documented in the [@fastify/swagger Integration](#fastifyswagger-integration) section at the end of this document.

---

## API Conventions

### Base URL and Versioning

All public REST endpoints are versioned at `/v1`. The base URL path is `/v1`; the full URL depends on deployment environment (see `servers` in the spec below).

Versioning policy: the major version increments only on **breaking changes** (field removal, type change, required field addition, enum value removal). Non-breaking additions (new optional fields, new endpoints, new enum values) do not increment the version. A breaking change is preceded by a deprecation notice in this document with a minimum 30-day notice period before removal.

### Response Envelope

All responses use a consistent envelope:

```
{
  "data": <object or array>,       // present on success
  "meta": <PaginationMeta object>  // present on paginated list responses only
}
```

Error responses do **not** use the `data` envelope; they follow the `ErrorResponse` shape directly.

### Error Format

All error responses follow the `ErrorResponse` or `ValidationErrorResponse` schema (see components). HTTP status codes map as follows:

| Code | Meaning | When used |
|---|---|---|
| `400 Bad Request` | Schema validation failure | Missing required field; wrong type; pattern mismatch; out-of-range value |
| `404 Not Found` | Resource not found | Tracking number or document ID does not exist; document not publicly visible |
| `422 Unprocessable Entity` | Business rule violation | Document type cannot accept complaint submissions; etc. |
| `429 Too Many Requests` | Rate limit exceeded | See rate limiting section |
| `500 Internal Server Error` | Unexpected server error | Unhandled exception (Sentry notified automatically) |
| `503 Service Unavailable` | Dependency unavailable | PostgreSQL unavailable at health check |

Validation errors (400) always include a `details` array with per-field error entries.

### Pagination

All list endpoints support cursor-free offset pagination via `page` and `limit` query parameters. Responses include a `PaginationMeta` object with `total`, `page`, `limit`, `totalPages`, `hasNextPage`, and `hasPrevPage`.

Default: `page=1`, `limit=20`. Maximum: `limit=100`.

### Timestamps and Timezone

All `date-time` values are ISO 8601 strings in the `Asia/Manila` timezone (UTC+8), e.g. `2026-06-15T14:30:00+08:00`. Clients should parse as timezone-aware datetimes.

All `date` values are ISO 8601 date strings, e.g. `2026-06-15`.

### Presigned Image URLs

First-page previews are served as presigned S3-compatible URLs. Default TTL: **15 minutes** (configurable via `PRESIGNED_URL_TTL_SECONDS` in the env catalog). Clients must not cache beyond `expiresAt`. If a URL has expired, re-fetch the parent endpoint to obtain a fresh presigned URL.

First-page images are rendered from the uploaded PDF at upload time (eager rendering) and stored in S3 as JPEG. Subsequent pages are not exposed through this API; full-document access requires a Document Request Form.

### Internationalization

All response labels and messages are returned in the language indicated by the `Accept-Language` request header. Supported values: `fil` (Filipino), `en` (English, default), `ilo` (Ilocano). If an unsupported locale is requested, the server falls back to `en` and includes a `Content-Language: en` response header.

The locale setting affects human-readable fields (`documentTypeName`, `lifecycleStatus`, `message`, error messages). Structured fields (enums, UUIDs, series numbers, dates) are locale-invariant.

### Rate Limiting

The `@fastify/rate-limit` plugin enforces per-IP rate limits on all public endpoints. Rate limit headers are included on every response (see spec). Full configuration is in the [Rate Limiting Configuration](#rate-limiting-configuration) section.

### CORS

The `@fastify/cors` plugin enforces a strict origin allowlist. Allowed origins are configured in the env catalog (`CORS_ALLOWED_ORIGINS`). Initial Phase 1 allowlist: `https://sp.batac.gov.ph`. Additional origins added at deployment time as the portal is built.

### Security Headers

`@fastify/helmet` provides default security headers on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-XSS-Protection`. These headers are not enumerated in the OpenAPI spec (they are response headers outside the schema layer) but are always present in production.

---

## Phase 1 Endpoint Summary

| Method | Path | Auth | Module | Description |
|---|---|---|---|---|
| `GET` | `/v1/health` | None | — | Service health check |
| `GET` | `/v1/public/tracking/{trackingNumber}` | None | Tracking | Document lookup by QR UUID; routing history |
| `GET` | `/v1/public/documents` | None | Portal / Documents | Paginated list of published legislative documents |
| `GET` | `/v1/public/documents/{documentId}` | None | Portal / Documents | Single published document detail |
| `POST` | `/v1/public/complaints` | None | Portal | Citizen complaint submission |
| `POST` | `/v1/public/document-requests` | None | Portal | Document copy request form |

**Module routing note (from B2):** The Tracking module owns the `publicLookupHandler` REST endpoint (`/v1/public/tracking/{trackingNumber}`). Portal module owns the `/v1/public/documents`, `/v1/public/complaints`, and `/v1/public/document-requests` endpoints. From the API consumer's perspective this is invisible — all endpoints live under the same Fastify process. The distinction matters only for the internal Fastify plugin scope where these routes are registered.

---

## OpenAPI 3.0 Specification

The full spec below is the target state that `@fastify/swagger` must reproduce at runtime. It is presented as standalone YAML for readability and can be used directly with any OpenAPI-compatible tooling (Swagger UI, Redoc, code generators, contract testing).

```yaml
openapi: '3.0.3'

info:
  title: 'Batac City LGU Platform — Public REST API'
  version: '1.0.0'
  description: |
    Public REST API for citizen-facing features of the Batac City LGU Platform.

    Phase 1 scope: document status lookup by QR tracking number, published
    legislative document browsing, citizen complaint submission, and document
    copy request form submission. All Phase 1 endpoints are unauthenticated.

    Internal staff endpoints (SP Secretariat, Mayor's Office, department
    staff) use tRPC and are not documented here.

    Legal source of truth: Physical documents retain legal primacy.
    This platform is the operational source of truth for tracking, workflow,
    and reporting purposes (consolidated reference Part 1).

    Contact the Batac City IT Office for API access or integration queries.

servers:
  - url: 'https://api.batac.gov.ph/v1'
    description: 'Production'
  - url: 'https://staging-api.batac.gov.ph/v1'
    description: 'Staging / UAT'
  - url: 'http://localhost:3000/v1'
    description: 'Local development'

tags:
  - name: 'health'
    description: 'Service health and readiness checks'
  - name: 'tracking'
    description: |
      Document tracking by QR code. The QR tracking UUID is assigned at
      secretariat logging — before the preliminary series number is
      assigned. It is immutable for the document's full lifetime.
  - name: 'documents'
    description: |
      Published legislative documents (SP Resolutions, SP Ordinances,
      and Appropriation Ordinances) that have completed the full
      legislative lifecycle and been released to the public portal.
      Title and first page are publicly visible; full copies require
      a Document Request Form submission.
  - name: 'complaints'
    description: |
      Citizen complaint submission. Complaints may cover any LGU-related
      subject — not limited to transportation. Routed by the SP Secretariat
      after submission.
  - name: 'document-requests'
    description: |
      Document and records copy request form. Fee-based. Approval requires
      Vice Mayor AND SP Secretary signatures. Payment collected in person
      at the Secretariat after approval.

# ─────────────────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────────────────

paths:

  # ---------------------------------------------------------------------------
  # Health
  # ---------------------------------------------------------------------------

  /health:
    get:
      operationId: 'getHealth'
      summary: 'Service health check'
      tags:
        - 'health'
      description: |
        Returns the operational status of the API. Suitable for load balancer
        health checks and uptime monitoring. Not rate-limited.

        Status values:
        - ok: all dependencies healthy; all operations available
        - degraded: non-critical dependency unavailable; primary read
          operations continue; mutations may be affected
        - unavailable: PostgreSQL unreachable; service cannot operate
      security: []
      responses:
        '200':
          description: 'Service is healthy or degraded but reachable'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
              example:
                status: 'ok'
                version: '1.0.0'
                timestamp: '2026-06-15T08:00:00+08:00'
        '503':
          description: 'Primary dependency unavailable; service cannot handle requests'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
              example:
                status: 'unavailable'
                version: '1.0.0'
                timestamp: '2026-06-15T08:00:00+08:00'

  # ---------------------------------------------------------------------------
  # Tracking — QR lookup
  # ---------------------------------------------------------------------------

  /public/tracking/{trackingNumber}:
    get:
      operationId: 'getDocumentByTrackingNumber'
      summary: 'Document status lookup by QR tracking number'
      tags:
        - 'tracking'
      description: |
        Looks up a document by its QR tracking UUID. This is the endpoint
        that QR code scans on physical SP documents resolve to.

        Assignment sequence (consolidated reference Part 11.6):
          Secretariat logs document
            → QR tracking UUID assigned (first, before series number)
            → Preliminary "Draft" series number assigned second
            → Workflow instance created

        The QR tracking UUID is completely independent of the series
        number. It is immutable for the document's full lifetime,
        including preliminary stage, through Mayor signature, through
        Panlalawigan review, and into the archive.

        Response content:
        - Document type, preliminary or final series number, title
        - Current lifecycle status display label and any Secretariat remarks
        - Full routing history from draft, ordered chronologically
        - Presigned URL for the first page image only (TTL: 15 min)
        - URL to the Document Request Form page for requesting the full copy

        This endpoint returns information for documents at any lifecycle
        stage, not only released documents. A document still in workflow
        will show its current routing history.

        Served by: Tracking module publicLookupHandler (B2 Module 5)
      security: []
      parameters:
        - $ref: '#/components/parameters/trackingNumber'
      responses:
        '200':
          description: 'Document found'
          headers:
            X-Request-ID:
              $ref: '#/components/headers/X-Request-ID'
            X-RateLimit-Limit:
              $ref: '#/components/headers/X-RateLimit-Limit'
            X-RateLimit-Remaining:
              $ref: '#/components/headers/X-RateLimit-Remaining'
            X-RateLimit-Reset:
              $ref: '#/components/headers/X-RateLimit-Reset'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TrackingLookupResponse'
              example:
                data:
                  trackingNumber: '550e8400-e29b-41d4-a716-446655440000'
                  documentId: '7c9e6679-7425-40de-944b-e07fc1f90ae7'
                  documentType: 'SP_RESOLUTION'
                  documentTypeName: 'SP Resolution'
                  title: 'A Resolution Authorizing the City Mayor to Enter Into a Memorandum of Agreement With MMSU'
                  preliminaryNumber: null
                  finalNumber: '7SP 2026-04'
                  lifecycleStatus: 'With Mayor — Pending Signature'
                  remarks: null
                  routingHistory:
                    - timestamp: '2026-03-04T09:15:00+08:00'
                      action: 'Received and logged by SP Secretariat'
                      fromOfficeName: null
                      toOfficeName: 'SP Secretariat'
                      actorDisplayName: 'Mia Prima M. Mesina'
                    - timestamp: '2026-03-05T10:00:00+08:00'
                      action: 'First Reading — referred to Committee on Education'
                      fromOfficeName: 'SP Secretariat'
                      toOfficeName: 'Committee on Education, Culture, Science & Technology'
                      actorDisplayName: null
                    - timestamp: '2026-03-12T14:30:00+08:00'
                      action: 'Committee Report submitted'
                      fromOfficeName: 'Committee on Education, Culture, Science & Technology'
                      toOfficeName: 'SP Secretariat'
                      actorDisplayName: null
                    - timestamp: '2026-03-18T10:00:00+08:00'
                      action: 'Second Reading — Approved'
                      fromOfficeName: 'SP Secretariat'
                      toOfficeName: 'SP Secretariat'
                      actorDisplayName: null
                    - timestamp: '2026-03-18T11:00:00+08:00'
                      action: 'Final number assigned: 7SP 2026-04'
                      fromOfficeName: 'SP Secretariat'
                      toOfficeName: 'SP Secretariat'
                      actorDisplayName: 'Gladys R. Lagura'
                    - timestamp: '2026-03-18T14:00:00+08:00'
                      action: 'Signed by Vice Mayor'
                      fromOfficeName: 'SP Secretariat'
                      toOfficeName: "Vice Mayor's Office"
                      actorDisplayName: null
                    - timestamp: '2026-03-19T09:00:00+08:00'
                      action: 'Transmittal Letter issued; transmitted to Mayor'
                      fromOfficeName: "Vice Mayor's Office"
                      toOfficeName: "Mayor's Office"
                      actorDisplayName: null
                  firstPagePreview:
                    url: 'https://r2.batac.gov.ph/previews/7c9e6679-first-page.jpg?X-Amz-Expires=900&...'
                    expiresAt: '2026-06-15T08:15:00+08:00'
                    widthPx: 794
                    heightPx: 1123
                  documentRequestUrl: 'https://portal.batac.gov.ph/document-requests?ref=7SP+2026-04'
        '404':
          description: 'No document found for this tracking number'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                statusCode: 404
                error: 'Not Found'
                message: 'No document found for the provided tracking number.'
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '500':
          $ref: '#/components/responses/InternalServerError'

  # ---------------------------------------------------------------------------
  # Published documents — list
  # ---------------------------------------------------------------------------

  /public/documents:
    get:
      operationId: 'listPublishedDocuments'
      summary: 'List published legislative documents'
      tags:
        - 'documents'
      description: |
        Returns a paginated list of published legislative documents that
        have been released to the public portal after completing the full
        legislative lifecycle (including Mayor action and Panlalawigan review
        where applicable).

        Phase 1 document types returned: SP_RESOLUTION, SP_ORDINANCE,
        APPROPRIATION_ORDINANCE.

        For each document the response includes title, series number,
        document type, key dates, and a presigned URL for the first page
        image only. All subsequent pages are blurred at the rendering layer.
        Full copies require a Document Request Form.

        Search (q parameter) uses PostgreSQL full-text search in Phase 1
        (tsvector/tsquery). Phase 2 upgrades to Meilisearch with typo
        tolerance for Filipino proper names.

        Public visibility rule applied: only documents with
        public_visibility_rule = 'title_and_first_page_public' are returned.
        Internal, confidential, and restricted documents are excluded.

        Results are ordered by final number assignment date, descending
        (most recently approved first) unless overridden by sort parameters.
      security: []
      parameters:
        - name: 'documentType'
          in: 'query'
          required: false
          description: 'Filter by document type code'
          schema:
            type: string
            enum:
              - 'SP_RESOLUTION'
              - 'SP_ORDINANCE'
              - 'APPROPRIATION_ORDINANCE'
        - name: 'year'
          in: 'query'
          required: false
          description: |
            Filter by the year portion of the final series number
            (e.g. 2026 returns all 7SP 2026-NN documents).
          schema:
            type: integer
            minimum: 2000
            maximum: 2099
            example: 2026
        - name: 'number'
          in: 'query'
          required: false
          description: |
            Find a document by its exact final series number
            (e.g. "7SP 2026-03"). The space delimiter is part of the
            number format; URL-encode as %20 or +.
            When this parameter is provided, it takes precedence over
            other filters and returns at most one result.
          schema:
            type: string
            maxLength: 50
            example: '7SP 2026-03'
        - name: 'q'
          in: 'query'
          required: false
          description: |
            Full-text search against document titles. Supports Filipino,
            English, and Ilocano text. Minimum 2 characters.
          schema:
            type: string
            minLength: 2
            maxLength: 200
        - name: 'page'
          in: 'query'
          required: false
          description: 'Page number, 1-indexed'
          schema:
            type: integer
            minimum: 1
            default: 1
            example: 1
        - name: 'limit'
          in: 'query'
          required: false
          description: 'Items per page. Maximum 100.'
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
            example: 20
      responses:
        '200':
          description: 'Paginated list of published documents'
          headers:
            X-Request-ID:
              $ref: '#/components/headers/X-Request-ID'
            X-RateLimit-Limit:
              $ref: '#/components/headers/X-RateLimit-Limit'
            X-RateLimit-Remaining:
              $ref: '#/components/headers/X-RateLimit-Remaining'
            X-RateLimit-Reset:
              $ref: '#/components/headers/X-RateLimit-Reset'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublishedDocumentListResponse'
        '400':
          description: 'Invalid query parameters'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationErrorResponse'
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '500':
          $ref: '#/components/responses/InternalServerError'

  # ---------------------------------------------------------------------------
  # Published documents — single
  # ---------------------------------------------------------------------------

  /public/documents/{documentId}:
    get:
      operationId: 'getPublishedDocument'
      summary: 'Get a single published document'
      tags:
        - 'documents'
      description: |
        Returns full metadata for a single published legislative document
        identified by its system UUID.

        Returns 404 if:
        - The document does not exist
        - The document exists but has not been released (still in workflow)
        - The document's public_visibility_rule is not
          'title_and_first_page_public'

        The response includes title, series number, authorship, committee
        assignments, Panlalawigan review outcome, publication details (if
        an ordinance with penalty), and a presigned URL for the first
        page image only.
      security: []
      parameters:
        - $ref: '#/components/parameters/documentId'
      responses:
        '200':
          description: 'Document found and publicly accessible'
          headers:
            X-Request-ID:
              $ref: '#/components/headers/X-Request-ID'
            X-RateLimit-Limit:
              $ref: '#/components/headers/X-RateLimit-Limit'
            X-RateLimit-Remaining:
              $ref: '#/components/headers/X-RateLimit-Remaining'
            X-RateLimit-Reset:
              $ref: '#/components/headers/X-RateLimit-Reset'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublishedDocumentDetailResponse'
              example:
                data:
                  documentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
                  documentType: 'SP_ORDINANCE'
                  documentTypeName: 'SP Ordinance'
                  title: 'An Ordinance Regulating the Operation of Tricycles-for-Hire in Batac City'
                  finalNumber: '7SP 2026-02'
                  approvedAt: '2026-02-18'
                  releasedAt: '2026-03-05T09:00:00+08:00'
                  trackingNumber: '9f8e7d6c-5b4a-3210-fedc-ba9876543210'
                  authors:
                    - 'Hon. Macarthur A. Aguinaldo'
                    - 'Hon. Kichel Jomarie G. Pungtilan'
                  sponsors:
                    - 'Hon. Macarthur A. Aguinaldo'
                  committees:
                    - 'Committee on Transportation and Communication'
                    - 'Committee on Laws, Rules, Ethics & Privileges'
                  panlalawiganOutcome: 'valid'
                  panlalawiganOutcomeDate: '2026-03-01'
                  hasNewspaperPublication: true
                  newspaperPublicationDate: '2026-03-10'
                  firstPagePreview:
                    url: 'https://r2.batac.gov.ph/previews/a1b2c3d4-first-page.jpg?...'
                    expiresAt: '2026-06-15T08:15:00+08:00'
                    widthPx: 794
                    heightPx: 1123
                  documentRequestUrl: 'https://portal.batac.gov.ph/document-requests?ref=7SP+2026-02'
        '404':
          description: 'Document not found or not publicly accessible'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                statusCode: 404
                error: 'Not Found'
                message: 'Document not found or not yet available on the public portal.'
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '500':
          $ref: '#/components/responses/InternalServerError'

  # ---------------------------------------------------------------------------
  # Complaints
  # ---------------------------------------------------------------------------

  /public/complaints:
    post:
      operationId: 'submitComplaint'
      summary: 'Submit a citizen complaint'
      tags:
        - 'complaints'
      description: |
        Accepts a complaint addressed to the Sangguniang Panlungsod.

        Complaints may cover any LGU-related matter — not limited to
        transportation subjects. (Transportation violations are a common
        type but not the only type; consolidated reference Part 4.14.)

        Routing: the SP Secretariat decides routing after submission —
        to a committee directly, or to the Vice Mayor, depending on the
        nature of the complaint. There is no fixed routing rule. Routing
        is not reflected in the API response.

        Respondent notification: the Secretariat issues a formal written
        notice to the respondent. If the respondent has an email address,
        the notice is sent by email. If only a contact number is on file,
        the respondent must claim the written notice in person at the LGU
        (consolidated reference Part 4.14).

        Outcome states (consolidated reference Part 4.14):
        - pending_hearing: complaint received; routing in progress
        - received_seen: VM and/or committee has seen the complaint
        - dismissed: complaint dismissed by the committee
        - resolved: committee report issued; complainant notified; closed

        Access modes (consolidated reference Part 4.14):
        - digital_form: citizen fills this form online. The system generates
          a printable copy. The citizen must print, sign, and submit it
          physically to the Secretariat.
        - clerk_assisted: a Secretariat clerk fills the form on behalf of
          a citizen who appeared in person.
        Physical download-and-submit (mode 1) is handled entirely offline
        and does not use this endpoint.

        Rate limit: 20 requests per IP per hour (anti-spam).
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ComplaintSubmissionRequest'
            examples:
              transportation_overcharging:
                summary: 'Tricycle overcharging complaint'
                value:
                  violationType: 'overcharging'
                  tricycleNumber: 'BTC-1234'
                  incidentDate: '2026-06-10'
                  incidentTime: '14:30'
                  place: 'Public Market to Barangay 1, Batac City'
                  remarks: 'Driver charged PHP 50 for a route with a regulated fare of PHP 15.'
                  complainantName: 'Juan Dela Cruz'
                  complainantAddress: 'Barangay 5, Batac City, Ilocos Norte'
                  complainantContact: '09171234567'
                  complainantEmail: 'juan.delacruz@email.com'
                  respondentName: null
                  respondentContact: null
                  respondentEmail: null
                  accessMode: 'digital_form'
              general_lgu:
                summary: 'General LGU complaint'
                value:
                  violationType: 'other'
                  violationTypeOther: 'Commercial establishment operating past allowed hours, violating noise ordinance.'
                  tricycleNumber: null
                  incidentDate: '2026-06-12'
                  incidentTime: '22:15'
                  place: 'National Highway near SM City Laoag exit, Batac City'
                  remarks: 'Loud music audible 200 meters away. Happened on multiple nights.'
                  complainantName: 'Maria Santos'
                  complainantAddress: 'Barangay 10, Batac City, Ilocos Norte'
                  complainantContact: '09181234567'
                  complainantEmail: null
                  respondentName: 'XYZ Convenience Store'
                  respondentContact: null
                  respondentEmail: null
                  accessMode: 'digital_form'
      responses:
        '201':
          description: 'Complaint submitted successfully'
          headers:
            X-Request-ID:
              $ref: '#/components/headers/X-Request-ID'
            X-RateLimit-Limit:
              $ref: '#/components/headers/X-RateLimit-Limit'
            X-RateLimit-Remaining:
              $ref: '#/components/headers/X-RateLimit-Remaining'
            X-RateLimit-Reset:
              $ref: '#/components/headers/X-RateLimit-Reset'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ComplaintSubmissionResponse'
              example:
                data:
                  complaintId: 'c0ffee00-dead-beef-cafe-000000000001'
                  referenceCode: 'COMP-2026-0042'
                  submittedAt: '2026-06-15T09:30:00+08:00'
                  status: 'pending_hearing'
                  message: >
                    Your complaint has been received by the SP Secretariat
                    (reference: COMP-2026-0042). It will be reviewed and
                    routed to the appropriate committee. You will be notified
                    of the outcome via your contact number.
                  printableFormUrl: 'https://api.batac.gov.ph/v1/public/generated-forms/COMP-2026-0042.pdf?token=...'
        '400':
          description: 'Validation error — check the details array for per-field messages'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationErrorResponse'
              example:
                statusCode: 400
                error: 'Bad Request'
                message: 'Validation failed. See details for per-field errors.'
                details:
                  - field: 'incidentTime'
                    message: 'Must be in 24-hour HH:MM format (e.g. "14:30")'
                    code: 'invalid_string'
                  - field: 'violationTypeOther'
                    message: 'Required when violationType is "other"'
                    code: 'too_small'
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '500':
          $ref: '#/components/responses/InternalServerError'

  # ---------------------------------------------------------------------------
  # Document Requests
  # ---------------------------------------------------------------------------

  /public/document-requests:
    post:
      operationId: 'submitDocumentRequest'
      summary: 'Submit a Document and Records Request Form'
      tags:
        - 'document-requests'
      description: |
        Submits a request for a certified copy of an SP document. This is
        the digital entry point for the Document and Records Request Form.

        Fee structure: Secretary's Fees under Ordinance No. 3SP 2014-05.
        Per-page fee applies. Payment is collected in person at the
        Secretariat after approval. Payment processing via this API is
        deferred to a future phase (consolidated reference Part 4.15).

        Approval required: Vice Mayor AND SP Secretary must both sign
        before the copy is released. The requester is notified via their
        contact number (primary channel) when approved.

        Three access modes (consolidated reference Part 4.15):
        - digital_form: requester fills this form online. The system
          generates a printable copy. The requester must print, sign,
          and submit it physically to the Secretariat.
        - clerk_assisted: a Secretariat clerk fills the form on behalf
          of a requester who appeared in person.
        Physical download of the blank template from sp.batac.gov.ph
        (access mode 1) does not use this endpoint.

        Identity verification: the requester must present a valid
        government-issued ID when submitting the signed physical form.
        Accepted types: government employee ID, birth certificate,
        barangay residency certificate, any government-issued photo ID.

        Rate limit: 20 requests per IP per hour.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DocumentRequestSubmissionRequest'
            example:
              requesterName: 'Jose B. Reyes'
              requesterAgency: 'Department of Public Works and Highways — Ilocos Norte'
              requesterEmail: 'jreyes@dpwh.gov.ph'
              requesterPhone: '09191234567'
              documentType: 'SP_ORDINANCE'
              documentTitle: 'An Ordinance Adopting the Annual Investment Program for Fiscal Year 2026'
              documentNumber: '7SP 2026-03'
              numberOfPagesCopied: null
              purpose: 'Reference for ongoing road infrastructure planning in Batac City.'
              idType: 'Government Employee ID (DPWH)'
              accessMode: 'digital_form'
      responses:
        '201':
          description: 'Document request submitted successfully'
          headers:
            X-Request-ID:
              $ref: '#/components/headers/X-Request-ID'
            X-RateLimit-Limit:
              $ref: '#/components/headers/X-RateLimit-Limit'
            X-RateLimit-Remaining:
              $ref: '#/components/headers/X-RateLimit-Remaining'
            X-RateLimit-Reset:
              $ref: '#/components/headers/X-RateLimit-Reset'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DocumentRequestSubmissionResponse'
              example:
                data:
                  requestId: 'd0c1e2f3-a4b5-6789-cdef-012345678901'
                  referenceCode: 'DREQ-2026-0017'
                  submittedAt: '2026-06-15T10:00:00+08:00'
                  message: >
                    Your document request has been received (reference:
                    DREQ-2026-0017). It will be reviewed by the Vice Mayor
                    and SP Secretary. You will be contacted via phone when
                    your request is approved and ready for payment.
                  estimatedWorkingDays: 3
                  printableFormUrl: 'https://api.batac.gov.ph/v1/public/generated-forms/DREQ-2026-0017.pdf?token=...'
        '400':
          description: 'Validation error'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationErrorResponse'
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '500':
          $ref: '#/components/responses/InternalServerError'

# ─────────────────────────────────────────────────────────────────────────────
# COMPONENTS
# ─────────────────────────────────────────────────────────────────────────────

components:

  # ---------------------------------------------------------------------------
  # Parameters
  # ---------------------------------------------------------------------------

  parameters:

    trackingNumber:
      name: 'trackingNumber'
      in: 'path'
      required: true
      description: |
        The QR tracking UUID assigned by the system at secretariat logging.
        This is the value encoded in the QR code affixed to the physical
        document. It is completely independent of the preliminary and final
        series numbers and is immutable for the document's lifetime.
        Source: documents.documents.qr_tracking_number (C1 §4.5)
      schema:
        type: string
        format: uuid
        example: '550e8400-e29b-41d4-a716-446655440000'

    documentId:
      name: 'documentId'
      in: 'path'
      required: true
      description: |
        The UUID primary key of the document in the system
        (documents.documents.id). Not to be confused with the tracking
        number (qr_tracking_number) or the series number (final_number).
      schema:
        type: string
        format: uuid
        example: '7c9e6679-7425-40de-944b-e07fc1f90ae7'

  # ---------------------------------------------------------------------------
  # Response shortcuts
  # ---------------------------------------------------------------------------

  responses:

    TooManyRequests:
      description: 'Rate limit exceeded. Retry after the indicated duration.'
      headers:
        Retry-After:
          description: 'Seconds to wait before retrying'
          schema:
            type: integer
            example: 60
        X-RateLimit-Limit:
          $ref: '#/components/headers/X-RateLimit-Limit'
        X-RateLimit-Remaining:
          $ref: '#/components/headers/X-RateLimit-Remaining'
        X-RateLimit-Reset:
          $ref: '#/components/headers/X-RateLimit-Reset'
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            statusCode: 429
            error: 'Too Many Requests'
            message: 'Rate limit exceeded. Please wait before retrying.'

    InternalServerError:
      description: 'Unexpected server error. Logged to Sentry automatically.'
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            statusCode: 500
            error: 'Internal Server Error'
            message: 'An unexpected error occurred. Please try again later.'

  # ---------------------------------------------------------------------------
  # Headers
  # ---------------------------------------------------------------------------

  headers:

    X-Request-ID:
      description: |
        UUID generated per request. Include in support tickets for
        log correlation.
      schema:
        type: string
        format: uuid

    X-RateLimit-Limit:
      description: 'Maximum requests allowed in the current rate limit window'
      schema:
        type: integer

    X-RateLimit-Remaining:
      description: 'Requests remaining in the current rate limit window'
      schema:
        type: integer

    X-RateLimit-Reset:
      description: 'Unix timestamp (seconds) when the current rate limit window resets'
      schema:
        type: integer

  # ---------------------------------------------------------------------------
  # Security schemes
  # ---------------------------------------------------------------------------

  securitySchemes: {}
  # No authentication for Phase 1 public endpoints.
  # Phase 3 will add: citizenOtp (OTP-based phone + email verification for
  # citizen accounts). Internal staff API uses JWT bearer via tRPC;
  # not represented here.

  # ---------------------------------------------------------------------------
  # Schemas
  # ---------------------------------------------------------------------------

  schemas:

    # ──────────────────────────────────────────────────────────────────────────
    # Shared / primitive types
    # ──────────────────────────────────────────────────────────────────────────

    HealthResponse:
      type: object
      required:
        - status
        - version
        - timestamp
      properties:
        status:
          type: string
          enum:
            - 'ok'
            - 'degraded'
            - 'unavailable'
          description: |
            ok: all dependencies healthy.
            degraded: a non-critical dependency is unavailable; primary
              read operations continue.
            unavailable: PostgreSQL is unreachable; service cannot operate.
        version:
          type: string
          description: 'Deployed application version (semver)'
          example: '1.0.0'
        timestamp:
          type: string
          format: date-time
          description: 'Server time at response generation (Asia/Manila)'
          example: '2026-06-15T08:00:00+08:00'

    ErrorResponse:
      type: object
      required:
        - statusCode
        - error
        - message
      properties:
        statusCode:
          type: integer
          description: 'HTTP status code'
          example: 404
        error:
          type: string
          description: 'HTTP status reason phrase'
          example: 'Not Found'
        message:
          type: string
          description: 'Human-readable error description (locale-aware)'
          example: 'Document not found or not yet available on the public portal.'

    ValidationErrorResponse:
      allOf:
        - $ref: '#/components/schemas/ErrorResponse'
        - type: object
          properties:
            details:
              type: array
              description: 'Per-field validation error details from Zod parsing'
              items:
                type: object
                required:
                  - field
                  - message
                properties:
                  field:
                    type: string
                    description: |
                      Dot-notation path to the failing field
                      (e.g. "complainantEmail", "incidentTime").
                    example: 'incidentTime'
                  message:
                    type: string
                    description: 'Human-readable validation failure message'
                    example: 'Must be in 24-hour HH:MM format (e.g. "14:30")'
                  code:
                    type: string
                    description: 'Machine-readable Zod error code'
                    example: 'invalid_string'

    PaginationMeta:
      type: object
      required:
        - total
        - page
        - limit
        - totalPages
        - hasNextPage
        - hasPrevPage
      properties:
        total:
          type: integer
          description: 'Total number of items matching the query'
          minimum: 0
          example: 47
        page:
          type: integer
          description: 'Current page number (1-indexed)'
          minimum: 1
          example: 1
        limit:
          type: integer
          description: 'Items per page'
          minimum: 1
          maximum: 100
          example: 20
        totalPages:
          type: integer
          description: 'Total number of pages'
          minimum: 0
          example: 3
        hasNextPage:
          type: boolean
          example: true
        hasPrevPage:
          type: boolean
          example: false

    PresignedImageRef:
      type: object
      required:
        - url
        - expiresAt
      description: |
        A presigned S3-compatible URL for a first-page image.
        Default TTL: 15 minutes (configurable via PRESIGNED_URL_TTL_SECONDS).
        Clients must not cache beyond expiresAt.
      properties:
        url:
          type: string
          format: uri
          description: |
            Presigned URL for the first page JPEG image. Valid until expiresAt.
            Re-fetch the parent endpoint after expiry to obtain a fresh URL.
          example: 'https://r2.batac.gov.ph/previews/abc123-first-page.jpg?X-Amz-Expires=900&X-Amz-Signature=...'
        expiresAt:
          type: string
          format: date-time
          description: 'URL expiry timestamp (ISO 8601, Asia/Manila timezone)'
          example: '2026-06-15T08:15:00+08:00'
        widthPx:
          type: integer
          nullable: true
          description: 'Image width in pixels (available after first render)'
          example: 794
        heightPx:
          type: integer
          nullable: true
          description: 'Image height in pixels (available after first render)'
          example: 1123

    # ──────────────────────────────────────────────────────────────────────────
    # Tracking / QR lookup
    # ──────────────────────────────────────────────────────────────────────────

    RoutingHistoryEntry:
      type: object
      required:
        - timestamp
        - action
      properties:
        timestamp:
          type: string
          format: date-time
          description: 'When this routing step was recorded (Asia/Manila timezone)'
          example: '2026-03-04T09:15:00+08:00'
        action:
          type: string
          description: |
            Human-readable routing action label (locale-aware).
            Examples: "Received and logged by SP Secretariat",
            "First Reading — referred to Committee on Laws",
            "Committee Report submitted", "Second Reading — Approved",
            "Signed by Vice Mayor", "Transmitted to Mayor".
          example: 'Received and logged by SP Secretariat'
        fromOfficeName:
          type: string
          nullable: true
          description: |
            Office or party the document was received from.
            Null at the initial logging step.
          example: null
        toOfficeName:
          type: string
          nullable: true
          description: 'Office or party the document was routed to'
          example: 'SP Secretariat'
        actorDisplayName:
          type: string
          nullable: true
          description: |
            Display name of the person who performed the action.
            Null when the action was system-generated (e.g. a lapse timer
            firing) or when disclosure is restricted by classification level.
          example: 'Mia Prima M. Mesina'

    TrackingLookupData:
      type: object
      required:
        - trackingNumber
        - documentId
        - documentType
        - documentTypeName
        - title
        - lifecycleStatus
        - routingHistory
        - firstPagePreview
        - documentRequestUrl
      properties:
        trackingNumber:
          type: string
          format: uuid
          description: 'The QR tracking UUID (matches the request path parameter)'
          example: '550e8400-e29b-41d4-a716-446655440000'
        documentId:
          type: string
          format: uuid
          description: 'Primary key of the document record (documents.documents.id)'
          example: '7c9e6679-7425-40de-944b-e07fc1f90ae7'
        documentType:
          type: string
          description: 'Document type code (documents.document_types.code)'
          example: 'SP_RESOLUTION'
        documentTypeName:
          type: string
          description: 'Human-readable document type label (locale-aware)'
          example: 'SP Resolution'
        title:
          type: string
          description: 'Full document title'
          example: 'A Resolution Authorizing the City Mayor to Enter Into a Memorandum of Agreement With MMSU'
        preliminaryNumber:
          type: string
          nullable: true
          description: |
            Preliminary "Draft" series number (e.g. "Draft 7SP 2026-02").
            Present only while the document is in the preliminary stage,
            before the final number is assigned.
            Null after the final number is assigned.
            Null for document types with no series numbering
            (e.g. CITIZEN_COMPLAINT, DOCUMENT_REQUEST_FORM).
          example: null
        finalNumber:
          type: string
          nullable: true
          description: |
            Final series number assigned after the last reading vote
            (e.g. "7SP 2026-01"). Immutable once assigned.
            Null before final number assignment.
          example: '7SP 2026-04'
        lifecycleStatus:
          type: string
          description: |
            Human-readable display label for the document's current
            lifecycle state (locale-aware). Not an enum — the label is
            derived from both the lifecycle_state and the current workflow
            step for richer display (e.g. "With Mayor — Pending Signature"
            rather than the raw "in_workflow").
          example: 'With Mayor — Pending Signature'
        remarks:
          type: string
          nullable: true
          description: 'Freetext remarks from the SP Secretariat, if any'
        routingHistory:
          type: array
          description: |
            Full routing history from draft to the current step, ordered
            chronologically (earliest first). The initial entry is always
            the secretariat logging event. The QR tracking UUID is present
            in every entry because it is assigned at logging time.
          items:
            $ref: '#/components/schemas/RoutingHistoryEntry'
        firstPagePreview:
          $ref: '#/components/schemas/PresignedImageRef'
        documentRequestUrl:
          type: string
          format: uri
          description: |
            URL to the Document Request Form page on the public portal,
            with the document reference pre-populated. Clicking this
            link initiates the copy request process.
          example: 'https://portal.batac.gov.ph/document-requests?ref=7SP+2026-04'

    TrackingLookupResponse:
      type: object
      required:
        - data
      properties:
        data:
          $ref: '#/components/schemas/TrackingLookupData'

    # ──────────────────────────────────────────────────────────────────────────
    # Published documents
    # ──────────────────────────────────────────────────────────────────────────

    PublishedDocumentType:
      type: string
      enum:
        - 'SP_RESOLUTION'
        - 'SP_ORDINANCE'
        - 'APPROPRIATION_ORDINANCE'
      description: |
        Phase 1 public document types. Document types that are not publicly
        listed (CITIZEN_COMPLAINT, DOCUMENT_REQUEST_FORM, CERTIFICATION_OF_URGENCY,
        TRANSMITTAL_LETTER) are never returned by public document endpoints.

    PanlalawiganOutcome:
      type: string
      nullable: true
      enum:
        - 'valid'
        - 'valid_in_part'
        - 'returned'
        - 'operative_in_its_entirety'
        - 'deemed_approved'
        - null
      description: |
        Outcome of the Sangguniang Panlalawigan 30-day review.
        Null if the review has not yet concluded.
        operative_in_its_entirety applies specifically to Appropriation
        Ordinances; it is synonymous with "valid/implementable" for that type.
        deemed_approved: 30 days elapsed with no Panlalawigan action per
          RA 7160 Section 56(d).
        Source: documents.panlalawigan_outcome_enum (C1 §4.2)

    PublishedDocumentSummary:
      type: object
      required:
        - documentId
        - documentType
        - documentTypeName
        - title
        - finalNumber
        - approvedAt
        - releasedAt
        - trackingNumber
        - firstPagePreview
        - documentRequestUrl
      properties:
        documentId:
          type: string
          format: uuid
          description: 'Primary key of the document record'
          example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
        documentType:
          $ref: '#/components/schemas/PublishedDocumentType'
        documentTypeName:
          type: string
          description: 'Human-readable document type label (locale-aware)'
          example: 'SP Ordinance'
        title:
          type: string
          description: 'Full document title'
          example: 'An Ordinance Regulating the Operation of Tricycles-for-Hire in Batac City'
        finalNumber:
          type: string
          description: |
            Final series number (e.g. "7SP 2026-02"). Space-delimited
            format confirmed in consolidated reference Part 5.1.
          example: '7SP 2026-02'
        approvedAt:
          type: string
          format: date
          description: |
            Date of the last reading vote (Second Reading for Resolutions;
            Third Reading for Ordinances). This is when the final number
            was assigned.
          example: '2026-02-18'
        releasedAt:
          type: string
          format: date-time
          description: |
            Timestamp when the document was released to the public portal
            (lifecycle_state transition to "released").
          example: '2026-03-05T09:00:00+08:00'
        trackingNumber:
          type: string
          format: uuid
          description: 'QR tracking UUID for this document'
          example: '9f8e7d6c-5b4a-3210-fedc-ba9876543210'
        firstPagePreview:
          $ref: '#/components/schemas/PresignedImageRef'
        documentRequestUrl:
          type: string
          format: uri
          description: 'URL to request a full copy via Document Request Form'
          example: 'https://portal.batac.gov.ph/document-requests?ref=7SP+2026-02'

    PublishedDocumentDetail:
      allOf:
        - $ref: '#/components/schemas/PublishedDocumentSummary'
        - type: object
          properties:
            authors:
              type: array
              description: |
                Full names of councilors and Vice Mayor who authored or
                co-authored the measure, as recorded in the document title
                and Index of Ordinances.
              items:
                type: string
              example:
                - 'Hon. Macarthur A. Aguinaldo'
                - 'Hon. Kichel Jomarie G. Pungtilan'
            sponsors:
              type: array
              description: |
                Formal sponsors of the measure. Only councilors can sponsor;
                the Vice Mayor is included/mentioned after the title but is
                not a sponsor in the technical sense (consolidated reference
                Part 4.1).
              items:
                type: string
              example:
                - 'Hon. Macarthur A. Aguinaldo'
            committees:
              type: array
              description: |
                Names of standing committees that reviewed the measure via
                a joint hearing. Standard practice: subject-matter committee
                plus Committee on Laws, Rules, Ethics & Privileges
                (consolidated reference Part 8.1).
              items:
                type: string
              example:
                - 'Committee on Transportation and Communication'
                - 'Committee on Laws, Rules, Ethics & Privileges'
            panlalawiganOutcome:
              $ref: '#/components/schemas/PanlalawiganOutcome'
            panlalawiganOutcomeDate:
              type: string
              format: date
              nullable: true
              description: |
                Date of Panlalawigan action, or the lapse date for
                deemed_approved outcomes (30 days from transmission date).
                Null if outcome is still pending.
              example: '2026-03-01'
            hasNewspaperPublication:
              type: boolean
              description: |
                True if this ordinance includes a penalty provision and has
                been published in a newspaper of general circulation (Ilocos
                Times). Always false for SP Resolutions and Appropriation
                Ordinances. Per consolidated reference Part 4.2, SP Secretariat
                arranges publication; date is a mandatory tracked field.
              example: true
            newspaperPublicationDate:
              type: string
              format: date
              nullable: true
              description: |
                Date of newspaper publication, if applicable.
                Null for documents that do not require publication.
              example: '2026-03-10'

    PublishedDocumentListResponse:
      type: object
      required:
        - data
        - meta
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/PublishedDocumentSummary'
        meta:
          $ref: '#/components/schemas/PaginationMeta'

    PublishedDocumentDetailResponse:
      type: object
      required:
        - data
      properties:
        data:
          $ref: '#/components/schemas/PublishedDocumentDetail'

    # ──────────────────────────────────────────────────────────────────────────
    # Citizen complaints
    # ──────────────────────────────────────────────────────────────────────────

    ComplaintViolationType:
      type: string
      enum:
        - 'overcharging'
        - 'trip_cutting'
        - 'refused_to_convey'
        - 'discourtesy'
        - 'other'
      description: |
        Violation type code. Maps to the standard SP Secretariat complaint
        form categories (consolidated reference Part 4.14). Transportation
        types are explicitly enumerated; any other LGU-related complaint
        uses 'other' with a description in violationTypeOther.

    ComplaintAccessMode:
      type: string
      enum:
        - 'digital_form'
        - 'clerk_assisted'
      description: |
        How the complaint form was completed:
        digital_form — citizen filled the form online via the public portal.
          System generates a printable copy; citizen must print, sign, and
          submit physically to the Secretariat.
        clerk_assisted — Secretariat staff filled the form on behalf of a
          citizen present in person. Physical signing happens on-site.
        Access mode 1 (download blank template, fill manually, submit) does
        not use this endpoint.

    ComplaintSubmissionRequest:
      type: object
      required:
        - violationType
        - incidentDate
        - incidentTime
        - place
        - complainantName
        - complainantAddress
        - complainantContact
        - accessMode
      properties:
        violationType:
          $ref: '#/components/schemas/ComplaintViolationType'
        violationTypeOther:
          type: string
          maxLength: 500
          nullable: true
          description: |
            Required when violationType is 'other'. Free-text description
            of the complaint subject.
          example: 'Noise ordinance violation by commercial establishment'
        tricycleNumber:
          type: string
          maxLength: 50
          nullable: true
          description: |
            Tricycle or vehicle body/plate number, if applicable to
            a transportation complaint.
          example: 'BTC-1234'
        incidentDate:
          type: string
          format: date
          description: 'Date the incident or violation occurred (ISO 8601 date)'
          example: '2026-06-10'
        incidentTime:
          type: string
          pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          description: 'Time of the incident in 24-hour HH:MM format'
          example: '14:30'
        place:
          type: string
          maxLength: 500
          description: 'Location where the incident occurred'
          example: 'Public Market to Barangay 1, Batac City'
        remarks:
          type: string
          maxLength: 2000
          nullable: true
          description: 'Additional context or details about the incident'
        complainantName:
          type: string
          maxLength: 200
          description: 'Full name of the complainant'
          example: 'Juan Dela Cruz'
        complainantAddress:
          type: string
          maxLength: 500
          description: 'Complete mailing address of the complainant'
          example: 'Barangay 5, Batac City, Ilocos Norte'
        complainantContact:
          type: string
          maxLength: 50
          description: 'Primary contact number of the complainant'
          example: '09171234567'
        complainantEmail:
          type: string
          format: email
          maxLength: 254
          nullable: true
          description: |
            Email address of the complainant. If provided, notifications
            are sent here in addition to via contact number.
          example: 'juan.delacruz@email.com'
        respondentName:
          type: string
          maxLength: 200
          nullable: true
          description: |
            Name of the person or establishment being complained against,
            if known at time of submission.
        respondentContact:
          type: string
          maxLength: 50
          nullable: true
          description: 'Contact number of the respondent, if known'
        respondentEmail:
          type: string
          format: email
          maxLength: 254
          nullable: true
          description: |
            Email address of the respondent, if known. If provided, the
            Secretariat will send the formal written notice by email rather
            than requiring the respondent to claim it in person
            (consolidated reference Part 4.14).
        accessMode:
          $ref: '#/components/schemas/ComplaintAccessMode'

    ComplaintSubmissionResult:
      type: object
      required:
        - complaintId
        - referenceCode
        - submittedAt
        - status
        - message
      properties:
        complaintId:
          type: string
          format: uuid
          description: |
            Internal system UUID of the complaint record.
            Use with Secretariat staff for precise record lookups.
          example: 'c0ffee00-dead-beef-cafe-000000000001'
        referenceCode:
          type: string
          description: |
            Human-readable reference code for in-person or phone follow-up.
            Format: COMP-{YYYY}-{NNNN} (zero-padded to 4 digits).
          example: 'COMP-2026-0042'
        submittedAt:
          type: string
          format: date-time
          description: 'Timestamp of submission (Asia/Manila timezone)'
          example: '2026-06-15T09:30:00+08:00'
        status:
          type: string
          enum:
            - 'pending_hearing'
          description: |
            Initial status is always pending_hearing. Subsequent transitions
            (received_seen → dismissed or resolved) are not surfaced via
            this public API in Phase 1.
        message:
          type: string
          description: |
            Confirmation message with next-step instructions
            (locale-aware).
          example: >
            Your complaint has been received by the SP Secretariat
            (reference: COMP-2026-0042). It will be reviewed and routed
            to the appropriate committee. You will be notified of the
            outcome via your contact number.
        printableFormUrl:
          type: string
          format: uri
          nullable: true
          description: |
            Present when accessMode is 'digital_form'. Presigned URL to
            download the system-generated printable complaint form
            pre-populated with the submitted data. The complainant must
            print this, sign it, and submit the physical copy to the
            Secretariat. Valid for 24 hours.
          example: 'https://api.batac.gov.ph/v1/public/generated-forms/COMP-2026-0042.pdf?token=...'

    ComplaintSubmissionResponse:
      type: object
      required:
        - data
      properties:
        data:
          $ref: '#/components/schemas/ComplaintSubmissionResult'

    # ──────────────────────────────────────────────────────────────────────────
    # Document and Records Request Form
    # ──────────────────────────────────────────────────────────────────────────

    DocumentRequestAccessMode:
      type: string
      enum:
        - 'digital_form'
        - 'clerk_assisted'
      description: |
        How the document request form was completed:
        digital_form — requester filled the form online via the public portal.
          System generates a printable copy; requester must print, sign, and
          submit physically to the Secretariat.
        clerk_assisted — Secretariat staff filled the form on behalf of a
          requester present in person. Physical signing happens on-site.

    DocumentRequestSubmissionRequest:
      type: object
      required:
        - requesterName
        - requesterEmail
        - documentType
        - documentTitle
        - purpose
        - idType
        - accessMode
      properties:
        requesterName:
          type: string
          maxLength: 200
          description: 'Full name of the requester'
          example: 'Jose B. Reyes'
        requesterAgency:
          type: string
          maxLength: 300
          nullable: true
          description: |
            Agency, department, or organization of the requester,
            if applicable.
          example: 'Department of Public Works and Highways — Ilocos Norte'
        requesterEmail:
          type: string
          format: email
          maxLength: 254
          description: |
            Email address for notifications. After approval, the requester
            is notified via contact number (primary channel). Email is
            supplementary (consolidated reference Part 4.15).
          example: 'jreyes@dpwh.gov.ph'
        requesterPhone:
          type: string
          maxLength: 50
          nullable: true
          description: |
            Primary contact number for approval notification.
            After approval, the requester is contacted here before the
            copy is released.
          example: '09191234567'
        documentType:
          $ref: '#/components/schemas/PublishedDocumentType'
        documentTitle:
          type: string
          maxLength: 1000
          description: |
            Full title of the document being requested, as printed on the
            physical document or as shown on the public portal.
          example: 'An Ordinance Adopting the Annual Investment Program for Fiscal Year 2026'
        documentNumber:
          type: string
          maxLength: 50
          nullable: true
          description: |
            Series number of the document (e.g. "7SP 2026-03"). Provide
            if known. The Secretariat will verify this on processing.
            May be null if the requester does not know the exact number.
          example: '7SP 2026-03'
        numberOfPagesCopied:
          type: integer
          minimum: 1
          nullable: true
          description: |
            Number of pages to be copied. Affects the fee calculation
            under Ordinance No. 3SP 2014-05. If null, the Secretariat
            will fill this in during processing.
        purpose:
          type: string
          maxLength: 1000
          description: 'Stated purpose for requesting the certified copy'
          example: 'Reference for ongoing road infrastructure planning in Batac City.'
        idType:
          type: string
          maxLength: 100
          description: |
            Type of government-issued identification that will be presented
            by the requester when submitting the signed physical form.
            Accepted: Government employee ID, birth certificate, barangay
            residency certificate, or any government-issued photo ID.
          example: 'Government Employee ID (DPWH)'
        accessMode:
          $ref: '#/components/schemas/DocumentRequestAccessMode'

    DocumentRequestSubmissionResult:
      type: object
      required:
        - requestId
        - referenceCode
        - submittedAt
        - message
      properties:
        requestId:
          type: string
          format: uuid
          description: 'Internal system UUID of the document request record'
          example: 'd0c1e2f3-a4b5-6789-cdef-012345678901'
        referenceCode:
          type: string
          description: |
            Human-readable reference code for follow-up.
            Format: DREQ-{YYYY}-{NNNN} (zero-padded to 4 digits).
          example: 'DREQ-2026-0017'
        submittedAt:
          type: string
          format: date-time
          description: 'Timestamp of submission (Asia/Manila timezone)'
          example: '2026-06-15T10:00:00+08:00'
        message:
          type: string
          description: 'Confirmation message with next-step instructions (locale-aware)'
          example: >
            Your document request has been received (reference: DREQ-2026-0017).
            It will be reviewed by the Vice Mayor and SP Secretary. You will be
            contacted via phone when your request is approved and ready for payment.
        estimatedWorkingDays:
          type: integer
          nullable: true
          description: |
            Estimated processing time in working days, based on RA 11032
            (ARTA) default SLA thresholds. Simple transactions: ≤3 working
            days. Actual processing may vary; this is an informational
            estimate only.
          example: 3
        printableFormUrl:
          type: string
          format: uri
          nullable: true
          description: |
            Present when accessMode is 'digital_form'. Presigned URL to
            download the system-generated printable Document Request Form
            pre-populated with the submitted data. The requester must print,
            sign, and submit the physical copy to the Secretariat. Valid 24 hours.
          example: 'https://api.batac.gov.ph/v1/public/generated-forms/DREQ-2026-0017.pdf?token=...'

    DocumentRequestSubmissionResponse:
      type: object
      required:
        - data
      properties:
        data:
          $ref: '#/components/schemas/DocumentRequestSubmissionResult'
```

---

## @fastify/swagger Integration

### Plugin Registration

Register `@fastify/swagger` and `@fastify/swagger-ui` in `/apps/server/src/plugins/openapi.ts`. The registration below uses the OpenAPI 3.x configuration matching the spec above.

```typescript
// /apps/server/src/plugins/openapi.ts
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export default fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Batac City LGU Platform — Public REST API',
        version: '1.0.0',
      },
      servers: [
        { url: process.env.API_BASE_URL ?? 'http://localhost:3000/v1' },
      ],
      tags: [
        { name: 'health' },
        { name: 'tracking' },
        { name: 'documents' },
        { name: 'complaints' },
        { name: 'document-requests' },
      ],
      components: {
        securitySchemes: {},
      },
    },
    // The Zod type provider handles schema serialization.
    // Do not set transform here; use fastify-type-provider-zod instead.
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/v1/docs',
    // Only expose Swagger UI in non-production environments.
    uiConfig: { docExpansion: 'list' },
  });
});
```

### Route Schema Definition Pattern

Each route must declare its `schema` using Zod schemas imported from `/packages/shared`. The `fastify-type-provider-zod` type provider translates these to JSON Schema for Fastify's own validation layer and passes the JSON Schema representation to `@fastify/swagger` for spec generation.

```typescript
// /apps/server/src/modules/tracking/routes/public-lookup.ts
import { z } from 'zod';
import {
  TrackingLookupResponseSchema,
  ErrorResponseSchema,
} from '@batac-lgu/shared';

export default async function publicLookupRoute(fastify: FastifyInstance) {
  fastify.get(
    '/public/tracking/:trackingNumber',
    {
      schema: {
        tags: ['tracking'],
        summary: 'Document status lookup by QR tracking number',
        params: z.object({
          trackingNumber: z.string().uuid(),
        }),
        response: {
          200: TrackingLookupResponseSchema,
          404: ErrorResponseSchema,
          429: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // handler implementation
    }
  );
}
```

### Zod Type Provider Setup

The server entry point must configure Fastify to use the Zod type provider:

```typescript
// /apps/server/src/app.ts
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';

const app = Fastify({ logger: true })
  .withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

### Shared Package Schema Location

All request/response Zod schemas referenced by this spec live in `/packages/shared/src/schemas/`. The file structure should mirror the endpoint hierarchy:

```
/packages/shared/src/schemas/
  public/
    tracking.ts         — TrackingLookupResponseSchema, RoutingHistoryEntrySchema
    documents.ts        — PublishedDocumentSummarySchema, PublishedDocumentDetailSchema,
                          PublishedDocumentListResponseSchema
    complaints.ts       — ComplaintSubmissionRequestSchema, ComplaintSubmissionResponseSchema
    document-requests.ts — DocumentRequestSubmissionRequestSchema, DocumentRequestSubmissionResponseSchema
  common/
    pagination.ts       — PaginationMetaSchema
    errors.ts           — ErrorResponseSchema, ValidationErrorResponseSchema
    presigned-image.ts  — PresignedImageRefSchema
    health.ts           — HealthResponseSchema
```

### Schema Synchronization Rule

**This document is the contract; the Zod schemas are the implementation.** They must match exactly. Any field added to or removed from a Zod schema in `/packages/shared` that affects a public endpoint must be reflected in a corresponding update to this document in the same PR.

A contract test using `openapi-typescript` or a similar tool should validate the auto-generated spec against this document on every CI run. Divergences are build failures.

---

## Rate Limiting Configuration

`@fastify/rate-limit` configuration for Phase 1 public endpoints. All limits are per-IP. Key name is the IP address (or `X-Forwarded-For` first hop, trusted from the Nginx/Caddy proxy).

| Endpoint | Method | Limit | Window | Rationale |
|---|---|---|---|---|
| `/v1/health` | GET | No limit | — | Load balancer health checks must never be blocked |
| `/v1/public/tracking/{trackingNumber}` | GET | 120 req | 1 min | QR scanning is interactive; generous limit for legitimate use |
| `/v1/public/documents` | GET | 120 req | 1 min | Public browsing; generous limit |
| `/v1/public/documents/{documentId}` | GET | 120 req | 1 min | Same as above |
| `/v1/public/complaints` | POST | 20 req | 1 hour | Anti-spam; a human submitting complaints would rarely need more |
| `/v1/public/document-requests` | POST | 20 req | 1 hour | Same rationale |

All rate-limited endpoints return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on every response, and `Retry-After` when the limit is exceeded (HTTP 429).

Rate limit configuration values are managed via environment variables (`RATE_LIMIT_TRACKING_MAX`, `RATE_LIMIT_SUBMISSION_MAX`, etc.) per the env catalog (L1), not hardcoded.

---

## CORS Configuration

`@fastify/cors` is configured with a strict origin allowlist. The initial production allowlist is in `CORS_ALLOWED_ORIGINS` (env catalog L1). Phase 1 allowlist:

| Origin | Reason |
|---|---|
| `https://sp.batac.gov.ph` | Existing SP website (subscription renewed; coexists with new platform) |
| `https://portal.batac.gov.ph` | Phase 3 citizen portal (pre-registered for DNS readiness) |

`credentials: false` — Phase 1 public endpoints are unauthenticated; no cookies are sent or received. Set `credentials: true` only when citizen auth (Phase 3) is introduced.

Allowed methods: `GET, POST, OPTIONS`. Phase 1 public endpoints use only GET and POST.

Preflight cache (`Access-Control-Max-Age`): 600 seconds (10 minutes).

---

## Change Management

### Adding a New Public Endpoint

1. Update this document: add the path to the OpenAPI spec YAML, add the endpoint to the Phase 1 Endpoint Summary table, update the Cross-Schema Reference Index in C1 if the new endpoint reads from a new schema.
2. Add the corresponding Zod schemas to `/packages/shared/src/schemas/public/`.
3. Implement the route and handler. The PR description must reference the E2 section being implemented.
4. Contract tests must pass: the auto-generated spec from `@fastify/swagger` must match the spec in this document.

### Breaking Changes

A breaking change to an existing endpoint (field removal, type change, required field addition, enum value removal) requires:

1. A minimum 30-day deprecation notice in this document before the breaking change is applied.
2. A version increment (`/v2/` path prefix) if the old endpoint must continue to work during the transition.
3. An ADR documenting the reason for the breaking change and the migration path.

### Non-Breaking Additions

New optional response fields, new optional query parameters, new enum values, and new endpoints may be added without a version increment. They must still be documented here in the same PR.

### Phase Addendum Process

When Phase 1B, 2, or 3 introduces new public REST endpoints, a dated addendum section is appended to the OpenAPI spec YAML at the bottom of the `paths` block. The addendum identifies its phase and date. The components section is extended in place (no addendum; just new schemas). The info.version is incremented by a minor version (e.g. 1.0.0 → 1.1.0) when a new phase's endpoints are added.

---

_This document is the pre-development contract for all Phase 1 public REST endpoints. The YAML spec above is the target state that `@fastify/swagger` must reproduce at runtime. Any deviation from this contract discovered during implementation must be resolved in the implementation, not in this document, unless the source requirements themselves have changed._
