# Context: Phase 1 Workflow Definitions — Structured Data — Blocking

> **Purpose:** Filtered reference for producing the Phase 1 workflow definition seed records (`workflow.definitions` table) for SP Resolution (standard + Certified Urgent), SP Ordinance (standard + Certified Urgent), and Appropriation Ordinance.
> 
> **Source documents:** `2-stack-context.md` + `consolidated-architecture-and-requirements-reference-iteration-3.md`
> 
> **What was excluded:** Stakeholder identities, numbering formats, document request/records/complaint modules, portal, IAM, org structure, file storage, OCR, audit log internals, session management, citizen identity, LMITS migration, barangay workflows, Phase 2–5 content, compliance details, DR/backup, mobile/device, extensibility tiers, all of Part 14 Q&A not bearing on workflow step logic, and all non-workflow stack detail from `2-stack-context.md`.

---

## 1. Stack — Workflow-Relevant Only

### 1.1 Database

- **PostgreSQL** — mandatory. JSONB, Row-Level Security, append-only audit grants.
- **Drizzle ORM + Drizzle Kit** — schema and migrations. TypeScript inference.
- Schema for workflow: `schema: workflow → definitions, definition_versions, steps, transition_rules, instances, step_instances, workflow_events`
- No cross-schema foreign keys. `workflow` module communicates with other modules only through the internal event bus or published module APIs.
- **Primary keys:** UUID v4 (`gen_random_uuid()`) everywhere.
- **Timestamps:** `TIMESTAMPTZ` on every timestamp column.
- **Soft-delete:** `deleted_at TIMESTAMPTZ` + `deleted_by UUID` on every table. No hard deletes.
- **`city_id UUID NOT NULL`** in all core entity tables (default: Batac City UUID).

### 1.2 Validation / Contracts

- **Zod** in `/packages/shared` is the single source of truth: backend validation, DB types, frontend forms.
- Type safety chain: `Drizzle schema → drizzle-zod → Zod schemas → /packages/shared → Fastify route validation, tRPC input validation, React Hook Form`.

### 1.3 Scheduling (relevant to 10-day Mayor timer)

- **node-cron** (simple) + **pgboss** (durable) — durable jobs handle the 10-day Mayor lapse timer and 30-day Panlalawigan timer.

### 1.4 Workflow Engine Implementation

- **Custom domain-specific engine.** Not Camunda, Temporal, or Flowable.
- Admin-configurable without developer involvement (for workflow definitions).
- Workflow instance **pins to definition version active at creation** (`definition_version_id` column on the instance).
- In-flight migration: Option A (continue under old version) or Option B (admin migrates with mandatory reason, 2nd-level approval from City Administrator, 24-hour reversible window, dedicated audit event).

---

## 2. Workflow Engine — Step Types (Phase 1)

|Type|Description|Phase|
|---|---|---|
|`action`|User performs an action (review, comment)|Phase 1|
|`approval`|User approves, rejects, or returns for revision|Phase 1|
|`multi_referral`|Assigns to multiple committees simultaneously; **all committees must sign/contribute to the unified report**; committees missing Thursday cutoff delay Second Reading; absent committees marked red in Order of Business; completes when all-committee unified report submitted and accepted by SP Secretary|Phase 1|
|`decision`|System evaluates a condition; routes accordingly|Phase 1|
|`notification`|System sends a notification; no user action required|Phase 1|
|`termination`|Ends the workflow|Phase 1|
|`parallel_split`|Splits into parallel branches|Phase 2 (reserved in data model)|
|`parallel_join`|Merges parallel branches|Phase 2 (reserved in data model)|

---

## 3. SP Resolution Workflow

### 3.1 Confirmed Step Sequence (Standard Path)

