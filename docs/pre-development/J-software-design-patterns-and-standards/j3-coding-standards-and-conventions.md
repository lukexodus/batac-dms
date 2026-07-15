# J3 — Coding Standards and Conventions

**Project:** Batac City LGU Platform (`batac-dms`) **Applies to:** All code in the monorepo (`/apps`, `/packages`, `/tools`) **Audience:** Development team (internal reference) **Status:** Pre-Development Baseline

## Table of Contents

- [L46–L230] 1. TypeScript Configuration and Strictness — Global rules for TypeScript compiler config, strict type checks, `any` prohibition, and function return type requirements.
  - [L48–L105] 1.1 Base `tsconfig.json` — Monorepo-wide base compiler options in `/packages/config` and permissible package/app overrides.
  - [L106–L127] 1.2 The `strict: true` Flag Means All of These — Explicit compiler strictness flags including exact property types and unchecked index access controls.
  - [L128–L176] 1.3 The `any` Prohibition — Mandatory ban on `any`, safe use of `unknown`, type assertions (`as`), and prohibition of `@ts-ignore` bypasses.
  - [L177–L230] 1.4 Explicit Return Types on Exported Functions — Mandatory return type annotations for functions exported from `/packages` and guidelines for internal helpers.
- [L231–L439] 2. Naming Conventions — Casing standards across codebases for variables, components, constants, files, directories, DB tables, schemas, and events.
  - [L233–L257] 2.1 PascalCase — Types, Interfaces, Components, Enums, Classes — PascalCase formatting rules for types, interfaces, React components, classes, and const object enums.
  - [L258–L280] 2.2 camelCase — Functions, Variables, Object Properties, Method Names — camelCase formatting rules for functions, local variables, object attributes, and class methods.
  - [L281–L321] 2.3 SCREAMING_SNAKE_CASE — True Constants — SCREAMING_SNAKE_CASE requirements for module-level immutable configurations, thresholds, and environment variables.
  - [L322–L360] 2.4 kebab-case — File and Directory Names — kebab-case filenames in apps/packages, specific file suffixes (e.g. `.schema.ts`), and `index.ts` public exports.
  - [L361–L384] 2.5 Database Schema and Column Names — PostgreSQL and Drizzle schema naming requirements using snake_case for tables and columns.
  - [L385–L402] 2.6 Zod Schema Names — Zod naming schema suffix (`{Entity}Schema`), and required type inference (`z.infer`) instead of duplication.
  - [L403–L419] 2.7 tRPC Procedure Names — camelCase naming patterns for tRPC procedures using specific verb-resource actions instead of generic handles.
  - [L420–L439] 2.8 Event Bus Event Names — SCREAMING_SNAKE_CASE event naming convention (`MODULE_NOUN_PAST_VERB`) and locations for their exports.
- [L440–L499] 3. Import Ordering — Linter-enforced import group ordering, spacing requirements, and mandatory use of `import type`.
- [L500–L574] 4. Module Boundary Rules — Strict schema isolation boundaries between server modules and their permitted communication patterns.
- [L575–L691] 5. Comment Conventions — Requirements for JSDoc documentation, meaningful inline notes, and structured task comments.
  - [L577–L634] 5.1 JSDoc — Required on All Exported Functions in `/packages/shared` — Mandatory JSDoc tagging format (`@param`, `@returns`, `@throws`) for exports in the shared package.
  - [L635–L671] 5.2 Inline Comments — When and How — Guidelines for writing explanatory inline comments that clarify complex logic instead of restating code.
  - [L672–L691] 5.3 TODO / FIXME / HACK Format — Standardized formatting for temporary comments requiring issue numbers and developer identifiers.
- [L692–L749] 6. Prettier Configuration — Monorepo formatting settings (print width, quotes, trailing commas) and editor configurations for save-actions.
- [L750–L885] 7. ESLint Configuration — Linter rules, base configurations, and plugins for monorepo validation, safety, and import order.
  - [L752–L755] 7.1 Base Config Location — Location of the base ESLint config and rules for extending it in individual packages.
  - [L756–L767] 7.2 Core Plugins — List of ESLint plugins utilized across the codebase for boundary checks, TypeScript safety, and style.
  - [L768–L848] 7.3 Key Rule Decisions — Specific ESLint rules governing TypeScript strictness, forbidden patterns, import sorting, and environment access.
  - [L849–L865] 7.4 `no-console` Enforcement — Mandatory prohibition of `console.*` in favor of structured Pino JSON logging.
  - [L866–L885] 7.5 React-Specific Rules (Web App Only) — React-specific lint rule overrides for props, hooks, and async event handlers.
- [L886–L986] 8. File and Directory Organization — Standard directory layout structures for server modules, React components, and the shared package.
  - [L888–L931] 8.1 Server Module Structure — File layout within server modules, routing, services, repository, and strict `index.ts` public APIs.
  - [L932–L962] 8.2 React Component Structure (`/apps/web`) — Feature-based layout guidelines in web app, single-component default exports, and tightly-coupled subcomponents.
  - [L963–L986] 8.3 Shared Package Structure (`/packages/shared`) — Directory organization of schemas, types, constants, utilities, and events in the shared codebase.
- [L987–L1064] 9. Zod and the Type-Safety Chain — Schema-first type-safety chain, deriving types from schemas, and parsing error handling conventions.
- [L1065–L1156] 10. Error Handling Conventions — Rules for throwing custom Errors, catch type narrowing, promise handling, and tRPC error codes.
- [L1157–L1189] 11. Quick-Reference Cheat Sheet — Summary table of standard conventions for TypeScript, naming, imports, modules, comments, and errors.

