from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.staff_service import StaffService
from app.models.models import User, RoleEnum
from pydantic import BaseModel, EmailStr
import uuid
from typing import List, Dict, Any, Optional

router = APIRouter()

class StaffInviteCreate(BaseModel):
    email: EmailStr
    role: str
    department_id: Optional[uuid.UUID] = None

@router.post("/invites", status_code=status.HTTP_201_CREATED)
async def invite_staff(
    invite_data: StaffInviteCreate,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Hospital-side invitation endpoint. Only Owners and HR can invite staff."""
    from app.core.audit import log_clinical_audit
    
    # 1. Trigger Invitation
    if not current_user.staff_profile:
         raise HTTPException(status_code=400, detail="Inviter has no linked hospital profile.")

    invite = await StaffService.invite_staff_member(
        db,
        inviter_user_id=current_user.id,
        hospital_id=current_user.staff_profile.hospital_id,
        hospital_hospyn_id=current_user.hospyn_id or "HOSPYN-GENERIC",
        email=invite_data.email,
        role=invite_data.role,
        department_id=invite_data.department_id
    )
    
    await log_clinical_audit(
        db, 
        user_id=current_user.id, 
        action="STAFF_INVITE_SENT", 
        resource_type="STAFF_INVITE",
        details={"invited_email": invite_data.email, "role": invite_data.role}
    )
    
    return {"message": "Invitation sent successfully", "token_preview": invite.token[:8] + "..."}

@router.get("/members")
async def list_staff(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.doctor])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns the list of all staff members in the hospital."""
    if not current_user.staff_profile:
        return []
    return await StaffService.get_hospital_staff(db, current_user.staff_profile.hospital_id)
