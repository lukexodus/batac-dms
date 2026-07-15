# Error Handling and Response Normalization Strategy — Pre-dev

**Project:** Batac City LGU Platform  
**Status:** Pre-development baseline  
**Scope:** `/apps/server` (Fastify + tRPC + REST), `/apps/web` (Vite + React), `/packages/shared`  
**Audience:** Development team (internal reference)

## Table of Contents

- [L40–L56] 1. Purpose and Scope — Scope of platform error handling and response serialization across server, web, and shared packages.
- [L57–L99] 2. Error Architecture Overview — Flow diagram of error propagation, request-specific traceId generation format, and Sentry operational policy.
- [L100–L285] 3. Standard tRPC Error Shape — Format and client consumption patterns for tRPC error payloads.
  - [L102–L138] 3.1 Wire Format — JSON payload shape for tRPC responses containing trace identifiers, validation states, and domain details.
  - [L139–L162] 3.2 tRPC Error Code → HTTP Status Mapping — Table defining tRPC-to-HTTP code translations and rules for throwing appropriate status-mapped conflict errors.
  - [L163–L210] 3.3 Custom tRPC Error Formatter — Server-side error formatter implementation in init.ts mapping internal errors to the unified tRPC schema.
  - [L211–L285] 3.4 Frontend Consumption Pattern — Client-side error narrowing helpers, type-safe schema guards, and component-level mutation handling patterns.
- [L286–L444] 4. Standard REST Error Shape — Format and routing middleware for REST error payloads.
  - [L290–L329] 4.1 Wire Format — JSON envelope requirements for REST responses containing validation details and HTTP status constraints.
  - [L330–L444] 4.2 Fastify Error Handler — Global Fastify error handler configuration wrapping Zod validations, custom domain exceptions, and Sentry triggers.
- [L445–L556] 5. Zod Validation Error Serialization — Serialization and binding protocols for schema validation errors.
  - [L447–L482] 5.1 In tRPC Procedures (Input Validation) — Payload shape for tRPC parser failures using flattened schema field and form error structures.
  - [L483–L507] 5.2 In REST Routes (fastify-type-provider-zod) — REST validation error normalization using Fastify type provider to align wire formats with tRPC.
  - [L508–L556] 5.3 Frontend Form Binding — Helper function mapping backend Zod validation failures back to React Hook Form inline field errors.
- [L557–L895] 6. Domain Error Design — Core domain error architecture and specific code registries.
  - [L559–L646] 6.1 AppError Base Class — Server-side AppError base class definition and module-specific concrete error subclass implementations.
  - [L647–L734] 6.2 Domain Error Code Registry — Complete catalog of Phase 1 domain errors, trigger conditions, HTTP status codes, and Sentry behaviors.
  - [L735–L774] 6.3 Domain Error Propagation in tRPC Procedures — Guidelines and code patterns for wrapping custom domain exceptions inside standard tRPC TRPCErrors.
  - [L775–L802] 6.4 Domain Error Propagation in REST Routes — Guidelines for throwing domain exceptions directly inside REST routes to trigger Fastify handler serialization.
  - [L803–L895] 6.5 Domain Error Detail Types — Client-safe Zod validation schemas and runtime parsing helpers for typed domain error payload details.
- [L896–L1131] 7. Sentry Integration — Configuration, triggers, and privacy compliance rules for Sentry.
  - [L898–L922] 7.1 Sentry Initialization — Global Sentry setup configuration, sample rates, and integration hook points for request logging.
  - [L923–L1070] 7.2 Integration Points — Middleware and service hooks for capturing unhandled exceptions, security anomalies, and telemetry tags.
  - [L1071–L1116] 7.3 PII Scrubbing Rules (RA 10173 Compliance) — Compliance rules and scrubbing denylists protecting citizen data from leaking to third-party monitoring.
  - [L1117–L1131] 7.4 Sentry Severity Reference — Severity mapping table designating capture levels for specific system events and infrastructure exceptions.
- [L1132–L1210] 8. Frontend Error Handling Boundaries — Global TanStack Query error interception, local UI fallback decisions, and rendering error boundary setups.
- [L1211–L1234] Appendix: Domain Error Quick Reference — Reference table listing Phase 1 domain error codes, HTTP statuses, module mappings, and Sentry capture rules.

---

## 1. Purpose and Scope

This document defines how errors are classified, shaped, serialized, and surfaced across the entire stack before a single line of application code is written. Its goal is to make error handling a **decided concern** rather than an emergent one.

Coverage:

- Wire shapes for tRPC and REST error responses
- tRPC error code → HTTP status mapping table
- How Zod validation errors are serialized through both APIs
- Domain error type hierarchy and the full domain error code registry for this platform
- How domain errors propagate from the server to the frontend with full type safety
- Sentry integration points: which errors are captured, what context is attached, and PII scrubbing constraints under RA 10173

Not in scope here: frontend toast/dialog/form-field display patterns beyond the decision rules in section 8, logging aggregation pipeline, monitoring alert rule configuration.

---

## 2. Error Architecture Overview

Errors originate at three layers and flow upward:

```
Database / External Service
        │
        ▼
Domain / Service Layer ────────────────▶ AppError subtypes (typed, with context)
        │
        ▼
tRPC Procedure / REST Route Handler
        │
        ├─▶ TRPCError (wraps AppError) ──▶ tRPC wire format
        │
        └─▶ Fastify error handler ────────▶ REST wire format
        │
        ▼
Client (TanStack Query / fetch)
        │
        ▼
Frontend domain error narrowing (type-narrowed from /packages/shared)
```

Two invariants hold across both tRPC and REST:

1. Every error response includes a `traceId`. This is the Fastify request ID (`req.id`), configured to use a short unique string format (e.g., `req_01hwqxnk4pfj`) rather than the default incrementing integer. It is the handle for any user-reported error.
2. All unhandled exceptions are captured by Sentry before the response leaves the server. Expected domain errors are **never** sent to Sentry — they are operational events, not bugs.

`traceId` generation is configured once in the Fastify factory:

```typescript
// /apps/server/src/server.ts
import { nanoid } from 'nanoid';

const fastify = Fastify({
  genReqId: () => `req_${nanoid(12)}`,
  logger: pino({ ... }), // Pino logs req.id on every message automatically
});
```

---

## 3. Standard tRPC Error Shape

