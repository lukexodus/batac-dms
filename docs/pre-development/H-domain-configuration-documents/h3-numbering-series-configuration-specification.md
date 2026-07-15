### Numbering Series Configuration Specification — Blocking

**Source:** Part 5.1 and Part 5.2, Consolidated Architecture & Requirements Reference (Iteration 3)  
**Blocking:** `number_series` must be seeded before the first workflow engine migration runs. Workflow definitions resolve number formats and sequences by `series_id` at instance creation time. This seed cannot be deferred.  
**Scope:** 11 confirmed series. Two entries excluded: Franchise Ordinance (out of scope, Part 4.16); Panlalawigan external reference `R{YEAR}-{NNNN}` (provincially assigned; stored as metadata in a dedicated column; not a managed series).

---

#### Table of Contents

- [L19–L28] Global Field Values — Identical Across All 11 Records — 4 fields shared by every series row (delimiter, resets_annually, authority_office_id, year_format); skip if you only need per-series specifics.
- [L32–L58] Table 1 — Series Identity and Formats — prefix, padding, preliminary/final format string per series; padding footnotes flag SPR (recommended 3-digit) and SPS (flagged for review) as likely undersized at 2.
- [L62–L82] Table 2 — PostgreSQL Sequence Names — proposed sequence-name pattern per series plus year-boundary creation policy; naming convention itself is unconfirmed, not just the names.
- [L86–L110] Table 3 — Number Assignment Events — which workflow event assigns preliminary vs. final numbers per series; only SPR has deferred (nullable) final assignment, only the 3 SP legislative types have a preliminary stage.
- [L114–L152] Implementation Notes — 9 numbered notes: 7SP/administration-change handling, shared-prefix-not-shared-counter, preliminary mutability, panlalawigan_review_log's unresolved table placement, why Certification of Urgency and QR tracking number have no series record, gap/reuse policy.

---

#### Global Field Values — Identical Across All 11 Records

Do not repeat these in individual series rows unless a specific series requires an override.

| Field                 | Value                             | Source                                                                                  |
| --------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `delimiter`           | `" "` (single space)              | Q-A01 — confirmed                                                                       |
| `resets_annually`     | `true`                            | Part 5.1 — confirmed for all 11 series                                                  |
| `authority_office_id` | FK → SP Secretariat office record | Q-B03 — confirmed                                                                       |
| `year_format`         | `YYYY` (4-digit)                  | [Inference — consistent with all examples in Part 5.1: `2026-01`, `2025-04`, `2024-19`] |

---

#### Table 1 — Series Identity and Formats

`series_id` values are [Inference] — proposed stable slugs. Not defined in the reference document.  
`document_type_code` values are [Inference] — proposed FK references consistent with naming patterns in the reference document. Must match the `document_types` seed, which must be defined before this seed runs.  
Padding footnotes follow the table.

| `series_id`                  | `document_type_code`         | `prefix` | `sequence_padding` | `preliminary_format`    | `final_format`     | Phase |
| ---------------------------- | ---------------------------- | -------- | ------------------ | ----------------------- | ------------------ | ----- |
| `sp_resolution`              | `SP_RESOLUTION`              | `7SP`    | `2` ¹              | `Draft 7SP {YEAR}-{NN}` | `7SP {YEAR}-{NN}`  | 1     |
| `sp_ordinance`               | `SP_ORDINANCE`               | `7SP`    | `2` ¹              | `Draft 7SP {YEAR}-{NN}` | `7SP {YEAR}-{NN}`  | 1     |
| `sp_appropriation_ordinance` | `SP_APPROPRIATION_ORDINANCE` | `7SP`    | `2` ¹              | `Draft 7SP {YEAR}-{NN}` | `7SP {YEAR}-{NN}`  | 1     |
| `notice_committee_hearing`   | `NOTICE_COMMITTEE_HEARING`   | `NCH`    | `2` ¹              | —                       | `NCH {YEAR}-{NN}`  | 1B    |
| `notice_special_session`     | `NOTICE_SPECIAL_SESSION`     | `NOSP`   | `2` ¹              | —                       | `NOSP {YEAR}-{NN}` | 1B    |
| `designation`                | `DESIGNATION`                | `D`      | `2` ¹              | —                       | `D {YEAR}-{NN}`    | 1B    |
| `letters_received`           | `LETTER_RECEIVED`            | `SPR`    | `3` ²              | —                       | `SPR {YEAR}-{NN}`  | 1B    |
| `letters_sent`               | `LETTER_SENT`                | `SPS`    | `2` ³              | —                       | `SPS {YEAR}-{NN}`  | 1B    |
| `memo_outgoing`              | `MEMO_OUTGOING`              | `MO`     | `2` ¹              | —                       | `MO {YEAR}-{NN}`   | 1B    |
| `memo_incoming`              | `MEMO_INCOMING`              | `MI`     | `2` ¹              | —                       | `MI {YEAR}-{NN}`   | 1B    |
| `panlalawigan_review_log`    | `PANLALAWIGAN_REVIEW_LOG`    | _(none)_ | `2` ¹              | —                       | `{YEAR}-{NN}`      | 1     |

