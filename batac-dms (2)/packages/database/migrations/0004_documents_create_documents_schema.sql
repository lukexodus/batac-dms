CREATE SCHEMA "documents";
--> statement-breakpoint
CREATE TABLE "documents"."attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"attachment_type" text NOT NULL,
	"file_key" uuid,
	"source_document_id" uuid,
	"mime_type" text,
	"file_size_bytes" bigint,
	"description" text,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "attachments_attachment_type_check" CHECK ("documents"."attachments"."attachment_type" IN ('certification_of_urgency','committee_report','transmittal_letter','scan','other')),
	CONSTRAINT "ck_attachments_file_or_source" CHECK ("documents"."attachments"."file_key" IS NOT NULL OR "documents"."attachments"."source_document_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "documents"."classification_allowlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"role_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_classification_allowlists_type_role" UNIQUE("document_type_id","role_code","city_id")
);
--> statement-breakpoint
CREATE TABLE "documents"."document_sponsorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"sponsor_employee_id" uuid NOT NULL,
	"sponsorship_type" text NOT NULL,
	"order_of_priority" integer DEFAULT 1 NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_sponsorships" UNIQUE("document_id","sponsor_employee_id","sponsorship_type"),
	CONSTRAINT "document_sponsorships_sponsorship_type_check" CHECK ("documents"."document_sponsorships"."sponsorship_type" IN ('principal_author','co_author','introducer','co_introducer'))
);
--> statement-breakpoint
CREATE TABLE "documents"."document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"owning_module" text NOT NULL,
	"number_series_id" uuid,
	"has_preliminary_numbering" boolean DEFAULT false NOT NULL,
	"control_number_deferred" boolean DEFAULT false NOT NULL,
	"requires_publication" boolean DEFAULT false NOT NULL,
	"retention_schedule_id" uuid,
	"classification_default" text NOT NULL,
	"public_visibility_rule" text NOT NULL,
	"required_step_types" text[],
	"metadata_schema" jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_document_types_city_code" UNIQUE("city_id","code"),
	CONSTRAINT "document_types_owning_module_check" CHECK ("documents"."document_types"."owning_module" IN ('workflow','organization','portal')),
	CONSTRAINT "document_types_classification_default_check" CHECK ("documents"."document_types"."classification_default" IN ('public','internal','confidential','restricted')),
	CONSTRAINT "document_types_public_visibility_rule_check" CHECK ("documents"."document_types"."public_visibility_rule" IN ('title_and_first_page_public','not_public','complainant_restricted','requester_restricted')),
	CONSTRAINT "ck_document_types_retention_before_activation" CHECK ("documents"."document_types"."is_active" = false OR "documents"."document_types"."retention_schedule_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "documents"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"title" text NOT NULL,
	"lifecycle_state" text DEFAULT 'draft' NOT NULL,
	"classification_level" text NOT NULL,
	"qr_tracking_number" uuid NOT NULL,
	"preliminary_number" text,
	"final_number" text,
	"control_number" text,
	"number_series_id" uuid,
	"originating_office_id" uuid NOT NULL,
	"owned_by_office_id" uuid NOT NULL,
	"drafted_by_employee_id" uuid,
	"created_by" uuid NOT NULL,
	"workflow_instance_id" uuid,
	"retention_schedule_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tsv" "tsvector",
	"superseded_by" uuid,
	"superseded_at" timestamp with time zone,
	"closure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_documents_qr_tracking_number" UNIQUE("qr_tracking_number"),
	CONSTRAINT "documents_lifecycle_state_check" CHECK ("documents"."documents"."lifecycle_state" IN ('draft','submitted','in_workflow','pending_mayor_action','pending_panlalawigan_review','completed','released','archived','disposed','cancelled','superseded')),
	CONSTRAINT "documents_classification_level_check" CHECK ("documents"."documents"."classification_level" IN ('public','internal','confidential','restricted'))
);
--> statement-breakpoint
CREATE TABLE "documents"."number_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"series_key" text NOT NULL,
	"document_type_id" uuid,
	"series_type" text NOT NULL,
	"phase" text DEFAULT '1' NOT NULL,
	"prefix" text,
	"sp_ordinal" text,
	"delimiter" text DEFAULT ' ' NOT NULL,
	"sequence_padding" smallint NOT NULL,
	"sequence_name_prefix" text NOT NULL,
	"year_format" text DEFAULT 'YYYY' NOT NULL,
	"preliminary_format" text,
	"final_format" text NOT NULL,
	"resets_annually" boolean DEFAULT true NOT NULL,
	"authority_office_id" uuid NOT NULL,
	"preliminary_assignment_event" text,
	"final_assignment_event" text NOT NULL,
	"deferred_final_assignment" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_number_series_city_key" UNIQUE("city_id","series_key"),
	CONSTRAINT "number_series_series_type_check" CHECK ("documents"."number_series"."series_type" IN ('legislative','administrative')),
	CONSTRAINT "number_series_phase_check" CHECK ("documents"."number_series"."phase" IN ('1','1b'))
);
--> statement-breakpoint
CREATE TABLE "documents"."numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"number_series_id" uuid NOT NULL,
	"number_type" text NOT NULL,
	"number_value" text NOT NULL,
	"sequence_year" smallint NOT NULL,
	"sequence_number" integer NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" uuid NOT NULL,
	"superseded_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_numbers_series_year_seq" UNIQUE("number_series_id","sequence_year","sequence_number"),
	CONSTRAINT "numbers_number_type_check" CHECK ("documents"."numbers"."number_type" IN ('preliminary','final','control'))
);
--> statement-breakpoint
CREATE TABLE "documents"."panlalawigan_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"number_series_id" uuid,
	"control_no" text,
	"subject" text,
	"transmitted_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"action_deadline" timestamp with time zone,
	"response_date" timestamp with time zone,
	"outcome" text,
	"resolution_number" text,
	"remarks" text,
	"days_elapsed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_panlalawigan_reviews_document" UNIQUE("document_id"),
	CONSTRAINT "panlalawigan_reviews_outcome_check" CHECK ("documents"."panlalawigan_reviews"."outcome" IN ('valid','valid_in_part','returned','operative_in_its_entirety','deemed_approved'))
);
--> statement-breakpoint
CREATE TABLE "documents"."signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"signature_type" text NOT NULL,
	"signed_by_employee_id" uuid NOT NULL,
	"signed_by_display_name" text,
	"signed_at" timestamp with time zone NOT NULL,
	"is_wet_ink" boolean DEFAULT false NOT NULL,
	"signature_image_s3_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "signatures_signature_type_check" CHECK ("documents"."signatures"."signature_type" IN ('presiding_officer','mayor','sp_secretary','vice_mayor','committee_chair'))
);
--> statement-breakpoint
CREATE TABLE "documents"."versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"file_key" uuid NOT NULL,
	"original_filename" text,
	"mime_type" text NOT NULL,
	"file_size_bytes" bigint,
	"page_count" integer,
	"scan_quality_score" numeric(4, 3),
	"scan_quality_category" text,
	"ocr_processed" boolean DEFAULT false NOT NULL,
	"ocr_text" text,
	"tsv" "tsvector",
	"requires_manual_verification" boolean DEFAULT false NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_versions_document_number" UNIQUE("document_id","version_number"),
	CONSTRAINT "versions_scan_quality_category_check" CHECK ("documents"."versions"."scan_quality_category" IN ('good','fair','poor')),
	CONSTRAINT "ck_versions_scan_quality_range" CHECK ("documents"."versions"."scan_quality_score" IS NULL OR ("documents"."versions"."scan_quality_score" >= 0 AND "documents"."versions"."scan_quality_score" <= 1))
);
--> statement-breakpoint
ALTER TABLE "documents"."attachments" ADD CONSTRAINT "attachments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."attachments" ADD CONSTRAINT "attachments_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "documents"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."classification_allowlists" ADD CONSTRAINT "classification_allowlists_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "documents"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."document_sponsorships" ADD CONSTRAINT "document_sponsorships_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."document_types" ADD CONSTRAINT "document_types_number_series_id_number_series_id_fk" FOREIGN KEY ("number_series_id") REFERENCES "documents"."number_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."documents" ADD CONSTRAINT "documents_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "documents"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."documents" ADD CONSTRAINT "documents_number_series_id_number_series_id_fk" FOREIGN KEY ("number_series_id") REFERENCES "documents"."number_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."documents" ADD CONSTRAINT "documents_superseded_by_documents_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "documents"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."number_series" ADD CONSTRAINT "number_series_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "documents"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."numbers" ADD CONSTRAINT "numbers_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."numbers" ADD CONSTRAINT "numbers_number_series_id_number_series_id_fk" FOREIGN KEY ("number_series_id") REFERENCES "documents"."number_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."panlalawigan_reviews" ADD CONSTRAINT "panlalawigan_reviews_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."panlalawigan_reviews" ADD CONSTRAINT "panlalawigan_reviews_number_series_id_number_series_id_fk" FOREIGN KEY ("number_series_id") REFERENCES "documents"."number_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."signatures" ADD CONSTRAINT "signatures_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents"."versions" ADD CONSTRAINT "versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_document" ON "documents"."attachments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_source_document" ON "documents"."attachments" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "idx_classification_allowlists_type" ON "documents"."classification_allowlists" USING btree ("document_type_id");--> statement-breakpoint
CREATE INDEX "idx_sponsorships_document" ON "documents"."document_sponsorships" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_documents_type" ON "documents"."documents" USING btree ("document_type_id");--> statement-breakpoint
CREATE INDEX "idx_documents_lifecycle_state" ON "documents"."documents" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "idx_documents_originating_office" ON "documents"."documents" USING btree ("originating_office_id");--> statement-breakpoint
CREATE INDEX "idx_documents_owned_by_office" ON "documents"."documents" USING btree ("owned_by_office_id");--> statement-breakpoint
CREATE INDEX "idx_documents_workflow_instance" ON "documents"."documents" USING btree ("workflow_instance_id");--> statement-breakpoint
CREATE INDEX "idx_documents_metadata_gin" ON "documents"."documents" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "idx_documents_metadata_certified_urgent" ON "documents"."documents" USING btree ((metadata->>'certified_urgent'));--> statement-breakpoint
CREATE INDEX "idx_documents_metadata_has_penalty" ON "documents"."documents" USING btree ((metadata->>'has_penalty_provision'));--> statement-breakpoint
CREATE INDEX "idx_documents_metadata_outcome_state" ON "documents"."documents" USING btree ((metadata->>'outcome_state'));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_numbers_one_current_per_type" ON "documents"."numbers" USING btree ("document_id","number_type") WHERE is_current = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_numbers_document" ON "documents"."numbers" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_panlalawigan_reviews_document" ON "documents"."panlalawigan_reviews" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_signatures_document" ON "documents"."signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_versions_document" ON "documents"."versions" USING btree ("document_id");
--> statement-breakpoint
-- === Manual additions: updated_at triggers, FTS triggers, lifecycle/immutability
-- functions, sequence function, grants, RLS (C1 Part 5 + Part 12) ===
-- public.fn_set_updated_at() already exists (created in 0002_iam_create_iam_schema.sql).

