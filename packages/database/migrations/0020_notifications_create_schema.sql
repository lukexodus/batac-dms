CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TABLE "notifications"."delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"notification_event_id" uuid NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"delivered_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "delivery_log_status_check" CHECK ("notifications"."delivery_log"."status" IN ('delivered','bounced','failed'))
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"recipient_user_id" uuid,
	"recipient_email" text,
	"recipient_phone" text,
	"template_data" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_event_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "notification_events_channel_check" CHECK ("notifications"."notification_events"."channel" IN ('in_app','email','sms')),
	CONSTRAINT "notification_events_status_check" CHECK ("notifications"."notification_events"."status" IN ('pending','sent','failed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "notifications"."templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_templates_city_name_channel" UNIQUE("city_id","name","channel"),
	CONSTRAINT "templates_channel_check" CHECK ("notifications"."templates"."channel" IN ('in_app','email','sms'))
);
--> statement-breakpoint
ALTER TABLE "notifications"."delivery_log" ADD CONSTRAINT "delivery_log_notification_event_id_notification_events_id_fk" FOREIGN KEY ("notification_event_id") REFERENCES "notifications"."notification_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notification_events" ADD CONSTRAINT "notification_events_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "notifications"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_delivery_log_event" ON "notifications"."delivery_log" USING btree ("notification_event_id");--> statement-breakpoint
CREATE INDEX "idx_notification_events_template" ON "notifications"."notification_events" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_notification_events_recipient" ON "notifications"."notification_events" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE TRIGGER trg_templates_set_updated_at
    BEFORE UPDATE ON notifications.templates
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();