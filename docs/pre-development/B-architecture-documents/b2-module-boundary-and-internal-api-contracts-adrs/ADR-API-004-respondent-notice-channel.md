# ADR-API-004: Respondent Notice Channel

**Status:** Accepted
**Date:** June 2026
**Decided by:** Luke (stakeholder/architect decision)
**Related documents:** B2 — Module Boundary and Internal API Contracts, Module 7 (Notifications), Module 10 (Portal); B1 — System Architecture, Module 10 Component Diagram; Consolidated Architecture and Requirements Reference (Iteration 3), Part 4.14

---

## Context

Citizen Complaint respondent notification (Consolidated Reference, Part 4.14, `[RESOLVES Q-B04]`) requires sending a formal written notice to the complaint respondent — by email when an address is on file, or by phone/in-person pickup otherwise.

B1's Component Diagram for the Portal module (Module 10) shows the **Respondent Notice Service calling the LGU SMTP Server directly**: _"Rel(respondentNoticeSvc, smtpServer, 'Sends formal email notice when email address on file')"_ (B1, line 561), with the SMTP server itself listed as an explicit external system in B1's Level 1 System Context (_"Delivers step-assignment notifications, overdue alerts, and formal respondent notices when respondent has an email address"_, B1 line 63).

B2 proposed an alternative: route this call through `Notifications.sendNotification()` instead, so that respondent notices — like every other notification in the system — land in the single `delivery_log` owned by the Notifications module, rather than Portal independently calling SMTP and that delivery attempt going unrecorded anywhere centrally. B2 flagged this explicitly as a design decision to confirm (B2, Module 7 Published API doc comment: _"this is a design decision to confirm in the ADR for respondent notices"_).

## Decision

**Portal's Respondent Notice Service routes through `Notifications.sendNotification()`. It does not call SMTP directly.** B1's direct-SMTP diagram is superseded by this ADR.

### Mechanics

1. When the Portal module's Complaint Ingester routes a complaint and a respondent notice needs to go out, the **Respondent Notice Service calls `Notifications.sendNotification(input)`** with:
   ```typescript
   {
     recipientEmail: respondent.email,        // when on file
     recipientPhone: respondent.phone,        // Phase 3 SMS path
     templateId: 'respondent-formal-notice',
     templateData: { /* complaint reference, outcome summary, claim instructions */ },
     channel: respondent.email ? 'email' : 'sms',  // Phase 1/2: 'sms' channel value
                                                      // is not yet wired to a real
                                                      // gateway (see Phase note below)
   }
   ```
2. **Phase 1 and Phase 2 behavior when only a contact number is available:** Per the Consolidated Reference (Part 4.14) and B1's Notifications Module 7 note (_"Phase 1 and 2: respondent is called by phone; formal written notice must be claimed in person from LGU"_), there is no SMS gateway yet. `Notifications.sendNotification()` with `channel: 'sms'` in Phase 1/2 does not silently fail — the Notifications module's SMS Delivery Interface (B1, Module 7: _"Reserved — Phase 3"_) is implemented in Phase 1 as a **logging-only stub**: it records a `delivery_log` entry of type `phone_call_required`, and the actual phone call and in-person notice handoff remain manual Secretariat actions tracked outside the system (consistent with B1's existing note that this is a manual process in Phase 1/2). The point of routing through Notifications even for this manual-fallback path is that the _attempt_ and its outcome are still logged centrally, rather than Portal needing its own ad hoc tracking for "did we try to notify this respondent."
3. **Documents module change:** Removed — Documents is not involved in this flow. (Included here only to confirm no Documents-side change results from this ADR.)
4. **Notifications module's `delivery_log` becomes the single source of truth for every notification attempt in the system**, including respondent notices, step assignments, lapse alerts, and SLA escalations. This directly serves the unified-logging rationale B2 originally proposed.
5. **B1's Component Diagram for Module 10 (Portal) requires correction** in any future revision of B1: the `Rel(respondentNoticeSvc, smtpServer, ...)` relationship is removed and replaced with `Rel(respondentNoticeSvc, notifMod, "Sends formal respondent notice via sendNotification()")`. This ADR does not edit B1 directly (B1 is supplied as read-only context for this exercise), but the correction is recorded here so a future B1 revision picks it up, and the _authoritative_ design from this point forward is what this ADR and the updated B2 state, not B1's original diagram.
6. **Published API Call Matrix addition (carried into updated B2):** `Portal (respondent notice service) | Notifications | sendNotification() | Formal written notice to complaint respondent` — this entry already existed in B2's matrix as a tentative `[Inference]` row; it is now confirmed rather than inferred.

## Consequences

- **Positive:** Every notification delivery attempt in the system — regardless of which module triggered it — is recorded in one place (`notifications.delivery_log`). An LGU IT Office or Records Officer investigating "did the respondent actually get notified" has one log to check, not two (Notifications' log plus an untracked direct-SMTP call history).
- **Positive:** Template management for respondent notices benefits from the same admin-configurable Template Engine (B1, Module 7) used for every other notification type, rather than Portal needing its own template-rendering logic duplicated from Notifications.
- **Positive:** When the Phase 3 SMS gateway is added, only the Notifications module's SMS Delivery Interface needs to change (from logging-stub to real gateway call) — Portal's Respondent Notice Service code does not change at all, since it already only calls the stable `sendNotification()` interface.
- **Negative (accepted):** One additional internal hop (Portal → Notifications → SMTP) versus the original direct call. Given this is a non-time-critical, non-interactive backend operation (a respondent notice is not blocking a citizen-facing page render), the latency cost of this hop is not a meaningful concern.
- **Negative (accepted):** Portal's Respondent Notice Service is no longer the component holding the SMTP relationship — operational runbooks or on-call documentation that may have assumed "SMTP issues = check Portal" need to be written or corrected to point at Notifications instead. This is a one-time documentation correction, not an ongoing cost.
- **Documentation correction required:** B1's Module 10 Component Diagram and Level 1 System Context diagram both depict the now-superseded direct-SMTP relationship. This ADR is the authoritative record that B1's diagram is superseded; a future B1 revision should update the diagram to remove `Rel(respondentNoticeSvc, smtpServer, ...)`.
