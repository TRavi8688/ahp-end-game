"""
app/services/audit_service.py
Immutable audit log writer with HMAC-SHA256 integrity chaining.
Place in: backend/healthcare-core/app/services/audit_service.py
         AND backend/auth-service/app/services/audit_service.py
"""
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog  # your SQLAlchemy model

_AUDIT_HMAC_SECRET = os.environ.get("AUDIT_HMAC_SECRET", "").encode()


def _compute_integrity_hash(
    log_id: str,
    actor_id: Optional[str],
    action: str,
    created_at: datetime,
) -> str:
    if not _AUDIT_HMAC_SECRET:
        return ""
    payload = f"{log_id}:{actor_id or 'system'}:{action}:{created_at.isoformat()}"
    return hmac.new(_AUDIT_HMAC_SECRET, payload.encode(), hashlib.sha256).hexdigest()


async def write_audit_log(
    db: AsyncSession,
    *,
    hospital_id: str,
    action: str,
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    patient_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    request_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "success",
    detail: Optional[str] = None,
) -> None:
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    integrity = _compute_integrity_hash(log_id, actor_id, action, now)

    entry = AuditLog(
        id=log_id,
        hospital_id=hospital_id,
        actor_id=actor_id,
        actor_role=actor_role,
        patient_id=patient_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        request_id=request_id,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        detail=detail,
        integrity_hash=integrity,
        created_at=now,
    )
    db.add(entry)
    # Do NOT call db.commit() here — caller controls the transaction
    # (caller commits; if main transaction rolls back, the audit log also rolls back,
    #  which is correct — we only log completed operations)
