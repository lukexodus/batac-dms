# ADR-GEN-012: Environment Variable Access Pattern: Per-App Config Modules Over Shared Config Package

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (resolving J3/L1 discrepancy)

---

### Context

Originally, the coding standards in J3 (§2.3, §7.3) suggested accessing environment variables through a single shared workspace package (`@batac/config/env`). However, the environment variable configuration in L1 infrastructure planning establishes per-app config modules (like `apps/server/src/config/env.ts` and `apps/web/src/config/env.client.ts`) as the architecture of choice.

Creating a shared runtime `@batac/config/env` package presents two major drawbacks:

1. **Separation of Concerns:** It mixes build-time tooling configuration (like TSConfigs and ESLint base configs) with runtime application code in `/packages/config`.
2. **Client/Server Environment Boundary:** A shared package makes it easier to accidentally leak server-side secrets or schemas into client-side Vite bundles, violating the strict environment boundary between the web frontend and backend server.

### Decision

We resolve the discrepancy between J3 and L1 by standardizing on **per-app config modules** instead of a shared workspace configuration package.

1. **Local App Config Modules:**
   - In `apps/server`, environment variables must be imported from the validated local config module `apps/server/src/config/env.ts` (e.g., `import { env } from '../config/env'`).
   - In `apps/web`, environment variables must be imported from the validated local config module `apps/web/src/config/env.client.ts` (e.g., `import { clientEnv } from '../config/env.client'`).

2. **Lint Enforcement:**
   - Direct `process.env` access is prohibited in application code by the base ESLint rule `no-restricted-syntax`.
   - The ESLint error message is updated to direct developer to their respective app config modules rather than a shared package.
   - The server's local startup verification file `apps/server/src/config/env.ts` is granted an explicit rule exemption via a local override since it is the one legitimate entry point that must parse `process.env`.

### Alternatives Considered

**Shared `@batac/config/env` package** — Mixing build-time tooling configs and runtime application code in a single shared config package. Rejected due to separation of concerns and the risk of exposing server secrets to Vite client bundles.

### Consequences

**Positive**

- Ensures clean separation between build-time config tooling and runtime application code.
- Prevents leakage of server-side secrets or backend schemas into the frontend Vite client bundle.
- Guarantees fail-fast startup verification per application scope.

**Negative / Trade-offs**

- Requires duplicating the base validation syntax or keeping local schemas for server and client env variables in separate configuration files, which is already naturally aligned with their distinct runtime needs.

### Related Decisions

- L1 (Environment Variable Catalog) — Defines the specific schemas and properties verified at startup.
- J3 (Coding Standards and Conventions) — Outlines conventions and ESLint rules governing code standards.
