from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from app.models.models import Bed, BedStatusEnum, Admission
from app.core.realtime import manager
import uuid
from typing import Optional
from datetime import datetime, timezone

class BedService:
    """
    Live Bed State Machine: AVAILABLE -> RESERVED -> OCCUPIED -> CLEANING -> MAINTENANCE
    """
    
    @classmethod
    async def update_bed_status(
        cls, 
        db: AsyncSession, 
        bed_id: uuid.UUID, 
        status: BedStatusEnum,
        hospyn_id: str
    ) -> bool:
        """
        Updates bed status and broadcasts to the nursing dashboard.
        """
        result = await db.execute(
            update(Bed)
            .where(Bed.id == bed_id, Bed.hospyn_id == hospyn_id)
            .values(status=status)
        )
        await db.commit()
        
        if result.rowcount > 0:
            # Broadcast real-time update to all staff in this hospital
            await manager.broadcast_to_hospital(
                hospyn_id,
                {
                    "type": "BED_STATUS_UPDATE",
                    "bed_id": str(bed_id),
                    "status": status.value,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return True
        return False

    @classmethod
    async def admit_patient(
        cls,
        db: AsyncSession,
        hospital_id: uuid.UUID,
        patient_id: uuid.UUID,
        bed_id: uuid.UUID,
        hospyn_id: str
    ) -> Optional[Admission]:
        """
        Atomically updates bed to 'occupied' and creates an admission record.
        """
        # 1. Mark Bed as Occupied
        success = await cls.update_bed_status(db, bed_id, BedStatusEnum.occupied, hospyn_id)
        if not success:
            return None
            
        # 2. Create Admission Record
        admission = Admission(
            hospital_id=hospital_id,
            patient_id=patient_id,
            bed_id=bed_id,
            status="admitted",
            hospyn_id=hospyn_id
        )
        db.add(admission)
        await db.commit()
        
        return admission
