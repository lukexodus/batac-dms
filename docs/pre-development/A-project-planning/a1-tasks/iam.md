# A1 Task List — Module: IAM

**Generated:** 2026-06-24
**Pass:** Step 2 — Module: IAM
**Wave:** B (IAM and AUDIT run in parallel after INFRA Wave A completes)

**Documents loaded in order before generating any task:**

1. `docs/pre-development/A-project-planning/a1-skeleton.md` (v2.1) — structural contract
2. `docs/pre-development/A-project-planning/a1-tasks/infra.md` — TASK-INFRA-001 through TASK-INFRA-021 read; all IDs confirmed before writing Prerequisites fields
3. `docs/pre-development/B-architecture-documents/b5-authentication-and-authorization-architecture.md`
4. `docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md`
5. `docs/pre-development/I-security-and-authorization/i1-abac-policy-specification.md`
6. `docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md` — Part 3 (§iam) only, per A1-AGENTS.md §9
7. `docs/pre-development/J-software-design-patterns-and-standards/j1-software-design-patterns.md`
8. `docs/pre-development/J-software-design-patterns-and-standards/j2-error-handling-and-response-normalization-strategy.md`
9. `docs/pre-development/J-software-design-patterns-and-standards/j3-coding-standards-and-conventions.md`
10. `docs/pre-development/J-software-design-patterns-and-standards/j4-module-structure-template.md`

**Phase 1 IAM capability inventory** (sourced from skeleton §6 + loaded documents):

| #   | Capability                                                                                                         | Primary source                |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 1   | PKCE login: credential validation, concurrent-session enforcement, JWT (RS256) issuance, HTTP-only cookie delivery | B5 §1–3, §4.3                 |
| 2   | Token refresh: one-time-use rotation with family-wide revocation on reuse detection                                | B5 §1.2                       |
| 3   | Logout: user-initiated session termination, cookie clearing, refresh-token revocation                              | B5 §4.1                       |
| 4   | Inactivity enforcement: 30-min server-side check in preHandler                                                     | B5 §4.4                       |
| 5   | Workstation lock/unlock: locked_at behavior; silent refresh on unlock                                              | B5 §4.6, ADR-AUTH-010         |
| 6   | Forced logout (IT Admin): mandatory reason, audit event                                                            | B5 §4.5                       |
| 7   | Fastify preHandler chain: verifyAccessToken, loadDelegationContext, setDatabaseSessionVars, updateLastActivity     | B5 §10.1                      |
| 8   | PolicyGuard (hardcoded Gates 1–5) + PolicyEvaluator (RBAC/ABAC Steps 6–8) with `session` resource                  | B5 §5.5; I1 §2, §12           |
| 9   | Role assignment/revocation: Platform Admin exclusion (app-layer + DB trigger)                                      | B5 §8.4; I1 §15 Invariant #12 |
| 10  | IAM tRPC router: user CRUD, own profile, own sessions, password change                                             | I2 §1                         |
| 11  | Seed: 13 roles, permissions catalog, role-permission matrix (all 17 I2 sections)                                   | I2 all sections               |
| 12  | MFA hook wired at login (no-op in Phase 1, activated Phase 2)                                                      | B5 §10.5                      |

**TASK-INFRA IDs confirmed for Prerequisites:**

| Task ID        | Title (abbreviated)                                               |
| -------------- | ----------------------------------------------------------------- |
| TASK-INFRA-001 | Bootstrap monorepo workspace and shared tooling                   |
| TASK-INFRA-005 | Create PostgreSQL role bootstrap script and post-migration grants |
| TASK-INFRA-006 | Implement Drizzle migration runner and package scripts            |
| TASK-INFRA-008 | Write Fastify server production Dockerfile and entrypoint         |

**AUDIT module note:** AUDIT is also Wave B and its task list has been generated. IAM tasks that call the audit service reference `TASK-AUDIT-003` in their Prerequisites.

---

## Table of Contents

- [L69–L368] TASK-IAM-001 — [MIGRATION] Create Drizzle iam schema definitions and generate DDL migration
- [L369–L528] TASK-IAM-002 — Scaffold IAM module file structure with typed stubs
- [L529–L634] TASK-IAM-003 — Implement IAM repository layer with all CRUD operations
- [L635–L773] TASK-IAM-004 — [ABAC] Implement PolicyGuard (hardcoded gates) and PolicyEvaluator (RBAC/ABAC steps)
- [L774–L918] TASK-IAM-005 — Implement Fastify auth preHandler middleware chain
- [L919–L1188] TASK-IAM-006 — [AUDIT] Implement POST /api/auth/login (PKCE, JWT issuance, HTTP-only cookies)
- [L1189–L1268] TASK-IAM-007 — [AUDIT] Implement POST /api/auth/refresh (token rotation with reuse detection)
- [L1269–L1320] TASK-IAM-008 — [AUDIT] Implement POST /api/auth/logout (session termination and cookie clearing)
- [L1321–L1421] TASK-IAM-009 — [ABAC][AUDIT] Implement role assignment and revocation service (Platform Admin exclusion)
- [L1422–L1493] TASK-IAM-010 — [AUDIT] Implement POST /api/admin/sessions/:id/terminate (IT Admin force logout)
- [L1494–L1572] TASK-IAM-011 — [AUDIT] Implement workstation lock and unlock endpoints (locked_at behavior)
- [L1573–L1693] TASK-IAM-012 — Implement IAM tRPC router for internal SPA (user management, profile, sessions, password)
- [L1694–L1889] TASK-IAM-013 — Seed IAM roles, permissions, and role-permission matrix
- [L1890–L2018] TASK-IAM-014 — Wire IAM Fastify module plugin and register in app.ts
- [L2019–L2235] Module Summary — IAM

---

## TASK-IAM-001

Phase: 1
Module: IAM
Title: [MIGRATION] Create Drizzle iam schema definitions and generate DDL migration
Prerequisites: [TASK-INFRA-005, TASK-INFRA-006]
Deliverables:

- /packages/database/src/schema/iam.ts — Drizzle ORM table definitions for all 9 iam.\* tables using pgSchema('iam') and pgTable; all indexes, check constraints, and updated_at triggers represented; exported as named exports re-exported from /packages/database/src/schema/index.ts
- /apps/server/src/database/migrations/{timestamp}\_create_iam_schema.sql — SQL migration generated by `pnpm db:generate` and manually extended with: trg_enforce_platform_admin_exclusion function + trigger, iam.sessions RLS policy, and runtime GRANT statements
  Acceptance Criteria:
- [ ] `pnpm db:generate` produces a migration file that, when applied via `pnpm db:migrate`, creates all 9 tables in the `iam` schema with zero errors on a fresh database
- [ ] `SELECT table_name FROM information_schema.tables WHERE table_schema = 'iam' ORDER BY table_name` returns exactly: credentials, mfa_records, permissions, refresh_tokens, role_assignments, role_permissions, roles, sessions, users
- [ ] Inserting two rows into iam.sessions with the same user_id and active = true fails with a unique constraint violation (partial index idx_sessions_one_active_per_user)
- [ ] Inserting an iam.role_assignments row where the user already holds a role with type_code = 'platform_admin' and the incoming role has type_code = 'document_processor' (or vice versa) raises the exception from trg_enforce_platform_admin_exclusion
- [ ] `pnpm typecheck` passes at the workspace root
- [ ] `pnpm db:migrate` is idempotent: running it twice on the same database does not fail
      AI Prompt: |
      You are implementing the Drizzle ORM schema for the `iam` PostgreSQL schema and
      generating the corresponding SQL migration for the Batac City LGU document-management
      platform.

## Project-wide DDL conventions

- Every table uses `id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()`.
- Every table includes `city_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid`.
- All temporal columns use `TIMESTAMPTZ`. Every mutable table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- The `updated_at` column is kept current by the shared trigger function `public.fn_set_updated_at()` (already created by TASK-INFRA-006). Every mutable table needs: `CREATE TRIGGER trg_{tablename}_set_updated_at BEFORE UPDATE ON iam.{tablename} FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();`
- Soft delete only: all tables carry `deleted_at TIMESTAMPTZ NULL` and `deleted_by UUID NULL`. No table may ever receive a SQL `DELETE`.
- No native PostgreSQL ENUMs in the iam schema: use `TEXT NOT NULL CHECK (column IN (...))`.
- No FOREIGN KEY constraints across schema boundaries. Cross-schema references are plain UUID columns with a comment: `-- logical FK -> <schema>.<table>.<column> (cross-schema)`.
- Drizzle conventions: use `drizzle-orm/pg-core`, `pgSchema`, `pgTable`, `uuid`, `text`, `boolean`, `timestamp`, `inet` helpers. Schema file: `/packages/database/src/schema/iam.ts`.

## Table definitions

### iam.users

```sql
CREATE TABLE iam.users (
  id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  username    TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive','suspended','deactivated')),
  mfa_enabled             BOOLEAN     NOT NULL DEFAULT false,
  login_failure_count     INT         NOT NULL DEFAULT 0,
  login_locked_until      TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ NULL,
  deleted_by  UUID        NULL,
  CONSTRAINT uq_users_city_username UNIQUE (city_id, username),
  CONSTRAINT uq_users_city_email    UNIQUE (city_id, email)
);
-- updated_at trigger required
```

### iam.credentials

```sql
CREATE TABLE iam.credentials (
  id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id         UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  user_id         UUID        NOT NULL REFERENCES iam.users(id),
  password_hash   TEXT        NOT NULL,
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ NULL,
  deleted_by      UUID        NULL,
  CONSTRAINT uq_credentials_user UNIQUE (user_id)
);
-- updated_at trigger required
```

### iam.sessions

```sql
CREATE TABLE iam.sessions (
  id                  UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id             UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  user_id             UUID        NOT NULL REFERENCES iam.users(id),
  session_token_hash  TEXT        NOT NULL,
  ip_address          INET        NULL,
  user_agent          TEXT        NULL,
  last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at           TIMESTAMPTZ NULL,
  active              BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  terminated_at       TIMESTAMPTZ NULL,
  terminated_by       UUID        NULL REFERENCES iam.users(id),
  termination_reason  TEXT        NULL
                          CHECK (termination_reason IN ('logout','inactivity','forced','replaced','expired','lock')),
  deleted_at          TIMESTAMPTZ NULL,
  deleted_by          UUID        NULL,
  CONSTRAINT uq_sessions_token_hash UNIQUE (session_token_hash),
  CONSTRAINT ck_sessions_termination_consistency
      CHECK ((terminated_at IS NULL) = (termination_reason IS NULL))
);
CREATE UNIQUE INDEX idx_sessions_one_active_per_user
    ON iam.sessions(user_id) WHERE active = true AND deleted_at IS NULL;
CREATE INDEX idx_sessions_user ON iam.sessions(user_id);
ALTER TABLE iam.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_own_or_admin ON iam.sessions FOR SELECT TO batac_app
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role_tier', true) IN ('IT_ADMIN','SECURITY_ADMIN')
    );
-- No updated_at trigger: session rows are replaced, not mutated
```

### iam.refresh_tokens

```sql
CREATE TABLE iam.refresh_tokens (
  id                UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  user_id           UUID        NOT NULL REFERENCES iam.users(id),
  session_id        UUID        NOT NULL REFERENCES iam.sessions(id),
  token_hash        TEXT        NOT NULL,
  salt              TEXT        NOT NULL,
  family_id         UUID        NOT NULL,
  used_at           TIMESTAMPTZ NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ NULL,
  revocation_reason TEXT        NULL
                        CHECK (revocation_reason IN ('logout','reuse_detected','forced','family_revoked','replaced')),
  replaced_by       UUID        NULL REFERENCES iam.refresh_tokens(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ NULL,
  deleted_by        UUID        NULL,
  CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);
CREATE INDEX idx_rt_user_id    ON iam.refresh_tokens(user_id);
CREATE INDEX idx_rt_family_id  ON iam.refresh_tokens(family_id);
CREATE INDEX idx_rt_expires_at ON iam.refresh_tokens(expires_at)
    WHERE revoked_at IS NULL AND used_at IS NULL;
```

### iam.roles

```sql
CREATE TABLE iam.roles (
  id                UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  name              TEXT        NOT NULL,
  code              TEXT        NOT NULL,
  description       TEXT        NULL,
  type_code         TEXT        NOT NULL
                        CHECK (type_code IN ('platform_admin','document_processor','sys_admin','auditor','citizen')),
  is_system_role    BOOLEAN     NOT NULL DEFAULT false,
  is_platform_admin BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ NULL,
  deleted_by        UUID        NULL,
  CONSTRAINT uq_roles_city_code UNIQUE (city_id, code)
);
-- updated_at trigger required
```

### iam.permissions

```sql
CREATE TABLE iam.permissions (
  id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  resource    TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  description TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ NULL,
  deleted_by  UUID        NULL,
  CONSTRAINT uq_permissions_city_resource_action UNIQUE (city_id, resource, action)
);
-- updated_at trigger required
```

### iam.role_permissions

```sql
CREATE TABLE iam.role_permissions (
  role_id             UUID NOT NULL REFERENCES iam.roles(id),
  permission_id       UUID NOT NULL REFERENCES iam.permissions(id),
  decision            TEXT NOT NULL CHECK (decision IN ('allow','deny','conditional')),
  condition_reference TEXT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT ck_role_permissions_condition_required
      CHECK (decision <> 'conditional' OR condition_reference IS NOT NULL)
);
```

### iam.role_assignments

```sql
CREATE TABLE iam.role_assignments (
  id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id         UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  user_id         UUID        NOT NULL REFERENCES iam.users(id),
  role_id         UUID        NOT NULL REFERENCES iam.roles(id),
  assigned_by     UUID        NOT NULL REFERENCES iam.users(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  office_scope_id UUID        NULL, -- logical FK -> organization.offices.id (cross-schema)
  revoked_by      UUID        NULL REFERENCES iam.users(id),
  revoked_at      TIMESTAMPTZ NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ NULL,
  deleted_by      UUID        NULL,
  CONSTRAINT ck_role_assignments_revocation_consistency
      CHECK ((revoked_at IS NULL) = (is_active = true))
);
CREATE UNIQUE INDEX uq_role_assignments_active
    ON iam.role_assignments(user_id, role_id,
       COALESCE(office_scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_role_assignments_user ON iam.role_assignments(user_id) WHERE is_active = true;
CREATE INDEX idx_role_assignments_role ON iam.role_assignments(role_id);
```

### iam.mfa_records