### 3.1 Wire Format

tRPC v11 uses the `@trpc/server/adapters/fastify` adapter. The JSON envelope on error:

```json
{
  "error": {
    "json": {
      "message": "A document with control number SPR 2026-42 already exists.",
      "code": -32600,
      "data": {
        "code": "CONFLICT",
        "httpStatus": 409,
        "path": "documents.assignControlNumber",
        "traceId": "req_01hwqxnk4pfj",
        "domainError": {
          "code": "DUPLICATE_CONTROL_NUMBER",
          "details": {
            "series": "SPR",
            "year": 2026,
            "number": 42,
            "existingDocumentId": "018f4c72-..."
          }
        },
        "zodError": null
      }
    }
  }
}
```

The top-level `code` is the JSON-RPC numeric error code (set by tRPC automatically from the human-readable tRPC error code). Both are always present.

`stack` is included only in development (`NODE_ENV !== 'production'`) and stripped by the error formatter before the response is sent in production.

`domainError` is `null` when the error is not a recognized domain error (e.g., it is a Zod validation error or an unhandled exception). `zodError` is `null` unless the error originates from a Zod input validation failure.

### 3.2 tRPC Error Code → HTTP Status Mapping

| tRPC Code               | JSON-RPC Code | HTTP Status | When Used on This Platform                                                                          |
| ----------------------- | ------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `PARSE_ERROR`           | -32700        | 400         | tRPC input schema validation failed (Zod)                                                           |
| `BAD_REQUEST`           | -32600        | 400         | Invalid request not caused by schema type issues                                                    |
| `UNAUTHORIZED`          | -32001        | 401         | No valid session / JWT expired or absent                                                            |
| `FORBIDDEN`             | -32003        | 403         | Authenticated but ABAC policy denied; step not assigned to caller                                   |
| `NOT_FOUND`             | -32004        | 404         | Entity does not exist or is not visible to this actor (RLS / ABAC)                                  |
| `METHOD_NOT_SUPPORTED`  | -32005        | 405         | Procedure called with wrong HTTP method                                                             |
| `TIMEOUT`               | -32008        | 408         | Procedure timed out (e.g., long-running OCR job)                                                    |
| `CONFLICT`              | -32009        | 409         | Domain invariant conflict: duplicate number, locked document, active designation, etc.              |
| `PRECONDITION_FAILED`   | -32012        | 412         | A required prior condition is not met (e.g., missing Certification of Urgency)                      |
| `PAYLOAD_TOO_LARGE`     | -32013        | 413         | File upload exceeds the 25 MB per-file limit                                                        |
| `UNPROCESSABLE_CONTENT` | -32022        | 422         | Semantically invalid input that passes schema validation (invalid state transition, quorum not met) |
| `TOO_MANY_REQUESTS`     | -32029        | 429         | Rate limit exceeded (`@fastify/rate-limit`)                                                         |
| `CLIENT_CLOSED_REQUEST` | -32099        | 499         | Client disconnected before response was sent                                                        |
| `INTERNAL_SERVER_ERROR` | -32603        | 500         | Unhandled exception; audit chain corruption                                                         |
| `NOT_IMPLEMENTED`       | -32604        | 501         | Feature not yet implemented in current phase                                                        |
| `BAD_GATEWAY`           | -32014        | 502         | Upstream dependency failure (S3-compatible storage, OCR service)                                    |
| `SERVICE_UNAVAILABLE`   | -32022        | 503         | Application in maintenance or degraded mode                                                         |

**Rule:** tRPC error code selection is the responsibility of the procedure, not the error formatter. The formatter transforms the shape; it does not reclassify errors. When throwing a `TRPCError`, always select the most semantically correct code from the table above. Do not default to `INTERNAL_SERVER_ERROR` for domain errors.

### 3.3 Custom tRPC Error Formatter

Defined in `/apps/server/src/trpc/init.ts`. This is the single location where the tRPC error shape is customized. It runs on every error before the response is serialized.

```typescript
// /apps/server/src/trpc/init.ts

import { initTRPC } from '@trpc/server';
import { ZodError } from 'zod';
import type { Context } from './context';
import { AppError } from '../errors/AppError';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, ctx }) {
    const isProduction = process.env.NODE_ENV === 'production';

    const domainError =
      error.cause instanceof AppError
        ? {
            code: error.cause.code,
            details: error.cause.details ?? null,
          }
        : null;

    const zodError = error.cause instanceof ZodError ? error.cause.flatten() : null;

    return {
      ...shape,
      data: {
        ...shape.data,
        traceId: ctx?.requestId ?? null,
        domainError,
        zodError,
        // Strip stack trace in production
        stack: isProduction ? undefined : shape.data.stack,
      },
    };
  },
});

export { t };
```

The `ctx.requestId` is the Fastify request ID (`req.id`) injected into the tRPC context at request time inside the Fastify adapter's `createContext` function.

### 3.4 Frontend Consumption Pattern

On the frontend, tRPC errors surface through TanStack Query as `TRPCClientError<AppRouter>`. Domain error narrowing uses type guard helpers exported from `/packages/shared`.

```typescript
// /packages/shared/src/errors.ts

export const DOMAIN_ERROR_CODES = {
  NUMBER_SERIES_EXHAUSTED: 'NUMBER_SERIES_EXHAUSTED',
  DUPLICATE_CONTROL_NUMBER: 'DUPLICATE_CONTROL_NUMBER',
  NUMBER_IS_IMMUTABLE: 'NUMBER_IS_IMMUTABLE',
  SERIES_NOT_FOUND: 'SERIES_NOT_FOUND',
  ACTIVE_DESIGNATION_EXISTS: 'ACTIVE_DESIGNATION_EXISTS',
  INVALID_WORKFLOW_TRANSITION: 'INVALID_WORKFLOW_TRANSITION',
  COMMITTEE_REPORTS_PENDING: 'COMMITTEE_REPORTS_PENDING',
  CERTIFICATION_OF_URGENCY_REQUIRED: 'CERTIFICATION_OF_URGENCY_REQUIRED',
  QUORUM_NOT_MET: 'QUORUM_NOT_MET',
  WORKFLOW_STEP_NOT_ASSIGNED: 'WORKFLOW_STEP_NOT_ASSIGNED',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  DOCUMENT_LOCKED: 'DOCUMENT_LOCKED',
  DOCUMENT_IS_IMMUTABLE: 'DOCUMENT_IS_IMMUTABLE',
  DOCUMENT_UNDER_LEGAL_HOLD: 'DOCUMENT_UNDER_LEGAL_HOLD',
  ROLE_COMBINATION_FORBIDDEN: 'ROLE_COMBINATION_FORBIDDEN',
  FILE_SIZE_LIMIT_EXCEEDED: 'FILE_SIZE_LIMIT_EXCEEDED',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  STORAGE_SERVICE_ERROR: 'STORAGE_SERVICE_ERROR',
  OCR_PROCESSING_FAILED: 'OCR_PROCESSING_FAILED',
  AUDIT_CHAIN_CORRUPTED: 'AUDIT_CHAIN_CORRUPTED',
} as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[keyof typeof DOMAIN_ERROR_CODES];
```