---

---

## 1. TypeScript Configuration and Strictness

### 1.1 Base `tsconfig.json`

A single base config lives in `/packages/config/tsconfig.base.json`. Every workspace package and app extends it. Do not define compiler options locally unless the base does not cover a legitimate package-specific need (e.g., `jsx` mode for `/apps/web`).

```json
// /packages/config/tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "verbatimModuleSyntax": true
  }
}
```

**App-level overrides** (`/apps/web/tsconfig.json`):

```json
{
  "extends": "@batac/config/tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

**Server-level override** (`/apps/server/tsconfig.json`):

```json
{
  "extends": "@batac/config/tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src"]
}
```

---

### 1.2 The `strict: true` Flag Means All of These

`"strict": true` enables the following flags. They are each in effect. Do not disable any of them.

|Flag|What it enforces|
|---|---|
|`strictNullChecks`|`null` and `undefined` are not assignable to other types without explicit handling|
|`strictFunctionTypes`|Function parameter types are checked contravariantly|
|`strictBindCallApply`|`bind`, `call`, and `apply` are type-checked|
|`strictPropertyInitialization`|Class properties must be initialised in the constructor|
|`noImplicitAny`|Variables cannot implicitly receive the `any` type|
|`noImplicitThis`|`this` in non-class contexts must be typed|
|`alwaysStrict`|`"use strict"` emitted in every output file|
|`useUnknownInCatchVariables`|`catch (e)` binds `e` as `unknown`, not `any`|

The two extra flags beyond `strict` (`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`) address common sources of runtime errors not covered by the base strict mode:

- **`exactOptionalPropertyTypes`** — `{ foo?: string }` does not allow `{ foo: undefined }`. Assign `undefined` only where the type explicitly includes it.
- **`noUncheckedIndexedAccess`** — `arr[0]` has type `T | undefined`, not `T`. Always guard index access.

---

### 1.3 The `any` Prohibition

**`any` is prohibited.** The ESLint rule `@typescript-eslint/no-explicit-any` is set to `"error"`. There are no exceptions configured. PRs that introduce `any` will not pass CI.

**Instead of `any`, use:**

```typescript
// For truly unknown input (e.g., external API responses before parsing):
const raw: unknown = await response.json();

// For generic containers:
function identity<T>(value: T): T { return value; }

// For dynamic keys with a known value shape:
const lookup: Record<string, DocumentType> = {};

// For intentionally flexible function signatures:
type AnyFunction = (...args: unknown[]) => unknown;
```

**`unknown` is the correct escape hatch**, not `any`. `unknown` forces a type guard before use; `any` silently disables checking.

**Type assertions (`as`) are permitted only when:**

1. You have already validated the shape (e.g., after a Zod parse).
2. The compiler cannot infer an obvious relationship (e.g., `e as Error` after `instanceof Error`).
3. The assertion is followed immediately by a comment explaining why the narrowing is safe.

```typescript
// WRONG
const doc = rawData as DocumentRecord;

// RIGHT — Zod validates shape; assertion is redundant here; let Zod infer:
const doc = DocumentRecordSchema.parse(rawData); // type is DocumentRecord

// ACCEPTABLE — narrowing the catch variable after instanceof guard
try { ... }
catch (e) {
  if (e instanceof DatabaseError) {
    const dbError = e as DatabaseError; // redundant but explicit
    logger.error({ code: dbError.code }, 'DB error');
  }
}
```

**`// @ts-ignore` and `// @ts-expect-error` are prohibited** in all `/apps` and `/packages` code. If a third-party type is wrong, patch it with a `.d.ts` declaration file in the relevant package and leave a comment linking to the upstream issue.

---

### 1.4 Explicit Return Types on Exported Functions

All functions and methods **exported from any file in `/packages`** must have explicit return types. This is enforced by the ESLint rule `@typescript-eslint/explicit-module-boundary-types`.

Internal (non-exported) functions may rely on inference where the return type is obvious from the implementation, but explicit annotation is always preferred.

```typescript
// /packages/shared/src/utils/document-number.ts

// WRONG — no explicit return type on exported function
export function formatDocumentNumber(series: string, year: number, seq: number) {
  return `${series} ${year}-${String(seq).padStart(2, '0')}`;
}

// RIGHT
export function formatDocumentNumber(
  series: string,
  year: number,
  seq: number,
): string {
  return `${series} ${year}-${String(seq).padStart(2, '0')}`;
}

// RIGHT — async functions must include Promise in return type
export async function findDocumentByTrackingId(
  db: Database,
  trackingId: string,
): Promise<Document | null> {
  return db.query.documents.findFirst({
    where: eq(documents.trackingId, trackingId),
  }) ?? null;
}

// ACCEPTABLE for internal helpers — inference is clear
function zeroPad(n: number, width: number) {
  return String(n).padStart(width, '0');
}
```

**Callbacks and anonymous functions** passed as arguments do not require explicit return types unless the inference is non-obvious.

```typescript
// Fine — callback type inferred from the Array.map signature
const titles = documents.map((doc) => doc.title);

// Require explicit type — body is complex enough that inference could mislead
const statuses = steps.reduce<Record<string, StepStatus>>((acc, step) => {
  acc[step.id] = step.status;
  return acc;
}, {});
```

---

