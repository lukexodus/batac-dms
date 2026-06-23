# A1 — Module Task List: INFRA

Generated per `A1-AGENTS.md` §6 "Step 2 — Module passes," for the `INFRA` module
(Wave A — no prerequisite module task lists). This document contains tasks only;
it is not the assembled A1 (that is the Step 4 integration pass).

**Documents loaded for this pass, in order:** `a1-skeleton.md` (v2) →
`tech-stack.md` → L1 (Environment Variable Catalog) → L2 (Docker and Docker
Compose Specification) → L3 (CI/CD Pipeline Specification) → L4 (Backup and DR
Runbooks) → D5 (Deployment Diagram) → C5 (Migration Strategy and Conventions) →
J3 (Coding Standards and Conventions). Per `A1-AGENTS.md` §6 Step 2's opening
instruction ("read the capability list for this module in consolidated ref §13
Phase 1... for every pass without exception"), Part 13 (Roadmap), §10.2 (Module
Boundaries), §11.2 (Infrastructure and Cloud Agnosticism), and §11.14
(Disaster Recovery and Backup) of
`consolidated-architecture-and-requirements-reference-iteration-3.md` were also
read, since the nine documents above are themselves downstream interpretations
of that reference. `AGENTS.md` (the execution-phase routing file) was not read,
per `A1-AGENTS.md` §8.

**Sourcing & confidence legend** (matching the convention established in
`a1-skeleton.md` v2):
- Unmarked statements are taken directly from one of the nine loaded documents.
- `[Inference]` — a reasoned synthesis not stated verbatim in a loaded document.
- `[SPEC GAP]` — something a source requires but no loaded document specifies
  clearly enough to write a self-contained AI Prompt for. Not invented; left for
  human resolution per `A1-AGENTS.md` §1 and §8.
- `[CONFLICT]` — an apparent disagreement between two loaded sources, flagged
  rather than resolved by guessing, per `A1-AGENTS.md` §1.

---

## Phase 1 INFRA capabilities identified before task generation

Per `A1-AGENTS.md` §6 Step 2: the consolidated reference's Phase 1 "Included"
list (Part 13) names `INFRA` only as a single trailing line item — "Infrastructure" — with
no enumerated sub-capabilities of its own, since `INFRA` is not one of the 11
schema-owning domain modules (`a1-skeleton.md` v2 §2, footnote `[†1]`). Its
Phase 1 scope is therefore derived entirely from the nine cross-cutting
documents above, not from a §13 capability list written in domain language.
Reading those nine documents end to end (per the ToC-scoped discipline in
`A1-AGENTS.md` §9), the complete set of Phase 1 INFRA deliverables is:

1. Monorepo workspace tooling — pnpm workspaces, Turborepo, shared
   TypeScript/ESLint/Prettier configuration (`tech-stack.md` Monorepo
   Structure; J3 §1.1, §6, §7).
2. Environment variable validation — Zod schemas for `/apps/server` and
   `/apps/web`, the `.env.example` template, and the Docker secrets loader
   (L1 §21–§23).
3. Local development infrastructure — `compose.yml` (PostgreSQL, MinIO,
   Mailpit, reserved Meilisearch profile), the PostgreSQL role bootstrap
   script, and post-migration grants (L2 Part 1–2).
4. Migration tooling — the Drizzle Kit migration runner and the automated
   migration invariant linter (C5 §2, §6, §7; L2 Part 10).
5. Production container images — the Fastify server Dockerfile, the web SPA
   Dockerfile, and the Nginx reverse-proxy configuration (L2 Part 4–6).
6. The liveness health-check endpoint consumed by every health probe in L2
   Part 7 and D5 (L2 Part 7).
7. The production/staging Docker Compose stack (L2 Part 3).
8. CI/CD — the pull-request merge-gate pipeline and the main-branch
   E2E/deployment-gate pipeline (L3 §2–§9, §11–§12).
9. The full backup/DR runbook set — WAL-based PITR archiving, daily encrypted
   `pg_dump`, streaming replication and failover, the monthly restoration
   test, the quarterly DR drill, and the break-glass procedure (L4, all six
   runbooks).

No Phase 1B, 2, 3, 4, or 5 capability is generated below. Where a loaded
document names later-phase INFRA-relevant work (Meilisearch container,
Multi-LGU assessment, on-premise migration tooling, HRIS/Payroll and
procurement integrations), it is recorded only in the Module Summary's
Deferred Capabilities list, per `A1-AGENTS.md` §5.

---

## TASK-INFRA-001

Phase:          1
Module:         INFRA
Title:          Bootstrap monorepo workspace and shared tooling configuration
Prerequisites:  [NONE]
Deliverables:
  - /package.json — root workspace manifest; `private: true`; `packageManager` field pinned via Corepack
  - /pnpm-workspace.yaml — workspace globs: `apps/*`, `packages/*`, `tools/*`
  - /turbo.json — initial task graph stub (`build`, `lint`, `typecheck`, `dev`); extended by later tasks
  - /.gitignore — `node_modules`, `dist`, `.turbo`, `.env`, `.env.local`, `coverage`, `build`, `.next`
  - /packages/config/package.json — `@batac/config` workspace package manifest
  - /packages/config/tsconfig.base.json — shared base TypeScript compiler options
  - /packages/config/eslint.base.js — shared ESLint rule set
  - /packages/config/.prettierrc.json — Prettier configuration
  - /packages/config/.prettierignore — Prettier ignore list
  - /tools/scripts/package.json — `@batac/scripts` workspace package manifest (stub; populated by TASK-INFRA-007)
  - /.vscode/settings.json — committed format-on-save editor configuration
Acceptance Criteria:
  - [ ] `pnpm install --frozen-lockfile` completes with exit code 0 on a clean checkout
  - [ ] `pnpm -v` on a clean checkout matches the version pinned in the root `package.json` `packageManager` field (verifies Corepack activation per ADR-INF-008)
  - [ ] `pnpm turbo run lint` and `pnpm turbo run typecheck` both resolve as valid Turborepo tasks (zero affected packages is an acceptable result at this stage; a "task not found" error is not)
  - [ ] Manual: opening any `.ts` file in VS Code on a fresh checkout shows the Prettier extension as the active default formatter with no per-developer settings changes required
AI Prompt:
  > Scaffold the root-level monorepo tooling for a pnpm + Turborepo workspace.
  > You have no pre-development documents available — all required values are
  > below.
  >
  > **Workspace layout** (create directories now if absent; do not populate
  > app/package source files — that is out of scope for this task):
  > ```
  > /apps/web        /apps/server        /apps/portal
  > /packages/shared /packages/ui        /packages/config   /packages/database
  > /tools/scripts
  > ```
  >
  > **`/package.json`** (root):
  > ```json
  > {
  >   "name": "batac-dms",
  >   "private": true,
  >   "packageManager": "pnpm@9.15.4",
  >   "scripts": {
  >     "build": "turbo run build",
  >     "lint": "turbo run lint",
  >     "typecheck": "turbo run typecheck",
  >     "test:unit": "turbo run test:unit",
  >     "test:integration": "turbo run test:integration",
  >     "dev": "turbo run dev"
  >   },
  >   "devDependencies": {
  >     "turbo": "^2.0.0",
  >     "typescript": "^5.5.0",
  >     "prettier": "^3.3.0",
  >     "eslint": "^9.0.0"
  >   }
  > }
  > ```
  > Run `corepack use pnpm@9.15.4` after creating the file so Corepack records
  > the pin consistently — do not hand-edit the version string afterward
  > without re-running that command (ADR-INF-008).
  >
  > **`/pnpm-workspace.yaml`:**
  > ```yaml
  > packages:
  >   - "apps/*"
  >   - "packages/*"
  >   - "tools/*"
  > ```
  >
  > **`/turbo.json`** (minimum stub; later tasks add `test:integration` service
  > requirements and `db:lint`):
  > ```json
  > {
  >   "$schema": "https://turbo.build/schema.json",
  >   "globalEnv": ["NODE_ENV", "DATABASE_URL_APP", "DATABASE_URL_AUDIT", "S3_ENDPOINT"],
  >   "tasks": {
  >     "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "out/**"] },
  >     "lint": { "dependsOn": [], "outputs": [] },
  >     "typecheck": { "dependsOn": ["^build"], "outputs": [] },
  >     "dev": { "cache": false, "persistent": true }
  >   }
  > }
  > ```
  >
  > **`/.gitignore`** must include at minimum: `node_modules`, `dist`, `.turbo`,
  > `.env`, `.env.local`, `.env.staging`, `.env.production`, `coverage`,
  > `build`, `.next`, `*.log`.
  >
  > **`/packages/config/package.json`:**
  > ```json
  > { "name": "@batac/config", "private": true, "version": "0.0.0" }
  > ```
  >
  > **`/packages/config/tsconfig.base.json`** — every workspace package and app
  > extends this; do not define these options locally elsewhere:
  > ```json
  > {
  >   "compilerOptions": {
  >     "target": "ES2022",
  >     "module": "ESNext",
  >     "moduleResolution": "Bundler",
  >     "lib": ["ES2022"],
  >     "strict": true,
  >     "exactOptionalPropertyTypes": true,
  >     "noUncheckedIndexedAccess": true,
  >     "noImplicitOverride": true,
  >     "noPropertyAccessFromIndexSignature": true,
  >     "forceConsistentCasingInFileNames": true,
  >     "isolatedModules": true,
  >     "skipLibCheck": false,
  >     "declaration": true,
  >     "declarationMap": true,
  >     "sourceMap": true,
  >     "resolveJsonModule": true,
  >     "esModuleInterop": true,
  >     "verbatimModuleSyntax": true
  >   }
  > }
  > ```
  >
  > **`/packages/config/eslint.base.js`** (excerpt — full rule rationale is in
  > J3 §7.3; reproduce these rules exactly, they are not illustrative):
  > ```js
  > module.exports = {
  >   rules: {
  >     '@typescript-eslint/no-explicit-any': 'error',
  >     '@typescript-eslint/no-unsafe-assignment': 'error',
  >     '@typescript-eslint/no-unsafe-call': 'error',
  >     '@typescript-eslint/no-unsafe-member-access': 'error',
  >     '@typescript-eslint/no-unsafe-return': 'error',
  >     '@typescript-eslint/explicit-module-boundary-types': 'error',
  >     '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
  >     '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  >     '@typescript-eslint/no-floating-promises': 'error',
  >     '@typescript-eslint/await-thenable': 'error',
  >     '@typescript-eslint/no-misused-promises': 'error',
  >     'no-console': 'error',
  >     'no-debugger': 'error',
  >     'no-warning-comments': ['warn', { terms: ['todo', 'fixme', 'hack'], location: 'start' }],
  >     'import/order': [
  >       'error',
  >       {
  >         groups: ['builtin', 'external', ['internal', 'parent', 'sibling', 'index'], 'type'],
  >         pathGroups: [{ pattern: '@batac/**', group: 'internal', position: 'before' }],
  >         pathGroupsExcludedImportTypes: ['type'],
  >         'newlines-between': 'always',
  >         alphabetize: { order: 'asc', caseInsensitive: true },
  >       },
  >     ],
  >     'import/no-duplicates': 'error',
  >     'import/no-cycle': 'error',
  >     'no-restricted-syntax': [
  >       'error',
  >       {
  >         selector: 'MemberExpression[object.name="process"][property.name="env"]',
  >         message: 'Access env variables through the package config/env module, not process.env directly.',
  >       },
  >     ],
  >   },
  > };
  > ```
  > `[CONFLICT]` J3 §7.3's original rule message names `@batac/config/env` as the
  > approved access point, but L1 §21.1 places the env validation modules at
  > `/apps/server/src/config/env.server.ts` and `/apps/web/src/config/env.client.ts`
  > — per-app, not inside the shared `@batac/config` package. TASK-INFRA-002
  > follows L1's explicit file paths. The rule message above is reworded
  > generically ("the package config/env module") to avoid asserting either
  > path as settled; do not hardcode `@batac/config/env` into the rule message.
  > This is flagged for human resolution in the Module Summary.
  >
  > Required plugins (declare as devDependencies of `/packages/config`):
  > `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`,
  > `eslint-plugin-boundaries`, `eslint-plugin-jsdoc`.
  >
  > **`/packages/config/.prettierrc.json`:**
  > ```json
  > {
  >   "semi": true,
  >   "singleQuote": true,
  >   "quoteProps": "as-needed",
  >   "trailingComma": "all",
  >   "tabWidth": 2,
  >   "useTabs": false,
  >   "printWidth": 100,
  >   "bracketSpacing": true,
  >   "arrowParens": "always",
  >   "endOfLine": "lf",
  >   "plugins": ["prettier-plugin-tailwindcss"]
  > }
  > ```
  >
  > **`/packages/config/.prettierignore`:**
  > ```
  > .turbo
  > dist
  > build
  > .next
  > node_modules
  > *.sql
  > coverage
  > ```
  > The `*.sql` exclusion is deliberate — Drizzle-generated migrations are
  > reviewed as-is and must not be reformatted (J3 §6.2).
  >
  > **`/.vscode/settings.json`:**
  > ```json
  > {
  >   "editor.formatOnSave": true,
  >   "editor.defaultFormatter": "esbenp.prettier-vscode",
  >   "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  >   "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" }
  > }
  > ```
  >
  > **`/tools/scripts/package.json`** (stub; TASK-INFRA-007 adds the
  > `lint:migrations` script):
  > ```json
  > { "name": "@batac/scripts", "private": true, "version": "0.0.0" }
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm install --frozen-lockfile` completes with exit code 0 on a clean checkout
  > - [ ] `pnpm -v` on a clean checkout matches the version pinned in the root `package.json` `packageManager` field
  > - [ ] `pnpm turbo run lint` and `pnpm turbo run typecheck` both resolve as valid Turborepo tasks
  > - [ ] A developer opening any `.ts` file in VS Code on a fresh checkout sees Prettier as the active formatter with no manual settings changes
  > A reviewer will verify each one independently.

---

## TASK-INFRA-002

Phase:          1
Module:         INFRA
Title:          Add server and web environment variable validation schemas
Prerequisites:  [TASK-INFRA-001]
Deliverables:
  - /apps/server/src/config/env.server.ts — Zod schema validating all server-side environment variables
  - /apps/server/src/config/env.ts — startup entry point; exits the process on invalid configuration
  - /apps/web/src/config/env.client.ts — Zod schema and parsed export for Vite client-side variables
