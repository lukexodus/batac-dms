# ADR-UI-014: Sequential Commit with Per-Item Status for Order of Business Batch Save

**Status:** Accepted
**Date:** 2026-06-19
**Deciders:** Development team (engineering implementation decision; no stakeholder input required)
**Affected documents:** F2 (`f2-zustand-store-design.md`) §13 `useOrderOfBusinessStore`

---

## Context

`useOrderOfBusinessStore.pendingChanges` (F2 §13) buffers multiple staged scheduling mutations (`SCHEDULE_FIRST_READING`, `ENTER_HEARING_DATE`) so the SP Secretary can review a full set of changes before committing them together, rather than firing one mutation per click. On save, the component must fire each buffered change as its own tRPC mutation.

No source document specifies what happens if one mutation in the batch fails while others succeed. This is a pure engineering/UX implementation decision with no conflicting stakeholder requirement, so the development team is deciding it directly rather than raising it as an open question.

## Decision

**Sequential commit, per-item status tracking, no rollback.**

1. On save, the component iterates `pendingChanges` **in array order**, firing each item's corresponding tRPC mutation one at a time (not in parallel via `Promise.all`).
2. Each item tracks one of: `pending`, `committing`, `succeeded`, `failed`.
3. On a given item's success: it is immediately removed from `pendingChanges` (consistent with F2 §13's existing usage note) and `session.getOrderOfBusiness` is invalidated incrementally (or once, at the end — see Consequences).
4. On a given item's failure: it remains in `pendingChanges`, marked `failed`, and the UI highlights it with the error message. The iteration **continues** to the next item rather than aborting the whole batch.
5. After the full pass completes, the buffer contains only the failed items (successes already removed). The user can retry the remaining failed items (re-running the same save action re-attempts only what's left in the buffer), edit them, or discard them individually via the existing `removeChange` action.
6. No automatic rollback of already-succeeded items is performed if a later item fails. Each scheduling change (a first-reading date, a hearing date) is an independent fact about an independent document/step; there is no transactional relationship between them that would make a partial commit incorrect or unsafe to leave in place.

## Rationale

1. **Matches the real-world independence of the data.** Scheduling document A's first reading and entering committee X's hearing date are unrelated facts about unrelated entities. There is no business rule requiring all-or-nothing commitment — Part 4.18 and Part 7.2 describe the Order of Business as an aggregation of independently-scheduled items, not a single atomic unit. Treating the batch as transactional (all-or-nothing) would be inventing a constraint the source material doesn't impose, and would force the Secretary to redo successful entries after an unrelated failure elsewhere in the batch — strictly worse UX for no correctness benefit.
2. **Sequential (not parallel) keeps error attribution simple.** Firing all mutations via `Promise.all` makes it harder to present a clean per-item result if multiple fail with related causes (e.g. a stale `stepInstanceId` after a concurrent edit) — sequential execution means each result is fully resolved before the next request is even sent, which is simpler to reason about and test, at an acceptable latency cost given the batch sizes described (a handful of changes per save, not hundreds).
3. **Per-item highlighting directly serves the existing usage note in F2 §13**, which already says "the failed change is highlighted in the pending list; successfully committed changes are removed from the buffer" — this ADR fully specifies the previously-unspecified mechanics behind that sentence rather than introducing new behavior.
4. **No rollback avoids a worse failure mode.** A rollback-on-any-failure design would require either compensating mutations (undo a successful schedule change) or a server-side transaction spanning unrelated procedures (`session.scheduleDocumentForFirstReading` and `session.enterCommitteeHearingDate` are separate procedures per F2 §13's citation of F1 §6) — neither of which the backend is designed to support, and neither of which the underlying business process needs.

## Alternatives Considered

**Parallel commit (`Promise.all`) with aggregate success/failure.** Rejected — faster, but harder to attribute specific errors to specific items cleanly when several fire near-simultaneously, and offers no benefit at the batch sizes this store is designed for (a handful of staged changes per Order of Business session, not a bulk operation).

**All-or-nothing transactional commit.** Rejected — would require backend support this catalog doesn't provide (no single procedure spans both change types), and doesn't match the independent nature of the underlying data per Rationale #1.

## Consequences

- `OrderOfBusinessState` gains an implicit need to track per-item status during the save operation. This can be modeled either as a transient `committingIndex`/`failedIndices` field on the store, or as local component state derived from watching the buffer shrink — left as an implementation detail, not specified further here, since either satisfies the contract.
- `isSaving` (existing field) remains `true` for the duration of the full sequential pass, not per-item.
- `session.getOrderOfBusiness` cache invalidation: the simplest correct approach is to invalidate once after the full pass completes (whether partially or fully successful), since the view needs to reflect whatever subset actually committed. Invalidating after every single item is also correct but causes more refetches than necessary; left to the implementing developer's judgment.
- This ADR does not change `useOrderOfBusinessStore`'s public action signatures (`addScheduleFirstReading`, `addEnterHearingDate`, `removeChange`, `clearPendingChanges`, `setSaving`) — it specifies the *component-level* save orchestration logic that consumes those actions, which sits outside the store itself per F2's existing convention that mutation orchestration lives in components/hooks, not in the store (§15 Rule 3).