```sql
CREATE TABLE iam.mfa_records (
  id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  user_id          UUID        NOT NULL REFERENCES iam.users(id),
  method           TEXT        NOT NULL DEFAULT 'totp' CHECK (method IN ('totp')),
  secret_encrypted TEXT        NOT NULL,
  is_enabled       BOOLEAN     NOT NULL DEFAULT false,
  enabled_at       TIMESTAMPTZ NULL,
  last_verified_at TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ NULL,
  deleted_by       UUID        NULL,
  CONSTRAINT uq_mfa_records_user_method UNIQUE (user_id, method)
);
-- updated_at trigger required
```

## Platform Administrator exclusion trigger (append manually to migration file)

```sql
CREATE OR REPLACE FUNCTION iam.enforce_platform_admin_exclusion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_incoming_type TEXT;
  v_conflict_type TEXT;
BEGIN
  SELECT type_code INTO v_incoming_type FROM iam.roles WHERE id = NEW.role_id;
  IF v_incoming_type = 'platform_admin' THEN
    v_conflict_type := 'document_processor';
  ELSIF v_incoming_type = 'document_processor' THEN
    v_conflict_type := 'platform_admin';
  ELSE
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM iam.role_assignments ra
    JOIN iam.roles r ON r.id = ra.role_id
    WHERE ra.user_id = NEW.user_id
      AND r.type_code = v_conflict_type
      AND ra.is_active = true AND ra.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'Platform Administrator role cannot be combined with document-processing roles (user_id: %)',
      NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_platform_admin_exclusion
  BEFORE INSERT OR UPDATE ON iam.role_assignments
  FOR EACH ROW EXECUTE FUNCTION iam.enforce_platform_admin_exclusion();
```

## Runtime grants (append manually to migration file after the trigger)

```sql
GRANT USAGE ON SCHEMA iam TO batac_app, batac_readonly;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA iam TO batac_app;
GRANT SELECT ON ALL TABLES IN SCHEMA iam TO batac_readonly;
REVOKE SELECT ON iam.credentials FROM batac_app; -- No direct credential reads by app role
```

## Steps

1. Create `/packages/database/src/schema/iam.ts` with Drizzle table definitions matching the
   SQL above. Use `const iamSchema = pgSchema('iam')` then `iamSchema.table(...)` for each table.
2. Re-export all tables from `/packages/database/src/schema/index.ts`.
3. Run `pnpm db:generate` to produce the SQL migration file.
4. Manually append the trigger function, trigger CREATE, RLS policy, and GRANT statements to the
   generated migration file under the comment `-- === Manual additions: triggers, RLS, grants ===`.
5. Run `pnpm db:migrate` on a clean database and verify success.

Confirm before submitting:

- [ ] `pnpm db:generate` + `pnpm db:migrate` succeeds on a fresh database with all 9 tables created
- [ ] `SELECT table_name FROM information_schema.tables WHERE table_schema = 'iam' ORDER BY table_name` returns exactly: credentials, mfa_records, permissions, refresh_tokens, role_assignments, role_permissions, roles, sessions, users
- [ ] Inserting two active sessions for the same user_id fails with unique constraint violation
- [ ] Inserting a platform_admin + document_processor role combination fires trg_enforce_platform_admin_exclusion and raises an exception
- [ ] `pnpm typecheck` passes at the workspace root
- [ ] `pnpm db:migrate` is idempotent (running it twice does not fail)

---

## TASK-IAM-002

Phase: 1
Module: IAM
Title: Scaffold IAM module file structure with typed stubs
Prerequisites: [TASK-INFRA-001, TASK-IAM-001]
Deliverables:

- /apps/server/src/modules/iam/index.ts — Published API barrel; re-exports only the public surface (AuthContext type, IamPublicAPI interface, PolicyEvaluator type)
- /apps/server/src/modules/iam/iam.errors.ts — Re-export of RoleCombinationForbiddenError from shared error registry; also creates /apps/server/src/errors/domain/iam.ts with the class definition
- /apps/server/src/modules/iam/iam.types.ts — AuthContext, Context, IamService interface, IamRepository interface, all input/output types; Fastify module augmentation for iamService and policyEvaluator
- /apps/server/src/modules/iam/iam.schemas.ts — Module-private Zod schemas (stubs; method bodies throw 'not implemented')
- /apps/server/src/modules/iam/iam.events.ts — IAM domain event key constants and stub subscription registrations
- /apps/server/src/modules/iam/iam.repository.ts — createIamRepository stub (typed return interface, empty method bodies)
- /apps/server/src/modules/iam/iam.service.ts — createIamService stub (typed deps interface, empty method bodies)
- /apps/server/src/modules/iam/iam.router.ts — createIamRouter stub
- /apps/server/src/modules/iam/iam.routes.ts — registerIamRoutes stub
- /apps/server/src/modules/iam/iam.plugin.ts — fp-wrapped Fastify plugin stub with name: 'iam' and dependencies declared
- /apps/server/src/modules/iam/iam.policy.ts — PolicyGuard class stub and PolicyEvaluator class stub with typed interfaces
  Acceptance Criteria:
- [ ] `pnpm typecheck` passes with all 11 new files present and zero `any` types in any file
- [ ] `iam.plugin.ts` exports a default fp-wrapped plugin with `name: 'iam'` and `dependencies: ['database', 'event-bus', 'audit']`
- [ ] `index.ts` contains only re-export statements; no implementation logic
- [ ] All method stubs are typed and throw `new Error('not implemented')` — they are never `undefined` or `() => {}`
      AI Prompt: |
      You are scaffolding the IAM module for the Batac City LGU document-management platform.
      Create all files in their stub/typed-empty form so later tasks can fill in implementations
      without re-creating files.

## Module folder

`/apps/server/src/modules/iam/`

## File naming rule

Every file carries the module prefix (`iam.repository.ts`, not `repository.ts`).
Exception: `index.ts`.

## Pattern rules

- Repositories and services are FACTORY FUNCTIONS, not classes.
  Signatures: `createIamRepository(db: DbClient | DbTransaction): IamRepository`
  and `createIamService(deps: IamServiceDeps): IamService`.
- Never use `class`, `new`, or decorators for service/repository.
- `index.ts` must contain only re-export statements.
- `iam.plugin.ts` must be wrapped with `fastify-plugin` (`fp`).
- TypeScript `strict: true` must be satisfied. No `any`.

## iam.types.ts — define these types

```typescript
export type AuthContext = {
  userId: string;
  sessionId: string;
  officeId: string | null; // [RESOLVED — see Module Summary "cid/oid spec gaps"]
  // null until the ORG module's Step 2 pass wires a real
  // resolver (organization.employees has no row, or no
  // active organization.assignments row, for this user).
  // Never an empty string — see rationale in Module Summary.
  cityId: string;
  roles: string[];
  permissions: string[]; // 'resource:action' codes
  committeeIds: string[];
  delegationGrantId: string | null;
  effectiveOfficeIds: string[]; // never contains null; see TASK-IAM-005 Hook 2
  effectiveRoles: string[];
  isItAdmin: boolean;
  isPlatformAdmin: boolean;
};

export type Context = {
  auth: AuthContext | null;
  db: DbClient;
  req: FastifyRequest;
};
```

Fastify module augmentation (at bottom of iam.types.ts):

```typescript
declare module 'fastify' {
  interface FastifyInstance {
    iamService: IamService;
    policyEvaluator: PolicyEvaluator;
  }
}
```

## iam.errors.ts

Create `/apps/server/src/errors/domain/iam.ts`:

```typescript
import { AppError } from '../AppError';
export class RoleCombinationForbiddenError extends AppError {
  readonly code = 'ROLE_COMBINATION_FORBIDDEN' as const;
  readonly httpStatus = 422;
  readonly trpcCode = 'FORBIDDEN' as const;
  constructor(details: { incomingRoleType: string; conflictingRoleType: string; userId: string }) {
    super(
      `Cannot assign a ${details.incomingRoleType} role to a user who already holds a ${details.conflictingRoleType} role.`,
      details,
    );
  }
}
```

Then in `/apps/server/src/modules/iam/iam.errors.ts`:

```typescript
export { RoleCombinationForbiddenError } from '../../errors/domain/iam';
```

## iam.plugin.ts stub

```typescript
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

async function iamPlugin(fastify: FastifyInstance): Promise<void> {
  // Implementations added by TASK-IAM-006 through TASK-IAM-014
}

export default fp(iamPlugin, {
  name: 'iam',
  dependencies: ['database', 'event-bus', 'audit'],
});
```

## iam.policy.ts stub

```typescript
export type EvaluationResult = { allowed: true } | { allowed: false; reason: string };

export type SubjectContext = AuthContext; // re-import from iam.types

export type ResourceDescriptor = {
  type: string;
  id: string;
  cityId: string;
  classificationLevel?: string;
  deletedAt?: Date | null;
  [key: string]: unknown;
};

export class PolicyGuard {
  checkGates(
    _subject: SubjectContext,
    _resource: ResourceDescriptor,
    _action: string,
  ): EvaluationResult {
    throw new Error('not implemented');
  }
}

export class PolicyEvaluator {
  evaluate(
    _subject: SubjectContext,
    _resource: ResourceDescriptor,
    _action: string,
    _ctx?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    throw new Error('not implemented');
  }
  registerResourceHandler(_resourceType: string, _handler: unknown): void {
    throw new Error('not implemented');
  }
}
```

Confirm before submitting:

- [ ] `pnpm typecheck` passes with all 11 new files and zero `any` types
- [ ] `iam.plugin.ts` exports default fp-wrapped plugin with name 'iam' and correct dependencies
- [ ] `index.ts` contains only re-export statements
- [ ] All method stubs throw `new Error('not implemented')`

---

## TASK-IAM-003

Phase: 1
Module: IAM
Title: Implement IAM repository layer with all CRUD operations
Prerequisites: [TASK-IAM-002]
Deliverables:

- /apps/server/src/modules/iam/iam.repository.ts — Complete createIamRepository(db) factory function implementing the full IamRepository interface; covers users, credentials, sessions, refresh_tokens, roles, permissions, role_permissions, role_assignments, mfa_records
- /apps/server/src/modules/iam/**tests**/iam.repository.test.ts — Integration tests against a test database for key methods: findUserByUsername, createSession, terminateSession, createRefreshToken, revokeRefreshTokenFamily, findActiveRoleAssignmentsByUserId
  Acceptance Criteria:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test apps/server/src/modules/iam/__tests__/iam.repository.test.ts` passes
- [ ] The factory accepts both `DbClient` and `DbTransaction`; confirmed by calling it inside a `db.transaction(async (tx) => { createIamRepository(tx).findUserById(...) })` in tests
- [ ] No method imports from or queries any schema other than `iam` (code review: zero imports from other schema files)
- [ ] All delete operations use `UPDATE ... SET deleted_at, deleted_by`; no raw `DELETE` statements
      AI Prompt: |
      You are implementing the IAM repository for the Batac City LGU document-management platform.

## File

`/apps/server/src/modules/iam/iam.repository.ts`

## Pattern

Factory function, not a class:

```typescript
export function createIamRepository(db: DbClient | DbTransaction): IamRepository { ... }
```

The IamRepository interface is defined in `iam.types.ts`. Import table references from
`@batac/database/schema/iam` (the Drizzle schema created in TASK-IAM-001).

## Rules

- Query ONLY the `iam` schema. No cross-schema queries.
- Soft delete only: `UPDATE ... SET deleted_at = now(), deleted_by = ?`. Never issue `DELETE`.
- Use Drizzle ORM operators (`eq`, `and`, `isNull`, `isNotNull`, `lte`, `desc`, etc.).
- No business logic in the repository — pure data access.

## Required interface methods

```typescript
interface IamRepository {
  // Users
  findUserById(id: string): Promise<UserRow | null>;
  findUserByUsername(cityId: string, username: string): Promise<UserRow | null>;
  findUserByEmail(cityId: string, email: string): Promise<UserRow | null>;
  createUser(input: CreateUserInput): Promise<UserRow>;
  updateUser(id: string, input: Partial<UpdateUserInput>): Promise<UserRow>;
  softDeleteUser(id: string, deletedBy: string): Promise<void>;
  listUsers(
    cityId: string,
    opts: { limit: number; offset: number; search?: string },
  ): Promise<UserRow[]>;
  updateLoginFailure(id: string, count: number, lockedUntil: Date | null): Promise<void>;
  resetLoginFailure(id: string): Promise<void>;

  // Credentials (no direct SELECT by app role — reads via service only)
  findCredentialByUserId(userId: string): Promise<CredentialRow | null>;
  createCredential(userId: string, passwordHash: string): Promise<void>;
  updateCredentialHash(userId: string, passwordHash: string): Promise<void>;

  // Sessions
  createSession(input: CreateSessionInput): Promise<SessionRow>;
  findActiveSessionByUserId(userId: string): Promise<SessionRow | null>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  findSessionById(id: string): Promise<SessionRow | null>;
  terminateSession(id: string, reason: string, terminatedBy: string | null): Promise<void>;
  updateLastActivity(id: string): Promise<void>;
  setSessionLocked(id: string, lockedAt: Date | null): Promise<void>;
  listSessionsByUserId(userId: string): Promise<SessionRow[]>;
  listAllActiveSessions(
    cityId: string,
    opts: { limit: number; offset: number },
  ): Promise<SessionRow[]>;

  // Refresh tokens
  createRefreshToken(input: CreateRefreshTokenInput): Promise<RefreshTokenRow>;
  findRefreshTokenById(id: string): Promise<RefreshTokenRow | null>;
  markRefreshTokenUsed(id: string, replacedById: string): Promise<void>;
  revokeRefreshTokensBySessionId(sessionId: string, reason: string): Promise<void>;
  revokeRefreshTokenFamily(familyId: string, reason: string): Promise<void>;
  findLatestActiveRefreshTokenForSession(sessionId: string): Promise<RefreshTokenRow | null>;

  // Roles
  findRoleById(id: string): Promise<RoleRow | null>;
  findRoleByCode(cityId: string, code: string): Promise<RoleRow | null>;
  listActiveRoles(cityId: string): Promise<RoleRow[]>;

  // Role assignments
  findActiveRoleAssignmentsByUserId(
    userId: string,
  ): Promise<(RoleAssignmentRow & { role: RoleRow })[]>;
  createRoleAssignment(input: CreateRoleAssignmentInput): Promise<RoleAssignmentRow>;
  revokeRoleAssignment(id: string, revokedBy: string): Promise<void>;
  findAssignmentsByUserId(userId: string): Promise<RoleAssignmentRow[]>;
  findConflictingTypeCodeForUser(userId: string, conflictTypeCode: string): Promise<RoleRow | null>;

