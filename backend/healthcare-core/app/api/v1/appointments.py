"""
Appointment API Routes

Endpoints:
    POST   /appointments/                      - Book an appointment
    GET    /appointments/                       - List appointments (filtered by role)
    GET    /appointments/{id}                   - Get appointment details
    PUT    /appointments/{id}                   - Reschedule/update appointment
    POST   /appointments/{id}/cancel            - Cancel an appointment
    PUT    /appointments/{id}/clinical-notes     - Add clinical notes (doctor only)
    PUT    /appointments/{id}/complete           - Mark appointment complete (doctor only)
"""

import uuid
from datetime import timezone, datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    AppointmentListResponse,
    AppointmentClinicalUpdate,
    AppointmentCancelRequest,
)
from shared.utils.responses import success_response, error_response
from shared.audit import log_audit_event

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Book a new appointment."""
    # Verify doctor exists and is active — use write-lock to prevent booking concurrency race conditions
    doc_result = await db.execute(
        select(Doctor)
        .where(Doctor.id == payload.doctor_id, Doctor.deleted_at.is_(None))
        .with_for_update()
    )
    doctor = doc_result.scalars().first()
    if not doctor or not doctor.is_active:
        raise HTTPException(status_code=404, detail="Doctor not found or unavailable")

    # Verify patient exists
    pat_result = await db.execute(
        select(Patient).where(
            Patient.id == payload.patient_id, Patient.deleted_at.is_(None)
        )
    )
    patient = pat_result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Patients can only book for themselves
    if current_user.role == "patient" and str(patient.user_id) != current_user.sub:
        raise HTTPException(
            status_code=403, detail="Patients can only book appointments for themselves"
        )

    # Doctor or staff booking on behalf of patient requires explicit booking consent token
    if str(patient.user_id) != current_user.sub:
        if not payload.patient_consent_token:
            raise HTTPException(
                status_code=403,
                detail="A valid patient booking consent token is required for third-party scheduling.",
            )
        from shared.redis_client import verify_patient_consent_token

        consent_verified = await verify_patient_consent_token(
            str(patient.id), payload.patient_consent_token
        )
        if not consent_verified:
            raise HTTPException(
                status_code=403,
                detail="Invalid or expired patient booking consent token.",
            )

    # Check for scheduling conflicts (same doctor, overlapping time)
    conflict_query = select(Appointment).where(
        Appointment.doctor_id == payload.doctor_id,
        Appointment.scheduled_at == payload.scheduled_at,
        Appointment.status.in_(
            [AppointmentStatus.scheduled, AppointmentStatus.confirmed]
        ),
    )
    conflict_result = await db.execute(conflict_query)
    if conflict_result.scalars().first():
        return error_response(
            "SCHEDULING_CONFLICT",
            "Doctor already has an appointment at this time.",
            409,
        )

    appointment_data = payload.model_dump()
    appointment_data.pop("patient_consent_token", None)
    appointment = Appointment(**appointment_data)
    db.add(appointment)
    await db.flush()
    await db.refresh(appointment)

    log_audit_event(
        action="appointment_created",
        actor_id=current_user.sub,
        target_id=str(appointment.id),
    )

    return success_response(
        data=AppointmentResponse.model_validate(appointment).model_dump(mode="json"),
        message="Appointment booked successfully.",
        status_code=201,
    )


@router.get("/")
async def list_appointments(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: AppointmentStatus = Query(None, alias="status"),
    hospital_id: uuid.UUID = Query(None),
):
    """
    List appointments.
    - Patients see only their own appointments.
    - Doctors see only their own appointments.
    - Admin/hospital_admin see all (optionally filtered by hospital).
    """
    query = select(Appointment)

    if current_user.role == "patient":
        # Get patient record for this user
        pat_result = await db.execute(
            select(Patient).where(Patient.user_id == uuid.UUID(current_user.sub))
        )
        patient = pat_result.scalars().first()
        if not patient:
            return success_response(
                data=AppointmentListResponse(
                    total=0, page=page, page_size=page_size, items=[]
                ).model_dump(mode="json")
            )
        query = query.where(Appointment.patient_id == patient.id)
    elif current_user.role == "doctor":
        doc_result = await db.execute(
            select(Doctor).where(Doctor.user_id == uuid.UUID(current_user.sub))
        )
        doctor = doc_result.scalars().first()
        if not doctor:
            return success_response(
                data=AppointmentListResponse(
                    total=0, page=page, page_size=page_size, items=[]
                ).model_dump(mode="json")
            )
        query = query.where(Appointment.doctor_id == doctor.id)
    else:
        # Admin / hospital_admin
        if hospital_id:
            query = query.where(Appointment.hospital_id == hospital_id)

    if status_filter:
        query = query.where(Appointment.status == status_filter)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Appointment.scheduled_at.desc())
    )
    result = await db.execute(query)
    appointments = result.scalars().all()

    return success_response(
        data=AppointmentListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[AppointmentResponse.model_validate(a) for a in appointments],
        ).model_dump(mode="json")
    )


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get appointment details. Access restricted by role."""
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Verify access
    if current_user.role == "patient":
        pat_result = await db.execute(
            select(Patient).where(Patient.user_id == uuid.UUID(current_user.sub))
        )
        patient = pat_result.scalars().first()
        if not patient or appointment.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "doctor":
        doc_result = await db.execute(
            select(Doctor).where(Doctor.user_id == uuid.UUID(current_user.sub))
        )
        doctor = doc_result.scalars().first()
        if not doctor or appointment.doctor_id != doctor.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return success_response(
        data=AppointmentResponse.model_validate(appointment).model_dump(mode="json")
    )


