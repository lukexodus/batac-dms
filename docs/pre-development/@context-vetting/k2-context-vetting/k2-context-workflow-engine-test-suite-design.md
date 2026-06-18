# K2 Context — Workflow Engine Test Suite Design (Pre-dev)

**Source:** Stack Context + Consolidated Architecture & Requirements Reference (Iteration 3) **Purpose:** All context needed to write the complete workflow engine test case specification before any engine code is written. Stripped of everything unrelated to the engine, its step types, valid/invalid transitions, and all domain rules the engine must enforce.

---

## 1 — Technology Stack (Testing-Relevant Subset)

|Layer|Choice|
|---|---|
|Backend framework|Fastify|
|Internal API|tRPC on Fastify|
|Database|PostgreSQL|
|ORM|Drizzle ORM + Drizzle Kit|
|Validation / contracts|Zod (shared package)|
|Testing|**Vitest (unit/integration)** + Playwright (E2E)|
|Scheduling|node-cron (simple) + **pgboss (durable)**|

**Testing priority order (from Stack Context):**

1. Workflow engine state machine — every valid and invalid state transition ← _this is K2_
2. API integration tests — all ABAC-protected Fastify routes
3. E2E tests (Playwright) — the five or six most critical user journeys

> Do not chase high unit test coverage of CRUD modules. It is a poor return on investment.

---

## 2 — Workflow Engine: Core Design

### 2.1 Implementation approach

Custom domain-specific engine. Not Camunda, Temporal, or Flowable. Admin-configurable without developer involvement.

### 2.2 Phase 1 Step Types

|Type|Description|Phase|
|---|---|---|
|`action`|User performs an action (review, comment)|Phase 1|
|`approval`|User approves, rejects, or returns for revision|Phase 1|
|`multi_referral`|Assigns to multiple committees simultaneously; **all committees must sign/contribute to the unified report**; committees missing Thursday cutoff delay Second Reading; absent committees marked red in Order of Business; completes when all-committee unified report submitted and accepted by SP Secretary|Phase 1|
|`decision`|System evaluates a condition; routes accordingly|Phase 1|
|`notification`|System sends a notification; no user action required|Phase 1|
|`termination`|Ends the workflow|Phase 1|
|`parallel_split`|Splits into parallel branches|**Phase 2 (reserved in data model only)**|
|`parallel_join`|Merges parallel branches|**Phase 2 (reserved in data model only)**|

### 2.3 Version Pinning

- A workflow instance **pins to the definition version active at its creation time**.
- All step resolution for an instance uses the pinned version — never the current (latest) version.
- In-flight migration requires an explicit Option B action by admin: mandatory reason, 2nd-level approval from City Administrator required, 24-hour reversible window, dedicated audit event.
- **Test implication:** An instance created under version N must continue resolving steps from version N even after version N+1 is published.

### 2.4 Architectural Invariants Relevant to the Engine

|#|Invariant|Enforcement|
|---|---|---|
|4|Workflow instance pins to definition version at creation|DB column `definition_version_id`; all resolution uses pinned version|
|13|Encoder and final approver of same document cannot be the same user|Workflow engine constraint|
|14|Workflow constraints per document type (legally mandated minimum steps)|Workflow editor validation|
|16|One active designation per person at any time|Application-level + DB partial unique index on active `delegation_grants` per user|

### 2.5 Database Schema (Workflow Module)

```
schema: workflow → definitions, definition_versions, steps, transition_rules,
                   instances, step_instances, workflow_events
```

---

## 3 — Step Transitions: Valid and Invalid

### 3.1 SP Resolution Workflow (2 readings)

**Legally mandated minimum steps — must all appear; omitting any is invalid:**

1. Committee referral (`multi_referral`) OR Certified Urgent bypass (skips to step 3)
2. Second Reading vote (`approval`)
3. VP certification (`approval`)
4. Transmittal Letter to Mayor (`action`/`notification`)
5. Mayor review — 10-day window (`decision`)
6. Docketing (`action`)
7. Panlalawigan review — 30-day timer (`decision`)
8. Release / archive (`termination`)

**Valid transitions:**