Type guard on the frontend:

```typescript
// /apps/web/src/lib/errors.ts

import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@server/trpc/router';
import type { DomainErrorCode } from '@lgu/shared/errors';

export function isDomainError(
  error: unknown,
  code: DomainErrorCode,
): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError && error.data?.domainError?.code === code;
}
```

In a component mutation handler:

```typescript
const { mutate } = trpc.documents.assignControlNumber.useMutation({
  onError(error) {
    if (isDomainError(error, 'DUPLICATE_CONTROL_NUMBER')) {
      // error.data.domainError.details is typed via DomainErrorDetails
      // (see section 6.5) after runtime validation with Zod
      const details = parseDomainDetails(
        'DUPLICATE_CONTROL_NUMBER',
        error.data.domainError.details,
      );
      toast.error(
        `Control number ${details.series} ${details.year}-${details.number} is already assigned.`,
      );
      return;
    }
    // Unrecognized errors fall through to the global QueryCache handler
  },
});
```

> **Note on `domainError.details` typing:** `details` arrives as `unknown` from the JSON payload. For any error where the frontend reads specific fields from `details`, parse it at runtime using the Zod schemas exported from `/packages/shared` (see section 6.5). Do not cast directly.

---

## 4. Standard REST Error Shape

REST routes serve the public portal (Phase 3), mobile clients, and third-party integrations. The internal `/web` app never calls REST routes directly — it uses tRPC. The REST shape below is an external API contract.

### 4.1 Wire Format

**Error response:**

```json
{
  "ok": false,
  "error": {
    "code": "DUPLICATE_CONTROL_NUMBER",
    "message": "A document with control number SPR 2026-42 already exists.",
    "traceId": "req_01hwqxnk4pfj",
    "details": {
      "series": "SPR",
      "year": 2026,
      "number": 42,
      "existingDocumentId": "018f4c72-..."
    }
  }
}
```

**Success response (normalized envelope):**

```json
{
  "ok": true,
  "data": { ... }
}
```

**Rules:**

- `ok` is always `boolean`, never absent. It is the fast check callers use before reading `data` or `error`.
- `error.code` is the domain error code string (e.g., `DUPLICATE_CONTROL_NUMBER`) for domain errors, or a generic structural code (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`) for non-domain errors.
- `error.details` is present only when the error has structured context relevant to the caller. It is **absent**, not `null`, for generic errors.
- `error.message` is a human-readable English string. It is not a translation key. Localization is the client's responsibility.
- `traceId` is always present on every error response.
- HTTP status codes on REST routes follow the domain error's designated HTTP status from section 6.2.
- `data.code` in success responses is not included here — each route defines its own response schema in the OpenAPI spec.

### 4.2 Fastify Error Handler

A single `setErrorHandler` registered on the root Fastify instance handles all errors from REST route handlers. The tRPC adapter handles its own errors separately.

```typescript
// /apps/server/src/plugins/errorHandler.ts

import type { FastifyError, FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import * as Sentry from '@sentry/node';

export const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const traceId = request.id;

    // 1. Zod validation error (from fastify-type-provider-zod route schema)
    if (error instanceof ZodError) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          traceId,
          details: { issues: error.flatten() },
        },
      });
    }

    // 2. Known domain error thrown directly from a route handler
    const domainErr =
      error instanceof AppError ? error : error.cause instanceof AppError ? error.cause : null;

    if (domainErr) {
      return reply.status(domainErr.httpStatus).send({
        ok: false,
        error: {
          code: domainErr.code,
          message: domainErr.message,
          traceId,
          ...(domainErr.details !== undefined && { details: domainErr.details }),
        },
      });
    }

    // 3. Fastify native validation errors
    if ((error as FastifyError).validation) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          traceId,
          details: { issues: (error as FastifyError).validation },
        },
      });
    }

    // 4. Explicit HTTP errors (fastify.httpErrors.notFound(), 4xx range)
    const statusCode = (error as FastifyError).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.status(statusCode).send({
        ok: false,
        error: {
          code: httpStatusToGenericCode(statusCode),
          message: error.message,
          traceId,
        },
      });
    }

    // 5. Unhandled exception — capture in Sentry, return opaque 500
    Sentry.withScope((scope) => {
      scope.setTag('traceId', traceId);
      scope.setTag('route', request.routeOptions.url ?? 'unknown');
      scope.setUser({ id: request.user?.id });
      Sentry.captureException(error);
    });

    request.log.error({ err: error, traceId }, 'Unhandled exception');

    return reply.status(500).send({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Note your trace ID when reporting this issue.',
        traceId,
      },
    });
  });
};

function httpStatusToGenericCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    408: 'TIMEOUT',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    422: 'UNPROCESSABLE_CONTENT',
    429: 'RATE_LIMITED',
  };
  return map[status] ?? 'CLIENT_ERROR';
}
```

---

## 5. Zod Validation Error Serialization

### 5.1 In tRPC Procedures (Input Validation)

When a tRPC procedure's input schema fails validation, tRPC internally throws a `TRPCError` with code `PARSE_ERROR` and `cause` set to the `ZodError`. The custom error formatter in section 3.3 intercepts this and serializes it as:

```json
{
  "error": {
    "json": {
      "message": "Input validation failed",
      "code": -32700,
      "data": {
        "code": "PARSE_ERROR",
        "httpStatus": 400,
        "path": "documents.create",
        "traceId": "req_01hwqxnk4pfj",
        "domainError": null,
        "zodError": {
          "formErrors": [],
          "fieldErrors": {
            "title": ["Required"],
            "year": ["Expected number, received string"]
          }
        }
      }
    }
  }
}
```

`zodError` is the output of `ZodError.flatten()`:

- `fieldErrors` — `Record<string, string[]>`: per-field messages keyed by field path
- `formErrors` — `string[]`: top-level (non-field) validation messages

For nested objects, field paths use dot notation by default from `flatten()`. For deeply nested schemas, consider calling `ZodError.format()` instead and adjust the formatter and the frontend helper accordingly. Make this a project-wide decision before the first form is built.

### 5.2 In REST Routes (fastify-type-provider-zod)

REST routes declare Zod schemas as route schemas via `fastify-type-provider-zod`. When the request body, querystring, or params fail validation, the Fastify error handler normalizes it to:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "traceId": "req_01hwqxnk4pfj",
    "details": {
      "issues": {
        "formErrors": [],
        "fieldErrors": {
          "email": ["Invalid email address"]
        }
      }
    }
  }
}
```

The `issues` shape inside `details` deliberately mirrors the tRPC `zodError` shape. External API clients face one validation error format regardless of whether they call a REST route or a tRPC-over-HTTP endpoint.

### 5.3 Frontend Form Binding

React Hook Form is bound to Zod schemas via `@hookform/resolvers/zod`. Client-side validation runs before any network call. When a tRPC mutation still returns a `PARSE_ERROR` — because a server-side Zod schema is stricter or differs from the client schema — the frontend must reflect those errors in the form rather than displaying a generic toast.

```typescript
// /apps/web/src/lib/formErrors.ts

import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@server/trpc/router';

export function setServerZodErrors<T extends FieldValues>(
  error: TRPCClientError<AppRouter>,
  setError: UseFormSetError<T>,
): void {
  const zodError = error.data?.zodError;
  if (!zodError) return;

  Object.entries(zodError.fieldErrors).forEach(([field, messages]) => {
    if (messages?.length) {
      setError(field as Path<T>, {
        type: 'server',
        message: messages[0],
      });
    }
  });

  zodError.formErrors.forEach((message) => {
    setError('root.serverError', { type: 'server', message });
  });
}
```

Usage inside a mutation's `onError`:

```typescript
const { mutate } = trpc.someModule.create.useMutation({
  onError(error) {
    if (error.data?.code === 'PARSE_ERROR') {
      setServerZodErrors(error, setError);
      return;
    }
    // Handle domain errors separately
  },
});
```

---

## 6. Domain Error Design

### 6.1 AppError Base Class

Defined in `/apps/server/src/errors/AppError.ts`. This is a server-only module. The `code` strings and their detail types live in `/packages/shared` so the frontend can reference them without importing server code.

```typescript
// /apps/server/src/errors/AppError.ts

import type { DomainErrorCode } from '@lgu/shared/errors';
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';

export abstract class AppError extends Error {
  abstract readonly code: DomainErrorCode;
  abstract readonly httpStatus: number;
  abstract readonly trpcCode: TRPC_ERROR_CODE_KEY;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    // Maintain correct prototype chain after TypeScript transpilation
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

Each domain error is a concrete subclass:

```typescript
// /apps/server/src/errors/domain/documents.ts

import { AppError } from '../AppError';

export class DuplicateControlNumberError extends AppError {
  readonly code = 'DUPLICATE_CONTROL_NUMBER' as const;
  readonly httpStatus = 409;
  readonly trpcCode = 'CONFLICT' as const;

  constructor(details: {
    series: string;
    year: number;
    number: number;
    existingDocumentId?: string;
  }) {
    super(
      `A document with control number ${details.series} ${details.year}-${details.number} already exists.`,
      details,
    );
  }
}

export class ActiveDesignationExistsError extends AppError {
  readonly code = 'ACTIVE_DESIGNATION_EXISTS' as const;
  readonly httpStatus = 409;
  readonly trpcCode = 'CONFLICT' as const;

  constructor(details: { userId: string; activeDesignationId: string; activeUntil: string }) {
    super(
      'This person already holds one active designation. Only one active designation per person is permitted.',
      details,
    );
  }
}

export class NumberSeriesExhaustedError extends AppError {
  readonly code = 'NUMBER_SERIES_EXHAUSTED' as const;
  readonly httpStatus = 409;
  readonly trpcCode = 'CONFLICT' as const;

