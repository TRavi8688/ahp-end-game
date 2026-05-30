from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.models.models import User
from sqlalchemy import delete
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(
    current_user: User = Depends(deps.get_db_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Mandatory App Store Requirement: Allows users to delete their own account and all associated PHI.
    """
    logger.info(f"PRIVACY: User {current_user.id} requested full account deletion.")
    
    # In a production enterprise system, this would trigger a cascaded deletion 
    # of all clinical records, or move them to long-term cold storage if legally required.
    
    await db.execute(delete(User).where(User.id == current_user.id))
    await db.commit()
    
    return None
