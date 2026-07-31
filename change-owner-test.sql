DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'pgboss') LOOP
        EXECUTE 'ALTER TABLE pgboss.' || quote_ident(r.tablename) || ' OWNER TO batac_app';
    END LOOP;
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'pgboss') LOOP
        EXECUTE 'ALTER VIEW pgboss.' || quote_ident(r.viewname) || ' OWNER TO batac_app';
    END LOOP;
    FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'pgboss') LOOP
        EXECUTE 'ALTER SEQUENCE pgboss.' || quote_ident(r.sequencename) || ' OWNER TO batac_app';
    END LOOP;
    FOR r IN (SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args 
              FROM pg_proc p 
              JOIN pg_namespace n ON p.pronamespace = n.oid 
              WHERE n.nspname = 'pgboss') LOOP
        EXECUTE 'ALTER FUNCTION pgboss.' || quote_ident(r.proname) || '(' || r.args || ') OWNER TO batac_app';
    END LOOP;
END
$$;