  constructor(details: { series: string; year: number; maxValue: number }) {
    super(
      `The document number series ${details.series} for ${details.year} has reached its configured maximum (${details.maxValue}).`,
      details,
    );
  }
}
```

Files are organized by module: `/apps/server/src/errors/domain/documents.ts`, `workflow.ts`, `organization.ts`, `iam.ts`, `records.ts`, `infrastructure.ts`.

### 6.2 Domain Error Code Registry

Full inventory for Phase 1. Entries must be added here before the error class is implemented. New domain errors introduced in later phases follow the same pattern.

---

#### Number Series (module: `documents`)

| Code                       | HTTP | tRPC Code   | Trigger                                                                                                                                                        | Sentry                           |
| -------------------------- | ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `NUMBER_SERIES_EXHAUSTED`  | 409  | `CONFLICT`  | PostgreSQL sequence for a `(series, year)` combination has hit its configured max. Yearly counters reset annually; this is rare but operationally significant. | `captureMessage` — warning level |
| `DUPLICATE_CONTROL_NUMBER` | 409  | `CONFLICT`  | Unique constraint on `(series, year, number)` — the control number is already assigned to another document.                                                    | No                               |
| `NUMBER_IS_IMMUTABLE`      | 409  | `CONFLICT`  | Attempt to modify or reassign a finalized (non-`Draft`) series number. Final numbers are immutable by platform invariant.                                      | No                               |
| `SERIES_NOT_FOUND`         | 404  | `NOT_FOUND` | The requested `number_series` record does not exist or is inactive.                                                                                            | No                               |

---

#### Designation / Delegation (module: `organization`)

| Code                        | HTTP | tRPC Code  | Trigger                                                                                                                                                                                                                           | Sentry |
| --------------------------- | ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `ACTIVE_DESIGNATION_EXISTS` | 409  | `CONFLICT` | A user already holds one active `delegation_grant`. Only one active designation per person is permitted at any time (enforced by both app-level validation and a PostgreSQL partial unique index on active delegations per user). | No     |

---

#### Workflow (module: `workflow`)

| Code                                | HTTP | tRPC Code               | Trigger                                                                                                                                                                                                                                                        | Sentry |
| ----------------------------------- | ---- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `INVALID_WORKFLOW_TRANSITION`       | 422  | `UNPROCESSABLE_CONTENT` | The requested state transition is not permitted by the workflow state machine for the document's current step/state.                                                                                                                                           | No     |
| `COMMITTEE_REPORTS_PENDING`         | 409  | `CONFLICT`              | A `multi_referral` workflow step cannot auto-complete while one or more assigned committees have not yet submitted their contribution to the unified report. Manual SP Secretary override is required; that override is audit-logged with a mandatory comment. | No     |
| `CERTIFICATION_OF_URGENCY_REQUIRED` | 412  | `PRECONDITION_FAILED`   | Attempting to skip the committee review step without a valid Certification of Urgency attached to the measure. The Certification of Urgency is a Mayor-issued formal document; its absence means the standard committee path must be followed.                 | No     |
| `QUORUM_NOT_MET`                    | 422  | `UNPROCESSABLE_CONTENT` | A vote is recorded but the present member count is below the required 7 of 12 quorum threshold.                                                                                                                                                                | No     |
| `WORKFLOW_STEP_NOT_ASSIGNED`        | 403  | `FORBIDDEN`             | The calling user is not the current step's assignee and holds no active delegation covering this action.                                                                                                                                                       | No     |

---

#### Document (module: `documents`)

| Code                        | HTTP | tRPC Code   | Trigger                                                                                                                                                                                                    | Sentry |
| --------------------------- | ---- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `DOCUMENT_NOT_FOUND`        | 404  | `NOT_FOUND` | The document does not exist, has been soft-deleted, or is not visible to this actor under RLS / ABAC.                                                                                                      | No     |
| `DOCUMENT_LOCKED`           | 409  | `CONFLICT`  | The document is under pessimistic lock held by another user. Lock timeout is 15 minutes (configurable per document type). `details` includes the lock holder's name and expiry time for display in the UI. | No     |
| `DOCUMENT_IS_IMMUTABLE`     | 409  | `CONFLICT`  | Attempt to modify a document that has been finalized and is now immutable by platform invariant.                                                                                                           | No     |
| `DOCUMENT_UNDER_LEGAL_HOLD` | 409  | `CONFLICT`  | A retention schedule change or disposition action was attempted while the document is under a legal hold.                                                                                                  | No     |

---

#### Authorization (module: `iam`)

| Code                         | HTTP | tRPC Code   | Trigger                                                                                                                                                               | Sentry |
| ---------------------------- | ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `ROLE_COMBINATION_FORBIDDEN` | 422  | `FORBIDDEN` | Attempt to assign the Platform Administrator role to a user who already holds any document-processing role, or vice versa. These roles cannot coexist on one account. | No     |

---

#### File / Storage (module: `documents`)

| Code                       | HTTP | tRPC Code               | Trigger                                                                                                                                                                                                                                 | Sentry             |
| -------------------------- | ---- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `FILE_SIZE_LIMIT_EXCEEDED` | 413  | `PAYLOAD_TOO_LARGE`     | Uploaded file exceeds the 25 MB per-file limit (configured via `FILE_SIZE_LIMIT_BYTES` env var).                                                                                                                                        | No                 |
| `UNSUPPORTED_FILE_TYPE`    | 422  | `UNPROCESSABLE_CONTENT` | File MIME type is not in the allowed set: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `image/png`, `image/jpeg`. | No                 |
| `STORAGE_SERVICE_ERROR`    | 502  | `BAD_GATEWAY`           | S3-compatible storage call failed (upload, presigned URL generation, delete). The underlying S3 error is logged but never forwarded to the client.                                                                                      | `captureException` |

---

#### Infrastructure / Security (modules: `documents`, `audit`)

| Code                    | HTTP | tRPC Code               | Trigger                                                                                                                                                                                                         | Sentry                           |
| ----------------------- | ---- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `OCR_PROCESSING_FAILED` | 502  | `BAD_GATEWAY`           | The OCR service interface threw an error. The document is stored successfully but is not indexed for full-text search. Users are shown the scan quality indicator as unknown; they may re-trigger OCR manually. | `captureException`               |
| `AUDIT_CHAIN_CORRUPTED` | 500  | `INTERNAL_SERVER_ERROR` | Hash chain validation at retrieval time detected a broken chain — a tamper indicator. This is a security event, not a user-correctable error.                                                                   | `captureException` — fatal level |

---

#### Generic Structural Codes (REST only, no AppError class)

These codes are returned by the REST error handler for non-domain errors. They do not have corresponding `AppError` subclasses.

| Code               | HTTP | When                                                        |
| ------------------ | ---- | ----------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Zod / `fastify-type-provider-zod` schema validation failure |
| `UNAUTHORIZED`     | 401  | No valid session / JWT expired or absent                    |
| `FORBIDDEN`        | 403  | ABAC denial with no further domain context to add           |
| `NOT_FOUND`        | 404  | Generic 404 when no specific domain error applies           |
| `RATE_LIMITED`     | 429  | `@fastify/rate-limit` threshold exceeded                    |
| `INTERNAL_ERROR`   | 500  | Unhandled exception                                         |

### 6.3 Domain Error Propagation in tRPC Procedures

Procedures **always** wrap `AppError` in a `TRPCError`. The tRPC adapter requires a `TRPCError` to set the HTTP status code correctly. An unwrapped `AppError` escapes the procedure as an unhandled exception, producing a 500 and a Sentry capture.

```typescript
// /apps/server/src/modules/documents/documents.router.ts

import { TRPCError } from '@trpc/server';
import { DuplicateControlNumberError } from '../../errors/domain/documents';

export const assignControlNumber = procedure
  .input(assignControlNumberSchema)
  .mutation(async ({ input, ctx }) => {
    const existing = await ctx.db.query.documents.findFirst({
      where: and(
        eq(documents.series, input.series),
        eq(documents.year, input.year),
        eq(documents.number, input.number),
      ),
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `A document with control number ${input.series} ${input.year}-${input.number} already exists.`,
        cause: new DuplicateControlNumberError({
          series: input.series,
          year: input.year,
          number: input.number,
          existingDocumentId: existing.id,
        }),
      });
    }

    // ... proceed
  });
