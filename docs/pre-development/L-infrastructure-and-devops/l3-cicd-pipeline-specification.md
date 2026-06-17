# L3 — CI/CD Pipeline Specification

**Document:** L3
**Platform:** Batac City LGU Platform
**Status:** Early-dev — implement in the first week of development; not a pre-dev prerequisite
**Last Updated:** June 2026
**Audience:** Development team
**Source Documents:** `k1-test-strategy.md`; `l2-docker-compose-specification.md`; `2-stack-context.md`
**Prerequisites:** L2 — Docker and Docker Compose Specification; K1 — Test Strategy

---

## About This Document

This document specifies the CI/CD pipeline for the Batac City LGU Platform monorepo. It defines what runs in each pipeline stage, which stages must pass before a branch may merge to `main`, how Turborepo remote caching is configured, and how staging and production deployments are triggered and gated.

**Why early-dev, not pre-dev.** L2 must be finished before any developer sets up a local environment. L3 can wait because CI has nothing meaningful to run until at least lint, typecheck, and a handful of unit tests exist. The target is to have CI passing on every PR before the first feature branch is merged to `main` — practically, by the end of the first week of active development.

**Reference implementation: GitHub Actions.** All stage definitions, job structures, and YAML excerpts use GitHub Actions syntax. The pipeline concepts (stages, dependency ordering, environment scoping, secrets) transfer directly to GitLab CI or any other provider if the team migrates.

**What this document does not cover:**

- Infrastructure provisioning (Terraform/Pulumi for the VPS; that is a separate IaC document not yet in the plan)
- Database backup, PITR, or DR procedures — that is L4
- The local development setup — that is L2
- Individual test case definitions — those belong in test files; K1 defines scope and priorities

---

## 1. Design Principles

**The pipeline enforces the same priority order K1 establishes.** Unit tests run before integration tests. Integration tests run before E2E tests. Nothing slower gates something faster. A CI pipeline that makes a developer wait eight minutes for lint to fail on a trivial syntax error is a broken pipeline.

**Merge gates are narrow and fast.** Only four stages block a PR merge: lint, typecheck, unit tests, and integration tests. The build stage also blocks merge as proof the production artifacts compile. E2E tests run on merge to `main` — not on every PR — because they require a real browser session and are an order of magnitude slower. A failed E2E run does not roll back a merge but does block a production deployment tag.

**Turborepo determines what actually runs.** Every stage invokes a Turborepo task rather than running commands directly against individual packages. Turborepo uses its task graph and cached outputs to skip work whose inputs have not changed. A PR that only modifies `apps/web` does not re-run server unit tests if the server's inputs are unchanged. This keeps CI fast as the codebase grows without requiring the team to maintain per-package job matrices manually.

**No shared mutable state between CI runs.** The test PostgreSQL instance is created fresh per run, migrated from scratch using the same `entrypoint-migrate.sh` and `entrypoint-seed.sh` scripts that L2 defines, and destroyed after the run. No CI database persists between runs.

**Coverage metrics are never a gate.** K1 is explicit: coverage is collected for informational purposes and stored as a CI artifact. No threshold exists. No stage fails because line coverage dropped. This remains true indefinitely.

---

## 2. Pipeline Topology

Two distinct pipeline configurations exist, triggered by different events.

### 2.1 Pull Request Pipeline (merge gate)

Triggered on: every push to a PR branch targeting `main`.

```
┌──────────────────────────────────────────────────────────────┐
│  Job A — quality (runs in parallel)                          │
│    step: lint        pnpm turbo run lint                     │
│    step: typecheck   pnpm turbo run typecheck                │
└──────────────────────────────────────────────────────────────┘
                              │
                    (both steps must pass)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Job B — test:unit                                           │
│    pnpm turbo run test:unit                                  │
│    Budget: 60 seconds                                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Job C — test:integration                                    │
│    services: postgres:17-alpine, minio/minio                 │
│    run migrate → seed → pnpm turbo run test:integration      │
│    Budget: 5 minutes                                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Job D — build                                               │
│    pnpm turbo run build                                      │
│    Validates production artifacts compile cleanly            │
└──────────────────────────────────────────────────────────────┘
```

