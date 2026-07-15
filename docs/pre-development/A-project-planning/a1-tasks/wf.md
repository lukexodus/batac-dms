# WF Module — Master Task List

**Generated:** 2026-06-29
**Module:** WF (Workflow Engine)
**Wave:** E — requires TASK-DOCS list (all TASK-DOCS IDs referenced herein are from `docs.md`)
**Phase:** 1 (full spec)
**Source documents loaded (in order):**
1. `a1-skeleton.md` — structural contract
2. `a1-tasks/docs.md` — prerequisite module task list (TASK-DOCS IDs)
3. `b4-workflow-engine-specification.md` — authoritative engine spec
4. `c1-full-database-schema-ddl-v3.md` §workflow — DDL
5. `h1-phase-1-workflow-definitions-structured-data.md` — Phase 1 workflow seed data
6. `d3-state-machine-diagrams.md` — state machines (authoritative over B4 for enum values)
7. `k2-workflow-engine-test-suite-design.md` — test suite design
8. `e1-trpc-router-and-procedure-catalog.md` §workflow — tRPC procedures
9. `b2-module-boundary-and-internal-api-contracts-v1.1.md` — Module 4 boundary contract
10. `consolidated-architecture-and-requirements-reference-iteration-3.md` — Parts 4.1–4.3, 4.10, 4.17, 7.2, 8, 11.3

---

## Table of Contents

- [L58–L326] TASK-WF-001 — `[MIGRATION]` Create workflow schema Drizzle definitions and DDL migration
- [L327–L391] TASK-WF-002 — Scaffold WF module file structure with typed stubs
- [L392–L521] TASK-WF-003 — Implement WorkflowContextSchema and step-config Zod types in `/packages/shared`
- [L522–L607] TASK-WF-004 — Implement WF repository layer — all `workflow.*` tables
- [L608–L718] TASK-WF-005 — Implement engine core — createInstance, step resolution, transition evaluation, assignee resolution, domain event emission
- [L719–L817] TASK-WF-006 — Implement `action`, `decision`, `notification`, and `termination` step handlers (including REPASSED)
- [L818–L890] TASK-WF-007 — `[AUDIT]` Implement `approval` step handler — outcome validation, scheduler-only guard, encoder ≠ final-approver invariant
- [L891–L984] TASK-WF-008 — `[AUDIT]` Implement `multi_referral` step handler — committee metadata, completion sequence, manual advance guard
- [L985–L1062] TASK-WF-009 — `[AUDIT]` Implement Certified Urgent bypass event consumer (`document.certification_urgency.logged`)
- [L1063–L1144] TASK-WF-010 — Implement definition publish-time validator — `MISSING_LAPSE_TRANSITION`, `MISSING_OUTCOME_TRANSITION`, Phase 1 parallel-step guard, legally mandated step guard
- [L1145–L1219] TASK-WF-011 — Implement Thursday cutoff scheduler job (`evaluateThursdayCutoffs` — pgboss, PHT-timezone-aware, idempotent)
- [L1220–L1297] TASK-WF-012 — Implement Mayor lapse timer scheduler job (`evaluateMayorLapseTimers` — hourly node-cron, pessimistic lock, race-condition prevention)
- [L1298–L1373] TASK-WF-013 — Implement Panlalawigan 30-day timer scheduler job (`evaluatePanlalawiganTimers` — daily 06:00 PHT, 30-calendar-day, VALID_IN_PART paths)
- [L1374–L1445] TASK-WF-014 — Implement SLA escalation monitor (`evaluateSlaBreaches` — 15-min node-cron, startup run, 80%/100%/150% thresholds, working-day computation)
- [L1446–L1542] TASK-WF-015 — `[AUDIT]` Implement Version Management Option B — `migrateInstance`, `bypassStep`, `cancelInstance` (step key mapping, City Admin approval check, 24-hour reversal window)
- [L1543–L1622] TASK-WF-016 — Seed Phase 1 workflow definitions — SP Resolution, SP Ordinance, Appropriation Ordinance (deterministic uuidv5, idempotent)
- [L1623–L1704] TASK-WF-017 — `[ABAC]` Implement WF ABAC policy guard — step-assignment checks, encoder ≠ final-approver enforcement, role gates
- [L1705–L1793] TASK-WF-018 — `[ABAC]` Implement workflow tRPC router — read procedures (`getInstance`, `getActiveInstanceForDocument`, `listMyAssignedSteps`, `getSlaComplianceData`)
- [L1794–L1899] TASK-WF-019 — `[ABAC][AUDIT]` Implement workflow tRPC router — action and approval step procedures
- [L1900–L1957] TASK-WF-020 — `[ABAC][AUDIT]` Implement workflow tRPC router — multi-referral procedures
- [L1958–L2061] TASK-WF-021 — `[AUDIT]` Implement workflow tRPC router — Mayor/Panlalawigan/publication lapse procedures
- [L2062–L2129] TASK-WF-022 — `[AUDIT]` Implement workflow tRPC router — admin procedures
- [L2130–L2223] TASK-WF-023 — Implement Session and Order of Business tRPC router (`sessionRouter`)
- [L2224–L2309] TASK-WF-024 — Wire WF Fastify plugin, event bus consumers (`document.created`, delegation events), and WF Published API implementation
- [L2310–L2411] TASK-WF-025 — Implement WF Vitest test suite per K2
- [L2412–L2527] Module Summary
  - [L2420–L2432] Document Conflicts Resolved at Generation Time
  - [L2433–L2455] Systematic Event Name Convention
  - [L2456–L2465] Confirmed Spec Gaps Carried Forward
  - [L2466–L2479] Deferred Capabilities (Phase 2 / Phase 1B)
  - [L2480–L2514] Task Dependency Graph (abbreviated — full prerequisites in each task header)
  - [L2515–L2527] Cross-Validation Log

---

## TASK-WF-001

