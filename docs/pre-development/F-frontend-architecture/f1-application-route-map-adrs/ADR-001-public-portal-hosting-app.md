# ADR-001: Public Portal Hosting App

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #1 (also referenced in F1 §2.1, §13.1; F1-Context §1.1, §10)
**Decision owner:** Luke (product/architecture owner)

## Context

F1-Context's monorepo layout places `/apps/portal` (Next.js) as a Phase 3 deliverable, with the stack-decisions table giving the rationale `[Confirmed — F1-Context, Stack Decisions table]`: SSG for SEO on citizen-facing document lookups. At the same time, the consolidated requirements file repeatedly describes specific **Phase 1** public-portal behavior — tracking-number lookup, first-page document preview, the Document Request Form, and Citizen Complaint submission `[Confirmed — F1-Context §10]`. Neither source file resolved which app was meant to serve this Phase 1 behavior; F1 itself carried the question forward unresolved into its own gaps list (§14 #1) rather than picking one.

Two options were on the table:

1. Serve Phase 1 portal routes as unauthenticated routes inside the existing `/apps/web` Vite/React SPA.
2. Build `/apps/portal` (Next.js) now, ahead of its originally planned Phase 3 slot.

## Decision

**Phase 1 public portal routes will be served from `/apps/portal` (Next.js), built now rather than waiting for Phase 3.**

## Rationale

- The original SSG/SEO justification for choosing Next.js for this surface `[Confirmed — F1-Context, Stack Decisions table]` applies just as much to Phase 1 portal pages as to any later phase — a Vite SPA does not provide this out of the box.
- A separate app/bundle/deploy target gives a cleaner authentication boundary between the public-facing surface and the staff-authenticated `/apps/web` SPA, reducing the risk of internal-only code, environment variables, or sourcemaps leaking into a publicly served bundle.
- Building `/apps/portal` once now avoids paying the Next.js setup/migration cost twice (once for a throwaway `/apps/web` implementation, again later when Phase 3 arrives).
- The REST-only constraint on portal-facing traffic `[Confirmed — F1-Context §1.2, tRPC architecture rule]` is satisfied identically regardless of which app hosts these routes, so this constraint did not favor either option.

## Consequences

- `[Inference]` This pulls Phase 3 infrastructure work (new app scaffold, build pipeline, CI/CD target, deploy target) into the Phase 1 timeline. The original phase plan did not budget for this; schedule and resourcing impact should be assessed separately and is not something this ADR can verify.
- All Phase 1 public-portal routes named in F1 §13.2 (`/portal/lookup`, `/portal/documents/:trackingNumber`, `/portal/register`, `/portal/login`, `/portal/requests/new`, `/portal/requests/:requestId/status`, `/portal/complaints/new`, `/portal/complaints/:complaintId/status`) are re-scoped from `/apps/web` to `/apps/portal`.
- These routes continue to depend on REST/OpenAPI endpoints from `/server`, not tRPC, per the existing tRPC/REST boundary rule — this ADR does not change that boundary, only which frontend app consumes it.
- `sp.batac.gov.ph` coexistence is unaffected — `[Confirmed — F1-Context §10]` the consolidated requirements file states the batac-dms public portal will coexist with `sp.batac.gov.ph`, with no requirement to formally retire the latter; this remains true under either hosting option and is not changed by this decision.
- F1 §2.1 and §13.1's "Unverified — hosting app not settled" language is superseded by this ADR and should be removed from any future revision of F1.

## Alternatives considered

- **Serve from `/apps/web` as unauthenticated routes.** Faster to ship (no new app to scaffold) and avoids new infrastructure risk before a Phase 1 deadline, but forfeits the SSG/SEO benefit that was the original reason Next.js was chosen for this surface, and creates a muddier auth boundary between public and internal-staff code in the same bundle. Not selected.

## Traceability

- F1-Context §1.1 (monorepo layout), §1.2 (tRPC/REST rule), §10 (Phase 1 portal behavior; stack-decisions Next.js/Phase 3 row)
- F1 §2.1, §13.1, §14 gap #1
