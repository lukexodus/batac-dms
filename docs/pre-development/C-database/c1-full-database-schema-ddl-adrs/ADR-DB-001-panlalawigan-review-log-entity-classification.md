# ADR-DB-001: `panlalawigan_review_log` Entity Classification

**Status:** Accepted
**Date:** June 2026
**Decided by:** Luke (stakeholder/architect decision)
**Affects:** C1 (Full Database Schema DDL), C2 (Entity-Relationship Diagrams), H2 (Document Type Catalog), H3 (Numbering Series Configuration)

---

## Context

H3 Implementation Note 5, H2 Implementation Note 8, and C2 each independently deferred the same question: is the Sangguniang Panlalawigan review log (`panlalawigan_review_log` numbering series, tracked control number e.g. `2026-01`) a row in the standard `documents.document_types` catalog, a `tracking`-schema entity, or a `records`-schema entity?

The current DDL (C1 Part 5) already implements a specific shape:

- `documents.number_series` carries a row for `panlalawigan_review_log` with `document_type_id = NULL`.
- `documents.panlalawigan_reviews` is a dedicated table (per Decision 3.14) with its own column set sourced from B4's `workflow.instances.context` field names for the panlalawigan step, and a `number_series_id` FK to the series row above.

This is functional — numbers generate correctly, the immutability and uniqueness rules from H3 apply — but the *conceptual* classification was left open. That classification has a concrete downstream effect: it determines whether SP Panlalawigan control numbers appear in the standard document catalog, search, and listings alongside Resolutions, Ordinances, NCH notices, etc., or whether they are treated as an internal tracking artifact attached to an existing legislative document.

**Supporting evidence from the Consolidated Architecture & Requirements Reference (Iteration 3), Part 4.3** ("Sangguniang Panlalawigan Review"):

- The fields tracked (`Control No.`, `Date Received`, `SP Reso. No.`, `Subject`, `Date Approved/Disapproved`, `Date Referred`, `Remarks`) are described entirely as a **log** kept by the SP Secretariat about the *outcome* of a document already transmitted to the Panlalawigan — not as a document in its own right.
- The `Control No.` is explicitly the **SP Secretariat's own internal sequence number**, not a number the Panlalawigan assigns or a number that identifies a public-facing document.
- The review log has no content body, no signatures, no public portal visibility rules, and no retention/classification behavior of its own anywhere in the Reference document — all of which are defining characteristics of every entry in the `document_types` catalog (Part 4.1–4.18).
- D4 Relationship Note 10 (per prior architecture work) establishes that each `Document` has its own `PanlalawiganReview`, for independent outcome tracking — i.e., the review is a satellite record *of* a document, not a document itself.

Per Part 10.2 of the Consolidated Reference, module schema boundaries are an Architectural Law: each module owns its schema, and cross-schema foreign keys are prohibited except where explicitly scoped and named (see ADR-B2-5 for the one existing named exception). The current `panlalawigan_reviews.number_series_id → documents.number_series.id` relationship is an intra-`documents`-schema FK (both tables live in the `documents` schema), so it does not itself violate Law #2 — but formalizing the classification is still needed to confirm this is the intended permanent home, not a placeholder.

## Decision

**The `panlalawigan_review_log` is formalized as an internal tracking/log entity, not a public document type.**

Specifically:

1. **No `documents.document_types` row is created** for `panlalawigan_review_log`. `documents.number_series.document_type_id` remains `NULL` for this series permanently, by design — not as a deferred placeholder.
2. **`documents.panlalawigan_reviews` remains the authoritative table**, staying in the `documents` schema (not moved to `tracking` or `records`), because it is a satellite record of an existing `documents.documents` row (per the `UNIQUE (document_id)` constraint already in C1) rather than an independent entity needing its own lifecycle, classification, or retention treatment.
3. **Control numbers from this series do not appear in the standard document catalog, document search, or document listings** as if they were documents themselves. They appear only as a field on the parent document's detail view (e.g., "Panlalawigan Control No.: 2026-01") and in any dedicated Panlalawigan-tracking report/dashboard.
4. **The `number_series` table's `document_type_id NULL` path is retained as designed** (C1 Decision 3.11's comment already anticipated this) rather than introducing a synthetic `document_types` row purely to satisfy a NOT NULL constraint.

## Rationale

- The Consolidated Reference (Part 4.3) never describes the Panlalawigan review as something the public, the citizen portal, or any other module would look up as a standalone document — it is always discussed as an outcome annotation on an already-existing Resolution or Ordinance.
- Treating it as a `document_types` entry would require it to carry classification level, retention schedule, and workflow-required-step-type metadata (per `ck_document_types_retention_before_activation` and related C1 invariants) that have no real meaning for a log entry — it would be schema overhead with no behavioral benefit.
- Keeping it in `tracking` or `records` was considered and rejected: it has no routing/QR-tracking behavior (`tracking` schema's actual purpose per Part 10.2) and no archival/disposition behavior (`records` schema's actual purpose). It is neither — it is document-outcome metadata, which is what `documents.panlalawigan_reviews` already is.
- This keeps the existing, already-implemented C1 shape as the final answer rather than requiring a schema migration. No DDL changes are required as a result of this ADR.

## Consequences

- **C1:** No DDL change required. The existing `document_type_id NULL` design on the `panlalawigan_review_log` `number_series` row, and the existing `documents.panlalawigan_reviews` table, are confirmed as final, not provisional. The Part 15 open item is closed.
- **C2:** Entity-Relationship Diagrams should annotate `panlalawigan_reviews` as a documents-schema satellite entity (1:1 with `documents.documents`), not draw it as a peer of the document-type-driven entities.
- **H2:** Implementation Note 8 (or equivalent) should be updated to state plainly that `panlalawigan_review_log` is intentionally absent from the Document Type Catalog — not pending.
- **H3:** Implementation Note 5 should be updated to remove the "may not apply" hedge and state the classification as confirmed: `document_type_code = PANLALAWIGAN_REVIEW_LOG` in H3's own Table 1 was always [Inference] and should now be read as **not applicable** — there is no `document_types` row, so there is no `document_type_code` to assign. H3's Table 1 row for this series should drop that column value (or mark it `N/A`) on next revision.
- **Application/UI:** Front-end and reporting work that lists "documents" must exclude `panlalawigan_review_log` control numbers from that listing by construction — they are not retrievable via `Documents.getDocumentById()`-style document-catalog APIs, only as a field/sub-resource of the parent document.
- **Future revisit trigger:** If a future phase requires the Panlalawigan review log to be independently searchable, reportable, or retained on its own schedule (separate from its parent document), that would justify revisiting this ADR with a superseding decision — but no such requirement exists in the current Consolidated Reference.