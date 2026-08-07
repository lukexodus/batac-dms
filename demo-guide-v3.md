# SP Resolution Workflow — Complete Branch-by-Branch Testing Guide

**Purpose:** A step-by-step reference for manually testing every reachable branch of the SP Resolution workflow — not a timed demo script (see `demo-guide-v2.md` for that). Follow this sequentially, or jump to any branch section independently once you have a document at the right step.

**Verification basis:** Every claim below was checked directly against the current repository upload (dated for this session). Two claims explicitly correct or supersede the prior handoff document — flagged inline where relevant. All file:line citations are current as of this snapshot; re-verify if you're reading this against a later upload.

---

## Before You Start: Two Things `demo-guide-v2.md` Gets Wrong or Omits

If you've read the existing demo guide, correct these two points before using it as reference material — they no longer match live behavior:

1. **Final numbering is fully automatic, not manual.** `demo-guide-v2.md`'s numbering section describes the Secretary manually assigning/finalizing the final number, with a hedge about a rendering bug. That's stale. `DocumentDetailPage.tsx`'s `canAssignFinalNumber` (line 130) has an explicit guard returning `false` whenever `documentTypeCode === 'SP_RESOLUTION'` — the "Finalize Number" button is intentionally hidden for this document type. The final number is assigned automatically by a `workflow.step.completed` subscriber (`documents.plugin.ts:213-241`) the moment `second_reading_vote` or `second_reading_amended_vote` completes with an approving outcome. Don't look for a button here — there isn't one, by design.
2. **OoB Scheduling and First Reading are now one action, not two.** The old guide frames these as separate steps ("Step 2a — Schedule for Order of Business" then "Step 2b — Record First Reading"). Since `TASK-WF-BE-003` landed, clicking "Schedule & Complete Task" in the `OrderOfBusinessSchedulingPanel` does both atomically in one transaction (`session.router.ts:770-1024`, `session.router.ts:956-1021`). There is no separate "Record First Reading" step to look for afterward.

---

## Act 0 — Before the Workflow Exists: Intake and the Hidden First Step

**What the old guide misses entirely:** submitting the "New Document" form does *not* immediately make the document ready for OoB scheduling.

1. Submit a new SP Resolution via the intake form. A workflow instance is created, and the document immediately shows up in `DocumentPicker` on the Order of Business page (it filters on `lifecycleState="in_workflow"`, `OrderOfBusinessPage.tsx:838-841` — set at instance-creation time).
2. **But the workflow instance itself sits at `intake_logging`, not yet advanced.** `intake_logging` is `is_start: true` with `auto_complete: false` and `step_type: 'action'` — nothing auto-completes it (`create-instance.ts`; auto-completion applies only to `decision`/`notification` step types). It's assigned to the Secretariat Staff role and needs to be completed like any ordinary action step, via `GenericActionPanel`'s "Complete Task" button, **before** `order_of_business_scheduling` becomes active.
3. **What to test:** log in as Secretariat Staff, go to "My Assigned Steps," find the new document at `intake_logging`, complete it. Only after that will it appear as schedulable.

---

## Act 1 — Order of Business Scheduling → First Reading (Merged Action)

1. As SP Secretary, open the document from "My Assigned Steps" at `order_of_business_scheduling`.
2. The panel shown is **`OrderOfBusinessSchedulingPanel`** (title: "Order of Business Scheduling"). It has:
   - A Session Date picker, defaulting to the upcoming Tuesday (`getNextTuesdayFormatted`, line 11).
   - An optional rich-text Comment field.
   - One button: **"Schedule & Complete Task."**
3. Click it. This single action, in one transaction, creates/reuses the SP session, creates/reuses the Order of Business, inserts the OoB item, **and completes the `order_of_business_scheduling` workflow step**, advancing to First Reading logging (`session.router.ts:956-1021`).
4. **Testable fact — comment field is live:** unlike a previous version of this system, the comment you type here is now actually sent to the server (`OrderOfBusinessSchedulingPanel.tsx:54`, `session.router.ts:775, 1012`) and flows into the step-completion record. If you leave it blank, `null` is sent — this is correct, expected behavior, not a bug.

