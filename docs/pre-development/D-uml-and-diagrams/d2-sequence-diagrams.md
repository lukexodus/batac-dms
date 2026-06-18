# D2 — Sequence Diagrams — All Phase 1 Workflows

**Document:** D2
**Platform:** Batac City LGU Platform
**Status:** Pre-Development Baseline
**Last Updated:** June 2026
**Audience:** Development team — internal reference
**Source Documents:** `consolidated-architecture-and-requirements-reference-iteration-3.md` (Post-Interview 2); `b4-workflow-engine-specification.md` (B4); `b2-module-boundary-and-internal-api-contracts.md` (B2); `h1-phase-1-workflow-definitions-structured-data.md` (H1)

---

## About This Document

One sequence diagram per workflow or feature showing the exact message sequence between actors, system components, and domain modules. Each diagram covers the full happy path and all named variants for that workflow.

**Actor key used across all diagrams:**

| Label | Who |
|---|---|
| `Councilor` | Authoring city councilor or SP staff |
| `SecStaff` | SP Secretariat staff (Administrative Officer II / Clerk III) |
| `SPSec` | SP Secretary (Gladys R. Lagura) |
| `ViceMayor` | Vice Mayor / Presiding Officer (or Acting VM via delegation) |
| `Mayor` | Mayor (or Acting Mayor via delegation) |
| `LegalOfficer` | City Legal Office legal officer |
| `CommitteeChair` | Chair of the referred subject-matter committee |
| `RecordsOfficer` | Records Officer |
| `Citizen` | Member of the public |
| `Clerk` | Secretariat clerk (for in-person citizen-assisted flows) |

**System component key:**

| Label | Component |
|---|---|
| `Web` | `/apps/web` — Vite + React SPA (internal authenticated app) |
| `Server` | `/apps/server` — Fastify backend (tRPC + REST) |
| `WF` | Workflow Engine (within Server) |
| `DocMod` | Documents module |
| `TrackMod` | Tracking module |
| `OrgMod` | Organization module |
| `IAMMod` | IAM module |
| `NotifMod` | Notifications module |
| `AuditMod` | Audit module |
| `EventBus` | In-process event bus |
| `Scheduler` | pgboss + node-cron scheduler |
| `S3` | S3-compatible object storage (Cloudflare R2 / MinIO) |
| `DB` | PostgreSQL database |

**Notation conventions:**

- `-->>` dashed return arrow = response/callback
- `->>` solid arrow = request/call
- `Note over` = internal state recorded in DB
- `rect` = conditional or looping block
- All timer-based transitions (Mayor 10-day lapse, Panlalawigan 30-day) are shown as scheduler-initiated sequences

> **Event naming note `[B3 Reconciliation — ADR-B2-3 / B3 §0.2]`:** This document was authored using B2's draft event naming conventions. B3 (`b3-internal-domain-event-catalog.md`) ratified the canonical event names. The table below maps each D2 usage to the B3 canonical name. The diagrams themselves are not revised (to preserve mermaid structural integrity and readability) — implementors should use the B3 canonical names in code. One event is **removed** and not merely renamed (ADR-B2-3).
>
> | D2 usage (diagram labels) | B3 Canonical Name | Notes |
> |---|---|---|
> | `workflow.step_assigned` | `workflow.step.started` | B3 §7.11; B4 name ratified over B2 equivalent |
> | `workflow.step_completed` | `workflow.step.completed` | B3 §7.12 |
> | `workflow.completed(...)` | `workflow.instance.completed` | B3 §7.2; outcome code now in `outcomeCode` payload field |
> | `documents.certification_urgency.logged` | `document.certification_urgency.logged` | B3 OI-3 — singular prefix; also corrected in Diagrams 2 and 5 below |
> | `document.secretariat_decision` | ~~removed~~ | **ADR-B2-3** — this event no longer exists. The secretariat's Approve/Reject/Amended action now enters via the Workflow Router, which atomically calls `Documents.transitionState()` and emits `workflow.step.completed`. No sequence diagram in D2 shows this specific event — D2 correctly omitted it because the step was already modeled as a workflow step action (see §2 tRPC calls `submitStepAction`). |

---

## 1. SP Resolution — Standard Path

Covers: Secretariat intake → First Reading → Committee referral → Second Reading (no amendments) → Final number assignment → VP certification → Transmittal to Mayor → Mayor signs → Docketing → Panlalawigan transmission → VALID outcome → Portal publication → Archive.

