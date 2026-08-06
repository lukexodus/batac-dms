CREATE SCHEMA "records";
--> statement-breakpoint
CREATE TABLE "records"."retention_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"retention_period_years" integer,
	"is_permanent" boolean DEFAULT false NOT NULL,
	"disposition_rule" text,
	"legal_basis" text,
	"configured_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "chk_retention_period" CHECK ("records"."retention_schedules"."is_permanent" = true OR "records"."retention_schedules"."retention_period_years" IS NOT NULL)
);

CREATE TRIGGER trg_retention_schedules_set_updated_at
    BEFORE UPDATE ON records.retention_schedules
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

GRANT SELECT, INSERT, UPDATE ON records.retention_schedules TO batac_app;
GRANT SELECT ON records.retention_schedules TO batac_readonly;
