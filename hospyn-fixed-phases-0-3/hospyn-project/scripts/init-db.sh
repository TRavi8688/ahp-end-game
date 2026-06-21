#!/bin/bash
# ============================================================
# scripts/init-db.sh
# Creates both required PostgreSQL databases on first run.
# Mounted into the postgres container via docker-compose.
# ============================================================
set -e

echo "==> Hospyn DB Init: Creating databases..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Auth service database
    CREATE DATABASE hospyn_auth;
    GRANT ALL PRIVILEGES ON DATABASE hospyn_auth TO hospyn;

    -- Healthcare core database
    CREATE DATABASE hospyn_healthcare;
    GRANT ALL PRIVILEGES ON DATABASE hospyn_healthcare TO hospyn;
EOSQL

echo "==> Hospyn DB Init: Both databases created successfully."
