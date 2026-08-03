/* manually authored to fix RLS violation on login */
CREATE POLICY sessions_insert ON iam.sessions FOR INSERT TO batac_app
    WITH CHECK (true);

CREATE POLICY sessions_update ON iam.sessions FOR UPDATE TO batac_app
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role_tier', true) IN ('IT_ADMIN','SECURITY_ADMIN')
    );
