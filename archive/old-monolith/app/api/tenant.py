from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user
from app.models.models import User

async def get_hospital_tenant_id(user: User = Depends(get_current_user)) -> int:
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
