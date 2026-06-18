# End-to-End Type Safety Chain Document

## 1. Relevant Stack Decisions

|Layer|Choice|Hard constraint|
|---|---|---|
|Internal API|tRPC on Fastify|End-to-end type safety for `/web` — no REST for internal routes|
|External/public API|Fastify REST + OpenAPI (`@fastify/swagger`)|Required for portal, mobile, third-party, or non-TS clients|
|ORM|Drizzle ORM + Drizzle Kit|Full PostgreSQL feature access with TypeScript inference|
|Validation / contracts|Zod (shared package)|Single source of truth: backend validation, DB types, frontend forms|
|Server state (frontend)|TanStack Query|Cache invalidation, background refetch, optimistic updates|
|Forms|React Hook Form + `@hookform/resolvers/zod`|Validates against shared Zod schemas|
|Env config|dotenv + Zod schema|Fail fast on missing required vars at startup|

---

## 2. Monorepo Structure (relevant packages/apps only)

```
/apps
  /web        — Vite + React SPA (internal authenticated app)
  /server     — Fastify backend (tRPC + REST routes, single process)

/packages
  /shared     — Zod schemas, TypeScript types, API contracts, constants
  /database   — Drizzle schema, migrations, query helpers, seed data
```

(`/portal`, `/ui`, `/config`, `/tools` omitted — not part of the type inference chain.)

---

## 3. tRPC Architecture (Hybrid)

**Rule:** tRPC is used exclusively for `/web` (internal app) ↔ `/server`. The public portal and any external-facing interface use REST only.

```
/web  ──tRPC──▶  /server (Fastify)  ──REST/OpenAPI──▶  /portal, mobile, third-party
```

- tRPC procedures are defined in `/server`, consumed in `/web` with full type inference via TanStack Query (tRPC v11 uses TanStack Query as its data layer).
- REST routes are defined in `/server` with `@fastify/swagger` generating an OpenAPI 3.0 spec from route schemas.
- Both live in the same Fastify process; they are separated by plugin scope.

---

## 4. Type Safety Chain (core diagram)

```
Drizzle schema (PostgreSQL)
  └─▶ drizzle-zod → Zod schemas
        └─▶ /packages/shared (single source of truth)
              ├─▶ Fastify route validation (fastify-type-provider-zod)
              ├─▶ tRPC procedure input validation
              ├─▶ React Hook Form validation (@hookform/resolvers/zod)
              └─▶ TanStack Query response types
```

A DB schema change propagates as a compile error to every layer. No runtime contract surprises.

---