|From|To|Condition|
|---|---|---|
|Secretariat logging|`multi_referral` (committee referral)|No Certification of Urgency|
|Secretariat logging|Second Reading|Certification of Urgency logged (bypass)|
|`multi_referral`|Second Reading|All committees submitted unified report AND accepted by SP Secretary|
|`multi_referral`|Second Reading (delayed)|SP Secretary manually advances with mandatory audit-logged comment|
|Second Reading|Archived (`termination`)|Voted down|
|Second Reading|Secretariat logs amendments → final vote on amended version|Approved with amendments|
|Final vote (amendments)|Assigned Final Number|Approved|
|Final vote (amendments)|Archived (`termination`)|Rejected|
|Second Reading|Assigned Final Number|Approved — no amendments|
|Assigned Final Number|VP signs|—|
|VP signs|Transmittal Letter to Mayor|—|
|Transmittal Letter|Mayor review window opens|—|
|Mayor review|Returns to Secretariat → Docketing|Mayor signs within 10 days|
|Mayor review|Lapsed into Law → Docketing|10 calendar days elapsed; no Mayor action|
|Mayor review|Returned to SP with objections → override vote|Mayor vetoes|
|Override vote|Archived (`termination`)|Override fails|
|Override vote|Docketing|Override succeeds (2/3 = 8 of 12)|
|Docketing|Panlalawigan review (30-day timer)|—|
|Panlalawigan review|SP Secretary records → notify → Publish → Archive|VALID|
|Panlalawigan review|VALID-IN-PART branch (manual review)|VALID-IN-PART|
|Panlalawigan review|RETURNED branch|RETURNED|
|Panlalawigan review|Deemed Approved (RA 7160 §56d) → Archive|30 days elapsed; no action|
|VALID-IN-PART branch|SP Secretary records|After manual review resolution|
|RETURNED branch|SP Secretary records|After follow-up action|

**Invalid transitions (must throw):**

- Advancing to Second Reading when `multi_referral` is in progress and no manual override has been logged
- Assigning a Final Number before Second Reading vote completes
- VP signing before Final Number is assigned
- Mayor review step being skipped (no path from VP sign → Docketing that bypasses Mayor)
- Panlalawigan review step being skipped (no path from Docketing → Release that bypasses it)
- Transitioning out of `termination` (any state)
- Second Reading proceeding when committee Thursday cutoff has passed and no report submitted (unless SP Secretary manual override with audit log)

---

### 3.2 SP Ordinance Workflow (3 readings)

**Legally mandated minimum steps — must all appear; omitting any is invalid:**

1. Committee referral (`multi_referral`) OR Certified Urgent bypass (skips to step 3)
2. Second Reading (`approval`) — debate and amendments
3. Third Reading (`approval`) — final vote on amended or clean version
4. VP certification (`approval`)
5. Transmittal Letter to Mayor (`action`/`notification`)
6. Mayor review — 10-day window (`decision`)
7. Docketing (`action`)
8. Panlalawigan review — 30-day timer (`decision`)
9. Publication if penalty ordinance (`action`)
10. Release / archive (`termination`)

**Valid transitions (delta from Resolution, above):**

|From|To|Condition|
|---|---|---|
|Second Reading|Secretariat logs amendments → Third Reading|Approved with amendments|
|Second Reading|Third Reading (clean)|Approved — no amendments|
|Second Reading|Archived (`termination`)|Voted down|
|Third Reading|Assigned Final Number|Approved|
|Third Reading|Archived (`termination`)|Voted down|
|Panlalawigan review|`OPERATIVE IN ITS ENTIRETY` branch|Used for Appropriation Ordinances; treated as VALID|
|Archive step|Publication in newspaper|Ordinance has penalty AND publication date not yet recorded|
|Archive step|Archive (direct)|Ordinance has no penalty|

**Invalid transitions (must throw):**

- All Resolution invalids apply, plus:
- Assigning Final Number before Third Reading vote completes (for Ordinances; Second Reading is not the last reading)
- Skipping Third Reading (no path from Second Reading → Final Number for Ordinances)
- Skipping publication step for a penalty ordinance that has no recorded publication date

---

### 3.3 Appropriation Ordinance

Same flow as SP Ordinance. No special workflow. `OPERATIVE IN ITS ENTIRETY` Panlalawigan outcome = synonymous with VALID; must not block or branch differently from VALID.

---

## 4 — Multi-Referral Completion Conditions

**Step type:** `multi_referral`

**Completion condition A — Normal (all committees sign):**

- All assigned committees have signed and contributed to the single unified committee report
- Unified report submitted to Secretariat
- SP Secretary accepts the unified report
- Step transitions to next step (Second Reading)

**Completion condition B — SP Secretary manual override:**

- One or more committees have not submitted their contribution
- SP Secretary explicitly advances the step (overrides the missing report requirement)
- System records: mandatory comment from SP Secretary; dedicated audit event
- Step transitions to next step (Second Reading) despite incomplete committee submissions
- Missing committees remain marked red in the Order of Business record for that session

