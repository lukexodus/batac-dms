ALTER TABLE "workflow"."instances" ADD COLUMN "sla_warning_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workflow"."instances" ADD COLUMN "sla_critical_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workflow"."steps" ADD COLUMN "legally_mandated" boolean DEFAULT false NOT NULL;