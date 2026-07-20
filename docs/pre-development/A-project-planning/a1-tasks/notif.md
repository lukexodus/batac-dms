# NOTIF Module — Master Task List

**Generated:** 2026-07-20
**Module:** NOTIF (Notifications)
**Wave:** F — requires TASK-WF list (all TASK-WF IDs referenced herein are from `a1-tasks/wf.md`)
**Phase:** 1 (full spec)
**Source documents loaded (in order):**
1. `a1-skeleton.md` — structural contract
2. `a1-tasks/wf.md` — prerequisite module task list (TASK-WF IDs)
3. `h4-notification-event-and-template-catalog.md` — event/template domain catalog
4. `c1-full-database-schema-ddl-v3.md` §notifications — DDL
5. `e1-trpc-router-and-procedure-catalog.md` §notifications — tRPC procedures
6. `b2-module-boundary-and-internal-api-contracts-v1.1.md` — Module 7 boundary contract
7. `b3-internal-domain-event-catalog-v1.3.md` — Master Event Registry, §4/§6/§7 payload schemas

**Before writing any task**, the capability list for this module was identified from consolidated ref §13 Phase 1 ("In-app notifications — step assignment, overdue alerts") and cross-checked against H4's full 9-event catalog (§4.1–4.9), B2 Module 7's Events Consumed table, and B3's Master Event Registry (§8) directly — not taken on faith from any single source. See Module Summary for the full reconciliation.

---

## Table of Contents

- [L46–L149] TASK-NOTIF-001 — Drizzle schema and SQL migration for templates, notification events, and delivery log tables with a corrected recipient column.
- [L150–L201] TASK-NOTIF-002 — Barrel index, stub types, and repository data-access layer for the notifications database tables.
- [L202–L252] TASK-NOTIF-003 — SSE connection registry, push service, connection cleanup, and an authenticated stream endpoint for real-time in-app delivery.
- [L253–L338] TASK-NOTIF-004 — Core notification dispatch service handling template resolution, variable substitution, and barrel-exported Published API contract.
- [L339–L399] TASK-NOTIF-005 — Idempotent seed script inserting nine Phase 1 templates with starter copy, legal citations, and conflict handling.
- [L400–L478] TASK-NOTIF-006 — Event subscriber for workflow.step.started that notifies the assigned user with document details resolved from the Documents API.
- [L479–L543] TASK-NOTIF-007 — Event subscriber for document.state_changed using originating office fallback roles as a functional default.
- [L544–L622] TASK-NOTIF-008 — Escalation subscribers for three SLA tiers, resolving assignee, supervisor, Records Officer, and Department Head roles.
- [L623–L693] TASK-NOTIF-009 — Event subscribers for Mayor and Panlalawigan lapse timers, notifying the SP Secretary with verbatim legal citations.
- [L694–L738] TASK-NOTIF-010 — Dispatch extension for external complaint notifications using Nodemailer for email and logging fallback for phone calls.
- [L739–L797] TASK-NOTIF-011 — Event subscriber notifying displaced users on forced session termination, including the required B3 registry registration.
- [L798–L915] TASK-NOTIF-012 — Four tRPC procedures (listMine, markAsRead, preferences, listDeliveryLogs) protected by the standard ABAC and role middleware chain.
- [L916–L969] TASK-NOTIF-013 — Fastify plugin wiring the SSE route, tRPC router, and eight event subscriptions at server startup.
- [L970–L1010] TASK-NOTIF-014 — Vitest suite covering repository, service, SSE, router, and all consumer logic across seven priority testing areas.
- [L1011–L1181] Module Summary — NOTIF — High-level overview of total tasks, wave dependency details, and first executable task prerequisites.
  - [L1021–L1030] Document Conflicts Resolved at Generation Time — Details of resolved conflicts regarding the recipient identifier, template lookup key, and initial planning counts.
  - [L1031–L1098] Confirmed Spec Gaps — Unresolved specification gaps including urgency bypass alerts, cutoff warnings, template CRUD, and trilingual schema support.
  - [L1099–L1141] Deferred Capabilities — Features deferred to later development phases, including email notifications, SMS gateway integration, and future document types.
  - [L1142–L1152] Cross-Module Reference Placeholders (for Step 4 Integration Pass) — Outlines cross-module placeholders for the DOCS and IAM event emitters to be resolved during integration.
  - [L1153–L1172] Task Dependency Graph — Visual dependency diagram mapping workflow prerequisites and execution order of all NOTIF tasks.
  - [L1173–L1181] Cross-Validation Log — Verification checklist documenting source cross-checks, API signature validations, and payload schema alignment testing.

---

## TASK-NOTIF-001