**Non-completion conditions (step must NOT complete):**

- Only some (but not all) committees have signed, and no SP Secretary manual override exists
- Unified report exists but SP Secretary has not accepted it yet
- Thursday cutoff has passed: Second Reading for that measure is delayed — it does NOT proceed at the next Tuesday session; it waits until the Tuesday after the week all committees submit

**Absent committee behavior:**

- An absent committee does NOT block the hearing from occurring
- An absent committee DOES count toward the "not yet submitted" flag
- The hearing proceeds; the unified report requirement remains
- Absent committees are flagged red in the Order of Business view

---

## 5 — Thursday Cutoff Enforcement

**Rule:** Documents received by Secretariat before Thursday of week N are included in the Order of Business for Tuesday of week N+1. Committee reports must also be submitted by Thursday cutoff to enable Second Reading on the immediately following Tuesday.

**Engine enforcement:**

|Condition|System behavior|
|---|---|
|Document received before Thursday cutoff|Eligible for next Tuesday's Order of Business|
|Document received after Thursday cutoff|Not eligible until the Tuesday of the following week|
|Committee report submitted before Thursday cutoff|Second Reading can proceed on next Tuesday|
|Committee report NOT submitted by Thursday cutoff|Item marked red in Order of Business; Second Reading delayed to Tuesday of the week after the committee submits|
|`multi_referral` step: any committee report missing at Thursday cutoff|That measure's Second Reading slot is blocked for the upcoming Tuesday|

**Test cases required:**

- Document logged on Wednesday → appears in next Tuesday's OoB
- Document logged on Friday → does NOT appear in next Tuesday's OoB; appears in the following Tuesday's OoB
- Committee submits report on Wednesday → Second Reading eligible for next Tuesday
- Committee submits report on Saturday → Second Reading NOT eligible for next Tuesday; eligible for Tuesday of following week
- `multi_referral` with two committees: one submits by Thursday, one does not → Second Reading blocked; both correctly flagged

---

## 6 — Certified Urgent Bypass Path

**Trigger:** Mayor issues a formal written Certification of Urgency document. Secretariat logs it (does not create or authorize).

**Effect on workflow instance:**

- The committee referral step (`multi_referral`) is bypassed entirely
- Each associated measure's workflow instance advances directly to Second Reading
- First and Second Reading occur in the same session
- Committee review and committee report are skipped entirely — no report required, no committee sign-off required

**Additional rules:**

- A single Certification of Urgency can cover multiple measures in the same session
- When it covers multiple measures, it is attached to each measure individually
- The Certification has no standalone numbering — attached to the measure(s) it certifies, not filed independently
- Upon logging: each associated measure's `workflow_instance` is updated immediately

**Test cases required:**

- Measure without Certification: `multi_referral` step present, mandatory
- Measure with Certification: `multi_referral` step absent; next step is Second Reading
- Certification covering two measures: both measures bypass committee referral; each has the Certification attached
- Certification logged after `multi_referral` already started: behavior must be defined (likely: committee step cancelled; advance to Second Reading; audit event)
- Removing or revoking a Certification after bypass already applied: behavior must be defined and tested

---

## 7 — 10-Day Lapse Timer Transition (Mayor Review)

**Rule:** After VP certification and Transmittal Letter, the Mayor has 10 **calendar days** to act. Applies to both SP Resolutions and SP Ordinances.

**Timer behavior:**

|Day|Event|
|---|---|
|Day 0|Document transmitted to Mayor (Transmittal Letter sent)|
|Day 1–9|Mayor review window open|
|Day 10 (no action)|System transitions status to "Lapsed into Law"|

**On lapse:**

- System logs RA 7160 legal basis (Resolution: §47; Ordinance: §47) automatically
- SP Secretary notified
- Document proceeds to Docketing (same path as Mayor-signed document)
- The lapse is recorded as the completion event of the Mayor review step

**Possible Mayor actions (all within 10-day window):**

|Action|Next step|
|---|---|
|Mayor signs|Returns to SP Secretariat → Docketing|
|Mayor vetoes|Returned to SP with written objections → Override vote|
|No action (day 10)|Lapsed into Law → Docketing|

**Override vote outcomes:**

|Outcome|Threshold|Next step|
|---|---|---|
|Override fails|< 8 votes|Archived (`termination`)|
|Override succeeds|≥ 8 of 12 members (2/3 majority)|Docketing|

**Test cases required:**

