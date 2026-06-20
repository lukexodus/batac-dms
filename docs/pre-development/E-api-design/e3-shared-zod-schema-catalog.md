# E3. Shared Zod Schema Catalog

**Document:** E3
**Platform:** Batac City LGU Platform
**Status:** BLOCKING — prerequisite for E1 (tRPC Procedure Catalog), E2 (REST API OpenAPI Specification), A1 (Master Phased Task List), and all frontend form implementations. No procedure, route, or form may define its own copy of a schema catalogued here.
**Last Updated:** June 2026
**Audience:** Backend and frontend development team
**Source Documents Reviewed:**
- `c1-full-database-schema-ddl.md` — authoritative column types, enums, and constraints for all eight Phase 1 schemas
- `tech-stack.md` — type safety chain; stack decisions (Zod, drizzle-zod, tRPC, React Hook Form, TanStack Query)
- `consolidated-architecture-and-requirements-reference-iteration-3.md` — Parts 4, 5, 9, 10, 11, 12 (document types, numbering, module boundaries, design decisions, architectural invariants)
- `b4-workflow-engine-specification.md` — workflow enum definitions, step type semantics, instance/step status graphs
- `h2-document-type-catalog-with-jsonb-metadata-schemas.md` — per-document-type JSONB metadata schemas and non-JSONB column list

## Table of Contents

- [L89–L106] About This Document — Catalog role as the single source of truth for all shared Zod schemas and type safety chain.
- [L107–L168] Conventions — Prefix conventions, layer symbols, sensitive field restrictions, and file structure inside the shared package.
- [L169–L372] Part 1 — Common / Utility Schemas — Reusable schemas for identifiers, pagination, dates, API errors, and pre-signed S3 file upload requests.
  - [L175–L187] `UuidSchema` — Standard UUID v4 validation schema for primary keys and cross-schema references.
  - [L188–L200] `TimestampSchema` — ISO 8601 datetime validation with timezone offset mapping to database TIMESTAMPTZ columns.
  - [L201–L215] `DateSchema` — YYYY-MM-DD date-only validation schema mapping to database DATE columns.
  - [L216–L236] `PaginationInputSchema` — Standard cursor-based pagination parameters limit (1 to 100) and UUID cursor for list endpoints.
  - [L237–L252] `OffsetPaginationInputSchema` — Offset-based pagination schema for reports and exports.
  - [L253–L263] `SortOrderSchema` — Enum validator for sorting direction defaulting to ascending order.
  - [L264–L284] `DateRangeSchema` — Date range filter ensuring start date does not succeed end date.
  - [L285–L301] `PaginatedResponseSchema` — Generic wrapper schema for paginated API list responses.
  - [L302–L316] `IdParamsSchema` — Path parameter validator containing a single UUID identifier.
  - [L317–L333] `ApiErrorSchema` — Standardized error payload schema for all REST and tRPC error responses.
  - [L334–L372] `PresignedUploadRequestSchema` / `PresignedUploadResponseSchema` — File upload request and response contracts specifying allowed MIME types and a 25MB file size limit.
- [L373–L732] Part 2 — IAM Domain — User profiles, credentials, logins, MFA setup, role-based access control, and active session tracking.
  - [L380–L426] Enum Schemas — Enumerations for user status, MFA types, session termination reasons, and permission decisions.
  - [L427–L540] User Schemas — User selection, registration inputs, updates, search filters, and summary entities.
  - [L541–L613] Auth Schemas — Credentials validation, authentication payloads, password changes, and TOTP MFA registration.
  - [L614–L732] Role and Permission Schemas — Role definitions, permissions matrices, system role creation, assignment workflows, and active session details.
- [L733–L1185] Part 3 — Organization Domain — Municipal office hierarchy, staff positions, employee records, job assignments, committee rosters, and authority delegation.
  - [L740–L776] Enum Schemas — Enumerations for user status, MFA types, session termination reasons, and permission decisions.
  - [L777–L873] Office Schemas — Office properties, parent-child hierarchies, creation inputs, modification validation, and list filters.
  - [L874–L910] Position Schemas — Department job positions and authority levels creation schemas.
  - [L911–L979] Employee Schemas — Employee profile details, creation validations, and summaries for committee and workflow rosters.
  - [L980–L1026] Assignment Schemas — Job assignments linking employees to specific offices and positions with date limits.
  - [L1027–L1088] Committee Schemas — Committee detail forms, member assignments, roles, and creation schemas.
  - [L1089–L1185] Delegation Schemas — Authorization grants delegating power from one official to another based on designations.
- [L1186–L1744] Part 4 — Documents Domain — Central document record, version history, attachments, signature tracking, numbering series, and provincial review actions.
  - [L1193–L1309] Enum Schemas — Enumerations for user status, MFA types, session termination reasons, and permission decisions.
  - [L1310–L1355] Document Type Schemas — Definitions of system-supported document types, classification defaults, and metadata structure.
  - [L1356–L1493] Core Document Schemas — Main document attributes, registration inputs, cancellation flows, and search criteria.
  - [L1494–L1540] Version Schemas — Document file versions, S3 key references, page counts, and OCR status.
  - [L1541–L1581] Attachment Schemas — Supplemental document attachments, upload payloads, and attachment types classification.
  - [L1582–L1625] Number Schemas — Assignment history for preliminary and immutable final numbers of a document.
  - [L1626–L1670] Signature Schemas — Digital and wet-ink signature entries containing signer names and image references.
  - [L1671–L1744] Panlalawigan Review Schemas — Provincial board reviews, transmittal timelines, and outcome logs for resolutions or ordinances.
- [L1745–L2161] Part 5 — Document Metadata Schemas — Specific JSONB schemas validating attributes of all document types, including ordinances, resolutions, and complaints.
  - [L1753–L1806] Shared Sub-schemas — Reusable metadata components for sponsors, legislative readings, mayor actions, veto overrides, and publications.
  - [L1807–L1848] `SpResolutionMetadataSchema` — Metadata for Sangguniang Panlungsod resolutions including readings, sponsors, and urgency paths.
  - [L1849–L1880] `SpOrdinanceMetadataSchema` — Metadata for legislative ordinances requiring three readings and publication details.
  - [L1881–L1897] `AppropriationOrdinanceMetadataSchema` — Sub-type of ordinances validating fiscal year budget details and appropriation totals.
  - [L1898–L1917] `CertificationOfUrgencyMetadataSchema` — Metadata documenting urgency certifications covering one or more active legislative measures.
  - [L1918–L1969] `CitizenComplaintMetadataSchema` — Form fields for public complaints against personnel or services, incident locations, and outcomes.
  - [L1970–L1998] `DocumentRequestFormMetadataSchema` — Data structures for public copy requests, officer collections, and multi-signature approvals.
  - [L1999–L2134] Phase 1B Document Type Metadata Schemas — Metadata schemas for letters, memos, hearings, special sessions, and delegations reserved for Phase 1B.
  - [L2135–L2161] Discriminated Metadata Union — Discriminator union matching a document type code to its corresponding metadata schema.
- [L2162–L2453] Part 6 — Workflow Domain — Actionable workflow definitions, step types, progress instances, committee report submissions, and bypass records.
  - [L2169–L2235] Enum Schemas — Enumerations for user status, MFA types, session termination reasons, and permission decisions.
  - [L2236–L2281] Workflow Definition Schemas — Template patterns and configured steps for routing specific document lifecycle workflows.
  - [L2282–L2453] Workflow Instance Schemas — Real-time workflow states, action inputs, committee submissions, bypass actions, and event history.
- [L2454–L2560] Part 7 — Tracking Domain — QR tracking scanners, routing history, and custody verification inputs for physical documents.
  - [L2460–L2502] `QrCodeScanResultSchema` — Response — Response payload returned on QR code scan containing document metadata and routing history.
  - [L2503–L2540] `RoutingEntrySelectSchema` — Select (Append-only) — Append-only routing events tracking transfer logs between departments.
  - [L2541–L2560] `TrackingRecordSelectSchema` — Select — Combined tracking records detailing physical custody status and complete routing history.
- [L2561–L2656] Part 8 — Records Domain — Document retention policies, archive inventory logs, and bulk archiving tools for records officers.
- [L2657–L2734] Part 9 — Notifications Domain — In-app alerts, read markers, search criteria, and SSE stream envelopes for real-time notifications.
- [L2735–L2798] Part 10 — Audit Domain — Tamper-evident, read-only system audit logs containing hashes, actions, and filtering mechanisms.
- [L2799–L2914] Part 11 — Session Attendance — Council session attendance records, legislative quorum enforcement, and planned legislative session orders.
  - [L2807–L2819] `AttendanceStatusSchema` — Enumerated presence, official business, and excused or unexcused absence validators.
  - [L2820–L2850] `SpSessionSelectSchema` — Select — Details of SP session dates, attendee list, and quorum metrics.
  - [L2851–L2878] `CreateSpSessionInputSchema` — Input — Form for initiating a session requiring quorum validation of at least seven present members.
  - [L2879–L2914] `OrderOfBusinessSchema` — Response — Scheduled reading items and red-flag indicator details for SP Secretary dashboards.
- [L2915–L2986] Part 12 — Dashboard Schemas — Aggregated summaries, SLA task warnings, and action lists for secretary and mayor roles.
- [L2987–L3100] Part 13 — Layer Consumption Summary Matrix — Matrix matching all catalogued schemas to their usage across application execution layers.
- [L3101–L3115] Part 14 — Naming Conventions — Rules and suffix standardizations for naming input, filter, response, and select schemas.
- [L3116–L3167] Part 15 — Import and Export Conventions — Barrel export setup in packages/shared and consumer import examples for backend and frontend.
- [L3168–L3190] Part 16 — Schema Enforcement Rules — Governance policies Drizzle derivations, sensitive column exclusions, and validation constraints.

---

---

## About This Document

This catalog is the single source of truth for every Zod schema that resides in `/packages/shared`. Per the type safety chain in `tech-stack.md`:

```
Drizzle schema (PostgreSQL)
  └─▶ drizzle-zod → Zod schemas
        └─▶ /packages/shared  ◀── this document
              ├─▶ Fastify route validation (fastify-type-provider-zod)
              ├─▶ tRPC procedure input validation
              ├─▶ React Hook Form validation (@hookform/resolvers/zod)
              └─▶ TanStack Query response types
```

A DB schema change propagates as a compile error to every layer. No layer may define its own copy of a schema catalogued here. A PR that introduces a locally-defined entity schema in `/apps/web` or `/apps/server` without a corresponding entry in this catalog fails review.

---

## Conventions

### Schema Type Tags

| Tag | Description |
|-----|-------------|
| **Select** | Full entity shape derived from `drizzle-zod`'s `createSelectSchema()`. Used as response types. Never includes sensitive fields (`password_hash`, `session_token_hash`, `secret_encrypted`). |
| **Insert** | DB insert shape from `createInsertSchema()`. Used only in the backend repository layer. **Not exported from `/packages/shared`**. |
| **Input** | Custom client-input schema for a user-initiated operation. Validates form submissions and tRPC/REST request bodies. Often differs from the Insert schema (e.g. the client sends `password`; the Insert schema stores `password_hash`). |
| **Filter** | Query-parameter schema for list endpoints. All fields optional. |
| **Response** | Composite schema assembling multiple entities for a specific API payload (e.g. dashboard). Not directly a DB entity row. |
| **Params** | Path/route parameter schema (e.g. `{ id: UuidSchema }`). Used by both tRPC and REST. |

### Layer Consumption Notation

| Symbol | Layer |
|--------|-------|
| **[B]** | Backend validation — Fastify route schema via `fastify-type-provider-zod`; also REST-specific middleware |
| **[T]** | tRPC procedure input — the `.input(schema)` call on a procedure |
| **[F]** | React Hook Form — passed to `useForm({ resolver: zodResolver(schema) })` |
| **[R]** | TanStack Query response type — inferred as `TData` from a query or mutation |

A schema tagged **[T]** is also used by the backend tRPC handler for validation, so it covers **[B]** implicitly. They are distinguished when a REST endpoint uses the same schema independently.

### Sensitive Field Policy

The following database columns are **never** included in any schema exported from `/packages/shared`:

| Column | Table | Reason |
|--------|-------|--------|
| `password_hash` | `iam.credentials` | Argon2id hash; never transmitted |
| `session_token_hash` | `iam.sessions` | Raw token; never transmitted |
| `secret_encrypted` | `iam.mfa_records` | Encrypted TOTP secret; never transmitted |
| `ocr_text` | `documents.versions` | Large blob; streamed separately on demand |

### File Organization in `/packages/shared`

```
/packages/shared/src/
  schemas/
    common.ts            — UUIDs, pagination, dates, API envelopes
    iam.ts               — IAM domain
    organization.ts      — Organization domain
    documents.ts         — Document core, numbering, versions, signatures
    document-metadata.ts — Per-document-type JSONB metadata schemas
    workflow.ts          — Workflow engine
    tracking.ts          — DTS / QR codes / routing
    records.ts           — Records management
    notifications.ts     — In-app notifications and SSE
    audit.ts             — Audit log (read-only)
    attendance.ts        — SP session attendance and Order of Business
    dashboard.ts         — Dashboard payload schemas
  enums/
    iam.ts
    organization.ts
    documents.ts
    workflow.ts
  index.ts               — Barrel export (all public exports)
```

---

## Part 1 — Common / Utility Schemas

**File:** `packages/shared/src/schemas/common.ts`

---

### `UuidSchema`

> Single UUID v4 string. Used wherever a primary key or cross-schema reference appears in an API input or response.

```typescript
export const UuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof UuidSchema>;
```

**Layers:** [B] [T] [F] [R]

---

### `TimestampSchema`

> ISO 8601 datetime string with timezone offset. Maps to PostgreSQL `TIMESTAMPTZ`. The server always returns UTC; the frontend localises display to `Asia/Manila` via `date-fns`.

```typescript
export const TimestampSchema = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;
```

**Layers:** [R]

---

### `DateSchema`

> ISO 8601 date-only string `YYYY-MM-DD`. Maps to PostgreSQL `DATE`.