Phase:          1
Module:         WF
Title:          [MIGRATION] Create workflow schema Drizzle definitions and DDL migration
Prerequisites:  [TASK-DOCS-001]
Deliverables:
  - /packages/database/src/schema/workflow.schema.ts — Drizzle schema definitions for all workflow schema objects: 3 native PostgreSQL ENUM types (`workflow_step_type_enum`, `workflow_instance_status_enum`, `workflow_step_status_enum`) and 15 tables: `workflow.definitions`, `workflow.definition_versions`, `workflow.steps`, `workflow.transition_rules`, `workflow.instances`, `workflow.step_instances`, `workflow.workflow_events`, `workflow.pending_certified_urgent_bypasses`, `workflow.committee_reports`, `workflow.committee_report_signatures`, `workflow.sp_sessions`, `workflow.session_attendances`, `workflow.order_of_business`, `workflow.order_of_business_items`, `workflow.admin_approval_grants` `[OPEN-Q-3 RESOLVED — see Module Summary]`; also ALTER statements adding `superseded_by UUID NULL`, `previous_document_id UUID NULL`, `closure_reason TEXT NULL`, `superseded_at TIMESTAMPTZ NULL` to `documents.documents`
  - NOTE: the "11 tables" figure in the prior draft of this line undercounted even before `admin_approval_grants` was added (14 were already listed there). Corrected count: 15.
  - /packages/database/migrations/{NNN}_workflow_create_schema.sql — generated SQL migration from `pnpm db:generate`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes across the monorepo
  - [ ] `pnpm db:generate` produces a SQL migration that creates the `workflow` schema, all 3 ENUMs, all 15 tables, all indexes, and `REVOKE UPDATE, DELETE ON workflow.workflow_events FROM batac_app`
  - [ ] `workflow.admin_approval_grants` exists with FKs to `workflow.instances` and `workflow.definition_versions`, and a partial index on `(instance_id, target_version_id) WHERE used = false AND deleted_at IS NULL` `[OPEN-Q-3 RESOLVED]`
  - [ ] `pnpm db:migrate` applies cleanly against a fresh local database
  - [ ] `workflow_instance_status_enum` contains exactly the D3-authoritative values: `'Running', 'Paused', 'Stuck', 'Completed', 'Cancelled'` (NOT B4's lowercase `active/suspended`)
  - [ ] `workflow_step_status_enum` contains exactly D3-authoritative values: `'Pending', 'Active', 'Completed', 'Skipped', 'Returned', 'Failed', 'Cancelled'` (`Skipped` replaces B4's `bypassed`; `Returned` is new)
  - [ ] `workflow_step_type_enum` contains all 8 values including Phase 2 reserved `parallel_split` and `parallel_join`
  - [ ] `workflow.step_instances` has a GIN index on the `metadata` JSONB column
  - [ ] `workflow.workflow_events` has no `deleted_at`/`deleted_by` columns (append-only)
  - [ ] `workflow.definitions` has a partial unique index `(document_type_id) WHERE is_active = true AND deleted_at IS NULL`
  - [ ] `workflow.definition_versions` has a partial unique index `(definition_id) WHERE is_current = true`
  - [ ] `workflow.steps` has a partial unique index `(definition_version_id) WHERE is_start = true AND deleted_at IS NULL`
  - [ ] `documents.documents` gains the four repass columns: `superseded_by`, `previous_document_id`, `closure_reason`, `superseded_at`
AI Prompt:
  > You are implementing the Drizzle ORM schema and DDL migration for the `workflow` PostgreSQL schema in the Batac City LGU document management platform. This is a custom domain-specific workflow engine used to orchestrate the entire legislative document lifecycle (SP Resolutions, SP Ordinances, Appropriation Ordinances).
  >
  > **CRITICAL: ENUM VALUES — USE THESE EXACTLY (D3 state machine diagrams are authoritative; B4 and C1's DDL use B4 values which are superseded by D3):**
  >
  > ```sql
  > -- workflow_step_type_enum: 8 values (parallel_split/join are Phase 2 reserved)
  > CREATE TYPE workflow.workflow_step_type_enum AS ENUM
  >   ('action','approval','multi_referral','decision','notification','termination','parallel_split','parallel_join');
  >
  > -- workflow_instance_status_enum: D3-authoritative (NOT B4's active/suspended)
  > CREATE TYPE workflow.workflow_instance_status_enum AS ENUM
  >   ('Running','Paused','Stuck','Completed','Cancelled');
  >
  > -- workflow_step_status_enum: D3-authoritative ('Skipped' replaces 'bypassed'; 'Returned' is new)
  > CREATE TYPE workflow.workflow_step_status_enum AS ENUM
  >   ('Pending','Active','Completed','Skipped','Returned','Failed','Cancelled');
  > ```
  >
  > **ALL TABLES (create in this order to respect foreign key dependencies):**
  >
  > Platform-wide conventions: UUID PK via `gen_random_uuid()`, `city_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid`, TIMESTAMPTZ on all timestamps, NOT NULL unless noted. Cross-schema references (to iam.users, documents.*, organization.*) are logical only — no DB-level FK constraints.
  >
  > ```sql
  > workflow.definitions(
  >   id UUID PK, city_id UUID,
  >   document_type_id UUID NOT NULL,  -- logical FK → documents.document_types.id
  >   name TEXT NOT NULL, description TEXT NULL, is_active BOOLEAN NOT NULL DEFAULT false,
  >   created_by UUID NOT NULL,        -- logical FK → iam.users.id
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL
  > )
  > -- PARTIAL UNIQUE INDEX: (document_type_id) WHERE is_active = true AND deleted_at IS NULL
  >
  > workflow.definition_versions(
  >   id UUID PK, city_id UUID,
  >   definition_id UUID NOT NULL REFERENCES workflow.definitions(id),
  >   version_number INTEGER NOT NULL,
  >   snapshot JSONB NOT NULL,          -- authoritative on conflict with denormalized steps rows
  >   published_at TIMESTAMPTZ NULL,
  >   published_by UUID NULL,           -- logical FK → iam.users.id
  >   deprecated_at TIMESTAMPTZ NULL,
  >   is_current BOOLEAN NOT NULL DEFAULT false,
  >   status TEXT GENERATED ALWAYS AS (
  >     CASE WHEN deprecated_at IS NOT NULL THEN 'Deprecated'
  >          WHEN published_at  IS NOT NULL THEN 'Published'
  >          ELSE 'Draft' END
  >   ) STORED,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL,
  >   UNIQUE(definition_id, version_number)
  > )
  > -- PARTIAL UNIQUE INDEX: (definition_id) WHERE is_current = true
  >
  > workflow.steps(
  >   id UUID PK, city_id UUID,
  >   definition_version_id UUID NOT NULL REFERENCES workflow.definition_versions(id),
  >   step_key TEXT NOT NULL, step_type workflow.workflow_step_type_enum NOT NULL,
  >   label TEXT NOT NULL, config JSONB NULL,
  >   position INTEGER NOT NULL DEFAULT 0, is_start BOOLEAN NOT NULL DEFAULT false,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL,
  >   UNIQUE(definition_version_id, step_key)
  > )
  > -- PARTIAL UNIQUE INDEX: (definition_version_id) WHERE is_start = true AND deleted_at IS NULL
  > -- INDEX: idx_steps_definition_version(definition_version_id)
  >
  > workflow.transition_rules(
  >   id UUID PK, city_id UUID,
  >   definition_version_id UUID NOT NULL REFERENCES workflow.definition_versions(id),
  >   from_step_id UUID NOT NULL REFERENCES workflow.steps(id),
  >   to_step_id UUID NOT NULL REFERENCES workflow.steps(id),
  >   condition_expression TEXT NULL,   -- JSONLogic; null = unconditional
  >   outcome_filter TEXT NULL,         -- if set, rule only fires when step outcome matches this value
  >   priority INTEGER NOT NULL DEFAULT 0,  -- lower = evaluated first
  >   label TEXT NULL,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL
  > )
  > -- INDEXES: idx_transition_rules_from_step(from_step_id), idx_transition_rules_definition_version(definition_version_id)
  >
  > workflow.instances(
  >   id UUID PK, city_id UUID,
  >   definition_version_id UUID NOT NULL REFERENCES workflow.definition_versions(id),
  >   document_id UUID NOT NULL,        -- logical FK → documents.documents.id
  >   status workflow.workflow_instance_status_enum NOT NULL DEFAULT 'Running',
  >   context JSONB NOT NULL DEFAULT '{}'::jsonb,
  >   sla_deadline TIMESTAMPTZ NULL, sla_breached_at TIMESTAMPTZ NULL,
  >   started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ NULL,
  >   created_by UUID NOT NULL,         -- logical FK → iam.users.id
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL
  > )
  > -- INDEXES: idx_instances_document(document_id), idx_instances_definition_version(definition_version_id)
  > -- PARTIAL INDEX: idx_instances_sla_active(sla_deadline) WHERE status = 'Running'
  >
  > workflow.step_instances(
  >   id UUID PK, city_id UUID,
  >   instance_id UUID NOT NULL REFERENCES workflow.instances(id),
  >   step_id UUID NOT NULL REFERENCES workflow.steps(id),
  >   status workflow.workflow_step_status_enum NOT NULL DEFAULT 'Pending',
  >   assigned_to JSONB NULL,           -- array of {user_id, resolved_via}; snapshot at activation
  >   started_at TIMESTAMPTZ NULL, completed_at TIMESTAMPTZ NULL,
  >   outcome TEXT NULL, outcome_comment TEXT NULL,
  >   metadata JSONB NULL,              -- multi_referral submissions etc.
  >   sla_deadline TIMESTAMPTZ NULL, sla_breached_at TIMESTAMPTZ NULL,
  >   bypassed_at TIMESTAMPTZ NULL,
  >   bypassed_by UUID NULL,            -- null for system-triggered bypasses
  >   bypass_reason TEXT NULL,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL
  > )
  > -- INDEXES: idx_step_instances_instance(instance_id), idx_step_instances_step(step_id)
  > -- GIN INDEX: idx_step_instances_metadata_gin USING GIN (metadata)
  >
  > workflow.workflow_events(  -- APPEND-ONLY: no deleted_at/deleted_by, no updated_at
  >   id UUID PK, city_id UUID,
  >   instance_id UUID NOT NULL REFERENCES workflow.instances(id),
  >   step_instance_id UUID NULL REFERENCES workflow.step_instances(id),
  >   event_type TEXT NOT NULL,
  >   actor_id UUID NULL,               -- null for system events
  >   actor_type TEXT NOT NULL CHECK (actor_type IN ('user','system','scheduler')),
  >   payload JSONB NOT NULL,
  >   occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
  > )
  > -- INDEXES: idx_workflow_events_instance(instance_id), idx_workflow_events_step_instance(step_instance_id), idx_workflow_events_occurred_at(occurred_at)
  > -- AFTER ALL TABLES: REVOKE UPDATE, DELETE ON workflow.workflow_events FROM batac_app;
  >
  > workflow.pending_certified_urgent_bypasses(
  >   id UUID PK, city_id UUID,
  >   instance_id UUID NOT NULL REFERENCES workflow.instances(id),
  >   step_key TEXT NOT NULL DEFAULT 'committee_referral',
  >   certification_document_id UUID NOT NULL,  -- logical FK → documents.documents.id
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   applied_at TIMESTAMPTZ NULL,
  >   applied_to_step_instance_id UUID NULL REFERENCES workflow.step_instances(id),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL
  > )
  > -- INDEX: idx_pending_bypasses_instance(instance_id)
  >
  > workflow.committee_reports(
  >   id UUID PK, city_id UUID,
  >   step_instance_id UUID NOT NULL REFERENCES workflow.step_instances(id),
  >   submitted_at TIMESTAMPTZ NULL,
  >   is_unified BOOLEAN NOT NULL DEFAULT false, is_accepted BOOLEAN NOT NULL DEFAULT false,
  >   accepted_by UUID NULL,            -- logical FK → iam.users.id
  >   accepted_at TIMESTAMPTZ NULL,
  >   content TEXT NULL,
  >   document_id UUID NULL,            -- logical FK → documents.documents.id
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL,
  >   UNIQUE(step_instance_id)
  > )
  > -- TRIGGER: fn_set_updated_at BEFORE UPDATE
  >
  > workflow.committee_report_signatures(
  >   id UUID PK, city_id UUID,
  >   committee_report_id UUID NOT NULL REFERENCES workflow.committee_reports(id),
  >   committee_id UUID NOT NULL,       -- logical FK → organization.committees.id
  >   signed_by_employee_id UUID NULL,  -- logical FK → organization.employees.id
  >   signed_at TIMESTAMPTZ NULL,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL,
  >   UNIQUE(committee_report_id, committee_id)
  > )
  >
  > workflow.sp_sessions(
  >   id UUID PK, city_id UUID,
  >   session_number INTEGER NOT NULL,
  >   session_date DATE NOT NULL,
  >   session_type TEXT NOT NULL CHECK (session_type IN ('regular','special')),
  >   presided_by_employee_id UUID NOT NULL,  -- logical FK → organization.employees.id
  >   present_count INTEGER NULL, quorum_achieved BOOLEAN NULL,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL,
  >   UNIQUE(city_id, session_number)
  > )
  > -- TRIGGER: fn_set_updated_at BEFORE UPDATE
  >
  > workflow.session_attendances(
  >   id UUID PK, city_id UUID,
  >   sp_session_id UUID NOT NULL REFERENCES workflow.sp_sessions(id),
  >   employee_id UUID NOT NULL,        -- logical FK → organization.employees.id
  >   is_present BOOLEAN NOT NULL,
  >   absence_reason TEXT NULL CHECK (absence_reason IN ('ob','sick_leave','vacation_leave','absent')),
  >   recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL,
  >   UNIQUE(sp_session_id, employee_id),
  >   CHECK(is_present = true OR absence_reason IS NOT NULL)
  > )
  >
  > workflow.order_of_business(
  >   id UUID PK, city_id UUID,
  >   sp_session_id UUID NOT NULL REFERENCES workflow.sp_sessions(id),
  >   generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   cutoff_date DATE NOT NULL,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL,
  >   UNIQUE(sp_session_id)
  > )
  >
  > workflow.order_of_business_items(
  >   id UUID PK, city_id UUID,
  >   order_of_business_id UUID NOT NULL REFERENCES workflow.order_of_business(id),
  >   document_id UUID NOT NULL,        -- logical FK → documents.documents.id
  >   item_order INTEGER NOT NULL,
  >   item_type TEXT NOT NULL CHECK (item_type IN ('first_reading','second_reading','third_reading','committee_report','other')),
  >   is_red_flagged BOOLEAN NOT NULL DEFAULT false,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL,
  >   UNIQUE(order_of_business_id, item_order)
  > )
  >
  > workflow.admin_approval_grants(
  >   -- [OPEN-Q-3 RESOLVED, developer decision 2026-07-02]: table lives in the `workflow` schema (Option A),
  >   -- not `iam`. WF owns both the table and its consumption logic — no cross-schema dependency.
  >   -- [Inference]: the column list below is not independently specified anywhere as a literal CREATE TABLE
  >   -- statement. It is derived directly from the approval-record shape TASK-WF-015 already assumes
  >   -- ({ approver_user_id, target_version_id, instance_id, reason, expiry_timestamp } WHERE expiry_timestamp
  >   -- > NOW() AND used = false) plus this migration's established per-table conventions (id, city_id,
  >   -- created_at, soft-delete pair). Confirm column names against TASK-WF-015's actual query once written.
  >   id UUID PK, city_id UUID,
  >   instance_id UUID NOT NULL REFERENCES workflow.instances(id),
  >   target_version_id UUID NOT NULL REFERENCES workflow.definition_versions(id),
  >   approver_user_id UUID NOT NULL,   -- logical FK → iam.users.id; City Administrator role is enforced by the
  >                                     -- calling tRPC procedure's ABAC guard (TASK-WF-022), not by this table
  >   reason TEXT NOT NULL,
  >   granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   expiry_timestamp TIMESTAMPTZ NOT NULL,
  >   used BOOLEAN NOT NULL DEFAULT false,
  >   used_at TIMESTAMPTZ NULL,
  >   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  >   deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL
  > )
  > -- INDEX: idx_admin_approval_grants_instance(instance_id)
  > -- PARTIAL INDEX: idx_admin_approval_grants_unused(instance_id, target_version_id) WHERE used = false AND deleted_at IS NULL
  > ```
  >
  > **Additionally, add to this migration (ALTER TABLE on the documents schema — already created by TASK-DOCS-001):**
  > ```sql
  > -- Required for REPASSED termination path (ADR-014, D3 Appendix D)
  > -- When Panlalawigan returns a document and it is repassed, the original document is superseded
  > -- and the original workflow instance remains 'Running' indefinitely (no distinct Repassed status)
  > ALTER TABLE documents.documents
  >   ADD COLUMN IF NOT EXISTS superseded_by UUID NULL REFERENCES documents.documents(id),
  >   ADD COLUMN IF NOT EXISTS previous_document_id UUID NULL REFERENCES documents.documents(id),
  >   ADD COLUMN IF NOT EXISTS closure_reason TEXT NULL,
  >   ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ NULL;
  > ```
  >
  > **Notes on the fn_set_updated_at trigger:** This function is already defined in the `public` schema from an earlier INFRA migration. Apply it to `committee_reports` and `sp_sessions` with `BEFORE UPDATE FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at()`.
  >
  > **Drizzle implementation:** Use `pgSchema('workflow')` to scope all tables. Export individual table objects. Use Drizzle's native enum support via `pgEnum`. The `status` GENERATED column on `definition_versions` may need `sql` template for the Drizzle definition.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes across the monorepo
  > - [ ] `pnpm db:generate` produces correct SQL with workflow schema, 3 ENUMs, 15 tables, all indexes
  > - [ ] `workflow.admin_approval_grants` created with the columns specified above `[OPEN-Q-3 RESOLVED — workflow schema, not iam]`
  > - [ ] `pnpm db:migrate` applies cleanly against a fresh local database
  > - [ ] `workflow_instance_status_enum` contains exactly `'Running','Paused','Stuck','Completed','Cancelled'`
  > - [ ] `workflow_step_status_enum` contains exactly `'Pending','Active','Completed','Skipped','Returned','Failed','Cancelled'`
  > - [ ] `workflow.workflow_events` has no `deleted_at`/`deleted_by` columns
  > - [ ] `workflow.definitions` partial unique index `(document_type_id) WHERE is_active = true AND deleted_at IS NULL` exists
  > - [ ] `workflow.step_instances` has GIN index on `metadata`
  > - [ ] `documents.documents` gains four repass columns
  > - [ ] `REVOKE UPDATE, DELETE ON workflow.workflow_events FROM batac_app` is at end of migration

---

## TASK-WF-002

Phase:          1
Module:         WF
Title:          Scaffold WF module file structure with typed stubs
Prerequisites:  [TASK-WF-001]
Deliverables:
  - /apps/server/src/modules/workflow/index.ts — module entry point exporting the Fastify plugin and the `WorkflowPublicAPI` interface; declares method stubs: `getInstanceById`, `getActiveInstanceForDocument`, `getWorkflowSLAData`
  - /apps/server/src/modules/workflow/workflow.db.ts — typed Drizzle accessor scoped to the workflow schema
  - /apps/server/src/modules/workflow/engine/index.ts — engine entry point exporting all 7 method stubs: `createInstance`, `submitStepAction`, `bypassStep`, `cancelInstance`, `migrateInstance`, `evaluateTimers`, `evaluateSlaBreaches` — each throwing `NotImplementedError` at this stage
  - /apps/server/src/modules/workflow/engine/types.ts — internal TypeScript types derived from Drizzle schema
  - /apps/server/src/modules/workflow/workflow.plugin.ts — Fastify plugin stub with `fp()` wrapper
  - /apps/server/src/modules/workflow/workflow.router.ts — tRPC router stub; all procedures return `notImplemented`
  - /apps/server/src/modules/workflow/session.router.ts — session/OoB tRPC router stub
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes with no errors in the workflow module
  - [ ] `WorkflowPublicAPI` interface matches the B2 Module 4 Published API signature exactly
  - [ ] All 7 engine entry points exported from `engine/index.ts` with correct TypeScript signatures
  - [ ] The plugin stub registers without runtime errors (`pnpm dev` starts successfully)
AI Prompt:
  > You are scaffolding the WF (Workflow) module file structure for the Batac City LGU platform. The workflow module owns the `workflow` PostgreSQL schema and implements a custom domain-specific workflow engine.
  >
  > **Published API interface (B2 Module 4 — implement exactly):**
  > ```typescript
  > interface WorkflowPublicAPI {
  >   getInstanceById(instanceId: string): Promise<WorkflowInstanceSummary | null>;
  >   getActiveInstanceForDocument(documentId: string): Promise<WorkflowInstanceSummary | null>;
  >   getWorkflowSLAData(filter: WorkflowSLAFilter): Promise<WorkflowSLAData[]>;
  > }
  > interface WorkflowInstanceSummary {
  >   instanceId: string; documentId: string; definitionId: string;
  >   definitionVersionId: string;  // pinned at creation; immutable except via migrateInstance
  >   currentStepType: WorkflowStepType; currentStepInstanceId: string;
  >   currentAssigneeUserId: string | null;
  >   status: 'Active' | 'Completed' | 'Cancelled';  // B2 Published API surface; maps from internal DB enum ('Running'→'Active', 'Paused'→'Active', 'Stuck'→'Active')
  >   slaDeadline: Date | null;
  >   lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null;
  >   createdAt: Date;
  > }
  > type WorkflowStepType = 'action'|'approval'|'multi_referral'|'decision'|'notification'|'termination'|'parallel_split'|'parallel_join';
  > interface WorkflowSLAFilter { officeId?: string; documentTypeId?: string; from?: Date; to?: Date; breachedOnly?: boolean; }
  > interface WorkflowSLAData { instanceId: string; documentId: string; documentTypeId: string; slaClassification: 'simple'|'complex'|'highly_technical'; slaThresholdDays: number; elapsedWorkingDays: number; isBreached: boolean; breachedAt: Date | null; currentAssigneeOfficeId: string | null; }
  > ```
  >
  > **Engine entry points (stub with NotImplementedError):**
  > - `engine.createInstance(documentId: string, definitionId: string): Promise<WorkflowInstance>`
  > - `engine.submitStepAction(stepInstanceId: string, actorId: string, outcome: string, comment: string | null, payload: Record<string, unknown>): Promise<void>`
  > - `engine.bypassStep(stepInstanceId: string, actorId: string, bypassReason: string, comment: string): Promise<void>`
  > - `engine.cancelInstance(instanceId: string, actorId: string, reason: string): Promise<void>`
  > - `engine.migrateInstance(instanceId: string, targetVersionId: string, actorId: string, reason: string): Promise<{ reversibleUntil: Date }>`
  > - `engine.evaluateTimers(): Promise<void>`
  > - `engine.evaluateSlaBreaches(): Promise<void>`
  >
  > **Instance and step status enums (D3-authoritative):**
  > - Instance: `'Running' | 'Paused' | 'Stuck' | 'Completed' | 'Cancelled'`
  > - Step: `'Pending' | 'Active' | 'Completed' | 'Skipped' | 'Returned' | 'Failed' | 'Cancelled'`
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes with no errors in the workflow module
  > - [ ] `WorkflowPublicAPI` interface matches B2 Module 4 exactly
  > - [ ] All 7 engine entry points exported with correct signatures
  > - [ ] Plugin stub registers without runtime errors

---

## TASK-WF-003

Phase:          1
Module:         WF
Title:          Implement WorkflowContextSchema and step-config Zod types in `/packages/shared`
Prerequisites:  [TASK-WF-002]
Deliverables:
  - /packages/shared/src/workflow/context.schema.ts — Zod schema `WorkflowContextSchema` for `workflow.instances.context` JSONB; all keys optional/nullable at initialization; enforces UUID format on UUID fields
  - /packages/shared/src/workflow/step-config.schema.ts — Zod schemas for all 6 Phase 1 step type configs: `ActionStepConfigSchema` (with `triggers_mayor_lapse_timer` and `triggers_panlalawigan_timer` extension fields), `ApprovalStepConfigSchema` (with `is_final_approval` extension field), `MultiReferralStepConfigSchema`, `DecisionStepConfigSchema`, `NotificationStepConfigSchema`, `TerminationStepConfigSchema`; plus `WorkflowStepDefSchema`, `WorkflowTransitionRuleDefSchema`, `WorkflowDefinitionSeedSchema` for seed validation
  - /packages/shared/src/workflow/index.ts — re-exports all workflow types and schemas
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes in `/packages/shared`
  - [ ] `WorkflowContextSchema.parse({})` succeeds (all keys optional)
  - [ ] `WorkflowContextSchema.parse({ document_id: 'not-a-uuid' })` throws Zod error
  - [ ] `TerminationStepConfigSchema` accepts `{ outcome_code: 'REPASSED', final_document_status: null }` without error
  - [ ] `MultiReferralStepConfigSchema` requires `thursday_cutoff_enabled`, `require_all_committee_signatures`, `allow_secretary_advance` as non-optional fields
  - [ ] `ApprovalStepConfigSchema` accepts optional `is_final_approval: true` (used by vp_certification step)
AI Prompt:
  > You are implementing the Zod schemas for the Batac City LGU workflow engine's context and step configuration types, living in `/packages/shared/src/workflow/`.
  >
  > **WorkflowContextSchema (B4 Appendix B — full key list):**
  > All keys are optional at init; they transition from null to set values as the workflow progresses. Keys are never removed from context.
  > ```typescript
  > WorkflowContextSchema = z.object({
  >   // Set at instance creation
  >   document_id: z.string().uuid().optional(),
  >   document_type: z.enum(['sp_resolution','sp_ordinance','appropriation_ordinance']).optional(),
  >   created_by: z.string().uuid().optional(),  // for encoder≠final-approver invariant #11
  >   // Written by documents module callbacks
  >   series_number_preliminary: z.string().nullable().optional(),
  >   series_number_final: z.string().nullable().optional(),
  >   qr_tracking_id: z.string().uuid().nullable().optional(),
  >   // Certified Urgent (set by bypass handler)
  >   certified_urgent: z.boolean().optional().default(false),
  >   certified_urgent_document_id: z.string().uuid().nullable().optional(),
  >   // Thursday cutoff scheduler output
  >   second_reading_eligible_date: z.string().nullable().optional(),  // ISO date YYYY-MM-DD
  >   // Mayor review (set by context writer on transmittal_letter_to_mayor completion)
  >   mayor_transmittal_date: z.string().nullable().optional(),   // TIMESTAMPTZ string
  >   mayor_action_deadline: z.string().nullable().optional(),    // TIMESTAMPTZ string
  >   mayor_action: z.enum(['SIGNED','VETOED','LAPSED']).nullable().optional(),
  >   mayor_action_date: z.string().nullable().optional(),
  >   // Veto override
  >   veto_override_vote_count: z.number().int().nullable().optional(),
  >   veto_override_outcome: z.enum(['OVERRIDE_SUCCEEDED','OVERRIDE_FAILED']).nullable().optional(),
  >   // Panlalawigan review (set by context writer on panlalawigan_transmission_logging completion)
  >   panlalawigan_transmission_date: z.string().nullable().optional(),
  >   panlalawigan_action_deadline: z.string().nullable().optional(),
  >   panlalawigan_outcome: z.enum(['VALID','VALID_IN_PART','RETURNED','DEEMED_APPROVED','OPERATIVE_IN_ITS_ENTIRETY']).nullable().optional(),
  >   panlalawigan_response_date: z.string().nullable().optional(),
  >   panlalawigan_resolution_number: z.string().nullable().optional(),
  >   // Publication (SP Ordinance with penalty clause only)
  >   requires_publication: z.boolean().optional(),  // H1-X-2 write path resolved — see TASK-WF-005 [OPEN-Q-2 RESOLVED, Option B]; set at createInstance via cross-module query, defaults false
  >   publication_date: z.string().nullable().optional(),
  >   publication_newspaper: z.string().nullable().optional(),
  >   // VALID_IN_PART routing (ADR-03)
  >   referred_committee_chair_id: z.string().uuid().nullable().optional(),
  >   // SLA
  >   sla_paused: z.literal(false).optional(),  // always false in Phase 1; reserved
  > })
  > ```
  >
  > **Step config schemas (B4 §4.1–4.6):**
  > ```typescript
  > ActionStepConfigSchema = z.object({
  >   assignee: z.string(),
  >   form_key: z.string().optional(),
  >   require_comment: z.boolean().default(false),
  >   allow_comment: z.boolean().default(true),
  >   auto_complete: z.boolean().default(false),
  >   deadline_hours: z.number().int().positive().optional(),
  >   // H1-X-1 resolution: engine recognizes these as config flags on action steps
  >   triggers_mayor_lapse_timer: z.boolean().optional(),   // true on transmittal_letter_to_mayor
  >   triggers_panlalawigan_timer: z.boolean().optional(),  // true on panlalawigan_transmission_logging
  > })
  >
  > ApprovalStepConfigSchema = z.object({
  >   assignee: z.string(),
  >   allowed_outcomes: z.array(z.string()).min(1),  // subset of valid outcome codes
  >   require_comment_on: z.array(z.string()).default(['REJECTED','RETURNED_FOR_REVISION']),
  >   deadline_hours: z.number().int().positive().optional(),
  >   is_final_approval: z.boolean().optional(),  // true on vp_certification; triggers encoder≠approver invariant #11
  > })
  >
  > MultiReferralStepConfigSchema = z.object({
  >   default_committee_roles: z.array(z.string()),
  >   report_acceptor_role: z.string(),
  >   thursday_cutoff_enabled: z.boolean(),         // MUST be true for SP Resolution/Ordinance
  >   cutoff_time_pht: z.string().default('23:59:59'),
  >   require_all_committee_signatures: z.boolean(), // MUST be true
  >   allow_secretary_advance: z.boolean(),
  > })
  >
  > DecisionStepConfigSchema = z.object({
  >   condition_expression: z.string(),  // JSONLogic expression
  >   true_outcome: z.string().default('TRUE'),
  >   false_outcome: z.string().default('FALSE'),
  > })
  >
  > NotificationStepConfigSchema = z.object({
  >   template_key: z.string(),
  >   recipients: z.array(z.string()),
  >   channels: z.array(z.string()).default(['in_app']),
  >   payload_context_keys: z.array(z.string()).optional(),
  > })
  >
  > TerminationStepConfigSchema = z.object({
  >   outcome_code: z.enum([
  >     'APPROVED_AND_RELEASED','LAPSED_INTO_LAW','DEEMED_APPROVED_PANLALAWIGAN',
  >     'VETOED_OVERRIDE_FAILED','REJECTED_AT_VOTE','ARCHIVED_NO_ACTION',
  >     'CANCELLED','VALID_IN_PART_RESOLVED','REPASSED'
  >   ]),
  >   final_document_status: z.enum(['RELEASED','ARCHIVED','CANCELLED']).nullable(),
  >     // null for REPASSED path — document lifecycle tracked via documents.superseded_by
  >   emit_event: z.string().optional(),
  > })
  > ```
  >
  > Also define `WorkflowStepDefSchema` (combines step metadata with config discriminated union by step_type, includes `legally_mandated: z.boolean()` extension field), `WorkflowTransitionRuleDefSchema`, and `WorkflowDefinitionSeedSchema` for seed script validation.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes in `/packages/shared`
  > - [ ] `WorkflowContextSchema.parse({})` succeeds
  > - [ ] `WorkflowContextSchema.parse({ document_id: 'not-a-uuid' })` throws Zod error
  > - [ ] `TerminationStepConfigSchema` accepts `{ outcome_code: 'REPASSED', final_document_status: null }`
  > - [ ] `MultiReferralStepConfigSchema` requires `thursday_cutoff_enabled`, `require_all_committee_signatures`, `allow_secretary_advance`
  > - [ ] `ApprovalStepConfigSchema` accepts optional `is_final_approval: true`

---

## TASK-WF-004

Phase:          1
Module:         WF
Title:          Implement WF repository layer — all workflow.* tables
Prerequisites:  [TASK-WF-002, TASK-WF-003]
Deliverables:
  - /apps/server/src/modules/workflow/workflow.repository.ts — typed repository functions for all 11 workflow schema tables; key constraint: `createWorkflowEvent` provides INSERT only; `updateInstanceStatus` has application-level guard rejecting updates when current status is `'Completed'` or `'Cancelled'`; `updateInstanceContext` uses JSONB merge (`||` operator); `migrateInstanceVersion` is the ONLY function that updates `definition_version_id`
  - /apps/server/src/modules/workflow/workflow.repository.test.ts — Vitest unit tests for repository layer
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm test apps/server/src/modules/workflow/workflow.repository.test.ts` passes
  - [ ] `createWorkflowEvent` has no update or delete code paths anywhere in the repository
  - [ ] `updateInstanceStatus` throws CONFLICT when current status is `'Completed'` or `'Cancelled'` (B4 invariant #6)
  - [ ] `updateInstanceContext` merges (not replaces) the patch into existing context via JSONB `||`
  - [ ] `migrateInstanceVersion` is the only repository function that writes `definition_version_id`
AI Prompt:
  > You are implementing the repository layer for the WF module. All functions accept an optional `tx` (Drizzle transaction) parameter for atomic multi-table operations. The repository does NOT start transactions itself — the engine layer owns transaction boundaries.
  >
  > **Key constraints:**
  > 1. `workflow.workflow_events` is append-only. Provide ONLY insert + read functions. The DB already has `REVOKE UPDATE, DELETE` enforced at grant level.
  > 2. `instances.definition_version_id` may only be updated via `migrateInstanceVersion`. No generic updateInstance function should expose this column.
  > 3. `updateInstanceStatus` application-level guard: if current status is `'Completed'` or `'Cancelled'`, throw a typed CONFLICT error before any DB write (B4 invariant #6).
  > 4. `updateInstanceContext(id, patch)`: uses Drizzle's `sql` template for JSONB merge — `context = context || ${json}::jsonb`. This merges keys rather than replacing the entire object.
  >
  > **Required exports:**
  > ```typescript
  > // definitions + definition_versions
  > getActiveDefinitionForDocumentType(documentTypeId: string, tx?): Promise<{definition, currentVersion} | null>
  > createDefinition(data, tx?): Promise<Definition>
  > createDefinitionVersion(data, tx?): Promise<DefinitionVersion>
  > getDefinitionVersionWithSteps(versionId: string, tx?): Promise<{version, steps, transitionRules} | null>
  > publishDefinitionVersion(versionId: string, publishedBy: string, tx?): Promise<void>
  >
  > // instances
  > createInstance(data, tx?): Promise<Instance>
  > getInstanceById(id: string, tx?): Promise<Instance | null>
  > getActiveInstanceForDocument(documentId: string, tx?): Promise<Instance | null>
  > updateInstanceStatus(id: string, status: InstanceStatus, completedAt?: Date, tx?): Promise<void>
  >   // GUARD: throw CONFLICT if current status is 'Completed' or 'Cancelled'
  > updateInstanceContext(id: string, patch: Partial<WorkflowContext>, tx?): Promise<void>
  >   // Uses JSONB || merge, NOT full replacement
  > migrateInstanceVersion(id: string, targetVersionId: string, tx?): Promise<void>
  >   // ONLY function allowed to write definition_version_id
  > getActiveInstancesByDefinitionAndStepConfig(config: { stepType?: StepType, configKey?: string, configValue?: string }, tx?): Promise<InstanceWithActiveStep[]>
  >   // Used by scheduler jobs
  >
  > // step_instances
  > createStepInstance(data, tx?): Promise<StepInstance>
  > getStepInstanceById(id: string, tx?): Promise<StepInstance | null>
  > updateStepInstance(id: string, data: Partial<StepInstanceUpdate>, tx?): Promise<StepInstance>
  > getActiveStepInstancesForInstance(instanceId: string, tx?): Promise<StepInstance[]>
  > lockStepInstanceForUpdate(id: string, tx): Promise<StepInstance | null>
  >   // SELECT FOR UPDATE — tx is required (not optional) for this function
  >
  > // workflow_events — INSERT ONLY
  > createWorkflowEvent(data, tx?): Promise<WorkflowEvent>
  > getWorkflowEventsForInstance(instanceId: string): Promise<WorkflowEvent[]>
  >
  > // pending_certified_urgent_bypasses
  > createPendingBypass(data, tx?): Promise<PendingBypass>
  > getPendingBypassForInstance(instanceId: string, stepKey: string, tx?): Promise<PendingBypass | null>
  > markBypassApplied(bypassId: string, stepInstanceId: string, tx?): Promise<void>
  >
  > // committee_reports
  > createOrGetCommitteeReport(stepInstanceId: string, tx?): Promise<CommitteeReport>
  > updateCommitteeReport(id: string, data, tx?): Promise<CommitteeReport>
  >
  > // sp_sessions + attendance + OoB
  > createSpSession(data, tx?): Promise<SpSession>
  > upsertSessionAttendance(data, tx?): Promise<void>
  > createOrderOfBusiness(data, tx?): Promise<OrderOfBusiness>
  > getOrderOfBusinessWithItems(spSessionId: string): Promise<{oob, items} | null>
  > upsertOrderOfBusinessItem(data, tx?): Promise<void>
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `pnpm test` for workflow.repository.test.ts passes
  > - [ ] `createWorkflowEvent` has no update or delete paths
  > - [ ] `updateInstanceStatus` throws CONFLICT when status is 'Completed' or 'Cancelled'
  > - [ ] `updateInstanceContext` uses JSONB merge (`||`), not full replacement
  > - [ ] `migrateInstanceVersion` is the only function that writes `definition_version_id`

---

## TASK-WF-005

Phase:          1
Module:         WF
Title:          Implement engine core — createInstance, step resolution, transition evaluation, assignee resolution, domain event emission
Prerequisites:  [TASK-WF-004, TASK-DOCS-006]
Deliverables:
  - /apps/server/src/modules/workflow/engine/create-instance.ts — `engine.createInstance` per B4 §3.2: resolves active definition version, creates instance row, initializes context, identifies start step, activates start step, resolves assignees, emits `workflow.instance.created` and `workflow.step.started` — all within one transaction
  - /apps/server/src/modules/workflow/engine/step-resolution.ts — step resolution algorithm (B4 §3.3): activates next step after current step reaches terminal status; auto-executes `decision` and `notification` steps inline
  - /apps/server/src/modules/workflow/engine/transition-evaluation.ts — transition evaluation (B4 §3.4): JSONLogic evaluation via `json-logic-js`, `outcome_filter` matching, `priority` ordering, sets instance to `'Stuck'` when no rule matches
  - /apps/server/src/modules/workflow/engine/assignee-resolution.ts — assignee resolution (B4 §3.5): parses `role:`, `office_role:`, `delegation_aware:`, `actor_from_context:`, `static:` expression prefixes; calls Organization Published API for delegation lookups; returns `{ user_id, resolved_via }[]` snapshot
  - /apps/server/src/modules/workflow/engine/context-writer.ts — detects `triggers_mayor_lapse_timer` and `triggers_panlalawigan_timer` flags on action step config; writes `mayor_transmittal_date/deadline` or `panlalawigan_transmission_date/deadline` to instance context on step completion; emits `workflow.context.updated` (B3 §7.15) alongside every such write
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `engine.createInstance` with a valid documentId and definitionId creates one `instances` row, one `step_instances` row, and two `workflow_events` rows — all in one transaction
  - [ ] `engine.createInstance` with no published active definition version throws `NO_ACTIVE_VERSION`
  - [ ] Transition evaluation with no matching rule sets `instances.status = 'Stuck'` and emits `workflow.instance.stuck`
  - [ ] `decision` steps are auto-executed in the same call chain without a second `submitStepAction` call
  - [ ] `delegation_aware:<role>` assignee expression calls Organization Published API for delegation lookup
  - [ ] `action` step with `triggers_mayor_lapse_timer: true` writes `mayor_transmittal_date = NOW()` and `mayor_action_deadline = NOW() + 10 days` on completion
  - [ ] `action` step with `triggers_panlalawigan_timer: true` writes `panlalawigan_transmission_date = NOW()` and `panlalawigan_action_deadline = NOW() + 30 days` on completion
  - [ ] `engine.createInstance` sets `context.requires_publication` from `Documents.getDocumentById(documentId)`'s penalty-clause field, defaulting to `false` if the document has none or the call returns `null` `[OPEN-Q-2 RESOLVED — Option B, cross-module query; supersedes the earlier H1-X-2 "leave unset" gap]`
  - [ ] `action` step completions that write timer-trigger context keys also emit `workflow.context.updated` (B3 §7.15) in the same transaction
AI Prompt:
  > You are implementing the core workflow engine for the Batac City LGU platform. The engine is deterministic: same inputs always produce the same outputs. All operations execute within PostgreSQL transactions.
  >
  > **createInstance algorithm (B4 §3.2):**
  > ```
  > 1. Resolve current active, published definition version (is_current = true, published_at IS NOT NULL, definition.is_active = true) for definitionId. Throw NO_ACTIVE_VERSION if none found.
  > 2. Open a Drizzle transaction.
  > 3. Resolve requires_publication [OPEN-Q-2 RESOLVED — Option B: cross-module query via Published API]:
  >    - Call Documents.getDocumentById(documentId) (B2 Module 3 Published API).
  >    > [Unverified]: B2 Module 3's `DocumentSummary` interface, AS CURRENTLY SPECIFIED, does NOT include a
  >    > metadata or penalty-clause field — it exposes only documentId, documentTypeId, documentTypeName,
  >    > title, currentState, originatingOfficeId, cityId, preliminaryNumber, finalNumber, classificationLevel,
  >    > createdAt (confirmed against both B2 §Module 3 Published API and TASK-DOCS-006, which implements it
  >    > "exactly" per B2). This is a genuine interface gap, not merely an unconfirmed field name: implementing
  >    > this option requires a companion change extending `DocumentSummary` before this call can return a
  >    > usable value. Flag this to the reviewing developer/B2 owner if it has not already been made.
  >    > The document-side JSONB key is confirmed (docs.md, C1 DDL, and H2 §6 all agree) as
  >    > `metadata.has_penalty_provision` — present only on SP_ORDINANCE-type documents.
  >    > [Inference, not independently confirmed by any source document]: once `DocumentSummary` is extended,
  >    > following B3 §2.2's camelCase convention the added field would naturally be named `hasPenaltyProvision`.
  >    - requires_publication = (extended DocumentSummary result)?.hasPenaltyProvision ?? false
  >    - If getDocumentById returns null (should not happen — this call is reacting to that same document's
  >      own document.created event — but handle defensively): log a warning, default to false, do NOT throw.
  > 4. Create workflow.instances row:
  >    - definition_version_id = resolved version id
  >    - document_id = documentId
  >    - status = 'Running'
  >    - context = { document_id: documentId, document_type: <from doc type lookup>, created_by: actorId, certified_urgent: false, certified_urgent_document_id: null, sla_paused: false, requires_publication: <value resolved in step 3> }
  >    - started_at = NOW()
  >    - created_by = actorId (the user calling createInstance)
  > 5. Compute sla_deadline from document type's SLA classification (read from document type config).
  >    Default: 'complex' = 7 working days for SP Resolutions/Ordinances.
  > 6. Identify start step (is_start = true) for the resolved definition version. Exactly one must exist. Throw INVALID_DEFINITION if zero or more than one.
  > 7. Create workflow.step_instances row for start step: status = 'Pending', then immediately 'Active', started_at = NOW().
  > 8. Resolve assignees for start step using assignee resolution logic.
  > 9. Write resolved assignees to step_instances.assigned_to (JSONB array of {user_id, resolved_via}).
  > 10. Emit workflow.instance.created event to workflow_events within the same transaction.
  > 11. Emit workflow.step.started event to workflow_events within the same transaction.
  > 12. If start step type is 'decision' or 'notification': auto-execute it within the same transaction.
  > 13. Commit transaction.
  > 14. After commit: publish events to in-process event bus for downstream subscribers (audit, tracking, notifications).
  > ```
  >
  > **Step resolution algorithm (B4 §3.3) — called after any step reaches terminal status:**
  > ```
  > 1. Run transition evaluation to find the winning transition's to_step_id.
  >    If no match: set instance.status = 'Stuck'; emit workflow.instance.stuck; STOP.
  > 2. Create step_instances row for the next step: status = 'Active', started_at = NOW().
  > 3. Resolve assignees; write to assigned_to.
  > 4. Emit workflow.step.started.
  > 5. If new step type is 'decision' or 'notification': auto-execute immediately (recursive call).
  > 6. If new step type is 'termination': execute termination logic (in TASK-WF-006).
  > Note: NO concurrent step activation in Phase 1.
  > ```
  >
  > **Transition evaluation algorithm (B4 §3.4):**
  > ```
  > 1. Load all transition_rules WHERE from_step_id = currentStep.id AND definition_version_id = instance.definition_version_id.
  > 2. Filter: remove rules WHERE outcome_filter IS NOT NULL AND outcome_filter != step_instance.outcome.
  > 3. Sort remaining by priority ASC (lower value = higher priority = evaluated first).
  > 4. For each candidate: evaluate condition_expression via json-logic-js against instance.context.
  >    - condition_expression IS NULL = always matches (unconditional rule)
  >    - JSONLogic evaluator: pure read-only against context; undefined keys = null (falsy)
  > 5. First matching rule wins; its to_step_id is the next step.
  > 6. If NO rule matches:
  >    - Set instance.status = 'Stuck'
  >    - Emit workflow.instance.stuck { instanceId, currentStepInstanceId, evaluatedRules }
  >    - Notify Platform Administrator and Records Officer via event bus
  >    - STOP
  > ```
  >
  > **Assignee resolution (B4 §3.5) — called at step activation:**
  > Parse config.assignee string:
  > - `role:<role_key>` → call Organization.getUsersByRole(role_key)
  > - `office_role:<office_key>:<role_key>` → call Organization.getUserByOfficeRole(office_key, role_key)
  > - `delegation_aware:<role_key>` → resolve role:<role_key>, then for each resolved user call Organization.getActiveDelegationForUser(userId); if active delegation exists, route to designated person instead
  > - `actor_from_context:<context_key>` → read UUID from instance.context[context_key]; return as single-user array
  > - `static:<user_id>` → return literal UUID as single-user array
  > Return `{ user_id: string, resolved_via: string }[]`. This snapshot is stored at activation and is AUTHORITATIVE for the step's lifetime — subsequent delegation changes do NOT affect an already-active step.
  >
  > **Context writer — timer trigger flags (H1-X-1 resolution):**
  > After an `action` step completes, before running step resolution:
  > - If step.config.triggers_mayor_lapse_timer === true:
  >   Write: { mayor_transmittal_date: NOW().toISOString(), mayor_action_deadline: (NOW() + 10 days).toISOString() }
  > - If step.config.triggers_panlalawigan_timer === true:
  >   Write: { panlalawigan_transmission_date: NOW().toISOString(), panlalawigan_action_deadline: (NOW() + 30 days).toISOString() }
  > Both deadlines are CALENDAR days — no adjustment for weekends or holidays.
  > In the SAME transaction as either write above, emit `workflow.context.updated` (B3 §7.15):
  > `{ instanceId, updatedKeys: [...the key names just written], previousValues: { ...prior values, likely null }, newValues: { ...the values just written }, actorId: <the actor who completed the triggering step> }`
  >
  > **install json-logic-js:** `pnpm add json-logic-js` in /apps/server; import with type declarations.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `engine.createInstance` creates one instances row + one step_instances row + two workflow_events in one transaction
  > - [ ] `engine.createInstance` with no published active version throws `NO_ACTIVE_VERSION`
  > - [ ] Transition evaluation with no matching rule sets status to 'Stuck' and emits workflow.instance.stuck
  > - [ ] `decision` steps auto-execute without a second submitStepAction call
  > - [ ] `delegation_aware:` calls Organization Published API
  > - [ ] `triggers_mayor_lapse_timer: true` writes mayor context keys on action step completion
  > - [ ] `triggers_panlalawigan_timer: true` writes panlalawigan context keys on action step completion
  > - [ ] requires_publication IS set at createInstance via `Documents.getDocumentById` `[OPEN-Q-2 RESOLVED — Option B]`; defaults to false if absent or the call returns null
  > - [ ] `workflow.context.updated` emitted alongside every timer-trigger context write

---

## TASK-WF-006

Phase:          1
Module:         WF
Title:          Implement action, decision, notification, and termination step handlers
Prerequisites:  [TASK-WF-005]
Deliverables:
  - /apps/server/src/modules/workflow/engine/step-handlers/action.handler.ts — `action` step: validates actor in `assigned_to`, `require_comment` enforcement, `auto_complete` path, invokes context writer for timer flags, runs step resolution
  - /apps/server/src/modules/workflow/engine/step-handlers/decision.handler.ts — `decision` step: JSONLogic evaluation via `json-logic-js`, auto-completes on activation with `actor_type = 'system'`, runs step resolution immediately
  - /apps/server/src/modules/workflow/engine/step-handlers/notification.handler.ts — `notification` step: enqueues to Notifications Published API (delivery failure does NOT fail the step), auto-completes with `outcome = 'DISPATCHED'`
  - /apps/server/src/modules/workflow/engine/step-handlers/termination.handler.ts — `termination` step: all 9 outcome codes; REPASSED keeps instance `'Running'` and emits `workflow.instance.repassed`; CANCELLED sets all Active step instances to Cancelled in same transaction; Phase 1 guard for `parallel_split`/`parallel_join` activation
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `action` step with `require_comment = true` and empty comment throws `VALIDATION_FAILED`
  - [ ] `action` step where actorId not in `assigned_to` throws `FORBIDDEN`
  - [ ] `decision` step sets `actor_type = 'system'` and auto-completes; no actor submission needed
  - [ ] `notification` step delivery failure does NOT fail the step (fire-and-forget on delivery)
  - [ ] `termination` with `outcome_code = 'REPASSED'` does NOT set `instances.status = 'Completed'`; emits `workflow.instance.repassed`
  - [ ] `termination` with `outcome_code = 'CANCELLED'` sets all Active step instances to Cancelled in same transaction
  - [ ] `parallel_split` or `parallel_join` step activation emits `workflow.step.failed`, sets instance to `Stuck`, and stops
AI Prompt:
  > You are implementing the step type behavior handlers for the Batac City LGU workflow engine — specifically `action`, `decision`, `notification`, and `termination`. All handlers operate within the calling transaction.
  >
  > **action handler (B4 §4.1):**
  > Called by `engine.submitStepAction` for action steps.
  > Validation sequence (throw at first failure):
  > 1. Verify step_instances.status = 'Active'; else throw CONFLICT ("step is not active")
  > 2. Verify actorId is in step_instances.assigned_to[].user_id; else throw FORBIDDEN
  > 3. If config.require_comment = true and comment is empty/whitespace: throw VALIDATION_FAILED
  > On success:
  > - Set step_instances.status = 'Completed', outcome = 'DONE', completed_at = NOW(), actor_type = 'user'
  > - Invoke context writer (timer flags)
  > - Emit workflow.step.completed
  > - Run step resolution
  >
  > auto_complete path: if config.auto_complete = true, complete immediately on activation, actor_type = 'system'. Used for system-driven logging steps.
  >
  > **decision handler (B4 §4.4):**
  > Always auto-executes on activation. Never waits for actor input.
  > - Evaluate config.condition_expression (JSONLogic) against instance.context
  > - Truthy → outcome = config.true_outcome (default 'TRUE')
  > - Falsy → outcome = config.false_outcome (default 'FALSE')
  > - Set status = 'Completed', actor_type = 'system', completed_at = NOW()
  > - Emit workflow.step.completed
  > - Run step resolution immediately (recursive; may trigger more auto-execution)
  >
  > Phase 1 JSONLogic expressions used in definitions:
  > - `{ "==": [{"var":"certified_urgent"}, true] }` — check certified urgent
  > - `{ "==": [{"var":"mayor_action"}, "VETOED"] }` — check veto
  > - `{ "in": [{"var":"panlalawigan_outcome"}, ["VALID","DEEMED_APPROVED","OPERATIVE_IN_ITS_ENTIRETY"]] }` — final_outcome_check TRUE branch
  > - `{ "==": [{"var":"requires_publication"}, true] }` — publication_check for SP Ordinance
  >
  > **notification handler (B4 §4.5):**
  > Always auto-executes on activation.
  > - Resolve recipients from config.recipients using assignee resolution logic
  > - Call Notifications Published API enqueue (template_key, recipients, channels, payload)
  > - If enqueue fails: LOG the error (structured Pino log at error level) but do NOT throw — delivery failure does not affect workflow state
  > - Set status = 'Completed', outcome = 'DISPATCHED', actor_type = 'system', completed_at = NOW()
  > - Emit workflow.step.completed
  > - Run step resolution
  >
  > **termination handler (B4 §4.6):**
  > Called by step resolution when step_type = 'termination'. Auto-executes on activation.
  >
  > For outcome_codes APPROVED_AND_RELEASED, LAPSED_INTO_LAW, DEEMED_APPROVED_PANLALAWIGAN, VETOED_OVERRIDE_FAILED, REJECTED_AT_VOTE, ARCHIVED_NO_ACTION, VALID_IN_PART_RESOLVED:
  > - Set instances.status = 'Completed', completed_at = NOW()
  > - Call Documents.transitionState(documentId, final_document_status) via Documents Published API
  > - Emit `workflow.instance.completed` (B3 §7.2 — NOT `workflow.completed`, B2's equivalent alias) { instanceId, documentId, outcomeCode: <the outcome_code above>, finalDocumentStatus: <final_document_status> }
  >
  > For CANCELLED:
  > - In the SAME transaction: set all step_instances WHERE status = 'Active' AND instance_id = this.instance.id → status = 'Cancelled'
  > - Then set instances.status = 'Completed' (yes, Completed — the cancellation terminates the workflow)
  > - Emit `workflow.instance.completed` with outcomeCode = 'CANCELLED'
  >
  > For REPASSED (CRITICAL SPECIAL CASE — B4 §4.6, D3 ADR-015):
  > - Do NOT set instances.status = 'Completed'
  > - Instance REMAINS 'Running' indefinitely — there is no distinct 'Repassed' instance status
  > - Set step_instances.status = 'Completed', completed_at = NOW()
  > - final_document_status = null for this path (document lifecycle tracked via documents.superseded_by)
  > - Emit workflow.instance.repassed { instanceId, documentId }
  > - The documents module subscribes to this event and handles: setting documents.superseded_by on the original, creating a new document, creating a new workflow instance for the new document
  >
  > **Phase 1 guard for parallel step types (B4 §5):**
  > Before ANY step activation, check: if step_type is 'parallel_split' or 'parallel_join':
  > - Emit workflow.step.failed { instanceId, stepInstanceId, errorCode: 'STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1', errorMessage: 'parallel_split and parallel_join are Phase 2 reserved step types' }
  > - Set instance.status = 'Stuck'
  > - Throw so the calling context knows to stop
  >
  > Before submitting this PR, confirm each item:
  > - [ ] action step with require_comment = true and empty comment throws VALIDATION_FAILED
  > - [ ] action step where actorId not in assigned_to throws FORBIDDEN
  > - [ ] decision step sets actor_type = 'system' and auto-completes
  > - [ ] notification step: delivery failure does NOT fail the step
  > - [ ] termination REPASSED: instance remains 'Running'; emits workflow.instance.repassed
  > - [ ] termination CANCELLED: all Active step instances set to Cancelled in same transaction
  > - [ ] parallel_split or parallel_join activation emits step.failed and sets instance to Stuck

---

## TASK-WF-007

Phase:          1
Module:         WF
Title:          [AUDIT] Implement approval step handler — outcome validation, scheduler-only guard, encoder ≠ final-approver invariant
Prerequisites:  [TASK-WF-006]
Deliverables:
  - /apps/server/src/modules/workflow/engine/step-handlers/approval.handler.ts — `approval` step: validates actor, enforces `allowed_outcomes`, scheduler-only guard for `LAPSED`/`DEEMED_APPROVED`, encoder ≠ final-approver invariant #11 for `is_final_approval` steps, override vote threshold validation, `RETURNED_FOR_REVISION` → `'Returned'` step status
  - /apps/server/src/modules/workflow/engine/step-handlers/approval.handler.test.ts — Vitest tests covering K2 RES-I10, RES-I11, RES-I12, RES-I13, INV11-01a/b
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm test` for approval.handler.test.ts passes
  - [ ] K2 RES-I10: `LAPSED` submitted with `actor_type = 'user'` throws `FORBIDDEN` (B4 invariant #3)
  - [ ] K2 RES-I11: `DEEMED_APPROVED` submitted with `actor_type = 'user'` throws `FORBIDDEN` (B4 invariant #3)
  - [ ] K2 RES-I12: `OVERRIDE_SUCCEEDED` with `veto_override_vote_count < 8` throws
  - [ ] K2 RES-I13: `OVERRIDE_FAILED` with `veto_override_vote_count >= 8` throws
  - [ ] K2 INV11-01a: `vp_certification` with `is_final_approval = true` and `actorId === instance.context.created_by` throws `ENCODER_CANNOT_BE_FINAL_APPROVER`
  - [ ] K2 INV11-01b: same step, `actorId !== instance.context.created_by` succeeds normally
  - [ ] `RETURNED_FOR_REVISION` outcome sets step status to `'Returned'` (D3 terminal state), NOT `'Completed'`
  - [ ] Any outcome not in `config.allowed_outcomes` throws `VALIDATION_FAILED`
AI Prompt:
  > You are implementing the `approval` step type handler. This is the most complex step type handler due to its multiple guard conditions, scheduler-reserved outcomes, and the encoder/final-approver invariant.
  >
  > **Validation sequence (execute IN ORDER; throw at first failure):**
  > 1. Verify step_instances.status = 'Active'; else throw CONFLICT
  > 2. Verify submitted outcome is in config.allowed_outcomes; else throw VALIDATION_FAILED
  > 3. Scheduler-only guard (B4 invariant #3):
  >    - If outcome = 'LAPSED' AND actor_type != 'scheduler': throw FORBIDDEN with cause 'LAPSED_IS_SCHEDULER_ONLY'
  >    - If outcome = 'DEEMED_APPROVED' AND actor_type != 'scheduler': throw FORBIDDEN with cause 'DEEMED_APPROVED_IS_SCHEDULER_ONLY'
  > 4. Verify actorId is in step_instances.assigned_to[].user_id; else throw FORBIDDEN
  >    (Skip this check if actor_type = 'scheduler' — scheduler has no user_id)
  > 5. Encoder ≠ final approver (B4 invariant #11 — check AFTER role gate):
  >    - If config.is_final_approval = true AND actorId === instance.context.created_by:
  >      throw error code 'ENCODER_CANNOT_BE_FINAL_APPROVER'
  >    - This step applies to vp_certification only (it carries is_final_approval: true in seed data)
  > 6. Comment requirements: if outcome is in config.require_comment_on (default ['REJECTED','RETURNED_FOR_REVISION']) and comment is empty/whitespace: throw VALIDATION_FAILED
  > 7. Override vote threshold (for veto_override_vote step specifically):
  >    - If outcome = 'OVERRIDE_SUCCEEDED' AND instance.context.veto_override_vote_count < 8: throw VALIDATION_FAILED (2/3 of 12 = 8 votes minimum; confirmed fact)
  >    - If outcome = 'OVERRIDE_FAILED' AND instance.context.veto_override_vote_count >= 8: throw VALIDATION_FAILED
  > 8. OPERATIVE_IN_ITS_ENTIRETY guard (K2 APP-I02):
  >    - If outcome = 'OPERATIVE_IN_ITS_ENTIRETY' AND instance.context.document_type != 'appropriation_ordinance':
  >      throw error code 'OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE'
  >
  > **State change on success:**
  >
  > For RETURNED_FOR_REVISION (D3 correction to B4's model):
  > - Set step_instances.status = 'Returned' (terminal state — NOT 'Completed')
  > - D3 §3.2: "Returned: Actor explicitly returns the document; mandatory non-empty outcome_comment provided; workflow definition specifies a designated prior step to re-activate"
  > - Set outcome = 'RETURNED_FOR_REVISION', outcome_comment, completed_at = NOW()
  > - Emit workflow.step.completed
  > - Run step resolution (routes back to the prior step per transition rules)
  >
  > For all other outcomes:
  > - Set step_instances.status = 'Completed'
  > - Set outcome, outcome_comment, completed_at = NOW()
  > - Set actor_type = 'user' for human actor; 'scheduler' for scheduler-set outcomes (LAPSED, DEEMED_APPROVED)
  > - Emit workflow.step.completed
  > - Run step resolution
  >
  > **Audit note:** workflow.step.completed is consumed by the audit service, which writes a dedicated audit entry for approval step completions. The WF engine does NOT write directly to audit schema.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] K2 RES-I10: LAPSED with actor_type = 'user' throws FORBIDDEN
  > - [ ] K2 RES-I11: DEEMED_APPROVED with actor_type = 'user' throws FORBIDDEN
  > - [ ] K2 RES-I12: OVERRIDE_SUCCEEDED with vote_count < 8 throws
  > - [ ] K2 RES-I13: OVERRIDE_FAILED with vote_count >= 8 throws
  > - [ ] K2 INV11-01a: is_final_approval + same user = ENCODER_CANNOT_BE_FINAL_APPROVER
  > - [ ] K2 INV11-01b: is_final_approval + different user = succeeds
  > - [ ] RETURNED_FOR_REVISION sets step status to 'Returned' (not 'Completed')
  > - [ ] Any outcome not in allowed_outcomes throws VALIDATION_FAILED

---

## TASK-WF-008

Phase:          1
Module:         WF
Title:          [AUDIT] Implement multi_referral step handler — committee metadata, completion sequence, manual advance guard
Prerequisites:  [TASK-WF-006]
Deliverables:
  - /apps/server/src/modules/workflow/engine/step-handlers/multi-referral.handler.ts — `multi_referral` step: committee submission tracking via `step_instances.metadata`, `REPORT_ACCEPTED` completion sequence requiring all committees + SP Secretary acceptance (B4 invariant #2), `SECRETARY_ADVANCED` mandatory comment guard (B4 invariant #7), `BYPASSED_CERTIFIED_URGENT` actor guard
  - /apps/server/src/modules/workflow/engine/step-handlers/multi-referral.handler.test.ts — Vitest tests for K2 MREF-01 through MREF-10
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] K2 MREF-01: all committees submitted + SP Secretary accepts → `REPORT_ACCEPTED`; second reading activated
  - [ ] K2 MREF-02: some committees not submitted, no override → step stays Active; CONFLICT thrown
  - [ ] K2 MREF-03: all submitted but SP Secretary has NOT accepted unified report → step stays Active (B4 invariant #2)
  - [ ] K2 MREF-06: `SECRETARY_ADVANCED` with empty/null comment → throws (B4 invariant #7)
  - [ ] K2 MREF-09: absent/red-flag status is a display attribute, NOT a step state transition on the multi_referral step itself
  - [ ] `BYPASSED_CERTIFIED_URGENT` submitted with actor_type = 'user' throws `FORBIDDEN` (only engine bypass handler may set this outcome)
  - [ ] Committee submission appends to `metadata.submissions`; if last committee, sets `metadata.all_submitted_at = NOW()` and emits `workflow.multi_referral.all_submitted`
  - [ ] Committee list locked after first submission; modifications after first submission require `bypassStep` with mandatory comment
AI Prompt:
  > You are implementing the `multi_referral` step type handler. Most SP Resolutions and Ordinances are referred to TWO committees simultaneously (the relevant subject-matter committee AND the Committee on Laws — confirmed as the default, not a special case; consolidated reference Part 8.3). ALL assigned committees must contribute to the unified report before the step can complete normally.
  >
  > **step_instances.metadata schema (full shape):**
  > ```json
  > {
  >   "assigned_committees": [{ "committee_id": "<UUID>", "role_key": "string", "label": "string" }],
  >   "submissions": [
  >     { "committee_id": "<UUID>", "submitted_by": "<UUID>", "submitted_at": "<TIMESTAMPTZ>",
  >       "contribution_document_id": "<UUID>", "missed": false }
  >   ],
  >   "thursday_cutoffs_missed": 0,
  >   "last_cutoff_evaluated_at": null,
  >   "all_submitted_at": null,
  >   "second_reading_eligible_date": null,   // written by Thursday cutoff scheduler
  >   "unified_report_document_id": null,
  >   "secretary_accepted_at": null,
  >   "secretary_accepted_by": null,
  >   "manual_advance": false,
  >   "manual_advance_comment": null,
  >   "manual_advance_by": null
  > }
  > ```
  >
  > **Committee submission flow (called when a committee submits their contribution):**
  > 1. Validate step is 'Active', step_type = 'multi_referral'
  > 2. Validate submitting actor's committeeId is in metadata.assigned_committees
  > 3. Validate this committee has not already submitted (no existing submissions entry for this committee_id)
  > 4. Append to metadata.submissions: { committee_id, submitted_by, submitted_at: NOW(), contribution_document_id, missed: false }
  > 5. Emit workflow.multi_referral.committee_submitted
  > 6. If this was the LAST unsubmitted committee:
  >    - Set metadata.all_submitted_at = NOW()
  >    - Emit workflow.multi_referral.all_submitted
  >
  > **Committee list lock:** After submissions.length > 0, assigned_committees is LOCKED. If someone tries to modify assigned_committees after the first submission (without going through bypassStep), throw CONFLICT with 'COMMITTEE_LIST_LOCKED'.
  >
  > **REPORT_ACCEPTED completion sequence (B4 §4.3 + B4 invariant #2):**
  > 1. SP Secretary uploads unified report → writes metadata.unified_report_document_id
  > 2. SP Secretary accepts report:
  >    a. ENGINE CHECK: verify ALL committees in assigned_committees have entries in submissions (or manual_advance = true). If not → throw CONFLICT with code 'REQUIRE_ALL_COMMITTEE_SIGNATURES_VIOLATED' (B4 invariant #2)
  >    b. Set metadata.secretary_accepted_at = NOW(), secretary_accepted_by = actorId
  >    c. Write instance.context.second_reading_eligible_date = metadata.second_reading_eligible_date (may be null if scheduler hasn't run yet)
  >    d. Set step status = 'Completed', outcome = 'REPORT_ACCEPTED', completed_at = NOW()
  >    e. Emit workflow.step.completed
  >    f. Run step resolution
  >
  > **SECRETARY_ADVANCED (manual override — B4 §4.3 + B4 invariant #7):**
  > 1. Verify config.allow_secretary_advance = true; else throw CONFLICT
  > 2. Verify outcome_comment is non-empty (B4 invariant #7); throw COMMENT_REQUIRED if empty/whitespace
  > 3. For each committee in metadata.assigned_committees with no submission:
  >    Add entry: { committee_id, submitted_by: null, submitted_at: NOW(), contribution_document_id: null, missed: true }
  > 4. Set metadata.manual_advance = true, manual_advance_comment = outcome_comment, manual_advance_by = actorId
  > 5. Set step status = 'Completed', outcome = 'SECRETARY_ADVANCED', completed_at = NOW()
  > 6. Emit workflow.multi_referral.secretary_advanced { stepInstanceId, actorId, comment, missingCommitteeIds, metadataSnapshot }
  > 7. Run step resolution
  > Note: audit service writes a dedicated audit entry on this event.
  > Note: missed committees remain red-flagged in Order of Business AFTER override (Q-A02 confirmed decision).
  >
  > **BYPASSED_CERTIFIED_URGENT guard:**
  > If engine.submitStepAction is called with outcome = 'BYPASSED_CERTIFIED_URGENT' and actor_type = 'user': throw FORBIDDEN. This outcome is ONLY set by the Certified Urgent bypass handler (TASK-WF-009) which sets actor_type = 'system'.
  >
  > **Red-flag behavior note (K2 MREF-09):**
  > Absent/red-flagged committees are a DISPLAY attribute of the Order of Business view — not a step state transition. The handler maintains metadata correctly; the Order of Business query (TASK-WF-023) reads metadata.submissions and assigned_committees to compute display state.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] K2 MREF-01: normal completion (all submitted + accepted) works
  > - [ ] K2 MREF-02: not all submitted, no override → step stays Active (CONFLICT thrown)
  > - [ ] K2 MREF-03: all submitted but not accepted → step stays Active (B4 invariant #2)
  > - [ ] K2 MREF-06: SECRETARY_ADVANCED with empty comment throws (B4 invariant #7)
  > - [ ] BYPASSED_CERTIFIED_URGENT with actor_type = 'user' throws FORBIDDEN
  > - [ ] Committee submission correctly appends and sets all_submitted_at when last
  > - [ ] Committee list locked after first submission

---

## TASK-WF-009

Phase:          1
Module:         WF
Title:          [AUDIT] Implement Certified Urgent bypass event consumer
Prerequisites:  [TASK-WF-008, TASK-DOCS-019]
Deliverables:
  - /apps/server/src/modules/workflow/engine/certified-urgent-bypass.handler.ts — event consumer for `document.certification_urgency.logged` (B3 §6.5 — one event per Certification, carrying an array of ALL associated instance IDs to bypass; NOT one event per measure — see Module Summary conflict log for the correction history on this point); implements 3-case bypass algorithm (Case A: active step, Case B: pending step, Case C: already past referral) plus inactive instance check; iterates `associatedInstanceIds` and processes each in its own independent transaction; emits `workflow.step.bypassed` (bypassReason: 'CERTIFIED_URGENT') and `workflow.certification_urgency.bypass_applied` (B3 §7.13, §7.23) per instance
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] K2 CU-02 (Case A): active `committee_referral` step → bypassed immediately; `status = 'Skipped'`, `bypassed_by = null` (system), `bypass_reason = 'CERTIFIED_URGENT'`, `outcome = 'BYPASSED_CERTIFIED_URGENT'`; `workflow.step.bypassed` then `workflow.certification_urgency.bypass_applied` emitted; `second_reading_vote` activated
  - [ ] K2 CU-03 (Case B): pending step → `pending_certified_urgent_bypasses` row created; `workflow.certification_urgency.bypass_deferred` emitted; Case A logic fires when step would normally activate
  - [ ] K2 CU-04 (Case C): step already Completed/Skipped → `workflow.certification_urgency.already_past_referral` emitted; no workflow change
  - [ ] K2 CU-05: non-Running instance → `workflow.certification_urgency.already_inactive` emitted; no change
  - [ ] K2 CU-10: bypass is irreversible — no revocation mechanism
  - [ ] `instance.context.certified_urgent = true` and `certified_urgent_document_id` set in same transaction as bypass (Cases A and B)
  - [ ] Each instanceId in `associatedInstanceIds` processed in its own independent transaction
AI Prompt:
  > You are implementing the Certified Urgent bypass event consumer for the Batac City LGU workflow engine.
  >
  > **Background:** The Mayor issues a formal written Certification of Urgency document. This is a FREQUENT operation (confirmed Interview 2). When Secretariat logs it, each associated legislative measure bypasses the committee referral step entirely and proceeds directly to Second Reading. One certification can cover multiple measures.
  >
  > **Event subscription — CORRECTED, see Module Summary conflict log:** Subscribe to `document.certification_urgency.logged` on the in-process event bus (B3 §6.5 — this is the B3-ratified name; NOT `document.certified_urgent`, which was this task's own earlier draft name, and NOT `documents.certification_urgency.logged` (plural), which was B4's authoring inconsistency). This is ONE event per Certification, carrying an array of every associated instance to bypass — NOT one event per measure. Payload (B3 §6.5, camelCase per B3 §2.2):
  > ```typescript
  > { certificationDocumentId: string; associatedInstanceIds: string[]; loggedBy: string; loggedAt: string; }
  > ```
  >
  > **Iterate the batch, processing each instanceId INDEPENDENTLY in its own transaction:**
  > ```typescript
  > for (const instanceId of event.associatedInstanceIds) {
  >   // Steps 0 through Case A/B/C below run once per iteration, each in its own transaction.
  >   // One instance's failure must not roll back or block any other instance in the same batch.
  > }
  > ```
  >
  > **Step 0 — Inactive check:**
  > Load instance. If instance.status != 'Running' (is 'Completed', 'Cancelled', 'Stuck', 'Paused'):
  > - Emit workflow.certification_urgency.already_inactive { instanceId, instanceStatus, certificationDocumentId }
  > - SKIP this instance, continue to next
  >
  > **Within transaction — set context first:**
  > - Set instance.context.certified_urgent = true
  > - Set instance.context.certified_urgent_document_id = certificationDocumentId
  > - In the SAME transaction, emit workflow.context.updated (B3 §7.15): { instanceId, updatedKeys: ['certified_urgent', 'certified_urgent_document_id'], previousValues: { certified_urgent: false, certified_urgent_document_id: null }, newValues: { certified_urgent: true, certified_urgent_document_id: certificationDocumentId }, actorId: loggedBy }
  >
  > **Find the multi_referral step_instance for this instance:**
  > Look for step_instances joined to steps where step_type = 'multi_referral' and instance_id = this instance's id.
  >
  > **CASE A — step_instance.status = 'Active':**
  > Within the SAME transaction as the context update:
  > - Set step_instances.status = 'Skipped'
  > - Set step_instances.bypassed_at = NOW()
  > - Set step_instances.bypassed_by = null (system-triggered; no human actor for this specific action)
  > - Set step_instances.bypass_reason = 'CERTIFIED_URGENT'
  > - Set step_instances.outcome = 'BYPASSED_CERTIFIED_URGENT'
  > - Emit workflow.step.bypassed (B3 §7.13) { instanceId, stepInstanceId, bypassReason: 'CERTIFIED_URGENT', bypassedBy: null }
  > - Run transition evaluation from the bypassed step. The definition MUST have a rule with outcome_filter = 'BYPASSED_CERTIFIED_URGENT' → second_reading_vote. (Enforced at publish time by TASK-WF-010.)
  > - Emit workflow.certification_urgency.bypass_applied (B3 §7.23) { instanceId, stepInstanceId, certificationDocumentId }
  >
  > **CASE B — step_instance.status = 'Pending':**
  > - Create pending_certified_urgent_bypasses row: { instance_id: instanceId, step_key: 'committee_referral', certification_document_id: certificationDocumentId }
  > - Emit workflow.certification_urgency.bypass_deferred (B3 §7.24) { instanceId, certificationDocumentId }
  >
  > **Pending bypass trigger (called in step resolution when activating any multi_referral step):**
  > - Check: getPendingBypassForInstance(instanceId, 'committee_referral')
  > - If found and applied_at IS NULL: execute Case A logic (bypass immediately instead of activating); mark bypass applied
  >
  > **CASE C — step_instance.status = 'Completed' or 'Skipped':**
  > - Emit workflow.certification_urgency.already_past_referral (B3 §7.25) { instanceId, certificationDocumentId }
  > - NO workflow change. Log at warning level.
  >
  > **IMPORTANT:** Bypass is irreversible (K2 ADR-01). No revocation mechanism exists.
  >
  > **Audit:** `workflow.step.bypassed` and `workflow.certification_urgency.bypass_applied` are both consumed by Audit (B3 §7.13, §7.23) — emitted in the same transaction, they record the same event at different levels of granularity.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] K2 CU-02: active step bypassed with status='Skipped', bypassed_by=null, bypass_reason='CERTIFIED_URGENT'
  > - [ ] K2 CU-03: pending step creates pending_certified_urgent_bypasses row
  > - [ ] K2 CU-04: already-past step emits already_past_referral; no change
  > - [ ] K2 CU-05: non-Running instance emits already_inactive
  > - [ ] context.certified_urgent = true set in same transaction as bypass; workflow.context.updated emitted alongside it
  > - [ ] Each instanceId in the incoming `associatedInstanceIds` array processed in its own transaction, via an explicit `for` loop (one failure doesn't block others)
  > - [ ] Subscription and payload use `document.certification_urgency.logged` / camelCase fields, not `document.certified_urgent` / snake_case

---

## TASK-WF-010

Phase:          1
Module:         WF
Title:          Implement definition publish-time validator
Prerequisites:  [TASK-WF-005]
Deliverables:
  - /apps/server/src/modules/workflow/engine/definition-validator.ts — `validateDefinitionForPublish(versionId)`: runs all checks and returns typed result with complete error list; invoked by `publishDefinitionVersion` before any publish write
  - /apps/server/src/modules/workflow/engine/definition-validator.test.ts — Vitest tests for K2 PUBVAL-01, PUBVAL-02, STEP-I16, and the `MISSING_CERTIFIED_URGENT_TRANSITION` check
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] K2 PUBVAL-01a: `mayor_review` step with `LAPSED` in `allowed_outcomes` but no `outcome_filter='LAPSED'` transition rule → publish fails with `MISSING_LAPSE_TRANSITION`
  - [ ] K2 PUBVAL-01b: `LAPSED → docketing` rule present → publish succeeds
  - [ ] K2 PUBVAL-02a: `second_reading_vote` with `REJECTED` in `allowed_outcomes` but no outgoing matching rule → fails with `MISSING_OUTCOME_TRANSITION`
  - [ ] K2 PUBVAL-02c: `MISSING_LAPSE_TRANSITION` returned (not `MISSING_OUTCOME_TRANSITION`) when the LAPSED-specific rule is absent
  - [ ] `parallel_split` or `parallel_join` in any step → fails with `STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1`
  - [ ] Zero `is_start = true` steps → fails with `MISSING_START_STEP`; more than one → `MULTIPLE_START_STEPS`
  - [ ] `multi_referral` step without `outcome_filter = 'BYPASSED_CERTIFIED_URGENT'` outgoing transition → fails with `MISSING_CERTIFIED_URGENT_TRANSITION`
  - [ ] All errors collected and returned together (not fail-fast on first error)
AI Prompt:
  > You are implementing the definition publish-time validator. This runs when a Platform Administrator publishes a draft definition version. All checks run; all errors are collected and returned together (not fail-fast).
  >
  > ```typescript
  > type ValidationError = { code: string; step_key?: string; missing_outcome_code?: string; message: string }
  > type ValidationResult = { valid: true } | { valid: false; errors: ValidationError[] }
  > async function validateDefinitionForPublish(versionId: string): Promise<ValidationResult>
  > ```
  >
  > **Validation checks (collect ALL errors):**
  >
  > **1. Start step check:**
  > - Count steps WHERE is_start = true AND deleted_at IS NULL for this version
  > - 0 → error { code: 'MISSING_START_STEP' }
  > - > 1 → error { code: 'MULTIPLE_START_STEPS' }
  >
  > **2. Phase 1 parallel step guard (B4 §5, invariant #5):**
  > - For each step WHERE step_type IN ('parallel_split','parallel_join'):
  >   error { code: 'STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1', step_key }
  >
  > **3. MISSING_LAPSE_TRANSITION (B4 invariant #4 — specific named error):**
  > - For each approval step WHERE 'LAPSED' IN config.allowed_outcomes:
  >   Check: EXISTS transition_rule WHERE from_step_id = step.id AND outcome_filter = 'LAPSED'
  >   If not: error { code: 'MISSING_LAPSE_TRANSITION', step_key }
  >   NOTE: Return MISSING_LAPSE_TRANSITION, NOT generic MISSING_OUTCOME_TRANSITION, for LAPSED specifically (K2 PUBVAL-02c)
  >
  > **4. MISSING_DEEMED_APPROVED_TRANSITION (symmetric with LAPSED):**
  > - For each approval step WHERE 'DEEMED_APPROVED' IN config.allowed_outcomes:
  >   Check transition_rule with outcome_filter = 'DEEMED_APPROVED'
  >   If not: error { code: 'MISSING_DEEMED_APPROVED_TRANSITION', step_key }
  >
  > **5. MISSING_OUTCOME_TRANSITION — general rule (B4 §4.2):**
  > - For each approval step: for each code in config.allowed_outcomes (EXCEPT LAPSED and DEEMED_APPROVED which have specific checks above):
  >   Check: EXISTS outgoing transition_rule with matching outcome_filter OR a null outcome_filter (unconditional default)
  >   If not: error { code: 'MISSING_OUTCOME_TRANSITION', step_key, missing_outcome_code: code }
  >
  > **6. MISSING_CERTIFIED_URGENT_TRANSITION:**
  > - For each multi_referral step:
  >   Check: EXISTS transition_rule with from_step_id = step.id AND outcome_filter = 'BYPASSED_CERTIFIED_URGENT'
  >   If not: error { code: 'MISSING_CERTIFIED_URGENT_TRANSITION', step_key }
  >
  > **7. Cross-version transition guard (B4 invariant #12):**
  > - For each transition_rule in this version:
  >   Load from_step and to_step; verify both have definition_version_id = this version's id
  >   If not: error { code: 'CROSS_VERSION_TRANSITION_REFERENCE', step_key: from_step.step_key }
  >
  > **8. multi_referral config requirements:**
  > - For each multi_referral step: verify thursday_cutoff_enabled = true AND require_all_committee_signatures = true
  >   If not: error { code: 'MULTI_REFERRAL_INVALID_CONFIG', step_key }
  >
  > **Integration:** `publishDefinitionVersion` in the repository calls this function first. If `valid = false`, it throws a typed error with the full errors array and does NOT execute the publish SQL.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] K2 PUBVAL-01a: MISSING_LAPSE_TRANSITION when LAPSED rule absent
  > - [ ] K2 PUBVAL-01b: publish succeeds with LAPSED rule present
  > - [ ] K2 PUBVAL-02a: MISSING_OUTCOME_TRANSITION for REJECTED without rule
  > - [ ] K2 PUBVAL-02c: MISSING_LAPSE_TRANSITION (not MISSING_OUTCOME_TRANSITION) for LAPSED case
  > - [ ] STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1 for parallel step types
  > - [ ] MISSING_CERTIFIED_URGENT_TRANSITION for multi_referral without bypass rule
  > - [ ] All errors collected together (not fail-fast)

---

## TASK-WF-011

Phase:          1
Module:         WF
Title:          Implement Thursday cutoff scheduler job (`evaluateThursdayCutoffs`)
Prerequisites:  [TASK-WF-008, TASK-DOCS-019]
Deliverables:
  - /apps/server/src/modules/workflow/jobs/evaluate-thursday-cutoffs.ts — pgboss job `evaluateThursdayCutoffs`, scheduled every Thursday 23:59:59 PHT (Asia/Manila); idempotent via `metadata.last_cutoff_evaluated_at` guard; computes `second_reading_eligible_date = cutoff_date + 5 days` (following Tuesday); emits `workflow.multi_referral.cutoff_missed` or `workflow.multi_referral.second_reading_eligible`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] K2 THU-01: all committees submit before Thursday 23:59:59 PHT → `second_reading_eligible_date` = following Tuesday; event emitted
  - [ ] K2 THU-02: submission at exactly 23:59:59 PHT counts as before cutoff (`<=` comparison)
  - [ ] K2 THU-03: some committees miss cutoff → `thursday_cutoffs_missed += 1`; `cutoff_missed` event includes `missing_committee_ids`
  - [ ] K2 THU-09: running the job twice in the same window has no additional effect
  - [ ] K2 THU-10: if `second_reading_eligible_date` already set, no further update
  - [ ] K2 THU-11: cutoff computed in `Asia/Manila` timezone (23:59:59 PHT = 15:59:59 UTC)
AI Prompt:
  > You are implementing the Thursday cutoff enforcement scheduler job.
  >
  > **Background:** SP sessions are held on Tuesdays. The Thursday cutoff is the deadline for committee reports before the next Tuesday's Order of Business. If all committees submit before Thursday 23:59:59 PHT, the measure is eligible for the following Tuesday. If not, eligibility moves to the Tuesday after the week all committees finally submit. (Source: consolidated reference Part 7.2, Part 8.3; confirmed Interview 2.)
  >
  > **Schedule:** pgboss job, every Thursday 23:59:59 PHT. PHT 23:59:59 = UTC 15:59:59 (Asia/Manila is UTC+8, no DST). Configure with timezone-aware cron: `'59 59 23 * * 4'` in `Asia/Manila`, or convert to the UTC-equivalent cron expression if pgboss's scheduler does not support IANA timezone strings directly — confirm against the installed pgboss version's scheduling API before finalizing; if pgboss requires UTC cron, register `'59 15 * * 4'` (UTC) instead and document the conversion in a code comment.
  >
  > **Algorithm (per active multi_referral step_instance with thursday_cutoff_enabled = true):**
  > ```
  > cutoff_ts = current Thursday 23:59:59 PHT as TIMESTAMPTZ
  >
  > FOR each step_instance WHERE step.step_type = 'multi_referral'
  >   AND step_instance.status = 'Active'
  >   AND step.config->>'thursday_cutoff_enabled' = 'true':
  >
  >   -- Idempotency guard
  >   IF metadata.last_cutoff_evaluated_at >= cutoff_ts: SKIP (already processed this window)
  >
  >   IF metadata.all_submitted_at IS NULL:
  >     metadata.thursday_cutoffs_missed += 1
  >     metadata.last_cutoff_evaluated_at = cutoff_ts
  >     EMIT workflow.multi_referral.cutoff_missed {
  >       step_instance_id, cutoff_timestamp: cutoff_ts,
  >       missing_committee_ids: [committees in assigned_committees with no submissions entry],
  >       cutoff_number: metadata.thursday_cutoffs_missed
  >     }
  >
  >   ELSE IF metadata.all_submitted_at <= cutoff_ts AND metadata.second_reading_eligible_date IS NULL:
  >     -- K2 THU-02: <= means exactly-23:59:59 submissions count as before cutoff
  >     eligible_date = DATE(cutoff_ts AT TIME ZONE 'Asia/Manila') + INTERVAL '5 days'  -- Thursday + 5 = Tuesday
  >     metadata.second_reading_eligible_date = eligible_date
  >     metadata.last_cutoff_evaluated_at = cutoff_ts
  >     WRITE instance.context.second_reading_eligible_date = eligible_date
  >     EMIT workflow.multi_referral.second_reading_eligible { step_instance_id, eligible_date, cutoff_timestamp_cleared: cutoff_ts }
  >
  >   ELSE:
  >     PASS  -- second_reading_eligible_date already set; nothing to do (K2 THU-10)
  > ```
  >
  > **Eligible date examples (verify against these in tests):**
  > - Last submission Monday Week N 08:00 → cutoff Thursday Week N 23:59:59 → eligible Tuesday Week N+1
  > - Last submission Thursday Week N 23:59:59 exactly → counts as before cutoff (K2 THU-02) → eligible Tuesday Week N+1
  > - Last submission Thursday Week N 23:59:59.001 (1ms after) → evaluated next week → eligible Tuesday Week N+2
  > - Last submission Friday Week N 09:00 → evaluated Thursday Week N+1 → eligible Tuesday Week N+2
  >
  > **Test fixture guidance (K2 §2):** Tests must control the cutoff timestamp explicitly — do not depend on the real system clock. Use Vitest fake timers (`vi.useFakeTimers()` + `vi.setSystemTime()`) or pass cutoff_ts as an injectable parameter to the job's core function for testability.
  >
  > **Registration:** Register in WF plugin initialization (TASK-WF-024) with job name `'evaluateThursdayCutoffs'`.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] K2 THU-01: all submitted before cutoff → eligible_date = following Tuesday
  > - [ ] K2 THU-02: exactly-23:59:59 submission counts as before cutoff
  > - [ ] K2 THU-03: missed cutoff → thursday_cutoffs_missed incremented; missing_committee_ids correct
  > - [ ] K2 THU-09: idempotent on double-run in same window
  > - [ ] K2 THU-10: no update once second_reading_eligible_date is set
  > - [ ] K2 THU-11: Asia/Manila timezone correctly applied

---

## TASK-WF-012

Phase:          1
Module:         WF
Title:          Implement Mayor lapse timer scheduler job (`evaluateMayorLapseTimers`)
Prerequisites:  [TASK-WF-007]
Deliverables:
  - /apps/server/src/modules/workflow/jobs/evaluate-mayor-lapse-timers.ts — node-cron job, every hour; `SELECT ... FOR UPDATE` row lock to prevent race conditions with concurrent Mayor submissions; sets `step_instances.completed_at = mayor_action_deadline` (not `NOW()`); `actor_type = 'scheduler'`; emits `workflow.approval.lapsed`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] K2 MAYOR-01: 10 calendar days elapsed, no Mayor action → step completes `LAPSED`, `completed_at = mayor_action_deadline`, `workflow.approval.lapsed` emitted with `legal_basis: 'RA 7160 Section 47'`
  - [ ] K2 MAYOR-11 (tested via approval handler): LAPSED submitted by `actor_type = 'user'` throws FORBIDDEN — confirms this job correctly sets `actor_type = 'scheduler'`
  - [ ] Race condition: Mayor submits between this job's `SELECT` and lock acquisition → job detects non-null outcome post-lock and skips (no double-lapse)
  - [ ] `outcome_comment` exact text: `'Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47.'`
  - [ ] After lapse, transition routes to `docketing` via the `outcome_filter = 'LAPSED'` rule
AI Prompt:
  > You are implementing the Mayor 10-day lapse timer scheduler job.
  >
  > **Legal basis:** RA 7160 Section 47. Applies to both SP Resolutions AND SP Ordinances. (Source: confirmed, consolidated reference Part 4.1, Part 11.3.)
  >
  > **Timer start:** Set by the context writer (TASK-WF-005) when the `transmittal_letter_to_mayor` action step completes (config.triggers_mayor_lapse_timer = true):
  > - `context.mayor_transmittal_date = NOW()`
  > - `context.mayor_action_deadline = NOW() + INTERVAL '10 days'`
  > 10 CALENDAR days — no weekend/holiday adjustment.
  >
  > **Schedule:** node-cron, every hour (`'0 * * * *'`). Register in WF plugin init (TASK-WF-024).
  >
  > **Algorithm:**
  > ```
  > FOR each active approval step_instance WHERE:
  >   'LAPSED' IN step.config->>'allowed_outcomes'
  >   AND instance.context->>'mayor_action_deadline' IS NOT NULL
  >   AND step_instance.outcome IS NULL
  >   AND NOW() > (instance.context->>'mayor_action_deadline')::TIMESTAMPTZ:
  >
  >   BEGIN TRANSACTION
  >     SELECT step_instance.* FROM workflow.step_instances WHERE id = $1 FOR UPDATE
  >
  >     -- Race condition check AFTER lock acquired
  >     IF step_instance.outcome IS NOT NULL:
  >       ROLLBACK; CONTINUE to next instance  -- Mayor beat the scheduler
  >
  >     UPDATE step_instances SET
  >       status = 'Completed',
  >       outcome = 'LAPSED',
  >       outcome_comment = 'Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47.',
  >       completed_at = (instance.context->>'mayor_action_deadline')::TIMESTAMPTZ,  -- CRITICAL: deadline, not NOW()
  >       actor_type = 'scheduler'
  >
  >     UPDATE instances SET context = context || jsonb_build_object(
  >       'mayor_action', 'LAPSED',
  >       'mayor_action_date', instance.context->>'mayor_action_deadline'
  >     )
  >
  >     INSERT INTO workflow_events (event_type: 'workflow.approval.lapsed', payload: {
  >       step_instance_id, legal_basis: 'RA 7160 Section 47', deadline_was: mayor_action_deadline
  >     }, actor_type: 'scheduler')
  >
  >     RUN step resolution (routes to docketing via outcome_filter = 'LAPSED' rule)
  >   COMMIT
  > ```
  >
  > **Race condition prevention:** The `SELECT ... FOR UPDATE` acquires a pessimistic row lock. If the Mayor's `mayorSign`/`mayorVeto` tRPC call is mid-flight and reaches its own UPDATE first, this job's check (`outcome IS NOT NULL` post-lock) detects it and skips — first commit wins.
  >
  > **Notification:** `workflow.approval.lapsed` triggers in-app notification to SP Secretary + dashboard alert via the Notifications module subscribing to this event. The WF module does not send notifications directly.
  >
  > **Veto path note (for context only, not implemented in this job):** If Mayor submits `outcome = 'VETOED'` before the deadline, the workflow routes to `veto_override_vote` (handled by approval handler + transition evaluation, TASK-WF-007). Override threshold: 2/3 = 8 of 12 SP members (confirmed fact).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] K2 MAYOR-01: 10 days elapsed → LAPSED with completed_at = deadline (not NOW())
  > - [ ] outcome_comment text matches exactly
  > - [ ] workflow.approval.lapsed emitted with legal_basis = 'RA 7160 Section 47'
  > - [ ] Race condition: Mayor submission between SELECT and lock → job skips
  > - [ ] actor_type = 'scheduler' (not 'user')
  > - [ ] Routes to docketing after lapse

---

## TASK-WF-013

Phase:          1
Module:         WF
Title:          Implement Panlalawigan 30-day timer scheduler job (`evaluatePanlalawiganTimers`)
Prerequisites:  [TASK-WF-007]
Deliverables:
  - /apps/server/src/modules/workflow/jobs/evaluate-panlalawigan-timers.ts — node-cron job, daily 06:00 PHT; `SELECT ... FOR UPDATE` race prevention; 30-calendar-day RA 7160 §56(d) deemed approval; `completed_at = panlalawigan_action_deadline`; emits `workflow.panlalawigan.deemed_approved`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] K2 PANLA-01: 30 calendar days elapsed → `panlalawigan_review` completes `DEEMED_APPROVED`, `completed_at = panlalawigan_action_deadline`, `legal_basis: 'RA 7160 Section 56(d)'`
  - [ ] K2 PANLA-13 (tested via approval handler): `DEEMED_APPROVED` from `actor_type = 'user'` throws FORBIDDEN
  - [ ] Race condition: Secretariat submits outcome between `SELECT` and lock → job skips
  - [ ] `outcome_comment` exact text: `'Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan.'`
AI Prompt:
  > You are implementing the Panlalawigan 30-day timer scheduler job.
  >
  > **Legal basis:** RA 7160 Section 56(d). Applies to both SP Resolutions AND SP Ordinances — both are transmitted to Sangguniang Panlalawigan after Mayor action (sign or lapse). (Source: confirmed, consolidated reference Part 4.3.)
  >
  > **Timer start:** Set by context writer when `panlalawigan_transmission_logging` action step completes (config.triggers_panlalawigan_timer = true):
  > - `context.panlalawigan_transmission_date = NOW()`
  > - `context.panlalawigan_action_deadline = NOW() + INTERVAL '30 days'`
  > 30 CALENDAR days — no weekend/holiday adjustment.
  >
  > **Schedule:** node-cron, daily at 06:00 PHT (`'0 6 * * *'` with `timezone: 'Asia/Manila'`).
  >
  > **Algorithm:**
  > ```
  > FOR each active approval step_instance WHERE:
  >   'DEEMED_APPROVED' IN step.config->>'allowed_outcomes'
  >   AND instance.context->>'panlalawigan_action_deadline' IS NOT NULL
  >   AND instance.context->>'panlalawigan_outcome' IS NULL
  >   AND NOW() > (instance.context->>'panlalawigan_action_deadline')::TIMESTAMPTZ:
  >
  >   BEGIN TRANSACTION
  >     SELECT step_instance.* FOR UPDATE
  >     IF instance.context->>'panlalawigan_outcome' IS NOT NULL:
  >       ROLLBACK; CONTINUE  -- Secretariat beat the scheduler
  >
  >     UPDATE step_instances SET
  >       status = 'Completed', outcome = 'DEEMED_APPROVED',
  >       outcome_comment = 'Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan.',
  >       completed_at = (instance.context->>'panlalawigan_action_deadline')::TIMESTAMPTZ,  -- deadline, not NOW()
  >       actor_type = 'scheduler'
  >
  >     UPDATE instances SET context = context || jsonb_build_object(
  >       'panlalawigan_outcome', 'DEEMED_APPROVED',
  >       'panlalawigan_response_date', instance.context->>'panlalawigan_action_deadline'
  >     )
  >
  >     EMIT workflow.panlalawigan.deemed_approved {
  >       step_instance_id, legal_basis: 'RA 7160 Section 56(d)',
  >       transmission_date: context.panlalawigan_transmission_date,
  >       deadline_was: context.panlalawigan_action_deadline
  >     }
  >
  >     RUN step resolution  -- VALID/DEEMED_APPROVED route to publication_check (Ordinance) or portal_publication (Resolution)
  >   COMMIT
  > ```
  >
  > **Manual Panlalawigan response (before 30 days, handled elsewhere not in this job):** Secretariat submits via `workflow.recordPanlalawiganOutcome` (TASK-WF-021) with allowed_outcomes VALID, VALID_IN_PART, RETURNED, OPERATIVE_IN_ITS_ENTIRETY (Appropriation Ordinance only — guarded in approval handler TASK-WF-007).
  >
  > **Outcome routing (via transition rules in definitions, not in this job):**
  > - VALID, DEEMED_APPROVED, OPERATIVE_IN_ITS_ENTIRETY (Appropriation Ordinance) → publication_check or portal_publication
  > - VALID_IN_PART → valid_in_part_action step
  > - RETURNED → returned_review step
  >
  > Before submitting this PR, confirm each item:
  > - [ ] K2 PANLA-01: 30 days elapsed → DEEMED_APPROVED, completed_at = deadline (not NOW())
  > - [ ] workflow.panlalawigan.deemed_approved emitted with correct legal basis
  > - [ ] outcome_comment text matches exactly
  > - [ ] Race condition: Secretariat submission between SELECT and lock → job skips
  > - [ ] actor_type = 'scheduler'

---

## TASK-WF-014

Phase:          1
Module:         WF
Title:          Implement SLA escalation monitor (`evaluateSlaBreaches`)
Prerequisites:  [TASK-WF-005]
Deliverables:
  - /apps/server/src/modules/workflow/jobs/evaluate-sla-breaches.ts — `evaluateSlaBreaches()`: runs on Fastify startup AND every 15 minutes via node-cron; 80%/100%/150% thresholds; `sla_breached_at = sla_deadline` (not detection time); idempotent per threshold per step instance
  - /apps/server/src/modules/workflow/services/sla.service.ts — `computeSlaDeadline(startDate, workingDays)` and `elapsedWorkingDays(startDate, now)`; reads holiday calendar from Platform Administrator config (not hardcoded)
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `evaluateSlaBreaches` runs on server startup before accepting requests
  - [ ] Instances with `sla_deadline < NOW()` and `sla_breached_at IS NULL` get `sla_breached_at = sla_deadline` (not `NOW()`)
  - [ ] `workflow.sla.warning` emitted at 80% elapsed; at most once per step instance
  - [ ] `workflow.sla.breached` emitted at 100%; `sla_breached_at` set to deadline
  - [ ] `workflow.sla.critical` emitted at 150%; at most once per step instance
  - [ ] Working day computation excludes Saturdays/Sundays; holidays read from config table, not hardcoded
  - [ ] ARTA defaults documented and applied: simple ≤ 3 working days; complex ≤ 7; highly technical ≤ 20
AI Prompt:
  > You are implementing the SLA escalation monitor for the Batac City LGU workflow engine.
  >
  > **Legal basis:** RA 11032 (ARTA — Anti-Red Tape Act). ARTA compliance obligations do NOT pause during system outages, instance Pauses, or Stuck states — the SLA clock runs continuously on wall-clock time. (Source: confirmed legal requirement, consolidated reference Part 11.3.)
  >
  > **ARTA transaction categories:** simple ≤ 3 working days; complex ≤ 7 working days (SP Resolutions/Ordinances default here); highly technical ≤ 20 working days. Working days exclude Saturdays, Sundays, and configured public holidays — the holiday calendar is maintained by Platform Administrators in a config table, NOT hardcoded in application code.
  >
  > **Startup behavior (ARTA compliance critical):**
  > Run `evaluateSlaBreaches` on server startup BEFORE accepting requests. For each instance/step where `sla_deadline < NOW()` and `sla_breached_at IS NULL`:
  > - Set `sla_breached_at = sla_deadline` (the actual breach moment, not the detection moment)
  > - Emit `workflow.sla.breached`
  > Example: a 12-hour outage causing 47 measures to breach → 47 breach events fire on restart, no deduplication, each carrying its true historical breach time.
  >
  > **Escalation schedule (runs every 15 min via node-cron AND on startup):**
  > ```
  > 80% threshold: NOW() >= started_at + (sla_deadline - started_at) * 0.8
  >   → emit workflow.sla.warning { instance_id, step_instance_id, sla_deadline, percent_elapsed: 80 }
  >   → notify assignee + direct supervisor (in-app)
  >   → idempotent: track via step_instances.metadata.sla_warning_sent_at; emit at most once per step instance
  >
  > 100% threshold (breach): NOW() > sla_deadline AND sla_breached_at IS NULL
  >   → set sla_breached_at = sla_deadline (not NOW())
  >   → emit workflow.sla.breached { instance_id, step_instance_id, sla_deadline, breach_detected_at: NOW(), breached_at: sla_deadline }
  >   → notify assignee, supervisor, Records Officer; step-level also notifies SP Secretary; instance-level also surfaces on Mayor dashboard
  >
  > 150% threshold: NOW() >= started_at + (sla_deadline - started_at) * 1.5 AND step still active
  >   → emit workflow.sla.critical { instance_id, step_instance_id, sla_deadline }
  >   → add to SP Secretary critical queue
  >   → idempotent: track via step_instances.metadata.sla_critical_sent_at; emit at most once
  > ```
  >
  > **Idempotency implementation:** Add `sla_warning_sent_at` and `sla_critical_sent_at` to `step_instances.metadata` (or dedicated columns if preferred — confirm with TASK-WF-001 schema before adding new columns; metadata JSONB is the lower-friction choice). Check these before emitting; set them when emitted.
  >
  > **Notification targets (configurable, not hardcoded):** Supervisor and Records Officer role keys are read from document type configuration. Defaults: supervisor = `'role:sp_presiding_officer'`, records officer = `'role:records_officer'` for SP document types.
  >
  > **sla.service.ts:**
  > ```typescript
  > computeSlaDeadline(startDate: Date, workingDays: number): Promise<Date>
  >   // Walks forward from startDate, skipping Sat/Sun and configured holidays, until workingDays business days have elapsed
  > elapsedWorkingDays(startDate: Date, now: Date): Promise<number>
  >   // Counts business days between startDate and now, excluding Sat/Sun and holidays
  > ```
  > Holiday calendar: read from a config table (introduced in a prior platform-wide migration — locate it; if it does not yet exist, flag this as a blocking dependency and stub with an empty holiday list plus a TODO, since holiday calendar migration ownership belongs to a different module).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] evaluateSlaBreaches runs on startup before accepting requests
  > - [ ] Outage-period breaches get sla_breached_at = sla_deadline (not NOW())
  > - [ ] workflow.sla.warning at 80%, at most once per step instance
  > - [ ] workflow.sla.breached at 100%, sla_breached_at = deadline
  > - [ ] workflow.sla.critical at 150%, at most once per step instance
  > - [ ] Working days exclude weekends; holidays from config, not hardcoded

---

## TASK-WF-015

Phase:          1
Module:         WF
Title:          [AUDIT] Implement Version Management Option B — migrateInstance, bypassStep, cancelInstance
Prerequisites:  [TASK-WF-005, TASK-WF-006, TASK-WF-007]
Deliverables:
  - /apps/server/src/modules/workflow/engine/admin-operations.ts — `engine.cancelInstance`, `engine.bypassStep`, `engine.migrateInstance`; all mandatory-comment-enforced (B4 invariant #10) and always audit-logged; `migrateInstance` requires unexpired City Administrator approval record (B4 invariant #8), step-key mapping with `STEP_KEY_NOT_FOUND_IN_TARGET_VERSION` guard, and 24-hour reversal window
  - /apps/server/src/modules/workflow/engine/admin-operations.test.ts — Vitest tests for K2 VER-03 through VER-14, B4 invariants #8, #9, #10, #12
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `cancelInstance` with empty reason throws `VALIDATION_FAILED` (B4 invariant #10)
  - [ ] `cancelInstance` sets all `Active` step instances to `Cancelled` in the same transaction as `instances.status = 'Cancelled'`
  - [ ] `bypassStep` with empty comment throws `VALIDATION_FAILED` (B4 invariant #10)
  - [ ] K2 VER-03: `instances.definition_version_id` is only writable via `migrateInstance`/`migrateInstanceVersion` (B4 invariant #1) — verified by repository contract from TASK-WF-004
  - [ ] K2 VER-04: `migrateInstance` without a valid, unexpired City Administrator approval record throws `NO_ADMIN_APPROVAL` (B4 invariant #8)
  - [ ] K2 VER-14: migration where a target-version transition references a step from a different version → instance set to `Stuck` (B4 invariant #12) — covered by the publish-time validator on the TARGET version, plus a runtime defensive check here
  - [ ] Migration emits `workflow.instance.migration.started` then `workflow.instance.migration.completed`
  - [ ] 24-hour reversal: `reversibleUntil = migration_completed_at + 24h`; reversal requested after that window requires a fresh City Administrator approval record
AI Prompt:
  > You are implementing the admin engine operations: `cancelInstance`, `bypassStep`, `migrateInstance`. These are high-risk operations requiring mandatory reasons/comments and are always audit-logged via emitted events.
  >
  > **cancelInstance:**
  > ```typescript
  > engine.cancelInstance(instanceId: string, actorId: string, reason: string): Promise<void>
  > ```
  > Preconditions (in order):
  > 1. Load instance. If status is 'Completed' or 'Cancelled' already: throw CONFLICT
  > 2. If reason is empty/whitespace: throw VALIDATION_FAILED (B4 invariant #10)
  > 3. Verify actorId has Platform Administrator (or other authorized) role — actual role check is enforced by the calling tRPC procedure's ABAC guard (TASK-WF-017/022); this engine function trusts its caller but documents the expectation
  >
  > Within ONE transaction:
  > - UPDATE step_instances SET status = 'Cancelled' WHERE instance_id = instanceId AND status = 'Active'
  > - UPDATE instances SET status = 'Cancelled', cancellation_reason = reason, cancelled_by = actorId, completed_at = NOW()
  > - Emit workflow.instance.cancelled { instanceId, actorId, cancellationReason: reason }
  >
  > **bypassStep:**
  > ```typescript
  > engine.bypassStep(stepInstanceId: string, actorId: string, bypassReason: string, comment: string): Promise<void>
  > ```
  > Preconditions:
  > 1. Step must be 'Active'; else CONFLICT
  > 2. comment must be non-empty (B4 invariant #10); else VALIDATION_FAILED
  >
  > Within ONE transaction:
  > - UPDATE step_instances SET status = 'Skipped', bypassed_at = NOW(), bypassed_by = actorId, bypass_reason = bypassReason, outcome_comment = comment
  > - Emit workflow.step.bypassed { instanceId, stepInstanceId, bypassReason, bypassedBy: actorId }
  > - Run step resolution
  > Note: this is the ADMIN bypass (bypassed_by = actorId, a real user). Distinguish from the Certified Urgent bypass (TASK-WF-009) where bypassed_by = null.
  >
  > **migrateInstance — Option B in-flight migration (B4 §7.3):**
  > ```typescript
  > engine.migrateInstance(instanceId: string, targetVersionId: string, actorId: string, reason: string): Promise<{ migrationId: string; reversibleUntil: Date }>
  > ```
  > High-risk operation for legally-mandated workflow changes mid-flight.
  >
  > Preconditions (validate IN ORDER):
  > 1. targetVersionId must be a published version (published_at IS NOT NULL) for the same `definition_id` as the instance's current version
  > 2. A valid, unexpired City Administrator approval record must exist in `workflow.admin_approval_grants` `[OPEN-Q-3 RESOLVED — workflow schema, not iam; table defined in TASK-WF-001]`:
  >    `SELECT * FROM workflow.admin_approval_grants WHERE instance_id = instanceId AND target_version_id = targetVersionId AND used = false AND deleted_at IS NULL AND expiry_timestamp > NOW()`.
  >    If no row → throw NO_ADMIN_APPROVAL (B4 invariant #8).
  > 3. reason must be non-empty (B4 invariant #10)
  > 4. instance.status must be 'Running'
  >
  > Migration algorithm (one transaction):
  > 1. Load instance, all active step instances, target version's steps
  > 2. Step mapping: for each active step instance, find the step with matching step_key in the target version
  >    - If any active step's step_key has no match in target version: throw STEP_KEY_NOT_FOUND_IN_TARGET_VERSION (list all missing keys); ABORT migration (no partial writes)
  > 3. Emit workflow.instance.migration.started { instanceId, fromVersionId, toVersionId, actorId, reason, stepMapping }
  > 4. Call repository.migrateInstanceVersion(instanceId, targetVersionId) — the ONLY function allowed to write definition_version_id
  > 5. For each active step instance: UPDATE step_id to the mapped target-version step id
  > 6. UPDATE workflow.admin_approval_grants SET used = true, used_at = NOW() WHERE id = <the matched grant's id>, atomically with the migration
  > 7. Emit workflow.instance.migration.completed { instanceId, fromVersionId, toVersionId }
  > 8. Commit
  > 9. Return { migrationId: <the migration event's id>, reversibleUntil: completedAt + 24 hours }
  >
  > Runtime defensive check (B4 invariant #12, beyond the publish-time validator): after migration, verify that for each remapped active step, any transition rules from that step in the target version reference only target-version step ids. If a stale reference is somehow found (should be prevented at publish time but checked defensively here): set instance.status = 'Stuck' and emit workflow.instance.stuck rather than allowing an inconsistent state.
  >
  > **Reversal (within 24h window):**
  > - Same algorithm in reverse (source/target version swapped)
  > - Requires the original migration's event_id as input
  > - Requires non-empty reversal reason
  > - After 24h: requires a NEW City Administrator approval record (cannot reuse the original)
  > - Emits workflow.instance.migration.reversed { instance_id, actor_id, reversal_reason, original_migration_event_id }
  >
  > **Audit:** All three operations' events are consumed by the audit service, which writes permanently-retained, high-priority audit entries. The WF engine never writes directly to the audit schema.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] cancelInstance with empty reason throws VALIDATION_FAILED
  > - [ ] cancelInstance sets all Active step instances to Cancelled in same transaction
  > - [ ] bypassStep with empty comment throws VALIDATION_FAILED
  > - [ ] migrateInstance without City Admin approval throws NO_ADMIN_APPROVAL
  > - [ ] migrateInstance with missing step_key in target version throws STEP_KEY_NOT_FOUND_IN_TARGET_VERSION, aborts cleanly
  > - [ ] Migration emits migration.started then migration.completed
  > - [ ] 24h reversal window enforced; reversal after 24h requires new approval

---

## TASK-WF-016

Phase:          1
Module:         WF
Title:          Seed Phase 1 workflow definitions — SP Resolution, SP Ordinance, Appropriation Ordinance
Prerequisites:  [TASK-WF-001, TASK-WF-003, TASK-WF-010, TASK-DOCS-007]
Deliverables:
  - /packages/database/src/seeds/workflow/constants.ts — `WORKFLOW_SEED_NAMESPACE` UUID constant for deterministic `uuidv5` generation; `PLATFORM_ADMIN_SEED_USER_ID` reference (reuse from existing seed constants if already defined by an earlier TASK-DOCS or platform-infra seed task — do not redefine if a shared constant already exists)
  - /packages/database/src/seeds/workflow/phase1-legislative.ts — exports `SP_RESOLUTION_WORKFLOW`, `SP_ORDINANCE_WORKFLOW`, `APPROPRIATION_ORDINANCE_WORKFLOW` as typed `WorkflowDefinitionSeed` constants (full step/transition data per H1, with the ADR-03 correction applied to `committee_revisions_review`'s assignee expression); a `seedPhase1WorkflowDefinitions()` function that resolves `document_type_id`, inserts definitions → versions → steps → transition rules in order using deterministic `uuidv5` step IDs, calls `validateDefinitionForPublish` before publishing, and uses `ON CONFLICT DO NOTHING` for idempotency
  - **SCOPE NOTE `[OPEN-Q-4 RESOLVED, developer decision 2026-07-02 — Option C]`:** This task seeds only the three legislative types above. `DOCUMENT_REQUEST_FORM`'s workflow definition is confirmed as a real Phase 1-scoped concept structurally — [ADR-EVT-001](../../B-architecture-documents/b3-internal-domain-event-catalog-adrs/ADR-EVT-001-document-request-form-approval-modeling.md) already closes B3's OI-13/14/15 around it — but authoring and seeding its actual `workflow.definitions` row is explicitly **deferred to Phase 1B**, not built in this task. Until a Phase 1B task seeds it, `DOCUMENT_REQUEST_FORM` documents will have no active workflow definition and `createInstance` will throw `NO_ACTIVE_VERSION` when triggered for one (see TASK-WF-024's note on this) — this is the intended Phase 1 behavior, not an oversight. When Phase 1B authors this seed, ADR-EVT-001 already specifies its shape: two sequential `approval` steps (Vice Mayor, then conditionally SP Secretary), `allowed_outcomes: ['APPROVED','REJECTED']` on each (both already-defined B4 §4.2 codes — no new per-step outcome codes), rejection at the VM step routing directly to termination without proceeding to the SP Secretary step, and a `termination` step using the two new outcome codes `RELEASED_TO_REQUESTER` / `REQUEST_DENIED` (ADR-EVT-001 Consequences). The exact `assignee` resolution expressions for the two approval steps are explicitly left open by ADR-EVT-001's own "Open Follow-Ups" — not specified here, not specified there.
  - /packages/database/src/seeds/index.ts — wires the Phase 1 workflow seed into the seed runner, after the docs/document-types seed
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes in `/packages/database`
  - [ ] Seed run against a fresh database (after document-types are seeded) inserts and publishes all 3 workflow definitions
  - [ ] Re-running the seed produces no duplicate rows and no errors (idempotent)
  - [ ] `committee_revisions_review` step's assignee is `"actor_from_context:referred_committee_chair_id"` — the H1 placeholder `"instance_aware:committee_chair_of_referred_committee"` does NOT appear anywhere in the seed data (corrected per K2 ADR-03)
  - [ ] All 3 definitions pass `validateDefinitionForPublish` before being marked published; seed aborts loudly if any fails
  - [ ] Each step has a deterministic UUID derived from `uuidv5(WORKFLOW_SEED_NAMESPACE, \`${definitionCode}.${step_key}\`)` — confirmed by running the seed twice and diffing generated IDs (must be identical)
  - [ ] SP Ordinance and Appropriation Ordinance definitions correctly diverge from SP Resolution per the documented step differences (third_reading_vote, publication_check/newspaper_publication, OPERATIVE_IN_ITS_ENTIRETY)
AI Prompt:
  > You are implementing the Phase 1 workflow definition seed script for the Batac City LGU platform — inserting the three legislative workflow definitions into the database.
  >
  > **CRITICAL CORRECTION (K2 ADR-03):** H1 §4/§5 specifies the `committee_revisions_review` step's assignee as the placeholder string `"instance_aware:committee_chair_of_referred_committee"`. This is NOT a valid B4 assignee resolution expression — it does not match any of the five supported prefixes (`role:`, `office_role:`, `delegation_aware:`, `actor_from_context:`, `static:`). The corrected expression, per K2 ADR-03, is:
  > ```
  > "actor_from_context:referred_committee_chair_id"
  > ```
  > This works because `workflow.resolveValidInPart`'s `route_to_committee` path (TASK-WF-021) writes `context.referred_committee_chair_id` before routing here. Use ONLY the corrected expression in seed data — do not include the placeholder anywhere, even as a comment artifact that might get copy-pasted.
  >
  > **Seed location:** `/packages/database/src/seeds/workflow/phase1-legislative.ts`
  >
  > **Deterministic UUIDs:**
  > ```typescript
  > import { v5 as uuidv5 } from 'uuid';
  > const WORKFLOW_SEED_NAMESPACE = '<define a stable namespace UUID — generate one with uuidv4() once and hardcode it; do not regenerate on each run>';
  > // step id = uuidv5(WORKFLOW_SEED_NAMESPACE, `${definitionCode}.${step.step_key}`)
  > // transition rule id = uuidv5(WORKFLOW_SEED_NAMESPACE, `${definitionCode}.${from_step_key}->${to_step_key}.${outcome_filter ?? 'default'}`)
  > ```
  >
  > **Insertion order (per definition):**
  > ```
  > 1. Resolve document_type_id: SELECT id FROM documents.document_types WHERE code = definition.document_type_code
  > 2. INSERT workflow.definitions ... ON CONFLICT (use a natural idempotency key, e.g. ON CONFLICT DO NOTHING with a pre-check SELECT, since the partial unique index is on (document_type_id) WHERE is_active) — capture id
  > 3. INSERT workflow.definition_versions (snapshot = full {steps, transition_rules} JSON for traceability) ON CONFLICT DO NOTHING — capture id
  > 4. For each step: compute uuidv5 id; INSERT workflow.steps ON CONFLICT (definition_version_id, step_key) DO NOTHING
  > 5. Build a step_key → step_id map from inserted/existing rows
  > 6. For each transition rule: resolve from_step_id/to_step_id via the map; compute uuidv5 id; INSERT workflow.transition_rules ON CONFLICT DO NOTHING
  > 7. CALL validateDefinitionForPublish(versionId) — if invalid, THROW with the full error list and ABORT THE ENTIRE SEED RUN (do not partially publish)
  > 8. UPDATE workflow.definition_versions SET published_at = NOW(), published_by = PLATFORM_ADMIN_SEED_USER_ID, is_current = true WHERE id = versionId
  > 9. UPDATE workflow.definitions SET is_active = true WHERE id = definitionId
  > ```
  >
  > **SP Resolution workflow (H1 §5.2–§5.3) — steps in order with key config:**
  > intake_logging (action, is_start, legally_mandated, auto_complete) → order_of_business_scheduling (action, sp_secretary) → first_reading (action, legally_mandated, sp_secretary) → committee_referral (multi_referral, legally_mandated, thursday_cutoff_enabled: true, require_all_committee_signatures: true, allow_secretary_advance: true) → second_reading_vote (approval, legally_mandated, allowed_outcomes: [APPROVED, RETURNED_FOR_REVISION, REJECTED]) → amendments_logging (action, secretariat_staff, conditional on RETURNED_FOR_REVISION) → second_reading_amended_vote (approval, allowed_outcomes: [APPROVED, REJECTED]) → final_number_assignment (action, legally_mandated, sp_secretary) → vp_certification (approval, legally_mandated, assignee: "delegation_aware:vice_mayor", allowed_outcomes: [SIGNED], is_final_approval: true) → transmittal_letter_to_mayor (action, legally_mandated, secretariat_staff, triggers_mayor_lapse_timer: true) → mayor_review (approval, legally_mandated, assignee: "delegation_aware:mayor", allowed_outcomes: [SIGNED, VETOED, LAPSED]) → veto_override_vote (approval, assignee: "office_role:sp_secretariat:sp_secretary", allowed_outcomes: [OVERRIDE_SUCCEEDED, OVERRIDE_FAILED]) → docketing (action, legally_mandated, secretariat_staff) → panlalawigan_transmission_logging (action, secretariat_staff, triggers_panlalawigan_timer: true) → panlalawigan_review (approval, legally_mandated, assignee: "office_role:sp_secretariat:sp_secretary", allowed_outcomes: [VALID, VALID_IN_PART, RETURNED, DEEMED_APPROVED]) → valid_in_part_action (action, sp_secretary) → valid_in_part_decision (approval, sp_secretary, allowed_outcomes: [RESOLVED_IN_PLACE, ROUTED_TO_LEGAL, ROUTED_TO_COMMITTEE, REVISED_DIRECTLY]) → legal_office_review (approval, "office_role:city_legal:legal_officer", allowed_outcomes: [RESOLVED_IN_PLACE]) → committee_revisions_review (approval, "actor_from_context:referred_committee_chair_id" [CORRECTED], allowed_outcomes: [RESOLVED_IN_PLACE]) → returned_review (approval, sp_secretary, allowed_outcomes: [REPASS, RESOLVED_DIRECTLY]) → portal_publication (action, legally_mandated, secretariat_staff) → archive (action, records_officer) → final_outcome_check (decision, condition: {"in":[{"var":"panlalawigan_outcome"},["VALID","DEEMED_APPROVED"]]}) → 6 termination steps: end_approved_and_released (APPROVED_AND_RELEASED, final_document_status: ARCHIVED), end_valid_in_part_resolved (VALID_IN_PART_RESOLVED, ARCHIVED), end_rejected_at_vote (REJECTED_AT_VOTE, CANCELLED), end_vetoed_override_failed (VETOED_OVERRIDE_FAILED, CANCELLED), end_repassed (REPASSED, final_document_status: null), end_cancelled (CANCELLED, CANCELLED).
  >
  > Wire the 39 transition rules per H1 §5.4 transition summary table, including the mandatory `committee_referral → second_reading_vote` rule with `outcome_filter: 'BYPASSED_CERTIFIED_URGENT'` and the `mayor_review → docketing` rule with `outcome_filter: 'LAPSED'`.
  >
  > **SP Ordinance differences from SP Resolution:**
  > - `second_reading_vote` APPROVED routes to `third_reading_vote` (not `final_number_assignment`)
  > - `amendments_logging` routes to `third_reading_vote` (not `second_reading_amended_vote`)
  > - Replace `second_reading_amended_vote` with `third_reading_vote` (approval, legally_mandated, sp_secretary, allowed_outcomes: [APPROVED, REJECTED])
  > - All Panlalawigan-outcome paths feed into `publication_check` instead of going straight to `portal_publication`
  > - Add `publication_check` (decision, condition: {"==":[{"var":"requires_publication"},true]}; TRUE→newspaper_publication, FALSE→portal_publication)
  > - Add `newspaper_publication` (action, sp_secretary) → portal_publication
  >
  > **Appropriation Ordinance differences from SP Ordinance:**
  > - No `publication_check`, no `newspaper_publication` step
  > - `panlalawigan_review.allowed_outcomes` includes `OPERATIVE_IN_ITS_ENTIRETY`, routing identically to VALID (→ portal_publication)
  > - `final_outcome_check` TRUE condition: {"in":[{"var":"panlalawigan_outcome"},["VALID","DEEMED_APPROVED","OPERATIVE_IN_ITS_ENTIRETY"]]}
  >
  > **Constants:** `city_id = '00000000-0000-4000-8000-000000000001'`; `created_by` / `published_by` = `PLATFORM_ADMIN_SEED_USER_ID`.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Seed runs cleanly against fresh database; all 3 definitions inserted and published
  > - [ ] Seed re-run produces no duplicates, no errors
  > - [ ] committee_revisions_review uses the corrected "actor_from_context:referred_committee_chair_id" expression; placeholder string appears nowhere
  > - [ ] All 3 definitions pass validateDefinitionForPublish before publish; seed aborts loudly on any failure
  > - [ ] Step UUIDs are deterministic across repeated runs
  > - [ ] SP Ordinance / Appropriation Ordinance correctly diverge per the documented differences

---

## TASK-WF-017

Phase:          1
Module:         WF
Title:          [ABAC] Implement WF ABAC policy guard
Prerequisites:  [TASK-WF-002, TASK-DOCS-009]
Deliverables:
  - /apps/server/src/modules/workflow/workflow.policy.ts — `WorkflowPolicyGuard` class implementing ABAC checks for every WF tRPC procedure: step-assignment authorization, office-scoped vs. unconditional read access, encoder ≠ final-approver enforcement (invariant #11, checked AFTER the role gate), committee-membership checks for multi-referral, and role-to-procedure mappings per E1 Module 4
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Users not present in `step_instances.assigned_to` cannot call `completeActionStep` or `approveStep` — throws `FORBIDDEN`
  - [ ] `sp_member` can call `submitCommitteeReport` only when `subject.committee_ids ∩ step.metadata.assigned_committee_ids ≠ ∅`
  - [ ] `dept_encoder`/`brgy_encoder` can complete a step only when `step.assignee_user_id = subject.user_id` OR `parent_document.created_by = subject.user_id` — they cannot claim from a general office queue
  - [ ] `migrateInstanceToNewDefinitionVersion` callable only by `plat_admin`
  - [ ] `manuallyAdvanceMultiReferralStep` callable only by `sp_secretary` — verified to throw FORBIDDEN for every other role including `sp_presiding_officer` and `plat_admin`
  - [ ] `getSlaComplianceData` callable by `records_officer, sp_secretary, sp_presiding_officer, mayor, auditor` without office-scoping (ARTA reporting is cross-office)
  - [ ] Encoder≠final-approver check (invariant #11) is verified to run strictly after the role/assignment gate, not before
AI Prompt:
  > You are implementing the ABAC policy guard for the WF module — enforcing access control on all workflow tRPC procedures, following the established pattern from `DocumentPolicyGuard` (TASK-DOCS-009).
  >
  > **Policy rules by procedure (E1 Module 4):**
  >
  > Read procedures:
  > - `getInstance` / `getActiveInstanceForDocument`: `plat_admin, records_officer, dept_encoder (scoped), dept_approver (scoped), sp_secretary (unconditional), sp_member (scoped), sp_presiding_officer, mayor, brgy_encoder (scoped), brgy_captain (scoped), auditor`. Scoped roles read only documents in their own office. Cross-office read for `records_officer/sp_presiding_officer/mayor/auditor` additionally requires `document.classification_level IN ('public','internal')`.
  > - `listMyAssignedSteps`: all operational roles; filter `step.assignee_user_id = subject.user_id OR office-scoped queue membership`.
  >
  > Action step procedures:
  > - `completeActionStep`: `dept_encoder (scoped), dept_approver, sp_secretary, sp_presiding_officer, mayor, brgy_encoder (scoped), brgy_captain`. Guard: step is `action` + `Active` + (`assignee_user_id = subject.user_id` OR office-match for non-Encoder roles). Encoder-specific restriction: `dept_encoder`/`brgy_encoder` may ONLY complete where `step.assignee_user_id = subject.user_id OR parent_document.created_by = subject.user_id` — never from a general office queue.
  >
  > Approval step procedures:
  > - `approveStep`/`rejectStep`/`returnStepForRevision`: `dept_approver, sp_secretary, mayor, brgy_captain`. Guard: step is `approval` + `Active` + office-match or direct assignee match. Invariant #11: if `step.is_final_approval = true` and `subject.user_id === document.created_by` (or `workflow_instance.context.created_by`) → FORBIDDEN with cause `'encoder_final_approver_same_user_prohibited'`. **This check runs strictly AFTER the role/assignment gate above**, mirroring the approval handler's own validation order (TASK-WF-007).
  > - `certifyAsPresidingOfficer`: `sp_presiding_officer` only. Guard: `step.name = 'vp_certification'`, direct assignee match OR active delegation scoped to `sp_presiding_officer`.
  > - `mayorSign`/`mayorVeto`: `mayor` only. Guard: `step.name IN ('mayor_review','mayor_signature')`, direct assignee OR active delegation.
  > - `recordVetoOverrideVote`: `sp_secretary` only.
  >
  > Multi-referral procedures:
  > - `submitCommitteeReport`: `sp_secretary, sp_member (committee-scoped)`. For `sp_member`: `subject.committee_ids ∩ step.metadata.assigned_committee_ids ≠ ∅` (committee_ids read from JWT-cached claim, not a fresh DB lookup, for latency reasons — confirm this matches the auth module's established claim-caching pattern).
  > - `manuallyAdvanceMultiReferralStep`: `sp_secretary` ONLY. No exceptions, no fallback role — this is an explicit negative per I1 §6.7. Even `plat_admin` must use `bypassStep` instead, not this procedure.
  >
  > Mayor/Panlalawigan procedures:
  > - `logMayorLapseConfirmation, logDocketingCompletion, recordPanlalawiganOutcome, resolveValidInPart, confirmPanlalawiganDeemedApproved, recordNewspaperPublicationDate`: `sp_secretary`.
  >
  > Admin procedures:
  > - `migrateInstanceToNewDefinitionVersion`: `plat_admin` ONLY.
  > - `cancelInstance`/`bypassStep` (admin surface): `plat_admin`; `cancelInstance` additionally allows `records_officer` with own-office scope.
  >
  > Reporting:
  > - `getSlaComplianceData`: `records_officer, sp_secretary, sp_presiding_officer, mayor, auditor` — NOT office-scoped (ARTA compliance reporting must be cross-office for these roles).
  >
  > **Implementation pattern:**
  > ```typescript
  > class WorkflowPolicyGuard {
  >   async checkProcedureAccess(procedure: string, ctx: AuthedContext, input: unknown): Promise<void> {
  >     // dispatches to the per-procedure method below; throws TRPCError FORBIDDEN with `cause` set to the violated clause name
  >   }
  >   async canCompleteActionStep(ctx, stepInstanceId): Promise<void> { ... }
  >   async canApproveStep(ctx, stepInstanceId): Promise<void> {
  >     // 1. role/assignment gate
  >     // 2. THEN invariant #11 check
  >   }
  >   async canSubmitCommitteeReport(ctx, stepInstanceId, committeeId): Promise<void> { ... }
  >   async canManuallyAdvanceMultiReferral(ctx): Promise<void> {
  >     if (ctx.roles.includes('sp_secretary')) return;
  >     throw new TRPCError({ code: 'FORBIDDEN', cause: 'only_sp_secretary_may_manually_advance' });
  >   }
  >   async canMigrateInstance(ctx): Promise<void> { ... }
  >   async canAccessSlaData(ctx): Promise<void> { ... }
  >   // ... etc for every procedure in TASK-WF-018 through TASK-WF-022
  > }
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] Non-assigned actor calling completeActionStep throws FORBIDDEN
  > - [ ] sp_member calling submitCommitteeReport for an unassigned committee throws FORBIDDEN
  > - [ ] dept_encoder attempting a step not assigned to them and not their own document throws FORBIDDEN
  > - [ ] migrateInstanceToNewDefinitionVersion by non-plat_admin throws FORBIDDEN
  > - [ ] manuallyAdvanceMultiReferralStep by any role other than sp_secretary throws FORBIDDEN (including plat_admin)
  > - [ ] getSlaComplianceData accessible by all five listed roles without office scoping
  > - [ ] Invariant #11 check runs after, not before, the role/assignment gate

---

## TASK-WF-018

Phase:          1
Module:         WF
Title:          [ABAC] Implement workflow tRPC router — read procedures
Prerequisites:  [TASK-WF-017]
Deliverables:
  - /apps/server/src/modules/workflow/workflow.router.ts (read section) — 4 query procedures: `workflow.getInstance`, `workflow.getActiveInstanceForDocument`, `workflow.listMyAssignedSteps`, `workflow.getSlaComplianceData`; each calls `WorkflowPolicyGuard` before executing
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `workflow.getInstance({ instanceId })` returns the `WorkflowInstanceSummary` shape per B2 Module 4 (or `null` if not found, surfaced as a typed nullable rather than a thrown NOT_FOUND, matching the Published API contract)
  - [ ] `workflow.listMyAssignedSteps` returns a cursor-paginated list of step instances where the caller is assignee; includes `stepType`, `assignedAt`, `dueAt`
  - [ ] `workflow.getSlaComplianceData` with `breachedOnly: true` returns only instances where `sla_breached_at IS NOT NULL`
  - [ ] All four procedures throw `UNAUTHORIZED` with no valid session and `FORBIDDEN` on ABAC failure
AI Prompt:
  > You are implementing the read (query) procedures for the workflow tRPC router.
  >
  > **Procedure definitions (E1 Module 4):**
  >
  > ```typescript
  > // workflow.getInstance
  > type: 'query'
  > input: z.object({ instanceId: z.string().uuid() })
  > output: z.object({
  >   instanceId: z.string().uuid(), documentId: z.string().uuid(),
  >   definitionVersionId: z.string().uuid(),
  >   currentStepType: z.enum(['action','approval','multi_referral','decision','notification','termination','parallel_split','parallel_join']),
  >   currentStepInstanceId: z.string().uuid(),
  >   currentAssigneeUserId: z.string().uuid().nullable(),
  >   status: z.enum(['Active','Completed','Cancelled']),   // B2 Published API surface type: 'Running'/'Paused'/'Stuck' → 'Active'
  >   slaDeadline: z.coerce.date().nullable(),
  >   lapseStatus: z.enum(['mayor_10_day_lapsed','panlalawigan_30_day_deemed']).nullable()
  > }).nullable()
  > Calls: WorkflowPublicAPI.getInstanceById() (TASK-WF-024)
  > Guard: WorkflowPolicyGuard.canReadInstance(ctx, instanceId)
  >
  > // workflow.getActiveInstanceForDocument
  > type: 'query'
  > input: z.object({ documentId: z.string().uuid() })
  > output: same shape as getInstance, nullable
  > Calls: WorkflowPublicAPI.getActiveInstanceForDocument()
  > Guard: WorkflowPolicyGuard.canReadInstanceForDocument(ctx, documentId)
  >
  > // workflow.listMyAssignedSteps
  > type: 'query'
  > input: z.object({ cursor: z.string().nullable().optional(), limit: z.number().int().min(1).max(100).default(20) })
  > output: z.object({
  >   items: z.array(z.object({
  >     stepInstanceId: z.string().uuid(), instanceId: z.string().uuid(),
  >     documentId: z.string().uuid(), documentTitle: z.string(),
  >     stepType: z.enum(['action','approval','multi_referral','decision','notification','termination']),
  >     assignedAt: z.coerce.date(), dueAt: z.coerce.date().nullable()
  >   })),
  >   nextCursor: z.string().nullable()
  > })
  > Query: SELECT step_instances WHERE status IN ('Pending','Active') AND (assigned_to @> jsonb_build_array(jsonb_build_object('user_id', ctx.session.userId)) OR <office-scope match>); JOIN documents for title
  > Guard: WorkflowPolicyGuard.canListAssignedSteps(ctx) — effectively all authenticated operational roles; this is the "my inbox" query
  >
  > // workflow.getSlaComplianceData
  > type: 'query'
  > input: z.object({
  >   officeId: z.string().uuid().optional(), documentTypeId: z.string().uuid().optional(),
  >   breachedOnly: z.boolean().default(false),
  >   from: z.coerce.date().optional(), to: z.coerce.date().optional()
  > })
  > output: z.array(z.object({
  >   instanceId: z.string().uuid(), documentId: z.string().uuid(),
  >   slaClassification: z.enum(['simple','complex','highly_technical']),
  >   slaThresholdDays: z.number().int(), elapsedWorkingDays: z.number().int(),
  >   isBreached: z.boolean(), breachedAt: z.coerce.date().nullable()
  > }))
  > Guard: WorkflowPolicyGuard.canAccessSlaData(ctx) — records_officer, sp_secretary, sp_presiding_officer, mayor, auditor; NOT office-scoped
  > ```
  >
  > **Pattern (matches the established DOCS router pattern):**
  > 1. Extract `ctx.session.userId` and roles; throw `UNAUTHORIZED` if no session
  > 2. Call the corresponding `WorkflowPolicyGuard` method; it throws `FORBIDDEN` with a `cause` string on failure
  > 3. Execute the repository/service query
  > 4. Return the typed output (Zod-validated at the router boundary)
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `workflow.getInstance` returns the correct shape per B2 Module 4, nullable
  > - [ ] `workflow.listMyAssignedSteps` returns cursor-paginated results scoped to the caller
  > - [ ] `workflow.getSlaComplianceData` with `breachedOnly: true` filters correctly
  > - [ ] All four procedures throw UNAUTHORIZED with no valid session

---

## TASK-WF-019

Phase:          1
Module:         WF
Title:          [ABAC][AUDIT] Implement workflow tRPC router — action and approval step procedures
Prerequisites:  [TASK-WF-017, TASK-WF-006, TASK-WF-007]
Deliverables:
  - /apps/server/src/modules/workflow/workflow.router.ts (action/approval section) — mutation procedures: `workflow.completeActionStep`, `workflow.approveStep`, `workflow.rejectStep`, `workflow.returnStepForRevision`, `workflow.certifyAsPresidingOfficer`, `workflow.mayorSign`, `workflow.mayorVeto`, `workflow.recordVetoOverrideVote`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `completeActionStep` calls `engine.submitStepAction` with `outcome = 'DONE'`
  - [ ] `approveStep` calls the approval handler with the caller's session `userId` as actor
  - [ ] `rejectStep` enforces `comment` via Zod `.min(1)` — required, not optional
  - [ ] `returnStepForRevision` enforces `comment` via Zod `.min(1)`
  - [ ] `certifyAsPresidingOfficer` checks for an active delegation via the Organization Published API when the caller is not the direct assignee
  - [ ] `mayorSign` and `mayorVeto` are separate procedures (not a single procedure with an outcome parameter); `mayorVeto` requires `objectionsText` as Zod `.min(1)`
  - [ ] `recordVetoOverrideVote({ votesFor, votesAgainst, absentCouncilorIds })` returns `{ overrideSucceeded: true }` when `votesFor >= 8`, `false` otherwise
AI Prompt:
  > You are implementing the action and approval step mutation procedures for the workflow tRPC router.
  >
  > **Procedure definitions (E1 Module 4):**
  >
  > ```typescript
  > // workflow.completeActionStep
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid(), comment: z.string().optional() })
  > output: z.object({ success: z.literal(true), nextStepType: z.string().nullable() })
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'DONE', comment ?? null, {})
  >
  > // workflow.approveStep
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid(), comment: z.string().optional() })
  > output: z.object({ success: z.literal(true) })
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'APPROVED', comment ?? null, {})
  >
  > // workflow.rejectStep
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid(), comment: z.string().min(1) })  // REQUIRED
  > output: z.object({ success: z.literal(true) })
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'REJECTED', comment, {})
  >
  > // workflow.returnStepForRevision
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid(), comment: z.string().min(1) })  // REQUIRED
  > output: z.object({ success: z.literal(true) })
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'RETURNED_FOR_REVISION', comment, {})
  >
  > // workflow.certifyAsPresidingOfficer
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid() })
  > output: z.object({ success: z.literal(true) })
  > Additional ABAC: step.label must correspond to 'vp_certification'; caller is sp_presiding_officer directly assigned OR holds active delegation via Organization.getActiveDelegationForUser(ctx.session.userId)
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'SIGNED', null, {})
  >
  > // workflow.mayorSign
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid() })
  > output: z.object({ success: z.literal(true) })
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'SIGNED', null, {})
  >
  > // workflow.mayorVeto
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid(), objectionsText: z.string().min(1) })  // REQUIRED
  > output: z.object({ success: z.literal(true) })
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'VETOED', objectionsText, {})
  >
  > // workflow.recordVetoOverrideVote
  > type: 'mutation'
  > input: z.object({
  >   stepInstanceId: z.string().uuid(),
  >   votesFor: z.number().int().min(0).max(12),
  >   votesAgainst: z.number().int().min(0).max(12),
  >   absentCouncilorIds: z.array(z.string().uuid())
  > })
  > output: z.object({ overrideSucceeded: z.boolean() })
  > Business logic:
  >   const overrideSucceeded = votesFor >= 8;  // 2/3 of 12 SP members — confirmed fact, consolidated reference Part 4.1
  >   const outcome = overrideSucceeded ? 'OVERRIDE_SUCCEEDED' : 'OVERRIDE_FAILED';
  >   // write context.veto_override_vote_count = votesFor BEFORE calling submitStepAction, since the approval handler's
  >   // threshold guard (TASK-WF-007) reads context.veto_override_vote_count to validate the outcome
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, outcome, null, { voteCount: votesFor, votesAgainst, absentCouncilorIds })
  > ```
  >
  > **All mutation procedures follow this pattern:**
  > 1. Verify `ctx.session` exists; else `UNAUTHORIZED`
  > 2. Call `WorkflowPolicyGuard.checkProcedureAccess(procedureName, ctx, input)`
  > 3. Execute the engine call
  > 4. Return typed output
  >
  > **Error mapping (engine error code → TRPCError code):**
  > - `FORBIDDEN` → `FORBIDDEN`
  > - `CONFLICT` → `CONFLICT`
  > - `VALIDATION_FAILED` → `BAD_REQUEST`
  > - `NOT_FOUND` → `NOT_FOUND`
  > - `ENCODER_CANNOT_BE_FINAL_APPROVER` → `FORBIDDEN` with `cause: 'encoder_final_approver_same_user_prohibited'`
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `rejectStep` enforces comment via Zod `.min(1)`
  > - [ ] `returnStepForRevision` enforces comment via Zod `.min(1)`
  > - [ ] `mayorVeto` requires `objectionsText` non-empty
  > - [ ] `recordVetoOverrideVote` returns `overrideSucceeded: true` iff `votesFor >= 8`
  > - [ ] `certifyAsPresidingOfficer` checks delegation via Organization Published API when not directly assigned

---

## TASK-WF-020

Phase:          1
Module:         WF
Title:          [ABAC][AUDIT] Implement workflow tRPC router — multi-referral procedures
Prerequisites:  [TASK-WF-017, TASK-WF-008]
Deliverables:
  - /apps/server/src/modules/workflow/workflow.router.ts (multi-referral section) — mutation procedures: `workflow.submitCommitteeReport`, `workflow.manuallyAdvanceMultiReferralStep`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `submitCommitteeReport` returns `{ allCommitteesSubmitted: boolean }`, `true` exactly when the submitting committee was the last unsubmitted one
  - [ ] `manuallyAdvanceMultiReferralStep({ stepInstanceId, mandatoryComment })` — `mandatoryComment` is Zod `.min(1)`; callable only by `sp_secretary`
  - [ ] `manuallyAdvanceMultiReferralStep` by any non-`sp_secretary` role (including `plat_admin`) throws `FORBIDDEN`
  - [ ] Committees that did not submit remain red-flagged in the Order of Business view even after a `SECRETARY_ADVANCED` override (override does not retroactively clear the red-flag fact)
AI Prompt:
  > You are implementing the multi-referral mutation procedures for the workflow tRPC router.
  >
  > **Procedure definitions (E1 Module 4):**
  >
  > ```typescript
  > // workflow.submitCommitteeReport
  > type: 'mutation'
  > input: z.object({
  >   stepInstanceId: z.string().uuid(),
  >   committeeId: z.string().uuid(),
  >   reportText: z.string().min(1),
  >   reportAttachmentS3Key: z.string().optional()
  > })
  > output: z.object({ allCommitteesSubmitted: z.boolean() })
  > ABAC: step.step_type = 'multi_referral', step.status = 'Active'. For sp_member: subject.committee_ids ∩ step.metadata.assigned_committee_ids ≠ ∅ (committee_ids from JWT-cached claim).
  > Business:
  > - Calls the multi-referral handler's committee-submission flow (TASK-WF-008)
  > - Returns allCommitteesSubmitted = true iff this call completed the set
  > - Step remains 'Active' regardless — only SP Secretary acceptance (a separate action) completes the step
  > Source: confirmed Part 8.3, consolidated reference
  >
  > // workflow.manuallyAdvanceMultiReferralStep
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid(), mandatoryComment: z.string().min(1) })
  > output: z.object({ success: z.literal(true) })
  > ABAC: sp_secretary ONLY — explicit negative per I1 §6.7; no other role, including plat_admin, may call this specific procedure (plat_admin uses the separate bypassStep admin procedure instead, which has different semantics and audit framing)
  > Business:
  > - Forces the committee_referral step to complete despite one or more committees not having submitted
  > - mandatoryComment double-enforced: Zod .min(1) at the router AND validated again in the engine handler (TASK-WF-008)
  > - Emits `workflow.multi_referral.secretary_advanced` (B3/B4 §7.20 — canonical name; `workflow.manually_advanced` is the B2-equivalent alias noted for cross-reference only, not to be used in code) via the SECRETARY_ADVANCED outcome path, consumed by Audit
  > - Absent committees remain red-flagged in Order of Business afterward — override does NOT retroactively clear the red-flag (confirmed Q-A02 decision, consolidated reference Part 8.3)
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'SECRETARY_ADVANCED', mandatoryComment, {})
  > Source: confirmed Part 8.3 Q-A02; B4 §4.3; I1 §6.7
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `submitCommitteeReport` returns `allCommitteesSubmitted: true` exactly when the last committee submits
  > - [ ] `manuallyAdvanceMultiReferralStep` enforces `mandatoryComment` via Zod `.min(1)`
  > - [ ] `manuallyAdvanceMultiReferralStep` by any non-sp_secretary role throws FORBIDDEN
  > - [ ] Red-flagged committees remain red-flagged after override