All four jobs must pass. A failing job blocks merge. The PR branch is never merged to `main` with a failing CI run.

### 2.2 Main Branch Pipeline

Triggered on: push to `main` (i.e., after a PR merges).

```
Jobs A → B → C → D    (same as PR pipeline; must pass to proceed)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Job E — test:e2e                                            │
│    Deploy to staging environment                             │
│    Run Playwright suite against live staging stack           │
│    Budget: no hard limit; expected < 15 minutes              │
└──────────────────────────────────────────────────────────────┘
                              │
                    (must pass to proceed to production)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Job F — deploy:staging (auto; already completed in Job E)   │
│    Staging is updated as a prerequisite of E2E               │
└──────────────────────────────────────────────────────────────┘
                              │
               (manual approval required — environment gate)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Job G — deploy:production                                   │
│    Manual gate: requires explicit approval from a designated │
│    deployer (IT Office representative or team lead)          │
│    Only reachable after E2E tests pass on staging            │
└──────────────────────────────────────────────────────────────┘
```

A failed E2E run (Job E) does not roll back the merge to `main` but blocks Job G. Production is never updated while E2E tests are failing on staging.

---

## 3. Stage Definitions

### 3.1 Lint

**Turborepo task:** `lint`  
**Defined in:** each package's `package.json` `scripts.lint` field, wired via Turborepo's `turbo.json` pipeline  
**Tool:** ESLint with the shared config from `@batac/config`  
**Scope:** all packages — `apps/server`, `apps/web`, `packages/shared`, `packages/ui`, `packages/database`  
**Must pass for merge:** yes

The lint task runs ESLint across all packages in the dependency order Turborepo computes. Packages whose source files have not changed since the last successful run are skipped via cache. The output is a per-package lint report; any error-level finding fails the step.

Lint warnings do not fail CI. The shared ESLint config treats warnings as informational only. If a finding is important enough to block a merge, it must be an error in the config.

### 3.2 Typecheck

**Turborepo task:** `typecheck`  
**Tool:** `tsc --noEmit` using each package's `tsconfig.json`  
**Scope:** all packages  
**Must pass for merge:** yes

TypeScript compilation errors anywhere in the type-safety chain (Drizzle schema → Zod → shared types → tRPC procedures → React components) fail this step. The type-safety chain described in `2-stack-context.md` means that a DB schema change propagates as a compile error to every consuming layer; typecheck in CI is what makes that guarantee operational.

Lint and typecheck run as steps within the same job (Job A) and execute in parallel via Turborepo's task scheduler when their dependency graphs permit. The job fails if either step fails.

### 3.3 Unit Tests

**Turborepo task:** `test:unit`  
**Tool:** Vitest  
**Scope:** all packages; test files located under `src/__tests__/unit/` or equivalent per K1  
**Must pass for merge:** yes  
**Budget:** 60 seconds total across all packages

No database connection. No Fastify server. No network. Pure functions, state machine transition logic, Zod schema validators, and SLA computation functions only. See K1 Section 5 for the full scope.

The Vitest configuration for unit tests excludes any file that imports database modules, Fastify, or `pg`. A test file that accidentally reaches outside the unit boundary fails the import resolution step, making the violation immediately obvious.

Coverage is collected in this step with `--coverage` and the report is uploaded as a GitHub Actions artifact. The report is never used as a pass/fail gate.

### 3.4 Integration Tests

**Turborepo task:** `test:integration`  
**Tool:** Vitest + `@fastify/inject` + live PostgreSQL + live MinIO  
**Scope:** workflow engine entry points, ABAC-protected routes, DB constraint enforcement, event bus wiring — see K1 Section 6  
**Must pass for merge:** yes  
**Budget:** 5 minutes

Integration tests require two service containers spun up by the CI environment before Vitest runs: a PostgreSQL instance (version 17) and a MinIO instance. Both must be healthy before the test runner starts.