```typescript
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date — expected YYYY-MM-DD");
export type DateString = z.infer<typeof DateSchema>;
```

**Layers:** [B] [T] [F] [R]

---

### `PaginationInputSchema`

> Standard cursor-based pagination parameters for all list endpoints.

| Field | Zod Type | Validation | Notes |
|-------|----------|------------|-------|
| `cursor` | `UuidSchema` | optional | UUID of the last item from the previous page |
| `limit` | `z.number().int()` | min 1, max 100, default 25 | |

```typescript
export const PaginationInputSchema = z.object({
  cursor: UuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(25),
});
export type PaginationInput = z.infer<typeof PaginationInputSchema>;
```

**Layers:** [B] [T]

---

### `OffsetPaginationInputSchema`

> Offset-based pagination used for reports and exports where cursor pagination does not apply.

```typescript
export const OffsetPaginationInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
});
export type OffsetPaginationInput = z.infer<typeof OffsetPaginationInputSchema>;
```

**Layers:** [B] [T]

---

### `SortOrderSchema`

```typescript
export const SortOrderSchema = z.enum(["asc", "desc"]).default("asc");
export type SortOrder = z.infer<typeof SortOrderSchema>;
```

**Layers:** [B] [T]

---

### `DateRangeSchema`

> Inclusive date range filter. Both bounds are optional to allow open-ended ranges.

```typescript
export const DateRangeSchema = z
  .object({
    from: DateSchema.optional(),
    to:   DateSchema.optional(),
  })
  .refine(
    (v) => !(v.from && v.to) || v.from <= v.to,
    { message: "'from' must not be later than 'to'" }
  );
export type DateRange = z.infer<typeof DateRangeSchema>;
```

**Layers:** [B] [T] [F]

---

### `PaginatedResponseSchema`

> Generic paginated list wrapper. Usage: `PaginatedResponseSchema(DocumentSummarySchema)`.

```typescript
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items:      z.array(itemSchema),
    nextCursor: UuidSchema.nullable(),
    total:      z.number().int().nonnegative(),
  });
```

**Layers:** [R]

---

### `IdParamsSchema`

> Path parameters for `/:id` routes.

```typescript
export const IdParamsSchema = z.object({
  id: UuidSchema,
});
export type IdParams = z.infer<typeof IdParamsSchema>;
```

**Layers:** [B] [T]

---

### `ApiErrorSchema`

> Standard error body returned by all Fastify error responses.

```typescript
export const ApiErrorSchema = z.object({
  code:    z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
```

**Layers:** [R]

---

### `PresignedUploadRequestSchema` / `PresignedUploadResponseSchema`

> Client requests a pre-signed S3 upload URL before sending a file. Applies to all document upload operations. Files are streamed directly to S3-compatible storage per the file storage strategy — they never pass through the application server.

| Field | Zod Type | Validation | Notes |
|-------|----------|------------|-------|
| `filename` | `z.string()` | max 512 | Original filename for display; UUID key assigned server-side |
| `mimeType` | `z.enum([...])` | PDF, DOCX, XLSX, PNG, JPG only | Per stack constraint |
| `fileSizeBytes` | `z.number().int()` | positive, max 26,214,400 (25 MB) | Configurable via env but validated here at the default cap |

```typescript
export const AllowedMimeTypeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

export const PresignedUploadRequestSchema = z.object({
  filename:      z.string().max(512),
  mimeType:      AllowedMimeTypeSchema,
  fileSizeBytes: z.number().int().positive().max(26_214_400),
});

export const PresignedUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  s3Key:     z.string().min(1),
  expiresAt: TimestampSchema,
});

export type PresignedUploadRequest  = z.infer<typeof PresignedUploadRequestSchema>;
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;
```

**Layers:** [B] [T] [R]

---

## Part 2 — IAM Domain

**File:** `packages/shared/src/schemas/iam.ts`
**File:** `packages/shared/src/enums/iam.ts`

---

### Enum Schemas

#### `UserStatusSchema`

```typescript
export const UserStatusSchema = z.enum(["active", "inactive", "suspended", "deactivated"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;
```

**Source:** `iam.user_status_enum` | **Layers:** [B] [T] [F] [R]

---

#### `MfaTypeSchema`

```typescript
export const MfaTypeSchema = z.enum(["totp"]);
export type MfaType = z.infer<typeof MfaTypeSchema>;
```

**Source:** `iam.mfa_type_enum` | **Layers:** [B] [R]
**Note:** Single-value enum in Phase 1. Expand only via a developer-tier schema migration (Part 11.21 of the consolidated reference).

---

#### `SessionTerminationReasonSchema`

```typescript
export const SessionTerminationReasonSchema = z.enum(["user_logout", "forced", "timeout"]);
export type SessionTerminationReason = z.infer<typeof SessionTerminationReasonSchema>;
```

**Source:** `iam.session_termination_reason_enum` | **Layers:** [R]

---

#### `PermissionDecisionSchema`

```typescript
export const PermissionDecisionSchema = z.enum(["allow", "deny", "conditional"]);
export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;
```

**Source:** `iam.permission_decision_enum` | **Layers:** [B] [T] [R]

---

### User Schemas

#### `UserSelectSchema` — Select

> Full user entity as returned by the API. Excludes `city_id` (inferred from session) and sensitive credential fields.

| Field | Zod Type | Notes |
|-------|----------|-------|
| `id` | `UuidSchema` | PK |
| `username` | `z.string()` | Unique per city |
| `email` | `z.string()` | Unique per city |
| `status` | `UserStatusSchema` | |
| `mfaEnabled` | `z.boolean()` | |
| `createdAt` | `TimestampSchema` | |
| `updatedAt` | `TimestampSchema` | |

```typescript
export const UserSelectSchema = z.object({
  id:         UuidSchema,
  username:   z.string().min(3).max(64),
  email:      z.string().email().max(254),
  status:     UserStatusSchema,
  mfaEnabled: z.boolean(),
  createdAt:  TimestampSchema,
  updatedAt:  TimestampSchema,
});
export type UserSelect = z.infer<typeof UserSelectSchema>;
```

**Layers:** [R]

---

#### `UserSummarySchema` — Response

> Lightweight user reference used in nested objects (e.g. "created by", "assigned by") to avoid sending the full entity in lists.

```typescript
export const UserSummarySchema = z.object({
  id:          UuidSchema,
  username:    z.string(),
  displayName: z.string(), // computed: employee first+last name, or username fallback
});
export type UserSummary = z.infer<typeof UserSummarySchema>;
```

**Layers:** [R]

---

#### `CreateUserInputSchema` — Input

> Platform Administrator creates a new system user. Password is Argon2id-hashed server-side; the plain-text value is never stored.

| Field | Zod Type | Validation | Notes |
|-------|----------|------------|-------|
| `username` | `z.string()` | min 3, max 64, `^[a-z0-9_.\-]+$` | Lowercase alphanumeric + `_ . -` |
| `email` | `z.string()` | `.email()`, max 254 | |
| `initialPassword` | `z.string()` | min 12, max 128 | |
| `status` | `UserStatusSchema` | default `'active'` | |

```typescript
export const CreateUserInputSchema = z.object({
  username:        z.string().min(3).max(64).trim()
                    .regex(/^[a-z0-9_.\-]+$/, "Username: a-z, 0-9, _, ., - only"),
  email:           z.string().email().max(254),
  initialPassword: z.string().min(12).max(128),
  status:          UserStatusSchema.default("active"),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `UpdateUserInputSchema` — Input

```typescript
export const UpdateUserInputSchema = z
  .object({
    username: z.string().min(3).max(64).trim().optional(),
    email:    z.string().email().max(254).optional(),
    status:   UserStatusSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `UserFilterSchema` — Filter

```typescript
export const UserFilterSchema = z.object({
  status:   UserStatusSchema.optional(),
  officeId: UuidSchema.optional(),
  roleCode: z.string().optional(),
  search:   z.string().max(100).optional(),
  sortBy:   z.enum(["username", "email", "createdAt", "status"]).default("username"),
  sortOrder: SortOrderSchema,
  ...PaginationInputSchema.shape,
});
export type UserFilter = z.infer<typeof UserFilterSchema>;
```

**Layers:** [B] [T]

---

### Auth Schemas

#### `LoginInputSchema` — Input

```typescript
export const LoginInputSchema = z.object({
  username: z.string().min(1).trim(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;
```

**Layers:** [B] [T] [F]
**Note:** Password length is only validated for non-emptiness here. Strength rules apply at creation/change time only.

---

#### `AuthResponseSchema` — Response

> Tokens are delivered via HTTP-only cookies per the auth architecture; the response body carries only identity data for display.

```typescript
export const AuthResponseSchema = z.object({
  user:      UserSelectSchema,
  sessionId: UuidSchema,
  expiresAt: TimestampSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
```

**Layers:** [B] [R]

---

#### `ChangePasswordInputSchema` — Input

```typescript
export const ChangePasswordInputSchema = z
  .object({
    currentPassword:    z.string().min(1),
    newPassword:        z.string().min(12).max(128),
    confirmNewPassword: z.string().min(12).max(128),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "New password must differ from current password",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `SetupTotpInputSchema` — Input

> MFA setup schema. Phase 2 enforcement; schema reserved in Phase 1 per L1 §6.5 so the auth flow can be built against it from day one.

```typescript
export const SetupTotpInputSchema = z.object({
  totpCode: z.string().length(6).regex(/^\d{6}$/, "TOTP code must be 6 digits"),
});
export type SetupTotpInput = z.infer<typeof SetupTotpInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Role and Permission Schemas

#### `RoleSelectSchema` — Select

```typescript
export const RoleSelectSchema = z.object({
  id:           UuidSchema,
  name:         z.string().min(1).max(128),
  code:         z.string().min(1).max(64),
  description:  z.string().nullable(),
  isSystemRole: z.boolean(),
  createdAt:    TimestampSchema,
  updatedAt:    TimestampSchema,
});
export type RoleSelect = z.infer<typeof RoleSelectSchema>;
```

**Layers:** [R]

---

#### `PermissionSelectSchema` — Select

```typescript
export const PermissionSelectSchema = z.object({
  id:          UuidSchema,
  resource:    z.string().min(1).max(128),
  action:      z.string().min(1).max(64),
  description: z.string().nullable(),
});
export type PermissionSelect = z.infer<typeof PermissionSelectSchema>;
```

**Layers:** [R]

---

#### `CreateRoleInputSchema` — Input

```typescript
export const CreateRoleInputSchema = z.object({
  name:        z.string().min(1).max(128).trim(),
  code:        z.string().min(1).max(64).trim()
                .regex(/^[A-Z0-9_]+$/, "Role code must be UPPER_SNAKE_CASE"),
  description: z.string().max(512).optional(),
  permissions: z
    .array(z.object({
      permissionId:       UuidSchema,
      decision:           PermissionDecisionSchema.default("allow"),
      conditionReference: z.string().optional(),
    }))
    .min(1, "At least one permission required"),
});
export type CreateRoleInput = z.infer<typeof CreateRoleInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `AssignRoleInputSchema` — Input

```typescript
export const AssignRoleInputSchema = z.object({
  userId:        UuidSchema,
  roleId:        UuidSchema,
  officeScopeId: UuidSchema.optional(),
});
export type AssignRoleInput = z.infer<typeof AssignRoleInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `RoleAssignmentSelectSchema` — Select

```typescript
export const RoleAssignmentSelectSchema = z.object({
  id:            UuidSchema,
  userId:        UuidSchema,
  roleId:        UuidSchema,
  role:          RoleSelectSchema,
  officeScopeId: UuidSchema.nullable(),
  assignedBy:    UuidSchema.nullable(),
  assignedAt:    TimestampSchema,
  revokedAt:     TimestampSchema.nullable(),
  revokedBy:     UuidSchema.nullable(),
  isActive:      z.boolean(),
});
export type RoleAssignmentSelect = z.infer<typeof RoleAssignmentSelectSchema>;
```

**Layers:** [R]

---

#### `SessionSelectSchema` — Select

> Active session metadata for the admin "force logout" UI. Excludes `session_token_hash`.

```typescript
export const SessionSelectSchema = z.object({
  id:                 UuidSchema,
  userId:             UuidSchema,
  ipAddress:          z.string().nullable(),
  userAgent:          z.string().nullable(),
  expiresAt:          TimestampSchema,
  terminatedAt:       TimestampSchema.nullable(),
  terminationReason:  SessionTerminationReasonSchema.nullable(),
  createdAt:          TimestampSchema,
});
export type SessionSelect = z.infer<typeof SessionSelectSchema>;
```

**Layers:** [R]

---

## Part 3 — Organization Domain

**File:** `packages/shared/src/schemas/organization.ts`
**File:** `packages/shared/src/enums/organization.ts`

---

### Enum Schemas

#### `OfficeTypeSchema`

```typescript
export const OfficeTypeSchema = z.enum([
  "sp_office", "mayors_office", "city_department", "barangay", "other",
]);
export type OfficeType = z.infer<typeof OfficeTypeSchema>;
```

**Source:** `organization.office_type_enum` | **Layers:** [B] [T] [F] [R]

---

#### `AuthorityLevelSchema`

```typescript
export const AuthorityLevelSchema = z.enum(["executive", "managerial", "staff", "support"]);
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>;
```

**Source:** `organization.authority_level_enum` | **Layers:** [B] [T] [F] [R]

---

#### `CommitteeRoleSchema`

```typescript
export const CommitteeRoleSchema = z.enum(["chairman", "vice_chairman", "member"]);
export type CommitteeRole = z.infer<typeof CommitteeRoleSchema>;
```

**Source:** `organization.committee_role_enum` | **Layers:** [B] [T] [F] [R]

---

### Office Schemas

#### `OfficeSelectSchema` — Select

| Field | Zod Type | Notes |
|-------|----------|-------|
| `id` | `UuidSchema` | |
| `name` | `z.string()` | max 256 |
| `code` | `z.string()` | max 32; unique per city |
| `officeType` | `OfficeTypeSchema` | |
| `parentOfficeId` | `UuidSchema.nullable()` | Self-referential hierarchy |
| `createdAt` | `TimestampSchema` | |
| `updatedAt` | `TimestampSchema` | |

```typescript
export const OfficeSelectSchema = z.object({
  id:             UuidSchema,
  name:           z.string().min(1).max(256),
  code:           z.string().min(1).max(32),
  officeType:     OfficeTypeSchema,
  parentOfficeId: UuidSchema.nullable(),
  createdAt:      TimestampSchema,
  updatedAt:      TimestampSchema,
});
export type OfficeSelect = z.infer<typeof OfficeSelectSchema>;
```

**Layers:** [R]

---

#### `OfficeSummarySchema` — Response

> Lightweight reference used in nested objects.

```typescript
export const OfficeSummarySchema = z.object({
  id:         UuidSchema,
  name:       z.string(),
  code:       z.string(),
  officeType: OfficeTypeSchema,
});
export type OfficeSummary = z.infer<typeof OfficeSummarySchema>;
```

**Layers:** [R]

---

#### `CreateOfficeInputSchema` — Input

```typescript
export const CreateOfficeInputSchema = z.object({
  name:           z.string().min(1).max(256).trim(),
  code:           z.string().min(1).max(32).trim().toUpperCase(),
  officeType:     OfficeTypeSchema,
  parentOfficeId: UuidSchema.optional(),
});
export type CreateOfficeInput = z.infer<typeof CreateOfficeInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `UpdateOfficeInputSchema` — Input

```typescript
export const UpdateOfficeInputSchema = CreateOfficeInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });
export type UpdateOfficeInput = z.infer<typeof UpdateOfficeInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `OfficeFilterSchema` — Filter

