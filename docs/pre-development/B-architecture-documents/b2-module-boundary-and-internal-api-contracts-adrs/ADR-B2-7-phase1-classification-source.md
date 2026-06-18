# ADR-B2-7: Phase 1 Classification Source

**Status:** Accepted
**Date:** June 2026
**Decided by:** Development team (ratifying detail already specified in B2; formalizing the Phase 2 migration plan required by B2's Required ADRs table)
**Related documents:** B2 — Module Boundary and Internal API Contracts, Module 1 (IAM), Module 3 (Documents), Module 6 (Records); Consolidated Architecture and Requirements Reference (Iteration 3), Part 11.8, Part 11.9

---

## Context

The IAM module's ABAC Policy Engine evaluates classification-gated access policies (Consolidated Reference, Part 11.8: "Document classification is used for classification-gated access rules"). The four classification levels (Public, Internal, Confidential, Restricted) are defined in B2's Documents module (`DocumentSummary.classificationLevel`) and, separately, are the Records module's responsibility once that module exists (B2, Module 6: `Records.getClassificationForDocument()`).

The Records module is Phase 2 (Consolidated Reference, Module Priority Order; B2 Module 6 header: "Phase 2 (module delivered Phase 2; schema reserved in Phase 1 migration)"). This creates a genuine question for Phase 1: since `IAM.evaluatePolicy()` is documented as internally calling `Records.getClassificationForDocument()` "as needed" (B2, Module 1 Published API doc comment), what does the ABAC engine call in Phase 1, when Records does not yet exist as an active module?

B2 already answers this in two places without contradiction:
- Module 6's `getClassificationForDocument()` doc comment: *"Phase 1 note: Records module is delivered in Phase 2. In Phase 1, the ABAC engine uses the classificationLevel field from Documents.getDocumentById() instead. This method becomes the canonical classification source in Phase 2."*
- The Published API Call Matrix: `IAM (ABAC engine) | Records | getClassificationForDocument() | Classification-gated access control [Phase 2]`.

What is not yet specified is the mechanics of the Phase 1→2 cutover itself — this ADR's purpose, per its entry in B2's Required ADRs table, is to require "a deliberate migration plan at Phase 2 start."

## Decision

### Phase 1 (confirmed, no change from B2's stated design)

`Documents.getDocumentById()` is the sole source of `classificationLevel` for the IAM ABAC engine in Phase 1. The `documents.documents` table owns this column directly. There is no Phase 1 call from IAM to Records for this purpose, because Records is not an active module.

### Phase 2 cutover — migration plan

1. **Records module ships with its own `classification_rules` table** (already in B2's Module 6 schema: `classification_rules`), seeded at Phase 2 deployment time by **copying** the current `classificationLevel` value for every existing document from `documents.documents.classification_level` into the new Records schema's classification entries. This is a one-time, scripted data migration (per the Stack Context's Migration Rules: "Every schema change produces a migration file committed to version control... reviewable, and executable directly by `psql` if needed"), run as part of the Phase 2 deployment, not a live dual-write period.
2. **`Documents.getDocumentById()` continues to return `classificationLevel`** after the Phase 2 cutover — this field is not removed from the Documents schema or its Published API. Removing it would require every Phase 1-era caller of `getDocumentById()` that happens to read `classificationLevel` (display purposes, e.g.) to be found and changed in the same breaking-change window, which is unnecessary churn for a field that is cheap to keep duplicated. Per ADR-B2-6 (Published API Versioning), if this field's removal were later desired, it would be a same-PR breaking change with the compiler/coupling-test suite catching every reader — but that removal is explicitly **not** part of this migration.
3. **Going forward from Phase 2 cutover, `documents.documents.classification_level` is no longer the field IAM's ABAC engine reads.** The ABAC engine's internal call switches from `Documents.getDocumentById().classificationLevel` to `Records.getClassificationForDocument()`. This is a single code change in the IAM module's ABAC Policy Engine component — not a change to any other module's code, since `evaluatePolicy()`'s external signature (`userId`, `resource`, `action`, `context`) does not change; only its internal implementation does.
4. **Write-path consistency after cutover:** Any operation that changes a document's classification level after Phase 2 (e.g. a Records Officer reclassifying a document from Internal to Confidential) must write to the Records module's `classification_rules`/relevant table, **not** to `documents.documents.classification_level`. The Documents module's `Document Type Registry` (B1, Module 3) and any UI surface for setting classification on document creation must, after Phase 2 cutover, call into Records for the authoritative write rather than writing the now-vestigial Documents-schema field. This is a deliberate one-way handoff: Documents-schema classification becomes a frozen historical snapshot of "what it was as of Phase 2 cutover," and Records becomes the only schema where classification can change going forward.
5. **Validation step before cutover is considered complete:** A reconciliation query comparing `documents.documents.classification_level` against the newly seeded Records entries for every document must show 100% match before the Phase 1→2 classification cutover is marked done in the Phase 2 rollout checklist. Any mismatch blocks cutover completion and is investigated as a data integrity issue, not silently accepted.

## Consequences

- **Positive:** Phase 1 ships with zero dependency on a module that doesn't exist yet — `IAM.evaluatePolicy()` works correctly from day one of Phase 1 using only the Documents module.
- **Positive:** The Phase 2 cutover is a single, well-defined migration with an explicit validation gate (the reconciliation query), rather than an ambiguous "switch it over at some point" instruction.
- **Positive:** No other module's code changes during this cutover — `evaluatePolicy()`'s public contract is stable across the Phase 1→2 boundary, so this is invisible to every caller of IAM's Published API.
- **Negative (accepted):** `classificationLevel` exists as a column in both the `documents` and `records` schemas after Phase 2, with the `documents` copy becoming a frozen snapshot rather than being kept live. This is a deliberate, documented duplication rather than an oversight — removing it is possible later under ADR-B2-6's same-PR breaking-change process if judged worthwhile, but is out of scope here.
- **Follow-on requirement:** The Phase 2 rollout checklist (wherever that is tracked) must include the reconciliation validation step from Decision point 5 as a named, blocking gate — this ADR is the source of that requirement.
