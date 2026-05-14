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

logger = logging.getLogger(__name__)

async def get_db_user(user: User = Depends(get_current_user)) -> User:
    """
    Standard Enterprise Dependency to retrieve the full User model.
    Reuses the User object already fetched and validated by the security layer.
    """
    return user

async def get_current_patient(user: User = Depends(get_db_user), db: AsyncSession = Depends(get_db)) -> Patient:
    """Gated dependency for Patient-only routes."""
    if user.role != "patient":
        raise HTTPException(status_code=403, detail="Route requires Patient role.")
    
    repo = PatientRepository(Patient, db)
    patient = await repo.get_by_user_id(user.id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not initialized.")
    return patient

async def get_current_doctor(user: User = Depends(get_db_user), db: AsyncSession = Depends(get_db)) -> Doctor:
    """Gated dependency for Doctor-only routes."""
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Route requires Doctor role.")
    
    from sqlalchemy.orm import selectinload
    stmt = select(Doctor).options(selectinload(Doctor.user).selectinload(User.staff_profile)).where(Doctor.user_id == user.id)
    result = await db.execute(stmt)
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")
    return doctor


async def get_super_admin(user: User = Depends(get_db_user)) -> User:
    """Strictly Gated dependency for Platform-level Super Admin routes."""
    if user.role.value != "admin":
        logger.warning(f"UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT: user_id={user.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail={
                "error_code": "INSUFFICIENT_PERMISSIONS",
                "message": "Platform SuperAdmin privileges are required for this action."
            }
        )
    return user


async def get_active_family_member_id(request: Request) -> Optional[uuid.UUID]:
    """
    Optional Dependency to extract the family member context from headers.
    If provided, clinical queries will be scoped to this family member.
    If not provided, queries default to the primary patient profile.
    """
    from typing import Optional
    header_val = request.headers.get("X-Family-Member-ID")
    if header_val and header_val not in ["null", "undefined", ""]:
        try:
            return uuid.UUID(header_val)
        except ValueError:
            return None
    return None