```typescript
export const OfficeFilterSchema = z.object({
  officeType:      OfficeTypeSchema.optional(),
  parentOfficeId:  UuidSchema.optional(),
  search:          z.string().max(100).optional(),
  includeInactive: z.boolean().default(false),
  sortBy:          z.enum(["name", "code", "officeType"]).default("name"),
  sortOrder:       SortOrderSchema,
  ...PaginationInputSchema.shape,
});
export type OfficeFilter = z.infer<typeof OfficeFilterSchema>;
```

**Layers:** [B] [T]

---

### Position Schemas

#### `PositionSelectSchema` — Select

```typescript
export const PositionSelectSchema = z.object({
  id:             UuidSchema,
  officeId:       UuidSchema,
  title:          z.string().min(1).max(256),
  code:           z.string().min(1).max(64),
  authorityLevel: AuthorityLevelSchema,
  createdAt:      TimestampSchema,
  updatedAt:      TimestampSchema,
});
export type PositionSelect = z.infer<typeof PositionSelectSchema>;
```

**Layers:** [R]

---

#### `CreatePositionInputSchema` — Input

```typescript
export const CreatePositionInputSchema = z.object({
  officeId:       UuidSchema,
  title:          z.string().min(1).max(256).trim(),
  code:           z.string().min(1).max(64).trim().toUpperCase(),
  authorityLevel: AuthorityLevelSchema,
});
export type CreatePositionInput = z.infer<typeof CreatePositionInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Employee Schemas

#### `EmployeeSelectSchema` — Select

| Field | Zod Type | Notes |
|-------|----------|-------|
| `id` | `UuidSchema` | |
| `userId` | `UuidSchema.nullable()` | NULL for Barangay officials (no system access in Phase 1) |
| `employeeNumber` | `z.string().nullable()` | |
| `firstName` | `z.string()` | max 128 |
| `lastName` | `z.string()` | max 128 |
| `email` | `z.string().nullable()` | |
| `phoneNumber` | `z.string().nullable()` | |

```typescript
export const EmployeeSelectSchema = z.object({
  id:             UuidSchema,
  userId:         UuidSchema.nullable(),
  employeeNumber: z.string().nullable(),
  firstName:      z.string().min(1).max(128),
  lastName:       z.string().min(1).max(128),
  email:          z.string().email().nullable(),
  phoneNumber:    z.string().max(32).nullable(),
  createdAt:      TimestampSchema,
  updatedAt:      TimestampSchema,
});
export type EmployeeSelect = z.infer<typeof EmployeeSelectSchema>;
```

**Layers:** [R]

---

#### `EmployeeSummarySchema` — Response

> Lightweight reference for display in document headers, committee rosters, and workflow step assignee lists.

```typescript
export const EmployeeSummarySchema = z.object({
  id:          UuidSchema,
  displayName: z.string(), // computed: "Hon. First Last" for SP members; "First Last" otherwise
  position:    z.string().optional(),
  officeCode:  z.string().optional(),
});
export type EmployeeSummary = z.infer<typeof EmployeeSummarySchema>;
```

**Layers:** [R]

---

#### `CreateEmployeeInputSchema` — Input

```typescript
export const CreateEmployeeInputSchema = z.object({
  userId:         UuidSchema.optional(),
  employeeNumber: z.string().max(32).optional(),
  firstName:      z.string().min(1).max(128).trim(),
  lastName:       z.string().min(1).max(128).trim(),
  email:          z.string().email().max(254).optional(),
  phoneNumber:    z.string().max(32).optional(),
});
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Assignment Schemas

#### `AssignmentSelectSchema` — Select

```typescript
export const AssignmentSelectSchema = z.object({
  id:         UuidSchema,
  employeeId: UuidSchema,
  employee:   EmployeeSummarySchema,
  positionId: UuidSchema,
  position:   PositionSelectSchema,
  officeId:   UuidSchema,
  office:     OfficeSummarySchema,
  startDate:  DateSchema,
  endDate:    DateSchema.nullable(),
  isActive:   z.boolean(),
  createdAt:  TimestampSchema,
});
export type AssignmentSelect = z.infer<typeof AssignmentSelectSchema>;
```

**Layers:** [R]

---

#### `CreateAssignmentInputSchema` — Input

```typescript
export const CreateAssignmentInputSchema = z
  .object({
    employeeId: UuidSchema,
    positionId: UuidSchema,
    officeId:   UuidSchema,
    startDate:  DateSchema,
    endDate:    DateSchema.optional(),
  })
  .refine(
    (v) => !v.endDate || v.endDate >= v.startDate,
    { message: "endDate must not be before startDate", path: ["endDate"] }
  );
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Committee Schemas

#### `CommitteeSelectSchema` — Select

```typescript
export const CommitteeSelectSchema = z.object({
  id:                    UuidSchema,
  name:                  z.string().min(1).max(256),
  code:                  z.string().min(1).max(64),
  chairedByEmployeeId:   UuidSchema.nullable(),
  chair:                 EmployeeSummarySchema.nullable(),
  createdAt:             TimestampSchema,
  updatedAt:             TimestampSchema,
});
export type CommitteeSelect = z.infer<typeof CommitteeSelectSchema>;
```

**Layers:** [R]

---

#### `CommitteeMemberSchema` / `CommitteeWithMembersSchema` — Response

```typescript
export const CommitteeMemberSchema = z.object({
  id:            UuidSchema,
  employee:      EmployeeSummarySchema,
  committeeRole: CommitteeRoleSchema,
  startDate:     DateSchema,
  isActive:      z.boolean(),
});

export const CommitteeWithMembersSchema = CommitteeSelectSchema.extend({
  members: z.array(CommitteeMemberSchema),
});
export type CommitteeWithMembers = z.infer<typeof CommitteeWithMembersSchema>;
```

**Layers:** [R]

---

#### `CreateCommitteeInputSchema` — Input

```typescript
export const CreateCommitteeInputSchema = z.object({
  name:                z.string().min(1).max(256).trim(),
  code:                z.string().min(1).max(64).trim().toUpperCase(),
  chairedByEmployeeId: UuidSchema.optional(),
  members: z.array(z.object({
    employeeId:    UuidSchema,
    committeeRole: CommitteeRoleSchema,
    startDate:     DateSchema,
  })).optional(),
});
export type CreateCommitteeInput = z.infer<typeof CreateCommitteeInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Delegation Schemas

#### `DelegationGrantSelectSchema` — Select

