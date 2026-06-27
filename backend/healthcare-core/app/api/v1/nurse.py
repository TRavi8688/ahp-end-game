"""
Nurse API Routes (Staff Portal — Nurse)

Endpoints:
    GET   /nurse/queue                     - List triage queue for this hospital
    PATCH /nurse/queue/{id}/start          - Pick up patient for triage
    PATCH /nurse/queue/{id}/complete       - Submit vitals and route to doctor
"""

import uuid
from typing import Annotated, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, case
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.walkin import WalkInRequest, QueueState, PriorityLevel
from app.models.staff import Staff, StaffRole
from app.models.doctor import Doctor
from app.services.queue_service import (
    resolve_staff,
    resolve_any_staff,
    transition_queue_state,
)
from app.services.triage_service import apply_triage_data
from shared.utils.responses import success_response
from shared.audit import log_audit_event

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class TriageCompletePayload(BaseModel):
    """Vitals and triage notes submitted by the nurse."""

    triage_notes: str = Field(..., min_length=1, max_length=5000)
    vitals: dict = Field(..., description="Vitals readings")
    assigned_doctor_id: Optional[str] = None  # Nurse can assign a specific doctor
    priority_override: Optional[str] = None  # Nurse can manually escalate


# ---------------------------------------------------------------------------
# GET Nurse Queue — WAITING_TRIAGE + IN_TRIAGE for this hospital
# ---------------------------------------------------------------------------