---

## TASK-WF-021

Phase:          1
Module:         WF
Title:          [AUDIT] Implement workflow tRPC router — Mayor/Panlalawigan/publication lapse procedures
Prerequisites:  [TASK-WF-017, TASK-WF-012, TASK-WF-013]
Deliverables:
  - /apps/server/src/modules/workflow/workflow.router.ts (lapse/publication section) — mutation procedures: `workflow.logMayorLapseConfirmation`, `workflow.logDocketingCompletion`, `workflow.recordPanlalawiganOutcome`, `workflow.resolveValidInPart`, `workflow.confirmPanlalawiganDeemedApproved`, `workflow.recordNewspaperPublicationDate`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `logMayorLapseConfirmation` is idempotent — a second call after lapse is already recorded is a no-op that does not produce a duplicate audit entry
  - [ ] `recordPanlalawiganOutcome` writes panlalawigan fields into `workflow.instances.context`
  - [ ] `resolveValidInPart` requires `mandatoryComment` as Zod `.min(1)` across all four resolution paths; all four are audit-logged
  - [ ] `confirmPanlalawiganDeemedApproved` returns `{ success: true, legalBasis: 'RA7160_S56D' }`
  - [ ] `recordNewspaperPublicationDate` writes `publication_date` and `publication_newspaper` to context; callable only when the document type is `SP_ORDINANCE` or `SP_APPROPRIATION_ORDINANCE`
