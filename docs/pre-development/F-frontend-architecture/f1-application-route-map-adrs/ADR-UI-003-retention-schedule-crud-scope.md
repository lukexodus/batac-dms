# ADR-UI-003: Retention Schedule Creation/Activation — Pulled Into Phase 1

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #3 (also referenced in F1 §12.6)
**Decision owner:** Luke (product/architecture owner)

## Context

I2's conditional note ⁵ describes a two-step retention-schedule workflow: Records Officers may draft/propose changes to retention schedules, but final activation of a new schedule requires Platform Administrator action; existing schedules may be applied by the Records Officer to individual records without Platform Administrator involvement `[Confirmed — I2, Conditional Note ⁵]`. E1's `records` router, however, only catalogues two procedures: `records.getRetentionSchedule` (read) and `records.applyRetentionSchedule` (apply an already-existing schedule to a specific record, Records Officer only). No procedure exists anywhere in E1 for creating a new retention schedule or activating one — the propose/activate workflow I2 describes has no backing procedure at all.

F1 flagged this as an open gap (§12.6) without inventing procedure names for the missing create/activate steps.

## Decision

**Retention schedule creation and activation are pulled into Phase 1 scope.** Procedures backing the propose (Records Officer) → activate (Platform Administrator) workflow described in I2's conditional note ⁵ must be designed and built.

## Rationale

As with ADR-UI-002, the underlying gap here was that the procedures had not yet been designed, not that they were infeasible. I2 already describes the intended workflow in enough detail (propose/draft by Records Officer, final activation by Platform Administrator) to scope the work, even though no procedure signature exists yet.

## Consequences

- `[Inference]` At minimum, two new procedures are needed: one for Records Officer to propose/draft a new retention schedule, and one for Platform Administrator to activate it. Whether "propose" and "activate" are two calls against one mutable draft row, or two separate procedures against a status field (e.g., `draft` → `active`), is an implementation detail not resolved by this ADR.
- `[Inference]` This work should sit in the same `records` module/schema as the existing `getRetentionSchedule`/`applyRetentionSchedule` procedures, consistent with the module-boundary rule that each module owns its own schema `[Confirmed — F1-Context §1.3]`.
- `/retention-schedules` (F1 §12.6), currently a read-only route per the confirmed view-access role list (Platform Administrator, Records Officer, SP Secretary, Auditor), gains write capability: a Records-Officer-only "propose new schedule" action and a Platform-Administrator-only "activate" action, in addition to its existing read.
- This is one of four scope items pulled into Phase 1 in this decision pass (see ADR-UI-002 consequences for the combined note on cumulative scope impact, which applies here as well).
- F1 §14 gap #3's `[Unverified]` status is superseded by this ADR.

## Alternatives considered

- **Keep both retention-schedule creation and activation deferred**, leaving `/retention-schedules` as a read/apply-only page in Phase 1. Lower scope, but leaves I2's described propose/activate workflow with no way to actually create new schedules in Phase 1. Not selected.

## Traceability

- I2, Conditional Note ⁵
- E1, `records.getRetentionSchedule`, `records.applyRetentionSchedule`
- F1 §12.6, §14 gap #3
