DROP POLICY IF EXISTS documents_office_isolation ON documents.documents;
CREATE POLICY documents_office_isolation ON documents.documents
    FOR SELECT TO batac_app
    USING (
        owned_by_office_id = NULLIF(current_setting('app.current_office_id', true), '')::uuid
        OR current_setting('app.bypass_office_isolation', true) = 'true'
    );