1. **Councilor / SP Staff drafts resolution** — inputs sponsors in title.
2. **SP Secretariat logs** — receives draft; logs in system; **QR code assigned** (tracking starts); **Preliminary Draft number assigned** (`Draft 7SP {YEAR}-{NN}`).
3. **SP Secretary consolidates into Order of Business** — cutoff: **Thursday** for next Tuesday session.
4. **SP Session — First Reading** — title and sponsors read; Vice Mayor refers to committee/s.
5. **Branch: Certified Urgent?** (Mayor issued formal Certification of Urgency document)
    - **No → Committee referral (`multi_referral` step)** — joint hearing if multiple committees referred; unified compiled report; hearing continues even if a committee is absent.
        - Committee defers or archives → **Archived** (terminal).
        - Committee report submitted to Secretariat **before Thursday cutoff**.
    - **Yes → skip directly to Second Reading** (committee review and report entirely skipped).
6. **SP Session — Second Reading** — debate, amendments if any, vote.
    - Voted down → **Archived** (terminal).
    - Approved with amendments → Secretariat logs amendments, finalizes document, prepares amended final copy → **Final vote on amended version**.
        - Rejected → **Archived** (terminal).
        - Approved → proceed to step 7.
    - Approved without amendments → proceed to step 7.
7. **SP Secretary assigns Final Number** — Draft prefix removed (`7SP {YEAR}-{NN}`); Secretariat decides the number. **Assigned after Second Reading vote, before VP and Mayor sign.**
8. **Presiding Officer (Vice Mayor) signs certified copy.**
9. **Transmittal Letter to Mayor** — formal cover letter (SPS format): "For appropriate action." System generates or prompts Secretariat to generate.
10. **Mayor review — 10 calendar days.**
    - Mayor signs → document returns to SP Secretariat.
    - 10-day lapse (no Mayor action) → **Lapsed into Law** (logged with RA 7160 legal basis; SP Secretary notified) → continues to docketing.
    - Mayor vetoes → returned to SP with objections; **Override vote: 2/3 = 8 of 12**.
        - Override fails → **Archived** (terminal).
        - Override succeeds → document returns to SP Secretariat.
11. **Docketing** — Secretariat readies for distribution. Document already signed; already has final number.
12. **Sangguniang Panlalawigan review — 30-day timer.**
    - VALID → SP Secretary records outcome; notifies relevant offices.
    - VALID-IN-PART → manual review (SP Secretary chooses path; audit-logged with mandatory comment).
    - RETURNED → SP follows recommendations; modify, repass, or return to draft; implementation usually stopped.
    - 30 days no action → **Deemed Approved per RA 7160 Section 56(d)**; Remarks: "Lapsed 30 days."
    - All outcomes → proceed to publication/release.
13. **Publication** — title and first page public only. Full copy: paid Document Request required.
14. **Records Officer — Permanent Archive.**
15. **Public Portal** — title and first page visible; full copy via Document Request Form.

### 3.2 Certified Urgent Path — Resolution

- Mayor issues **formal written Certification of Urgency document** (not a verbal declaration).
- Secretariat logs the Certification (does not create or authorize it).
- A single Certification can cover **multiple measures in the same session**; attached to each measure individually in the system.
- Certification has **no standalone number** — attached to associated measure(s), not filed independently.
- Upon logging: each associated measure's workflow instance **bypasses the committee referral step** and advances directly to Second Reading.
- **First and Second Reading occur in the same session.**
- Frequency: **frequent** — fully supported in Phase 1.

### 3.3 Legally Mandated Minimum Steps — SP Resolution

|Required Step|Notes|
|---|---|
|Committee referral OR Certified Urgent path|One of these must appear in every Resolution workflow instance|
|Second Reading vote|Mandatory|
|VP certification (sign)|Mandatory|
|Transmittal to Mayor|Mandatory|
|Mayor review (10-day timer)|Mandatory; lapse = law|
|Docketing|Mandatory after Mayor action|
|Panlalawigan review (30-day timer)|Mandatory|
|Release / Publication|Mandatory|

### 3.4 Key Constraints — SP Resolution

- **Two readings only** (not three). Supersedes any prior reference to three readings.
- Final number assigned **after Second Reading vote, before VP and Mayor sign** — not after Mayor's signature.
- Amendments at Second Reading: Secretariat logs and finalizes. No separate third reading for resolutions.
- Mayor 10-day lapse: applies to resolutions (confirmed — same rule as ordinances).
- Veto override: 2/3 majority = **8 of 12 members**.
- Transmittal Letter is a mandatory step before Mayor review.
- Docketing occurs **after** returning from Mayor; document already has final number at that point.
- Both resolutions and ordinances transmitted to Panlalawigan **after** Mayor action.
- Panlalawigan RETURNED → implementation usually stopped.
- Publication: title and first page publicly visible; full copy requires paid Document Request + VM + SP Secretary approval.