## 2. Naming Conventions

### 2.1 PascalCase — Types, Interfaces, Components, Enums, Classes

```typescript
// Types and interfaces
type DocumentStatus = 'draft' | 'submitted' | 'in_workflow' | 'completed';
interface WorkflowStep { id: string; type: StepType; }

// React components (file: document-list.tsx → export: DocumentList)
export function DocumentList({ documents }: DocumentListProps) { ... }

// Enums (prefer const objects + `as const` over TypeScript enums — see §2.6)
const StepType = {
  Action: 'action',
  Approval: 'approval',
  MultiReferral: 'multi_referral',
  Decision: 'decision',
  Notification: 'notification',
  Termination: 'termination',
} as const;
type StepType = typeof StepType[keyof typeof StepType];

// Classes (used sparingly — prefer plain functions and objects)
class WorkflowEngine { ... }
```

### 2.2 camelCase — Functions, Variables, Object Properties, Method Names

```typescript
// Functions
function assignCommitteeReferral(stepId: string, committeeIds: string[]): void { ... }

// Variables
const preliminaryNumber = `Draft 7SP ${year}-${seq}`;
let isOverrideVoteRequired = false;

// Object properties
const workflowInstance = {
  definitionVersionId: '...',
  currentStepId: '...',
  startedAt: new Date(),
};

// Method names
class DocumentService {
  async promoteToFinalNumber(documentId: string): Promise<void> { ... }
}
```

### 2.3 SCREAMING_SNAKE_CASE — True Constants

Use `SCREAMING_SNAKE_CASE` for values that are:

- Defined at the module level
- Never reassigned
- Represent a fixed configuration value, threshold, or domain constant (not a runtime-derived value)

```typescript
// /packages/shared/src/constants/workflow.ts

export const MAYOR_REVIEW_WINDOW_DAYS = 10;
export const PANLALAWIGAN_REVIEW_WINDOW_DAYS = 30;
export const QUORUM_THRESHOLD = 7;           // of 12 members
export const VETO_OVERRIDE_THRESHOLD = 8;    // of 12 members
export const SESSION_DAY_OF_WEEK = 2;        // Tuesday (0 = Sunday)
export const ORDER_OF_BUSINESS_CUTOFF_DAY = 4; // Thursday
export const QR_TRACKING_PREFIX = 'DTS';
export const SP_ORDINAL = 7;                 // 7th Sangguniang Panlungsod

// NOT a true constant — derived at runtime
const currentYear = new Date().getFullYear(); // stays camelCase
```

**Zod `z.literal` values and string union members** are not module-level constants; they live inside the schema definition and follow the schema conventions (see §9).

**Environment variable names** (in `.env` files and `process.env`) are SCREAMING_SNAKE_CASE by convention. They are accessed through the validated env config module — never read `process.env` directly in application code.

```typescript
// WRONG — direct process.env access in application code
const bucket = process.env.S3_BUCKET;

// RIGHT — import the validated env object from the app's config module
// In apps/server:
import { env } from '../config/env';
// In apps/web:
import { clientEnv } from '../config/env.client';

const bucket = env.S3_BUCKET;
```

### 2.4 kebab-case — File and Directory Names

All file and directory names in `/packages` and `/apps` use **kebab-case**, regardless of what the file exports.

|What the file exports|File name|
|---|---|
|`DocumentList` component|`document-list.tsx`|
|`WorkflowEngine` class|`workflow-engine.ts`|
|`formatDocumentNumber` function|`format-document-number.ts`|
|`DocumentRecordSchema` Zod schema|`document-record.schema.ts`|
|`useDocumentSearch` hook|`use-document-search.ts`|
|Tests for `document-list.tsx`|`document-list.test.tsx`|

**Suffix conventions:**

|Suffix|Use|
|---|---|
|`.schema.ts`|Zod schema definitions (in `/packages/shared`)|
|`.types.ts`|Type-only files where they need to be isolated|
|`.test.ts` / `.test.tsx`|Vitest unit and integration tests|
|`.spec.ts`|Playwright E2E spec files|
|`.config.ts`|Configuration objects|
|`.constants.ts`|Module-level constants|
|`.router.ts`|tRPC router definitions|
|`.handler.ts`|Fastify route handler functions|
|`.service.ts`|Domain service modules|
|`.repository.ts`|Database query modules|
|`.events.ts`|Internal event type definitions|

**Index files (`index.ts`)** are used at the top of each package to define the public API. Consumers import from the package, not from internal paths.

```typescript
// RIGHT
import { DocumentRecordSchema } from '@batac/shared';

// WRONG — reaches into internal path
import { DocumentRecordSchema } from '@batac/shared/src/schemas/document-record.schema';
```

### 2.5 Database Schema and Column Names

Drizzle schema definitions use **snake_case** for table names and column names, consistent with PostgreSQL conventions.

```typescript
// /packages/database/src/schema/documents.schema.ts
export const documents = pgTable('documents', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  cityId:              uuid('city_id').notNull(),
  documentTypeId:      uuid('document_type_id').notNull(),
  originatingOfficeId: uuid('originating_office_id').notNull(),
  trackingId:          varchar('tracking_id', { length: 64 }).notNull().unique(),
  preliminaryNumber:   varchar('preliminary_number', { length: 64 }),
  finalNumber:         varchar('final_number', { length: 64 }),
  status:              documentStatusEnum('status').notNull().default('draft'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:           timestamp('deleted_at', { withTimezone: true }),
  deletedBy:           uuid('deleted_by'),
});
```