```mermaid
sequenceDiagram
    autonumber
    actor Councilor
    actor SecStaff
    actor SPSec
    actor ViceMayor
    actor Mayor
    actor RecordsOfficer
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant DocMod as Documents Module
    participant TrackMod as Tracking Module
    participant OrgMod as Organization Module
    participant NotifMod as Notifications Module
    participant AuditMod as Audit Module
    participant EventBus
    participant Scheduler
    participant S3
    participant DB

    %% ── DRAFT SUBMISSION ──────────────────────────────────────────────────────
    Councilor->>Web: Submits draft resolution (title, sponsors, file upload)
    Web->>Server: tRPC createDocument(payload, file)
    Server->>S3: Stream upload file; store at UUID key
    S3-->>Server: storageKey
    Server->>DocMod: createDocument(metadata, storageKey)
    DocMod->>DB: INSERT documents (status=Draft)
    DB-->>DocMod: document_id
    DocMod->>EventBus: emit document.created
    EventBus->>TrackMod: consume document.created
    TrackMod->>DB: INSERT tracking_record; generate QR UUID
    TrackMod->>S3: Store QR code image at UUID key
    Note over DB: QR tracking number assigned FIRST — before preliminary number
    EventBus->>WF: consume document.created
    WF->>DB: SELECT active definition_version for document_type=sp_resolution
    WF->>DB: INSERT workflow.instances (pinned to definition_version_id)
    WF->>DB: INSERT step_instances[intake_logging] status=active
    WF->>OrgMod: resolveCurrentHolder(role=secretariat_staff)
    OrgMod->>DB: SELECT employee with role; check delegation_grants
    OrgMod-->>WF: assignee=SecStaff user_id
    WF->>DB: UPDATE step_instances.assigned_to
    WF->>EventBus: emit workflow.step_assigned
    EventBus->>NotifMod: consume workflow.step_assigned → notify SecStaff (in-app)
    EventBus->>AuditMod: consume document.created, workflow.step_assigned
    Server-->>Web: document_id, tracking_id
    Web-->>Councilor: Document created; pending Secretariat intake

    %% ── SECRETARIAT INTAKE LOGGING ───────────────────────────────────────────
    SecStaff->>Web: Opens intake task; enters intake form fields
    Web->>Server: tRPC submitStepAction(step_instance_id=intake_logging, outcome=DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>IAMMod: evaluatePolicy(SecStaff, complete_step, step_instance_id)
    IAMMod-->>WF: allowed=true
    WF->>DB: UPDATE step_instances[intake_logging] status=completed, outcome=DONE
    Note over WF: intake_logging completion triggers preliminary number assignment
    WF->>DocMod: (event) intake_logging step completed — assign preliminary number
    DocMod->>DB: SELECT next val from sequence sp_resolution/YEAR
    DocMod->>DB: INSERT document_numbers (preliminary="Draft 7SP 2026-NN")
    Note over DB: Preliminary number assigned SECOND — after QR tracking number
    DocMod->>DB: UPDATE documents.current_state = In-Workflow
    DocMod->>EventBus: emit document.number_assigned(type=preliminary)
    EventBus->>AuditMod: consume document.number_assigned
    WF->>DB: INSERT step_instances[order_of_business_scheduling] status=active
    WF->>EventBus: emit workflow.step_assigned (SPSec)
    EventBus->>NotifMod: notify SPSec: new document for Order of Business

    %% ── ORDER OF BUSINESS SCHEDULING ────────────────────────────────────────
    SPSec->>Web: Adds document to next Tuesday Order of Business
    Web->>Server: tRPC submitStepAction(order_of_business_scheduling, DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: UPDATE step_instances[order_of_business_scheduling] status=completed
    WF->>DB: INSERT step_instances[first_reading] status=active
    WF->>EventBus: emit workflow.step_assigned (SPSec)

    %% ── FIRST READING ────────────────────────────────────────────────────────
    Note over SPSec,ViceMayor: Tuesday SP Session — First Reading
    SPSec->>Web: Records First Reading occurred; enters referred committee(s)
    Web->>Server: tRPC submitStepAction(first_reading, DONE, referred_committees=[...])
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: UPDATE step_instances[first_reading] status=completed
    WF->>DB: INSERT step_instances[committee_referral] status=active
    Note over DB: committee list written to step_instances.metadata.assigned_committees
    WF->>OrgMod: resolveCurrentHolder for each assigned committee role
    OrgMod-->>WF: committee assignees resolved
    WF->>EventBus: emit workflow.step_assigned (committee chairs + Committee on Laws)
    EventBus->>NotifMod: notify committee members: referral received
    EventBus->>AuditMod: audit step completion

    %% ── COMMITTEE REFERRAL (multi_referral) ─────────────────────────────────
    Note over SPSec: Committees conduct joint hearing; Thursday cutoff applies
    
    rect rgb(255, 248, 220)
        Note over Scheduler: Thursday 23:59:59 PHT — cutoff evaluation
        Scheduler->>WF: engine.evaluateThursdayCutoffs()
        WF->>DB: SELECT active multi_referral step_instances WHERE thursday_cutoff_enabled=true
        
        alt All committees submitted before cutoff
            WF->>DB: UPDATE metadata.second_reading_eligible_date = next Tuesday
            WF->>DB: UPDATE instance.context.second_reading_eligible_date
            WF->>EventBus: emit workflow.multi_referral.second_reading_eligible
        else One or more committees have NOT submitted
            WF->>DB: UPDATE metadata.thursday_cutoffs_missed += 1
            WF->>EventBus: emit workflow.multi_referral.cutoff_missed
            Note over SPSec: Item marked red in Order of Business dashboard
            EventBus->>NotifMod: notify SPSec: missing committee report(s)
        end
    end

    CommitteeChair->>Web: Submits committee contribution document
    Web->>Server: tRPC submitCommitteeContribution(step_instance_id, file)
    Server->>S3: Store contribution document
    Server->>WF: engine.submitStepAction(committee_referral, COMMITTEE_SUBMITTED, committee_id)
    WF->>DB: APPEND to metadata.submissions [{committee_id, submitted_at, doc_id}]
    WF->>EventBus: emit workflow.multi_referral.committee_submitted

    Note over CommitteeChair: Both committees submit; all_submitted_at recorded
    WF->>EventBus: emit workflow.multi_referral.all_submitted

    SPSec->>Web: Uploads unified committee report; accepts report
    Web->>Server: tRPC acceptCommitteeReport(step_instance_id, unified_report_file)
    Server->>S3: Store unified report
    Server->>WF: engine.submitStepAction(committee_referral, REPORT_ACCEPTED)
    WF->>DB: UPDATE metadata.unified_report_document_id, secretary_accepted_at
    WF->>DB: UPDATE step_instances[committee_referral] status=completed, outcome=REPORT_ACCEPTED
    WF->>DB: INSERT step_instances[second_reading_vote] status=active
    WF->>EventBus: emit workflow.step_completed, workflow.step_assigned

    %% ── SECOND READING VOTE (no amendments) ─────────────────────────────────
    Note over SPSec,ViceMayor: Tuesday SP Session — Second Reading
    SPSec->>Web: Records vote outcome: APPROVED (no amendments)
    Web->>Server: tRPC submitStepAction(second_reading_vote, APPROVED)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: UPDATE step_instances[second_reading_vote] status=completed, outcome=APPROVED
    WF->>DB: INSERT step_instances[final_number_assignment] status=active
    WF->>EventBus: emit workflow.step_assigned (SPSec)

    %% ── FINAL NUMBER ASSIGNMENT ──────────────────────────────────────────────
    Note over DB: Final number assigned AFTER Second Reading vote, BEFORE VP signs
    SPSec->>Web: Assigns final series number (removes "Draft" prefix)
    Web->>Server: tRPC submitStepAction(final_number_assignment, DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>DocMod: assignFinalNumber(document_id, actor_id)
    DocMod->>DB: UPDATE document_numbers: final_number="7SP 2026-NN", preliminary_number nulled
    Note over DB: Final number IMMUTABLE from this point forward
    DocMod->>EventBus: emit document.number_assigned(type=final)
    EventBus->>AuditMod: audit final number assignment
    WF->>DB: UPDATE step_instances[final_number_assignment] status=completed
    WF->>DB: INSERT step_instances[vp_certification] status=active
    WF->>OrgMod: resolveCurrentHolder(role=delegation_aware:vice_mayor)
    OrgMod->>DB: CHECK active delegation_grants for vice_mayor
    OrgMod-->>WF: assignee resolved (VM or Acting VM)
    WF->>EventBus: emit workflow.step_assigned (ViceMayor)
    EventBus->>NotifMod: notify ViceMayor: document awaiting signature

    %% ── VP CERTIFICATION ─────────────────────────────────────────────────────
    ViceMayor->>Web: Reviews certified copy; signs
    Web->>Server: tRPC submitStepAction(vp_certification, SIGNED)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: UPDATE step_instances[vp_certification] status=completed, outcome=SIGNED
    WF->>DB: INSERT step_instances[transmittal_letter_to_mayor] status=active
    WF->>EventBus: emit workflow.step_assigned (SecStaff)

    %% ── TRANSMITTAL LETTER TO MAYOR ──────────────────────────────────────────
    SecStaff->>Web: Generates and sends transmittal letter (SPS format); logs dispatch
    Web->>Server: tRPC submitStepAction(transmittal_letter_to_mayor, DONE)
    Server->>WF: engine.submitStepAction(...)
    Note over WF: triggers_mayor_lapse_timer=true on this step config
    WF->>DB: UPDATE instance.context: mayor_transmittal_date=NOW(), mayor_action_deadline=NOW()+10days
    WF->>DB: UPDATE step_instances[transmittal_letter_to_mayor] status=completed
    WF->>DB: INSERT step_instances[mayor_review] status=active
    WF->>OrgMod: resolveCurrentHolder(role=delegation_aware:mayor)
    OrgMod-->>WF: assignee resolved (Mayor or Acting Mayor)
    WF->>EventBus: emit workflow.step_assigned (Mayor)
    EventBus->>NotifMod: notify Mayor: legislative measure awaiting review

    %% ── MAYOR REVIEW — STANDARD SIGNED PATH ─────────────────────────────────
    Mayor->>Web: Reviews document; signs within 10 calendar days
    Web->>Server: tRPC submitStepAction(mayor_review, SIGNED)
    Server->>WF: engine.submitStepAction(...)
    WF->>IAMMod: evaluatePolicy(Mayor, complete_step, mayor_review)
    IAMMod-->>WF: allowed=true
    WF->>DB: UPDATE step_instances[mayor_review] status=completed, outcome=SIGNED
    WF->>DB: UPDATE instance.context: mayor_action=SIGNED, mayor_action_date=NOW()
    WF->>DB: INSERT step_instances[docketing] status=active
    WF->>EventBus: emit workflow.step_completed, workflow.step_assigned (SecStaff)
    EventBus->>AuditMod: audit Mayor signature

    %% ── DOCKETING ────────────────────────────────────────────────────────────
    SecStaff->>Web: Completes docketing — readies document for distribution
    Web->>Server: tRPC submitStepAction(docketing, DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: UPDATE step_instances[docketing] status=completed
    WF->>DB: INSERT step_instances[panlalawigan_transmission_logging] status=active
    WF->>EventBus: emit workflow.step_assigned (SecStaff)

    %% ── PANLALAWIGAN TRANSMISSION ────────────────────────────────────────────
    SecStaff->>Web: Logs transmission to Sangguniang Panlalawigan
    Web->>Server: tRPC submitStepAction(panlalawigan_transmission_logging, DONE)
    Server->>WF: engine.submitStepAction(...)
    Note over WF: triggers_panlalawigan_timer=true on this step config
    WF->>DB: UPDATE instance.context: panlalawigan_transmission_date=NOW(), panlalawigan_action_deadline=NOW()+30days
    WF->>DB: UPDATE step_instances[panlalawigan_transmission_logging] status=completed
    WF->>DB: INSERT step_instances[panlalawigan_review] status=active
    WF->>EventBus: emit workflow.step_assigned (SPSec)

    %% ── PANLALAWIGAN REVIEW — VALID ──────────────────────────────────────────
    Note over SPSec: Receives formal written Panlalawigan resolution (within 30 days)
    SPSec->>Web: Records Panlalawigan outcome: VALID; enters Panlalawigan resolution number
    Web->>Server: tRPC submitStepAction(panlalawigan_review, VALID, panlalawigan_resolution_number)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: UPDATE step_instances[panlalawigan_review] status=completed, outcome=VALID
    WF->>DB: UPDATE instance.context: panlalawigan_outcome=VALID, panlalawigan_response_date=NOW()
    WF->>DB: INSERT step_instances[portal_publication] status=active
    WF->>EventBus: emit workflow.step_assigned (SecStaff)

    %% ── PORTAL PUBLICATION ───────────────────────────────────────────────────
    SecStaff->>Web: Publishes to portal (title + first page visible publicly)
    Web->>Server: tRPC submitStepAction(portal_publication, DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>DocMod: transitionState(document_id, Released, SecStaff)
    DocMod->>DB: UPDATE documents.current_state = Released
    DocMod->>EventBus: emit document.state_changed(Released)
    WF->>DB: UPDATE step_instances[portal_publication] status=completed
    WF->>DB: INSERT step_instances[archive] status=active
    WF->>EventBus: emit workflow.step_assigned (RecordsOfficer)

    %% ── PERMANENT ARCHIVE ────────────────────────────────────────────────────
    RecordsOfficer->>Web: Archives document permanently
    Web->>Server: tRPC submitStepAction(archive, DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>DocMod: transitionState(document_id, Archived, RecordsOfficer)
    DocMod->>DB: UPDATE documents.current_state = Archived
    WF->>DB: UPDATE step_instances[archive] status=completed
    WF->>DB: INSERT step_instances[final_outcome_check] status=active (decision)
    WF->>WF: Evaluate JSONLogic: panlalawigan_outcome IN [VALID, DEEMED_APPROVED] → TRUE
    WF->>DB: UPDATE step_instances[final_outcome_check] status=completed, outcome=TRUE
    WF->>DB: INSERT step_instances[end_approved_and_released] status=active (termination)
    WF->>WF: Execute termination: outcome_code=APPROVED_AND_RELEASED
    WF->>DB: UPDATE workflow.instances status=completed, completed_at=NOW()
    WF->>EventBus: emit workflow.completed(APPROVED_AND_RELEASED)
    EventBus->>AuditMod: audit workflow completion
    Note over DB: SP Resolution lifecycle complete — permanent archive; no disposition authorized
```

---

## 2. SP Resolution — Certified Urgent Path

Covers: Mayor issues Certification of Urgency → Secretariat logs certification → committee referral step bypassed → First and Second Reading in same session.

The standard intake and post-Second Reading steps (final number assignment through archive) are identical to Diagram 1 and are omitted for brevity — this diagram shows only the divergent segment.

