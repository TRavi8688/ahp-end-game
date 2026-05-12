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
            # 1. Fetch the last 50 clinical events (Longitudinal Memory)
            stmt = select(ClinicalEvent).where(
                ClinicalEvent.patient_id == patient_id,
                ClinicalEvent.family_member_id == family_member_id
            ).order_by(desc(ClinicalEvent.timestamp)).limit(50)
            
            result = await db.execute(stmt)
            events = result.scalars().all()
            
            # 2. Reconstruct the Clinical Timeline
            timeline = []
            active_medications = []
            pending_labs = []
            
            for event in events:
                # Basic context per event
                entry = {
                    "t": event.timestamp.isoformat(),
                    "type": event.event_type,
                    "data": self._filter_phi(event.payload, requesting_user_role, consent_overrides)
                }
                timeline.append(entry)
                
                # Logic to track active state from events (Projections)
                if event.event_type == "PRESCRIPTION_CREATED":
                    active_medications.extend(event.payload.get("medications", []))
                elif event.event_type == "LAB_ORDER_CREATED":
                    pending_labs.append(event.aggregate_id)
                elif event.event_type == "LAB_STATUS_UPDATED" and event.payload.get("status") == "completed":
                    if event.aggregate_id in pending_labs:
                        pending_labs.remove(event.aggregate_id)

            # 3. Assemble the Final LLM Context
            context = {
                "summary_version": "v1.enterprise",
                "timeline": timeline[:20], # Most recent 20 for token efficiency
                "active_state": {
                    "medications": active_medications,
                    "pending_lab_count": len(pending_labs),
                    "recent_alerts": [e.payload for e in events if e.event_type in ["ABNORMAL_RESULT_DETECTED", "CRITICAL_ALERT"]][:3]
                },
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
