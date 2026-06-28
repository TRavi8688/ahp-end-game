"""
Doctor Queue API Routes (Staff Portal -- Doctor)

Endpoints:
    GET   /doctor/queue                    - List patients waiting for consultation
    PATCH /doctor/queue/{id}/start         - Start consultation (creates Appointment)
    PATCH /doctor/queue/{id}/complete      - Complete consultation with notes
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
from app.models.doctor import Doctor
from app.models.appointment import (
    Appointment,
    AppointmentStatus,
    AppointmentType,
    AppointmentSource,
)
from app.services.queue_service import transition_queue_state
from shared.utils.responses import success_response
from shared.audit import log_audit_event

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class PrescriptionItemInput(BaseModel):
    drug_name: str = Field(..., max_length=200)
    dosage: str = Field(..., max_length=100)
    frequency: str = Field(..., max_length=100)
    duration: str = Field(..., max_length=100)
    instructions: Optional[str] = Field(None, max_length=500)


class ConsultationCompletePayload(BaseModel):
    chief_complaint: Optional[str] = Field(None, max_length=2000)
    clinical_notes: Optional[str] = Field(None, max_length=10000)
    diagnosis: Optional[str] = Field(None, max_length=5000)
    prescription_items: Optional[list[PrescriptionItemInput]] = Field(None)


# ---------------------------------------------------------------------------
# GET Doctor Queue -- WAITING_DOCTOR for this hospital (or assigned to this doc)
# ---------------------------------------------------------------------------

# (Keep get_doctor_queue implementation and start_consultation implementation, replacing complete_consultation)


# ---------------------------------------------------------------------------
# GET Doctor Queue -- WAITING_DOCTOR for this hospital (or assigned to this doc)
# ---------------------------------------------------------------------------


@router.get("/queue")
async def get_doctor_queue(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch all walk-in requests in WAITING_DOCTOR or IN_CONSULTATION state
    for this doctor's hospital. If a patient is assigned to a specific doctor,
    only that doctor sees them. Unassigned patients are visible to all.
    """
    doctor = await _resolve_doctor(db, current_user.sub)

    priority_order = case(
        (WalkInRequest.priority_level == PriorityLevel.emergency, 0),
        (WalkInRequest.priority_level == PriorityLevel.urgent, 1),
        (WalkInRequest.priority_level == PriorityLevel.normal, 2),
        (WalkInRequest.priority_level == PriorityLevel.low, 3),
        else_=4,
    )

    # Show: assigned to me OR unassigned at my hospital
    result = await db.execute(
        select(WalkInRequest)
        .where(
            WalkInRequest.hospital_id == doctor.hospital_id,
            WalkInRequest.queue_state.in_(
                [
                    QueueState.waiting_doctor,
                    QueueState.in_consultation,
                ]
            ),
            WalkInRequest.deleted_at.is_(None),
            # Hospital-scoped: assigned to me OR unassigned
            (WalkInRequest.assigned_doctor_id == doctor.id)
            | (WalkInRequest.assigned_doctor_id.is_(None)),
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
                "age": w.age,
                "gender": w.gender,
                "reason_for_visit": w.reason_for_visit,
                "symptoms": w.symptoms,
                "priority_level": w.priority_level.value,
                "queue_state": w.queue_state.value,
                "wait_minutes": int(wait_seconds / 60),
                "triage_vitals_json": w.triage_vitals_json,
                "triage_notes": w.triage_notes,
                "assigned_to_me": (
                    str(w.assigned_doctor_id) == str(doctor.id)
                    if w.assigned_doctor_id
                    else False
                ),
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
        )

    return success_response(
        data={
            "queue": items,
            "total_waiting": len(
                [i for i in items if i["queue_state"] == "waiting_doctor"]
            ),
            "total_in_consultation": len(
                [i for i in items if i["queue_state"] == "in_consultation"]
            ),
        }
    )


# ---------------------------------------------------------------------------
# GET Patient Details for a specific walk-in request
# ---------------------------------------------------------------------------


@router.get("/patient/{walkin_id}")
async def get_patient_details(
    walkin_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch comprehensive patient details for a specific walk-in.
    Returns patient profile, allergies, conditions, medications, and records.
    """
    doctor = await _resolve_doctor(db, current_user.sub)
    walkin = await _get_walkin_for_hospital(db, walkin_id, doctor.hospital_id)

    # Initialize empty patient data
    profile = {
        "id": str(walkin.id),  # Treat walkin_id as patient ID in frontend for now
        "hospyn_id": str(walkin.id),
        "name": walkin.full_name,
        "age": walkin.age,
        "gender": walkin.gender,
        "blood_group": "Unknown",
        "consent_required": False,
    }
    allergies = []
    conditions = []
    medications = []
    records = []
    ai_summary = ""

    if walkin.patient_id:
        from app.models.patient import Patient
        from app.models.medical_record import MedicalRecord

        result = await db.execute(
            select(Patient).where(Patient.id == walkin.patient_id)
        )
        patient = result.scalars().first()
        if patient:
            profile.update(
                {
                    "id": str(patient.id),
                    "hospyn_id": patient.hospyn_id or str(patient.id),
                    "name": patient.full_name,
                    "age": patient.age or walkin.age,
                    "gender": patient.gender or walkin.gender,
                    "blood_group": patient.blood_type or "Unknown",
                }
            )

            # Extract basic data
            if patient.known_allergies:
                allergies = [
                    {"id": i, "allergen": a.strip(), "severity": "High"}
                    for i, a in enumerate(patient.known_allergies.split(","))
                    if a.strip()
                ]
            if patient.chronic_conditions:
                conditions = [
                    {"id": i, "name": c.strip()}
                    for i, c in enumerate(patient.chronic_conditions.split(","))
                    if c.strip()
                ]

            # Fetch medical records
            records_result = await db.execute(
                select(MedicalRecord)
                .where(MedicalRecord.patient_id == patient.id)
                .order_by(MedicalRecord.created_at.desc())
            )
            patient_records = records_result.scalars().all()
            for r in patient_records:
                import json

                extracted = {}
                if r.ai_extracted:
                    try:
                        extracted = json.loads(r.ai_extracted)
                    except:
                        pass
                records.append(
                    {
                        "id": str(r.id),
                        "type": r.record_type or "Document",
                        "ai_extracted": extracted,
                        "created_at": (
                            r.created_at.isoformat() if r.created_at else None
                        ),
                    }
                )
                # Attempt to extract medications from prescriptions
                if r.record_type == "prescription" and "medications" in extracted:
                    for m in extracted["medications"]:
                        medications.append(
                            {
                                "id": str(uuid.uuid4()),
                                "generic_name": m.get("name", "Unknown"),
                                "dosage": m.get("dosage", ""),
                                "frequency": m.get("frequency", ""),
                            }
                        )

    # Add triage vitals as a record
    if walkin.triage_vitals_json:
        import json

        try:
            vitals = json.loads(walkin.triage_vitals_json)
            records.insert(
                0,
                {
                    "id": str(walkin.id) + "_vitals",
                    "type": "vitals",
                    "ai_extracted": {
                        "heartRate": {"value": vitals.get("heart_rate")},
                        "bloodPressure": {"value": vitals.get("blood_pressure")},
                        "bloodOxygen": {"value": vitals.get("oxygen_saturation")},
                        "temperature": {"value": vitals.get("temperature")},
                    },
                    "created_at": (
                        walkin.created_at.isoformat() if walkin.created_at else None
                    ),
                },
            )
        except:
            pass

    return success_response(
        data={
            "profile": profile,
            "allergies": allergies,
            "conditions": conditions,
            "medications": medications,
            "records": records,
            "ai_summary": ai_summary,
            "consent_required": profile.get("consent_required", False),
        }
    )


# ---------------------------------------------------------------------------
# PATCH Start Consultation -- Doctor picks up patient
# ---------------------------------------------------------------------------


@router.patch("/queue/{walkin_id}/start")
async def start_consultation(
    walkin_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Doctor picks up a patient for consultation.
    WAITING_DOCTOR -> IN_CONSULTATION.
    Creates an Appointment record linked to this WalkInRequest.
    """
    doctor = await _resolve_doctor(db, current_user.sub)
    walkin = await _get_walkin_for_hospital(db, walkin_id, doctor.hospital_id)

    if walkin.queue_state != QueueState.waiting_doctor:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start: current state is '{walkin.queue_state.value}'.",
        )

    # Assign this doctor
    walkin.assigned_doctor_id = doctor.id

    await transition_queue_state(
        db,
        walkin,
        QueueState.in_consultation,
        current_user.sub,
        ip_address=request.client.host if request.client else None,
    )

    # Create the Appointment record -- this is the only place appointments are created from walk-ins
    now = datetime.now(timezone.utc)
    appointment = Appointment(
        patient_id=walkin.patient_id,  # May be None for anonymous walk-ins
        doctor_id=doctor.id,
        hospital_id=doctor.hospital_id,
        scheduled_at=now,
        duration_minutes=30,
        appointment_type=AppointmentType.in_person,
        status=AppointmentStatus.in_progress,
        chief_complaint=walkin.reason_for_visit,
        source_type=AppointmentSource.walkin,
        walkin_request_id=walkin.id,
    )
    db.add(appointment)
    await db.flush()

    log_audit_event(
        action="consultation_started",
        actor_id=current_user.sub,
        target_id=str(walkin.id),
        details={
            "appointment_id": str(appointment.id),
            "doctor_name": doctor.full_name,
        },
    )

    return success_response(
        data={
            "request_id": str(walkin.id),
            "appointment_id": str(appointment.id),
            "new_state": walkin.queue_state.value,
            "patient_name": walkin.full_name,
        },
        message="Consultation started.",
    )


# ---------------------------------------------------------------------------
# PATCH Complete Consultation -- Doctor finishes and writes notes
# ---------------------------------------------------------------------------


@router.patch("/queue/{walkin_id}/complete")
async def complete_consultation(
    walkin_id: uuid.UUID,
    payload: ConsultationCompletePayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Doctor completes consultation. Stores clinical notes in the Appointment and MedicalRecord.
    Creates structured Prescription items.
    IN_CONSULTATION -> COMPLETED.
    """
    doctor = await _resolve_doctor(db, current_user.sub)
    walkin = await _get_walkin_for_hospital(db, walkin_id, doctor.hospital_id)

    if walkin.queue_state != QueueState.in_consultation:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete: current state is '{walkin.queue_state.value}'.",
        )

    # 1. Update redundant Appointment model (for backward compatibility / consent tracking)
    appt_result = await db.execute(
        select(Appointment).where(
            Appointment.walkin_request_id == walkin.id,
            Appointment.doctor_id == doctor.id,
        )
    )
    appointment = appt_result.scalars().first()
    if appointment:
        appointment.chief_complaint = (
            payload.chief_complaint or appointment.chief_complaint
        )
        appointment.clinical_notes = payload.clinical_notes
        appointment.diagnosis = payload.diagnosis
        # Store serialized string of prescriptions on Appointment.prescription for legacy reports
        if payload.prescription_items:
            items_desc = []
            for item in payload.prescription_items:
                items_desc.append(
                    f"{item.drug_name} {item.dosage} ({item.frequency}) x {item.duration}"
                )
            appointment.prescription = "; ".join(items_desc)
        appointment.status = AppointmentStatus.completed
        appointment.completed_at = datetime.now(timezone.utc)

    # 2. Call transactional ClinicalService to create MedicalRecord and Prescription items
    from app.services.clinical_service import ClinicalService

    items_list = []
    if payload.prescription_items:
        for item in payload.prescription_items:
            items_list.append(
                {
                    "drug_name": item.drug_name,
                    "dosage": item.dosage,
                    "frequency": item.frequency,
                    "duration": item.duration,
                    "instructions": item.instructions,
                }
            )

    try:
        await ClinicalService.complete_consultation(
            db=db,
            walkin_id=walkin_id,
            doctor_id=doctor.id,
            chief_complaint=payload.chief_complaint or "",
            clinical_notes=payload.clinical_notes or "",
            diagnosis=payload.diagnosis or "",
            prescription_items=items_list,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    log_audit_event(
        action="consultation_completed",
        actor_id=current_user.sub,
        target_id=str(walkin.id),
        details={
            "appointment_id": str(appointment.id) if appointment else None,
            "has_prescription": bool(payload.prescription_items),
        },
    )

    return success_response(
        data={
            "request_id": str(walkin.id),
            "new_state": walkin.queue_state.value,
        },
        message="Consultation completed.",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _resolve_doctor(db: AsyncSession, user_id: str) -> Doctor:
    result = await db.execute(
        select(Doctor).where(
            Doctor.user_id == uuid.UUID(user_id),
            Doctor.is_active == True,
            Doctor.deleted_at.is_(None),
        )
    )
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=403, detail="Doctor profile not found.")
    return doctor


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
