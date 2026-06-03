-- scripts/init_db.sql
-- Phase 6: Runs once when the postgres container first starts.
-- Creates the hospyn database and a dedicated app user with least-privilege.

-- Create databases (one per service for isolation)
CREATE DATABASE hospyn_auth;
CREATE DATABASE hospyn_healthcare;

-- Create app user with limited privileges (not the postgres superuser)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hospyn_app') THEN
        CREATE ROLE hospyn_app WITH LOGIN PASSWORD 'REPLACE_IN_ENTRYPOINT';
    END IF;
END
$$;

-- Grant only what's needed — no superuser, no createdb
GRANT CONNECT ON DATABASE hospyn_auth TO hospyn_app;
GRANT CONNECT ON DATABASE hospyn_healthcare TO hospyn_app;

\c hospyn_auth
GRANT USAGE ON SCHEMA public TO hospyn_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hospyn_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hospyn_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hospyn_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO hospyn_app;

\c hospyn_healthcare
GRANT USAGE ON SCHEMA public TO hospyn_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hospyn_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hospyn_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hospyn_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO hospyn_app;
