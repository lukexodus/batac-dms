# N1 — Notification Event and Template Catalog

**Platform:** Batac City LGU Platform
**Status:** Pre-Development Baseline | June 2026
**Audience:** Development team — `notifications` module implementation reference
**Source Documents:**
- `b3-internal-domain-event-catalog.md` (B3) — canonical domain event catalog
- `consolidated-architecture-and-requirements-reference-iteration-3.md` — requirements and architecture reference
- `i2-role-permission-matrix.md` (I2) — role-based notification permissions
- `h1-workflow-definitions-structured-data.md` (H1) — workflow step type contracts
- `tech-stack.md` — delivery infrastructure

---

> **Notation used throughout this document:**
>
> `[Confirmed]` — explicitly stated in one or more source documents.
>
> `[Inference]` — logically required from the architecture or module responsibilities but not explicitly stated.
>
> `[B3 Gap]` — a notification requirement found in the consolidated reference or role-permission matrix that is not currently registered in B3 as a domain event with a `notifications` consumer. Each gap requires a follow-up action documented in Section 8.


## Table of Contents

- [L60–L69] 1. Introduction — Overview of the notifications module role, core Phase 1 requirements, event-driven architecture, and catalog organization.
- [L70–L115] 2. Purpose and Scope — Implementation goals, delivery channels by phase, out-of-scope details, and owned PostgreSQL schemas/tables.
- [L116–L147] 3. Delivery Infrastructure — Technical stack for Server-Sent Events (SSE), email exceptions, SMS timelines, and channel identifier definitions.
- [L148–L368] 4. Notification Event Catalog — Trigger events and consumer registry mapping for legislative, ARTA, and administrative actions.
  - [L154–L177] 4.1 Step Assignment Notification — Triggers when a workflow step is activated to notify the designated assignee via workflow.step.started event.
  - [L178–L199] 4.2 Document State Change Notification — Notifies affected users of document lifecycle phase transitions via document.state_changed event.
  - [L200–L223] 4.3 SLA Warning Notification — Warns assignees when 80% of the ARTA-configured SLA duration has elapsed using workflow.sla.warning.
  - [L224–L245] 4.4 SLA Breach Escalation Notification — Triggers supervisor and Records Officer notifications upon missed SLA deadlines via workflow.sla.breached.
  - [L246–L269] 4.5 SLA Critical Escalation Notification — Triggers high-priority alerts to supervisors, Records Officers, and Department Heads at 150% SLA threshold.
  - [L270–L293] 4.6 Mayor 10-Day Lapse-Into-Law Notification — Alerts the SP Secretary via workflow.approval.lapsed when the Mayor's 10-day review period expires.
  - [L294–L317] 4.7 Panlalawigan 30-Day Deemed Approval Notification — Alerts the SP Secretary via workflow.panlalawigan.deemed_approved when the Sangguniang Panlalawigan's 30-day review expires.
  - [L318–L346] 4.8 Complaint Respondent Notification `[B3 Gap — routing resolved by ADR-B2-4]` — Email/phone alerting for external respondents via ADR-B2-4 direct API call, bypassing the main event bus.
  - [L347–L368] 4.9 Session Security Notification `[B3 Gap]` — In-app notification sent to a displaced user when their active session is terminated due to multi-device login.
- [L369–L629] 5. Notification Template Catalog — Administrator-managed templating syntax and database configuration details for notification message bodies.
  - [L375–L392] 5.1 Template Framework — Template schema definition, identifier patterns, is_active status, and Phase 2 react-email rendering rules.
  - [L393–L419] 5.2 Template T-01: Step Assignment — In-App — In-app message configuration and payload variables for step routing alerts under workflow.step.started.
  - [L420–L436] 5.3 Template T-02: Step Assignment — Email (Phase 2) — Phase 2 email message setup and variables for step routing alerts under workflow.step.started.
  - [L437–L461] 5.4 Template T-03: Document State Change — In-App — In-app message payload and transition configuration for document lifecycle state changes.
  - [L462–L485] 5.5 Template T-04: SLA Warning — In-App — In-app alert format for 80% SLA warning thresholds using workflow instance context variables.
  - [L486–L510] 5.6 Template T-05: SLA Breach Escalation — In-App — In-app alert structure for supervisor/Records Officer notifications when SLA deadlines are first missed.
  - [L511–L534] 5.7 Template T-06: SLA Critical Escalation — In-App — In-app alert format for three-tier supervisor, Records Officer, and Department Head escalations at 150% SLA.
  - [L535–L557] 5.8 Template T-07: Mayor 10-Day Lapse — In-App — In-app alert for SP Secretary containing the verbatim 'RA 7160 Section 47' legal basis.
  - [L558–L581] 5.9 Template T-08: Panlalawigan 30-Day Deemed Approval — In-App — In-app alert for SP Secretary containing the verbatim 'RA 7160 Section 56(d)' legal basis.
  - [L582–L606] 5.10 Template T-09: Complaint Respondent Notification — Email — Phase 1 exception email template for citizen respondents containing complaint tracking and Secretariat details.
  - [L607–L629] 5.11 Template T-10: Session Displaced — In-App — In-app security alert template delivered to force-logged-out users upon their subsequent login.
- [L630–L646] 6. Mapping of Notification Events to Templates — Reference table mapping all nine notification events to their corresponding templates, channels, and delivery phases.
- [L647–L686] 7. Role-Based Notification Permissions — Matrix defining which roles receive step, SLA, or respondent alerts, plus self-service and delivery log permissions.
- [L687–L751] 8. Notes and Considerations — Known B3 gaps, email delivery staging, SLA timer confirmation, and verbatim legal basis constraints.
- [L752–L772] 9. Conclusion — Summary of Phase 1 notifications, required implementation decisions, and ongoing maintenance guidelines.

---

---

## 1. Introduction

The Batac City LGU Platform includes a `notifications` module as a core Phase 1 infrastructure component. This module delivers timely, role-appropriate messages to platform users when significant system events occur — workflow step assignments, ARTA SLA threshold warnings and breaches, legislative lapse-into-law events, and citizen complaint respondent alerts, among others.

