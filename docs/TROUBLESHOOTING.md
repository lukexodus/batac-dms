# Local Setup Troubleshooting

Sharp edges in first-time `docker compose up` + `pnpm dev` setup, and how
to fix them. If something here doesn't match what you're seeing, check
`docs/development-findings-log.md` for anything more specific to your
situation before assuming this doc is wrong — it covers the common cases,
not every case.

---

## Meilisearch not running after `docker compose up -d`

**Symptom:** `FEATURE_MEILISEARCH_ENABLED=true` in `.env` but the app
can't reach Meilisearch at `http://localhost:7700`. The service isn't in
`docker compose ps` output.

**Cause:** The `meilisearch` service in `compose.yml:121-122` is gated
behind `profiles: [search]`. Plain `docker compose up -d` skips it. The
file's own header comment (line 3) documents this, but the README's
getting-started step 3 only shows the profile-less command.

**Fix:** Start with the profile flag:

```bash
docker compose --profile search up -d
```

In Phase 1, Meilisearch is not required — `SEARCH_PROVIDER=postgres` and
`FEATURE_MEILISEARCH_ENABLED=false` (the defaults in `.env.example`) mean
nothing calls Meilisearch. You only need the profile flag if you've
explicitly enabled the feature flag.

---

## Postgres init scripts didn't run: role `batac_app` / `batac_migrate` / `batac_audit` does not exist

**Symptom:** `pnpm db:migrate` or `pnpm dev` fails with something like
`role "batac_app" does not exist` or `password authentication failed for
user "batac_app"`.

**Cause:** The role-creation script `tools/db/init/01-create-roles.sh`
only runs automatically when PostgreSQL initialises against an **empty**
`postgres_data` volume (`compose.yml:29-30` mounts it into
`/docker-entrypoint-initdb.d`). If the volume already exists (from a
previous `docker compose up`), Postgres skips all init scripts entirely —
it doesn't check whether the roles are present.

**Fix:** Remove the volume and recreate the container. This **deletes all
data** in the local dev database — safe for a disposable local dev
environment, destructive against any data you care about:

```bash
docker compose down -v
docker compose up -d
```

Then re-run migrations:

```bash
pnpm --filter @batac/database db:migrate
```

---

## Migration 0002 fails with `permission denied for schema public`

**Symptom:** `pnpm db:migrate` succeeds through migration 0000 and 0001
but fails on 0002 (IAM schema) with:

```
ERROR 42501: permission denied for schema public
```

The failing statement is `CREATE OR REPLACE FUNCTION public.fn_set_updated_at()`.

**Cause:** PostgreSQL 15+ revokes `CREATE` on the `public` schema from
`PUBLIC` by default. The `batac_migrate` role (which Drizzle uses to run
migrations) needs `CREATE` on `public` to create the shared trigger
function. This was a gap in the original init scripts, fixed in
`01-create-roles.sh:56` with `GRANT CREATE ON SCHEMA public TO batac_migrate`
(citing LOG-0012 in `docs/development-findings-log.md`).

**Fix:** If your `01-create-roles.sh` already contains the `GRANT CREATE
ON SCHEMA public TO batac_migrate` line (line 56), this is already fixed
— you just need a fresh volume (see the entry above). If your copy of the
script is older and lacks that grant, pull the latest version and reset
the volume:

```bash
docker compose down -v
docker compose up -d
```

---

## MinIO init container exits with error / buckets not created

**Symptom:** `docker compose ps` shows `minio-init` as `Exit 1` (or
similar non-zero exit). No `batac-documents` or `batac-backups` buckets
in MinIO console at `http://localhost:9001`.

**Cause:** The `minio-init` service (`compose.yml:69-90`) runs once and
exits — `restart: no` (line 71) means it won't retry. It depends on
MinIO being healthy (`condition: service_healthy`), but if MinIO's
healthcheck passes before the API is fully ready to accept bucket
creation requests, the `mc` commands inside the init script can still
fail. The init script uses `--ignore-existing` on `mc mb` to be
idempotent, but a connection error during the alias-setup step
(`mc alias set local ...`) would cause a hard exit.

