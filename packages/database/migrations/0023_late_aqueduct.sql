CREATE TABLE "notifications"."notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"template_category" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_notif_prefs_user_category_channel" UNIQUE("user_id","template_category","channel"),
	CONSTRAINT "notif_prefs_channel_check" CHECK ("notifications"."notification_preferences"."channel" IN ('in_app','email','sms'))
);
--> statement-breakpoint
CREATE INDEX "idx_notif_prefs_user" ON "notifications"."notification_preferences" USING btree ("user_id");