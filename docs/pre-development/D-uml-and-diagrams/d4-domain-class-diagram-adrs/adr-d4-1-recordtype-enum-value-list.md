# ADR-D4-1: `RecordType` Enum Value List

**Status:** Accepted (schema/enum design) — **retention-period figures remain `[Unverified]` pending legal/regulatory confirmation; see "Deferred — Not Resolved by This ADR" below**
**Date:** June 2026
**Decided by:** Development team (ratifying detail already specified in source documents; same pattern as ADR-B2-2 and ADR-B2-7)
**Affects:** D4 (Domain Class Diagram), C1 (Full Database Schema DDL), Records module schema

---

## Context

D4 declares `Record.recordType: RecordType` as a typed field but never enumerates its members. C1 currently leaves the underlying column as unconstrained `TEXT` for the same reason (see C1 Part 15, "Open Items Requiring Confirmation"). No prior document (B-series, H-series, or the Consolidated Architecture & Requirements Reference) supplies a value list either.

**What does exist in the source documents:**

The Consolidated Architecture & Requirements Reference, Part 11.7 ("Records Management"), gives a **retention table** grouped by category, explicitly marked `[Inference]`/configurable and flagged for confirmation:

| Category | Retention |
|---|---|
| SP Resolutions, Ordinances | Permanent `[CONFIRMED]` |
| Signed contracts, financial records | Permanent |
| Personnel records | 10–15 years |
| Correspondence with citizens | 10–15 years |
| Internal memos | 5 years |
| Draft versions (final approved kept) | 1 year |

Part 11.7 itself flags these as **"Retention defaults (configurable; to be confirmed with COA/DILG)"** — i.e., the source document already treats the retention *periods* as provisional, separate from whatever category labels are used to organize them.

Additionally, a site-visit observation of the SP Secretariat's physical filing practice (Consolidated Reference, Part 7.6) recorded the categories actually used to organize paper records today (by SP term and by document/activity type — Proposed Ordinances, Memo Incoming/Outgoing, Committee Reports, Vouchers, etc.). That observation is **not itself a disposition framework** — confirmed in interview that no NAP-approved Records Disposition Schedule (RDS) exists for the Batac SP, and no disposition action has ever occurred.

**External regulatory context (web research, June 2026):** Republic Act 9470 (National Archives of the Philippines Act of 2007) establishes that LGUs are subject to retention/disposition governed by a General Records Disposition Schedule (GRDS) issued by the National Archives of the Philippines (NAP). `[Verified]` A scanned reproduction of NAP General Circular No. 1 (Official Gazette, Vol. 105 No. 12, March 23, 2009) was retrieved directly, confirming: the GRDS is attached to **Circular No. 1**, not Circular No. 3 as an earlier secondhand source claimed — Circular No. 3 is a separate, later, procedural circular governing how agencies establish and revise an RDS, not the schedule's content itself; all government agencies, explicitly including LGUs, are directed to observe the attached GRDS for common record series and may not dispose of records earlier than the indicated retention period (longer retention is always permitted); each agency must additionally file its own agency-specific Records Disposition Schedule (NAP Form 2) for records not covered by the GRDS.

From the retrieved GRDS table itself (items 14–82 visible in the retrieved excerpt), `[Verified]` confirmed retention periods exist for general administrative and financial record series — e.g., Board/Executive Committee minutes (Permanent) vs. staff minutes (1 year); incoming/outgoing correspondence logbooks (2 years after last entry); financial statements (Permanent); payrolls and check stubs (10 years, conditional on post-audit settlement); employee payment indices (15 years after retirement/separation). **None of these confirmed rows are Sanggunian/city-council-specific** — the retrieved excerpt does not include line items for SP Resolutions, SP Ordinances, committee reports, attendance records, or other legislative-body-specific series. Their presence elsewhere in the GRDS, in a different item-number range not covered by this retrieval, is possible but `[Unverified]`.

A separate document was provided during this project's research, presenting itself as an excerpt of "NAP GC No. 3 (2011)" with specific quoted retention values for Sanggunian-specific series (e.g., "Approved Resolutions/Ordinances — Decision is permanent," "Drafts of Minutes — 1 year after transcribed," "Committee Report – Performance of Sanggunian Member — Permanent"). **This document's specific quoted line items could not be corroborated against the retrieved primary source** `[Unverified]` — none of its quoted phrases appear in the GRDS table actually retrieved from the Official Gazette reproduction, and its citation (GC3, 2011) conflicts with the confirmed fact that the GRDS is attached to GC1 (2009). This document is therefore **not relied upon as a source** in this ADR. It may still be a useful lead for locating the Sanggunian-specific items elsewhere in the full GRDS, but its specific figures must not be treated as confirmed until independently verified against a primary NAP document.

D4's existing relationship design is relevant context: `DocumentType "1" --> "1" RetentionSchedule : governs` — i.e., **retention scheduling is already modeled as keyed off `document_type`, not off `RecordType` directly.** `RecordType` is a property of the `Record` entity itself (alongside `recordNumber`, `physicalLocation`, `formalizedAt`), describing what kind of record it is, while a *separate* `RetentionSchedule` entity (governed by `DocumentType`) carries the actual retention period and disposition rule.

## Decision

**`RecordType` is defined now, as a working enum, using the six categories already present in Part 11.7's retention table — ratifying existing source-document content rather than inventing new categories.**

