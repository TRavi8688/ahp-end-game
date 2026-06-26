import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "003b_core_models"
down_revision = "003_billing"
branch_labels = None
depends_on = None

# ENUM definitions
queuestate = postgresql.ENUM(
    "waiting_reception", "waiting_triage", "in_triage", "waiting_doctor",
    "in_consultation", "completed", "cancelled", "no_show", "referred", "emergency",
    name="queuestate", create_type=False
)
prioritylevel = postgresql.ENUM("low", "normal", "urgent", "emergency", name="prioritylevel", create_type=False)
walkinsource = postgresql.ENUM("qr_walkin", "manual_reception", name="walkinsource", create_type=False)

staffrole = postgresql.ENUM("doctor", "nurse", "receptionist", "pharmacist", "admin", "superadmin", name="staffrole", create_type=False)
shiftstatus = postgresql.ENUM("on_duty", "off_duty", "on_break", "emergency_duty", name="shiftstatus", create_type=False)

def upgrade() -> None:
    # 1. Create Enums
    queuestate.create(op.get_bind(), checkfirst=True)
    prioritylevel.create(op.get_bind(), checkfirst=True)
    walkinsource.create(op.get_bind(), checkfirst=True)
    staffrole.create(op.get_bind(), checkfirst=True)
    shiftstatus.create(op.get_bind(), checkfirst=True)

    # 2. Create staff
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
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("shift_status", shiftstatus, nullable=False, server_default="off_duty"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_staff_user_id", "staff", ["user_id"])
    op.create_index("ix_staff_hospital_id", "staff", ["hospital_id"])

    # 3. Create walkin_requests
    op.create_table(
        "walkin_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("age", sa.Integer, nullable=False),
        sa.Column("gender", sa.String(20), nullable=False),
        sa.Column("reason_for_visit", sa.Text, nullable=False),
        sa.Column("symptoms", sa.Text, nullable=True),
        sa.Column("queue_state", queuestate, nullable=False, server_default="waiting_reception"),
        sa.Column("priority_level", prioritylevel, nullable=False, server_default="normal"),
        sa.Column("source", walkinsource, nullable=False, server_default="qr_walkin"),
        sa.Column("queue_number", sa.Integer, nullable=True),
        sa.Column("triage_notes", sa.Text, nullable=True),
        sa.Column("triage_vitals_json", sa.JSON, nullable=True),
        sa.Column("receptionist_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_nurse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_doctor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("billing_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("billing_amount", sa.Integer, nullable=False, server_default="50000"),
        sa.Column("payment_method", sa.String(20), nullable=True),
        sa.Column("payment_reference", sa.String(100), nullable=True),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("triaged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("routed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consultation_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_walkin_hospital_state", "walkin_requests", ["hospital_id", "queue_state"])
    op.create_index("ix_walkin_priority_created", "walkin_requests", ["priority_level", "created_at"])
    op.create_index("ix_walkin_assigned_doctor", "walkin_requests", ["assigned_doctor_id"])
    op.create_index("ix_walkin_assigned_nurse", "walkin_requests", ["assigned_nurse_id"])
    op.create_index("ix_walkin_phone_hospital", "walkin_requests", ["phone", "hospital_id"])

    # 4. Create queue_events
    op.create_table(
        "queue_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("walkin_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("walkin_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("old_status", sa.String(50), nullable=False),
        sa.Column("new_status", sa.String(50), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_queue_events_walkin_request_id", "queue_events", ["walkin_request_id"])

    # 5. Create payment_transactions
    op.create_table(
        "payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("walkin_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("walkin_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("payment_method", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("transaction_reference", sa.String(100), nullable=True),
        sa.Column("collected_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_payment_transactions_walkin_request_id", "payment_transactions", ["walkin_request_id"])

    # 6. Create prescriptions
    op.create_table(
        "prescriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("walkin_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("walkin_requests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_prescriptions_patient_id", "prescriptions", ["patient_id"])
    op.create_index("ix_prescriptions_doctor_id", "prescriptions", ["doctor_id"])
    op.create_index("ix_prescriptions_walkin_request_id", "prescriptions", ["walkin_request_id"])

    # 7. Create prescription_items
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
    op.create_index("ix_prescription_items_prescription_id", "prescription_items", ["prescription_id"])

def downgrade() -> None:
    pass