Notifications are driven by the internal in-process event bus described in B3. The `notifications` module subscribes to specific domain events, resolves the appropriate recipients from the current organization and role state, selects the matching administrator-configured template, and dispatches the notification via the available channel for the active phase.

This catalog consolidates all notification-relevant information from the platform's architecture and requirements sources into a single reference for the development team. It covers every event that triggers a notification, the recipient logic for each, the delivery channels by phase, and the template framework including the payload variables available for message composition.

---

## 2. Purpose and Scope

### 2.1 Purpose

This document is the implementation reference for the `notifications` module. It defines:

- Every notification event, the domain event that triggers it, and its business justification
- Intended recipients per event, as determined by role, office scope, and context
- Delivery channels available in each phase
- The template framework: template key naming conventions, available payload variables, and channel-specific structure
- A mapping table from domain events to template keys
- Role-based notification permissions derived from I2
- Open items and known B3 gaps that must be resolved before implementation

### 2.2 Scope

**Phase 1 (in scope — must be implemented):**
- In-app notifications delivered via Server-Sent Events (SSE) for all operational roles
- Complaint respondent notification via email (where available) or phone contact — Phase 1 exception to the general Phase 2 email rollout
- All notification events sourced from Phase 1 domain events in B3 §8 (Master Event Registry) that list `notifications` as a consumer

**Phase 2 (reserved — architecture must not preclude):**
- Email delivery for the general in-app notification system (all operational roles)
- Email templates implemented with `@react-email/components`

**Phase 3 (reserved):**
- SMS gateway for citizen-facing and barangay official notifications

**Out of scope for this document:**
- Specific notification message body text — templates are **administrator-configurable** per the platform's extensibility tiers (consolidated ref Part 11.21); this catalog defines template structure and available variables only
- Phase 2 Reporting module (no notification subscriptions defined in B3)

### 2.3 Module Database Schema

The `notifications` module owns the following tables in the `notifications` PostgreSQL schema (consolidated ref Part 11.9):

| Table | Purpose |
|---|---|
| `notifications.templates` | Administrator-managed message templates; referenced by `template_key` string |
| `notifications.notification_events` | Log of every notification event generated (distinct from the domain event bus) |
| `notifications.delivery_log` | Record of every delivery attempt, channel used, and result |

Delivery logs are accessible only to **System Administrators** and **Platform Administrators** (I2, Section 11).

---

## 3. Delivery Infrastructure

### 3.1 Phase 1 — In-App via SSE

Real-time in-app notifications are delivered using **Server-Sent Events (SSE)** — a one-directional server-push mechanism that requires no WebSocket infrastructure (tech-stack.md). This is the sole delivery channel for all internal-user notifications in Phase 1.

| Component | Technology |
|---|---|
| Real-time push | Server-Sent Events (SSE) |
| Durable timer scheduling | `pgboss` |
| Simple scheduling | `node-cron` |

### 3.2 Phase 2 — Email

Email delivery is added in Phase 2 for the general notification system. `@react-email/components` is used for template rendering; `Nodemailer` handles transport and is compatible with any SMTP provider including the LGU mail server (tech-stack.md).

**Phase 1 exception:** Complaint respondent notifications use email in Phase 1 for respondents who have a known email address. This is an explicit requirement sourced from the consolidated reference (Part 4.14) and is the only Phase 1 email-channel notification.

### 3.3 Phase 3 — SMS

An SMS gateway is added in Phase 3, enabling notifications to citizens and barangay officials without in-app access (consolidated ref Part 13). The document copy-request contact-number notification (consolidated ref Part 4.15) is deferred to Phase 3 when the SMS gateway is available; in Phase 1 it is handled manually by Secretariat staff.

### 3.4 Channel Identifier Reference

| Channel Identifier | Description | Phase Available |
|---|---|---|
| `in_app` | In-app notification via SSE; default for all workflow steps | Phase 1 |
| `email` | Email delivery | Phase 2 (Phase 1 exception: complaint respondent only) |
| `sms` | SMS gateway | Phase 3 |

---

## 4. Notification Event Catalog

This section catalogs every notification event the `notifications` module must handle. Events in Sections 4.1–4.7 are sourced directly from B3 §8 (Master Event Registry) — those rows explicitly list `notifications` as a consumer module. Events in Sections 4.8–4.9 are sourced from the consolidated reference and role-permission matrix; they are not currently registered in B3 with a `notifications` consumer and are flagged accordingly as B3 gaps requiring follow-up.

---

### 4.1 Step Assignment Notification

| Field | Value |
|---|---|
| **Notification Event Name** | Step Assignment |
| **Triggering Domain Event** | `workflow.step.started` |
| **Emitter Module** | `workflow` |
| **Phase** | 1 |
| **B3 Reference** | §7.11; Master Event Registry row 24 |

**Description:** Notifies the step assignee that a workflow step has been routed to them and requires action. Delegation resolution has already been applied by the workflow engine before this event fires — the `assignedTo` field in the payload already reflects the designated person if a Designation grant is active.

**Trigger Condition:** A workflow step instance is activated and the engine routes it to an assignee. Fired within the committing database transaction.

**Recipient(s):** The user identified by `assignedTo` in the event payload. May be a Secretariat staff member, committee member, SP Secretary, Vice Mayor, Mayor, Barangay Captain, or other role depending on the step definition. `assignedTo` is `null` for system-executed steps (`decision`, `notification` step types); no notification is sent in that case.

**Delivery Channel(s):** `in_app` (Phase 1); `email` (Phase 2)

**Priority:** Normal

**Important Note:** B3 §7.11 confirms that `documentId` is a **required** field in this event's payload precisely because the Notifications module cannot compose a usable notification body without knowing the associated document. The module must resolve human-readable document details (type, series number, title) from `documentId` at notification time.

---

### 4.2 Document State Change Notification

