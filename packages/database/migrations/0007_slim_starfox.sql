ALTER TYPE "workflow"."workflow_step_status_enum" ADD VALUE 'returned';--> statement-breakpoint
DROP INDEX "workflow"."idx_instances_sla_active";--> statement-breakpoint
CREATE INDEX "idx_instances_sla_active" ON "workflow"."instances" USING btree ("sla_deadline") WHERE "workflow"."instances"."status" IN ('active', 'suspended', 'stuck');