Acceptance Criteria:
  - [ ] `pnpm --filter server typecheck` and `pnpm --filter web typecheck` both pass
  - [ ] Running `node -r dotenv/config -e "require('./apps/server/dist/config/env')"` with `AUTH_JWT_ACCESS_SECRET` unset prints `[FATAL] Environment variable validation failed at startup:` to stderr and exits with code 1
  - [ ] The same command with every `REQ`-classified variable set (per TASK-INFRA-003's `.env.example`) exits 0 from the validation step
  - [ ] Manual: a reviewer confirms `env.client.ts` only reads `import.meta.env.VITE_*` keys, never `process.env`
AI Prompt:
  > Implement the environment-variable validation layer for `/apps/server` and
  > `/apps/web`. This project validates all configuration at startup using Zod
  > and fails fast — the process must never start in an undefined configuration
  > state.
  >
  > **`/apps/server/src/config/env.server.ts`** — reproduce this schema exactly
  > (it is the confirmed specification, not an example):
  > ```typescript
  > import { z } from 'zod';
  >
  > const booleanFromString = z.enum(['true', 'false']).transform((v) => v === 'true');
  > const positiveInt = z.coerce.number().int().positive();
  > const nonNegativeInt = z.coerce.number().int().min(0);
  > const floatBetween0and1 = z.coerce.number().min(0).max(1);
  >
  > const LogLevel = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']);
  > const AppEnv = z.enum(['development', 'staging', 'production', 'on-premise']);
  > const NodeEnv = z.enum(['development', 'test', 'staging', 'production']);
  > const SearchProvider = z.enum(['postgres', 'meilisearch']);
  > const OcrEngine = z.enum(['tesseract', 'service']);
  >
  > export const serverEnvSchema = z.object({
  >   // ─── Core ─────────────────────────────────────────────────────────────
  >   NODE_ENV: NodeEnv,
  >   APP_ENV: AppEnv,
  >   APP_NAME: z.string().min(1).default('Batac City LGU Platform'),
  >   APP_VERSION: z.string().default('0.0.0'),
  >   APP_URL: z.string().url(),
  >   API_URL: z.string().url(),
  >   APP_PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  >   APP_HOST: z.string().default('0.0.0.0'),
  >   LOG_LEVEL: LogLevel.default('info'),
  >   LOG_PRETTY: booleanFromString.default('false'),
  >   LOG_REDACT_PATHS: z.string()
  >     .default('["req.headers.authorization","req.headers.cookie","*.password","*.secret"]')
  >     .transform((s) => JSON.parse(s) as string[]),
  >   LOG_DESTINATION: z.string().default('stdout'),
  >   HEALTH_CHECK_PATH: z.string().default('/health'),
  >   CORS_ALLOWED_ORIGINS: z.string().transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  >   CITY_ID: z.string().uuid(),
  >   TRUST_PROXY: booleanFromString.default('false'),
  >   APP_INSTANCE_ID: z.string().min(1).default(() => crypto.randomUUID()),
  >
  >   // ─── Database ────────────────────────────────────────────────────────
  >   DATABASE_URL_APP: z.string().url(),
  >   DATABASE_URL_AUDIT: z.string().url(),
  >   DATABASE_URL_MIGRATE: z.string().url().optional(),
  >   DB_POOL_MIN: nonNegativeInt.default(2),
  >   DB_POOL_MAX: positiveInt.default(10),
  >   DB_POOL_IDLE_TIMEOUT_MS: positiveInt.default(30000),
  >   DB_POOL_ACQUIRE_TIMEOUT_MS: positiveInt.default(10000),
  >   DB_POOL_CONNECTION_TIMEOUT_MS: positiveInt.default(5000),
  >   DB_STATEMENT_TIMEOUT_MS: positiveInt.default(30000),
  >   DRIZZLE_VERBOSE: booleanFromString.default('false'),
  >
  >   // ─── Authentication ───────────────────────────────────────────────────
  >   AUTH_JWT_ACCESS_SECRET: z.string().min(32),
  >   AUTH_JWT_REFRESH_SECRET: z.string().min(32),
  >   AUTH_JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  >   AUTH_JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  >   AUTH_JWT_ALGORITHM: z.enum(['HS256', 'RS256', 'ES256']).default('HS256'),
  >   AUTH_COOKIE_SECURE: booleanFromString.default('true'),
  >   AUTH_COOKIE_SAMESITE: z.enum(['Strict', 'Lax', 'None']).default('Strict'),
  >   AUTH_COOKIE_DOMAIN: z.string().optional(),
  >   AUTH_ACCESS_TOKEN_COOKIE_NAME: z.string().default('__Host-bat_at'),
  >   AUTH_REFRESH_TOKEN_COOKIE_NAME: z.string().default('__Host-bat_rt'),
  >   AUTH_SESSION_INACTIVITY_TIMEOUT_MS: positiveInt.default(1800000),
  >   AUTH_SESSION_WARNING_THRESHOLD_MS: positiveInt.default(1500000),
  >   AUTH_MAX_CONCURRENT_SESSIONS: positiveInt.default(1),
  >   AUTH_MFA_TOTP_ENABLED: booleanFromString.default('false'),
  >   AUTH_MFA_TOTP_ISSUER: z.string().default('Batac City LGU'),
  >   AUTH_MFA_TOTP_WINDOW: nonNegativeInt.default(1),
  >
  >   // ─── Argon2id ─────────────────────────────────────────────────────────
  >   ARGON2_MEMORY_COST: positiveInt.default(65536),
  >   ARGON2_TIME_COST: positiveInt.default(3),
  >   ARGON2_PARALLELISM: positiveInt.default(1),
  >   ARGON2_HASH_LENGTH: positiveInt.default(32),
  >
  >   // ─── Audit Log ────────────────────────────────────────────────────────
  >   AUDIT_HMAC_SECRET: z.string().min(32),
  >   AUDIT_GENESIS_HASH: z.string().length(64).default('0'.repeat(64)),
  >   AUDIT_CHAIN_VERIFY_ON_READ: booleanFromString.default('true'),
  >   AUDIT_RETENTION_DAYS: positiveInt.default(3650),
  >   AUDIT_TSA_ENABLED: booleanFromString.default('false'),
  >   AUDIT_TSA_URL: z.string().url().optional(),
  >   AUDIT_EXPORT_ENABLED: booleanFromString.default('false'),
  >   AUDIT_EXPORT_DESTINATION: z.enum(['s3']).default('s3'),
  >
  >   // ─── S3-Compatible Storage ────────────────────────────────────────────
  >   S3_ENDPOINT: z.string().url(),
  >   S3_BUCKET: z.string().min(1),
  >   S3_ACCESS_KEY: z.string().min(1),
  >   S3_SECRET_KEY: z.string().min(1),
  >   S3_REGION: z.string().default('auto'),
  >   S3_FORCE_PATH_STYLE: booleanFromString.default('false'),
  >   S3_UPLOAD_MAX_SIZE_MB: positiveInt.default(25),
  >   S3_SIGNED_URL_EXPIRES_S: positiveInt.default(300),
  >   S3_UPLOAD_PRESIGN_EXPIRES_S: positiveInt.default(600),
  >   S3_ALLOWED_MIME_TYPES: z.string()
  >     .default('application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg')
  >     .transform((s) => s.split(',').map((m) => m.trim())),
  >   S3_BACKUP_BUCKET: z.string().optional(),
  >   S3_BACKUP_ACCESS_KEY: z.string().optional(),
  >   S3_BACKUP_SECRET_KEY: z.string().optional(),
  >   S3_BACKUP_ENDPOINT: z.string().url().optional(),
  >
  >   // ─── SMTP ─────────────────────────────────────────────────────────────
  >   SMTP_HOST: z.string().min(1),
  >   SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  >   SMTP_SECURE: booleanFromString.default('false'),
  >   SMTP_USER: z.string().min(1),
  >   SMTP_PASSWORD: z.string().min(1),
  >   SMTP_FROM: z.string().email(),
  >   SMTP_FROM_NAME: z.string().default('Batac City LGU'),
  >   SMTP_REJECT_UNAUTHORIZED: booleanFromString.default('true'),
  >   SMTP_POOL: booleanFromString.default('true'),
  >   SMTP_MAX_CONNECTIONS: positiveInt.default(5),
  >   SMTP_MAX_MESSAGES: positiveInt.default(100),
  >   SMTP_DEBUG: booleanFromString.default('false'),
  >
  >   // ─── OCR ──────────────────────────────────────────────────────────────
  >   OCR_ENGINE: OcrEngine.default('tesseract'),
  >   OCR_SERVICE_URL: z.string().url().optional(),
  >   OCR_SERVICE_API_KEY: z.string().optional(),
  >   OCR_LANGUAGE_PACKS: z.string().default('eng+fil'),
  >   OCR_WORKER_COUNT: positiveInt.default(2),
  >   OCR_TIMEOUT_MS: positiveInt.default(60000),
  >   OCR_MAX_FILE_SIZE_MB: positiveInt.default(25),
  >   OCR_QUALITY_THRESHOLD: floatBetween0and1.default(0.6),
  >   OCR_QUEUE_CONCURRENCY: positiveInt.default(3),
  >   OCR_MIGRATION_ENABLED: booleanFromString.default('false'),
  >   OCR_MIGRATION_BATCH_SIZE: positiveInt.default(50),
  >
  >   // ─── Search (Phase 1 = postgres; Phase 2 fields optional now) ────────
  >   SEARCH_PROVIDER: SearchProvider.default('postgres'),
  >   SEARCH_FTS_LANGUAGE: z.string().default('english'),
  >   SEARCH_MEILISEARCH_URL: z.string().url().optional(),
  >   SEARCH_MEILISEARCH_MASTER_KEY: z.string().optional(),
  >   SEARCH_MEILISEARCH_INDEX_PREFIX: z.string().default('batac_'),
  >   SEARCH_SYNC_BATCH_SIZE: positiveInt.default(100),
  >   SEARCH_SYNC_INTERVAL_MS: positiveInt.default(5000),
  >   SEARCH_SYNC_ON_STARTUP: booleanFromString.default('false'),
  >
  >   // ─── SSE & Notifications ──────────────────────────────────────────────
  >   SSE_HEARTBEAT_INTERVAL_MS: positiveInt.default(30000),
  >   SSE_CONNECTION_TIMEOUT_MS: positiveInt.default(3600000),
  >   SSE_MAX_CONNECTIONS_PER_USER: positiveInt.default(3),
  >   SSE_RETRY_MS: positiveInt.default(3000),
  >   NOTIF_RETENTION_DAYS: positiveInt.default(30),
  >   NOTIF_MAX_UNREAD_PER_USER: positiveInt.default(200),
  >
  >   // ─── Sentry ───────────────────────────────────────────────────────────
  >   SENTRY_DSN: z.string().url().optional(),
  >   SENTRY_ENVIRONMENT: z.string().optional(),
  >   SENTRY_RELEASE: z.string().optional(),
  >   SENTRY_TRACES_SAMPLE_RATE: floatBetween0and1.default(0.1),
  >   SENTRY_PROFILES_SAMPLE_RATE: floatBetween0and1.default(0.0),
  >
  >   // ─── Background Jobs ──────────────────────────────────────────────────
  >   PGBOSS_SCHEMA: z.string().default('pgboss'),
  >   PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS: positiveInt.default(86400),
  >   PGBOSS_DELETE_AFTER_DAYS: positiveInt.default(7),
  >   JOB_WORKER_CONCURRENCY: positiveInt.default(5),
  >   JOB_RETRY_LIMIT: nonNegativeInt.default(3),
  >   JOB_RETRY_DELAY_S: nonNegativeInt.default(60),
  >   JOB_EXPIRY_SECONDS: positiveInt.default(3600),
  >
  >   // ─── Cron Expressions ─────────────────────────────────────────────────
  >   CRON_SLA_CHECK: z.string().default('*/15 * * * *'),
  >   CRON_MAYOR_LAPSE_CHECK: z.string().default('0 6 * * *'),
  >   CRON_PANLALAWIGAN_TIMER_CHECK: z.string().default('0 7 * * *'),
  >   CRON_SESSION_CLEANUP: z.string().default('0 3 * * *'),
  >   CRON_NOTIFICATION_CLEANUP: z.string().default('0 2 * * *'),
  >   CRON_AUDIT_EXPORT: z.string().default('0 1 1 * *'),
  >   CRON_DELEGATION_EXPIRY_CHECK: z.string().default('*/5 * * * *'),
  >   CRON_BACKUP_DATABASE: z.string().default('0 0 * * *'),
  >   CRON_ORDER_OF_BUSINESS_ALERT: z.string().default('0 9 * * 4'),
  >
  >   // ─── Rate Limiting ────────────────────────────────────────────────────
  >   RATE_AUTH_MAX: positiveInt.default(10),
  >   RATE_AUTH_WINDOW_MS: positiveInt.default(900000),
  >   RATE_API_MAX: positiveInt.default(200),
  >   RATE_API_WINDOW_MS: positiveInt.default(60000),
  >   RATE_PORTAL_MAX: positiveInt.default(60),
  >   RATE_PORTAL_WINDOW_MS: positiveInt.default(60000),
  >   RATE_UPLOAD_MAX: positiveInt.default(20),
  >   RATE_UPLOAD_WINDOW_MS: positiveInt.default(60000),
  >
  >   // ─── QR & Document Numbering ──────────────────────────────────────────
  >   QR_BASE_URL: z.string().url(),
  >   QR_ERROR_CORRECTION_LEVEL: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  >   QR_MODULE_SIZE: positiveInt.default(4),
  >   QR_COVER_SHEETS_PER_PAGE: positiveInt.default(4),
  >   DOC_SP_ORDINAL: z.coerce.number().int().min(1).max(99),
  >   DOC_NUMBER_CITY_ID: z.string().uuid().optional(),
  >   DOC_TRACKING_NUMBER_PREFIX: z.string().default('DTS'),
  >
  >   // ─── i18n ─────────────────────────────────────────────────────────────
  >   I18N_DEFAULT_LOCALE: z.string().default('en'),
  >   I18N_SUPPORTED_LOCALES: z.string().default('en,fil,ilo').transform((s) => s.split(',').map((l) => l.trim())),
  >   I18N_FALLBACK_LOCALE: z.string().default('en'),
  >
  >   // ─── Feature Flags ────────────────────────────────────────────────────
  >   FEATURE_MFA_ENABLED: booleanFromString.default('false'),
  >   FEATURE_OCR_ENABLED: booleanFromString.default('true'),
  >   FEATURE_MEILISEARCH_ENABLED: booleanFromString.default('false'),
  >   FEATURE_CITIZEN_PORTAL_ENABLED: booleanFromString.default('false'),
  >   FEATURE_SMS_ENABLED: booleanFromString.default('false'),
  >   FEATURE_PHILSYS_ENABLED: booleanFromString.default('false'),
  >   FEATURE_RECORDS_MANAGEMENT_ENABLED: booleanFromString.default('false'),
  >   FEATURE_EMAIL_NOTIFICATIONS_ENABLED: booleanFromString.default('true'),
  >   FEATURE_SSE_ENABLED: booleanFromString.default('true'),
  >
  >   // ─── Disaster Recovery ────────────────────────────────────────────────
  >   DR_HOT_STANDBY_ENABLED: booleanFromString.default('false'),
  >   DR_HOT_STANDBY_URL: z.string().url().optional(),
  >   DR_MAX_REPLICATION_LAG_S: positiveInt.default(60),
  >
  >   // ─── Backup ───────────────────────────────────────────────────────────
  >   BACKUP_ENABLED: booleanFromString.default('false'),
  >   BACKUP_ENCRYPTION_KEY: z.string().min(32).optional(),
  >   BACKUP_RETENTION_DAYS_HOT: positiveInt.default(30),
  >   BACKUP_RETENTION_DAYS_COLD: positiveInt.default(365),
  >
  >   // ─── Portal (Phase 3 — fields declared now so the schema does not break later) ──
  >   PORTAL_URL: z.string().url().optional(),
  >   PORTAL_API_URL: z.string().url().optional(),
  >   PORTAL_CDN_URL: z.string().url().optional(),
  >   PORTAL_CITIZEN_OTP_EXPIRY_S: positiveInt.default(300),
  >   PORTAL_CITIZEN_OTP_LENGTH: positiveInt.default(6),
  >   PORTAL_CITIZEN_REVERIFY_DAYS: positiveInt.default(365),
  >
  >   // ─── SMS (Phase 3) ────────────────────────────────────────────────────
  >   SMS_PROVIDER: z.string().optional(),
  >   SMS_API_KEY: z.string().optional(),
  >   SMS_SENDER_ID: z.string().max(11).default('BATAC'),
  > }).superRefine((data, ctx) => {
  >   if (data.FEATURE_MEILISEARCH_ENABLED && !data.SEARCH_MEILISEARCH_URL) {
  >     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SEARCH_MEILISEARCH_URL'], message: 'SEARCH_MEILISEARCH_URL is required when FEATURE_MEILISEARCH_ENABLED is true' });
  >   }
  >   if (data.AUDIT_TSA_ENABLED && !data.AUDIT_TSA_URL) {
  >     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AUDIT_TSA_URL'], message: 'AUDIT_TSA_URL is required when AUDIT_TSA_ENABLED is true' });
  >   }
  >   if (data.BACKUP_ENABLED && !data.BACKUP_ENCRYPTION_KEY) {
  >     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['BACKUP_ENCRYPTION_KEY'], message: 'BACKUP_ENCRYPTION_KEY is required when BACKUP_ENABLED is true' });
  >   }
  >   if (data.DR_HOT_STANDBY_ENABLED && !data.DR_HOT_STANDBY_URL) {
  >     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DR_HOT_STANDBY_URL'], message: 'DR_HOT_STANDBY_URL is required when DR_HOT_STANDBY_ENABLED is true' });
  >   }
  >   if (data.AUTH_SESSION_WARNING_THRESHOLD_MS >= data.AUTH_SESSION_INACTIVITY_TIMEOUT_MS) {
  >     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AUTH_SESSION_WARNING_THRESHOLD_MS'], message: 'AUTH_SESSION_WARNING_THRESHOLD_MS must be less than AUTH_SESSION_INACTIVITY_TIMEOUT_MS' });
  >   }
  > });
  >
  > export type ServerEnv = z.infer<typeof serverEnvSchema>;
  > ```
  > `[Inference]` Two fields above (`LOG_DESTINATION`, `HEALTH_CHECK_PATH`) are
  > documented in L1 §13.2 and §13.3 respectively, with an unambiguous name,
  > type, and default, but were absent from L1 §21.2's own schema code listing.
  > They are included here because their specification is otherwise complete —
  > this is not an invented decision. Flagged in the Module Summary as an
  > internal inconsistency in L1 for human reconciliation.
  >
  > **`/apps/server/src/config/env.ts`** — the startup validation entry point:
  > ```typescript
  > import 'dotenv/config';
  > import { serverEnvSchema } from './env.server';
  >
  > const result = serverEnvSchema.safeParse(process.env);
  >
  > if (!result.success) {
  >   console.error('\n[FATAL] Environment variable validation failed at startup:');
  >   console.error(result.error.flatten().fieldErrors);
  >   console.error('\nThe application cannot start with an invalid configuration.');
  >   process.exit(1);
  > }
  >
  > export const env = result.data;
  > ```
  >
  > **`/apps/web/src/config/env.client.ts`:**
  > ```typescript
  > import { z } from 'zod';
  >
  > export const clientEnvSchema = z.object({
  >   VITE_APP_NAME: z.string().default('Batac City LGU'),
  >   VITE_API_URL: z.string().url(),
  >   VITE_APP_URL: z.string().url(),
  >   VITE_SENTRY_DSN: z.string().url().optional(),
  >   VITE_SENTRY_ENVIRONMENT: z.string().optional(),
  > });
  >
  > export const clientEnv = clientEnvSchema.parse({
  >   VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  >   VITE_API_URL: import.meta.env.VITE_API_URL,
  >   VITE_APP_URL: import.meta.env.VITE_APP_URL,
  >   VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  >   VITE_SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  > });
  > ```
  > Vite exposes only `VITE_`-prefixed variables to the browser bundle — never
  > prefix a secret with `VITE_` (L1 §21.4).
  >
  > **Out of scope for this task:** `env.portal.ts` (Next.js `/apps/portal`
  > schema, L1 §21.5). The public citizen portal is a Phase 3 capability
  > (`PORTAL` module); do not create this file as part of Phase 1 INFRA work.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm --filter server typecheck` and `pnpm --filter web typecheck` both pass
  > - [ ] Validation fails fast with `[FATAL] Environment variable validation failed at startup:` when `AUTH_JWT_ACCESS_SECRET` is unset
  > - [ ] Validation passes (exit 0) when every `REQ`-classified variable is set
  > - [ ] `env.client.ts` reads only `import.meta.env.VITE_*`, never `process.env`
  > A reviewer will verify each one independently.

---

## TASK-INFRA-003

Phase:          1
Module:         INFRA
Title:          Create environment variable template and Docker secrets loader
Prerequisites:  [TASK-INFRA-002]
Deliverables:
  - /.env.example — committed template at monorepo root with every variable and a safe placeholder
  - /apps/server/src/config/load-docker-secrets.ts — reads `/run/secrets/*` files into `process.env` before validation runs
Acceptance Criteria:
  - [ ] Copying `.env.example` to `.env` and running the env-validation entry point from TASK-INFRA-002 exits 0 with zero edits to the copied file
  - [ ] `.env.example` contains a non-empty placeholder for every variable marked `REQ` anywhere in L1
  - [ ] A unit test confirms `loadDockerSecrets()` does NOT overwrite a variable already present in `process.env` — the secrets file is a fallback, never an override
  - [ ] Manual: a reviewer greps `.env.example` for the secret-classified variables listed in L1 §23.1 and confirms every value is an obvious placeholder, not a realistic-looking credential
AI Prompt:
  > Create the root `.env.example` template and the Docker-secrets-to-env-var
  > loader used in containerized deployments.
  >
  > **`/.env.example`** must cover every section below with safe placeholders
  > (this is the Phase 1 subset; exclude `PORTAL_*`/`SMS_*`/`NEXT_PUBLIC_*`
  > Phase 3 variables from the "required" framing — they may appear commented
  > out for forward reference only):
  > ```dotenv
  > # ╔═══════════════════════════════════════════════════════════════════════╗
  > # ║  Batac City LGU Platform — Environment Variable Template              ║
  > # ║  Copy this file to .env and populate all required values.             ║
  > # ║  NEVER commit .env to version control.                                ║
  > # ╚═══════════════════════════════════════════════════════════════════════╝
  >
  > # ─── Core ──────────────────────────────────────────────────────────────────
  > NODE_ENV=development
  > APP_ENV=development
  > APP_NAME=Batac City LGU Platform
  > APP_VERSION=0.0.0
  > APP_URL=http://localhost:5173
  > API_URL=http://localhost:3000
  > APP_PORT=3000
  > APP_HOST=0.0.0.0
  > LOG_LEVEL=debug
  > LOG_PRETTY=true
  > CORS_ALLOWED_ORIGINS=http://localhost:5173
  > CITY_ID=01930a7d-0000-0000-0000-000000000001
  > TRUST_PROXY=false
  >
  > # ─── Database ──────────────────────────────────────────────────────────────
  > DATABASE_URL_APP=postgresql://batac_app:app_devpassword@localhost:5432/batac_lgu
  > DATABASE_URL_AUDIT=postgresql://batac_audit:audit_devpassword@localhost:5432/batac_lgu
  > DATABASE_URL_MIGRATE=postgresql://batac_migrate:migrate_devpassword@localhost:5432/batac_lgu
  >
  > # ─── Authentication ────────────────────────────────────────────────────────
  > AUTH_JWT_ACCESS_SECRET=dev-only-placeholder-please-change-32-chars-min
  > AUTH_JWT_REFRESH_SECRET=dev-only-placeholder-please-change-32-chars-min
  >
  > # ─── Audit Log ─────────────────────────────────────────────────────────────
  > AUDIT_HMAC_SECRET=dev-only-placeholder-please-change-32-chars-min
  >
  > # ─── S3-Compatible Storage (MinIO in local dev) ────────────────────────────
  > S3_ENDPOINT=http://localhost:9000
  > S3_BUCKET=batac-documents
  > S3_ACCESS_KEY=minio
  > S3_SECRET_KEY=minio123456
  > S3_FORCE_PATH_STYLE=true
  > S3_REGION=us-east-1
  > S3_BACKUP_BUCKET=batac-backups
  >
  > # ─── SMTP (Mailpit in local dev) ───────────────────────────────────────────
  > SMTP_HOST=localhost
  > SMTP_PORT=1025
  > SMTP_SECURE=false
  > SMTP_REJECT_UNAUTHORIZED=false
  > SMTP_USER=dev
  > SMTP_PASSWORD=dev
  > SMTP_FROM=no-reply@batac.gov.ph
  >
  > # ─── QR / Document Numbering ───────────────────────────────────────────────
  > QR_BASE_URL=http://localhost:5173/track
  > DOC_SP_ORDINAL=7
  >
  > # ─── Nginx / Deployment (production/staging only) ─────────────────────────
  > APP_DOMAIN=dms.batac.gov.ph
  > ```
  > Add every other variable named in L1 with its documented default where one
  > exists; omit defaulted-optional variables only if their absence does not
  > break local startup (the schema in TASK-INFRA-002 supplies the default at
  > runtime).
  >
  > **`/apps/server/src/config/load-docker-secrets.ts`:**
  > ```typescript
  > import { readFileSync, existsSync } from 'fs';
  >
  > const SECRET_MAPPING: Record<string, string> = {
  >   '/run/secrets/jwt_access_secret': 'AUTH_JWT_ACCESS_SECRET',
  >   '/run/secrets/jwt_refresh_secret': 'AUTH_JWT_REFRESH_SECRET',
  >   '/run/secrets/audit_hmac_secret': 'AUDIT_HMAC_SECRET',
  >   '/run/secrets/database_url_app': 'DATABASE_URL_APP',
  >   '/run/secrets/database_url_audit': 'DATABASE_URL_AUDIT',
  >   '/run/secrets/s3_access_key': 'S3_ACCESS_KEY',
  >   '/run/secrets/s3_secret_key': 'S3_SECRET_KEY',
  >   '/run/secrets/smtp_password': 'SMTP_PASSWORD',
  >   '/run/secrets/backup_encryption_key': 'BACKUP_ENCRYPTION_KEY',
  > };
  >
  > export function loadDockerSecrets(): void {
  >   for (const [path, envVar] of Object.entries(SECRET_MAPPING)) {
  >     if (existsSync(path) && !process.env[envVar]) {
  >       process.env[envVar] = readFileSync(path, 'utf8').trim();
  >     }
  >   }
  > }
  > ```
  > This must be called and its import completed *before* `env.ts` (TASK-INFRA-002)
  > runs its `safeParse`, so that secrets mounted as files are present in
  > `process.env` ahead of validation (L1 §23.3).
  >
  > Variables that must never appear in source code, committed files, log
  > output, or API responses (L1 §23.1): `AUTH_JWT_ACCESS_SECRET`,
  > `AUTH_JWT_REFRESH_SECRET`, `AUDIT_HMAC_SECRET`, `DATABASE_URL_APP`,
  > `DATABASE_URL_AUDIT`, `DATABASE_URL_MIGRATE`, `DB_APP_PASSWORD`,
  > `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BACKUP_ACCESS_KEY`,
  > `S3_BACKUP_SECRET_KEY`, `SMTP_PASSWORD`, `OCR_SERVICE_API_KEY`,
  > `BACKUP_ENCRYPTION_KEY`, `SEARCH_MEILISEARCH_MASTER_KEY`,
  > `DR_HOT_STANDBY_URL`, `AUDIT_TSA_URL`, `SMS_API_KEY`. Every value placed in
  > `.env.example` for these must be an obvious placeholder.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Copying `.env.example` to `.env` and running the validation entry point exits 0
  > - [ ] Every `REQ`-classified variable in L1 has a non-empty placeholder in `.env.example`
  > - [ ] `loadDockerSecrets()` never overwrites an already-set `process.env` value
  > - [ ] No secret-classified variable in `.env.example` looks like a real credential
  > A reviewer will verify each one independently.


---

## TASK-INFRA-004

Phase:          1
Module:         INFRA
Title:          Define local development Docker Compose infrastructure stack
Prerequisites:  [TASK-INFRA-001]
Deliverables:
  - /compose.yml — local development infrastructure: PostgreSQL, MinIO, MinIO bucket init, Mailpit, and a reserved Meilisearch profile
Acceptance Criteria:
  - [ ] `docker compose config` validates the file with zero errors
  - [ ] `docker compose up -d` brings `postgres`, `minio`, and `mailpit` to a healthy state within 30 seconds (`docker compose ps` shows `healthy`)
  - [ ] `docker compose --profile search up -d meilisearch` starts Meilisearch only when explicitly requested; it does not start on a plain `docker compose up -d`
  - [ ] Manual: `http://localhost:9001` (MinIO console) and `http://localhost:8025` (Mailpit UI) both load in a browser after `docker compose up -d`
AI Prompt:
  > Write the local development Docker Compose file. Only infrastructure
  > services run in Docker for local development — `/apps/server` and
  > `/apps/web` run on the host via `pnpm dev` for hot-reload support, and are
  > out of scope for this file.
  >
  > **`/compose.yml`:**
  > ```yaml
  > # compose.yml — local development infrastructure
  > # Start all services:    docker compose up -d
  > # With Meilisearch:      docker compose --profile search up -d
  > # Reset everything:      docker compose down -v
  >
  > name: batac-dev
  >
  > services:
  >
  >   postgres:
  >     image: postgres:16-alpine
  >     restart: unless-stopped
  >     environment:
  >       POSTGRES_DB: ${DB_NAME:-batac_lgu}
  >       POSTGRES_USER: postgres
  >       POSTGRES_PASSWORD: ${DB_SUPERUSER_PASSWORD:-postgres}
  >       DB_APP_PASSWORD: ${DB_APP_PASSWORD:-app_devpassword}
  >       DB_AUDIT_PASSWORD: ${DB_AUDIT_PASSWORD:-audit_devpassword}
  >       DB_MIGRATE_PASSWORD: ${DB_MIGRATE_PASSWORD:-migrate_devpassword}
  >       TZ: Asia/Manila
  >     ports:
  >       - "${DB_PORT_EXPOSED:-5432}:5432"
  >     volumes:
  >       - postgres_data:/var/lib/postgresql/data
  >       - ./tools/db/init:/docker-entrypoint-initdb.d:ro
  >     healthcheck:
  >       test: ["CMD-SHELL", "pg_isready -U postgres -d ${DB_NAME:-batac_lgu}"]
  >       interval: 5s
  >       timeout: 5s
  >       retries: 10
  >       start_period: 15s
  >
  >   minio:
  >     image: minio/minio:latest
  >     restart: unless-stopped
  >     command: server /data --console-address ":9001"
  >     environment:
  >       MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minio}
  >       MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minio123456}
  >       TZ: Asia/Manila
  >     ports:
  >       - "9000:9000"
  >       - "9001:9001"
  >     volumes:
  >       - minio_data:/data
  >     healthcheck:
  >       test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
  >       interval: 10s
  >       timeout: 5s
  >       retries: 5
  >       start_period: 15s
  >
  >   minio-init:
  >     image: minio/mc:latest
  >     restart: no
  >     depends_on:
  >       minio:
  >         condition: service_healthy
  >     environment:
  >       S3_ACCESS_KEY: ${S3_ACCESS_KEY:-minio}
  >       S3_SECRET_KEY: ${S3_SECRET_KEY:-minio123456}
  >       S3_BUCKET: ${S3_BUCKET:-batac-documents}
  >       S3_BACKUP_BUCKET: ${S3_BACKUP_BUCKET:-batac-backups}
  >     entrypoint: >
  >       /bin/sh -c "
  >         mc alias set local http://minio:9000 $$S3_ACCESS_KEY $$S3_SECRET_KEY &&
  >         mc mb --ignore-existing local/$$S3_BUCKET &&
  >         mc mb --ignore-existing local/$$S3_BACKUP_BUCKET &&
  >         mc anonymous set none local/$$S3_BUCKET &&
  >         mc version enable local/$$S3_BUCKET &&
  >         echo '[minio-init] Buckets ready.'
  >       "
  >
  >   mailpit:
  >     image: axllent/mailpit:latest
  >     restart: unless-stopped
  >     ports:
  >       - "1025:1025"
  >       - "8025:8025"
  >     healthcheck:
  >       test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:8025"]
  >       interval: 10s
  >       timeout: 5s
  >       retries: 5
  >       start_period: 5s
  >
  >   meilisearch:
  >     image: getmeili/meilisearch:latest
  >     restart: unless-stopped
  >     profiles:
  >       - search
  >     environment:
  >       MEILI_MASTER_KEY: ${SEARCH_MEILISEARCH_MASTER_KEY:-meilisearch-dev-key-changeme}
  >       MEILI_NO_ANALYTICS: "true"
  >       MEILI_ENV: development
  >       TZ: Asia/Manila
  >     ports:
  >       - "7700:7700"
  >     volumes:
  >       - meilisearch_data:/meili_data
  >     healthcheck:
  >       test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:7700/health"]
  >       interval: 10s
  >       timeout: 5s
  >       retries: 5
  >       start_period: 20s
  >
  > volumes:
  >   postgres_data:
  >     driver: local
  >   minio_data:
  >     driver: local
  >   meilisearch_data:
  >     driver: local
  > ```
  > The `./tools/db/init` bind mount is created by this task as an empty
  > directory if it does not already exist; TASK-INFRA-005 populates it.
  > `meilisearch` is Phase 2 — it must never start without `--profile search`
  > being passed explicitly.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `docker compose config` validates with zero errors
  > - [ ] `postgres`, `minio`, and `mailpit` reach `healthy` within 30 seconds of `docker compose up -d`
  > - [ ] `meilisearch` does not start without `--profile search`
  > - [ ] The MinIO console and Mailpit UI both load in a browser
  > A reviewer will verify each one independently.

---

## TASK-INFRA-005

Phase:          1
Module:         INFRA
Title:          Create PostgreSQL role bootstrap script and post-migration grants
Prerequisites:  [TASK-INFRA-004]
Deliverables:
  - /tools/db/init/01-create-roles.sh — creates the three application database roles on first container start
  - /packages/database/scripts/post-migrate-grants.sql — idempotent grants applied after every Drizzle migration run
Acceptance Criteria:
  - [ ] `docker compose down -v && docker compose up -d`, then `docker compose exec postgres psql -U postgres -d batac_lgu -c "\du"` lists `batac_migrate`, `batac_app`, and `batac_audit`
  - [ ] Running `post-migrate-grants.sql` twice in a row against the same database produces no errors on the second run (idempotency)
  - [ ] As `batac_app`: `INSERT` into a table in the `audit` schema succeeds; `UPDATE` or `DELETE` against the same table fails with a permission-denied error
  - [ ] Manual: a reviewer confirms `01-create-roles.sh` sources every password from an environment variable (`${DB_MIGRATE_PASSWORD}`, `${DB_APP_PASSWORD}`, `${DB_AUDIT_PASSWORD}`) and never hardcodes a credential
AI Prompt:
  > Implement the two scripts that establish the platform's three-role
  > least-privilege database access model.
  >
  > **Three database roles** (L1 §5.1; L4 Architecture Reference):
  > | Role | Connects via | Purpose | Notes |
  > |---|---|---|---|
  > | `batac_migrate` | `DATABASE_URL_MIGRATE` | DDL; schema migrations | Never used at application runtime |
  > | `batac_app` | `DATABASE_URL_APP` | DML on all schemas except `audit` | No access to write the `audit` schema beyond `INSERT` |
  > | `batac_audit` | `DATABASE_URL_AUDIT` | `INSERT` + `SELECT` on `audit` only | `UPDATE`/`DELETE` revoked explicitly |
  >
  > **`/tools/db/init/01-create-roles.sh`** — runs once, automatically, the
  > first time the PostgreSQL container starts against an empty
  > `postgres_data` volume:
  > ```bash
  > #!/bin/bash
  > # tools/db/init/01-create-roles.sh
  > # Creates the three application database roles on first container start.
  > set -e
  >
  > psql -v ON_ERROR_STOP=1 \
  >      --username "postgres" \
  >      --dbname "${POSTGRES_DB:-batac_lgu}" \
  >      <<-EOSQL
  >
  >   CREATE USER batac_migrate
  >     WITH ENCRYPTED PASSWORD '${DB_MIGRATE_PASSWORD:-migrate_devpassword}';
  >   GRANT ALL PRIVILEGES ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_migrate;
  >
  >   CREATE USER batac_app
  >     WITH ENCRYPTED PASSWORD '${DB_APP_PASSWORD:-app_devpassword}';
  >   GRANT CONNECT ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_app;
  >
  >   CREATE USER batac_audit
  >     WITH ENCRYPTED PASSWORD '${DB_AUDIT_PASSWORD:-audit_devpassword}';
  >   GRANT CONNECT ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_audit;
  >
  > EOSQL
  >
  > echo "[01-create-roles] Roles batac_migrate, batac_app, batac_audit created."
  > ```
  > `[CONFLICT]` C5's addendum ("Migration-Owning Role Name") states
  > `batac_migrate` is `NOLOGIN`, citing C1 §3.16 as the source of truth. The
  > script above creates it as a `LOGIN` role with a password (`CREATE USER`
  > is shorthand for `CREATE ROLE ... LOGIN`), because `DATABASE_URL_MIGRATE`
  > (a password-bearing connection string consumed by TASK-INFRA-006's
  > `migrate.ts`) cannot authenticate against a `NOLOGIN` role. This task
  > follows L2's behavior, since the role must be able to open a connection for
  > the migration runner to function at all. The discrepancy with C5/C1 is
  > flagged in the Module Summary for human resolution — do not silently change
  > this script's `LOGIN` behavior to match C5 without first confirming what
  > C1 §3.16 actually specifies.
  >
  > **`/packages/database/scripts/post-migrate-grants.sql`** — applied after
  > every Drizzle migration run, from `migrate.ts` (TASK-INFRA-006), using the
  > `batac_migrate` connection. Idempotent:
  > ```sql
  > -- packages/database/scripts/post-migrate-grants.sql
  > DO $$
  > DECLARE
  >   s TEXT;
  >   app_schemas TEXT[] := ARRAY[
  >     'iam', 'organization', 'documents', 'workflow',
  >     'tracking', 'records', 'notifications',
  >     'search_meta', 'portal', 'reporting'
  >   ];
  > BEGIN
  >   FOREACH s IN ARRAY app_schemas LOOP
  >     EXECUTE format('GRANT USAGE ON SCHEMA %I TO batac_app', s);
  >     EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO batac_app', s);
  >     EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO batac_app', s);
  >     EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO batac_app', s);
  >     EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO batac_app', s);
  >   END LOOP;
  > END
  > $$;
  >
  > GRANT USAGE ON SCHEMA audit TO batac_app, batac_audit;
  > GRANT INSERT ON ALL TABLES IN SCHEMA audit TO batac_app, batac_audit;
  > ALTER DEFAULT PRIVILEGES IN SCHEMA audit
  >   GRANT INSERT ON TABLES TO batac_app, batac_audit;
  > REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA audit
  >   FROM batac_app, batac_audit;
  >
  > DO $$
  > BEGIN
  >   IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss') THEN
  >     EXECUTE 'GRANT ALL PRIVILEGES ON SCHEMA pgboss TO batac_app';
  >     EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pgboss TO batac_app';
  >     EXECUTE 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pgboss TO batac_app';
  >     EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT ALL PRIVILEGES ON TABLES TO batac_app';
  >     EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT ALL PRIVILEGES ON SEQUENCES TO batac_app';
  >   END IF;
  > END
  > $$;
  > ```
  > Note: schema-level grants are not applied in `01-create-roles.sh` because
  > the schemas do not exist yet at that point — they are created later by
  > Drizzle migrations (owned by each domain module), and this SQL file is what
  > grants access to them once they exist.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `\du` after a fresh `docker compose up -d` lists all three roles
  > - [ ] Re-running `post-migrate-grants.sql` twice produces no errors
  > - [ ] `batac_app` can `INSERT` but not `UPDATE`/`DELETE` in the `audit` schema
  > - [ ] Every password in `01-create-roles.sh` is sourced from an environment variable, never hardcoded
  > A reviewer will verify each one independently.

---

## TASK-INFRA-006

Phase:          1
Module:         INFRA
Title:          Implement Drizzle migration runner and package scripts
Prerequisites:  [TASK-INFRA-002, TASK-INFRA-005]
Deliverables:
  - /packages/database/package.json — `@batac/database` workspace package with `db:generate` and `db:migrate` scripts
  - /packages/database/drizzle.config.ts — Drizzle Kit configuration
  - /packages/database/scripts/migrate.ts — applies pending migrations, then runs `post-migrate-grants.sql`
Acceptance Criteria:
  - [ ] `pnpm --filter @batac/database db:generate` runs without error against an (initially empty) `/packages/database/schema/` directory
  - [ ] `pnpm --filter @batac/database db:migrate` against a freshly bootstrapped `compose.yml` Postgres instance applies zero pending migrations cleanly, then runs `post-migrate-grants.sql` without error
  - [ ] Running `db:migrate` twice in a row is idempotent — the second run reports zero migrations to apply and grants re-apply cleanly
  - [ ] Manual: a reviewer confirms `migrate.ts` never shells out to `psql` and uses only the `postgres` npm package, per L2 Part 10
AI Prompt:
  > Implement the Drizzle Kit migration tooling for `/packages/database`.
  >
  > **Directory convention** (C5 §2.1): Drizzle schema files live under
  > `/packages/database/schema/`; Drizzle Kit configuration lives at
  > `/packages/database/drizzle.config.ts`; migration output goes to
  > `/packages/database/migrations/`. Do not hand-edit Drizzle Kit's snapshot
  > metadata directory — it tracks applied state and manual edits corrupt the
  > diff engine.
  >
  > **`/packages/database/package.json`** (scripts section; C5 §2.2–§2.3):
  > ```json
  > {
  >   "name": "@batac/database",
  >   "private": true,
  >   "version": "0.0.0",
  >   "scripts": {
  >     "build": "tsc -p tsconfig.json",
  >     "db:generate": "drizzle-kit generate",
  >     "db:migrate": "tsx scripts/migrate.ts",
  >     "db:lint": "echo 'see @batac/scripts lint:migrations'"
  >   }
  > }
  > ```
  >
  > **`/packages/database/drizzle.config.ts`** — `[Inference]` the exact file
  > content is not given verbatim in any loaded document; the directory
  > locations and the `DATABASE_URL_MIGRATE` connection role are confirmed
  > (C5 §2.1; L1 §5.1):
  > ```typescript
  > import { defineConfig } from 'drizzle-kit';
  >
  > export default defineConfig({
  >   schema: './schema/**/*.ts',
  >   out: './migrations',
  >   dialect: 'postgresql',
  >   dbCredentials: {
  >     url: process.env.DATABASE_URL_MIGRATE as string,
  >   },
  > });
  > ```
  >
  > **`/packages/database/scripts/migrate.ts`** — reproduce exactly (L2 Part 10):
  > ```typescript
  > import { drizzle } from 'drizzle-orm/postgres-js';
  > import { migrate } from 'drizzle-orm/postgres-js/migrator';
  > import postgres from 'postgres';
  > import { readFileSync } from 'node:fs';
  > import { join, dirname } from 'node:path';
  > import { fileURLToPath } from 'node:url';
  >
  > const __dirname = dirname(fileURLToPath(import.meta.url));
  >
  > if (!process.env.DATABASE_URL_MIGRATE) {
  >   console.error(
  >     '[migrate] DATABASE_URL_MIGRATE is not set. ' +
  >     'This variable is required for migrations and post-migrate grants.'
  >   );
  >   process.exit(1);
  > }
  >
  > const client = postgres(process.env.DATABASE_URL_MIGRATE, {
  >   max: 1,
  >   onnotice: () => {},
  > });
  >
  > const db = drizzle(client);
  >
  > console.log('[migrate] Applying Drizzle migrations...');
  > await migrate(db, { migrationsFolder: join(__dirname, '../migrations') });
  >
  > console.log('[migrate] Applying post-migrate grants...');
  > const grantsSQL = readFileSync(join(__dirname, './post-migrate-grants.sql'), 'utf-8');
  > await client.unsafe(grantsSQL);
  > await client.end();
  >
  > console.log('[migrate] Done.');
  > ```
  > `DATABASE_URL_MIGRATE` is declared `.optional()` in the Zod schema
  > (TASK-INFRA-002) because the running Fastify server does not need it at
  > runtime — but this script explicitly validates its own presence and exits
  > with a clear error if missing, so the optional declaration does not create
  > ambiguity in practice.
  >
  > Never use Drizzle Kit's reset/drop operations against any environment with
  > persistent data — production, staging with production-representative data,
  > and (by policy, for consistency) staging with synthetic data are all
  > prohibited from this operation. Only a developer's local environment and
  > CI's ephemeral test database may use it (C5 §6).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `db:generate` runs without error against an empty schema directory
  > - [ ] `db:migrate` against a fresh local Postgres applies cleanly and idempotently
  > - [ ] `migrate.ts` contains no `psql` shell invocation
  > - [ ] `DATABASE_URL_MIGRATE` absence produces the documented error message, not a stack trace
  > A reviewer will verify each one independently.

---

## TASK-INFRA-007

Phase:          1
Module:         INFRA
Title:          Build automated migration invariant linter for CI
Prerequisites:  [TASK-INFRA-001]
Deliverables:
  - /tools/scripts/lint-migrations.ts — parses every SQL file in `/packages/database/migrations/` and enforces the three designated invariants plus supplementary convention checks
  - /tools/scripts/package.json (updated) — `lint:migrations` script
  - /turbo.json (updated) — `db:lint` task wired to depend on the database package's typecheck output
Acceptance Criteria:
  - [ ] `pnpm --filter @batac/scripts lint:migrations` exits 0 against an empty migrations directory
  - [ ] A fixture migration file containing `id SERIAL PRIMARY KEY` makes the linter exit non-zero with an `[INVARIANT-06]` message naming the file and line
  - [ ] A fixture migration file containing `REFERENCES iam.users(id)` inside a `CREATE TABLE` for the `documents` schema makes the linter exit non-zero with an `[INVARIANT-01]` message
  - [ ] A fixture migration file with an undecorated `DATE` column produces a WARN (not a FAIL) and the process still exits 0 when no FAIL-severity finding is present
AI Prompt:
  > `[Inference]` C5 §7.1 states the source documents designate three
  > invariants for automated linting but do not specify the implementation —
  > the script below is the designed approach, consistent with the confirmed
  > stack. Build it at `/tools/scripts/lint-migrations.ts`.
  >
  > **Invocation:** `pnpm --filter @batac/scripts lint:migrations`, and as the
  > `db:lint` Turborepo task. It must run in CI on every pull request that
  > touches `/packages/database/` and must pass before the `build` task runs —
  > a failed linter blocks merge (C5 §7).
  >
  > The linter parses every `.sql` file in `/packages/database/migrations/`
  > using a PostgreSQL-dialect SQL parser (e.g. `pgsql-ast-parser` — choose the
  > exact library at implementation time based on maintenance status and
  > dialect coverage, and record the choice in a code comment). It must run
  > entirely in the local/CI Node.js process with no external service
  > dependency.
  >
  > **Rule — Invariant #1, no cross-schema foreign keys (FAIL, blocks merge):**
  > Trigger: any `REFERENCES {schema}.{table}` where `{schema}` differs from
  > the schema of the table being defined/altered. Permitted: `REFERENCES`
  > within the same schema. The `audit.events` table's `actor_id`/`entity_id`
  > plain-`UUID` columns carry no `REFERENCES` clause by design — the linter
  > produces no output for them; no special-case code is needed. Output format:
  > ```
  > [INVARIANT-01] Cross-schema foreign key detected.
  >   File: {filename}
  >   Line {N}: REFERENCES {schema}.{table}({col})
  >   Tables in schema '{owning_schema}' may not reference tables in schema '{other_schema}'.
  >   Cross-schema relationships must be resolved at the application layer:
  >   store the UUID and resolve in code, or communicate via the event bus.
  > ```
  >
  > **Rule — Invariant #6, UUID v4 primary keys (FAIL, blocks merge):**
  > Trigger: any `CREATE TABLE` primary key column typed other than `UUID`, or
  > a `UUID` primary key without `DEFAULT gen_random_uuid()`. Pass examples:
  > `id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY` and
  > `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. Composite primary keys on
  > junction tables (`[Inference]` — two or more `UUID` foreign-key columns,
  > no independent identity) are recognized and not flagged. Sequence-derived
  > columns that are not primary keys (used for document-number `{NN}`
  > counters) must never be flagged. `DEFAULT uuid_generate_v4()` is a WARN,
  > not a FAIL — functionally equivalent, but `gen_random_uuid()` is the
  > project standard (built into PostgreSQL 13+, no `uuid-ossp` dependency).
  >
  > **Rule — Invariant #7, TIMESTAMPTZ for timestamps (FAIL for `TIMESTAMP`;
  > WARN for `DATE`):** Trigger: a column whose name ends with `_at`, `_on`,
  > `_timestamp`, or starts with/contains `created`, `updated`, `deleted`,
  > `expires`, `sent`, `received`, `approved`, `signed`, `submitted`,
  > `logged`, `transmitted`, `published` — typed as anything other than
  > `TIMESTAMPTZ` / `TIMESTAMP WITH TIME ZONE`. `DATE` columns are legitimate
  > where the time component is meaningless (`[Inference]` — e.g. a
  > publication date); they WARN and require a suppression comment to pass
  > cleanly: `-- linter: allow-date reason="..."`. Every `allow-date`
  > suppression requires a reason and a second developer's code-review
  > approval.
  >
  > **Supplementary convention checks** (`[Inference]`, derived from
  > consolidated ref Part 11.9):
  > | Check | Severity | Trigger |
  > |---|---|---|
  > | Missing soft-delete columns | WARN | `CREATE TABLE` without both `deleted_at TIMESTAMPTZ` and `deleted_by UUID` |
  > | Missing `city_id` | WARN | `CREATE TABLE` in `iam`/`organization`/`documents`/`workflow`/`tracking`/`records` without `city_id UUID NOT NULL` |
  > | `DELETE` DML in migration SQL | FAIL | Any `DELETE FROM` statement in a `.sql` migration file |
  > | `DROP` without expand-contract comment | WARN | `DROP COLUMN`/`DROP TABLE`/`DROP SCHEMA` without a `-- expand-contract: contract phase` comment |
  > | `CREATE INDEX` without `CONCURRENTLY` on an existing table | WARN | `CREATE INDEX` (no `CONCURRENTLY`) targeting a table not created earlier in the same file |
  >
  > Suppression syntax for warnings:
  > `-- linter: skip-soft-delete reason="..."` /
  > `-- linter: skip-city-id reason="..."`. Every suppression requires a stated
  > reason and second-developer code-review approval; a suppression with no
  > reason must itself fail the linter as if it were a hard failure.
  >
  > **Exit code policy** (`[Inference]` — not stated explicitly in C5; derived
  > from the severity table): exit 0 if no FAIL-severity finding exists, even
  > if WARN findings are present; exit non-zero if any FAIL-severity finding
  > exists, including a suppression comment missing its required reason.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Empty migrations directory → exit 0
  > - [ ] `SERIAL PRIMARY KEY` fixture → `[INVARIANT-06]` FAIL, non-zero exit
  > - [ ] Cross-schema `REFERENCES` fixture → `[INVARIANT-01]` FAIL, non-zero exit
  > - [ ] Undecorated `DATE` column fixture → WARN only, exit 0
  > A reviewer will verify each one independently.


