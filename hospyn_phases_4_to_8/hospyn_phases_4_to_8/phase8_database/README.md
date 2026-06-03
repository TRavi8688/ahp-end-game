# Phase 8 — Database & Migration Fixes

## What This Fixes
- **Duplicate Alembic revision ID '001'** — both `001_initial_schema.py` and `001_dpdp_compliance.py` had the same revision, causing Alembic to fail
- **Test migration in production** — `da8862faef42_verification_test.py` removed from the migration chain
- **Missing queue_events table** — the WebSocket queue system had no persistent audit trail

---

## Step-by-Step Application

### 1. Fix the duplicate revision IDs (automated script)

```bash
# Run from your repo root
python phase8_database/fix_duplicate_migration_ids.py
```

This script automatically:
- Changes `001_dpdp_compliance.py` revision from `'001'` → `'001_dpdp'`
- Sets its `down_revision` from `None` → `'001'` (chains it after initial schema)
- Removes `da8862faef42_verification_test.py` from the migration chain

If you prefer to do it manually, open `alembic/versions/001_dpdp_compliance.py` and change:
```python
# BEFORE:
revision = '001'
down_revision = None

# AFTER:
revision = '001_dpdp'
down_revision = '001'
```

### 2. Add the queue_events migration

```bash
# Step 1: Check your current alembic head
alembic history | head -3
# Note the revision ID of the current head (e.g., 'abc123def456')

# Step 2: Copy the migration file
cp phase8_database/alembic/versions/a1b2c3d4e5f6_add_queue_events_tracking_table.py \
   alembic/versions/a1b2c3d4e5f6_add_queue_events_tracking_table.py

# Step 3: Edit the file and set down_revision to your current head
# Open the file and change:
#   down_revision = None
# To:
#   down_revision = 'YOUR_CURRENT_HEAD_REVISION_ID'
```

### 3. Verify and apply

```bash
# Verify chain is clean (no duplicate heads)
alembic history --verbose
alembic heads          # MUST show exactly 1 head

# If multiple heads appear, merge them:
alembic merge heads -m "merge_migration_heads"

# Apply all migrations
alembic upgrade head

# Verify the queue_events table was created
psql $DATABASE_URL -c "\d queue_events"
```

### 4. Commit
```bash
git add alembic/versions/
git commit -m "fix(db): repair alembic chain — fix duplicate 001 revision, add queue_events table"
```

---

## Manual Steps Required
- Edit `down_revision` in the queue_events migration file to match your current head
- Run `alembic upgrade head` with a working DATABASE_URL

## Verify
```bash
alembic heads
# Expected output: exactly ONE line like:
# a1b2c3d4e5f6 (head)

alembic current
# Expected: a1b2c3d4e5f6 (head)
```
