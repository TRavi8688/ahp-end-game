from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.staff_service import StaffService
from app.models.models import User, RoleEnum
from pydantic import BaseModel, EmailStr
import uuid
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/staff", tags=["Staff"])

class StaffInviteCreate(BaseModel):
    email: EmailStr
    role: str
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    job_title: Optional[str] = None
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

    # Parsing full name into first/last
    first_name = "Staff"
    last_name = "Member"
    if invite_data.full_name:
        parts = invite_data.full_name.strip().split(None, 1)
        first_name = parts[0]
        if len(parts) > 1:
            last_name = parts[1]

    invite, raw_token, temp_password = await StaffService.invite_staff_member(
        db,
        inviter_user_id=current_user.id,
        hospital_id=current_user.staff_profile.hospital_id,
        hospital_hospyn_id=current_user.hospyn_id or "HOSPYN-GENERIC",
        email=invite_data.email,
        role=invite_data.role,
        phone_number=invite_data.phone_number or invite_data.phone,
        specialty=invite_data.specialty,
        job_title=invite_data.job_title or invite_data.role,
        first_name=first_name,
        last_name=last_name,
        department_id=invite_data.department_id
    )
    
    await log_clinical_audit(
        db, 
        user_id=current_user.id, 
        action="STAFF_INVITE_SENT", 
        resource_type="STAFF_INVITE",
        details={"invited_email": invite_data.email, "role": invite_data.role}
    )
    
    portal_url = "https://hospyn-erp-portal.web.app/accept-invite" 
    if invite_data.role == "doctor":
        portal_url = "https://hospyn-doctor-pro.web.app/accept-invite"

    from app.core.email import send_staff_invite_email
    email_sent = send_staff_invite_email(
        to_email=invite_data.email,
        staff_name=invite_data.full_name or "New Staff Member",
        role=invite_data.role,
        portal_url=f"{portal_url}?token={raw_token}",
        temp_password=temp_password
    )
    
    return {
        "message": "Invitation sent successfully to staff email" if email_sent else "Invitation simulated (SMTP not configured)", 
        "token_preview": raw_token[:8] + "...",
        "temp_password": temp_password
    }

@router.get("/members")
async def list_staff(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.doctor])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns the list of all staff members in the hospital."""
    if not current_user.staff_profile:
        return []
    profiles = await StaffService.get_hospital_staff(db, current_user.staff_profile.hospital_id)
    
    # Safe serialization to ensure nested 'user' object is always delivered to frontend
    results = []
    for p in profiles:
        results.append({
            "id": str(p.id),
            "user_id": str(p.user_id),
            "department_id": str(p.department_id) if p.department_id else None,
            "user": {
                "id": str(p.user.id),
                "email": p.user.email,
                "first_name": p.user.first_name,
                "last_name": p.user.last_name,
                "role": p.user.role.value if p.user.role else None,
                "is_active": p.user.is_active
            } if p.user else None
        })
    return results
