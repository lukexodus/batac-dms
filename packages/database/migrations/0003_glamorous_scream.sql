CREATE SCHEMA "organization";
--> statement-breakpoint
CREATE TABLE "organization"."assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "ck_assignments_dates" CHECK ("organization"."assignments"."end_date" IS NULL OR "organization"."assignments"."end_date" >= "organization"."assignments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "organization"."committee_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"committee_role" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "ck_committee_memberships_role" CHECK ("organization"."committee_memberships"."committee_role" IN ('chairman','vice_chairman','member'))
);
--> statement-breakpoint
CREATE TABLE "organization"."committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"chaired_by_employee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_committees_city_code" UNIQUE("city_id","code")
);
--> statement-breakpoint
CREATE TABLE "organization"."cross_office_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"office_scope" text NOT NULL,
	"access_level" text NOT NULL,
	"resource_types" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_cross_office_grants_office_scope" CHECK ("organization"."cross_office_grants"."office_scope" IN ('all')),
	CONSTRAINT "ck_cross_office_grants_access_level" CHECK ("organization"."cross_office_grants"."access_level" IN ('metadata_only', 'full'))
);
--> statement-breakpoint
CREATE TABLE "organization"."delegation_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"delegating_employee_id" uuid NOT NULL,
	"delegated_to_employee_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"designation_document_id" uuid,
	"scope_description" text NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legal_basis" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "ck_delegation_dates" CHECK ("organization"."delegation_grants"."end_date" > "organization"."delegation_grants"."start_date"),
	CONSTRAINT "ck_delegation_not_self" CHECK ("organization"."delegation_grants"."delegating_employee_id" <> "organization"."delegation_grants"."delegated_to_employee_id"),
	CONSTRAINT "ck_delegation_revocation_consistency" CHECK (("organization"."delegation_grants"."revoked_at" IS NULL) = ("organization"."delegation_grants"."is_active" = true) OR "organization"."delegation_grants"."revoked_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "organization"."employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"user_id" uuid,
	"employee_number" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_employees_city_number" UNIQUE("city_id","employee_number")
);
--> statement-breakpoint
CREATE TABLE "organization"."offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"office_type" text NOT NULL,
	"parent_office_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_offices_city_code" UNIQUE("city_id","code"),
	CONSTRAINT "ck_offices_not_self_parent" CHECK ("organization"."offices"."id" <> "organization"."offices"."parent_office_id"),
	CONSTRAINT "ck_offices_office_type" CHECK ("organization"."offices"."office_type" IN ('executive','legislative','department','barangay','external'))
);
--> statement-breakpoint
CREATE TABLE "organization"."positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"title" text NOT NULL,
	"code" text NOT NULL,
	"authority_level" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_positions_city_code" UNIQUE("city_id","code"),
	CONSTRAINT "ck_positions_authority_level" CHECK ("organization"."positions"."authority_level" IN ('executive', 'managerial', 'staff', 'support'))
);
--> statement-breakpoint
ALTER TABLE "organization"."assignments" ADD CONSTRAINT "assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "organization"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."assignments" ADD CONSTRAINT "assignments_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "organization"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."assignments" ADD CONSTRAINT "assignments_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "organization"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."committee_memberships" ADD CONSTRAINT "committee_memberships_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "organization"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."committee_memberships" ADD CONSTRAINT "committee_memberships_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "organization"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."committees" ADD CONSTRAINT "committees_chaired_by_employee_id_employees_id_fk" FOREIGN KEY ("chaired_by_employee_id") REFERENCES "organization"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- linter: allow-cross-schema-fk reason="cross_office_grants.role_id references iam.roles by design — grants are scoped to specific IAM roles across schemas."
ALTER TABLE "organization"."cross_office_grants" ADD CONSTRAINT "cross_office_grants_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "iam"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."delegation_grants" ADD CONSTRAINT "delegation_grants_delegating_employee_id_employees_id_fk" FOREIGN KEY ("delegating_employee_id") REFERENCES "organization"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."delegation_grants" ADD CONSTRAINT "delegation_grants_delegated_to_employee_id_employees_id_fk" FOREIGN KEY ("delegated_to_employee_id") REFERENCES "organization"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."delegation_grants" ADD CONSTRAINT "delegation_grants_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "organization"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."delegation_grants" ADD CONSTRAINT "delegation_grants_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "organization"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."offices" ADD CONSTRAINT "offices_parent_office_id_offices_id_fk" FOREIGN KEY ("parent_office_id") REFERENCES "organization"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization"."positions" ADD CONSTRAINT "positions_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "organization"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assignments_employee" ON "organization"."assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_assignments_position" ON "organization"."assignments" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_assignments_office" ON "organization"."assignments" USING btree ("office_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assignments_one_primary_per_employee" ON "organization"."assignments" USING btree ("employee_id") WHERE is_primary = true AND is_active = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_committee_membership_active" ON "organization"."committee_memberships" USING btree ("committee_id","employee_id") WHERE is_active = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_employee" ON "organization"."committee_memberships" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_delegation_one_active_per_delegatee" ON "organization"."delegation_grants" USING btree ("delegated_to_employee_id") WHERE is_active = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_delegation_delegator" ON "organization"."delegation_grants" USING btree ("delegating_employee_id");--> statement-breakpoint
CREATE INDEX "idx_delegation_delegatee" ON "organization"."delegation_grants" USING btree ("delegated_to_employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_employees_user_id" ON "organization"."employees" USING btree ("user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_offices_parent" ON "organization"."offices" USING btree ("parent_office_id");--> statement-breakpoint
CREATE INDEX "idx_positions_office" ON "organization"."positions" USING btree ("office_id");
--> statement-breakpoint
-- === Manual additions: updated_at triggers, helper function, grants ===
-- organization.offices trigger
CREATE TRIGGER trg_offices_set_updated_at
    BEFORE UPDATE ON organization.offices
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- organization.positions trigger
CREATE TRIGGER trg_positions_set_updated_at
    BEFORE UPDATE ON organization.positions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- organization.employees trigger
CREATE TRIGGER trg_employees_set_updated_at
    BEFORE UPDATE ON organization.employees
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- organization.assignments trigger
CREATE TRIGGER trg_assignments_set_updated_at
    BEFORE UPDATE ON organization.assignments
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- organization.delegation_grants trigger
CREATE TRIGGER trg_delegation_grants_set_updated_at
    BEFORE UPDATE ON organization.delegation_grants
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- organization.committees trigger
CREATE TRIGGER trg_committees_set_updated_at
    BEFORE UPDATE ON organization.committees
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- organization.committee_memberships trigger
CREATE TRIGGER trg_committee_memberships_set_updated_at
    BEFORE UPDATE ON organization.committee_memberships
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
-- has_cross_office_read_grant() — B5 §6.5 / ADR-AUTH-009
-- Answers: does the given user have any active cross-office read grant?
-- Notes:
--   • Only handles office_scope = 'all' (covers all four seeded roles from B5 §5.6).
--   • access_level ('metadata_only' vs 'full') is stored but NOT enforced here;
--     the calling RLS policy must add a second condition to distinguish levels.
--   • A future role needing per-office granularity requires a schema change + function update.
CREATE OR REPLACE FUNCTION has_cross_office_read_grant(
    p_user_id   UUID,
    p_office_id UUID
) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM organization.cross_office_grants g
        JOIN iam.role_assignments ra ON ra.role_id = g.role_id
        WHERE ra.user_id = p_user_id
          AND ra.revoked_at IS NULL
          AND (g.office_scope = 'all')
          -- specific-office-scope branch intentionally omitted (ADR-AUTH-009):
          -- all four seeded roles use office_scope = 'all'. A future role needing
          -- per-office granularity requires a schema change + function update.
    );
$$ LANGUAGE sql STABLE;
--> statement-breakpoint
-- Grant statements (C1 Part 12)
GRANT USAGE ON SCHEMA organization TO batac_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA organization TO batac_app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA organization TO batac_readonly;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA organization TO batac_readonly;