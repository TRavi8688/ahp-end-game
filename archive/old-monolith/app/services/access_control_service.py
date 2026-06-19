from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import models
from app.core.logging import logger
import uuid

class AccessControlService:
    """
    Enterprise-Grade ABAC (Attribute-Based Access Control).
    Ensures that access to clinical records is granted based on 
    permanent tenant locks (hospyn_id) and explicit clinical grants.
    """
    
    @staticmethod
    async def can_doctor_access_patient(
        db: AsyncSession, 
        doctor_id: uuid.UUID, 
        patient_id: uuid.UUID,
        hospyn_id: str
    ) -> bool:
        """
        Verify if a doctor has a legitimate clinical reason to access a patient's data
        within the current hospital tenant.
        """
        # 1. Strict Tenant Check: Are they in the same organization?
        # 2. Check for explicit access grant
        stmt = select(models.AccessGrant).where(
            models.AccessGrant.doctor_id == doctor_id,
            models.AccessGrant.patient_id == patient_id,
            models.AccessGrant.status == models.AccessStatusEnum.granted,
            models.AccessGrant.hospyn_id == hospyn_id
        )
        result = await db.execute(stmt)
        return result.scalars().first() is not None

    @staticmethod
    async def log_access_attempt(
        db: AsyncSession,
        user_id: uuid.UUID,
        resource_id: uuid.UUID,
        granted: bool,
        reason: str,
        hospyn_id: str
    ):
        """Forensic logging of clinical data access attempts for regulatory compliance."""
        from app.core.audit import log_audit_action
        action = "DATA_ACCESS_GRANTED" if granted else "DATA_ACCESS_DENIED"
        await log_audit_action(
            db,
            action=action,
            user_id=user_id,
            resource_type="MEDICAL_RECORD",
            resource_id=resource_id,
            hospyn_id=hospyn_id,
            details={"granted": granted, "reason": reason}
        )
