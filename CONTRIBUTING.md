# Contributing to Batac City LGU Platform

This is a short pointer document. The actual conventions live in a few places under `docs/`, written in more depth than belongs here — this file just tells you where to go, in order.

## Before you write any code

**Read `AGENTS.md` at the repo root first.** It's not optional context — it's a routing table that maps your task type (writing a workflow step, a tRPC router, a migration, a Zod schema, and so on) to the specific documents you need to read before touching that code, in the order to read them in. It also explains what to do when no document answers your question, and how the source-of-truth hierarchy works when two documents disagree. Don't open anything else under `docs/` until you've matched your task to a row in that table.

## Setup

```bash
pnpm install
cp .env.example .env        # fill in real values
docker compose -f compose.yml up -d   # Postgres, MinIO, Mailpit, Meilisearch
pnpm dev
```

Full setup detail, including the three-role database URLs (`batac_app`, `batac_audit`, `batac_migrate`) and why they're separate, is in the main [README](./README.md).

## Branching, commits, and PRs

Full detail is in [`docs/collaboration/git-workflow-guide.md`](./docs/collaboration/git-workflow-guide.md). The short version:

- **Branch names** follow `feature/`, `fix/`, or `research/` prefixes — see the guide's Repository Structure section for the exact convention.
- **Commits** are prefixed with module scope and task ID:
  ```
  feat(wf): [TASK-WF-008] enforce Thursday cutoff in workflow transitions
  fix(iam): [TASK-IAM-005] resolve duplicate session cookie bug
  docs: update system architecture diagram in B1
  ```
- **PR titles** start with the task ID and any relevant tags: `[TASK-UI-001][MIGRATION] Foundation PR`.
- **PR checklist** (full version in the guide): summary of changes and why, testing details, verification steps for reviewers. UI component PRs additionally need a link to the component's `/dev/{component-name}` route and proof of accessibility auditing (F6).

## Code style

Full detail is in [`docs/pre-development/J-software-design-patterns-and-standards/j3-coding-standards-and-conventions.md`](./docs/pre-development/J-software-design-patterns-and-standards/j3-coding-standards-and-conventions.md) — TypeScript strictness rules, naming conventions, and the rest. Read it once; most of it is enforced by lint/typecheck anyway, so you'll mostly notice it when CI tells you.

## Before opening a PR

From the repo root:

```bash
pnpm typecheck
pnpm lint
pnpm test:unit          # and pnpm test:integration if your change touches integration-tested code
```

A note on that last one: the git workflow guide refers to this step as `pnpm test`. There's no `test` script at the repo root — each package defines its own (`apps/server`, for instance, runs `vitest run`). If you want to run a single package's test script directly rather than the root `test:unit`/`test:integration` split, use `pnpm --filter <package-name> test`.

**On `db:lint`:** `turbo.json` defines a `db:lint` task, and [`c5-migration-strategy-and-conventions.md`](./docs/pre-development/C-database/c5-migration-strategy-and-conventions.md) describes it as a required, merge-blocking CI check for any PR touching `/packages/database/`. As of this writing, `.github/workflows/ci.yml` does not actually invoke it — CI currently runs `lint-typecheck` and `unit-tests` only. This gap is already logged as [`LOG-0016`](./docs/development-findings-log.md) in the findings log, with an open question for a human to confirm whether `db:lint` is meant to be wired in. If your PR touches `/packages/database/`, it's worth running `pnpm --filter @batac/scripts lint:migrations` yourself in the meantime rather than assuming CI will catch it.

## If you hit a question no document answers

This happens by design — not every implementation-level question gets pre-decided. Per `AGENTS.md`: don't guess silently, and don't block the whole task on it either.

1. Implement the most conservative reasonable default.
2. Label it `[Inference]` (a reasoned default) or `[Speculation]` (an unconfirmed guess) in your PR description.
3. Append an entry to `docs/development-findings-log.md` describing the gap and what you did — this is the durable record; a PR description isn't searchable by the next person who hits the same question. See that file's own header for the entry format.

Agents and contributors never edit `AGENTS.md`, `A1-AGENTS.md`, `document-list.md`, or any Group B–L architecture document based on something learned mid-implementation, even if the fix looks obvious. Log a finding instead and let a human decide whether it warrants a source-document change.
