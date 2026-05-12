"""create_required_enums

Revision ID: 42e7f9361f9c
Revises: 46739b368c27
Create Date: 2026-05-12 13:48:45.692869

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42e7f9361f9c'
down_revision: Union[str, Sequence[str], None] = '46739b368c27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create ENUM types if they don't exist
    enums = {
        "organizationtypeenum": "('hospital', 'pharmacy', 'lab')",
        "roleenum": "('patient', 'doctor', 'admin', 'nurse', 'pharmacy', 'hospital_admin')",
        "licensestatusenum": "('pending', 'verified', 'rejected')",
        "verificationstatusenum": "('pending', 'basic_verified', 'identity_verified', 'otp_verified', 'completed')",
        "bedstatusenum": "('available', 'reserved', 'occupied', 'cleaning', 'maintenance')",
        "queuestatusenum": "('checked_in', 'waiting_vitals', 'waiting_doctor', 'consultation', 'pharmacy', 'completed', 'cancelled')",
        "accesslevelenum": "('full', 'restricted', 'emergency', 'human_only')"
    }
    
    for name, values in enums.items():
        op.execute(sa.text(f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name}') THEN CREATE TYPE {name} AS ENUM {values}; END IF; END $$;"))

    # Drop defaults before casting
    op.execute(sa.text("ALTER TABLE hospitals ALTER COLUMN org_type DROP DEFAULT"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role DROP DEFAULT"))

    # Fix existing columns to use ENUMs
    op.execute(sa.text("ALTER TABLE hospitals ALTER COLUMN org_type TYPE organizationtypeenum USING org_type::organizationtypeenum"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role TYPE roleenum USING role::roleenum"))
    
    # Restore defaults with correct type casting
    op.execute(sa.text("ALTER TABLE hospitals ALTER COLUMN org_type SET DEFAULT 'hospital'::organizationtypeenum"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'patient'::roleenum"))


def downgrade() -> None:
    """Downgrade schema."""
    pass
