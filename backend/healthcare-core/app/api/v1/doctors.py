"""
Doctor API Routes

Endpoints:
    POST   /doctors/              - Register a doctor profile (doctor, admin)
    GET    /doctors/              - List doctors (with filters)
    GET    /doctors/{id}          - Get doctor details
    GET    /doctors/me            - Get current doctor's own profile
    PUT    /doctors/{id}          - Update doctor profile
    DELETE /doctors/{id}          - Soft-delete doctor (admin only)
"""

import uuid
from datetime import timezone, datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.models.doctor import Doctor, DoctorStatus
from app.models.hospital import Hospital
from app.schemas.doctor import (
    DoctorCreate,
    DoctorUpdate,
    DoctorResponse,
    DoctorListResponse,
)
from app.models.medical_record import MedicalRecord
from app.models.appointment import Appointment
from shared.utils.responses import success_response, error_response
from shared.gcs import GCSStorageService
from shared.audit import log_audit_event
import json

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_doctor(
    payload: DoctorCreate,
    current_user: Annotated[
        TokenPayload, Depends(require_role("doctor", "admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Register a new doctor profile. Links to user_id from auth service."""
    # Verify the hospital exists
    hospital_result = await db.execute(
        select(Hospital).where(
            Hospital.id == payload.hospital_id, Hospital.deleted_at.is_(None)
        )
    )
    if not hospital_result.scalars().first():
        raise HTTPException(status_code=404, detail="Hospital not found")

    # Check if this user already has a doctor profile
    existing = await db.execute(
        select(Doctor).where(Doctor.user_id == uuid.UUID(current_user.sub))
    )
    if existing.scalars().first():
        return error_response(
            "PROFILE_EXISTS", "Doctor profile already exists for this user.", 409
        )

    # Check duplicate license
    lic_check = await db.execute(
        select(Doctor).where(
            Doctor.medical_license_number == payload.medical_license_number
        )
    )
    if lic_check.scalars().first():
        return error_response(
            "DUPLICATE_LICENSE",
            "A doctor with this license number already exists.",
            409,
        )

    doctor = Doctor(
        **payload.model_dump(),
        user_id=uuid.UUID(current_user.sub),
        status=DoctorStatus.pending_approval,
    )
    db.add(doctor)
    await db.flush()
    await db.refresh(doctor)

    log_audit_event(
        action="doctor_created", actor_id=current_user.sub, target_id=str(doctor.id)
    )

    return success_response(
        data=DoctorResponse.model_validate(doctor).model_dump(mode="json"),
        message="Doctor profile created. Pending admin approval.",
        status_code=201,
    )


@router.get("/me")
async def get_my_profile(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """Get the current logged-in doctor's own profile."""
    result = await db.execute(
        select(Doctor).where(
            Doctor.user_id == uuid.UUID(current_user.sub),
            Doctor.deleted_at.is_(None),
        )
    )
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(
            status_code=404, detail="Doctor profile not found. Please register first."
        )

    return success_response(
        data=DoctorResponse.model_validate(doctor).model_dump(mode="json")
    )


@router.get("/")
async def list_doctors(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    hospital_id: uuid.UUID = Query(None),
    specialization: str = Query(None),
    status_filter: DoctorStatus = Query(None, alias="status"),
):
    """List doctors with filtering. Any authenticated user can view active doctors."""
    query = select(Doctor).where(Doctor.deleted_at.is_(None))

    # Non-admin users only see active doctors
    if current_user.role not in ("admin", "hospital_admin"):
        query = query.where(Doctor.status == DoctorStatus.active)

    if hospital_id:
        query = query.where(Doctor.hospital_id == hospital_id)
    if specialization:
        query = query.where(Doctor.specialization.ilike(f"%{specialization}%"))
    if status_filter and current_user.role in ("admin", "hospital_admin"):
        query = query.where(Doctor.status == status_filter)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Doctor.created_at.desc())
    )
    result = await db.execute(query)
    doctors = result.scalars().all()

    return success_response(
        data=DoctorListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[DoctorResponse.model_validate(d) for d in doctors],
        ).model_dump(mode="json")
    )


@router.get("/{doctor_id}")
async def get_doctor(
    doctor_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get a specific doctor's details."""
    result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_id, Doctor.deleted_at.is_(None))
    )
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    return success_response(
        data=DoctorResponse.model_validate(doctor).model_dump(mode="json")
    )


@router.get("/patients/{patient_id}/medical-records")
async def get_patient_medical_records(
    patient_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Get a patient's medical records.
    The doctor MUST have an existing or upcoming appointment with this patient
    to have the authorization to view their records (Zero-Trust).
    """
    # 1. Resolve current doctor
    doc_result = await db.execute(
        select(Doctor).where(Doctor.user_id == uuid.UUID(current_user.sub))
    )
    doctor = doc_result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=403, detail="Doctor profile not found")

    # 2. Check for an active relationship (an appointment exists)
    appt_result = await db.execute(
        select(Appointment)
        .where(Appointment.doctor_id == doctor.id, Appointment.patient_id == patient_id)
        .limit(1)
    )
    if not appt_result.scalars().first():
        log_audit_event(
            action="unauthorized_record_access_attempt",
            actor_id=current_user.sub,
            target_id=str(patient_id),
            details={"reason": "No active appointment relationship"},
        )
        raise HTTPException(
            status_code=403,
            detail="Access denied. You must have an appointment with this patient to view their records.",
        )

    # 3. Load records that aren't hidden by the patient
    records_result = await db.execute(
        select(MedicalRecord)
        .where(
            MedicalRecord.patient_id == patient_id,
            MedicalRecord.hidden_by_patient == False,
        )
        .order_by(MedicalRecord.created_at.desc())
    )
    records = records_result.scalars().all()

    storage = GCSStorageService()
    formatted_records = []
    for r in records:
        secure_url = (
            await storage.get_secure_url(r.file_url, expires_in=600)
            if r.file_url
            else None
        )
        formatted_records.append(
            {
                "id": str(r.id),
                "record_type": r.record_type,
                "record_name": r.record_name,
                "hospital_name": r.hospital_name,
                "secure_url": secure_url,
                "ai_summary": r.ai_summary,
                "ai_extracted": json.loads(r.ai_extracted) if r.ai_extracted else {},
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )

    log_audit_event(
        action="doctor_accessed_patient_records",
        actor_id=current_user.sub,
        target_id=str(patient_id),
    )

    return success_response(data=formatted_records)


@router.put("/{doctor_id}")
async def update_doctor(
    doctor_id: uuid.UUID,
    payload: DoctorUpdate,
    current_user: Annotated[
        TokenPayload, Depends(require_role("doctor", "admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Update a doctor profile. Doctors can only update their own profile."""
    result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_id, Doctor.deleted_at.is_(None))
    )
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Doctors can only update their own profile
    if current_user.role == "doctor" and str(doctor.user_id) != current_user.sub:
        raise HTTPException(
            status_code=403, detail="You can only update your own profile"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(doctor, field, value)

    await db.flush()
    await db.refresh(doctor)
    log_audit_event(
        action="doctor_updated", actor_id=current_user.sub, target_id=str(doctor.id)
    )

    return success_response(
        data=DoctorResponse.model_validate(doctor).model_dump(mode="json"),
        message="Doctor profile updated.",
    )


@router.delete("/{doctor_id}", status_code=status.HTTP_200_OK)
async def delete_doctor(
    doctor_id: uuid.UUID,
    current_user: Annotated[
        TokenPayload, Depends(require_role("admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a doctor profile. Admin or hospital_admin only."""
    result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_id, Doctor.deleted_at.is_(None))
    )
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor.deleted_at = datetime.now(timezone.utc)
    doctor.is_active = False
    await db.flush()
    log_audit_event(
        action="doctor_deleted", actor_id=current_user.sub, target_id=str(doctor.id)
    )

    return success_response(message="Doctor profile deactivated.")