  // Permissions
  findPermissionsByRoleIds(roleIds: string[]): Promise<PermissionRow[]>;

  // MFA
  findMfaRecordByUserId(userId: string): Promise<MfaRecordRow | null>;
}
```

Define all Row types (UserRow, CredentialRow, SessionRow, etc.) in `iam.types.ts` using
Drizzle's `InferSelectModel<typeof table>`.

Confirm before submitting:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test apps/server/src/modules/iam/__tests__/iam.repository.test.ts` passes
- [ ] Factory accepts both DbClient and DbTransaction
- [ ] No cross-schema queries
- [ ] All deletes use soft-delete pattern

---

## TASK-IAM-004

Phase: 1
Module: IAM
Title: [ABAC] Implement PolicyGuard (hardcoded gates) and PolicyEvaluator (RBAC/ABAC steps)
Prerequisites: [TASK-IAM-003]
Deliverables:

- /apps/server/src/modules/iam/iam.policy.ts — PolicyGuard with synchronous Gates 1–5 (no DB access); PolicyEvaluator with Steps 6–8 RBAC + ABAC evaluation; `session` resource type handler registered at instantiation; resource handler registry pattern for extensibility by other modules
- /apps/server/src/modules/iam/**tests**/iam.policy.test.ts — Unit tests covering all 5 gates and session resource policies
  Acceptance Criteria:
- [ ] `pnpm test apps/server/src/modules/iam/__tests__/iam.policy.test.ts` passes; test suite covers: Gate 1 cross-city DENY, Gate 2 IT Admin content isolation DENY, Gate 3 Platform Admin operational exclusion DENY, Gate 4 classification gate DENY, Gate 5 soft-delete gate DENY, session:read_own same-user ALLOW, session:read_own cross-user DENY, session:force_terminate IT Admin ALLOW, session:force_terminate non-IT-Admin DENY
- [ ] `PolicyEvaluator.evaluate()` returns `{ allowed: false, reason: 'tenant_isolation' }` when subject.cityId !== resource.cityId regardless of all other attributes
- [ ] `PolicyEvaluator.evaluate()` returns `{ allowed: false, reason: 'platform_admin_operational_exclusion_invariant' }` when subject.isPlatformAdmin = true and action is not in the Platform Admin allowed-action list
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing the ABAC policy evaluation engine for the Batac City LGU
      document-management platform. This is security-critical. Implement exactly as specified;
      no convenience overrides.

## Two classes in iam.policy.ts

### PolicyGuard — synchronous; no DB access; called first

Evaluates the 5 hardcoded cascade gates. First DENY terminates immediately.

**Gate 1 — City isolation**

```
IF resource.cityId !== subject.cityId → DENY, reason: 'tenant_isolation'
```

**Gate 2 — IT Admin content isolation**

```
IF subject.isItAdmin = true
  AND resource.type IN ['document_version','document_attachment']
  AND resource.classificationLevel IN ['confidential','restricted']
  AND action IN ['read','download','export','bulk_export','scan_qr_content']
→ DENY, reason: 'it_admin_content_isolation_invariant'
```

**Gate 3 — Platform Admin operational exclusion**

```
IF subject.isPlatformAdmin = true
  AND action NOT IN [
    'manage_roles','manage_workflow_def','manage_document_types',
    'manage_number_series','manage_retention_schedules','manage_sla_config',
    'manage_notification_templates','manage_office_hierarchy',
    'manage_standing_committees','manage_public_visibility_rules',
    'read_org_structure','read_workflow_definitions','read_user_directory',
    'post_announcement','run_report','export_report'
  ]
→ DENY, reason: 'platform_admin_operational_exclusion_invariant'
```

**Gate 4 — Classification gate**

```
IF resource.classificationLevel IN ['confidential','restricted']
  AND allowlistRoles (injected async fn; returns [] by default) does not include any of subject.roles
→ DENY, reason: 'classification_denied'
```

Gate 4 accepts an injected `getAllowlistRoles?: (resourceTypeId: string) => Promise<string[]>`.
Default: returns `[]` (deny all classified resources unless the DOCS module injects the real fn).

**Gate 5 — Soft-delete gate**

```
IF resource.deletedAt != null
  AND action NOT IN ['read','read_metadata','view_audit_trail']
→ DENY, reason: 'resource_soft_deleted'
```

### PolicyEvaluator — async; delegates gates to PolicyGuard; runs Steps 6–8

```typescript
export class PolicyEvaluator {
  constructor(private readonly guard: PolicyGuard) {}

  async evaluate(
    subject: SubjectContext,
    resource: ResourceDescriptor,
    action: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    // Step 1–5: run PolicyGuard gates
    const gateResult = this.guard.checkGates(subject, resource, action);
    if (!gateResult.allowed) return gateResult;

    // Step 6: RBAC check — perm claim is a pre-computed list in the JWT
    const permKey = `${resource.type}:${action}`;
    if (!subject.permissions.includes(permKey)) {
      return { allowed: false, reason: 'rbac_no_matching_permission' };
    }

    // Steps 7–8: ABAC refinements via registered resource handler
    const handler = this.handlers.get(resource.type);
    if (!handler) return { allowed: true }; // no handler = RBAC sufficient
    return handler(subject, resource, action, context);
  }

  registerResourceHandler(resourceType: string, handler: ResourcePolicyHandler): void {
    this.handlers.set(resourceType, handler);
  }

  private readonly handlers = new Map<string, ResourcePolicyHandler>();
}
```

### session resource handler (register in PolicyEvaluator constructor)

```
session:read_own  → ALLOW IF resource.userId === subject.userId
session:read_all  → ALLOW IF subject.isItAdmin === true
session:force_terminate → ALLOW IF subject.isItAdmin === true AND context?.reason is non-empty string
All other session actions → DENY, reason: 'session_action_not_permitted'
```

Register this handler inside the PolicyEvaluator constructor or at the point PolicyEvaluator
is instantiated in the plugin (TASK-IAM-014).

## ResourceDescriptor shape

```typescript
type ResourceDescriptor = {
  type: string;
  id: string;
  cityId: string;
  classificationLevel?: string;
  deletedAt?: Date | null;
  userId?: string; // for session resources
  officeId?: string;
  documentTypeId?: string;
  [key: string]: unknown;
};
```

Confirm before submitting:

- [ ] All 9 policy scenarios pass in iam.policy.test.ts
- [ ] Gate 1: cross-city → tenant_isolation DENY regardless of other attributes
- [ ] Gate 3: Platform Admin + operational action → exclusion DENY
- [ ] session:force_terminate IT Admin + reason → ALLOW; non-IT-Admin → DENY
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-005

Phase: 1
Module: IAM
Title: Implement Fastify auth preHandler middleware chain
Prerequisites: [TASK-IAM-003, TASK-IAM-004]
Deliverables:

- /apps/server/src/modules/iam/iam.middleware.ts — fp-wrapped plugin exporting four preHandlers (verifyAccessToken, loadDelegationContext, setDatabaseSessionVars, updateLastActivity); inactivity enforcement; 423 Locked response on locked sessions; exported as authMiddlewarePlugin
  Acceptance Criteria:
- [ ] Request with missing or expired `batac_at` cookie is rejected 401 before reaching any route handler
- [ ] Request with a valid JWT whose session.active = false in iam.sessions is rejected 401
- [ ] Request where NOW() - session.last_activity_at > 30 min is rejected 401; session row is terminated with termination_reason = 'inactivity'; both cookies are cleared
- [ ] Request on a session where locked_at IS NOT NULL is rejected 423 Locked (except POST /api/auth/unlock which must bypass this check)
- [ ] After each valid authenticated request, iam.sessions.last_activity_at is updated to within 1 second of now()
- [ ] A request from a user whose AuthContext.officeId is null does not throw at the setDatabaseSessionVars hook (app.current_office_id session var is set to SQL NULL, not the string 'null' or an empty string)
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing the Fastify authentication preHandler middleware chain for the Batac
      City LGU document-management platform.

## File

`/apps/server/src/modules/iam/iam.middleware.ts`

## Cookie names and JWT algorithm

- Access token cookie: `batac_at` — Path=/; HttpOnly; Secure; SameSite=Strict
- Refresh token cookie: `batac_rt` — Path=/api/auth/refresh; HttpOnly; Secure; SameSite=Strict
- JWT signing algorithm: RS256. Verify using JWT_PUBLIC_KEY env var (PEM-encoded RSA public key).
- Use `fast-jwt` or `jsonwebtoken` (whichever is in project deps per TASK-INFRA-001).
- COOKIE_SECURE env var controls the Secure flag (default true; false in development).

## JWT private claims (beyond iss/sub/iat/exp/jti)

```
uid  — user UUID
oid  — primary office UUID, or null  [RESOLVED — see iam.md Module Summary;
       null whenever no organization.employees row, or no active
       organization.assignments row, exists for this user]
rid  — string[] of role codes
perm — string[] of 'resource:action' permission codes
cid  — string[] of committee UUIDs ([] if no active organization.committee_memberships rows)
dg   — delegation grant UUID or null
city — city UUID
sid  — session UUID
is_ita — boolean (IT Admin flag)
is_pa  — boolean (Platform Admin flag)
```

## Hook 1: verifyAccessToken

```
1. Extract batac_at cookie. Absent → 401.
2. Verify JWT (RS256, JWT_PUBLIC_KEY). Invalid/expired → 401.
3. Load iam.sessions WHERE id = claims.sid AND active = true.
   Not found or active = false → 401.
4. If session.locked_at IS NOT NULL AND request.url !== '/api/auth/unlock' → 423 Locked.
5. Inactivity check: if NOW() - session.last_activity_at > 30 minutes:
     UPDATE iam.sessions SET active=false, terminated_at=NOW(), termination_reason='inactivity'
     Revoke all refresh tokens: UPDATE iam.refresh_tokens SET revoked_at=NOW(),
       revocation_reason='logout' WHERE session_id=sid AND revoked_at IS NULL
     Clear cookies (Max-Age=0, Expires=past date) on both batac_at and batac_rt
     Return 401 { code: 'SESSION_EXPIRED', reason: 'inactivity' }
6. Populate request.auth (type: AuthContext) from JWT claims.
```

## Hook 2: loadDelegationContext

```
1. If request.auth.delegationGrantId IS NULL → skip.
2. const grant = await fastify.iamService.resolveActiveDelegationGrant(request.auth.delegationGrantId);
   [RESOLVED — see Module Summary "Hook 2 cross-schema access" finding. This previously read
   organization.delegation_grants directly via SQL, which is a Law #2 violation per B2 §"Enforcement
   Mechanisms" (no module may read another module's schema directly). resolveActiveDelegationGrant
   is a method on IamService backed by an injected resolver function (see TASK-IAM-006's
   IamServiceDeps), defaulting to a Phase-1 no-op (returns null) until the ORG module's Step 2
   pass wires the real organization-backed implementation. The method internally applies the same
   filter the old SQL did: row not found, expired (effective_until <= NOW()), or revoked → null.]
3. If grant === null → set request.auth.delegationGrantId = null; skip.
4. Merge grant.scope into request.auth:
   effectiveOfficeIds = [request.auth.officeId, ...grant.scope.officeIds].filter(
     (id): id is string => id !== null
   )
   effectiveRoles      = [...auth.roles, ...grant.scope.roles]
```

Note: `effectiveOfficeIds` is typed `string[]` (never contains `null`) — `request.auth.officeId`
itself may be `null` (see TASK-IAM-002), and the filter above drops it rather than letting a
literal `null` flow into an array ABAC office-membership checks treat as `string[]`. This is a
type-safety filter only; it has no security effect either way, since `document.officeId ∈ [..., null]`
cannot match a real (non-null) office UUID regardless of whether the `null` is filtered out.

Note: `resolveActiveDelegationGrant` is declared on `IamService` and defined as part of
`IamServiceDeps` in TASK-IAM-006 (the task that also introduces the other two org-context
resolver functions). TASK-IAM-005's own test suite does not need the production
`createIamService` — mock `fastify.iamService.resolveActiveDelegationGrant` directly to
return `null` (no active delegation) or a fake grant object, the same way any other
collaborator on `fastify.iamService` would be mocked for a middleware-only test.

## Hook 3: setDatabaseSessionVars

```typescript
// Within the same DB connection used for this request, SET LOCAL vars:
await db.execute(sql`
  SELECT set_config('app.current_user_id',   ${request.auth.userId},   true),
         set_config('app.current_office_id', ${request.auth.officeId ?? null}, true),
         set_config('app.city_id',           ${request.auth.cityId},   true),
         set_config('app.current_role_tier', ${roleTier},             true),
         set_config('app.is_ita', ${String(request.auth.isItAdmin)},  true),
         set_config('app.is_pa',  ${String(request.auth.isPlatformAdmin)}, true)
`);
// roleTier: 'IT_ADMIN' if isItAdmin, 'SECURITY_ADMIN' if roles includes 'auditor', else 'STANDARD'
```

**`app.current_office_id` when `request.auth.officeId` is `null` [RESOLVED — see Module Summary]:**
`set_config(..., NULL, true)` is valid — it sets the session variable to SQL NULL, not the
3-character string `'null'`. Any RLS policy comparing `current_setting('app.current_office_id')::uuid
  = documents.office_id` then evaluates to `NULL` (neither true nor false) for that row, which
PostgreSQL treats as not-matching — the row is excluded, the same fail-closed behavior as the
application-layer ABAC check (see TASK-IAM-005 Hook 2 note above). This replaces the previous
empty-string placeholder design (`oid=''`), which would have made this same line throw
`invalid input syntax for type uuid` the moment any RLS policy attempted the `::uuid` cast on it —
a crash on every request for a user with no resolved office, rather than a clean, safe denial.

## Hook 4: updateLastActivity

```typescript
await iamRepo.updateLastActivity(request.auth.sessionId);
```

Simple UPDATE, acceptable on every authenticated request.

## Export

```typescript
export const authMiddlewarePlugin = fp(
  async (fastify) => {
    fastify.addHook('preHandler', verifyAccessToken);
    fastify.addHook('preHandler', loadDelegationContext);
    fastify.addHook('preHandler', setDatabaseSessionVars);
    fastify.addHook('preHandler', updateLastActivity);
  },
  { name: 'auth-middleware', dependencies: ['iam'] },
);
```

