"""add staff table

Revision ID: 0011_staff_table
Revises: 009_hospin_matrix_3
Create Date: 2026-06-26 00:00:00.000000

FIXED: app/models/staff.py (Staff, StaffRole, ShiftStatus) had no migration
anywhere in this repo -- there was no `staff` table in the database at all.
Every endpoint that queries it (nurse.py, reception.py, owner.py, staff.py,
and the new lab.py) would fail at the DB level for every single request.
This creates the table to exactly match the existing ORM model.

Note: this intentionally does NOT create `staff_shifts` or staff leave
tables -- those are queried defensively (wrapped in try/except, treated as
"table may not exist yet") by staff.py's HR-only shift-roster/leave
endpoints, which are out of scope here.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011_staff_table"
down_revision = "009_hospin_matrix_3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    staffrole = postgresql.ENUM(
        "receptionist", "nurse", "admin", "lab_technician", "pharmacist",
        name="staffrole",
        create_type=False
    )
    shiftstatus = postgresql.ENUM(
        "on_duty", "off_duty", "on_break",
        name="shiftstatus",
        create_type=False
    )
    
    # staffrole and shiftstatus were already created in 003b_core_models.py
    # We just need to ensure lab_technician is added to staffrole.
    op.execute("ALTER TYPE staffrole ADD VALUE IF NOT EXISTS 'lab_technician'")

    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if not inspector.has_table("staff"):
        op.create_table(
            "staff",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                       server_default=sa.text("gen_random_uuid()")),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("hospital_id", postgresql.UUID(as_uuid=True),
                       sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("first_name", sa.String(100), nullable=False),
            sa.Column("last_name", sa.String(100), nullable=False),
            sa.Column("phone", sa.String(30), nullable=True),
            sa.Column("role", staffrole, nullable=False),
            sa.Column("department", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
            sa.Column("shift_status", shiftstatus, nullable=False, server_default="off_duty"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )

        op.create_index("ix_staff_id", "staff", ["id"])
        op.create_index("ix_staff_user_id", "staff", ["user_id"])
        op.create_index("ix_staff_hospital_id", "staff", ["hospital_id"])
        op.create_index("ix_staff_role", "staff", ["role"])
        op.create_index("ix_staff_hospital_role", "staff", ["hospital_id", "role"])
        op.create_index("ix_staff_user_hospital", "staff", ["user_id", "hospital_id"], unique=True)


def downgrade() -> None:
    op.drop_table("staff")
    postgresql.ENUM(name="shiftstatus").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="staffrole").drop(op.get_bind(), checkfirst=True)
