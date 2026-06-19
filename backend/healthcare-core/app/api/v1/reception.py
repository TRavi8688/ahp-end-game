"""
Reception API Routes (Staff Portal — Receptionist)

Endpoints:
    GET   /reception/queue                  - List pending walk-ins for this hospital
    POST  /reception/queue/manual           - Manual intake (patient without phone)
    PATCH /reception/queue/{id}/accept      - Accept and route to nurse or doctor
    PATCH /reception/queue/{id}/reject      - Reject / cancel walk-in
"""

import uuid
from typing import Annotated, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.walkin import (
    WalkInRequest,
    QueueState,
    PriorityLevel,
    ACTIVE_QUEUE_STATES,
)
from app.models.staff import Staff, StaffRole
from app.models.doctor import Doctor
from app.services.queue_service import (
    resolve_staff,
    transition_queue_state,
)
from shared.utils.responses import success_response
from shared.audit import log_audit_event

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ManualIntakeForm(BaseModel):
    hospyn_id: Optional[str] = Field(
        None, description="Optional Hospyn ID of an existing patient (e.g. PAT-999999)"
    )
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=30)
    age: int = Field(..., ge=0, le=150)
    gender: str = Field(..., min_length=1, max_length=20)
    reason_for_visit: str = Field(..., min_length=1, max_length=2000)
    symptoms: Optional[str] = Field(None, max_length=2000)
    priority_level: str = "normal"  # low / normal / urgent / emergency


class AcceptPayload(BaseModel):
    route_to: str = "triage"  # "triage" or "doctor"
    assigned_doctor_id: Optional[str] = None  # Required if route_to == "doctor"