| Field | Value |
|---|---|
| **Notification Event Name** | Document State Change |
| **Triggering Domain Event** | `document.state_changed` |
| **Emitter Module** | `documents` |
| **Phase** | 1 |
| **B3 Reference** | §6.2; Master Event Registry row 10 |

**Description:** Notifies affected parties when a document's lifecycle state advances to a new state (e.g., `Draft → Submitted`, `In-Workflow → Released`, `Released → Archived`, any state → `Cancelled`).

**Trigger Condition:** The document lifecycle state machine advances to a new state via an authorized user action through the Documents module Router.

**Recipient(s):** Determined by the transition type, the document's originating office, and the document's classification level. Exact recipient logic is template-driven and administrator-configurable. The `actorId` who triggered the transition does not automatically receive a notification.

**Delivery Channel(s):** `in_app` (Phase 1); `email` (Phase 2)

**Priority:** Normal

---

### 4.3 SLA Warning Notification

| Field | Value |
|---|---|
| **Notification Event Name** | SLA Warning (80%) |
| **Triggering Domain Event** | `workflow.sla.warning` |
| **Emitter Module** | `workflow` |
| **Phase** | 1 |
| **B3 Reference** | §7.27; Master Event Registry row 40 |

**Description:** Warns the step assignee that 80% of the configured ARTA SLA time for the current workflow step has elapsed. Provides an advance alert before the SLA deadline is breached, allowing the assignee to act before the matter escalates.

**Trigger Condition:** A `pgboss` scheduled job determines that 80% of the ARTA SLA window has elapsed for the active step instance.

**Recipient(s):** The **current step assignee only**. Escalation to supervisors and other roles does not occur until breach (Section 4.4). (B3 §7.27, OI-11 resolution)

**Delivery Channel(s):** `in_app` (Phase 1); `email` (Phase 2)

**Priority:** Medium

**ARTA Context:** ARTA (RA 11032) SLA thresholds are configurable: simple transactions ≤ 3 working days; complex ≤ 7 working days; highly technical ≤ 20 working days. The SLA clock runs continuously from workflow initiation — system outages do not suspend ARTA obligations (consolidated ref Parts 11.3, 11.15).

---

### 4.4 SLA Breach Escalation Notification

| Field | Value |
|---|---|
| **Notification Event Name** | SLA Breach Escalation |
| **Triggering Domain Event** | `workflow.sla.breached` |
| **Emitter Module** | `workflow` |
| **Phase** | 1 |
| **B3 Reference** | §7.28; Master Event Registry row 41; B2 equivalent: `workflow.escalated` |

**Description:** Notifies the assignee's supervisor and the Records Officer that the ARTA SLA deadline has passed without the step being completed. This is an automatic escalation required by RA 11032 (ARTA).

**Trigger Condition:** A `pgboss` scheduled job determines that the ARTA SLA deadline has elapsed for the active step instance. The `breachedAt` timestamp equals `slaDeadline`; `breachDetectedAt` reflects when the job fired and may differ slightly.

**Recipient(s):** The **assignee's supervisor** and the **Records Officer** for the step's office. These are resolved at notification time from the administrator-configurable escalation configuration — they are **not** embedded in the event payload. This allows administrators to update escalation targets without a code or schema change. (B3 §7.28, OI-7 resolution)

**Delivery Channel(s):** `in_app` (Phase 1); `email` (Phase 2)

**Priority:** High

---

### 4.5 SLA Critical Escalation Notification

| Field | Value |
|---|---|
| **Notification Event Name** | SLA Critical Escalation (150%) |
| **Triggering Domain Event** | `workflow.sla.critical` |
| **Emitter Module** | `workflow` |
| **Phase** | 1 |
| **B3 Reference** | §7.29; Master Event Registry row 42 |

**Description:** Second-tier escalation for severely overdue documents. 150% of the ARTA SLA time has elapsed. Notifies the breach escalation audience (supervisor + Records Officer) plus the Department Head, a wider audience reflecting heightened urgency.

**Trigger Condition:** A `pgboss` scheduled job determines that 150% of the ARTA SLA window has elapsed for the active step instance.

**Recipient(s):** **Assignee's supervisor**, **Records Officer**, and **Department Head**. Same resolution mechanism as SLA Breach — resolved at notification time from administrator-configurable escalation configuration.

**Delivery Channel(s):** `in_app` (Phase 1); `email` (Phase 2)

**Priority:** Critical

**Note on 150% threshold:** This threshold value is sourced from B4 via B3 (§7.29) and is flagged `[Unverified]` in B3 — it does not appear in the consolidated reference, which describes only an 80% warning and a breach-notification model. The existence of a third escalation tier is confirmed by team decision (B3, OI-11). The specific 150% figure should be confirmed with stakeholders before the SLA scheduler configuration is finalized.

---

### 4.6 Mayor 10-Day Lapse-Into-Law Notification

| Field | Value |
|---|---|
| **Notification Event Name** | Mayor 10-Day Lapse |
| **Triggering Domain Event** | `workflow.approval.lapsed` |
| **Emitter Module** | `workflow` |
| **Phase** | 1 |
| **B3 Reference** | §7.21; Master Event Registry row 34; B2 equivalent: `workflow.lapsed` with `lapseType: 'mayor_10_day_lapsed'` |

**Description:** Notifies the SP Secretary that the Mayor's 10-calendar-day review window has elapsed with no action, and the measure has lapsed into law per RA 7160 Section 47. The SP Secretary must confirm the lapse in the system to advance the workflow to docketing.

**Trigger Condition:** The `evaluateMayorLapseTimers` scheduler job fires when `NOW() > instance.context.mayor_action_deadline`. The step outcome is set to `LAPSED` by the scheduler (not by a human actor); `workflow.approval.lapsed` is then emitted.

**Recipient(s):** **SP Secretary** only

**Delivery Channel(s):** `in_app` (Phase 1); `email` (Phase 2)

**Priority:** High

