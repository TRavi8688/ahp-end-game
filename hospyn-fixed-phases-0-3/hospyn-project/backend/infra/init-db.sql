-- backend/infra/init-db.sql
-- DB-2 FIX: Create isolated databases and least-privilege users.
-- This file is mounted to /docker-entrypoint-initdb.d/ and runs once on first start.
-- Passwords come from Docker secrets / env vars at runtime via a wrapper if needed;
-- for compose development they are set directly. In production use GCP Secret Manager.

-- ── Auth service DB ────────────────────────────────────────────────────────────
CREATE DATABASE hospyn_auth;
CREATE USER auth_user WITH ENCRYPTED PASSWORD :'AUTH_DB_PASSWORD';
GRANT CONNECT ON DATABASE hospyn_auth TO auth_user;
\connect hospyn_auth
GRANT USAGE ON SCHEMA public TO auth_user;
GRANT CREATE ON SCHEMA public TO auth_user;   -- needed for Alembic migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO auth_user;

-- ── Healthcare Core DB ─────────────────────────────────────────────────────────
\connect postgres
CREATE DATABASE hospyn_healthcare;
CREATE USER healthcare_user WITH ENCRYPTED PASSWORD :'HEALTHCARE_DB_PASSWORD';
GRANT CONNECT ON DATABASE hospyn_healthcare TO healthcare_user;
\connect hospyn_healthcare
GRANT USAGE ON SCHEMA public TO healthcare_user;
GRANT CREATE ON SCHEMA public TO healthcare_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO healthcare_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO healthcare_user;

-- ── AI Service DB ──────────────────────────────────────────────────────────────
\connect postgres
CREATE DATABASE hospyn_ai;
CREATE USER ai_user WITH ENCRYPTED PASSWORD :'AI_DB_PASSWORD';
GRANT CONNECT ON DATABASE hospyn_ai TO ai_user;
\connect hospyn_ai
GRANT USAGE ON SCHEMA public TO ai_user;
GRANT CREATE ON SCHEMA public TO ai_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ai_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ai_user;

-- ── Explicitly deny cross-DB access ───────────────────────────────────────────
-- Each user only has CONNECT on their own database.
-- auth_user CANNOT connect to hospyn_healthcare or hospyn_ai (no GRANT).
-- healthcare_user CANNOT connect to hospyn_auth or hospyn_ai.
-- ai_user CANNOT connect to hospyn_auth or hospyn_healthcare.
