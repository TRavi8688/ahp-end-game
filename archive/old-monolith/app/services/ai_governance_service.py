import uuid
import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import ClinicalAIEvent, ClinicianOverride, Doctor, MedicalRecord, Condition, Medication
from app.schemas import schemas
from app.core.audit import log_clinical_audit

logger = logging.getLogger(__name__)

class AIGovernanceService:
    @staticmethod
    async def record_ai_event(
        db: AsyncSession,
        user_id: uuid.UUID,
        trace_id: str,
        prompt_template: str,
        prompt_payload: Dict[str, Any],
        response_text: str,
        safety_metadata: Dict[str, Any],
        provider: str,
        model_version: str,
        latency_ms: int,
        hospital_id: Optional[uuid.UUID] = None
    ) -> ClinicalAIEvent:
        """Records every AI interaction for clinical auditing and forensic replay."""
        event = ClinicalAIEvent(
            hospital_id=hospital_id,
            trace_id=trace_id,
            user_id=user_id,
            prompt_template=prompt_template,
            prompt_payload=prompt_payload,
            response_text=response_text,
            safety_metadata=safety_metadata,
            provider=provider,
            model_version=model_version,
            latency_ms=latency_ms
        )
        db.add(event)
        return event

    @staticmethod
    async def apply_clinician_override(
        db: AsyncSession,
        doctor: Doctor,
        override_data: schemas.AIOverrideRequest
    ) -> ClinicianOverride:
        """
        Processes a formal clinician override of AI findings.
        This is the "Supremacy Layer" where human judgment corrects the AI.
        """
        # 1. Fetch the AI event
        stmt = select(ClinicalAIEvent).where(ClinicalAIEvent.id == override_data.ai_event_id)
        result = await db.execute(stmt)
        ai_event = result.scalar_one_or_none()
        
        if not ai_event:
            raise ValueError("Clinical AI Event not found for override.")

        # 2. Record the Override
        override = ClinicianOverride(
            hospital_id=doctor.user.staff_profile.hospital_id if doctor.user.staff_profile else None,
            ai_event_id=override_data.ai_event_id,
            doctor_user_id=doctor.user_id,
            override_type=override_data.override_type,
            justification=override_data.justification,
            correction_text=override_data.correction_text,
            severity_impact=override_data.severity_impact
        )
        
        # 3. Mark AI Event as Overridden
        ai_event.overridden = True
        
        db.add(override)
        
        # 4. Audit Log
        await log_clinical_audit(
            db,
            user_id=doctor.user_id,
            action="AI_CLINICAL_OVERRIDE",
            resource_type="AI_EVENT",
            resource_id=ai_event.id,
            details={
                "type": override_data.override_type,
                "severity": override_data.severity_impact,
                "justification": override_data.justification[:100]
            }
        )
        
        # 5. Logic to "Promote" or "Correct" clinical data
        # If the override corrects a specific extraction, we'd update the relevant record here.
        # This requires linking the AI Event to a specific MedicalRecord or finding.
        
        return override

    @staticmethod
    async def verify_ai_extraction(
        db: AsyncSession,
        doctor: Doctor,
        record_id: uuid.UUID,
        accepted_findings: Dict[str, Any]
    ) -> None:
        """
        Allows a doctor to selectively accept AI-extracted findings.
        Accepted findings are promoted to 'confirmed_by_doctor' status.
        """
        stmt = select(MedicalRecord).where(MedicalRecord.id == record_id)
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        
        if not record:
             raise ValueError("Medical Record not found.")

        # Update record summaries
        if "doctor_summary" in accepted_findings:
            record.doctor_summary = accepted_findings["doctor_summary"]

        # Promote conditions/medications
        # (This is where the actual clinical domain logic stabilizes)
        logger.info(f"DOCTOR_VERIFICATION: Record {record_id} verified by Dr. {doctor.user.last_name}")
        
        await log_clinical_audit(
            db,
            user_id=doctor.user_id,
            action="WRITE_PHI",
            resource_type="MEDICAL_RECORD_VERIFICATION",
            resource_id=record_id,
            patient_id=record.patient_id
        )