---

## TASK-INFRA-008

Phase:          1
Module:         INFRA
Title:          Write Fastify server production Dockerfile and entrypoint
Prerequisites:  [TASK-INFRA-006]
Deliverables:
  - /apps/server/Dockerfile — multi-stage production build (pruner → deps → builder → production)
  - /apps/server/entrypoint.sh — migrate → seed (dev/staging only) → start Fastify
Acceptance Criteria:
  - [ ] `docker build -f apps/server/Dockerfile -t batac-server:test .` completes successfully from the monorepo root
  - [ ] `docker run --rm batac-server:test sh -c "id -un"` reports `node`, not `root`
  - [ ] `docker run --rm batac-server:test ls /app/tessdata` lists decompressed `eng.traineddata` and `fil.traineddata`
  - [ ] Manual: a reviewer confirms `ENTRYPOINT` is `dumb-init` (PID 1) and `CMD` invokes `./entrypoint.sh`
AI Prompt:
  > Write the production Dockerfile and container entrypoint for
  > `/apps/server` (Fastify — tRPC, REST/OpenAPI, SSE, pgboss workers,
  > node-cron, OCR, QR/PDF generation, Nodemailer, all in one process).
  >
  > **`/apps/server/Dockerfile`** (L2 Part 4):
  > ```dockerfile
  > # apps/server/Dockerfile
  >
  > FROM node:22-alpine AS pruner
  > RUN corepack enable
  > WORKDIR /app
  > COPY . .
  > RUN pnpm dlx turbo prune --scope=server --docker
  >
  > FROM node:22-alpine AS deps
  > RUN corepack enable
  > WORKDIR /app
  > COPY --from=pruner /app/out/json/ .
  > COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
  > RUN pnpm install --frozen-lockfile
  >
  > FROM deps AS builder
  > COPY --from=pruner /app/out/full/ .
  > RUN pnpm --filter @batac/shared build && \
  >     pnpm --filter @batac/database build && \
  >     pnpm --filter server build
  >
  > FROM node:22-alpine AS production
  > RUN apk add --no-cache wget dumb-init
  > RUN corepack enable
  > WORKDIR /app
  >
  > COPY --from=pruner /app/out/json/ .
  > COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
  > RUN pnpm install --frozen-lockfile --prod
  >
  > COPY --from=builder /app/apps/server/dist           ./apps/server/dist
  > COPY --from=builder /app/packages/shared/dist       ./packages/shared/dist
  > COPY --from=builder /app/packages/database/dist     ./packages/database/dist
  > COPY --from=builder /app/packages/database/migrations ./packages/database/migrations
  > COPY --from=builder /app/packages/database/scripts/post-migrate-grants.sql \
  >                     ./packages/database/scripts/post-migrate-grants.sql
  >
  > COPY apps/server/entrypoint.sh ./entrypoint.sh
  > RUN chmod +x ./entrypoint.sh
  >
  > ENV TZ=Asia/Manila
  > ENV TESSDATA_PREFIX=/app/tessdata
  > RUN mkdir -p /app/tessdata && \
  >     wget -q -O /app/tessdata/eng.traineddata.gz \
  >       https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz && \
  >     wget -q -O /app/tessdata/fil.traineddata.gz \
  >       https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/fil.traineddata.gz && \
  >     gunzip /app/tessdata/*.gz && \
  >     chown -R node:node /app/tessdata
  >
  > USER node
  > EXPOSE 3000
  > ENTRYPOINT ["/usr/bin/dumb-init", "--"]
  > CMD ["./entrypoint.sh"]
  > ```
  > `[Inference]` `turbo prune --scope=server --docker` is the standard
  > Turborepo monorepo-Docker-build command — verify it matches the exact
  > Turborepo version pinned in TASK-INFRA-001 before the first real build.
  > `@node-rs/argon2` (not `argon2`) is the password-hashing package — it ships
  > prebuilt `linux-x64-musl` binaries, so no `python3`/`make`/`g++` build
  > toolchain is added to the `deps` stage (ADR-INF-001). `tesseract.js`
  > (`OCR_ENGINE=tesseract`) is pure JS/WASM — no system `tesseract` binary or
  > `apk add tesseract-ocr` is required. Language packs (`eng`, `fil`) are
  > unconditionally bundled so the same image serves both cloud and
  > no-guaranteed-internet on-premise targets (ADR-INF-003). `[Inference]`
  > confirm `TESSDATA_PREFIX=/app/tessdata` against the `tesseract.js`
  > scheduler API in the OCR service before the OCR feature is implemented; if
  > the path differs, update both the `ENV` and `RUN` lines. If Ilocano
  > language support is later required, its availability in the
  > `naptha/tessdata` repository must be confirmed first — `[Inference]`, not
  > confirmed here.
  >
  > **`/apps/server/entrypoint.sh`** (L2 Part 10):
  > ```bash
  > #!/bin/sh
  > # apps/server/entrypoint.sh
  > set -e
  >
  > echo "[entrypoint] APP_ENV=${APP_ENV}"
  > echo "[entrypoint] DB_HOST=${DB_HOST:-localhost}"
  >
  > echo "[entrypoint] Running database migrations..."
  > node ./packages/database/dist/migrate.js
  > echo "[entrypoint] Migrations complete."
  >
  > if [ "$APP_ENV" = "development" ] || [ "$APP_ENV" = "staging" ]; then
  >   echo "[entrypoint] Seeding database (${APP_ENV})..."
  >   node ./packages/database/dist/seed.js
  >   echo "[entrypoint] Seed complete."
  > else
  >   echo "[entrypoint] Skipping seed (APP_ENV=${APP_ENV})."
  > fi
  >
  > echo "[entrypoint] Starting server on port ${APP_PORT:-3000}..."
  > exec node ./apps/server/dist/index.js
  > ```
  > Migrations are idempotent (Drizzle tracks applied state in
  > `__drizzle_migrations`); seeds must be written as idempotent
  > `INSERT ... ON CONFLICT DO NOTHING` operations, since this runs on every
  > container restart in development. Seeding never runs in production. The
  > `seed.js` script itself is not part of this task's deliverables — it is
  > invoked here but authored by whichever module owns the seed data being
  > created; this task only wires the invocation point.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `docker build` from monorepo root completes successfully
  > - [ ] The running container's effective user is `node`, not `root`
  > - [ ] `/app/tessdata` contains decompressed `eng.traineddata` and `fil.traineddata`
  > - [ ] `ENTRYPOINT` is `dumb-init`; `CMD` is `./entrypoint.sh`
  > A reviewer will verify each one independently.