```mermaid
sequenceDiagram
    autonumber
    actor SecStaff
    actor SPSec
    actor Mayor
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant DocMod as Documents Module
    participant EventBus
    participant AuditMod as Audit Module
    participant DB

    Note over SecStaff,DB: Intake → Order of Business → First Reading complete (same as standard path)
    Note over DB: step_instances[committee_referral] status=active

    %% ── MAYOR ISSUES CERTIFICATION OF URGENCY ────────────────────────────────
    Note over Mayor: Mayor issues formal written Certification of Urgency document
    Note over Mayor: A single Certification can cover multiple measures in the same session

    SecStaff->>Web: Logs Certification of Urgency; selects associated measure(s)
    Web->>Server: tRPC logCertificationOfUrgency(certification_file, [document_id_1, document_id_2, ...])
    Server->>DocMod: createDocument(type=certification_of_urgency, file)
    Note over DocMod: Certification has NO standalone series number
    DocMod->>DB: INSERT documents (type=certification_of_urgency, no series number)
    DocMod->>DB: INSERT document_attachments linking certification to each associated measure
    DocMod->>EventBus: emit document.certification_urgency.logged(certification_document_id, [instance_ids])

    %% ── WORKFLOW ENGINE PROCESSES BYPASS ─────────────────────────────────────
    EventBus->>WF: consume document.certification_urgency.logged

    loop For each associated instance_id
        WF->>DB: SELECT instance WHERE id=instance_id; verify status=Running
        WF->>DB: UPDATE instance.context: certified_urgent=true, certified_urgent_document_id=certification_document_id

        alt committee_referral step is ACTIVE
            WF->>DB: UPDATE step_instances[committee_referral]
            Note over DB: status=Skipped, bypassed_at=NOW(), bypassed_by=NULL (system), bypass_reason=CERTIFIED_URGENT, outcome=BYPASSED_CERTIFIED_URGENT
            WF->>EventBus: emit workflow.step.bypassed(bypass_reason=CERTIFIED_URGENT, certification_document_id)
            WF->>WF: Run transition evaluation on outcome=BYPASSED_CERTIFIED_URGENT
            WF->>DB: INSERT step_instances[second_reading_vote] status=active
            WF->>EventBus: emit workflow.certification_urgency.bypass_applied
        else committee_referral step is PENDING (not yet activated)
            WF->>DB: INSERT pending_certified_urgent_bypasses(instance_id, step_key=committee_referral)
            WF->>EventBus: emit workflow.certification_urgency.bypass_deferred
            Note over WF: When committee_referral would normally activate, engine checks for pending bypass and executes Skipped path instead
        else committee_referral already COMPLETED or Skipped
            WF->>EventBus: emit workflow.certification_urgency.already_past_referral
            Note over WF: No workflow change; log at warning level
        end
    end

    EventBus->>AuditMod: consume workflow.step.bypassed (dedicated audit entry per bypass)

    %% ── SAME-SESSION SECOND READING ─────────────────────────────────────────
    Note over SPSec: Same Tuesday session — First Reading AND Second Reading occur
    SPSec->>Web: Records Second Reading vote: APPROVED (same session as First Reading)
    Web->>Server: tRPC submitStepAction(second_reading_vote, APPROVED)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: UPDATE step_instances[second_reading_vote] status=completed, outcome=APPROVED
    WF->>DB: INSERT step_instances[final_number_assignment] status=active
    WF->>EventBus: emit workflow.step_assigned

    Note over SPSec,DB: Final number assignment → VP certification → Transmittal → Mayor review → Docketing → Panlalawigan → Publication → Archive (identical to standard path Diagram 1 steps 22–48)
```

---

## 3. SP Resolution — Veto and Override Path

Covers: Mayor vetoes → SP override vote → two branches: Override Succeeds (→ Docketing) and Override Fails (→ terminal VETOED_OVERRIDE_FAILED).

This diagram starts after Transmittal Letter to Mayor is logged (timer already set) and covers only the veto divergence.

```mermaid
sequenceDiagram
    autonumber
    actor SPSec
    actor Mayor
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant DocMod as Documents Module
    participant NotifMod as Notifications Module
    participant AuditMod as Audit Module
    participant Scheduler
    participant EventBus
    participant DB

    Note over Mayor,DB: Transmittal letter sent; step_instances[mayor_review] active; 10-day timer running

    %% ── MAYOR VETOES ─────────────────────────────────────────────────────────
    Mayor->>Web: Reviews document; selects VETOED; enters mandatory veto reason
    Web->>Server: tRPC submitStepAction(mayor_review, VETOED, comment="[veto reason]")
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: UPDATE step_instances[mayor_review] status=completed, outcome=VETOED, outcome_comment=[reason]
    WF->>DB: UPDATE instance.context: mayor_action=VETOED, mayor_action_date=NOW()
    WF->>WF: Transition evaluation: outcome_filter=VETOED → veto_override_vote
    WF->>DB: INSERT step_instances[veto_override_vote] status=active
    WF->>EventBus: emit workflow.step_assigned (SPSec)
    EventBus->>NotifMod: notify SPSec: Mayor vetoed — override vote required
    EventBus->>AuditMod: audit veto action

    %% ── VETO OVERRIDE VOTE ───────────────────────────────────────────────────
    Note over SPSec: SP conducts override vote in session; threshold = 2/3 = 8 of 12 members

    SPSec->>Web: Records override vote count and outcome

    alt 8 or more of 12 SP members vote to override (OVERRIDE_SUCCEEDED)
        SPSec->>Web: Submits outcome=OVERRIDE_SUCCEEDED, vote_count=8 (or more)
        Web->>Server: tRPC submitStepAction(veto_override_vote, OVERRIDE_SUCCEEDED)
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: UPDATE instance.context: veto_override_vote_count=8, veto_override_outcome=OVERRIDE_SUCCEEDED
        WF->>DB: UPDATE step_instances[veto_override_vote] status=completed, outcome=OVERRIDE_SUCCEEDED
        WF->>WF: Transition: OVERRIDE_SUCCEEDED → docketing
        WF->>DB: INSERT step_instances[docketing] status=active
        WF->>EventBus: emit workflow.step_assigned (SecStaff)
        EventBus->>AuditMod: audit override success
        Note over DB: Workflow continues: Docketing → Panlalawigan → Publication → Archive (standard path)

    else Fewer than 8 vote to override (OVERRIDE_FAILED)
        SPSec->>Web: Submits outcome=OVERRIDE_FAILED, vote_count=[count]
        Web->>Server: tRPC submitStepAction(veto_override_vote, OVERRIDE_FAILED)
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: UPDATE instance.context: veto_override_outcome=OVERRIDE_FAILED
        WF->>DB: UPDATE step_instances[veto_override_vote] status=completed, outcome=OVERRIDE_FAILED
        WF->>WF: Transition: OVERRIDE_FAILED → end_vetoed_override_failed (termination)
        WF->>DB: INSERT step_instances[end_vetoed_override_failed] status=active
        WF->>WF: Execute termination: outcome_code=VETOED_OVERRIDE_FAILED
        WF->>DocMod: transitionState(document_id, Cancelled, system)
        DocMod->>DB: UPDATE documents.current_state = Cancelled
        WF->>DB: UPDATE workflow.instances status=completed
        WF->>EventBus: emit workflow.completed(VETOED_OVERRIDE_FAILED)
        EventBus->>AuditMod: audit workflow termination
        EventBus->>NotifMod: notify SPSec: override failed; document archived
    end

    %% ── MAYOR LAPSE VARIANT (shown here for completeness) ───────────────────
    Note over Scheduler: Alternatively — Mayor takes NO action within 10 calendar days
    
    rect rgb(240, 248, 255)
        Note over Scheduler: evaluateMayorLapseTimers() runs hourly
        Scheduler->>WF: engine.evaluateTimers()
        WF->>DB: SELECT active mayor_review step_instances WHERE NOW() > mayor_action_deadline AND outcome IS NULL
        WF->>DB: SELECT FOR UPDATE step_instances (pessimistic lock)
        
        alt Step outcome is still NULL (Mayor has not acted)
            WF->>DB: UPDATE step_instances[mayor_review] status=completed, outcome=LAPSED
            Note over DB: completed_at = mayor_action_deadline (not detection time)
            WF->>DB: UPDATE step_instances[mayor_review] outcome_comment="Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47."
            WF->>DB: UPDATE instance.context: mayor_action=LAPSED, mayor_action_date=mayor_action_deadline
            WF->>WF: Transition: LAPSED → docketing
            WF->>DB: INSERT step_instances[docketing] status=active
            WF->>EventBus: emit workflow.approval.lapsed(legal_basis="RA 7160 Section 47")
            EventBus->>NotifMod: notify SPSec: document lapsed into law
            EventBus->>AuditMod: audit lapse event
        else Mayor acted concurrently (race condition)
            Note over WF: outcome already set; RELEASE lock; skip this instance
        end
    end
```

---

## 4. SP Ordinance — Standard Path

Covers: Intake → First Reading → Committee referral → Second Reading with amendments → Third Reading → Final number → VP sign → Transmittal → Mayor signs → Docketing → Panlalawigan VALID → Publication check (penalty clause = YES) → Newspaper publication → Portal publication → Archive.

Steps shared with SP Resolution (intake, committee referral, VP certification, transmittal, Mayor review, docketing, Panlalawigan transmission) are condensed.

