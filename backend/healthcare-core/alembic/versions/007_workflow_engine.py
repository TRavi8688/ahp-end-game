"""Workflow Engine: hospital-defined stages, patient tokens, doctor sessions

Revision ID: 007_workflow_engine
Revises: 006_lab_extend
Create Date: 2026-06-23 00:00:00.000000

Foundational schema for the dynamic Workflow Engine (per Hospain platform
plan): every hospital defines its own stage graph instead of a hardcoded
Reception->Nurse->Doctor->Billing flow. Patients get a Token that moves
through stages via Transitions. Includes DoctorSession + token locking to
match the Doctor App's existing contract (POST /queue/session/start,
POST /queue/token/advance -- both take no body; the server decides "next").
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "007_workflow_engine"
down_revision = "006_lab_extend"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- workflow_definitions ------------------------------------------------
    op.create_table(
        "workflow_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("token_prefix", sa.String(10), nullable=False, server_default="A"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_workflow_def_hospital", "workflow_definitions", ["hospital_id"])
    # Only one ACTIVE workflow per hospital at a time
    op.create_index(
        "ux_workflow_one_active_per_hospital", "workflow_definitions",
        ["hospital_id"], unique=True, postgresql_where=sa.text("is_active = true"),
    )

    # -- workflow_stages ------------------------------------------------------
    op.create_table(
        "workflow_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stage_key", sa.String(50), nullable=False),  # hospital-chosen slug, e.g. "triage_nurse"
        sa.Column("display_name", sa.String(100), nullable=False),
        # stage_type drives WHICH role/queue picks this up -- still hospital-named,
        # but the system needs to know "this is fundamentally a doctor-shaped stage"
        # to route it to the right dashboard/app.
        sa.Column("stage_type", sa.String(30), nullable=False),  # reception|nurse|doctor|lab|billing|custom
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("assigned_role", sa.String(30), nullable=True),  # e.g. "nurse", "doctor" -- JWT role allowed to act here
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assignment_strategy", sa.String(20), nullable=False, server_default="least_busy"),  # round_robin|least_busy|manual|department
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sla_minutes", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflow_definitions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_stage_workflow", "workflow_stages", ["workflow_id"])
    op.create_unique_constraint("ux_stage_key_per_workflow", "workflow_stages", ["workflow_id", "stage_key"])

    # -- workflow_transitions -------------------------------------------------
    op.create_table(
        "workflow_transitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_stage_id", postgresql.UUID(as_uuid=True), nullable=True),  # NULL = entry point
        sa.Column("to_stage_id", postgresql.UUID(as_uuid=True), nullable=True),    # NULL = workflow complete
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("condition_json", postgresql.JSONB(), nullable=True),  # reserved for future conditional branching
        sa.ForeignKeyConstraint(["workflow_id"], ["workflow_definitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_stage_id"], ["workflow_stages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_stage_id"], ["workflow_stages.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_transition_workflow", "workflow_transitions", ["workflow_id"])
    op.create_index("ix_transition_from_stage", "workflow_transitions", ["from_stage_id"])

    # -- patient_tokens --------------------------------------------------------
    op.create_table(
        "patient_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_code", sa.String(20), nullable=False),  # e.g. "A001"
        sa.Column("current_stage_id", postgresql.UUID(as_uuid=True), nullable=True),  # NULL once completed
        sa.Column("previous_stage_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="waiting"),  # waiting|in_progress|completed|cancelled
        # Multi-staff locking -- "Nurse A opens Patient #100, system locks; Nurse B sees 'Currently assigned to Nurse A'"
        sa.Column("locked_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, onupdate=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflow_definitions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["current_stage_id"], ["workflow_stages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["previous_stage_id"], ["workflow_stages.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_token_hospital_stage", "patient_tokens", ["hospital_id", "current_stage_id", "status"])
    op.create_index("ix_token_assigned_staff", "patient_tokens", ["assigned_staff_id"])
    op.create_unique_constraint("ux_token_code_per_hospital_per_day", "patient_tokens", ["hospital_id", "token_code"])

    # -- token_stage_history ---------------------------------------------------
    op.create_table(
        "token_stage_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("token_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stage_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("exited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["token_id"], ["patient_tokens.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stage_id"], ["workflow_stages.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_history_token", "token_stage_history", ["token_id"])

    # -- doctor_sessions -------------------------------------------------------
    # Matches Doctor App's POST /queue/session/start, which takes no body --
    # the doctor just clicks "Start Session" and the server tracks that
    # they're actively pulling from the queue.
    op.create_table(
        "doctor_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hospital_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),  # active|on_break|ended
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_doctor_session_doctor", "doctor_sessions", ["doctor_id", "status"])


def downgrade() -> None:
    op.drop_table("doctor_sessions")
    op.drop_table("token_stage_history")
    op.drop_table("patient_tokens")
    op.drop_table("workflow_transitions")
    op.drop_table("workflow_stages")
    op.drop_table("workflow_definitions")