---

## TASK-INFRA-009

Phase:          1
Module:         INFRA
Title:          Write web SPA production Dockerfile
Prerequisites:  [TASK-INFRA-001]
Deliverables:
  - /apps/web/Dockerfile — multi-stage build producing only the compiled `/app/dist` Vite output
Acceptance Criteria:
  - [ ] `docker build -f apps/web/Dockerfile -t batac-web:test --build-arg VITE_API_URL=https://api.example.test --build-arg VITE_APP_URL=https://example.test .` completes from the monorepo root without error
  - [ ] `docker run --rm batac-web:test ls /app` shows only a `dist` directory — no `node_modules`, no source files
  - [ ] Manual: a reviewer confirms no `VITE_`-prefixed build `ARG` in the Dockerfile carries a secret value, per L1 §21.4's warning
  - [ ] Manual: a reviewer confirms `VITE_API_URL` is documented as the public-facing URL, not an internal Docker hostname
AI Prompt:
  > Write the production Dockerfile for the `/apps/web` Vite SPA. The output
  > image's sole purpose is to seed the `web_static` Docker volume that Nginx
  > serves from (TASK-INFRA-010, TASK-INFRA-012) — it is not a running service.
  >
  > **`/apps/web/Dockerfile`** (L2 Part 5):
  > ```dockerfile
  > # apps/web/Dockerfile
  >
  > FROM node:22-alpine AS pruner
  > RUN corepack enable
  > WORKDIR /app
  > COPY . .
  > RUN pnpm dlx turbo prune --scope=web --docker
  >
  > FROM node:22-alpine AS deps
  > RUN corepack enable
  > WORKDIR /app
  > COPY --from=pruner /app/out/json/ .
  > COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
  > RUN pnpm install --frozen-lockfile
  >
  > FROM deps AS builder
  > COPY --from=pruner /app/out/full/ .
  >
  > ARG VITE_APP_NAME="Batac City LGU"
  > ARG VITE_API_URL
  > ARG VITE_APP_URL
  > ARG VITE_SENTRY_DSN
  > ARG VITE_SENTRY_ENVIRONMENT
  >
  > ENV VITE_APP_NAME=$VITE_APP_NAME
  > ENV VITE_API_URL=$VITE_API_URL
  > ENV VITE_APP_URL=$VITE_APP_URL
  > ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
  > ENV VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT
  >
  > RUN pnpm --filter @batac/shared build && \
  >     pnpm --filter @batac/ui build && \
  >     pnpm --filter web build
  >
  > FROM alpine:3.20 AS production
  > COPY --from=builder /app/apps/web/dist /app/dist
  > ```
  > `VITE_*` variables are baked into the bundle at build time and cannot be
  > changed at runtime — a changed `VITE_API_URL` requires a new image build,
  > not a container restart. `VITE_API_URL` must be the public-facing URL
  > Nginx exposes (e.g. `https://dms.batac.gov.ph`), never an internal Docker
  > hostname. Building a staging image with a different `VITE_API_URL` than
  > the production image is the correct pattern — they are different
  > artifacts. Never prefix a secret with `VITE_` — it will appear verbatim in
  > the browser bundle.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `docker build` with the listed `--build-arg`s completes successfully
  > - [ ] The production image contains only `/app/dist`
  > - [ ] No `VITE_*` build arg carries a secret value
  > - [ ] `VITE_API_URL` is documented as the public-facing URL
  > A reviewer will verify each one independently.

