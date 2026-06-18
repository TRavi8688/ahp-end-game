"""make appointments.patient_id nullable for anonymous walk-ins

Revision ID: d3e4f5a6b7c8
Revises: c2g03dd759f5
Create Date: 2026-06-07 14:50:00.000000

The appointments table was created with patient_id NOT NULL in 001_initial.py.
However, walk-in patients who have not registered in the system are anonymous —
they have no Patient record, so walkin_requests.patient_id is None.

When a doctor starts a consultation for such an anonymous walk-in, the code
(doctor_queue.py:start_consultation) creates an Appointment with patient_id=None,
which correctly reflects the lack of a linked patient. The NOT NULL constraint
causes a DB IntegrityError.

Fix: ALTER appointments.patient_id to be nullable so walk-in-only appointments
can be stored without a patient FK until the patient optionally registers.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "c2g03dd759f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Allow NULL in appointments.patient_id so anonymous walk-in appointments
    # can be stored without a linked Patient record.
    op.alter_column(
        "appointments",
        "patient_id",
        existing_type=sa.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    # WARNING: This will fail if any rows have patient_id = NULL.
    # Run: UPDATE appointments SET patient_id = <some_uuid> WHERE patient_id IS NULL;
    # before running downgrade.
    op.alter_column(
        "appointments",
        "patient_id",
        existing_type=sa.UUID(as_uuid=True),
        nullable=False,
    )