The TypeScript property name (camelCase) and the SQL column name (snake_case) can differ. Drizzle handles the translation. Column names in raw SQL strings must use the snake_case form.

### 2.6 Zod Schema Names

Zod schemas in `/packages/shared` follow the pattern `{Entity}Schema` for object schemas and `{Entity}InputSchema` or `{Entity}OutputSchema` for I/O variants.

```typescript
// Object schemas
export const DocumentRecordSchema = z.object({ ... });
export const WorkflowStepSchema = z.object({ ... });

// Input/output variants
export const CreateDocumentInputSchema = z.object({ ... });
export const CreateDocumentOutputSchema = z.object({ ... });

// Inferred types — always derive from the schema, do not duplicate
export type DocumentRecord = z.infer<typeof DocumentRecordSchema>;
export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>;
```

### 2.7 tRPC Procedure Names

tRPC procedures use **camelCase** and must reflect an action on a resource:

```typescript
// Pattern: {verb}{Resource} or {resource}.{verb}
documentRouter.getById
documentRouter.create
documentRouter.promoteToFinalNumber
workflowRouter.advanceStep
workflowRouter.getInstanceStatus
sessionRouter.record
sessionRouter.getAttendance
```

Avoid generic names like `get`, `update`, `handle`. Be specific about what is being fetched or mutated.

### 2.8 Event Bus Event Names

Internal event bus events use **SCREAMING_SNAKE_CASE** with a module prefix:

```typescript
// Pattern: {MODULE}_{NOUN}_{PAST_VERB}
export const DOCUMENT_LOGGED_BY_SECRETARIAT = 'DOCUMENT_LOGGED_BY_SECRETARIAT';
export const WORKFLOW_STEP_COMPLETED = 'WORKFLOW_STEP_COMPLETED';
export const MAYOR_REVIEW_WINDOW_LAPSED = 'MAYOR_REVIEW_WINDOW_LAPSED';
export const PANLALAWIGAN_TIMER_STARTED = 'PANLALAWIGAN_TIMER_STARTED';
export const DESIGNATION_GRANT_CREATED = 'DESIGNATION_GRANT_CREATED';
export const CERTIFICATION_OF_URGENCY_LOGGED = 'CERTIFICATION_OF_URGENCY_LOGGED';
export const COMMITTEE_REPORT_SUBMITTED = 'COMMITTEE_REPORT_SUBMITTED';
export const AUDIT_EVENT_WRITTEN = 'AUDIT_EVENT_WRITTEN';
```

Event name constants are defined in each module's `events.ts` file and re-exported from the module's `index.ts` as part of its public API.

---

## 3. Import Ordering

ESLint `eslint-plugin-import` with the `import/order` rule enforces a consistent import order. The rule configuration is in `/packages/config/eslint.base.js`. Do not reorder imports manually to circumvent the linter.

### 3.1 Import Groups (in order)

1. **Node built-in modules** — `node:crypto`, `node:path`, `node:fs`, etc. Always use the `node:` prefix.
2. **External packages** — npm packages; anything resolved from `node_modules`.
3. **Internal monorepo packages** — `@batac/*` workspace packages.
4. **Absolute imports within the same app** — paths resolved by `@/*` aliases.
5. **Relative imports** — `./`, `../`.
6. **Side-effect imports** — `import './styles.css'`.
7. **Type-only imports** — `import type { ... }` (separated by blank line from value imports in the same group).

### 3.2 Blank Lines Between Groups

One blank line separates each group. No blank lines within a group.

```typescript
// 1. Node built-ins
import { createHmac, randomUUID } from 'node:crypto';
import { join } from 'node:path';

// 2. External packages
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

// 3. Internal monorepo packages
import { DocumentRecordSchema, MAYOR_REVIEW_WINDOW_DAYS } from '@batac/shared';
import { db } from '@batac/database';

// 4. Absolute app-local imports (if applicable)
import { auditService } from '@/modules/audit/audit.service';

// 5. Relative imports
import { formatDocumentNumber } from './format-document-number';
import { buildPreliminaryNumber } from './numbering-helpers';

// Type-only imports — same ordering rules, but use `import type`
import type { Database } from '@batac/database';
import type { WorkflowStepInstance } from '@batac/shared';
import type { FastifyPluginAsync } from 'fastify';
```

### 3.3 `import type` Rule

Use `import type` for any import that is used **only as a type** (never as a value at runtime). This is enforced by `@typescript-eslint/consistent-type-imports`. The `verbatimModuleSyntax` tsconfig option ensures TypeScript strips type-only imports correctly during compilation.

```typescript
// WRONG — value import for a type-only use
import { FastifyPluginAsync } from 'fastify';
const plugin: FastifyPluginAsync = async (app) => { ... };

// RIGHT — type-only import
import type { FastifyPluginAsync } from 'fastify';
const plugin: FastifyPluginAsync = async (app) => { ... };
```

---

## 4. Module Boundary Rules

### 4.1 The Cross-Module Schema Import Prohibition

Each server module owns its own PostgreSQL schema. **No module may import from another module's schema file.**

