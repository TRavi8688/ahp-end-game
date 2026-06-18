"""
tests/test_migration_integrity.py

Runs against a fresh test database to verify the full migration chain works
end-to-end. Executes in CI before any deployment artifact is built.

Requirements:
  - TEST_DATABASE_URL env var pointing at an empty postgres DB
  - alembic on PATH (installed in the CI venv)
  - Repo root must have alembic.ini
"""
import os
import subprocess
import sys

import pytest

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://hospyn_test:test_password@localhost:5432/hospyn_test",
)

# Alembic env vars used by alembic.ini (adjust key name to match your config)
_ALEMBIC_ENV = {**os.environ, "DATABASE_URL": TEST_DATABASE_URL}


def _run_alembic(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["alembic", *args],
        capture_output=True,
        text=True,
        env=_ALEMBIC_ENV,
    )


# ---------------------------------------------------------------------------
# Migration chain tests
# ---------------------------------------------------------------------------

class TestMigrationIntegrity:
    def test_migrations_run_from_scratch(self):
        """
        alembic upgrade head must succeed on a completely empty database.
        This is the exact command run during production deployments.
        """
        # Start from a clean slate
        down = _run_alembic("downgrade", "base")
        # downgrade base may fail if already empty — that's fine
        _ = down  # noqa: intentionally ignored

        result = _run_alembic("upgrade", "head")
        assert result.returncode == 0, (
            f"'alembic upgrade head' failed on fresh DB.\n"
            f"STDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}"
        )
        # Verify the output mentions applying migrations (not a no-op on broken chain)
        assert "ERROR" not in result.stderr, (
            f"Alembic stderr contains ERROR:\n{result.stderr}"
        )

    def test_migrations_can_downgrade_one_step(self):
        """
        alembic downgrade -1 must not crash.
        We only test one step here — a full base downgrade would take too long
        and is tested separately in local dev.
        """
        result = _run_alembic("downgrade", "-1")
        assert result.returncode == 0, (
            f"'alembic downgrade -1' failed.\n"
            f"STDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}"
        )
        # Re-apply so subsequent tests see a fully upgraded DB
        reup = _run_alembic("upgrade", "head")
        assert reup.returncode == 0, "Could not re-apply head after downgrade"

    def test_alembic_check_passes(self):
        """
        alembic check must pass — schema in DB must match what migrations define.
        If this fails, someone edited a deployed migration file or the models
        drifted without a new migration being created.
        """
        result = _run_alembic("check")
        assert result.returncode == 0, (
            f"'alembic check' detected schema drift.\n"
            f"STDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}\n\n"
            f"Fix: run 'alembic revision --autogenerate -m \"fix drift\"' "
            f"and review the generated file."
        )

    def test_exactly_one_head(self):
        """
        alembic heads must report exactly one head.
        Multiple heads mean the chain has diverged and 'upgrade head' is ambiguous.
        """
        result = _run_alembic("heads")
        assert result.returncode == 0, f"alembic heads failed: {result.stderr}"

        head_lines = [
            line for line in result.stdout.splitlines()
            if line.strip() and "(head)" in line
        ]
        assert len(head_lines) == 1, (
            f"Expected exactly 1 head, found {len(head_lines)}:\n"
            + "\n".join(head_lines)
            + "\n\nFix: run 'alembic merge -m \"merge heads\" <rev_a> <rev_b>'"
        )

    def test_downgrade_base_and_reupgrade(self):
        """
        Full round-trip: downgrade to base (empty schema) then upgrade head again.
        Slow — mark with @pytest.mark.slow and skip in quick CI runs.
        Ensures every downgrade() function is correct, not just upgrade().
        """
        down = _run_alembic("downgrade", "base")
        assert down.returncode == 0, (
            f"'alembic downgrade base' failed.\n{down.stdout}\n{down.stderr}"
        )

        up = _run_alembic("upgrade", "head")
        assert up.returncode == 0, (
            f"'alembic upgrade head' failed after full downgrade.\n{up.stdout}\n{up.stderr}"
        )

    def test_current_revision_is_head(self):
        """
        After running upgrade head, alembic current must show (head).
        """
        _run_alembic("upgrade", "head")  # ensure we're at head

        result = _run_alembic("current")
        assert result.returncode == 0
        assert "(head)" in result.stdout, (
            f"DB is not at head after upgrade head:\n{result.stdout}"
        )