---

## TASK-INFRA-010

Phase:          1
Module:         INFRA
Title:          Configure Nginx reverse proxy and container entrypoint
Prerequisites:  [TASK-INFRA-008, TASK-INFRA-009]
Deliverables:
  - /nginx/batac.conf.template — reverse proxy, static bundle serving, SSE-safe API proxy config
  - /nginx/entrypoint.sh — runs `envsubst` on the template at container start
Acceptance Criteria:
  - [ ] `envsubst '${APP_DOMAIN}' < nginx/batac.conf.template` with `APP_DOMAIN=test.example.com` set leaves no unresolved `${APP_DOMAIN}` token, and leaves Nginx's own `$host`/`$request_uri`/`$scheme` references untouched
  - [ ] The substituted config passes `nginx -t` syntax validation inside a temporary `nginx:1.27-alpine` container
  - [ ] Manual: a reviewer confirms the `/api/` location block sets `proxy_buffering off` and `proxy_read_timeout 3600s` (required for SSE)
  - [ ] Manual: a reviewer confirms the hashed-asset location block sets `immutable` caching while the `.html` block sets `no-cache`
AI Prompt:
  > Write the Nginx configuration that serves the static SPA bundle and
  > reverse-proxies `/api/*` to Fastify, including the SSE-specific settings
  > the notification feed depends on.
  >
  > **`/nginx/batac.conf.template`** (L2 Part 6; mounted at
  > `/etc/nginx/templates/batac.conf.template` inside the container):
  > ```nginx
  > server {
  >     listen 80;
  >     server_name _;
  >     location / {
  >         return 301 https://$host$request_uri;
  >     }
  > }
  >
  > server {
  >     listen 443 ssl http2;
  >     server_name ${APP_DOMAIN};
  >
  >     ssl_certificate     /etc/nginx/certs/fullchain.pem;
  >     ssl_certificate_key /etc/nginx/certs/privkey.pem;
  >     ssl_protocols             TLSv1.2 TLSv1.3;
  >     ssl_prefer_server_ciphers off;
  >     ssl_session_cache         shared:SSL:10m;
  >     ssl_session_timeout       1d;
  >
  >     root  /usr/share/nginx/html;
  >     index index.html;
  >
  >     location / {
  >         try_files $uri $uri/ /index.html;
  >     }
  >
  >     location ~* \.(js|css|woff2?|ttf|eot|svg|png|ico)$ {
  >         try_files $uri =404;
  >         add_header Cache-Control "public, max-age=31536000, immutable";
  >         access_log off;
  >     }
  >
  >     location ~* \.html$ {
  >         add_header Cache-Control "no-cache, must-revalidate";
  >     }
  >
  >     location = /health {
  >         proxy_pass http://server:3000/health;
  >         proxy_http_version 1.1;
  >         proxy_set_header Host $host;
  >         access_log off;
  >     }
  >
  >     location /api/ {
  >         proxy_pass         http://server:3000;
  >         proxy_http_version 1.1;
  >         proxy_set_header Host               $host;
  >         proxy_set_header X-Real-IP          $remote_addr;
  >         proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
  >         proxy_set_header X-Forwarded-Proto  $scheme;
  >
  >         proxy_set_header   Connection    '';
  >         proxy_buffering    off;
  >         proxy_cache        off;
  >         proxy_read_timeout 3600s;
  >         proxy_send_timeout 3600s;
  >         proxy_connect_timeout 10s;
  >     }
  >
  >     gzip            on;
  >     gzip_vary       on;
  >     gzip_proxied    any;
  >     gzip_comp_level 6;
  >     gzip_types
  >         text/plain text/css text/javascript application/javascript
  >         application/json application/x-javascript image/svg+xml;
  > }
  > ```
  > SSE requires `proxy_buffering off` and a long `proxy_read_timeout` — without
  > these, Nginx buffers SSE chunks and the browser's notification feed stalls.
  > `proxy_set_header Connection ''` clears any `Connection: upgrade` header
  > Nginx might otherwise forward — SSE is a standard long-lived HTTP response,
  > not a protocol upgrade. The `/health` location proxies directly to Fastify
  > and is also used by Nginx's own healthcheck in `compose.prod.yml`
  > (TASK-INFRA-012) and TASK-INFRA-011's endpoint.
  >
  > **Domain injection** (ADR-INF-004): Nginx does not natively support
  > environment-variable substitution in config files, so a custom entrypoint
  > runs `envsubst` at container start:
  > ```sh
  > #!/bin/sh
  > # nginx/entrypoint.sh
  > set -e
  > envsubst '${APP_DOMAIN}' < /etc/nginx/templates/batac.conf.template \
  >   > /etc/nginx/conf.d/batac.conf
  > exec nginx -g 'daemon off;'
  > ```
  > The explicit variable list (`'${APP_DOMAIN}'`) prevents `envsubst` from
  > also expanding Nginx's own `$host`, `$request_uri`, `$scheme` references.
  >
  > **TLS** (ADR-INF-005, resolved): the certificate and key are mounted from
  > Docker secrets to the fixed paths above. Certbot/Let's Encrypt is
  > deliberately not used — ACME requires outbound internet access, which
  > conflicts with the on-premise deployment constraint. Manual renewal with a
  > 60-day advance reminder is the adopted procedure; this task does not need
  > to automate that reminder.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `envsubst` resolves `${APP_DOMAIN}` and leaves Nginx's own `$`-variables untouched
  > - [ ] `nginx -t` reports syntax OK on the substituted config
  > - [ ] The `/api/` block disables buffering and sets a ≥3600s read timeout
  > - [ ] Hashed assets get `immutable` caching; `.html` gets `no-cache`
  > A reviewer will verify each one independently.

---

## TASK-INFRA-011

Phase:          1
Module:         INFRA
Title:          Implement Fastify liveness health-check endpoint
Prerequisites:  [TASK-INFRA-002]
Deliverables:
  - /apps/server/src/routes/health.route.ts — lightweight liveness probe; registers `GET {HEALTH_CHECK_PATH}`
Acceptance Criteria:
  - [ ] `curl -s http://localhost:3000${HEALTH_CHECK_PATH:-/health}` returns HTTP 200 with a JSON body containing `status`, `version`, and `uptime` keys
  - [ ] Code review confirms the route handler contains no database query and no import of any repository/Drizzle module
  - [ ] A unit test asserts the route responds without throwing when called directly (no live server required)
  - [ ] Manual: stopping the `postgres` container while the server process keeps running, then curling the health path, still returns HTTP 200 — this is a liveness probe, not a readiness probe
AI Prompt:
  > Implement the minimal liveness endpoint every infrastructure health check
  > in this project depends on: Docker Compose healthchecks (TASK-INFRA-004,
  > TASK-INFRA-012), Nginx's `/health` proxy (TASK-INFRA-010), and the CI E2E
  > smoke check (TASK-INFRA-014).
  >
  > **Specification** (L2 Part 7): the endpoint must be a lightweight liveness
  > probe returning `HTTP 200` with `{ "status": "ok", "version": "...", "uptime": ... }`.
  > It must NOT query the database on every call — that conflates liveness with
  > readiness. A separate `/ready` endpoint that does check database
  > connectivity may be added later for Kubernetes-style deployments, but is
  > not required for the Docker Compose deployment target and is out of scope
  > for this task.
  >
  > The path itself is read from the validated env object (TASK-INFRA-002),
  > not from `process.env` directly:
  > ```typescript
  > import type { FastifyInstance } from 'fastify';
  > import { env } from '../config/env';
  >
  > const startedAt = Date.now();
  >
  > export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  >   app.get(env.HEALTH_CHECK_PATH, async (_request, reply) => {
  >     reply.send({
  >       status: 'ok',
  >       version: env.APP_VERSION,
  >       uptime: Math.floor((Date.now() - startedAt) / 1000),
  >     });
  >   });
  > }
  > ```
  > `env.HEALTH_CHECK_PATH` is available because TASK-INFRA-002 added it to
  > `serverEnvSchema` to close the gap between L1 §13.3 (which documents the
  > variable) and L1 §21.2's schema code excerpt (which omitted it) — see that
  > task's `[Inference]` note. Register this route at the top level of the
  > Fastify instance, not nested under any module's plugin scope, since it must
  > respond even if a domain module's plugin fails to register.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `curl` against `HEALTH_CHECK_PATH` returns 200 with `status`/`version`/`uptime`
  > - [ ] The route file imports no database or repository module
  > - [ ] A unit test calls the handler directly without a live server
  > - [ ] The endpoint returns 200 even when the database is unreachable
  > A reviewer will verify each one independently.


---

## TASK-INFRA-012

Phase:          1
Module:         INFRA
Title:          Define production and staging Docker Compose stack
Prerequisites:  [TASK-INFRA-008, TASK-INFRA-009, TASK-INFRA-010]
Deliverables:
  - /compose.prod.yml — production/staging stack: nginx, server, web-build, postgres-primary, postgres-standby, optional MinIO (on-premise profile), optional Meilisearch (search profile)
Acceptance Criteria:
  - [ ] `docker compose -f compose.prod.yml config` validates without error given a populated `.env.production`
  - [ ] `docker compose -f compose.prod.yml --profile onpremise config` additionally resolves the `minio` service when that profile is active
  - [ ] Manual: a reviewer confirms `nginx` declares `depends_on: server: condition: service_healthy` and `depends_on: web-build: condition: service_completed_successfully`
  - [ ] Manual: a reviewer confirms the `server` service's port mapping is `127.0.0.1:3000:3000`, not publicly exposed