```

The `cause` is what the error formatter reads to populate `domainError` in the wire response. The `TRPCError.code` must match the `AppError.trpcCode` on the cause — this is not enforced at compile time, so it is a convention to verify in code review.

### 6.4 Domain Error Propagation in REST Routes

REST route handlers throw `AppError` subtypes directly. The centralized Fastify error handler (section 4.2) detects `AppError` instances and serializes them into the REST envelope:

```typescript
// /apps/server/src/modules/organization/designations.rest.ts

import { ActiveDesignationExistsError } from '../../errors/domain/organization';

fastify.post('/api/v1/designations', {
  schema: createDesignationSchema,
  handler: async (request, reply) => {
    const active = await designationService.findActiveForUser(request.body.userId);

    if (active) {
      throw new ActiveDesignationExistsError({
        userId: request.body.userId,
        activeDesignationId: active.id,
        activeUntil: active.endDate.toISOString(),
      });
    }

    const newDesignation = await designationService.create(request.body);
    reply.status(201).send({ ok: true, data: newDesignation });
  },
});
```

### 6.5 Domain Error Detail Types

The `details` field on each domain error must have a defined TypeScript type. These types are defined in `/packages/shared` so the frontend can validate and narrow them without importing server code. Each detail type also has a Zod schema for runtime validation on the client.

```typescript
// /packages/shared/src/errors.ts (additions)

import { z } from 'zod';

export const domainErrorDetails = {
  DUPLICATE_CONTROL_NUMBER: z.object({
    series: z.string(),
    year: z.number(),
    number: z.number(),
    existingDocumentId: z.string().uuid().optional(),
  }),

  ACTIVE_DESIGNATION_EXISTS: z.object({
    userId: z.string().uuid(),
    activeDesignationId: z.string().uuid(),
    activeUntil: z.string().datetime(),
  }),

  DOCUMENT_LOCKED: z.object({
    lockedByUserId: z.string().uuid(),
    lockedByName: z.string(),
    lockedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }),

  COMMITTEE_REPORTS_PENDING: z.object({
    committeeIds: z.array(z.string().uuid()),
    committeeNames: z.array(z.string()),
    thursdayCutoff: z.string().date(),
  }),

  FILE_SIZE_LIMIT_EXCEEDED: z.object({
    fileSizeBytes: z.number(),
    limitBytes: z.number(),
  }),

  UNSUPPORTED_FILE_TYPE: z.object({
    providedMimeType: z.string(),
    allowedMimeTypes: z.array(z.string()),
  }),

  INVALID_WORKFLOW_TRANSITION: z.object({
    currentState: z.string(),
    attemptedTransition: z.string(),
    allowedTransitions: z.array(z.string()),
  }),

  QUORUM_NOT_MET: z.object({
    presentCount: z.number(),
    requiredCount: z.number(),
    totalMembers: z.number(),
  }),

  NUMBER_SERIES_EXHAUSTED: z.object({
    series: z.string(),
    year: z.number(),
    maxValue: z.number(),
  }),

  // Errors with no structured details — return null on the wire
  NUMBER_IS_IMMUTABLE: z.null(),
  SERIES_NOT_FOUND: z.null(),
  DOCUMENT_NOT_FOUND: z.null(),
  DOCUMENT_IS_IMMUTABLE: z.null(),
  DOCUMENT_UNDER_LEGAL_HOLD: z.null(),
  ROLE_COMBINATION_FORBIDDEN: z.null(),
  OCR_PROCESSING_FAILED: z.null(),
  AUDIT_CHAIN_CORRUPTED: z.null(),
  STORAGE_SERVICE_ERROR: z.null(),
  WORKFLOW_STEP_NOT_ASSIGNED: z.null(),
  CERTIFICATION_OF_URGENCY_REQUIRED: z.null(),
};

export type DomainErrorDetails = {
  [K in DomainErrorCode]: z.infer<(typeof domainErrorDetails)[K]>;
};

// Runtime validator used on the frontend before reading details fields
export function parseDomainDetails<C extends DomainErrorCode>(
  code: C,
  details: unknown,
): DomainErrorDetails[C] {
  return domainErrorDetails[code].parse(details) as DomainErrorDetails[C];
}
```

---

## 7. Sentry Integration

### 7.1 Sentry Initialization

Sentry is initialized in `/apps/server/src/sentry.ts` and imported before the Fastify server starts. The Fastify integration provides automatic request context attachment.

```typescript
// /apps/server/src/sentry.ts

import * as Sentry from '@sentry/node';

export function initSentry(): void {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.GIT_SHA, // injected at build time via Docker build arg
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
    beforeSend(event) {
      return scrubPII(event); // see section 7.3
    },
  });
}
```

The `scrubPII` function runs before every event is transmitted. It is the last line of defense against accidental PII leakage.

### 7.2 Integration Points

Three capture patterns are used. Nothing outside these three patterns calls Sentry APIs.

---

**A. Automatic capture — unhandled exceptions (500s)**

The Fastify REST error handler (section 4.2) calls `Sentry.captureException(error)` for all errors that reach its final catch branch. The tRPC adapter has a similar integration: add a tRPC middleware that catches unhandled procedure exceptions and forwards them to Sentry before re-throwing.

```typescript
// /apps/server/src/trpc/middleware/sentryError.ts

import * as Sentry from '@sentry/node';

export const sentryErrorMiddleware = t.middleware(async ({ path, next, ctx }) => {
  const result = await next();

  if (!result.ok && result.error.code === 'INTERNAL_SERVER_ERROR') {
    Sentry.withScope((scope) => {
      scope.setTag('procedurePath', path);
      scope.setTag('traceId', ctx.requestId);
      scope.setUser({ id: ctx.user?.id, role: ctx.user?.primaryRole });
      Sentry.captureException(result.error.cause ?? result.error);
    });
  }

  return result;
});
```

---

**B. Manual capture — security events and operational anomalies**

A small set of domain errors represent security events or conditions that need proactive visibility. These are captured explicitly at the service layer, not in the generic error handler.

`AUDIT_CHAIN_CORRUPTED` — fatal security event:

```typescript
// /apps/server/src/modules/audit/audit.service.ts