**Service container configuration (GitHub Actions excerpt):**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ci_postgres_password
      POSTGRES_DB: batac_lgu_test
      DB_APP_PASSWORD: ci_app_password
      DB_AUDIT_PASSWORD: ci_audit_password
      DB_MIGRATE_PASSWORD: ci_migrate_password
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10

  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    env:
      MINIO_ROOT_USER: ci_minio_access
      MINIO_ROOT_PASSWORD: ci_minio_secret
    ports:
      - 9000:9000
    options: >-
      --health-cmd "curl -f http://localhost:9000/minio/health/live"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```

**Before Vitest runs, the test database is bootstrapped in three steps:**

1. Role bootstrap: run `tools/scripts/docker/postgres-init/01-create-roles.sh` targeting the CI postgres instance to create `app_user`, `audit_user`, and `migrate_user`.
2. Migration: run `tools/scripts/docker/entrypoint-migrate.sh` (Drizzle Kit migrations + pgboss schema bootstrap) via `DATABASE_URL_MIGRATE`.
3. Seed: run `tools/scripts/docker/entrypoint-seed.sh` to load fixtures.

These are the same scripts L2 defines for local development. CI uses no separate mechanism; parity with local development is guaranteed by using the same entry points.

**Meilisearch is not present in CI for Phase 1.** The `--profile phase2` services are not started. Any code path that would reach Meilisearch must be behind the search abstraction layer specified in `2-stack-context.md`; in Phase 1, that layer delegates to PostgreSQL FTS and no Meilisearch connection is attempted.

Integration test files run sequentially within each file and may run in parallel across files (separate Vitest workers), each operating within its own database transaction scope per K1 Section 6.2.

### 3.5 Build

**Turborepo task:** `build`  
**Tool:** Turborepo orchestrating `tsc` (server) and Vite (web)  
**Scope:** `apps/server` and `apps/web`; all upstream packages  
**Must pass for merge:** yes

The build step uses the `build` Dockerfile target defined in L2 Section 6. It does not run the full Docker build in CI for every PR (that would be too slow); instead it runs `pnpm turbo run build --filter=@batac/server... --filter=@batac/web...` directly on the CI runner to verify the production TypeScript compiles and Vite bundles without errors.

The full Docker image build (targeting the `production` Dockerfile stage) runs only on the main branch pipeline (Job D equivalent on `main`), immediately before staging deployment. On PRs, the TypeScript/Vite build is sufficient to catch contract breakage.

Turborepo caches the build output under `.turbo/`. If neither the server's nor the web's inputs changed since the last successful build, the build step is a cache hit and completes in seconds.

### 3.6 E2E Tests (main branch only)

**Tool:** Playwright  
**Scope:** the five or six most critical user journeys — see K3 (when written)  
**Runs on:** push to `main` and on release candidate tags  
**Does not run on:** PR branches  
**Blocks production deployment:** yes — a failing E2E run prevents Job G from being triggered  
**Does not block PR merge:** by design (K1 Section 7)

E2E tests run against the **live staging environment** after it has been updated. They are not run against a local or ephemeral environment inside the CI runner. This means Job E is structurally: deploy to staging → run Playwright against staging → report.

Playwright is not invoked via Turborepo because it exercises a deployed environment, not a package in the monorepo. It is a raw `npx playwright test` step in the CI job.

The workflow engine is never stubbed or mocked during E2E runs. If the engine is broken, E2E tests must fail.

### 3.7 Deploy — Staging (automatic, main branch only)

Staging is deployed automatically on every successful merge to `main`, as a prerequisite step of Job E. This means staging always tracks `main`. There is no manual trigger or approval for staging.

**Deployment mechanism (to be confirmed against the actual VPS configuration):** SSH into the staging VPS → `docker compose pull` + `docker compose up -d` using the production Dockerfile image built in the current CI run, or a direct `docker stack deploy` if the VPS runs Swarm. The exact command is an implementation detail left to the team; this document fixes the trigger and gate logic, not the deploy command.

**Staging environment variables** are injected from a GitHub Actions environment named `staging`, which scopes secrets to jobs that explicitly request that environment. Staging credentials are distinct from production credentials at the secrets level.

### 3.8 Deploy — Production (manual gate)

Production deployment is triggered manually. After Job E (E2E tests) passes, GitHub Actions presents a pending deployment on the `production` environment that requires explicit approval from one or more designated reviewers configured in the GitHub environment settings. The designated reviewers are the team lead and the LGU IT Office representative.

The manual gate is implemented using GitHub Actions environment protection rules (`required_reviewers`). A job that targets the `production` environment will not execute until an approver clicks "Approve and deploy" in the GitHub UI.

No production deployment occurs without a passing E2E run on staging. The job dependency graph enforces this: `deploy:production` depends on `test:e2e`, which only runs after staging is updated.

---

## 4. Merge Gate Summary

| Stage | Blocks PR merge | Blocks production deploy | When it runs |
|---|---|---|---|
| Lint | Yes | Yes (transitively) | Every PR push + main push |
| Typecheck | Yes | Yes (transitively) | Every PR push + main push |
| Unit tests | Yes | Yes (transitively) | Every PR push + main push |
| Integration tests | Yes | Yes (transitively) | Every PR push + main push |
| Build (TypeScript/Vite) | Yes | Yes (transitively) | Every PR push + main push |
| E2E tests (Playwright) | **No** | **Yes** | Main push + release tags only |
| Deploy staging | No | Yes (prerequisite of E2E) | Main push only |
| Deploy production | No | N/A (is the gate) | Manual, after E2E passes |

**Coverage reports** are uploaded as artifacts on unit test runs. They never appear in this table.

---

## 5. Turborepo Remote Cache

Turborepo's remote cache allows task outputs (compiled packages, test results, build artifacts) to be shared across CI runs and across developer machines. A cache hit means a task whose inputs are unchanged is skipped entirely — its outputs are downloaded from the cache instead of recomputed.

### 5.1 Phase 1 — GitHub Actions Cache (zero setup)

For the first week of development, Turborepo's remote cache is satisfied using `actions/cache` to persist the `.turbo` directory between runs. This is not a true Turborepo remote cache (which requires a cache API server), but it achieves the same effect for single-machine CI runs and requires no additional infrastructure.

```yaml
- name: Cache Turborepo outputs
  uses: actions/cache@v4
  with:
    path: .turbo
    key: turbo-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
    restore-keys: |
      turbo-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
      turbo-${{ runner.os }}-
