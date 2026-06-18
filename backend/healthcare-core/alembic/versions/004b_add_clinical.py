"""add clinical tables

Revision ID: 004b_add_clinical
Revises: 003_billing
Create Date: 2026-06-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004b_add_clinical"
down_revision = "003_billing"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # staff
    staffrole = postgresql.ENUM('receptionist', 'nurse', 'admin', 'lab_technician', 'pharmacist', name='staffrole')
    shiftstatus = postgresql.ENUM('on_duty', 'off_duty', 'on_break', name='shiftstatus')

    op.create_table(
        "staff",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("role", staffrole, nullable=False),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("shift_status", shiftstatus, server_default="off_duty", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # walkin_requests
    queuestate = postgresql.ENUM('waiting_reception', 'waiting_triage', 'in_triage', 'waiting_doctor', 'in_consultation', 'completed', 'cancelled', 'no_show', 'referred', 'emergency', name='queuestate')
    prioritylevel = postgresql.ENUM('low', 'normal', 'urgent', 'emergency', name='prioritylevel')
    walkinsource = postgresql.ENUM('qr_walkin', 'manual_reception', name='walkinsource')

    op.create_table(
        "walkin_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("gender", sa.String(20), nullable=False),
        sa.Column("reason_for_visit", sa.Text(), nullable=False),
        sa.Column("symptoms", sa.Text(), nullable=True),
        sa.Column("queue_state", queuestate, server_default="waiting_reception", nullable=False),
        sa.Column("priority_level", prioritylevel, server_default="normal", nullable=False),
        sa.Column("source", walkinsource, server_default="qr_walkin", nullable=False),
        sa.Column("queue_number", sa.Integer(), nullable=True),
        sa.Column("triage_notes", sa.Text(), nullable=True),
        sa.Column("triage_vitals_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("receptionist_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_nurse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_doctor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("billing_status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("billing_amount", sa.Integer(), server_default="50000", nullable=False),
        sa.Column("payment_method", sa.String(20), nullable=True),
        sa.Column("payment_reference", sa.String(100), nullable=True),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("triaged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("routed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consultation_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # prescriptions
    op.create_table(
        "prescriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("walkin_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("walkin_requests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # prescription_items
    op.create_table(
        "prescription_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("prescription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drug_name", sa.String(200), nullable=False),
        sa.Column("dosage", sa.String(100), nullable=False),
        sa.Column("frequency", sa.String(100), nullable=False),
        sa.Column("duration", sa.String(100), nullable=False),
        sa.Column("instructions", sa.String(500), nullable=True),
    )

def downgrade() -> None:
    pass