**Padding footnotes:**

¹ `sequence_padding = 2` is [Inference] — derived from all observed examples in Part 5.1 (e.g., `NCH 2025-03`, `D 2024-01`, `MO 2025-04`). The reference document uses the placeholder `{NN}` without specifying minimum digit width. 2-digit padding is sufficient for all series where confirmed annual volumes (Part 7.4) are well under 99.

² `sequence_padding = 3` for SPR is [Inference — recommended]. Letters Received confirmed at ~38/month (Part 7.4: `SPR 2026-01` through `SPR 2026-98` in Q1 2026 alone). Annualised volume ~456, which exceeds the 2-digit ceiling of 99. 3-digit padding (001–999) accommodates projected volume.

³ `sequence_padding = 2` for SPS is [Inference — flagged for review]. Letters Sent confirmed at ~12/month (Part 7.4: Q1 2026 sample). Annualised volume ~144, which exceeds 99. 3-digit padding may be required. Confirm with SP Secretariat before finalising.

---

#### Table 2 — PostgreSQL Sequence Names

One sequence per series per year, per Part 5.2: "Separate PostgreSQL sequence per document type per year — no shared counter."

`sequence_name_pattern` is [Inference] — a proposed naming convention. The reference document specifies per-year sequences but does not define a naming pattern. Confirm the convention before writing seed scripts.

| `series_id`                  | `sequence_name_pattern`                    | Example (year 2026)                      |
| ---------------------------- | ------------------------------------------ | ---------------------------------------- |
| `sp_resolution`              | `ns_sp_resolution_{YEAR}_seq`              | `ns_sp_resolution_2026_seq`              |
| `sp_ordinance`               | `ns_sp_ordinance_{YEAR}_seq`               | `ns_sp_ordinance_2026_seq`               |
| `sp_appropriation_ordinance` | `ns_sp_appropriation_ordinance_{YEAR}_seq` | `ns_sp_appropriation_ordinance_2026_seq` |
| `notice_committee_hearing`   | `ns_nch_{YEAR}_seq`                        | `ns_nch_2026_seq`                        |
| `notice_special_session`     | `ns_nosp_{YEAR}_seq`                       | `ns_nosp_2026_seq`                       |
| `designation`                | `ns_designation_{YEAR}_seq`                | `ns_designation_2026_seq`                |
| `letters_received`           | `ns_letters_received_{YEAR}_seq`           | `ns_letters_received_2026_seq`           |
| `letters_sent`               | `ns_letters_sent_{YEAR}_seq`               | `ns_letters_sent_2026_seq`               |
| `memo_outgoing`              | `ns_memo_outgoing_{YEAR}_seq`              | `ns_memo_outgoing_2026_seq`              |
| `memo_incoming`              | `ns_memo_incoming_{YEAR}_seq`              | `ns_memo_incoming_2026_seq`              |
| `panlalawigan_review_log`    | `ns_panlalawigan_review_log_{YEAR}_seq`    | `ns_panlalawigan_review_log_2026_seq`    |

