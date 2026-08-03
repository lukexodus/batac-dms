CREATE POLICY documents_update ON documents.documents
    FOR UPDATE TO batac_app
    USING (
        owned_by_office_id = NULLIF(current_setting('app.current_office_id', true), '')::uuid
        OR current_setting('app.bypass_office_isolation', true) = 'true'
        OR created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    WITH CHECK (
        city_id = NULLIF(current_setting('app.current_city_id', true), '')::uuid
        AND (
            owned_by_office_id = NULLIF(current_setting('app.current_office_id', true), '')::uuid
            OR current_setting('app.bypass_office_isolation', true) = 'true'
            OR created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    );