---

## 4. SP Ordinance Workflow

### 4.1 Confirmed Step Sequence (Standard Path)

1. **Councilor / SP Staff drafts ordinance.**
2. **SP Secretariat logs** — QR code assigned; Preliminary Draft number assigned (`Draft 7SP {YEAR}-{NN}`).
3. **SP Secretary consolidates into Order of Business.**
4. **SP Session — First Reading** — Vice Mayor refers to committee/s.
5. **Branch: Certified Urgent?**
    - **No → Committee referral (`multi_referral` step)** — joint hearing if multiple committees; unified report; hearing continues even if committee absent.
        - Committee report submitted before Thursday cutoff.
    - **Yes → skip directly to Second Reading** (committee review and report entirely skipped).
6. **SP Session — Second Reading** — debate; amendments if any; incorporated by Secretariat.
    - Voted down → **Archived** (terminal).
    - Approved with amendments → Secretariat logs amendments; prepares final copy with amendments → proceed to Third Reading (amended version).
    - Approved without amendments → proceed to Third Reading (unamended version).
7. **SP Session — Third Reading** — final version (with or without amendments) read; final vote.
    - Voted down → **Archived** (terminal).
    - Approved → proceed to step 8.
8. **SP Secretary assigns Final Number** — Draft prefix removed (`7SP {YEAR}-{NN}`); assigned **after Third Reading vote, before VP and Mayor sign.**
9. **Vice Mayor signs.**
10. **Transmittal Letter to Mayor** — formal cover letter (SPS format): "For appropriate action."
11. **Mayor review — 10 calendar days.**
    - Mayor signs → returns to Secretariat.
    - 10-day lapse → **Lapsed into Law** (RA 7160 Section 47) → continues to docketing.
    - Mayor vetoes → SP override vote: 2/3 = 8 of 12.
        - Override fails → **Archived** (terminal).
        - Override succeeds → returns to Secretariat.
12. **Docketing** — Secretariat readies for distribution. Document already signed; already has final number.
13. **Sangguniang Panlalawigan review — 30-day timer.**
    - VALID → SP Secretary records outcome; notifies relevant offices.
    - OPERATIVE IN ITS ENTIRETY → same treatment as VALID (used specifically for Appropriation Ordinances; synonymous with valid/implementable).
    - VALID-IN-PART → manual review (SP Secretary chooses path; audit-logged with mandatory comment).
    - RETURNED → follow recommendations; implementation usually stopped.
    - 30 days no action → **Deemed Approved per RA 7160 Section 56(d)**; Remarks: "Lapsed 30 days."
14. **Publication branch:**
    - Penalty ordinance? **Yes** → full ordinance text published in newspaper (Ilocos Times). SP Secretariat arranges placement. Publication date is a mandatory tracked field.
    - Penalty ordinance? **No** → no newspaper publication required.
15. **Records Officer — Permanent Archive.**
16. **Public Portal.**

### 4.2 Certified Urgent Path — Ordinance

- Identical trigger and attachment rules as Resolution (see Section 3.2).
    
- **Committee review and report entirely skipped.**
    
- First and Second Reading occur in the same session.
    
- Third Reading still required (ordinances always require three readings when not bypassed — but the Certified Urgent path only bypasses committee referral; readings 2 and 3 proceed per standard ordinance flow).
    
    > [Inference] The Certified Urgent path bypasses committee referral only, not the reading count for ordinances. Standard three-reading requirement still applies. Behavior of the certified urgent path for ordinances beyond the committee-skip is not explicitly re-confirmed for the Third Reading; this is reasoned from the confirmed constraint that ordinances require three readings. Label: **[Inference — not independently confirmed for Certified Urgent + Ordinance + Third Reading combination]**.
    

### 4.3 Legally Mandated Minimum Steps — SP Ordinance

