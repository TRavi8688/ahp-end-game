from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.onboarding_service import OnboardingService
from app.services.organization_service import OrganizationService
from app.core.security import get_password_hash
from app.models.models import User, RoleEnum
from pydantic import BaseModel, EmailStr
import uuid

router = APIRouter()

class OnboardingActivation(BaseModel):
    token: str
    password: str
    first_name: str
    last_name: str

@router.post("/activate-onboarding")
async def activate_professional_account(
    data: OnboardingActivation,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Finalizes the onboarding for Owners and HR Managers.
    Validates the hashed token, sets the password, and activates the account.
    """
    # 1. Verify the invitation token
    invite = await OnboardingService.verify_invite(db, data.token)
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation token."
        )

    # 2. Create the permanent User account
    new_user = User(
        email=invite.email,
        hashed_password=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=invite.role,
        hospyn_id=invite.hospyn_id,
        is_active=True
    )
    
    db.add(new_user)
    
    # 3. Mark the invite as used
    await OnboardingService.complete_onboarding(db, invite.id)
    await db.commit()

    return {
        "message": "Account successfully activated.",
        "role": invite.role,
        "hospyn_id": invite.hospyn_id,
        "redirect_to": "/dashboard"
    }