- Mayor signs on day 5: timer cancelled; proceeds to Docketing
- Mayor vetoes on day 3: override vote step opens
- No action at day 10: system auto-transitions; RA 7160 legal basis logged; SP Secretary notified; proceeds to Docketing
- Override with 7 votes: must fail; document archived
- Override with 8 votes: must succeed; proceeds to Docketing
- Override with 9 votes: must succeed
- Day 10 lapse while Mayor vacation (system does not suspend ARTA clock for outages or external delays)

---

## 8 — 30-Day Panlalawigan Timer Transition

**Rule:** After Docketing, the document is transmitted to the Sangguniang Panlalawigan for review. The Panlalawigan has 30 calendar days to act. Applies to both Resolutions and Ordinances.

**Timer behavior:**

|Day|Event|
|---|---|
|Day 0|Transmission to Panlalawigan|
|Day 1–29|Panlalawigan review window open|
|Day 30 (no response)|System transitions to "Deemed Approved"|

**On 30-day lapse with no action:**

- Status transitions to "Deemed Approved per RA 7160 Section 56(d)"
- Remarks field populated with statutory legal basis phrase ("Lapsed 30 days")
- SP Secretary notified; SP Secretary confirms
- Document proceeds to normal post-review flow (publish, log, archive)

**Panlalawigan outcome types and handling:**

|Outcome|System behavior|
|---|---|
|VALID|SP Secretary records; notifies relevant offices; publish → archive|
|OPERATIVE IN ITS ENTIRETY|Appropriation Ordinances only; treated identically to VALID|
|VALID-IN-PART|System marks VALID-IN-PART; attaches Panlalawigan response; places step in "Awaiting SP Secretariat Action"; SP Secretary chooses one of four paths (all audit-logged)|
|RETURNED|System flags high-priority; requires immediate review; implementation stops; Secretariat decides path (modify and repass = back to drafting, or Legal/Committee referral)|
|Referred to committee|Panlalawigan committee review in progress; 30-day clock still running|
|(blank — 30 days elapsed)|Deemed Approved; RA 7160 §56(d); Remarks: "Lapsed 30 days"|

**VALID-IN-PART — SP Secretary's four choices (all audit-logged):**

1. Resolve as-is with mandatory comment
2. Route to Legal Office
3. Route to concerned Committee for re-evaluation
4. Implement revisions directly without repassing

**Multiple documents per batch:** The Panlalawigan frequently acts on multiple SP documents in one resolution. The engine must associate the Panlalawigan's own resolution number and action date with each individual SP document's step.

**Test cases required:**

- Day 0 transmission; Panlalawigan responds VALID on day 15: timer cancelled; proceeds normally
- No response through day 30: auto-transition to Deemed Approved; legal basis logged; SP Secretary notified
- VALID-IN-PART outcome: step placed in "Awaiting SP Secretariat Action"; each of four SP Secretary choices must transition correctly
- RETURNED outcome: high-priority flag set; implementation stops; Secretariat proceeds to repass path
- OPERATIVE IN ITS ENTIRETY on an Appropriation Ordinance: must resolve identically to VALID
- OPERATIVE IN ITS ENTIRETY on a regular Ordinance: behavior must be defined (likely: invalid input; throw)
- Multiple SP documents in one Panlalawigan batch resolution: each document's step must be independently resolved

---

## 9 — Version Pinning Behavior

**Rule:** A workflow instance resolves all its steps from the definition version that was active (pinned) at the moment of the instance's creation. It does not migrate to newer versions automatically.

**Relevant schema column:** `definition_version_id` on the `workflow.instances` table.

**What "pinned version" means in practice:**

- Step order, step types, transition rules, and step configurations are read from the pinned version
- If the admin publishes a new version of the same workflow definition after an instance is created, that instance continues under the old version
- New instances created after publication use the new version

**In-flight migration (Option B) — required test coverage:**

|Condition|Expected behavior|
|---|---|
|Admin triggers Option B migration|Mandatory reason captured; 2nd-level approval (City Administrator) required before migration executes|
|Migration applied|Instance's `definition_version_id` updated; dedicated audit event written; 24-hour reversible window begins|
|Rollback within 24 hours|Instance's `definition_version_id` reverted to prior version; audit event written|
|Rollback after 24 hours|Must fail or require a new migration|

**Test cases required:**

- Instance created under version 1; version 2 published; instance must still resolve steps from version 1
- New instance created after version 2 published; must resolve steps from version 2
- Admin attempts Option B without 2nd-level approval: must fail
- Admin completes Option B with approval: instance migrated; audit event present
- Rollback within 24 hours: instance reverts correctly
- Rollback after 24 hours: must be rejected