```mermaid
sequenceDiagram
    autonumber
    actor Councilor
    actor SecStaff
    actor SPSec
    actor ViceMayor
    actor Mayor
    actor RecordsOfficer
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant DocMod as Documents Module
    participant TrackMod as Tracking Module
    participant NotifMod as Notifications Module
    participant AuditMod as Audit Module
    participant EventBus
    participant S3
    participant DB

    %% ── INTAKE (condensed — identical to SP Resolution) ─────────────────────
    Councilor->>Web: Submits draft ordinance
    Web->>Server: tRPC createDocument(payload, file)
    Server->>DocMod: createDocument(type=sp_ordinance)
    DocMod->>DB: INSERT documents; QR UUID generated by TrackMod; preliminary "Draft 7SP YYYY-NN" assigned
    Note over DB: QR assigned first; preliminary number second
    WF->>DB: INSERT workflow.instances (pinned to sp_ordinance definition_version)
    WF->>DB: INSERT step_instances[intake_logging] status=active

    SecStaff->>Web: Completes intake form
    Web->>Server: tRPC submitStepAction(intake_logging, DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: step_instances[intake_logging] → completed; step_instances[order_of_business_scheduling] → active

    SPSec->>Web: Schedules on Order of Business
    Web->>Server: tRPC submitStepAction(order_of_business_scheduling, DONE)
    WF->>DB: → step_instances[first_reading] active

    %% ── FIRST READING ────────────────────────────────────────────────────────
    Note over SPSec,ViceMayor: Tuesday Session — First Reading
    SPSec->>Web: Records First Reading; VP refers to committee(s) (subject + Committee on Laws)
    Web->>Server: tRPC submitStepAction(first_reading, DONE, referred_committees=[subject_committee, committee_laws])
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: step_instances[first_reading] → completed; step_instances[committee_referral] → active
    Note over DB: Two committees assigned: subject-matter committee + Committee on Laws (standard practice)
    WF->>EventBus: emit workflow.step_assigned (both committee chairs)
    EventBus->>NotifMod: notify both committee chairs

    %% ── COMMITTEE REFERRAL (condensed — identical mechanism to SP Resolution) 
    Note over SPSec: Committees conduct joint hearing; both submit contributions before Thursday cutoff
    
    Note over SecStaff,SPSec: Both committees submit contributions; SP Secretary accepts unified report
    SPSec->>Web: Accepts unified committee report
    Web->>Server: tRPC acceptCommitteeReport(step_instance_id, report_file)
    Server->>WF: engine.submitStepAction(committee_referral, REPORT_ACCEPTED)
    WF->>DB: step_instances[committee_referral] → completed; step_instances[second_reading_vote] → active

    %% ── SECOND READING — WITH AMENDMENTS ────────────────────────────────────
    Note over SPSec,ViceMayor: Tuesday Session — Second Reading; debate; amendments raised
    SPSec->>Web: Records vote outcome: RETURNED_FOR_REVISION (amendments to be incorporated)
    Web->>Server: tRPC submitStepAction(second_reading_vote, RETURNED_FOR_REVISION)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: step_instances[second_reading_vote] → completed, outcome=RETURNED_FOR_REVISION
    WF->>WF: Transition: RETURNED_FOR_REVISION → amendments_logging
    WF->>DB: INSERT step_instances[amendments_logging] status=active
    WF->>EventBus: emit workflow.step_assigned (SecStaff)

    %% ── AMENDMENTS LOGGING ───────────────────────────────────────────────────
    SecStaff->>Web: Logs amendments; uploads amended final copy of ordinance
    Web->>Server: tRPC submitStepAction(amendments_logging, DONE, amended_file)
    Server->>S3: Store amended document
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: step_instances[amendments_logging] → completed
    WF->>WF: Transition: → third_reading_vote
    WF->>DB: INSERT step_instances[third_reading_vote] status=active
    WF->>EventBus: emit workflow.step_assigned (SPSec)

    %% ── THIRD READING VOTE ───────────────────────────────────────────────────
    Note over SPSec,ViceMayor: Tuesday Session — Third Reading; final amended version read; final vote
    SPSec->>Web: Records final vote outcome: APPROVED
    Web->>Server: tRPC submitStepAction(third_reading_vote, APPROVED)
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: step_instances[third_reading_vote] → completed, outcome=APPROVED
    WF->>WF: Transition: APPROVED → final_number_assignment
    WF->>DB: INSERT step_instances[final_number_assignment] status=active
    WF->>EventBus: emit workflow.step_assigned (SPSec)

    %% ── FINAL NUMBER ASSIGNMENT ──────────────────────────────────────────────
    Note over DB: For SP Ordinance: assigned AFTER Third Reading vote, BEFORE VP signs
    SPSec->>Web: Assigns final series number
    Web->>Server: tRPC submitStepAction(final_number_assignment, DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>DocMod: assignFinalNumber(document_id)
    DocMod->>DB: UPDATE document_numbers: final="7SP 2026-NN"
    WF->>DB: step_instances[final_number_assignment] → completed; step_instances[vp_certification] → active

    %% ── VP CERTIFICATION ─────────────────────────────────────────────────────
    ViceMayor->>Web: Signs certified copy
    Web->>Server: tRPC submitStepAction(vp_certification, SIGNED)
    WF->>DB: → step_instances[transmittal_letter_to_mayor] active

    %% ── TRANSMITTAL + MAYOR REVIEW (condensed) ───────────────────────────────
    SecStaff->>Web: Logs transmittal letter dispatch; 10-day timer starts
    Web->>Server: tRPC submitStepAction(transmittal_letter_to_mayor, DONE)
    WF->>DB: context.mayor_action_deadline = NOW()+10days; → step_instances[mayor_review] active

    Mayor->>Web: Signs within 10 calendar days
    Web->>Server: tRPC submitStepAction(mayor_review, SIGNED)
    WF->>DB: → step_instances[docketing] active

    %% ── DOCKETING + PANLALAWIGAN (condensed) ─────────────────────────────────
    SecStaff->>Web: Docketing complete
    Web->>Server: tRPC submitStepAction(docketing, DONE)
    WF->>DB: → step_instances[panlalawigan_transmission_logging] active

    SecStaff->>Web: Logs Panlalawigan transmission; 30-day timer starts
    Web->>Server: tRPC submitStepAction(panlalawigan_transmission_logging, DONE)
    WF->>DB: context.panlalawigan_action_deadline = NOW()+30days; → step_instances[panlalawigan_review] active

    %% ── PANLALAWIGAN REVIEW — VALID ──────────────────────────────────────────
    SPSec->>Web: Records Panlalawigan outcome: VALID
    Web->>Server: tRPC submitStepAction(panlalawigan_review, VALID)
    WF->>DB: step_instances[panlalawigan_review] → completed, outcome=VALID
    WF->>WF: Transition: VALID → publication_check (decision step)
    WF->>DB: INSERT step_instances[publication_check] status=active

    %% ── PUBLICATION CHECK ────────────────────────────────────────────────────
    WF->>WF: Evaluate JSONLogic: instance.context.requires_publication == true
    
    rect rgb(255, 240, 240)
        Note over WF: requires_publication=TRUE — ordinance has penalty clause
        WF->>DB: step_instances[publication_check] → completed, outcome=TRUE
        WF->>WF: Transition: TRUE → newspaper_publication
        WF->>DB: INSERT step_instances[newspaper_publication] status=active
        WF->>EventBus: emit workflow.step_assigned (SecStaff)

        SecStaff->>Web: Arranges newspaper publication with Ilocos Times; records publication date (mandatory field)
        Web->>Server: tRPC submitStepAction(newspaper_publication, DONE, publication_date, newspaper="Ilocos Times")
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: UPDATE instance.context: publication_date, publication_newspaper
        WF->>DB: step_instances[newspaper_publication] → completed
        WF->>WF: Transition: → portal_publication
        WF->>DB: INSERT step_instances[portal_publication] status=active
    end

    %% ── PORTAL PUBLICATION ───────────────────────────────────────────────────
    SecStaff->>Web: Publishes to portal
    Web->>Server: tRPC submitStepAction(portal_publication, DONE)
    Server->>WF: engine.submitStepAction(...)
    WF->>DocMod: transitionState(document_id, Released)
    DocMod->>DB: UPDATE documents.current_state = Released
    WF->>DB: step_instances[portal_publication] → completed; step_instances[archive] → active

    %% ── ARCHIVE + TERMINATION ────────────────────────────────────────────────
    RecordsOfficer->>Web: Archives document
    Web->>Server: tRPC submitStepAction(archive, DONE)
    WF->>DocMod: transitionState(document_id, Archived)
    WF->>DB: step_instances[archive] → completed; step_instances[final_outcome_check] → active (decision)
    WF->>WF: Evaluate: panlalawigan_outcome IN [VALID, DEEMED_APPROVED] → TRUE
    WF->>DB: step_instances[final_outcome_check] → completed, outcome=TRUE
    WF->>DB: step_instances[end_approved_and_released] → active (termination)
    WF->>WF: Execute termination: APPROVED_AND_RELEASED
    WF->>DB: workflow.instances status=completed
    WF->>EventBus: emit workflow.completed(APPROVED_AND_RELEASED)
    EventBus->>AuditMod: audit completion
```

---

## 5. SP Ordinance — Certified Urgent Path

The Certified Urgent mechanism is identical to SP Resolution (Diagram 2). The only difference is document type. Condensed diagram shows divergence only.

```mermaid
sequenceDiagram
    autonumber
    actor SecStaff
    actor SPSec
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant DocMod as Documents Module
    participant EventBus
    participant AuditMod as Audit Module
    participant DB

    Note over SecStaff,DB: SP Ordinance — Intake → Order of Business → First Reading complete
    Note over DB: step_instances[committee_referral] status=active (or pending)

    SecStaff->>Web: Logs Certification of Urgency (covers this ordinance + any others in same session)
    Web->>Server: tRPC logCertificationOfUrgency(file, [ordinance_document_id, ...])
    Server->>DocMod: createDocument(type=certification_of_urgency, no series number)
    DocMod->>DB: INSERT certification document; INSERT attachments linking to each ordinance
    DocMod->>EventBus: emit document.certification_urgency.logged([instance_ids])

    EventBus->>WF: consume document.certification_urgency.logged
    WF->>DB: UPDATE instance.context: certified_urgent=true
    WF->>DB: UPDATE step_instances[committee_referral]: status=Skipped, outcome=BYPASSED_CERTIFIED_URGENT
    WF->>DB: INSERT step_instances[second_reading_vote] status=active
    WF->>EventBus: emit workflow.step.bypassed, workflow.certification_urgency.bypass_applied
    EventBus->>AuditMod: dedicated audit entry for bypass

    Note over SPSec: Same session: First Reading AND Second Reading
    SPSec->>Web: Records Second Reading vote: RETURNED_FOR_REVISION (amendments exist)
    Web->>Server: tRPC submitStepAction(second_reading_vote, RETURNED_FOR_REVISION)
    WF->>DB: → step_instances[amendments_logging] active

    SecStaff->>Web: Logs amendments; uploads amended copy
    Web->>Server: tRPC submitStepAction(amendments_logging, DONE)
    WF->>DB: → step_instances[third_reading_vote] active

    Note over SPSec: Third Reading proceeds (may be next session or same if urgency continues)
    SPSec->>Web: Records Third Reading final vote: APPROVED
    Web->>Server: tRPC submitStepAction(third_reading_vote, APPROVED)
    WF->>DB: → step_instances[final_number_assignment] active

    Note over SPSec,DB: Final number → VP cert → Transmittal → Mayor → Docketing → Panlalawigan → Publication → Archive (standard path)
```

---

## 6. Appropriation Ordinance — Full Lifecycle

The Appropriation Ordinance workflow is identical to SP Ordinance with two differences:
1. No `publication_check` or `newspaper_publication` steps — `requires_publication` is always `false`
2. `panlalawigan_review` allows `OPERATIVE_IN_ITS_ENTIRETY` outcome (treated identically to VALID)

This diagram shows the Appropriation Ordinance-specific divergence at the Panlalawigan step.

