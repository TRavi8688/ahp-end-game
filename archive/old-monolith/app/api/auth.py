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

import json
import base64
from app.schemas import schemas
import uuid

def _decode_jwt_unverified(token: str) -> dict:
    try:
        # Pad the payload string to avoid incorrect padding errors
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        return json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
    except Exception:
        return {}

@router.post("/google", response_model=Token)
async def google_login(
    request: schemas.GoogleLoginRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Authenticate via Google JWT token.
    For production, use google-auth to strictly verify the JWT signature.
    """
    payload = _decode_jwt_unverified(request.token)
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Invalid Google token payload")
        
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        # We return a 404 so the frontend knows to show the "Setup Profile" modal
        raise HTTPException(status_code=404, detail="Google user profile not found. Please complete setup.")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

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

class AppleLoginRequest(BaseModel):
    token: str

@router.post("/apple", response_model=Token)
async def apple_login(
    request: AppleLoginRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Authenticate via Apple Identity Token.
    """
    payload = _decode_jwt_unverified(request.token)
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Invalid Apple token payload")
        
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Apple user profile not found. Please complete setup.")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

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

@router.post("/forgot-password/request")
async def request_forgot_password(
    request: schemas.ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate an OTP and send it to the user's email/phone.
    """
    result = await db.execute(select(User).where((User.email == request.identifier) | (User.hospyn_id == request.identifier)))
    user = result.scalars().first()
    if not user:
         raise HTTPException(status_code=404, detail="Account not found.")
         
    # Mocking OTP sent successfully for development
    return {"message": "OTP Dispatched", "target": user.email}

@router.post("/forgot-password/verify")
async def verify_forgot_password(
    request: schemas.ForgotPasswordVerify,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify the OTP provided by the user.
    """
    if len(request.otp) != 6:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    # Generate a dummy reset token
    reset_token = str(uuid.uuid4())
    return {"message": "OTP Verified", "reset_token": reset_token}

@router.post("/forgot-password/reset")
async def reset_password(
    request: schemas.ForgotPasswordReset,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using the reset token.
    """
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password too weak")
        
    # In a real app, verify reset_token and update user's hashed_password
    return {"message": "Password reset successful."}
