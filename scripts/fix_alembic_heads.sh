# SEC-6 FIX: Remove root-level /alembic/ folder and fix duplicate migration heads
# ================================================================================
# These are shell commands to run from the repo root.

# Step 1: Delete the entire root-level /alembic/ folder (old monolith migrations).
# These reference models that no longer exist and conflict with service-level chains.
rm -rf alembic/

# Step 2: For each service, verify there is exactly ONE head.
# Run these from the respective service directories:

cd backend/auth-service
alembic heads
# Must print exactly ONE revision ID. If it prints two, run step 3 below.

cd ../../backend/healthcare-core
alembic heads
# Same — must be exactly one head.

cd ../../backend/ai-service
alembic heads

# Step 3 (if multiple heads exist in any service):
# Merge them into a single linear chain. Example for healthcare-core:
cd backend/healthcare-core
alembic merge heads -m "merge_duplicate_heads"
# This creates a new migration file that has both heads as down_revisions.
# Commit the generated file.

# Step 4: Smoke test on a clean database (do this in a local/dev environment):
# docker run --rm -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:15 &
# sleep 3
# cd backend/auth-service
# alembic downgrade base && alembic upgrade head
# cd ../healthcare-core
# alembic downgrade base && alembic upgrade head
# cd ../ai-service
# alembic downgrade base && alembic upgrade head
