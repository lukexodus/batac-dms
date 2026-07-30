-- Custom SQL migration file, put your code below! --

-- SECURITY DEFINER owned by batac_migrate (the DDL-owning role, per C5
-- Addendum) so that batac_app (runtime) can perform a single, narrow
-- credential-hash lookup without needing a blanket SELECT grant on
-- iam.credentials, which is intentionally revoked (see
-- 0002_iam_create_iam_schema.sql line 247). This function returns the
-- full credentials row (matching the CredentialRow type already used by
-- findCredentialByUserId's callers) rather than just the password hash,
-- so no caller-side type or contract changes are needed — only the
-- internal query implementation changes.
CREATE OR REPLACE FUNCTION iam.fn_get_credential_by_user_id(
    p_user_id UUID
)
RETURNS TABLE (
    id              UUID,
    city_id         UUID,
    user_id         UUID,
    password_hash   TEXT,
    last_changed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.city_id,
        c.user_id,
        c.password_hash,
        c.last_changed_at,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        c.deleted_by
    FROM iam.credentials c
    WHERE c.user_id = p_user_id
      AND c.deleted_at IS NULL;
END;
$fn$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION iam.fn_get_credential_by_user_id(UUID) TO batac_app;