```
schema: iam           → users, credentials, sessions, refresh_tokens, roles, permissions
schema: organization  → offices, positions, employees, assignments, delegations
schema: documents     → document_types, documents, versions, attachments, numbers, number_series, signatures
schema: workflow      → definitions, definition_versions, steps, transition_rules, instances, step_instances, workflow_events
schema: tracking      → tracking_records, routing_entries, qr_codes
schema: records       → records, retention_schedules, archive_entries, classification_rules, dispositions
schema: notifications → templates, notification_events, delivery_log
schema: audit         → events (append-only; INSERT-only DB permissions)
schema: search_meta   → index_metadata, index_jobs
schema: portal        → public_documents, citizen_requests, complaints, announcements
schema: reporting     → report_definitions, schedules, outputs
```

```typescript
// /apps/server/src/modules/workflow/workflow.service.ts

// WRONG — workflow module directly imports the documents schema
import { documents } from '@batac/database/schema/documents';

// RIGHT — workflow module works with document data passed to it or
// fetches from its own schema and receives document identifiers only
import { workflowInstances } from '@batac/database/schema/workflow';
```

**Why this matters:** Cross-schema imports create implicit coupling between modules. When the documents schema changes, the workflow module's code breaks even though workflow has no business reason to know about document internals. The module boundary enforces the architectural invariant that modules communicate only through defined contracts.

### 4.2 Permitted Communication Channels

Modules communicate through exactly two channels:

**A. The internal event bus** — for fire-and-forget notifications after a state change.

```typescript
// workflow.service.ts — emits after a step completes
await eventBus.emit(WORKFLOW_STEP_COMPLETED, {
  instanceId: stepInstance.workflowInstanceId,
  stepId: stepInstance.stepId,
  completedBy: actorId,
  completedAt: new Date(),
});

// notifications/notification.listener.ts — reacts to the event
eventBus.on(WORKFLOW_STEP_COMPLETED, async (payload) => {
  await notificationService.dispatchStepCompletedNotification(payload);
});
```

**B. A published module service function or repository function** — for synchronous cross-module reads where the emitting module provides a typed function.

```typescript
// iam/index.ts — IAM module's public API
export { getUserById } from './iam.repository';
export type { User } from './iam.types';

// workflow/workflow.service.ts — consumes IAM public API (not IAM schema)
import { getUserById } from '@batac/server/modules/iam';
```

**No other channel is permitted.** A module may not reach into another module's repository, database query helper, or schema file — even as a "shortcut."

### 4.3 Enforcement

- **Automated migration linting** — a custom Turborepo task (`lint:boundaries`) runs `eslint-plugin-boundaries` on every PR. It reads the module map from `/tools/scripts/module-boundaries.config.js` and fails CI if any import crosses a declared boundary.
- **Code review policy** — every PR that touches a module's schema file or index.ts must include a reviewer who owns the downstream affected module.
- **No cross-schema foreign key constraints** — enforced by the migration linter, which scans generated SQL for `REFERENCES` that cross schema names.

---

## 5. Comment Conventions

### 5.1 JSDoc — Required on All Exported Functions in `/packages/shared`

Every exported function in `/packages/shared` must have a JSDoc comment. The ESLint rule `jsdoc/require-jsdoc` is configured to enforce this for exported functions in the shared package.

**Minimum required JSDoc tags:**

```typescript
/**
 * Formats a document control number in the confirmed SP Secretariat format.
 *
 * All document types use a space delimiter between the series prefix and the
 * year-sequence component. Example output: `SPR 2026-01`, `MO 2025-04`.
 *
 * @param series - The document type prefix (e.g., `'SPR'`, `'MO'`, `'NCH'`).
 * @param year - The calendar year (e.g., `2026`).
 * @param seq - The sequence number within the year (1-based, zero-padded to 2 digits).
 * @returns The formatted control number string.
 *
 * @example
 * formatControlNumber('SPR', 2026, 1) // → 'SPR 2026-01'
 * formatControlNumber('NOSP', 2026, 13) // → 'NOSP 2026-13'
 */
export function formatControlNumber(series: string, year: number, seq: number): string {
  return `${series} ${year}-${String(seq).padStart(2, '0')}`;
}
```

**Tag requirements:**

|Tag|Required when|
|---|---|
|`@param`|Function has parameters|
|`@returns`|Function returns a non-void value|
|`@throws`|Function throws a known error class|
|`@example`|The usage is non-obvious or the function has edge cases|
|`@deprecated`|Function is deprecated; include migration path in body|

**JSDoc on types and interfaces in `/packages/shared`:**

```typescript
/**
 * The two-stage numbering state for an SP legislative measure.
 *
 * Preliminary numbers carry the `Draft ` prefix and can change before finalization.
 * The final number is assigned after the last reading vote and is immutable.
 *
 * @see Part 5 of the architecture reference for numbering rules.
 */
export interface DocumentNumberState {
  /** The preliminary number, including `Draft ` prefix. Null if not yet assigned. */
  preliminary: string | null;
  /** The final number, without `Draft ` prefix. Null until the last reading vote. */
  final: string | null;
  /** The QR tracking number. Assigned at logging, before preliminary number. Immutable. */
  trackingId: string;
}
```

### 5.2 Inline Comments — When and How

Write inline comments for **non-obvious decisions**, not for obvious code. A comment that repeats the code in English adds noise without value.

```typescript
// WRONG — repeats the code
// Check if the document has a final number
if (document.finalNumber !== null) { ... }

// RIGHT — explains the domain rule behind the condition
// Final numbers are immutable; only documents still in draft/workflow status
// can have their preliminary number replaced. Per Part 5.2 of the arch ref.
if (document.finalNumber !== null) {
  throw new DocumentAlreadyFinalizedException(document.id);
}
```