This plugin is registered on the PROTECTED-routes scope only (not on public auth endpoints).

Confirm before submitting:

- [ ] Missing/expired batac_at cookie → 401 before route handler runs
- [ ] Valid JWT with session.active = false → 401
- [ ] Inactivity > 30 min → 401; session terminated; cookies cleared
- [ ] locked_at IS NOT NULL (and URL ≠ /api/auth/unlock) → 423 Locked
- [ ] Valid request: last_activity_at updated to within 1 second of now()
- [ ] Null officeId does not throw at setDatabaseSessionVars; app.current_office_id set to SQL NULL
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-006

Phase: 1
Module: IAM
Title: [AUDIT] Implement POST /api/auth/login (PKCE, JWT issuance, HTTP-only cookies)
Prerequisites: [TASK-IAM-005, TASK-AUDIT-003]
Deliverables:

- /apps/server/src/modules/iam/iam.service.ts — Adds login(input: LoginInput): Promise<void> method to createIamService(); handles PKCE verification, Argon2id credential check, concurrent-session enforcement, progressive account lockout, JWT (RS256) issuance, refresh-token issuance, cookie delivery, MFA no-op hook, audit events. Also adds the `IamServiceDeps` org-context resolver fields (`getPrimaryOffice`, `getCommitteeIds`, `resolveActiveDelegationGrant`) and a private `buildAccessTokenClaims()` helper — see "Org-context resolver design" below. [RESOLVED — see Module Summary, formerly two SPEC GAPs]
- /apps/server/src/modules/iam/iam.routes.ts — Registers POST /api/auth/login as a public route (no auth preHandlers); rate limited 5 req / 15 min per IP via @fastify/rate-limit
- /apps/server/src/modules/iam/**tests**/iam.login.test.ts — Integration tests: success flow, wrong password, PKCE mismatch, concurrent session replacement, lockout counter, response body shape, null-office login
  Acceptance Criteria:
- [ ] POST /api/auth/login valid credentials + PKCE → 200; two Set-Cookie headers (batac_at, batac_rt); JSON body matches AuthResponseSchema (`user`, `sessionId`, `expiresAt`, `roleCodes`, `officeScopeId`, `officeCode`); no token value anywhere in the response body [RESOLVED — see Module Summary "login response body" finding; previously specified as an empty body, which contradicted the already-accepted ADR-UI-012/F2 frontend design]
- [ ] When the authenticating user has no resolvable primary office (no `organization.employees` row, or no active `organization.assignments` row — the expected case for every Phase-1 login, since the ORG module does not exist yet): `officeScopeId` and `officeCode` are both `null` in the response body, and the JWT `oid` claim is `null` — not an empty string, and the request does not throw
- [ ] POST /api/auth/login wrong password → 401; audit login_failed event emitted with attempted_identifier_hash = SHA-256(username) — never plaintext
- [ ] POST /api/auth/login PKCE code_verifier that does not satisfy SHA-256(code_verifier) = code_challenge → 400
- [ ] POST /api/auth/login when an active session already exists: old session terminated (termination_reason='replaced'), session_replaced audit event emitted, new session created — all in one transaction
- [ ] batac_at cookie: HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age = JWT_ACCESS_TTL_SECONDS
- [ ] batac_rt cookie: HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age = 14*24*3600
- [ ] `pnpm test apps/server/src/modules/iam/__tests__/iam.login.test.ts` passes
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing POST /api/auth/login for the Batac City LGU document-management platform.
      This is a PUBLIC route (no auth preHandlers). The server is both authorization server and
      resource server in Phase 1.

## PKCE (RFC 7636 — S256 method only)

The SPA is a public client (no client secret). PKCE protects the token request:

In Phase 1, the SPA sends both credentials AND the PKCE material in a single login request
(collapsed flow — authorization code step is skipped since server and resource server are the same).

Request body:

```json
{
  "username": "string",
  "password": "string",
  "code_verifier": "string", // 32-byte CSPRNG, base64url-encoded by client
  "code_challenge": "string", // SHA-256(code_verifier), base64url-encoded by client
  "code_challenge_method": "S256"
}
```

Server verifies: `base64url(SHA-256(code_verifier)) === code_challenge`.
Mismatch → 400 Bad Request, body: `{ code: 'PKCE_MISMATCH' }`.

## Org-context resolver design [RESOLVED — formerly two SPEC GAPs in the Module Summary]

The JWT `oid` (primary office) and `cid` (committee memberships) claims, and the login
response body's `officeScopeId`/`officeCode` fields, all depend on `organization` schema
data. The ORG module owns that schema and is built in Wave C — after IAM (Wave B). At the
time this task is implemented, `organization.*` does not exist as a module, so
`iam.service.ts` cannot import anything from it.

This is solved the same way TASK-IAM-004's Gate 4 solved the identical problem one module
over (DOCS module not yet built; `getAllowlistRoles?: (resourceTypeId) => Promise<string[]>`
injected with a `[]`-returning default): `IamServiceDeps` gains three **optional** functions,
each defaulting to a safe no-op. `createIamService` uses the provided function if present,
the no-op default otherwise — IAM's own code never branches on "has ORG been built yet,"
it just always calls `deps.getPrimaryOffice(...)` etc., and that call happens to be a no-op
until a later task supplies the real one.

```typescript
// iam.service.ts — added to IamServiceDeps

interface IamServiceDeps {
  db: DbClient;
  auditService: AuditService;
  eventBus: TypedEventBus;
  policyEvaluator: PolicyEvaluator;

  /**
   * Resolve a user's primary office. Returns null if the user has no
   * organization.employees row, or that employee has no active
   * organization.assignments row — both expected outcomes, not error
   * conditions (e.g. every Phase-1 login, before the ORG module exists;
   * also any real future user who is IAM-only with no LGU employment
   * record, since organization.employees.user_id is nullable by design).
   * [Inference] Phase-1 default below returns null unconditionally.
   * The ORG module's Step 2 pass supplies the real implementation —
   * see this file's Module Summary, "Forward note for the ORG module".
   */
  getPrimaryOffice?: (userId: string) => Promise<{ officeId: string; officeCode: string } | null>;

  /**
   * Active organization.committee_memberships rows for this user, as
   * committee UUIDs. Empty array if none — a normal outcome (most staff
   * are not SP Members), not just the Phase-1 default.
   * [Inference] Phase-1 default below returns [] unconditionally.
   */
  getCommitteeIds?: (userId: string) => Promise<string[]>;

  /**
   * Load an organization.delegation_grants row by id, applying the same
   * filter TASK-IAM-005's Hook 2 needs (not found, expired, or revoked → null).
   * Used by the auth preHandler chain, not by login directly — login only
   * needs this if a user can somehow start a session while already holding
   * a delegation; exposed here because IamServiceDeps is the one place all
   * three org-context resolvers are wired, per TASK-IAM-014.
   * [Inference] Phase-1 default below returns null unconditionally.
   */
  resolveActiveDelegationGrant?: (delegationGrantId: string) => Promise<{
    scope: { roles: string[]; officeIds: string[]; actions: string[] };
  } | null>;
}

// Inside createIamService(deps), near the top:
const getPrimaryOffice = deps.getPrimaryOffice ?? (async () => null);
const getCommitteeIds = deps.getCommitteeIds ?? (async () => []);
const resolveActiveDelegationGrant = deps.resolveActiveDelegationGrant ?? (async () => null);
```

**Why this is safe to leave un-implemented through all of Wave B:** every consumer of these
three claims already treats "no office" / "no committees" / "no delegation" as a normal,
expected value, not an error path — `subject.office_id` participates in ABAC checks via
array membership (`document.office_id ∈ subject.effective_office_ids`), where `null`/`[]`
simply fails to match anything and the request is denied on that branch, the same fail-closed
outcome as a genuinely officeless user. No Phase-1 acceptance criterion anywhere in this
module depends on `oid`/`cid` resolving to a real value, because no Phase-1 capability needs
office-scoped or committee-scoped data to be correct yet — ORG, which provides the only data
that could populate it, has not run.

**What happens when the ORG module's Step 2 pass runs (Wave C):** a new task in that pass —
not generated as part of this file — implements `Organization.getPrimaryOfficeForUser()`,
`Organization.getCommitteeIdsForUser()`, and `Organization.getDelegationGrantById()` on the
Organization Published API (see B2's Organization module section, which this resolution
also updates), and edits `iam.plugin.ts` (TASK-IAM-014) to pass three small adapter functions
into `createIamService`'s `deps`, e.g. `getPrimaryOffice: (userId) =>
  fastify.organizationService.getPrimaryOfficeForUser(userId)`. No change to `iam.service.ts`
itself is needed at that point — only to the plugin wiring that constructs its `deps`. See
the Module Summary's "Forward note for the ORG module" for the exact task this implies.

## Login flow (execute in order; abort on first failure)

````
1. Rate limit check: 5 req / 15 min per IP (@fastify/rate-limit). Excess → 429.
2. PKCE verify (see above). Fail → 400.
3. Find user: iamRepo.findUserByUsername(BATAC_CITY_ID, username).
   Not found → 401 generic ("Invalid credentials").
4. Status check: if user.status IN ('inactive','deactivated') → 401 generic.
5. Lockout check: if user.login_locked_until IS NOT NULL AND NOW() < login_locked_until
   → 429 with Retry-After header (remaining seconds). Do NOT reveal which check failed.
6. Password verify: argon2.verify(credential.password_hash, submittedPassword).
   (Load credential via iamRepo.findCredentialByUserId — the only place app code reads credentials.)
   Params from env: ARGON2_MEMORY_COST (default 65536), ARGON2_TIME_COST (default 2),
   ARGON2_PARALLELISM (default 1), ARGON2_HASH_LENGTH (default 32).
   Mismatch:
     a. Compute new lockout delay (see table below); UPDATE iam.users login_failure_count++, login_locked_until.
     b. Emit audit event login_failed({ attempted_identifier_hash: SHA256(username), ip_address, user_agent, failure_reason: 'wrong_password' }).
     c. Return 401 generic.
7. MFA hook (Phase 1 no-op):
   IF user.mfa_enabled = true AND MFA_REQUIRED_ROLES env var includes any of user's role codes:
     → (Phase 2 path — not implemented; skip for Phase 1. All users fall through.)
8. Concurrent-session enforcement (in a single DB transaction):
   a. iamRepo.findActiveSessionByUserId(user.id).
   b. If found (old_session):
        UPDATE old session: active=false, terminated_at=NOW(), termination_reason='replaced'.
        Revoke old session's refresh tokens: revocation_reason='replaced'.
        Emit audit event session_replaced({ user_id, old_session_id, new_session_id_placeholder, ip_address }).
   c. INSERT new iam.sessions row (user_id, session_token_hash=SHA256(jti_placeholder), ip_address, user_agent).
   d. Commit transaction; capture new session id.
9. Build claims and issue JWT via the shared buildAccessTokenClaims() helper (see below) —
   this helper is also used, unchanged, by TASK-IAM-007 (refresh) and TASK-IAM-011 (unlock's
   silent refresh path), so all three flows resolve oid/cid/dg identically and can never drift:
   ```typescript
   async function buildAccessTokenClaims(userId: string, sessionId: string) {
     const activeRoles = await iamRepo.findActiveRoleAssignmentsByUserId(userId);
     const roleCodes    = activeRoles.map(ra => ra.role.code);
     const [office, committeeIds] = await Promise.all([
       getPrimaryOffice(userId),
       getCommitteeIds(userId),
     ]);
     return {
       registered: { iss: 'batac-lgu-platform', sub: userId, jti: uuidv4() },
       private: {
         uid: userId,
         oid: office?.officeId ?? null,
         rid: roleCodes,
         perm: await iamRepo.findPermissionsByRoleIds(activeRoles.map(ra => ra.roleId)),
         cid: committeeIds,
         dg: null,   // login always starts dg null; a delegation is picked up at next refresh
                     // if one becomes active later in the session — same staleness model as roles
         city: BATAC_CITY_ID,
         sid: sessionId,
         is_ita: activeRoles.some(ra => ra.role.code === 'sys_admin'),
         is_pa: activeRoles.some(ra => ra.role.is_platform_admin === true),
       },
       display: { roleCodes, officeScopeId: office?.officeId ?? null, officeCode: office?.officeCode ?? null },
     };
   }
   ```
   Takes `userId` rather than a full user row deliberately — TASK-IAM-007 (refresh) only has
   `row.user_id` from the refresh-token row at the point it needs this, and should not need an
   extra `findUserById` call just to satisfy this helper's signature.
   Call site: `const claims = await buildAccessTokenClaims(user.id, newSessionId);` then sign:
   ```typescript
   const accessToken = jwt.sign(
     { ...claims.registered, ...claims.private },
     JWT_PRIVATE_KEY,
     { algorithm: 'RS256', expiresIn: JWT_ACCESS_TTL_SECONDS },
   );
   ```
   Sign with RS256 (JWT_PRIVATE_KEY env var, PEM-encoded RSA private key); `iat=NOW()`,
   `exp=NOW()+JWT_ACCESS_TTL_SECONDS`. Update `session_token_hash = SHA256(jti)` on the new
   session row.
10. Issue refresh token:
    raw = crypto.randomBytes(32) → base64url
    salt = crypto.randomBytes(16) → base64url
    token_hash = SHA256(raw + salt)
    token_id = uuidv4()
    INSERT iam.refresh_tokens (id=token_id, user_id, session_id, token_hash, salt,
      family_id=uuidv4(), expires_at=NOW()+14days).
    Cookie value format: `${token_id}.${raw}`
11. Reset lockout: iamRepo.resetLoginFailure(user.id).
12. Emit audit event login_success({ user_id, session_id, ip_address, user_agent }).
13. Set cookies (batac_at, batac_rt) and return 200 with a body matching `AuthResponseSchema`
    (E3 Part 2 — RESOLVED to include `roleCodes`, `officeScopeId`, `officeCode`; see Module
    Summary "login response body" finding):
    ```typescript
    return reply.status(200).send({
      user: toUserSelectSchema(user),       // existing projection; excludes credential fields
      sessionId,
      expiresAt: new Date(Date.now() + JWT_ACCESS_TTL_SECONDS * 1000),
      roleCodes: claims.display.roleCodes,
      officeScopeId: claims.display.officeScopeId,
      officeCode: claims.display.officeCode,
    });
    ```
    Tokens themselves are never in this body — they are only ever in the two Set-Cookie
    headers set in this same step. This body exists purely so `/web`'s `useSessionStore`
    (F2 §5, ADR-UI-012) can hydrate identity synchronously from the login response, per the
    already-accepted frontend design — it carries no security-sensitive value of its own.
````

## Progressive account lockout delays

| login_failure_count after increment | Delay (login_locked_until = NOW() + delay) |
| ----------------------------------- | ------------------------------------------ |
| 1–5                                 | no lockout (login_locked_until = NULL)     |
| 6                                   | 30 seconds                                 |
| 7                                   | 60 seconds                                 |
| 8                                   | 2 minutes                                  |
| 9                                   | 5 minutes                                  |
| 10+                                 | 15 minutes                                 |

## Audit events (via fastify.auditService.writeEvent — decorated by AUDIT module prerequisite)

- login_success: `{ user_id, session_id, ip_address, user_agent }`
- login_failed: `{ attempted_identifier_hash: sha256hex(username), ip_address, user_agent, failure_reason }`
- session_replaced: `{ user_id, old_session_id, new_session_id, new_ip_address }`

attempted_identifier_hash MUST be SHA-256(username) in hex. NEVER log the plaintext username.

## is_ita and is_pa computation

Computed inside `buildAccessTokenClaims()` (see "Org-context resolver design" above) from
the same `activeRoles` lookup used for `rid`/`perm` — not a separate query:

```typescript
const is_ita = activeRoles.some((ra) => ra.role.code === 'sys_admin');
const is_pa = activeRoles.some((ra) => ra.role.is_platform_admin === true);
```

Confirm before submitting:

- [ ] Valid login → 200 with two Set-Cookie headers; body matches AuthResponseSchema; no token in response body
- [ ] Login with no resolvable primary office → officeScopeId/officeCode null in response; oid null (not '') in JWT; no throw
- [ ] Wrong password → 401; audit login_failed with SHA-256 hash (never plaintext)
- [ ] PKCE mismatch → 400 with code PKCE_MISMATCH
- [ ] Existing active session → replaced in one transaction; session_replaced audit emitted
- [ ] batac_at: HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=JWT_ACCESS_TTL_SECONDS
- [ ] batac_rt: HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=1209600
- [ ] `pnpm test apps/server/src/modules/iam/__tests__/iam.login.test.ts` passes
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-007

Phase: 1
Module: IAM
Title: [AUDIT] Implement POST /api/auth/refresh (token rotation with reuse detection)
Prerequisites: [TASK-IAM-006]
Deliverables:

- /apps/server/src/modules/iam/iam.service.ts — Adds refresh(input: RefreshInput): Promise<void> method; one-time-use enforcement; family-wide revocation on reuse; new token issuance
- /apps/server/src/modules/iam/iam.routes.ts — Registers POST /api/auth/refresh as a public route; rate limited 20 req / min per session
  Acceptance Criteria:
- [ ] POST /api/auth/refresh valid unused token → 200; new batac_at and batac_rt cookies set; old token row has used_at set; new token row inserted with same family_id
- [ ] POST /api/auth/refresh already-used token → 401; all tokens in same family_id revoked; session terminated; both cookies cleared; token_reuse_detected audit event emitted
- [ ] POST /api/auth/refresh revoked token → 401; no additional revocation triggered
- [ ] POST /api/auth/refresh expired token (expires_at < NOW()) → 401
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing POST /api/auth/refresh for the Batac City LGU document-management
      platform. This is a PUBLIC route (no auth preHandlers). The refresh token cookie
      (batac_rt) is path-scoped to /api/auth/refresh — the browser sends it only here.

## Cookie value format (established in TASK-IAM-006)

```
batac_rt value = "<token_id>.<raw_base64url_token>"
Split: token_id = value.split('.')[0]; raw_token = value.split('.').slice(1).join('.')
```

## Token rotation flow

```
1. Extract batac_rt cookie. Absent → 401.
2. Parse: split on first '.'; get token_id and raw_token.
3. Load token row: iamRepo.findRefreshTokenById(token_id). Not found → 401.
4. Verify hash: SHA256(raw_token + row.salt) must equal row.token_hash. Mismatch → 401.
5. Check reuse (CRITICAL — security invariant):
   IF row.used_at IS NOT NULL:
     a. Revoke entire family: iamRepo.revokeRefreshTokenFamily(row.family_id, 'reuse_detected').
     b. Terminate session: terminateSession(row.session_id, 'forced', null).
     c. Clear both cookies (Max-Age=0, Expires=past).
     d. Emit audit: token_reuse_detected({ user_id: row.user_id, family_id: row.family_id,
          ip_address, action_taken: 'family_revoked' }).
     e. Return 401 { code: 'TOKEN_REUSE_DETECTED', message: 'Session security event detected.' }.