@router.get("/queue")
async def get_nurse_queue(
    current_user: Annotated[TokenPayload, Depends(require_role("staff", "nurse", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch all walk-in requests in WAITING_TRIAGE or IN_TRIAGE state.
    Sorted by priority and wait time.
    """
    staff = await _resolve_nurse(db, current_user.sub)

    priority_order = case(
        (WalkInRequest.priority_level == PriorityLevel.emergency, 0),
        (WalkInRequest.priority_level == PriorityLevel.urgent, 1),
        (WalkInRequest.priority_level == PriorityLevel.normal, 2),
        (WalkInRequest.priority_level == PriorityLevel.low, 3),
        else_=4,
    )

    result = await db.execute(
        select(WalkInRequest)
        .where(
            WalkInRequest.hospital_id == staff.hospital_id,
            WalkInRequest.queue_state.in_(
                [
                    QueueState.waiting_triage,
                    QueueState.in_triage,
                ]
            ),
            WalkInRequest.deleted_at.is_(None),
        )
        .order_by(priority_order, WalkInRequest.created_at.asc())
    )
    walkins = result.scalars().all()

    now = datetime.now(timezone.utc)
    items = []
    for w in walkins:
        created_at = (
            w.created_at.replace(tzinfo=timezone.utc)
            if w.created_at and w.created_at.tzinfo is None
            else w.created_at
        )
        wait_seconds = (now - created_at).total_seconds() if created_at else 0
        items.append(
            {
                "id": str(w.id),
                "queue_number": w.queue_number,
                "first_name": w.first_name,
                "last_name": w.last_name,
                "full_name": w.full_name,
                "phone": w.phone,
                "age": w.age,
                "gender": w.gender,
                "reason_for_visit": w.reason_for_visit,
                "symptoms": w.symptoms,
                "priority_level": w.priority_level.value,
                "queue_state": w.queue_state.value,
                "wait_minutes": int(wait_seconds / 60),
                "triage_vitals_json": w.triage_vitals_json,
                "triage_notes": w.triage_notes,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
        )

    return success_response(
        data={
            "queue": items,
            "total_pending": len(
                [i for i in items if i["queue_state"] == "waiting_triage"]
            ),
            "total_in_triage": len(
                [i for i in items if i["queue_state"] == "in_triage"]
            ),
        }
    )


# ---------------------------------------------------------------------------
# PATCH Start Triage — Nurse picks up patient
# ---------------------------------------------------------------------------


@router.patch("/queue/{walkin_id}/start")
async def start_triage(
    walkin_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role("staff", "nurse", "admin"))],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Nurse picks up a patient for triage. WAITING_TRIAGE → IN_TRIAGE."""
    staff = await _resolve_nurse(db, current_user.sub)
    walkin = await _get_walkin_for_hospital(db, walkin_id, staff.hospital_id)

    if walkin.queue_state != QueueState.waiting_triage:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start triage: current state is '{walkin.queue_state.value}'.",
        )

    walkin.assigned_nurse_id = staff.id

    await transition_queue_state(
        db,
        walkin,
        QueueState.in_triage,
        current_user.sub,
        ip_address=request.client.host if request.client else None,
    )

    return success_response(
        data={
            "request_id": str(walkin.id),
            "new_state": walkin.queue_state.value,
            "patient_name": walkin.full_name,
        },
        message="Triage started.",
    )


# ---------------------------------------------------------------------------
# PATCH Complete Triage — Submit vitals and route to doctor
# ---------------------------------------------------------------------------


@router.patch("/queue/{walkin_id}/complete")
async def complete_triage(
    walkin_id: uuid.UUID,
    payload: TriageCompletePayload,
    current_user: Annotated[TokenPayload, Depends(require_role("staff", "nurse", "admin"))],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Nurse completes triage. Stores vitals and triage notes.
    Auto-escalates priority if vitals are critical.
    Transitions: IN_TRIAGE → WAITING_DOCTOR.
    """
    staff = await _resolve_nurse(db, current_user.sub)
    walkin = await _get_walkin_for_hospital(db, walkin_id, staff.hospital_id)

    if walkin.queue_state != QueueState.in_triage:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete triage: current state is '{walkin.queue_state.value}'.",
        )

    # Apply triage data (vitals, notes, auto-escalation)
    try:
        apply_triage_data(
            walkin,
            vitals=payload.vitals,
            triage_notes=payload.triage_notes,
            nurse_id=str(staff.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Manual priority override by nurse
    if payload.priority_override:
        try:
            walkin.priority_level = PriorityLevel(payload.priority_override)
        except ValueError:
            pass

    # Assign doctor if specified
    if payload.assigned_doctor_id:
        doc_result = await db.execute(
            select(Doctor).where(
                Doctor.id == uuid.UUID(payload.assigned_doctor_id),
                Doctor.hospital_id == staff.hospital_id,
                Doctor.is_active == True,
                Doctor.deleted_at.is_(None),
            )
        )
        doctor = doc_result.scalars().first()
        if doctor:
            walkin.assigned_doctor_id = doctor.id

    await transition_queue_state(
        db,
        walkin,
        QueueState.waiting_doctor,
        current_user.sub,
        ip_address=request.client.host if request.client else None,
    )

    log_audit_event(
        action="triage_completed",
        actor_id=current_user.sub,
        target_id=str(walkin.id),
        details={
            "priority": walkin.priority_level.value,
            "vitals_recorded": bool(walkin.triage_vitals_json),
        },
    )

    return success_response(
        data={
            "request_id": str(walkin.id),
            "new_state": walkin.queue_state.value,
            "priority_level": walkin.priority_level.value,
            "auto_escalated": payload.priority_override is None
            and walkin.priority_level != PriorityLevel.normal,
        },
        message="Triage completed. Patient routed to doctor.",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _resolve_nurse(db: AsyncSession, user_id: str) -> Staff:
    staff = await resolve_staff(db, user_id, StaffRole.nurse)
    if not staff:
        staff = await resolve_any_staff(db, user_id)
    if not staff:
        raise HTTPException(status_code=403, detail="Nurse staff profile not found.")
        
    from app.models.hospital import Hospital
    hospital = await db.scalar(select(Hospital).where(Hospital.id == staff.hospital_id))
    if hospital and "nurse" not in hospital.enabled_modules:
        raise HTTPException(status_code=403, detail="Nurse triage module is not enabled.")
        
    return staff


async def _get_walkin_for_hospital(
    db: AsyncSession, walkin_id: uuid.UUID, hospital_id: uuid.UUID
) -> WalkInRequest:
    result = await db.execute(
        select(WalkInRequest).where(
            WalkInRequest.id == walkin_id,
            WalkInRequest.hospital_id == hospital_id,
            WalkInRequest.deleted_at.is_(None),
        )
    )
    walkin = result.scalars().first()
    if not walkin:
        raise HTTPException(
            status_code=404, detail="Walk-in request not found in your hospital."
        )
    return walkin
