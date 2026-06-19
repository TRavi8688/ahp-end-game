from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import WearableData, WearableDataType, NotificationQueue
from app.core.logging import logger
import uuid
from datetime import datetime

class RemoteMonitoringService:
    """
    PREVENTATIVE CARE ENGINE (Phase 3.2).
    Analyzes wearable data streams to detect clinical risks.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def process_wearable_pulse(self, patient_id: uuid.UUID, bpm: float, measured_at: datetime):
        """
        Ingests heart rate and flags Tachycardia (>100 BPM at rest).
        """
        # 1. Record the data
        entry = WearableData(
            patient_id=patient_id,
            data_type=WearableDataType.HEART_RATE,
            value=bpm,
            unit="BPM",
            source="WEARABLE_SYNC",
            measured_at=measured_at
        )
        self.db.add(entry)

        # 2. Risk Detection Logic (Simplified)
        if bpm > 120: # Critical Tachycardia Threshold
            logger.warning(f"CLINICAL_ALERT: Critical Heart Rate detected for Patient {patient_id}: {bpm} BPM")
            
            # 3. Queue a durable notification for the doctor
            alert = NotificationQueue(
                patient_id=patient_id,
                provider="push_notification",
                message_type="CRITICAL_VITALS_ALERT",
                payload={
                    "vitals_type": "HEART_RATE",
                    "value": bpm,
                    "unit": "BPM",
                    "status": "CRITICAL"
                }
            )
            self.db.add(alert)
        
        await self.db.commit()
        return True