```mermaid
sequenceDiagram
    autonumber
    actor SecStaff
    actor SPSec
    actor ViceMayor
    actor Mayor
    actor RecordsOfficer
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant DocMod as Documents Module
    participant AuditMod as Audit Module
    participant EventBus
    participant DB

    Note over SecStaff,DB: Appropriation Ordinance intake → First Reading → Committee referral → Second Reading → Third Reading → Final number → VP cert → Transmittal → Mayor signs → Docketing → Panlalawigan transmission (identical to SP Ordinance standard path)

    Note over DB: step_instances[panlalawigan_review] active; 30-day timer running

    SPSec->>Web: Receives Panlalawigan resolution; records outcome

    alt Panlalawigan returns OPERATIVE_IN_ITS_ENTIRETY (Appropriation Ordinance specific)
        SPSec->>Web: Selects outcome: OPERATIVE_IN_ITS_ENTIRETY; enters Panlalawigan resolution number
        Web->>Server: tRPC submitStepAction(panlalawigan_review, OPERATIVE_IN_ITS_ENTIRETY)
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: step_instances[panlalawigan_review] → completed, outcome=OPERATIVE_IN_ITS_ENTIRETY
        WF->>DB: UPDATE instance.context: panlalawigan_outcome=OPERATIVE_IN_ITS_ENTIRETY
        Note over WF: Treated identically to VALID — Appropriation Ordinance can be implemented
        WF->>WF: Transition: OPERATIVE_IN_ITS_ENTIRETY → portal_publication
        Note over WF: NO publication_check step for Appropriation Ordinances — skips directly to portal
        WF->>DB: INSERT step_instances[portal_publication] status=active
        WF->>EventBus: emit workflow.step_assigned (SecStaff)

    else Panlalawigan returns VALID (also valid for Appropriation Ordinances)
        SPSec->>Web: Selects outcome: VALID
        Web->>Server: tRPC submitStepAction(panlalawigan_review, VALID)
        WF->>DB: step_instances[panlalawigan_review] → completed, outcome=VALID
        WF->>WF: Transition: VALID → portal_publication (no publication_check)
        WF->>DB: INSERT step_instances[portal_publication] status=active
    end

    %% ── PORTAL PUBLICATION + ARCHIVE ─────────────────────────────────────────
    SecStaff->>Web: Publishes to portal
    Web->>Server: tRPC submitStepAction(portal_publication, DONE)
    WF->>DocMod: transitionState(document_id, Released)
    WF->>DB: step_instances[portal_publication] → completed; step_instances[archive] → active

    RecordsOfficer->>Web: Archives document
    Web->>Server: tRPC submitStepAction(archive, DONE)
    WF->>DocMod: transitionState(document_id, Archived)
    WF->>DB: step_instances[archive] → completed; step_instances[final_outcome_check] → active (decision)

    %% ── FINAL OUTCOME CHECK — Appropriation Ordinance extended condition ──────
    WF->>WF: Evaluate JSONLogic: panlalawigan_outcome IN [VALID, DEEMED_APPROVED, OPERATIVE_IN_ITS_ENTIRETY]
    Note over WF: OPERATIVE_IN_ITS_ENTIRETY included in TRUE branch — this is the key difference from SP Ordinance
    WF->>DB: step_instances[final_outcome_check] → completed, outcome=TRUE
    WF->>DB: step_instances[end_approved_and_released] → active (termination)
    WF->>WF: Execute termination: APPROVED_AND_RELEASED
    WF->>DB: workflow.instances status=completed
    WF->>EventBus: emit workflow.completed(APPROVED_AND_RELEASED)
    EventBus->>AuditMod: audit completion
```

---

## 7. Panlalawigan Review — All Four Outcome Paths

Four sub-diagrams for the four Panlalawigan outcomes. All start after `panlalawigan_review` step activation.

### 7A. VALID / DEEMED_APPROVED / OPERATIVE_IN_ITS_ENTIRETY (covered in Diagrams 1, 4, 6 above)

### 7B. VALID_IN_PART — All Four Resolution Paths

```mermaid
sequenceDiagram
    autonumber
    actor SPSec
    actor LegalOfficer
    actor CommitteeChair
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant DocMod as Documents Module
    participant AuditMod as Audit Module
    participant EventBus
    participant DB

    Note over SPSec,DB: step_instances[panlalawigan_review] active; formal written notification received from Panlalawigan

    SPSec->>Web: Records outcome: VALID_IN_PART; enters Panlalawigan resolution number; mandatory comment
    Web->>Server: tRPC submitStepAction(panlalawigan_review, VALID_IN_PART, comment="[specifics]")
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: step_instances[panlalawigan_review] → completed, outcome=VALID_IN_PART
    WF->>DB: UPDATE instance.context: panlalawigan_outcome=VALID_IN_PART
    WF->>DB: INSERT step_instances[valid_in_part_action] status=active
    WF->>EventBus: emit workflow.step_assigned (SPSec)

    SPSec->>Web: Documents context, initial notes; mandatory comment (not yet selecting path)
    Web->>Server: tRPC submitStepAction(valid_in_part_action, DONE, require_comment=true)
    WF->>DB: step_instances[valid_in_part_action] → completed
    WF->>DB: INSERT step_instances[valid_in_part_decision] status=active

    SPSec->>Web: Selects resolution path (four options presented as distinct buttons)

    alt Path 1: RESOLVED_IN_PLACE — Secretary resolves as-is
        SPSec->>Web: Selects RESOLVED_IN_PLACE; enters mandatory comment explaining resolution
        Web->>Server: tRPC submitStepAction(valid_in_part_decision, RESOLVED_IN_PLACE, comment)
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: step_instances[valid_in_part_decision] → completed, outcome=RESOLVED_IN_PLACE
        WF->>WF: Transition: RESOLVED_IN_PLACE → portal_publication (for Resolution) OR publication_check (for Ordinance)
        WF->>DB: INSERT next step
        EventBus->>AuditMod: audit resolution path choice + mandatory comment

    else Path 2: ROUTED_TO_LEGAL — Legal Office reviews
        SPSec->>Web: Selects ROUTED_TO_LEGAL
        Web->>Server: tRPC submitStepAction(valid_in_part_decision, ROUTED_TO_LEGAL)
        WF->>DB: step_instances[valid_in_part_decision] → completed, outcome=ROUTED_TO_LEGAL
        WF->>WF: Transition: ROUTED_TO_LEGAL → legal_office_review
        WF->>DB: INSERT step_instances[legal_office_review] status=active
        WF->>EventBus: emit workflow.step_assigned (LegalOfficer)
        EventBus->>AuditMod: audit routing to Legal

        Note over LegalOfficer: No Phase 1 SLA timer — step stays open until Legal Officer acts
        LegalOfficer->>Web: Reviews VALID_IN_PART provisions; logs recommendation with mandatory comment
        Web->>Server: tRPC submitStepAction(legal_office_review, RESOLVED_IN_PLACE, comment="[legal recommendation]")
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: step_instances[legal_office_review] → completed, outcome=RESOLVED_IN_PLACE
        WF->>WF: Transition: RESOLVED_IN_PLACE → portal_publication (or publication_check)
        WF->>DB: INSERT next step
        EventBus->>AuditMod: audit Legal Officer resolution

    else Path 3: ROUTED_TO_COMMITTEE — Committee reviews
        SPSec->>Web: Selects ROUTED_TO_COMMITTEE
        Web->>Server: tRPC submitStepAction(valid_in_part_decision, ROUTED_TO_COMMITTEE)
        WF->>DB: step_instances[valid_in_part_decision] → completed, outcome=ROUTED_TO_COMMITTEE
        WF->>WF: Transition: ROUTED_TO_COMMITTEE → committee_revisions_review
        WF->>DB: INSERT step_instances[committee_revisions_review] status=active
        Note over WF: Assignee resolved from instance context — Committee Chair of the referred committee
        WF->>EventBus: emit workflow.step_assigned (CommitteeChair)

        Note over CommitteeChair: No Phase 1 SLA timer — step stays open until Committee Chair acts
        CommitteeChair->>Web: Reviews provisions; logs recommendation with mandatory comment
        Web->>Server: tRPC submitStepAction(committee_revisions_review, RESOLVED_IN_PLACE, comment)
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: step_instances[committee_revisions_review] → completed, outcome=RESOLVED_IN_PLACE
        WF->>WF: Transition: → portal_publication (or publication_check)
        WF->>DB: INSERT next step
        EventBus->>AuditMod: audit Committee Chair resolution

    else Path 4: REVISED_DIRECTLY — Secretariat implements revisions directly
        SPSec->>Web: Selects REVISED_DIRECTLY; enters mandatory comment detailing revisions made
        Web->>Server: tRPC submitStepAction(valid_in_part_decision, REVISED_DIRECTLY, comment="[revision details]")
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: step_instances[valid_in_part_decision] → completed, outcome=REVISED_DIRECTLY
        WF->>WF: Transition: REVISED_DIRECTLY → portal_publication (or publication_check)
        WF->>DB: INSERT next step
        EventBus->>AuditMod: audit direct revision (mandatory comment stored)
    end

    Note over SPSec,DB: All four paths continue to portal_publication → archive → final_outcome_check → end_valid_in_part_resolved (termination)
```

### 7C. RETURNED — Repass or Resolve Directly

```mermaid
sequenceDiagram
    autonumber
    actor SPSec
    actor SecStaff
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant DocMod as Documents Module
    participant AuditMod as Audit Module
    participant EventBus
    participant DB

    Note over SPSec,DB: step_instances[panlalawigan_review] active; Panlalawigan RETURNED with objections

    SPSec->>Web: Records outcome: RETURNED; enters Panlalawigan resolution number; mandatory comment
    Web->>Server: tRPC submitStepAction(panlalawigan_review, RETURNED, comment="[objection specifics]")
    Server->>WF: engine.submitStepAction(...)
    WF->>DB: step_instances[panlalawigan_review] → completed, outcome=RETURNED
    WF->>DB: UPDATE instance.context: panlalawigan_outcome=RETURNED
    WF->>WF: Transition: RETURNED → returned_review
    WF->>DB: INSERT step_instances[returned_review] status=active, priority=high
    WF->>EventBus: emit workflow.step_assigned (SPSec) — high priority flag
    EventBus->>AuditMod: audit RETURNED outcome

    Note over SPSec: Implementation typically stopped at this point

    SPSec->>Web: Reviews Panlalawigan objections; decides path

    alt REPASS — document returned to drafting
        SPSec->>Web: Selects REPASS; enters mandatory comment (why repassing)
        Web->>Server: tRPC submitStepAction(returned_review, REPASS, comment)
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: step_instances[returned_review] → completed, outcome=REPASS
        WF->>WF: Transition: REPASS → end_repassed (termination)
        WF->>DB: INSERT step_instances[end_repassed] status=active
        WF->>WF: Execute REPASSED termination — special case: instance does NOT complete
        Note over WF: outcome_code=REPASSED: instance remains Running; emit workflow.instance.repassed
        WF->>EventBus: emit workflow.instance.repassed(instance_id, document_id)
        EventBus->>DocMod: consume workflow.instance.repassed
        DocMod->>DB: UPDATE original document: superseded_by=NEW_DOC_ID, closure_reason=REPASSED
        DocMod->>DB: INSERT new document (inherits content from original; new document_id; no series number yet)
        Note over DB: New document reuses original's final series number upon its own eventual approval (scoped exception to numbering-reuse invariant — D3-O-2 resolution)
        DocMod->>EventBus: emit document.created (new document)
        EventBus->>WF: consume document.created → creates new workflow instance for new document
        WF->>DB: INSERT workflow.instances (new instance pinned to current definition_version)
        Note over DB: Original instance remains Running indefinitely (by design — D3-O-7 resolution)
        EventBus->>AuditMod: audit repass; audit new instance creation

    else RESOLVED_DIRECTLY — Secretariat implements recommendations without repassing
        SPSec->>Web: Selects RESOLVED_DIRECTLY; enters mandatory comment detailing what was changed
        Web->>Server: tRPC submitStepAction(returned_review, RESOLVED_DIRECTLY, comment)
        Server->>WF: engine.submitStepAction(...)
        WF->>DB: step_instances[returned_review] → completed, outcome=RESOLVED_DIRECTLY
        WF->>WF: Transition: RESOLVED_DIRECTLY → portal_publication (or publication_check for Ordinance)
        WF->>DB: INSERT next step
        Note over SPSec,DB: Workflow continues to publication → archive → final_outcome_check → end_valid_in_part_resolved
        EventBus->>AuditMod: audit direct resolution (mandatory comment stored)
    end
```

