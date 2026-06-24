"""
Workflow Engine API

Three logical groups, mounted at three different prefixes (see router.py):

  /workflows/...  — hospital-level config (Owner/Admin define their stage graph)
  /tokens/...      — generic token creation + queue fetch (any stage type)
  /queue/...       — the EXACT contract Doctor App's clinicalService.js
                     already calls: POST /queue/session/start (no body),
                     POST /queue/token/advance (no body — "Call Next"),
                     POST /queue/token/{id}/complete

Per the Hospain platform plan: hospitals fully define their own stages —
there is no hardcoded Reception->Nurse->Doctor->Billing chain baked into
the API. A sane default is seeded automatically (see workflow_service.
ensure_default_workflow) so the system works before any hospital configures
something custom.

Tenant scoping: every endpoint resolves hospital_id from the staff/doctor
row tied to the JWT's user id — never trusts a hospital_id from the
frontend, per the platform plan's security requirement.
"""

import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import TokenPayload, require_role
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.staff import Staff, StaffRole
from app.models.workflow import (
    WorkflowDefinition, WorkflowStage, WorkflowTransition,
    PatientToken, DoctorSession,
)
from app.services import workflow_service
from app.services.queue_service import resolve_any_staff

workflow_router = APIRouter()
tokens_router = APIRouter()
queue_router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _resolve_doctor(db: AsyncSession, user_id: str) -> Doctor:
    result = await db.execute(
        select(Doctor).where(Doctor.user_id == uuid.UUID(user_id), Doctor.is_active == True, Doctor.deleted_at.is_(None))
    )
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=403, detail="Doctor profile not found.")
    return doctor


async def _resolve_hospital_id_for_staff_or_owner(db: AsyncSession, user_id: str) -> uuid.UUID:
    staff = await resolve_any_staff(db, user_id)
    if staff:
        return staff.hospital_id
    # Owners aren't in the staff table — check hospitals.owner_user_id
    from app.models.hospital import Hospital
    result = await db.execute(select(Hospital).where(Hospital.owner_user_id == uuid.UUID(user_id)))
    hospital = result.scalars().first()
    if hospital:
        return hospital.id
    raise HTTPException(status_code=403, detail="No hospital association found for this account.")


def _serialize_stage(s: WorkflowStage) -> dict:
    return {
        "id": str(s.id), "stage_key": s.stage_key, "display_name": s.display_name,
        "stage_type": s.stage_type, "order_index": s.order_index, "assigned_role": s.assigned_role,
        "assignment_strategy": s.assignment_strategy, "requires_approval": s.requires_approval,
        "sla_minutes": s.sla_minutes,
    }


def _serialize_workflow(w: WorkflowDefinition) -> dict:
    return {
        "id": str(w.id), "name": w.name, "token_prefix": w.token_prefix, "is_active": w.is_active,
        "stages": [_serialize_stage(s) for s in sorted(w.stages, key=lambda x: x.order_index)],
        "transitions": [
            {"id": str(t.id), "from_stage_id": str(t.from_stage_id) if t.from_stage_id else None,
             "to_stage_id": str(t.to_stage_id) if t.to_stage_id else None, "is_default": t.is_default}
            for t in w.transitions
        ],
    }


