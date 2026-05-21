from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Patient, Doctor
from app.repositories.base import UserRepository, PatientRepository
import logging
import uuid
async def get_hospital_id(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> uuid.UUID:
    """
    Mandatory Enterprise Dependency to enforce Tenant Isolation.
    Extracts the hospital_id from the user's staff profile OR doctor profile.
    Prevents cross-hospital data leakage at the query level.
    """
    # 1. Try StaffProfile first (nurses, receptionists, admins, etc.)
    if user.staff_profile:
        return user.staff_profile.hospital_id
    
    # 2. For doctors, fall back to the Doctor table
    from app.models.models import Doctor, StaffProfile
    if user.role and user.role.value == "doctor":
        stmt = select(Doctor).where(Doctor.user_id == user.id)
        result = await db.execute(stmt)
        doctor = result.scalars().first()
        if doctor and doctor.hospital_id:
            return doctor.hospital_id
    
    # 3. Broader fallback — check StaffProfile by user_id directly
    stmt = select(StaffProfile).where(StaffProfile.user_id == user.id)
    result = await db.execute(stmt)
    staff = result.scalars().first()
    if staff and staff.hospital_id:
        return staff.hospital_id

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No hospital profile linked to this account. Please contact your administrator."
    )

from typing import List, Optional
from app.models.models import User, Patient, Doctor, RoleEnum

class RoleChecker:
    """
    ENTERPRISE RBAC GATE:
    Generic dependency to enforce specific roles on endpoints.
    Usage: Depends(RoleChecker([RoleEnum.doctor, RoleEnum.admin]))
    """
    def __init__(self, allowed_roles: List[RoleEnum]):
        self.allowed_roles = allowed_roles

    async def __call__(self, user: User = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            logger.warning(f"PERMISSION_DENIED: user_id={user.id} | required={self.allowed_roles} | actual={user.role}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "INSUFFICIENT_PERMISSIONS",
                    "message": f"This action requires one of the following roles: {[r.value for r in self.allowed_roles]}",
                    "required_roles": [r.value for r in self.allowed_roles]
                }
            )
        return user

async def get_db_user(user: User = Depends(get_current_user)) -> User:
    """Standard Enterprise Dependency to retrieve the full User model."""
    return user

async def get_current_patient(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> Patient:
    """Gated dependency for Patient-only routes."""
    if user.role != RoleEnum.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Route requires Patient role."
        )
    
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_user_id(user.id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Patient profile not initialized."
        )
    return patient

async def get_current_doctor(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> Doctor:
    """Gated dependency for Doctor-only routes."""
    if user.role != RoleEnum.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Route requires Doctor role."
        )
    
    from sqlalchemy.orm import selectinload
    stmt = select(Doctor).options(selectinload(Doctor.user)).where(Doctor.user_id == user.id)
    result = await db.execute(stmt)
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Doctor profile not found."
        )
    return doctor

async def get_super_admin(user: User = Depends(get_current_user)) -> User:
    """Strictly Gated dependency for Platform-level Super Admin routes."""
    if user.role != RoleEnum.admin:
        logger.warning(f"UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT: user_id={user.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail={
                "error_code": "INSUFFICIENT_PERMISSIONS",
                "message": "Platform SuperAdmin privileges are required for this action."
            }
        )
    return user

async def get_current_hospital_admin(user: User = Depends(get_current_user)) -> User:
    """Dependency for Hospital-level Admin routes (Onboarding, Staff mgmt)."""
    if user.role not in [RoleEnum.admin, RoleEnum.hospital_admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hospital Admin privileges are required for this action."
        )
    return user

async def get_active_family_member_id(
    request: Request,
    current_patient: Optional[Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db)
) -> Optional[uuid.UUID]:
    """
    Extract and VALIDATE family member context from headers.
    Ensures Patient A cannot access Patient B's family data via ID spoofing.
    """
    header_val = request.headers.get("X-Family-Member-ID")
    if not header_val or header_val in ["null", "undefined", ""]:
        return None
        
    try:
        active_id = uuid.UUID(header_val)
        
        # OWNERSHIP VALIDATION GATE
        from app.models.models import FamilyMember
        stmt = select(FamilyMember).where(
            FamilyMember.id == active_id,
            FamilyMember.patient_id == current_patient.id
        )
        result = await db.execute(stmt)
        exists = result.scalar_one_or_none()
        
        if not exists:
            logger.warning(f"SPOOFING_ATTEMPT: Patient {current_patient.id} tried to access FamilyID {active_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Unauthorized access to this family profile."
            )
            
        return active_id
    except (ValueError, AttributeError):
        return None

def check_module_enabled(module_name: str):
    async def dependency(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ):
        from sqlalchemy import select
        from app.models.models import HospitalSettings, RoleEnum

        hospital_id = None
        role_str = str(user.role.value) if hasattr(user.role, 'value') else str(user.role)
        if role_str in ["hospital_admin", "admin", "doctor", "receptionist", "pharmacy", "lab", "nurse"]:
            if hasattr(user, 'staff_profile') and user.staff_profile:
                hospital_id = user.staff_profile.hospital_id
            elif hasattr(user, 'doctor_profile') and user.doctor_profile:
                hospital_id = user.doctor_profile.hospital_id
            else:
                from app.models.models import StaffProfile, Doctor
                if role_str == "doctor":
                    doc_res = await db.execute(select(Doctor).where(Doctor.user_id == user.id))
                    doc = doc_res.scalars().first()
                    if doc:
                        hospital_id = doc.hospital_id
                else:
                    staff_res = await db.execute(select(StaffProfile).where(StaffProfile.user_id == user.id))
                    staff = staff_res.scalars().first()
                    if staff:
                        hospital_id = staff.hospital_id

        if not hospital_id:
            return

        result = await db.execute(
            select(HospitalSettings).where(HospitalSettings.hospital_id == hospital_id)
        )
        settings = result.scalars().first()

        is_enabled = True
        if module_name == "pharmacy":
            is_enabled = settings.enable_pharmacy if settings else False
        elif module_name == "labs":
            is_enabled = settings.enable_labs if settings else False
        elif module_name == "inpatient_beds":
            is_enabled = settings.enable_inpatient_beds if settings else False
        elif module_name == "hr":
            is_enabled = settings.enable_hr if settings else False
        elif module_name == "billing":
            is_enabled = settings.enable_billing if settings else True

        if not is_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Module '{module_name}' is disabled for this hospital."
            )
    return dependency

