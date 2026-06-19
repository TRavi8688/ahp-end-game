from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
import uuid
import json

from app.models.models import AuditLog, Message, NotificationTypeEnum, AddedByEnum
from app.services.integrity import integrity_service

class NotificationService:
    async def trigger_event(
        self,
        db: AsyncSession,
        hospital_id: uuid.UUID,
        actor_id: uuid.UUID,
        action: str,
        resource_type: str,
        resource_id: uuid.UUID,
        patient_id: Optional[uuid.UUID] = None,
        notification_text: Optional[str] = None,
        payload: Optional[dict] = None
    ):
        """
        SOVEREIGN EVENT BUS:
        1. Fetches the latest forensic hash to maintain the chain.
        2. Calculates a new HMAC signature for the current action.
        3. Persists a sealed Audit entry.
        4. Dispatches clinical communications.
        """
        # 1. Fetch Previous Link in the Forensic Chain
        stmt = select(AuditLog.signature).order_by(desc(AuditLog.timestamp)).limit(1)
        result = await db.execute(stmt)
        prev_hash = result.scalar_one_or_none() or "GENESIS_SEAL_000000000000000000000000"

        # 2. Generate Cryptographic Signature
        signature = integrity_service.sign_audit_entry(
            prev_hash=prev_hash,
            current_action=action,
            resource_id=str(resource_id)
        )

        # 3. Persist Sealed Audit Entry
        audit = AuditLog(
            hospital_id=hospital_id,
            user_id=actor_id,
            patient_id=patient_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=payload or {},
            signature=signature,
            prev_hash=prev_hash
        )
        db.add(audit)

        # 4. Dispatch Clinical Communications (Mobile App / Messaging)
        if patient_id and notification_text:
            # We use the Message model to simulate real-time patient notifications
            msg = Message(
                hospital_id=hospital_id,
                patient_id=patient_id,
                user_id=actor_id, # The sender (e.g. Doctor)
                content=notification_text,
                role="system"
            )
            db.add(msg)
            
        # Note: We don't commit here. The calling API (e.g. /prescribe) 
        # must commit to ensure atomicity between the resource creation and the audit log.
        return True

notification_service = NotificationService()
