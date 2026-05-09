from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.onboarding_service import OnboardingService
from app.models import models
from app.core.limiter import limiter
from pydantic import BaseModel, EmailStr
import uuid

router = APIRouter()

class InviteCreate(BaseModel):
    hospital_id: uuid.UUID
    email: EmailStr
    hospyn_id: str # The permanent tenant ID for this hospital

class InviteResponse(BaseModel):
    raw_token: str
    onboarding_url: str

@router.post("/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def create_hospital_invite(
    request: Request,
    invite_data: InviteCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_admin: models.User = Depends(deps.get_super_admin),
):
    """
    SUPER ADMIN ONLY: Generates a secure onboarding invite for a new hospital owner.
    """
    from app.core.audit import log_audit_action
    
    raw_token, onboarding_url = await OnboardingService.create_invite(
        db=db,
        hospital_id=invite_data.hospital_id,
        email=invite_data.email,
        hospyn_id=invite_data.hospyn_id,
        created_by=current_admin.id,
        ip_address=request.client.host
    )
    
    await log_audit_action(
        db=db,
        action="HOSPITAL_INVITE_CREATED",
        user_id=current_admin.id,
        resource_type="HOSPITAL_INVITE",
        details={
            "target_email": invite_data.email,
            "target_hospyn_id": invite_data.hospyn_id,
            "hospital_id": str(invite_data.hospital_id)
        }
    )
    
    return {
        "raw_token": raw_token,
        "onboarding_url": onboarding_url
    }
