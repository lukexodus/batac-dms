CREATE SCHEMA "tracking";
--> statement-breakpoint
CREATE TABLE "tracking"."qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"tracking_id" uuid NOT NULL,
	"tracking_number" text NOT NULL,
	"qr_image_file_key" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_qr_codes_tracking_id" UNIQUE("tracking_id"),
	CONSTRAINT "uq_qr_codes_document" UNIQUE("document_id"),
	CONSTRAINT "uq_qr_codes_tracking_number" UNIQUE("tracking_number")
);
--> statement-breakpoint
CREATE TABLE "tracking"."routing_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"tracking_record_id" uuid NOT NULL,
	"from_office_id" uuid,
	"to_office_id" uuid,
	"actor_id" uuid,
	"action_description" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tracking"."tracking_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"qr_code_id" uuid NOT NULL,
	"current_status" text,
	"current_custodian_office_id" uuid,
	"physical_location" text,
	"last_moved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_tracking_records_document" UNIQUE("document_id")
);
--> statement-breakpoint
ALTER TABLE "tracking"."routing_entries" ADD CONSTRAINT "routing_entries_tracking_record_id_tracking_records_id_fk" FOREIGN KEY ("tracking_record_id") REFERENCES "tracking"."tracking_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking"."tracking_records" ADD CONSTRAINT "tracking_records_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "tracking"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_routing_entries_tracking_record" ON "tracking"."routing_entries" USING btree ("tracking_record_id");--> statement-breakpoint
CREATE INDEX "idx_routing_entries_occurred_at" ON "tracking"."routing_entries" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tracking_records_qr_code" ON "tracking"."tracking_records" USING btree ("qr_code_id");
--> statement-breakpoint
-- === Manual additions: DTS-{YEAR}-{SEQUENCE} tracking-number helper function,
-- 2026 sequence pre-creation, and grants (C1 Part 7 footer + Part 11 + Part 12) ===
-- [RESOLVED — SPEC-GAP-TRACK-01, 2026-06-30]
-- No updated_at triggers in this section: no tracking.* table has an
-- updated_at column (C1 §1.4 — qr_codes/tracking_records omit it by DDL
-- choice; routing_entries is append-only). public.fn_set_updated_at() is
-- therefore never referenced by this migration.

-- Per-year auto-creating sequence for the DTS-{YEAR}-{SEQUENCE} tracking
-- number. Mirrors documents.fn_get_next_sequence_value()'s on-demand-creation
-- pattern (C1 §1.9) so the {SEQUENCE} component resets to 1 each calendar
-- year, consistent with how document final numbers reset annually. Tracking
-- has only one numbering stream (unlike documents.number_series, which
-- dispatches by series_key across eleven series), so no series_key parameter
-- is needed here.
-- SECURITY DEFINER owned by batac_migrate (the DDL-owning role, per C5
-- Addendum) so that batac_app (runtime) can CREATE SEQUENCE without DDL
-- privileges.
CREATE OR REPLACE FUNCTION tracking.fn_get_next_tracking_number(
    p_year INTEGER
)
RETURNS TABLE (sequence_value BIGINT, was_created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    v_seq_name TEXT;
    v_next     BIGINT;
    v_created  BOOLEAN := false;
BEGIN
    v_seq_name := 'tracking.dts_' || p_year::text || '_seq';

    BEGIN
        EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
    EXCEPTION WHEN undefined_table THEN
        -- On-demand year creation is a safety net, not the expected path —
        -- pre-creation via migration (see tracking.dts_2026_seq below) is
        -- expected to make this branch unreachable in normal operation
        -- (C1 Part 11). was_created = true signals the application to emit
        -- a structured log warning (C1 §1.9) — not an audit event or domain
        -- event, since this is an operational/ops concern, not a business one.
        EXECUTE format(
            'CREATE SEQUENCE IF NOT EXISTS %s AS INTEGER INCREMENT 1 START 1',
            v_seq_name
        );
        EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
        v_created := true;
    END;

    RETURN QUERY SELECT v_next, v_created;
END;
$fn$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION tracking.fn_get_next_tracking_number(INTEGER) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION tracking.fn_get_next_tracking_number(INTEGER) TO batac_app;
--> statement-breakpoint
ALTER FUNCTION tracking.fn_get_next_tracking_number(INTEGER) OWNER TO batac_migrate;
--> statement-breakpoint

-- Pre-create the current year's sequence (C1 Part 11 pattern) — the function
-- above is the on-demand safety net, not the expected creation path.
CREATE SEQUENCE IF NOT EXISTS tracking.dts_2026_seq AS INTEGER INCREMENT 1 START 1;
--> statement-breakpoint

-- Grant statements (C1 Part 12 — tracking-schema lines only; iam/organization/
-- documents etc. were already granted by their own migrations). NOTE:
-- post-migrate-grants.sql (TASK-INFRA-006) already grants
-- batac_app/batac_readonly on the 'tracking' schema generically and
-- idempotently on every db:migrate run, and also carries the
-- routing_entries append-only REVOKE (added alongside this migration —
-- see LOG-0026). These inline grants are included for consistency with the
-- 0004 (documents) precedent and to keep this migration file a complete,
-- self-contained record per C1 Part 12. batac_it_admin intentionally
-- receives no USAGE grant on the tracking schema (not listed in C1 Part 12
-- IT admin grants).
GRANT USAGE ON SCHEMA tracking TO batac_app, batac_readonly;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tracking TO batac_app;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA tracking TO batac_readonly;
--> statement-breakpoint
GRANT USAGE ON ALL SEQUENCES IN SCHEMA tracking TO batac_app;
--> statement-breakpoint
-- tracking.routing_entries is append-only (C1 §1.4 / C1 Part 7 DDL comment):
-- explicitly revoke UPDATE/DELETE, mirroring the workflow.workflow_events
-- precedent in post-migrate-grants.sql. See LOG-0026 for why this statement
-- is also required in post-migrate-grants.sql (that script's generic
-- per-schema loop would otherwise re-grant UPDATE back to batac_app on every
-- db:migrate run, immediately undoing this line).
REVOKE UPDATE, DELETE ON tracking.routing_entries FROM batac_app;