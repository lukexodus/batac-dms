# ADR-L2-07 — Node.js Runtime Version

**Status:** Decided  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-07  
**Author:** Architecture review

---

## Context

All Dockerfiles in the project currently use `node:20-alpine`. The open decision notes that Node.js 22 reached LTS status in October 2024 and is a valid alternative.

Node.js LTS schedule as of mid-2026:

| Version | Status | Active LTS start | Maintenance end |
|---------|--------|-----------------|-----------------|
| 20 | Maintenance LTS | October 2023 | April 2026 |
| 22 | Active LTS | October 2024 | April 2027 |
| 24 | Current (non-LTS) | April 2025 | October 2025 (if it follows the pattern) |

Node.js 20 entered Maintenance LTS mode in April 2026, meaning it receives only critical security fixes. Node.js 22 is the current Active LTS line and receives active bugfixes through October 2026, followed by maintenance through April 2027.

The stack is built on Fastify with tRPC v11, TanStack Query, Drizzle ORM, and Zod — all of which have declared Node 20+ as their minimum and are tested on Node 22.

---

## Decision

**Upgrade to `node:22-alpine` across all Dockerfiles.**

Node.js 20 is in Maintenance LTS as of this decision date (June 2026). Active LTS security patches flow to Node 22, not Node 20. Remaining on Node 20 means the project starts its production life on a maintenance-only runtime, which is the wrong side of the LTS curve for a new system being built to run for years.

Rationale:

1. **Active LTS is the correct baseline for new production systems.** Node 22 is the current Active LTS release. Maintenance LTS (Node 20) receives security backports but not feature or performance improvements. New projects should not begin on a Maintenance LTS line.

2. **No ecosystem blockers.** All stack dependencies (`fastify`, `@trpc/server`, `drizzle-orm`, `zod`, `@aws-sdk/client-s3`, `pino`, `pg`, `pgboss`, `@node-rs/argon2`) are compatible with Node 22. Node 22 is the tested minimum for several of them.

3. **Performance improvements.** Node 22 ships V8 12.x with improvements to startup time, memory usage, and `fetch` implementation stability. These are directly relevant to a Fastify-based server that handles concurrent API requests and SSE long-poll connections.

4. **Native `fetch` stability.** Node 22's native `fetch` is stable and unflagged. The stack uses native `fetch` (or `ky`) for internal service calls — Node 22 is the appropriate baseline for this.

---

## Consequences

### Required Dockerfile changes

In every `FROM node:20-alpine` line across all Dockerfiles:

```dockerfile
# Before
FROM node:20-alpine AS pruner
FROM node:20-alpine AS deps
FROM node:20-alpine AS production

# After
FROM node:22-alpine AS pruner
FROM node:22-alpine AS deps
FROM node:22-alpine AS production
```

This applies to:
- `apps/server/Dockerfile` (Part 4) — all stages
- `apps/web/Dockerfile` (Part 5) — all stages

### Status update in L2 Part 13

L2-07 moves from `20 assumed [Inference]` to `Resolved — Node.js 22 LTS`.

### Future migration

When Node.js 24 becomes LTS (expected October 2026), evaluate upgrading at that point. There is no need to chase the Current (non-LTS) line.

---

## Rejected alternative

Staying on `node:20-alpine` was rejected because Node 20 is in Maintenance LTS as of this decision date. Beginning a production deployment on a maintenance-only runtime creates an unnecessary upgrade obligation within the first year of operation.