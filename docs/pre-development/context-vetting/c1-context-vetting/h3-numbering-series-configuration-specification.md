### Numbering Series Configuration Specification — Blocking

**Source:** Part 5.1 and Part 5.2, Consolidated Architecture & Requirements Reference (Iteration 3) **Blocking:** `number_series` must be seeded before the first workflow engine migration runs. Workflow definitions resolve number formats and sequences by `series_id` at instance creation time. This seed cannot be deferred. **Scope:** 11 confirmed series. Two entries excluded: Franchise Ordinance (out of scope); Panlalawigan external reference `R{YEAR}-{NNNN}` (provincially assigned; stored as metadata in a dedicated column; not a managed series).

---

#### Global Field Values — Identical Across All 11 Records

Do not repeat these in individual series rows unless a specific series requires an override.

| Field                 | Value                             | Source                                                 |
| --------------------- | --------------------------------- | ------------------------------------------------------ |
| `delimiter`           | `" "` (single space)              | Q-A01 — confirmed                                      |
| `resets_annually`     | `true`                            | Part 5.1 — confirmed for all 11 series                 |
| `authority_office_id` | FK → SP Secretariat office record | Q-B03 — confirmed                                      |
| `year_format`         | `YYYY` (4-digit)                  | [Inference — consistent with all examples in Part 5.1] |

---

#### Table 1 — Series Identity and Formats

`series_id` values are [Inference] — proposed stable slugs. Not defined in the reference document. `document_type_code` values are [Inference] — proposed FK references. Must match the `document_types` seed, which must be defined before this seed runs. Padding footnotes follow the table.

|`series_id`|`document_type_code`|`prefix`|`sequence_padding`|`preliminary_format`|`final_format`|Phase|
|---|---|---|---|---|---|---|
|`sp_resolution`|`SP_RESOLUTION`|`7SP`|`2` ¹|`Draft 7SP {YEAR}-{NN}`|`7SP {YEAR}-{NN}`|1|
|`sp_ordinance`|`SP_ORDINANCE`|`7SP`|`2` ¹|`Draft 7SP {YEAR}-{NN}`|`7SP {YEAR}-{NN}`|1|
|`sp_appropriation_ordinance`|`SP_APPROPRIATION_ORDINANCE`|`7SP`|`2` ¹|`Draft 7SP {YEAR}-{NN}`|`7SP {YEAR}-{NN}`|1|
|`notice_committee_hearing`|`NOTICE_COMMITTEE_HEARING`|`NCH`|`2` ¹|—|`NCH {YEAR}-{NN}`|1B|
|`notice_special_session`|`NOTICE_SPECIAL_SESSION`|`NOSP`|`2` ¹|—|`NOSP {YEAR}-{NN}`|1B|
|`designation`|`DESIGNATION`|`D`|`2` ¹|—|`D {YEAR}-{NN}`|1B|
|`letters_received`|`LETTER_RECEIVED`|`SPR`|`3` ²|—|`SPR {YEAR}-{NNN}`|1B|
|`letters_sent`|`LETTER_SENT`|`SPS`|`2` ³|—|`SPS {YEAR}-{NN}`|1B|
|`memo_outgoing`|`MEMO_OUTGOING`|`MO`|`2` ¹|—|`MO {YEAR}-{NN}`|1B|
|`memo_incoming`|`MEMO_INCOMING`|`MI`|`2` ¹|—|`MI {YEAR}-{NN}`|1B|
|`panlalawigan_review_log`|`PANLALAWIGAN_REVIEW_LOG`|_(none)_|`2` ¹|—|`{YEAR}-{NN}`|1|

**Padding footnotes:**

¹ `sequence_padding = 2` is [Inference] — derived from all observed examples in Part 5.1. The reference document uses the placeholder `{NN}` without specifying minimum digit width.

² `sequence_padding = 3` for SPR is [Inference — recommended]. Annualised volume ~456, which exceeds the 2-digit ceiling of 99. 3-digit padding (001–999) accommodates projected volume.

³ `sequence_padding = 2` for SPS is [Inference — flagged for review]. Annualised volume ~144, which exceeds 99. 3-digit padding may be required. Confirm with SP Secretariat before finalising.

---

#### Table 2 — PostgreSQL Sequence Names

One sequence per series per year. `sequence_name_pattern` is [Inference] — a proposed naming convention. The reference document specifies per-year sequences but does not define a naming pattern. Confirm the convention before writing migration scripts.

|`series_id`|`sequence_name_pattern`|Example (year 2026)|
|---|---|---|
|`sp_resolution`|`ns_sp_resolution_{YEAR}_seq`|`ns_sp_resolution_2026_seq`|
|`sp_ordinance`|`ns_sp_ordinance_{YEAR}_seq`|`ns_sp_ordinance_2026_seq`|
|`sp_appropriation_ordinance`|`ns_sp_appropriation_ordinance_{YEAR}_seq`|`ns_sp_appropriation_ordinance_2026_seq`|
|`notice_committee_hearing`|`ns_nch_{YEAR}_seq`|`ns_nch_2026_seq`|
|`notice_special_session`|`ns_nosp_{YEAR}_seq`|`ns_nosp_2026_seq`|
|`designation`|`ns_designation_{YEAR}_seq`|`ns_designation_2026_seq`|
|`letters_received`|`ns_letters_received_{YEAR}_seq`|`ns_letters_received_2026_seq`|
|`letters_sent`|`ns_letters_sent_{YEAR}_seq`|`ns_letters_sent_2026_seq`|
|`memo_outgoing`|`ns_memo_outgoing_{YEAR}_seq`|`ns_memo_outgoing_2026_seq`|
|`memo_incoming`|`ns_memo_incoming_{YEAR}_seq`|`ns_memo_incoming_2026_seq`|
|`panlalawigan_review_log`|`ns_panlalawigan_review_log_{YEAR}_seq`|`ns_panlalawigan_review_log_2026_seq`|

