CREATE SCHEMA "workflow";
--> statement-breakpoint
CREATE TYPE "workflow"."workflow_instance_status_enum" AS ENUM('active', 'suspended', 'stuck', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "workflow"."workflow_step_status_enum" AS ENUM('pending', 'active', 'completed', 'bypassed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "workflow"."workflow_step_type_enum" AS ENUM('action', 'approval', 'multi_referral', 'decision', 'notification', 'termination', 'parallel_split', 'parallel_join');--> statement-breakpoint
CREATE TABLE "workflow"."committee_report_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"committee_report_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"signed_by_employee_id" uuid,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_committee_report_signatures" UNIQUE("committee_report_id","committee_id")
);
--> statement-breakpoint
CREATE TABLE "workflow"."committee_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"step_instance_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"is_unified" boolean DEFAULT false NOT NULL,
	"is_accepted" boolean DEFAULT false NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"content" text,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_committee_reports_step_instance" UNIQUE("step_instance_id")
);
--> statement-breakpoint
CREATE TABLE "workflow"."definition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"deprecated_at" timestamp with time zone,
	"is_current" boolean DEFAULT false NOT NULL,
	"status" text GENERATED ALWAYS AS (CASE
            WHEN deprecated_at IS NOT NULL THEN 'Deprecated'
            WHEN published_at  IS NOT NULL THEN 'Published'
            ELSE 'Draft'
          END) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_definition_versions_def_number" UNIQUE("definition_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "workflow"."definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "workflow"."instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"definition_version_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "workflow"."workflow_instance_status_enum" DEFAULT 'active' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sla_deadline" timestamp with time zone,
	"sla_breached_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "workflow"."order_of_business" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"sp_session_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cutoff_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_order_of_business_session" UNIQUE("sp_session_id")
);
--> statement-breakpoint
CREATE TABLE "workflow"."order_of_business_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"order_of_business_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"item_order" integer NOT NULL,
	"item_type" text NOT NULL,
	"is_red_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_oob_items_order" UNIQUE("order_of_business_id","item_order"),
	CONSTRAINT "order_of_business_items_item_type_check" CHECK ("workflow"."order_of_business_items"."item_type" IN ('first_reading','second_reading','third_reading','committee_report','other'))
);
--> statement-breakpoint
CREATE TABLE "workflow"."pending_certified_urgent_bypasses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"step_key" text DEFAULT 'committee_referral' NOT NULL,
	"certification_document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	"applied_to_step_instance_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "workflow"."session_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"sp_session_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"is_present" boolean NOT NULL,
	"absence_reason" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_session_attendance" UNIQUE("sp_session_id","employee_id"),
	CONSTRAINT "session_attendances_absence_reason_check" CHECK ("workflow"."session_attendances"."absence_reason" IN ('ob','sick_leave','vacation_leave','absent')),
	CONSTRAINT "ck_attendance_reason" CHECK ("workflow"."session_attendances"."is_present" = true OR "workflow"."session_attendances"."absence_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "workflow"."sp_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"session_number" integer NOT NULL,
	"session_date" text NOT NULL,
	"session_type" text NOT NULL,
	"presided_by_employee_id" uuid NOT NULL,
	"present_count" integer,
	"quorum_achieved" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_sp_sessions_city_number" UNIQUE("city_id","session_number"),
	CONSTRAINT "sp_sessions_session_type_check" CHECK ("workflow"."sp_sessions"."session_type" IN ('regular','special'))
);
--> statement-breakpoint
CREATE TABLE "workflow"."step_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"status" "workflow"."workflow_step_status_enum" DEFAULT 'pending' NOT NULL,
	"assigned_to" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"outcome" text,
	"outcome_comment" text,
	"metadata" jsonb,
	"sla_deadline" timestamp with time zone,
	"sla_breached_at" timestamp with time zone,
	"bypassed_at" timestamp with time zone,
	"bypassed_by" uuid,
	"bypass_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "workflow"."steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"definition_version_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"step_type" "workflow"."workflow_step_type_enum" NOT NULL,
	"label" text NOT NULL,
	"config" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"is_start" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_steps_version_key" UNIQUE("definition_version_id","step_key")
);
--> statement-breakpoint
CREATE TABLE "workflow"."transition_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"definition_version_id" uuid NOT NULL,
	"from_step_id" uuid NOT NULL,
	"to_step_id" uuid NOT NULL,
	"condition_expression" text,
	"outcome_filter" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"step_instance_id" uuid,
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_events_actor_type_check" CHECK ("workflow"."workflow_events"."actor_type" IN ('user','system','scheduler'))
);
--> statement-breakpoint
ALTER TABLE "workflow"."committee_report_signatures" ADD CONSTRAINT "committee_report_signatures_committee_report_id_committee_reports_id_fk" FOREIGN KEY ("committee_report_id") REFERENCES "workflow"."committee_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."committee_reports" ADD CONSTRAINT "committee_reports_step_instance_id_step_instances_id_fk" FOREIGN KEY ("step_instance_id") REFERENCES "workflow"."step_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."definition_versions" ADD CONSTRAINT "definition_versions_definition_id_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "workflow"."definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."instances" ADD CONSTRAINT "instances_definition_version_id_definition_versions_id_fk" FOREIGN KEY ("definition_version_id") REFERENCES "workflow"."definition_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."order_of_business" ADD CONSTRAINT "order_of_business_sp_session_id_sp_sessions_id_fk" FOREIGN KEY ("sp_session_id") REFERENCES "workflow"."sp_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."order_of_business_items" ADD CONSTRAINT "order_of_business_items_order_of_business_id_order_of_business_id_fk" FOREIGN KEY ("order_of_business_id") REFERENCES "workflow"."order_of_business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."pending_certified_urgent_bypasses" ADD CONSTRAINT "pending_certified_urgent_bypasses_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "workflow"."instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."pending_certified_urgent_bypasses" ADD CONSTRAINT "pending_certified_urgent_bypasses_applied_to_step_instance_id_step_instances_id_fk" FOREIGN KEY ("applied_to_step_instance_id") REFERENCES "workflow"."step_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."session_attendances" ADD CONSTRAINT "session_attendances_sp_session_id_sp_sessions_id_fk" FOREIGN KEY ("sp_session_id") REFERENCES "workflow"."sp_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."step_instances" ADD CONSTRAINT "step_instances_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "workflow"."instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."step_instances" ADD CONSTRAINT "step_instances_step_id_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "workflow"."steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."steps" ADD CONSTRAINT "steps_definition_version_id_definition_versions_id_fk" FOREIGN KEY ("definition_version_id") REFERENCES "workflow"."definition_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."transition_rules" ADD CONSTRAINT "transition_rules_definition_version_id_definition_versions_id_fk" FOREIGN KEY ("definition_version_id") REFERENCES "workflow"."definition_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."transition_rules" ADD CONSTRAINT "transition_rules_from_step_id_steps_id_fk" FOREIGN KEY ("from_step_id") REFERENCES "workflow"."steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."transition_rules" ADD CONSTRAINT "transition_rules_to_step_id_steps_id_fk" FOREIGN KEY ("to_step_id") REFERENCES "workflow"."steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."workflow_events" ADD CONSTRAINT "workflow_events_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "workflow"."instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."workflow_events" ADD CONSTRAINT "workflow_events_step_instance_id_step_instances_id_fk" FOREIGN KEY ("step_instance_id") REFERENCES "workflow"."step_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_definition_versions_one_current" ON "workflow"."definition_versions" USING btree ("definition_id") WHERE "workflow"."definition_versions"."is_current" = true;--> statement-breakpoint
CREATE INDEX "idx_definition_versions_definition" ON "workflow"."definition_versions" USING btree ("definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_definitions_one_active_per_doctype" ON "workflow"."definitions" USING btree ("document_type_id") WHERE "workflow"."definitions"."is_active" = true AND "workflow"."definitions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_instances_document" ON "workflow"."instances" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_instances_definition_version" ON "workflow"."instances" USING btree ("definition_version_id");--> statement-breakpoint
CREATE INDEX "idx_instances_sla_active" ON "workflow"."instances" USING btree ("sla_deadline") WHERE "workflow"."instances"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_pending_bypasses_instance" ON "workflow"."pending_certified_urgent_bypasses" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_step_instances_instance" ON "workflow"."step_instances" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_step_instances_step" ON "workflow"."step_instances" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "idx_step_instances_metadata_gin" ON "workflow"."step_instances" USING gin ("metadata");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_steps_one_start_per_version" ON "workflow"."steps" USING btree ("definition_version_id") WHERE "workflow"."steps"."is_start" = true AND "workflow"."steps"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_steps_definition_version" ON "workflow"."steps" USING btree ("definition_version_id");--> statement-breakpoint
CREATE INDEX "idx_transition_rules_from_step" ON "workflow"."transition_rules" USING btree ("from_step_id");--> statement-breakpoint
CREATE INDEX "idx_transition_rules_definition_version" ON "workflow"."transition_rules" USING btree ("definition_version_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_events_instance" ON "workflow"."workflow_events" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_events_step_instance" ON "workflow"."workflow_events" USING btree ("step_instance_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_events_occurred_at" ON "workflow"."workflow_events" USING btree ("occurred_at");
--> statement-breakpoint
-- === Manual additions: workflow schema triggers, append-only REVOKE, and grants
-- (C1 Part 6 + Part 12). Manually authored section; all generated SQL is above.
-- Affected schemas: workflow only.
--
-- Tables with updated_at + trigger (C1 §1.4 / Part 6):
--   workflow.committee_reports, workflow.sp_sessions
-- Tables intentionally without updated_at (write-once or versioned-via-events):
--   workflow.definitions, workflow.definition_versions (versioned), workflow.steps,
--   workflow.transition_rules, workflow.instances (events log), workflow.step_instances,
--   workflow.workflow_events (append-only), workflow.pending_certified_urgent_bypasses,
--   workflow.committee_report_signatures, workflow.session_attendances,
--   workflow.order_of_business, workflow.order_of_business_items
-- [Inference — LOG-0041: updated_at omissions on definitions/instances/step_instances
-- follow the C1 Part 6 DDL literally; these tables are mutated via definition_versions
-- or the append-only workflow_events log, making in-place updated_at tracking redundant.]

-- fn_set_updated_at() is defined in the core migration (Part 2) and is available
-- in all schemas. No redefinition needed here.
CREATE TRIGGER trg_committee_reports_set_updated_at
    BEFORE UPDATE ON workflow.committee_reports
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_sp_sessions_set_updated_at
    BEFORE UPDATE ON workflow.sp_sessions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint

-- workflow.workflow_events is append-only (B4 / C1 Part 12).
-- Explicitly revoke UPDATE and DELETE from batac_app, mirroring the
-- tracking.routing_entries precedent established in migration 0005.
-- NOTE: post-migrate-grants.sql (TASK-INFRA-006) handles the generic per-schema
-- GRANT loop; this REVOKE must also appear in post-migrate-grants.sql so that
-- the generic loop does not re-grant UPDATE to batac_app on every db:migrate run.
-- (Same reasoning as LOG-0026 for tracking.routing_entries.)
REVOKE UPDATE, DELETE ON workflow.workflow_events FROM batac_app;
--> statement-breakpoint

-- Grant statements (C1 Part 12 — workflow-schema lines only; iam/organization/
-- documents/tracking were already granted by their own migrations). Included here
-- for consistency with the 0004 (documents) and 0005 (tracking) precedents and to
-- keep this migration a complete, self-contained record per C1 Part 12.
-- post-migrate-grants.sql (TASK-INFRA-006) also covers workflow generically and
-- idempotently on every db:migrate run; these inline grants are redundant but
-- non-harmful and provide a clear, searchable audit trail.
GRANT USAGE ON SCHEMA workflow TO batac_app, batac_readonly;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA workflow TO batac_app;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA workflow TO batac_readonly;