AI Prompt:
  > You are implementing the Mayor/Panlalawigan/publication lapse procedures for the workflow tRPC router.
  >
  > **Procedure definitions (E1 Module 4):**
  >
  > ```typescript
  > // workflow.logMayorLapseConfirmation
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid() })
  > output: z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S47') })
  > callable by: sp_secretary
  > Business: The 10-day timer fires automatically via node-cron (TASK-WF-012). This procedure is the SP Secretary's manual confirmation/acknowledgment after notification of an already-computed lapse. Implemented idempotently: if step.outcome is already 'LAPSED', treat as a no-op success (no duplicate audit entry, no re-emission of workflow.approval.lapsed).
  >
  > // workflow.logDocketingCompletion
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid() })
  > output: z.object({ success: z.literal(true) })
  > callable by: sp_secretary
  > Business: Marks the Docketing step complete. The document already has its final number assigned at this point in the workflow.
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, 'DONE', null, {})
  >
  > // workflow.recordPanlalawiganOutcome
  > type: 'mutation'
  > input: z.object({
  >   stepInstanceId: z.string().uuid(),
  >   outcome: z.enum(['VALID','VALID_IN_PART','RETURNED','OPERATIVE_IN_ITS_ENTIRETY']),
  >   controlNumber: z.string().optional(),
  >   panlalawiganResolutionNumber: z.string().optional(),
  >   dateReferred: z.coerce.date().optional(),
  >   remarks: z.string().optional()
  > })
  > output: z.object({ success: z.literal(true) })
  > callable by: sp_secretary
  > ABAC: step.label corresponds to 'panlalawigan_review', step.status = 'Active'
  > Business:
  > - outcome = 'RETURNED': flags high-priority, routes to returned_review per transition rules
  > - outcome = 'VALID_IN_PART': places into "Awaiting SP Secretariat Action" pending a subsequent resolveValidInPart call
  > - outcome = 'OPERATIVE_IN_ITS_ENTIRETY': only valid for Appropriation Ordinance instances (guard enforced in approval handler, TASK-WF-007)
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, outcome, remarks ?? null, { controlNumber, panlalawiganResolutionNumber, dateReferred })
  >
  > // workflow.resolveValidInPart
  > type: 'mutation'
  > input: z.object({
  >   documentId: z.string().uuid(),
  >   resolutionPath: z.enum(['resolve_as_is','route_to_legal','route_to_committee','implement_directly']),
  >   mandatoryComment: z.string().min(1)
  > })
  > output: z.object({ success: z.literal(true) })
  > callable by: sp_secretary
  > ABAC: parent document's panlalawigan_review outcome must be 'VALID_IN_PART'
  > Business — 4 paths, ALL audit-logged (confirmed decision, consolidated reference Part 4.3):
  >   resolve_as_is → outcome 'RESOLVED_IN_PLACE' on valid_in_part_decision step; document annotated with mandatoryComment
  >   route_to_legal → outcome 'ROUTED_TO_LEGAL'; routes to legal_office_review
  >   route_to_committee → outcome 'ROUTED_TO_COMMITTEE'; BEFORE submitting, writes context.referred_committee_chair_id = <chair of the originally-referred committee, resolved via Organization Published API>; routes to committee_revisions_review (which reads this context key per the ADR-03-corrected assignee expression)
  >   implement_directly → outcome 'REVISED_DIRECTLY'; Secretariat implements changes directly per mandatoryComment
  > Calls: engine.submitStepAction(stepInstanceId, ctx.session.userId, <mapped outcome>, mandatoryComment, {})
  >   where the step instance is the instance's current valid_in_part_decision step instance
  >
  > // workflow.confirmPanlalawiganDeemedApproved
  > type: 'mutation'
  > input: z.object({ stepInstanceId: z.string().uuid() })
  > output: z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S56D') })
  > callable by: sp_secretary
  > ABAC: step.label = 'panlalawigan_review', step.status = 'Active', the 30-day window must have already elapsed (deemed approval is system-detected; this is confirmation, not initiation)
  > Business: idempotent — no-op if already confirmed
  >
  > // workflow.recordNewspaperPublicationDate
  > type: 'mutation'
  > input: z.object({
  >   documentId: z.string().uuid(),
  >   publicationDate: z.coerce.date(),
  >   newspaperName: z.string().default('Ilocos Times')
  > })
  > output: z.object({ success: z.literal(true) })
  > callable by: sp_secretary
  > ABAC: document.document_type_code IN ('SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE') AND the document carries a penalty-clause flag requiring full publication
  > Business: writes to workflow.instances.context: { publication_date: publicationDate.toISOString().split('T')[0], publication_newspaper: newspaperName }
  > Source: SP Ordinances with a penalty clause require full newspaper publication (Ilocos Times is the paper of record). Publication date is a mandatory tracked field. (Confirmed fact, consolidated reference Part 4.2.)
  > ```
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `logMayorLapseConfirmation` is idempotent (second call is a no-op)
  > - [ ] `recordPanlalawiganOutcome` writes panlalawigan fields to instance context
  > - [ ] `resolveValidInPart` requires `mandatoryComment` via Zod `.min(1)` for all 4 paths
  > - [ ] `confirmPanlalawiganDeemedApproved` returns `legalBasis: 'RA7160_S56D'`
  > - [ ] `recordNewspaperPublicationDate` writes publication fields to context; restricted to Ordinance document types

