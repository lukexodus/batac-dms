# K3. Critical E2E Test Scenarios — Early-dev

**Document ID:** K3
**Type:** Playwright E2E test scenario catalog — pre-development reference
**Status:** SETTLED — scenario list and assertion specifications finalized before first workflow feature is implemented
**Date:** June 2026
**Based on:**
- `consolidated-architecture-and-requirements-reference-iteration-3.md` (Post-Interview 2, developer decisions incorporated)
- `f1-application-route-map-v2.md` (F1) — route paths and component names
- `h1-phase-1-workflow-definitions-structured-data.md` (H1) — step keys, outcome codes, transition rules
- `tech-stack.md` — test tooling (Vitest + Playwright)

**Audience:** Development team — whoever writes Playwright tests

## Table of Contents

- [L38–L45] Purpose — Overview and rationale for testing the six highest-risk user journeys in Phase 1.
- [L46–L62] How to Use This Document — Guide to scenario structure, role codes, step keys, outcome codes, and epistemic markers.
- [L63–L86] Shared Seed Data Requirements — Base database state and mock users required as preconditions for all six test scenarios.
- [L87–L232] S1. Full SP Resolution Lifecycle — Standard Path to Panlalawigan VALID — Happy path E2E test for the complete SP Resolution workflow ending in public portal publication.
  - [L89–L94] Goal — Objective and legal basis of the happy path test scenario.
  - [L95–L98] Roles involved — List of six specific system roles required to execute the S1 scenario.
  - [L99–L102] Routes exercised (F1 paths) — The sequence of F1 frontend application route paths tested in S1.
  - [L103–L106] Workflow steps exercised (H1 step_keys, SP Resolution) — Chronological order of Custom Workflow Engine step keys and outcomes.
  - [L107–L110] Preconditions — Initial setup constraints including active SP Resolution workflow definition version 1.
  - [L111–L232] Scenario script — Fifteen-step test actions and assertions verifying QR, numbering, signature, and audit transitions.
- [L233–L278] S2. Certified Urgent Path — Same-Session Second Reading — Verifies committee referral bypass and direct transition to second reading via Certification of Urgency.
- [L279–L329] S3. Mayor 10-Day Lapse-into-Law — Verifies automated transition to docketing when Mayor fails to act within ten calendar days.
- [L330–L397] S4. Citizen Complaint — All Three Access Modes Through to Resolution — Tests complaint intake via physical, digital portal, and clerk-assisted modes and subsequent resolution.
- [L398–L447] S5. QR Code Scan on Mobile Device Resolving to Document Status — Verifies mobile viewport rendering of public tracking page, first-page visibility, and blurred pages.
- [L448–L507] S6. SP Secretary Manual Override of Missing Committee Report — Mandatory Audit Log Entry — Verifies SP Secretary manual committee bypass requirement for comment, audit trail, and role lock.
- [L508–L543] Notes for Test Implementation — Technical instructions for handling timers, database isolation, URL configuration, and Playwright folder structure.

---

---

## Purpose

These six scenarios cover the highest-risk user journeys in Phase 1. They are specified before development begins so that test coverage is not retrofitted around whatever happened to get built. Each scenario is defined at the level of: roles, routes, workflow step keys, preconditions, step-by-step actions, and named assertions. The developer writing the tests should not need to derive what to assert — only to translate the named assertions into Playwright locators and `expect()` calls.

The scenarios are not a comprehensive regression suite. They are a risk-weighted selection: each one exercises a path that is either legally mandated by RA 7160, structurally difficult to repair if broken in production, or an architectural assumption that has never been exercised end-to-end.

---

## How to Use This Document

**Scenario structure.** Each scenario lists: the goal, the roles involved (role codes from F1 §2.2), the routes exercised (paths from F1 §4), the workflow step keys exercised (from H1), seed data required, the step-by-step script, and named assertions. Assertions are listed inline at the step where they fire.

**Role codes.** `sp_secretary`, `secretariat_staff`, `sp_member`, `sp_presiding_officer`, `mayor`, `records_officer`, `citizen`, `plat_admin`. These match the `roleCodeEnum` in E1 and the role reference table in F1 §2.2.

**Step keys.** References like `committee_referral`, `mayor_review`, `panlalawigan_review` refer to `step_key` values in H1 Sections 5–7. Step statuses referenced (`Running`, `Skipped`, `Done`, `Failed`) use D3-authoritative terminology per H1 §2.5.

**Outcome codes.** `REPORT_ACCEPTED`, `BYPASSED_CERTIFIED_URGENT`, `SIGNED`, `LAPSED`, `VALID`, etc. are outcome codes from H1 §2.3.

**Epistemic markers.** This document inherits the project's labeling convention.
- `[Confirmed]` — grounded in the consolidated reference or interview findings
- `[Inference]` — a reasonable conclusion drawn from confirmed facts
- `[Unverified]` — no confirmed source; a design choice or open question that the test reveals rather than resolves

---

## Shared Seed Data Requirements

All six scenarios depend on the following base seed state. Run this before any scenario; each scenario may add to it but not replace it.