**Fix:**

1. Check that MinIO is actually healthy: `docker compose ps minio` — the
   status should show `(healthy)`, not just `(running)`.
2. Re-run just the init container:

```bash
docker compose up minio-init
```

If MinIO is healthy, the buckets will be created. If MinIO isn't healthy,
wait a few seconds and retry — the healthcheck has a 15-second start
period (`compose.yml:62`).

---

## S3 / MinIO authentication errors from the app

**Symptom:** The app fails to upload files or connect to MinIO with
`AccessDenied` or connection errors, even though MinIO is running.

**Cause:** The `.env.example` S3 credentials (lines 74-75) are
placeholders:

```
S3_ACCESS_KEY=minio_dev_access_key_placeholder
S3_SECRET_KEY=minio_dev_secret_key_placeholder
```

When you copy `.env.example` to `.env`, these placeholder values override
the compose.yml defaults (`minio` / `minio123456` in `compose.yml:49-50`).
MinIO starts with whatever `S3_ACCESS_KEY`/`S3_SECRET_KEY` you provide as
`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, so the credentials stay
consistent between MinIO and the app — but they'll be the placeholder
strings, not the defaults.

This works if you leave everything as-is, but breaks if you manually
change one side (e.g., update MinIO's password in compose.yml but forget
to update `.env`).

**Fix:** For local dev, use the compose.yml defaults in your `.env`:

```
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123456
```

Or use any other consistent pair — just make sure `S3_ACCESS_KEY` and
`S3_SECRET_KEY` in `.env` match `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`
that MinIO actually started with. If you've already started MinIO with
the placeholder credentials and don't want to reset volumes, you can use
the MinIO console at `http://localhost:9001` (login with whatever
credentials MinIO started with) to verify bucket existence.

---

## Three database URLs — why they exist and what breaks if you merge them

**Symptom:** Not a runtime error, but a design confusion. `.env.example`
defines three separate connection strings (lines 26-28):

```
DATABASE_URL_APP=postgresql://batac_app:...@localhost:5432/batac_lgu
DATABASE_URL_AUDIT=postgresql://batac_audit:...@localhost:5432/batac_lgu
DATABASE_URL_MIGRATE=postgresql://batac_migrate:...@localhost:5432/batac_lgu
```

All three point at the same database but use different roles. It's
tempting to collapse them into one.

**What each role does** (from `01-create-roles.sh` and the init script's
comments):

- `batac_migrate` — runs Drizzle migrations; needs `CREATE` on `public`
  schema and `ALL PRIVILEGES ON DATABASE`
- `batac_app` — runtime application DML; gets `CONNECT` only; schema-level
  grants applied by migrations