-- documents.document_types trigger
CREATE TRIGGER trg_document_types_set_updated_at
    BEFORE UPDATE ON documents.document_types
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- documents.number_series trigger
CREATE TRIGGER trg_number_series_set_updated_at
    BEFORE UPDATE ON documents.number_series
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- documents.documents trigger
CREATE TRIGGER trg_documents_set_updated_at
    BEFORE UPDATE ON documents.documents
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- documents.panlalawigan_reviews trigger
CREATE TRIGGER trg_panlalawigan_reviews_set_updated_at
    BEFORE UPDATE ON documents.panlalawigan_reviews
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint

-- FTS trigger: documents.documents.tsv maintained from title (C1 Part 5).
CREATE TRIGGER trg_documents_tsv_update
    BEFORE INSERT OR UPDATE OF title ON documents.documents
    FOR EACH ROW
    EXECUTE FUNCTION tsvector_update_trigger(tsv, 'pg_catalog.english', title);
--> statement-breakpoint
-- FTS trigger: documents.versions.tsv maintained from ocr_text (C1 Part 5).
CREATE TRIGGER trg_versions_tsv_update
    BEFORE INSERT OR UPDATE OF ocr_text ON documents.versions
    FOR EACH ROW
    EXECUTE FUNCTION tsvector_update_trigger(tsv, 'pg_catalog.english', ocr_text);