**Legal Scope:** Applies to both SP Resolutions and SP Ordinances. The legal basis phrase `"RA 7160 Section 47"` is included verbatim in the event payload (`legalBasis` field) and must be preserved exactly in the notification message. No working-day or public holiday adjustments apply to the 10-day count (consolidated ref Parts 4.1, 4.2, 11.3).

---

### 4.7 Panlalawigan 30-Day Deemed Approval Notification

| Field | Value |
|---|---|
| **Notification Event Name** | Panlalawigan 30-Day Deemed Approval |
| **Triggering Domain Event** | `workflow.panlalawigan.deemed_approved` |
| **Emitter Module** | `workflow` |
| **Phase** | 1 |
| **B3 Reference** | §7.22; Master Event Registry row 35; B2 equivalent: `workflow.lapsed` with `lapseType: 'panlalawigan_30_day_deemed'`; B3 Context Reference equivalent: `panlalawigan_timer.expired` |

**Description:** Notifies the SP Secretary that the Sangguniang Panlalawigan took no action within 30 calendar days of receiving the transmitted measure. The measure is therefore deemed approved per RA 7160 Section 56(d). The SP Secretary must confirm this status; the Remarks field is to be populated with "Lapsed 30 days."

**Trigger Condition:** The `evaluatePanlalawiganTimers` scheduler job fires when `NOW() > instance.context.panlalawigan_action_deadline`. The step outcome is set to `DEEMED_APPROVED` by the scheduler.

**Recipient(s):** **SP Secretary** only

**Delivery Channel(s):** `in_app` (Phase 1); `email` (Phase 2)

**Priority:** High

**Legal Basis:** The legal basis phrase `"RA 7160 Section 56(d)"` is included verbatim in the event payload (`legalBasis` field) and must be preserved exactly in the notification message. The payload also includes `transmissionDate` (when the measure was sent to the Panlalawigan) and `deadlineWas` (the 30-day deadline), both of which should appear in the notification for the SP Secretary's records (consolidated ref Part 4.3).

---

### 4.8 Complaint Respondent Notification `[B3 Gap — routing resolved by ADR-B2-4]`

| Field | Value |
|---|---|
| **Notification Event Name** | Complaint Respondent Alert |
| **Triggering Domain Event** | Not currently registered in B3 as a domain event with a `notifications` consumer. Triggered by the complaint workflow within the platform. See Section 8.4 for the follow-up action still required in B3. |
| **Emitter Module** | `portal` (Respondent Notice Service — routing confirmed via `Notifications.sendNotification()` per ADR-B2-4) |
| **Phase** | 1 |
| **Source** | Consolidated ref Part 4.14; I2 Section 11, Conditional note ¹⁸; I2 Section 12; ADR-B2-4 — Respondent Notice Channel (June 2026) |

**Description:** Notifies the named respondent in a citizen complaint that a formal written notice has been issued and requires their attention. Delivery method depends entirely on what contact information is available for the respondent.

**Trigger Condition:** The Secretariat logs and routes a complaint and issues a formal written notice to the named respondent.

**Recipient(s):** The **named respondent** of the complaint (citizen or entity — not a platform user)

**Delivery Channel(s):** Two paths, determined by available contact information:

| Respondent Contact Available | Delivery Method |
|---|---|
| Email address | Notification AND the formal written notice delivered by email |
| Contact number only (no email) | Notification sent by phone contact; respondent must claim the formal written notice **in person** at the LGU |

**Priority:** High

**Phase 1 Email Exception:** This is the only Phase 1 notification that uses the `email` channel. It is an explicit Phase 1 requirement because the respondent is an external party (not a platform user) and the formal written notice must reach them regardless of whether they have a platform account. Email notifications for internal platform users are Phase 2.

---

### 4.9 Session Security Notification `[B3 Gap]`

| Field | Value |
|---|---|
| **Notification Event Name** | Session Displaced — New Device Login |
| **Triggering Domain Event** | `session.terminated` (B3 §4.3) — note: B3 currently lists only `audit` as a consumer of this event. The `notifications` consumer is required per consolidated ref Part 11.17 but is not yet registered in B3. See Section 8.3. |
| **Emitter Module** | `iam` |
| **Phase** | 1 |
| **Source** | Consolidated ref Part 11.17; B3 §4.3 |

**Description:** Notifies a user that their active session has been terminated because a new login was detected from a different device. Alerts the user to investigate if the login was not initiated by them.

**Trigger Condition:** A user authenticates from a new device while an existing active session is present. The platform enforces one active session per user; the prior session is force-terminated. (Consolidated ref Part 11.17)

**Recipient(s):** The **displaced user** — the user whose prior session was terminated