- `batac_audit` — audit log INSERT + chain-hash SELECT only; UPDATE and
  DELETE are explicitly revoked on `audit.events` (Invariant #3 / I3 §16)

**What breaks:** If you point all three URLs at `batac_app` (or any single
role), you silently defeat the audit-isolation design: the audit role
can't modify non-audit data, the app role can't touch audit tables, and
the migration role has broad DDL privileges the other two shouldn't have.
Nothing visibly breaks in local dev — the isolation exists to enforce
invariants that only matter when code bugs or misuse would otherwise
corrupt audit history or bypass RLS. Keeping the three URLs separate
ensures your local dev matches production behavior.

---

## `pnpm dev` starts but the server crashes with plugin errors

**Symptom:** Server process exits immediately with errors mentioning
`FST_ERR_PLUGIN_NOT_PRESENT_IN_INSTANCE` or missing `database` / `event-bus`
dependencies.

**Cause:** The Fastify module-plugin chain (`database.plugin.ts` →
`event-bus.plugin.ts` → audit → iam → ...) requires that earlier plugins
are registered before later ones declare them as dependencies. If the
plugin registration order in `apps/server/src/index.ts` is wrong, or if
`database.plugin.ts` / `event-bus.plugin.ts` are missing (they were
created as gap-fill infrastructure per LOG-0017 in
`docs/development-findings-log.md`), the chain breaks at startup.

**Fix:** Ensure `apps/server/src/infrastructure/database.plugin.ts` and
`apps/server/src/infrastructure/event-bus.plugin.ts` exist (they should if
you've pulled the latest code). Check the registration order in
`index.ts` — database and event-bus must be registered before any module
that lists them as dependencies.

---

## Port conflict: address already in use

**Symptom:** `docker compose up -d` fails with one of:

```
Bind for 0.0.0.0:5432 failed: port is already allocated
```
(or `:9000`, `:9001`, `:1025`, `:8025`)

**Cause:** Another service (a local Postgres, another MinIO instance, or
any process) is already bound to that port.

**Ports used by this stack** (from `compose.yml`):

| Service    | Host port | Override variable in `.env`     |
|------------|-----------|--------------------------------|
| Postgres   | 5432      | `DB_PORT_EXPOSED` (line 27)    |
| MinIO API  | 9000      | *none*                         |
| MinIO UI   | 9001      | *none*                         |
| Mailpit    | 1025, 8025| *none*                         |
| Meilisearch| 7700      | *none* (only with `--profile`) |

**Fix for Postgres:** Set `DB_PORT_EXPOSED` in your `.env` to a free port
(e.g., `5433`). The app's `DATABASE_URL_*` connection strings must also
use that port.

**Fix for other services:** Currently only Postgres has an env-variable
override in compose.yml. For MinIO or Mailpit, you'd need to edit
`compose.yml` directly or stop the conflicting local process.

---

## Tailwind utility classes missing on UI components (blank/unstyled components)

**Symptom:** Components from `packages/ui` render without any styling —
no colours, spacing, or layout — even though `pnpm dev` starts cleanly.

**Cause:** Tailwind CSS v4's `@tailwindcss/vite` plugin in `apps/web`
scans only `apps/web/src` for utility classes by default. It doesn't
automatically scan `packages/ui/src/components`, so classes used only
inside library components are omitted from the compiled CSS bundle. See
LOG-0006 in `docs/development-findings-log.md`.

**Fix:** The `@source` directives in
`packages/ui/src/styles/globals.css` already target the UI components
directory. If you're seeing this issue, check that those directives are
present:

```css
@source "../components/**/*.{ts,tsx}";
@source "../../../apps/web/src/**/*.{ts,tsx}";
```

If they're missing, you've likely checked out an older branch. Pull the
latest `packages/ui/src/styles/globals.css`.

---

## `skipLibCheck` errors when building `@batac/database` or `@batac/ui`

**Symptom:** `pnpm build` or `tsc --noEmit` fails with type errors
inside `drizzle-orm` or `recharts` `.d.ts` files (e.g., `error TS7016:
Could not find a declaration file for module 'lodash'`).

**Cause:** Third-party `.d.ts` files in `drizzle-orm` and `recharts`
contain internal type errors that surface under strict `skipLibCheck:
false`. See LOG-0005 and LOG-0007 in
`docs/development-findings-log.md`.

**Fix:** Both `packages/database/tsconfig.json` and
`packages/ui/tsconfig.json` override the base config with
`"skipLibCheck": true`. If you're seeing these errors, verify those
overrides exist in the respective `tsconfig.json` files. This only skips
type-checking of third-party `.d.ts` files — all workspace source code is
still fully type-checked.

---

## General tips (not repo-specific)

These aren't specific to this repo's code, but come up often enough in
local dev to be worth listing separately.

### Docker Desktop / Docker Engine not running

`docker compose` commands fail with "Cannot connect to the Docker daemon."
Start Docker Desktop or the Docker service before running anything.

### `pnpm` command not found / wrong version

This repo pins `pnpm@9.15.4` via `packageManager` in `package.json`.
Enable corepack first:

```bash
corepack enable
```

Then `pnpm install` will use the correct version automatically.

### Node.js version too old

Check `package.json`'s `engines` field (if present) or the `.node-version`
file. This repo targets Node.js 20+.

---

For anything not covered here, check `docs/development-findings-log.md` —
it's the append-only record of discoveries made during implementation and
covers edge cases this doc doesn't repeat.
