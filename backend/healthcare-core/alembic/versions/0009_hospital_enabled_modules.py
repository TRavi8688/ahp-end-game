"""add modular os tables and enabled_modules column

Revision ID: 0009_hospital_enabled_modules
Revises: 0008_pharmacy_ledger_network
Create Date: 2026-06-19 19:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_hospital_enabled_modules"
down_revision = "0008_pharmacy_ledger_network"
branch_labels = None
depends_on = None

# Enum types
queue_priority_enum = postgresql.ENUM('NORMAL', 'VIP', 'EMERGENCY', name='queuepriority', create_type=False)
queue_status_enum = postgresql.ENUM(
    'waiting_reception', 'waiting_triage', 'waiting_doctor', 'consulting',
    'waiting_lab', 'waiting_pharmacy', 'waiting_billing', 'completed', 'rejected',
    name='queuestatus', create_type=False
)
bed_status_enum = postgresql.ENUM('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', name='bedstatus', create_type=False)


def upgrade() -> None:
    # 1. Add enabled_modules to hospitals
    op.add_column(
        "hospitals",
        sa.Column(
            "enabled_modules",
            postgresql.JSONB,
            nullable=False,
            server_default='["reception", "nurse", "doctor", "pharmacy", "laboratory", "billing", "ward", "admin"]'
        ),
    )

    # Create enums
    queue_priority_enum.create(op.get_bind(), checkfirst=True)
    queue_status_enum.create(op.get_bind(), checkfirst=True)
    bed_status_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create hospital_chains table
    op.create_table(
        "hospital_chains",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 3. Create hospital_modules table
    op.create_table(
        "hospital_modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("module_name", sa.String(100), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("config", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_unique_constraint("uq_hospital_module_name", "hospital_modules", ["hospital_id", "module_name"])
    op.create_index("ix_hospital_modules_hospital_id", "hospital_modules", ["hospital_id"])

    # 4. Create patient_queues table
    op.create_table(
        "patient_queues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("gender", sa.String(10), nullable=False),
        sa.Column("visit_reason", sa.Text(), nullable=True),
        sa.Column("priority", queue_priority_enum, nullable=False, server_default="NORMAL"),
        sa.Column("status", queue_status_enum, nullable=False, server_default="waiting_reception"),
        sa.Column("token_number", sa.String(20), nullable=False),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("department_id", sa.String(50), nullable=True),
        sa.Column("estimated_waiting_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_patient_queues_hospital_id", "patient_queues", ["hospital_id"])
    op.create_index("ix_patient_queues_status", "patient_queues", ["status"])

    # 5. Create beds table
    op.create_table(
        "beds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("ward_name", sa.String(100), nullable=False),
        sa.Column("bed_number", sa.String(20), nullable=False),
        sa.Column("status", bed_status_enum, nullable=False, server_default="AVAILABLE"),
        sa.Column("daily_charge_paisa", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_unique_constraint("uq_hospital_ward_bed", "beds", ["hospital_id", "ward_name", "bed_number"])
    op.create_index("ix_beds_hospital_id", "beds", ["hospital_id"])

    # 6. Create ward_admissions table
    op.create_table(
        "ward_admissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bed_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("beds.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("admitted_by_doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("admitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("discharged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("discharge_summary", sa.Text(), nullable=True),
    )

    # 7. Create audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_id", sa.String(100), nullable=True),
        sa.Column("previous_state", postgresql.JSONB, nullable=True),
        sa.Column("new_state", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_audit_logs_hospital_id", "audit_logs", ["hospital_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("ward_admissions")
    op.drop_table("beds")
    op.drop_table("patient_queues")
    op.drop_table("hospital_modules")
    op.drop_table("hospital_chains")

    bed_status_enum.drop(op.get_bind(), checkfirst=True)
    queue_status_enum.drop(op.get_bind(), checkfirst=True)
    queue_priority_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_column("hospitals", "enabled_modules")