6. IF row.revoked_at IS NOT NULL → 401.
7. IF row.expires_at < NOW() → 401.
8. Valid token — proceed (in a transaction):
   a. Mark old token used: iamRepo.markRefreshTokenUsed(row.id, new_token_id_placeholder).
   b. Generate new raw token (32 bytes, base64url), new salt (16 bytes, base64url), new_id = uuidv4().
   c. Insert new token: same session_id, same family_id, new token_hash, new salt,
        new id, expires_at = NOW() + 14 days.
   d. Update replaced_by on old token: UPDATE WHERE id = row.id SET replaced_by = new_id.
   e. Issue new JWT via `buildAccessTokenClaims(row.user_id, row.session_id)` — the exact same
      helper TASK-IAM-006 (login) uses. [RESOLVED — see that task's Module Summary cross-reference.]
      This re-resolves `oid`, `cid`, `rid`, and `perm` freshly from the DB on every refresh —
      the previous text here ("reload roles and permissions freshly from DB") named only two
      of the four claims that actually need re-resolution on refresh; calling the shared
      helper instead of re-deriving each claim inline here removes the risk of the two flows
      drifting apart as either gets modified later. `dg` is set from
      `resolveActiveDelegationGrant`-equivalent logic if `request.auth.delegationGrantId`
      carried a still-valid grant; otherwise null — same rule as TASK-IAM-005 Hook 2.
   f. UPDATE iam.sessions SET last_activity_at = NOW() WHERE id = row.session_id.
9. Set new cookies (same cookie attributes as login).
10. Emit audit: token_refresh({ user_id: row.user_id, session_id: row.session_id }).
11. Return 200 {}.
```

**[RESOLVED — 2026-06-26]** The refresh response body (`200 {}`, cookie-only) is final.
`useSessionStore` does not re-hydrate from background token renewal. Role, office, and
committee changes take effect at next full login. See iam.md Module Summary
"Resolved developer decisions (2026-06-26)" item 2 for the full rationale.

Rate limit: 20 req / min per session. Key the rate limiter on the session_id parsed from
the refresh token (available after step 3 succeeds).

Confirm before submitting:

- [ ] Valid unused token → 200; new cookies set; old used_at populated; new row same family_id
- [ ] Already-used token → 401; whole family revoked; session terminated; cookies cleared; reuse audit emitted
- [ ] Revoked token → 401 (no extra revocation)
- [ ] Expired token → 401
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-008

Phase: 1
Module: IAM
Title: [AUDIT] Implement POST /api/auth/logout (session termination and cookie clearing)
Prerequisites: [TASK-IAM-006]
Deliverables:

- /apps/server/src/modules/iam/iam.service.ts — Adds logout(input: LogoutInput): Promise<void> method; terminates session and revokes all active refresh tokens atomically
- /apps/server/src/modules/iam/iam.routes.ts — Registers POST /api/auth/logout as a PROTECTED route (auth preHandlers apply); rate limited 10 req / min per IP
  Acceptance Criteria:
- [ ] POST /api/auth/logout on active session → session.active = false, termination_reason = 'logout', all refresh tokens for that session revoked (revocation_reason = 'logout')
- [ ] Response clears both cookies: Set-Cookie with Max-Age=0 and Expires=Thu, 01 Jan 1970 00:00:00 GMT for both batac_at (Path=/) and batac_rt (Path=/api/auth/refresh)
- [ ] logout audit event emitted: `{ user_id, session_id, method: 'user_initiated' }`
- [ ] POST /api/auth/logout on already-terminated session → 200 (idempotent; no error)
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing POST /api/auth/logout for the Batac City LGU document-management
      platform. This is a PROTECTED route — the auth preHandlers run first and populate request.auth.

## Logout flow

```
POST /api/auth/logout
No request body required. session_id comes from request.auth.sessionId.

1. Load session: iamRepo.findSessionById(request.auth.sessionId).
   Not found or active = false → return 200 {} (idempotent).
2. In a transaction:
   a. UPDATE iam.sessions SET active=false, terminated_at=NOW(), termination_reason='logout'
      WHERE id = request.auth.sessionId.
   b. UPDATE iam.refresh_tokens SET revoked_at=NOW(), revocation_reason='logout'
      WHERE session_id = request.auth.sessionId AND revoked_at IS NULL.
3. Clear cookies:
   reply.header('Set-Cookie', [
     'batac_at=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
     'batac_rt=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
   ]);
4. Emit audit: logout({ user_id: request.auth.userId, session_id: request.auth.sessionId,
     method: 'user_initiated' }).
5. Return 200 {}.
```

Rate limit: 10 req / min per IP (prevents logout-flood attacks on shared machines).

Confirm before submitting:

- [ ] Active session: terminated; refresh tokens revoked; cookies cleared; 200 returned
- [ ] Logout audit event emitted with method='user_initiated'
- [ ] Already-terminated session → 200 (idempotent)
- [ ] Both Set-Cookie headers have Max-Age=0 and correct Path attributes
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-009

Phase: 1
Module: IAM
Title: [ABAC][AUDIT] Implement role assignment and revocation service (Platform Admin exclusion)
Prerequisites: [TASK-IAM-003, TASK-IAM-004, TASK-AUDIT-003]
Deliverables:

- /apps/server/src/modules/iam/iam.service.ts — Adds assignRole(input) and revokeRole(input) methods; application-layer Platform Admin exclusion check; audit events role_assigned and role_revoked
- /apps/server/src/modules/iam/**tests**/iam.role-assignment.test.ts — Unit tests: normal assignment success, platform_admin + document_processor block, document_processor + platform_admin block, revocation
  Acceptance Criteria:
- [ ] assignRole() with a document_processor-type role for a user holding a platform_admin-type role → throws RoleCombinationForbiddenError (httpStatus 422, code 'ROLE_COMBINATION_FORBIDDEN') before any DB INSERT
- [ ] assignRole() with a platform_admin-type role for a user holding a document_processor-type role → same error
- [ ] Successful assignRole() → emits role_assigned({ actor_id, target_user_id, role_id, role_name }) audit event
- [ ] revokeRole() → sets is_active=false, revoked_at, revoked_by on the assignment row; emits role_revoked({ actor_id, target_user_id, role_id, role_name, reason }) audit event
- [ ] `pnpm test apps/server/src/modules/iam/__tests__/iam.role-assignment.test.ts` passes
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing the role assignment and revocation service methods for the Batac City
      LGU document-management platform.

## Platform Administrator exclusion invariant

A Platform Administrator (type_code='platform_admin') cannot be combined with any
document-processing role (type_code='document_processor') on the same user.
Enforced at TWO layers: 1. Application layer (this task): check before INSERT; throw typed error. 2. Database layer (TASK-IAM-001): trg_enforce_platform_admin_exclusion trigger.

## type_code classification (authoritative)

- type_code = 'document_processor': dept_encoder, dept_approver, sp_secretary, sp_member,
  sp_presiding_officer, mayor, brgy_encoder, brgy_captain
- type_code = 'platform_admin': plat_admin
- type_code = 'sys_admin': sys_admin
- type_code = 'auditor': records_officer, auditor
- type_code = 'citizen': citizen

## assignRole()

```typescript
async assignRole(input: {
  actorId:       string;
  targetUserId:  string;
  roleId:        string;
  officeScopeId: string | null;
}): Promise<RoleAssignmentRow>
```

```
1. Load incoming role: iamRepo.findRoleById(roleId). Not found → throw NotFoundError.
2. If incomingRole.type_code IN ('platform_admin','document_processor'):
     conflictTypeCode = incomingRole.type_code === 'platform_admin'
       ? 'document_processor' : 'platform_admin'
     existingConflict = iamRepo.findConflictingTypeCodeForUser(targetUserId, conflictTypeCode)
     If existingConflict found:
       throw new RoleCombinationForbiddenError({
         incomingRoleType: incomingRole.type_code,
         conflictingRoleType: conflictTypeCode,
         userId: targetUserId
       })
3. Insert: iamRepo.createRoleAssignment({ userId: targetUserId, roleId, assignedBy: actorId,
     officeScopeId }).
   If DB trigger fires (race condition bypass): surface as 500 with message
   'Role assignment constraint violated at database layer — possible race condition'.
4. Emit audit: role_assigned({ actor_id: actorId, target_user_id: targetUserId,
     role_id: roleId, role_name: incomingRole.name }).
5. Return new assignment row.
```

## revokeRole()

```typescript
async revokeRole(input: {
  actorId:          string;
  targetUserId:     string;
  roleAssignmentId: string;
  reason:           string;
}): Promise<void>
```

```
1. Load assignment: iamRepo.findAssignmentsByUserId(targetUserId) → filter by roleAssignmentId.
   Not found → throw NotFoundError.
   If is_active = false → return (idempotent).
2. iamRepo.revokeRoleAssignment(roleAssignmentId, actorId).
3. Load role name for audit.
4. Emit audit: role_revoked({ actor_id: actorId, target_user_id: targetUserId,
     role_id: assignment.role_id, role_name, reason }).
```

## Important: token staleness

Role changes take effect on the NEXT token refresh (next POST /api/auth/refresh), not
immediately. The caller must use force-terminate (TASK-IAM-010) if instant effect is required.
Document this in a JSDoc comment on both methods.

Confirm before submitting:

- [ ] platform_admin + document_processor → RoleCombinationForbiddenError before DB INSERT
- [ ] document_processor + platform_admin → same error
- [ ] Successful assign → role_assigned audit emitted
- [ ] Revoke → is_active=false + revoked_at + role_revoked audit
- [ ] Tests pass; `pnpm typecheck` passes

---

## TASK-IAM-010

Phase: 1
Module: IAM
Title: [AUDIT] Implement POST /api/admin/sessions/:id/terminate (IT Admin force logout)
Prerequisites: [TASK-IAM-005, TASK-IAM-004, TASK-AUDIT-003]
Deliverables:

- /apps/server/src/modules/iam/iam.service.ts — Adds forceTerminateSession(input) method; mandatory reason field; enforces IT Admin only via PolicyEvaluator; audit event forced_logout
- /apps/server/src/modules/iam/iam.routes.ts — Registers POST /api/admin/sessions/:id/terminate as a protected route
  Acceptance Criteria:
- [ ] Caller with is_ita = false → 403; abac_denial audit event emitted
- [ ] Missing or empty reason field in body → 400
- [ ] Valid IT Admin call: session.active = false, termination_reason = 'forced', terminated_by = actorId; all refresh tokens for that session revoked; forced_logout audit event emitted
- [ ] Target user's next request → 401 (session inactive, caught by verifyAccessToken)
- [ ] Already-terminated session → 200 (idempotent)
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing the forced session termination endpoint for the Batac City LGU
      document-management platform. This is a PROTECTED route for IT Admins only.

## ABAC enforcement (before any service call)

```typescript
const result = await fastify.policyEvaluator.evaluate(
  request.auth,
  { type: 'session', id: request.params.id, cityId: request.auth.cityId },
  'force_terminate',
  { reason: request.body.reason },
);
if (!result.allowed) {
  await fastify.auditService.writeEvent({
    eventType: 'abac_denial',
    actorId: request.auth.userId,
    targetId: request.params.id,
    targetType: 'session',
    payload: { action: 'force_terminate', denial_reason: result.reason },
    cityId: request.auth.cityId,
  });
  return reply.status(403).send({ code: 'FORBIDDEN', message: 'Access denied.' });
}
```

## Force termination flow

```
POST /api/admin/sessions/:id/terminate
Body: { reason: string }  ← mandatory; reject with 400 if absent or empty string

1. Validate: typeof reason === 'string' && reason.trim().length > 0. Fail → 400.
2. Load target session: iamRepo.findSessionById(params.id). Not found → 404.
   If active = false → return 200 { terminated: true } (idempotent).
3. In a transaction:
   a. UPDATE iam.sessions SET active=false, terminated_at=NOW(),
        termination_reason='forced', terminated_by=request.auth.userId WHERE id=params.id.
   b. Revoke all refresh tokens: UPDATE iam.refresh_tokens SET revoked_at=NOW(),
        revocation_reason='forced' WHERE session_id=params.id AND revoked_at IS NULL.
4. Emit audit: forced_logout({ actor_id: request.auth.userId,
     target_user_id: targetSession.user_id, target_session_id: params.id, reason }).
5. Return 200 { terminated: true }.
```

The target user's next authenticated request will hit verifyAccessToken, load
session.active = false, and receive 401. No push notification is issued (Phase 1).

Confirm before submitting:

- [ ] is_ita = false → 403 + abac_denial audit event
- [ ] Missing/empty reason → 400
- [ ] Valid IT Admin call → session terminated; tokens revoked; forced_logout audit emitted
- [ ] Target's next request → 401
- [ ] Already-terminated → 200 (idempotent)
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-011

Phase: 1
Module: IAM
Title: [AUDIT] Implement workstation lock and unlock endpoints (locked_at behavior)
Prerequisites: [TASK-IAM-006, TASK-IAM-007]
Deliverables:

- /apps/server/src/modules/iam/iam.service.ts — Adds lockSession(input) and unlockSession(input) methods; locked_at set/clear; silent token refresh on unlock when access token has expired; audit events session_locked, session_unlocked
- /apps/server/src/modules/iam/iam.routes.ts — Registers POST /api/auth/lock (protected) and POST /api/auth/unlock (special: reachable with a locked session)
  Acceptance Criteria:
- [ ] POST /api/auth/lock → session.locked_at = NOW(); session_locked audit emitted; 200
- [ ] POST /api/auth/unlock correct password + JWT still valid → locked_at = NULL; session_unlocked audit emitted; 200 (no new cookies)
- [ ] POST /api/auth/unlock correct password + JWT expired while locked → locked_at = NULL; new batac_at and batac_rt cookies set via silent refresh; session_unlocked audit emitted; 200
- [ ] POST /api/auth/unlock wrong password → 401; locked_at unchanged
- [ ] POST /api/auth/unlock with expired/revoked refresh token (and expired JWT) → 401 with code 'REFRESH_REQUIRED'; full re-login required
- [ ] While locked, all protected routes (except /api/auth/unlock) → 423 Locked (verified by sending a test request to a non-unlock endpoint with locked_at set)
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing the workstation lock/unlock endpoints for the Batac City LGU
      document-management platform.

## Behavior overview

"Lock screen" does NOT terminate the session. It sets locked_at = NOW(). While locked:

- verifyAccessToken hook (TASK-IAM-005) returns 423 Locked for all routes EXCEPT /api/auth/unlock.
- The SPA shows a lock screen UI.
- Re-entering password resumes the session; locked_at is cleared.

## POST /api/auth/lock (PROTECTED route)

```
Auth preHandlers run first (session must be active and NOT already locked for normal flow).
1. UPDATE iam.sessions SET locked_at = NOW() WHERE id = request.auth.sessionId.
2. Emit audit: session_locked({ user_id: request.auth.userId, session_id: request.auth.sessionId }).
3. Return 200 { locked: true }.
```

## POST /api/auth/unlock (SPECIAL route)

This route is registered OUTSIDE the protected scope that has the authMiddlewarePlugin.
Instead, it manually reads the batac_at cookie, parses the JWT (ignoring exp), and loads
the session — even if locked. The preHandler chain is NOT applied here.

Body: `{ password: string }`

```
1. Extract batac_at cookie. Absent → 401.
2. Decode JWT WITHOUT verifying expiry (use jwt.decode or verify with clockTolerance=Infinity).
   Extract claims: uid, sid. If malformed → 401.
3. Load session: iamRepo.findSessionById(sid). Not found or active = false → 401.
   If locked_at IS NULL → return 200 { unlocked: true } (already unlocked; idempotent).
4. Verify password: iamRepo.findCredentialByUserId(uid) → argon2.verify(hash, password).
   Mismatch → 401 { code: 'INVALID_PASSWORD' }. locked_at MUST remain set.
5. Clear lock: UPDATE iam.sessions SET locked_at = NULL WHERE id = sid.
6. Silent refresh check (ADR-AUTH-010):
   IF JWT exp < NOW() (access token expired while locked):
     Find most recent active refresh token: iamRepo.findLatestActiveRefreshTokenForSession(sid).
     If none found (expired or revoked) → 401 { code: 'REFRESH_REQUIRED',
       message: 'Your session has expired. Please log in again.' }
     If found: perform full rotation (same logic as TASK-IAM-007 step 8):
       mark old used, insert new token, issue new JWT, set new cookies on this response.
   ELSE (JWT still valid):
     No new cookies needed.
7. Emit audit: session_unlocked({ user_id: uid, session_id: sid }).
8. Return 200 { unlocked: true }.
```

Key design decision (ADR-AUTH-010): Only a missing/expired/revoked REFRESH token requires
full re-login. An expired ACCESS token is handled transparently via silent refresh on unlock.
The password entry is the security gate; token expiry is a housekeeping detail.

Confirm before submitting:

- [ ] Lock: locked_at set; session_locked audit emitted; 200
- [ ] Unlock correct password + valid JWT: locked_at cleared; session_unlocked emitted; 200; no new cookies
- [ ] Unlock correct password + expired JWT: locked_at cleared; new cookies set; session_unlocked emitted; 200
- [ ] Unlock wrong password: 401; locked_at unchanged
- [ ] Unlock with no valid refresh token + expired JWT: 401 code REFRESH_REQUIRED
- [ ] Non-unlock protected route with locked_at set: 423 Locked
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-012

Phase: 1
Module: IAM
Title: Implement IAM tRPC router for internal SPA (user management, profile, sessions, password)
Prerequisites: [TASK-IAM-005, TASK-IAM-009]
Deliverables:

- /apps/server/src/modules/iam/iam.router.ts — createIamRouter(fastify) factory returning a tRPC router with all procedures listed below; all procedures use protectedProcedure (require AuthContext)
  Acceptance Criteria:
- [ ] iam.createUser callable only when ctx.auth.isItAdmin = true; non-IT-Admin → TRPCError FORBIDDEN; user_created audit emitted
- [ ] iam.updateUser enforces: caller is IT Admin OR Platform Admin OR targeting own account; non-admin cross-user call → FORBIDDEN
- [ ] iam.getProfile returns own profile for unauthenticated-scope callers; admin can request any userId
- [ ] iam.changePassword: current password mismatch → TRPCError UNAUTHORIZED; success → Argon2id hash stored, password_changed audit emitted
- [ ] iam.listOwnSessions returns only sessions where session.user_id = ctx.auth.userId
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are implementing the IAM tRPC router for the internal SPA of the Batac City LGU
      document-management platform.

## File

`/apps/server/src/modules/iam/iam.router.ts`

## Export

```typescript
export function createIamRouter(fastify: FastifyInstance): AnyTRPCRouter { ... }
```

## All procedures use protectedProcedure

ctx.auth is type AuthContext (never null on protectedProcedure). Use the ctx populated
by the auth preHandler chain (TASK-IAM-005).

## Procedures

### iam.createUser (mutation)

Restriction: ctx.auth.isItAdmin === true. Else throw TRPCError({ code: 'FORBIDDEN' }).
Input: { username: string, email: string, status?: 'active' | 'inactive' }
Action: 1. iamService.createUser({ ...input, cityId: ctx.auth.cityId }).
(createUser inserts into iam.users and iam.credentials with a temporary hash.) 2. Emit audit: user_created({ actor_id: ctx.auth.userId, new_user_id: newUser.id }).
Returns: UserRow (without password_hash).

### iam.updateUser (mutation)

Restriction: isItAdmin || isPlatformAdmin || input.userId === ctx.auth.userId.
Non-admin cross-user attempt → FORBIDDEN.
Input: { userId: string, email?: string, status?: string }
Action: iamService.updateUser({ ...input }).
Returns: UserRow.

### iam.deactivateUser (mutation)

Restriction: isItAdmin || isPlatformAdmin.
Input: { userId: string }
Action: 1. UPDATE iam.users SET status='deactivated'. 2. Terminate all active sessions for that user (termination_reason='forced'). 3. Revoke all role assignments for that user.
Returns: { deactivated: true }.

### iam.getProfile (query)

No role restriction (all authenticated users for own account).
Input: { userId?: string }
If userId provided AND userId !== ctx.auth.userId:
Restriction: isItAdmin || isPlatformAdmin. Else FORBIDDEN.
Action:
targetId = input.userId ?? ctx.auth.userId
user = iamRepo.findUserById(targetId)
assignments = iamRepo.findActiveRoleAssignmentsByUserId(targetId)
Returns: { user: UserRow, roles: (RoleAssignmentRow & { role: RoleRow })[] }

### iam.changePassword (mutation)

No role restriction (users change their own password only; cannot change another user's).
Input: { currentPassword: string, newPassword: string }
Action: 1. Load credential: iamRepo.findCredentialByUserId(ctx.auth.userId). 2. Argon2id verify currentPassword. Mismatch → TRPCError({ code: 'UNAUTHORIZED' }). 3. Hash newPassword with Argon2id using env vars:
ARGON2_MEMORY_COST, ARGON2_TIME_COST, ARGON2_PARALLELISM, ARGON2_HASH_LENGTH. 4. iamRepo.updateCredentialHash(ctx.auth.userId, newHash). 5. Emit audit: password_changed({ user_id: ctx.auth.userId, actor_id: ctx.auth.userId }).
Returns: { success: true }.

### iam.listOwnSessions (query)

No role restriction.
Input: none.
Action: iamRepo.listSessionsByUserId(ctx.auth.userId).
Note: Application-layer scope (userId = ctx.auth.userId) plus DB-layer RLS on iam.sessions.
Returns: SessionRow[].

### iam.listAllSessions (query)

Restriction: ctx.auth.isItAdmin === true.
Input: { page?: number, limit?: number }
Action: iamRepo.listAllActiveSessions(ctx.auth.cityId, { limit, offset: page \* limit }).
Returns: SessionRow[].

### iam.listUsers (query)

Restriction: isItAdmin || isPlatformAdmin → full listing with status.
Other roles → limited directory view (id, username, primary office assignment) — no status/credentials.
Input: { page?: number, limit?: number, search?: string }
Returns: UserRow[] (fields filtered by role tier).

## Error mapping

```typescript
import { RoleCombinationForbiddenError } from './iam.errors';
// in each procedure body:
try { ... } catch (e) {
  if (e instanceof RoleCombinationForbiddenError)
    throw new TRPCError({ code: 'FORBIDDEN', message: e.message, cause: e });
  throw e;
}
```

Confirm before submitting:

- [ ] iam.createUser: non-IT-Admin → FORBIDDEN; success → user_created audit
- [ ] iam.updateUser: non-admin cross-user → FORBIDDEN
- [ ] iam.getProfile: own account no restriction; other userId requires admin
- [ ] iam.changePassword: wrong current password → UNAUTHORIZED; success → Argon2id hash + audit
- [ ] iam.listOwnSessions: returns only caller's own sessions
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-013

Phase: 1
Module: IAM
Title: Seed IAM roles, permissions, and role-permission matrix
Prerequisites: [TASK-IAM-001, TASK-INFRA-006]
Deliverables:

- /apps/server/src/database/seeds/iam.seed.ts — Atomic seed script: inserts system-user sentinel, 13 roles with correct codes/type_codes/flags, permissions catalog (all resource:action pairs from the I2 matrix), and role_permissions rows; uses ON CONFLICT DO NOTHING; runnable via `pnpm db:seed`
  Acceptance Criteria:
- [ ] `pnpm db:seed` completes without error on a freshly migrated database
- [ ] `SELECT count(*) FROM iam.roles WHERE deleted_at IS NULL` = 13
- [ ] `SELECT type_code, is_platform_admin FROM iam.roles WHERE code = 'plat_admin'` = ('platform_admin', true)
- [ ] `SELECT is_system_role FROM iam.roles WHERE code = 'sys_admin'` = true
- [ ] `SELECT count(*) FROM iam.role_permissions` > 0 and matches expected cell count from I2
- [ ] `pnpm db:seed` is idempotent: running twice produces no duplicate rows and no error
- [ ] `pnpm typecheck` passes
      AI Prompt: |
      You are writing the IAM seed script for the Batac City LGU document-management platform.

## File

`/apps/server/src/database/seeds/iam.seed.ts`

Wrap all inserts in a single DB transaction. Use `ON CONFLICT DO NOTHING` for idempotency.
Log: `console.log('Seeded: N roles, M permissions, P role_permission entries.')` at the end.

## Constants

```typescript
const CITY_ID = '00000000-0000-4000-8000-000000000001';
const SYS_USER = '00000000-0000-0000-0000-000000000001'; // sentinel for assigned_by
```

## Step 1: System user sentinel

```typescript
await db
  .insert(users)
  .values({
    id: SYS_USER,
    city_id: CITY_ID,
    username: 'system',
    email: 'system@internal.batac.gov.ph',
    status: 'inactive',
  })
  .onConflictDoNothing();
```

## Step 2: 13 roles

| code                 | name                   | type_code          | is_system_role | is_platform_admin |
| -------------------- | ---------------------- | ------------------ | -------------- | ----------------- |
| sys_admin            | System Administrator   | sys_admin          | true           | false             |
| plat_admin           | Platform Administrator | platform_admin     | true           | true              |
| records_officer      | Records Officer        | auditor            | false          | false             |
| dept_encoder         | Department Encoder     | document_processor | false          | false             |
| dept_approver        | Department Approver    | document_processor | false          | false             |
| sp_secretary         | SP Secretary           | document_processor | false          | false             |
| sp_member            | SP Member              | document_processor | false          | false             |
| sp_presiding_officer | SP Presiding Officer   | document_processor | false          | false             |
| mayor                | Mayor                  | document_processor | false          | false             |
| brgy_encoder         | Barangay Encoder       | document_processor | false          | false             |
| brgy_captain         | Barangay Captain       | document_processor | false          | false             |
| auditor              | Auditor                | auditor            | false          | false             |
| citizen              | Citizen                | citizen            | false          | false             |

Use `uuidv4()` for each role id. Store in a `roleMap: Record<string, string>` keyed by code.

## Step 3: Permission catalog

Insert one row per `resource:action` pair.
The `resource` and `action` values together form the perm-claim key (`resource:action`).

Include at minimum the following (add all non-N/A cells from the I2 matrix):

```
iam_user: create, read, update, deactivate, view_directory, view_own_profile,
          edit_own_profile, change_own_password
session: read_own, read_all, force_terminate, register_citizen
role: assign, revoke
organization: create_office, edit_office, deactivate_office, create_position, edit_position,
  create_employee, edit_employee, assign_employee, view_org_chart
delegation_grant: create, revoke_early, read
document: create, read_metadata, read_file, update, cancel, submit, number_assign,
  number_promote, certify_urgent, archive, publish_portal, export, bulk_archive, bulk_export
workflow_instance: read, migrate
workflow_step_instance: read, complete_action, approve, reject, return, certify,
  mayor_sign, mayor_veto, submit_committee_report, advance, secretariat_decision, panlalawigan_review
tracking_record: read, scan_qr_internal, scan_qr_public
routing_entry: create
qr_code: print
session_attendance: manage
order_of_business: manage
signature: upload, validate
records: promote, set_retention, archive, legal_hold, bulk_export, pii_erase
notification: receive, manage_preferences, configure_templates
complaint: file, assign, set_outcome, read_own, read_respondent, read_all
document_request: create_self, create_assisted, approve_vice_mayor,
  approve_secretary, release_copy
portal: view_public, publish, post_announcement
audit_event: write, read_own, read_office, read_full, validate_chain, export
report: view_dashboard, view_task_inbox, view_sla, view_panlalawigan_summary,
  view_index, create_definition, run, export
platform: manage_document_types, manage_workflows, manage_roles, manage_sla,
  manage_notifications, manage_retention, manage_visibility_rules, manage_committees,
  manage_org, health_metrics, manage_keys, run_migrations, manage_backups
ocr: view_quality, reupload, retrigger, view_extracted_text
```

Store in a `permMap: Record<string, string>` keyed by `resource:action` → permission_id.

## Step 4: role_permissions matrix

Insert role_permissions rows for every non-N/A cell in the I2 permission matrix.
decision values: 'allow' for ✅, 'deny' for ❌, 'conditional' for 🔶.
For 'conditional' rows, set condition_reference to the I2 section and note number
(e.g., 'I2-§2-note-1').

Key mappings (representative subset — implement all 17 I2 sections):

- sys_admin → iam_user:create allow, iam_user:read allow, session:read_all allow,
  session:force_terminate allow, role:assign allow, role:revoke allow,
  audit_event:read_full allow, platform:health_metrics allow ...
- plat_admin → platform:manage_document_types allow, platform:manage_workflows allow,
  platform:manage_roles allow, platform:manage_sla allow,
  platform:manage_notifications allow, platform:manage_retention allow,
  platform:manage_visibility_rules allow, platform:manage_committees allow,
  platform:manage_org allow, document:create deny, document:read_file deny ...
  (Platform Admin is DENIED all document_processor actions)
- dept_encoder → document:create allow, document:read_metadata allow, document:submit allow,
  document:update allow, tracking_record:scan_qr_internal allow ...
- citizen → portal:view_public allow, document_request:create_self allow,
  complaint:file allow, complaint:read_own allow ...
- All roles → notification:receive allow, report:view_task_inbox allow (where applicable)

Implement the full matrix for all 13 roles × all relevant permissions.

## Step 5: cross_office_grants seed [Added — ADR-AUTH-009 §Consequences]

The `organization.cross_office_grants` table lives in the `organization` schema (created by
TASK-ORG-001 migration), but ADR-AUTH-009 specifies its seed data belongs alongside IAM seed
data because it references `iam.roles`. The organization migration (TASK-ORG-001) must have
already run before this step executes. The `pnpm db:seed` entry point runs all migrations
first, so this ordering is automatic.

Seed one row per role from B5 §5.6 "Cross-Office Permissions" table:

```typescript
// Uses roleMap built in Step 2 (keyed by role code → role_id UUID)
const CROSS_OFFICE_GRANTS = [
  {
    // Records Officer: read metadata (not content) across all offices for archival purposes
    roleCode: 'records_officer',
    officeScope: 'all',
    accessLevel: 'metadata_only',
    resourceTypes: ['document'],
  },
  {
    // SP Secretary: read and act on all workflow steps across SP Secretariat scope
    roleCode: 'sp_secretary',
    officeScope: 'all',
    accessLevel: 'full',
    resourceTypes: ['document', 'workflow_step_instance'],
  },
  {
    // Platform Administrator: org structure and workflow definitions only; no document content
    roleCode: 'plat_admin',
    officeScope: 'all',
    accessLevel: 'metadata_only',
    resourceTypes: ['organization', 'workflow_definition'],
  },
  {
    // System Administrator (IT Admin): audit/session data only; no document content
    roleCode: 'sys_admin',
    officeScope: 'all',
    accessLevel: 'metadata_only',
    resourceTypes: ['audit_event', 'session'],
  },
] as const;

for (const grant of CROSS_OFFICE_GRANTS) {
  await db
    .insert(crossOfficeGrants)
    .values({
      roleId: roleMap[grant.roleCode],
      officeScope: grant.officeScope,
      accessLevel: grant.accessLevel,
      resourceTypes: grant.resourceTypes,
    })
    .onConflictDoNothing(); // idempotent: re-seeding does not duplicate rows
}
```

Note: `access_level = 'metadata_only'` vs `'full'` is stored but NOT yet enforced by
`has_cross_office_read_grant()` — the function only answers "can read across offices."
Enforcement of the metadata/full distinction is Documents module migration work (ADR-AUTH-009
§Consequences). These seed rows are correct as data; they will be enforced once the Documents
migration adds the RLS condition.

Confirm before submitting:

- [ ] `pnpm db:seed` completes without error on a freshly migrated database
- [ ] `SELECT count(*) FROM iam.roles WHERE deleted_at IS NULL` = 13
- [ ] plat_admin: type_code='platform_admin', is_platform_admin=true
- [ ] sys_admin: is_system_role=true
- [ ] `SELECT count(*) FROM iam.role_permissions` matches expected non-N/A I2 cells
- [ ] Idempotent (no duplicate rows on second run)
- [ ] `pnpm typecheck` passes

---

## TASK-IAM-014

Phase: 1
Module: IAM
Title: Wire IAM Fastify module plugin and register in app.ts
Prerequisites: [TASK-IAM-006, TASK-IAM-007, TASK-IAM-008, TASK-IAM-009, TASK-IAM-010, TASK-IAM-011, TASK-IAM-012, TASK-IAM-013, TASK-AUDIT-003]
Deliverables:

- /apps/server/src/modules/iam/iam.plugin.ts — Complete fp-wrapped plugin: instantiates PolicyGuard + PolicyEvaluator (with session handler registered), instantiates IamService, decorates both onto fastify, attaches tRPC router, registers REST routes in a nested scope with correct public/protected route partitioning
- /apps/server/src/app.ts — Registers iam plugin after database, event-bus, and audit plugins; before organization and all downstream modules
  Acceptance Criteria:
- [ ] `pnpm build` succeeds; `pnpm dev` starts with no plugin registration errors
- [ ] `pnpm typecheck` passes
- [ ] fastify.iamService and fastify.policyEvaluator are accessible in plugins registered after IAM (confirmed by temporary log in a downstream plugin's init)
- [ ] POST /api/auth/login is reachable (returns 400 or 401 on a bad request — not 404)
- [ ] The tRPC iam.\* procedures are callable from the SPA (merged into app-wide tRPC router)
- [ ] A full login (POST /api/auth/login) succeeds end-to-end with no `organization` module registered — confirms the default no-op org-context resolvers (TASK-IAM-006) are sufficient for the app to boot and serve requests through Wave B alone
      AI Prompt: |
      You are wiring the complete IAM module plugin and registering it in the application entry
      point for the Batac City LGU document-management platform.

## iam.plugin.ts — complete implementation

```typescript
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createIamRepository } from './iam.repository';
import { createIamService } from './iam.service';
import { createIamRouter } from './iam.router';
import { registerIamRoutes } from './iam.routes';
import { PolicyGuard, PolicyEvaluator } from './iam.policy';
import { authMiddlewarePlugin } from './iam.middleware';

