from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional, List
from app.models.models import User, HospitalInvite, RoleEnum
from app.services.onboarding_service import OnboardingService
import uuid
import logging

logger = logging.getLogger(__name__)

class StaffService:
    """
    Hospyn Staffing Engine: Manages internal recruitment and role assignment for hospitals.
    """
    
    @classmethod
    async def invite_staff_member(
        cls,
        db: AsyncSession,
        inviter_hospyn_id: str,
        email: str,
        role: str,
        department_id: Optional[uuid.UUID] = None
    ) -> HospitalInvite:
        """
        Creates a secure invitation for a new staff member (Doctor, Nurse, Pharmacist).
        """
        # 1. Generate a unique activation token
        # 2. Store the invite with the role lock
        invite = await OnboardingService.create_invite(
            db,
            email=email,
            role=role,
            hospyn_id=inviter_hospyn_id
        )
        
        logger.info(f"STAFFING: New {role} invited to {inviter_hospyn_id} | Email: {email}")
        
        # In production: Trigger EmailService.send_staff_invite_email(email, invite.token)
        
        return invite

    @classmethod
    async def get_hospital_staff(
        cls,
        db: AsyncSession,
        hospyn_id: str
    ):
        """
        Retrieves the full list of staff for a hospital, including verification status.
        """
        stmt = select(User).where(User.hospyn_id == hospyn_id)
        result = await db.execute(stmt)
        return result.scalars().all()

    @classmethod
    async def deactivate_staff_member(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        hospyn_id: str
    ) -> bool:
        """
        Instantly revokes access for a staff member (Emergency Deactivation).
        """
        result = await db.execute(
            update(User)
            .where(User.id == user_id, User.hospyn_id == hospyn_id)
            .values(is_active=False)
        )
        await db.commit()
        return result.rowcount > 0