|Required Step|Notes|
|---|---|
|Committee referral OR Certified Urgent path|One of these must appear in every Ordinance workflow instance|
|Three readings (1st, 2nd, 3rd)|Mandatory|
|VP certification (sign)|Mandatory|
|Transmittal to Mayor|Mandatory|
|Mayor review (10-day timer)|Mandatory; lapse = law|
|Docketing|Mandatory after Mayor action|
|Panlalawigan review (30-day timer)|Mandatory|
|Publication (if penalty)|Mandatory when ordinance contains penalty; SP Secretariat arranges|
|Release|Mandatory|

### 4.4 Key Constraints — SP Ordinance

- **Three readings.** First (referral), Second (amendments), Third (final version; final vote).
- Amendments at Second Reading. Third Reading reads the final amended version.
- Final number assigned **after Third Reading vote, before VP signs.**
- Mayor 10-day lapse applies.
- Veto override: 2/3 = 8 of 12.
- Publication: only ordinances **with penalty** require full newspaper publication (Ilocos Times). Ordinances without penalty: public portal only.
- Publication date is a mandatory tracked field.
- SP Secretariat arranges publication — not the Mayor's Office.

---

## 5. Appropriation Ordinance Workflow

### 5.1 Flow

**Identical to SP Ordinance workflow in all respects.** No special-case workflow.

- Same three readings.
- Same committee referral / Certified Urgent branching.
- Same Mayor 10-day lapse.
- Same Panlalawigan review.
- Panlalawigan outcome **"OPERATIVE IN ITS ENTIRETY"** = synonymous with VALID; means the ordinance is valid and can be implemented. Used specifically for Appropriation Ordinances.
- Supplemental Appropriation Ordinances (which allocate more to initial budget) follow the same flow.
- Numbering uses the same format as regular ordinances (`Draft 7SP {YEAR}-{NN}` → `7SP {YEAR}-{NN}`), same annual counter.

### 5.2 Legally Mandated Minimum Steps — Appropriation Ordinance

Same table as SP Ordinance (Section 4.3), with the addition:

- Panlalawigan outcome "OPERATIVE IN ITS ENTIRETY" treated equivalently to VALID.

---

## 6. Multi-Committee Referral Step (`multi_referral`) — Detail

### 6.1 Decision (Finalized)

**Option B selected:** Single `multi_referral` step type with multiple committee assignees. One workflow step assigns to multiple committees simultaneously; each committee contributes to a unified report; step completes when the joint report is submitted and accepted by the SP Secretary.

**This decision is finalized. The workflow engine schema must implement `multi_referral` as a distinct step type before Phase 1 development begins.**

### 6.2 Behavior

- Accepts a list of assigned committees.
- **All assigned committees must sign and contribute to the unified report** before the step completes.
- Absent committees (and those that have not yet submitted their contribution) are **marked red in the Order of Business** — visually flagged but do not block the hearing itself.
- Committee report deadline: **Thursday cutoff** before the next Tuesday session.
- If one or more committees have not submitted their contribution before the Thursday cutoff: the Second Reading for that measure does **not** proceed at the immediately following Tuesday — it is delayed to the **Tuesday after the week in which all committees submit**.
- **SP Secretary can manually advance the step** (overriding a missing report) — this must be audit-logged with a mandatory comment.
- Completes when the unified committee report is submitted and accepted by the SP Secretary, with **all required committee signatures**.

### 6.3 Context: Why Multi-Referral Exists

- Most SP measures are referred to **two committees simultaneously**: the relevant subject-matter committee AND the Committee on Laws. This is standard practice — not a special case.
- Committee on Laws appears on nearly every Notice of Committee Hearing — effectively a co-reviewer by default.
- Joint hearing: **single unified compiled report** regardless of how many committees are referred.
- If one committee is absent, the hearing still continues.
- Even if an entire committee is absent as a whole, the hearing proceeds.
- Not all committee members are required to be present.
- System does **not** log individual committee absentees.
- In one hearing session, multiple documents can be discussed as long as the committees concerned are the same.

### 6.4 Architectural Implication (from Part 10.4)

