import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.models import Surgery, OperationTheatre, SurgeryStatus, Doctor, Patient

logger = logging.getLogger(__name__)

class SurgeryService:
    @staticmethod
    async def schedule_surgery(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        patient_id: uuid.UUID,
        theatre_id: uuid.UUID,
        surgeon_id: uuid.UUID,
        procedure_name: str,
        scheduled_start: datetime,
        scheduled_end: datetime
    ) -> Surgery:
        """
        SURGICAL BOOKING:
        Checks for OT and Surgeon availability before committing.
        """
        # 1. Check OT Conflict
        stmt = select(Surgery).where(
            and_(
                Surgery.theatre_id == theatre_id,
                Surgery.status != SurgeryStatus.CANCELLED,
                Surgery.scheduled_start < scheduled_end,
                Surgery.scheduled_end > scheduled_start
            )
        )
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise ValueError("Operation Theatre is already booked for this time slot")

        # 2. Check Surgeon Conflict
        stmt = select(Surgery).where(
            and_(
                Surgery.lead_surgeon_id == surgeon_id,
                Surgery.status != SurgeryStatus.CANCELLED,
                Surgery.scheduled_start < scheduled_end,
                Surgery.scheduled_end > scheduled_start
            )
        )
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise ValueError("Lead Surgeon has another surgery scheduled at this time")

        # 3. Create Surgery Record
        surgery = Surgery(
            hospital_id=hospital_id,
            patient_id=patient_id,
            theatre_id=theatre_id,
            lead_surgeon_id=surgeon_id,
            procedure_name=procedure_name,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            status=SurgeryStatus.SCHEDULED
        )
        
        db.add(surgery)
        await db.commit()
        await db.refresh(surgery)
        
        logger.info(f"SURGERY_SCHEDULED: id={surgery.id} procedure='{procedure_name}'")
        return surgery

    @staticmethod
    async def update_status(
        db: AsyncSession,
        surgery_id: uuid.UUID,
        status: SurgeryStatus,
        notes: Optional[str] = None
    ) -> Surgery:
        """
        SURGICAL LIFECYCLE:
        Tracks progress from PRE_OP to COMPLETED.
        """
        stmt = select(Surgery).where(Surgery.id == surgery_id)
        result = await db.execute(stmt)
        surgery = result.scalar_one_or_none()
        
        if not surgery:
            raise ValueError("Surgery record not found")

        surgery.status = status
        if notes:
            surgery.notes = notes

        if status == SurgeryStatus.IN_PROGRESS and not surgery.actual_start:
            surgery.actual_start = datetime.now(timezone.utc)
        elif status == SurgeryStatus.COMPLETED and not surgery.actual_end:
            surgery.actual_end = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(surgery)
        return surgery

    @staticmethod
    async def get_hospital_schedule(
        db: AsyncSession,
        hospital_id: uuid.UUID
    ) -> List[Surgery]:
        """
        WARD VIEW:
        All surgeries for today/future.
        """
        stmt = select(Surgery).where(
            Surgery.hospital_id == hospital_id,
            Surgery.status != SurgeryStatus.CANCELLED
        ).order_by(Surgery.scheduled_start)
        
        result = await db.execute(stmt)
        return result.scalars().all()
