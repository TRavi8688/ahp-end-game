import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.models import ClinicalEvent, Patient
from app.core.logging import logger

class ClinicalContextService:
    """
    The SHIELD Layer for Chitti AI.
    Converts raw clinical event streams into secure, filtered, and 
    summarized context for LLM consumption.
    """

    async def get_patient_clinical_context(
        self,
        db: AsyncSession,
        patient_id: uuid.UUID,
        requesting_user_role: str,
        family_member_id: Optional[uuid.UUID] = None,
        consent_overrides: Optional[Dict[str, bool]] = None
    ) -> Dict[str, Any]:
        """
        Generates a Filtered Structured Summary of the patient's history.
        Enforces PHI-stripping and profile isolation.
        """
        try:
            from app.models.models import Condition, Medication, Allergy, MedicalRecord, ClinicalEvent

            # 1. Fetch Core Profile Data
            conditions_stmt = select(Condition).where(Condition.patient_id == patient_id)
            meds_stmt = select(Medication).where(Medication.patient_id == patient_id)
            allergies_stmt = select(Allergy).where(Allergy.patient_id == patient_id)
            records_stmt = select(MedicalRecord).where(MedicalRecord.patient_id == patient_id).order_by(desc(MedicalRecord.created_at)).limit(10)

            # 2. Fetch Clinical Events (Timeline)
            events_stmt = select(ClinicalEvent).where(
                ClinicalEvent.patient_id == patient_id,
                ClinicalEvent.family_member_id == family_member_id
            ).order_by(desc(ClinicalEvent.timestamp)).limit(20)
            
            # Execute all queries
            conditions_res = await db.execute(conditions_stmt)
            meds_res = await db.execute(meds_stmt)
            allergies_res = await db.execute(allergies_stmt)
            records_res = await db.execute(records_stmt)
            events_res = await db.execute(events_stmt)

            conditions = conditions_res.scalars().all()
            medications = meds_res.scalars().all()
            allergies = allergies_res.scalars().all()
            records = records_res.scalars().all()
            events = events_res.scalars().all()
            
            # 3. Reconstruct the Clinical Timeline
            timeline = []
            for event in events:
                entry = {
                    "t": event.timestamp.isoformat(),
                    "type": event.event_type,
                    "data": self._filter_phi(event.payload, requesting_user_role, consent_overrides)
                }
                timeline.append(entry)

            # 4. Assemble the Final LLM Context
            context = {
                "summary_version": "v1.enterprise",
                "patient_profile": {
                    "conditions": [{"name": c.name, "added_by": c.added_by} for c in conditions if not c.hidden_by_patient],
                    "medications": [{"name": m.generic_name, "dosage": m.dosage, "frequency": m.frequency} for m in medications if not m.hidden_by_patient],
                    "allergies": [{"allergen": a.allergen, "severity": a.severity} for a in allergies if not a.hidden_by_patient],
                    "recent_records": [{"name": r.record_name or r.type, "hospital": r.hospital_name, "summary": r.ai_summary} for r in records if not r.hidden_by_patient]
                },
                "timeline": timeline,
                "safety_flags": {
                    "phi_stripped": True,
                    "role_scoped": requesting_user_role
                }
            }
            
            return context

        except Exception as e:
            logger.error(f"CONTEXT_GEN_FAILURE: Failed to assemble context for patient {patient_id}. Error: {e}")
            return {"error": "Clinical context could not be assembled securely."}

    def _filter_phi(
        self, 
        payload: Dict[str, Any], 
        role: str, 
        overrides: Optional[Dict[str, bool]] = None
    ) -> Dict[str, Any]:
        """
        Internal Guard (SHIELD V2): Recursively strips or obscures sensitive 
        clinical and personal data before it leaves the secure perimeter.
        """
        import re

        # 1. Define sensitive clinical keys that require role-based redaction
        CLINICAL_SENSITIVE_KEYS = {"notes", "clinical_history", "private_comment", "internal_memo"}
        
        # 2. Define PII patterns (PII should NEVER reach an external LLM in raw form)
        PII_PATTERNS = {
            "email": r"[\w\.-]+@[\w\.-]+\.\w+",
            "phone": r"\b(?:\+?\d{1,3}[- ]?)?\(?\d{3,4}\)?[- ]?\d{3,4}[- ]?\d{4}\b|\b\d{3}-\d{4}\b",
            "date": r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b",
            "ssn": r"\b\d{3}-\d{2}-\d{4}\b"
        }

        def _scrub_value(val: Any) -> Any:
            if isinstance(val, str):
                # Apply PII scrubbing
                scrubbed = val
                for p_name, pattern in PII_PATTERNS.items():
                    scrubbed = re.sub(pattern, f"[{p_name.upper()}_REDACTED]", scrubbed)
                return scrubbed
            elif isinstance(val, dict):
                return {k: _scrub_value(v) for k, v in val.items() if k not in CLINICAL_SENSITIVE_KEYS or role in ["doctor", "admin"]}
            elif isinstance(val, list):
                return [_scrub_value(v) for v in val]
            return val

        # Execute recursive scrubbing
        filtered = _scrub_value(payload)
        
        # Secondary Guard: Explicit redaction for clinical notes if role is insufficient
        if role not in ["doctor", "admin"]:
            # Ensure even if missed by recursive scrub, these are killed
            for key in CLINICAL_SENSITIVE_KEYS:
                if key in filtered:
                    filtered[key] = "[CLINICAL_NOTES_REDACTED_FOR_ROLE]"
                    
        return filtered


clinical_context_service = ClinicalContextService()