async function iamPlugin(fastify: FastifyInstance): Promise<void> {
  // 1. PolicyGuard + PolicyEvaluator
  const policyGuard = new PolicyGuard();
  const policyEvaluator = new PolicyEvaluator(policyGuard);
  // Session resource handler is registered inside PolicyEvaluator constructor (TASK-IAM-004)
  fastify.decorate('policyEvaluator', policyEvaluator);

  // 2. IAM service
  const iamService = createIamService({
    db: fastify.db,
    auditService: fastify.auditService, // decorated by audit plugin (in dependencies)
    eventBus: fastify.eventBus,
    policyEvaluator,
    // getPrimaryOffice, getCommitteeIds, resolveActiveDelegationGrant: intentionally omitted.
    // createIamService defaults all three to safe no-ops (see TASK-IAM-006, "Org-context
    // resolver design"). [RESOLVED — see Module Summary, "Forward note for the ORG module"]
    // The ORG module's Step 2 pass adds a task that edits ONLY this object literal — passing
    // three adapter functions backed by fastify.organizationService — and does not otherwise
    // touch iam.service.ts, iam.middleware.ts, or this plugin file.
  });
  fastify.decorate('iamService', iamService);

  // 3. tRPC router (decorated for merger in trpc plugin)
  fastify.decorate('iamTrpcRouter', createIamRouter(fastify));

  // 4. REST routes — two nested scopes: public and protected
  await fastify.register(
    async (publicScope) => {
      // No authMiddlewarePlugin here; these routes are unauthenticated
      await registerIamRoutes(publicScope, iamService, policyEvaluator, { public: true });
    },
    { prefix: '/api' },
  );

  await fastify.register(
    async (protectedScope) => {
      await protectedScope.register(authMiddlewarePlugin);
      await registerIamRoutes(protectedScope, iamService, policyEvaluator, { public: false });
    },
    { prefix: '/api' },
  );
}