```
RecordType:
  - LEGISLATIVE_PERMANENT   -- SP Resolutions, Ordinances (Part 11.7 row 1)
  - FINANCIAL               -- Signed contracts, financial records (Part 11.7 row 3)
  - PERSONNEL               -- Personnel records (Part 11.7 row 4)
  - CORRESPONDENCE          -- Correspondence with citizens (Part 11.7 row 5)
  - INTERNAL_MEMO           -- Internal memos (Part 11.7 row 6)
  - DRAFT                   -- Draft versions, final approved kept (Part 11.7 row 7)
```

This is a **grouping enum**, coarser than `document_type` — multiple `document_types` map to a single `RecordType` (e.g., `SP_RESOLUTION`, `SP_ORDINANCE`, and `SP_APPROPRIATION_ORDINANCE` all map to `LEGISLATIVE_PERMANENT`). The mapping from `document_type` → `RecordType` is itself a new piece of configuration data, not previously specified, and is enumerated below for traceability:

| `document_type_code` (H2/H3) | `RecordType` |
|---|---|
| `SP_RESOLUTION`, `SP_ORDINANCE`, `SP_APPROPRIATION_ORDINANCE` | `LEGISLATIVE_PERMANENT` |
| `MEMO_OUTGOING`, `MEMO_INCOMING` | `INTERNAL_MEMO` |
| `LETTER_RECEIVED`, `LETTER_SENT` | `CORRESPONDENCE` |
| `NOTICE_COMMITTEE_HEARING`, `NOTICE_SPECIAL_SESSION`, `DESIGNATION` | `LEGISLATIVE_PERMANENT` `[Inference — proposed]` |
| `PANLALAWIGAN_REVIEW_LOG` | N/A — per ADR-C1-1, not a `document_types` row; not formalized as a `Record` |

`[Inference — proposed]`: NCH, Notice of Special Session, and Designation are mapped to `LEGISLATIVE_PERMANENT` because Part 11.7 has no dedicated row for them and they are procedurally tied to the legislative process; this specific mapping choice is new and was not directly stated in any source document. It should be reviewed alongside the retention-period confirmation below rather than treated as settled fact.

`Vouchers`, `Codes`, and the other Part 7.6-observed categories with no `document_types` equivalent (Capacity Development materials, CDP/AIP/Annual Budget, Legislative Agenda, etc.) are **out of scope for this ADR**. They are not currently modeled as `document_types` at all, so they have no `RecordType` mapping yet; introducing them is a separate, future decision (see D4/H2 follow-up, not this ADR).

## Rationale

- Part 11.7's table is the only source-document content that groups document types by a shared treatment (retention period) rather than by individual document type — that is exactly what an enum coarser than `document_type` is for.
- This matches D4's own modeling: `RetentionSchedule` is governed by `DocumentType`, but `RecordType` is a separate descriptive property of `Record`. Defining `RecordType` along Part 11.7's groupings keeps the two concepts aligned without forcing a 1:1 mirror of `document_type`, which would make `RecordType` redundant.
- This is schema/enum design — a developer decision, not a legal-classification decision — and does not require external sign-off to unblock D4/C1 implementation, consistent with how ADR-B2-2 and ADR-B2-7 ratified detail already present in source documents without needing a new stakeholder interview.

## Deferred — Not Resolved by This ADR

**The retention *periods* attached to each `RecordType` (Permanent / 10–15 years / 5 years / 1 year, per Part 11.7) remain `[Unverified]` against actual NAP requirements, specifically for the legislative/Sanggunian-specific record series.** This ADR fixes the category *names* and the `document_type` → `RecordType` mapping; it does **not** certify that the retention durations in Part 11.7 are legally correct. Part 11.7 itself already flagged this ("to be confirmed with COA/DILG") before this ADR existed, and that flag is **not lifted** by this decision.

Direct retrieval of NAP General Circular No. 1's attached GRDS (Official Gazette, March 23, 2009) confirmed the existence and general structure of the schedule, and confirmed several non-Sanggunian-specific retention periods (see "External regulatory context" above). It did **not** surface confirmed retention periods for the Sanggunian-specific series this project actually needs (SP Resolutions, SP Ordinances, committee reports, session minutes, attendance, designations, letters, memos) — those item numbers were not present in the retrieved excerpt. A secondhand document claiming to quote exactly these Sanggunian-specific figures was evaluated and found uncorroborated against the primary source; it is not used as a basis for any retention period in this project.

**This does not block Phase 1 implementation** of the `RecordType` enum or the Records module schema. It **does block** the Records module's first real disposition action: before any document is actually disposed of (not before the enum/schema ships), the retention periods must be checked against the actual NAP GRDS — specifically the Sanggunian/legislative-body-specific item numbers, which were not part of the excerpt retrieved during this ADR's research — or against Batac City's own Agency RDS if one is later filed with NAP. This is recorded as a follow-up item, not a new open item duplicate of C1 Part 15 — it sits downstream of the enum decision made here.

## Consequences

- **D4:** `RecordType` enum values are defined as listed above. No structural change to the class diagram is required — `Record.recordType` already exists as a typed field.
- **C1:** `records.record_type` (or equivalent column, once the `records` schema migration is written) can now be constrained with a `CHECK` constraint or native enum type using the six values above, rather than left as unconstrained `TEXT`. C1 Part 15's open item for `RecordType` values is closed by this ADR for the *enum* question; the retention-period sub-question is tracked separately per "Deferred" above.
- **H2/Records module:** The `document_type` → `RecordType` mapping table above becomes seed data for the Records module once it is implemented (Phase 2, per Part 10.2's module list).
- **Audit/compliance:** Before go-live of any actual disposition workflow, retention periods must be confirmed against NAP/COA/DILG guidance. This is a prerequisite for *exercising* disposition, not for shipping the schema.