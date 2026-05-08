from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Patient, Doctor
from app.repositories.base import UserRepository, PatientRepository
import logging
async def get_hospital_id(user: User = Depends(get_current_user)) -> int:
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
    
    stmt = select(Doctor).where(Doctor.user_id == user.id)
    result = await db.execute(stmt)
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")
    return doctor


async def get_current_hospital_admin(user: User = Depends(get_db_user)) -> User:
    """Gated dependency for Hospital Admin routes."""
    if user.role not in ["hospital_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Route requires Hospital Admin privileges.")
    return user
