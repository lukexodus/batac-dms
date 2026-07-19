# `@batac/scripts`

Internal developer tooling for the `batac-dms` monorepo. Not published, not
part of the application runtime.

## `lint-migrations.ts`

Run via `pnpm --filter @batac/scripts lint:migrations` (or `pnpm run
db:lint` from `packages/database`, which aliases to this).

Parses every `.sql` file in `packages/database/migrations/` using the
third-party `pgsql-ast-parser` library and checks a set of project-specific
invariants (soft-delete columns present, `city_id` present on core-schema
tables, `DROP` statements carry an expand-contract comment, `CREATE INDEX`
on an existing table uses `CONCURRENTLY`, and others — see the script
source for the full list).

### Known limitation: some valid SQL is silently skipped, not linted

`pgsql-ast-parser` cannot parse every construct PostgreSQL actually accepts.
When a migration file fails to parse as a whole, this tool falls back to
parsing it statement-by-statement (split on Drizzle Kit's
`--> statement-breakpoint` markers). Any individual statement that *still*
fails to parse in that fallback is skipped — printed as a `[WARN]`, with a
line-number estimate and a preview of the statement's first line — and the
invariant checks above never run against it. The overall script can still
exit successfully ("Migration invariant linting passed successfully") even
when some statements were skipped; success only means the *parseable*
portion passed, not that every statement in the file was checked.

Known categories that trigger this (see the comment in `lint-migrations.ts`
directly above the fallback's `try`/`catch` block for the current
authoritative list, since this README may not always be kept in perfect
sync with it):

- `CREATE TRIGGER`
- `CREATE POLICY` (and, by extension, a `DROP POLICY` immediately preceding
  a `CREATE POLICY` recreation of the same policy, which Drizzle Kit
  generates automatically when an `ALTER COLUMN` changes a column that an
  RLS policy depends on)
- `SECURITY DEFINER` function bodies
- `GRANT`/`REVOKE` variants
- `ALTER COLUMN ... SET DATA TYPE` with a schema-qualified target type and
  an explicit `USING` cast (e.g. converting a `text` column to a native
  Postgres enum type) — confirmed via
  `packages/database/migrations/0011_lumpy_goblin_queen.sql`, where 13 of
  15 skipped statements were exactly this pattern

**If a migration you're reviewing triggers a `[WARN] ... statement(s)
skipped` message**, check whether the skipped statement(s) fall into one of
these known categories before assuming something is wrong with your
migration. If they don't match any known category, that may be a new
pattern this tool doesn't yet handle — worth flagging so this list (and the
matching comment in `lint-migrations.ts`) can be kept current.

This is a parser-coverage limitation, not a claim that the skipped SQL
itself is invalid — statements skipped for this reason may still be
perfectly valid PostgreSQL DDL that a real Postgres instance accepts and
executes correctly.