```typescript
// RIGHT — explains a non-obvious technical choice
// Drizzle does not expose a native `FOR UPDATE SKIP LOCKED` shortcut;
// using sql`` template tag to get advisory lock on the sequence row.
// This prevents duplicate sequence numbers under concurrent requests.
await db.execute(
  sql`SELECT pg_advisory_xact_lock(${SEQUENCE_LOCK_KEY})`
);
```

**Section separator comments in large files:**

Use a comment block to separate logical sections within a file that is too large to split further. This is acceptable but should be infrequent — prefer file splitting.

```typescript
// ---------------------------------------------------------------------------
// Committee Referral Step Handlers
// ---------------------------------------------------------------------------
```

### 5.3 TODO / FIXME / HACK Format

Use a structured format that ESLint's `no-warning-comments` rule can track:

```typescript
// TODO(username): Short description of what needs to be done.
// FIXME(username): Short description of the known defect.
// HACK(username): Short description of why this compromise exists and what
//   the correct solution would be. Include a ticket number.
```

Every TODO and FIXME must include a GitHub issue number before a PR is merged to `main`. PRs with untracked TODOs will not pass review.

```typescript
// TODO(beltran): Extract this into a shared date utility — see GH #42.
const sessionDate = startOfDay(addDays(referralDate, 7));
```

---

## 6. Prettier Configuration

Prettier runs on all TypeScript, JavaScript, JSON, Markdown, and CSS files. The config is in `/packages/config/.prettierrc.json` and is referenced by each workspace package.

### 6.1 `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "trailingComma": "all",
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Rationale for key settings:**

|Setting|Value|Reason|
|---|---|---|
|`printWidth`|`100`|TypeScript generics and JSDoc annotations frequently exceed 80 characters|
|`trailingComma`|`"all"`|Cleaner git diffs when adding new array items or function parameters|
|`singleQuote`|`true`|Consistent with the majority TypeScript convention; avoids HTML/JSX conflicts|
|`semi`|`true`|Avoids ASI edge cases; explicit termination|

### 6.2 `.prettierignore`

```
.turbo
dist
build
.next
node_modules
*.sql           # Drizzle-generated migrations: reviewed as-is
coverage
```

### 6.3 Format on Save

All team members must configure their editor to format on save using the workspace Prettier config. A `.vscode/settings.json` is committed to the repository:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" }
}
```

---

## 7. ESLint Configuration

### 7.1 Base Config Location

`/packages/config/eslint.base.js` — extended by all packages and apps. Each package adds its own `eslint.config.js` that extends the base and adds package-specific overrides (e.g., `react/` rules for `/apps/web`, no-DOM rules for `/apps/server`).

### 7.2 Core Plugins

|Plugin|Purpose|
|---|---|
|`@typescript-eslint`|TypeScript-aware lint rules|
|`eslint-plugin-import`|Import ordering and resolution|
|`eslint-plugin-boundaries`|Module boundary enforcement|
|`jsdoc`|JSDoc completeness on exports in `/packages/shared`|
|`eslint-plugin-react`|React-specific rules (web app only)|
|`eslint-plugin-react-hooks`|Hook dependency arrays (web app only)|
|`eslint-plugin-no-restricted-imports`|Blocks direct `process.env` access, cross-schema imports|

### 7.3 Key Rule Decisions

```js
// /packages/config/eslint.base.js (excerpt)
module.exports = {
  rules: {
    // TypeScript strictness — aligned with tsconfig strict mode
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',

    // Forbidden patterns
    'no-console': 'error',         // Use Pino logger, not console
    'no-debugger': 'error',
    'no-warning-comments': [
      'warn',
      { terms: ['todo', 'fixme', 'hack'], location: 'start' },
    ],

    // Import ordering
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          ['internal', 'parent', 'sibling', 'index'],
          'type',
        ],
        pathGroups: [
          { pattern: '@batac/**', group: 'internal', position: 'before' },
        ],
        pathGroupsExcludedImportTypes: ['type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-duplicates': 'error',
    'import/no-cycle': 'error',

    // Prevent direct environment variable access in application code
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MemberExpression[object.name="process"][property.name="env"]',
        message:
          'Do not access process.env directly. Import the validated env object ' +
          'from the app\'s config module (apps/server: src/config/env.ts; ' +
          'apps/web: src/config/env.client.ts).',
      },
    ],
  },
};

To allow the startup validation files (which must parse `process.env` to populate the application's config module) to access `process.env` directly, they must be explicitly exempted via overrides in their respective local ESLint configurations:

```js
// In apps/server's local eslint.config.js (not the shared base)
overrides: [
  {
    files: ['src/config/env.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
],
```
```

### 7.4 `no-console` Enforcement

`console.*` is forbidden in all application code. Use the Pino logger instance:

```typescript
// WRONG
console.log('Document logged:', documentId);
console.error('Failed to assign number:', err);

// RIGHT — in server modules
import { logger } from '@batac/server/logger';
logger.info({ documentId }, 'Document logged by secretariat');
logger.error({ err, documentId }, 'Failed to assign preliminary number');
```

The logger is structured JSON (Pino). All log calls must include a context object as the first argument and a message string as the second. Never concatenate data into the message string — put it in the context object.

### 7.5 React-Specific Rules (Web App Only)

```js
// /apps/web/eslint.config.js additions
{
  rules: {
    'react/prop-types': 'off',                  // TypeScript handles this
    'react/react-in-jsx-scope': 'off',          // React 17+ JSX transform
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',      // Warn, not error, for complex deps
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } }, // Allow async onClick handlers
    ],
  },
}
```

---

## 8. File and Directory Organization

### 8.1 Server Module Structure

Each server module under `/apps/server/src/modules/{module-name}/` follows this layout:

```
/modules/workflow/
  index.ts                  ← Public API (explicit re-exports only)
  workflow.router.ts         ← tRPC router definition
  workflow.service.ts        ← Business logic; calls repositories
  workflow.repository.ts     ← Drizzle queries against the workflow schema
  workflow.events.ts         ← Event name constants emitted by this module
  workflow-engine.ts         ← Core state machine implementation
  step-handlers/
    action-step.handler.ts
    multi-referral-step.handler.ts
    decision-step.handler.ts
  __tests__/
    workflow-engine.test.ts
    multi-referral-step.test.ts
