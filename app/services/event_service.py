import uuid
import json
import hashlib
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import ClinicalEvent
from app.core.config import settings
from app.core.logging import logger

class EventService:
    """
    Enterprise Event Infrastructure for AHP 2.0.
    Enforces immutable, signed, and aggregate-linked clinical events.
    """

    @staticmethod
    def _generate_signature(payload: Dict[str, Any], metadata: Dict[str, Any]) -> str:
        """
        Creates a cryptographic signature of the event content.
        Ensures the event remains immutable and tamper-evident.
        """
        content = json.dumps({"p": payload, "m": metadata}, sort_keys=True)
        # In a real system, we'd use HMAC with a secret from Vault/KMS
        return hashlib.sha256(f"{content}{settings.SECRET_KEY}".encode()).hexdigest()

    async def log_event(
        self,
        db: AsyncSession,
        tenant_id: int,
        patient_id: int,
        actor_id: int,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        payload: Dict[str, Any],
        metadata_info: Optional[Dict[str, Any]] = None
    ) -> ClinicalEvent:
        """
        Appends a new immutable clinical event to the longitudinal stream.
        """
        try:
            event_id = str(uuid.uuid4())
            meta = metadata_info or {}
            
            # Enrich metadata with system context if not provided
            if "version" not in meta:
                meta["sys_version"] = settings.VERSION
            
            signature = self._generate_signature(payload, meta)
            
            event = ClinicalEvent(
                id=event_id,
                tenant_id=tenant_id,
                patient_id=patient_id,
                actor_id=actor_id,
                event_type=event_type,
                aggregate_type=aggregate_type,
                aggregate_id=aggregate_id,
                payload=payload,
                metadata_info=meta,
                signature=signature,
                version=1
            )
            
            db.add(event)
            # Note: We don't commit here. The calling service handles the transaction.
            # This ensures the clinical action and the event log are atomic.
            
            logger.info(f"CLINICAL_EVENT_LOGGED: {event_type} | Patient: {patient_id} | ID: {event_id}")
            return event
            
        except Exception as e:
            logger.error(f"EVENT_LOG_FAILURE: Failed to record {event_type} for patient {patient_id}. Error: {e}")
            raise

event_service = EventService()
