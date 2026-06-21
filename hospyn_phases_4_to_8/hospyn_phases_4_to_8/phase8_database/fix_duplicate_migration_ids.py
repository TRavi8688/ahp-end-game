#!/usr/bin/env python3
"""
fix_duplicate_migration_ids.py
Phase 8 Fix: Fix the duplicate Alembic revision ID '001' issue.

The audit found that both files have revision = '001':
  - alembic/versions/001_initial_schema.py
  - alembic/versions/001_dpdp_compliance.py

This causes Alembic to fail with "Multiple head revisions are present".

USAGE:
  python fix_duplicate_migration_ids.py

This script will:
  1. Show you the current migration chain issues
  2. Fix 001_dpdp_compliance.py to use revision '001_dpdp' and chain after '001'
  3. Remove da8862faef42_verification_test.py (test migration — not for production)
  4. Verify the chain is clean

PREREQUISITES:
  pip install alembic

RUN FROM YOUR REPO ROOT:
  python fix_duplicate_migration_ids.py
"""

import os
import re
import subprocess
import sys

REPO_ROOT = os.getcwd()
ALEMBIC_VERSIONS_DIR = os.path.join(REPO_ROOT, "alembic", "versions")


def run_cmd(cmd, check=True):
    """Run a shell command and return output."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"ERROR running: {cmd}")
        print(result.stderr)
    return result


def fix_dpdp_compliance_revision():
    """Fix 001_dpdp_compliance.py to have a unique revision ID."""
    filepath = os.path.join(ALEMBIC_VERSIONS_DIR, "001_dpdp_compliance.py")

    if not os.path.exists(filepath):
        print(f"  [SKIP] {filepath} not found — may already be fixed or renamed.")
        return False

    with open(filepath, "r") as f:
        content = f.read()

    # Check if already fixed
    if "revision = '001_dpdp'" in content:
        print("  [OK] 001_dpdp_compliance.py already has unique revision ID.")
        return True

    # Fix revision ID
    content = re.sub(
        r"revision\s*=\s*['\"]001['\"]",
        "revision = '001_dpdp'",
        content
    )

    # Fix down_revision to point to initial schema
    if "down_revision = None" in content or "down_revision=None" in content:
        content = re.sub(
            r"down_revision\s*=\s*None",
            "down_revision = '001'",
            content
        )
    elif "down_revision = '001'" not in content:
        # If it has a different down_revision, chain it after 001
        content = re.sub(
            r"down_revision\s*=\s*['\"].*?['\"]",
            "down_revision = '001'",
            content,
            count=1
        )

    with open(filepath, "w") as f:
        f.write(content)

    print(f"  [FIXED] {filepath}")
    print("          revision: '001' → '001_dpdp'")
    print("          down_revision: None → '001'")
    return True


def remove_test_migration():
    """Remove the test migration file that should not be in production."""
    test_migration = os.path.join(ALEMBIC_VERSIONS_DIR, "da8862faef42_verification_test.py")

    if not os.path.exists(test_migration):
        print("  [SKIP] da8862faef42_verification_test.py not found — already removed.")
        return

    # Git remove (from tracking + filesystem)
    result = run_cmd(f"git rm {test_migration}", check=False)
    if result.returncode == 0:
        print(f"  [REMOVED] da8862faef42_verification_test.py (git rm)")
    else:
        # Not tracked by git — just delete
        os.remove(test_migration)
        print(f"  [REMOVED] da8862faef42_verification_test.py (file delete)")


def verify_alembic_chain():
    """Run alembic history to verify the chain is clean."""
    print("\n  Verifying Alembic migration chain...")

    history = run_cmd("alembic history --verbose", check=False)
    if history.returncode != 0:
        print("  [WARNING] Could not run alembic history — check DATABASE_URL is set")
        print("  Run manually: alembic history")
        return

    heads = run_cmd("alembic heads", check=False)
    if heads.returncode == 0:
        head_count = len(heads.stdout.strip().split("\n"))
        if head_count == 1:
            print(f"  [OK] Alembic chain has exactly 1 head: {heads.stdout.strip()}")
        else:
            print(f"  [WARNING] Multiple heads detected ({head_count}):")
            print(heads.stdout)
            print("\n  To fix: run `alembic merge heads -m 'merge_heads'`")
    else:
        print("  Could not verify heads — check your alembic.ini DATABASE_URL")


def main():
    print("=" * 60)
    print("Phase 8: Alembic Migration Chain Fix")
    print("=" * 60)

    if not os.path.exists(ALEMBIC_VERSIONS_DIR):
        print(f"ERROR: {ALEMBIC_VERSIONS_DIR} not found.")
        print("Run this script from your repo root.")
        sys.exit(1)

    print("\n1. Fixing duplicate revision ID in 001_dpdp_compliance.py...")
    fix_dpdp_compliance_revision()

    print("\n2. Removing test migration from production alembic chain...")
    remove_test_migration()

    print("\n3. Verifying migration chain...")
    verify_alembic_chain()

    print("\n" + "=" * 60)
    print("NEXT STEPS:")
    print("  1. Review the changes: git diff alembic/")
    print("  2. Run: alembic history  (verify clean chain)")
    print("  3. Run: alembic heads    (verify exactly 1 head)")
    print("  4. Copy the new queue_events migration file:")
    print("     cp phase8_database/alembic/versions/a1b2c3d4e5f6_add_queue_events_tracking_table.py \\")
    print("        alembic/versions/")
    print("     Then set down_revision to your current head revision ID")
    print("  5. Run: alembic upgrade head")
    print("  6. Commit: git add alembic/ && git commit -m 'fix: repair alembic migration chain'")
    print("=" * 60)


if __name__ == "__main__":
    main()