---

#### Table 3 — Number Assignment Events

Defines which workflow lifecycle event triggers number assignment. Included here because it determines column nullability constraints in the DDL.

|`series_id`|`preliminary_assignment_event`|`final_assignment_event`|`deferred_final_assignment`|
|---|---|---|---|
|`sp_resolution`|`SECRETARIAT_LOGGING`|`SECOND_READING_VOTE_APPROVED`|No|
|`sp_ordinance`|`SECRETARIAT_LOGGING`|`THIRD_READING_VOTE_APPROVED`|No|
|`sp_appropriation_ordinance`|`SECRETARIAT_LOGGING`|`THIRD_READING_VOTE_APPROVED`|No|
|`notice_committee_hearing`|—|`SECRETARIAT_LOGGING`|No|
|`notice_special_session`|—|`SECRETARIAT_LOGGING`|No|
|`designation`|—|`SECRETARIAT_LOGGING`|No|
|`letters_received`|—|`SECRETARIAT_NUMBER_ASSIGNMENT`|**Yes**|
|`letters_sent`|—|`SECRETARIAT_LOGGING`|No|
|`memo_outgoing`|—|`SECRETARIAT_FINALIZATION`|No|
|`memo_incoming`|—|`SECRETARIAT_LOGGING`|No|
|`panlalawigan_review_log`|—|`RECEIPT_OF_PROVINCIAL_RESPONSE`|No|

⁴ **Letters Received — deferred assignment confirmed:** The document record is created at receipt but `control_number` remains `NULL` until the Secretariat explicitly assigns it. **DDL constraint: `control_number` column must be nullable for this series.**

---

#### Implementation Notes (DDL-Relevant Only)

**1. `7SP` prefix and administration change**

The `7` in `7SP` is the SP ordinal — changes with each administration. [Inference: consider a separate `sp_ordinal` column rather than embedding the digit in the `prefix` string, so an administration change is a single field update rather than three data edits. Not specified in the reference document — confirm schema design before implementing.]

**2. Shared prefix does not mean shared counter**

All three `7SP` series use the same rendered prefix. The DB unique constraint on `number_series` must be scoped to `(series_id, year, sequence_number)` — not to the rendered format string. A resolution and an ordinance may both legitimately hold the rendered number `7SP 2026-05` in the same year.

**3. Preliminary number nullability and mutability**

`preliminary_number` must be nullable and mutable on `sp_resolution`, `sp_ordinance`, and `sp_appropriation_ordinance` until the final assignment event fires. Once `final_number` is assigned, it is immutable — no override path exists for any role. **DDL constraint: `final_number` column must be NOT NULL only after assignment; `preliminary_number` must be nullable.**

**4. `panlalawigan_review_log` — entity classification**

The `panlalawigan_review_log` series is an SP Secretariat internal control number for tracking provincial review responses — a log entry, not a legislative document. Whether this entity is modelled as a row in `documents.document_types` or as a distinct entity in `tracking` or `records` is unresolved. `document_type_code = PANLALAWIGAN_REVIEW_LOG` in Table 1 is [Inference] and may not apply. **Confirm before writing DDL for this series.**

**5. Certification of Urgency — no series record, no sequence**

The Certification of Urgency has no standalone numbering series. No `number_series` row and no PostgreSQL sequence is required. It is stored as an attachment to the associated legislative measure.

**6. QR tracking number — not a series, not a sequence**

The QR tracking number is a UUID generated directly at document creation — before any numbering event fires. It is not managed by `number_series` and requires no PostgreSQL sequence. **DDL: stored as a UUID column on the document record, generated with `gen_random_uuid()`.**

**7. Column nullability summary for `documents.numbers`**

|Column|Nullable|Reason|
|---|---|---|
|`preliminary_number`|Yes|Only present for Resolution, Ordinance, Appropriation Ordinance; absent for all other series|
|`final_number`|Yes|Assigned at a later lifecycle event; NULL until assignment event fires|
|`control_number`|Yes|Deferred for Letters Received; also absent for series without a control number concept|
|`series_id`|No|Always required|
|`year`|No|Always required|
|`sequence_number`|No|Always required; assigned when the number is assigned|

---

**What was removed and why:**

|Removed section|Reason|
|---|---|
|Seed policy timing and "seed all 11 before Phase 1" guidance|Deployment/ops concern; no DDL column or constraint implied|
|Gap policy enforcement detail|Application-layer enforcement; DDL implication (gap logging) already captured in audit schema context|
|Table 3 event name constant values beyond nullability implication|Event constants are workflow engine implementation detail, not DDL|
|Footnote ⁵ and ⁶ event name confirmation notes|Workflow engine concern; the DDL only needs to know `deferred = No` for those two|
|Application UI behavior descriptions|No DDL implication|
|"Sequence creation policy" (cron/on-demand)|Ops concern; the DDL only needs to know one sequence per series per year|
|Implementation Note 8 (`active` flag speculation)|[Inference] flag on an optional column; not confirmed; excluded to avoid polluting DDL design with unconfirmed fields|