---

## TASK-WF-022

Phase:          1
Module:         WF
Title:          [AUDIT] Implement workflow tRPC router — admin procedures
Prerequisites:  [TASK-WF-017, TASK-WF-015]
Deliverables:
  - /apps/server/src/modules/workflow/workflow.router.ts (admin section) — mutation procedures: `workflow.migrateInstanceToNewDefinitionVersion`, `workflow.cancelInstance`, `workflow.bypassStep`
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `migrateInstanceToNewDefinitionVersion` callable only by `plat_admin`; returns `{ migrationId, reversibleUntil }`
  - [ ] `migrateInstanceToNewDefinitionVersion` with a missing `mandatoryReason` fails Zod validation (`.min(1)`) before the request reaches the engine
  - [ ] `cancelInstance` callable by `plat_admin` (unconditional) and `records_officer` (own-office scope); `reason` is Zod `.min(1)`
  - [ ] `bypassStep` callable only by `plat_admin`; `bypassReason` and `comment` are both Zod `.min(1)`
  - [ ] All three procedures emit audit events consumed downstream by the audit service — none write to the audit schema directly from the tRPC layer
AI Prompt:
  > You are implementing the admin mutation procedures for the workflow tRPC router. These are restricted to Platform Administrators (with one exception for `cancelInstance`) and are always audit-logged via the underlying engine operations from TASK-WF-015.
  >
  > **Procedure definitions (E1 Module 4 + B4 §3.1):**
  >
  > ```typescript
  > // workflow.migrateInstanceToNewDefinitionVersion
  > type: 'mutation'
  > input: z.object({
  >   instanceId: z.string().uuid(),
  >   newDefinitionVersionId: z.string().uuid(),
  >   mandatoryReason: z.string().min(1),
  >   secondLevelApproverUserId: z.string().uuid()
  > })
  > output: z.object({ migrationId: z.string().uuid(), reversibleUntil: z.coerce.date() })
  > callable by: plat_admin ONLY
  > Business:
  > - Implements Option B in-flight migration (B4 §7.3)
  > - Validates secondLevelApproverUserId corresponds to a valid, unexpired City Administrator approval record for this exact (instanceId, newDefinitionVersionId) pair — the actual lookup/validation happens inside engine.migrateInstance (TASK-WF-015); this procedure does not duplicate that logic, it just passes the input through
  > Calls: engine.migrateInstance(instanceId, newDefinitionVersionId, ctx.session.userId, mandatoryReason)
  > Source: confirmed Part 11.3 "Version pinning — Option B"
  >
  > // workflow.cancelInstance
  > type: 'mutation'
  > input: z.object({ instanceId: z.string().uuid(), reason: z.string().min(1) })
  > output: z.object({ success: z.literal(true) })
  > callable by: plat_admin (unconditional), records_officer (own-office scope only)
  > Calls: engine.cancelInstance(instanceId, ctx.session.userId, reason)
  >
  > // workflow.bypassStep
  > type: 'mutation'
  > input: z.object({
  >   stepInstanceId: z.string().uuid(),
  >   bypassReason: z.string().min(1),
  >   comment: z.string().min(1)
  > })
  > output: z.object({ success: z.literal(true) })
  > callable by: plat_admin ONLY
  > Calls: engine.bypassStep(stepInstanceId, ctx.session.userId, bypassReason, comment)
  > Note: this is the ADMIN bypass surface (bypassed_by = a real plat_admin user). The Certified Urgent bypass (TASK-WF-009) is a separate, automated event-driven path with bypassed_by = null — they are not interchangeable and this procedure must never be used to simulate the Certified Urgent path.
  > ```
  >
  > **Audit:** These three operations emit `workflow.instance.migration.started`/`.completed`, `workflow.instance.cancelled`, and `workflow.step.bypassed` respectively. The audit service subscribes to these events and writes permanent audit entries. The tRPC procedures themselves perform no direct audit-schema writes.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `migrateInstanceToNewDefinitionVersion` callable only by plat_admin
  > - [ ] `migrateInstanceToNewDefinitionVersion` returns `migrationId` and `reversibleUntil`
  > - [ ] `mandatoryReason`/`reason`/`bypassReason`/`comment` all enforced as Zod `.min(1)`
  > - [ ] `cancelInstance` callable by plat_admin and records_officer (scoped); `bypassStep` by plat_admin only
  > - [ ] All three procedures emit audit-consumable events via the engine, not directly

