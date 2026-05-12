from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional, List
from app.models.models import User, RoleEnum
from app.models.onboarding import HospitalInvite
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
        inviter_user_id: uuid.UUID,
        hospital_id: uuid.UUID,
        hospital_hospyn_id: str,
        email: str,
        role: str,
        department_id: Optional[uuid.UUID] = None
    ) -> HospitalInvite:
        """
        Creates a secure invitation for a new staff member (Doctor, Nurse, Pharmacist).
        """
        # Call OnboardingService with CORRECT ARGUMENTS and ORDER
        raw_token, onboarding_url = await OnboardingService.create_invite(
            db,
            hospital_id=hospital_id,
            email=email,
            hospyn_id=hospital_hospyn_id,
            created_by=inviter_user_id,
            role=role
        )
        
        # Retrieval of the invite object for the return (since create_invite returns strings)
        from app.models.onboarding import HospitalInvite
        from app.services.onboarding_service import OnboardingService
        token_hash = OnboardingService._hash_token(raw_token)
        stmt = select(HospitalInvite).where(HospitalInvite.token_hash == token_hash)
        invite = (await db.execute(stmt)).scalar_one()

        logger.info(f"STAFFING: New {role} invited to {hospital_hospyn_id} | Email: {email}")
        return invite

    @classmethod
    async def get_hospital_staff(
        cls,
        db: AsyncSession,
        hospital_id: uuid.UUID
    ):
        """
        Retrieves the full list of staff for a hospital via StaffProfile join.
        """
        from app.models.models import StaffProfile
        stmt = select(User).join(StaffProfile).where(StaffProfile.hospital_id == hospital_id)
        result = await db.execute(stmt)
        return result.scalars().all()

    @classmethod
    async def deactivate_staff_member(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        hospital_id: uuid.UUID
    ) -> bool:
        """
        Instantly revokes access for a staff member (Emergency Deactivation).
        """
        from app.models.models import StaffProfile
        # Atomic subquery to ensure they belong to this hospital
        stmt = update(User).where(
            User.id == user_id,
            User.id.in_(select(StaffProfile.user_id).where(StaffProfile.hospital_id == hospital_id))
        ).values(is_active=False)
        
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0