**Sequence creation policy:** The seed script creates sequences for the current year only. A year-boundary maintenance process (cron or scheduled migration) must create the following year's sequences before the calendar rollover. On-demand creation at first use of a new year is also acceptable if the application handles this path without error.

---

#### Table 3 — Number Assignment Events

Defines which workflow lifecycle event triggers number assignment. For the three series with a two-stage lifecycle (preliminary + final), both events are listed.

Event name constants are [Inference] — proposed identifiers consistent with the confirmed assignment rules in Parts 4.1, 4.2, 4.6, 4.8, and 5.2. The workflow engine must emit or handle these event types at the corresponding lifecycle steps. Actual event constant names are confirmed during workflow engine implementation.

| `series_id`                  | `preliminary_assignment_event` | `final_assignment_event`           | `deferred_final_assignment` |
| ---------------------------- | ------------------------------ | ---------------------------------- | --------------------------- |
| `sp_resolution`              | `SECRETARIAT_LOGGING`          | `SECOND_READING_VOTE_APPROVED`     | No                          |
| `sp_ordinance`               | `SECRETARIAT_LOGGING`          | `THIRD_READING_VOTE_APPROVED`      | No                          |
| `sp_appropriation_ordinance` | `SECRETARIAT_LOGGING`          | `THIRD_READING_VOTE_APPROVED`      | No                          |
| `notice_committee_hearing`   | —                              | `SECRETARIAT_LOGGING`              | No                          |
| `notice_special_session`     | —                              | `SECRETARIAT_LOGGING`              | No                          |
| `designation`                | —                              | `SECRETARIAT_LOGGING`              | No                          |
| `letters_received`           | —                              | `SECRETARIAT_NUMBER_ASSIGNMENT` ⁴  | **Yes**                     |
| `letters_sent`               | —                              | `SECRETARIAT_LOGGING`              | No                          |
| `memo_outgoing`              | —                              | `SECRETARIAT_FINALIZATION` ⁵       | No                          |
| `memo_incoming`              | —                              | `SECRETARIAT_LOGGING`              | No                          |
| `panlalawigan_review_log`    | —                              | `RECEIPT_OF_PROVINCIAL_RESPONSE` ⁶ | No                          |

⁴ **Letters Received — deferred assignment confirmed (Part 4.8):** "Some entries show 'SPR-2026-' with no sequence number filled, then later numbered after VM review and routing decision." The document record is created at receipt but `control_number` remains `NULL` until the Secretariat explicitly assigns it. `deferred_final_assignment = true` means the `control_number` column must be nullable for this series. `SECRETARIAT_NUMBER_ASSIGNMENT` fires when the number is deliberately entered — a distinct, recorded action separate from document creation.

⁵ **Memo Outgoing — post-finalization assignment confirmed (Part 4.6):** "Control number: SP Secretariat's own sequential number (MO format) — assigned after finalization." The MO number is not assigned at receipt; it is assigned after the outgoing memo is finalized and ready for dissemination. `SECRETARIAT_FINALIZATION` is [Inference]; the exact step name must be confirmed when the MO workflow is defined.

⁶ **Panlalawigan review log assignment event (Part 4.3, observed log fields):** The SP Secretariat's control number (`{YEAR}-{NN}`) is assigned when a provincial response is received — either a formal written Panlalawigan resolution received within 30 days, or a 30-day lapse record created by the SP Secretary. `RECEIPT_OF_PROVINCIAL_RESPONSE` is [Inference]; the event name must be confirmed when the Panlalawigan review tracking workflow is defined.

---

#### Implementation Notes

**1. `7SP` prefix and administration change**

`7SP` is not a static string. The `7` is `{SP_NUMBER}` — the ordinal of the current Sangguniang Panlungsod. Part 5.1 confirms: "Changes with each administration." When the 8th SP is seated, a Platform Administrator must update the `prefix` field on `sp_resolution`, `sp_ordinance`, and `sp_appropriation_ordinance` from `7SP` to `8SP`, or new series records must be created for the new administration. Documents issued under the 7th SP retain `7SP` permanently — the immutability rule applies (Part 5.2).

