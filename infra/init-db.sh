#!/bin/bash
# infra/init-db.sh
#
# PLACE AT: backend/infra/init-db.sh
# REPLACES: infra/init-db.sql
#
# FIX: The original init-db.sql used psql variable syntax :'AUTH_DB_PASSWORD'
#      which requires --variable flags. Docker's entrypoint-initdb.d runs
#      plain psql without them — passwords were always empty strings silently.
#      This shell script uses $ENV_VAR syntax which Docker passes correctly.
#
# MOUNT IN docker-compose.yml:
#   db:
#     volumes:
#       - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
#
# REQUIRED ENV VARS (set in docker-compose or infra/.env):
#   POSTGRES_USER, POSTGRES_PASSWORD
#   AUTH_DB_PASSWORD, HEALTHCARE_DB_PASSWORD,
#   NOTIFICATION_DB_PASSWORD, AI_DB_PASSWORD

set -euo pipefail

echo "==> Hospyn: creating databases and users..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    -- Auth Service DB
    CREATE DATABASE hospyn_auth;
    CREATE USER auth_user WITH ENCRYPTED PASSWORD '${AUTH_DB_PASSWORD}';
    GRANT CONNECT ON DATABASE hospyn_auth TO auth_user;

    -- Healthcare Core DB
    CREATE DATABASE hospyn_healthcare;
    CREATE USER healthcare_user WITH ENCRYPTED PASSWORD '${HEALTHCARE_DB_PASSWORD}';
    GRANT CONNECT ON DATABASE hospyn_healthcare TO healthcare_user;

    -- Notification Service DB
    CREATE DATABASE hospyn_notifications;
    CREATE USER notification_user WITH ENCRYPTED PASSWORD '${NOTIFICATION_DB_PASSWORD}';
    GRANT CONNECT ON DATABASE hospyn_notifications TO notification_user;

    -- AI Service DB
    CREATE DATABASE hospyn_ai;
    CREATE USER ai_user WITH ENCRYPTED PASSWORD '${AI_DB_PASSWORD}';
    GRANT CONNECT ON DATABASE hospyn_ai TO ai_user;
EOSQL

echo "==> Databases created. Granting schema privileges..."

# Grant per-DB schema privileges
for entry in "hospyn_auth:auth_user" "hospyn_healthcare:healthcare_user" "hospyn_notifications:notification_user" "hospyn_ai:ai_user"; do
    DB="${entry%%:*}"
    USER="${entry##*:}"

    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<-EOSQL
        -- Enable UUID generation
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Schema access
        GRANT USAGE  ON SCHEMA public TO ${USER};
        GRANT CREATE ON SCHEMA public TO ${USER};

        -- Future tables/sequences created by this user
        ALTER DEFAULT PRIVILEGES
            IN SCHEMA public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${USER};

        ALTER DEFAULT PRIVILEGES
            IN SCHEMA public
            GRANT USAGE, SELECT ON SEQUENCES TO ${USER};
EOSQL

    echo "    [ok] ${DB} → ${USER}"
done

echo "==> Hospyn database initialisation complete."