export default fp(iamPlugin, {
  name: 'iam',
  dependencies: ['database', 'event-bus', 'audit'],
});
```

## registerIamRoutes() — route partitioning

The `public: boolean` option controls which routes are registered in which scope:

- Public scope (no auth): POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/unlock
- Protected scope (auth preHandlers): POST /api/auth/logout, POST /api/auth/lock,
  POST /api/admin/sessions/:id/terminate

## app.ts registration order

```typescript
// /apps/server/src/app.ts
import databasePlugin from './infrastructure/database.plugin';
import eventBusPlugin from './infrastructure/event-bus.plugin';
import auditPlugin from './modules/audit/audit.plugin'; // Wave B, no module deps
import iamPlugin from './modules/iam/iam.plugin'; // Wave B, depends on audit
// organization, documents, workflow, tracking, notifications: add when their tasks run

export async function buildApp(opts?: FastifyServerOptions) {
  const fastify = Fastify({ logger: true, ...opts });
  await fastify.register(databasePlugin);
  await fastify.register(eventBusPlugin);
  await fastify.register(auditPlugin);
  await fastify.register(iamPlugin);
  // await fastify.register(organizationPlugin);  // add when TASK-ORG-010 completes
  await fastify.register(trpcPlugin); // merged tRPC router — must come last
  return fastify;
}
```

## TypeScript module augmentation (ensure in iam.types.ts)

```typescript
declare module 'fastify' {
  interface FastifyInstance {
    iamService: IamService;
    policyEvaluator: PolicyEvaluator;
    iamTrpcRouter: ReturnType<typeof createIamRouter>;
  }
}
```

## fp() call semantics

`fp()` breaks Fastify's encapsulation — decorations set inside `iamPlugin` are visible
to the parent scope and all plugins registered after IAM. The `dependencies` array causes
Fastify to throw at startup if 'database', 'event-bus', or 'audit' plugins are not yet
registered, replacing runtime NullPointerErrors with a clear startup error.

Confirm before submitting:

- [ ] `pnpm build` succeeds; `pnpm dev` starts with no plugin registration errors
- [ ] `pnpm typecheck` passes
- [ ] fastify.iamService and fastify.policyEvaluator accessible in downstream plugins
- [ ] POST /api/auth/login reachable (returns 400 or 401 — not 404)
- [ ] tRPC iam.\* procedures callable from the SPA
- [ ] Login succeeds end-to-end with no organization module registered (default resolvers sufficient)

---

## Module Summary — IAM

```
Total tasks:           14
Wave:                  B (parallel with AUDIT; after INFRA Wave A)
First executable:      TASK-IAM-001 (requires only TASK-INFRA-005, TASK-INFRA-006)
Estimated PR size:     Each task = 1 PR; average ~3–8 files changed per PR
```

### Spec Gaps Identified — RESOLVED 2026-06-25

Both gaps below were originally recorded when this file was generated (2026-06-24) and are
resolved as of this revision. Resolution authorized directly by the project owner, who granted
explicit authority to edit this file, other pre-dev documents, and A1-AGENTS.md's normal
"a human resolves spec gaps" restriction for this specific resolution pass — see the chat
record for that authorization; it is not re-derived from any pre-dev document.

**[RESOLVED — committee_ids (cid) and primary office (oid) JWT claims]**
Original gap: both claims depend on `organization` schema data, but the ORG module (Wave C) is
built after IAM (Wave B), so `iam.service.ts` cannot import anything from it at the time
TASK-IAM-006 is implemented. The three candidate mechanisms named in the original gap text —
IAM service option callback, cross-schema direct SQL, ORG-event subscription — are no longer
all live options:

- **Cross-schema direct SQL** is ruled out, not just discouraged: B2's Enforcement Mechanisms
  state a direct cross-module schema query is blocked in code review with exactly one named
  exception (Search Meta's Phase 1 `documents.tsvector` read, ADR-B2-5) — this is not that
  exception.
- **ORG-event subscription** is ruled out by B2's own sync-vs-async decision rule: "Use the
  Published API (sync) when the caller needs a return value to proceed... the action must
  complete atomically with the caller's transaction." Login must embed `oid`/`cid` in the JWT
  before it can respond; an async event has no defined arrival time relative to that response.
- **IAM service option callback** — chosen. `IamServiceDeps` gains three optional functions
  (`getPrimaryOffice`, `getCommitteeIds`, `resolveActiveDelegationGrant`), each defaulting to a
  safe no-op, exactly mirroring the pattern TASK-IAM-004's Gate 4 already established in this
  same module for the structurally identical problem (DOCS module not yet built;
  `getAllowlistRoles?` defaults to `[]`). Full design, code, and rationale are in TASK-IAM-006
  ("Org-context resolver design"); the consuming sites are TASK-IAM-006 (login), TASK-IAM-007
  (refresh, via the same shared helper), and TASK-IAM-005 (Hook 2, see below). No new task ID
  was needed in this module — this is a Deps-shape and call-site change within already-planned
  tasks, not new work.

This also addressed two related problems found while resolving the above, not originally flagged
as separate gaps in this file:

**[RESOLVED — Hook 2 cross-schema SQL was a Law #2 violation, not a Phase 1 placeholder]**
TASK-IAM-005's `loadDelegationContext` hook read `organization.delegation_grants` via direct
SQL, annotated only as "Cross-schema direct SQL in Phase 1; OrganizationService not yet
available" — stated as a Phase 1 convenience, but it is the same forward-dependency problem as
`oid`/`cid`, and B2's Enforcement Mechanisms make no Phase 1 exception for it. Fixed with the
same mechanism: a third optional `resolveActiveDelegationGrant` function on `IamServiceDeps`,
defaulting to `async () => null`, exposed on `IamService` for the middleware to call.

**[RESOLVED — `oid` typed and placeholdered as a non-nullable empty string]**
TASK-IAM-002's `AuthContext.officeId` was typed `string`, and TASK-IAM-006 set the Phase-1
placeholder to `''`. Two independent problems with this, not one: (1) `''` is not a valid UUID,
and B5 §6.3's RLS session-var hook casts this value `::uuid` in policy expressions —
`set_config('app.current_office_id', '', true)` followed by any policy's `::uuid` cast throws
`invalid input syntax for type uuid` on every request from a user with no resolved office,
which in Phase 1 is every user, since ORG does not exist yet. (2) Even after ORG exists, not
every `iam.users` row necessarily resolves to an office — `organization.employees.user_id` is
nullable by design (C1 Part 4: "not every employee has a platform account," and the relationship
holds in both directions: not every user has an employee row either), so "no primary office" is
a permanent, legitimate state, not only a Phase-1 gap. Changed `oid`/`AuthContext.officeId` to
`string | null` throughout (TASK-IAM-002, TASK-IAM-005, TASK-IAM-006). This is independently
consistent with ADR-UI-012 (frontend, accepted 2026-06-19, predates this file), which already
specified the equivalent frontend field `officeScopeId: z.string().uuid().nullable()` —
this resolution did not have to invent that nullability decision, only propagate it to where
the IAM module's own types and the JWT claim had not yet caught up to it. ABAC office-scope
checks already use array-membership comparisons (`document.office_id ∈ subject.effective_office_ids`,
I1 §3.2), where a `null` office safely fails to match any real document — confirmed by reading
I1's existing comparison logic, not assumed.

**[RESOLVED — TASK-IAM-006's login response body contradicted the accepted frontend design]**
Found while updating TASK-IAM-006 for the above: it specified `POST /api/auth/login` returning
an empty body (`200 {}`), but F2 §5 and ADR-UI-012 (accepted 2026-06-19) require the login
response to carry `AuthResponseSchema` — `user`, `sessionId`, `expiresAt`, `roleCodes`,
`officeScopeId`, `officeCode` — so `useSessionStore` can hydrate synchronously with no second
round-trip, which is the entire point of that ADR's decision. This is not a new design choice;
ADR-UI-012 was already "Accepted" five days before this file's original generation date, and
this file's IAM Step 2 pass simply never loaded F2 or its ADRs — A1-AGENTS.md §2's Pass Types
table does not list any F-series document in the IAM module's Read column, so the prior pass
had no path to discover this. TASK-IAM-006 now returns the `AuthResponseSchema`-shaped body.
E3's `AuthResponseSchema` itself was also still missing the three fields ADR-UI-012 already
called for — also addressed; see this resolution's changes to E3 below. Tokens remain cookie-only;
nothing about where the JWT/refresh token live changed.

### Cross-document changes made as part of this resolution

- **B5** (`b5-authentication-and-authorization-architecture.md`): §1.1 — added the missing `cid`
  row to the JWT Private Claims table (I1 introduced `cid` as D-ABAC-06 after B5 was written;
  B5's own claims table was never updated to include it — found while correcting `oid`, corrected at
  the same time since both rows are in the same table); marked `oid` nullable with a short
  rationale and a pointer to this Module Summary's longer explanation. §5.6 — flagged the
  office-assignment-uniqueness ambiguity as an open question (does not resolve it). §5.7 — noted
  the delegation-grant lookup's access mechanism is now resolved via Organization's Published
  API, not direct SQL. §12 — added the office-assignment-uniqueness item as a new row, with an
  explicit account of why it doesn't block Wave B or Wave C, per this same Module Summary's
  "Open questions for the developer" item 1.
- **I3** (`i3-security-design-document.md`): §4.1.2 and §5.1 — same `cid`/`oid` corrections as B5,
  for the same reason (I3's private-claims and subject-attribute tables are second copies of the
  same information and would otherwise now contradict the corrected B5 tables). §18.2 — added
  the same new office-assignment-uniqueness row as B5 §12, for the same reason.
- **B2** (`b2-module-boundary-and-internal-api-contracts-v1.1.md`) Module 2 (Organization):
  added `getPrimaryOfficeForUser()`, `getCommitteeIdsForUser()`, and `getDelegationGrantById()`
  to the Organization Published API, and added IAM as a caller of all three in the Published
  API Call Matrix and the Module Dependency Map. This gives the ORG module's future Step 2 pass
  a concrete target interface to implement, rather than leaving the "real" side of the
  IAM-owned resolver functions undefined anywhere.
- **E3** (`e3-shared-zod-schema-catalog.md`): extended `AuthResponseSchema` with `roleCodes`,
  `officeScopeId`, `officeCode`, per ADR-UI-012's already-accepted decision (this is the E3 edit
  that ADR-UI-012's own "Consequences" section already said was required and had not yet been
  made — not a new decision introduced here).
- All four documents' Tables of Contents (B5, B2, E3 — I3's left for the project owner to redo)
  were corrected for the line-number drift these edits caused, since each used a line-numbered
  ToC convention. Verified mechanically against each file's actual header positions, not by
  arithmetic alone, after an arithmetic-only first pass on E3 produced an off-by-one error that
  was caught and corrected.

### Forward note for the ORG module's Step 2 pass

When that pass runs (Wave C, per A1-AGENTS.md §2), in addition to its own Read list, it should
load this file's "Org-context resolver design" (TASK-IAM-006) and the three new B2 Organization
Published API methods above. It will need one new task — something like
`TASK-ORG-NNN — Wire OrganizationContextPort into IAM service` — whose AI Prompt is already
almost fully determined by this resolution: implement the three methods against
`organization.employees` → `organization.assignments` (office) / `organization.committee_memberships`
(committees) / `organization.delegation_grants` (by id), then edit only the `createIamService({...})`
call site in TASK-IAM-014's `iam.plugin.ts`, adding three adapter functions that call
`fastify.organizationService`. No other IAM file changes. This is not generated as a full task
here — A1-AGENTS.md §2's Pass Types table requires the ORG pass to load the IAM and AUDIT task
lists in order, which this file doesn't have authority to do on ORG's behalf — but the shape of
that one task is determined by this resolution, not open for the ORG pass to redesign.
**[RESOLVED — ADR-AUTH-011, 2026-06-26]** The `getPrimaryOfficeForUser` tie-break rule is now
defined: return the `organization.assignments` row where `is_primary = true AND is_active = true
AND deleted_at IS NULL`. At most one such row per employee is guaranteed by the partial unique
index `uq_assignments_one_primary_per_employee`. If no `is_primary` row exists, returns `null`.

### Resolved developer decisions (2026-06-26)

**[RESOLVED — 2026-06-26, ADR-AUTH-011] 1. "Primary office" tie-break in `organization.assignments`.**

Decision: **Option (c)** — add an explicit `is_primary BOOLEAN NOT NULL DEFAULT false` column to
`organization.assignments`. The application layer (ORG module service) is responsible for
maintaining the one-primary-per-employee invariant atomically: a "set primary" operation must
unset any other `is_primary = true` row for the same `employee_id` within the same transaction.
A partial unique index serves as a DB-level safety net:

```sql
CREATE UNIQUE INDEX uq_assignments_one_primary_per_employee
    ON organization.assignments (employee_id)
    WHERE is_primary = true AND is_active = true AND deleted_at IS NULL;
