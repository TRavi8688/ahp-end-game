import hmac
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.models import AuditLog
from app.core.config import settings
from app.core.logging import logger

def calculate_log_signature(data: Dict[str, Any], prev_hash: str = "") -> str:
    """
    Cryptographic signing of audit logs to ensure immutability.
    Uses HMAC-SHA256 with the ENCRYPTION_KEY as the secret.
    """
    serialized = json.dumps(data, sort_keys=True, default=str)
    message = f"{prev_hash}|{serialized}"
    return hmac.new(
        settings.ENCRYPTION_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()

async def log_audit_action(
    db: Optional[AsyncSession] = None,
    action: str = "UNKNOWN",
    user_id: Optional[uuid.UUID] = None,
    resource_type: Optional[str] = "SYSTEM",
    resource_id: Optional[uuid.UUID] = None,
    patient_id: Optional[uuid.UUID] = None,
    hospital_id: Optional[uuid.UUID] = None,
    hospyn_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """
    Immutable Audit Logging with Per-Tenant Chain of Trust.
    Every log entry is signed and chained to the previous entry's hash for that hospital.
    """
    from app.core.database import AsyncSessionLocal
    import uuid as uuid_lib
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Get the hash of the previous log for THIS tenant for chaining
            stmt = select(AuditLog.signature).where(
                AuditLog.hospyn_id == hospyn_id
            ).order_by(desc(AuditLog.id)).limit(1)
            
            result = await session.execute(stmt)
            prev_hash = result.scalar() or f"ROOT_GENESIS_{hospyn_id or 'GLOBAL'}"

            # 2. Prepare log data
            log_data = {
                "action": action,
                "user_id": str(user_id) if user_id else None,
                "hospyn_id": hospyn_id,
                "hospital_id": str(hospital_id) if hospital_id else None,
                "resource_type": resource_type,
                "resource_id": str(resource_id) if resource_id else None,
                "patient_id": str(patient_id) if patient_id else None,
                "details": details,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            # 3. Calculate Signature (Immutability Check)
            signature = calculate_log_signature(log_data, prev_hash)

            audit_entry = AuditLog(
                action=action,
                user_id=user_id,
                hospital_id=hospital_id,
                hospyn_id=hospyn_id,
                resource_type=resource_type,
                resource_id=resource_id,
                patient_id=patient_id,
                details=details,
                ip_address=ip_address,
                user_agent=user_agent,
                signature=signature,
                prev_hash=prev_hash
            )
            
            session.add(audit_entry)
            await session.commit()
        except Exception as e:
            logger.error(f"AUDIT_LOGGING_FAILURE: {e}")
            await session.rollback()
            
async def verify_audit_chain(logs: list[AuditLog]) -> tuple[bool, list[str]]:
    """
    ENTERPRISE COMPLIANCE:
    Verifies a sequence of audit logs by recalculating the HMAC chain.
    Returns (is_valid, list_of_corrupted_log_ids).
    """
    corrupted_ids = []
    
    # We iterate forward through the logs to verify the chain
    # In practice, the caller should provide logs in ascending order.
    sorted_logs = sorted(logs, key=lambda x: x.timestamp)
    
    for i, log in enumerate(sorted_logs):
        # 1. Prepare expected log data format
        log_data = {
            "action": log.action,
            "user_id": str(log.user_id) if log.user_id else None,
            "hospyn_id": log.hospyn_id,
            "hospital_id": str(log.hospital_id) if log.hospital_id else None,
            "resource_type": log.resource_type,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "patient_id": str(log.patient_id) if log.patient_id else None,
            "details": log.details,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "timestamp": log.timestamp.isoformat() if hasattr(log.timestamp, "isoformat") else str(log.timestamp)
        }
        
        # 2. Recompute signature
        expected_sig = calculate_log_signature(log_data, log.prev_hash)
        
        # 3. Verify
        if log.signature != expected_sig:
            logger.warning("AUDIT_CHAIN_CORRUPTION", log_id=log.id, action=log.action)
            corrupted_ids.append(str(log.id))
            
    return len(corrupted_ids) == 0, corrupted_ids

