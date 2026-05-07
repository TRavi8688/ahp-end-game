from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional

from app.models.admission import Bed, Admission, BedStatus, AdmissionStatus
from app.core.outbox import add_event_to_outbox

async def admit_patient(db: AsyncSession, patient_id: int, user, queue_token_id: Optional[int] = None) -> Admission:
    """
    Creates an admission record. The patient is pending a bed assignment.
    """
    async with db.begin():
        # Enforce no duplicate active admissions for the same patient
        result = await db.execute(
            select(Admission).where(
                Admission.patient_id == patient_id,
                Admission.status != AdmissionStatus.DISCHARGED
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValueError("Patient is already admitted or pending admission.")

        admission = Admission(
            hospital_id=user.hospital_id,
            patient_id=patient_id,
            queue_token_id=queue_token_id,
            status=AdmissionStatus.PENDING,
            created_by_id=user.id,
            last_modified_by_id=user.id
        )
        db.add(admission)
        await db.flush()

        event = {
            "event_type": "ADMISSION.CREATED",
            "event_version": "v1",
            "tenant_id": user.hospital_id,
            "occurred_at": datetime.utcnow().isoformat(),
            "payload": {
                "admission_id": admission.id,
                "patient_id": patient_id
            }
        }
        add_event_to_outbox(db, event)

        return admission

async def assign_bed(db: AsyncSession, admission_id: int, bed_id: int, user) -> Admission:
    """
    Strict State Transition: AVAILABLE -> TEMP_RESERVED or OCCUPIED.
    Actually, let's transition it to OCCUPIED for a direct assignment.
    """
    async with db.begin():
        result = await db.execute(
            select(Admission).where(
                Admission.id == admission_id,
                Admission.hospital_id == user.hospital_id
            )
        )
        admission = result.scalar_one_or_none()

        if not admission:
            raise ValueError("Admission not found or access denied")

        if admission.status == AdmissionStatus.DISCHARGED:
            raise ValueError("Cannot assign bed to discharged admission")

        result_bed = await db.execute(
            select(Bed).where(
                Bed.id == bed_id,
                Bed.hospital_id == user.hospital_id
            )
        )
        bed = result_bed.scalar_one_or_none()

        if not bed:
            raise ValueError("Bed not found or access denied")

        if bed.status != BedStatus.AVAILABLE:
            raise ValueError(f"Bed is not AVAILABLE. Current status: {bed.status}")

        # If admission already had a bed, free it
        if admission.bed_id:
            old_bed_res = await db.execute(select(Bed).where(Bed.id == admission.bed_id))
            old_bed = old_bed_res.scalar_one()
            old_bed.status = BedStatus.AVAILABLE
            old_bed.last_modified_by_id = user.id

        # Update new bed and admission
        bed.status = BedStatus.OCCUPIED
        bed.last_modified_by_id = user.id
        
        admission.bed_id = bed.id
        admission.status = AdmissionStatus.ADMITTED
        admission.last_modified_by_id = user.id

        event = {
            "event_type": "BED.ASSIGNED",
            "event_version": "v1",
            "tenant_id": user.hospital_id,
            "occurred_at": datetime.utcnow().isoformat(),
            "payload": {
                "admission_id": admission.id,
                "bed_id": bed.id
            }
        }
        add_event_to_outbox(db, event)

        return admission

async def discharge_patient(db: AsyncSession, admission_id: int, user) -> Admission:
    """
    Strict State Transition: OCCUPIED -> AVAILABLE
    """
    async with db.begin():
        result = await db.execute(
            select(Admission).where(
                Admission.id == admission_id,
                Admission.hospital_id == user.hospital_id
            )
        )
        admission = result.scalar_one_or_none()

        if not admission:
            raise ValueError("Admission not found or access denied")

        if admission.status == AdmissionStatus.DISCHARGED:
            raise ValueError("Patient already discharged")

        admission.status = AdmissionStatus.DISCHARGED
        admission.discharged_at = datetime.utcnow()
        admission.last_modified_by_id = user.id

        if admission.bed_id:
            bed_res = await db.execute(select(Bed).where(Bed.id == admission.bed_id))
            bed = bed_res.scalar_one()
            bed.status = BedStatus.AVAILABLE
            bed.last_modified_by_id = user.id

        event = {
            "event_type": "ADMISSION.DISCHARGED",
            "event_version": "v1",
            "tenant_id": user.hospital_id,
            "occurred_at": datetime.utcnow().isoformat(),
            "payload": {
                "admission_id": admission.id,
            }
        }
        add_event_to_outbox(db, event)

        return admission