def _serialize_token(t: PatientToken) -> dict:
    return {
        "id": str(t.id), "token_code": t.token_code, "status": t.status,
        "patient_id": str(t.patient_id), "patient_name": t.patient.full_name if t.patient else None,
        "current_stage": _serialize_stage(t.current_stage) if t.current_stage else None,
        "assigned_staff_id": str(t.assigned_staff_id) if t.assigned_staff_id else None,
        "locked_by_staff_id": str(t.locked_by_staff_id) if t.locked_by_staff_id else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


async def _load_token(db: AsyncSession, token_id: uuid.UUID) -> PatientToken:
    result = await db.execute(
        select(PatientToken).where(PatientToken.id == token_id)
        .options(selectinload(PatientToken.patient), selectinload(PatientToken.current_stage))
    )
    token = result.scalars().first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found.")
    return token


# ── /workflows — hospital config (Owner / Admin) ─────────────────────────────

class StageInput(BaseModel):
    stage_key: str
    display_name: str
    stage_type: str  # reception|nurse|doctor|lab|billing|custom
    assigned_role: Optional[str] = None
    assignment_strategy: str = "least_busy"
    requires_approval: bool = False
    sla_minutes: Optional[int] = None


class SaveWorkflowPayload(BaseModel):
    name: str
    token_prefix: str = Field("A", max_length=10)
    stages: list[StageInput] = Field(..., min_length=1)


@workflow_router.get("/active")
async def get_active_workflow_endpoint(
    current_user: Annotated[TokenPayload, Depends(require_role("owner", "admin", "hospital_admin", "super_admin", "doctor", "nurse", "receptionist", "lab", "hr"))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_hospital_id_for_staff_or_owner(db, current_user.sub)
    workflow = await workflow_service.ensure_default_workflow(db, hospital_id)
    return {"data": _serialize_workflow(workflow)}


@workflow_router.post("")
async def save_workflow(
    payload: SaveWorkflowPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("owner", "admin", "hospital_admin", "super_admin"))],
    db: AsyncSession = Depends(get_db),
):
    """Replaces the hospital's active workflow with a freshly hospital-defined
    one: a straight linear chain through the given stages, in the order
    submitted (branching/conditional transitions aren't exposed via this
    endpoint yet — condition_json exists in the schema for that follow-up)."""
    hospital_id = await _resolve_hospital_id_for_staff_or_owner(db, current_user.sub)

    # Deactivate any current active workflow (only one active per hospital)
    result = await db.execute(
        select(WorkflowDefinition).where(WorkflowDefinition.hospital_id == hospital_id, WorkflowDefinition.is_active.is_(True))
    )
    for old in result.scalars().all():
        old.is_active = False
    await db.flush()

    workflow = WorkflowDefinition(
        id=uuid.uuid4(), hospital_id=hospital_id, name=payload.name,
        token_prefix=payload.token_prefix, is_active=True,
    )
    db.add(workflow)
    await db.flush()

    stage_rows = []
    for idx, s in enumerate(payload.stages):
        stage = WorkflowStage(
            id=uuid.uuid4(), workflow_id=workflow.id, stage_key=s.stage_key, display_name=s.display_name,
            stage_type=s.stage_type, order_index=idx, assigned_role=s.assigned_role,
            assignment_strategy=s.assignment_strategy, requires_approval=s.requires_approval, sla_minutes=s.sla_minutes,
        )
        db.add(stage)
        stage_rows.append(stage)
    await db.flush()

    prev = None
    for stage in stage_rows:
        db.add(WorkflowTransition(id=uuid.uuid4(), workflow_id=workflow.id, from_stage_id=prev.id if prev else None, to_stage_id=stage.id, is_default=True))
        prev = stage
    db.add(WorkflowTransition(id=uuid.uuid4(), workflow_id=workflow.id, from_stage_id=prev.id, to_stage_id=None, is_default=True))
    await db.flush()

    refreshed = await workflow_service.get_active_workflow(db, hospital_id)
    return {"data": _serialize_workflow(refreshed)}


# ── /tokens — generic token creation + queue fetch ───────────────────────────

class CreateTokenPayload(BaseModel):
    patient_id: str


@tokens_router.post("", status_code=status.HTTP_201_CREATED)
async def create_token_endpoint(
    payload: CreateTokenPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("receptionist", "admin", "hospital_admin", "owner", "super_admin"))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_hospital_id_for_staff_or_owner(db, current_user.sub)
    patient_result = await db.execute(select(Patient).where(Patient.id == uuid.UUID(payload.patient_id), Patient.hospital_id == hospital_id))
    patient = patient_result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found in your hospital.")
    token = await workflow_service.create_token(db, hospital_id, patient.id)
    full = await _load_token(db, token.id)
    return {"data": _serialize_token(full)}


@tokens_router.get("/queue")
async def get_queue_endpoint(
    stage_type: str,
    current_user: Annotated[TokenPayload, Depends(require_role("nurse", "doctor", "receptionist", "lab", "admin", "hospital_admin", "owner", "super_admin"))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_hospital_id_for_staff_or_owner(db, current_user.sub)
    result = await db.execute(
        select(PatientToken)
        .join(WorkflowStage, PatientToken.current_stage_id == WorkflowStage.id)
        .where(PatientToken.hospital_id == hospital_id, WorkflowStage.stage_type == stage_type, PatientToken.status.in_(["waiting", "in_progress"]))
        .order_by(PatientToken.created_at.asc())
        .options(selectinload(PatientToken.patient), selectinload(PatientToken.current_stage))
    )
    tokens = result.scalars().all()
    return {"data": [_serialize_token(t) for t in tokens]}


# ── /queue/session/* and /queue/token/* — Doctor App's exact contract ──────

@queue_router.post("/session/start")
async def start_queue_session(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _resolve_doctor(db, current_user.sub)
    # End any stale active session first (e.g. browser crashed without a clean logout)
    result = await db.execute(select(DoctorSession).where(DoctorSession.doctor_id == doctor.id, DoctorSession.status == "active"))
    for stale in result.scalars().all():
        stale.status = "ended"
        stale.ended_at = datetime.now(timezone.utc)

    session = DoctorSession(id=uuid.uuid4(), doctor_id=doctor.id, hospital_id=doctor.hospital_id, status="active")
    db.add(session)
    await db.flush()
    return {"data": {"session_id": str(session.id), "status": session.status, "started_at": session.started_at.isoformat()}}


@queue_router.post("/token/advance")
async def call_next_token(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """'Call Next' — matches Doctor App's POST /queue/token/advance, which
    sends no body: the server decides who's next, not the client."""
    doctor = await _resolve_doctor(db, current_user.sub)
    token = await workflow_service.claim_next_token(db, doctor.hospital_id, "doctor", doctor.id)
    if not token:
        return {"data": None, "message": "No patients waiting."}
    full = await _load_token(db, token.id)
    return {"data": _serialize_token(full)}


@queue_router.post("/token/{token_id}/complete")
async def complete_token(
    token_id: str,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _resolve_doctor(db, current_user.sub)
    token = await _load_token(db, uuid.UUID(token_id))
    if token.hospital_id != doctor.hospital_id:
        raise HTTPException(status_code=404, detail="Token not found in your hospital.")
    if token.locked_by_staff_id and token.locked_by_staff_id != doctor.id:
        raise HTTPException(status_code=409, detail="This token is locked by another staff member.")
    updated = await workflow_service.advance_token(db, token, acting_staff_id=doctor.id)
    full = await _load_token(db, updated.id)
    return {"data": _serialize_token(full)}