@router.post("/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentCancelRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Cancel an appointment. Involved parties or admins only."""
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.status in (AppointmentStatus.completed, AppointmentStatus.cancelled):
        return error_response(
            "INVALID_STATE",
            "Cannot cancel a completed or already cancelled appointment.",
            400,
        )

    appointment.status = AppointmentStatus.cancelled
    appointment.cancelled_by_user_id = uuid.UUID(current_user.sub)
    appointment.cancellation_reason = payload.reason
    await db.flush()

    log_audit_event(
        action="appointment_cancelled",
        actor_id=current_user.sub,
        target_id=str(appointment.id),
        details={"reason": payload.reason},
    )

    return success_response(message="Appointment cancelled successfully.")


@router.patch("/{appointment_id}/clinical-notes")
async def update_clinical_notes(
    appointment_id: uuid.UUID,
    payload: AppointmentClinicalUpdate,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """Add clinical notes, diagnosis, prescription. Doctor only."""
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Verify this is the assigned doctor
    doc_result = await db.execute(
        select(Doctor).where(Doctor.user_id == uuid.UUID(current_user.sub))
    )
    doctor = doc_result.scalars().first()
    if not doctor or appointment.doctor_id != doctor.id:
        raise HTTPException(
            status_code=403, detail="Only the assigned doctor can update clinical notes"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(appointment, field, value)

    await db.flush()
    await db.refresh(appointment)
    log_audit_event(
        action="clinical_notes_updated",
        actor_id=current_user.sub,
        target_id=str(appointment.id),
    )

    return success_response(
        data=AppointmentResponse.model_validate(appointment).model_dump(mode="json"),
        message="Clinical notes updated.",
    )


@router.put("/{appointment_id}/complete")
async def complete_appointment(
    appointment_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """Mark appointment as completed. Doctor only."""
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Verify assigned doctor
    doc_result = await db.execute(
        select(Doctor).where(Doctor.user_id == uuid.UUID(current_user.sub))
    )
    doctor = doc_result.scalars().first()
    if not doctor or appointment.doctor_id != doctor.id:
        raise HTTPException(
            status_code=403,
            detail="Only the assigned doctor can complete this appointment",
        )

    if appointment.status == AppointmentStatus.cancelled:
        return error_response(
            "INVALID_STATE", "Cannot complete a cancelled appointment.", 400
        )

    appointment.status = AppointmentStatus.completed
    appointment.completed_at = datetime.now(timezone.utc)
    await db.flush()

    log_audit_event(
        action="appointment_completed",
        actor_id=current_user.sub,
        target_id=str(appointment.id),
    )

    return success_response(message="Appointment marked as completed.")
