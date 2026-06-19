"""
backend/auth-service/app/api/v1/auth.py

FIXES:
  FIX-A1: login() now accepts body.get("phone_number") in addition to
           "phone"/"username"/"email" — super-admin and staff portal send different keys.
  FIX-A2: Returns access_token + role + user_id in JSON body (frontend reads these).
           Also sets httpOnly cookie for browser-based apps.
  FIX-A3: login() uses async DB session (was sync Depends(get_db)).
  FIX-A4: OTP send/verify endpoints added for patient mobile app.
  FIX-A5: /register endpoint creates user with correct role from body.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Response, HTTPException, status, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.limiter import limiter
from app.models.user import User, RoleEnum, OTPVerification
from app.services.auth_service import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, generate_otp, hash_otp, verify_otp,
    deliver_otp,
)
import re

logger = logging.getLogger(__name__)
router = APIRouter()

COOKIE_NAME    = "token"
COOKIE_MAX_AGE = 60 * 60 * 8   # 8 hours


# ─── Login ───────────────────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request:  Request,
    response: Response,
    body:     dict,
    db:       AsyncSession = Depends(get_db),
):
    """
    FIX-A1: Accepts any of these body keys for the identifier:
      username, email, phone, phone_number
    Sends access_token in JSON body AND as httpOnly cookie.
    """
    # FIX-A1: accept all common key names
    identifier = (
        body.get("username")
        or body.get("email")
        or body.get("phone")
        or body.get("phone_number")
    )
    password = body.get("password")

    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="username/email/phone and password are required",
        )

    # Look up user by email or phone
    result = await db.execute(
        select(User).where(
            ((User.email == identifier) | (User.phone_number == identifier)),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalars().first()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is suspended. Contact support.",
        )

    token_data = {
        "sub":           str(user.id),
        "role":          user.role.value,
        "hospital_id":   str(user.hospital_id) if user.hospital_id else None,
        "token_version": user.token_version,
    }
    token = create_access_token(token_data)
    refresh = create_refresh_token(token_data)

    # FIX-A2: Set httpOnly cookie AND return in body
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )

    return {
        "access_token":  token,
        "refresh_token": refresh,
        "token_type":    "bearer",
        "role":          user.role.value,
        "user_id":       str(user.id),
        "user": {
            "id":    str(user.id),
            "role":  user.role.value,
            "name":  user.full_name or "",
            "email": user.email or "",
            "phone": user.phone_number or "",
        },
    }


# ─── Logout ──────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"status": "logged_out"}


# ─── Register ────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(
    request: Request,
    body:    dict,
    db:      AsyncSession = Depends(get_db),
):
    """
    FIX-A5: Creates user with role from body. Defaults to 'patient'.
    Required fields: password + (email or phone_number)
    """
    email        = body.get("email")
    phone_number = body.get("phone_number") or body.get("phone")
    password     = body.get("password")
    role_str     = body.get("role", "patient")
    full_name    = body.get("full_name") or body.get("name") or ""

    if not password:
        raise HTTPException(status_code=422, detail="password is required")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if not email and not phone_number:
        raise HTTPException(status_code=422, detail="email or phone_number is required")
    if email and not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        raise HTTPException(status_code=422, detail="Invalid email format")

    try:
        role = RoleEnum(role_str)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role: {role_str}")

    # Duplicate check
    if email:
        existing = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="Email already registered")
    if phone_number:
        existing = await db.execute(select(User).where(User.phone_number == phone_number, User.deleted_at.is_(None)))
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="Phone number already registered")

    user = User(
        email=email,
        phone_number=phone_number,
        hashed_password=get_password_hash(password),
        role=role,
        full_name=full_name,
        is_active=True,
        token_version=1,
    )
    db.add(user)
    await db.flush()

    return {
        "id":    str(user.id),
        "role":  user.role.value,
        "email": user.email,
        "phone": user.phone_number,
    }


# ─── Send OTP ────────────────────────────────────────────────────────────────

@router.post("/send-otp", status_code=status.HTTP_202_ACCEPTED)
@router.post("/otp/send", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def send_otp(
    request: Request,
    body:    dict,
    db:      AsyncSession = Depends(get_db),
):
    """Send OTP to phone or email for patient app authentication."""
    phone = body.get("phone") or body.get("phone_number")
    email = body.get("email")

    if not phone and not email:
        raise HTTPException(status_code=422, detail="phone or email is required")

    otp_code   = generate_otp()
    hashed     = hash_otp(otp_code)
    expires_at = datetime.now(timezone.utc).replace(
        second=0, microsecond=0
    )
    from datetime import timedelta
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    otp_record = OTPVerification(
        identifier=phone or email,
        hashed_otp=hashed,
        expires_at=expires_at,
    )
    db.add(otp_record)
    await db.flush()

    delivered = deliver_otp(phone, email, otp_code)
    if not delivered:
        logger.error("OTP delivery failed — all channels exhausted")

    return {"message": "OTP sent if the number is registered."}


# ─── Verify OTP ──────────────────────────────────────────────────────────────

@router.post("/verify-otp")
@router.post("/otp/verify")
@limiter.limit("10/minute")
async def verify_otp_endpoint(
    request:  Request,
    response: Response,
    body:     dict,
    db:       AsyncSession = Depends(get_db),
):
    """Verify OTP and return access token. Used by patient mobile app."""
    identifier = body.get("phone") or body.get("phone_number") or body.get("email")
    otp_plain  = body.get("otp") or body.get("code")

    if not identifier or not otp_plain:
        raise HTTPException(status_code=422, detail="phone/email and otp are required")

    # Get most recent non-expired, non-verified OTP
    result = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.identifier == identifier,
            OTPVerification.is_verified == False,
            OTPVerification.expires_at > datetime.now(timezone.utc),
            OTPVerification.attempts < 5,
        )
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    otp_record = result.scalars().first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP expired or not found. Please request a new one.")

    if not verify_otp(otp_plain, otp_record.hashed_otp):
        otp_record.attempts += 1
        await db.flush()
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    otp_record.is_verified = True
    await db.flush()

    # Find or create user
    result = await db.execute(
        select(User).where(
            (User.email == identifier) | (User.phone_number == identifier),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalars().first()

    if not user:
        # Auto-create patient account on first OTP verify
        user = User(
            phone_number=identifier if "@" not in identifier else None,
            email=identifier if "@" in identifier else None,
            hashed_password=get_password_hash(""),
            role=RoleEnum.patient,
            is_active=True,
            token_version=1,
        )
        db.add(user)
        await db.flush()

    token = create_access_token({
        "sub":           str(user.id),
        "role":          user.role.value,
        "token_version": user.token_version,
    })

    response.set_cookie(
        key=COOKIE_NAME, value=token, httponly=True, secure=True,
        samesite="strict", max_age=COOKIE_MAX_AGE, path="/",
    )

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":    str(user.id),
            "role":  user.role.value,
            "phone": user.phone_number or "",
            "email": user.email or "",
        },
    }


# ─── Check user exists ────────────────────────────────────────────────────────

@router.get("/check-user")
@limiter.limit("20/minute")
async def check_user(
    request:    Request,
    identifier: str,
    db:         AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            (User.phone_number == identifier) | (User.email == identifier),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalars().first()
    return {"exists": user is not None}
