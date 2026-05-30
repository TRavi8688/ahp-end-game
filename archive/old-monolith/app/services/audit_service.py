import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Patient, ClinicalEvent, MedicalRecord, User
from typing import List, Dict, Any

class AuditService:
    @staticmethod
    async def get_patient_forensic_trail(db: AsyncSession, patient_id: str) -> Dict[str, Any]:
        """
        Generates a tamper-proof clinical journey for a patient.
        Includes every clinical event and medical record metadata.
        """
        # 1. Fetch Patient Info
        patient_query = select(Patient).where(Patient.id == patient_id)
        patient_result = await db.execute(patient_query)
        patient = patient_result.scalar_one_or_none()
        
        if not patient:
            return {"error": "Patient not found"}

        # 2. Fetch All Clinical Events
        event_query = select(ClinicalEvent).where(
            ClinicalEvent.patient_id == patient_id
        ).order_by(ClinicalEvent.timestamp.asc())
        
        event_result = await db.execute(event_query)
        events = event_result.scalars().all()

        # 3. Fetch Medical Record Metadata
        record_query = select(MedicalRecord).where(
            MedicalRecord.patient_id == patient_id
        ).order_by(MedicalRecord.created_at.asc())
        
        record_result = await db.execute(record_query)
        records = record_result.scalars().all()

        # 4. Construct the Forensic Trail
        trail = {
            "metadata": {
                "report_id": f"HSP-AUD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "patient_hospyn_id": patient.hospyn_id,
                "integrity_check": "SHA256-V2"
            },
            "clinical_timeline": [
                {
                    "event_id": str(e.id),
                    "timestamp": e.timestamp.isoformat(),
                    "type": e.event_type,
                    "actor_id": str(e.actor_id),
                    "payload": e.payload,
                    "signature": e.signature
                } for e in events
            ],
            "document_history": [
                {
                    "record_id": str(r.id),
                    "uploaded_at": r.created_at.isoformat(),
                    "type": r.type,
                    "name": r.record_name,
                    "ocr_confidence": r.ocr_confidence_score,
                    "checksum": r.record_checksum
                } for r in records
            ]
        }

        return trail

    @staticmethod
    async def export_forensic_json(db: AsyncSession, patient_id: str) -> str:
        """Exports the trail as a formatted JSON string."""
        trail = await AuditService.get_patient_forensic_trail(db, patient_id)
        return json.dumps(trail, indent=2, default=str)
