from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Any

from app.core.database import get_db
from app.core.security import create_access_token, verify_password
from app.models.core import User

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    role: str

@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    # 1. Look up user by email (OAuth2 'username' field usually maps to email)
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # 2. Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # 3. Generate JWT
    user_role = user.role.value if hasattr(user.role, 'value') else user.role
    access_token = create_access_token(
        subject=user.id,
        role=user_role,
        tenant_id=user.hospyn_id
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "role": user_role
    }

@router.get("/me")
async def read_users_me():
    """
    Get current user details. (Will require dependency injection of current user later)
    """
    return {"message": "Current user logic goes here"}
