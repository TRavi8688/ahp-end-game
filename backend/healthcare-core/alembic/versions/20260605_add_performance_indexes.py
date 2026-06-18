"""add performance indexes — FIXED

Revision ID: c3d5f7a9b2e4
Revises: a7f3e9c21b84
Create Date: 2026-06-05

FIX: down_revision was 'a7f3e9c21b84' — already correct.
     No change needed here. File included for completeness.
     Chain: d3e4f5a6b7c8 → b2c4e6f8a1d3 → a7f3e9c21b84 → c3d5f7a9b2e4
"""
from alembic import op
from sqlalchemy import text

revision = 'c3d5f7a9b2e4'
down_revision = 'a7f3e9c21b84'
branch_labels = None
depends_on = None

_INDEXES = [
    ('ix_appointments_hospital_doctor', 'appointments', ['hospital_id', 'doctor_id']),
    ('ix_appointments_hospital_date',   'appointments', ['hospital_id', 'scheduled_at']),
    ('ix_patients_hospital_id',         'patients',     ['hospital_id']),
    ('ix_medical_records_patient_created', 'medical_records', ['patient_id', 'created_at']),
    ('ix_patients_deleted_at',          'patients',     ['deleted_at']),
]


def _index_exists(connection, index_name: str) -> bool:
    result = connection.execute(
        text("SELECT 1 FROM pg_indexes WHERE indexname = :name"),
        {"name": index_name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    for index_name, table_name, columns in _INDEXES:
        if _index_exists(conn, index_name):
            print(f"  [skip] {index_name} already exists")
            continue
        try:
            with conn.begin_nested():
                op.create_index(index_name, table_name, columns)
            print(f"  [ok]   {index_name} created on {table_name}{columns}")
        except Exception as exc:
            print(f"  [warn] Could not create {index_name}: {exc}")


def downgrade() -> None:
    conn = op.get_bind()
    for index_name, table_name, _ in reversed(_INDEXES):
        if not _index_exists(conn, index_name):
            continue
        try:
            with conn.begin_nested():
                op.drop_index(index_name, table_name=table_name)
        except Exception as exc:
            print(f"  [warn] Could not drop {index_name}: {exc}")