[Inference: consider storing `{SP_NUMBER}` as a separate configurable `sp_ordinal` column rather than embedding the digit directly in the `prefix` string, so that an administration change becomes a single field update rather than three data edits. Not specified in the reference document — confirm schema design before implementing.]

**2. Resolution, Ordinance, and Appropriation Ordinance share the `7SP` prefix**

All three use the final format `7SP {YEAR}-{NN}`. A bare number like `7SP 2026-05` does not indicate whether the document is a resolution, an ordinance, or an appropriation ordinance. The application must always display the document type alongside the series number in listings, search results, dashboards, and QR scan outputs.

**3. Shared prefix does not mean shared counter**

Part 5.2 confirms: "Separate PostgreSQL sequence per document type per year — no shared counter." It is therefore possible for a resolution and an ordinance to both hold the rendered number `7SP 2026-05` in the same year. The DB unique constraint is scoped to `(series_id, year, sequence_number)` — not to the rendered format string alone. This is by design and matches how the SP Secretariat manages these as independent series.

**4. Preliminary number lifecycle for Resolution and Ordinance types**

Part 5.2 confirms: "Preliminary numbers can be replaced before finalization." A resolution may be assigned `Draft 7SP 2026-02` at logging, but if the document originally assigned `Draft 7SP 2026-01` is voted on and finalised first, preliminary and final sequence order will diverge. The `preliminary_number` column must be nullable and mutable for `sp_resolution`, `sp_ordinance`, and `sp_appropriation_ordinance` until the final assignment event fires. Once the final number is assigned, `preliminary_number` is retired and `final_number` is immutable with no override path for any role.

**5. `panlalawigan_review_log` — entity classification**

The `panlalawigan_review_log` series (format `{YEAR}-{NN}`, no prefix) is the SP Secretariat's internal control number for tracking provincial review responses (Part 4.3: "Control No.: SP Secretariat's own sequence number, e.g. 2026-01"). This is a log or registry entry, not a legislative document. Whether this entity is modelled as a `document_type` row in the `documents` schema or as a distinct entity in the `tracking` or `records` schema depends on the final data model. The `document_type_code = PANLALAWIGAN_REVIEW_LOG` in Table 1 is [Inference] and may not apply if this entity is not stored in the `documents` table. Confirm before implementing.

**6. Certification of Urgency — no series record**

Q-B01 (developer decision, Part 4.17) confirmed: the Certification of Urgency has no standalone numbering series. It is attached to the associated legislative measure(s) as a document attachment and referenced by the measure's own number. No `number_series` record is required.

**7. QR tracking number — not a series**

Part 5.2 confirms: "QR tracking number: System-generated UUID, independent of preliminary and final numbers. Assigned at secretariat logging (before preliminary number). Immutable for document's life." The QR tracking number is not managed by the `number_series` table. It is generated directly as a UUID at document creation, before any numbering event fires.

**8. Phase 1B series — seed all records before Phase 1 goes live**

NCH, NOSP, Designation, Letters Received, Letters Sent, Memo Outgoing, and Memo Incoming are Phase 1B document types, but all 11 series records should be seeded together before Phase 1 deployment. [Inference: if the schema includes an `active` flag on `number_series`, Phase 1B series can be seeded as inactive and activated when Phase 1B workflows are deployed. If no such flag exists, seeding all records early has no functional impact — unused series have zero sequence activity until the corresponding workflow is live.]

**9. Gap policy**

Part 5.2: "Gaps: Permitted only for cancelled documents; gap logged with cancellation reason. Reuse: Never, even if cancelled." Enforced at the application layer. A cancelled document's sequence number is permanently retired. The PostgreSQL sequence continues incrementing; the gap is recorded as a cancellation event in the audit log. No mechanism exists for any role to reuse a gap number.