| Seed entity | Value / notes |
|---|---|
| Organization | Batac City (city_id = `BATAC_CITY_UUID` constant) |
| Document type | `sp_resolution` active, linked to `SP_RESOLUTION_WORKFLOW` definition version 1 |
| Numbering series | `7SP` series, year = current year, counter = 1 |
| Workflow definition | `SP_RESOLUTION_WORKFLOW` seeded per H1 §10 insertion sequence; all step UUIDs deterministic via `uuidv5` |
| User: secretariat staff | Role `secretariat_staff`, office = SP Secretariat |
| User: SP Secretary | Role `sp_secretary`, office = SP Secretariat |
| User: SP Member (Committee on Laws) | Role `sp_member`, assigned to Committee on Laws |
| User: Vice Mayor | Role `sp_presiding_officer`, position = Vice Mayor |
| User: Mayor | Role `mayor` |
| User: Records Officer | Role `records_officer` |
| User: Citizen | Role `citizen`, phone OTP verified, email verified |
| User: Platform Administrator | Role `plat_admin` |
| Session | No active Tuesday session pre-seeded; each scenario that needs one must create it |

Scenarios that require a `sp_ordinance` or `appropriation_ordinance` document type add those seed records locally. Scenario 4 requires the complaint module seed (`complaints` document type active, complaint workflow definition seeded).

---

## S1. Full SP Resolution Lifecycle — Standard Path to Panlalawigan VALID

### Goal

Walk the SP Resolution workflow from secretariat logging through every mandatory step on the happy path, ending with Panlalawigan VALID and the document visible on the public portal. This is the single most important scenario: it validates the entire legally mandated step sequence in one execution, tests every timer trigger, tests two-stage numbering (preliminary → final), and confirms the public portal visibility rule.

**Legal basis for the path exercised:** RA 7160 §§ 47, 53, 56(d).

### Roles involved

`secretariat_staff` · `sp_secretary` · `sp_member` (Committee on Laws) · `sp_presiding_officer` (Vice Mayor) · `mayor` · `records_officer`

### Routes exercised (F1 paths)

`/documents/new` → `/documents/:documentId` → `/order-of-business` → `/workflow/steps` → `/workflow/steps/:instanceId` (multiple panels) → `/portal/documents/:trackingNumber`

### Workflow steps exercised (H1 step_keys, SP Resolution)

`intake_logging` → `order_of_business_scheduling` → `first_reading` → `committee_referral` (REPORT_ACCEPTED) → `second_reading_vote` (APPROVED) → `final_number_assignment` → `vp_certification` (SIGNED) → `transmittal_letter_to_mayor` → `mayor_review` (SIGNED) → `docketing` → `panlalawigan_transmission_logging` → `panlalawigan_review` (VALID) → `portal_publication` → `archive` → `final_outcome_check` (TRUE) → `end_approved_and_released`

### Preconditions

Base seed applied. A `sp_resolution` document type record exists. The SP Resolution workflow definition is active at version 1.

### Scenario script

**Step 1.1 — Document intake.** Authenticate as `secretariat_staff`. Navigate to `/documents/new`. Fill the SP Resolution intake form: title, sponsors (at least one Councilor from Part 3.2), document type = SP Resolution. Submit.

> **Assert 1.1.a — QR code assigned.** The document detail page (`/documents/:documentId`) displays a QR tracking number (UUID format). This number must not be null and must not equal the preliminary series number. `[Confirmed — consolidated ref Part 5.2, Part 11.6: QR assigned before preliminary number]`

> **Assert 1.1.b — Preliminary number format.** The displayed preliminary number matches `Draft 7SP {YEAR}-{NN}` with a space delimiter. The word "Draft" is present. `[Confirmed — consolidated ref Parts 5.1, 5.2]`

> **Assert 1.1.c — Workflow instance created.** The document detail page shows workflow status as `Running` (not null, not `Created`). `[Confirmed — H1 §2.5: Created collapsed into Running]`

> **Assert 1.1.d — Active step is `intake_logging`.** The workflow step panel shows `intake_logging` as the current step, assigned to `secretariat_staff`. `[Confirmed — H1 §5.2, step 1 is_start: true]`

---

**Step 1.2 — Order of Business scheduling.** Still as `sp_secretary`. Navigate to `/workflow/steps` and open the `order_of_business_scheduling` step instance. Enter the next eligible Tuesday date. Submit.

> **Assert 1.2.a — OB entry visible.** Navigate to `/order-of-business`. The document appears in the upcoming session's Order of Business. `[Confirmed — consolidated ref Part 4.18]`

> **Assert 1.2.b — No red flag.** The document row on the Order of Business view is not red-flagged (no missing committee report yet — referral has not occurred). `[Confirmed — red flag is for missing reports post-referral, consolidated ref Part 4.18]`

---

**Step 1.3 — First Reading.** As `sp_secretary`, open the `first_reading` step instance. Record that First Reading occurred. Set committee referral to: Committee on Laws (default) + one subject-matter committee (e.g., Committee on Appropriations). Submit.

> **Assert 1.3.a — Committee referral step active.** The workflow advances to `committee_referral`. Step type displayed is `multi_referral`. Assigned committees are exactly the two set in Step 1.3. `[Confirmed — H1 §5.2 step 4; F1 §8.2 Multi-Referral Panel]`

> **Assert 1.3.b — Both committee members see assigned step.** Authenticate as `sp_member` (Committee on Laws). Navigate to `/workflow/steps`. The `committee_referral` step instance appears in the inbox.

---

**Step 1.4 — Committee hearing and report.** As `sp_secretary`, navigate to the `committee_referral` step instance at `/workflow/steps/:instanceId`. Enter a hearing date (Multi-Referral Panel: `session.enterCommitteeHearingDate`). Submit.

