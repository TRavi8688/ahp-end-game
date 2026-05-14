from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Patient, Doctor
from app.repositories.base import UserRepository, PatientRepository
import logging
import uuid
async def get_hospital_id(user: User = Depends(get_current_user)) -> uuid.UUID:
    """
    Mandatory Enterprise Dependency to enforce Tenant Isolation.
    Extracts the hospital_id from the user's staff profile.
    Prevents cross-hospital data leakage at the query level.
    """
    if not user.staff_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff profile not found. Access denied."
        )
    return user.staff_profile.hospital_id

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