Phase:          1
Module:         NOTIF
Title:          [MIGRATION] Create notifications schema — templates, notification events, delivery log
Prerequisites:  [NONE]
Deliverables:
  - /packages/database/src/schema/notifications.schema.ts — Drizzle schema definitions for all 3 `notifications` schema tables: `notifications.templates`, `notifications.notification_events`, `notifications.delivery_log`. No native PostgreSQL enums (per C1 §1.6, only the `workflow` schema uses native enums); all constrained columns use `TEXT NOT NULL CHECK (... IN (...))`.
  - /packages/database/migrations/{NNN}_notifications_create_schema.sql — generated SQL migration from `pnpm db:generate`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes across the monorepo
  - [ ] `pnpm db:generate` produces a migration creating the `notifications` schema and exactly 3 tables, 3 indexes (`idx_notification_events_template`, `idx_notification_events_recipient`, `idx_delivery_log_event`), and the `trg_templates_set_updated_at` trigger
  - [ ] `pnpm db:migrate` applies cleanly against a fresh local database
  - [ ] `notifications.notification_events.recipient_user_id` exists (NOT `recipient_employee_id` — see Module Summary conflict #1); logical FK → `iam.users.id`, documented with an inline comment per §1.1
  - [ ] `notifications.delivery_log` has no `updated_at` column and no trigger (append-only per C1 §1.4, explicitly listed as an exception)
  - [ ] `notifications.templates` has a `UNIQUE (city_id, name, channel)` constraint
  - [ ] Manual: `psql` → `\dt notifications.*` shows exactly 3 tables; `\d notifications.notification_events` shows `recipient_user_id` (not `recipient_employee_id`)
AI Prompt:
  > You are creating the Drizzle schema and migration for the `notifications` PostgreSQL schema for the Batac City LGU Platform.
  >
  > **Base DDL (C1 Part 9), with one corrected column — see below for why:**
  > ```sql
  > CREATE TABLE notifications.templates (
  >     id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  >     city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  >     name             TEXT        NOT NULL,
  >     channel          TEXT        NOT NULL CHECK (channel IN ('in_app','email','sms')),
  >     subject_template TEXT        NULL,
  >     body_template    TEXT        NOT NULL,
  >     is_active        BOOLEAN     NOT NULL DEFAULT true,
  >     -- created_by: logical FK → iam.users.id (cross-schema); Platform Admin, Tier 2
  >     created_by       UUID        NULL,
  >     created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  >     updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  >     deleted_at       TIMESTAMPTZ NULL,
  >     deleted_by       UUID        NULL,
  >     CONSTRAINT uq_templates_city_name_channel UNIQUE (city_id, name, channel)
  > );
  >
  > CREATE TRIGGER trg_templates_set_updated_at
  >     BEFORE UPDATE ON notifications.templates
  >     FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
  >
  > CREATE TABLE notifications.notification_events (
  >     id                    UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  >     city_id               UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  >     template_id           UUID        NOT NULL REFERENCES notifications.templates(id),
  >     channel               TEXT        NOT NULL CHECK (channel IN ('in_app','email','sms')),
  >     -- recipient_user_id: logical FK → iam.users.id (cross-schema) — CORRECTED, see note below
  >     recipient_user_id     UUID        NULL,
  >     recipient_email       TEXT        NULL,
  >     recipient_phone       TEXT        NULL,
  >     template_data         JSONB       NULL,
  >     status                TEXT        NOT NULL DEFAULT 'pending'
  >                               CHECK (status IN ('pending','sent','failed','cancelled')),
  >     triggered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  >     source_event_type     TEXT        NULL,
  >     created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  >     deleted_at            TIMESTAMPTZ NULL,
  >     deleted_by            UUID        NULL
  > );
  >
  > CREATE INDEX idx_notification_events_template  ON notifications.notification_events(template_id);
  > CREATE INDEX idx_notification_events_recipient ON notifications.notification_events(recipient_user_id);
  >
  > -- Append-only: no updated_at (§1.4).
  > CREATE TABLE notifications.delivery_log (
  >     id                    UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  >     city_id               UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  >     notification_event_id UUID        NOT NULL REFERENCES notifications.notification_events(id),
  >     attempt_count         INTEGER     NOT NULL DEFAULT 1,
  >     status                TEXT        NOT NULL CHECK (status IN ('delivered','bounced','failed')),
  >     delivered_at          TIMESTAMPTZ NULL,
  >     error_message         TEXT        NULL,
  >     created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  >     deleted_at            TIMESTAMPTZ NULL,
  >     deleted_by            UUID        NULL
  > );
  >
  > CREATE INDEX idx_delivery_log_event ON notifications.delivery_log(notification_event_id);
  > ```
  >
  > **CORRECTION APPLIED — read before implementing:** C1 Part 9's literal DDL names the recipient column `recipient_employee_id` (logical FK → `organization.employees.id`). This is corrected to `recipient_user_id` (logical FK → `iam.users.id`) above. Do not use the C1 literal column name. Rationale (full detail in Module Summary conflict #1): E1's `notifications` router uses `recipient_user_id`/`recipientUserId` consistently across 3 of its 4 procedures, matching `subject.user_id` from the session; B2's `IAMPublicAPI.getUserById(userId)` is explicitly documented as "Called by ... Notifications (recipient addressing)"; B2's own `NotificationInput.recipientUserId?: string` confirms it a third time; and the upstream event payload this table records against (`workflow.step.started.assignedTo`) is itself a `user_id`, per B3 §7.11. No document anywhere describes an `employee_id` resolution step. This is a documented correction to C1, which needs a companion DDL edit in the live C1 document — flag this to whoever owns C1 if not already fixed.
  >
  > **Column naming note:** C1 calls this table's lookup identifier `name`; H4 (the domain catalog) calls the same concept `template_key` throughout (e.g. `notif.workflow.step_assignment.in_app`). They are the same column — H4's `template_key` values are what gets stored in `templates.name`. Use `name` as the literal column name in code; you may name the corresponding TypeScript/Zod field `name` or alias it as `templateKey` in application code, but the DB column is `name`.
  >
  > **Conventions (C1 §1.1–§1.11) applying here:**
  > - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` on every table
  > - `city_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid` tenant sentinel on every table (not a FK — do not omit from inserts)
  > - No cross-schema FK constraints — `recipient_user_id`, `deleted_by`, `created_by` are plain UUID columns with inline comments only
  > - Soft delete (`deleted_at`, `deleted_by`) on `templates` and `notification_events`; `delivery_log` also gets soft-delete columns per the DDL above even though it has no `updated_at` — these are two independent conventions (append-only ≠ non-deletable), don't conflate them
  > - All CHECK-constrained values are `lower_snake_case`
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes across the monorepo
  > - [ ] `pnpm db:generate` produces a migration creating the `notifications` schema and exactly 3 tables, 3 indexes, and the `trg_templates_set_updated_at` trigger
  > - [ ] `pnpm db:migrate` applies cleanly against a fresh local database
  > - [ ] `notifications.notification_events.recipient_user_id` exists (NOT `recipient_employee_id`); logical FK → `iam.users.id`
  > - [ ] `notifications.delivery_log` has no `updated_at` column and no trigger
  > - [ ] `notifications.templates` has a `UNIQUE (city_id, name, channel)` constraint
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-002

Phase:          1
Module:         NOTIF
Title:          Scaffold NOTIF module file structure and repository layer
Prerequisites:  [TASK-NOTIF-001]
Deliverables:
  - /apps/server/src/modules/notifications/index.ts — barrel file; exports only the `NotificationsPublicAPI` type/interface (implementation wired in TASK-NOTIF-004, TASK-NOTIF-013) per B2's module-isolation rule — no internal files re-exported
  - /apps/server/src/modules/notifications/notifications.types.ts — typed stubs: `NotificationInput`, `TemplateRecord`, `NotificationEventRecord`, `DeliveryLogRecord`
  - /apps/server/src/modules/notifications/notifications.repository.ts — repository layer over all 3 `notifications.*` tables: `findActiveTemplateByNameAndChannel(name, channel)`, `insertNotificationEvent(data)`, `updateNotificationEventStatus(id, status)`, `insertDeliveryLogEntry(data)`, `listNotificationsForUser(userId, opts)`, `markNotificationRead(id, userId)`, `listDeliveryLogs(opts)`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Repository functions target only the `notifications` schema via the Drizzle client from TASK-NOTIF-001 — no import from any other module's schema file
  - [ ] The monorepo's automated coupling test suite (per B2 Enforcement Mechanisms) passes with no new violations
  - [ ] `notifications/index.ts` exports zero concrete implementations, only the `NotificationsPublicAPI` interface type
  - [ ] Manual: `grep -r "from '.*modules/notifications/notifications\." apps/server/src/modules/` outside this module returns no matches (nothing reaches past the barrel)
AI Prompt:
  > You are scaffolding the `notifications` module's file structure and data-access layer for the Batac City LGU Platform, following the same structural pattern already established by the `workflow`, `documents`, `tracking`, `iam`, and `audit` modules (each module directory: a barrel `index.ts`, a `.types.ts` or `.schemas.ts`, a `.repository.ts`, later a `.service.ts`, `.router.ts`, `.plugin.ts`).
  >
  > **Architectural Law #2 (B2 Enforcement Model):** this module owns exactly one PostgreSQL schema (`notifications`). Its Drizzle queries target only that schema. No module may import another module's repository, schema definition files, or internal services. The barrel file (`index.ts`) exports **only** the Published API interface — internal files are never re-exported.
  >
  > **Types to define in `notifications.types.ts`:**
  > ```typescript
  > export interface NotificationInput {
  >   recipientUserId?: string;       // for authenticated internal system users
  >   recipientEmail?: string;        // for external recipients (e.g. complaint respondents)
  >   recipientPhone?: string;        // Phase 3 — SMS gateway; Phase 1/2 logs phone_call_required
  >   templateId: string;             // the template's `name` column value (H4 calls this "template_key"), e.g. 'notif.workflow.step_assignment.in_app'
  >   templateData: Record<string, string>;  // variable substitutions for the template body
  >   channel: 'in_app' | 'email' | 'sms';
  > }
  > ```
  > This mirrors B2 Module 7's `NotificationInput` interface exactly (field-for-field), which is the input shape for the `sendNotification()` Published API method built in TASK-NOTIF-004.
  >
  > **Repository responsibilities (no business logic here — pure data access):**
  > - `findActiveTemplateByNameAndChannel(name: string, channel: string)` — `SELECT * FROM notifications.templates WHERE name = $1 AND channel = $2 AND is_active = true AND deleted_at IS NULL`
  > - `insertNotificationEvent(data)` — inserts a row into `notification_events`, returns the created row (including its `id`, needed by the delivery log)
  > - `updateNotificationEventStatus(id, status)` — updates `notification_events.status` (`'pending' | 'sent' | 'failed' | 'cancelled'`)
  > - `insertDeliveryLogEntry(data)` — inserts a row into `delivery_log` (`status: 'delivered' | 'bounced' | 'failed'`)
  > - `listNotificationsForUser(userId, { unreadOnly, cursor, pageSize })` — backs `notifications.listMine` (TASK-NOTIF-012); filters `WHERE recipient_user_id = $1`
  > - `markNotificationRead(id, userId)` — backs `notifications.markAsRead`; must verify `recipient_user_id = userId` before updating (ABAC enforced again at the router layer, but the repository should not silently update another user's row even if called incorrectly)
  > - `listDeliveryLogs(opts)` — backs `notifications.listDeliveryLogs`; no recipient filter (Sys Admin/Plat Admin only, enforced at router layer)
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] Repository functions target only the `notifications` schema — no cross-module schema import
  > - [ ] The monorepo's automated coupling test suite passes with no new violations
  > - [ ] `notifications/index.ts` exports zero concrete implementations, only the `NotificationsPublicAPI` interface type
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-003

Phase:          1
Module:         NOTIF
Title:          Implement SSE delivery infrastructure for in-app notifications
Prerequisites:  [TASK-NOTIF-002]
Deliverables:
  - /apps/server/src/modules/notifications/notifications.sse.ts — SSE connection registry (`Map<userId, ServerResponse[]>`, supporting multiple simultaneous tabs/devices per user), `pushToUser(userId, payload)` function, and a Fastify route handler at `GET /api/notifications/stream` that upgrades to an SSE connection, authenticates via the existing `verifyAccessToken` middleware, and registers/deregisters the connection on open/close
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `pushToUser(userId, payload)` for a connected user writes a well-formed SSE frame (`data: <JSON>\n\n`) to every open connection for that user
  - [ ] `pushToUser(userId, payload)` for a user with zero open connections is a silent no-op — does not throw, does not queue (Phase 1 has no offline queue; the notification row in `notification_events` is the durable record, not the SSE delivery itself)
  - [ ] Connection cleanup: closing the HTTP connection (client disconnect) removes the entry from the registry — verified by a test that opens, closes, and confirms the registry no longer holds a reference (no memory leak)
  - [ ] `GET /api/notifications/stream` without a valid JWT returns `401` before upgrading to SSE
  - [ ] Manual: `curl -N -H "Authorization: Bearer <valid JWT>" https://localhost:PORT/api/notifications/stream` stays open; triggering `pushToUser` for that user from a separate script prints the event in the curl terminal within 1 second
AI Prompt:
  > You are implementing the Server-Sent Events (SSE) delivery infrastructure for the `notifications` module — the sole Phase 1 delivery mechanism for in-app notifications (H4 §3.1; tech-stack.md).
  >
  > **Why SSE, not WebSockets:** confirmed in tech-stack.md and H4 §3.1 — SSE is a one-directional server-push mechanism requiring no WebSocket infrastructure. This is a deliberate, already-made stack decision; do not substitute WebSockets.
  >
  > **Connection registry design:**
  > - A user may have multiple simultaneous connections (multiple browser tabs, or desktop + mobile). Register connections in a `Map<string, Response[]>` keyed by `userId`, with an array of open response streams per user.
  > - On new connection: push the new `Response` object onto that user's array (create the array if this is their first connection).
  > - On connection close (`request.raw.on('close', ...)`- Fastify convention): remove that specific `Response` from the array; if the array becomes empty, delete the map entry entirely (prevents unbounded memory growth from stale empty arrays).
  >
  > **`pushToUser(userId: string, payload: unknown)`:**
  > ```typescript
  > export function pushToUser(userId: string, payload: unknown): void {
  >   const connections = registry.get(userId);
  >   if (!connections || connections.length === 0) return; // silent no-op — no offline queue in Phase 1
  >   const frame = `data: ${JSON.stringify(payload)}\n\n`;
  >   for (const res of connections) {
  >     res.write(frame);
  >   }
  > }
  > ```
  >
  > **Route:** `GET /api/notifications/stream`, built on the same `protectedProcedure`-equivalent middleware chain used elsewhere (E1 Global Conventions §3: `verifyAccessToken` populates `ctx.subject` from the JWT). This is a raw Fastify route (not a tRPC procedure — tRPC doesn't support long-lived streaming connections in this stack), but it must still authenticate via the same JWT verification used everywhere else. Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. Send an initial comment line (`: connected\n\n`) immediately on open so the client knows the stream is live.
  >
  > **Durability note (important for correctness elsewhere in this module):** SSE delivery is best-effort and ephemeral. The durable record of "this notification happened" is always the `notification_events` row (written by TASK-NOTIF-004's dispatch service) — SSE push is a real-time convenience layer on top of that, not the source of truth. A user who was offline when a notification fired will see it via `notifications.listMine` (TASK-NOTIF-012) on their next visit, even though they never received a live SSE push for it.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `pushToUser` writes a well-formed SSE frame to every open connection for a connected user
  > - [ ] `pushToUser` for a user with zero connections is a silent no-op
  > - [ ] Connection cleanup on client disconnect removes the registry entry (no leak)
  > - [ ] `GET /api/notifications/stream` without a valid JWT returns `401` before upgrading
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-004

Phase:          1
Module:         NOTIF
Title:          Implement core notification dispatch service and Published API
Prerequisites:  [TASK-NOTIF-002, TASK-NOTIF-003]
Deliverables:
  - /apps/server/src/modules/notifications/notifications.service.ts — `sendNotification(input: NotificationInput): Promise<void>` core dispatch logic: template lookup, `{{variable}}` substitution, channel routing (`in_app` → TASK-NOTIF-003's `pushToUser`; `email`/`sms` → stub for TASK-NOTIF-010), `notification_events` + `delivery_log` writes
  - /apps/server/src/modules/notifications/notifications.public-api.ts — the concrete `NotificationsPublicAPI` implementation (single method: `sendNotification`), assembled into `index.ts`'s barrel export
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `sendNotification({ recipientUserId, templateId: 'notif.workflow.step_assignment.in_app', templateData, channel: 'in_app' })` against a seeded active template writes exactly 1 `notification_events` row (`status: 'sent'`) and exactly 1 `delivery_log` row (`status: 'delivered'`)
  - [ ] `sendNotification()` where no active template matches `(name, channel)` sets `notification_events.status = 'failed'`, writes a `delivery_log` row with `status: 'failed'` and a descriptive `error_message` — does not throw an unhandled exception (per B3 §2.4/§9 Rule 5: downstream handler failures must not propagate back and break the emitting module's transaction)
  - [ ] Template variable substitution: `{{variableName}}` tokens in `body_template` are replaced from `templateData`; a token with no matching key in `templateData` is left as literal text (does not throw) and is logged as a warning
  - [ ] `in_app` channel dispatch calls `pushToUser` (TASK-NOTIF-003) after the `notification_events` row commits — SSE push happens only after durable persistence, never before
  - [ ] Manual: seed one template (borrow from TASK-NOTIF-005 if sequenced after it, or insert one manually for this test), call `sendNotification` directly via a script, confirm the row in `notifications.notification_events` and a live SSE client (per TASK-NOTIF-003's manual test) both receive it
AI Prompt:
  > You are implementing the core notification dispatch service for the `notifications` module — the single function that every event consumer (TASK-NOTIF-006 through -011) and every external caller (Portal, via the Published API) routes through. This is the module's only Published API method.
  >
  > **Published API contract (B2 Module 7, verbatim):**
  > ```typescript
  > interface NotificationsPublicAPI {
  >   /**
  >    * Send a notification programmatically from outside the event bus flow.
  >    * Most notifications are triggered by event bus subscriptions (TASK-NOTIF-006
  >    * through -011). This method is the synchronous path for cases where the
  >    * caller needs delivery confirmation before proceeding, or where there is no
  >    * associated domain event. Primary caller: Portal module's Respondent Notice
  >    * Service (not yet built — Portal is Wave G; this API surface must exist and
  >    * be stable before that module's Step 2 pass runs).
  >    */
  >   sendNotification(input: NotificationInput): Promise<void>;
  > }
  > ```
  >
  > **`NotificationInput` (from TASK-NOTIF-002's `notifications.types.ts`):**
  > ```typescript
  > interface NotificationInput {
  >   recipientUserId?: string;
  >   recipientEmail?: string;
  >   recipientPhone?: string;
  >   templateId: string;              // matches templates.name — see TASK-NOTIF-001's naming note
  >   templateData: Record<string, string>;
  >   channel: 'in_app' | 'email' | 'sms';
  > }
  > ```
  >
  > **Dispatch algorithm:**
  > ```
  > 1. Look up template: repository.findActiveTemplateByNameAndChannel(input.templateId, input.channel).
  >    If none found: insert notification_events row with status='failed', source_event_type=null,
  >    insert delivery_log row status='failed' error_message='No active template for <templateId>/<channel>'.
  >    Log a warning. Return (do not throw).
  > 2. Render body: substitute {{variableName}} tokens in template.body_template from input.templateData.
  >    Unmatched tokens are left as literal text; log a warning per unmatched token, do not throw.
  > 3. Insert notification_events row:
  >    { template_id: template.id, channel: input.channel, recipient_user_id: input.recipientUserId ?? null,
  >      recipient_email: input.recipientEmail ?? null, recipient_phone: input.recipientPhone ?? null,
  >      template_data: input.templateData, status: 'pending', source_event_type: <caller-supplied, optional> }
  > 4. Dispatch by channel:
  >    - 'in_app': call pushToUser(input.recipientUserId, { notificationId, renderedBody, ... }) — TASK-NOTIF-003.
  >      SSE push is fire-and-forget; it does not affect notification_events.status or delivery_log.status,
  >      since a missing live connection is not a delivery failure in Phase 1 (see TASK-NOTIF-003's durability note).
  >    - 'email' / 'sms': delegate to TASK-NOTIF-010's channel handler (stub a clear TODO/interface boundary here;
  >      TASK-NOTIF-010 implements the concrete email/phone-fallback logic and calls back into this same
  >      notification_events row via its id).
  > 5. Update notification_events.status = 'sent' (in_app: once pushed to registry, regardless of live-connection
  >    outcome, since durability = row write, not live delivery — see TASK-NOTIF-003).
  > 6. Insert delivery_log row: { notification_event_id, status: 'delivered', delivered_at: NOW() } for the
  >    in_app happy path. (Channel-specific delivery_log semantics for email/sms are TASK-NOTIF-010's concern.)
  > ```
  >
  > **Error handling — B3 §2.4 / §9 Rule 5 applies here even though this module doesn't emit events:** this service is itself a downstream consumer of every workflow/document/iam event. A failure inside `sendNotification` must never propagate up and fail the emitting module's transaction (the emitting module has already committed by the time this runs — see B3 §2.4: "Events are emitted synchronously within the database transaction... After the transaction commits, the event bus notifies downstream subscribers asynchronously. Downstream handler failures do not roll back the originating state change; consumers must implement their own retry logic."). Wrap the dispatch algorithm's steps in a try/catch at the consumer-handler level (TASK-NOTIF-006 etc. call this service inside their own error boundary); this service itself should not throw for ordinary failure modes (missing template, SSE push failure) — reserve thrown exceptions for genuine programming errors (e.g. malformed input that fails Zod validation).
  >
  > **`recipientUserId` vs C1's literal `recipient_employee_id`:** use `recipient_user_id` throughout (per TASK-NOTIF-001's correction). Do not add an Organization Published API lookup to translate to an employee ID — no such translation is described anywhere in the source documents, and three independent documents (E1, B2's `getUserById`, B2's own `NotificationInput`) confirm the recipient identity is a plain `iam.users.id`.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `sendNotification` against a seeded active template writes exactly 1 `notification_events` row (status: 'sent') and 1 `delivery_log` row (status: 'delivered') for the in_app happy path
  > - [ ] Missing-template case sets status='failed' on both rows without throwing
  > - [ ] Unmatched `{{variable}}` tokens are left literal and logged, not thrown
  > - [ ] SSE push happens only after the `notification_events` row commits
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-005

Phase:          1
Module:         NOTIF
Title:          Seed Phase 1 notification templates — nine template records
Prerequisites:  [TASK-NOTIF-001]
Deliverables:
  - /packages/database/src/seed/notifications.seed.ts — idempotent seed script inserting the 9 Phase 1 template rows (T-01, T-03 through T-10 — **not** T-02, which is Phase-2-only) into `notifications.templates`, upserting on the `(city_id, name, channel)` unique constraint
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm db:seed` inserts exactly 9 rows into `notifications.templates`
  - [ ] Every row's `name` value matches one of H4's 9 confirmed Phase 1 template keys exactly (listed in AI Prompt below) — no typos, no invented keys
  - [ ] `notif.workflow.step_assignment.email` (T-02, Phase 2) is **not** seeded
  - [ ] Every seeded row has `is_active = true`
  - [ ] Re-running `pnpm db:seed` twice does not create duplicate rows (upsert, not insert)
  - [ ] Manual: `SELECT name, channel, is_active FROM notifications.templates ORDER BY name;` returns exactly 9 rows, all `is_active = true`, `channel` values matching the table below
AI Prompt:
  > You are seeding the Phase 1 notification template records for the `notifications` module, per H4 §5 (Template Catalog) and §6 (Mapping table).
  >
  > **Templates are administrator-configurable** (H4 §8.1) — this task seeds the row *structure* (`name`, `channel`, `is_active`) with minimal, functional starter body text so the system is usable on day one; final wording is expected to be edited by the Platform Administrator post-deployment via the admin interface (not yet built — see Module Summary spec gap on template CRUD). Do not treat the seeded `body_template` text as final copy — keep it short, functional, and clearly using every documented payload variable so an administrator has a working example to edit from.
  >
  > **The 9 Phase 1 rows to seed (H4 §5, §6):**
  >
  > | `name` (= H4's "template_key") | `channel` | Payload variables available (for `body_template` placeholders) |
  > |---|---|---|
  > | `notif.workflow.step_assignment.in_app` | `in_app` | `{{instanceId}}`, `{{stepInstanceId}}`, `{{stepType}}`, `{{stepKey}}`, `{{assignedTo}}`, `{{documentId}}`, `{{dueAt}}` |
  > | `notif.document.state_changed.in_app` | `in_app` | `{{documentId}}`, `{{fromState}}`, `{{toState}}`, `{{actorId}}`, `{{reason}}` |
  > | `notif.workflow.sla_warning.in_app` | `in_app` | `{{instanceId}}`, `{{stepInstanceId}}`, `{{slaDeadline}}`, `{{percentElapsed}}` (always `80`) |
  > | `notif.workflow.sla_breach.in_app` | `in_app` | `{{instanceId}}`, `{{stepInstanceId}}`, `{{slaDeadline}}`, `{{breachedAt}}`, `{{breachDetectedAt}}` |
  > | `notif.workflow.sla_critical.in_app` | `in_app` | `{{instanceId}}`, `{{stepInstanceId}}`, `{{slaDeadline}}`, `{{percentElapsed}}` (always `150`) |
  > | `notif.workflow.mayor_lapse.in_app` | `in_app` | `{{stepInstanceId}}`, `{{legalBasis}}` (verbatim `"RA 7160 Section 47"`), `{{deadlineWas}}` |
  > | `notif.workflow.panlalawigan_deemed_approved.in_app` | `in_app` | `{{stepInstanceId}}`, `{{legalBasis}}` (verbatim `"RA 7160 Section 56(d)"`), `{{transmissionDate}}`, `{{deadlineWas}}` |
  > | `notif.complaint.respondent_notice.email` | `email` | `{{respondentName}}`, `{{complaintReference}}`, `{{complaintSubject}}`, `{{lguOffice}}`, `{{secretariatContactInfo}}` |
  > | `notif.iam.session_displaced.in_app` | `in_app` | `{{sessionId}}`, `{{userId}}`, `{{reason}}` (`'forced'` for this trigger) |
  >
  > **Do NOT seed** `notif.workflow.step_assignment.email` — that is T-02, explicitly Phase 2 (H4 §5.3).
  >
  > **Legal basis phrases are verbatim and immutable (H4 §8.6):** the Mayor-lapse and Panlalawigan-deemed-approved templates must include `"RA 7160 Section 47"` and `"RA 7160 Section 56(d)"` respectively, character-for-character, in the seeded starter body text — these are legally mandated phrases, not administrator-editable wording.
  >
  > **`notif.complaint.respondent_notice.email` subject:** set `subject_template` (this is the only seeded row where `subject_template` is non-null — all `in_app` rows have `subject_template = NULL`, since `in_app` notifications have no subject line per C1/H4 §5.1). Suggested starter: `"Notice Regarding Complaint {{complaintReference}} — {{lguOffice}}"`.
  >
  > **Upsert pattern (idempotency):**
  > ```typescript
  > await db.insert(templates).values(seedRows)
  >   .onConflictDoUpdate({
  >     target: [templates.cityId, templates.name, templates.channel],
  >     set: { /* only update is_active and updated_at on conflict — never overwrite an admin's edited body_template */ isActive: true },
  >   });
  > ```
  > Note the deliberate asymmetry: on conflict, only flip `is_active` back to `true` if needed — do **not** overwrite `body_template`/`subject_template` on re-seed, since an administrator may have already edited that content in a real environment. Re-running this seed must never clobber admin edits.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `pnpm db:seed` inserts exactly 9 rows
  > - [ ] Every `name` matches the table above exactly, and T-02 is excluded
  > - [ ] All 9 rows have `is_active = true`
  > - [ ] Re-running seed does not duplicate rows or overwrite body text on conflict
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-006

Phase:          1
Module:         NOTIF
Title:          Implement Step Assignment event consumer
Prerequisites:  [TASK-WF-005, TASK-NOTIF-004]
Deliverables:
  - /apps/server/src/modules/notifications/consumers/step-assignment.consumer.ts — event bus subscriber for `workflow.step.started`; resolves document display details via `Documents.getDocumentById()`, calls `sendNotification()` with `templateId: 'notif.workflow.step_assignment.in_app'`, `channel: 'in_app'`; no-ops when `assignedTo` is null
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Subscribing to `workflow.step.started` with `assignedTo` non-null calls `sendNotification` exactly once, with `recipientUserId = payload.assignedTo` and `templateData` containing all 7 payload fields (`instanceId`, `stepInstanceId`, `stepType`, `stepKey`, `assignedTo`, `documentId`, `dueAt`)
  - [ ] `assignedTo === null` (system-executed `decision`/`notification` steps) results in **no** call to `sendNotification` — verified by a test asserting zero calls
  - [ ] `dueAt === null` (step types with no due date) does not throw — the field is passed through as an empty string or omitted from `templateData`, template rendering handles its absence gracefully
  - [ ] Handler failure (e.g. `Documents.getDocumentById` throwing) is caught locally and logged — does not crash the event bus subscriber process or affect other subscribers
  - [ ] Manual: trigger a `workflow.step.started` event via a test harness with a known `assignedTo` user, confirm that user receives an SSE push (per TASK-NOTIF-003's live-client test) containing the document's series number, not just its raw UUID
AI Prompt:
  > You are implementing the Step Assignment notification — the highest-volume Phase 1 notification event (H4 §4.1).
  >
  > **Subscribe to `workflow.step.started`.** Consumer is registered per B3's Master Event Registry row 24: `notifications`, `audit` are its confirmed consumers. Emitted by TASK-WF-005 (`engine.createInstance` and step-resolution's step-activation path), within the committing transaction.
  >
  > **Payload schema (B3 §7.11, canonical — do not use B2's older `workflow.step_assigned` name or its narrower field set):**
  > ```typescript
  > interface WorkflowStepStartedPayload {
  >   instanceId: string;      // uuid
  >   stepInstanceId: string;  // uuid
  >   stepType: 'action' | 'approval' | 'multi_referral' | 'decision' | 'notification' | 'termination' | 'parallel_split' | 'parallel_join';
  >   stepKey: string;
  >   assignedTo: string | null;   // uuid; null for system-executed steps
  >   documentId: string;          // uuid — REQUIRED, always present
  >   dueAt: string | null;        // ISO 8601 datetime; field always present, value nullable
  > }
  > ```
  >
  > **Handler logic:**
  > ```
  > 1. If payload.assignedTo === null: return immediately. No notification for system-executed steps
  >    (decision/notification step types auto-execute with no human assignee).
  > 2. Resolve document display details: call Documents.getDocumentById(payload.documentId) — the Documents
  >    module's Published API (per B2 Module 3; also directly confirmed as the pattern WF's own engine already
  >    uses in TASK-WF-005 for the same call). This module cannot compose a useful notification body from a
  >    raw UUID alone (H4 §4.1's explicit rationale for why documentId is required in the payload at all).
  >    Returned shape includes at minimum: documentId, documentTypeName, title, preliminaryNumber, finalNumber
  >    (per the DocumentSummary shape WF's own TASK-WF-005 AI Prompt already establishes as the confirmed,
  >    though currently gap-flagged, Published API return shape — see that task's [Unverified] note on
  >    DocumentSummary; this consumer has the same dependency and should flag the same gap if it still exists
  >    at implementation time rather than silently working around it).
  > 3. Call sendNotification({
  >      recipientUserId: payload.assignedTo,
  >      templateId: 'notif.workflow.step_assignment.in_app',
  >      channel: 'in_app',
  >      templateData: {
  >        instanceId: payload.instanceId,
  >        stepInstanceId: payload.stepInstanceId,
  >        stepType: payload.stepType,
  >        stepKey: payload.stepKey,
  >        assignedTo: payload.assignedTo,
  >        documentId: payload.documentId,
  >        dueAt: payload.dueAt ?? '',
  >        documentTitle: <resolved from step 2>,       // enrichment beyond the raw event payload
  >        documentSeriesNumber: <resolved from step 2>, // preliminaryNumber or finalNumber, whichever is set
  >      },
  >    });
  > 4. Wrap steps 2–3 in try/catch. On failure: log the error with stepInstanceId and documentId for
  >    traceability; do not rethrow (per B3 §2.4/§9 Rule 5 — this is an async downstream handler; its
  >    failure must not affect the workflow engine's already-committed transaction).
  > ```
  >
  > **Recipient identity:** `payload.assignedTo` is already a `user_id` (per WF's assignee-resolution algorithm, TASK-WF-005, which explicitly returns `{ user_id, resolved_via }[]`). Pass it directly as `recipientUserId` — no translation needed (see TASK-NOTIF-001/004's resolution of the recipient identity conflict).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `assignedTo` non-null calls `sendNotification` exactly once with all 7 payload fields present in `templateData`
  > - [ ] `assignedTo === null` results in zero calls to `sendNotification`
  > - [ ] `dueAt === null` does not throw
  > - [ ] Handler failure is caught and logged locally, does not crash the subscriber process
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-007

Phase:          1
Module:         NOTIF
Title:          Implement Document State Change event consumer
Prerequisites:  [CROSS-MODULE REF: DOCS — task list not yet supplied; TASK-NOTIF-004]
Deliverables:
  - /apps/server/src/modules/notifications/consumers/document-state-changed.consumer.ts — event bus subscriber for `document.state_changed`; recipient logic is template-driven per H4 §4.2 (not hardcoded); calls `sendNotification()` with `templateId: 'notif.document.state_changed.in_app'`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Subscribing to `document.state_changed` calls `sendNotification` with `templateData` containing all 5 payload fields (`documentId`, `fromState`, `toState`, `actorId`, `reason`)
  - [ ] `reason` field absent in the payload (optional per schema) does not throw — passed through as empty string
  - [ ] The transitioning `actorId` does not automatically become the recipient (H4 §4.2: "The actorId who triggered the transition does not automatically receive a notification") — verified by a test where `actorId` and the resolved recipient differ
  - [ ] Handler failure is caught and logged locally, does not crash the subscriber process
  - [ ] Manual: trigger a `Draft → Submitted` document state change via a test harness, confirm a notification row is written with the correct `fromState`/`toState` values
AI Prompt:
  > You are implementing the Document State Change notification consumer (H4 §4.2).
  >
  > **Subscribe to `document.state_changed`.** Confirmed consumer per B3's Master Event Registry row 10 (`tracking`, `notifications`, `audit`, `search_meta` [Phase 2], `portal` [Phase 3]) and independently confirmed in Documents' own Events Emitted table (B2 Module 3): `document.state_changed → Tracking (routing history entry), Notifications, Search Meta [Phase 1 no-op; Phase 2 sync], Portal [Phase 3], Audit`.
  >
  > **Payload schema (B3 §6.2, canonical):**
  > ```typescript
  > interface DocumentStateChangedPayload {
  >   documentId: string;   // uuid
  >   fromState: 'Draft' | 'Submitted' | 'In-Workflow' | 'Pending-Approval' | 'Completed' | 'Released' | 'Archived' | 'Disposed' | 'Cancelled';
  >   toState: 'Draft' | 'Submitted' | 'In-Workflow' | 'Pending-Approval' | 'Completed' | 'Released' | 'Archived' | 'Disposed' | 'Cancelled';
  >   actorId: string;      // uuid
  >   reason?: string;      // optional
  > }
  > ```
  >
  > **Recipient logic — deliberately not hardcoded here (H4 §4.2):** "Determined by the transition type, the document's originating office, and the document's classification level. Exact recipient logic is template-driven and administrator-configurable." This is a genuine architectural instruction, not an omission: unlike Step Assignment (single, payload-carried recipient) or the SLA events (fixed role-based escalation), Document State Change's recipient set varies by which transition fired and is meant to be resolved by administrator configuration, not application code. **No pre-dev document specifies the concrete recipient-resolution mechanism** (e.g., a per-transition-type recipient-role config table) beyond this instruction. For this task: implement the event subscription, payload handling, and the `sendNotification()` call itself, but resolve the recipient as **the document's `originatingOfficeId`'s office-level fallback role** (per the same `office_role:` assignee-expression pattern WF's engine already uses — B4 §3.5, as excerpted in TASK-WF-005) as a functional Phase 1 default, and leave a clearly marked `// TODO(NOTIF): recipient resolution here is a functional default, not the full "administrator-configurable per transition type" design H4 §4.2 describes — no concrete config-table design exists yet in the source documents` comment at the resolution point. Do not silently invent a full configurable-recipient-matrix feature; that is out of scope for a self-contained Phase 1 task without a specified schema for it.
  >
  > **Cross-module note:** `document.state_changed` is emitted by the `documents` module. This module pass was supplied `TASK-WF list` only (per A1-AGENTS.md §2's Pass Types table for NOTIF), not `TASK-DOCS list` — so there is no confirmed `TASK-DOCS-NNN` ID to cite as the emitting task. Use the placeholder below; the Step 4 integration pass resolves it once both module lists exist together.
  >
  > **Handler logic:**
  > ```
  > 1. Resolve recipient per the functional default above (originatingOfficeId office-level fallback role) —
  >    call Documents.getDocumentById(payload.documentId) to obtain originatingOfficeId if not already
  >    available, then resolve the office's fallback assignee via Organization's Published API
  >    (getUserByOfficeRole or equivalent — exact method name not confirmed in this module's document set;
  >    flag as [CROSS-MODULE REF: ORG — task list not yet supplied] if the method signature is not yet stable
  >    at implementation time).
  > 2. Call sendNotification({
  >      recipientUserId: <resolved above>,
  >      templateId: 'notif.document.state_changed.in_app',
  >      channel: 'in_app',
  >      templateData: {
  >        documentId: payload.documentId, fromState: payload.fromState, toState: payload.toState,
  >        actorId: payload.actorId, reason: payload.reason ?? '',
  >      },
  >    });
  > 3. Wrap in try/catch; log and swallow failures per B3 §9 Rule 5.
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `sendNotification` is called with all 5 payload fields present in `templateData`
  > - [ ] Missing `reason` does not throw
  > - [ ] `actorId` is never used as the recipient
  > - [ ] Handler failure is caught and logged, does not crash the subscriber process
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-008

Phase:          1
Module:         NOTIF
Title:          Implement SLA warning, breach, and critical event consumers
Prerequisites:  [TASK-WF-014, TASK-NOTIF-004]
Deliverables:
  - /apps/server/src/modules/notifications/consumers/sla-escalation.consumer.ts — event bus subscribers for `workflow.sla.warning`, `workflow.sla.breached`, `workflow.sla.critical`; implements the 3-tier escalation-audience resolution (assignee-only → +supervisor+Records Officer → +Department Head); resolves escalation targets **at notification time** from administrator-configurable escalation config, never from the event payload
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `workflow.sla.warning` notifies the step's current assignee **only** — no supervisor, no Records Officer
  - [ ] `workflow.sla.breached` notifies assignee's supervisor **and** Records Officer (not the assignee again)
  - [ ] `workflow.sla.critical` notifies the breach-tier audience **plus** the Department Head
  - [ ] Escalation targets are resolved via a lookup at handling time, not read from any event payload field (none of the 3 SLA payloads carry recipient information — confirmed absent by design, B3 §7.28 OI-7)
  - [ ] Each of the 3 events results in exactly the documented number of `sendNotification` calls (1 for warning; 2 for breach; 3 for critical) using the correct template key per tier
  - [ ] Manual: trigger `workflow.sla.breached` via a test harness for a step with a known office, confirm both the supervisor and Records Officer for that office each receive a distinct in-app notification
AI Prompt:
  > You are implementing the three-tier ARTA SLA escalation notification consumers (H4 §4.3–§4.5) — legally significant under RA 11032; these are not cosmetic alerts (H4 §8.7).
  >
  > **Subscribe to all three: `workflow.sla.warning`, `workflow.sla.breached`, `workflow.sla.critical`.** All three confirmed consumers per B3 Master Event Registry rows 40–42 (`notifications`, `audit` on every row) and emitted by TASK-WF-014 (`evaluateSlaBreaches`, `pgboss`-durable, runs on startup and every 15 minutes).
  >
  > **Payload schemas (B3 §7.27–§7.29, canonical):**
  > ```typescript
  > interface WorkflowSlaWarningPayload {
  >   instanceId: string; stepInstanceId: string;
  >   slaDeadline: string;           // ISO 8601
  >   percentElapsed: 80;            // always literal 80
  > }
  > interface WorkflowSlaBreachedPayload {
  >   instanceId: string; stepInstanceId: string;
  >   slaDeadline: string; breachDetectedAt: string; breachedAt: string; // = slaDeadline per B4
  > }
  > interface WorkflowSlaCriticalPayload {
  >   instanceId: string; stepInstanceId: string;
  >   slaDeadline: string;
  >   percentElapsed: 150;           // [Unverified in B3 — sourced only from B4; confirm with stakeholders before this threshold is treated as final, per H4 §8.10]
  > }
  > ```
  >
  > **Tiered escalation audience (B3 §7.27 OI-11, team decision — confirmed, not inference):**
  > - **Warning (80%):** the step's **current assignee only**. No escalation yet.
  > - **Breach (100%):** assignee's **supervisor** and the **Records Officer** for the step's office.
  > - **Critical (150%):** the breach-tier audience (supervisor + Records Officer) **plus the Department Head**.
  >
  > **Escalation target resolution — at notification time, never from the payload (B3 §7.28 OI-7, binding design decision):** "The event payload does not carry escalation targets... The Notifications module resolves them at notification time by looking up the current supervisor and Records Officer for the step's office, via the workflow definition's escalation configuration... Rationale: escalation targets are Administrator-configurable (no developer) — resolving at notification time means an admin's mid-flight config change is honored correctly, and no stale snapshot problem exists." **Do not add an `escalatedToUserIds`-style field anywhere** — this was explicitly considered and rejected. H4 §8.5 restates this as a binding implementation dependency for T-05/T-06.
  >
  > **Default escalation role keys (per TASK-WF-014's own AI Prompt, which already establishes this default for the same underlying job):** supervisor = `'role:sp_presiding_officer'`, Records Officer = `'role:records_officer'` for SP document types, configurable per document type — not hardcoded platform-wide.
  >
  > **Handler logic (shared structure across all 3 tiers, differing only in audience):**
  > ```
  > For workflow.sla.warning:
  >   1. Resolve current assignee for stepInstanceId (via Workflow's step_instances.assigned_to,
  >      or the Workflow Published API's read surface — TASK-WF-018's getInstance/listMyAssignedSteps
  >      family; exact method depends on what WF's tRPC/Published surface exposes at this stepInstanceId).
  >   2. sendNotification({ recipientUserId: assignee, templateId: 'notif.workflow.sla_warning.in_app',
  >      channel: 'in_app', templateData: { instanceId, stepInstanceId, slaDeadline, percentElapsed: '80' } })
  >
  > For workflow.sla.breached:
  >   1. Resolve assignee's supervisor (role:sp_presiding_officer default) and Records Officer for the
  >      step's office from the escalation configuration.
  >   2. sendNotification(...) once per resolved recipient, templateId: 'notif.workflow.sla_breach.in_app',
  >      templateData: { instanceId, stepInstanceId, slaDeadline, breachedAt, breachDetectedAt }
  >
  > For workflow.sla.critical:
  >   1. Resolve the same breach-tier audience PLUS the Department Head for the step's office.
  >   2. sendNotification(...) once per resolved recipient (3 total), templateId: 'notif.workflow.sla_critical.in_app',
  >      templateData: { instanceId, stepInstanceId, slaDeadline, percentElapsed: '150' }
  > ```
  > Wrap each handler in try/catch; log and swallow per B3 §9 Rule 5 — one recipient's resolution failure must not block notifying the others in the same tier.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] Warning notifies assignee only; breach notifies supervisor + Records Officer; critical adds Department Head
  > - [ ] Escalation targets are resolved at handling time, never read from the event payload
  > - [ ] Correct call counts per tier (1 / 2 / 3) and correct template keys
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-009

Phase:          1
Module:         NOTIF
Title:          Implement Mayor and Panlalawigan lapse-timer event consumers
Prerequisites:  [TASK-WF-012, TASK-WF-013, TASK-NOTIF-004]
Deliverables:
  - /apps/server/src/modules/notifications/consumers/legislative-lapse.consumer.ts — event bus subscribers for `workflow.approval.lapsed` and `workflow.panlalawigan.deemed_approved`; both notify the SP Secretary only; both preserve their `legalBasis` phrase verbatim
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `workflow.approval.lapsed` notifies the SP Secretary only, with `legalBasis` rendered as the exact literal `"RA 7160 Section 47"` — byte-for-byte, no paraphrase
  - [ ] `workflow.panlalawigan.deemed_approved` notifies the SP Secretary only, with `legalBasis` rendered as the exact literal `"RA 7160 Section 56(d)"` — byte-for-byte, no paraphrase, and includes both `transmissionDate` and `deadlineWas` in `templateData`
  - [ ] A test asserts the recipient role resolves to `sp_secretary` specifically, not any other SP-adjacent role
  - [ ] Handler failure is caught and logged locally, does not crash the subscriber process
  - [ ] Manual: trigger `workflow.approval.lapsed` via a test harness, confirm the SP Secretary's notification body contains the unaltered string `RA 7160 Section 47`
AI Prompt:
  > You are implementing the two legislative lapse-timer notification consumers (H4 §4.6, §4.7). Both share near-identical structure — same single recipient, same "verbatim legal basis" constraint — so they are combined into one reviewable task, mirroring how the underlying WF scheduler jobs (TASK-WF-012, TASK-WF-013) were split as siblings rather than merged.
  >
  > **Subscribe to `workflow.approval.lapsed`** (Mayor 10-day) **and `workflow.panlalawigan.deemed_approved`** (Panlalawigan 30-day). Both confirmed consumers per B3 Master Event Registry rows 34–35 (`notifications`, `audit`). Emitted respectively by TASK-WF-012 (`evaluateMayorLapseTimers`, hourly `node-cron`) and TASK-WF-013 (`evaluatePanlalawiganTimers`, daily 06:00 PHT).
  >
  > **Payload schemas (B3 §7.21, §7.22, canonical):**
  > ```typescript
  > interface WorkflowApprovalLapsedPayload {
  >   stepInstanceId: string;
  >   legalBasis: 'RA 7160 Section 47';  // literal type — verbatim, immutable
  >   deadlineWas: string;               // ISO 8601
  > }
  > interface WorkflowPanlalawiganDeemedApprovedPayload {
  >   stepInstanceId: string;
  >   legalBasis: 'RA 7160 Section 56(d)';  // literal type — verbatim, immutable
  >   transmissionDate: string;             // ISO 8601
  >   deadlineWas: string;                  // ISO 8601
  > }
  > ```
  >
  > **Legal basis phrases are verbatim and immutable (H4 §8.6):** these strings are typed as Zod/TypeScript literals precisely because they must never be altered, paraphrased, or reformatted by application code or by an administrator editing the template. When rendering `{{legalBasis}}` into the template body, pass the payload's `legalBasis` value through unchanged — do not construct or reformat this string anywhere in the handler.
  >
  > **Recipient (both events):** **SP Secretary only** — H4 §4.6, §4.7 both state this explicitly with no other recipients. Resolve via `role:sp_secretary` (the same `role:<key>` assignee-expression pattern from B4 §3.5 that WF's own engine uses).
  >
  > **Handler logic:**
  > ```
  > For workflow.approval.lapsed:
  >   sendNotification({
  >     recipientUserId: <resolved sp_secretary user>,
  >     templateId: 'notif.workflow.mayor_lapse.in_app', channel: 'in_app',
  >     templateData: { stepInstanceId: payload.stepInstanceId, legalBasis: payload.legalBasis,
  >                      deadlineWas: payload.deadlineWas },
  >   });
  >
  > For workflow.panlalawigan.deemed_approved:
  >   sendNotification({
  >     recipientUserId: <resolved sp_secretary user>,
  >     templateId: 'notif.workflow.panlalawigan_deemed_approved.in_app', channel: 'in_app',
  >     templateData: { stepInstanceId: payload.stepInstanceId, legalBasis: payload.legalBasis,
  >                      transmissionDate: payload.transmissionDate, deadlineWas: payload.deadlineWas },
  >   });
  > ```
  > Both must prompt the SP Secretary to confirm the outcome in the system to advance the workflow (Mayor lapse → docketing; Panlalawigan deemed-approval → populate Remarks with "Lapsed 30 days") — this is a message-content/UX concern for the administrator-edited template body, not application logic this task implements, but note it in the seeded starter body text from TASK-NOTIF-005.
  >
  > Wrap both in try/catch; log and swallow per B3 §9 Rule 5.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] Both events notify the SP Secretary only
  > - [ ] `legalBasis` is rendered byte-for-byte verbatim in both cases
  > - [ ] Panlalawigan event includes both `transmissionDate` and `deadlineWas`
  > - [ ] Handler failure is caught and logged, does not crash the subscriber process
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-010

Phase:          1
Module:         NOTIF
Title:          Implement Complaint Respondent notification — email and phone fallback
Prerequisites:  [TASK-NOTIF-004]
Deliverables:
  - /apps/server/src/modules/notifications/notifications.external-recipient.ts — extends the core dispatch service (TASK-NOTIF-004) for external (non-platform-user) recipients: email delivery via Nodemailer/LGU SMTP for the `email` channel, and a `phone_call_required` delivery-log-only path for the `sms` channel (no actual SMS gateway exists until Phase 3)
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `sendNotification({ recipientEmail, templateId: 'notif.complaint.respondent_notice.email', channel: 'email', templateData })` sends a real email via Nodemailer/LGU SMTP and writes a `delivery_log` row with `status: 'delivered'` on success, `'bounced'`/`'failed'` on SMTP error
  - [ ] `sendNotification({ recipientPhone, channel: 'sms', ... })` in Phase 1 does **not** attempt an actual SMS send (no gateway exists) — writes a `delivery_log` row with `status: 'delivered'` and `error_message` (or an equivalent field) recording `'phone_call_required'`, logging that manual Secretariat follow-up is needed
  - [ ] A request with neither `recipientEmail` nor `recipientPhone` for the `email`/`sms` channels throws a clear validation error at the call site (a caller programming error, not a runtime data-availability case)
  - [ ] Every respondent notice attempt — email or phone-fallback — lands in `notifications.delivery_log`, satisfying B2's stated design intent that this path is centrally logged even though it bypasses SMTP direct-calling
  - [ ] Manual: call `sendNotification` with a test `recipientEmail`, confirm an email arrives at a test inbox (e.g. Mailhog/Mailtrap in the dev environment) with the complaint reference number in the subject line
AI Prompt:
  > You are implementing the Complaint Respondent Notification (H4 §4.8) — the **only Phase 1 notification that uses the `email` channel for general delivery**, and the only one with a phone-only fallback path. This is a confirmed Phase 1 requirement (consolidated ref Part 4.14), routed entirely through this module's `sendNotification()` Published API per a resolved architecture decision — not a direct SMTP call from Portal, and not a domain event on the bus.
  >
  > **Routing — already resolved, not open (ADR-B2-4, confirmed in both H4 §8.4 and B2 Module 7's Published API doc comment):** "Portal's Respondent Notice Service calls `Notifications.sendNotification()` — not a direct SMTP call, and not a separate domain event on the bus. The Notifications module handles delivery and logs every attempt in `notifications.delivery_log`. B1's direct-SMTP diagram is superseded by ADR-B2-4." Portal doesn't exist yet (Wave G, after NOTIF) — this task's job is to make sure `sendNotification()` is ready and correctly behaved for this exact call shape *before* Portal's own Step 2 pass needs to call it.
  >
  > **No triggering domain event exists for this notification** (H4 §4.8, §8.4 — a confirmed, still-open B3 action item: "Whether this call path is accompanied by a formal domain event... is still the team's choice when implementing the complaint module." Do not invent one here — that decision belongs to whichever future module pass implements the complaint workflow itself, likely `documents` or a dedicated complaints capability, not `notifications`.)
  >
  > **Two delivery paths, chosen by the caller via `channel` (H4 §4.8 table):**
  >
  > | Respondent contact available | `NotificationInput` shape | Behavior |
  > |---|---|---|
  > | Email address | `{ recipientEmail, channel: 'email', templateId: 'notif.complaint.respondent_notice.email', templateData }` | Send via Nodemailer + LGU SMTP (tech-stack.md). This email **constitutes both the notification and delivery of the formal written notice** — not just an alert (H4 §5.10 Implementation Notes). |
  > | Contact number only, no email | `{ recipientPhone, channel: 'sms', templateData }` | **No SMS gateway exists in Phase 1** (Phase 3 per H4 §3.3). Do not attempt an actual send. Write a `delivery_log` entry recording that a phone call is required (H4 §8.4: "logs a `delivery_log` entry of type `phone_call_required`"). The actual phone call and in-person written-notice handoff remain manual Secretariat actions — this task's only job is to ensure the *attempt* is centrally logged, per B2's stated rationale for routing this through `sendNotification()` in the first place. |
  >
  > **Template variables (H4 §5.10, T-09):** `{{respondentName}}`, `{{complaintReference}}`, `{{complaintSubject}}`, `{{lguOffice}}`, `{{secretariatContactInfo}}`.
  >
  > **Validation:** a caller must supply exactly one of `recipientEmail` (for `channel: 'email'`) or `recipientPhone` (for `channel: 'sms'`) — this is a caller contract, not a data-availability branch to handle silently; throw a clear error (not a swallowed no-op) if neither is present, since that indicates a bug in the calling code (future Portal module), not a legitimate runtime state.
  >
  > **Delivery log status semantics for the phone-fallback path:** since no real delivery occurs, use `status: 'delivered'` with a distinguishing `error_message` value (e.g. `'phone_call_required'`) rather than `status: 'failed'` — this was not a failed delivery attempt, it is a correctly-executed logging of a manual-follow-up requirement. Using `'failed'` here would misrepresent this as an error condition in delivery-log reporting (TASK-NOTIF-012's `listDeliveryLogs` procedure, visible only to Sys Admin/Plat Admin).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] Email path sends via Nodemailer/LGU SMTP and logs `delivered`/`bounced`/`failed` correctly
  > - [ ] Phone-fallback path logs `phone_call_required` without attempting an actual SMS send
  > - [ ] Missing both `recipientEmail` and `recipientPhone` throws a clear caller-contract error
  > - [ ] Every attempt (either path) writes a `delivery_log` row
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-011

Phase:          1
Module:         NOTIF
Title:          Implement Session Security event consumer for `session.terminated`
Prerequisites:  [CROSS-MODULE REF: IAM — task list not yet supplied; TASK-NOTIF-004]
Deliverables:
  - /apps/server/src/modules/notifications/consumers/session-displaced.consumer.ts — event bus subscriber for `session.terminated`, filtered to `reason: 'forced'` only (new-device displacement — not `'timeout'`); notifies the displaced user
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `session.terminated` with `reason: 'forced'` calls `sendNotification` for `recipientUserId: payload.userId`
  - [ ] `session.terminated` with `reason: 'timeout'` results in **no** call to `sendNotification` (H4 §4.9 is scoped specifically to new-device displacement, not ordinary inactivity timeout)
  - [ ] This PR includes the required companion edit to B3's Master Event Registry (§8, row 3) adding `notifications` as a consumer of `session.terminated` alongside the existing `audit` consumer — per H4 §8.3's explicit instruction that this edit "must be included in the same PR that implements this feature"
  - [ ] Handler failure is caught and logged locally, does not crash the subscriber process
  - [ ] Manual: force a session termination via a second-device login test, confirm the displaced user sees the security notification on their next SSE connection or `notifications.listMine` call
AI Prompt:
  > You are implementing the Session Security notification consumer (H4 §4.9).
  >
  > **This event registration is a known, flagged gap you are closing, not inventing.** B3's Master Event Registry (§8, row 3) currently lists `session.terminated`'s only consumer as `audit`. H4 §8.3 explicitly documents this as a required, still-open action item: *"The `notifications` module must also subscribe to `session.terminated`... Add `notifications` as a consumer of `session.terminated` in B3's Master Event Registry. This edit is an action item for the B3 document, outside this catalog's authority to make directly. The update must be included in the same PR that implements this feature."* This task is that PR — implement the subscription **and** make the corresponding edit to B3 (or file it as an immediate companion change, per your team's process for cross-document edits raised by a task).
  >
  > **Subscribe to `session.terminated`, filter to `reason === 'forced'` only.** Payload schema (B3 §4.3, canonical):
  > ```typescript
  > interface SessionTerminatedPayload {
  >   sessionId: string;      // uuid — the terminated session
  >   userId: string;         // uuid — the displaced user
  >   terminatedBy: string;   // uuid — IT Admin actor, or a system UUID for timeout
  >   reason: 'forced' | 'timeout';
  > }
  > ```
  > H4 §4.9 scopes this notification specifically to new-device displacement (`reason: 'forced'`), **not** ordinary inactivity timeout (`reason: 'timeout'`) — a routine timeout is not a security event worth alerting the user about; a forced displacement from a new device login is. Filter at the top of the handler: `if (payload.reason !== 'forced') return;`.
  >
  > **Cross-module note:** `session.terminated` is emitted by the `iam` module. This module pass was supplied `TASK-WF list` only — not `TASK-IAM list` — so there is no confirmed `TASK-IAM-NNN` ID to cite even though IAM's Wave B ran chronologically before this Wave F pass. Per A1-AGENTS.md §5's placeholder convention, use `[CROSS-MODULE REF: IAM — task list not yet supplied]`; the Step 4 integration pass resolves it once both lists exist together in the same context.
  >
  > **Recipient:** the displaced user — `recipientUserId: payload.userId`, direct, no role resolution needed.
  >
  > **Delivery timing note (H4 §4.9):** "delivered upon the user's next login or active SSE connection" — this is naturally satisfied by the existing dispatch architecture: the `notification_events` row is durable (written by `sendNotification`, TASK-NOTIF-004) regardless of whether the user has a live SSE connection at the moment of dispatch; `notifications.listMine` (TASK-NOTIF-012) will surface it on their next session regardless. No special "queue until next login" logic is needed beyond what TASK-NOTIF-003/004 already provide.
  >
  > **Handler logic:**
  > ```
  > 1. If payload.reason !== 'forced': return (no notification for timeout).
  > 2. sendNotification({
  >      recipientUserId: payload.userId,
  >      templateId: 'notif.iam.session_displaced.in_app', channel: 'in_app',
  >      templateData: { sessionId: payload.sessionId, userId: payload.userId, reason: payload.reason },
  >    });
  > 3. Wrap in try/catch; log and swallow per B3 §9 Rule 5.
  > ```
  > Message content should advise the user to contact the IT Admin if the new-device login was not initiated by them (consolidated ref Part 11.17) — note this in TASK-NOTIF-005's seeded starter body text.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `reason: 'forced'` triggers exactly one `sendNotification` call to the displaced user
  > - [ ] `reason: 'timeout'` triggers zero calls
  > - [ ] The companion B3 Master Event Registry edit (adding `notifications` as a `session.terminated` consumer) is included in this PR
  > - [ ] Handler failure is caught and logged, does not crash the subscriber process
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-012

Phase:          1
Module:         NOTIF
Title:          [ABAC] Implement notifications tRPC router procedures
Prerequisites:  [TASK-NOTIF-001, TASK-NOTIF-004]
Deliverables:
  - /apps/server/src/modules/notifications/notifications.router.ts — `notificationsRouter` with all 4 confirmed procedures: `listMine`, `markAsRead`, `getOwnPreferences`/`updateOwnPreferences`, `listDeliveryLogs`
  - /apps/server/src/modules/notifications/notifications.policy.ts — ABAC condition helpers for own-recipient scoping
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `notifications.listMine` returns only notifications where `recipient_user_id = ctx.subject.userId` — verified by a test asserting a second user's notifications never appear
  - [ ] `notifications.markAsRead` on another user's notification returns `FORBIDDEN`, not a silent no-op
  - [ ] `notifications.listDeliveryLogs` is callable only by `sys_admin` and `plat_admin` — every other role gets `FORBIDDEN` at the `requireRole` gate before any query runs
  - [ ] `notifications.updateOwnPreferences` with `channel: 'email'` or `'sms'` is schema-valid (accepted) but has no functional effect in Phase 1 (per E1's explicit note that these channels are "functionally inert in Phase 1")
  - [ ] All 4 procedures run the full middleware chain (`verifyAccessToken` → `loadDelegationContext` → Zod input parse → `requireRole` → `requirePolicy`) — no procedure skips `requirePolicy` even where the ABAC condition is "own records only," per E1's Global Convention #3
  - [ ] Manual: as a `records_officer` test user, call `listMine`, confirm only that user's own notifications are returned; attempt `listDeliveryLogs` as the same user, confirm `FORBIDDEN`
AI Prompt:
  > You are implementing the `notificationsRouter` — 4 procedures, all confirmed in E1 Module 8 with complete input/output schemas. This is the only tRPC surface this module exposes; template CRUD is a known gap (see Module Summary) and is explicitly **not** implemented here — do not add it.
  >
  > **Global middleware chain (E1 Global Conventions §3, applies to every procedure below with zero exceptions):**
  > ```
  > 1. verifyAccessToken — populates ctx.subject from the JWT
  > 2. loadDelegationContext — expands effective office/role scope if a delegation grant is active
  > 3. Zod input parse (tRPC's .input() validator)
  > 4. requireRole([...]) — coarse role-set gate, per procedure below
  > 5. requirePolicy(resource, action) — full ABAC cascade via IAM.evaluatePolicy(); runs even when the
  >    only resource-specific clause is "own records only" — the Global Gates (tenant isolation, IT Admin
  >    content isolation, Platform Admin operational exclusion, soft-delete gate) always apply.
  > ```
  >
  > **Shared fragment schemas referenced below (E1 "Shared Fragment Schemas"):**
  > ```typescript
  > const paginationInput = z.object({
  >   cursor: z.string().nullish(),
  >   pageSize: z.number().int().min(1).max(100).default(20),
  > });
  > const dateRangeInput = z.object({
  >   from: z.coerce.date().nullish(),
  >   to: z.coerce.date().nullish(),
  > });
  > interface PaginatedOutput<T> { items: T[]; nextCursor: string | null; }
  > ```
  >
  > **`notifications.listMine`**
  > ```typescript
  > type = 'query'
  > input = paginationInput.extend({ unreadOnly: z.boolean().default(false) })
  > output = z.object({
  >   items: z.array(z.object({
  >     notificationId: z.string().uuid(), templateId: z.string(), renderedTitle: z.string(),
  >     renderedBody: z.string(), isRead: z.boolean(), createdAt: z.coerce.date(),
  >     relatedDocumentId: z.string().uuid().nullable(),
  >   })),
  >   nextCursor: z.string().nullable(),
  > })
  > callableBy = ['records_officer','dept_encoder','dept_approver','sp_secretary','sp_member',
  >               'sp_presiding_officer','mayor','brgy_encoder','brgy_captain']  // all 9 operational roles per I2 §11; NOT sys_admin/plat_admin/auditor/citizen
  > abac = "WHERE recipient_user_id = subject.user_id — own notifications only"
  > businessOperation = "Reads notifications.notification_events filtered to the caller (repository.listNotificationsForUser, TASK-NOTIF-002)"
  > ```
  >
  > **`notifications.markAsRead`**
  > ```typescript
  > type = 'mutation'
  > input = z.object({ notificationId: z.string().uuid() })
  > output = z.object({ success: z.literal(true) })
  > callableBy = same as listMine, plus 'citizen' (output-schema completeness per I2's row — citizen's actual
  >              channel is the Portal REST layer in practice, not this tRPC router; include for schema parity)
  > abac = "notification.recipient_user_id = subject.user_id"
  > businessOperation = "Sets notification_events.is_read = true — repository.markNotificationRead"
  > ```
  > **Note on `is_read`:** neither C1's DDL nor this module's earlier tasks define an `is_read` column on `notification_events` explicitly in the excerpt loaded for this pass — the DDL shown in TASK-NOTIF-001 does not list `is_read`. Add it as part of this task's migration-adjacent scope if it does not already exist (`ALTER TABLE notifications.notification_events ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false`), since `listMine`'s output schema (`isRead: z.boolean()`) and `markAsRead`'s behavior both require it and no other task in this list adds it. Flag this explicitly in your PR description as a correction discovered while implementing E1's contract against C1's DDL.
  >
  > **`notifications.getOwnPreferences` / `notifications.updateOwnPreferences`**
  > ```typescript
  > type = 'query' / 'mutation'
  > inputUpdate = z.object({ channel: z.enum(['in_app']), templateCategory: z.string(), enabled: z.boolean() })
  >   // NOTE: input enum is ['in_app'] only in Phase 1 per E1 — email/sms are schema-valid elsewhere but
  >   // this specific input constrains to in_app; if extending to accept email/sms as inert values, keep
  >   // them functionally inert per E1's explicit note, do not wire them to any real delivery gating.
  > output = z.object({ preferences: z.array(z.object({
  >   templateCategory: z.string(), channel: z.string(), enabled: z.boolean(),
  > })) })
  > callableBy = all 12 authenticated internal roles
  > abac = "Own preferences only"
  > businessOperation = "User-configurable, no admin approval needed (consolidated ref Part 11.21 'User-configurable' tier)"
  > ```
  >
  > **`notifications.listDeliveryLogs`**
  > ```typescript
  > type = 'query'
  > input = paginationInput.extend({ ...dateRangeInput.shape })
  > output = z.object({
  >   items: z.array(z.object({
  >     deliveryLogId: z.string().uuid(), recipientUserId: z.string().uuid().nullable(),
  >     recipientEmail: z.string().nullable(), channel: z.string(), status: z.string(),
  >     sentAt: z.coerce.date(),
  >   })),
  >   nextCursor: z.string().nullable(),
  > })
  > callableBy = ['sys_admin', 'plat_admin']
  > abac = "None beyond role gate"
  > businessOperation = "Reads notifications.delivery_log in full — the only procedure in this router with cross-recipient visibility"
  > ```
  > Note: this output schema's field is `recipientUserId` — a fourth independent confirmation of the `recipient_user_id` naming decision made in TASK-NOTIF-001 (see Module Summary conflict #1).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `listMine` returns only the caller's own notifications
  > - [ ] `markAsRead` on another user's notification returns `FORBIDDEN`
  > - [ ] `listDeliveryLogs` is callable only by `sys_admin`/`plat_admin`
  > - [ ] `updateOwnPreferences` accepts `in_app` per the confirmed input schema; email/sms remain inert if accepted at all
  > - [ ] All 4 procedures run the full 5-step middleware chain with no shortcuts
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-013

Phase:          1
Module:         NOTIF
Title:          Wire NOTIF Fastify plugin and event bus consumers
Prerequisites:  [TASK-NOTIF-005, TASK-NOTIF-006, TASK-NOTIF-007, TASK-NOTIF-008, TASK-NOTIF-009, TASK-NOTIF-010, TASK-NOTIF-011, TASK-NOTIF-012]
Deliverables:
  - /apps/server/src/modules/notifications/notifications.plugin.ts — Fastify plugin registering: the SSE route (TASK-NOTIF-003), the `notificationsRouter` (TASK-NOTIF-012), and all 6 event bus consumer subscriptions (TASK-NOTIF-006 through -011) at server startup
  - /apps/server/src/modules/notifications/index.ts (updated) — barrel now exports the completed `NotificationsPublicAPI` implementation from TASK-NOTIF-004
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Server startup registers exactly 6 event bus subscriptions for this module: `workflow.step.started`, `document.state_changed`, `workflow.sla.warning`, `workflow.sla.breached`, `workflow.sla.critical`, `workflow.approval.lapsed`, `workflow.panlalawigan.deemed_approved`, `session.terminated` — **wait, recount: that is 8 distinct event types, not 6** — verify the plugin subscribes to all 8 (Step Assignment=1, Document State Change=1, SLA×3=3, Lapse×2=2, Session=1 → 8 total; the Complaint Respondent path, TASK-NOTIF-010, is not an event subscription and is not registered here — it's reached only via the Published API)
  - [ ] Every subscription handler is wrapped in the plugin's own top-level try/catch in addition to each consumer's internal error handling, as defense in depth
  - [ ] `NotificationsPublicAPI.sendNotification` is reachable from another module's code via the barrel import (`import { NotificationsPublicAPI } from '@/modules/notifications'`) with no internal file exposed
  - [ ] Server fails fast (does not start) if the SSE route or router registration throws during plugin init — but an individual event consumer registration failure logs a startup warning rather than blocking server start (consistency with WF's own established pattern for non-critical subscription wiring)
  - [ ] Manual: start the server, confirm via startup logs that 8 event subscriptions are registered and the `/api/notifications/stream` route responds
AI Prompt:
  > You are wiring the final assembly point for the `notifications` module: the Fastify plugin that registers the SSE route, the tRPC router, and every event bus consumer built in TASK-NOTIF-006 through -011.
  >
  > **Complete list of event subscriptions this plugin must register (8 event types across 6 consumer files):**
  > ```
  > workflow.step.started              → step-assignment.consumer.ts        (TASK-NOTIF-006)
  > document.state_changed             → document-state-changed.consumer.ts (TASK-NOTIF-007)
  > workflow.sla.warning               → sla-escalation.consumer.ts         (TASK-NOTIF-008)
  > workflow.sla.breached              → sla-escalation.consumer.ts         (TASK-NOTIF-008)
  > workflow.sla.critical              → sla-escalation.consumer.ts         (TASK-NOTIF-008)
  > workflow.approval.lapsed           → legislative-lapse.consumer.ts      (TASK-NOTIF-009)
  > workflow.panlalawigan.deemed_approved → legislative-lapse.consumer.ts   (TASK-NOTIF-009)
  > session.terminated                 → session-displaced.consumer.ts      (TASK-NOTIF-011)
  > ```
  > TASK-NOTIF-010 (Complaint Respondent) is **not** in this list — it has no triggering domain event (H4 §4.8/§8.4, still an open B3 action item on whether one will ever exist) and is reached exclusively via the `NotificationsPublicAPI.sendNotification()` Published API surface, which this plugin exposes through the barrel export but does not "subscribe" to anything for.
  >
  > **Plugin registration order:**
  > ```
  > 1. Register the SSE route (TASK-NOTIF-003) — GET /api/notifications/stream
  > 2. Register the notificationsRouter (TASK-NOTIF-012) into the root tRPC router at
  >    /apps/server/src/trpc/root.ts, per E1's stated router file layout convention
  > 3. Subscribe all 8 event handlers to the in-process event bus (per B2's event bus mechanism)
  > 4. Export the completed NotificationsPublicAPI implementation (TASK-NOTIF-004) through this
  >    module's index.ts barrel, so other modules (eventually Portal, Wave G) can import and call
  >    sendNotification() directly.
  > ```
  >
  > **Startup failure semantics — mirror WF's established pattern (TASK-WF-024):** critical registration (route, router) should fail server startup loudly if it errors, since a broken router means the whole API surface is compromised. Individual event-consumer subscription failures should log a clear startup warning and continue — a broken SLA consumer, for instance, should not prevent the SSE route or the tRPC router from working, since those failures are independently recoverable (a fix-and-redeploy for that one consumer) rather than systemic.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] All 8 event subscriptions are registered at startup (verified via startup log output)
  > - [ ] `NotificationsPublicAPI.sendNotification` is reachable from outside the module via the barrel import only
  > - [ ] Route/router registration failure fails startup; individual consumer registration failure logs a warning and continues
  > A reviewer will verify each one independently.

---

## TASK-NOTIF-014

Phase:          1
Module:         NOTIF
Title:          Implement NOTIF Vitest test suite
Prerequisites:  [TASK-NOTIF-013]
Deliverables:
  - /apps/server/src/modules/notifications/__tests__/notifications.repository.test.ts
  - /apps/server/src/modules/notifications/__tests__/notifications.service.test.ts
  - /apps/server/src/modules/notifications/__tests__/notifications.sse.test.ts
  - /apps/server/src/modules/notifications/__tests__/notifications.router.test.ts
  - /apps/server/src/modules/notifications/__tests__/consumers.test.ts — covers all 6 consumer files (TASK-NOTIF-006 through -011) in one suite, mirroring the shared event-bus-mocking setup across all 8 subscribed event types
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm test --filter notifications` passes with zero failures
  - [ ] Every Acceptance Criterion listed across TASK-NOTIF-001 through TASK-NOTIF-013 has at least one corresponding automated test — this task is where implementing agents must enumerate that full list and confirm coverage; per-task acceptance criteria cite representative checks only, this task closes the gap (mirroring WF's own TASK-WF-025 pattern for the same reason)
  - [ ] Test coverage includes: the `assignedTo === null` no-op case, the 3-tier SLA escalation audience differences, the `reason: 'forced'` vs `'timeout'` filter, the verbatim legal-basis string preservation (both phrases), the `recipient_user_id` ABAC scoping on `listMine`/`markAsRead`, and the phone-fallback `delivery_log` logging path
  - [ ] Manual: run the full suite locally (`pnpm test --filter notifications`) and confirm the reported test count is consistent with the enumerated criteria count across all 13 preceding tasks (no criteria silently uncovered)
AI Prompt:
  > You are implementing the Vitest test suite for the `notifications` module, covering every task in this list (TASK-NOTIF-001 through TASK-NOTIF-013).
  >
  > **Your first responsibility:** read every Acceptance Criteria checkbox across all 13 preceding tasks in this document and confirm each has at least one corresponding automated test in this suite. Per-task Acceptance Criteria in this document cite a representative subset for reviewability; this task is explicitly where full enumeration and coverage confirmation happens (this is the same closing-the-gap role WF's own TASK-WF-025 plays for its module, per that task's own stated purpose).
  >
  > **Priority coverage areas (these are the highest-risk correctness points identified during this module's generation and deserve dedicated, explicit test cases, not just incidental coverage):**
  > 1. **`assignedTo === null` no-op** (TASK-NOTIF-006) — a system-executed step (`decision`/`notification` type) must never generate a Step Assignment notification.
  > 2. **SLA 3-tier escalation audience** (TASK-NOTIF-008) — warning → assignee only; breach → supervisor + Records Officer; critical → + Department Head. Test each tier's exact recipient set, not just "a notification was sent."
  > 3. **`session.terminated` reason filter** (TASK-NOTIF-011) — `'forced'` notifies; `'timeout'` does not. Both branches need explicit tests, not just the happy path.
  > 4. **Verbatim legal basis strings** (TASK-NOTIF-009) — assert the exact byte sequence `"RA 7160 Section 47"` and `"RA 7160 Section 56(d)"` appear unaltered; a test that only checks "contains RA 7160" would not catch a paraphrasing regression.
  > 5. **`recipient_user_id` ABAC scoping** (TASK-NOTIF-012) — `listMine` and `markAsRead` must be tested with two distinct seeded users to confirm cross-user isolation, not just single-user happy-path coverage.
  > 6. **Phone-fallback logging** (TASK-NOTIF-010) — confirm `delivery_log` receives a `phone_call_required`-flavored entry with `status: 'delivered'` (not `'failed'`) for the no-email-available path.
  > 7. **Downstream handler failure isolation** (B3 §9 Rule 5, applies to every consumer) — a thrown error inside any one consumer's logic must not propagate and must not prevent other consumers from processing their own events. At least one test per consumer file should simulate a downstream failure (e.g., `sendNotification` rejecting) and assert the subscriber process itself does not crash.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `pnpm test --filter notifications` passes with zero failures
  > - [ ] Every Acceptance Criterion across TASK-NOTIF-001 through -013 has at least one corresponding test
  > - [ ] All 7 priority coverage areas above have dedicated, explicit test cases
  > A reviewer will verify each one independently.

---

## Module Summary — NOTIF

**Total tasks:** 14 (TASK-NOTIF-001 — TASK-NOTIF-014)
**Wave:** F — depends on TASK-WF-005, TASK-WF-012, TASK-WF-013, TASK-WF-014 (specific IDs cited); all 14 tasks are Phase 1.
**First executable task:** TASK-NOTIF-001 (`Prerequisites: [NONE]` — the `notifications` schema is fully self-contained per C1 Part 9, with no ALTERs to any other module's schema, unlike WF's own TASK-WF-001 which needed a TASK-DOCS-001 prerequisite for its `documents.documents` ALTER).

---

**Resolution status:** All three rows in the table below and both notes following the Confirmed Spec Gaps block have been written back into their respective source documents (C1, E1, H4) as of this note. See each row/note for the specific companion-document edit. The Confirmed Spec Gaps themselves (all four) remain genuinely unresolved — no task was generated for any of them, and none has invented content — consistent with A1-AGENTS.md §8's instruction not to fill spec gaps.

### Document Conflicts Resolved at Generation Time

| # | Conflict | Sources | Resolution Applied |
|---|---|---|---|
| 1 | Recipient identity column: `recipient_employee_id` (FK → `organization.employees`) vs `recipient_user_id` (FK → `iam.users`) | C1 Part 9's literal DDL names the column `recipient_employee_id`. Four independent, mutually-consistent sources say otherwise: E1's `listMine`/`markAsRead` ABAC conditions and `listDeliveryLogs` output schema all reference `recipient_user_id`/`recipientUserId`; B2's `IAMPublicAPI.getUserById(userId)` doc comment states it is "Called by ... Notifications (recipient addressing)"; and B2's own `NotificationInput.recipientUserId?: string`. (A fifth citation to B3 §7.11's `assignedTo` field and a WF assignee-resolution algorithm was in an earlier draft of this row; removed — B3 §7.11 itself only types `assignedTo` as a bare `z.string().uuid().nullable()` with no `user_id`/`employee_id` annotation, and the "assignee-resolution algorithm" detail was never independently verified against B4/D3, which are outside this pass's reading list. The other four citations, all independently verified, are sufficient on their own.) | **Adopted `recipient_user_id` (FK → `iam.users.id`) throughout.** Applied in TASK-NOTIF-001's DDL (explicitly marked as a correction to C1), and consistently in every subsequent task. **C1 Part 9's column-rename edit has now been applied** (see C1 Part 15 "Resolved" table), superseding the "flagged as an action item" status this row previously described. |
| 2 | Template lookup identifier: C1 names the column `name`; H4 calls the same concept `template_key` throughout its entire catalog (all 10 template entries, the mapping table in §6) | C1 Part 9 DDL; H4 §5 (all of §5.2–5.11), §6 | **No functional conflict — terminology only.** The DB column is `name` (per C1, followed literally); H4's "template_key" values (e.g. `notif.workflow.step_assignment.in_app`) are exactly what gets stored in that column. Documented explicitly in TASK-NOTIF-001's AI Prompt so implementers don't go looking for a nonexistent `template_key` column. |
| 3 | Skeleton's Phase 1 task-count rationale ("eight named Phase 1 priority events, each needing trilingual template content") vs. H4's actual catalog | `a1-skeleton.md` §6 (NOTIF row); `document-list.md` line 293 (the pre-H4 planning brief that appears to be the skeleton's actual source — it names exactly 8 events, several of which don't survive into the real H4); H4 itself (9 events, no trilingual content addressed anywhere) | **Not a true conflict — H4 supersedes as the authoritative, later-written domain catalog.** The Step 1 Skeleton pass never loads H4 (only `document-list.md`, `tech-stack.md`, consolidated ref §10.2/§13 per its own stated reading list) and explicitly disclaims its task-count figures as rough, non-binding `[Inference]`. This task list follows H4's actual 9 events. The "trilingual" phrase turned out to point to a real, separate, unresolved gap — see Spec Gap #4 below — but the *count* discrepancy itself is just an artifact of the skeleton predating H4. |

---

### Confirmed Spec Gaps

```
[SPEC GAP: Notification template CRUD / administrator-management procedures.
H4 states repeatedly and unambiguously that templates are "administrator-
configurable... through the admin configuration interface" (§5, §8.1) with
"no developer involvement required to create, edit, or activate them." The
underlying schema (notifications.templates) exists in C1 Part 9. E1's own
"What Is Out of Scope" note states that admin configuration procedures ARE
in scope precisely when "the underlying schema is confirmed in C1" — yet
E1 Module 8 (Notifications Router) defines only 4 procedures (listMine,
markAsRead, preferences, listDeliveryLogs), none of which allow creating,
editing, or listing templates. Without such a procedure, no Platform
Administrator can actually manage templates as H4 requires. Not resolved
here — TASK-NOTIF-012 explicitly does not add an invented procedure shape
for this, per A1-AGENTS.md §8's instruction not to fill spec gaps with
invented content.]

[SPEC GAP: Trilingual template content has no schema support. tech-stack.md
confirms a platform-wide requirement: "i18n | i18next + react-i18next |
Filipino, English, Ilocano" — and H4 explicitly lists tech-stack.md as one
of its five source documents. Yet H4 makes no mention of localization
anywhere in its full 772 lines, and C1 Part 9's notifications.templates DDL
has no locale/language discriminator column (only the existing UNIQUE
(city_id, name, channel) constraint, with no fourth dimension for language).
As currently specified, the schema cannot represent "the same template_key,
in three languages" at all. Not resolved here — TASK-NOTIF-005 seeds single-
language (English) starter content only, and does not attempt to design a
locale-column extension without a source document specifying one.]
```

**Session Security's B3 registration gap (H4 §8.3) is a known, already-actionable item, not a newly-discovered one** — it is addressed directly by TASK-NOTIF-011, which includes the required companion B3 edit in its own Acceptance Criteria, per H4's explicit instruction that the fix ships in the same PR as the feature. It is listed here for completeness, not as an unresolved gap: **[RESOLVED — addressed by TASK-NOTIF-011, not left as a gap]**.

**Complaint Respondent routing (H4 §8.4, B2 Module 7) is fully resolved, not a gap** — ADR-B2-4 settles the routing question definitively (`Notifications.sendNotification()`, not direct SMTP, not a domain event). TASK-NOTIF-010 implements it as specified. The one item ADR-B2-4 leaves genuinely open — whether a future `complaint.respondent_notice.issued`-style domain event ever gets added to the bus — belongs to whichever future module implements the complaint workflow, not to NOTIF.

**Certification of Urgency bypass notification — decided, no notification built (human decision, not a document-derived resolution)** — a human has decided that no dedicated notification will be built for any of the four CU-bypass events (`.bypass_applied`, `.bypass_deferred`, `.already_past_referral`, `.already_inactive`) in Phase 1. Rationale on record: every one of these events already has a confirmed `audit` consumer (B3 §8, rows 36–39) — the bypass is fully and immediately auditable regardless of this decision. Investigation did not find any source document positively stating a notification was intended here; the only suggestive evidence is a contrast in the consolidated reference (§11.3), which explicitly states the comparable Mayor's 10-day lapse event "notifies SP Secretary" but uses no equivalent phrase for CU bypass, one paragraph later. This contrast is suggestive, not dispositive — no document affirmatively rules a notification out either. **This closure rests primarily on the human decision, not on documentary proof that no notification was ever intended.** If Certified Urgent's actual Phase 1 usage reveals stakeholders need an active alert rather than relying on the audit trail, this should be revisited as a Phase 1B or Phase 2 addition, not treated as permanently settled. H4 §9's decision table (row 4) has been updated to reflect this closure — see that document. **[RESOLVED — no notification built, per human decision; see rationale above]**

**Thursday-cutoff / missing-committee-report notification — decided, no notification built (human decision, with strong document support)** — a human has decided that no dedicated notification will be built for `workflow.multi_referral.cutoff_missed` in Phase 1. This decision has stronger direct document support than the CU-bypass closure above: D3 (State Machine Diagrams) §3.4 states explicitly and with a `[CONFIRMED]` label, citing B4 §6.2, that "`multi_referral` red-flag is not a state transition" — meaning the project's own authoritative state-machine reference already treats the missed-cutoff situation as a display/query-layer concern, not an event requiring its own downstream side effect. B4 §6.2's own job algorithm describes the effect of a missed cutoff entirely in terms of Order-of-Business exclusion, and the consolidated reference §4.18 independently frames the same mechanism as a "visual indicator" on a "derived view." Every one of these was read directly, not inferred from a citation. As with the CU-bypass closure, `cutoff_missed` retains its confirmed `audit` consumer (B3 §8, row 31) regardless of this decision. H4 §9's decision table (row 5) has been updated to reflect this closure — see that document. **[RESOLVED — no notification built, per human decision; existing Order-of-Business red-flag UI and audit trail are the intended stakeholder-facing signal]**

---

### Deferred Capabilities

```
[DEFERRED — Phase 2: Email delivery channel for the 8 general operational-role
notification events (Step Assignment, Document State Change, SLA×3, Mayor/
Panlalawigan lapse×2). Template T-02 (notif.workflow.step_assignment.email)
exists in H4's catalog but is explicitly Phase 2 and is not seeded by
TASK-NOTIF-005. Independently confirmed as the correct Phase 1 boundary by
WF's own Module Summary: "Phase 1 Notifications module delivers in-app only;
channels: ['in_app'] is the correct Phase 1 default."]

[DEFERRED — Phase 3: SMS gateway. The `sms` channel exists in the schema
(notifications.templates.channel CHECK constraint already includes it) but
has no real transport in Phase 1/2 — TASK-NOTIF-010's phone-fallback path is
a delivery_log-only placeholder pending the actual gateway.]

[DEFERRED — Phase 1B: any Notification capability specific to the 8 document
types added in Phase 1B (Letters Received/Sent, Memos Incoming/Outgoing,
Notices of Committee Hearing/Special Session, Designations, Barangay
Resolutions). The Phase Scope Table (a1-skeleton.md §3) marks NOTIF "Full
spec" for Phase 1B as well as Phase 1, but per A1-AGENTS.md §5 ("Phase 1B...
capabilities are not generated in a Phase 1 module pass") and §6's Step 2
rule (capability identification is scoped to "consolidated ref §13 Phase 1"
specifically), this pass generates Phase 1 tasks only. Whether Phase 1B's
new document types need dedicated new notification events, or are fully
served by the existing Step Assignment / Document State Change events
already built here (since Phase 1B document types reuse the same workflow
engine and the same two generic events), is a question for the Step 3
Outline pass or a dedicated Phase 1B NOTIF pass to resolve — H4 itself does
not distinguish Phase 1 vs Phase 1B event scope explicitly enough to answer
this here.]

[DEFERRED — Phase 1B, carried forward directly from WF's own Module Summary:
Records module retention trigger on workflow.instance.completed (Phase 2,
per B3 §8) and Portal public document visibility update on the same event
(Phase 3) are both out of NOTIF's scope entirely — NOTIF was never a
candidate consumer for workflow.instance.completed in any source document;
noted here only to confirm this task list correctly did not attempt to
invent a NOTIF role for that event.]
```

---

### Cross-Module Reference Placeholders (for Step 4 Integration Pass)

Two tasks reference emitting modules whose task lists were not supplied to this pass (per A1-AGENTS.md §2's Pass Types table, which lists only `TASK-WF list` as NOTIF's prerequisite reading, and a1-skeleton.md §2's explicit footnote confirming NOTIF's only module dependency is WF):

- **TASK-NOTIF-007** (`document.state_changed` consumer) references `[CROSS-MODULE REF: DOCS — task list not yet supplied]`. DOCS's Wave D list (`a1-tasks/docs.md`) will supply the real emitting-task ID once available in the same context as this document.
- **TASK-NOTIF-011** (`session.terminated` consumer) references `[CROSS-MODULE REF: IAM — task list not yet supplied]`. IAM's Wave B list (`a1-tasks/iam.md`) will supply the real emitting-task ID once available in the same context as this document.

Both are correctly-applied instances of A1-AGENTS.md §5's placeholder convention, not gaps in this task list's own reasoning — the events themselves, their payloads, and their consumer registration are all fully confirmed (B3 §8 rows 3 and 10); only the specific upstream `TASK-{MODULE}-NNN` citation is deferred, exactly as the convention anticipates for a prerequisite module whose list wasn't part of this pass's reading set.

---

### Task Dependency Graph

```
TASK-NOTIF-001 ──► TASK-NOTIF-002 ──► TASK-NOTIF-003 ──► TASK-NOTIF-004
       │                                                        │
       └──► TASK-NOTIF-005 ─────────────────────┐               │
                                                  │               │
TASK-WF-005 ─────────────────────────────────────┼──► TASK-NOTIF-006
[CROSS-MODULE REF: DOCS] ────────────────────────┼──► TASK-NOTIF-007
TASK-WF-014 ──────────────────────────────────────┼──► TASK-NOTIF-008
TASK-WF-012 + TASK-WF-013 ────────────────────────┼──► TASK-NOTIF-009
                                                   ├──► TASK-NOTIF-010
[CROSS-MODULE REF: IAM] ──────────────────────────┼──► TASK-NOTIF-011
TASK-NOTIF-001 ────────────────────────────────────┴──► TASK-NOTIF-012

TASK-NOTIF-005..012 (all eight) ──► TASK-NOTIF-013 ──► TASK-NOTIF-014
```

---

### Cross-Validation Log

1. **All TASK-WF prerequisite IDs verified directly against `wf.md`, not assumed from its Table of Contents** — `wf.md`'s own Module Summary notes its ToC line numbers were deliberately left stale by the developer's standing instruction; this pass re-derived every cited line range via `grep` before reading, after an initial ToC-trusting read of TASK-WF-012 actually returned TASK-WF-011's content. TASK-WF-005, -009, -012, -013, -014 were each opened and read directly at their grep-verified locations before being cited.
2. **`recipient_user_id` vs `recipient_employee_id` (Conflict #1) checked against three independent sources**, not resolved on a single document's say-so: E1 Module 8 (3 of 4 procedures), B2's `IAMPublicAPI.getUserById` doc comment, and B2's own `NotificationInput` interface. (A fourth citation to B3 §7.11 and a WF assignee-resolution algorithm was removed on review — B3 §7.11's `assignedTo` field carries no explicit `user_id`/`employee_id` type annotation, and the cited algorithm return shape was never independently checked against B4/D3, which fell outside this pass's reading list. The three remaining sources are independently sufficient.)
3. **All 9 H4 events cross-checked against B3's Master Event Registry (§8) directly**, not taken on H4's word alone — every "Consumers" cell for rows 3, 10, 24, 31, 34, 35, 36–39, 40–42 was read from the actual registry table, not inferred from H4's per-event descriptions.
4. **The two new spec gaps (Certification of Urgency bypass, `cutoff_missed`) were checked against three independent documents before being recorded as gaps** — H4's own 9-event catalog (silent on both), B2 Module 7's Events Consumed table (silent on both), and B3's Master Event Registry (both confirmed `audit`-only) — rather than being flagged from a single silent source, which could just as easily have been an incomplete catalog rather than a true absence.
5. **The "eight named Phase 1 priority events" / "trilingual" skeleton claim was traced to its likely source** (`document-list.md` line 293) rather than either dismissed or accepted at face value — confirmed as a pre-H4 planning artifact for the count, and confirmed as pointing to a real, separate, unaddressed gap for the trilingual claim specifically (checked against tech-stack.md, which does confirm the underlying i18n requirement is real platform-wide, just not addressed for notifications specifically).
6. **File path conventions were drawn from `wf.md`'s own stated deliverable paths** (`/packages/database/src/schema/`, `/packages/database/migrations/{NNN}_{module}_create_schema.sql`), not from incidental inspection of the sandbox's live repository state, consistent with this being a document-driven generation pass per A1-AGENTS.md §1's source-of-truth hierarchy.
7. **Every event payload schema cited in every AI Prompt was copied from B3's actual Zod/TypeScript code blocks** (§4.3, §6.2, §7.11, §7.18, §7.21, §7.22, §7.23–7.26, §7.27–7.29), not paraphrased from H4's variable-name tables alone — H4's tables were used to confirm template-variable naming matches B3's payload field naming exactly, which they do in every case checked.