As each committee (`sp_member` user), open the step and submit a committee report contribution. After all assigned committees have submitted, the SP Secretary accepts the unified report (`workflow.submitCommitteeReport` → outcome `REPORT_ACCEPTED`).

> **Assert 1.4.a — Incomplete state.** Before all committees submit: the step instance has status `Running`. The Order of Business shows the item as red-flagged if the Thursday cutoff has been simulated as passed. `[Confirmed — H1 §5.2 step 4; consolidated ref Part 8.3]`

> **Assert 1.4.b — Transition fires.** After SP Secretary accepts: the `committee_referral` step has outcome `REPORT_ACCEPTED` and status `Done`. The workflow advances to `second_reading_vote`. `[Confirmed — H1 §5.3 rule 4]`

---

**Step 1.5 — Second Reading vote.** As `sp_secretary`, open `second_reading_vote`. Record the vote outcome as `APPROVED` (no amendments). Submit.

> **Assert 1.5.a — Transition to final number.** Workflow advances to `final_number_assignment`. The `second_reading_vote` step has outcome `APPROVED` and status `Done`. `[Confirmed — H1 §5.3 rule 7]`

---

**Step 1.6 — Final number assignment.** As `sp_secretary`, open `final_number_assignment`. Confirm the final series number (system should propose next in sequence). Submit.

> **Assert 1.6.a — "Draft" prefix removed.** The document detail page now shows a final number `7SP {YEAR}-{NN}` with no "Draft" prefix. The preliminary number field is now null or replaced. `[Confirmed — consolidated ref Parts 5.1, 5.2]`

> **Assert 1.6.b — Number is immutable.** Attempt to edit the final series number via any available UI control. Confirm the field is read-only / no edit action is present. `[Confirmed — consolidated ref Part 11.5: final numbers are immutable]`

> **Assert 1.6.c — QR tracking number unchanged.** The QR tracking UUID from Assert 1.1.a has not changed. `[Confirmed — consolidated ref Part 11.6: QR code immutable for document's life]`

---

**Step 1.7 — VP Certification.** Switch to `sp_presiding_officer` (Vice Mayor). Open `vp_certification` at `/workflow/steps/:instanceId` (VP Certification Panel per F1 §8.2). Submit with outcome `SIGNED`.

> **Assert 1.7.a — Transition to transmittal letter.** Workflow advances to `transmittal_letter_to_mayor`. `[Confirmed — H1 §5.3 rule 14]`

---

**Step 1.8 — Transmittal Letter to Mayor.** As `secretariat_staff`, open `transmittal_letter_to_mayor`. Generate/confirm the transmittal letter (SPS format). Submit.

> **Assert 1.8.a — Mayor lapse timer context written.** Query the workflow instance context (via API or test DB assertion). `mayor_transmittal_date` is not null. `mayor_action_deadline` equals `mayor_transmittal_date + 10 calendar days` (not working days). `[Confirmed — H1 §5.5 step 10 comment; B4 §6.3]`

> **Assert 1.8.b — Transition to Mayor review.** Workflow advances to `mayor_review`, assigned to Mayor. `[Confirmed — H1 §5.3 rule 15]`

---

**Step 1.9 — Mayor signature.** Switch to `mayor`. Navigate to `/mayor` dashboard; confirm the document appears in the pending signatures queue. Open the Mayor Decision Panel at `/workflow/steps/:instanceId`. Submit with outcome `SIGNED`.

> **Assert 1.9.a — Transition to docketing.** Workflow advances to `docketing`. `[Confirmed — H1 §5.3 rule 16]`

> **Assert 1.9.b — LAPSED and VETOED outcomes are not selectable by Mayor.** Confirm these do not appear as manual submission options in the Mayor Decision Panel UI. (LAPSED is scheduler-only; confirmed per H1 §2.3 and B4 §4.2.)

---

**Step 1.10 — Docketing.** As `secretariat_staff`, open `docketing`. Complete it.

> **Assert 1.10.a — Transition to Panlalawigan transmission.** Workflow advances to `panlalawigan_transmission_logging`. `[Confirmed — H1 §5.3 rule 21]`

---

**Step 1.11 — Panlalawigan transmission logging.** As `secretariat_staff`, open `panlalawigan_transmission_logging`. Record the transmission. Submit.

> **Assert 1.11.a — Panlalawigan timer context written.** `panlalawigan_transmission_date` is not null. `panlalawigan_action_deadline` equals `panlalawigan_transmission_date + 30 calendar days`. `[Confirmed — H1 §5.5 step 14 comment; B4 §6.4]`

> **Assert 1.11.b — Transition to Panlalawigan review.** Workflow advances to `panlalawigan_review`, assigned to `sp_secretary`. `[Confirmed — H1 §5.3 rule 22]`

---

**Step 1.12 — Panlalawigan VALID outcome.** As `sp_secretary`, open `panlalawigan_review` (Panlalawigan Outcome Panel per F1 §8.2). Enter: outcome = `VALID`, Panlalawigan resolution number (e.g., `R2026-0841`). Submit.

> **Assert 1.12.a — Context key written.** `panlalawigan_outcome` = `VALID`, `panlalawigan_response_date` is not null. `[Confirmed — H1 §9 context keys table]`

> **Assert 1.12.b — Transition to portal publication.** Workflow advances to `portal_publication`. `[Confirmed — H1 §5.3 rule 23]`