```

**`index.ts` exports only the public API.** Internal files are not re-exported unless another module needs them through the defined communication channels.

```typescript
// /modules/workflow/index.ts

// Public service functions (consumed by other modules via event listeners)
export { getWorkflowInstanceStatus } from './workflow.repository';
export { advanceWorkflowStep } from './workflow.service';

// Public types (never internal Drizzle table types)
export type { WorkflowInstanceStatus, StepCompletion } from '@batac/shared';

// Event names (so listeners can subscribe without knowing internals)
export {
  WORKFLOW_STEP_COMPLETED,
  MAYOR_REVIEW_WINDOW_LAPSED,
  COMMITTEE_REPORT_SUBMITTED,
} from './workflow.events';

// Router (consumed by the root Fastify plugin)
export { workflowRouter } from './workflow.router';
```

### 8.2 React Component Structure (`/apps/web`)

```
/src/features/documents/
  index.ts
  components/
    document-list.tsx
    document-list.test.tsx
    document-detail.tsx
    document-number-badge.tsx
  hooks/
    use-document-search.ts
    use-document-search.test.ts
  pages/
    documents-page.tsx
    document-detail-page.tsx
  types.ts                    ← Feature-local types not in shared
```

Component files export **exactly one component** as the default export. Named exports from component files are for sub-components tightly coupled to the main component.

```typescript
// document-list.tsx

// Named export for a tightly-coupled sub-component
export function DocumentListItem({ document }: { document: DocumentRecord }) { ... }

// Default export for the primary component
export default function DocumentList({ filters }: DocumentListProps) { ... }
```

### 8.3 Shared Package Structure (`/packages/shared`)

```
/packages/shared/src/
  schemas/
    document.schema.ts
    workflow.schema.ts
    complaint.schema.ts
    ...
  types/
    document.types.ts         ← Types that cannot be derived from Zod schemas
  constants/
    workflow.constants.ts
    numbering.constants.ts
  utils/
    document-number.ts
    date-helpers.ts
  events/
    event-names.ts            ← All internal event name constants
  index.ts                    ← Barrel — all public exports
```

---

## 9. Zod and the Type-Safety Chain

### 9.1 Schema-First Rule

The Zod schema in `/packages/shared` is the **single source of truth** for any data shape that crosses a boundary — between server and client, between modules via published API, or between the application and external input.

**The chain is:**

```
Drizzle schema (PostgreSQL types)
  → drizzle-zod → Zod schema (in /packages/shared)
    → TypeScript type (via z.infer)
      → tRPC procedure I/O validation
      → React Hook Form validation
      → TanStack Query response types
```

Do not break this chain by:

- Declaring a TypeScript `interface` that duplicates a Zod schema
- Using `as` to convert an unvalidated payload to a typed object
- Accepting `unknown` and not validating it with Zod before use

### 9.2 Inferred Types vs. Declared Interfaces

**Prefer `z.infer<typeof Schema>` over manually declared interfaces** for any type that has a corresponding Zod schema.

```typescript
// /packages/shared/src/schemas/document.schema.ts

export const DocumentRecordSchema = z.object({
  id: z.string().uuid(),
  trackingId: z.string(),
  preliminaryNumber: z.string().nullable(),
  finalNumber: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'in_workflow', 'completed', 'released', 'archived']),
  createdAt: z.date(),
});

// Derive the type — do NOT declare a separate interface
export type DocumentRecord = z.infer<typeof DocumentRecordSchema>;
```

**When a manually declared interface IS appropriate:**

- The type is used only internally within a module and has no external validation requirement.
- The type represents a complex generic constraint that Zod cannot express.
- The type is an internal function signature or utility type.

```typescript
// Acceptable — internal to the workflow engine; never validated from external input
interface StepTransitionContext {
  instance: WorkflowInstance;
  step: WorkflowStepDefinition;
  actorId: string;
  metadata?: Record<string, unknown>;
}
```

### 9.3 Zod `.parse()` vs. `.safeParse()`

- Use `.parse()` when a validation failure is a programming error (bad data from your own DB or internal code). It throws a `ZodError` — let it propagate as an unhandled exception to be caught by Sentry.
- Use `.safeParse()` when a validation failure is an expected user error (form input, external API response). Handle the failure branch explicitly.

```typescript
// .parse() — for internal data that must always be valid
const config = WorkflowDefinitionSchema.parse(rawDefinition);