**Delivery Channel(s):** `in_app` (delivered upon the user's next login or active SSE connection)

**Priority:** Medium

---

## 5. Notification Template Catalog

Notification templates are **administrator-configurable** — no developer involvement is required to create, edit, or activate them. Templates are managed by the Platform Administrator through the admin configuration interface and stored in `notifications.templates`. This is classified under the "Administrator-configurable (no developer)" extensibility tier (consolidated ref Part 11.21).

This catalog does not define specific message body text. It defines the **template framework**: the template key for each notification type, the delivery channel, the payload variables available for message composition, and implementation notes. Template content is written and maintained by the Platform Administrator.

### 5.1 Template Framework

Each template record has the following structure. This structure is derived from the `NotificationStepConfig` interface defined in H1 §3 and the `notifications` schema in the consolidated reference:

| Field | Description |
|---|---|
| `template_key` | Unique string identifier used by workflow `notification` step configs and the notifications module's event subscription handlers to look up the correct template |
| `channel` | Delivery channel: `in_app`, `email`, or `sms` |
| `subject` | Subject line (email channel only; not applicable for `in_app` or `sms`) |
| `body` | Message body; includes placeholder variables (e.g., `{{variableName}}`) resolved from the event payload context at delivery time |
| `is_active` | Whether the template is currently active |

Multiple templates can exist for the same notification type across different channels (e.g., one `in_app` template and one `email` template for the same event, each with a distinct `template_key`).

**Templating syntax note:** The specific placeholder syntax (`{{variableName}}` notation used in this document is illustrative). The actual syntax depends on the templating library chosen during implementation. For `email` channel templates, `@react-email/components` is the specified renderer (tech-stack.md) and uses JSX-based composition rather than a string-interpolation syntax.

---

### 5.2 Template T-01: Step Assignment — In-App

| Field | Value |
|---|---|
| **Template Key** | `notif.workflow.step_assignment.in_app` |
| **Associated Notification Event** | Step Assignment (Section 4.1) |
| **Triggering Domain Event** | `workflow.step.started` |
| **Channel** | `in_app` |
| **Subject** | N/A |
| **Phase** | 1 |

**Available Payload Variables (sourced from B3 §7.11 payload schema):**

| Variable | Source Field | Type | Description |
|---|---|---|---|
| `{{instanceId}}` | `instanceId` | UUID | Workflow instance UUID |
| `{{stepInstanceId}}` | `stepInstanceId` | UUID | Step instance UUID |
| `{{stepType}}` | `stepType` | enum | Step type (`action`, `approval`, `multi_referral`, etc.) |
| `{{stepKey}}` | `stepKey` | string | Step key within the definition (e.g., `second_reading_vote`) |
| `{{assignedTo}}` | `assignedTo` | UUID (nullable) | UUID of the assignee; null for system-executed steps |
| `{{documentId}}` | `documentId` | UUID | Associated document UUID — required to compose message body |
| `{{dueAt}}` | `dueAt` | datetime (nullable) | Step due date/time; null for step types with no due date |

**Implementation Notes:** `documentId` is a required field in the payload (B3 §7.11, OI-5 resolution). The Notifications module must resolve human-readable document details (series number, type, title) from `documentId` at delivery time — it cannot produce a useful notification body using UUIDs alone. No notification should be sent when `assignedTo` is null.

---

### 5.3 Template T-02: Step Assignment — Email (Phase 2)

| Field | Value |
|---|---|
| **Template Key** | `notif.workflow.step_assignment.email` |
| **Associated Notification Event** | Step Assignment (Section 4.1) |
| **Triggering Domain Event** | `workflow.step.started` |
| **Channel** | `email` |
| **Subject** | Administrator-configurable; should include document number and step label |
| **Phase** | 2 |

**Available Payload Variables:** Identical to T-01.

**Implementation Notes:** Phase 2 only. Rendered with `@react-email/components`. Not required for Phase 1 delivery.

---

### 5.4 Template T-03: Document State Change — In-App

| Field | Value |
|---|---|
| **Template Key** | `notif.document.state_changed.in_app` |
| **Associated Notification Event** | Document State Change (Section 4.2) |
| **Triggering Domain Event** | `document.state_changed` |
| **Channel** | `in_app` |
| **Subject** | N/A |
| **Phase** | 1 |

**Available Payload Variables (sourced from B3 §6.2 payload schema):**

| Variable | Source Field | Type | Description |
|---|---|---|---|
| `{{documentId}}` | `documentId` | UUID | Document UUID |
| `{{fromState}}` | `fromState` | enum | Previous lifecycle state |
| `{{toState}}` | `toState` | enum | New lifecycle state |
| `{{actorId}}` | `actorId` | UUID | UUID of user who triggered the state change |
| `{{reason}}` | `reason` | string (optional) | Reason for the state change; may be absent |

**Implementation Notes:** Recipient logic varies significantly by transition type and is template-configurable. The `reason` field is optional — the template body must handle cases where it is absent.

---

### 5.5 Template T-04: SLA Warning — In-App

| Field | Value |
|---|---|
| **Template Key** | `notif.workflow.sla_warning.in_app` |
| **Associated Notification Event** | SLA Warning 80% (Section 4.3) |
| **Triggering Domain Event** | `workflow.sla.warning` |
| **Channel** | `in_app` |
| **Subject** | N/A |
| **Phase** | 1 |

**Available Payload Variables (sourced from B3 §7.27 payload schema):**

| Variable | Source Field | Type | Description |
|---|---|---|---|
| `{{instanceId}}` | `instanceId` | UUID | Workflow instance UUID |
| `{{stepInstanceId}}` | `stepInstanceId` | UUID | Step instance UUID |
| `{{slaDeadline}}` | `slaDeadline` | datetime | The ARTA SLA deadline timestamp |
| `{{percentElapsed}}` | `percentElapsed` | literal `80` | Always `80` for this event |

**Implementation Notes:** The template tone should communicate urgency without triggering alarm — this is a warning, not a breach notification. The message should display the deadline date/time and provide a direct link or reference to the relevant workflow step so the assignee can take action immediately.

---

### 5.6 Template T-05: SLA Breach Escalation — In-App

| Field | Value |
|---|---|
| **Template Key** | `notif.workflow.sla_breach.in_app` |
| **Associated Notification Event** | SLA Breach Escalation (Section 4.4) |
| **Triggering Domain Event** | `workflow.sla.breached` |
| **Channel** | `in_app` |
| **Subject** | N/A |
| **Phase** | 1 |

**Available Payload Variables (sourced from B3 §7.28 payload schema):**

| Variable | Source Field | Type | Description |
|---|---|---|---|
| `{{instanceId}}` | `instanceId` | UUID | Workflow instance UUID |
| `{{stepInstanceId}}` | `stepInstanceId` | UUID | Step instance UUID |
| `{{slaDeadline}}` | `slaDeadline` | datetime | The SLA deadline that was missed (= `breachedAt`) |
| `{{breachedAt}}` | `breachedAt` | datetime | Moment of breach; equals `slaDeadline` per B3 §7.28 |
| `{{breachDetectedAt}}` | `breachDetectedAt` | datetime | When the `pgboss` job detected the breach; may differ from `breachedAt` |

**Implementation Notes:** Recipients (supervisor and Records Officer) are resolved from administrator-configurable escalation configuration at notification time — they are not in the event payload. The message should clearly communicate that an ARTA SLA deadline (RA 11032) has been missed, identify the document and step, and indicate the appropriate escalation contacts.

---

### 5.7 Template T-06: SLA Critical Escalation — In-App

| Field | Value |
|---|---|
| **Template Key** | `notif.workflow.sla_critical.in_app` |
| **Associated Notification Event** | SLA Critical Escalation 150% (Section 4.5) |
| **Triggering Domain Event** | `workflow.sla.critical` |
| **Channel** | `in_app` |
| **Subject** | N/A |
| **Phase** | 1 |

**Available Payload Variables (sourced from B3 §7.29 payload schema):**

| Variable | Source Field | Type | Description |
|---|---|---|---|
| `{{instanceId}}` | `instanceId` | UUID | Workflow instance UUID |
| `{{stepInstanceId}}` | `stepInstanceId` | UUID | Step instance UUID |
| `{{slaDeadline}}` | `slaDeadline` | datetime | The original ARTA SLA deadline |
| `{{percentElapsed}}` | `percentElapsed` | literal `150` | Always `150` for this event |

**Implementation Notes:** Recipients (supervisor, Records Officer, Department Head) resolved at notification time. The message should convey critical urgency and cite ARTA non-compliance risk explicitly, distinguishing it clearly from the breach-level (T-05) notification.

---

### 5.8 Template T-07: Mayor 10-Day Lapse — In-App

| Field | Value |
|---|---|
| **Template Key** | `notif.workflow.mayor_lapse.in_app` |
| **Associated Notification Event** | Mayor 10-Day Lapse (Section 4.6) |
| **Triggering Domain Event** | `workflow.approval.lapsed` |
| **Channel** | `in_app` |
| **Subject** | N/A |
| **Phase** | 1 |

**Available Payload Variables (sourced from B3 §7.21 payload schema):**

| Variable | Source Field | Type | Description |
|---|---|---|---|
| `{{stepInstanceId}}` | `stepInstanceId` | UUID | Step instance UUID |
| `{{legalBasis}}` | `legalBasis` | literal string | Verbatim: `"RA 7160 Section 47"` — must not be altered |
| `{{deadlineWas}}` | `deadlineWas` | datetime | The 10-day deadline timestamp |

**Implementation Notes:** Recipient is the SP Secretary only. The legal basis phrase `"RA 7160 Section 47"` is carried verbatim in the payload and **must be included verbatim** in the notification — it is the legally mandated basis phrase recorded in system documents. The message must prompt the SP Secretary to confirm the lapse in the system to advance the workflow to docketing. The Notifications module should resolve the document's series number from `stepInstanceId` → `instanceId` → `documentId` for display.

---

### 5.9 Template T-08: Panlalawigan 30-Day Deemed Approval — In-App

| Field | Value |
|---|---|
| **Template Key** | `notif.workflow.panlalawigan_deemed_approved.in_app` |
| **Associated Notification Event** | Panlalawigan 30-Day Deemed Approval (Section 4.7) |
| **Triggering Domain Event** | `workflow.panlalawigan.deemed_approved` |
| **Channel** | `in_app` |
| **Subject** | N/A |
| **Phase** | 1 |

**Available Payload Variables (sourced from B3 §7.22 payload schema):**

| Variable | Source Field | Type | Description |
|---|---|---|---|
| `{{stepInstanceId}}` | `stepInstanceId` | UUID | Step instance UUID |
| `{{legalBasis}}` | `legalBasis` | literal string | Verbatim: `"RA 7160 Section 56(d)"` — must not be altered |
| `{{transmissionDate}}` | `transmissionDate` | datetime | Date the measure was transmitted to the Panlalawigan |
| `{{deadlineWas}}` | `deadlineWas` | datetime | The 30-day deadline timestamp |

**Implementation Notes:** Recipient is the SP Secretary only. The legal basis phrase `"RA 7160 Section 56(d)"` **must be included verbatim**. Both `transmissionDate` and `deadlineWas` should appear in the notification for the SP Secretary's records. The message must prompt the SP Secretary to confirm the deemed-approval status and populate the Remarks field with "Lapsed 30 days" (consolidated ref Part 4.3).

---

### 5.10 Template T-09: Complaint Respondent Notification — Email

| Field | Value |
|---|---|
| **Template Key** | `notif.complaint.respondent_notice.email` |
| **Associated Notification Event** | Complaint Respondent Alert (Section 4.8) |
| **Triggering Domain Event** | Complaint workflow (B3 gap — see Section 8.4) |
| **Channel** | `email` |
| **Subject** | Administrator-configurable; should include complaint reference number and the LGU name |
| **Phase** | 1 (Phase 1 exception to the general Phase 2 email timeline) |

**Available Variables:**

| Variable | Description |
|---|---|
| `{{respondentName}}` | Full name of the respondent |
| `{{complaintReference}}` | Complaint reference/tracking number |
| `{{complaintSubject}}` | Subject matter of the complaint |
| `{{lguOffice}}` | Issuing office name (e.g., "Sangguniang Panlungsod, Batac City") |
| `{{secretariatContactInfo}}` | Contact information for the SP Secretariat for the respondent's follow-up |

**Implementation Notes:** This template is used only when the respondent has a known email address. Per the consolidated reference (Part 4.14): "If respondent has an email address: notification AND the formal written notice sent by email." When only a phone number is available, notification is made by phone contact and no email template is used; the respondent claims the formal written notice in person. The email constitutes both the notification and delivery of the formal written notice.

---

### 5.11 Template T-10: Session Displaced — In-App

| Field | Value |
|---|---|
| **Template Key** | `notif.iam.session_displaced.in_app` |
| **Associated Notification Event** | Session Displaced — New Device Login (Section 4.9) |
| **Triggering Domain Event** | `session.terminated` (B3 gap — see Section 8.3) |
| **Channel** | `in_app` |
| **Subject** | N/A |
| **Phase** | 1 |

**Available Variables (sourced from B3 §4.3 payload schema):**

| Variable | Source Field | Type | Description |
|---|---|---|---|
| `{{sessionId}}` | `sessionId` | UUID | The terminated session UUID |
| `{{userId}}` | `userId` | UUID | The affected user's UUID |
| `{{reason}}` | `reason` | enum | `'forced'` for new-device displacement (vs. timeout) |

**Implementation Notes:** This notification is delivered to the displaced user upon their next in-app login or active SSE connection. The message should advise the user to contact the IT Admin if the login from the new device was not initiated by them (consolidated ref Part 11.17).

---

## 6. Mapping of Notification Events to Templates

| # | Notification Event | Triggering Domain Event | Template Key(s) | Channel | Phase |
|---|---|---|---|---|---|
| 1 | Step Assignment | `workflow.step.started` | `notif.workflow.step_assignment.in_app` | `in_app` | 1 |
| 1a | Step Assignment | `workflow.step.started` | `notif.workflow.step_assignment.email` | `email` | 2 |
| 2 | Document State Change | `document.state_changed` | `notif.document.state_changed.in_app` | `in_app` | 1 |
| 3 | SLA Warning (80%) | `workflow.sla.warning` | `notif.workflow.sla_warning.in_app` | `in_app` | 1 |
| 4 | SLA Breach Escalation | `workflow.sla.breached` | `notif.workflow.sla_breach.in_app` | `in_app` | 1 |
| 5 | SLA Critical Escalation (150%) | `workflow.sla.critical` | `notif.workflow.sla_critical.in_app` | `in_app` | 1 |
| 6 | Mayor 10-Day Lapse | `workflow.approval.lapsed` | `notif.workflow.mayor_lapse.in_app` | `in_app` | 1 |
| 7 | Panlalawigan 30-Day Deemed Approval | `workflow.panlalawigan.deemed_approved` | `notif.workflow.panlalawigan_deemed_approved.in_app` | `in_app` | 1 |
| 8 | Complaint Respondent Alert | *(B3 gap — see §8.4)* | `notif.complaint.respondent_notice.email` | `email` | 1 |
| 9 | Session Displaced | `session.terminated` *(B3 gap — see §8.3)* | `notif.iam.session_displaced.in_app` | `in_app` | 1 |

---

## 7. Role-Based Notification Permissions

The following tables are sourced entirely from I2, Section 11.

### 7.1 In-App Notifications — Assigned Steps and SLA Alerts

Roles permitted to receive in-app notifications for workflow step assignments and SLA alerts:

| Role | Receives Step Assignment Notifications | Receives SLA Escalation Notifications (Breach) |
|---|:---:|:---:|
| System Administrator | — | — |
| Platform Administrator | — | — |
| Records Officer | ✅ | ✅ |
| Department Encoder | ✅ | ❌ |
| Department Approver | ✅ | ✅ |
| SP Secretary | ✅ | ✅ |
| SP Member | ✅ | ❌ |
| SP Presiding Officer (Vice Mayor) | ✅ | ✅ |
| Mayor | ✅ | ✅ |
| Barangay Encoder | ✅ | ❌ |
| Barangay Captain | ✅ | ✅ |
| Auditor | — | — |
| Citizen | — | — |

> **Note:** The "Receive escalation notifications (SLA breach)" permission indicates which roles are *eligible* to receive escalation notifications. The actual recipients for a given breach are resolved at notification time from the escalation configuration for the specific step's office (B3 §7.28, OI-7 resolution). Not every role in the "receives" column will receive every breach notification.

### 7.2 Complaint Respondent Notification

A Citizen who is the **named respondent** in a complaint receives formal written notification via email (if available) or by phone contact (I2, Section 11, Conditional note ¹⁸; I2, Section 12). If the respondent has an authenticated citizen portal account, they may also view the complaint record to which they are a named party (I2, Section 12 — "View complaint as respondent").

### 7.3 Notification Self-Service Permissions

All operational roles — including Citizens for their own notifications — may:
- Mark their own notifications as read (I2 Section 11)
- Configure their own notification preferences (I2 Section 11)

Delivery logs for **all notifications** are accessible only to **System Administrators** and **Platform Administrators** (I2 Section 11).

---

## 8. Notes and Considerations

### 8.1 Template Content Is Administrator-Configurable

Specific notification message bodies are not defined in this document and must not be hardcoded in application logic. The Platform Administrator manages template content in `notifications.templates` through the admin configuration interface. This falls under the "Administrator-configurable (no developer)" extensibility tier (consolidated ref Part 11.21), meaning changes to wording, subject lines, or the addition of new templates require no code change or deployment.

### 8.2 General Email Delivery Is Phase 2

For all operational roles receiving internal system notifications, the `email` channel is a **Phase 2** feature. In Phase 1, all internal notifications are delivered **in-app only** via SSE. The sole Phase 1 email delivery case is the complaint respondent notification (Section 4.8, Template T-09) for external parties who are not platform users.

Implementation must not couple Phase 1 in-app notification delivery to email infrastructure. The email delivery path should be designed as an additive Phase 2 extension.

### 8.3 B3 Gap — `session.terminated` Missing `notifications` Consumer

The `session.terminated` domain event (B3 §4.3) currently lists only `audit` as its consumer. The consolidated reference states explicitly that "Logs out previous session; notification sent to user" (Part 11.17). The `notifications` module must also subscribe to `session.terminated`.

**Required action:** Add `notifications` as a consumer of `session.terminated` in B3's Master Event Registry. This edit is an action item for the B3 document, outside this catalog's authority to make directly. The update must be included in the same PR that implements this feature.

### 8.4 B3 Gap — Complaint Respondent Notification Not Registered as a Domain Event

The complaint respondent notification (Section 4.8) is not currently represented in B3 as a formal domain event with a `notifications` consumer. It is, however, an explicit Phase 1 requirement (consolidated ref Part 4.14; I2 Section 11, Conditional note ¹⁸).

**[RESOLVED — ADR-B2-4: Respondent Notice Channel, June 2026]** The **routing** question is resolved: Portal's Respondent Notice Service calls `Notifications.sendNotification()` — not a direct SMTP call, and not a separate domain event on the bus. The Notifications module handles delivery and logs every attempt in `notifications.delivery_log`. B1's direct-SMTP diagram for Module 10 (Portal) is superseded by ADR-B2-4.

**Remaining open item (still a B3 action):** Whether this call path is accompanied by a formal domain event (e.g., `complaint.respondent_notice.issued`) or is purely a direct Published API call is still the team's choice when implementing the complaint module. If a domain event is introduced, a new entry must be added to B3's Master Event Registry in the same PR that introduces it on the bus.

**Phase 1/2 behavior for phone-only respondents:** When only a contact number is available, `Notifications.sendNotification()` with `channel: 'sms'` logs a `delivery_log` entry of type `phone_call_required` in Phase 1/2 (the SMS gateway is reserved for Phase 3). The actual phone call and in-person notice handoff remain manual Secretariat actions. This ensures every respondent notice *attempt* is logged centrally regardless of delivery channel.

### 8.5 Escalation Target Resolution — Not in Event Payload

Per B3 §7.28, OI-7 resolution: SLA escalation recipients (supervisor, Records Officer, Department Head) are **resolved at notification time** from the administrator-configurable escalation configuration. They are not embedded in the event payload. This design allows Platform Administrators to update escalation targets without a code or schema change. Template T-05, T-06, and all SLA breach/critical notifications depend on this resolution mechanism being implemented correctly.

### 8.6 Legal Basis Phrases Are Verbatim and Immutable

The `workflow.approval.lapsed` event carries the literal string `"RA 7160 Section 47"` in its `legalBasis` field. The `workflow.panlalawigan.deemed_approved` event carries `"RA 7160 Section 56(d)"`. Both phrases are mandated by the source documents to appear verbatim in system records and notifications (consolidated ref Parts 4.1, 4.3, 11.3). Template administrators must not alter these phrases.

### 8.7 ARTA Compliance — SLA Notifications Are Legally Significant

SLA notifications are not cosmetic alerts. They carry obligations under **RA 11032 (ARTA)**. The SLA clock runs from workflow initiation and continues regardless of system outages, connectivity issues, or holidays (consolidated ref Parts 11.3, 11.15). Failure to deliver breach notifications does not relieve LGU staff of ARTA obligations. Delivery failures must be logged in `notifications.delivery_log` and monitored. The `pgboss` durable scheduler (not the simple `node-cron`) is specified for timer-based SLA events precisely because of this durability requirement (tech-stack.md).

### 8.8 `notification` Step Type Available but Not Used in Phase 1 Workflow Seeds

H1 §3 defines a `notification` step type with a `NotificationStepConfig` interface:

```typescript
interface NotificationStepConfig {
  template_key: string;
  recipients: string[];
  channels?: string[];       // default ["in_app"]
  payload_context_keys?: string[];
}
```

However, none of the three Phase 1 workflow seed definitions (SP Resolution, SP Ordinance, Appropriation Ordinance) in H1 §§5–7 include any `notification` type steps. All Phase 1 legislative workflow notifications are driven entirely by the event bus (domain events from B3 consumed by the `notifications` module), not by inline notification steps in the workflow definition. The `notification` step type is available in the workflow engine for future workflow definitions that require inline notification steps outside the event-bus pattern.

### 8.9 Document Copy-Request Notification Is Deferred

The consolidated reference states that after a document copy request is approved, the requester "is notified via contact number (primary channel)" (Part 4.15). Since the SMS gateway is Phase 3 and the payment system is deferred to later phases (consolidated ref Part 4.15), this notification is not implemented in Phase 1 and is not included in this catalog. This should be revisited during Phase 3 planning.

### 8.10 SLA Critical Threshold (150%) Requires Confirmation

The 150% SLA threshold that triggers `workflow.sla.critical` is sourced only from B4 via B3 §7.29 and is flagged `[Unverified]` in B3. The consolidated reference describes only an 80% warning and a breach model with no specific percentage for a third tier. The existence of a third escalation tier is confirmed by team decision (B3, OI-11), but the 150% threshold should be explicitly confirmed before the `pgboss` SLA scheduler configuration is finalized.

---

## 9. Conclusion

This catalog defines nine notification events and ten associated templates required for Phase 1 of the Batac City LGU Platform's `notifications` module. The notification system operates on a fully event-driven model: the `notifications` module subscribes to domain events on the internal in-process event bus (B3) and dispatches notifications to the appropriate recipients via the channel available for the active phase.

**Phase 1 delivery summary:**
- All internal operational-role notifications: **in-app only via SSE**
- Complaint respondent notification: **email** (where available) or **phone contact** — the sole Phase 1 exception to the general Phase 2 email timeline

**Key implementation decisions required before work begins:**

| # | Decision | Section | Status |
|---|---|---|---|
| 1 | Add `notifications` as a consumer of `session.terminated` in B3 | §8.3 | **Open** |
| 2 | Complaint respondent notification routing: **resolved** — Portal's Respondent Notice Service calls `Notifications.sendNotification()`; B1 direct-SMTP diagram superseded (ADR-B2-4) | §8.4 | **Resolved — ADR-B2-4** |
| 3 | Confirm the 150% SLA critical threshold with stakeholders before configuring `pgboss` timers | §8.10 | **Open** |

**Ongoing maintenance:** This document must be updated whenever a new notification event is introduced, an existing event's recipient logic changes, or a delivery channel is added. Changes to template message content do not require a revision to this document — that content is managed by the Platform Administrator in the admin interface.

---

*This document is the primary reference for `notifications` module implementation. It does not supersede B3 (Internal Domain Event Catalog), which remains the canonical source for domain event schemas and consumer registrations. Discrepancies between this catalog and B3 must be resolved by updating B3 in the same PR that implements the feature.*