The `workflow` module's step type for committee referral must support a list of assigned committee roles. The data model already reserves `parallel_split` and `parallel_join` step types for Phase 2. Phase 1 requires the `multi_referral` step type as a schema decision to make before the first workflow module migration. The `parallel_split`/`parallel_join` types remain reserved for Phase 2 (Barangay Budget workflow). Option B does not conflict with those types.

---

## 7. Mayor's 10-Day Lapse-into-Law Rule

- Applies to **both SP Resolutions AND SP Ordinances** (and Appropriation Ordinances).
- At **day 10 with no Mayor action**: system transitions to "Lapsed into Law."
- Logs RA 7160 legal basis automatically.
- Notifies SP Secretary.
- Document continues to docketing/distribution as if Mayor had signed.
- **Durable job (pgboss)** handles the timer — must be durable, not in-memory.

---

## 8. 10-Day Timer — Transition Rule Detail

|Trigger|Condition|Outcome|
|---|---|---|
|Mayor signs|Within 10 calendar days|Document returns to SP Secretariat; proceeds to docketing|
|No Mayor action|Day 10 elapses with no action|Lapsed into Law; RA 7160 logged; SP Secretary notified; proceeds to docketing|
|Mayor vetoes|Within 10 calendar days|Returned to SP with objections; override vote required (8 of 12)|

---

## 9. Panlalawigan Review — 30-Day Timer and Transition Rules

**Scope:** Both ordinances AND resolutions are transmitted. **Sequence:** Transmission occurs **AFTER Mayor action** (sign or lapse).

|Outcome|System Behavior|
|---|---|
|VALID|SP Secretary records outcome; notifies relevant offices; document proceeds|
|VALID-IN-PART|System marks VALID-IN-PART; attaches Panlalawigan response; places step in "Awaiting SP Secretariat Action." SP Secretary chooses: (1) Resolve as-is with mandatory comment; (2) Route to Legal Office; (3) Route to concerned Committee; (4) Implement revisions directly. All choices audit-logged.|
|RETURNED|System flags high-priority; requires immediate review. Secretariat decides path: modify and repass (back to drafting) is standard. Implementation stops.|
|OPERATIVE-IN-ITS-ENTIRETY|Used for Appropriation Ordinances only; treated as VALID|
|30 days no action|System transitions status to "Deemed Approved per RA 7160 Section 56(d)"; notifies SP Secretary for confirmation; Remarks field: "Lapsed 30 days"|

**Timer:** Automatically tracked from transmission date. Durable job (pgboss) required.

---

## 10. Thursday Cutoff Enforcement Rule

- **Sessions:** Always on **Tuesdays**.
- **Order of Business cutoff:** Thursday of the preceding week.
- Documents received by Secretariat **before Thursday** are included in the next Tuesday Order of Business.
- Committee reports must be submitted to Secretariat **before Thursday cutoff**.
- If committee report not submitted by Thursday: item **marked red** in Order of Business.
- If report still not submitted before the following Thursday: **Second Reading is delayed** — proceeds only on the Tuesday after the week the committee submits.
- Missing committee reports: marked red in Order of Business and in the SP Secretary dashboard.
- This is enforced in the `multi_referral` step type's completion logic, not just as a UI indicator.

---

## 11. Certified Urgent Path — Full Rules (Both Document Types)

|Rule|Value|
|---|---|
|Authorization source|Mayor issues formal written Certification of Urgency document|
|Logged by|SP Secretariat (receives and logs; does not create or authorize)|
|Effect on workflow|Associated measure(s) bypass committee referral step; advance directly to Second Reading in the same session|
|Frequency|Frequent — common occurrence; must be fully supported in Phase 1|
|Standalone number|**None** — Certification is always associated with and referenced by the document(s) it certifies|
|Filing|Attached to the specific legislative measure(s) — not filed as a standalone document|
|Scope per certification|A single Certification **can cover multiple measures** in the same session|
|Attachment when multi-measure|Attached to each measure individually in the system|
|Committee review|**Entirely skipped** — no committee referral, no committee report required|
|Reading count|Resolution: both readings in same session. Ordinance: readings 2 and 3 still required after First Reading in same session.|
|Phase|Phase 1 (not Phase 1B)|