---

**Step 1.13 — Portal publication.** As `secretariat_staff`, open `portal_publication`. Submit.

> **Assert 1.13.a — Document lifecycle status.** Document lifecycle_status = `Released`. `[Inference — H1 §5.5 step 21 comment]`

> **Assert 1.13.b — Public portal visibility.** Navigate (unauthenticated) to `/portal/documents/{trackingNumber}`. The document type and title are visible. The first page is visible. Pages beyond the first are blurred / not accessible. A "Get a copy" button is present. `[Confirmed — consolidated ref Parts 4.1, 4.15, 11.4]`

> **Assert 1.13.c — Full text is not accessible without request.** Attempt to access full document content from the portal page without a Document Request. Confirm the full text is not rendered and no direct download link is present.

---

**Step 1.14 — Archive.** Switch to `records_officer`. Open `archive`. Submit.

> **Assert 1.14.a — Lifecycle status.** Document lifecycle_status = `Archived`. `[Inference — H1 §5.5 step 22 comment]`

> **Assert 1.14.b — Workflow terminal.** Workflow instance proceeds through `final_outcome_check` (TRUE branch, since `panlalawigan_outcome` = `VALID`) and reaches `end_approved_and_released`. Instance status = `Completed`. Termination outcome code = `APPROVED_AND_RELEASED`. `[Confirmed — H1 §5.3 rules 37–38, §5.5 step T1]`

---

**Step 1.15 — Audit log verification.** As `records_officer` (or `sp_secretary`), navigate to `/audit`. Confirm audit entries exist for every workflow step completed above, each with: actor ID, step key, outcome, timestamp. No gaps in the step sequence. `[Confirmed — consolidated ref Part 11.11: all workflow step completions are audited events that cannot be disabled]`

---

## S2. Certified Urgent Path — Same-Session Second Reading

### Goal

Confirm that when the Mayor issues a Certification of Urgency and the Secretariat logs it against a pending measure, the `committee_referral` step is bypassed and the workflow advances directly to `second_reading_vote`. This tests the event-driven bypass mechanism (B4 §6.1) that the H1 BYPASSED_CERTIFIED_URGENT transition rule depends on.

**Legal basis:** Mayor's formal Certification of Urgency (consolidated ref Part 4.17).

### Roles involved

`secretariat_staff` · `sp_secretary` · `sp_presiding_officer` · `mayor`

### Routes exercised (F1 paths)

`/documents/new` · `/documents/:documentId` · `/workflow/steps/:instanceId`

### Workflow steps exercised

`intake_logging` → `order_of_business_scheduling` → `first_reading` → **`committee_referral` (BYPASSED_CERTIFIED_URGENT → skipped)** → `second_reading_vote` (APPROVED) → `final_number_assignment`

### Preconditions

Base seed applied. A second SP Resolution document (`sp_resolution`) exists and has been logged (steps 1.1 through 1.3 completed, workflow active at `committee_referral`). The Certification of Urgency document type is configured (consolidated ref Part 4.17: no standalone number, attached to measure/s).

### Scenario script

**Step 2.1 — Log the Certification of Urgency.** As `secretariat_staff`, navigate to `/documents/:documentId` for the resolution whose `committee_referral` step is active. Use `documents.logCertificationOfUrgency` (Lifecycle action group per F1 §7.3). Associate the Certification with this measure. Submit.

> **Assert 2.1.a — Engine event fired.** The system event `document.certification_urgency.logged` has been emitted. `[Confirmed — H1 §2.4; B4 §6.1]`

> **Assert 2.1.b — committee_referral step bypassed.** The `committee_referral` step instance now has status `Skipped` (not `Running`, not `Done`, not `Failed`). The `bypass_reason` field on the step instance = `CERTIFIED_URGENT`. Outcome = `BYPASSED_CERTIFIED_URGENT`. `[Confirmed — H1 §2.4; H1 §5.5 step 4 comment: engine sets step_instances.bypass_reason and outcome]`

> **Assert 2.1.c — Workflow advances to Second Reading.** The active step is now `second_reading_vote`, not `committee_referral`. `[Confirmed — H1 §5.3 rule 6]`

> **Assert 2.1.d — No committee report required.** The `second_reading_vote` step instance does not show any "missing report" indicator or blocking condition. `[Confirmed — consolidated ref Part 4.10: Certified Urgent skips committee review entirely]`

**Step 2.2 — Same-session Second Reading.** As `sp_secretary`, open `second_reading_vote`. Submit with outcome `APPROVED`.

> **Assert 2.2.a — Transition fires normally.** Workflow advances to `final_number_assignment` exactly as in S1. The bypass does not alter downstream step behavior. `[Confirmed — H1 §5.3 rule 7: APPROVED → final_number_assignment regardless of how second_reading_vote was reached]`

**Step 2.3 — Certification is attached, not standalone.** Navigate to the Certification of Urgency document. Confirm: it has no independent series number in the `7SP YYYY-NN` format. It is stored as an attachment to the associated measure, not as a top-level document in the numbering sequence. `[Confirmed — consolidated ref Part 4.17; H1 §5.5 step 4 comment]`

**Step 2.4 — Audit log.** Check the audit log for the bypass event. The entry must include: actor (secretariat_staff), event type (certification of urgency logged), associated measure document ID, step key = `committee_referral`, outcome = `BYPASSED_CERTIFIED_URGENT`. `[Confirmed — consolidated ref Part 11.11: all step completions audited]`

