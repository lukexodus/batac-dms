CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SEQUENCE "audit"."events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"sequence_number" bigint DEFAULT nextval('audit.events_sequence_seq') NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"target_id" uuid,
	"target_type" text,
	"resource_office_id" uuid,
	"payload" jsonb NOT NULL,
	"chain_hash" text NOT NULL,
	"hmac" text NOT NULL,
	"hmac_key_version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_hash_check" CHECK ("audit"."events"."chain_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "hmac_check" CHECK ("audit"."events"."hmac" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_audit_events_sequence" ON "audit"."events" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "idx_audit_events_city_occurred" ON "audit"."events" USING btree ("city_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_events_actor" ON "audit"."events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_target" ON "audit"."events" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_resource_office" ON "audit"."events" USING btree ("resource_office_id") WHERE "audit"."events"."resource_office_id" IS NOT NULL;