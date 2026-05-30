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
        phone_number: Optional[str] = None,
        specialty: Optional[str] = None,
        job_title: Optional[str] = None,
        first_name: Optional[str] = "Staff",
        last_name: Optional[str] = "Member",
        department_id: Optional[uuid.UUID] = None,
        ahba_id: Optional[str] = None,
        certification_url: Optional[str] = None
    ):
        """
        Creates a secure invitation for a new staff member and provisions their account instantly.
        """
        # Check if user already exists
        stmt_u = select(User).where(User.email == email)
        user = (await db.execute(stmt_u)).scalars().first()
        
        import secrets
        from app.core.security import get_password_hash
        
        temp_password = f"Temp-{secrets.token_hex(4).upper()}!"
        
        # Map the role string to core RoleEnum
        role_enum_val = RoleEnum.hospital_admin
        role_lower = role.lower()
        if "doctor" in role_lower:
            role_enum_val = RoleEnum.doctor
        elif "nurse" in role_lower:
            role_enum_val = RoleEnum.nurse
        elif "receptionist" in role_lower:
            role_enum_val = RoleEnum.receptionist
        elif "lab" in role_lower or "technician" in role_lower:
            role_enum_val = RoleEnum.lab
        elif "pharmacist" in role_lower or "pharmacy" in role_lower:
            role_enum_val = RoleEnum.pharmacy
        
        # Generate a unique Hospyn ID for this staff member (NOT the hospital's ID)
        role_prefix = "STF"
        if role_enum_val == RoleEnum.doctor:
            role_prefix = "DOC"
        elif role_enum_val == RoleEnum.nurse:
            role_prefix = "NRS"
        elif role_enum_val == RoleEnum.receptionist:
            role_prefix = "RCP"
        elif role_enum_val == RoleEnum.lab:
            role_prefix = "LAB"
        elif role_enum_val == RoleEnum.pharmacy:
            role_prefix = "PHR"
        elif role_enum_val == RoleEnum.hospital_admin:
            role_prefix = "ADM"
        staff_hospyn_id = f"HOSPYN-{role_prefix}-{uuid.uuid4().hex[:6].upper()}"

        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash(temp_password),
                role=role_enum_val,
                hospyn_id=staff_hospyn_id,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_temporary_password=True
            )
            db.add(user)
            await db.flush()
        else:
            # FIX: If user exists, update their password so the new temp password works
            user.hashed_password = get_password_hash(temp_password)
            user.is_temporary_password = True
            user.role = role_enum_val
            
            # Upgrade Hospyn ID if it's a legacy or patient ID
            if not user.hospyn_id or not user.hospyn_id.startswith("HOSPYN-"):
                user.hospyn_id = staff_hospyn_id
            
        # Create Staff Profile instantly
        from app.models.models import StaffProfile, Doctor
        stmt_sp = select(StaffProfile).where(StaffProfile.user_id == user.id)
        staff_prof = (await db.execute(stmt_sp)).scalars().first()
        if not staff_prof:
            staff_prof = StaffProfile(
                user_id=user.id,
                hospital_id=hospital_id,
                department_id=department_id,
                phone_number=phone_number,
                specialty=specialty,
                job_title=job_title
            )
            db.add(staff_prof)
            await db.flush()
        else:
            staff_prof.phone_number = phone_number
            staff_prof.specialty = specialty
            staff_prof.job_title = job_title
            if department_id:
                staff_prof.department_id = department_id
                
        # If doctor, also ensure Doctor profile exists
        if user.role.value == "doctor" or user.role == RoleEnum.doctor:
            stmt_doc = select(Doctor).where(Doctor.user_id == user.id)
            doc_prof = (await db.execute(stmt_doc)).scalars().first()
            if not doc_prof:
                doc_prof = Doctor(
                    user_id=user.id,
                    specialty=specialty or "General Medicine",
                    license_number=f"LIC-{secrets.token_hex(4).upper()}",
                    license_status="verified",
                    ahba_id=ahba_id,
                    certification_url=certification_url
                )
                db.add(doc_prof)
                await db.flush()
            else:
                doc_prof.ahba_id = ahba_id
                doc_prof.certification_url = certification_url
                await db.flush()

        # Call OnboardingService with CORRECT ARGUMENTS and ORDER
        raw_token, onboarding_url = await OnboardingService.create_invite(
            db,
            hospital_id=hospital_id,
            email=email,
            hospyn_id=hospital_hospyn_id,
            created_by=inviter_user_id,
            role=role,
            phone_number=phone_number,
            specialty=specialty,
            job_title=job_title
        )
        
        # Retrieval of the invite object for the return (since create_invite returns strings)
        from app.models.onboarding import HospitalInvite
        token_hash = OnboardingService._hash_token(raw_token)
        stmt = select(HospitalInvite).where(HospitalInvite.token_hash == token_hash)
        invite = (await db.execute(stmt)).scalar_one()

        await db.commit()

        staff_hospyn_id = user.hospyn_id
        logger.info(f"STAFFING: New {role} [{staff_hospyn_id}] invited to {hospital_hospyn_id} | Email: {email}")
        return invite, raw_token, temp_password, staff_hospyn_id

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
        from sqlalchemy.orm import selectinload
        stmt = select(StaffProfile).options(selectinload(StaffProfile.user)).where(StaffProfile.hospital_id == hospital_id)
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
