import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.models import Bed, Admission, BedStatusEnum, AdmissionStatus, Patient, Hospital
from app.core.realtime import manager

logger = logging.getLogger(__name__)

class AdmissionService:
    @staticmethod
    async def admit_patient(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        patient_id: uuid.UUID,
        bed_id: uuid.UUID,
        staff_id: uuid.UUID
    ) -> Admission:
        """
        CLINICAL ADMISSION:
        Atomically assigns a bed and creates the admission ledger entry.
        """
        # 1. Verify Bed Availability
        stmt = select(Bed).where(Bed.id == bed_id, Bed.hospital_id == hospital_id)
        result = await db.execute(stmt)
        bed = result.scalar_one_or_none()
        
        if not bed:
            raise ValueError("Bed not found")
        if bed.status != BedStatusEnum.available:
            raise ValueError(f"Bed is currently {bed.status.value}")

        # 2. Check for existing active admissions
        stmt = select(Admission).where(
            Admission.patient_id == patient_id,
            Admission.status == AdmissionStatus.ADMITTED
        )
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise ValueError("Patient is already admitted")

        # 3. Perform Transactional Update
        bed.status = BedStatusEnum.occupied
        
        admission = Admission(
            hospital_id=hospital_id,
            patient_id=patient_id,
            bed_id=bed_id,
            status=AdmissionStatus.ADMITTED,
            admitted_at=datetime.now(timezone.utc)
        )
        
        db.add(admission)
        await db.commit()
        await db.refresh(admission)

        # 4. Real-time Broadcast
        await manager.broadcast_to_hospital(
            str(hospital_id),
            {
                "type": "WARD_ADMISSION",
                "bed_id": str(bed_id),
                "patient_id": str(patient_id),
                "status": "OCCUPIED"
            }
        )
        
        logger.info(f"PATIENT_ADMITTED: patient={patient_id} bed={bed_id}")
        return admission

    @staticmethod
    async def discharge_patient(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        admission_id: uuid.UUID,
        staff_id: uuid.UUID
    ) -> Admission:
        """
        CLINICAL DISCHARGE:
        Frees the bed and closes the admission record.
        """
        stmt = select(Admission).where(
            Admission.id == admission_id,
            Admission.hospital_id == hospital_id
        )
        result = await db.execute(stmt)
        admission = result.scalar_one_or_none()
        
        if not admission:
            raise ValueError("Admission record not found")
        if admission.status == AdmissionStatus.DISCHARGED:
            raise ValueError("Patient already discharged")

        # 1. Update Admission
        admission.status = AdmissionStatus.DISCHARGED
        admission.discharged_at = datetime.now(timezone.utc)

        # 2. Free Bed (Set to CLEANING for safety)
        if admission.bed_id:
            stmt = select(Bed).where(Bed.id == admission.bed_id)
            res = await db.execute(stmt)
            bed = res.scalar_one_or_none()
            if bed:
                bed.status = BedStatusEnum.cleaning

        await db.commit()
        await db.refresh(admission)

        # 3. Broadcast
        await manager.broadcast_to_hospital(
            str(hospital_id),
            {
                "type": "WARD_DISCHARGE",
                "bed_id": str(admission.bed_id) if admission.bed_id else None,
                "status": "CLEANING"
            }
        )
        
        return admission

    @staticmethod
    async def get_ward_status(
        db: AsyncSession,
        hospital_id: uuid.UUID
    ) -> List[dict]:
        """
        NURSING DASHBOARD:
        Returns all beds and their current occupants.
        """
        stmt = select(Bed).where(Bed.hospital_id == hospital_id).order_by(Bed.bed_number)
        result = await db.execute(stmt)
        beds = result.scalars().all()
        
        # In a real app, we'd join with Admission and Patient for a full view
        return [
            {
                "id": b.id,
                "bed_number": b.bed_number,
                "status": b.status,
                "department_id": b.department_id
            } for b in beds
        ]
