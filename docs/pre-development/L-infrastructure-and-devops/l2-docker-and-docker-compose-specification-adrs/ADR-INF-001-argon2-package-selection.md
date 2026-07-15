# ADR-L2-01 — Argon2 Package Selection

**Status:** Decided  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-01  
**Author:** Architecture review

---

## Context

The stack requires Argon2id for password hashing (confirmed in L1 §6.4 and `tech-stack.md`). Two npm packages implement this:

- **`argon2`** — Pure Node.js wrapper around the reference C implementation. Requires native compilation via `node-gyp` (`python3`, `make`, `g++`) at build time. The compiled `.node` binary is architecture- and libc-specific. On Alpine Linux (musl libc), a binary compiled in one Alpine stage may be incompatible with the runtime Alpine stage if image digests differ, or if the compiler targets glibc conventions.
- **`@node-rs/argon2`** — Ships precompiled NAPI-RS binaries per platform (`linux-x64-musl`, `linux-x64-gnu`, etc.). No build toolchain required. Binary is selected at install time by the npm platform field.

The current Dockerfile (`Part 4`) already includes build tools (`apk add python3 make g++`) in the `deps` stage specifically to support `argon2` native compilation. Both stages (`deps` and `production`) use `node:20-alpine`, which reduces the risk of musl mismatch, but does not fully eliminate it: any future change to the base image tag resolution (digest drift, Node.js minor version bump) can cause a runtime binary incompatibility that only manifests at container start, not at build time.

---

## Decision

**Use `@node-rs/argon2` and remove the native build toolchain from the Dockerfile.**

Rationale:

1. **Eliminates the Alpine musl binary risk entirely.** `@node-rs/argon2` ships a prebuilt `linux-x64-musl` binary. It is selected automatically by npm/pnpm at install time. No compilation step; no libc mismatch surface.

2. **Removes build tools from the production image.** The `python3`, `make`, `g++` packages in the `deps` stage exist solely for `argon2` compilation. With `@node-rs/argon2`, those tools are no longer needed. The production image becomes smaller and has a reduced attack surface.

3. **Drop-in API compatibility.** `@node-rs/argon2` exports an identical async API (`hash`, `verify`). The OWASP parameters confirmed in L1 §6.4 (`ARGON2_MEMORY_COST=65536`, `ARGON2_TIME_COST=3`, `ARGON2_PARALLELISM=1`, `ARGON2_HASH_LENGTH=32`) apply identically to both packages and remain unchanged.

4. **Reproducible builds.** Prebuilt binaries are version-pinned via the lockfile. There is no compilation step that could produce a different output on different CI runners.

---

## Consequences

### Required Dockerfile changes

Remove from the `deps` stage:

```dockerfile
# DELETE this block — no longer required
RUN apk add --no-cache python3 make g++
```

No other Dockerfile changes are required. The `deps` and `production` stages otherwise remain identical.

### Required package change

```bash
pnpm remove argon2
pnpm add @node-rs/argon2
```

Update any import sites:

```typescript
// Before
import argon2 from 'argon2';

// After
import { hash, verify } from '@node-rs/argon2';
```

The hash format is compatible. Existing hashes (dev or staging) do not need to be re-hashed; `verify` from `@node-rs/argon2` reads standard Argon2id PHC strings.

### Status update in L2 Part 13

L2-01 moves from `Unresolved [Inference]` to `Resolved — @node-rs/argon2 selected`.

---

## Rejected alternative

Proceeding with `argon2` (native build) was rejected because the Alpine musl binary compatibility risk is real and has caused silent production failures on this image configuration in the wider Node.js ecosystem. The mitigation (pinning both stages to the same digest) adds operational overhead and does not eliminate the risk on future image updates. The upside of keeping `argon2` is nil: the APIs are identical.