---

## 12. Workflow Schema Module — Reference Fields

From `schema: workflow`:

```
definitions
definition_versions     ← instances pin to this via definition_version_id
steps
transition_rules
instances
step_instances
workflow_events
```

Key instance constraint: **`definition_version_id`** — the workflow instance column that pins to the definition version active at creation. All resolution uses the pinned version.

The seed records for Phase 1 go into `workflow.definitions` (and their associated `definition_versions`, `steps`, and `transition_rules` records).

---

## 13. Hardcoded Workflow Constraints (Architectural Invariant #14)

From Part 12 (Architectural Invariants):

> **Invariant #14:** Workflow constraints per document type (legally mandated minimum steps) — enforcement method: Workflow editor validation.

This means the seed definitions must include guards that prevent a Platform Administrator from removing legally required steps through the admin UI.

### Minimum Step Guards by Document Type

|Document Type|Minimum Required Steps (cannot be removed by admin)|
|---|---|
|SP Resolution|Committee referral OR Certified Urgent path; Second Reading vote; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Release|
|SP Ordinance|Committee referral OR Certified Urgent path; Three readings; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Publication (if penalty); Release|
|Appropriation Ordinance|Same as SP Ordinance; OPERATIVE-IN-ITS-ENTIRETY outcome handled as VALID|

---

## 14. Session and Scheduling Context (Relevant to Workflow Transitions)

|Rule|Detail|
|---|---|
|Session day|Tuesdays|
|Order of Business cutoff|Thursday of the preceding week|
|First Reading scheduling|SP Secretariat schedules|
|Second Reading scheduling|Committee schedules|
|Hearing scheduling|Committees and concerned parties decide; Secretariat logs what committee communicates|
|Hearing date input in system|Secretariat staff enters — not direct committee input|
|Committee referral without date|Allowed — step can begin as "assigned; date TBD"|
|Committee report deadline|**Thursday cutoff** — if not submitted, Second Reading delayed|
|Certified Urgent: committee step|**Entirely skipped**|
|Multiple documents in one session|Allowed if committees concerned are the same|
|Missing committee reports|Marked red in Order of Business|

---

## 15. Transmittal Letter as Workflow Step

- When a resolution or ordinance reaches the Mayor's review step, the system should **generate (or prompt the Secretariat to generate) a Transmittal Letter** (SPS format) to the Mayor's Office.
- This is a formal cover letter: "For appropriate action."
- This is a **mandatory step** in both Resolution and Ordinance workflows — appears in the hardcoded minimum step guards.
- The Transmittal Letter is an SPS document (Letters Sent); it gets its own SPS control number.

---

## 16. Workflow Definition Versioning Rules

- **Version pinning:** Instance pins to definition version active at creation.
- **In-flight migration:** Two options:
    - **Option A:** Continue under old version (default).
    - **Option B:** Admin migrates with mandatory reason + 2nd-level approval from City Administrator required + 24-hour reversible window + dedicated audit event.
- Workflow definitions are **administrator-configurable** (no developer involvement), subject to the hardcoded minimum step guards (Invariant #14).
- Workflow definitions must be published/deprecated — both events are always audited (cannot be disabled).

---

## 17. SLA and Escalation (Workflow-Level)

- SLA clock starts at workflow initiation.
- Warning at **80% of SLA time**.
- Automatic escalation at breach: notify supervisor + Records Officer.
- ARTA defaults: simple ≤ 3 working days; complex ≤ 7 working days; highly technical ≤ 20 working days.
- **System outage does not suspend ARTA obligations.** SLA clock continues regardless of connectivity.
- These SLA rules apply at the workflow-instance level and must be configurable per workflow definition.

---

## 18. Archival / Terminal States

- **Archived** is a terminal state reachable when:
    - Committee defers or archives a referred measure.
    - Second Reading vote rejects (either initial vote or vote on amended version for resolutions).
    - Third Reading vote rejects (ordinances).
    - Mayor veto override fails.
- **Cancelled** is a terminal state reachable from any active state by an authorized actor.
- No permanent deletion. Soft-delete only (`deleted_at` + `deleted_by`).