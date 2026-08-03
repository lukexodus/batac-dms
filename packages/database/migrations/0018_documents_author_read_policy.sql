CREATE POLICY documents_author_read ON documents.documents
    FOR SELECT TO batac_app
    USING (created_by = (NULLIF(current_setting('app.current_user_id', true), ''))::uuid);
