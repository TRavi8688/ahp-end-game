import uuid
from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user, TokenPayload
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from shared.gcs import GCSStorageService

router = APIRouter()


@router.get("/timeline")
async def get_clinical_timeline(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a unified chronological ledger of the patient's medical journey,
    combining official appointments/visits and uploaded medical documents/records.
    """
    # 1. Fetch current patient profile
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub), Patient.deleted_at.is_(None)
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    # 2. Fetch all appointments (visits)
    from sqlalchemy.orm import selectinload

    stmt_apt = (
        select(Appointment)
        .where(Appointment.patient_id == patient.id)
        .options(selectinload(Appointment.doctor))
        .order_by(Appointment.scheduled_at.desc())
    )
    res_apt = await db.execute(stmt_apt)
    appointments = res_apt.scalars().all()

    timeline_items = []

    # Format appointments as visits
    for apt in appointments:
        doc_name = "Assigned Doctor"
        if apt.doctor:
            doc_name = f"Dr. {apt.doctor.first_name} {apt.doctor.last_name}"

        timeline_items.append(
            {
                "id": str(apt.id),
                "type": "visit",
                "timestamp": apt.scheduled_at.isoformat(),
                "hospital_name": "Hospyn Clinic",
                "visit_reason": apt.chief_complaint or "Consultation",
                "symptoms": apt.chief_complaint or "",
                "department": "General Medicine",
                "doctor_name": doc_name,
                "status": apt.status.value,
                "prescriptions": (
                    [{"name": apt.prescription, "dosage": "", "instructions": ""}]
                    if apt.prescription
                    else []
                ),
                "lab_orders": [],
                "records": [],
            }
        )

    # 3. Load all medical records from database
    records_result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.patient_id == patient.id)
    )
    records = records_result.scalars().all()

    storage = GCSStorageService()
    for record in records:
        secure_url = (
            await storage.get_secure_url(record.file_url, expires_in=600)
            if record.file_url
            else None
        )

        timeline_items.append(
            {
                "id": str(record.id),
                "type": "standalone_record",
                "timestamp": (
                    record.created_at.isoformat()
                    if record.created_at
                    else datetime.utcnow().isoformat()
                ),
                "record_name": record.record_name or "Medical Record",
                "hospital_name": record.hospital_name or "Hospyn Clinic",
                "record_type": record.record_type or "Document",
                "secure_url": secure_url,
                "patient_summary": record.patient_summary or "",
                "ai_summary": record.ai_summary or "",
                "ocr_confidence_score": 0.95,
                "needs_verification": False,
            }
        )

    # 4. Sort timeline items chronologically (newest first)
    timeline_items.sort(key=lambda x: x["timestamp"], reverse=True)

    return timeline_items