async function validateChain(entries: AuditEntry[]): Promise<void> {
  const corrupted = detectChainCorruption(entries);
  if (corrupted) {
    Sentry.captureException(
      new Error('Audit chain integrity failure — tamper indicator detected'),
      {
        level: 'fatal',
        tags: {
          module: 'audit',
          event: 'AUDIT_CHAIN_CORRUPTED',
        },
        extra: {
          firstCorruptedEntryId: corrupted.entryId,
          detectedAt: new Date().toISOString(),
          // Never include entry payload — may contain document content
        },
      },
    );
    throw new AuditChainCorruptedError();
  }
}
```

`NUMBER_SERIES_EXHAUSTED` — operational warning:

```typescript
// /apps/server/src/modules/documents/number-series.service.ts

async function getNextNumber(series: string, year: number): Promise<number> {
  try {
    return await db.execute(sql`SELECT nextval(${sequenceName(series, year)})`);
  } catch (err) {
    if (isPostgresSequenceError(err)) {
      Sentry.captureMessage(`Document number series exhausted: ${series} ${year}`, {
        level: 'warning',
        tags: {
          module: 'documents',
          event: 'NUMBER_SERIES_EXHAUSTED',
          series,
          year: String(year),
        },
      });
      throw new NumberSeriesExhaustedError({ series, year, maxValue: SERIES_MAX });
    }
    throw err;
  }
}
```

`STORAGE_SERVICE_ERROR` and `OCR_PROCESSING_FAILED` — infrastructure failure:

```typescript
// /apps/server/src/services/storage.service.ts

async function uploadFile(key: string, stream: Readable, metadata: FileMetadata): Promise<void> {
  try {
    await s3Client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: stream }));
  } catch (err) {
    Sentry.captureException(err, {
      tags: { module: 'documents', event: 'STORAGE_SERVICE_ERROR' },
      extra: {
        // Never include key — it is a UUID and not helpful for debugging without the DB
        bucket: S3_BUCKET,
        endpoint: process.env.S3_ENDPOINT,
      },
    });
    throw new StorageServiceError();
  }
}
```

---

**C. Per-request scope context**

Set on every request via a Fastify `onRequest` hook. This context is automatically attached to any Sentry event captured during that request's lifecycle.

```typescript
// /apps/server/src/plugins/sentryScope.ts

fastify.addHook('onRequest', async (request) => {
  Sentry.setUser(
    request.user
      ? {
          id: request.user.id, // UUID only — never name or email
          role: request.user.primaryRole, // role string
        }
      : undefined,
  );

  Sentry.setTag('traceId', request.id);
  Sentry.setTag('module', inferModuleFromRoute(request.routeOptions.url ?? ''));

  Sentry.setContext('request', {
    method: request.method,
    route: request.routeOptions.url,
    // Never include request.body, request.headers (may contain bearer tokens), or request.params
  });
});
```

For tRPC calls, the procedure path is set as an additional tag in `sentryErrorMiddleware` (section 7.2 B).

### 7.3 PII Scrubbing Rules (RA 10173 Compliance)

The Data Privacy Act (RA 10173) prohibits sending citizen PII to external vendors without a lawful basis. Sending citizen document content, complaint details, or personal information to Sentry constitutes a data privacy violation.

**Never include in any Sentry event:**

- Request body content (may contain document text, citizen names, complainant details)
- File upload metadata that includes original filenames (which may contain citizen names; stored only as UUIDs in the system — enforce this rule at the upload handler level, not just in Sentry)
- Document titles or full-text content from OCR
- Citizen names, birthdates, phone numbers, email addresses
- Respondent details from Citizen Complaint records
- Any data from the `portal` schema or the complaint module that contains citizen-provided data
- Authentication tokens or cookie values

**Safe to include in Sentry context:**

- UUIDs (user ID, document ID, workflow instance ID) — opaque identifiers
- Role strings (`sp_secretary`, `records_officer`, etc.)
- Error codes and tRPC procedure paths / REST route paths
- Timestamps (ISO-8601)
- Count metrics (e.g., number of audit entries in a chain validation)
- Series strings (`SPR`, `MO`, `7SP`, etc.) — document classification labels
- Phase and environment tags

The `scrubPII` function applied in `beforeSend`:

```typescript
const PII_KEY_DENYLIST = new Set([
  'name',
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'phoneNumber',
  'contactNumber',
  'address',
  'birthdate',
  'dateOfBirth',
  'content',
  'body',
  'text',
  'title', // document content fields
  'complainantName',
  'respondentName',
  'password',
  'token',
  'secret',
  'cookie',
  'authorization',
]);

function scrubPII(event: Sentry.Event): Sentry.Event {
  return JSON.parse(
    JSON.stringify(event, (key, value) => {
      if (PII_KEY_DENYLIST.has(key)) return '[REDACTED]';
      return value;
    }),
  );
}
```

### 7.4 Sentry Severity Reference

| Capture Pattern                           | Level     | Condition                                                    |
| ----------------------------------------- | --------- | ------------------------------------------------------------ |
| Unhandled exception in REST error handler | `error`   | All 5xx from `setErrorHandler`'s final branch                |
| Unhandled exception in tRPC procedure     | `error`   | `INTERNAL_SERVER_ERROR` tRPC code in `sentryErrorMiddleware` |
| Audit chain corruption                    | `fatal`   | `detectChainCorruption()` returns a result                   |
| Storage service failure                   | `error`   | S3-compatible client throws                                  |
| OCR processing failure                    | `error`   | OCR service interface throws                                 |
| Number series exhausted                   | `warning` | PostgreSQL sequence error detected in number series service  |

All other domain errors — `DUPLICATE_CONTROL_NUMBER`, `ACTIVE_DESIGNATION_EXISTS`, `DOCUMENT_LOCKED`, `INVALID_WORKFLOW_TRANSITION`, `FORBIDDEN`, `UNAUTHORIZED`, validation errors — are **not sent to Sentry at any level**. They are logged by Pino at `info` level and are part of normal operational traffic.

---

## 8. Frontend Error Handling Boundaries

### 8.1 Global TanStack Query Error Handler

A global `QueryCache` error handler captures tRPC errors that are not handled at the individual query or mutation call site. Local `onError` callbacks always run first; the global handler is the fallback for unexpected errors and session management.

```typescript
// /apps/web/src/lib/queryClient.ts