### 7D. DEEMED_APPROVED — 30-Day Lapse

```mermaid
sequenceDiagram
    autonumber
    actor SPSec
    participant Web
    participant Server
    participant WF as Workflow Engine
    participant NotifMod as Notifications Module
    participant AuditMod as Audit Module
    participant Scheduler
    participant EventBus
    participant DB

    Note over SPSec,DB: step_instances[panlalawigan_review] active; panlalawigan_action_deadline approaching
    Note over DB: Panlalawigan has taken NO action; 30 calendar days elapsing

    Scheduler->>WF: engine.evaluateTimers() — evaluatePanlalawiganTimers() [runs daily at 06:00 PHT]
    WF->>DB: SELECT active panlalawigan_review steps WHERE NOW() > panlalawigan_action_deadline AND panlalawigan_outcome IS NULL
    WF->>DB: SELECT FOR UPDATE step_instances (pessimistic lock)

    alt panlalawigan_outcome still NULL (no action received)
        WF->>DB: UPDATE step_instances[panlalawigan_review] status=completed, outcome=DEEMED_APPROVED
        Note over DB: completed_at = panlalawigan_action_deadline (not scheduler detection time)
        WF->>DB: UPDATE step_instances.outcome_comment = "Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan."
        WF->>DB: UPDATE instance.context: panlalawigan_outcome=DEEMED_APPROVED, panlalawigan_response_date=panlalawigan_action_deadline
        WF->>WF: Transition: DEEMED_APPROVED → portal_publication (Resolution) OR publication_check (Ordinance)
        WF->>DB: INSERT next step
        WF->>EventBus: emit workflow.panlalawigan.deemed_approved(legal_basis="RA 7160 Section 56(d)")
        EventBus->>NotifMod: notify SPSec: document deemed approved; Panlalawigan did not act within 30 days
        EventBus->>AuditMod: audit deemed approval with legal basis
        Note over SPSec: SP Secretary records "Lapsed 30 days" remark in Panlalawigan log
        Note over SPSec,DB: Workflow continues: publication → archive → final_outcome_check → TRUE branch → end_approved_and_released
    else Panlalawigan acted concurrently (race condition)
        Note over WF: panlalawigan_outcome already set; RELEASE lock; skip
    end
```

---

## 8. Citizen Complaint — Full Lifecycle

Covers: Submission (all three access modes) → Secretariat logging → Committee routing → Committee report → Complainant notification → Respondent notification (email and phone variants) → Resolution.

```mermaid
sequenceDiagram
    autonumber
    actor Citizen
    actor Clerk
    actor SecStaff
    actor SPSec
    actor CommitteeChair
    participant Web
    participant Server
    participant DocMod as Documents Module
    participant NotifMod as Notifications Module
    participant AuditMod as Audit Module
    participant EventBus
    participant S3
    participant DB

    %% ── ACCESS MODE SELECTION ────────────────────────────────────────────────
    Note over Citizen,DB: Three access modes for complaint submission

    alt Mode 1: Citizen downloads template from sp.batac.gov.ph; submits physical signed form
        Note over Citizen: Downloads form; fills manually; submits at Secretariat with wet-ink signature
        Clerk->>Web: Receives physical form; enters data into system on citizen's behalf
        Web->>Server: tRPC createComplaint(mode=PHYSICAL_SUBMISSION, fields...)
        Server->>DB: INSERT complaints (submission_mode=physical, status=Pending_Hearing)
        Note over Clerk: System generates formatted record; no printed copy required here (already signed)
        Server-->>Clerk: complaint_id, control number

    else Mode 2: Citizen fills digital form → prints → signs → submits
        Citizen->>Web: Accesses digital complaint form (public portal)
        Web->>Server: REST POST /portal/complaints/draft (fields)
        Server->>DB: INSERT complaint_drafts (incomplete; no control number yet)
        Server-->>Web: draft_id
        Web-->>Citizen: Printable formatted complaint form (PDF)
        Note over Citizen: Citizen prints form; signs with wet-ink; submits physical signed copy at Secretariat
        Clerk->>Web: Confirms physical receipt; links draft to submission
        Web->>Server: tRPC confirmPhysicalComplaintSubmission(draft_id)
        Server->>DB: UPDATE complaints: status=Pending_Hearing; assign control number
        Server-->>Clerk: complaint_id confirmed

    else Mode 3: In-person clerk-assisted
        Citizen->>Clerk: Appears in person at Secretariat
        Clerk->>Web: Enters complaint fields into system while citizen is present
        Web->>Server: tRPC createComplaint(mode=IN_PERSON, fields...)
        Server->>DB: INSERT complaints (status=Pending_Hearing)
        Server-->>Web: Printable formatted complaint form
        Web-->>Clerk: Prints form on-site
        Clerk->>Citizen: Citizen signs printed form on the spot
        Note over Clerk,Citizen: Physical wet-ink signature captured; complaint officially logged
    end

    %% ── SECRETARIAT ROUTING ──────────────────────────────────────────────────
    Note over SecStaff: Secretariat receives logged complaint; decides routing (no fixed rule)
    SecStaff->>Web: Reviews complaint; routes to appropriate committee
    Web->>Server: tRPC routeComplaint(complaint_id, committee_id, routing_decision)
    Server->>DB: UPDATE complaints: routed_to_committee=committee_id, status=Received_Seen
    Server->>EventBus: emit complaint.routed
    EventBus->>NotifMod: notify committee: complaint assigned for review
    EventBus->>AuditMod: audit routing decision

    %% ── VICE MAYOR REVIEW (if applicable) ───────────────────────────────────
    rect rgb(240, 248, 255)
        Note over SecStaff: If Secretariat determines VP review is warranted (case-by-case)
        SecStaff->>Web: Routes to Vice Mayor for review/routing instructions
        Web->>Server: tRPC routeComplaintToViceMayor(complaint_id)
        Server->>DB: UPDATE complaints: routed_to_vm=true, status=Received_Seen
        Note over SecStaff: After VM adds routing notes; Secretariat acts on instructions
    end

    %% ── COMMITTEE REVIEW ─────────────────────────────────────────────────────
    CommitteeChair->>Web: Reviews complaint; conducts hearing if needed
    Note over CommitteeChair: For transportation complaints: Committee on Transportation + Committee on Laws co-referred
    CommitteeChair->>Web: Submits committee report with findings and recommendation
    Web->>Server: tRPC submitComplaintCommitteeReport(complaint_id, report_file, recommendation)
    Server->>S3: Store committee report
    Server->>DB: UPDATE complaints: committee_report_id=report_doc_id
    Server->>EventBus: emit complaint.committee_report_submitted

    %% ── SECRETARIAT LOGS REPORT ──────────────────────────────────────────────
    SecStaff->>Web: Receives and logs committee report
    Web->>Server: tRPC logComplaintReport(complaint_id, report_id)
    Server->>DB: UPDATE complaints: report_logged_at=NOW()
    EventBus->>AuditMod: audit report logging

    %% ── COMPLAINANT NOTIFICATION ─────────────────────────────────────────────
    SecStaff->>Web: Sends committee report to complainant; marks complaint as resolved
    Web->>Server: tRPC resolveComplaint(complaint_id, resolution_summary)
    Server->>DB: UPDATE complaints: status=Resolved, resolved_at=NOW()

    rect rgb(240, 255, 240)
        Server->>NotifMod: sendNotification(recipientEmail=citizen.email, template=complaint_resolved)
        Note over NotifMod: Complainant notified via contact number (primary channel)
    end

    %% ── RESPONDENT NOTIFICATION ──────────────────────────────────────────────
    Note over SecStaff: Respondent (e.g. tricycle operator) must also be formally notified

    alt Respondent has an email address on file
        Server->>NotifMod: sendNotification(recipientEmail=respondent.email, template=respondent_notice)
        Note over NotifMod: Formal written notice AND notification sent by email
        NotifMod->>DB: INSERT delivery_log (channel=email, recipient=respondent)
    else Respondent has only a contact number
        Server->>NotifMod: sendNotification(recipientPhone=respondent.phone, channel=phone_call)
        Note over NotifMod: Notification sent via phone/SMS; formal written notice must be claimed in person at LGU
        NotifMod->>DB: INSERT delivery_log (channel=phone, recipient=respondent, pickup_required=true)
        Note over SecStaff: Respondent must come in person to claim formal written notice
    end

    Server-->>Web: Complaint resolved
    Web-->>SecStaff: Status updated to Resolved; notifications dispatched
    EventBus->>AuditMod: audit complaint resolution + notification dispatch
```

---

## 9. Designation Grant and Auto-Expiry

Covers: Original authority issues Designation document → Secretariat logs → Immediate delegation effect → Active step re-routing → Auto-expiry at end date → Authority restoration.

