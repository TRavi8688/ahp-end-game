"""
Workflow Engine Service

Core logic for the dynamic, hospital-defined workflow system:
  - ensure_default_workflow(): seeds a sane default (Registration -> Nurse ->
    Doctor -> Billing -> Complete) for hospitals that haven't configured a
    custom one yet, so the system works out of the box.
  - create_token(): registers a patient into the active workflow at its
    entry stage, generating a token code.
  - advance_token(): moves a token to the next stage per the workflow's
    transitions (or marks it completed if there's no next stage).
  - claim_next_token(): the "Call Next" operation — finds the next
    unlocked, waiting token at a given stage_type for this hospital, locks
    it to the calling staff member, and returns it. This is what backs
    Doctor App's POST /queue/token/advance (which takes no body — the
    server decides who's "next").
  - Locking: a token can only be locked by one staff member at a time
    (Multi-Staff Locking System in the platform plan). Attempting to claim
    an already-locked token raises a clear 409, not a silent overwrite.

NOTE — current limitation, flagged honestly: assignment_strategy on
WorkflowStage (round_robin / least_busy / manual / department) is stored
but only "least_busy"-equivalent FIFO-by-wait-time is actually implemented
in claim_next_token() right now. Round-robin and department-based routing
need a follow-up pass — they require tracking last-assigned-staff per stage
and department membership respectively, which is more than this slice of
work covers.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workflow import (
    WorkflowDefinition, WorkflowStage, WorkflowTransition,
    PatientToken, TokenStageHistory,
)


# ── Default workflow (used until a hospital configures its own) ────────────

_DEFAULT_STAGES = [
    ("registration", "Registration", "reception", "reception", "manual"),
    ("nurse",        "Nurse",        "nurse",      "nurse",     "least_busy"),
    ("doctor",        "Doctor",      "doctor",     "doctor",    "least_busy"),
    ("billing",       "Billing",     "billing",    "receptionist", "manual"),
]


async def ensure_default_workflow(db: AsyncSession, hospital_id: uuid.UUID) -> WorkflowDefinition:
    """Returns the hospital's active workflow, creating the default
    Registration->Nurse->Doctor->Billing chain if none exists yet."""
    existing = await get_active_workflow(db, hospital_id)
    if existing:
        return existing

    workflow = WorkflowDefinition(
        id=uuid.uuid4(), hospital_id=hospital_id, name="Default Workflow",
        token_prefix="A", is_active=True,
    )
    db.add(workflow)
    await db.flush()

    stage_rows = []
    for idx, (key, name, stage_type, role, strategy) in enumerate(_DEFAULT_STAGES):
        stage = WorkflowStage(
            id=uuid.uuid4(), workflow_id=workflow.id, stage_key=key, display_name=name,
            stage_type=stage_type, order_index=idx, assigned_role=role, assignment_strategy=strategy,
        )
        db.add(stage)
        stage_rows.append(stage)
    await db.flush()

    # Entry transition (from_stage_id=NULL -> first stage), then linear chain,
    # then a terminal transition (last stage -> NULL = workflow complete).
    prev = None
    for stage in stage_rows:
        db.add(WorkflowTransition(
            id=uuid.uuid4(), workflow_id=workflow.id,
            from_stage_id=prev.id if prev else None, to_stage_id=stage.id, is_default=True,
        ))
        prev = stage
    db.add(WorkflowTransition(
        id=uuid.uuid4(), workflow_id=workflow.id,
        from_stage_id=prev.id, to_stage_id=None, is_default=True,
    ))
    await db.flush()

    return await get_active_workflow(db, hospital_id)


async def get_active_workflow(db: AsyncSession, hospital_id: uuid.UUID) -> Optional[WorkflowDefinition]:
    result = await db.execute(
        select(WorkflowDefinition)
        .where(WorkflowDefinition.hospital_id == hospital_id, WorkflowDefinition.is_active.is_(True))
        .options(selectinload(WorkflowDefinition.stages), selectinload(WorkflowDefinition.transitions))
    )
    return result.scalars().first()


async def get_next_stage_id(workflow: WorkflowDefinition, current_stage_id: Optional[uuid.UUID]) -> Optional[uuid.UUID]:
    """Looks up the default transition out of current_stage_id. Returns
    None if there's no further stage (workflow complete)."""
    candidates = [t for t in workflow.transitions if t.from_stage_id == current_stage_id]
    if not candidates:
        return None
    default = next((t for t in candidates if t.is_default), candidates[0])
    return default.to_stage_id


