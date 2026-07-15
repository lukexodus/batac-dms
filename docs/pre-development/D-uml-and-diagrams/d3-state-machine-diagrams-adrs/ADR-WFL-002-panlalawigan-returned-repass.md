# ADR-014: Panlalawigan RETURNED → Repass Modeled as Document Supersession, With Final-Number Reuse on Republication

**Status:** Accepted **Date:** 2026-06-17 **Resolves:** O-2 (D3 Appendix C); also addresses O-7 (see ADR-015) and supersedes prior numbering language **Decision owner:** Project stakeholder (team decision, not a stakeholder-interview finding) **Affects:** `documents` schema (new columns); consolidated reference Part 5.2, Part 11.5, **Part 12 Invariant table (formal amendment)**; D3 §1.3, §1.4

---

## Context

D3 Appendix C, item O-2, identified that the consolidated reference describes the Panlalawigan RETURNED → repass outcome only in narrative terms: "repassed (back to drafting)" (Part 4.3, Part 7's Q-C06 resolution). It never specifies the mechanism at the document-record level. Three options were on the table:

- **Option A:** the original document record loops back through its own lifecycle (no new record).
- **Option B:** the original record is simply closed/cancelled, and a wholly independent new document starts fresh at `Draft` with no link back.
- **Option C:** a hybrid supersession model.

No stakeholder was asked about this, and the consolidated reference does not address it at all — this is **purely a team architecture decision**, not something derivable from Interview 1, Interview 2, or developer decisions already on record.

## Decision

**Option C (supersession) is adopted**, with one further refinement decided by the team: the eventual republished-and-approved version reuses the original document's final series number.

### Mechanism

1. SP Secretary logs the Panlalawigan RETURNED outcome against the original document. The original document's `panlalawigan_outcome` field is set to `RETURNED`.
2. SP Secretary initiates the repass action (a manual UI action, not automatic). This creates a **new document record**:
   - Inherits title, authors, sponsors, and substantive content from the original.
   - Receives a fresh `document_id` and a fresh **preliminary** ("Draft") number under the normal preliminary-numbering rules (ADR does not change preliminary numbering — see consolidated reference Part 5.2).
   - Records `previous_document_id` pointing at the original, for traceability.
3. The original document record is marked:
   - `superseded_by = <new_document_id>`
   - `closure_reason = "Panlalawigan RETURNED; repassed"`
   - `superseded_at = NOW()`
   - Lifecycle status transitions `Pending Panlalawigan Review → In-Workflow` is **not** used here; instead, per ADR-015, the original's _workflow instance_ status is left untouched (`Running`), and the original _document_ lifecycle status is set to a value reflecting closure-via-supersession rather than reverting to `In-Workflow`. (Exact lifecycle status value for a superseded document is specified in the D3 revision accompanying this ADR — see "Document Lifecycle Impact" below.)
4. The new document proceeds through the full legislative workflow again from `Draft` (First Reading, committee referral or Certified Urgent, readings, VP signature, Transmittal, Mayor review, Panlalawigan review) as an ordinary new workflow instance.
5. **If and only if** the new document is eventually approved through to `Completed`: at final-number assignment time, the engine assigns the **original document's final number** to the new document, rather than drawing the next number from the per-year sequence. The original final number is retired from the live sequence at the moment of supersession (step 3) and is not available for any other document; it is held in reserve specifically for this republished version.
6. If the new document itself fails (voted down, RETURNED again, withdrawn, etc.) before reaching `Completed`, the reserved final number remains reserved against that lineage. Repeated repass attempts continue inheriting the same reserved number down the `previous_document_id` chain until one succeeds or the matter is formally abandoned (abandonment handling is out of scope for this ADR and is not yet decided).

### Public-facing presentation

The public portal shows one document under the original final number (e.g., `7SP 2026-05`), with a note: "Republished after Panlalawigan revision." Citizens do not see two separately-numbered measures for what is legislatively the same intent.

## Formal Amendment to Consolidated Reference Part 12, Invariant Table

**This decision overrides an existing documented invariant and the amendment is recorded here explicitly, per the consolidated reference's own change-control convention** (Part 5.2: "Reuse: Never, even if cancelled"; Part 11.5: same; Part 12 invariant table, the numbering-related rows derived from those sections).

> **Prior rule (Part 5.2, Part 11.5):** "Reuse: Never, even if cancelled."
>
> **Amended rule, effective from this ADR:** Final series numbers are never reused **except** in the single case of a document superseded due to a Panlalawigan RETURNED outcome and subsequently repassed to approval, per the mechanism in this ADR. In that specific case, the reserved final number is assigned exactly once to whichever document in the supersession chain is first approved to `Completed`. All other cancellation, rejection, and withdrawal scenarios remain governed by the original "never reused" rule unchanged. Cancelled or rejected documents that are **not** the subject of a Panlalawigan-RETURNED repass do **not** have their numbers reserved or reused under any circumstance.

This is a narrow, explicitly-scoped exception, not a general relaxation of the immutability rule. The development team implementing the numbering service (consolidated reference Part 11.5, `documents.number_series`) must treat "number reservation pending repass outcome" as a distinct, auditable state — not silently identical to ordinary gap-logging for cancelled documents (Part 5.2's existing gap mechanism, which remains the default for everything outside this one exception).

`[Decision — team architecture choice, not a stakeholder requirement, not a legal requirement, and not validated against COA or DILG numbering-continuity expectations for the Index of Ordinances (Part 5.3). This should be confirmed with Records Officer / COA-facing stakeholders before Production Rollout, since the Index of Ordinances is described in the consolidated reference as "an active operational record" that external bodies may rely on for continuity.]`

## Document Lifecycle Impact

This ADR requires one further lifecycle-enum decision that was not explicitly asked as a numbered question but is a direct consequence of adopting supersession: what lifecycle status does the **original, superseded** document carry going forward? It is not `Cancelled` (cancellation has its own distinct meaning and audit semantics per Part 11.7 and is not what happened here — the document wasn't withdrawn, it was administratively returned and superseded). It is not any of the existing non-terminal milestone states, since the original document's own legislative journey has genuinely ended.

**Resolution adopted alongside this ADR:** a new lifecycle state, `Superseded`, is added to the document lifecycle enum as a terminal state, distinct from `Cancelled` and `Disposed`. `Pending Panlalawigan Review → Superseded` is a new transition, firing on the `DOCUMENT_SUPERSEDED` event described in step 3 above. This is reflected in the revised D3 document issued alongside this ADR. `[Inference — this specific enum addition was not separately put to the stakeholder as a numbered question; it is treated as falling within the scope of "how supersession is modeled," which was decided above.]`

## Consequences

**Positive:**

- Citizens and the Index of Ordinances (Part 5.3) see continuity: one number, one legislative measure, regardless of how many repass cycles it took.
- Audit trail is genuinely complete: `superseded_by` / `previous_document_id` form a traceable chain from first attempt through final approval.

**Negative / costs:**

- This is the most structurally complex of the four resolved items. It requires: a new `Superseded` lifecycle state; new `superseded_by`, `previous_document_id`, `closure_reason`, `superseded_at` columns; a number-reservation mechanism distinct from ordinary gap-logging; and a formal, documented amendment to a previously-stated architectural invariant.
- The number-reservation mechanism is new and unspecified at the implementation level beyond what's described here — it needs its own design pass (sequence table changes, locking behavior if two repass attempts are somehow concurrent, etc.) before the first migration touching `documents.number_series` is written.
- COA/DILG numbering-continuity expectations for this scenario are unverified. `[Unverified]` — this should be confirmed before Production Rollout, not assumed safe because it "makes sense" to the development team.

## Alternatives considered

- **Option A** (loop the same record back through its lifecycle): rejected because document content genuinely changes between repass attempts (Part 4.3: "Secretariat follows recommendations: may change, modify, repass"), and reusing one row to represent materially different content across attempts would corrupt the meaning of "version" already established elsewhere in the system (Part 11.4 versioning: "All previous versions retained. No overwrite.").
- **Option B** (fully independent new document, no link, no number reuse): rejected per the team's stated reasoning that it would produce two separately-numbered public-facing documents for what is legislatively one measure, harming citizen-facing clarity — the explicit motivation given for choosing Option C over Option B.