---

## 10 — One-Active-Designation-Per-Person Constraint

**Rule:** A person cannot hold more than one active designation at any time. Frequent operation — 10+ Acting Mayor designations per year.

**Enforcement:** Application-level validation + **DB partial unique index on active `delegation_grants` per user**.

**Designation lifecycle:**

1. Mayor or Vice Mayor issues Designation document
2. Secretariat receives and logs it (D {YEAR}-{NN} number; QR assigned at logging)
3. Staff manually extracts scope and time bounds; enters in system
4. `delegation_grant` record created: **immediate effect, no Platform Admin confirmation step**
5. System routes affected workflow steps to designated person for the duration
6. Auto-expires at end date: routing returns to original authority automatically
7. One active designation per person enforced by DB partial unique index on active delegation grants

**Key constraint confirmed:** No Platform Admin confirmation step required. The pre-Interview 1 design that included this step is superseded. Designation takes effect immediately upon Secretariat logging.

**Test cases required:**

- Person has no active designation: new designation created successfully
- Person already has one active designation: attempt to create a second active designation must fail (throw)
- Person's existing designation is expired: new designation for the same person must succeed
- Designation end date reached: routing automatically returns to original authority; `delegation_grant` status transitions to inactive
- Early revocation by delegating authority: `delegation_grant` transitions to inactive; routing returns immediately
- Open-ended designation (no end date): must be rejected — duration must always be explicit
- Designation created by non-original-authority (e.g., Platform Admin): must be rejected
- Workflow step assigned to designated person for duration; after expiry, step assignment returns to original authority mid-workflow

---

## 11 — Confirmed Voting Thresholds (Engine Validation Inputs)

|Decision|Threshold|Members|
|---|---|---|
|Pass a measure|Half + 1|7 of 12|
|Veto override|2/3 majority|8 of 12|
|No proxy voting|Confirmed|—|

---

## 12 — Confirmed Hardcoded Workflow Constraints (Must Not Be Admin-Configurable)

These are legally mandated and must throw if violated, regardless of workflow definition:

|Document Type|Minimum Required Steps|
|---|---|
|SP Resolution|Committee referral OR Certified Urgent path; Second Reading vote; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Release|
|SP Ordinance / Appropriation Ordinance|Committee referral OR Certified Urgent path; 3 readings; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Publication (if penalty); Release|

The workflow editor must validate these constraints. A workflow definition that omits any legally mandated step for its document type must be rejected at publish time — not at runtime.

---

## 13 — SLA and Timer Behavior (Engine-Enforced)

|Rule|Detail|
|---|---|
|SLA clock starts|At workflow initiation|
|Warning|At 80% of SLA time elapsed|
|Automatic escalation at breach|Notify supervisor + Records Officer|
|ARTA defaults|Simple ≤ 3 working days; complex ≤ 7 working days; highly technical ≤ 20 working days|
|System outage|Does NOT suspend ARTA obligations; SLA clock continues|

---

## 14 — Audit Events Required from the Engine

The following must always be audit-logged by the workflow engine (cannot be disabled):

- All document state changes
- All approval actions
- All delegation grants/revocations
- All workflow definition publishes/deprecations
- All Option B migration executions
- SP Secretary "manual advance" on `multi_referral` step (mandatory comment required)
- SP Secretary "Approve / Reject / Amended" logging actions for legislative measures

---

## 15 — Relevant Numbering Rules (Engine Side-Effects)

The workflow engine is responsible for triggering number assignment at the correct lifecycle event. These are engine-enforced side-effects, not UI-driven actions.

|Number type|Assignment trigger|
|---|---|
|QR tracking number (UUID)|At secretariat logging — before preliminary number|
|Preliminary "Draft" number|At secretariat logging — after QR assignment|
|Final number|After Second Reading vote (Resolutions) or Third Reading vote (Ordinances) — before VP and Mayor sign|

**Final number is immutable once assigned.** No path in the workflow may re-assign or modify it. Any attempt must throw.

**Preliminary number is mutable** until finalization. Can be replaced before the Final number is assigned.

---

## 16 — Administration Transition (Engine Behavior at Officeholder Change)

- In-flight documents continue under the new administration
- Whoever was presiding at the document's last action still signs/approves
- In-flight documents requiring the prior Mayor's signature: **automatically wait for the new Mayor** — no manual reassignment required
- New officeholder accounts becoming active triggers office-level step assignee fallback rules

---

_End of K2 context document._