> Reflects the `organization.delegation_grants` table. One active delegation per person is enforced by a DB partial unique index (Architectural Invariant #16).

| Field | Zod Type | Notes |
|-------|----------|-------|
| `id` | `UuidSchema` | |
| `designationDocumentId` | `UuidSchema` | The `D {YEAR}-{NN}` document evidencing this grant |
| `delegatingEmployeeId` | `UuidSchema` | |
| `delegatedToEmployeeId` | `UuidSchema` | |
| `officeId` | `UuidSchema` | |
| `positionId` | `UuidSchema` | |
| `scopeDescription` | `z.string()` | |
| `legalBasis` | `z.string().nullable()` | |
| `validFrom` | `DateSchema` | Open-ended delegations prohibited |
| `validUntil` | `DateSchema` | NOT NULL — open-ended prohibited |
| `isActive` | `z.boolean()` | |
| `revokedAt` | `TimestampSchema.nullable()` | |
| `revokedBy` | `UuidSchema.nullable()` | |

```typescript
export const DelegationGrantSelectSchema = z.object({
  id:                      UuidSchema,
  designationDocumentId:   UuidSchema,
  delegatingEmployeeId:    UuidSchema,
  delegatingEmployee:      EmployeeSummarySchema,
  delegatedToEmployeeId:   UuidSchema,
  delegatedToEmployee:     EmployeeSummarySchema,
  officeId:                UuidSchema,
  office:                  OfficeSummarySchema,
  positionId:              UuidSchema,
  position:                PositionSelectSchema,
  scopeDescription:        z.string(),
  legalBasis:              z.string().nullable(),
  validFrom:               DateSchema,
  validUntil:              DateSchema,
  isActive:                z.boolean(),
  revokedAt:               TimestampSchema.nullable(),
  revokedBy:               UuidSchema.nullable(),
  createdAt:               TimestampSchema,
  updatedAt:               TimestampSchema,
});
export type DelegationGrantSelect = z.infer<typeof DelegationGrantSelectSchema>;
```

**Layers:** [R]

---

#### `LogDelegationInputSchema` — Input

> Secretariat logs a received Designation document. The `delegationGrantId` is the just-created `delegation_grants` row. Immediately effective — no Platform Administrator confirmation step (consolidated reference Part 4.12, Interview 2).

```typescript
export const LogDelegationInputSchema = z
  .object({
    designationDocumentId:   UuidSchema,
    delegatingEmployeeId:    UuidSchema,
    delegatedToEmployeeId:   UuidSchema,
    officeId:                UuidSchema,
    positionId:              UuidSchema,
    scopeDescription:        z.string().min(1).max(1024).trim(),
    legalBasis:              z.string().max(512).optional(),
    validFrom:               DateSchema,
    validUntil:              DateSchema,
  })
  .refine(
    (v) => v.delegatingEmployeeId !== v.delegatedToEmployeeId,
    { message: "Delegating and delegated-to employees must differ", path: ["delegatedToEmployeeId"] }
  )
  .refine(
    (v) => v.validUntil >= v.validFrom,
    { message: "validUntil must not be before validFrom", path: ["validUntil"] }
  );
export type LogDelegationInput = z.infer<typeof LogDelegationInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `RevokeDelegationInputSchema` — Input

```typescript
export const RevokeDelegationInputSchema = z.object({
  delegationGrantId: UuidSchema,
  reason:            z.string().min(1).max(512).trim(),
});
export type RevokeDelegationInput = z.infer<typeof RevokeDelegationInputSchema>;
```

**Layers:** [B] [T] [F]

---

## Part 4 — Documents Domain

**File:** `packages/shared/src/schemas/documents.ts`
**File:** `packages/shared/src/enums/documents.ts`

---

### Enum Schemas

#### `LifecycleStateSchema`

```typescript
export const LifecycleStateSchema = z.enum([
  "draft", "submitted", "in_workflow", "pending_approval",
  "completed", "released", "archived", "disposed", "cancelled",
]);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;
```

**Source:** `documents.lifecycle_state_enum` | **Layers:** [B] [T] [F] [R]

---

#### `ClassificationLevelSchema`

```typescript
export const ClassificationLevelSchema = z.enum(["public", "internal", "confidential", "restricted"]);
export type ClassificationLevel = z.infer<typeof ClassificationLevelSchema>;
```

**Source:** `documents.classification_level_enum` | **Layers:** [B] [T] [F] [R]

---

#### `PublicVisibilityRuleSchema`

```typescript
export const PublicVisibilityRuleSchema = z.enum([
  "title_and_first_page_public",
  "not_public",
  "complainant_restricted",
  "requester_restricted",
]);
export type PublicVisibilityRule = z.infer<typeof PublicVisibilityRuleSchema>;
```

**Source:** `documents.public_visibility_rule_enum` | **Layers:** [B] [R]

---

#### `NumberTypeSchema`

```typescript
export const NumberTypeSchema = z.enum(["preliminary", "final"]);
export type NumberType = z.infer<typeof NumberTypeSchema>;
```

**Source:** `documents.number_type_enum` | **Layers:** [R]

---

#### `AttachmentTypeSchema`

```typescript
export const AttachmentTypeSchema = z.enum([
  "certification_of_urgency",
  "committee_report",
  "transmittal_letter",
  "scan",
  "other",
]);
export type AttachmentType = z.infer<typeof AttachmentTypeSchema>;
```

**Source:** `documents.attachment_type_enum` | **Layers:** [B] [T] [F] [R]

---

#### `SignatureTypeSchema`

```typescript
export const SignatureTypeSchema = z.enum([
  "presiding_officer",
  "mayor",
  "sp_secretary",
  "vice_mayor",
  "committee_chair",
]);
export type SignatureType = z.infer<typeof SignatureTypeSchema>;
```

**Source:** `documents.signature_type_enum` | **Layers:** [B] [T] [R]

---

#### `PanlalawiganOutcomeSchema`

```typescript
export const PanlalawiganOutcomeSchema = z.enum([
  "valid",
  "valid_in_part",
  "returned",
  "operative_in_its_entirety",
  "deemed_approved",
]);
export type PanlalawiganOutcome = z.infer<typeof PanlalawiganOutcomeSchema>;
```

**Source:** `documents.panlalawigan_outcome_enum` | **Layers:** [B] [T] [F] [R]
**Note:** `"operative_in_its_entirety"` applies specifically to Appropriation Ordinances and is synonymous with "valid/implementable" (consolidated reference Part 4.2).

---

#### `ScanQualityCategorySchema`

```typescript
export const ScanQualityCategorySchema = z.enum(["good", "fair", "poor"]);
export type ScanQualityCategory = z.infer<typeof ScanQualityCategorySchema>;
```

**Source:** `documents.scan_quality_category_enum` | **Layers:** [R]

---

### Document Type Schemas

#### `DocumentTypeSummarySchema` — Response

> Lightweight reference embedded in `DocumentSelectSchema` and list items.

```typescript
export const DocumentTypeSummarySchema = z.object({
  id:                   UuidSchema,
  name:                 z.string(),
  code:                 z.string(),
  classificationDefault: ClassificationLevelSchema,
  preliminaryNumbering: z.boolean(),
});
export type DocumentTypeSummary = z.infer<typeof DocumentTypeSummarySchema>;
```

**Layers:** [R]

---

#### `DocumentTypeSelectSchema` — Select

```typescript
export const DocumentTypeSelectSchema = z.object({
  id:                   UuidSchema,
  name:                 z.string(),
  code:                 z.string(),
  owningModule:         z.string(),
  numberSeriesId:       UuidSchema.nullable(),
  preliminaryNumbering: z.boolean(),
  controlNumberDeferred: z.boolean(),
  classificationDefault: ClassificationLevelSchema,
  publicVisibilityRule: PublicVisibilityRuleSchema,
  metadataSchema:       z.record(z.unknown()),
  isActive:             z.boolean(),
  createdAt:            TimestampSchema,
  updatedAt:            TimestampSchema,
});
export type DocumentTypeSelect = z.infer<typeof DocumentTypeSelectSchema>;
```

**Layers:** [R]

---

### Core Document Schemas

#### `DocumentSelectSchema` — Select

> Full document entity. The `metadata` field is `z.record(z.unknown())` here; callers requiring typed metadata use the per-type schemas from Part 5 (`document-metadata.ts`).

| Field | Zod Type | Notes |
|-------|----------|-------|
| `id` | `UuidSchema` | |
| `documentTypeId` | `UuidSchema` | |
| `documentType` | `DocumentTypeSummarySchema` | |
| `title` | `z.string()` | |
| `lifecycleState` | `LifecycleStateSchema` | |
| `classificationLevel` | `ClassificationLevelSchema` | |
| `qrTrackingNumber` | `UuidSchema` | Immutable UUID assigned at secretariat logging, before preliminary number |
| `preliminaryNumber` | `z.string().nullable()` | Mutable; cleared when final number assigned; mutually exclusive with `finalNumber` |
| `finalNumber` | `z.string().nullable()` | Immutable once set — DB trigger enforces this |
| `controlNumber` | `z.string().nullable()` | SPR/SPS/MO/MI tracking reference; may be deferred per `document_types.control_number_deferred` |
| `originatingOfficeId` | `UuidSchema` | SP Secretariat for SP-workflow docs; external sender for letters received |
| `ownedByOfficeId` | `UuidSchema` | |
| `createdBy` | `UuidSchema` | |
| `workflowInstanceId` | `UuidSchema.nullable()` | |
| `versionNumber` | `z.number().int()` | |
| `metadata` | `z.record(z.unknown())` | Narrowed per document type by callers |

```typescript
export const DocumentSelectSchema = z.object({
  id:                  UuidSchema,
  documentTypeId:      UuidSchema,
  documentType:        DocumentTypeSummarySchema,
  title:               z.string().min(1),
  lifecycleState:      LifecycleStateSchema,
  classificationLevel: ClassificationLevelSchema,
  qrTrackingNumber:    UuidSchema,
  preliminaryNumber:   z.string().nullable(),
  finalNumber:         z.string().nullable(),
  controlNumber:       z.string().nullable(),
  originatingOfficeId: UuidSchema,
  originatingOffice:   OfficeSummarySchema,
  ownedByOfficeId:     UuidSchema,
  createdBy:           UuidSchema,
  workflowInstanceId:  UuidSchema.nullable(),
  versionNumber:       z.number().int().min(1),
  metadata:            z.record(z.unknown()),
  createdAt:           TimestampSchema,
  updatedAt:           TimestampSchema,
});
export type DocumentSelect = z.infer<typeof DocumentSelectSchema>;
```

**Layers:** [R]

---

#### `DocumentSummarySchema` — Response

> Lightweight document reference for lists, dashboards, QR scan results, and nested objects.

```typescript
export const DocumentSummarySchema = z.object({
  id:               UuidSchema,
  title:            z.string(),
  documentTypeCode: z.string(),
  lifecycleState:   LifecycleStateSchema,
  preliminaryNumber: z.string().nullable(),
  finalNumber:      z.string().nullable(),
  qrTrackingNumber: UuidSchema,
  createdAt:        TimestampSchema,
  updatedAt:        TimestampSchema,
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;
```

**Layers:** [R]

---

#### `LogDocumentInputSchema` — Input

> Secretariat logs a received draft. Creates the `documents.documents` row, triggers QR assignment, and triggers preliminary number assignment (for types with `preliminary_numbering = true`). The `uploadedFile` is the S3 key from a completed presigned upload.

```typescript
export const LogDocumentInputSchema = z.object({
  documentTypeId:      UuidSchema,
  title:               z.string().min(1).max(1024).trim(),
  classificationLevel: ClassificationLevelSchema,
  originatingOfficeId: UuidSchema,
  ownedByOfficeId:     UuidSchema,
  metadata:            z.record(z.unknown()), // validated server-side against per-type schema
  uploadedFile: z.object({
    s3Key:         z.string().min(1),
    originalFilename: z.string().max(512),
    mimeType:      AllowedMimeTypeSchema,
    fileSizeBytes: z.number().int().positive().max(26_214_400),
  }),
});
export type LogDocumentInput = z.infer<typeof LogDocumentInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `DocumentFilterSchema` — Filter

```typescript
export const DocumentFilterSchema = z.object({
  documentTypeCode:    z.string().optional(),
  lifecycleState:      LifecycleStateSchema.optional(),
  classificationLevel: ClassificationLevelSchema.optional(),
  officeId:            UuidSchema.optional(),
  search:              z.string().max(256).optional(),
  dateRange:           DateRangeSchema.optional(),
  sortBy:              z.enum(["title", "createdAt", "updatedAt", "finalNumber", "lifecycleState"]).default("createdAt"),
  sortOrder:           SortOrderSchema,
  ...PaginationInputSchema.shape,
});
export type DocumentFilter = z.infer<typeof DocumentFilterSchema>;
```

**Layers:** [B] [T]

---

#### `CancelDocumentInputSchema` — Input

```typescript
export const CancelDocumentInputSchema = z.object({
  documentId: UuidSchema,
  reason:     z.string().min(10).max(1024).trim(),
});
export type CancelDocumentInput = z.infer<typeof CancelDocumentInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Version Schemas

#### `VersionSelectSchema` — Select

> Excludes `ocr_text` — that field is large and streamed separately on explicit request.

```typescript
export const VersionSelectSchema = z.object({
  id:                   UuidSchema,
  documentId:           UuidSchema,
  versionNumber:        z.number().int().min(1),
  s3Key:                z.string(),
  originalFilename:     z.string().nullable(),
  mimeType:             z.string(),
  fileSizeBytes:        z.number().int().positive(),
  pageCount:            z.number().int().positive().nullable(),
  scanQualityScore:     z.number().min(0).max(1).nullable(),
  scanQualityCategory:  ScanQualityCategorySchema.nullable(),
  ocrProcessed:         z.boolean(),
  uploadedBy:           UuidSchema,
  createdAt:            TimestampSchema,
});
export type VersionSelect = z.infer<typeof VersionSelectSchema>;
```

**Layers:** [R]

---

#### `UploadNewVersionInputSchema` — Input

```typescript
export const UploadNewVersionInputSchema = z.object({
  documentId:       UuidSchema,
  s3Key:            z.string().min(1),
  originalFilename: z.string().max(512),
  mimeType:         AllowedMimeTypeSchema,
  fileSizeBytes:    z.number().int().positive().max(26_214_400),
  reason:           z.string().min(1).max(512).trim(),
});
export type UploadNewVersionInput = z.infer<typeof UploadNewVersionInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Attachment Schemas

#### `AttachmentSelectSchema` — Select

```typescript
export const AttachmentSelectSchema = z.object({
  id:             UuidSchema,
  documentId:     UuidSchema,
  s3Key:          z.string(),
  attachmentType: AttachmentTypeSchema,
  description:    z.string().nullable(),
  mimeType:       z.string(),
  fileSizeBytes:  z.number().int().positive(),
  uploadedBy:     UuidSchema,
  createdAt:      TimestampSchema,
});
export type AttachmentSelect = z.infer<typeof AttachmentSelectSchema>;
```

**Layers:** [R]

---

#### `UploadAttachmentInputSchema` — Input

```typescript
export const UploadAttachmentInputSchema = z.object({
  documentId:     UuidSchema,
  attachmentType: AttachmentTypeSchema,
  description:    z.string().max(512).optional(),
  s3Key:          z.string().min(1),
  mimeType:       AllowedMimeTypeSchema,
  fileSizeBytes:  z.number().int().positive().max(26_214_400),
});
export type UploadAttachmentInput = z.infer<typeof UploadAttachmentInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Number Schemas

#### `DocumentNumberSelectSchema` — Select

> Append-only history row. `isCurrent = true` identifies the active number for a given `(documentId, numberType)` pair. Final numbers are immutable at both the DB trigger level and the `fn_assign_final_number()` helper.

```typescript
export const DocumentNumberSelectSchema = z.object({
  id:               UuidSchema,
  documentId:       UuidSchema,
  seriesId:         UuidSchema,
  numberType:       NumberTypeSchema,
  numberValue:      z.string(),
  sequenceYear:     z.number().int(),
  sequenceNumber:   z.number().int(),
  isCurrent:        z.boolean(),
  assignedAt:       TimestampSchema,
  assignedBy:       UuidSchema,
  supersededAt:     TimestampSchema.nullable(),
  cancellationReason: z.string().nullable(),
});
export type DocumentNumberSelect = z.infer<typeof DocumentNumberSelectSchema>;
```

**Layers:** [R]

---

#### `AssignFinalNumberInputSchema` — Input

> Secretariat assigns the final number after the last reading vote (Second Reading for Resolutions; Third Reading for Ordinances), before VP and Mayor sign.

```typescript
export const AssignFinalNumberInputSchema = z.object({
  documentId: UuidSchema,
  reason:     z.string().min(1).max(512).trim(),
});
export type AssignFinalNumberInput = z.infer<typeof AssignFinalNumberInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Signature Schemas

#### `SignatureSelectSchema` — Select

> `signedByDisplayName` is denormalised at signing time per H2 Implementation Note 5 — it reflects the name as of the signing event, not any subsequent rename.

```typescript
export const SignatureSelectSchema = z.object({
  id:                    UuidSchema,
  documentId:            UuidSchema,
  signedByEmployeeId:    UuidSchema,
  signedByDisplayName:   z.string(),
  signatureType:         SignatureTypeSchema,
  signedAt:              TimestampSchema,
  isWetInk:              z.boolean(),
  signatureImageS3Key:   z.string().nullable(),
  createdAt:             TimestampSchema,
});
export type SignatureSelect = z.infer<typeof SignatureSelectSchema>;
```

**Layers:** [R]

---

#### `LogSignatureInputSchema` — Input

> Secretariat records that a physical wet-ink signature has been received. `signatureImageS3Key` is optional — provided when a scan of the signature page was uploaded.

```typescript
export const LogSignatureInputSchema = z.object({
  documentId:           UuidSchema,
  signedByEmployeeId:   UuidSchema,
  signedByDisplayName:  z.string().min(1).max(256).trim(),
  signatureType:        SignatureTypeSchema,
  signedAt:             TimestampSchema,
  signatureImageS3Key:  z.string().optional(),
});
export type LogSignatureInput = z.infer<typeof LogSignatureInputSchema>;
```

**Layers:** [B] [T] [F]

---

### Panlalawigan Review Schemas

#### `PanlalawiganReviewSelectSchema` — Select

> One row per document in `documents.panlalawigan_reviews`. The 30-day timer is tracked from `transmittedAt`. At day 30 with no `outcome` set, the system transitions to `"deemed_approved"` and notifies the SP Secretary.

```typescript
export const PanlalawiganReviewSelectSchema = z.object({
  id:                           UuidSchema,
  documentId:                   UuidSchema,
  controlNumber:                z.string().nullable(),
  subject:                      z.string().nullable(),
  transmittedAt:                TimestampSchema.nullable(),
  receivedAt:                   TimestampSchema.nullable(),
  dateReferred:                 TimestampSchema.nullable(),
  outcome:                      PanlalawiganOutcomeSchema.nullable(),
  panlalawiganResolutionNumber: z.string().nullable(),
  remarks:                      z.string().nullable(),
  daysElapsed:                  z.number().int().nonnegative().nullable(),
  createdAt:                    TimestampSchema,
  updatedAt:                    TimestampSchema,
});
export type PanlalawiganReviewSelect = z.infer<typeof PanlalawiganReviewSelectSchema>;
```

**Layers:** [R]

---

#### `InitiatePanlalawiganTransmittalInputSchema` — Input

```typescript
export const InitiatePanlalawiganTransmittalInputSchema = z.object({
  documentId:    UuidSchema,
  transmittedAt: TimestampSchema,
  controlNumber: z.string().max(64).optional(),
  subject:       z.string().max(512).optional(),
});
export type InitiatePanlalawiganTransmittalInput = z.infer<typeof InitiatePanlalawiganTransmittalInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `LogPanlalawiganOutcomeInputSchema` — Input

> VALID-IN-PART and RETURNED outcomes require mandatory remarks per the design decisions in consolidated reference Part 4.3.

```typescript
export const LogPanlalawiganOutcomeInputSchema = z
  .object({
    documentId:                   UuidSchema,
    outcome:                      PanlalawiganOutcomeSchema,
    panlalawiganResolutionNumber: z.string().max(64).optional(),
    receivedAt:                   TimestampSchema,
    dateReferred:                 TimestampSchema.optional(),
    remarks:                      z.string().max(2048).optional(),
  })
  .refine(
    (v) => v.outcome !== "valid_in_part" || (v.remarks && v.remarks.length >= 10),
    { message: "Remarks required for VALID-IN-PART (min 10 chars)", path: ["remarks"] }
  )
  .refine(
    (v) => v.outcome !== "returned" || (v.remarks && v.remarks.length >= 10),
    { message: "Remarks required for RETURNED (min 10 chars)", path: ["remarks"] }
  );
export type LogPanlalawiganOutcomeInput = z.infer<typeof LogPanlalawiganOutcomeInputSchema>;
```

**Layers:** [B] [T] [F]

---

## Part 5 — Document Metadata Schemas

**File:** `packages/shared/src/schemas/document-metadata.ts`

These schemas validate the JSONB `metadata` column of `documents.documents` for each Phase 1 document type. The server applies the correct per-type schema at document creation and at each workflow-step submission that touches metadata. The frontend form uses the same schema via `zodResolver` for real-time field validation.

---

### Shared Sub-schemas

```typescript
export const SponsorSchema = z.object({
  employeeId:  UuidSchema,
  displayName: z.string(),
});

export const ReadingRecordSchema = z.object({
  sessionId:           UuidSchema.optional(),
  sessionDate:         DateSchema.optional(),
  motionCarried:       z.boolean().optional(),
  yesVotes:            z.number().int().min(0).optional(),
  noVotes:             z.number().int().min(0).optional(),
  abstentions:         z.number().int().min(0).optional(),
  presidingOfficerId:  UuidSchema.optional(),
  notes:               z.string().max(2048).optional(),
});

export const MayorActionSchema = z
  .object({
    type:         z.enum(["signed", "vetoed", "lapsed"]),
    actionDate:   DateSchema,
    notes:        z.string().max(2048).optional(),
    vetoMessage:  z.string().max(4096).optional(),
  })
  .refine(
    (v) => v.type !== "vetoed" || (v.vetoMessage && v.vetoMessage.length > 0),
    { message: "vetoMessage required when type is 'vetoed'", path: ["vetoMessage"] }
  );

export const VetoOverrideSchema = z.object({
  overrideDate:      DateSchema,
  yesVotes:          z.number().int().min(0),
  noVotes:           z.number().int().min(0),
  resultedInOverride: z.boolean(),
});

export const PublicationInfoSchema = z.object({
  isPublished:   z.boolean().default(false),
  firstPageS3Key: z.string().optional(),
  publishedAt:   TimestampSchema.optional(),
});

export const NewspaperPublicationSchema = z.object({
  newspaper:       z.string().max(256),
  publicationDate: DateSchema,
  s3Key:           z.string().optional(),
  arrangedBy:      UuidSchema.optional(), // SP Secretariat employee who arranged placement
});
```

---

### `SpResolutionMetadataSchema`

> JSONB metadata for `SP_RESOLUTION`. Two readings. Final number assigned after Second Reading vote. Certified Urgent path skips committee referral entirely. (Consolidated reference Part 4.1.)

| Field | Zod Type | Required | Notes |
|-------|----------|----------|-------|
| `sponsors` | `z.array(SponsorSchema)` | yes, min 1 | Only councilors may sponsor |
| `firstReading` | `ReadingRecordSchema` | optional | |
| `certificationOfUrgencyDocumentId` | `UuidSchema` | optional | Mutually exclusive with `committeeReferralIds` |
| `committeeReferralIds` | `z.array(UuidSchema)` | optional | Multi-committee — all must sign unified report |
| `secondReading` | `ReadingRecordSchema` | optional | |
| `amendmentNotes` | `z.string()` | optional | Logged by Secretariat at Second Reading |
| `mayorAction` | `MayorActionSchema` | optional | |
| `vetoOverride` | `VetoOverrideSchema` | optional | |
| `transmittalLetterDocumentId` | `UuidSchema` | optional | SPS document accompanying the measure to Mayor |
| `publication` | `PublicationInfoSchema` | optional | Title + first page public; full copy by Document Request |

```typescript
export const SpResolutionMetadataSchema = z
  .object({
    sponsors:                          z.array(SponsorSchema).min(1, "At least one sponsor required"),
    firstReading:                      ReadingRecordSchema.optional(),
    certificationOfUrgencyDocumentId:  UuidSchema.optional(),
    committeeReferralIds:               z.array(UuidSchema).optional(),
    secondReading:                     ReadingRecordSchema.optional(),
    amendmentNotes:                    z.string().max(4096).optional(),
    mayorAction:                       MayorActionSchema.optional(),
    vetoOverride:                      VetoOverrideSchema.optional(),
    transmittalLetterDocumentId:       UuidSchema.optional(),
    publication:                       PublicationInfoSchema.optional(),
  })
  .refine(
    (v) => !(v.certificationOfUrgencyDocumentId && v.committeeReferralIds?.length),
    { message: "A certified urgent measure cannot also have committee referrals" }
  );
export type SpResolutionMetadata = z.infer<typeof SpResolutionMetadataSchema>;
```

**Layers:** [B] [T] [F]

---

### `SpOrdinanceMetadataSchema`

> JSONB metadata for `SP_ORDINANCE`. Three readings. Newspaper publication required if `hasPenaltyProvision = true`. (Consolidated reference Part 4.2.)

```typescript
export const SpOrdinanceMetadataSchema = z
  .object({
    sponsors:                          z.array(SponsorSchema).min(1),
    firstReading:                      ReadingRecordSchema.optional(),
    certificationOfUrgencyDocumentId:  UuidSchema.optional(),
    committeeReferralIds:               z.array(UuidSchema).optional(),
    secondReading:                     ReadingRecordSchema.optional(),
    amendmentNotes:                    z.string().max(4096).optional(),
    thirdReading:                      ReadingRecordSchema.optional(),
    mayorAction:                       MayorActionSchema.optional(),
    vetoOverride:                      VetoOverrideSchema.optional(),
    transmittalLetterDocumentId:       UuidSchema.optional(),
    hasPenaltyProvision:               z.boolean().default(false),
    newspaperPublication:              NewspaperPublicationSchema.optional(),
    publication:                       PublicationInfoSchema.optional(),
  })
  .refine(
    (v) => !(v.certificationOfUrgencyDocumentId && v.committeeReferralIds?.length),
    { message: "A certified urgent measure cannot also have committee referrals" }
  );
export type SpOrdinanceMetadata = z.infer<typeof SpOrdinanceMetadataSchema>;
```

**Layers:** [B] [T] [F]

---

### `AppropriationOrdinanceMetadataSchema`

> Same workflow as regular Ordinances. Distinct schema to allow future divergence. Panlalawigan outcome `"operative_in_its_entirety"` is specific to this type.

```typescript
export const AppropriationOrdinanceMetadataSchema = SpOrdinanceMetadataSchema.extend({
  appropriationType: z.enum(["annual_budget", "supplemental"]).default("annual_budget"),
  fiscalYear:        z.number().int().min(2000).max(2099),
  totalAmountPhp:    z.number().positive().optional(),
});
export type AppropriationOrdinanceMetadata = z.infer<typeof AppropriationOrdinanceMetadataSchema>;
```

**Layers:** [B] [T] [F]

---

### `CertificationOfUrgencyMetadataSchema`

> No standalone number. Always attached to associated measure(s). One Certification can cover multiple measures in the same session. (Consolidated reference Part 4.17, Q-B01.)

```typescript
export const CertificationOfUrgencyMetadataSchema = z.object({
  issuedByEmployeeId:   UuidSchema,
  issuedByDisplayName:  z.string().min(1),
  issuanceDate:         DateSchema,
  associatedDocumentIds: z.array(UuidSchema).min(1, "At least one associated measure required"),
  justification:        z.string().max(4096).optional(),
  sessionDate:          DateSchema.optional(),
});
export type CertificationOfUrgencyMetadata = z.infer<typeof CertificationOfUrgencyMetadataSchema>;
```

**Layers:** [B] [T] [F]

---

### `CitizenComplaintMetadataSchema`

> Not limited to transportation — any LGU-related complaint. Secretariat decides routing. Four outcome states. (Consolidated reference Part 4.14, Q-B04.)

```typescript
export const ComplaintOutcomeStateSchema = z.enum([
  "pending_hearing",
  "received_seen",
  "dismissed",
  "resolved",
]);
export type ComplaintOutcomeState = z.infer<typeof ComplaintOutcomeStateSchema>;

export const ComplaintViolationTypeSchema = z.enum([
  "overcharging", "trip_cutting", "refused_to_convey", "discourtesy", "other",
]);

export const CitizenComplaintMetadataSchema = z.object({
  // Complainant
  complainantName:     z.string().min(1).max(256).trim(),
  complainantAddress:  z.string().max(512).optional(),
  complainantContact:  z.string().max(64).optional(),
  complainantEmail:    z.string().email().optional(),

  // Incident
  violationType:   ComplaintViolationTypeSchema.optional(),
  subjectDescription: z.string().min(1).max(2048).trim(),
  tricycleNumber:  z.string().max(64).optional(),
  incidentDate:    DateSchema.optional(),
  incidentTime:    z.string().regex(/^\d{2}:\d{2}$/).optional(),
  incidentPlace:   z.string().max(512).optional(),
  remarks:         z.string().max(2048).optional(),

  // Respondent
  respondentName:    z.string().max(256).optional(),
  respondentContact: z.string().max(64).optional(),
  respondentEmail:   z.string().email().optional(),

  // Routing and outcome
  routedToCommitteeId: UuidSchema.optional(),
  routedToViceMayor:   z.boolean().default(false),
  outcomeState:        ComplaintOutcomeStateSchema.default("pending_hearing"),
  committeeReportDocumentId: UuidSchema.optional(),
  resolutionSummary:   z.string().max(2048).optional(),
});
export type CitizenComplaintMetadata = z.infer<typeof CitizenComplaintMetadataSchema>;
```

**Layers:** [B] [T] [F]

---

### `DocumentRequestFormMetadataSchema`

> Fee-based copy request. Requires both Vice Mayor and SP Secretary approval before release. Payment system deferred past Phase 5. (Consolidated reference Part 4.15.)

```typescript
export const DocumentRequestFormMetadataSchema = z.object({
  requesterName:           z.string().min(1).max(256).trim(),
  requesterAgency:         z.string().max(256).optional(),
  requesterEmail:          z.string().email().optional(),
  requesterPhone:          z.string().max(64).optional(),
  idPresented:             z.string().max(128).optional(),
  purpose:                 z.string().min(1).max(1024).trim(),
  requestedDocumentType:   z.string().max(128),
  requestedDocumentTitle:  z.string().max(1024).optional(),
  numberOfPagesCopied:     z.number().int().positive().optional(),
  paymentOrNumber:         z.string().max(64).optional(),
  collectingOfficer:       z.string().max(256).optional(),
  approvalStatus:          z.enum(["pending", "approved", "denied"]).default("pending"),
  approvedByViceMayor:     z.boolean().default(false),
  approvedBySpSecretary:   z.boolean().default(false),
  releasedAt:              TimestampSchema.optional(),
});
export type DocumentRequestFormMetadata = z.infer<typeof DocumentRequestFormMetadataSchema>;
```

**Layers:** [B] [T] [F]

---

### Phase 1B Document Type Metadata Schemas

> These document types are Phase 1B scope. Schemas are included in the shared package now so the type safety chain holds from the start of development.

#### `LetterReceivedMetadataSchema` — `SPR`

```typescript
export const LetterReceivedMetadataSchema = z.object({
  senderName:              z.string().min(1).max(256).trim(),
  senderOfficeOrganization: z.string().max(256).optional(),
  dateReceived:            DateSchema,
  routedToViceMayor:       z.boolean().default(true), // almost all letters go to VM first
  viceMayorNotes:          z.string().max(2048).optional(),
  routedToOfficeId:        UuidSchema.optional(),
  actionTaken:             z.string().max(2048).optional(),
});
export type LetterReceivedMetadata = z.infer<typeof LetterReceivedMetadataSchema>;
```

---

#### `LetterSentMetadataSchema` — `SPS`

```typescript
export const LetterSentMetadataSchema = z.object({
  recipientName:              z.string().min(1).max(256).trim(),
  recipientOfficeOrganization: z.string().max(256).optional(),
  recipientEmail:             z.string().email().optional(),
  dateSent:                   DateSchema,
  relatedDocumentId:          UuidSchema.optional(),
  letterType:                 z.enum(["transmittal", "invitation", "forwarding", "general"]).default("general"),
});
export type LetterSentMetadata = z.infer<typeof LetterSentMetadataSchema>;
```

---

#### `MemoOutgoingMetadataSchema` — `MO`

> Memos have the `MO {YEAR}-{NN}` number embedded in the document content. This `memoNumber` field is that embedded reference, distinct from the secretariat control number. (Consolidated reference Part 4.6.)

```typescript
export const MemoOutgoingMetadataSchema = z.object({
  memoNumber:            z.string().min(1).max(64).trim(),
  issuedByEmployeeId:    UuidSchema,
  issuedByDisplayName:   z.string(),
  issuanceDate:          DateSchema,
  recipientEmployeeIds:  z.array(UuidSchema).min(1),
  subject:               z.string().min(1).max(512).trim(),
  disseminatedAt:        DateSchema.optional(),
});
export type MemoOutgoingMetadata = z.infer<typeof MemoOutgoingMetadataSchema>;
```

---

#### `MemoIncomingMetadataSchema` — `MI`

```typescript
export const MemoIncomingMetadataSchema = z.object({
  senderOffice:           z.string().min(1).max(256).trim(),
  sendersOwnReference:    z.string().max(128).optional(), // e.g. "MRC Memo Circ. No. 2025-001"
  dateReceived:           DateSchema,
  subject:                z.string().min(1).max(512).trim(),
});
export type MemoIncomingMetadata = z.infer<typeof MemoIncomingMetadataSchema>;
```

---

#### `NoticeOfCommitteeHearingMetadataSchema` — `NCH`

```typescript
export const NoticeOfCommitteeHearingMetadataSchema = z.object({
  committeeIds:          z.array(UuidSchema).min(1),
  hearingDate:           DateSchema.optional(),
  hearingTime:           z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hearingVenue:          z.string().max(256).optional(),
  relatedDocumentIds:    z.array(UuidSchema).min(1),
  recipientEmployeeIds:  z.array(UuidSchema).min(1),
  notes:                 z.string().max(2048).optional(),
});
export type NoticeOfCommitteeHearingMetadata = z.infer<typeof NoticeOfCommitteeHearingMetadataSchema>;
```

---

#### `NoticeOfSpecialSessionMetadataSchema` — `NOSP`

> Always `NOSP` prefix — never `NCH`. Separate counter. (Consolidated reference Part 4.11, Q-13.)

```typescript
export const NoticeOfSpecialSessionMetadataSchema = z.object({
  sessionNumber:         z.string().max(64),
  sessionDate:           DateSchema,
  sessionTime:           z.string().regex(/^\d{2}:\d{2}$/),
  subject:               z.string().min(1).max(512).trim(),
  recipientEmployeeIds:  z.array(UuidSchema).min(1),
});
export type NoticeOfSpecialSessionMetadata = z.infer<typeof NoticeOfSpecialSessionMetadataSchema>;
```

---

#### `DesignationMetadataSchema` — `D`

> The `delegationGrantId` back-reference is populated by the server after the `delegation_grants` row is created. (Consolidated reference Part 4.12.)

```typescript
export const DesignationMetadataSchema = z
  .object({
    delegatingAuthorityEmployeeId: UuidSchema,
    delegatingAuthorityDisplayName: z.string(),
    designatedPersonEmployeeId:    UuidSchema,
    designatedPersonDisplayName:   z.string(),
    designatedOfficeId:            UuidSchema,
    designatedPositionId:          UuidSchema,
    scopeDescription:              z.string().min(1).max(1024).trim(),
    legalBasis:                    z.string().max(512).optional(),
    effectiveFrom:                 DateSchema,
    effectiveUntil:                DateSchema,
    delegationGrantId:             UuidSchema.optional(),
  })
  .refine(
    (v) => v.delegatingAuthorityEmployeeId !== v.designatedPersonEmployeeId,
    { message: "Delegating authority and designated person must differ", path: ["designatedPersonEmployeeId"] }
  )
  .refine(
    (v) => v.effectiveUntil >= v.effectiveFrom,
    { message: "effectiveUntil must not be before effectiveFrom", path: ["effectiveUntil"] }
  );
export type DesignationMetadata = z.infer<typeof DesignationMetadataSchema>;
```

---

### Discriminated Metadata Union

> Server-side utility for validating `metadata` against the correct per-type schema. The `__type` discriminant mirrors the `document_types.code` value.

```typescript
export const DocumentMetadataSchema = z.discriminatedUnion("__type", [
  SpResolutionMetadataSchema.extend({ __type: z.literal("SP_RESOLUTION") }),
  SpOrdinanceMetadataSchema.extend({ __type: z.literal("SP_ORDINANCE") }),
  AppropriationOrdinanceMetadataSchema.extend({ __type: z.literal("APPROPRIATION_ORDINANCE") }),
  CertificationOfUrgencyMetadataSchema.extend({ __type: z.literal("CERTIFICATION_OF_URGENCY") }),
  CitizenComplaintMetadataSchema.extend({ __type: z.literal("CITIZEN_COMPLAINT") }),
  DocumentRequestFormMetadataSchema.extend({ __type: z.literal("DOCUMENT_REQUEST_FORM") }),
  LetterReceivedMetadataSchema.extend({ __type: z.literal("LETTER_RECEIVED") }),
  LetterSentMetadataSchema.extend({ __type: z.literal("LETTER_SENT") }),
  MemoOutgoingMetadataSchema.extend({ __type: z.literal("MEMO_OUTGOING") }),
  MemoIncomingMetadataSchema.extend({ __type: z.literal("MEMO_INCOMING") }),
  NoticeOfCommitteeHearingMetadataSchema.extend({ __type: z.literal("NOTICE_OF_COMMITTEE_HEARING") }),
  NoticeOfSpecialSessionMetadataSchema.extend({ __type: z.literal("NOTICE_OF_SPECIAL_SESSION") }),
  DesignationMetadataSchema.extend({ __type: z.literal("DESIGNATION") }),
]);
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
```

**Layers:** [B] [T]

---

## Part 6 — Workflow Domain

**File:** `packages/shared/src/schemas/workflow.ts`
**File:** `packages/shared/src/enums/workflow.ts`

---

### Enum Schemas

#### `StepTypeSchema`

```typescript
export const StepTypeSchema = z.enum([
  "action",
  "approval",
  "multi_referral",   // Phase 1: all assigned committees must sign unified report
  "decision",
  "notification",
  "termination",
  "parallel_split",   // Phase 2 (reserved in data model)
  "parallel_join",    // Phase 2 (reserved in data model)
]);
export type StepType = z.infer<typeof StepTypeSchema>;
```

**Source:** B4 step type enum + consolidated reference Part 11.3 | **Layers:** [B] [T] [F] [R]

---

#### `WorkflowInstanceStatusSchema`

```typescript
export const WorkflowInstanceStatusSchema = z.enum([
  "pending", "active", "completed", "cancelled", "suspended",
]);
export type WorkflowInstanceStatus = z.infer<typeof WorkflowInstanceStatusSchema>;
```

**Source:** B4 §2.3 | **Layers:** [B] [T] [R]

---

#### `StepInstanceStatusSchema`

```typescript
export const StepInstanceStatusSchema = z.enum([
  "not_started", "in_progress", "pending_action",
  "completed", "skipped", "bypassed", "cancelled",
]);
export type StepInstanceStatus = z.infer<typeof StepInstanceStatusSchema>;
```

**Source:** B4 §2.8 | **Layers:** [B] [T] [R]

---

#### `ApprovalDecisionSchema`

> Maps to the Secretariat UI's "Approve / Reject / Amended" action buttons per consolidated reference Part 11.4.

```typescript
export const ApprovalDecisionSchema = z.enum([
  "approved",
  "rejected",
  "returned_for_revision",
  "amended",
]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
```

**Layers:** [B] [T] [F] [R]

---

### Workflow Definition Schemas

#### `WorkflowDefinitionSelectSchema` — Select

```typescript
export const WorkflowDefinitionSelectSchema = z.object({
  id:               UuidSchema,
  documentTypeId:   UuidSchema,
  name:             z.string().min(1).max(256),
  description:      z.string().nullable(),
  isActive:         z.boolean(),
  currentVersionId: UuidSchema.nullable(),
  createdAt:        TimestampSchema,
  updatedAt:        TimestampSchema,
});
export type WorkflowDefinitionSelect = z.infer<typeof WorkflowDefinitionSelectSchema>;
```

**Layers:** [R]

---

#### `WorkflowStepSelectSchema` — Select

```typescript
export const WorkflowStepSelectSchema = z.object({
  id:                  UuidSchema,
  definitionVersionId: UuidSchema,
  stepOrder:           z.number().int().min(0),
  stepType:            StepTypeSchema,
  name:                z.string().min(1).max(256),
  description:         z.string().nullable(),
  assignedRoleCodes:   z.array(z.string()),
  assignedCommitteeIds: z.array(UuidSchema), // populated for multi_referral steps
  durationDays:        z.number().int().positive().nullable(),
  isMandatory:         z.boolean(),
  canBypass:           z.boolean(),
  configuration:       z.record(z.unknown()),
});
export type WorkflowStepSelect = z.infer<typeof WorkflowStepSelectSchema>;
```

**Layers:** [R]

---

### Workflow Instance Schemas

#### `WorkflowInstanceSelectSchema` — Select

```typescript
export const WorkflowInstanceSelectSchema = z.object({
  id:                  UuidSchema,
  documentId:          UuidSchema,
  definitionVersionId: UuidSchema,
  status:              WorkflowInstanceStatusSchema,
  currentStepId:       UuidSchema.nullable(),
  startedAt:           TimestampSchema.nullable(),
  completedAt:         TimestampSchema.nullable(),
  slaDeadlineAt:       TimestampSchema.nullable(),
  slaBreached:         z.boolean(),
  createdAt:           TimestampSchema,
  updatedAt:           TimestampSchema,
});
export type WorkflowInstanceSelect = z.infer<typeof WorkflowInstanceSelectSchema>;
```

**Layers:** [R]

---

#### `StepAssigneeSchema`

> Used inside `StepInstanceSelectSchema`. For `multi_referral` steps, each committee gets its own assignee entry; `hasCompleted` tracks per-committee submission status (consolidated reference Part 8.3).

```typescript
export const StepAssigneeSchema = z.object({
  type:         z.enum(["user", "role", "committee"]),
  userId:       UuidSchema.optional(),
  roleCode:     z.string().optional(),
  committeeId:  UuidSchema.optional(),
  displayName:  z.string(),
  hasCompleted: z.boolean(),
});
```

---

#### `StepInstanceSelectSchema` — Select

```typescript
export const StepInstanceSelectSchema = z.object({
  id:                  UuidSchema,
  workflowInstanceId:  UuidSchema,
  stepId:              UuidSchema,
  step:                WorkflowStepSelectSchema,
  status:              StepInstanceStatusSchema,
  assignedTo:          z.array(StepAssigneeSchema),
  startedAt:           TimestampSchema.nullable(),
  dueAt:               TimestampSchema.nullable(),
  completedAt:         TimestampSchema.nullable(),
  completedBy:         UuidSchema.nullable(),
  decision:            ApprovalDecisionSchema.nullable(),
  comment:             z.string().nullable(),
  isRedFlagged:        z.boolean(), // true when committee hasn't submitted by Thursday cutoff
  createdAt:           TimestampSchema,
  updatedAt:           TimestampSchema,
});
export type StepInstanceSelect = z.infer<typeof StepInstanceSelectSchema>;
```

**Layers:** [R]

---

#### `AdvanceWorkflowStepInputSchema` — Input

> Used for `action` and `approval` step types. Rejected and returned-for-revision decisions require a comment.

```typescript
export const AdvanceWorkflowStepInputSchema = z
  .object({
    stepInstanceId:   UuidSchema,
    decision:         ApprovalDecisionSchema,
    comment:          z.string().max(2048).optional(),
    attachmentS3Key:  z.string().optional(),
  })
  .refine(
    (v) => v.decision !== "rejected" || (v.comment && v.comment.length >= 10),
    { message: "Comment required when rejecting (min 10 chars)", path: ["comment"] }
  )
  .refine(
    (v) => v.decision !== "returned_for_revision" || (v.comment && v.comment.length >= 10),
    { message: "Comment required when returning for revision (min 10 chars)", path: ["comment"] }
  )
  .refine(
    (v) => v.decision !== "amended" || (v.comment && v.comment.length >= 10),
    { message: "Amendment notes required (min 10 chars)", path: ["comment"] }
  );
export type AdvanceWorkflowStepInput = z.infer<typeof AdvanceWorkflowStepInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `SubmitCommitteeReportInputSchema` — Input

> A committee submits its contribution to the unified report in a `multi_referral` step. All assigned committees must submit before the step completes. Reports missing by Thursday cutoff cause Second Reading to be delayed (consolidated reference Part 8.3, Q-A02).

```typescript
export const SubmitCommitteeReportInputSchema = z.object({
  stepInstanceId:      UuidSchema,
  committeeId:         UuidSchema,
  reportS3Key:         z.string().min(1),
  reportMimeType:      AllowedMimeTypeSchema,
  reportFileSizeBytes: z.number().int().positive().max(26_214_400),
  recommendation:      z.string().min(10).max(4096).trim(),
  submittedAt:         TimestampSchema,
});
export type SubmitCommitteeReportInput = z.infer<typeof SubmitCommitteeReportInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `BypassStepInputSchema` — Input

> SP Secretary manually advances a `multi_referral` step past a missing committee report. Mandatory long-form reason. Every use is audit-logged with the actor and mandatory comment (consolidated reference Part 8.3).

```typescript
export const BypassStepInputSchema = z.object({
  stepInstanceId: UuidSchema,
  reason:         z.string().min(20).max(2048).trim(),
});
export type BypassStepInput = z.infer<typeof BypassStepInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `LogCertificationOfUrgencyInputSchema` — Input

> Secretariat logs a received Certification of Urgency. Each associated measure's `multi_referral` / committee step is bypassed and the workflow advances directly to Second Reading (consolidated reference Part 4.17).

```typescript
export const LogCertificationOfUrgencyInputSchema = z.object({
  certificationDocumentId: UuidSchema,
  associatedDocumentIds:   z.array(UuidSchema).min(1, "At least one associated measure required"),
});
export type LogCertificationOfUrgencyInput = z.infer<typeof LogCertificationOfUrgencyInputSchema>;
```

**Layers:** [B] [T] [F]

---

#### `WorkflowEventSelectSchema` — Select (Append-only)

```typescript
export const WorkflowEventSelectSchema = z.object({
  id:                  UuidSchema,
  workflowInstanceId:  UuidSchema,
  stepInstanceId:      UuidSchema.nullable(),
  eventType:           z.string(), // e.g. 'step.completed', 'step.bypassed', 'instance.cancelled'
  actorId:             UuidSchema.nullable(),
  payload:             z.record(z.unknown()),
  occurredAt:          TimestampSchema,
});
export type WorkflowEventSelect = z.infer<typeof WorkflowEventSelectSchema>;
```

**Layers:** [R]

---

## Part 7 — Tracking Domain

**File:** `packages/shared/src/schemas/tracking.ts`

---

### `QrCodeScanResultSchema` — Response

> Returned when a QR code UUID is scanned. Per consolidated reference Part 11.6: QR content is a UUID only; the scan looks up the document and returns this payload. First page visible; other pages blurred. "Get a copy" button triggers the Document Request Form flow.

```typescript
export const RoutingHistoryEntrySchema = z.object({
  from:        z.string(),
  to:          z.string(),
  actor:       UserSummarySchema,
  action:      z.string(),
  occurredAt:  TimestampSchema,
});

export const QrCodeScanResultSchema = z.object({
  trackingNumber:      UuidSchema,
  document:            DocumentSummarySchema,
  documentTypeLabel:   z.string(),
  currentLifecycleState: LifecycleStateSchema,
  remarks:             z.string().nullable(),
  routingHistory:      z.array(RoutingHistoryEntrySchema),
  firstPageS3Key:      z.string().nullable(),
  canRequestCopy:      z.boolean(),
});
export type QrCodeScanResult = z.infer<typeof QrCodeScanResultSchema>;
```

**Layers:** [B] [R]

---

#### `QrScanInputSchema` — Input

```typescript
export const QrScanInputSchema = z.object({
  trackingNumber: UuidSchema,
});
export type QrScanInput = z.infer<typeof QrScanInputSchema>;
```

**Layers:** [B] [T]

---

### `RoutingEntrySelectSchema` — Select (Append-only)

```typescript
export const RoutingEntrySelectSchema = z.object({
  id:               UuidSchema,
  trackingRecordId: UuidSchema,
  fromOfficeName:   z.string().nullable(),
  toOfficeName:     z.string(),
  actor:            UserSummarySchema,
  action:           z.string(),
  notes:            z.string().nullable(),
  occurredAt:       TimestampSchema,
});
export type RoutingEntrySelect = z.infer<typeof RoutingEntrySelectSchema>;
```

**Layers:** [R]

---

#### `LogRoutingEntryInputSchema` — Input

```typescript
export const LogRoutingEntryInputSchema = z.object({
  documentId:   UuidSchema,
  fromOfficeId: UuidSchema.optional(),
  toOfficeId:   UuidSchema,
  action:       z.string().min(1).max(128).trim(),
  notes:        z.string().max(1024).optional(),
  occurredAt:   TimestampSchema,
});
export type LogRoutingEntryInput = z.infer<typeof LogRoutingEntryInputSchema>;
```

**Layers:** [B] [T] [F]

---

### `TrackingRecordSelectSchema` — Select

```typescript
export const TrackingRecordSelectSchema = z.object({
  id:                         UuidSchema,
  documentId:                 UuidSchema,
  qrTrackingNumber:           UuidSchema,
  currentOfficeName:          z.string(),
  physicalCustodyConfirmedAt: TimestampSchema.nullable(),
  routingEntries:             z.array(RoutingEntrySelectSchema),
  createdAt:                  TimestampSchema,
  updatedAt:                  TimestampSchema,
});
export type TrackingRecordSelect = z.infer<typeof TrackingRecordSelectSchema>;
```

**Layers:** [R]

---

## Part 8 — Records Domain

**File:** `packages/shared/src/schemas/records.ts`

---

### `RetentionScheduleSelectSchema` — Select

> SP Resolutions and Ordinances are permanent per consolidated reference Part 11.7. All documents currently retained — none disposed of.

```typescript
export const RetentionPolicySchema = z.enum([
  "permanent", "1_year", "5_years", "10_years", "15_years", "configurable",
]);

export const RetentionScheduleSelectSchema = z.object({
  id:             UuidSchema,
  name:           z.string().min(1).max(256),
  policy:         RetentionPolicySchema,
  retentionYears: z.number().int().positive().nullable(),
  description:    z.string().nullable(),
  isActive:       z.boolean(),
  createdAt:      TimestampSchema,
});
export type RetentionScheduleSelect = z.infer<typeof RetentionScheduleSelectSchema>;
```

**Layers:** [R]

---

### `ArchiveEntrySelectSchema` — Select

```typescript
export const ArchiveEntrySelectSchema = z.object({
  id:                  UuidSchema,
  documentId:          UuidSchema,
  document:            DocumentSummarySchema,
  archivedAt:          TimestampSchema,
  archivedBy:          UuidSchema,
  archiver:            UserSummarySchema,
  retentionScheduleId: UuidSchema,
  retentionSchedule:   RetentionScheduleSelectSchema,
  reviewDueAt:         DateSchema.nullable(),
  disposedAt:          TimestampSchema.nullable(),
  disposedBy:          UuidSchema.nullable(),
  disposalReason:      z.string().nullable(),
  notes:               z.string().nullable(),
  createdAt:           TimestampSchema,
});
export type ArchiveEntrySelect = z.infer<typeof ArchiveEntrySelectSchema>;
```

**Layers:** [R]

---

### `BulkArchiveInputSchema` — Input

> Records Officers only. Confirmation dialog + dry-run preview required in the UI. Each item individually logged in audit. No bulk delete permitted (consolidated reference Part 11.4).

```typescript
export const BulkArchiveInputSchema = z.object({
  documentIds:         z.array(UuidSchema).min(1).max(200),
  reason:              z.string().min(10).max(1024).trim(),
  retentionScheduleId: UuidSchema,
  dryRun:              z.boolean().default(false),
});
export type BulkArchiveInput = z.infer<typeof BulkArchiveInputSchema>;
```

**Layers:** [B] [T] [F]

---

### `BulkArchivePreviewSchema` — Response

> Returned when `dryRun = true`.

```typescript
export const BulkArchivePreviewSchema = z.object({
  eligibleCount:        z.number().int(),
  ineligibleDocuments:  z.array(z.object({
    documentId: UuidSchema,
    title:      z.string(),
    reason:     z.string(),
  })),
  estimatedArchivedCount: z.number().int(),
});
export type BulkArchivePreview = z.infer<typeof BulkArchivePreviewSchema>;
```

**Layers:** [R]

---

## Part 9 — Notifications Domain

**File:** `packages/shared/src/schemas/notifications.ts`

---

### `NotificationEventSchema` — Response

> In-app notification delivered via SSE. `referenceId` links to the document or step instance the notification is about.

```typescript
export const NotificationChannelSchema = z.enum(["in_app", "email", "sms"]);

export const NotificationEventSchema = z.object({
  id:             UuidSchema,
  userId:         UuidSchema,
  type:           z.string().min(1), // e.g. 'document.assigned', 'sla.warning', 'step.overdue'
  title:          z.string().max(256),
  body:           z.string().max(2048),
  channel:        NotificationChannelSchema,
  referenceId:    UuidSchema.nullable(),
  referenceType:  z.string().nullable(),
  isRead:         z.boolean(),
  deliveredAt:    TimestampSchema.nullable(),
  createdAt:      TimestampSchema,
});
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;
```

**Layers:** [R]

---

#### `MarkNotificationReadInputSchema` — Input

```typescript
export const MarkNotificationsReadInputSchema = z.object({
  notificationIds: z.array(UuidSchema).min(1).max(100),
});
export type MarkNotificationsReadInput = z.infer<typeof MarkNotificationsReadInputSchema>;
```

**Layers:** [B] [T]

---

#### `NotificationFilterSchema` — Filter

```typescript
export const NotificationFilterSchema = z.object({
  isRead: z.boolean().optional(),
  type:   z.string().optional(),
  ...PaginationInputSchema.shape,
});
export type NotificationFilter = z.infer<typeof NotificationFilterSchema>;
```

**Layers:** [B] [T]

---

#### `SseEventSchema` — Response

> Envelope for Server-Sent Event payloads pushed by the backend SSE endpoint.

```typescript
export const SseEventSchema = z.object({
  event: z.enum(["notification", "workflow_update", "sla_warning", "heartbeat"]),
  data:  z.union([NotificationEventSchema, z.object({ message: z.string() })]),
  id:    z.string().optional(),
});
export type SseEvent = z.infer<typeof SseEventSchema>;
```

**Layers:** [B] [R]

---

## Part 10 — Audit Domain

**File:** `packages/shared/src/schemas/audit.ts`

> Audit log is append-only at the DB permission level (`INSERT` only; `UPDATE` and `DELETE` revoked from `app_user`). No Insert schema is exported from `/packages/shared` — inserts are internal server-only operations. Only `Select` and `Filter` schemas are exposed.

---

### `AuditEventSelectSchema` — Select

| Field | Zod Type | Notes |
|-------|----------|-------|
| `id` | `UuidSchema` | |
| `eventType` | `z.string()` | e.g. `'document.state_changed'`, `'user.role_assigned'`, `'step.bypassed'` |
| `actorId` | `UuidSchema.nullable()` | NULL for system-initiated events |
| `actorDisplayName` | `z.string().nullable()` | Denormalised at write time |
| `targetId` | `UuidSchema.nullable()` | Document, user, step instance, etc. |
| `targetType` | `z.string().nullable()` | |
| `payload` | `z.record(z.unknown())` | Event-specific structured data |
| `chainHash` | `z.string()` | SHA-256 hex; broken chain = tamper indicator |
| `hmacSignature` | `z.string()` | HMAC-SHA-256 |
| `occurredAt` | `TimestampSchema` | |
| `ipAddress` | `z.string().nullable()` | |

```typescript
export const AuditEventSelectSchema = z.object({
  id:               UuidSchema,
  eventType:        z.string().min(1).max(128),
  actorId:          UuidSchema.nullable(),
  actorDisplayName: z.string().nullable(),
  targetId:         UuidSchema.nullable(),
  targetType:       z.string().nullable(),
  payload:          z.record(z.unknown()),
  chainHash:        z.string().length(64),
  hmacSignature:    z.string(),
  occurredAt:       TimestampSchema,
  ipAddress:        z.string().nullable(),
});
export type AuditEventSelect = z.infer<typeof AuditEventSelectSchema>;
```

**Layers:** [R]

---

#### `AuditEventFilterSchema` — Filter

```typescript
export const AuditEventFilterSchema = z.object({
  actorId:     UuidSchema.optional(),
  targetId:    UuidSchema.optional(),
  targetType:  z.string().optional(),
  eventType:   z.string().optional(),
  dateRange:   DateRangeSchema.optional(),
  sortOrder:   SortOrderSchema.default("desc"),
  ...OffsetPaginationInputSchema.shape,
});
export type AuditEventFilter = z.infer<typeof AuditEventFilterSchema>;
```

**Layers:** [B] [T]

---

## Part 11 — Session Attendance

**File:** `packages/shared/src/schemas/attendance.ts`

Note: "Session" here means an SP plenary session (Tuesday legislative session), not an IAM auth session.

---

### `AttendanceStatusSchema`

```typescript
export const AttendanceStatusSchema = z.enum([
  "present", "absent_ob", "absent_sick", "absent_vacation", "absent",
]);
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;
```

**Source:** Consolidated reference Part 7.3 | **Layers:** [B] [T] [F] [R]

---

### `SpSessionSelectSchema` — Select

```typescript
export const AttendanceRecordSchema = z.object({
  employeeId: UuidSchema,
  employee:   EmployeeSummarySchema,
  status:     AttendanceStatusSchema,
  reason:     z.string().nullable(),
});

export const SpSessionSelectSchema = z.object({
  id:                      UuidSchema,
  sessionDate:             DateSchema,
  sessionNumber:           z.string().max(64),
  sessionType:             z.enum(["regular", "special"]),
  presidingOfficerEmployeeId: UuidSchema,
  presidingOfficer:        EmployeeSummarySchema,
  quorumMet:               z.boolean(),
  attendanceRecords:       z.array(AttendanceRecordSchema),
  presentCount:            z.number().int(),
  absentCount:             z.number().int(),
  createdAt:               TimestampSchema,
  updatedAt:               TimestampSchema,
});
export type SpSessionSelect = z.infer<typeof SpSessionSelectSchema>;
```

**Layers:** [R]

---

### `CreateSpSessionInputSchema` — Input

> Quorum is 7 of 12 members (half + 1 per consolidated reference Part 3.2). The server enforces this; the schema validates it so the form can surface the error before submission.

```typescript
export const CreateSpSessionInputSchema = z
  .object({
    sessionDate:             DateSchema,
    sessionNumber:           z.string().min(1).max(64).trim(),
    sessionType:             z.enum(["regular", "special"]).default("regular"),
    presidingOfficerEmployeeId: UuidSchema,
    attendanceRecords: z.array(z.object({
      employeeId: UuidSchema,
      status:     AttendanceStatusSchema,
      reason:     z.string().max(512).optional(),
    })).min(1),
  })
  .refine(
    (v) => v.attendanceRecords.filter((r) => r.status === "present").length >= 7,
    { message: "Quorum not met — at least 7 members must be present" }
  );
export type CreateSpSessionInput = z.infer<typeof CreateSpSessionInputSchema>;
```

**Layers:** [B] [T] [F]

---

### `OrderOfBusinessSchema` — Response

> Derived view for the SP Secretary dashboard (consolidated reference Part 4.18). Generated from all documents scheduled for the upcoming Tuesday session. Items with missing committee reports are red-flagged when the Thursday cutoff has passed.

```typescript
export const OrderOfBusinessItemSchema = z.object({
  documentId:              UuidSchema,
  document:                DocumentSummarySchema,
  documentTypeCode:        z.string(),
  sponsors:                z.array(EmployeeSummarySchema),
  scheduleItemType:        z.enum(["first_reading", "second_reading", "third_reading"]),
  committeeReferralStatus: z.enum([
    "not_referred",
    "pending_report",
    "report_submitted",
    "skipped_certified_urgent",
  ]),
  isRedFlagged:            z.boolean(),
  notes:                   z.string().nullable(),
});

export const OrderOfBusinessSchema = z.object({
  sessionDate:      DateSchema,
  sessionNumber:    z.string(),
  cutoffDate:       DateSchema,   // the Thursday that preceded this Order of Business
  items:            z.array(OrderOfBusinessItemSchema),
  redFlaggedCount:  z.number().int(),
  totalCount:       z.number().int(),
});
export type OrderOfBusiness = z.infer<typeof OrderOfBusinessSchema>;
```

**Layers:** [R]

---

## Part 12 — Dashboard Schemas

**File:** `packages/shared/src/schemas/dashboard.ts`

---

### `SlaStatusSchema` — Response (shared sub-schema)

```typescript
export const SlaStatusSchema = z.object({
  documentId:    UuidSchema,
  document:      DocumentSummarySchema,
  slaDeadlineAt: TimestampSchema,
  daysRemaining: z.number(),
  isBreached:    z.boolean(),
  isWarning:     z.boolean(), // true when past 80% of SLA time (consolidated reference Part 11.3)
});
export type SlaStatus = z.infer<typeof SlaStatusSchema>;
```

**Layers:** [R]

---

### `SpSecretaryDashboardSchema` — Response

```typescript
export const SpSecretaryDashboardSchema = z.object({
  pendingInbox: z.array(DocumentSummarySchema),
  upcomingSession: z.object({
    sessionDate:     DateSchema.nullable(),
    orderOfBusiness: OrderOfBusinessSchema.nullable(),
  }),
  slaWarnings:           z.array(SlaStatusSchema),
  overdueItems:          z.array(SlaStatusSchema),
  unreadNotificationCount: z.number().int(),
  recentActivity: z.array(z.object({
    occurredAt:  TimestampSchema,
    description: z.string(),
    documentId:  UuidSchema.nullable(),
  })),
});
export type SpSecretaryDashboard = z.infer<typeof SpSecretaryDashboardSchema>;
```

**Layers:** [R]

---

### `MayorDashboardSchema` — Response

> Pending signatures show `daysUntilLapse` — Mayor has 10 calendar days before a document lapses into law per RA 7160 (consolidated reference Parts 4.1, 4.2, 11.3).

```typescript
export const MayorDashboardSchema = z.object({
  pendingSignatures: z.array(
    DocumentSummarySchema.extend({
      daysUntilLapse: z.number().int(),
      transmittedAt:  TimestampSchema.nullable(),
    })
  ),
  overdueSignatures:       z.array(DocumentSummarySchema),
  slaWarnings:             z.array(SlaStatusSchema),
  unreadNotificationCount: z.number().int(),
});
export type MayorDashboard = z.infer<typeof MayorDashboardSchema>;
```

**Layers:** [R]

---

## Part 13 — Layer Consumption Summary Matrix

✓ = schema directly used in this layer

| Schema | [B] | [T] | [F] | [R] |
|--------|:---:|:---:|:---:|:---:|
| **Common** | | | | |
| `UuidSchema` | ✓ | ✓ | ✓ | ✓ |
| `TimestampSchema` | | | | ✓ |
| `DateSchema` | ✓ | ✓ | ✓ | ✓ |
| `PaginationInputSchema` | ✓ | ✓ | | |
| `DateRangeSchema` | ✓ | ✓ | ✓ | |
| `PaginatedResponseSchema<T>` | | | | ✓ |
| `ApiErrorSchema` | | | | ✓ |
| `PresignedUploadRequestSchema` | ✓ | ✓ | | |
| `PresignedUploadResponseSchema` | | | | ✓ |
| **IAM** | | | | |
| `UserSelectSchema` | | | | ✓ |
| `UserSummarySchema` | | | | ✓ |
| `CreateUserInputSchema` | ✓ | ✓ | ✓ | |
| `UpdateUserInputSchema` | ✓ | ✓ | ✓ | |
| `UserFilterSchema` | ✓ | ✓ | | |
| `LoginInputSchema` | ✓ | ✓ | ✓ | |
| `AuthResponseSchema` | ✓ | | | ✓ |
| `ChangePasswordInputSchema` | ✓ | ✓ | ✓ | |
| `SetupTotpInputSchema` | ✓ | ✓ | ✓ | |
| `RoleSelectSchema` | | | | ✓ |
| `CreateRoleInputSchema` | ✓ | ✓ | ✓ | |
| `AssignRoleInputSchema` | ✓ | ✓ | ✓ | |
| `RoleAssignmentSelectSchema` | | | | ✓ |
| `SessionSelectSchema` | | | | ✓ |
| **Organization** | | | | |
| `OfficeSelectSchema` | | | | ✓ |
| `OfficeSummarySchema` | | | | ✓ |
| `CreateOfficeInputSchema` | ✓ | ✓ | ✓ | |
| `UpdateOfficeInputSchema` | ✓ | ✓ | ✓ | |
| `OfficeFilterSchema` | ✓ | ✓ | | |
| `CreatePositionInputSchema` | ✓ | ✓ | ✓ | |
| `EmployeeSelectSchema` | | | | ✓ |
| `EmployeeSummarySchema` | | | | ✓ |
| `CreateEmployeeInputSchema` | ✓ | ✓ | ✓ | |
| `CreateAssignmentInputSchema` | ✓ | ✓ | ✓ | |
| `CommitteeWithMembersSchema` | | | | ✓ |
| `CreateCommitteeInputSchema` | ✓ | ✓ | ✓ | |
| `DelegationGrantSelectSchema` | | | | ✓ |
| `LogDelegationInputSchema` | ✓ | ✓ | ✓ | |
| `RevokeDelegationInputSchema` | ✓ | ✓ | ✓ | |
| **Documents Core** | | | | |
| `DocumentSelectSchema` | | | | ✓ |
| `DocumentSummarySchema` | | | | ✓ |
| `DocumentTypeSummarySchema` | | | | ✓ |
| `LogDocumentInputSchema` | ✓ | ✓ | ✓ | |
| `DocumentFilterSchema` | ✓ | ✓ | | |
| `CancelDocumentInputSchema` | ✓ | ✓ | ✓ | |
| `VersionSelectSchema` | | | | ✓ |
| `UploadNewVersionInputSchema` | ✓ | ✓ | ✓ | |
| `AttachmentSelectSchema` | | | | ✓ |
| `UploadAttachmentInputSchema` | ✓ | ✓ | ✓ | |
| `DocumentNumberSelectSchema` | | | | ✓ |
| `AssignFinalNumberInputSchema` | ✓ | ✓ | ✓ | |
| `SignatureSelectSchema` | | | | ✓ |
| `LogSignatureInputSchema` | ✓ | ✓ | ✓ | |
| `PanlalawiganReviewSelectSchema` | | | | ✓ |
| `InitiatePanlalawiganTransmittalInputSchema` | ✓ | ✓ | ✓ | |
| `LogPanlalawiganOutcomeInputSchema` | ✓ | ✓ | ✓ | |
| **Document Metadata** | | | | |
| `SpResolutionMetadataSchema` | ✓ | ✓ | ✓ | |
| `SpOrdinanceMetadataSchema` | ✓ | ✓ | ✓ | |
| `AppropriationOrdinanceMetadataSchema` | ✓ | ✓ | ✓ | |
| `CertificationOfUrgencyMetadataSchema` | ✓ | ✓ | ✓ | |
| `CitizenComplaintMetadataSchema` | ✓ | ✓ | ✓ | |
| `DocumentRequestFormMetadataSchema` | ✓ | ✓ | ✓ | |
| Phase 1B metadata schemas (6 types) | ✓ | ✓ | ✓ | |
| `DocumentMetadataSchema` (discriminated union) | ✓ | ✓ | | |
| **Workflow** | | | | |
| `WorkflowDefinitionSelectSchema` | | | | ✓ |
| `WorkflowStepSelectSchema` | | | | ✓ |
| `WorkflowInstanceSelectSchema` | | | | ✓ |
| `StepInstanceSelectSchema` | | | | ✓ |
| `AdvanceWorkflowStepInputSchema` | ✓ | ✓ | ✓ | |
| `SubmitCommitteeReportInputSchema` | ✓ | ✓ | ✓ | |
| `BypassStepInputSchema` | ✓ | ✓ | ✓ | |
| `LogCertificationOfUrgencyInputSchema` | ✓ | ✓ | ✓ | |
| `WorkflowEventSelectSchema` | | | | ✓ |
| **Tracking** | | | | |
| `QrScanInputSchema` | ✓ | ✓ | | |
| `QrCodeScanResultSchema` | ✓ | | | ✓ |
| `RoutingEntrySelectSchema` | | | | ✓ |
| `LogRoutingEntryInputSchema` | ✓ | ✓ | ✓ | |
| `TrackingRecordSelectSchema` | | | | ✓ |
| **Records** | | | | |
| `RetentionScheduleSelectSchema` | | | | ✓ |
| `ArchiveEntrySelectSchema` | | | | ✓ |
| `BulkArchiveInputSchema` | ✓ | ✓ | ✓ | |
| `BulkArchivePreviewSchema` | | | | ✓ |
| **Notifications** | | | | |
| `NotificationEventSchema` | | | | ✓ |
| `MarkNotificationsReadInputSchema` | ✓ | ✓ | | |
| `NotificationFilterSchema` | ✓ | ✓ | | |
| `SseEventSchema` | ✓ | | | ✓ |
| **Audit** | | | | |
| `AuditEventSelectSchema` | | | | ✓ |
| `AuditEventFilterSchema` | ✓ | ✓ | | |
| **Attendance** | | | | |
| `AttendanceStatusSchema` | ✓ | ✓ | ✓ | ✓ |
| `CreateSpSessionInputSchema` | ✓ | ✓ | ✓ | |
| `SpSessionSelectSchema` | | | | ✓ |
| `OrderOfBusinessSchema` | | | | ✓ |
| **Dashboards** | | | | |
| `SpSecretaryDashboardSchema` | | | | ✓ |
| `MayorDashboardSchema` | | | | ✓ |

---

## Part 14 — Naming Conventions

| Convention | Rule | Example |
|------------|------|---------|
| Select schemas | `{Entity}SelectSchema` | `DocumentSelectSchema` |
| Summary/lightweight schemas | `{Entity}SummarySchema` | `DocumentSummarySchema`, `OfficeSummarySchema` |
| Input schemas | `{Verb}{Entity}InputSchema` | `LogDocumentInputSchema`, `CreateUserInputSchema` |
| Filter schemas | `{Entity}FilterSchema` | `DocumentFilterSchema`, `AuditEventFilterSchema` |
| Response schemas | `{Entity}Schema` | `OrderOfBusinessSchema`, `QrCodeScanResultSchema` |
| Enum schemas | `{Concept}Schema` | `LifecycleStateSchema`, `StepTypeSchema` |
| Path params | `{Context}ParamsSchema` | `IdParamsSchema` |
| Inferred types | Same name without `Schema` suffix | `type DocumentSelect = z.infer<typeof DocumentSelectSchema>` |

---

## Part 15 — Import and Export Conventions

### Barrel Export (`index.ts`)

```typescript
// /packages/shared/src/index.ts

export * from "./schemas/common";
export * from "./schemas/iam";
export * from "./schemas/organization";
export * from "./schemas/documents";
export * from "./schemas/document-metadata";
export * from "./schemas/workflow";
export * from "./schemas/tracking";
export * from "./schemas/records";
export * from "./schemas/notifications";
export * from "./schemas/audit";
export * from "./schemas/attendance";
export * from "./schemas/dashboard";

// Enum schemas are re-exported from domain files above.
// These explicit re-exports allow import directly from the enums path
// for callers that only need enums (e.g. database seed scripts).
export * from "./enums/iam";
export * from "./enums/organization";
export * from "./enums/documents";
export * from "./enums/workflow";
```

### Consumer Import Patterns

```typescript
// tRPC procedure (apps/server)
import { LogDocumentInputSchema, type LogDocumentInput } from "@batac-lgu/shared";

// Fastify REST route (apps/server)
import { IdParamsSchema, DocumentFilterSchema } from "@batac-lgu/shared";

// React Hook Form (apps/web)
import { zodResolver } from "@hookform/resolvers/zod";
import { SpResolutionMetadataSchema, type SpResolutionMetadata } from "@batac-lgu/shared";

const form = useForm<SpResolutionMetadata>({
  resolver: zodResolver(SpResolutionMetadataSchema),
});

// TanStack Query response typing (apps/web)
import { type DocumentSelect, type PaginatedResponse } from "@batac-lgu/shared";
```

---

## Part 16 — Schema Enforcement Rules

The following rules are enforced at PR review and, where automated, by tooling:

1. **No locally-defined entity schemas.** Any schema representing a database entity or shared across backend and frontend must live in `/packages/shared`. A locally-defined entity schema in `/apps/web` or `/apps/server` fails review.

2. **drizzle-zod derivation.** Select schemas must be derived from or compositionally consistent with `createSelectSchema()` on the corresponding Drizzle table. Intentional divergences (omitted sensitive fields, computed fields like `displayName`) are documented in this catalog at the point of divergence.

3. **No `z.any()`.** Use `z.record(z.unknown())` for free-form JSON. Use discriminated unions where the shape is known but variable. The only exception is internal test fixtures.

4. **Sensitive fields excluded.** No schema exported from `/packages/shared` includes `password_hash`, `session_token_hash`, `secret_encrypted`, or `ocr_text`.

5. **Input schema refinements match backend rules.** If the server rejects a value that the client-side schema allows, the shared schema must be updated to match. The shared schema is the contract; it must never be more permissive than the authoritative server validation.

6. **Append-only log schemas have no Insert export.** `audit.events`, `workflow.workflow_events`, and `tracking.routing_entries` have no Insert schema in `/packages/shared`. Inserts are internal server operations.

7. **Phase 1B metadata schemas are included now.** All document type metadata schemas are present in this catalog even for Phase 1B types, so the type safety chain holds from the start of Phase 1 development. Phase 1B types are labelled in their schema descriptions.

8. **Enum additions are developer-tier changes.** Adding a value to an enum schema requires a PostgreSQL migration (`ALTER TYPE ... ADD VALUE`) and is therefore a developer-tier change (consolidated reference Part 11.21). Do not expand an enum in TypeScript without a corresponding migration.

---

*This document supersedes any locally-defined schema definitions in `/apps/web` or `/apps/server` present at the time of publication. Migration of pre-existing local schemas to this catalog is a pre-Phase-1-development-start requirement. This document is updated after every stakeholder interview, developer decision, or schema migration that changes a column type, constraint, or business rule.*