---

## TASK-WF-023

Phase:          1
Module:         WF
Title:          Implement Session and Order of Business tRPC router
Prerequisites:  [TASK-WF-004, TASK-WF-011]
Deliverables:
  - /apps/server/src/modules/workflow/session.router.ts — `sessionRouter` with procedures: `session.logSpSession` (create a session record with attendance), `session.logAttendance` (upsert `session_attendances` for an existing session), `session.getOrderOfBusiness` (read OoB for a session including red-flagged items), `session.generateOrderOfBusiness` (create/refresh OoB for an upcoming session, computing red-flag status from `multi_referral` `step_instances.metadata`)
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `session.logSpSession` requires `quorum_achieved` to be computed server-side from `present_count` against the total active SP membership count (not trusted from client input) and CHECK-constraint-compatible attendance rows (every absent member has an `absence_reason`)
  - [ ] `session.getOrderOfBusiness` returns items in `item_order` sequence with `isRedFlagged` computed from whether every committee in the corresponding `multi_referral` step's `assigned_committees` has a `submissions` entry
  - [ ] `session.generateOrderOfBusiness` only includes documents whose current step's `second_reading_eligible_date` (read from `instance.context`) is on or before the target session date
  - [ ] `session.logSpSession`/`session.logAttendance`/`session.generateOrderOfBusiness` are callable only by `sp_secretary`; `session.getOrderOfBusiness` is readable by all SP-related roles (`sp_secretary, sp_member, sp_presiding_officer, mayor, records_officer`)
