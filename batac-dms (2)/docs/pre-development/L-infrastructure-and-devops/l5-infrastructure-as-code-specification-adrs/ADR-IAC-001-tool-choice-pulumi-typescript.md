# ADR-IAC-001 — IaC Tool Choice: Pulumi (TypeScript) over Terraform

**Status:** Decided
**Date:** June 2026
**Resolves:** L5 §2 (Tool Choice) and the IaC `[SPEC GAP]` flagged in `a1-tasks/infra.md` Module Summary
**Domain:** Infrastructure as Code (L5)

---

## Context

The consolidated reference's Architectural Law #5 requires "all infrastructure defined as code from day one" (§11.2, D5 Deployment Constraints). L3's own scope note explicitly excludes "Infrastructure provisioning (Terraform/Pulumi for the VPS)" from the CI/CD pipeline document, acknowledging that IaC belongs in a separate document. Prior to L5 being authored, no such document existed — this ADR closes the tool-choice decision that L5 depends on.

Two mainstream IaC tools were considered:

- **Terraform / OpenTofu (HCL)** — the dominant IaC ecosystem. Declarative DSL (HCL), mature provider ecosystem (DigitalOcean, B2, etc.), broad community support. Requires learning a separate language from the application stack.
- **Pulumi (TypeScript)** — infrastructure-as-code using general-purpose programming languages. The TypeScript runtime shares the monorepo's existing toolchain: `pnpm`, `tsc`, `eslint`, and `prettier` all apply without additional configuration.

---

## Decision

**Use Pulumi with the TypeScript runtime.**

The Pulumi program lives in `/infra/`, registered as a workspace member (`@batac/infra`) in `pnpm-workspace.yaml`. Infrastructure configuration and application code share the same lint, typecheck, and format pipeline established in `TASK-INFRA-001`.

### Rationale

**1. Zero toolchain delta.** The team already writes TypeScript. The same `tsconfig.base.json`, ESLint configuration, and Prettier rules from `packages/config/` apply to the `/infra/` package with no additional setup. A developer joining the project does not need to learn HCL — the type system they already work with describes infrastructure resources.

**2. Shared type imports across the boundary.** Stack outputs (Droplet IP addresses, bucket names, Volume IDs) can be typed as strongly-typed TypeScript values, not stringly-typed HCL outputs. This is particularly useful for wiring L5 §6.1's two-host topology: Droplet A's private IP address (needed by `compose.prod.standby.yml` as `DB_PRIMARY_PRIVATE_IP`) can be exported as a typed Pulumi stack output and consumed directly in automation scripts without string parsing.

**3. State backend without extra infrastructure.** Pulumi Cloud's free tier (app.pulumi.com) provides state locking, history, and encrypted secrets out of the box. The alternative — a self-managed state bucket — creates a chicken-and-egg problem (the bucket that holds Pulumi's state must itself be provisioned by something before Pulumi runs). For a team this size, Pulumi Cloud's free tier removes that bootstrapping complexity entirely. See L5 §5 for the full state-backend reasoning.

**4. Provider parity.** The DigitalOcean Pulumi provider (`@pulumi/digitalocean`) and the Backblaze B2 provider (via `pulumi package add terraform-provider backblaze/b2`) both support all resources required by L5: Droplets, VPCs, Cloud Firewalls, Block Volumes, Spaces Buckets, DNS Records, and B2 Buckets with lifecycle rules. There is no feature gap relative to Terraform for this project's scope.

---

## Consequences

- `/infra/` is added to `pnpm-workspace.yaml` as a new workspace member (alongside `apps/*`, `packages/*`, `tools/*`). `TASK-INFRA-001` should add this glob.
- The Pulumi CLI is added to dev-environment setup documentation (the `doctl` and `pulumi` CLIs must be installed locally; neither runs in CI automatically — see L5 §12 for the deliberate separation of `pulumi up` from the CD pipeline).
- A Pulumi Cloud account must be created (or an existing one used). The account token is stored as a Pulumi config secret, never committed.
- `pulumi preview` (never `pulumi up`) may be added as an optional `workflow_dispatch`-triggered GitHub Actions job for PR visibility — see L5 §12.

## Rejected alternative

**Terraform (HCL)** was rejected not because it lacks features, but because adding a second language to a TypeScript-only monorepo carries a real maintenance cost for a small team. Every HCL change requires a context switch that a Pulumi TypeScript change does not. The functional outcome is identical; the friction is not.