---

## S3. Mayor 10-Day Lapse-into-Law

### Goal

Confirm that when no Mayor action is taken within 10 calendar days of the transmittal date, the scheduler (`evaluateMayorLapseTimers`) sets the `mayor_review` step outcome to `LAPSED`, the workflow transitions to `docketing` (same path as a signed document), and the correct legal basis is logged. This tests the automated lapse path mandated by RA 7160 §47.

### Roles involved

`secretariat_staff` · `sp_secretary` · `records_officer` — Mayor does **not** act in this scenario.

### Routes exercised

`/workflow/steps/:instanceId` (Mayor Lapse Confirmation Panel) · `/documents/:documentId` · `/secretary`

### Workflow steps exercised

(Starting from transmittal) `transmittal_letter_to_mayor` (already completed) → `mayor_review` (LAPSED — scheduler-set) → `docketing` → _(remainder of S1 happy path follows)_

### Preconditions

Base seed applied. An SP Resolution workflow instance is active at `mayor_review` with `mayor_transmittal_date` set. To test the scheduler without waiting 10 real days, one of the following isolation strategies must be used:

- **Option A (preferred): Test clock injection.** The test sets `mayor_action_deadline` to `NOW() - 1 second` directly in the test database before invoking the scheduler function. The scheduler function is then called directly (not by waiting for cron). `[Inference — standard practice for deadline-based scheduler tests; no confirmed platform decision on which of these approaches to use]`
- **Option B: Backdating API.** A test-only Fastify route (guarded by `NODE_ENV === 'test'`) accepts a `documentId` and artificially sets `mayor_action_deadline` in the past, then triggers `evaluateMayorLapseTimers` for that instance.

The test must not actually wait 10 calendar days. Whichever approach is chosen, it must be documented in the test file so the mechanism is not confused with a real lapse.

### Scenario script

**Step 3.1 — Simulate deadline expiry.** Using the chosen isolation strategy: set `mayor_action_deadline` to a timestamp in the past (at least 1 second before test execution time). Invoke `evaluateMayorLapseTimers` for the specific workflow instance.

> **Assert 3.1.a — LAPSED outcome set by scheduler.** The `mayor_review` step instance has outcome = `LAPSED`. The actor on the audit entry for this step completion is the scheduler (system actor), not a human user. `[Confirmed — H1 §2.3: LAPSED is scheduler-only; B4 §4.2 prevents human submission with outcome LAPSED]`

> **Assert 3.1.b — Transition to docketing.** Workflow advances to `docketing`. This is the same step reached by a Mayor `SIGNED` outcome. `[Confirmed — H1 §5.3 rules 16 and 17: both SIGNED and LAPSED → docketing, same target]`

> **Assert 3.1.c — Legal basis logged.** The workflow instance context or audit entry includes a reference to "RA 7160 §47" in the lapse record. The remarks field (or equivalent) is populated with the statutory basis phrase. `[Confirmed — consolidated ref Part 4.1: "Logged with RA 7160 legal basis"]`

**Step 3.2 — SP Secretary confirmation.** As `sp_secretary`, navigate to `/workflow/steps/:instanceId` for the `docketing` step. The Mayor Lapse Confirmation Panel (F1 §8.2) should have displayed prior to docketing — confirm that the lapse was acknowledged by the SP Secretary (via `workflow.logMayorLapseConfirmation`).

> **Assert 3.2.a — SP Secretary sees lapse notification.** Navigate to `/secretary` dashboard. An in-app notification for the lapse exists and is visible. `[Confirmed — consolidated ref Part 4.1: "SP Secretary notified"]`

**Step 3.3 — Downstream path is identical.** Continue through `docketing` → `panlalawigan_transmission_logging` → `panlalawigan_review`. Confirm that the lapse has no effect on subsequent steps. The document does not require re-signing or re-certification after a lapse.

> **Assert 3.3.a — No re-signing required.** The `vp_certification` step does not reappear after the lapse. The document already has its final number from step `final_number_assignment`. `[Confirmed — consolidated ref Part 4.1: docketing is the next step after both signed and lapsed paths]`

**Step 3.4 — Attempt by Mayor to sign after LAPSED.** Switch to `mayor`. Navigate to `/workflow/steps`. Confirm the `mayor_review` step instance does not appear as an actionable item for the Mayor. The scheduler has already closed it; a human submission must be rejected.

> **Assert 3.4.a — Step not actionable by Mayor.** The `mayor_review` step instance is not present in the Mayor's task inbox at `/workflow/steps` after the lapse has been processed. `[Confirmed — B4 §4.2: scheduler-only outcomes cannot be submitted by a human actor]`

---

## S4. Citizen Complaint — All Three Access Modes Through to Resolution

### Goal

Confirm that a citizen complaint can be received and resolved via all three access modes defined in the consolidated reference: (1) physical submission processed by staff, (2) digital form submission via the portal, (3) clerk-assisted in-person intake. Each mode must produce a complaint record with a resolvable lifecycle. This scenario tests the Citizen Complaint module added to Phase 1 scope (consolidated ref Part 4.14).

### Roles involved

`sp_secretary` (all three modes) · `sp_member` (committee report) · `citizen` (mode 2 portal submission)

### Routes exercised