AI Prompt:
  > You are implementing the Session and Order of Business tRPC router for the Batac City LGU workflow engine. This is a distinct router from the main `workflow` router because it operates on session/attendance/OoB tables rather than instance/step tables directly, though it reads `step_instances.metadata` for red-flag computation.
  >
  > **Procedures:**
  >
  > ```typescript
  > // session.logSpSession
  > type: 'mutation'
  > input: z.object({
  >   sessionNumber: z.number().int().positive(),
  >   sessionDate: z.coerce.date(),
  >   sessionType: z.enum(['regular','special']),
  >   presidedByEmployeeId: z.string().uuid(),
  >   attendance: z.array(z.object({
  >     employeeId: z.string().uuid(), isPresent: z.boolean(),
  >     absenceReason: z.enum(['ob','sick_leave','vacation_leave','absent']).optional()
  >   })).min(1)
  > })
  > output: z.object({ spSessionId: z.string().uuid(), quorumAchieved: z.boolean(), presentCount: z.number().int() })
  > callable by: sp_secretary ONLY
  > Business:
  > - presentCount = count of attendance entries where isPresent = true
  > - quorumAchieved computed server-side: presentCount >= ceil(totalActiveSpMembers / 2) + 1 (simple majority quorum per RA 7160 — confirm exact quorum formula against Organization module's SP membership roster rather than hardcoding the count of 12, since membership can change)
  > - Validate: every attendance entry where isPresent = false has a non-null absenceReason (mirrors the DB CHECK constraint; fail fast with a clear Zod-level or application-level error rather than relying solely on the DB constraint to reject)
  > - Insert sp_sessions row, then upsert all session_attendances rows in the same transaction
  >
  > // session.logAttendance
  > type: 'mutation'
  > input: z.object({
  >   spSessionId: z.string().uuid(),
  >   attendance: z.array(z.object({
  >     employeeId: z.string().uuid(), isPresent: z.boolean(),
  >     absenceReason: z.enum(['ob','sick_leave','vacation_leave','absent']).optional()
  >   })).min(1)
  > })
  > output: z.object({ success: z.literal(true), quorumAchieved: z.boolean(), presentCount: z.number().int() })
  > callable by: sp_secretary ONLY
  > Business: upserts attendance rows for an EXISTING session (UNIQUE(sp_session_id, employee_id) handles re-submission); recomputes and updates sp_sessions.present_count and quorum_achieved
  >
  > // session.getOrderOfBusiness
  > type: 'query'
  > input: z.object({ spSessionId: z.string().uuid() })
  > output: z.object({
  >   orderOfBusinessId: z.string().uuid(), spSessionId: z.string().uuid(),
  >   generatedAt: z.coerce.date(), cutoffDate: z.coerce.date(),
  >   items: z.array(z.object({
  >     documentId: z.string().uuid(), documentTitle: z.string(), itemOrder: z.number().int(),
  >     itemType: z.enum(['first_reading','second_reading','third_reading','committee_report','other']),
  >     isRedFlagged: z.boolean(),
  >     missingCommitteeNames: z.array(z.string())  // only populated when isRedFlagged = true
  >   }))
  > }).nullable()
  > callable by: sp_secretary, sp_member, sp_presiding_officer, mayor, records_officer
  > Business: for item_type = 'committee_report', join to the multi_referral step_instance's metadata; isRedFlagged = true iff EXISTS a committee in assigned_committees with no entry in submissions
  >
  > // session.generateOrderOfBusiness
  > type: 'mutation'
  > input: z.object({ spSessionId: z.string().uuid(), targetSessionDate: z.coerce.date() })
  > output: z.object({ orderOfBusinessId: z.string().uuid(), itemCount: z.number().int() })
  > callable by: sp_secretary ONLY
  > Business:
  > - Query active workflow instances where the current active step is second_reading_vote (or third_reading_vote for Ordinances) AND instance.context.second_reading_eligible_date <= targetSessionDate
  > - Also includes first_reading items: instances whose current step is first_reading and have not yet been scheduled
  > - Also includes committee_report items: instances at the committee_referral step (for visibility/red-flag display even if not yet eligible)
  > - Upsert order_of_business row (UNIQUE on sp_session_id), then upsert order_of_business_items in item_order sequence
  > - cutoff_date = the most recent Thursday before targetSessionDate
  > ```
  >
  > **ABAC:** Use the same `WorkflowPolicyGuard` pattern from TASK-WF-017, extended with session-specific methods (`canLogSpSession`, `canReadOrderOfBusiness`, `canGenerateOrderOfBusiness`).
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `quorum_achieved` computed server-side against the actual SP membership roster, not hardcoded or client-trusted
  > - [ ] Attendance validation rejects `isPresent: false` entries with no `absenceReason` before hitting the DB constraint
  > - [ ] `getOrderOfBusiness` correctly computes `isRedFlagged` from `multi_referral` step metadata
  > - [ ] `generateOrderOfBusiness` only includes second/third-reading items eligible by `second_reading_eligible_date <= targetSessionDate`
  > - [ ] Mutation procedures restricted to `sp_secretary`; `getOrderOfBusiness` readable by the broader SP-related role set

---

## TASK-WF-024