import { QueryCache, QueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@server/trpc/router';
import { toast } from 'sonner';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      if (!(error instanceof TRPCClientError)) return;

      // Queries that handle their own errors opt out of the global handler
      if (query.meta?.suppressGlobalErrorHandler) return;

      switch (error.data?.code) {
        case 'UNAUTHORIZED':
          window.location.href = `/login?reason=session_expired&next=${encodeURIComponent(window.location.pathname)}`;
          return;

        case 'INTERNAL_SERVER_ERROR':
          toast.error('An unexpected error occurred.', {
            description: error.data.traceId ? `Trace ID: ${error.data.traceId}` : undefined,
          });
          return;

        default:
          // Unexpected domain error not caught locally — show trace ID
          toast.error(error.message ?? 'Something went wrong.', {
            description: error.data?.traceId ? `Trace ID: ${error.data.traceId}` : undefined,
          });
      }
    },
  }),
});
```

### 8.2 Error Display Decision Rules

| Error Type                                    | Display Location                            | Notes                                                                                           |
| --------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Zod field validation — client-side            | Inline field error (react-hook-form)        | Shown below the field; no toast. Never show a toast for a field error.                          |
| Zod field validation — server (`PARSE_ERROR`) | Inline field error via `setServerZodErrors` | Bridge server errors to form fields using the helper in section 5.3.                            |
| `DUPLICATE_CONTROL_NUMBER`                    | Inline near the submit action               | Show the conflicting number from `details`; do not toast.                                       |
| `ACTIVE_DESIGNATION_EXISTS`                   | Inline in the designation form              | Show `activeUntil` from `details` so the user knows when the current one expires.               |
| `DOCUMENT_LOCKED`                             | Inline banner on the document view          | Show `lockedByName` and `expiresAt` from `details`. Auto-dismiss or re-check when lock expires. |
| `COMMITTEE_REPORTS_PENDING`                   | Inline on the workflow step panel           | List pending committee names from `details.committeeNames`.                                     |
| `INVALID_WORKFLOW_TRANSITION`                 | Toast + inline state indicator              | List `allowedTransitions` from `details` to guide the user.                                     |
| `QUORUM_NOT_MET`                              | Inline on the vote recording panel          | Show `presentCount` / `requiredCount`.                                                          |
| `FORBIDDEN`                                   | Toast                                       | "You do not have permission to perform this action." No domain details.                         |
| `UNAUTHORIZED`                                | Redirect to login                           | See global handler.                                                                             |
| `FILE_SIZE_LIMIT_EXCEEDED`                    | Inline on the file input                    | Show `fileSizeBytes` and `limitBytes` formatted in MB.                                          |
| `UNSUPPORTED_FILE_TYPE`                       | Inline on the file input                    | Show `providedMimeType` and `allowedMimeTypes`.                                                 |
| `INTERNAL_ERROR` / `INTERNAL_SERVER_ERROR`    | Toast with trace ID                         | "An unexpected error occurred. Note your Trace ID when reporting this."                         |
| `STORAGE_SERVICE_ERROR`                       | Toast with trace ID                         | "File upload failed. Please try again or contact support."                                      |
| `OCR_PROCESSING_FAILED`                       | Inline non-blocking notice on the document  | "Text could not be extracted from this document. You can trigger re-processing."                |
| Network error / offline                       | Toast                                       | "Connection issue — please try again."                                                          |

### 8.3 React Error Boundary

A top-level React error boundary wraps the authenticated application shell. It catches rendering errors (not query errors, which are handled by TanStack Query) and renders a full-page error fallback.

Full-page error display is reserved for rendering-level failures. No domain error from a tRPC call should produce a full-page error — they all have a local or toast display path.

The boundary stores the most recently seen `traceId` from TanStack Query events (stored in Zustand) and includes it in the fallback UI to aid support.

---

## Appendix: Domain Error Quick Reference

| Code                                | HTTP | tRPC Code               | Module       | Sentry    |
| ----------------------------------- | ---- | ----------------------- | ------------ | --------- |
| `NUMBER_SERIES_EXHAUSTED`           | 409  | `CONFLICT`              | documents    | warning   |
| `DUPLICATE_CONTROL_NUMBER`          | 409  | `CONFLICT`              | documents    | No        |
| `NUMBER_IS_IMMUTABLE`               | 409  | `CONFLICT`              | documents    | No        |
| `SERIES_NOT_FOUND`                  | 404  | `NOT_FOUND`             | documents    | No        |
| `ACTIVE_DESIGNATION_EXISTS`         | 409  | `CONFLICT`              | organization | No        |
| `INVALID_WORKFLOW_TRANSITION`       | 422  | `UNPROCESSABLE_CONTENT` | workflow     | No        |
| `COMMITTEE_REPORTS_PENDING`         | 409  | `CONFLICT`              | workflow     | No        |
| `CERTIFICATION_OF_URGENCY_REQUIRED` | 412  | `PRECONDITION_FAILED`   | workflow     | No        |
| `QUORUM_NOT_MET`                    | 422  | `UNPROCESSABLE_CONTENT` | workflow     | No        |
| `WORKFLOW_STEP_NOT_ASSIGNED`        | 403  | `FORBIDDEN`             | workflow     | No        |
| `DOCUMENT_NOT_FOUND`                | 404  | `NOT_FOUND`             | documents    | No        |
| `DOCUMENT_LOCKED`                   | 409  | `CONFLICT`              | documents    | No        |
| `DOCUMENT_IS_IMMUTABLE`             | 409  | `CONFLICT`              | documents    | No        |
| `DOCUMENT_UNDER_LEGAL_HOLD`         | 409  | `CONFLICT`              | records      | No        |
| `ROLE_COMBINATION_FORBIDDEN`        | 422  | `FORBIDDEN`             | iam          | No        |
| `FILE_SIZE_LIMIT_EXCEEDED`          | 413  | `PAYLOAD_TOO_LARGE`     | documents    | No        |
| `UNSUPPORTED_FILE_TYPE`             | 422  | `UNPROCESSABLE_CONTENT` | documents    | No        |
| `STORAGE_SERVICE_ERROR`             | 502  | `BAD_GATEWAY`           | documents    | exception |
| `OCR_PROCESSING_FAILED`             | 502  | `BAD_GATEWAY`           | documents    | exception |
| `AUDIT_CHAIN_CORRUPTED`             | 500  | `INTERNAL_SERVER_ERROR` | audit        | fatal     |