// .safeParse() — for user-submitted form data
const result = CreateDocumentInputSchema.safeParse(req.body);
if (!result.success) {
  return reply.code(400).send({ errors: result.error.flatten() });
}
const input = result.data;
```

---

## 10. Error Handling Conventions

### 10.1 Never Throw Strings or Plain Objects

Always throw an instance of `Error` or a subclass of `Error`. This ensures the stack trace is captured and Sentry reports it correctly.

```typescript
// WRONG
throw 'Document not found';
throw { code: 'NOT_FOUND', message: 'Document not found' };

// RIGHT — domain-specific error class
export class DocumentNotFoundException extends Error {
  constructor(documentId: string) {
    super(`Document not found: ${documentId}`);
    this.name = 'DocumentNotFoundException';
  }
}

throw new DocumentNotFoundException(documentId);
```

**Domain error classes** live in each module's `errors.ts` file and are re-exported from the module's `index.ts`.

### 10.2 `catch (e)` Is Always `unknown`

The `useUnknownInCatchVariables` tsconfig flag ensures this. Narrow before use:

```typescript
try {
  await db.insert(documents).values(newDoc);
} catch (e) {
  // WRONG — assumes e is an Error
  logger.error({ message: e.message }, 'Insert failed');

  // RIGHT — narrow first
  if (e instanceof Error) {
    logger.error({ err: e }, 'Document insert failed');
  } else {
    logger.error({ cause: e }, 'Document insert failed with non-Error throw');
  }
  throw e; // Always re-throw unless you fully handled the error
}
```

### 10.3 Promise Handling — No Floating Promises

The ESLint rule `@typescript-eslint/no-floating-promises` is set to `"error"`. Every Promise must be either `await`ed, returned, or explicitly `.catch()`ed.

```typescript
// WRONG — floating promise
eventBus.emit(WORKFLOW_STEP_COMPLETED, payload);

// RIGHT — await it
await eventBus.emit(WORKFLOW_STEP_COMPLETED, payload);

// RIGHT — fire-and-forget with explicit error handling
eventBus.emit(WORKFLOW_STEP_COMPLETED, payload).catch((e) => {
  logger.error({ err: e }, 'Failed to emit WORKFLOW_STEP_COMPLETED');
});

// RIGHT — void cast for intentional fire-and-forget (requires team agreement per call site)
void eventBus.emit(WORKFLOW_STEP_COMPLETED, payload);
```

Use `void` only when the fire-and-forget nature of the call is intentional and documented. Add an inline comment at each `void` site explaining why the result is discarded.

### 10.4 tRPC Error Codes

Use the appropriate tRPC `TRPCError` code. Do not use HTTP status codes directly in tRPC procedures.

```typescript
import { TRPCError } from '@trpc/server';

// Not found
throw new TRPCError({ code: 'NOT_FOUND', message: `Document ${id} not found` });

// Unauthorized (not authenticated)
throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });

// Forbidden (authenticated but not allowed)
throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });

// Validation failed (prefer letting Zod handle this automatically via input schemas)
throw new TRPCError({ code: 'BAD_REQUEST', message: 'Final number cannot be changed' });

// Conflict (e.g., duplicate numbering, duplicate designation)
throw new TRPCError({ code: 'CONFLICT', message: 'Person already has an active designation' });
```

---

## 11. Quick-Reference Cheat Sheet

|Category|Rule|Example|
|---|---|---|
|TypeScript|`strict: true` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`|See §1.1|
|TypeScript|No `any` — use `unknown`|`const raw: unknown = res.json()`|
|TypeScript|Explicit return types on all exports in `/packages`|`export function foo(): string`|
|TypeScript|`import type` for type-only imports|`import type { User } from '...'`|
|Naming|Types, interfaces, components → PascalCase|`DocumentRecord`, `DocumentList`|
|Naming|Functions, variables → camelCase|`formatControlNumber`, `currentYear`|
|Naming|Module-level fixed values → SCREAMING_SNAKE_CASE|`MAYOR_REVIEW_WINDOW_DAYS`|
|Naming|Files and directories → kebab-case|`document-list.tsx`|
|Naming|DB columns → snake_case|`originating_office_id`|
|Naming|Zod schemas → `{Entity}Schema`|`DocumentRecordSchema`|
|Naming|Event names → `MODULE_NOUN_PAST_VERB`|`WORKFLOW_STEP_COMPLETED`|
|Imports|Group order: Node → External → `@batac/*` → `@/` → Relative → Types|See §3|
|Imports|One blank line between groups|See §3.2|
|Modules|No cross-schema imports|See §4.1|
|Modules|Communicate via event bus or published module API only|See §4.2|
|Comments|JSDoc required on all exports in `/packages/shared`|See §5.1|
|Comments|Comments explain _why_, not _what_|See §5.2|
|Comments|TODOs must include username and GH issue before merge|`// TODO(rosales): GH #42`|
|Prettier|`printWidth: 100`, `singleQuote: true`, `trailingComma: 'all'`|See §6.1|
|ESLint|`no-console: error` — use Pino logger|See §7.4|
|Zod|Schema is source of truth — derive types with `z.infer`|See §9.2|
|Zod|`.parse()` for internal data, `.safeParse()` for user input|See §9.3|
|Errors|Never throw strings — always throw `Error` subclasses|See §10.1|
|Errors|`catch (e)` is `unknown` — narrow before use|See §10.2|
|Errors|No floating promises — `await`, `return`, or `.catch()`|See §10.3|

---

_This document is the authoritative coding standards reference. Questions about rules not covered here should be raised in a team discussion and resolved with an update to this document — not by precedent in code._