```mermaid
sequenceDiagram
    autonumber
    actor OriginalAuthority as Mayor or Vice Mayor
    actor SecStaff
    participant Web
    participant Server
    participant OrgMod as Organization Module
    participant WF as Workflow Engine
    participant NotifMod as Notifications Module
    participant AuditMod as Audit Module
    participant Scheduler
    participant EventBus
    participant DB

    %% ── DESIGNATION DOCUMENT ISSUED ─────────────────────────────────────────
    Note over OriginalAuthority: Mayor or Vice Mayor issues formal written Designation document
    Note over OriginalAuthority: Example: Vice Mayor designated as Acting Mayor during Mayor's travel

    SecStaff->>Web: Logs Designation document (D YYYY-NN); uploads file; enters scope and time bounds
    Web->>Server: tRPC logDesignation(designation_file, delegating_user_id, delegated_to_user_id, scope, valid_from, valid_until)
    Server->>OrgMod: createDelegation(...)
    OrgMod->>DB: CHECK partial unique index: no active delegation_grant for delegated_to_user_id
    Note over DB: One active designation per person enforced — DB partial unique index on active delegation_grants per user

    alt User already has an active designation (constraint violation)
        OrgMod-->>Server: Error: ACTIVE_DELEGATION_EXISTS
        Server-->>Web: 409 Conflict — user already holds an active designation
        Web-->>SecStaff: Error displayed; must revoke existing designation first
    else No active designation — proceed
        OrgMod->>DB: INSERT delegation_grants (status=active, effective_immediately=true)
        Note over DB: Designation takes IMMEDIATE effect — no Platform Admin confirmation required
        OrgMod->>DB: INSERT document_numbers (D YYYY-NN assigned to designation document)
        OrgMod->>EventBus: emit delegation.granted(delegationId, delegatingUserId, delegatedToUserId, scope, validFrom, validUntil)
        EventBus->>AuditMod: audit delegation grant (actor, designated person, time period, scope, legal basis)

        %% ── IMMEDIATE STEP RE-ROUTING ─────────────────────────────────────────
        EventBus->>WF: consume delegation.granted
        WF->>DB: SELECT active step_instances WHERE assigned_to contains delegatingUserId AND step_type IN [action, approval, multi_referral]
        
        loop For each active step assigned to the original authority
            WF->>OrgMod: resolveCurrentHolder(positionId) — re-resolves accounting for new delegation
            OrgMod-->>WF: assignee = delegatedToUserId (designated person)
            WF->>DB: UPDATE step_instances.assigned_to → delegatedToUserId
            WF->>EventBus: emit workflow.step_assigned (delegatedToUserId)
            EventBus->>NotifMod: notify designated person: workflow step now assigned to you
        end

        Server-->>Web: Designation logged; delegation active
        Web-->>SecStaff: Success — delegation effective immediately
    end

    %% ── DURING DELEGATION PERIOD ─────────────────────────────────────────────
    Note over OriginalAuthority,WF: During delegation: all new step activations resolve to designated person
    Note over WF: resolveCurrentHolder(role=delegation_aware:mayor) → checks delegation_grants → returns designated person

    %% ── OPTIONAL: EARLY REVOCATION ───────────────────────────────────────────
    rect rgb(255, 248, 220)
        Note over OriginalAuthority: If delegating authority revokes early (before valid_until)
        SecStaff->>Web: Logs early revocation of designation
        Web->>Server: tRPC revokeDelegation(delegation_id, revocation_reason)
        Server->>OrgMod: revokeDelegation(...)
        OrgMod->>DB: UPDATE delegation_grants: status=revoked, revoked_at=NOW()
        OrgMod->>EventBus: emit delegation.revoked(delegationId, revokedAt)
        EventBus->>WF: consume delegation.revoked — re-routes active steps back to original authority
        EventBus->>AuditMod: audit revocation
    end

    %% ── AUTO-EXPIRY AT END DATE ──────────────────────────────────────────────
    Note over Scheduler: pgboss job fires at valid_until timestamp
    Scheduler->>OrgMod: processExpiredDelegations()
    OrgMod->>DB: UPDATE delegation_grants: status=expired, expired_at=valid_until WHERE valid_until <= NOW() AND status=active
    OrgMod->>EventBus: emit delegation.expired(delegationId, delegatingUserId, delegatedToUserId, expiredAt)

    %% ── ROUTING RESTORED TO ORIGINAL AUTHORITY ──────────────────────────────
    EventBus->>WF: consume delegation.expired
    WF->>DB: SELECT active step_instances WHERE assigned_to contains delegatedToUserId
    
    loop For each active step still assigned to the designated person
        WF->>OrgMod: resolveCurrentHolder(positionId) — re-resolves; delegation gone; returns original authority
        OrgMod-->>WF: assignee = delegatingUserId (original authority restored)
        WF->>DB: UPDATE step_instances.assigned_to → delegatingUserId
        WF->>EventBus: emit workflow.step_assigned (delegatingUserId)
        EventBus->>NotifMod: notify original authority: workflow steps returned to you
    end

    EventBus->>AuditMod: audit delegation expiry + step re-routing
    Note over OriginalAuthority: Authority fully restored; no further action required
```

---

## 10. QR Code Assignment and Scan-to-Lookup

Covers: Document creation triggers QR assignment → QR code stored → Physical document printed with cover sheet → Field staff scans QR → Public lookup result displayed.

```mermaid
sequenceDiagram
    autonumber
    actor SecStaff
    actor FieldUser as Field Staff or Citizen
    participant Web
    participant Server
    participant DocMod as Documents Module
    participant TrackMod as Tracking Module
    participant EventBus
    participant S3
    participant DB
    participant PublicPortal as Public Portal (REST)

    %% ── QR ASSIGNMENT ON DOCUMENT CREATION ───────────────────────────────────
    Note over SecStaff: Secretariat logs any new document (SP Resolution, Letter, Memo, etc.)
    SecStaff->>Web: Creates document; uploads file
    Web->>Server: tRPC createDocument(payload, file)
    Server->>S3: Stream file upload; store at UUID key
    Server->>DocMod: createDocument(metadata, storageKey)
    DocMod->>DB: INSERT documents
    DocMod->>EventBus: emit document.created(document_id)

    %% ── TRACKING MODULE ASSIGNS QR ───────────────────────────────────────────
    EventBus->>TrackMod: consume document.created
    TrackMod->>DB: Generate tracking UUID (immutable for document lifetime)
    TrackMod->>DB: INSERT tracking_records(tracking_id=UUID, document_id)
    TrackMod->>Server: Generate QR code image containing tracking_id only (not a URL; not document content)
    Server->>S3: Store QR code PNG at UUID storage key
    TrackMod->>DB: INSERT qr_codes(tracking_id, s3_key)
    Note over DB: QR tracking number assigned FIRST — before preliminary series number
    Note over DB: QR tracking number: immutable, independent of preliminary and final series numbers

    %% ── PRELIMINARY NUMBER ASSIGNED AFTER QR ────────────────────────────────
    Note over DocMod: On intake_logging step completion → preliminary "Draft 7SP YYYY-NN" assigned
    DocMod->>DB: INSERT document_numbers(preliminary="Draft 7SP 2026-NN")
    Note over DB: Assignment sequence confirmed: QR → Preliminary number → (later) Final number

    %% ── COVER SHEET / QR COVER PAGE GENERATION ─────────────────────────────
    Note over SecStaff: When Secretariat needs to print cover sheet for a document
    SecStaff->>Web: Requests print cover sheet for document
    Web->>Server: tRPC generateCoverSheet(document_id)
    Server->>DocMod: getDocumentById(document_id)
    DocMod-->>Server: DocumentSummary (includes preliminary/final number)
    Server->>TrackMod: getTrackingRecordForDocument(document_id)
    TrackMod-->>Server: TrackingRecordSummary (tracking_id, qr_code_s3_key)
    Server->>S3: GET QR code image (presigned URL or direct fetch)
    S3-->>Server: QR code PNG
    Server->>Server: Compose cover sheet (3 fields only): QR Code image, Tracking Number, Series Number
    Note over Server: Cover sheet is compact — does not need full A4 page; multiple cover sheets can fit on one paper (configurable to save paper)
    Server-->>Web: Cover sheet PDF (rendered, ready to print)
    Web-->>SecStaff: Print dialog presented

    %% ── PHYSICAL DOCUMENT WITH QR ATTACHED ──────────────────────────────────
    Note over SecStaff: Physical document printed with QR cover sheet attached
    Note over SecStaff: Document enters physical routing workflow (hand-carried, mailed, etc.)

    %% ── QR SCAN — LOOKUP FLOW ────────────────────────────────────────────────
    Note over FieldUser: Field staff or citizen scans QR code using phone camera or dedicated scanner
    FieldUser->>PublicPortal: GET /track/{tracking_id} (scanned from QR code)
    PublicPortal->>Server: REST GET /api/public/track/{tracking_id}
    Server->>TrackMod: getTrackingRecordForDocument via tracking_id
    TrackMod->>DB: SELECT tracking_records WHERE tracking_id=UUID
    TrackMod-->>Server: tracking_record (document_id, document_type, current state)
    Server->>DocMod: getDocumentById(document_id)
    DocMod-->>Server: DocumentSummary (type, title, current_state, series_number)
    Server->>TrackMod: getRoutingHistory(document_id)
    TrackMod->>DB: SELECT routing_entries WHERE tracking_id ORDER BY timestamp
    TrackMod-->>Server: routing history (full movement trail from draft)
    Server->>S3: GET presigned URL for page 1 of document only
    S3-->>Server: Page 1 presigned URL

    Server-->>PublicPortal: Scan result payload:
    Note over Server: Scan result shows: document type, remarks/current status, full routing history from draft, first page only (other pages blurred), "Get a copy" button
    PublicPortal-->>FieldUser: Scan result displayed in browser

    %% ── "GET A COPY" FLOW (from scan result) ────────────────────────────────
    FieldUser->>PublicPortal: Taps "Get a copy"
    PublicPortal-->>FieldUser: Redirected to Document Request Form (three access modes — see Diagram 11)
```

---

## 11. Document Request Form — All Three Access Modes

Covers: Fee-based request for full copy of SP document. Approval requires both Vice Mayor AND SP Secretary. Three access modes for submission.

