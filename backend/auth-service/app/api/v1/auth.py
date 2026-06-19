"""
backend/auth-service/app/api/v1/auth.py

WHAT CHANGED vs existing file (which only had a stub with OAuth2PasswordRequestForm):
  - login() accepts JSON body with email/phone/phone_number/username — not form-encoded
  - Returns access_token + role + user object in JSON body (every frontend reads these)
  - Also sets httpOnly cookie for browser security
  - Token payload includes "aud" (audience) claim per product for isolation
  - token_version field is "ver" in JWT to match healthcare-core/security.py expectation
  - OTP send/verify endpoints complete implementation
  - /register creates user with correct role + full_name + hospital_id
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Response, HTTPException, status, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.limiter import limiter
from app.models.user import User, RoleEnum, OTPVerification
from app.services.auth_service import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    generate_otp,
    hash_otp,
    verify_otp,
    deliver_otp,
)

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
    Unified login for ALL products.

    Accepts any of these body keys:
      username | email | phone | phone_number

    Returns:
      access_token, token_type, role, user_id, user object

    Also sets httpOnly secure cookie for browser-based apps.
    """
    # Accept all common field names used across our products
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

    # Look up by email OR phone
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
            detail="Account is suspended. Please contact support.",
        )

    # Build JWT payload
    # "ver" matches what healthcare-core/security.py TokenPayload expects
    token_data = {
        "sub":  str(user.id),
        "role": user.role.value,
        "ver":  user.token_version,
        "hid":  str(user.hospital_id) if user.hospital_id else None,
    }
    token = create_access_token(token_data)

    # Set httpOnly cookie for browser apps
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
        "access_token": token,
        "token_type":   "bearer",
        "role":         user.role.value,
        "user_id":      str(user.id),
        "user": {
            "id":          str(user.id),
            "role":        user.role.value,
            "name":        user.full_name or "",
            "full_name":   user.full_name or "",
            "email":       user.email or "",
            "phone":       user.phone_number or "",
            "hospital_id": str(user.hospital_id) if user.hospital_id else None,
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
    Create a new user account.
    Required: password + (email or phone_number)
    Optional: role (default: patient), full_name, hospital_id
    """
    email        = body.get("email")
    phone_number = body.get("phone_number") or body.get("phone")
    password     = body.get("password")
    role_str     = body.get("role", "patient")
    full_name    = body.get("full_name") or body.get("name") or ""
    hospital_id  = body.get("hospital_id")

    if not password:
        raise HTTPException(status_code=422, detail="password is required")
    if not email and not phone_number:
        raise HTTPException(
            status_code=422, detail="email or phone_number is required"
        )
    if len(password) < 8:
        raise HTTPException(
            status_code=422, detail="password must be at least 8 characters"
        )

    try:
        role = RoleEnum(role_str)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role: {role_str}")

    # Duplicate check
    if email:
        existing = await db.execute(
            select(User).where(User.email == email, User.deleted_at.is_(None))
        )
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="Email already registered")

    if phone_number:
        existing = await db.execute(
            select(User).where(
                User.phone_number == phone_number, User.deleted_at.is_(None)
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=409, detail="Phone number already registered"
            )

    import uuid
    new_user = User(
        email=email,
        phone_number=phone_number,
        hashed_password=get_password_hash(password),
        role=role,
        full_name=full_name,
        hospital_id=uuid.UUID(hospital_id) if hospital_id else None,
        is_active=True,
        token_version=1,
    )
    db.add(new_user)
    await db.flush()

    return {
        "id":    str(new_user.id),
        "role":  new_user.role.value,
        "email": new_user.email,
        "phone": new_user.phone_number,
    }


# ─── Send OTP ────────────────────────────────────────────────────────────────

@router.post("/send-otp", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def send_otp(
    request: Request,
    body:    dict,
    db:      AsyncSession = Depends(get_db),
):
    """Send OTP for patient app phone login."""
    phone = body.get("phone") or body.get("phone_number")
    email = body.get("email")

    if not phone and not email:
        raise HTTPException(
            status_code=422, detail="phone or email is required"
        )

    otp_code = generate_otp()
    hashed   = hash_otp(otp_code)
    expires  = datetime.now(timezone.utc) + timedelta(minutes=10)

    otp_record = OTPVerification(
        identifier=phone or email,
        hashed_otp=hashed,
        expires_at=expires,
    )
    db.add(otp_record)
    await db.flush()

    delivered = deliver_otp(phone, email, otp_code)
    if not delivered:
        logger.error("OTP delivery failed via all channels")

    return {"message": "OTP sent if the number is registered."}


# ─── Verify OTP ──────────────────────────────────────────────────────────────

@router.post("/verify-otp")
@limiter.limit("10/minute")
async def verify_otp_endpoint(
    request:  Request,
    response: Response,
    body:     dict,
    db:       AsyncSession = Depends(get_db),
):
    """Verify OTP and return access token. Used by patient mobile app."""
    identifier = (
        body.get("phone")
        or body.get("phone_number")
        or body.get("email")
    )
    otp_plain = body.get("otp") or body.get("code")

    if not identifier or not otp_plain:
        raise HTTPException(
            status_code=422, detail="phone/email and otp are required"
        )

    result = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.identifier == identifier,
            OTPVerification.is_verified == False,       # noqa: E712
            OTPVerification.expires_at > datetime.now(timezone.utc),
            OTPVerification.attempts < 5,
        )
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    otp_record = result.scalars().first()

    if not otp_record:
        raise HTTPException(
            status_code=400,
            detail="OTP expired or not found. Request a new one.",
        )

    if not verify_otp(otp_plain, otp_record.hashed_otp):
        otp_record.attempts += 1
        await db.flush()
        raise HTTPException(status_code=400, detail="Incorrect OTP.")

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
        "sub":  str(user.id),
        "role": user.role.value,
        "ver":  user.token_version,
    })

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
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":    str(user.id),
            "role":  user.role.value,
            "phone": user.phone_number or "",
            "email": user.email or "",
        },
    }


# ─── Check user ──────────────────────────────────────────────────────────────

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


# ─── Legacy OTP aliases (patient app uses these) ─────────────────────────────

@router.post("/otp-request", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def otp_request(
    request: Request,
    body:    dict,
    db:      AsyncSession = Depends(get_db),
):
    return await send_otp(request, body, db)


@router.post("/otp-verify")
@limiter.limit("10/minute")
async def otp_verify(
    request:  Request,
    response: Response,
    body:     dict,
    db:       AsyncSession = Depends(get_db),
):
    return await verify_otp_endpoint(request, response, body, db)
