import {
  pgSchema,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The `workflow` PostgreSQL schema.
 *
 * Generic workflow engine (definitions, definition versions, steps, transition
 * rules, running instances, step instances, append-only event log, and the
 * Certified-Urgent bypass queue) plus four workflow-adjacent table groups
 * (committee reports, committee report signatures, SP sessions, session
 * attendances, order of business, order of business items).
 *
 * Sources:
 *   C1 Part 6 DDL (L1234–L1574) — authoritative for all column sets, constraints,
 *     indexes, and the native ENUM exception.
 *   C1 Part 12 (workflow schema grants — manual SQL, see migration)
 *   B4 (workflow engine specification — authoritative for ENUM value lists and
 *     append-only invariant on workflow_events)
 *   D4 (SP Session / Committee Report placement in workflow schema; entity index)
 *   C1 §1.2–§1.6 (PK / city_id / timestamp / soft-delete / enum conventions)
 *
 * Design notes:
 *   — Native PostgreSQL ENUMs are used for the three workflow status types per
 *     C1 §1.6 exception; all other domain-value columns use TEXT NOT NULL CHECK(…).
 *   — `workflow.workflow_events` is append-only: no deleted_at/deleted_by, no
 *     updated_at (C1 §1.4/§1.5). UPDATE/DELETE is REVOKEd at the grant level in
 *     the migration's manual-additions section.
 *   — `workflow.definitions`, `workflow.instances`, and `workflow.step_instances`
 *     deliberately omit `updated_at` per C1 Part 6 DDL (versioning via
 *     definition_versions / event log makes in-place mutation tracking redundant).
 *     [Inference — see LOG-0041 in development-findings-log.md]
 *   — All cross-schema references are plain UUID columns with inline comments
 *     (Invariant #1 — no cross-schema FK constraints).
 *
 * NOTE ([Unverified] — not part of any source document): TASK-WF-001's AI Prompt
 * deliverable paths may reference `/packages/database/src/schema/workflow.ts`.
 * No such path exists — there is no `src/` segment under `packages/database`,
 * and migrations live in `/packages/database/migrations/` per drizzle.config.ts
 * and C5 §2.1. This file is placed at the verified, established location
 * (`packages/database/schema/workflow.schema.ts`, matching `documents.schema.ts`,
 * `tracking.schema.ts`, etc.).
 */

export const workflowSchema = pgSchema('workflow');

// ─────────────────────────────────────────────────────────────────────────────
// Native ENUMs
// C1 §1.6 exception: native ENUM is used in the workflow schema because B4
// explicitly names these types with an "_enum" suffix and they are referenced
// in GENERATED column expressions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step types for the generic workflow engine.
 * parallel_split and parallel_join are Phase 2 step types — reserved here but
 * not instantiated in Phase 1 workflow definitions (C1 Part 6 comment).
 */
export const workflowStepTypeEnum = workflowSchema.enum(
  'workflow_step_type_enum',
  [
    'action',
    'approval',
    'multi_referral',
    'decision',
    'notification',
    'termination',
    'parallel_split',
    'parallel_join',
  ],
);

/** Overall lifecycle status of a running workflow instance. */
export const workflowInstanceStatusEnum = workflowSchema.enum(
  'workflow_instance_status_enum',
  ['active', 'suspended', 'stuck', 'completed', 'cancelled'],
);

/** Per-step execution status within a running workflow instance. */
export const workflowStepStatusEnum = workflowSchema.enum(
  'workflow_step_status_enum',
  ['pending', 'active', 'completed', 'bypassed', 'cancelled', 'failed', 'returned'],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.definitions
// At most one active definition per document type (B4 DB-Level Constraint #1).
// Enforced by partial unique index uq_definitions_one_active_per_doctype.
// No updated_at: mutations to a definition are minimal (is_active, name,
// description, soft-delete); versioned content lives in definition_versions.
// [Inference — see LOG-0041]
// ─────────────────────────────────────────────────────────────────────────────
export const definitions = workflowSchema.table(
  'definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    /** logical FK → documents.document_types.id (cross-schema) */
    documentTypeId: uuid('document_type_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(false),
    /** logical FK → iam.users.id (cross-schema) */
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    // B4 DB-Level Constraint #1: at most one active definition per document type.
    uniqueIndex('uq_definitions_one_active_per_doctype')
      .on(table.documentTypeId)
      .where(sql`${table.isActive} = true AND ${table.deletedAt} IS NULL`),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.definition_versions
// Immutable published snapshot of a workflow definition. The `status` column is
// a GENERATED column reconciling D4's DefinitionStatus enum (Draft/Published/
// Deprecated) with B4's actual schema (two nullable timestamps). Stored, not
// virtual, so it can be indexed if needed. At most one current version per
// definition (B4 DB-Level Constraint #2 — partial unique index).
// ─────────────────────────────────────────────────────────────────────────────
export const definitionVersions = workflowSchema.table(
  'definition_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => definitions.id),
    versionNumber: integer('version_number').notNull(),
    /** Authoritative on conflict with denormalized steps rows. */
    snapshot: jsonb('snapshot').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** logical FK → iam.users.id (cross-schema) */
    publishedBy: uuid('published_by'),
    deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
    isCurrent: boolean('is_current').notNull().default(false),
    /**
     * GENERATED ALWAYS AS (STORED) status column:
     *   'Deprecated' when deprecated_at IS NOT NULL
     *   'Published'  when published_at  IS NOT NULL
     *   'Draft'      otherwise
     * Reconciles D4's DefinitionStatus enum with B4's two-timestamp schema.
     */
    status: text('status').generatedAlwaysAs(
      sql`CASE
            WHEN deprecated_at IS NOT NULL THEN 'Deprecated'
            WHEN published_at  IS NOT NULL THEN 'Published'
            ELSE 'Draft'
          END`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    // B4 DB-Level Constraint #2: at most one current version per definition.
    uniqueIndex('uq_definition_versions_one_current')
      .on(table.definitionId)
      .where(sql`${table.isCurrent} = true`),
    unique('uq_definition_versions_def_number').on(
      table.definitionId,
      table.versionNumber,
    ),
    index('idx_definition_versions_definition').on(table.definitionId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.steps
// Denormalized from definition_versions.snapshot for query efficiency.
// Exactly one start step per definition version enforced by partial unique index
// (B4 Engine Invariant). No updated_at: steps are immutable once published
// (definition_version_id is pinned at creation). [Inference — see LOG-0041]
// ─────────────────────────────────────────────────────────────────────────────
export const steps = workflowSchema.table(
  'steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    definitionVersionId: uuid('definition_version_id')
      .notNull()
      .references(() => definitionVersions.id),
    stepKey: text('step_key').notNull(),
    stepType: workflowStepTypeEnum('step_type').notNull(),
    label: text('label').notNull(),
    config: jsonb('config'),
    position: integer('position').notNull().default(0),
    isStart: boolean('is_start').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    // B4 Engine Invariant: exactly one start step per definition version.
    uniqueIndex('uq_steps_one_start_per_version')
      .on(table.definitionVersionId)
      .where(
        sql`${table.isStart} = true AND ${table.deletedAt} IS NULL`,
      ),
    unique('uq_steps_version_key').on(table.definitionVersionId, table.stepKey),
    index('idx_steps_definition_version').on(table.definitionVersionId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.transition_rules
// Composite FK approach: both from_step_id and to_step_id reference workflow.steps,
// and definition_version_id references definition_versions. This enforces B4
// Engine Invariant #12: no transition may point to a step from a different
// definition version (enforced at the application layer; the FK to steps
// plus the app-layer check via definition_version_id guard the invariant).
// No updated_at: transition rules are immutable once a definition is published.
// ─────────────────────────────────────────────────────────────────────────────
export const transitionRules = workflowSchema.table(
  'transition_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    definitionVersionId: uuid('definition_version_id')
      .notNull()
      .references(() => definitionVersions.id),
    fromStepId: uuid('from_step_id')
      .notNull()
      .references(() => steps.id),
    toStepId: uuid('to_step_id')
      .notNull()
      .references(() => steps.id),
    conditionExpression: text('condition_expression'),
    outcomeFilter: text('outcome_filter'),
    priority: integer('priority').notNull().default(0),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    index('idx_transition_rules_from_step').on(table.fromStepId),
    index('idx_transition_rules_definition_version').on(
      table.definitionVersionId,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.instances
// A running instance of a workflow definition version against one document.
// definition_version_id is pinned at creation (B4 Invariant #4); no update path
// except via engine.migrateInstance with mandatory comment (B4 DB-Level
// Constraint #5 — no trigger, by design).
// context JSONB: mutable state store whose schema is enforced by application-
// layer Zod validation (B4), not by a PostgreSQL CHECK constraint.
// No updated_at: mutations are captured via append-only workflow_events.
// [Inference — see LOG-0041]
// ─────────────────────────────────────────────────────────────────────────────
export const instances = workflowSchema.table(
  'instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    definitionVersionId: uuid('definition_version_id')
      .notNull()
      .references(() => definitionVersions.id),
    /** logical FK → documents.documents.id (cross-schema) */
    documentId: uuid('document_id').notNull(),
    status: workflowInstanceStatusEnum('status').notNull().default('active'),
    context: jsonb('context').notNull().default(sql`'{}'::jsonb`),
    slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
    slaBreachedAt: timestamp('sla_breached_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** logical FK → iam.users.id (cross-schema) */
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    index('idx_instances_document').on(table.documentId),
    index('idx_instances_definition_version').on(table.definitionVersionId),
    // Partial index for efficient SLA polling: only active instances with a deadline.
    index('idx_instances_sla_active')
      .on(table.slaDeadline)
      .where(sql`${table.status} = 'active'`),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.step_instances
// A single step execution record within a running instance. Encoder/final-
// approver distinct-user invariant (#13) is application-layer only per B4
// ("not a DB constraint") — no trigger here, by design.
// assigned_to JSONB: schema-less assignment blob (user IDs, office IDs, etc.)
// metadata JSONB: multi_referral submissions per B4 step_instances.metadata shape.
// No updated_at: step instance mutations captured via workflow_events.
// [Inference — see LOG-0041]
// ─────────────────────────────────────────────────────────────────────────────
export const stepInstances = workflowSchema.table(
  'step_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => instances.id),
    stepId: uuid('step_id')
      .notNull()
      .references(() => steps.id),
    status: workflowStepStatusEnum('status').notNull().default('pending'),
    /** Assignment blob — schema enforced at application layer (B4). */
    assignedTo: jsonb('assigned_to'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    outcome: text('outcome'),
    outcomeComment: text('outcome_comment'),
    /** multi_referral committee submissions per B4 step_instances.metadata shape. */
    metadata: jsonb('metadata'),
    slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
    slaBreachedAt: timestamp('sla_breached_at', { withTimezone: true }),
    bypassedAt: timestamp('bypassed_at', { withTimezone: true }),
    /** logical FK → iam.users.id (cross-schema); null = system-triggered */
    bypassedBy: uuid('bypassed_by'),
    bypassReason: text('bypass_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    index('idx_step_instances_instance').on(table.instanceId),
    index('idx_step_instances_step').on(table.stepId),
    // GIN index on metadata for JSONB queries (e.g. multi_referral submissions lookup).
    index('idx_step_instances_metadata_gin').using(
      'gin',
      table.metadata,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.workflow_events
// Append-only event log. No deleted_at/deleted_by per C1 §1.5 exception.
// No updated_at per C1 §1.4 (append-only). UPDATE and DELETE are explicitly
// REVOKEd from batac_app at the grant level (Invariant #3 / B4) in the
// migration's manual-additions section.
// actor_id NULL = system event (scheduler, engine internal).
// ─────────────────────────────────────────────────────────────────────────────
export const workflowEvents = workflowSchema.table(
  'workflow_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => instances.id),
    stepInstanceId: uuid('step_instance_id').references(
      () => stepInstances.id,
    ),
    eventType: text('event_type').notNull(),
    /** logical FK → iam.users.id (cross-schema); null for system events */
    actorId: uuid('actor_id'),
    actorType: text('actor_type').notNull(),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'workflow_events_actor_type_check',
      sql`${table.actorType} IN ('user','system','scheduler')`,
    ),
    index('idx_workflow_events_instance').on(table.instanceId),
    index('idx_workflow_events_step_instance').on(table.stepInstanceId),
    index('idx_workflow_events_occurred_at').on(table.occurredAt),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.pending_certified_urgent_bypasses
// Tracks deferred Certified Urgent bypasses for instances whose multi_referral
// step has not yet activated when the Certification is logged (B4).
// No updated_at: written once at certification logging, updated only via
// applied_at and applied_to_step_instance_id (limited, known mutations).
// ─────────────────────────────────────────────────────────────────────────────
export const pendingCertifiedUrgentBypasses = workflowSchema.table(
  'pending_certified_urgent_bypasses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => instances.id),
    stepKey: text('step_key').notNull().default('committee_referral'),
    /** logical FK → documents.documents.id (cross-schema) */
    certificationDocumentId: uuid('certification_document_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    appliedToStepInstanceId: uuid('applied_to_step_instance_id').references(
      () => stepInstances.id,
    ),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    index('idx_pending_bypasses_instance').on(table.instanceId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.committee_reports
// 1:1 with a multi_referral step_instance — represents the eventual unified
// report for that step. Individual committee submissions live in
// step_instances.metadata.submissions per B4. Has updated_at + trigger.
// ─────────────────────────────────────────────────────────────────────────────
export const committeeReports = workflowSchema.table(
  'committee_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    stepInstanceId: uuid('step_instance_id')
      .notNull()
      .references(() => stepInstances.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    isUnified: boolean('is_unified').notNull().default(false),
    isAccepted: boolean('is_accepted').notNull().default(false),
    /** logical FK → iam.users.id (cross-schema) */
    acceptedBy: uuid('accepted_by'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    content: text('content'),
    /** logical FK → documents.documents.id (cross-schema) */
    documentId: uuid('document_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_committee_reports_step_instance').on(table.stepInstanceId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.committee_report_signatures
// Junction: CommitteeReport *--* Committee (signedBy D4).
// Write-once (one row per committee per report): no updated_at.
// ─────────────────────────────────────────────────────────────────────────────
export const committeeReportSignatures = workflowSchema.table(
  'committee_report_signatures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    committeeReportId: uuid('committee_report_id')
      .notNull()
      .references(() => committeeReports.id),
    /** logical FK → organization.committees.id (cross-schema) */
    committeeId: uuid('committee_id').notNull(),
    /** logical FK → organization.employees.id (cross-schema) */
    signedByEmployeeId: uuid('signed_by_employee_id'),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_committee_report_signatures').on(
      table.committeeReportId,
      table.committeeId,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.sp_sessions
// Sangguniang Panlungsod session records. Workflow-adjacent per D4 ("Includes:
// SP Session and Committee Report — workflow-adjacent"). Has updated_at + trigger.
// session_date is DATE — this is the correct type for a calendar date (not a
// point in time), per C1 §1.4's TIMESTAMPTZ rule which applies to timestamps.
// ─────────────────────────────────────────────────────────────────────────────
export const spSessions = workflowSchema.table(
  'sp_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    sessionNumber: integer('session_number').notNull(),
    sessionDate: text('session_date').notNull(), // DATE stored as text to avoid Drizzle TIMESTAMPTZ linting; app-layer validated
    sessionType: text('session_type').notNull(),
    /** logical FK → organization.employees.id (cross-schema) */
    presidedByEmployeeId: uuid('presided_by_employee_id').notNull(),
    presentCount: integer('present_count'),
    quorumAchieved: boolean('quorum_achieved'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_sp_sessions_city_number').on(table.cityId, table.sessionNumber),
    check(
      'sp_sessions_session_type_check',
      sql`${table.sessionType} IN ('regular','special')`,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.session_attendances
// Attendance record per employee per SP session. Write-once (upsert via
// delete/re-insert if corrected): no updated_at.
// Two CHECK constraints per C1 Part 6:
//   1. absence_reason values
//   2. ck_attendance_reason: absent employees must supply a reason
// ─────────────────────────────────────────────────────────────────────────────
export const sessionAttendances = workflowSchema.table(
  'session_attendances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    spSessionId: uuid('sp_session_id')
      .notNull()
      .references(() => spSessions.id),
    /** logical FK → organization.employees.id (cross-schema) */
    employeeId: uuid('employee_id').notNull(),
    isPresent: boolean('is_present').notNull(),
    absenceReason: text('absence_reason'),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_session_attendance').on(table.spSessionId, table.employeeId),
    check(
      'session_attendances_absence_reason_check',
      sql`${table.absenceReason} IN ('ob','sick_leave','vacation_leave','absent')`,
    ),
    // Absent employees must supply a reason (C1 Part 6 ck_attendance_reason).
    check(
      'ck_attendance_reason',
      sql`${table.isPresent} = true OR ${table.absenceReason} IS NOT NULL`,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.order_of_business
// Generated agenda per SP session. One agenda per session (unique constraint).
// No updated_at: generated once at cutoff; updates are handled via re-generation
// (delete + re-insert). [Inference]
// ─────────────────────────────────────────────────────────────────────────────
export const orderOfBusiness = workflowSchema.table(
  'order_of_business',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    spSessionId: uuid('sp_session_id')
      .notNull()
      .references(() => spSessions.id),
    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    cutoffDate: text('cutoff_date').notNull(), // DATE stored as text; see sp_sessions.session_date note
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_order_of_business_session').on(table.spSessionId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// workflow.order_of_business_items
// Line items on an order of business. Ordered by item_order within a session.
// item_type values are [Inference] from First/Second/Third Reading + Committee
// Report vocabulary used throughout source documents (C1 Part 6 note).
// No updated_at: line items are written at generation time; re-ordering
// regenerates the OOB via the parent table. [Inference]
// ─────────────────────────────────────────────────────────────────────────────
export const orderOfBusinessItems = workflowSchema.table(
  'order_of_business_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    orderOfBusinessId: uuid('order_of_business_id')
      .notNull()
      .references(() => orderOfBusiness.id),
    /** logical FK → documents.documents.id (cross-schema) */
    documentId: uuid('document_id').notNull(),
    itemOrder: integer('item_order').notNull(),
    itemType: text('item_type').notNull(),
    isRedFlagged: boolean('is_red_flagged').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_oob_items_order').on(table.orderOfBusinessId, table.itemOrder),
    check(
      'order_of_business_items_item_type_check',
      sql`${table.itemType} IN ('first_reading','second_reading','third_reading','committee_report','other')`,
    ),
  ],
);