```mermaid
sequenceDiagram
    autonumber
    actor Citizen
    actor Clerk
    actor ViceMayor
    actor SPSec
    actor SecStaff
    participant Web
    participant Server
    participant DB
    participant S3
    participant NotifMod as Notifications Module
    participant AuditMod as Audit Module

    %% ── ACCESS MODE 1: Download template → fill manually → submit physical ──
    rect rgb(240, 248, 255)
        Note over Citizen: Mode 1 — Citizen downloads form from sp.batac.gov.ph
        Citizen->>Web: Downloads blank Document Request Form template (sp.batac.gov.ph)
        Note over Citizen: Fills form by hand; includes: document type, title, page count, name, agency, date, email, ID presented, purpose
        Note over Citizen: Signs with wet-ink signature; submits physical form at Secretariat
        Clerk->>Web: Receives physical form; enters data into system
        Web->>Server: tRPC createDocumentRequest(mode=PHYSICAL_SUBMISSION, fields, citizen_contact)
        Server->>DB: INSERT document_requests (status=Pending, submission_mode=physical)
        Server-->>Clerk: request_id; control number assigned
    end

    %% ── ACCESS MODE 2: Fill digital form → print → sign → submit ────────────
    rect rgb(240, 255, 240)
        Note over Citizen: Mode 2 — Citizen fills digital form online
        Citizen->>Web: Fills Document Request Form on portal
        Web->>Server: REST POST /portal/document-requests/draft
        Server->>DB: INSERT document_request_drafts (incomplete)
        Server-->>Web: Formatted printable PDF of the request form
        Web-->>Citizen: PDF download (formatted with QR reference to sp.batac.gov.ph)
        Note over Citizen: Citizen prints form; signs with wet-ink; submits physical signed copy at Secretariat
        Clerk->>Web: Confirms physical receipt; links draft to confirmed submission
        Web->>Server: tRPC confirmDocumentRequestSubmission(draft_id)
        Server->>DB: UPDATE document_requests: status=Pending; assign control number
    end

    %% ── ACCESS MODE 3: In-person clerk-assisted ──────────────────────────────
    rect rgb(255, 248, 220)
        Note over Citizen: Mode 3 — Citizen visits Secretariat in person
        Citizen->>Clerk: Appears in person
        Clerk->>Web: Enters all form fields into digital form while citizen waits
        Web->>Server: tRPC createDocumentRequest(mode=IN_PERSON, fields)
        Server->>DB: INSERT document_requests (status=Pending)
        Server-->>Web: Formatted printable form PDF
        Web-->>Clerk: Prints form on-site
        Clerk->>Citizen: Citizen signs printed form on the spot
        Note over Clerk,Citizen: Physical wet-ink signature captured
    end

    %% ── REVIEW AND APPROVAL (common to all three modes) ─────────────────────
    Note over ViceMayor,SPSec: Approval requires BOTH Vice Mayor AND SP Secretary signatures
    Note over SecStaff: Secretariat routes request for review

    SecStaff->>Web: Forwards request for Vice Mayor review
    Web->>Server: tRPC routeDocumentRequest(request_id, to=VICE_MAYOR)
    Server->>DB: UPDATE document_requests: routed_to_vm=true

    ViceMayor->>Web: Reviews request; approves or rejects
    Web->>Server: tRPC reviewDocumentRequest(request_id, decision=APPROVED, reviewer=VICE_MAYOR)
    Server->>DB: UPDATE document_requests: vm_approved=true, vm_approved_at=NOW()

    SPSec->>Web: Reviews request; approves or rejects
    Web->>Server: tRPC reviewDocumentRequest(request_id, decision=APPROVED, reviewer=SP_SECRETARY)
    Server->>DB: UPDATE document_requests: sp_sec_approved=true, sp_sec_approved_at=NOW()
    Note over DB: Both signatures recorded — approval complete

    %% ── PAYMENT NOTIFICATION ─────────────────────────────────────────────────
    Server->>NotifMod: sendNotification(recipientPhone=citizen.phone, template=request_approved_pay_to_claim)
    Note over NotifMod: Citizen notified via contact number (primary channel) that request is approved
    Note over NotifMod: Payment is required before copy is released (fee per Ordinance No. 3SP 2014-05)
    Note over Server: Payment system deferred to later phases — recorded manually for now (OR number, collecting officer)

    %% ── PAYMENT AND DOCUMENT RELEASE ─────────────────────────────────────────
    Citizen->>Clerk: Comes in person; pays Secretary's Fee; presents OR
    Clerk->>Web: Records payment (OR number, collecting officer, date paid)
    Web->>Server: tRPC recordDocumentRequestPayment(request_id, or_number, amount)
    Server->>DB: UPDATE document_requests: payment_recorded=true, or_number, paid_at=NOW()

    Clerk->>Web: Releases document copy to citizen
    Web->>Server: tRPC releaseDocumentCopy(request_id)
    Server->>S3: Generate presigned URL for full document (all pages — not blurred)
    S3-->>Server: Full document presigned URL (time-limited)
    Server->>DB: UPDATE document_requests: status=Released, released_at=NOW()
    Server-->>Web: Full document access
    Web-->>Clerk: Prints or provides digital copy to citizen

    Server->>AuditMod: writeEvent(type=document_request_released, actor=Clerk, request_id)
```

---

## 12. Control Number Deferred Assignment Flow

Covers: Letters Received (SPR) or other documents where the control number is not assigned immediately at receipt — common pattern where `SPR-2026-` is logged with no sequence number, then numbered after Vice Mayor review.

```mermaid
sequenceDiagram
    autonumber
    actor SecStaff
    actor ViceMayor
    participant Web
    participant Server
    participant DocMod as Documents Module
    participant TrackMod as Tracking Module
    participant AuditMod as Audit Module
    participant EventBus
    participant DB

    %% ── RECEIPT WITHOUT IMMEDIATE CONTROL NUMBER ─────────────────────────────
    Note over SecStaff: A letter arrives addressed to the Vice Mayor (or SP Office)
    Note over SecStaff: ~38 letters per month; not all control numbers assigned at receipt (confirmed from scanned logs)

    SecStaff->>Web: Logs incoming letter; enters available fields (sender, date received, subject)
    Web->>Server: tRPC createIncomingLetter(fields, file_upload)
    Server->>DocMod: createDocument(type=letters_received, control_number=NULL)
    DocMod->>DB: INSERT documents (status=Submitted, control_number=NULL)
    Note over DB: Control number is nullable — deferred assignment is valid initial state
    DocMod->>DB: INSERT document_numbers (series_type=SPR, year=2026, sequence_number=NULL)
    Note over DB: Entry exists: "SPR-2026-" with no sequence filled — consistent with scanned log evidence
    DocMod->>EventBus: emit document.created

    %% ── QR STILL ASSIGNED IMMEDIATELY ───────────────────────────────────────
    EventBus->>TrackMod: consume document.created
    TrackMod->>DB: INSERT tracking_records (tracking_id=UUID) — QR still assigned even without control number
    Note over DB: QR tracking begins regardless of control number assignment status
    TrackMod->>DB: INSERT routing_entries(action=received, actor=SecStaff, timestamp=NOW())

    Server-->>Web: Document created; pending control number assignment; pending VM routing
    Web-->>SecStaff: Letter logged; no control number yet

    %% ── VICE MAYOR REVIEW ────────────────────────────────────────────────────
    Note over SecStaff: Almost all letters go to Vice Mayor — addressed to him or his office
    SecStaff->>Web: Routes letter to Vice Mayor; attaches physical document
    Web->>Server: tRPC routeLetterToViceMayor(document_id)
    Server->>DB: UPDATE documents: routed_to_vm=true, routed_at=NOW()
    Server->>DB: INSERT routing_entries(action=routed_to_vm, actor=SecStaff)

    ViceMayor->>Web: Reviews letter; adds routing instructions / notes
    Web->>Server: tRPC addViceMayorRoutingNotes(document_id, notes, routing_instructions)
    Server->>DB: UPDATE documents: vm_notes=notes, vm_reviewed_at=NOW()
    Server->>DB: INSERT routing_entries(action=vm_reviewed, actor=ViceMayor, notes)

    %% ── CONTROL NUMBER ASSIGNED AFTER VM REVIEW ──────────────────────────────
    Note over SecStaff: After VM returns letter with routing instructions — now assign control number
    SecStaff->>Web: Assigns sequential control number to the letter
    Web->>Server: tRPC assignControlNumber(document_id)
    Server->>DocMod: assignControlNumber(document_id, actor_id)
    DocMod->>DB: SELECT next available sequence from SPR YYYY counter
    DocMod->>DB: UPDATE document_numbers: sequence_number=NN
    Note over DB: Final control number: "SPR 2026-NN" (space delimiter confirmed)
    Note over DB: Control numbers are IMMUTABLE once assigned — no editing; mistake requires delete + re-create
    DocMod->>EventBus: emit document.number_assigned(type=control, value="SPR 2026-NN")
    EventBus->>AuditMod: audit control number assignment (actor, timestamp, assigned value)

    Server-->>Web: Control number assigned: "SPR 2026-NN"
    Web-->>SecStaff: Letter now has control number; routing can proceed

    %% ── SUBSEQUENT ROUTING ───────────────────────────────────────────────────
    SecStaff->>Web: Takes action per VM routing instructions (route to committee, file, respond, etc.)
    Web->>Server: tRPC updateLetterAction(document_id, action_taken)
    Server->>DB: UPDATE documents: action_taken, actioned_at=NOW()
    Server->>DB: INSERT routing_entries(action=actioned, actor=SecStaff, action_detail)

    %% ── CONTROL NUMBER MISTAKE CORRECTION ────────────────────────────────────
    rect rgb(255, 240, 240)
        Note over SecStaff: If control number was assigned with an error
        SecStaff->>Web: Reports control number mistake; requests correction
        Web->>Server: tRPC deleteDocumentRecord(document_id, reason="control_number_error")
        Note over Server: The ENTIRE RECORD is soft-deleted — control number cannot be edited in place
        Server->>DocMod: cancelDocument(document_id, reason="CONTROL_NUMBER_ERROR")
        DocMod->>DB: UPDATE documents: deleted_at=NOW(), deletion_reason=CONTROL_NUMBER_ERROR
        Note over DB: Original sequence number gap: logged as gap with cancellation reason; never reused
        EventBus->>AuditMod: audit cancellation with gap reason

        SecStaff->>Web: Creates new document record with corrected information
        Web->>Server: tRPC createIncomingLetter(corrected_fields)
        Server->>DocMod: createDocument(...) — new document_id; new sequence number from SPR counter
        Note over DB: New sequence number is one higher; the cancelled number is permanently retired
    end
```