```

This cache is per-branch and falls back to the most recent cache on any branch. It reduces CI time significantly after the first run on each branch. The limitation is that it does not share cache across concurrent PR branches — each branch builds its own cache from scratch on first run.

### 5.2 Long-Term — Self-Hosted Turborepo Remote Cache

Once MinIO is running in the staging or production infrastructure, deploy `turborepo-remote-cache` (the open-source Turborepo cache API server, `npm install -g turborepo-remote-cache`) as a lightweight service backed by MinIO. This eliminates the cross-branch limitation and shares cached outputs across all CI runs and all developer machines on the VPN.

**Configuration:**

```bash
# turborepo-remote-cache configuration (environment variables)
PORT=3080
STORAGE_PROVIDER=s3
STORAGE_PATH=turborepo-cache          # MinIO bucket name
S3_ENDPOINT=http://minio:9000         # or the staging MinIO URL
S3_ACCESS_KEY=<turbo_cache_key>
S3_SECRET_KEY=<turbo_cache_secret>
TURBO_TOKEN=<shared_api_token>        # any value; shared across CI and developers
```

**CI environment variables (once the self-hosted cache is running):**

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: batac-lgu
  TURBO_API: https://turbo-cache.internal.batac.gov.ph   # internal hostname
```

**Developer configuration (in `.turbo/config.json` at the repo root, committed):**

```json
{
  "teamId": "batac-lgu",
  "apiUrl": "https://turbo-cache.internal.batac.gov.ph"
}
```

Developers set `TURBO_TOKEN` in their shell environment (not in `.env`, which is for application variables). Cache reads are authenticated by the token; unauthenticated reads are rejected.

**Migration from Phase 1 to long-term cache:** Remove the `actions/cache` step and add the three `TURBO_*` environment variables. No changes to any `turbo.json` task definitions. Turborepo switches to the remote API automatically when `TURBO_TOKEN` and `TURBO_API` are set.

**Data sovereignty note:** This self-hosted setup stores all cached build artifacts inside the LGU's own MinIO instance. No build output is sent to Vercel's remote cache infrastructure. This is consistent with the on-premise deployment constraint and RA 10173 data sovereignty requirements.

---

## 6. Turborepo Task Configuration

