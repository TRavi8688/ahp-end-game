# backend/healthcare-core/app/api/v1/partner_auth.py
# Auth routes: login, register, /me GET, /me PATCH

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext
from jose import jwt

from app.core.database import get_db
from app.core.security import get_current_partner, create_access_token
from app.config.settings import settings
from app.models.partner import Partner

router = APIRouter()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    email:    EmailStr
    password: str


class RegisterIn(BaseModel):
    name:          str
    email:         EmailStr
    password:      str
    phone:         str
    business_type: str = "pharmacy"


class UpdateMeIn(BaseModel):
    name: Optional[str] = None


class PartnerOut(BaseModel):
    id:            str
    name:          str
    email:         str
    partner_code:  str
    is_active:     bool
    business_type: str

    class Config:
        from_attributes = True


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/auth/register", status_code=201)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    # Check duplicate email
    result = await db.execute(select(Partner).where(Partner.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    valid_types = {"pharmacy", "laboratory", "clinic"}
    if body.business_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"business_type must be one of {valid_types}")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Generate unique partner code
    code = f"{body.business_type[:3].upper()}-{str(uuid.uuid4())[:6].upper()}"

    partner = Partner(
        id=uuid.uuid4(),
        name=body.name,
        email=body.email,
        password_hash=pwd_ctx.hash(body.password),
        partner_code=code,
        commission_rate=0.15,
        is_active=False,    # Activated after Hospyn review
        business_type=body.business_type,
        phone=body.phone,
    )
    db.add(partner)
    await db.commit()
    return {"message": "Registration submitted. We'll review and contact you within 1-2 business days."}


@router.post("/auth/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Partner).where(Partner.email == body.email))
    partner = result.scalar_one_or_none()

    if not partner or not pwd_ctx.verify(body.password, partner.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not partner.is_active:
        raise HTTPException(status_code=403, detail="Account pending approval. We'll email you once verified.")

    token = create_access_token({"sub": str(partner.id), "type": "partner"})

    return {
        "access_token": token,
        "token_type":   "bearer",
        "partner": {
            "id":            str(partner.id),
            "name":          partner.name,
            "email":         partner.email,
            "partner_code":  partner.partner_code,
            "is_active":     partner.is_active,
            "business_type": getattr(partner, "business_type", "pharmacy"),
        },
    }


@router.get("/auth/me")
async def get_me(partner: Partner = Depends(get_current_partner)):
    return {
        "id":            str(partner.id),
        "name":          partner.name,
        "email":         partner.email,
        "partner_code":  partner.partner_code,
        "is_active":     partner.is_active,
        "business_type": getattr(partner, "business_type", "pharmacy"),
    }


@router.patch("/auth/me")
async def update_me(
    body:    UpdateMeIn,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    if body.name is not None:
        partner.name = body.name.strip()
    await db.commit()
    return {
        "id":            str(partner.id),
        "name":          partner.name,
        "email":         partner.email,
        "partner_code":  partner.partner_code,
        "is_active":     partner.is_active,
        "business_type": getattr(partner, "business_type", "pharmacy"),
    }