--> statement-breakpoint

-- documents.documents.lifecycle_state transition enforcement (C1 Part 5 / D3
-- post-ADR-013/ADR-014 authoritative state set). [Decision 3.12] released ->
-- cancelled is a VALID transition per D3 L99, L146 ("Unchanged from
-- Iteration 1. Extremely rare."). V1's trigger omitting this was incorrect.
CREATE OR REPLACE FUNCTION documents.check_lifecycle_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE
    v_allowed BOOLEAN := false;
BEGIN
    IF NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state THEN
        v_allowed := CASE OLD.lifecycle_state
            WHEN 'draft'                        THEN NEW.lifecycle_state IN ('submitted','cancelled')
            WHEN 'submitted'                    THEN NEW.lifecycle_state IN ('in_workflow','cancelled')
            WHEN 'in_workflow'                  THEN NEW.lifecycle_state IN
                                                    ('pending_mayor_action','pending_panlalawigan_review','completed','cancelled')
            WHEN 'pending_mayor_action'         THEN NEW.lifecycle_state IN ('in_workflow','completed','cancelled')
            WHEN 'pending_panlalawigan_review'  THEN NEW.lifecycle_state IN ('completed','superseded','cancelled')
            WHEN 'completed'                    THEN NEW.lifecycle_state IN ('released','cancelled')
            WHEN 'released'                     THEN NEW.lifecycle_state IN ('archived','cancelled')
            WHEN 'archived'                     THEN NEW.lifecycle_state IN ('disposed')
            WHEN 'disposed'                     THEN false
            WHEN 'cancelled'                    THEN false
            WHEN 'superseded'                   THEN false
            ELSE false
        END;

        IF NOT v_allowed THEN
            RAISE EXCEPTION 'invalid document lifecycle transition: % → %',
                OLD.lifecycle_state, NEW.lifecycle_state;
        END IF;
    END IF;
    RETURN NEW;
END;
$fn$;
--> statement-breakpoint
CREATE TRIGGER trg_documents_lifecycle_transition
    BEFORE UPDATE ON documents.documents
    FOR EACH ROW EXECUTE FUNCTION documents.check_lifecycle_transition();
--> statement-breakpoint

-- documents.numbers final/control number immutability (C1 Part 5 / C1 §1.9).
CREATE OR REPLACE FUNCTION documents.check_number_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
    IF OLD.number_type IN ('final','control')
       AND OLD.number_value IS DISTINCT FROM NEW.number_value THEN
        RAISE EXCEPTION 'final and control numbers are immutable once assigned: % %',
            OLD.number_type, OLD.number_value;
    END IF;
    RETURN NEW;
END;
$fn$;
--> statement-breakpoint
CREATE TRIGGER trg_numbers_immutability
    BEFORE UPDATE ON documents.numbers
    FOR EACH ROW EXECUTE FUNCTION documents.check_number_immutability();
--> statement-breakpoint

-- Hybrid auto-create sequence helper (C1 Decision 3.13 / §1.9). Creates the
-- target year's sequence on demand if it does not exist; returns was_created
-- so the calling application module can emit a structured log warning.
-- SECURITY DEFINER owned by batac_migrate (the DDL-owning role, per C5
-- Addendum) so that batac_app (runtime) can CREATE SEQUENCE without DDL
-- privileges.
CREATE OR REPLACE FUNCTION documents.fn_get_next_sequence_value(
    p_series_key TEXT,
    p_year       INTEGER
)
RETURNS TABLE (sequence_value BIGINT, was_created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    v_prefix   TEXT;
    v_seq_name TEXT;
    v_next     BIGINT;
    v_created  BOOLEAN := false;
BEGIN
    SELECT sequence_name_prefix INTO v_prefix
    FROM documents.number_series
    WHERE series_key = p_series_key AND deleted_at IS NULL;

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'unknown or deleted number series: %', p_series_key;
    END IF;

    v_seq_name := 'documents.' || v_prefix || '_' || p_year::text || '_seq';

    BEGIN
        EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
    EXCEPTION WHEN undefined_table THEN
        -- On-demand year creation: acceptable per H3's explicit allowance.
        -- was_created = true signals the application to emit a structured
        -- log warning (not an audit event or domain event — operational only).
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
REVOKE ALL ON FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) TO batac_app;
--> statement-breakpoint
ALTER FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) OWNER TO batac_migrate;
--> statement-breakpoint