AI Prompt:
  > Write the production/staging Docker Compose file. This is the deployment
  > target both the staging and production environments use; the difference
  > between them is the `.env.staging` / `.env.production` file supplied, not
  > the compose file itself.
  >
  > **`/compose.prod.yml`** (L2 Part 3):
  > ```yaml
  > name: batac-prod
  >
  > services:
  >
  >   postgres-primary:
  >     image: bitnami/postgresql:16
  >     restart: unless-stopped
  >     environment:
  >       POSTGRESQL_REPLICATION_MODE: master
  >       POSTGRESQL_REPLICATION_USER: ${DB_REPLICATION_USER:-replicator}
  >       POSTGRESQL_REPLICATION_PASSWORD_FILE: /run/secrets/db_replication_password
  >       POSTGRESQL_PASSWORD_FILE: /run/secrets/db_superuser_password
  >       POSTGRESQL_DATABASE: ${DB_NAME:-batac_lgu}
  >       TZ: Asia/Manila
  >     secrets:
  >       - db_replication_password
  >       - db_superuser_password
  >     volumes:
  >       - postgres_primary_data:/bitnami/postgresql
  >       - ./tools/db/init:/docker-entrypoint-initdb.d:ro
  >     healthcheck:
  >       test: ["CMD-SHELL", "pg_isready -U postgres -d ${DB_NAME:-batac_lgu}"]
  >       interval: 10s
  >       timeout: 5s
  >       retries: 10
  >       start_period: 30s
  >     deploy:
  >       resources:
  >         limits: { cpus: "2", memory: 4G }
  >
  >   postgres-standby:
  >     image: bitnami/postgresql:16
  >     restart: unless-stopped
  >     depends_on:
  >       postgres-primary:
  >         condition: service_healthy
  >     environment:
  >       POSTGRESQL_REPLICATION_MODE: slave
  >       POSTGRESQL_MASTER_HOST: postgres-primary
  >       POSTGRESQL_REPLICATION_USER: ${DB_REPLICATION_USER:-replicator}
  >       POSTGRESQL_REPLICATION_PASSWORD_FILE: /run/secrets/db_replication_password
  >       POSTGRESQL_PASSWORD_FILE: /run/secrets/db_superuser_password
  >       TZ: Asia/Manila
  >     secrets:
  >       - db_replication_password
  >       - db_superuser_password
  >     volumes:
  >       - postgres_standby_data:/bitnami/postgresql
  >     deploy:
  >       resources:
  >         limits: { cpus: "2", memory: 4G }
  >
  >   server:
  >     image: ${REGISTRY:-ghcr.io/batac}/server:${IMAGE_TAG:-latest}
  >     restart: unless-stopped
  >     depends_on:
  >       postgres-primary:
  >         condition: service_healthy
  >     env_file:
  >       - .env.${APP_ENV:-production}
  >     secrets:
  >       - jwt_access_secret
  >       - jwt_refresh_secret
  >       - audit_hmac_secret
  >       - database_url_app
  >       - database_url_audit
  >       - s3_access_key
  >       - s3_secret_key
  >       - smtp_password
  >       - backup_encryption_key
  >     ports:
  >       - "127.0.0.1:3000:3000"
  >     healthcheck:
  >       test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:3000${HEALTH_CHECK_PATH:-/health}"]
  >       interval: 15s
  >       timeout: 5s
  >       retries: 5
  >       start_period: 30s
  >     deploy:
  >       resources:
  >         limits: { cpus: "2", memory: 2G }
  >
  >   web-build:
  >     image: ${REGISTRY:-ghcr.io/batac}/web:${IMAGE_TAG:-latest}
  >     restart: "no"
  >     volumes:
  >       - web_static:/app/dist
  >     command: ["sh", "-c", "cp -r /app/dist/* /shared/ 2>/dev/null || true"]
  >
  >   nginx:
  >     image: nginx:1.27-alpine
  >     restart: unless-stopped
  >     depends_on:
  >       server:
  >         condition: service_healthy
  >       web-build:
  >         condition: service_completed_successfully
  >     environment:
  >       APP_DOMAIN: ${APP_DOMAIN}
  >     volumes:
  >       - ./nginx/batac.conf.template:/etc/nginx/templates/batac.conf.template:ro
  >       - ./nginx/entrypoint.sh:/entrypoint.sh:ro
  >       - web_static:/usr/share/nginx/html:ro
  >       - tls_certs:/etc/nginx/certs:ro
  >     entrypoint: ["/entrypoint.sh"]
  >     ports:
  >       - "80:80"
  >       - "443:443"
  >     healthcheck:
  >       test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost/health"]
  >       interval: 15s
  >       timeout: 5s
  >       retries: 5
  >
  >   minio:
  >     image: minio/minio:latest
  >     restart: unless-stopped
  >     profiles:
  >       - onpremise
  >     command: server /data --console-address ":9001"
  >     environment:
  >       MINIO_ROOT_USER_FILE: /run/secrets/s3_access_key
  >       MINIO_ROOT_PASSWORD_FILE: /run/secrets/s3_secret_key
  >       TZ: Asia/Manila
  >     secrets:
  >       - s3_access_key
  >       - s3_secret_key
  >     ports:
  >       - "127.0.0.1:9000:9000"
  >       - "127.0.0.1:9001:9001"
  >     volumes:
  >       - minio_prod_data:/data
  >
  >   meilisearch:
  >     image: getmeili/meilisearch:latest
  >     restart: unless-stopped
  >     profiles:
  >       - search
  >     environment:
  >       MEILI_MASTER_KEY_FILE: /run/secrets/meilisearch_master_key
  >       MEILI_NO_ANALYTICS: "true"
  >       MEILI_ENV: production
  >       TZ: Asia/Manila
  >     secrets:
  >       - meilisearch_master_key
  >     volumes:
  >       - meilisearch_prod_data:/meili_data
  >
  > secrets:
  >   db_replication_password: { file: ./secrets/db_replication_password.txt }
  >   db_superuser_password:   { file: ./secrets/db_superuser_password.txt }
  >   jwt_access_secret:       { file: ./secrets/jwt_access_secret.txt }
  >   jwt_refresh_secret:      { file: ./secrets/jwt_refresh_secret.txt }
  >   audit_hmac_secret:       { file: ./secrets/audit_hmac_secret.txt }
  >   database_url_app:        { file: ./secrets/database_url_app.txt }
  >   database_url_audit:      { file: ./secrets/database_url_audit.txt }
  >   s3_access_key:           { file: ./secrets/s3_access_key.txt }
  >   s3_secret_key:           { file: ./secrets/s3_secret_key.txt }
  >   smtp_password:           { file: ./secrets/smtp_password.txt }
  >   backup_encryption_key:   { file: ./secrets/backup_encryption_key.txt }
  >   meilisearch_master_key:  { file: ./secrets/meilisearch_master_key.txt }
  >
  > volumes:
  >   postgres_primary_data: { driver: local }
  >   postgres_standby_data: { driver: local }
  >   web_static:            { driver: local }
  >   tls_certs:             { driver: local }
  >   minio_prod_data:       { driver: local }
  >   meilisearch_prod_data: { driver: local }
  > ```
  > **Secrets** (ADR-INF-006, resolved): production secrets are plain files
  > under `./secrets/`, listed in `.gitignore`, populated manually by the LGU
  > IT Office during deployment and referenced via Docker's native `secrets:`
  > mechanism (which mounts each as a file under `/run/secrets/{name}` inside
  > the container — consumed by `load-docker-secrets.ts`, TASK-INFRA-003). No
  > external secrets manager (Vault, AWS Secrets Manager, etc.) is used in
  > Phase 1 — `[Inference]` this is the right read of ADR-INF-006's resolution
  > for a small-team, single-VPS, on-premise-or-budget-cloud deployment, though
  > L1 §23.2 separately lists broader per-environment secrets-manager options;
  > ADR-INF-006 supersedes that broader table for what Phase 1 actually builds.
  > `meilisearch` and `minio` are both reserved-but-inactive unless their
  > profile is passed explicitly — `minio` only matters for the on-premise
  > deployment target (D5; consolidated ref §11.2's S3-endpoint-swap path),
  > and `meilisearch` is Phase 2.
  >
  > `[SPEC GAP]` ADR-INF-009 names a `backup-restore-test` scratch container,
  > feature-flagged off by default for Phase 1 with a documented activation
  > checklist. It is intentionally NOT included in the compose file above —
  > it remains a documented-but-dormant Phase 1 capability, not a Phase 2+
  > deferral. Do not add it to this file; if a human decides to activate it,
  > that is a separate, explicit task.
  >
  > `[SPEC GAP]` No loaded document specifies how this compose file, the
  > `./secrets/` files, or the `nginx` TLS certificate volume actually get
  > onto the production host. L3 explicitly excludes "Infrastructure
  > provisioning (Terraform/Pulumi for the VPS)" as "a separate IaC document
  > not yet in the plan," even though the consolidated reference's
  > Architectural Law #5 and D5's Deployment Constraints both require IaC
  > "from day one." This task assumes a host with Docker and Docker Compose
  > already installed; provisioning that host is out of scope and unspecified.
  > Flagged in the Module Summary.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `docker compose -f compose.prod.yml config` validates given a populated `.env.production`
  > - [ ] `--profile onpremise config` additionally resolves `minio`
  > - [ ] `nginx`'s `depends_on` conditions match exactly as specified
  > - [ ] `server`'s port mapping is loopback-only (`127.0.0.1:3000:3000`)
  > A reviewer will verify each one independently.

---

## TASK-INFRA-013

Phase:          1
Module:         INFRA
Title:          Build CI pull-request merge-gate workflow
Prerequisites:  [TASK-INFRA-001, TASK-INFRA-005, TASK-INFRA-006]
Deliverables:
  - /.github/workflows/ci.yml — Jobs A (lint+typecheck), B (unit tests), C (integration tests with service containers), D (build); pnpm/Turborepo caching
  - /turbo.json (updated) — `test:unit`, `test:integration` task definitions added to TASK-INFRA-001's stub
Acceptance Criteria:
  - [ ] Opening a PR with a trivial change triggers Jobs A–D and they appear as GitHub status checks on the PR
  - [ ] Job C's service-container bootstrap (role-creation script → migrate → seed) completes against an empty fixture set in well under the 5-minute integration-test budget (L3 §9)
  - [ ] The workflow includes an `actions/cache` (or equivalent) step for both the pnpm store and `.turbo`, keyed on the `pnpm-lock.yaml` hash
  - [ ] Manual: a reviewer confirms no coverage-percentage gate exists anywhere in the unit-test job, per L3 §12 constraint #1
AI Prompt:
  > Build the pull-request merge-gate GitHub Actions workflow. This is the
  > pipeline every PR must pass before merge; the main-branch
  > deployment-pipeline jobs are added separately in TASK-INFRA-014.
  >
  > `[SPEC GAP]` L3's own "About This Document" section states this
  > specification does not cover "Infrastructure provisioning (Terraform/
  > Pulumi for the VPS; that is a separate IaC document not yet in the plan)" —
  > confirming the same gap already flagged in TASK-INFRA-012. This task only
  > covers the pipeline's job logic, not how runners reach the deployment
  > target.
  >
  > **Pipeline topology** (L3 §2.1, §3.1–§3.5): four jobs run in parallel where
  > possible —
  > - **Job A — Lint & Typecheck**: `pnpm turbo run lint typecheck`. Budget: 3
  >   minutes.
  > - **Job B — Unit Tests**: `pnpm turbo run test:unit`, no service
  >   containers, no network access. Budget: 5 minutes.
  > - **Job C — Integration Tests**: runs against `postgres:16-alpine` and
  >   `minio/minio` service containers; bootstraps the database with the
  >   three-role script (TASK-INFRA-005) and `db:migrate` (TASK-INFRA-006)
  >   before running `pnpm turbo run test:integration`. Budget: 8 minutes.
  > - **Job D — Build**: `pnpm turbo run build` for both `server` and `web`
  >   workspaces, confirming both Dockerfiles (TASK-INFRA-008,
  >   TASK-INFRA-009) build successfully. Budget: 6 minutes.
  >
  > ```yaml
  > # .github/workflows/ci.yml
  > name: CI
  >
  > on:
  >   pull_request:
  >     branches: [main]
  >
  > concurrency:
  >   group: ci-${{ github.head_ref }}
  >   cancel-in-progress: true
  >
  > jobs:
  >   lint-typecheck:
  >     runs-on: ubuntu-latest
  >     timeout-minutes: 3
  >     steps:
  >       - uses: actions/checkout@v4
  >       - uses: pnpm/action-setup@v4
  >       - uses: actions/setup-node@v4
  >         with: { node-version: 22, cache: 'pnpm' }
  >       - run: pnpm install --frozen-lockfile
  >       - uses: actions/cache@v4
  >         with:
  >           path: .turbo
  >           key: turbo-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
  >           restore-keys: turbo-${{ runner.os }}-
  >       - run: pnpm turbo run lint typecheck
  >
  >   unit-tests:
  >     runs-on: ubuntu-latest
  >     timeout-minutes: 5
  >     steps:
  >       - uses: actions/checkout@v4
  >       - uses: pnpm/action-setup@v4
  >       - uses: actions/setup-node@v4
  >         with: { node-version: 22, cache: 'pnpm' }
  >       - run: pnpm install --frozen-lockfile
  >       - run: pnpm turbo run test:unit
  >
  >   integration-tests:
  >     runs-on: ubuntu-latest
  >     timeout-minutes: 8
  >     services:
  >       postgres:
  >         image: postgres:16-alpine
  >         env:
  >           POSTGRES_DB: batac_lgu_test
  >           POSTGRES_PASSWORD: postgres
  >         ports: ["5432:5432"]
  >         options: >-
  >           --health-cmd "pg_isready -U postgres"
  >           --health-interval 5s --health-timeout 5s --health-retries 10
  >       minio:
  >         image: minio/minio:latest
  >         env:
  >           MINIO_ROOT_USER: minio
  >           MINIO_ROOT_PASSWORD: minio123456
  >         ports: ["9000:9000"]
  >     env:
  >       NODE_ENV: test
  >       APP_ENV: development
  >       DATABASE_URL_MIGRATE: postgresql://postgres:postgres@localhost:5432/batac_lgu_test
  >       DATABASE_URL_APP: postgresql://batac_app:app_devpassword@localhost:5432/batac_lgu_test
  >       DATABASE_URL_AUDIT: postgresql://batac_audit:audit_devpassword@localhost:5432/batac_lgu_test
  >     steps:
  >       - uses: actions/checkout@v4
  >       - uses: pnpm/action-setup@v4
  >       - uses: actions/setup-node@v4
  >         with: { node-version: 22, cache: 'pnpm' }
  >       - run: pnpm install --frozen-lockfile
  >       - name: Bootstrap database roles
  >         run: |
  >           PGPASSWORD=postgres psql -h localhost -U postgres -d batac_lgu_test \
  >             -v ON_ERROR_STOP=1 -f tools/db/init/01-create-roles.sh
  >       - name: Run migrations
  >         run: pnpm --filter @batac/database db:migrate
  >       - run: pnpm turbo run test:integration
  >
  >   build:
  >     runs-on: ubuntu-latest
  >     timeout-minutes: 6
  >     steps:
  >       - uses: actions/checkout@v4
  >       - uses: pnpm/action-setup@v4
  >       - uses: actions/setup-node@v4
  >         with: { node-version: 22, cache: 'pnpm' }
  >       - run: pnpm install --frozen-lockfile
  >       - run: pnpm turbo run build
  >       - run: docker build -f apps/server/Dockerfile -t batac-server:ci .
  >       - run: docker build -f apps/web/Dockerfile -t batac-web:ci --build-arg VITE_API_URL=https://ci.placeholder --build-arg VITE_APP_URL=https://ci.placeholder .
  > ```
  > `[Inference]` `tools/db/init/01-create-roles.sh` is written as a `psql`
  > entrypoint script for the Postgres container (TASK-INFRA-005) and is
  > re-used here directly with `psql ... -f` against the CI service
  > container — confirm this script has no Docker-entrypoint-specific
  > assumptions (e.g. reliance on `POSTGRES_DB` being pre-created by the
  > official image's first-run hook) before relying on it verbatim in CI; the
  > GitHub Actions Postgres service container does run the same official
  > entrypoint hooks, so this should hold, but it has not been executed to
  > confirm.
  >
  > `APP_ENV=development` (not `test`) is used in the integration-test job
  > above, deliberately. `[CONFLICT]` L3 §7.1's own example environment-config
  > table lists `APP_ENV: test` for CI, but the `AppEnv` Zod enum
  > (TASK-INFRA-002, sourced from L1 §21.2) only accepts
  > `development | staging | production | on-premise` — it does not include
  > `"test"`. Setting `APP_ENV=test` would fail startup validation. This task
  > follows L1's enum and uses `APP_ENV=development` for CI while leaving
  > `NODE_ENV=test`, since `NodeEnv`'s enum does include `"test"`. The L1/L3
  > mismatch is flagged in the Module Summary; do not change this without
  > confirming which document should be corrected.
  >
  > No code-coverage percentage threshold gates any job above — per L3 §12
  > constraint #1, coverage is reported but does not block merge.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] All four jobs appear as PR status checks
  > - [ ] Job C's bootstrap-and-migrate sequence completes well under 5 minutes on an empty fixture set
  > - [ ] pnpm store and `.turbo` are both cached, keyed on the lockfile hash
  > - [ ] No coverage-percentage gate exists in the unit-test job
  > A reviewer will verify each one independently.

---

## TASK-INFRA-014

Phase:          1
Module:         INFRA
Title:          Build CI main-branch E2E and deployment gate workflow
Prerequisites:  [TASK-INFRA-013, TASK-INFRA-012]
Deliverables:
  - /.github/workflows/ci.yml (extended) — Job E (E2E against a docker-compose stack), Job F (deploy to staging), Job G (manual-approval production deployment gate)
Acceptance Criteria:
  - [ ] Merging a PR to `main` triggers Jobs A–D again, followed automatically by Job E, with no manual step required to reach E2E
  - [ ] A failing Job E prevents Job G from running, verified by inspecting the `needs:` graph in the workflow YAML rather than only observing one passing run
  - [ ] Manual: the `production` GitHub Environment has a required-reviewers rule configured in repository settings (this is a one-time manual setting, not a file in this repository)
  - [ ] Manual: a reviewer confirms staging-only and production-only secrets are scoped to their respective GitHub Environments, so a PR-triggered job cannot read `secrets.PRODUCTION_*`
AI Prompt:
  > Extend `/.github/workflows/ci.yml` from TASK-INFRA-013 with the
  > main-branch-only jobs: end-to-end tests, staging deployment, and a
  > human-gated production deployment.
  >
  > **Pipeline topology** (L3 §2.2, §3.6–§3.8):
  > - **Job E — E2E Tests**: triggered only on push to `main` (post-merge), not
  >   on every PR — full Playwright suite against a `compose.yml`-equivalent
  >   stack with the just-built images. Budget: 15 minutes.
  > - **Job F — Deploy to Staging**: automatic on Job E success; SSHes into
  >   the staging host, pulls the new images, runs
  >   `docker compose -f compose.prod.yml up -d`.
  > - **Job G — Deploy to Production**: requires the GitHub Environment
  >   `production`'s manual-approval gate; only runs after a human reviewer
  >   approves, even though the workflow trigger itself is automatic.
  >
  > ```yaml
  > # Appended to .github/workflows/ci.yml — add this trigger and these jobs
  > on:
  >   pull_request:
  >     branches: [main]
  >   push:
  >     branches: [main]
  >
  > jobs:
  >   # ...lint-typecheck, unit-tests, integration-tests, build from TASK-INFRA-013...
  >
  >   e2e-tests:
  >     if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  >     needs: [build]
  >     runs-on: ubuntu-latest
  >     timeout-minutes: 15
  >     steps:
  >       - uses: actions/checkout@v4
  >       - run: docker compose -f compose.yml up -d
  >       - run: docker compose -f compose.yml exec -T postgres pg_isready -U postgres
  >       - run: pnpm exec playwright install --with-deps
  >       - run: pnpm turbo run test:e2e
  >       - run: docker compose -f compose.yml down -v
  >
  >   deploy-staging:
  >     if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  >     needs: [e2e-tests]
  >     runs-on: ubuntu-latest
  >     environment: staging
  >     steps:
  >       - uses: actions/checkout@v4
  >       - name: Deploy to staging host
  >         uses: appleboy/ssh-action@v1
  >         with:
  >           host: ${{ secrets.STAGING_HOST }}
  >           username: ${{ secrets.STAGING_SSH_USER }}
  >           key: ${{ secrets.STAGING_SSH_KEY }}
  >           script: |
  >             cd /opt/batac && \
  >             docker compose -f compose.prod.yml pull && \
  >             docker compose -f compose.prod.yml up -d
  >
  >   deploy-production:
  >     if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  >     needs: [deploy-staging]
  >     runs-on: ubuntu-latest
  >     environment: production
  >     steps:
  >       - uses: actions/checkout@v4
  >       - name: Deploy to production host
  >         uses: appleboy/ssh-action@v1
  >         with:
  >           host: ${{ secrets.PRODUCTION_HOST }}
  >           username: ${{ secrets.PRODUCTION_SSH_USER }}
  >           key: ${{ secrets.PRODUCTION_SSH_KEY }}
  >           script: |
  >             cd /opt/batac && \
  >             docker compose -f compose.prod.yml pull && \
  >             docker compose -f compose.prod.yml up -d
  > ```
  > `environment: production` is what causes GitHub to pause `deploy-production`
  > for the configured required reviewers — that pause is enforced by the
  > GitHub Environment's protection rule, not by anything in this YAML, so the
  > `production` Environment's required-reviewers setting must be configured
  > once in the repository's Settings → Environments UI (or via the GitHub API
  > / a Terraform `github` provider, which is out of scope here, consistent
  > with the IaC gap already flagged). `secrets.STAGING_*` and
  > `secrets.PRODUCTION_*` must be defined on their respective Environments,
  > not as repository-level secrets, so that `deploy-staging` cannot
  > accidentally read a production credential.
  >
  > **Branch protection** (L3 §8): the `main` branch's protection rule
  > requires Jobs A–D to pass and at least one approving code review before
  > merge; this, too, is a one-time GitHub repository setting with no
  > committed-config mechanism specified in L3 — note it as a manual setup
  > step, do not invent a YAML file for it.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Merging to `main` triggers Job E automatically, with no manual step
  > - [ ] The `needs:` graph shows Job G blocked behind a passing Job E (via Job F)
  > - [ ] The `production` Environment has required reviewers configured
  > - [ ] Staging and production secrets are scoped to their own Environments
  > A reviewer will verify each one independently.


---

## TASK-INFRA-015

Phase:          1
Module:         INFRA
Title:          Commit operational backup and DR runbook references
Prerequisites:  [TASK-INFRA-003]
Deliverables:
  - /docs/ops/l4-backup-dr-runbooks.md — the live, version-controlled copy of L4, authoritative for operational use going forward
  - /docs/ops/pitr-log.md — empty log template for PITR base-backup verification entries
  - /docs/ops/staging-test-log.md — empty log template for staging failover-drill entries
  - /docs/ops/restoration-test-log.md — empty log template for monthly restoration-test entries
  - /docs/ops/dr-drill-log.md — empty log template for quarterly DR-drill entries
Acceptance Criteria:
  - [ ] `/docs/ops/l4-backup-dr-runbooks.md` exists and its content matches the pre-development L4 document at the commit this task was authored against
  - [ ] Each of the four log templates contains a header row matching the column set its corresponding runbook section specifies, and zero data rows
  - [ ] Manual: a reviewer confirms none of the five files contain a real credential, hostname, or IP address — templates only
AI Prompt:
  > Establish the operational documentation home for the backup/DR runbook
  > set before any individual runbook's automation is built. L4 itself states,
  > in its closing line, that it is "version-controlled in the repository at
  > `docs/ops/l4-backup-dr-runbooks.md`" — this task creates that destination.
  >
  > Copy the full content of
  > `docs/pre-development/L-infrastructure-and-devops/l4-backup-dr-runbooks.md`
  > into `/docs/ops/l4-backup-dr-runbooks.md` verbatim. This becomes the
  > operational copy that IT staff follow during an actual incident or
  > scheduled procedure — the `docs/pre-development/` copy remains the
  > planning-phase historical record and is not updated further once this copy
  > exists.
  >
  > Create the four log templates referenced throughout L4, each as a Markdown
  > table with a header row only:
  >
  > **`/docs/ops/pitr-log.md`** (L4 Runbook 1 §1.6):
  > ```markdown
  > # WAL-Based PITR — Verification Log
  > | Date | Performed By | Base Backup Verified | WAL Archiving Confirmed | Notes |
  > |---|---|---|---|---|
  > ```
  >
  > **`/docs/ops/staging-test-log.md`** (L4 Runbook 3 §3.5):
  > ```markdown
  > # Streaming Replication — Staging Failover Test Log
  > | Date | Performed By | Replication Lag at Test Start | Failover Duration | Issues Found | Sign-off |
  > |---|---|---|---|---|---|
  > ```
  >
  > **`/docs/ops/restoration-test-log.md`** (L4 Runbook 4 §4.5):
  > ```markdown
  > # Monthly Restoration Test Log
  > | Date | Performed By | Backup File Tested | Row-Count Spot Check Passed | RTO Achieved | Issues Found | Sign-off |
  > |---|---|---|---|---|---|---|
  > ```
  >
  > **`/docs/ops/dr-drill-log.md`** (L4 Runbook 5 §5.5):
  > ```markdown
  > # Quarterly DR Drill Log
  > | Date | Drill Type | Participants | RTO Achieved | RPO Achieved | Issues Found | Sign-off |
  > |---|---|---|---|---|---|---|
  > ```
  > These four files start empty by design — they accumulate real entries only
  > once the corresponding runbook (TASK-INFRA-016 through TASK-INFRA-020) is
  > actually exercised in a real environment, which happens after Phase 1
  > development, not during it.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `/docs/ops/l4-backup-dr-runbooks.md` matches the source L4 document's content
  > - [ ] Each log template's header row matches its runbook section's column set
  > - [ ] No file contains a real credential, hostname, or IP address
  > A reviewer will verify each one independently.

