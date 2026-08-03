-- Migration 0015: Hook 1 RLS Bypass Functions
-- These SECURITY DEFINER functions allow the auth middleware to read/terminate sessions
-- and revoke refresh tokens BEFORE the user context is established in Hook 3.

CREATE OR REPLACE FUNCTION iam.fn_get_session_by_id(p_session_id uuid)
RETURNS TABLE (
    id uuid,
    city_id uuid,
    user_id uuid,
    session_token_hash text,
    ip_address inet,
    user_agent text,
    last_activity_at timestamp with time zone,
    locked_at timestamp with time zone,
    active boolean,
    created_at timestamp with time zone,
    terminated_at timestamp with time zone,
    terminated_by uuid,
    termination_reason text,
    deleted_at timestamp with time zone,
    deleted_by uuid
)
SECURITY DEFINER
SET search_path = iam, public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.city_id, s.user_id, s.session_token_hash, s.ip_address, s.user_agent, s.last_activity_at, s.locked_at, s.active, s.created_at, s.terminated_at, s.terminated_by, s.termination_reason, s.deleted_at, s.deleted_by
    FROM iam.sessions s
    WHERE s.id = p_session_id AND s.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION iam.fn_get_session_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.fn_get_session_by_id(uuid) TO batac_app;

CREATE OR REPLACE FUNCTION iam.fn_terminate_session(p_session_id uuid, p_reason text, p_terminated_by uuid)
RETURNS void
SECURITY DEFINER
SET search_path = iam, public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE iam.sessions
    SET active = false,
        terminated_at = now(),
        termination_reason = p_reason,
        terminated_by = p_terminated_by
    WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION iam.fn_terminate_session(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.fn_terminate_session(uuid, text, uuid) TO batac_app;

CREATE OR REPLACE FUNCTION iam.fn_revoke_refresh_tokens_by_session_id(p_session_id uuid, p_reason text)
RETURNS void
SECURITY DEFINER
SET search_path = iam, public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE iam.refresh_tokens
    SET revoked_at = now(),
        revocation_reason = p_reason
    WHERE session_id = p_session_id
      AND used_at IS NULL
      AND revoked_at IS NULL
      AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION iam.fn_revoke_refresh_tokens_by_session_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.fn_revoke_refresh_tokens_by_session_id(uuid, text) TO batac_app;


CREATE OR REPLACE FUNCTION iam.fn_update_last_activity(p_session_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = iam, public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE iam.sessions
    SET last_activity_at = now()
    WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION iam.fn_update_last_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.fn_update_last_activity(uuid) TO batac_app;