Mode 1: `/complaints/new` (staff-side, clerk enters physical submission) → `/complaints/:complaintId`
Mode 2: `/portal/complaints/new` (citizen portal, self-service) → `/portal/complaints/:complaintId/status` → `/complaints/:complaintId` (staff-side resolution)
Mode 3: `/complaints/new` (staff-side, clerk-assisted in-person, same route as mode 1 but intent differs)

> **[Resolved — ADR-001]** The public portal URL `/portal/complaints/new` is served from the Next.js portal application `/apps/portal` (built now).

> **[Resolved — ADR-009]** Citizen complaint submission is a public no-login form that does not require an authenticated citizen account.

### Preconditions

Base seed applied. Complaint module seed: `sp_resolution_complaint` document type active (or equivalent — `[Inference]` complaint document type naming is not confirmed in the consolidated reference; the team must verify the `document_type_code` used for complaints). Complaint workflow definition seeded (if a workflow instance is attached; `[Inference]` — complaint processing may use a simpler tracked state model rather than a full workflow definition; the team must verify this from the workflow engine spec). Respondent seed data: a tricycle operator with a phone number and an email address (for mode 2 notification test).

### Scenario script — Mode 1 (Physical submission processed by staff)

**Step 4.1 — Staff logs physical complaint.** As `sp_secretary`, navigate to `/complaints/new`. Enter complaint details: violation type, tricycle number, date/time, place, complainant name/address/contact. Submit (`complaints.createClerkAssisted`). This simulates a citizen physically delivering the completed form.

> **Assert 4.1.a — Complaint created.** The complaint record is created with status `Pending Hearing`. A control number or tracking ID is assigned. `[Confirmed — consolidated ref Part 4.14 outcome states]`

> **Assert 4.1.b — Complaint appears in staff list.** Navigate to `/complaints`. The new complaint appears in `complaints.listAll` results, visible to `sp_secretary`. `[Confirmed — F1 §8.3]`

**Step 4.2 — Secretariat routing decision.** As `sp_secretary`, open the complaint at `/complaints/:complaintId`. Log the routing decision (Secretariat routes to committee — consolidated ref Part 4.14 confirms Secretariat decides). Set status: `Received/Seen`. Submit (`complaints.logAndAssign`).

> **Assert 4.2.a — Status update.** Complaint status is now `Received/Seen`. `[Confirmed — consolidated ref Part 4.14 outcome states]`

**Step 4.3 — Committee report.** As `sp_member` (Committee on Transportation or relevant committee), open the assigned complaint step. Submit the committee report (`complaints.enterCommitteeReport`).

**Step 4.4 — Resolve complaint.** As `sp_secretary`, open the complaint. Log outcome = `Resolved`. Submit (`complaints.setOutcome`).

> **Assert 4.4.a — Final status.** Complaint status = `Resolved`. `[Confirmed — consolidated ref Part 4.14]`

> **Assert 4.4.b — Respondent notification.** For the seeded respondent (who has an email address): confirm the system attempted to send a formal written notice to the respondent's email. `[Confirmed — consolidated ref Part 4.14: if respondent has email, notification + formal notice sent by email]`

### Scenario script — Mode 2 (Digital portal submission)

**Step 4.5 — Citizen submits via portal.** Switch to `citizen` session (or unauthenticated, depending on gate resolution). Navigate to `/portal/complaints/new`. Fill the digital complaint form. Submit.

> **Assert 4.5.a — Submission acknowledged.** A submission confirmation is shown. A tracking reference is provided to the citizen.

> **Assert 4.5.b — Complaint visible in staff inbox.** Authenticate as `sp_secretary`. Navigate to `/complaints`. The portal-submitted complaint appears in the list. `[Inference — portal submission must create the same backend record as clerk-assisted; the intake path differs, not the record type]`

**Step 4.6 — Citizen status check.** Log back in as `citizen`. Navigate to `/portal/complaints/:complaintId/status`. Confirm the citizen can see the current complaint status. `[Confirmed — F1 §13.2, §4: "View own submitted complaint and status" is Citizen-only]`

**Step 4.7 — Staff resolves.** Staff processes and resolves the complaint (same as Steps 4.3–4.4). After resolution, citizen navigates back to the status page.

> **Assert 4.7.a — Status updated for citizen.** The citizen-facing status page now shows `Resolved` (or equivalent). `[Confirmed — F1 §13.2 route: PortalComplaintStatusPage]`

### Scenario script — Mode 3 (Clerk-assisted in-person)

**Step 4.8 — Clerk enters complaint in person.** As `sp_secretary`, navigate to `/complaints/new`. Enter the citizen's details (citizen is physically present). The clerk fills the form on the citizen's behalf. Submit. The system generates a printable form. `[Confirmed — consolidated ref Part 4.15 Mode 3 description for document requests; Part 4.14 confirms same three access modes apply to complaints]`

> **Assert 4.8.a — Printable form generated.** A printable version of the complaint form is available for the citizen to sign on the spot. `[Confirmed — consolidated ref Part 4.15: citizen signs the document even in clerk-assisted mode]`

> **Assert 4.8.b — Complaint record created.** Same as Assert 4.1.a.

---

## S5. QR Code Scan on Mobile Device Resolving to Document Status

### Goal

Confirm that a QR code generated at secretariat logging, when scanned from a mobile device viewport, navigates to the correct public portal document page displaying: document type, routing history, first page only (other pages blurred), and a "Get a copy" link. This scenario validates the tracking system's core citizen-facing output and the mobile-first responsive design requirement.

