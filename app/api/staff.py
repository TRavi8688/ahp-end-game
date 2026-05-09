from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.staff_service import StaffService
from app.models.models import User, RoleEnum
from pydantic import BaseModel, EmailStr
import uuid
from typing import List

router = APIRouter()

class StaffInviteCreate(BaseModel):
    email: EmailStr
    role: str
    department_id: Optional[uuid.UUID] = None

@router.post("/invites", status_code=status.HTTP_201_CREATED)
async def invite_staff(
    invite_data: StaffInviteCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Hospital-side invitation endpoint. Only Owners and HR can invite staff.
    """
    # 1. Permission Check
    if current_user.role not in [RoleEnum.OWNER, RoleEnum.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Owners or HR Managers can invite staff."
        )
    
    # 2. Trigger Invitation
    invite = await StaffService.invite_staff_member(
        db,
        inviter_hospyn_id=current_user.hospyn_id,
        email=invite_data.email,
        role=invite_data.role,
        department_id=invite_data.department_id
    )
    
    return {"message": "Invitation sent successfully", "token_preview": invite.token[:8] + "..."}

@router.get("/members")
async def list_staff(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Returns the list of all staff members in the hospital.
    """
    return await StaffService.get_hospital_staff(db, current_user.hospyn_id)
