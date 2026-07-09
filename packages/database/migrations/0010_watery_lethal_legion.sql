CREATE TABLE "workflow"."admin_approval_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"new_definition_version_id" uuid NOT NULL,
	"approved_by" uuid NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "workflow"."admin_approval_grants" ADD CONSTRAINT "admin_approval_grants_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "workflow"."instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow"."admin_approval_grants" ADD CONSTRAINT "admin_approval_grants_new_definition_version_id_definition_versions_id_fk" FOREIGN KEY ("new_definition_version_id") REFERENCES "workflow"."definition_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_approval_grants_instance_id" ON "workflow"."admin_approval_grants" USING btree ("instance_id");