class RejectPayload(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# GET Queue — Receptionist sees pending walk-ins for their hospital
# ---------------------------------------------------------------------------


@router.get("/queue")
async def get_reception_queue(
    current_user: Annotated[
        TokenPayload, Depends(require_role("staff", "admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch all walk-in requests in WAITING_RECEPTION state for this hospital.
    Sorted by: emergency first, then priority desc, then oldest first.
    """
    # Resolve staff → hospital scope
    staff = await _resolve_receptionist(db, current_user.sub)

    # Priority ordering: emergency > urgent > normal > low
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
            WalkInRequest.queue_state == QueueState.waiting_reception,
            WalkInRequest.deleted_at.is_(None),
        )
        .order_by(priority_order, WalkInRequest.created_at.asc())
    )
    walkins = result.scalars().all()

    # Also get counts for other queue states (for the dashboard HUD)
    all_active_states = [s.value for s in ACTIVE_QUEUE_STATES]
    counts_result = await db.execute(
        select(
            WalkInRequest.queue_state,
            func.count(WalkInRequest.id),
        )
        .where(
            WalkInRequest.hospital_id == staff.hospital_id,
            WalkInRequest.queue_state.in_(all_active_states),
            WalkInRequest.deleted_at.is_(None),
        )
        .group_by(WalkInRequest.queue_state)
    )
    state_counts = {row[0]: row[1] for row in counts_result.all()}

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
                "source": w.source.value,
                "queue_state": w.queue_state.value,
                "wait_minutes": int(wait_seconds / 60),
                "billing_status": w.billing_status,
                "billing_amount": w.billing_amount,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
        )

    return success_response(
        data={
            "queue": items,
            "total_pending": len(items),
            "state_counts": state_counts,
        }
    )


# ---------------------------------------------------------------------------
# POST Manual Intake — Receptionist enters patient details manually
# ---------------------------------------------------------------------------


@router.post("/queue/manual", status_code=status.HTTP_201_CREATED)
async def manual_intake(
    form: ManualIntakeForm,
    current_user: Annotated[
        TokenPayload, Depends(require_role("staff", "admin", "hospital_admin"))
    ],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receptionist manually creates a walk-in request for a patient
    who doesn't have a phone or can't scan QR.
    """
    staff = await _resolve_receptionist(db, current_user.sub)
    from app.services.reception_service import ReceptionService

    try:
        walkin = await ReceptionService.create_manual_walkin(
            db=db,
            hospital_id=staff.hospital_id,
            staff_id=staff.id,
            hospyn_id=form.hospyn_id,
            first_name=form.first_name,
            last_name=form.last_name,
            phone=form.phone,
            age=form.age,
            gender=form.gender,
            reason_for_visit=form.reason_for_visit,
            symptoms=form.symptoms,
            priority_level=form.priority_level,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    log_audit_event(
        action="manual_walkin_created",
        actor_id=current_user.sub,
        target_id=str(walkin.id),
        details={
            "hospital_id": str(staff.hospital_id),
            "source": "manual_reception",
            "queue_number": walkin.queue_number,
        },
        ip_address=request.client.host if request.client else None,
    )

    return success_response(
        data={
            "request_id": str(walkin.id),
            "queue_number": walkin.queue_number,
            "patient_name": walkin.full_name,
        },
        message="Patient added to queue manually.",
        status_code=201,
    )


# ---------------------------------------------------------------------------
# PATCH Accept — Route patient to Nurse (triage) or Doctor
# ---------------------------------------------------------------------------


class PaymentPayload(BaseModel):
    payment_method: str  # cash, card, upi
    transaction_reference: Optional[str] = Field(None, max_length=100)


@router.patch("/queue/{walkin_id}/accept")
async def accept_walkin(
    walkin_id: uuid.UUID,
    payload: AcceptPayload,
    current_user: Annotated[
        TokenPayload, Depends(require_role("staff", "admin", "hospital_admin"))
    ],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receptionist accepts a walk-in and routes to:
    - 'triage' → WAITING_TRIAGE (nurse picks up)
    - 'doctor' → WAITING_DOCTOR (skip triage, go direct to doctor)
    """
    staff = await _resolve_receptionist(db, current_user.sub)
    doc_id = (
        uuid.UUID(payload.assigned_doctor_id) if payload.assigned_doctor_id else None
    )

    from app.services.reception_service import ReceptionService

    try:
        walkin = await ReceptionService.route_walkin(
            db=db,
            walkin_id=walkin_id,
            hospital_id=staff.hospital_id,
            staff_id=staff.id,
            route_to=payload.route_to,
            assigned_doctor_id=doc_id,
            ip_address=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return success_response(
        data={
            "request_id": str(walkin.id),
            "new_state": walkin.queue_state.value,
            "routed_to": payload.route_to,
        },
        message=f"Patient routed to {payload.route_to}.",
    )


# ---------------------------------------------------------------------------
# PATCH Reject — Cancel walk-in
# ---------------------------------------------------------------------------


@router.patch("/queue/{walkin_id}/reject")
async def reject_walkin(
    walkin_id: uuid.UUID,
    payload: RejectPayload,
    current_user: Annotated[
        TokenPayload, Depends(require_role("staff", "admin", "hospital_admin"))
    ],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receptionist rejects/cancels a walk-in request."""
    staff = await _resolve_receptionist(db, current_user.sub)
    walkin = await _get_walkin_for_hospital(db, walkin_id, staff.hospital_id)

    if walkin.queue_state != QueueState.waiting_reception:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject: current state is '{walkin.queue_state.value}'.",
        )

    await transition_queue_state(
        db,
        walkin,
        QueueState.cancelled,
        current_user.sub,
        ip_address=request.client.host if request.client else None,
    )

    log_audit_event(
        action="walkin_rejected",
        actor_id=current_user.sub,
        target_id=str(walkin.id),
        details={"reason": payload.reason},
    )

    return success_response(message="Walk-in request rejected.")


# ---------------------------------------------------------------------------
# GET Patient Search — Quick autocomplete lookup
# ---------------------------------------------------------------------------


@router.get("/patients/search")
async def search_patients(
    q: str,
    current_user: Annotated[
        TokenPayload, Depends(require_role("staff", "admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Search registered patients in this hospital by phone or name."""
    staff = await _resolve_receptionist(db, current_user.sub)
    from app.models.patient import Patient

    query = (
        select(Patient)
        .where(
            Patient.hospital_id == staff.hospital_id,
            (Patient.first_name.ilike(f"%{q}%"))
            | (Patient.last_name.ilike(f"%{q}%"))
            | (Patient.phone.ilike(f"%{q}%"))
            | (Patient.email.ilike(f"%{q}%")),
            Patient.deleted_at.is_(None),
        )
        .limit(10)
    )

    result = await db.execute(query)
    patients = result.scalars().all()

    data = []
    for p in patients:
        data.append(
            {
                "id": str(p.id),
                "first_name": p.first_name,
                "last_name": p.last_name,
                "full_name": p.full_name,
                "phone": p.phone,
                "email": p.email,
                "age": (
                    (datetime.now().year - p.date_of_birth.year)
                    if p.date_of_birth
                    else None
                ),
                "gender": p.gender.value if p.gender else None,
                "blood_group": p.blood_group.value if p.blood_group else None,
                "known_allergies": p.known_allergies,
                "chronic_conditions": p.chronic_conditions,
                "emergency_contact_name": p.emergency_contact_name,
                "emergency_contact_phone": p.emergency_contact_phone,
            }
        )

    return success_response(data=data)


# ---------------------------------------------------------------------------
# GET Doctors availability & workload
# ---------------------------------------------------------------------------


@router.get("/doctors")
async def get_doctors_roster(
    current_user: Annotated[
        TokenPayload, Depends(require_role("staff", "admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Fetch active/on-duty doctors for this hospital and their queue workload."""
    staff = await _resolve_receptionist(db, current_user.sub)
    from app.models.doctor import DoctorStatus

    doc_query = select(Doctor).where(
        Doctor.hospital_id == staff.hospital_id,
        Doctor.status == DoctorStatus.active,
        Doctor.is_active == True,
        Doctor.deleted_at.is_(None),
    )
    result = await db.execute(doc_query)
    doctors = result.scalars().all()

    from app.services.routing_service import QueueRoutingService

    loads = await QueueRoutingService.get_doctor_loads(db, staff.hospital_id)

    data = []
    for d in doctors:
        data.append(
            {
                "id": str(d.id),
                "full_name": d.full_name,
                "specialization": d.specialization,
                "consultation_fee": d.consultation_fee,
                "years_of_experience": d.years_of_experience,
                "active_load": loads.get(d.id, 0),
                "avatar_url": d.avatar_url,
            }
        )

    return success_response(data=data)


# ---------------------------------------------------------------------------
# GET Signed QR Token
# ---------------------------------------------------------------------------


@router.get("/qr-token")
async def get_hospital_qr_token(
    current_user: Annotated[
        TokenPayload, Depends(require_role("staff", "admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Generate signed hospital QR token for walk-in forms."""
    staff = await _resolve_receptionist(db, current_user.sub)
    from app.services.queue_service import generate_walkin_token

    token = generate_walkin_token(str(staff.hospital_id))
    return success_response(data={"token": token})


# ---------------------------------------------------------------------------
# PATCH Pay walk-in request
# ---------------------------------------------------------------------------


@router.patch("/queue/{walkin_id}/pay")
async def pay_walkin(
    walkin_id: uuid.UUID,
    payload: PaymentPayload,
    current_user: Annotated[
        TokenPayload, Depends(require_role("staff", "admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Collect payment and mark walk-in status as paid."""
    staff = await _resolve_receptionist(db, current_user.sub)
    from app.services.reception_service import ReceptionService

    try:
        walkin = await ReceptionService.process_payment(
            db=db,
            walkin_id=walkin_id,
            hospital_id=staff.hospital_id,
            staff_id=staff.id,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return success_response(
        data={
            "id": str(walkin.id),
            "billing_status": walkin.billing_status,
        },
        message="Payment processed successfully.",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _resolve_receptionist(db: AsyncSession, user_id: str) -> Staff:
    """Resolve staff member. Accepts receptionist, admin, or hospital_admin roles."""
    staff = await resolve_staff(db, user_id, StaffRole.receptionist)
    if not staff:
        # Try admin role
        from app.services.queue_service import resolve_any_staff

        staff = await resolve_any_staff(db, user_id)
    if not staff:
        raise HTTPException(
            status_code=403,
            detail="Staff profile not found. You must be registered as hospital staff.",
        )
    return staff


async def _get_walkin_for_hospital(
    db: AsyncSession, walkin_id: uuid.UUID, hospital_id: uuid.UUID
) -> WalkInRequest:
    """Fetch a walk-in and enforce hospital-scoped access."""
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
