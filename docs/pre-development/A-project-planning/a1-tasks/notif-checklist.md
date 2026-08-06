# NOTIF Module Checklist

This checklist organizes the 14 tasks of the NOTIF module into logical groups to help you distribute the work among your team members. 

> [!TIP]
> **Recommended Distribution**
> - **Member A (Backend Core):** Database, Repository, and Core Dispatch (Tasks 001, 002, 004, 005)
> - **Member B (Real-time & API):** SSE Infrastructure, TRPC Router, and Plugin Wiring (Tasks 003, 012, 013)
> - **Member C (Event Driven Logic):** Event Consumers (Tasks 006 - 011)
> - **Member D (QA):** Vitest Suite (Task 014)

---

## Group 1: Database & Core Foundation
These tasks build the underlying storage and data-access layers. They must be completed first.
- [ ] **TASK-NOTIF-001**: Create Drizzle schema and SQL migrations for `templates`, `notification_events`, and `delivery_log`.
- [ ] **TASK-NOTIF-002**: Scaffold the NOTIF module repository layer (`findActiveTemplate`, `insertNotificationEvent`, etc.).
- [ ] **TASK-NOTIF-005**: Create an idempotent seed script to populate the 9 Phase 1 templates (`notif.workflow.step_assignment.in_app`, etc.).

## Group 2: Notification Engine
The core services that power the dispatch and real-time delivery of notifications.
- [ ] **TASK-NOTIF-003**: Implement the Server-Sent Events (SSE) infrastructure (`GET /api/notifications/stream`) to manage active user connections and push real-time updates.
- [ ] **TASK-NOTIF-004**: Implement the core `sendNotification()` dispatch service. Handles template variable substitution, writes to `notification_events`, and routes to the SSE engine or external handlers.

## Group 3: Event Consumers (The Triggers)
These tasks listen to domain events across the platform and trigger notifications via the dispatch service. These can be split easily once the Dispatch service (Task 004) is complete.
- [ ] **TASK-NOTIF-006**: **Step Assignment** (`workflow.step.started`) - Notifies the user assigned to a new step.
- [ ] **TASK-NOTIF-007**: **Document State Change** (`document.state_changed`) - Notifies the originating office when a document changes state.
- [ ] **TASK-NOTIF-008**: **SLA Escalations** (`workflow.sla.warning`, `breached`, `critical`) - Escalates overdue steps to assignees, supervisors, Records Officers, and Department Heads.
- [ ] **TASK-NOTIF-009**: **Legislative Timers** (`workflow.approval.lapsed`, `panlalawigan.deemed_approved`) - Alerts the SP Secretary with verbatim legal citations (RA 7160).
- [ ] **TASK-NOTIF-010**: **Complaint Respondent** - External recipient handler sending Nodemailer emails and logging manual phone-call fallbacks.
- [ ] **TASK-NOTIF-011**: **Session Security** (`session.terminated`) - Alerts users of forced session displacement (new device logins).

## Group 4: APIs & Integration
Wiring it all together and exposing the features to the frontend.
- [ ] **TASK-NOTIF-012**: **tRPC Router** - Implement `listMine`, `markAsRead`, `preferences`, and `listDeliveryLogs` with ABAC/role protection.
- [ ] **TASK-NOTIF-013**: **Fastify Plugin** - Register the SSE route, tRPC router, and all 8 event consumers at server startup.
- [ ] **TASK-NOTIF-014**: **Vitest Suite** - Write automated tests ensuring full coverage of the repository, service, SSE, router, and event consumers.