The `turbo.json` at the repo root wires all CI-invoked tasks. The following is the minimum required configuration before the first CI run. Extend it as new tasks are added.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "DATABASE_URL_APP", "DATABASE_URL_AUDIT", "S3_ENDPOINT"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "out/**"]
    },
    "lint": {
      "dependsOn": [],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test:unit": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Why `test:integration` is not cached:** Integration tests run against a live database whose state is reset per run. Caching their output would allow a test run that passed against a specific fixture state to be treated as passing against a different (potentially broken) state. Integration test results are never cached.

**Why `test:unit` is cached:** Unit tests are pure functions with deterministic outputs. If no source file in the dependency closure changed, the previous result is valid. Turborepo computes the cache key from all input files and the `globalEnv` hash; if any input changed, the tests re-run.

---

## 7. Environment Configuration in CI

### 7.1 Environment Variables per Stage

CI jobs receive application environment variables via GitHub Actions secrets, not via a `.env` file (which is gitignored and must never be committed). The mapping follows the same logic as L2 Section 9: variables that differ between the container context and the outside world are overridden explicitly.

| Variable | Source in CI | Notes |
|---|---|---|
| `DATABASE_URL_APP` | Constructed from secrets | Points to the CI service container postgres at `localhost:5432` |
| `DATABASE_URL_AUDIT` | Constructed from secrets | Same CI postgres instance, `audit_user` role |
| `DATABASE_URL_MIGRATE` | Constructed from secrets | Same CI postgres instance, `migrate_user` role |
| `S3_ENDPOINT` | `http://localhost:9000` | CI MinIO service container |
| `S3_ACCESS_KEY` | `ci_minio_access` (fixed CI value) | Not a production secret |
| `S3_SECRET_KEY` | `ci_minio_secret` (fixed CI value) | Not a production secret |
| `S3_BUCKET` | `batac-lgu-ci` | CI-only bucket; destroyed after run |
| `JWT_SECRET` | `${{ secrets.CI_JWT_SECRET }}` | Must be a real secret; used in auth tests |
| `HMAC_SECRET` | `${{ secrets.CI_HMAC_SECRET }}` | Must be a real secret; used in audit log tests |
| `CITY_ID` | Hardcoded fixture UUID | Same UUID used in fixture set per K1 Section 9.2 |
| `APP_ENV` | `test` | Disables external integrations (email, SSE delivery) |

Variables that must never be real credentials in CI (PostgreSQL passwords, MinIO keys) use fixed CI-only values. They are not stored as secrets — they are plaintext in the workflow YAML, because the CI database is ephemeral and contains no real data.

Variables that must be real secrets (JWT, HMAC) are stored as repository-level GitHub Actions secrets and are scoped so that they are never exposed to E2E logs.

### 7.2 Environment Scoping (Staging vs. Production)

GitHub Actions environments (`staging`, `production`) scope secrets so that a job targeting `staging` cannot access `production` secrets and vice versa. All staging-specific variables (VPS SSH key, staging database URL, staging S3 credentials) live exclusively in the `staging` environment. Production variables live exclusively in the `production` environment.

The `production` environment has `required_reviewers` set. The `staging` environment does not — it deploys automatically.

---

## 8. Branch and Trigger Strategy

| Event | Triggers |
|---|---|
| Push to a PR branch (targeting `main`) | Jobs A (lint + typecheck), B (unit tests), C (integration tests), D (build) |
| Push to `main` (PR merged) | All PR jobs + Job E (E2E on staging) + Job F (staging already updated) |
| Scheduled (nightly, optional) | Full pipeline including E2E; catches timing-dependent test regressions |
| Manual workflow dispatch | Any individual job group; useful for re-running a flaky E2E suite without a new commit |
| Release tag (e.g., `v1.0.0-rc1`) | Full pipeline including E2E; enables the production deploy gate |

**Branch protection rules on `main`** (set in GitHub repository settings):

- Require a pull request before merging — direct pushes to `main` are not permitted
- Require status checks to pass before merging — the four PR pipeline jobs are required checks
- Require branches to be up to date before merging — no merging stale branches
- Do not allow bypassing the above settings — applies to administrators too

---

## 9. Timing Budgets and Targets

These are enforced informally (alert when exceeded; not a hard CI failure) except where K1 sets an explicit budget.

| Stage | K1 budget | Target in practice |
|---|---|---|
| Lint | — | < 30 seconds |
| Typecheck | — | < 60 seconds |
| Unit tests | 60 seconds total | < 45 seconds with Turborepo cache hits |
| Integration tests | 5 minutes total | < 3 minutes for Phase 1 test volume |
| Build | — | < 2 minutes; < 10 seconds on cache hit |
| E2E tests | — | < 15 minutes; alert if consistently > 10 minutes |
| Full PR pipeline (Jobs A–D) | — | < 8 minutes end-to-end |

When the integration test suite grows beyond the 5-minute budget, the first remediation is to run test files in parallel workers (Vitest supports this per K1 Section 6.2 — parallel files, sequential within each file). Splitting into separate CI jobs is the escalation path.

---

## 10. Scheduler Jobs in CI

`pgboss` is configured in test mode for CI. The cron scheduler never fires on its own during a CI run. Time-dependent job evaluation (`evaluateMayorLapseTimers`, `evaluatePanlalawiganTimers`, `evaluateThursdayCutoffs`, `evaluateSlaBreaches`) is triggered explicitly by the test, not by the cron expression.

The `clock` parameter injection mechanism K1 Section 9.3 specifies — the engine receiving a `clock` function that returns a fixed `Date` rather than calling `Date.now()` internally — is the same mechanism that makes CI scheduler tests deterministic. Tests that exercise timer behavior always pass an explicit reference time. No test reads wall-clock time.

---

## 11. pnpm Installation in CI

pnpm is pinned via the root `package.json` `packageManager` field. Corepack activates the pinned version automatically. CI installs it the same way the Dockerfiles do:

```yaml
- name: Enable Corepack
  run: corepack enable

- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

`--frozen-lockfile` fails if `pnpm-lock.yaml` is out of sync with `package.json` files, catching accidental dependency drift before it reaches integration tests.

The `node_modules` directory is cached between CI jobs using `actions/cache` on the pnpm store path (`~/.local/share/pnpm/store`). This is separate from the Turborepo output cache and avoids re-downloading packages on every run.

```yaml
- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ~/.local/share/pnpm/store
    key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: pnpm-${{ runner.os }}-
```

---

## 12. Constraints and Invariants

| # | Constraint | Enforcement |
|---|---|---|
| 1 | Coverage thresholds must never block a CI stage or PR merge | No `--coverage-threshold` flag in any Vitest config; CI configuration review |
| 2 | Integration tests must run against a real PostgreSQL instance — never a mock | No `pg-mem` or `jest-mock` of DB in integration test files; code review policy |
| 3 | The workflow engine is never stubbed in E2E tests | No mock imports in Playwright test setup; confirmed by K1 Section 7 |
| 4 | Production secrets are never accessible to PR pipeline jobs | GitHub environment scoping; `production` environment secrets only accessible to Job G |
| 5 | No CI run ever uses a persistent shared test database | Service container spun up per run; no `DATABASE_URL` pointing to a shared host |
| 6 | Meilisearch is absent from CI in Phase 1 | No Meilisearch service container in any job definition until Phase 2 begins |
| 7 | `pnpm install --frozen-lockfile` on every CI run | Lockfile drift fails the install step before any test runs |
| 8 | The same bootstrap scripts (entrypoint-migrate, entrypoint-seed) run in CI and local dev | No CI-specific database setup script; direct invocation of L2 scripts |
| 9 | Turborepo remote cache stores no build artifacts outside LGU-controlled infrastructure | Self-hosted turborepo-remote-cache backed by MinIO; Vercel remote cache never used |
| 10 | A failed E2E run cannot be bypassed to trigger a production deployment | Job G has a hard `needs: [test:e2e]` dependency in the GitHub Actions workflow |

---

*This document is part of the L-series infrastructure reference set. Update it when: (1) a new Turborepo task is added that should be part of the merge gate, (2) the CI provider changes, (3) the staging or production deployment mechanism changes, or (4) K1's timing budgets are revised. K3 (Playwright E2E Specification) will cross-reference this document when written.*