---

## TASK-INFRA-016

Phase:          1
Module:         INFRA
Title:          Automate WAL-based PITR archiving configuration
Prerequisites:  [TASK-INFRA-012, TASK-INFRA-015]
Deliverables:
  - /tools/scripts/ops/wal-g-env.template — wal-g environment-variable template for S3 archive storage
  - /tools/scripts/ops/postgresql-pitr.conf.snippet — the `archive_mode`/`archive_command`/`wal_level` configuration block
  - /tools/scripts/ops/base-backup-cron.sh — weekly full base backup + nightly WAL-G verification, intended for the production host's crontab
Acceptance Criteria:
  - [ ] `wal-g backup-push $PGDATA` (run manually against a local test Postgres data directory with the template's variables populated) completes and lists the new backup via `wal-g backup-list`
  - [ ] The `postgresql-pitr.conf.snippet` values, when applied to a running `postgres-primary` container, survive a `docker compose restart postgres-primary` without reverting
  - [ ] `base-backup-cron.sh` exits non-zero and writes a line to `/docs/ops/pitr-log.md` style output if `wal-g backup-push` fails, rather than failing silently
  - [ ] Manual: a reviewer confirms the cron schedule comment in `base-backup-cron.sh` matches "weekly full base backup," not daily or monthly
AI Prompt:
  > Implement Runbook 1 (L4 §1) — WAL-based point-in-time-recovery archiving,
  > which underlies the consolidated reference's 1-hour RPO commitment
  > (consolidated ref §11.14).
  >
  > **`postgresql.conf` changes** — append to the `postgres-primary` service's
  > configuration (L4 §1.2):
  > ```ini
  > # tools/scripts/ops/postgresql-pitr.conf.snippet
  > wal_level = replica
  > archive_mode = on
  > archive_command = 'wal-g wal-push %p'
  > archive_timeout = 60
  > max_wal_senders = 5
  > wal_keep_size = 1GB
  > ```
  >
  > **wal-g environment** (L4 §1.3) — populated from secrets at deploy time,
  > never committed with real values:
  > ```dotenv
  > # tools/scripts/ops/wal-g-env.template
  > WALG_S3_PREFIX=s3://${S3_BACKUP_BUCKET}/wal-g
  > AWS_ACCESS_KEY_ID=${S3_BACKUP_ACCESS_KEY}
  > AWS_SECRET_ACCESS_KEY=${S3_BACKUP_SECRET_KEY}
  > AWS_ENDPOINT=${S3_BACKUP_ENDPOINT}
  > AWS_S3_FORCE_PATH_STYLE=true
  > WALG_COMPRESSION_METHOD=lz4
  > WALG_DELTA_MAX_STEPS=6
  > ```
  >
  > **Base backup schedule** (L4 §1.4) — a full base backup weekly, with
  > continuous WAL archiving covering the gaps between base backups:
  > ```bash
  > #!/bin/bash
  > # tools/scripts/ops/base-backup-cron.sh
  > # Crontab entry on the production host (NOT inside the container):
  > #   0 2 * * 0  /opt/batac/scripts/base-backup-cron.sh >> /var/log/batac/pitr-backup.log 2>&1
  > # Schedule: weekly full base backup, Sunday 02:00 Asia/Manila.
  > set -e
  >
  > source /opt/batac/scripts/wal-g-env
  >
  > echo "[$(date -Iseconds)] Starting weekly base backup..."
  > if wal-g backup-push "$PGDATA"; then
  >   echo "[$(date -Iseconds)] Base backup succeeded."
  > else
  >   echo "[$(date -Iseconds)] [ALERT] Base backup FAILED. Escalate immediately — PITR coverage may have a gap." >&2
  >   exit 1
  > fi
  >
  > echo "[$(date -Iseconds)] Pruning backups older than retention window..."
  > wal-g delete retain FULL 4 --confirm
  > ```
  > `[Inference]` This script is committed in the repository at
  > `/tools/scripts/ops/` and deployed (copied) to `/opt/batac/scripts/` on
  > the production host as part of host setup — the exact deployment
  > mechanism is unspecified, consistent with the Terraform/Pulumi IaC gap
  > already flagged in TASK-INFRA-012 and the Module Summary. This script
  > runs directly on the host's crontab, not inside a container, because
  > `wal-g` needs direct filesystem access to `$PGDATA` for `backup-push`
  > (L4 §1.4's framing of "the PostgreSQL host").
  >
  > **Retention** (consolidated ref §11.14): hot retention 30 days, cold
  > retention 1 year, with at least one cold copy in write-once (S3 object
  > lock) storage. `wal-g delete retain FULL 4 --confirm` above retains four
  > weekly full backups (~28 days); confirm the bucket's own object-lock
  > policy (a bucket-level S3 setting, not application code) separately
  > implements the 1-year cold/immutable tier — that bucket policy is
  > `[SPEC GAP]`, since no loaded document specifies the exact S3 lifecycle
  > rule JSON or object-lock retention-mode configuration.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `wal-g backup-push` against a local test data directory completes and is listed by `wal-g backup-list`
  > - [ ] The `postgresql.conf` snippet's settings survive a container restart
  > - [ ] `base-backup-cron.sh` exits non-zero on a failed `backup-push`, with a clearly-alarming log line
  > - [ ] The cron comment correctly states a weekly (not daily/monthly) schedule
  > A reviewer will verify each one independently.

---

## TASK-INFRA-017

Phase:          1
Module:         INFRA
Title:          Automate daily encrypted pg_dump backup to S3
Prerequisites:  [TASK-INFRA-012, TASK-INFRA-015]
Deliverables:
  - /tools/scripts/ops/pg_dump_backup.sh — nightly encrypted custom-format dump, uploaded to S3-compatible storage, with retention pruning
Acceptance Criteria:
  - [ ] Running the script manually against the local `compose.yml` Postgres produces a `.dump.gpg` file and uploads it to the local MinIO `batac-backups` bucket
  - [ ] Decrypting the uploaded file with the matching key and restoring it with `pg_restore --list` shows the expected table list with no corruption errors
  - [ ] The script exits non-zero and logs a clear failure line if `pg_dump` exits non-zero, rather than uploading a partial/empty file
  - [ ] Manual: a reviewer confirms the encryption key is read from an environment variable, never hardcoded in the script
AI Prompt:
  > Implement Runbook 2 (L4 §2) — the daily encrypted `pg_dump` backup that
  > provides the cold, restorable copy independent of streaming replication.
  >
  > **`/tools/scripts/ops/pg_dump_backup.sh`** (L4 §2.2–§2.4; crontab entry
  > per `CRON_BACKUP_DATABASE` default `0 0 * * *`, midnight Asia/Manila):
  > ```bash
  > #!/bin/bash
  > # tools/scripts/ops/pg_dump_backup.sh
  > # Crontab on the production host:
  > #   0 0 * * *  /opt/batac/scripts/pg_dump_backup.sh >> /var/log/batac/pg-dump-backup.log 2>&1
  > set -e
  >
  > source /opt/batac/scripts/backup-env
  > TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
  > DUMP_FILE="/tmp/batac_${TIMESTAMP}.dump"
  > ENCRYPTED_FILE="${DUMP_FILE}.gpg"
  >
  > echo "[$(date -Iseconds)] Starting pg_dump..."
  > if ! pg_dump "$DATABASE_URL_MIGRATE" -F custom -f "$DUMP_FILE"; then
  >   echo "[$(date -Iseconds)] [ALERT] pg_dump FAILED. No backup file produced for ${TIMESTAMP}." >&2
  >   rm -f "$DUMP_FILE"
  >   exit 1
  > fi
  >
  > echo "[$(date -Iseconds)] Encrypting dump..."
  > gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
  >     --symmetric --cipher-algo AES256 \
  >     -o "$ENCRYPTED_FILE" "$DUMP_FILE"
  > rm -f "$DUMP_FILE"
  >
  > echo "[$(date -Iseconds)] Uploading to S3..."
  > if ! aws s3 cp "$ENCRYPTED_FILE" \
  >      "s3://${S3_BACKUP_BUCKET}/daily/$(basename "$ENCRYPTED_FILE")" \
  >      --endpoint-url "$S3_BACKUP_ENDPOINT"; then
  >   echo "[$(date -Iseconds)] [ALERT] Upload FAILED for ${ENCRYPTED_FILE}. Local copy retained for manual recovery." >&2
  >   exit 1
  > fi
  > rm -f "$ENCRYPTED_FILE"
  >
  > echo "[$(date -Iseconds)] Pruning backups older than ${BACKUP_RETENTION_DAYS_HOT:-30} days..."
  > aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily/" --endpoint-url "$S3_BACKUP_ENDPOINT" \
  >   | awk '{print $4}' \
  >   | while read -r f; do
  >       age_days=$(( ( $(date +%s) - $(date -d "$(echo "$f" | grep -oP '\d{8}T\d{6}Z' | sed 's/T/ /;s/Z//')" +%s) ) / 86400 ))
  >       if [ "$age_days" -gt "${BACKUP_RETENTION_DAYS_HOT:-30}" ]; then
  >         aws s3 rm "s3://${S3_BACKUP_BUCKET}/daily/$f" --endpoint-url "$S3_BACKUP_ENDPOINT"
  >       fi
  >     done
  >
  > echo "[$(date -Iseconds)] Backup complete: ${TIMESTAMP}"
  > ```
  > `BACKUP_ENCRYPTION_KEY` and `S3_BACKUP_*` come from the same env-var set
  > validated in TASK-INFRA-002 (`superRefine` already requires
  > `BACKUP_ENCRYPTION_KEY` when `BACKUP_ENABLED` is true). `-F custom` (not
  > plain SQL) is used because `pg_restore` can selectively restore individual
  > tables from a custom-format dump, which the monthly restoration test
  > (TASK-INFRA-019) relies on. `[Inference]` `DATABASE_URL_MIGRATE`, not
  > `DATABASE_URL_APP`, is the connection string used for `pg_dump`, since the
  > dump must capture every schema including `audit`, and `batac_app` cannot
  > read tables it has no `SELECT` grant on (none are granted in
  > TASK-INFRA-005's `post-migrate-grants.sql`) — `batac_migrate`, which owns
  > the schema, can.
  >
  > **Retention** (consolidated ref §11.14): 30-day hot retention is enforced
  > above; the 1-year cold tier and the "at least one cold copy in write-once
  > storage" requirement depend on the destination bucket's own S3 lifecycle
  > and object-lock configuration, which is `[SPEC GAP]` — same gap already
  > noted in TASK-INFRA-016, since no loaded document gives the exact bucket
  > policy.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] A manual run against local `compose.yml` produces an encrypted dump and uploads it to MinIO
  > - [ ] The uploaded dump decrypts and `pg_restore --list`s cleanly
  > - [ ] A forced `pg_dump` failure produces a non-zero exit and an `[ALERT]` log line, with no partial file uploaded
  > - [ ] The encryption key is read only from an environment variable
  > A reviewer will verify each one independently.

---

## TASK-INFRA-018

Phase:          1
Module:         INFRA
Title:          Set up streaming replication, lag monitoring, and failover
Prerequisites:  [TASK-INFRA-012, TASK-INFRA-015]
Deliverables:
  - /tools/scripts/ops/check-replication-lag.sh — queries replication lag; used by monitoring and by the DR drill
  - /docs/ops/l4-runbook-3-failover-procedure.md — the manual failover sequence, extracted as a standalone quick-reference from the Runbook 1 copy in TASK-INFRA-015
Acceptance Criteria:
  - [ ] `check-replication-lag.sh` against the local `compose.prod.yml` primary/standby pair returns a numeric lag in seconds and exits non-zero if lag exceeds 60 seconds
  - [ ] Manually killing `postgres-primary` and following the documented failover sequence against `postgres-standby` results in `pg_is_in_recovery()` returning `false` on the promoted node
  - [ ] After promotion, the `server` container (pointed at the new primary via a manually updated `DATABASE_URL_APP` host) successfully serves the health-check endpoint from TASK-INFRA-011
  - [ ] Manual: a reviewer confirms the failover document explicitly states every step is human-executed — no automated promotion or DNS-update script is implied where none exists
AI Prompt:
  > Implement Runbook 3 (L4 §3) — streaming replication setup, lag
  > monitoring, and the manual failover procedure. `postgres-primary` and
  > `postgres-standby` are already defined in `compose.prod.yml`
  > (TASK-INFRA-012, using `bitnami/postgresql` images, which configure
  > streaming replication via the `POSTGRESQL_REPLICATION_MODE` environment
  > variables already set there); this task adds monitoring and the
  > documented procedure on top of that base.
  >
  > **Lag monitoring** (L4 §3.3):
  > ```bash
  > #!/bin/bash
  > # tools/scripts/ops/check-replication-lag.sh
  > # Usage: ./check-replication-lag.sh [max-allowed-seconds, default 60]
  > set -e
  > MAX_LAG="${1:-60}"
  >
  > LAG_SECONDS=$(docker compose -f compose.prod.yml exec -T postgres-standby \
  >   psql -U postgres -t -A -c \
  >   "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int;")
  >
  > echo "Replication lag: ${LAG_SECONDS}s (threshold: ${MAX_LAG}s)"
  >
  > if [ "$LAG_SECONDS" -gt "$MAX_LAG" ]; then
  >   echo "[ALERT] Replication lag (${LAG_SECONDS}s) exceeds threshold (${MAX_LAG}s)." >&2
  >   exit 1
  > fi
  > exit 0
  > ```
  > `DR_MAX_REPLICATION_LAG_S` (default 60, TASK-INFRA-002) is the same
  > threshold used here — wire this script into a cron entry or an external
  > monitor that alerts the on-call IT staff if it ever exits non-zero,
  > consistent with the consolidated reference's "lag < 60 seconds" hot-standby
  > commitment (§11.14).
  >
  > **`/docs/ops/l4-runbook-3-failover-procedure.md`** — a standalone
  > quick-reference extracted from the full L4 copy (TASK-INFRA-015), covering
  > only the failover sequence (L4 §3.6):
  > 1. Confirm the primary is genuinely down — a transient network blip is not
  >    grounds for failover (check from at least two independent vantage
  >    points before proceeding).
  > 2. On the standby host, run `pg_ctl promote` (or the equivalent
  >    `bitnami/postgresql` promotion trigger file mechanism).
  > 3. Confirm promotion: `psql -c "SELECT pg_is_in_recovery();"` must return
  >    `f` on the promoted node.
  > 4. Update `DATABASE_URL_APP`, `DATABASE_URL_AUDIT`, and
  >    `DATABASE_URL_MIGRATE` (wherever they are stored — the `./secrets/`
  >    files referenced in `compose.prod.yml`) to point at the promoted node's
  >    host, then restart the `server` service so it picks up the new
  >    connection strings.
  > 5. Update the DNS record (or load-balancer target) that routes traffic to
  >    the database host, if one exists outside the Docker network.
  > 6. Confirm application health via the TASK-INFRA-011 endpoint and a
  >    smoke-test write through the running application.
  > 7. Log the failover event and notify the LGU IT Office and relevant
  >    Sangguniang Panlalawigan stakeholders.
  > 8. The old primary is not automatically reintegrated as a new standby —
  >    rebuilding replication from the new primary is a separate, deliberate
  >    follow-up action, not part of the immediate failover.
  >
  > `[CONFLICT]` D5's Deployment Constraints table and the consolidated
  > reference's §11.14 service-commitments table both describe failover as
  > triggered automatically by "primary heartbeat loss for 60 seconds" with
  > "automated DNS failover." The procedure above, and L4's own Runbook 3, are
  > entirely human-executed — no health-check-triggered automatic promotion or
  > DNS update exists anywhere in the loaded documents. This task implements
  > the manual procedure exactly as L4 specifies it, since that is the only
  > concretely specified version; the gap to an automated mechanism is flagged
  > in the Module Summary for human resolution. Do not silently build an
  > auto-failover script to "satisfy" D5's wording — that would be inventing
  > an unspecified health-check/promotion/DNS-update integration with no
  > source to ground it.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] The lag-check script returns a numeric value and exits non-zero above the threshold
  > - [ ] Manually killing the primary and following the documented steps results in a successfully promoted standby
  > - [ ] The application serves traffic again after the documented connection-string update and restart
  > - [ ] The failover document does not imply any automated step that does not actually exist
  > A reviewer will verify each one independently.


---

## TASK-INFRA-019

Phase:          1
Module:         INFRA
Title:          Define monthly backup restoration test procedure
Prerequisites:  [TASK-INFRA-017]
Deliverables:
  - /tools/scripts/ops/monthly-restoration-test.sh — restores the latest daily `pg_dump` into a scratch database and runs the row-count spot check
  - /docs/ops/l4-runbook-4-restoration-checklist.md — the human checklist accompanying the script's output
Acceptance Criteria:
  - [ ] Running the script against the most recent local MinIO backup produces a scratch database (`batac_lgu_restoretest`) with no errors in `pg_restore`'s output
  - [ ] The script's row-count spot check correctly reports a mismatch when run against a deliberately truncated fixture table
  - [ ] The scratch database is dropped automatically at the end of a successful run, leaving no lingering restore artifact
  - [ ] Manual: a reviewer confirms the script never targets `postgres-primary` or `postgres-standby` directly — only a disposable scratch database
AI Prompt:
  > Implement Runbook 4 (L4 §4) — the monthly test that proves the daily
  > `pg_dump` backups (TASK-INFRA-017) are actually restorable, not merely
  > present in S3.
  >
  > **`/tools/scripts/ops/monthly-restoration-test.sh`** (L4 §4.2–§4.4):
  > ```bash
  > #!/bin/bash
  > # tools/scripts/ops/monthly-restoration-test.sh
  > # Crontab on the production host:
  > #   0 3 1 * *  /opt/batac/scripts/monthly-restoration-test.sh >> /var/log/batac/restoration-test.log 2>&1
  > set -e
  >
  > source /opt/batac/scripts/backup-env
  > SCRATCH_DB="batac_lgu_restoretest"
  > LATEST=$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily/" --endpoint-url "$S3_BACKUP_ENDPOINT" \
  >   | sort | tail -n 1 | awk '{print $4}')
  >
  > if [ -z "$LATEST" ]; then
  >   echo "[ALERT] No backup file found in s3://${S3_BACKUP_BUCKET}/daily/." >&2
  >   exit 1
  > fi
  >
  > echo "[$(date -Iseconds)] Testing restoration of: ${LATEST}"
  > aws s3 cp "s3://${S3_BACKUP_BUCKET}/daily/${LATEST}" "/tmp/${LATEST}" --endpoint-url "$S3_BACKUP_ENDPOINT"
  > gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" --decrypt \
  >   -o "/tmp/restoretest.dump" "/tmp/${LATEST}"
  >
  > psql "$DATABASE_URL_MIGRATE" -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
  > psql "$DATABASE_URL_MIGRATE" -c "CREATE DATABASE ${SCRATCH_DB};"
  >
  > SCRATCH_URL=$(echo "$DATABASE_URL_MIGRATE" | sed "s/\/[a-zA-Z0-9_]*$/\/${SCRATCH_DB}/")
  > pg_restore -d "$SCRATCH_URL" --no-owner --no-privileges "/tmp/restoretest.dump"
  >
  > echo "[$(date -Iseconds)] Running row-count spot check..."
  > EXPECTED_TABLE_COUNT=11  # 10 Phase 1 schema-owning modules + audit
  > ACTUAL_SCHEMA_COUNT=$(psql "$SCRATCH_URL" -t -A -c \
  >   "SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','public');")
  >
  > if [ "$ACTUAL_SCHEMA_COUNT" -lt "$EXPECTED_TABLE_COUNT" ]; then
  >   echo "[ALERT] Restored schema count (${ACTUAL_SCHEMA_COUNT}) is below the expected floor (${EXPECTED_TABLE_COUNT})." >&2
  >   psql "$DATABASE_URL_MIGRATE" -c "DROP DATABASE ${SCRATCH_DB};"
  >   rm -f "/tmp/${LATEST}" "/tmp/restoretest.dump"
  >   exit 1
  > fi
  >
  > echo "[$(date -Iseconds)] Row-count spot check passed (${ACTUAL_SCHEMA_COUNT} schemas)."
  > psql "$DATABASE_URL_MIGRATE" -c "DROP DATABASE ${SCRATCH_DB};"
  > rm -f "/tmp/${LATEST}" "/tmp/restoretest.dump"
  > echo "[$(date -Iseconds)] Restoration test complete. Add this run to /docs/ops/restoration-test-log.md."
  > ```
  > `[Inference]` The exact row/schema-count check above is a representative,
  > minimal spot check (count of non-system schemas) — L4 §4 calls for "a
  > row-count spot check" without naming the exact query; a more thorough
  > per-table row-count comparison against a known-good baseline could be
  > added later. The script never restores into `postgres-primary` or
  > `postgres-standby` directly — it always uses the disposable
  > `${SCRATCH_DB}` and drops it afterward, so a corrupted backup cannot
  > damage live data during the test.
  >
  > **`/docs/ops/l4-runbook-4-restoration-checklist.md`** — the human-facing
  > checklist accompanying each run, per L4 §4.5:
  > - [ ] Script completed with exit code 0
  > - [ ] Row-count spot check passed
  > - [ ] Elapsed time recorded and compared against the 4-hour RTO ceiling
  >   (consolidated ref §11.14)
  > - [ ] Entry added to `/docs/ops/restoration-test-log.md` (TASK-INFRA-015)
  >   with date, performed-by, backup file tested, and sign-off
  > - [ ] If the script failed: escalate immediately — this means the most
  >   recent daily backup is not restorable, and the previous day's backup
  >   should be checked next, not assumed to be fine
  >
  > Before submitting this PR, confirm each item:
  > - [ ] A run against the most recent local backup restores cleanly with no `pg_restore` errors
  > - [ ] A deliberately truncated fixture table causes the script to report a mismatch
  > - [ ] The scratch database is dropped automatically after a successful run
  > - [ ] The script never targets `postgres-primary` or `postgres-standby` directly
  > A reviewer will verify each one independently.

---

## TASK-INFRA-020

Phase:          1
Module:         INFRA
Title:          Define quarterly disaster-recovery drill procedure
Prerequisites:  [TASK-INFRA-018, TASK-INFRA-016]
Deliverables:
  - /docs/ops/l4-runbook-5-dr-drill-checklist.md — the quarterly drill checklist, combining a failover exercise and a PITR spot check
Acceptance Criteria:
  - [ ] The checklist explicitly requires both a standby-promotion exercise (TASK-INFRA-018) and a point-in-time-recovery spot check (TASK-INFRA-016) within the same drill, not just one or the other
  - [ ] The checklist requires a minimum of two participating team members, matching consolidated ref §11.14's "tested by minimum two team members" requirement for DR runbooks
  - [ ] The checklist requires recording both achieved RTO and achieved RPO against the 4-hour / 1-hour ceilings
  - [ ] Manual: a reviewer confirms the checklist explicitly instructs restoring the drilled environment back to its pre-drill state afterward, so the drill does not leave staging in a degraded configuration
AI Prompt:
  > Define Runbook 5 (L4 §5) — the quarterly disaster-recovery drill that
  > exercises both the replication-failover procedure and the PITR
  > restoration capability together, against the staging environment (never
  > production).
  >
  > **`/docs/ops/l4-runbook-5-dr-drill-checklist.md`:**
  > ```markdown
  > # Quarterly DR Drill Checklist
  >
  > Run against **staging only**. Minimum two participating team members
  > (consolidated ref §11.14). Schedule: once per quarter, on a day with no
  > scheduled Sangguniang Panlalawigan session.
  >
  > ## Pre-Drill
  > - [ ] Confirm staging is currently healthy (TASK-INFRA-011 health check green)
  > - [ ] Confirm at least one recent successful PITR base backup exists (`/docs/ops/pitr-log.md`)
  > - [ ] Confirm at least one recent successful daily `pg_dump` exists
  > - [ ] Note the staging environment's current state, so it can be restored afterward
  >
  > ## Drill Part A — Failover Exercise
  > - [ ] Start a timer
  > - [ ] Simulate primary failure (stop the `postgres-primary` container)
  > - [ ] Execute the failover procedure from `/docs/ops/l4-runbook-3-failover-procedure.md` (TASK-INFRA-018)
  > - [ ] Stop the timer once the application's health endpoint returns 200 against the promoted node
  > - [ ] Record elapsed time as the achieved RTO for this drill
  >
  > ## Drill Part B — Point-in-Time Recovery Spot Check
  > - [ ] Pick a timestamp from within the last base-backup-to-now window
  > - [ ] Restore to that timestamp into a disposable scratch environment using `wal-g backup-fetch` + WAL replay (per L4 §1.5)
  > - [ ] Confirm the restored data's latest timestamp is at or before the chosen recovery point, and no more than 1 hour earlier
  > - [ ] Record the achieved RPO for this drill
  >
  > ## Post-Drill
  > - [ ] Restore staging to its pre-drill configuration (re-establish the original primary/standby roles; do not leave the promoted-during-the-drill node as the permanent primary unless that was an intentional outcome)
  > - [ ] Record any issues found, with enough detail for a follow-up task to be filed if needed
  > - [ ] Add an entry to `/docs/ops/dr-drill-log.md` (TASK-INFRA-015) with date, drill type, participants, achieved RTO, achieved RPO, issues found, and sign-off from both participants
  > - [ ] If achieved RTO exceeded 4 hours or achieved RPO exceeded 1 hour, escalate to the LGU IT Office before the next scheduled drill, not after
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] The checklist requires both a failover exercise and a PITR spot check in the same drill
  > - [ ] The checklist requires a minimum of two participants
  > - [ ] The checklist requires recording achieved RTO and RPO against their ceilings
  > - [ ] The checklist instructs restoring staging to its pre-drill state afterward
  > A reviewer will verify each one independently.

---

## TASK-INFRA-021

Phase:          1
Module:         INFRA
Title:          Define break-glass procedure and credential rotation script
Prerequisites:  [TASK-INFRA-017, TASK-INFRA-018]
Deliverables:
  - /docs/ops/l4-runbook-6-break-glass-checklist.md — the physical envelope procedure and opening checklist
  - /tools/scripts/ops/rotate-credentials-after-breakglass.sh — semi-automated credential rotation helper for the mandatory post-opening rotation step
Acceptance Criteria:
  - [ ] The checklist explicitly states the break-glass credentials are for emergency direct database access only, and lists the two-person-authorization requirement before the envelope may be opened
  - [ ] `rotate-credentials-after-breakglass.sh` successfully rotates the `batac_app`, `batac_audit`, and `batac_migrate` passwords against a local test database, and the old passwords no longer authenticate afterward
  - [ ] The checklist requires an audit-system log entry within 1 hour of the application coming back online if it was offline at the time of opening, matching L4 §6's stated grace period
  - [ ] Manual: a reviewer confirms the script never prints the new passwords to a log file or anywhere persisted — only to the operator's terminal, for one-time secure transcription into the secrets store
AI Prompt:
  > Define Runbook 6 (L4 §6) — the break-glass procedure for emergency direct
  > database access when the normal application path is unavailable.
  >
  > **`/docs/ops/l4-runbook-6-break-glass-checklist.md`:**
  > ```markdown
  > # Break-Glass Procedure
  >
  > Break-glass credentials grant direct `psql` access to the production
  > database, bypassing the application entirely. They exist for emergencies
  > where the application itself cannot be used to investigate or correct a
  > problem. Treat opening the envelope as a significant, logged event — not
  > a convenience shortcut.
  >
  > ## Authorization (required before opening)
  > - [ ] Two-person authorization obtained — one technical lead and one
  >   designated approver from the LGU IT Office, both confirming the
  >   emergency by name
  > - [ ] The specific reason for needing direct database access is written
  >   down before the envelope is opened, not reconstructed afterward
  >
  > ## Opening
  > - [ ] Physically open the sealed envelope; photograph the broken seal with
  >   a timestamp
  > - [ ] Record date, time, both authorizers' names, and the stated reason in
  >   the physical incident log
  > - [ ] Use the credentials for only the specific corrective action
  >   identified — do not use the session for unrelated exploration
  >
  > ## Mandatory Follow-Up (within the same incident window)
  > - [ ] Run `rotate-credentials-after-breakglass.sh` to rotate `batac_app`,
  >   `batac_audit`, and `batac_migrate` passwords — the opened credentials
  >   must never be reused for a subsequent incident
  > - [ ] Reseal a new envelope with the newly rotated credentials, store it
  >   per the same physical-security procedure as the original
  > - [ ] Write an audit-log entry in the application's audit system with
  >   `event_type = 'break_glass.opened'`, the recorded reason, and both
  >   authorizers' names. If the application is offline at the time of
  >   opening, write this entry within 1 hour of it coming back online (L4 §6)
  > - [ ] File a post-incident review within 5 business days
  > ```
  >
  > **`/tools/scripts/ops/rotate-credentials-after-breakglass.sh`** (L4 §6.5):
  > ```bash
  > #!/bin/bash
  > # tools/scripts/ops/rotate-credentials-after-breakglass.sh
  > # Run manually, immediately after any break-glass envelope is opened.
  > set -e
  >
  > generate_password() { openssl rand -base64 32 | tr -d '/+=' | head -c 32; }
  >
  > NEW_APP_PW=$(generate_password)
  > NEW_AUDIT_PW=$(generate_password)
  > NEW_MIGRATE_PW=$(generate_password)
  >
  > psql "$DATABASE_URL_MIGRATE" -c "ALTER USER batac_app WITH ENCRYPTED PASSWORD '${NEW_APP_PW}';"
  > psql "$DATABASE_URL_MIGRATE" -c "ALTER USER batac_audit WITH ENCRYPTED PASSWORD '${NEW_AUDIT_PW}';"
  > psql "$DATABASE_URL_MIGRATE" -c "ALTER USER batac_migrate WITH ENCRYPTED PASSWORD '${NEW_MIGRATE_PW}';"
  >
  > echo ""
  > echo "Credentials rotated. Transcribe these into the secrets store NOW —"
  > echo "they are not saved anywhere by this script:"
  > echo ""
  > echo "  batac_app password:     ${NEW_APP_PW}"
  > echo "  batac_audit password:   ${NEW_AUDIT_PW}"
  > echo "  batac_migrate password: ${NEW_MIGRATE_PW}"
  > echo ""
  > echo "After updating the secrets store, restart the server service so it"
  > echo "picks up the new DATABASE_URL_APP / DATABASE_URL_AUDIT values."
  > ```
  > This script prints the new credentials to the terminal only, for one-time
  > manual transcription into the `./secrets/` files (TASK-INFRA-012) — it
  > must never write them to a log file, a committed file, or any persistent
  > store, since a credential that touches disk anywhere outside the secrets
  > mechanism defeats the purpose of rotating it.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] The checklist states the two-person-authorization requirement before opening
  > - [ ] The rotation script successfully changes all three passwords against a local test database, invalidating the old ones
  > - [ ] The checklist requires an audit-system entry within 1 hour of the application coming back online
  > - [ ] The script prints new passwords to the terminal only — never to a log or persisted file
  > A reviewer will verify each one independently.

---

## Module Summary — INFRA

**Total tasks:** 21 (`TASK-INFRA-001` through `TASK-INFRA-021`)

**First executable task:** `TASK-INFRA-001` (Prerequisites: `[NONE]`)

**Special tags used:** None. No `INFRA` task in this list writes a Drizzle
schema migration (`[MIGRATION]`), performs an ABAC policy check (`[ABAC]`), or
writes to the `audit` schema / emits an audit event from application code
(`[AUDIT]`) — the runbook tasks (`TASK-INFRA-016`–`021`) describe operational
procedures that *reference* the audit system as a downstream consumer once it
exists, but no INFRA deliverable itself performs an audit write.

**Spec gaps:**
- `[SPEC GAP]` No Terraform, Pulumi, or other infrastructure-as-code document
  exists anywhere in `docs/pre-development/`. L3's own scope note excludes
  "Infrastructure provisioning (Terraform/Pulumi for the VPS)" as "a separate
  IaC document not yet in the plan," yet the consolidated reference's
  Architectural Law #5 ("All infrastructure is defined in code"), §11.2, and
  D5's Deployment Constraints table all require it "from day one." Every task
  in this list that assumes a working Docker host (`TASK-INFRA-012` onward)
  is therefore unable to specify how that host itself is provisioned,
  hardened, or network-configured. A human must author the missing IaC
  document before this gap can be closed.
- `[SPEC GAP]` The S3 bucket lifecycle/object-lock configuration that
  implements the consolidated reference's "1-year cold retention" and "at
  least one cold copy in write-once storage" requirements (§11.14) is not
  specified in any loaded document — `TASK-INFRA-016` and `TASK-INFRA-017`
  implement the application-side retention pruning only.

**Deferred capabilities:**
- `[DEFERRED — Phase 2: Meilisearch activation]` The `meilisearch` service is
  defined but profile-gated inactive in `TASK-INFRA-004` and `TASK-INFRA-012`;
  activating it is a Phase 2 `SEARCH` module concern.
- `[DEFERRED — Phase 3: Next.js portal environment validation]` `env.portal.ts`
  is explicitly out of scope for `TASK-INFRA-002`; it belongs to the Phase 3
  `PORTAL` module pass.
- `[DEFERRED — Phase 5: Multi-LGU assessment / platform-scaling tooling]`
- `[DEFERRED — Phase 5: HRIS/Payroll integration]`
- `[DEFERRED — Phase 5: Procurement system integration]`
- `[DEFERRED — Phase 5: On-premise migration tooling]`, beyond the S3/MinIO
  endpoint-swap already covered by D5 and reflected in `TASK-INFRA-012`'s
  `onpremise` profile.

**Document conflicts followed (per `A1-AGENTS.md` §1):**
1. `[CONFLICT]` C5's addendum states `batac_migrate` is `NOLOGIN` (citing C1
   §3.16); L2 — and `TASK-INFRA-005` — create it as a `LOGIN` role with a
   password, because `DATABASE_URL_MIGRATE` requires password authentication
   to function. Followed L2. C1 itself was not loaded in this pass (it is not
   in INFRA's document list); a human should confirm what C1 §3.16 actually
   specifies before this is resolved.
2. `[CONFLICT]` L1 §21.2's `AppEnv` Zod enum does not include `"test"`
   (`development | staging | production | on-premise`), but L3 §7.1's
   example CI environment table sets `APP_ENV: test`. Followed L1's enum;
   `TASK-INFRA-013`'s CI workflow uses `APP_ENV=development` with
   `NODE_ENV=test` instead.
3. `[CONFLICT]` D5's Deployment Constraints and the consolidated reference's
   §11.14 both describe automated, DNS-triggered failover after 60 seconds of
   heartbeat loss. L4 Runbook 3 — the only concretely specified version —
   describes an entirely manual, human-executed failover procedure. Followed
   L4; `TASK-INFRA-018` implements the manual procedure and does not invent
   an automated promotion/DNS-update mechanism.
4. `[CONFLICT]` J3 §7.3's ESLint rule message names `@batac/config/env` as
   the approved environment-access path; L1 §21.1 places the actual env
   validation modules at `/apps/server/src/config/env.server.ts` and
   `/apps/web/src/config/env.client.ts` — per-app, not inside the shared
   `@batac/config` package. `TASK-INFRA-001` reworded the rule message
   generically rather than asserting either path as settled; `TASK-INFRA-002`
   followed L1's explicit per-app paths for the actual files.
5. `[Inference]`-resolved internal inconsistency (not a cross-document
   conflict): L1 §13.2 and §13.3 document `LOG_DESTINATION` and
   `HEALTH_CHECK_PATH` respectively, with unambiguous name/type/default, but
   both are absent from L1 §21.2's own schema code listing. `TASK-INFRA-002`
   includes both fields, sourced from §13, to avoid breaking
   `TASK-INFRA-011`'s health endpoint. A human should reconcile L1 §21.2
   against §13 directly.