### Roles involved

Unauthenticated (public)

### Routes exercised

`/portal/lookup` → `/portal/documents/:trackingNumber`

> **[Resolved — ADR-001]** Served from `/apps/portal` (Next.js).

### Preconditions

An SP Resolution from S1 (or a dedicated test document) that has reached `portal_publication` and has its first page uploaded. The QR code (UUID tracking number) from that document's `intake_logging` step is available. A multi-page PDF is attached as the document file (at minimum 2 pages; page 1 is the only page that should be visible to the public).

### Scenario script

**Step 5.1 — Set mobile viewport.** Configure Playwright to use a mobile viewport (e.g., `iPhone 13` or `Pixel 5` device preset). Use an unauthenticated browser context.

**Step 5.2 — Navigate via tracking number.** Navigate to `/portal/lookup`. Enter the QR tracking number in the lookup field. Submit.

> **Assert 5.2.a — Redirect to document page.** Browser navigates to `/portal/documents/{trackingNumber}`. `[Confirmed — F1 §13.2: PortalTrackingLookupPage is the entry point]`

**Step 5.3 — QR scan simulation.** Alternatively (or additionally): use Playwright to simulate a QR code scan by directly navigating to `/portal/documents/{trackingNumber}` — the URL encoded in the QR code's content. `[Confirmed — consolidated ref Part 11.6: QR content is a unique tracking ID, not a URL; the device scanner resolves the URL externally]`

> **[Inference]** The QR code encodes only the tracking UUID, not a full URL. The device's camera app resolves the lookup URL externally. For test purposes, navigating directly to `/portal/documents/{trackingNumber}` is equivalent to following the scanned link.

> **Assert 5.3.a — Document type displayed.** The page displays the document type (e.g., "SP Resolution"). `[Confirmed — consolidated ref Part 11.4: QR scan result shows document type]`

> **Assert 5.3.b — Routing history displayed.** The page shows a history of routing steps (at minimum: intake date, First Reading date, committee referral status). `[Confirmed — consolidated ref Part 11.4: "History from draft (full routing history)"]`

> **Assert 5.3.c — First page visible.** The document's first page is rendered (via `react-pdf` per stack). `[Confirmed — consolidated ref Parts 4.1, 11.4]`

> **Assert 5.3.d — Pages beyond first are blurred.** For the multi-page test document: pages 2+ are not readable. They may be visually blurred or not rendered at all. `[Confirmed — consolidated ref Part 11.4: "Other pages blurred"]`

> **Assert 5.3.e — "Get a copy" link present.** A "Get a copy" button or link is visible on the page. `[Confirmed — consolidated ref Part 11.6: "Full copy access: 'Get a copy' button on scan result"]`

> **Assert 5.3.f — No full-text download.** No direct download link for the full document PDF is present on this page. The "Get a copy" link navigates to the Document Request Form, not to a file download.

**Step 5.4 — Responsive layout.** On the mobile viewport: confirm the page layout is usable (no horizontal overflow, no text truncated outside viewport). Use Playwright's `page.screenshot()` for visual reference. `[Confirmed — consolidated ref Part 11.16: mobile-first responsive design]`

**Step 5.5 — Accessibility of public data.** Confirm the page loads without requiring authentication. Attempt to access the page in an incognito context. `[Confirmed — F1 §13.2: PortalDocumentViewPage requires "Public, no authentication required"]`

---

## S6. SP Secretary Manual Override of Missing Committee Report — Mandatory Audit Log Entry

### Goal

Confirm that when one or more committees have not submitted their report and the SP Secretary uses the manual advance action (`workflow.manuallyAdvanceMultiReferralStep`), the action is only permitted if a comment is provided, the outcome recorded is `SECRETARY_ADVANCED`, the step advances to `second_reading_vote`, and the audit log captures a distinct entry with the mandatory comment and the SP Secretary's identity. This scenario tests the governance control that prevents silent bypasses of the committee reporting requirement.

**Source:** consolidated ref Part 8.3; H1 §5.3 rule 5; F1 §6 (Order of Business view) and §8.2 (Multi-Referral Panel).

### Roles involved

`sp_secretary`

### Routes exercised

`/order-of-business` · `/workflow/steps/:instanceId` · `/audit`

### Workflow steps exercised

`committee_referral` (active, committee not yet submitted) → `SECRETARY_ADVANCED` → `second_reading_vote`

### Preconditions

Base seed applied. An SP Resolution workflow instance is active at `committee_referral`. The Committee on Laws has **not** submitted their report. The Thursday cutoff for the current session week has passed (simulate by setting `second_reading_eligible_date` to null in the test database, or by using the test clock strategy from S3).

### Scenario script

**Step 6.1 — Verify red flag in Order of Business.** As `sp_secretary`, navigate to `/order-of-business`. Locate the resolution document in the upcoming session.

> **Assert 6.1.a — Red flag displayed.** The document row is visually red-flagged due to missing committee report. `[Confirmed — consolidated ref Part 4.18: items with missing committee reports are marked red; H1 §5.2 step 4: absent committees marked red in Order of Business]`

> **Assert 6.1.b — Document not on next Tuesday agenda.** If the Thursday cutoff has passed, the document is not scheduled for the immediately following Tuesday session. `[Confirmed — consolidated ref Part 8.3: Second Reading delayed if report not submitted before cutoff]`