```

`getPrimaryOfficeForUser`'s concrete query is now: `SELECT office_id, office_code FROM
organization.assignments WHERE employee_id = :id AND is_primary = true AND is_active = true
AND deleted_at IS NULL LIMIT 1` — returning `null` if no row matches.

Rationale: concurrent active assignments are confirmed possible for Batac City LGU staff (ruling
out option a — hard DB constraint). An explicit flag is more transparent and auditable than an
implicit start-date or authority-level ordering (option b), which produces non-deterministic
results on ties. The partial unique index provides corruption protection while allowing
multi-assignment data.

Cross-document effects (all applied 2026-06-26):

- C1 DDL: `is_primary BOOLEAN NOT NULL DEFAULT false` + `uq_assignments_one_primary_per_employee` added to `organization.assignments`.
- C2 ERD: `bool is_primary` added to ASSIGNMENTS entity.
- E3: `isPrimary: z.boolean()` added to `AssignmentSelectSchema`.
- B2 Module 2: `getPrimaryOfficeForUser` doc-comment updated — open-question `[Inference]` note replaced with `[RESOLVED — ADR-AUTH-011]`.
- B5 §11: D-AUTH-11 row added; §12 Office-assignment-uniqueness row updated to resolved.
- I3 §18.1: row 16 (D-AUTH-11) added; §18.2 item updated to resolved.
- ADR-UI-012: "Open Follow-Up" section closed.

---

**[RESOLVED — 2026-06-26] 2. `POST /api/auth/refresh` response body and UI re-hydration.**

Decision: **Silent/cookie-only** — the refresh endpoint returns `200 {}` (empty body) as currently
designed in TASK-IAM-007. `useSessionStore` does not re-hydrate from a background refresh call.
Role, office, and committee changes take effect at the user's next full login. Displaying a
potentially-stale permission set between logins is an accepted product trade-off for this system.
No changes are needed to TASK-IAM-007's response body design.

Rationale: silent background token renewal is a UX-smoothness mechanism, not a re-authentication
event. Re-hydrating the store on every background refresh would require returning identity data
(role codes, office scope, committee ids) on every access-token renewal, adding non-trivial
payload overhead and an SPA code path that F2 does not currently describe. Given the low rate
of role/office/committee reassignments in the Batac City LGU context (administrative staff roles
are typically stable), staleness until next login is an acceptable trade-off. If real-time
propagation is later required (e.g., for sensitive permission escalations during an active
session), a server-sent event or a separate `/api/auth/identity` endpoint can be introduced
without changing the refresh contract.

Cross-document effects: none — TASK-IAM-007's existing `200 {}` design is already correct;
this entry formally closes the open-question framing that was left in that task's AI Prompt.

### Deferred Capabilities (not in Phase 1 scope)

**[DEFERRED — Phase 2: MFA TOTP enforcement and enrollment]**
B5 §10.5. The MFA hook is wired in TASK-IAM-006 as a no-op conditional guarded by
`user.mfa_enabled`. Phase 2 activation requires: setting `MFA_REQUIRED_ROLES` env var,
implementing `POST /api/auth/mfa/verify` endpoint, and implementing the TOTP enrollment
flow (iam.mfa_records inserted at verified-enrollment completion only).

**[DEFERRED — Phase 2: SSO / external IdP token exchange]**
B5 §9. Architecture is designed to support future OAuth 2.0 / OIDC-compliant IdP
integration. Phase 1 uses PKCE with the internal server as both authorization server and
resource server. External IdP integration requires a callback handler
`POST /api/auth/callback` and an `external_idp_sub TEXT` column on iam.users. No Phase 1
tasks cover this.

**[DEFERRED — Phase 3: Citizen portal authentication]**
Citizens authenticate via a separate mechanism scoped to Phase 3. No citizen-facing
login flow is in Phase 1 IAM scope.

**[DEFERRED — Phase 5: PhilSys identity verification]**
B5 §9.5, feature-flagged via `PHILSYS_ENABLED=false` env var. Not activated until the
PhilSys API integration is available; assigned to the Portal module (Phase 5).
