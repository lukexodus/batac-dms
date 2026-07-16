CREATE TABLE "iam"."password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"salt" text NOT NULL,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_password_reset_tokens_hash" UNIQUE("token_hash")
);
--> statement-breakpoint
DROP INDEX "iam"."idx_rt_expires_at";--> statement-breakpoint
ALTER TABLE "iam"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_prt_user_id" ON "iam"."password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rt_expires_at" ON "iam"."refresh_tokens" USING btree ("expires_at");