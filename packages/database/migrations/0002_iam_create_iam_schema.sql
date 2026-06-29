CREATE SCHEMA "iam";
--> statement-breakpoint
CREATE TABLE "iam"."credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"last_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_credentials_user" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "iam"."mfa_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text DEFAULT 'totp' NOT NULL,
	"secret_encrypted" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"enabled_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_mfa_records_user_method" UNIQUE("user_id","method"),
	CONSTRAINT "mfa_records_method_check" CHECK ("iam"."mfa_records"."method" IN ('totp'))
);
--> statement-breakpoint
CREATE TABLE "iam"."permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_permissions_city_resource_action" UNIQUE("city_id","resource","action")
);
--> statement-breakpoint
CREATE TABLE "iam"."refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"salt" text NOT NULL,
	"family_id" uuid NOT NULL,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"replaced_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_refresh_tokens_hash" UNIQUE("token_hash"),
	CONSTRAINT "refresh_tokens_revocation_reason_check" CHECK ("iam"."refresh_tokens"."revocation_reason" IN ('logout','reuse_detected','forced','family_revoked','replaced'))
);
--> statement-breakpoint
CREATE TABLE "iam"."role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"office_scope_id" uuid,
	"revoked_by" uuid,
	"revoked_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "ck_role_assignments_revocation_consistency" CHECK (("iam"."role_assignments"."revoked_at" IS NULL) = ("iam"."role_assignments"."is_active" = true))
);
--> statement-breakpoint
CREATE TABLE "iam"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"condition_reference" text,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id"),
	CONSTRAINT "role_permissions_decision_check" CHECK ("iam"."role_permissions"."decision" IN ('allow','deny','conditional')),
	CONSTRAINT "ck_role_permissions_condition_required" CHECK ("iam"."role_permissions"."decision" <> 'conditional' OR "iam"."role_permissions"."condition_reference" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "iam"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"type_code" text NOT NULL,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_roles_city_code" UNIQUE("city_id","code"),
	CONSTRAINT "roles_type_code_check" CHECK ("iam"."roles"."type_code" IN ('platform_admin','document_processor','sys_admin','auditor','citizen'))
);
--> statement-breakpoint
CREATE TABLE "iam"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"terminated_at" timestamp with time zone,
	"terminated_by" uuid,
	"termination_reason" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_sessions_token_hash" UNIQUE("session_token_hash"),
	CONSTRAINT "ck_sessions_termination_consistency" CHECK (("iam"."sessions"."terminated_at" IS NULL) = ("iam"."sessions"."termination_reason" IS NULL)),
	CONSTRAINT "sessions_termination_reason_check" CHECK ("iam"."sessions"."termination_reason" IN ('logout','inactivity','forced','replaced','expired','lock'))
);
--> statement-breakpoint
CREATE TABLE "iam"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"login_failure_count" integer DEFAULT 0 NOT NULL,
	"login_locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "uq_users_city_username" UNIQUE("city_id","username"),
	CONSTRAINT "uq_users_city_email" UNIQUE("city_id","email"),
	CONSTRAINT "users_status_check" CHECK ("iam"."users"."status" IN ('active','inactive','suspended','deactivated'))
);
--> statement-breakpoint
ALTER TABLE "iam"."credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."mfa_records" ADD CONSTRAINT "mfa_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "iam"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_refresh_tokens_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "iam"."refresh_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "iam"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."role_assignments" ADD CONSTRAINT "role_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."role_assignments" ADD CONSTRAINT "role_assignments_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "iam"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "iam"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iam"."sessions" ADD CONSTRAINT "sessions_terminated_by_users_id_fk" FOREIGN KEY ("terminated_by") REFERENCES "iam"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rt_user_id" ON "iam"."refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rt_family_id" ON "iam"."refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_rt_expires_at" ON "iam"."refresh_tokens" USING btree ("expires_at") WHERE revoked_at IS NULL AND used_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_assignments_active" ON "iam"."role_assignments" USING btree ("user_id","role_id",coalesce("office_scope_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE is_active = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_role_assignments_user" ON "iam"."role_assignments" USING btree ("user_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_role_assignments_role" ON "iam"."role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sessions_one_active_per_user" ON "iam"."sessions" USING btree ("user_id") WHERE active = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "iam"."sessions" USING btree ("user_id");
--> statement-breakpoint
-- === Manual additions: triggers, RLS, grants ===
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON iam.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_credentials_set_updated_at
    BEFORE UPDATE ON iam.credentials
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_roles_set_updated_at
    BEFORE UPDATE ON iam.roles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_permissions_set_updated_at
    BEFORE UPDATE ON iam.permissions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_mfa_records_set_updated_at
    BEFORE UPDATE ON iam.mfa_records
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION iam.enforce_platform_admin_exclusion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_incoming_type TEXT;
  v_conflict_type TEXT;
BEGIN
  SELECT type_code INTO v_incoming_type FROM iam.roles WHERE id = NEW.role_id;
  IF v_incoming_type = 'platform_admin' THEN
    v_conflict_type := 'document_processor';
  ELSIF v_incoming_type = 'document_processor' THEN
    v_conflict_type := 'platform_admin';
  ELSE
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM iam.role_assignments ra
    JOIN iam.roles r ON r.id = ra.role_id
    WHERE ra.user_id = NEW.user_id
      AND r.type_code = v_conflict_type
      AND ra.is_active = true AND ra.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'Platform Administrator role cannot be combined with document-processing roles (user_id: %)',
      NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_enforce_platform_admin_exclusion
  BEFORE INSERT OR UPDATE ON iam.role_assignments
  FOR EACH ROW EXECUTE FUNCTION iam.enforce_platform_admin_exclusion();
--> statement-breakpoint
ALTER TABLE iam.sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sessions_own_or_admin ON iam.sessions FOR SELECT TO batac_app
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role_tier', true) IN ('IT_ADMIN','SECURITY_ADMIN')
    );
--> statement-breakpoint
GRANT USAGE ON SCHEMA iam TO batac_app, batac_readonly;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA iam TO batac_app;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA iam TO batac_readonly;
--> statement-breakpoint
REVOKE SELECT ON iam.credentials FROM batac_app;