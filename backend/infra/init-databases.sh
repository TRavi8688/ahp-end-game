#!/bin/bash
set -e

# This script runs on first Postgres startup to create isolated databases
# for each microservice.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE hospyn_auth_db;
    CREATE DATABASE hospyn_healthcare_db;
EOSQL

echo "✅ Databases hospyn_auth_db and hospyn_healthcare_db created successfully."