**Step 6.2 — Attempt override without comment.** As `sp_secretary`, navigate to `/workflow/steps/:instanceId` for the `committee_referral` step (Multi-Referral Panel). Locate the manual advance action. Attempt to submit the manual advance with an empty comment field.

> **Assert 6.2.a — Submission blocked.** The system does not accept the submission. An error or validation message indicates that a comment is required for the manual advance. `[Confirmed — consolidated ref Part 8.3: SP Secretary can manually advance but must provide mandatory comment; F1 §8.2 Multi-Referral Panel: allow_secretary_advance: true but comment is mandatory]`

**Step 6.3 — Override with mandatory comment.** Enter a non-empty comment explaining the reason for the override (e.g., "Committee on Laws chair confirmed verbal agreement; formal report to follow"). Submit the manual advance (`workflow.manuallyAdvanceMultiReferralStep`).

> **Assert 6.3.a — Outcome recorded.** The `committee_referral` step instance has outcome = `SECRETARY_ADVANCED`. `[Confirmed — H1 §2.3: SECRETARY_ADVANCED is set by SP Secretary; H1 §5.3 rule 5]`

> **Assert 6.3.b — Workflow advances.** The active step is now `second_reading_vote`. `[Confirmed — H1 §5.3 rule 5: SECRETARY_ADVANCED → second_reading_vote]`

> **Assert 6.3.c — Red flag gone from Order of Business.** Navigate back to `/order-of-business`. The red flag is removed from this document's row (the referral step is no longer blocking it). `[Inference]`

**Step 6.4 — Audit log inspection.** Navigate to `/audit`. Locate the audit entry for the `committee_referral` manual advance.

> **Assert 6.4.a — Entry exists with correct actor.** The audit log contains an entry for: action = `multi_referral_manually_advanced` (or equivalent event name), actor = the SP Secretary's user ID, document ID = the resolution's UUID, step key = `committee_referral`. `[Confirmed — consolidated ref Part 11.11: all step completions audited; Part 8.3: manual advance is audit-logged]`

> **Assert 6.4.b — Comment is in the audit entry.** The mandatory comment entered in Step 6.3 is stored in the audit record's payload. `[Confirmed — consolidated ref Part 8.3: manual advance is "audit-logged with a mandatory comment"]`

> **Assert 6.4.c — Outcome code in audit entry.** The audit entry includes `outcome = SECRETARY_ADVANCED`. `[Confirmed — H1 §2.3: outcome codes are part of step completion events]`

> **Assert 6.4.d — Timestamp is not null.** The audit entry timestamp is populated and falls within the expected time window of the test.

**Step 6.5 — Audit entry is not editable.** Attempt to locate an edit or delete action on the audit entry. Confirm no such action is present in the UI, regardless of the logged-in role. `[Confirmed — consolidated ref Part 11.11: audit log is append-only; INSERT-only at DB permissions level]`

**Step 6.6 — Non-Secretary roles cannot manually advance.** In a separate session: authenticate as `sp_member`. Navigate to `/workflow/steps/:instanceId` for another `committee_referral` step instance. Confirm the manual advance action is not visible or not actionable for this role. `[Confirmed — F1 §8.2 Multi-Referral Panel: workflow.manuallyAdvanceMultiReferralStep is SP Secretary only]`

---

## Notes for Test Implementation

### Time-dependent steps

S3 and S6 both require advancing or bypassing real-time deadlines. The test implementation must not use `sleep()` or actual calendar waits. Recommended approach: expose a test-only endpoint or utility function (`/api/test/advance-timer`) that directly sets deadline fields in the database and invokes the scheduler function for a given instance ID. This endpoint must be gated on `NODE_ENV === 'test'` and must not be deployed to production. `[Inference — standard test-clock isolation pattern; no confirmed platform decision]`

### Database isolation

Each scenario should run against a clean database snapshot or use a rollback strategy so that residual state from one scenario does not affect another. Playwright's `test.beforeEach` hook is the natural place for this.

### Portal hosting configuration

S4 (Mode 2) and S5 both exercise portal routes. Since the hosting-app decision is resolved in favor of a separate `/apps/portal` Next.js app `[Resolved — ADR-001]`, the Playwright config should be configured to target its base URL (which should be parameterized in `playwright.config.ts` via an environment variable rather than hardcoding).

### Test execution priority

Run these six scenarios in order during early development: S1 is the critical path and should be the first Playwright test written. S3 can be written immediately after S1, since it reuses the majority of S1's setup. S2 and S6 can run in parallel. S4 and S5 require the portal module to be at minimum partially deployed and can be deferred until that work begins.

### Playwright project structure

These scenarios map naturally to one Playwright spec file each:
```
/apps/web/e2e/
  s1-sp-resolution-full-lifecycle.spec.ts
  s2-certified-urgent.spec.ts
  s3-mayor-lapse.spec.ts
  s4-citizen-complaint.spec.ts
  s5-qr-scan-mobile.spec.ts
  s6-secretary-override-audit.spec.ts
```

Shared seed helpers and role-switching utilities belong in a `/e2e/helpers/` directory, not duplicated across files.

---

_This document is finalized before first Phase 1 feature implementation. Changes to scenario scope, step keys, or assertion targets require a dated revision note at the top of the affected scenario. Changes that add a new mandatory assertion must be reviewed against the confirmed consolidated reference source before adding `[Confirmed]` status._