-- Grant statements (C1 Part 12 — documents-schema lines only; iam/organization/
-- etc. were already granted by their own migrations). NOTE: post-migrate-grants.sql
-- (TASK-INFRA-006) already grants batac_app/batac_readonly/batac_it_admin on the
-- 'documents' schema generically and idempotently on every db:migrate run — see
-- the PR summary for detail. These inline grants are included for consistency
-- with the 0003 (organization) precedent and to keep this migration file a
-- complete, self-contained record per C1 Part 12.
GRANT USAGE ON SCHEMA documents TO batac_app, batac_readonly, batac_it_admin;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA documents TO batac_app;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA documents TO batac_readonly;
--> statement-breakpoint
GRANT SELECT, UPDATE ON documents.documents TO batac_it_admin;
--> statement-breakpoint
-- Invariant #10: IT Admin has no document file content access — not even for
-- public documents. Revoke explicitly to block inheritance.
REVOKE ALL ON documents.versions FROM batac_it_admin;
--> statement-breakpoint
REVOKE ALL ON documents.attachments FROM batac_it_admin;
--> statement-breakpoint
GRANT USAGE ON ALL SEQUENCES IN SCHEMA documents TO batac_app;
--> statement-breakpoint

-- Row-Level Security (C1 Part 12).
ALTER TABLE documents.documents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Office isolation: a user's owned_by_office_id must match, or
-- app.bypass_office_isolation must be set (for SP Secretary, Records Officer, etc).
CREATE POLICY documents_office_isolation ON documents.documents
    FOR SELECT TO batac_app
    USING (
        owned_by_office_id = current_setting('app.current_office_id', true)::uuid
        OR current_setting('app.bypass_office_isolation', true) = 'true'
    );
--> statement-breakpoint
-- IT admin: may see metadata rows for non-confidential/restricted documents
-- (e.g., to diagnose a stuck workflow) but never confidential or restricted.
CREATE POLICY documents_it_admin_no_confidential ON documents.documents
    FOR SELECT TO batac_it_admin
    USING (classification_level NOT IN ('confidential','restricted'));
--> statement-breakpoint
-- IT admin UPDATE: closed-default policy — no UPDATE can commit until a
-- specific, narrower policy is added for the exact fields IT admin may touch.
CREATE POLICY documents_it_admin_metadata_only_update ON documents.documents
    FOR UPDATE TO batac_it_admin
    USING (true)
    WITH CHECK (false);
