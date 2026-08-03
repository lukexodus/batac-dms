CREATE POLICY documents_insert ON documents.documents
    FOR INSERT TO batac_app
    WITH CHECK (true);