Phase:          1
Module:         WF
Title:          Wire WF Fastify plugin, event bus consumers, and WF Published API implementation
Prerequisites:  [TASK-WF-018, TASK-WF-019, TASK-WF-020, TASK-WF-021, TASK-WF-022, TASK-WF-023, TASK-WF-009, TASK-WF-011, TASK-WF-012, TASK-WF-013, TASK-WF-014]
Deliverables:
  - /apps/server/src/modules/workflow/workflow.plugin.ts — finalized Fastify plugin: registers `workflowRouter` and `sessionRouter` under the tRPC app router, registers all 4 scheduler jobs (Thursday cutoff, Mayor lapse, Panlalawigan timer, SLA breach monitor) with the appropriate pgboss/node-cron mechanisms, registers `document.certification_urgency.logged` and `document.created` event bus subscriptions (B3 §6.5, §6.1); does **NOT** subscribe to `delegation.granted`/`delegation.expired`/`delegation.revoked` `[OPEN-Q-1 RESOLVED — see Module Summary]`; runs `evaluateSlaBreaches()` once synchronously during plugin startup before the plugin's `ready` resolves
  - /apps/server/src/modules/workflow/workflow.public-api.ts — concrete implementation of `WorkflowPublicAPI` (`getInstanceById`, `getActiveInstanceForDocument`, `getWorkflowSLAData`), registered into the cross-module API registry so other modules (Documents, Notifications, Reporting) can call it without importing the `workflow` schema directly
  - /apps/server/src/index.ts (modification) — registers the WF Fastify plugin in the server bootstrap sequence, positioned AFTER the Documents and Organization plugins (since WF's Published API and event consumers depend on both being registered first)
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm dev` starts the server successfully with the WF plugin registered; `/trpc/workflow.*` and `/trpc/session.*` routes respond
  - [ ] Server startup logs show `evaluateSlaBreaches()` executing once before the server begins accepting HTTP requests
  - [ ] All 4 scheduler jobs are confirmed registered (visible via pgboss's job listing or node-cron's task registry, depending on mechanism) after plugin initialization
  - [ ] `document.certification_urgency.logged` published on the event bus by a test harness triggers the certified-urgent bypass handler (TASK-WF-009) — confirmed via an integration test in this task
  - [ ] No subscription to `delegation.granted`, `delegation.expired`, or `delegation.revoked` exists anywhere in the plugin `[OPEN-Q-1 RESOLVED]`
  - [ ] `WorkflowPublicAPI` is registered such that calling it from a separate module's test (e.g., a Documents module integration test) does not require importing `workflow` schema tables directly
  - [ ] Plugin registration order: Documents and Organization plugins register before WF; verified by inspecting `/apps/server/src/index.ts`
AI Prompt:
  > You are finalizing the WF module's Fastify plugin wiring, event bus consumers, and Published API — the integration layer that connects all previously-built pieces (engine, handlers, schedulers, routers) into a running server.
  >
  > **workflow.plugin.ts responsibilities:**
  > ```typescript
  > const workflowPlugin: FastifyPluginAsync = async (fastify) => {
  >   // 1. Register tRPC routers
  >   fastify.decorate('workflowPublicAPI', createWorkflowPublicAPI(fastify.db));
  >   // merge workflowRouter and sessionRouter into the app's tRPC router — follow the pattern
  >   // established by the Documents module's plugin (TASK-DOCS-019 is the DOCS plugin-wiring task) for how sub-routers
  >   // are merged into the root appRouter; do not duplicate root router construction here
  >
  >   // 2. Subscribe to cross-module events
  >   fastify.eventBus.subscribe('document.certification_urgency.logged', handleCertifiedUrgentBypass);  // B3 §6.5; one event per Certification, batch array payload — see TASK-WF-009
  >
  >   // [OPEN-Q-1 RESOLVED, developer decision 2026-07-02]: DO NOT subscribe to delegation.granted / delegation.expired /
  >   // delegation.revoked. B4 §3.5 is the confirmed-authoritative behavior: the assignee snapshot written to
  >   // step_instances.assigned_to at step activation is immutable for that step's lifetime — a delegation change
  >   // never mutates an already-active step_instance. Assignee resolution (TASK-WF-005) calls the Organization
  >   // Published API LIVE at every step activation, so a newly-activated step already reflects current delegation
  >   // state without WF reacting to these events at all. [Inference, built directly on the confirmed decision above]:
  >   // subscribing would therefore be dead code — it could not legally re-route an active step (would violate the
  >   // snapshot-immutable rule just confirmed) and has nothing useful to do for a future step (which resolves live
  >   // on its own when it activates).
  >   // NOTE: B3 §8 (Master Event Registry, rows 6-8) formally lists `workflow` as a consumer of all three delegation
  >   // events. That listing reflects the live-re-route design described in B3 §5.1's Business Reason and in B2's
  >   // Events Consumed table — the interpretation the developer explicitly did NOT choose for OPEN-Q-1. Do not add
  >   // these subscriptions on the strength of B3's consumer table alone without first revisiting this decision.
  >
  >   // 3. Register scheduler jobs
  >   await registerThursdayCutoffJob(fastify);      // pgboss, weekly
  >   await registerMayorLapseTimerJob(fastify);      // node-cron, hourly
  >   await registerPanlalawiganTimerJob(fastify);    // node-cron, daily 06:00 PHT
  >   await registerSlaBreachMonitorJob(fastify);     // node-cron, every 15 min
  >
  >   // 4. CRITICAL: run evaluateSlaBreaches() ONCE, synchronously, before this plugin's promise resolves
  >   //    This must complete BEFORE Fastify begins accepting HTTP requests (ARTA compliance — see TASK-WF-014)
  >   await evaluateSlaBreaches(fastify.db);
  > };
  > export default fp(workflowPlugin, { name: 'workflow', dependencies: ['documents', 'organization'] });
  > ```
  >
  > **workflow.public-api.ts:**
  > ```typescript
  > function createWorkflowPublicAPI(db: DrizzleDb): WorkflowPublicAPI {
  >   return {
  >     async getInstanceById(instanceId: string): Promise<WorkflowInstanceSummary | null> {
  >       const instance = await workflowRepository.getInstanceById(instanceId);
  >       if (!instance) return null;
  >       const activeStep = await workflowRepository.getActiveStepInstancesForInstance(instanceId);
  >       // map to WorkflowInstanceSummary shape; compute lapseStatus from context.mayor_action / context.panlalawigan_outcome
  >       return mapToSummary(instance, activeStep[0]);
  >     },
  >     async getActiveInstanceForDocument(documentId: string): Promise<WorkflowInstanceSummary | null> { ... },
  >     async getWorkflowSLAData(filter: WorkflowSLAFilter): Promise<WorkflowSLAData[]> {
  >       // delegates to sla.service.ts's elapsedWorkingDays + repository queries, filtered per `filter`
  >     }
  >   };
  > }
  > ```
  > Register this on the Fastify instance (e.g., `fastify.decorate('workflowPublicAPI', ...)`) so other modules access it via `fastify.workflowPublicAPI` rather than importing workflow-internal modules — this is the boundary B2 Module 4 establishes.
  >
  > **Plugin registration order in /apps/server/src/index.ts:**
  > The WF plugin declares `dependencies: ['documents', 'organization']` in its `fp()` options (fastify-plugin's dependency mechanism) since: (a) `engine.createInstance` is typically invoked as a reaction to `document.created` events or direct calls from the Documents module, (b) assignee resolution calls the Organization Published API for delegation lookups, and (c) the termination handler calls `Documents.transitionState()`. Confirm the Documents and Organization plugins already declare themselves with compatible `fp()` names ('documents', 'organization') from their own scaffolding tasks; if names differ, adjust this dependency array to match rather than silently failing fastify-plugin's dependency check at boot.
  >
  > **document.created event consumption:** `createInstance` is not on the Published API surface (it's an engine entry point, not a read method), so the correct integration is: WF subscribes to `document.created` (singular — confirmed B2 Module 3 Events Emitted, B3 §6.1, and docs.md TASK-DOCS-006; do not write the plural `documents.created`) and calls `engine.createInstance(documentId, definitionId)` internally, where `definitionId` is resolved via `getActiveDefinitionForDocumentType(document.documentTypeId)`. Wire this subscription in this task; do not leave instance creation as a manually-triggered-only path. Note: `document.created` fires for all four workflow-capable document types confirmed in B3 OI-13 (`SP_RESOLUTION`, `SP_ORDINANCE`, `SP_APPROPRIATION_ORDINANCE`, `DOCUMENT_REQUEST_FORM`) — for `DOCUMENT_REQUEST_FORM`, `getActiveDefinitionForDocumentType` will find no active/published definition in Phase 1, since TASK-WF-016 does not seed one (`[OPEN-Q-4 RESOLVED — Phase 1B]`), so `createInstance` will throw `NO_ACTIVE_VERSION`. `[Inference — this specific consequence is not stated by any source document; it follows mechanically from NO_ACTIVE_VERSION's existing definition in TASK-WF-005 combined with the Phase 1B deferral decision]`: this is a safe, inert failure mode for a type that has no Phase 1 workflow yet, not a defect — but confirm the event handler logs rather than crash-loops on it, since a permanently-missing definition (as opposed to a transient error) will repeat on every DRF `document.created` event until Phase 1B ships.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm dev` starts successfully with WF plugin registered; tRPC routes respond
  > - [ ] `evaluateSlaBreaches()` runs once before the server accepts HTTP requests (confirmed via startup log ordering)
  > - [ ] All 4 scheduler jobs registered and confirmed active post-startup
  > - [ ] `document.certification_urgency.logged` correctly triggers the bypass handler (integration test included)
  > - [ ] `WorkflowPublicAPI` accessible from other modules without direct `workflow` schema imports
  > - [ ] Plugin dependency ordering (`documents`, `organization` before `workflow`) verified in index.ts
  > - [ ] Document-creation → workflow-instance-creation wiring subscribes to `document.created` (singular, confirmed against B2/B3/docs.md — not assumed)
  > - [ ] No `delegation.granted` / `delegation.expired` / `delegation.revoked` subscription exists anywhere in this file `[OPEN-Q-1 RESOLVED]`

---

## TASK-WF-025

Phase:          1
Module:         WF
Title:          Implement WF Vitest test suite per K2
Prerequisites:  [TASK-WF-024]
Deliverables:
  - /apps/server/src/modules/workflow/__tests__/instance-lifecycle.test.ts — INST-V (valid) and INST-I (invalid) test groups: instance creation, status transitions, B4 invariant #6 (no writes to completed/cancelled instances)
  - /apps/server/src/modules/workflow/__tests__/step-lifecycle.test.ts — STEP-V/STEP-I test groups: step activation, completion, all 7 Phase-1-available step type behaviors, STEP-I16 (parallel step Phase 1 guard)
  - /apps/server/src/modules/workflow/__tests__/transition-resolution.test.ts — RES-V/RES-I test groups: transition evaluation, priority ordering, outcome_filter matching, Stuck-on-no-match, RES-I10/I11/I12/I13 (scheduler-only + override threshold guards)
  - /apps/server/src/modules/workflow/__tests__/multi-referral.test.ts — MREF-01 through MREF-10 (already covered by unit tests in TASK-WF-008; this file adds END-TO-END coverage through the tRPC router layer, including ABAC interaction)
  - /apps/server/src/modules/workflow/__tests__/thursday-cutoff.test.ts — THU-01 through THU-11 end-to-end through the scheduler job entry point with injected timestamps
  - /apps/server/src/modules/workflow/__tests__/certified-urgent.test.ts — CU-02 through CU-10 end-to-end through the event bus
  - /apps/server/src/modules/workflow/__tests__/mayor-lapse.test.ts — MAYOR-01 through MAYOR-11 including the race-condition test using concurrent transaction simulation
  - /apps/server/src/modules/workflow/__tests__/panlalawigan.test.ts — PANLA-01 through PANLA-15 including APP-I02 (OPERATIVE_IN_ITS_ENTIRETY document-type guard)
  - /apps/server/src/modules/workflow/__tests__/version-management.test.ts — VER-03 through VER-14 end-to-end through `migrateInstanceToNewDefinitionVersion`
  - /apps/server/src/modules/workflow/__tests__/publish-validation.test.ts — PUBVAL-01, PUBVAL-02, STEP-I16 (already covered by unit tests in TASK-WF-010; this file adds coverage of the seed definitions from TASK-WF-016 actually passing validation)
  - /apps/server/src/modules/workflow/__tests__/invariants.test.ts — dedicated test file asserting each of B4's 12 numbered invariants individually, with a comment block mapping each test to its invariant number, plus INV11-01a/b (encoder ≠ final approver)
  - /apps/server/src/modules/workflow/__tests__/designations.test.ts — DESIG test group: assignee resolution correctness for all 5 expression prefixes (`role:`, `office_role:`, `delegation_aware:`, `actor_from_context:`, `static:`), including the delegation-aware snapshot-immutability behavior (a delegation created after step activation does not retroactively change an already-active step's assignee)
  - /apps/server/src/modules/workflow/__tests__/fixtures/workflow-test-helpers.ts — shared test fixtures: a minimal valid `WorkflowDefinitionSeed` builder, a transaction-per-test database fixture (matching the pattern from TASK-WF-004's repository tests), fake-timer helpers for the Thursday cutoff and lapse timer tests
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm test apps/server/src/modules/workflow` passes in full with zero skipped tests
  - [ ] Every K2 test ID referenced across TASK-WF-007 through TASK-WF-023's acceptance criteria has a corresponding executable test in this suite — cross-check against the K2 document's full ID list (the per-task acceptance criteria above cover a representative subset; this task's job is to ensure FULL K2 coverage, not just the subset already spot-checked in earlier tasks)
  - [ ] All 12 numbered B4 invariants have at least one dedicated test in `invariants.test.ts` referencing the invariant number in the test description
  - [ ] Race-condition tests (MAYOR, PANLA) use real concurrent transactions against the test database (two separate Drizzle transactions racing), not mocked locking behavior
  - [ ] No test depends on real wall-clock time; all time-sensitive tests use injected/fake timestamps
  - [ ] `pnpm test:coverage` for the workflow module shows coverage for every step handler, every scheduler job, and the definition validator at a level consistent with the project's established coverage bar (check `vitest.config.ts` thresholds; if none are configured for this package yet, do not introduce a new threshold unilaterally — flag this as a question rather than guessing a number)
AI Prompt:
  > You are implementing the comprehensive Vitest test suite for the WF module, following the test design in K2 (`k2-workflow-engine-test-suite-design.md`). Earlier tasks (TASK-WF-006 through TASK-WF-010, TASK-WF-015) already included unit-level tests colocated with their handlers covering a representative subset of K2 test IDs. This task's job is to (a) add end-to-end tests that exercise the full stack from tRPC procedure down through the engine to the database, and (b) close any K2 coverage gaps not already hit by the colocated unit tests.
  >
  > **Test database strategy:** Follow the transaction-per-test pattern established in TASK-WF-004's repository tests: each test runs inside a Drizzle transaction that is rolled back at the end, giving full isolation without needing to truncate tables between tests. Seed a minimal valid workflow definition (via the shared `workflow-test-helpers.ts` builder, NOT the full Phase 1 seed from TASK-WF-016, to keep individual tests fast and focused — except for `publish-validation.test.ts`'s seed-conformance check, which deliberately DOES load the real Phase 1 definitions to confirm they pass validation as shipped).
  >
  > **Race condition test pattern (MAYOR-driven, PANLA-driven):**
  > ```typescript
  > test('scheduler and human actor racing for the same step instance: first commit wins, no double-lapse', async () => {
  >   // Set up an instance with mayor_action_deadline in the past
  >   const stepInstanceId = await setupExpiredMayorReviewStep();
  >
  >   // Fire both paths concurrently against the REAL (non-rolled-back-mid-test) database connection pool,
  >   // not a single shared transaction, since SELECT FOR UPDATE semantics require separate connections to race meaningfully
  >   const [schedulerResult, humanResult] = await Promise.allSettled([
  >     evaluateMayorLapseTimers(testDb),                                  // scheduler path
  >     workflowRouterCaller.mayorSign({ stepInstanceId }),                 // human path racing it
  >   ]);
  >
  >   // Exactly one of these should have succeeded in setting the outcome; the other should be a no-op (scheduler)
  >   // or should observe CONFLICT (human, if scheduler won first)
  >   const finalStep = await getStepInstanceById(stepInstanceId);
  >   expect(['LAPSED', 'SIGNED']).toContain(finalStep.outcome);
  >   // Assert NO duplicate workflow_events rows for this step_instance_id with event_type in ('workflow.approval.lapsed','workflow.step.completed')
  >   const events = await getWorkflowEventsForStepInstance(stepInstanceId);
  >   expect(events.filter(e => ['workflow.approval.lapsed','workflow.step.completed'].includes(e.event_type))).toHaveLength(1);
  > });
  > ```
  > This pattern requires a test database fixture that does NOT wrap the whole test in one transaction (since FOR UPDATE locking across two truly concurrent transactions is the thing under test) — use a dedicated setup/teardown (e.g., truncate the relevant tables after) for these specific race-condition tests rather than the standard transaction-per-test fixture used elsewhere.
  >
  > **Invariants test file structure (invariants.test.ts):**
  > ```typescript
  > describe('B4 Engine Invariants', () => {
  >   describe('Invariant #1: definition_version_id immutable outside migrateInstance', () => { /* ... */ });
  >   describe('Invariant #2: multi_referral REPORT_ACCEPTED requires all committees + secretary acceptance', () => { /* ... */ });
  >   describe('Invariant #3: LAPSED/DEEMED_APPROVED are scheduler-only outcomes', () => { /* ... */ });
  >   describe('Invariant #4: every allowed_outcome has a covering transition rule at publish time', () => { /* ... */ });
  >   describe('Invariant #5: parallel_split/parallel_join unavailable in Phase 1', () => { /* ... */ });
  >   describe('Invariant #6: no writes permitted to Completed/Cancelled instances', () => { /* ... */ });
  >   describe('Invariant #7: SECRETARY_ADVANCED requires non-empty comment', () => { /* ... */ });
  >   describe('Invariant #8: migrateInstance requires unexpired City Administrator approval', () => { /* ... */ });
  >   describe('Invariant #9: <fill in from B4 §9 — the per-task source list above covers #1-8,#10-12 explicitly; confirm #9s exact statement directly from B4 §9 when implementing, since it was not independently re-stated in any single per-task prompt above>', () => { /* ... */ });
  >   describe('Invariant #10: admin operations (cancel, bypass, migrate) require non-empty reason/comment', () => { /* ... */ });
  >   describe('Invariant #11: encoder cannot be the final approver on is_final_approval steps', () => { /* INV11-01a, INV11-01b */ });
  >   describe('Invariant #12: transition rules cannot reference steps from a different definition_version_id', () => { /* ... */ });
  > });
  > ```
  > For invariant #9, re-read B4 §9 directly when writing this file rather than guessing its content — it was not independently summarized in the per-task source excerpts compiled into TASK-WF-001 through TASK-WF-024, so do not invent a plausible-sounding rule for it.
  >
  > **DESIG (assignee resolution) tests — snapshot immutability is the key behavior to verify:**
  > ```typescript
  > test('delegation created after step activation does not change an already-active steps resolved assignee', async () => {
  >   const stepInstanceId = await activateStepWithAssignee('delegation_aware:vice_mayor'); // resolves to vice_mayor's own user_id, no delegation yet
  >   const originalAssignee = (await getStepInstanceById(stepInstanceId)).assigned_to;
  >
  >   await organizationTestHelpers.createDelegation({ fromRole: 'vice_mayor', toUserId: someOtherUserId });
  >
  >   const stepAfterDelegation = await getStepInstanceById(stepInstanceId);
  >   expect(stepAfterDelegation.assigned_to).toEqual(originalAssignee); // UNCHANGED — snapshot is authoritative
  > });
  > ```
  >
  > **Coverage cross-check requirement:** Before finishing this task, enumerate every test ID mentioned in K2 (`k2-workflow-engine-test-suite-design.md`) and confirm each has at least one corresponding `test()`/`it()` block somewhere in the workflow module's test files (colocated unit tests from earlier tasks count). Where a K2 test ID has no corresponding test anywhere, add it to this suite. Do not silently skip IDs that don't fit neatly into the file structure above — add a new `describe` block or file as needed.
  >
  > Before submitting this PR, confirm each item:
  > - [ ] `pnpm typecheck` passes
  > - [ ] `pnpm test apps/server/src/modules/workflow` passes in full, zero skipped
  > - [ ] Every K2 test ID has a corresponding executable test (cross-checked against the full K2 document, not just the subset spot-checked in earlier task acceptance criteria)
  > - [ ] All 12 B4 invariants have a dedicated test referencing the invariant number
  > - [ ] MAYOR/PANLA race-condition tests use real concurrent transactions, not mocked locks
  > - [ ] No test depends on real wall-clock time
  > - [ ] Coverage reporting runs cleanly; no new threshold invented without confirming the project's existing convention

---

## Module Summary

**Task count:** 25 (TASK-WF-001 — TASK-WF-025)
**Wave:** E — depends on TASK-DOCS-001, TASK-DOCS-006, TASK-DOCS-007, TASK-DOCS-009, TASK-DOCS-019
**All 25 tasks are Phase 1** (except TASK-WF-016's `DOCUMENT_REQUEST_FORM` scope note, which documents Phase 1B work explicitly NOT done in this task list).

---

### Document Conflicts Resolved at Generation Time

| # | Conflict | Sources | Resolution Applied |
|---|---|---|---|
| 1 | `workflow_instance_status_enum` values | C1 DDL uses B4 lowercase (`active`, `suspended`); D3 requires PascalCase (`Running`, `Paused`) | **D3 is authoritative** (D3 Appendix B). TASK-WF-001 uses D3 values throughout. |
| 2 | `workflow_step_status_enum` values | C1/B4 uses `bypassed`; D3 requires `Skipped`. B4 lacks `Returned`; D3 adds it as a new terminal state. | **D3 is authoritative**. TASK-WF-001 uses `Skipped` and `Returned`. All step handler tasks use D3 values. |
| 3 | `committee_revisions_review` step assignee | H1 §4 contains invalid placeholder `"instance_aware:committee_chair_of_referred_committee"` (not a valid B4 expression prefix) | **K2 ADR-03 is authoritative**: corrected to `"actor_from_context:referred_committee_chair_id"` in TASK-WF-016. Write path confirmed in TASK-WF-021 (`resolveValidInPart` route_to_committee). |
| 4 | Certified Urgency bypass event name and shape | Three different names appeared across drafting: this task list's own earlier draft used `document.certified_urgent` framed as one-event-per-measure; B4 §6.1 (as excerpted) used the plural `documents.certification_urgency.logged`; B3 §6.5/§0.1 (OI-3, OI-12) ratifies the singular `document.certification_urgency.logged` as **one event per Certification, carrying an array of every associated instance to bypass** | **B3 is authoritative** (see conflict #7 below for why). Corrected in TASK-WF-009 and TASK-WF-024: event name, camelCase payload (`certificationDocumentId`, `associatedInstanceIds`, `loggedBy`, `loggedAt`), and an explicit `for (const instanceId of event.associatedInstanceIds)` loop replacing the earlier per-measure framing. |
| 5 | Delegation event **names** consumed by WF | Early draft used `organization.delegation.created`; B2 Events Consumed and B3 §5.1–5.3 / §8 both confirm `delegation.granted`, `delegation.expired`, `delegation.revoked` | **B2/B3 agree — names were already correct** in this draft (no change to the names). **Separately** — see `OPEN-Q-1` below — whether WF subscribes to these events **at all** was a genuine, unresolved behavioral conflict independent of naming; do not conflate the two. |
| 6 | `WorkflowInstanceSummary.status` on Published API surface | Internal DB enum (D3): `Running/Paused/Stuck/Completed/Cancelled`; B2 Published API: `Active/Completed/Cancelled` (simplified external view), confirmed verbatim at B2 Module 4 line defining `status: 'Active' \| 'Completed' \| 'Cancelled'` | **B2 is authoritative for the Published API surface only**. Mapping: `Running/Paused/Stuck → 'Active'`. TASK-WF-002 and TASK-WF-018 were already correct in this draft. Internal engine code continues to use D3 enum values. |
| 7 | **Which document wins when B2, B3, and B4 disagree on a Workflow event name** | B2 (Module Boundary Contracts) predates B3; B3 (`b3-internal-domain-event-catalog-v1.3.md`) is a dedicated event catalog **not in this task's originally-specified 10-document reading list**, but is directly referenced by B2/B4 cross-checks and is the only document that explicitly adjudicates B2-vs-B4 naming splits | **B3 §0.2 states its own precedence rule explicitly: "This catalog uses B4 names for all Workflow module events."** B3 is therefore the tie-breaker, and in practice it ratifies **B4's dot-separated names** (`workflow.step.completed`, not B2's `workflow.step_completed`) for nearly every Workflow event — B2's names survive only as documented aliases. This reverses what an earlier pass through this same conflict concluded (that B2's underscore convention and its `document.certified_urgent`-adjacent framing were authoritative) — see the full corrected name table below. `[Inference]`: since B3 was not on the originally-specified document list for this Step 2 pass, flag to the developer whether A1-AGENTS.md's Section 9 rule 4 document list for future WF-adjacent passes should be updated to include it explicitly. |
| 8 | `workflow.completed` vs `workflow.instance.completed` in TASK-WF-006's termination handler | Same B2/B4 split as #7, specific instance found during this pass: TASK-WF-006's termination handler emitted `workflow.completed` (B2's name) with a snake_case payload sketch | **B3 §7.2 is authoritative**: `workflow.instance.completed`, payload `{ instanceId, documentId, outcomeCode, finalDocumentStatus }`. Corrected in TASK-WF-006 (both the outcome_code branch and the CANCELLED branch). |
| 9 | Snake_case vs camelCase in illustrative event-payload sketches | B3 §2.2 states plainly: "All Zod schema field names use camelCase per TypeScript convention, regardless of the snake_case used in B4's source pseudocode... no additional [Inference] label is added for the case conversion alone." Eight illustrative payload sketches across TASK-WF-006, TASK-WF-008, and TASK-WF-015 (beyond the TASK-WF-009 case already covered by #4) still used snake_case field names (`instance_id`, `step_instance_id`, `actor_id`, etc.) | **B3 §2.2 is authoritative and unambiguous — mechanical fix, not a judgment call.** All 8 locations converted to camelCase (`instanceId`, `stepInstanceId`, `actorId`, etc.). |

---

### Systematic Event Name Convention

**Corrected authority chain: B3 > B4 = B2 (B3 is the tie-breaker; where it speaks, it ratifies B4's dot-separated names; B2's names survive only as historical aliases).** `[Unverified label carried from B3 itself]`: B3 marks its own emission-mechanics section (§2.4) and several individual event sources as `[Unverified — from B4 excerpt]`, meaning B3's own author could not independently verify completeness of the B4 excerpt it was built from. Treat B3 as authoritative over B2/B4 for naming and shape, per its own stated purpose (§1: "the unified canonical catalog that reconciles both"), while remembering B3 itself carries that caveat.

The table below supersedes the previous ("B2-Authoritative Name") version of this table, which had the direction of authority backwards.

| Event, as used throughout this document's AI Prompts | B3-Ratified Canonical Name | B2-Equivalent Alias (historical only — do not use in code) |
|---|---|---|
| `document.certification_urgency.logged` | `document.certification_urgency.logged` (B3 §6.5) | — (B2 does not list this event at all; B3 OI-12 flags this as a required B2 companion edit, outside this catalog's or this task list's authority to make directly) |
| `workflow.instance.created` | `workflow.instance.created` (B3 §7.1) | not in B2 |
| `workflow.instance.completed` | `workflow.instance.completed` (B3 §7.2) | `workflow.completed` |
| `workflow.instance.cancelled` | `workflow.instance.cancelled` (B3 §7.3) | not in B2 |
| `workflow.instance.stuck` | `workflow.instance.stuck` (B3 §7.4) | not in B2 |
| `workflow.instance.repassed` | `workflow.instance.repassed` (B3 §7.5) | not in B2 |
| `workflow.instance.migration.started/.completed/.reversed` | same (B3 §7.8–7.10) | not in B2 |
| `workflow.step.started` | `workflow.step.started` (B3 §7.11) | `workflow.step_assigned` |
| `workflow.step.completed` | `workflow.step.completed` (B3 §7.12) | `workflow.step_completed` |
| `workflow.step.bypassed` | `workflow.step.bypassed` (B3 §7.13) — **a genuinely distinct event from `step.completed`**, not a completion-with-outcome variant | not in B2 (this was the earlier draft's mistaken framing) |
| `workflow.step.failed` | `workflow.step.failed` (B3 §7.14) | not in B2 |
| `workflow.context.updated` | `workflow.context.updated` (B3 §7.15) | not in B2 |
| `workflow.multi_referral.committee_submitted/.all_submitted/.cutoff_missed/.second_reading_eligible` | same (B3 §7.16–7.19) | not in B2 |
| `workflow.multi_referral.secretary_advanced` | `workflow.multi_referral.secretary_advanced` (B3 §7.20) | `workflow.manually_advanced` |
| `workflow.approval.lapsed` | `workflow.approval.lapsed` (B3 §7.21) | `workflow.lapsed` (unified; B2's version does not distinguish Mayor vs Panlalawigan lapse) |
| `workflow.panlalawigan.deemed_approved` | `workflow.panlalawigan.deemed_approved` (B3 §7.22) | `workflow.lapsed` (same unified alias as above) |
| `workflow.certification_urgency.bypass_applied` | `workflow.certification_urgency.bypass_applied` (B3 §7.23) | `workflow.certified_urgent_applied` |
| `workflow.certification_urgency.bypass_deferred/.already_past_referral/.already_inactive` | same (B3 §7.24–7.26) | not in B2 |
| `workflow.sla.warning/.breached/.critical` | same (B3 §7.27–7.29) | `workflow.escalated` (unified; B2's version does not distinguish severity tiers) |
| `delegation.granted/.expired/.revoked` | same — **consumed, not emitted, by WF; and per `OPEN-Q-1`, not actually subscribed to in TASK-WF-024** despite B3 §8 formally listing `workflow` as a consumer | same names in B2 |

**Rule for implementing agents:** consult this table first. Where this table does not cover an event, consult B3 directly (`b3-internal-domain-event-catalog-v1.3.md`) before B2 or B4 individually — B3 is the reconciling document. `document.certification_urgency.logged`'s absence from B2's own Master Registry (noted in the table above) is a real, standing action item against the B2 document, not against this task list; flag it to whoever owns B2 if it has not been fixed by implementation time.

---

### Confirmed Spec Gaps Carried Forward

| ID | Description | Affected Tasks | Status |
|---|---|---|---|
| H1-X-2 | `requires_publication` context key: no write path existed at `createInstance` | TASK-WF-005, TASK-WF-003, TASK-WF-016 | **Resolved — see `OPEN-Q-2` below.** No longer an open gap; `createInstance` now resolves it via a cross-module query. |
| B4-§7.3-GAP | City Administrator approval record DDL: `migrateInstance` requires an unexpired approval record but no module owned the DDL for this table | TASK-WF-001, TASK-WF-015 | **Resolved — see `OPEN-Q-3` below.** `workflow.admin_approval_grants` now owns this. |
| K2-ADR-08 | ARTA SLA detailed test coverage deliberately excluded from K2 scope | TASK-WF-025 | **Still open / deferred to Phase 1B** — untouched by this session's resolutions. TASK-WF-025 covers the SLA monitor itself; detailed ARTA SLA escalation test scenarios remain deferred per K2 ADR-08. |

---

### Open Questions — Resolved

Four questions were surfaced during cross-validation against B2/B3/B4 and put to the developer. All four were answered on 2026-07-02; resolutions below are reflected throughout the tasks referenced.

| # | Question | Developer's Answer | What Changed |
|---|---|---|---|
| **OPEN-Q-1** | B4 §3.5 ("snapshot is authoritative... subsequent delegation changes do not affect an already-active step" — confirmed verbatim, B4 line 318) directly conflicts with B3 §5.1's Business Reason ("all active workflow steps... must immediately re-route") and B2's Events Consumed table for `delegation.granted`. Which governs? | **B4 §3.5 (snapshot immutable).** | TASK-WF-005: no change needed — it already implemented the snapshot-immutable approach. TASK-WF-024: the `delegation.granted`/`.expired`/`.revoked` subscriptions are **removed entirely**, with an inline note explaining why `[Inference built on the confirmed answer]` — since assignee resolution already queries the Organization Published API live at every step activation, a subscription could neither legally re-route an active step (would violate the snapshot rule just confirmed) nor accomplish anything for a future step (which resolves live on its own). TASK-WF-025's DESIG snapshot-immutability test required no change — it was already testing exactly this behavior and already passes under this answer. |
| **OPEN-Q-2** | H1-X-2's `requires_publication` write path — which of four options (A: event payload override, B: cross-module query, C: `intake_logging` hook, D: accept the Phase 1 gap)? | **Option B — cross-module query via Published API.** | TASK-WF-005's `createInstance` now calls `Documents.getDocumentById(documentId)` and reads a penalty-clause field. `[Unverified]`: B2 Module 3's `DocumentSummary`, as currently specified, does **not** expose this field at all (confirmed against both the B2 interface and TASK-DOCS-006, which implements it "exactly" per B2) — the document-side JSONB key is confirmed as `metadata.has_penalty_provision` (docs.md, C1 DDL, H2 §6 all agree), but a companion extension to `DocumentSummary` is a real prerequisite for this option to work at all, not just an unconfirmed field name. This is flagged inline in TASK-WF-005. TASK-WF-003's context schema comment updated to match. |
| **OPEN-Q-3** | `admin_approval_grants` table — `workflow` schema (Option A) or `iam` schema (Option B)? | **Option A — `workflow` schema.** | TASK-WF-001 gains the `workflow.admin_approval_grants` table (full DDL; `[Inference]`-labeled column list, since no source document gives a literal CREATE TABLE statement — it's derived from the approval-record shape TASK-WF-015 already assumed). Table count corrected 11→15 (the "11" figure undercounted even before this table was added — 14 were already listed). TASK-WF-015's `migrateInstance` precondition now queries this table directly instead of flagging a cross-module gap. |
| **OPEN-Q-4** | `DOCUMENT_REQUEST_FORM` workflow (a real, B3-OI-13/ADR-EVT-001-confirmed 4th workflow-capable document type) — add its seed to TASK-WF-016 (Option A), a new TASK-WF-026 (Option B), or confirm Phase 1B deferral with a scope note (Option C)? | **Option C — Phase 1B, with a scope note on TASK-WF-016.** | TASK-WF-016 gains a scope note: DRF is structurally real (ADR-EVT-001 already closes B3's OI-13/14/15 around it) but its `workflow.definitions` seed is explicitly not authored in this task. The note carries forward ADR-EVT-001's already-decided shape (two sequential `approval` steps — VM then SP Secretary; termination codes `RELEASED_TO_REQUESTER`/`REQUEST_DENIED`) so Phase 1B has a documented starting point instead of a blank page. TASK-WF-024 gains a note that `document.created` for a DRF document will correctly hit `NO_ACTIVE_VERSION` in Phase 1 (`[Inference]` — this specific consequence isn't stated by any source document; it follows mechanically from combining `NO_ACTIVE_VERSION`'s existing definition with the deferral decision) — this is an inert, expected failure mode, not a defect, though a naive retry policy could turn it into noisy repeated log lines until Phase 1B ships. Added to Deferred Capabilities below. |

---

### Deferred Capabilities (Phase 2 / Phase 1B)

| Capability | Deferred To | Reason |
|---|---|---|
| NCH (Notice of Committee Hearing) auto-generation from `multi_referral` step metadata | Phase 2 | Confirmed Phase 2 per a1-skeleton.md changelog; hooks exist in step metadata but NCH document type and generation logic are out of scope |
| `parallel_split` / `parallel_join` step execution | Phase 2 | Types reserved in schema (TASK-WF-001 enum), guarded at runtime (TASK-WF-006) and publish time (TASK-WF-010); execution logic deferred per B4 §5 |
| Barangay Budget workflow definition | Phase 2 | Requires `parallel_split` for multi-committee concurrent review |
| VALID_IN_PART parallel re-review path | Phase 2 | Same `parallel_split` dependency |
| Email / SMS notification channels | Phase 2 | Phase 1 Notifications module delivers in-app only; `channels: ['in_app']` is the correct Phase 1 default |
| Records module retention trigger on `workflow.instance.completed` | Phase 2 | Records module is Phase 2; B3 §8 marks this consumer as Phase 2 |
| Portal public document visibility update on `workflow.instance.completed` | Phase 3 | Portal is Phase 3 |
| `DOCUMENT_REQUEST_FORM` workflow definition (seed data + `workflow.definitions` row) | Phase 1B | `[OPEN-Q-4 RESOLVED — Option C]`. Structurally confirmed real (ADR-EVT-001); shape already decided (two `approval` steps, two new termination codes); not authored in TASK-WF-016. See TASK-WF-016's scope note. |

---

### Task Dependency Graph (abbreviated — full prerequisites in each task header)

```
TASK-DOCS-001 ──► TASK-WF-001
                       │
TASK-WF-001 ──► TASK-WF-002 ──► TASK-WF-003 ──► TASK-WF-004
                                                       │
                              TASK-DOCS-006 ───────────┤
                                                       ▼
                                                  TASK-WF-005
                                                       │
                          ┌────────────────────────────┼────────────┐
                          ▼                            ▼            ▼
                     TASK-WF-006                 TASK-WF-010  TASK-WF-014
                          │
              ┌───────────┼────────────┐
              ▼           ▼            ▼
         TASK-WF-007  TASK-WF-008  TASK-WF-015
                          │
              ┌───────────┼──────────────────┐
              ▼           ▼                  ▼
         TASK-WF-009  TASK-WF-011       TASK-WF-012/013

TASK-WF-001 + TASK-WF-003 + TASK-WF-010 + TASK-DOCS-007 ──► TASK-WF-016

TASK-DOCS-009 + TASK-WF-002 ──► TASK-WF-017
TASK-WF-017 ──► TASK-WF-018 through TASK-WF-022

TASK-WF-004 + TASK-WF-011 ──► TASK-WF-023

TASK-WF-018..023 + TASK-WF-009 + TASK-WF-011..014 ──► TASK-WF-024 ──► TASK-WF-025
```

---

### Cross-Validation Log

The following checks were performed after task generation and before writing this file to disk:

1. **All TASK-DOCS prerequisite IDs resolved:** TASK-DOCS-001, -006, -007, -009, -019 confirmed present in `docs.md`. Reference to non-existent TASK-DOCS-024 in AI Prompt prose corrected to TASK-DOCS-019. No `Prerequisites:` fields reference non-existent IDs.
2. **B2 Module 4 Published API cross-checked:** `WorkflowPublicAPI` interface matches B2 exactly (3 methods, correct signatures). `WorkflowInstanceSummary.status` uses `'Active'/'Completed'/'Cancelled'` per B2 §Published API in both TASK-WF-002 and TASK-WF-018.
3. **B3 (`b3-internal-domain-event-catalog-v1.3.md`) located and read directly, not taken on faith from an earlier pass's summary of it.** An earlier pass through this same reconciliation work concluded `document.certified_urgent` (per-measure) and B2's underscore convention were authoritative. Reading B3 directly overturns that: B3 §0.2 states its own precedence ("uses B4 names for all Workflow module events"), and §6.5 confirms `document.certification_urgency.logged` as one event carrying an array of instance IDs, not one event per measure. All corrected occurrences are listed in Document Conflicts Resolved, row 4/7, above. One specific claim from that same earlier pass — that an `affectedDocumentIds` field existed per "B3 §7.23" — was checked directly against B3 §7.23 and **could not be verified**; the actual §7.23 schema is `{ instanceId, stepInstanceId, certificationDocumentId }` with no such field. That claim was not carried into this file.
4. **Delegation event names cross-checked:** B2 Events Consumed and B3 §5.1–5.3/§8 both confirm `delegation.granted`/`delegation.expired`/`delegation.revoked` as the correct names — this was already correct in this draft. **Separately**, whether WF subscribes to these events at all was resolved by the developer as `OPEN-Q-1` (it does not); see Open Questions — Resolved, above. Do not treat the name-correctness check in this item as also covering the subscription question.
5. **D3 vs C1/B4 enum conflict documented:** Both task-level Acceptance Criteria (TASK-WF-001) and this Module Summary explicitly flag D3 as authoritative. No C1/B4 enum value appears in any AI Prompt enum definition.
6. **K2 ADR-03 correction propagated:** The invalid H1 placeholder `"instance_aware:committee_chair_of_referred_committee"` does not appear in any AI Prompt as an actual value (only as a documented "was:" correction reference). The corrected `"actor_from_context:referred_committee_chair_id"` appears in TASK-WF-016 seed data and is noted in TASK-WF-021 as the prerequisite write path.
7. **Scheduler deadline semantics verified:** `completed_at = deadline` (not `NOW()`) appears in TASK-WF-012 and TASK-WF-013 Acceptance Criteria. `outcome_comment` exact required text for both lapse outcomes is specified verbatim in those tasks.
8. **Structural integrity confirmed:** All 25 task headers are each preceded exactly 2 lines above by a `---` separator (re-verified after this session's edits: 25 headers, 25 matching separators, 25 unique IDs). No orphaned "pending developer answer" language remains anywhere in the file.
9. **TASK-WF-025 K2 coverage obligation stated:** The test suite task explicitly requires implementing agents to enumerate all K2 test IDs and confirm coverage — the per-task acceptance criteria cite a representative subset only; the test task closes the gap.
10. **`admin_approval_grants` DDL cross-checked against its only consumer:** the column list added to TASK-WF-001 (`OPEN-Q-3` resolution) was built directly from the approval-record shape TASK-WF-015 already assumed (`approver_user_id`, `target_version_id`, `instance_id`, `reason`, `expiry_timestamp`, `used`), then TASK-WF-015's query was updated to reference the confirmed table name. `[Inference, single-hop, labeled at point of use]`: no source document supplies a literal CREATE TABLE statement for this table; the DDL is synthesized from that one confirmed usage pattern plus this migration's own established per-table conventions (id/city_id/created_at/soft-delete columns), not chained through any further unconfirmed assumptions.
11. **`DocumentSummary` gap (`OPEN-Q-2`) verified as a real interface gap, not merely an unconfirmed field name:** checked directly against both B2 Module 3's Published API section and TASK-DOCS-006 (which implements `getDocumentById` "exactly" per B2, per that task's own Deliverables line). Neither exposes a metadata or penalty-clause field on `DocumentSummary`. This is stated plainly in TASK-WF-005 rather than downgraded to a vague "confirm the field name" note.
12. **camelCase payload sweep (B3 §2.2):** beyond the `document.certification_urgency.logged` payload already covered in TASK-WF-009, 8 additional illustrative event-payload sketches using snake_case field names were found (TASK-WF-006 ×3, TASK-WF-008 ×1, TASK-WF-015 ×4) and converted. This was a mechanical rename in illustrative sketches only — no algorithm logic, table/column names, or JSONB key names (e.g., `has_penalty_provision`, which stays snake_case because it is a real, already-existing document-side JSONB key, not a WF event field) were altered.
13. **This file's own Table of Contents line numbers were deliberately NOT recalculated**, per the developer's explicit standing instruction from earlier in this same body of work ("I'll do the ToC line numbers myself, so don't do them"). Content within ToC entries was updated where it named something that changed (e.g., TASK-WF-009's event name); `[L#–L#]` ranges were left as-is and are now stale relative to this file's actual line numbers. The developer will recompute these separately.