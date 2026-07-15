# ADR-L2-08 — pnpm Version Pinning via Corepack

**Status:** Decided  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-08  
**Author:** Architecture review

---

## Context

All Dockerfiles use `corepack enable` followed by `pnpm install --frozen-lockfile`. Corepack resolves the pnpm version from the `packageManager` field in the root `package.json`. If that field is absent, corepack falls back to a default pnpm version that may differ between environments, making builds non-reproducible.

The open decision asks whether `packageManager` is set in `package.json`. This is a hygiene requirement with a clear right answer, not a trade-off.

---

## Decision

**Require `packageManager` in the root `package.json` and keep it updated.**

The field must be set to the exact pnpm version in use, including patch level:

```json
{
  "packageManager": "pnpm@9.15.4"
}
```

(Version number is illustrative. Use `pnpm --version` in the current development environment to confirm the exact version, then set it.)

Rationale:

1. **Reproducible builds are a hard requirement.** A Docker image build that produces different dependency resolutions on different days or different CI runners is a production reliability risk. Corepack without a pinned version is a source of non-reproducibility.

2. **One field, no ongoing cost.** Setting `packageManager` is a one-line change. The cost of not setting it — a silent version drift that causes a lockfile conflict or behavioral change at an unexpected time — far exceeds the cost of the field.

3. **Corepack is already the mechanism in use.** The Dockerfiles call `corepack enable` and then invoke `pnpm` directly. This is the correct pattern; `packageManager` is the intended configuration hook for it.

4. **Lockfile enforcement is not a substitute.** `pnpm install --frozen-lockfile` prevents lockfile mutations but does not control which version of pnpm reads the lockfile. A newer pnpm major version may interpret the lockfile format differently or add new integrity checks that reject a lockfile written by an earlier version.

---

## Consequences

### Required action

Run in the project root:

```bash
pnpm --version
# Example output: 9.15.4

# Then add or update root package.json:
{
  "packageManager": "pnpm@9.15.4"
}
```

Alternatively:

```bash
corepack use pnpm@9.15.4
# This writes the packageManager field automatically
```

### Ongoing maintenance

When the team intentionally upgrades pnpm, update the `packageManager` field in the same commit that updates the lockfile. Treat them as atomic.

### Status update in L2 Part 13

L2-08 moves from `Not confirmed [Inference]` to `Resolved — packageManager field required in root package.json`.

---

## Rejected alternative

Accepting `corepack` without `packageManager` was rejected. The non-reproducibility risk is real and the fix is trivial. There is no argument for omitting the field.