async def _next_token_code(db: AsyncSession, hospital_id: uuid.UUID, prefix: str) -> str:
    """Sequential per-hospital token code, e.g. A001, A002. Resets are not
    time-boxed yet (no daily reset) — flagging as a follow-up if you want
    tokens to restart at 001 each day rather than growing forever."""
    result = await db.execute(
        select(func.count()).select_from(PatientToken).where(PatientToken.hospital_id == hospital_id)
    )
    count = result.scalar() or 0
    return f"{prefix}{count + 1:03d}"


async def create_token(db: AsyncSession, hospital_id: uuid.UUID, patient_id: uuid.UUID) -> PatientToken:
    workflow = await ensure_default_workflow(db, hospital_id)
    entry_stage_id = await get_next_stage_id(workflow, None)
    if not entry_stage_id:
        raise HTTPException(status_code=500, detail="Workflow has no entry stage configured.")

    code = await _next_token_code(db, hospital_id, workflow.token_prefix)
    token = PatientToken(
        id=uuid.uuid4(), hospital_id=hospital_id, workflow_id=workflow.id, patient_id=patient_id,
        token_code=code, current_stage_id=entry_stage_id, status="waiting",
    )
    db.add(token)
    await db.flush()
    db.add(TokenStageHistory(id=uuid.uuid4(), token_id=token.id, stage_id=entry_stage_id))
    await db.flush()
    return token


async def claim_next_token(
    db: AsyncSession, hospital_id: uuid.UUID, stage_type: str, staff_id: uuid.UUID,
) -> Optional[PatientToken]:
    """'Call Next' — finds the oldest unlocked, waiting token whose current
    stage matches stage_type for this hospital, locks it to staff_id."""
    result = await db.execute(
        select(PatientToken)
        .join(WorkflowStage, PatientToken.current_stage_id == WorkflowStage.id)
        .where(
            PatientToken.hospital_id == hospital_id,
            WorkflowStage.stage_type == stage_type,
            PatientToken.status == "waiting",
            PatientToken.locked_by_staff_id.is_(None),
        )
        .order_by(PatientToken.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)  # prevents two doctors claiming the same token in a race
    )
    token = result.scalars().first()
    if not token:
        return None

    now = datetime.now(timezone.utc)
    token.status = "in_progress"
    token.assigned_staff_id = staff_id
    token.locked_by_staff_id = staff_id
    token.locked_at = now
    await db.flush()
    return token


async def lock_token(db: AsyncSession, token: PatientToken, staff_id: uuid.UUID) -> PatientToken:
    """Explicit lock (e.g. opening a patient record) — raises 409 if someone
    else already holds the lock, per the Multi-Staff Locking System spec."""
    if token.locked_by_staff_id and token.locked_by_staff_id != staff_id:
        raise HTTPException(
            status_code=409,
            detail="Currently assigned to another staff member.",
        )
    token.locked_by_staff_id = staff_id
    token.locked_at = datetime.now(timezone.utc)
    await db.flush()
    return token


async def advance_token(db: AsyncSession, token: PatientToken, acting_staff_id: Optional[uuid.UUID] = None) -> PatientToken:
    """Moves a token to the next stage per its workflow's transitions, or
    marks it 'completed' if there's no next stage. Closes out the current
    stage's history row and opens a new one for the next stage."""
    workflow_result = await db.execute(
        select(WorkflowDefinition)
        .where(WorkflowDefinition.id == token.workflow_id)
        .options(selectinload(WorkflowDefinition.transitions))
    )
    workflow = workflow_result.scalars().first()
    if not workflow:
        raise HTTPException(status_code=500, detail="Token references a workflow that no longer exists.")

    now = datetime.now(timezone.utc)

    # Close out the current stage's history entry
    if token.current_stage_id:
        hist_result = await db.execute(
            select(TokenStageHistory)
            .where(TokenStageHistory.token_id == token.id, TokenStageHistory.stage_id == token.current_stage_id, TokenStageHistory.exited_at.is_(None))
            .order_by(TokenStageHistory.entered_at.desc())
            .limit(1)
        )
        open_history = hist_result.scalars().first()
        if open_history:
            open_history.exited_at = now

    next_stage_id = await get_next_stage_id(workflow, token.current_stage_id)
    token.previous_stage_id = token.current_stage_id
    token.locked_by_staff_id = None
    token.locked_at = None

    if next_stage_id is None:
        token.current_stage_id = None
        token.status = "completed"
        token.completed_at = now
    else:
        token.current_stage_id = next_stage_id
        token.status = "waiting"
        token.assigned_staff_id = None
        db.add(TokenStageHistory(id=uuid.uuid4(), token_id=token.id, stage_id=next_stage_id, assigned_staff_id=acting_staff_id))

    await db.flush()
    return token