---

## Act 2 — First Reading Outcome (Secretariat Decision)

The next actionable step reaches `SecretariatDecisionPanel` for `second_reading_vote` (and again later, for its own outcome). Three buttons:

- **Approve** → outcome `APPROVED`
- **Reject** → outcome `REJECTED`
- **Amended** → outcome `AMENDED`

**Testable fact:** `RETURNED_FOR_REVISION` is a valid server-side outcome for this step (it's in the seed's `allowed_outcomes`) but **has no button here**. This is intentional — `AMENDED` and `RETURNED_FOR_REVISION` represent the same real-world action, and the frontend correctly exposes only one path to it (`SecretariatDecisionPanel.tsx`, `workflow.router.ts:1507`). Don't go looking for a fourth button; it was never meant to exist.

---

## Act 3 — Committee Referral: Two Paths to the Same Place

At `committee_referral`, you have two independent options.

### 3a — Ordinary Path (No Certification of Urgency)
Referral proceeds normally to `committee_review`/`committee_revisions_review` depending on outcome.

### 3b — Certified Urgent Bypass
This is a full mechanism, not a flag on the resolution itself. It requires a **separate, real document**.

**Setup (do this before you can test the bypass):**
1. Via Intake, create a document of type **Certification of Urgency**. (This is what `LogCertificationOfUrgencyDialog.tsx` expects to find — its search will show "No Certification of Urgency documents found... Log one via Intake first" if none exist, line 112.)
2. On the SP Resolution's Document Detail page, as SP Secretary, you'll see a **"Log Certification of Urgency"** button (visible to any `sp_secretary` role, regardless of the document's current lifecycle state or step — `DocumentDetailPage.tsx:196-198`).
3. Click it. A dialog opens with a search box (defaults to query `"cert"`) and a dropdown of matching Certification of Urgency documents. Select one, click **Confirm**.

**What happens next depends on exactly where the workflow instance is** (`certified-urgent-bypass.handler.ts`, three cases):
- **If `multi_referral` step is currently active:** the step is immediately marked `bypassed` (outcome `BYPASSED_CERTIFIED_URGENT`), and the workflow advances past committee referral right away. Toast: "Certification of Urgency logged successfully. Bypassed committee referral."
- **If `multi_referral` is still pending (not yet reached):** the bypass is recorded as *deferred* — it will apply automatically once that step activates. No immediate workflow change.
- **If the workflow is already past committee referral:** the mutation **still succeeds and shows the same success toast**, but does nothing to the workflow — a no-op event (`workflow.certification_urgency.already_past_referral`) is logged and nothing else happens. **This is a genuinely testable edge case worth trying deliberately**: log a Certification of Urgency against a resolution that's already at, say, `second_reading_vote`, and confirm the toast appears but the workflow doesn't change.

---

## Act 4 — Valid-in-Part / Legal / Committee Routing (via Panlalawigan Outcome Panel)

This panel, `ValidInPartDecisionPanel`, has four buttons, all requiring a mandatory comment regardless of which path is chosen (a stricter, hardcoded rule independent of what the seed's config alone suggests):

- **Resolve In Place** → `RESOLVED_IN_PLACE`
- **Route to Legal Office** → `ROUTED_TO_LEGAL`
- **Route to Committee** → `ROUTED_TO_COMMITTEE`
- **Revise Directly** → `REVISED_DIRECTLY`

**Testable fact:** try submitting "Route to Legal Office" or "Route to Committee" with a blank comment — it will be rejected client-side ("Comment is required") and, if you bypass that, server-side too (`resolveValidInPart`'s `mandatoryComment: z.string()` schema plus an `isRichTextEmpty` check that applies to all four paths uniformly).

**Testable fact — the committee-chair edge case:** if "Route to Committee" is chosen and the referred committee has no chair on record, this now throws a clear `PRECONDITION_FAILED` error (per `TASK-WF-028`, implemented) rather than silently succeeding and leaving `committee_revisions_review` permanently un-actionable. Try this deliberately against a committee you know has no chair assigned in the Organization module.

---

## Act 5 — Panlalawigan Review

This is a single panel (`PanlalawiganOutcomePanel`) with **three independently-actionable sections shown all at once** — there is no gating that hides sections 2 or 3 until section 1 is used. Expect to see all three cards the first time you land here.

### 5a — Record Outcome
Dropdown: **Valid / Valid in Part / Operative in its Entirety / Returned**, optional remarks, "Record Outcome" button.

**Testable fact:** selecting **"Operative in its Entirety"** for an SP Resolution and clicking Record Outcome will fail with a clear validation error. This outcome is only valid for Appropriation Ordinances (`submitStepApproval`'s document-type-aware guard) — the dropdown shows it because this panel is shared across three document types, but SP Resolution correctly rejects it. This should error cleanly, not crash or silently misbehave.

### 5b — Resolve Valid in Part
A second, independent dropdown (Resolve As-Is / Route to Legal / Route to Committee / Implement Directly) with its own mandatory comment and its own "Resolve" button — separate from the Act 4 panel of the same name; this is the Panlalawigan-stage equivalent, reachable if "Valid in Part" gets selected in 5a first (in practice, but not enforced by the UI).

### 5c — Confirm 30-Day Deemed Approved
Button: **"Confirm."** This is **not** the same mechanism as the mayor-lapse pattern below, and behaves differently:
- **Server-side deadline enforcement is real and active here.** Clicking Confirm before 30 real days have elapsed since Panlalawigan transmission produces a `PRECONDITION_FAILED` error: "30-day window has not yet elapsed." (`workflow.router.ts:3460-3465`)
- Clicking it after the deadline **only records an audit acknowledgment** (`deemed_approved_confirmed_at`/`_by` in step metadata) — it does **not** itself advance the workflow.
- **The actual state transition** (step completed, outcome `DEEMED_APPROVED`, workflow advances) is performed entirely by an hourly background job, `evaluate-panlalawigan-timers.ts`, scheduled via pgboss (`workflow.plugin.ts:142-151`), independent of whether anyone ever clicks Confirm.
- **Practical consequence for testing:** you cannot trigger this branch by clicking a button on demand within a normal test session. To exercise it, either (a) wait out the real 30-day window on a persistently-running dev server, or (b) directly set `panlalawigan_action_deadline` in the instance's context (via DB) to a past timestamp, then either wait for the next hourly job run or invoke the job function directly in a test/script context.

---

## Act 6 — Returned Review (When Panlalawigan Returns With Objections)

If Act 5a's outcome is **Returned**, the workflow routes to `returned_review`, handled by `ReturnedReviewDecisionPanel`. Two buttons, both requiring mandatory remarks:

- **Repass to Drafting** → outcome `REPASS` → routes to a termination step, `end_repassed`
- **Resolve Directly** → outcome `RESOLVED_DIRECTLY` → routes to `portal_publication`, rejoining the main flow

**Note on scope:** the ADR-014 `workflow.instance.repassed` subscriber (document-supersession logic triggered by `end_repassed`) is treated as implemented per standing project instruction and was not independently re-verified against live code in this investigation — only the panel and its immediate routing were checked directly.

---

## Act 7 — VP Certification and Transmittal (No Branching)

- **`vp_certification`** (`VPCertificationPanel`): single outcome, `SIGNED` only — no decision branch to test here.
- **`transmittal_letter_to_mayor`** (`TransmittalLetterPanel`, an ordinary action step): completing this **starts the Mayor's 10-day clock** — it sets `mayor_action_deadline` in the instance context (`context-writer.ts:35-41`), which is what the next act depends on.

---

## Act 8 — Mayor Review: Sign, Veto, or Lapse

This is the most easily-misdescribed branch in the whole workflow — two separate panels, switched between by a server-computed hint, and the third outcome is driven by a background job, not a button.

### 8a — Normal Window: `MayorDecisionPanel`
While the 10-day deadline hasn't passed, this is what renders. Two buttons:
- **Sign** → outcome `SIGNED`, no confirmation required, no objections needed.
- **Veto** → outcome `VETOED`. Requires non-empty Objections text — enforced both client-side (toast: "Objections text is required to veto") and server-side (`BAD_REQUEST: Objections text is required to veto`).

### 8b — After the Deadline: `MayorLapseConfirmationPanel`
**This is a genuinely different, separate panel — not a third button inside 8a's panel.** The switch between the two is computed server-side by `computeMayorPanelHint`: it returns the lapse-confirmation panel only once `Date.now()` exceeds `mayor_action_deadline` and the lapse hasn't already been acknowledged.

**Critical distinction to get right when testing:** clicking **"Confirm 10-Day Lapse"** here does **not** itself advance the workflow. It only writes an audit acknowledgment (`lapse_confirmed_at`/`_by`) and logs a `LAPSED_CONFIRMED` event. **The actual state transition — step completed, outcome `LAPSED`, workflow advances to `docketing` — is performed entirely by an hourly background job**, `evaluate-mayor-lapse-timers.ts` (pgboss-scheduled, `workflow.plugin.ts:132-136`), which runs independently of any UI interaction. The job even has a documented race-condition guard for the case where the Mayor signs or vetoes right as the job is about to fire ("Mayor beat the scheduler").

**Practical consequence for testing:** same as the Deemed Approved branch above — not clickable on demand. To test, either wait out the real 10-day window, or manipulate `mayor_action_deadline` directly in the database to force it into the past, then wait for (or manually invoke) the next hourly job run.

---

## Act 9 — Veto Override (Only Reachable After a Veto)

If Act 8a resulted in `VETOED`, the workflow reaches `veto_override_vote`, handled by `VetoOverrideRecordingPanel`. One button: **"Record Vote."**

- Two numeric inputs: Votes For, Votes Against (0–12 each).
- **Threshold is hardcoded server-side at ≥ 8 of 12** ("2/3 of 12 SP members... not a judgment call, not configurable" — `workflow.router.ts:3003-3005`). `votesFor >= 8` alone determines `OVERRIDE_SUCCEEDED` vs `OVERRIDE_FAILED`.
- **Testable fact:** `votesAgainst` and absent-councilor data are recorded in context but **play no role in the outcome calculation whatsoever**. Nothing prevents entering internally-inconsistent numbers (e.g., `votesFor: 8, votesAgainst: 12`, summing past 12) — the vote still succeeds. This is worth trying deliberately to confirm the system doesn't reject it.
- **Outcomes route differently:** `OVERRIDE_SUCCEEDED` → `docketing` (rejoins the main flow toward Panlalawigan review); `OVERRIDE_FAILED` → `end_vetoed_override_failed`, a termination step with `final_document_status: 'cancelled'`.

---

## Act 10 — Portal Publication and Archive: Full Completability Confirmed

`portal_publication` and `archive` are both ordinary generic action steps (`GenericActionPanel`, "Complete Task"), with no step-key-specific logic anywhere in the codebase. Completing them in sequence advances to `final_outcome_check`, an automatic decision step (no human action) that routes to the correct termination step based on the recorded Panlalawigan outcome.

**Confirmed end-to-end:** yes, you can take a fresh SP Resolution all the way through to a terminal state, including past portal publication. What's genuinely missing is only the citizen-facing public portal itself (no `apps/server/src/modules/portal` module, no `/portal` frontend route exists) — this doesn't block the internal workflow at all; only the outward-facing publication layer is separate, additive future work.

**Lifecycle state confirmation:** `documents.lifecycleState` genuinely reaches `'archived'` by the time termination fires, via an explicit chain-of-custody hop sequence (`completed` → `released` → `archived`, never skipping the `released` hop) run inside the termination handler — this is real, verified, and not a per-step subscriber gap.

---

## Summary Table — Branches by How They're Triggered

| Branch | Trigger type | On-demand testable? |
|---|---|---|
| First Reading outcome (Approve/Reject/Amended) | Button click | Yes |
| Certified Urgent bypass | Button click + prerequisite document | Yes, once cert doc exists |
| Valid-in-part routing (all 4 paths) | Button click | Yes |
| Committee-chair-missing error | Button click, specific data setup | Yes, with an unassigned committee |
| Panlalawigan outcome (incl. rejected "Operative in Entirety") | Button click | Yes |
| Returned review (Repass / Resolve Directly) | Button click | Yes |
| VP Certification | Button click (single path) | Yes |
| Mayor Sign / Veto | Button click | Yes |
| **Mayor Lapse (`LAPSED`)** | **Hourly background job, deadline-gated** | **No — requires waiting or DB deadline manipulation** |
| Veto Override vote | Button click | Yes |
| **Panlalawigan Deemed Approved** | **Hourly background job, deadline-gated** | **No — requires waiting or DB deadline manipulation** |
| Portal Publication / Archive / termination | Button click (generic action) | Yes |

---

## Findings Log Entries for This Session

Per project convention, the following are new entries for `docs/development-findings-log.md`. These are proposed, not confirmed — a human needs to move them to `confirmed` if accurate. Copy-paste as needed; the repo copy was not edited directly.

```markdown
### [LOG-0256] `MayorLapseConfirmationPanel` and the Panlalawigan "Confirm 30-Day Deemed Approved" button are audit-acknowledgment-only — actual state transitions for both are performed by separate hourly background jobs, not by the button click

- date: 2026-08-07
- task_id: none (testing-guide investigation)
- status: proposed
- affects: demo-guide-v2.md (Act 4/mayor-review section, if it exists there), any future testing documentation
- supersedes: none

Confirmed by direct trace of both mutations and both jobs in the current upload.

`logMayorLapseConfirmation` (workflow.router.ts:2885-2954) writes `lapse_confirmed_at`/
`lapse_confirmed_by` into step instance metadata and logs a `LAPSED_CONFIRMED` audit
event. It does not call `submitStepApproval` or `resolveNextStep` anywhere in its body.
The actual step completion (status: 'completed', outcome: 'LAPSED', workflow advanced
via `resolveNextStep`) is performed entirely by `evaluate-mayor-lapse-timers.ts`
(lines 9-131), an hourly pgboss-scheduled job (workflow.plugin.ts:132-136,
'0 * * * *', Asia/Manila).

`confirmPanlalawiganDeemedApproved` (workflow.router.ts:3436-3538) follows the
identical pattern: writes `deemed_approved_confirmed_at`/`_by` metadata, logs a
`DEEMED_APPROVED_CONFIRMED` event, and returns — no step completion call anywhere
in the procedure. The actual transition (outcome: 'DEEMED_APPROVED') is performed
by `evaluate-panlalawigan-timers.ts`, also hourly pgboss-scheduled
(workflow.plugin.ts:142-151), confirmed via a passing test
(evaluate-panlalawigan-timers.test.ts:35, 'PANLA-01: 30 days elapsed -> step
completes DEEMED_APPROVED with deadline completedAt').

Unlike the mayor-lapse mutation, `confirmPanlalawiganDeemedApproved` does actively
enforce the deadline server-side before allowing even the metadata-only confirmation
(workflow.router.ts:3452-3465, throws PRECONDITION_FAILED if the deadline hasn't
been set or hasn't elapsed) — this is a real behavioral difference between the two
otherwise-parallel mechanisms, not just a naming difference.

Practical effect: neither branch is triggerable on-demand through the UI within a
normal test/demo session. Both require either waiting out the real deadline window
on a persistently-running server, or directly manipulating the relevant deadline
context key (`mayor_action_deadline` / `panlalawigan_action_deadline`) in the
database to force it into the past before the next hourly job tick.

Note: [Confirmed] — all four procedures/jobs and their exact line ranges checked
directly against the current repo upload. [Inference] — that this pattern
(confirmation-button-as-audit-trail, job-as-actual-transition) is an intentional,
consistent architectural choice rather than coincidence, based on the two
mechanisms being structurally identical; not stated as such anywhere in code
comments.

---

### [LOG-0257] `PanlalawiganOutcomePanel` renders three independently-actionable sections (Record Outcome / Resolve Valid in Part / Confirm 30-Day Deemed Approved) simultaneously with no gating between them

- date: 2026-08-07
- task_id: none (testing-guide investigation)
- status: proposed
- affects: demo-guide-v2.md, any future testing/training documentation for this step
- supersedes: none

Confirmed by direct read of PanlalawiganOutcomePanel.tsx (full file, 189 lines).
All three cards (lines 84-124, 126-167, 169-184) render unconditionally inside the
same CardContent — there is no state check hiding "Resolve Valid in Part" until
"Record Outcome" has been used, nor hiding "Confirm 30-Day Deemed Approved" until
the deadline context suggests it's relevant. A user landing on this step for the
first time sees all three at once, with no visual indication of which section is
"the" next action.

Not necessarily a bug — the components may be legitimately independent (Panlalawigan
outcome recording, valid-in-part resolution, and deadline confirmation could genuinely
need to coexist as separate concerns depending on document state) — but worth a human
decision on whether progressive disclosure (hiding sections 2/3 until relevant) would
reduce tester/user confusion, since nothing currently prevents clicking "Confirm" on
Deemed Approved before ever touching the Record Outcome dropdown.

Note: [Confirmed] — panel structure and absence of conditional rendering checked
directly against the current upload.

---

### [LOG-0258] Certified Urgent bypass button has no lifecycle-state gate; logging a certification against a document already past `multi_referral` succeeds with a success toast but is a silent no-op

- date: 2026-08-07
- task_id: none (testing-guide investigation)
- status: proposed
- affects: demo-guide-v2.md, any future testing documentation for this step; possibly
  a UX improvement candidate
- supersedes: none

Confirmed by tracing both the frontend gate and the backend handler's three-case logic.

The "Log Certification of Urgency" button's visibility gate, `canLogCertificationOfUrgency`
(DocumentDetailPage.tsx:196-198), checks only `hasRole(identity, 'sp_secretary')` — no
lifecycle-state or workflow-step condition. The button is visible and clickable on any
SP Resolution, at any point in its workflow, for any user with the sp_secretary role.

certified-urgent-bypass.handler.ts's Case C (lines 241-269) handles exactly this: when
the multi_referral step instance's status is 'completed', 'bypassed', or 'cancelled' (i.e.
the workflow has already moved past that step), the handler logs a
'workflow.certification_urgency.already_past_referral' event and returns — no error is
thrown, no state changes. The frontend (LogCertificationOfUrgencyDialog.tsx:54-61) shows
'Certification of Urgency logged successfully. Bypassed committee referral.' regardless of
which of the three backend cases actually fired, since success/failure is determined only
by whether the mutation resolved, not by which case ran.

Practical effect: a Secretary can click this button on a resolution already at, say,
second_reading_vote, get a success toast claiming the bypass worked, and nothing about
the workflow will have changed. Not a functional bug (the underlying data — cert doc
association — is still correctly written to document metadata regardless of workflow
state), but a testable, potentially confusing UX gap worth a human decision: should the
button be hidden/disabled once multi_referral has resolved, or should the success
message differentiate based on which case fired?

Note: [Confirmed] — frontend gate condition and all three backend cases checked directly
against the current upload.
```

---

## What Remains Genuinely Unverified (Explicitly Flagged, Not Silently Assumed)

- **ADR-014's `workflow.instance.repassed` subscriber** (triggered by Act 6's "Repass to Drafting" → `end_repassed`): treated as implemented per standing project instruction (`fix.md` prompt), not independently re-verified against live code in this or the prior session. If document-supersession behavior itself needs testing, that subscriber should be opened and traced before relying on this guide for that specific claim.
- **`mayor_signature` step key**: recognized by the backend guard and policy set alongside `mayor_review`, but has zero occurrences anywhere in the seed — dead/forward-compatible code, not a real branch. Not included as a testable item above.
- This guide covers the SP Resolution document type specifically. Ordinance and Appropriation Ordinance share some panels (notably `PanlalawiganOutcomePanel`) but have different `allowed_outcomes` sets — this guide's "will correctly reject" claims (e.g., "Operative in its Entirety") are specific to SP Resolution and should not be assumed to generalize without checking the other two document types' seed configs.