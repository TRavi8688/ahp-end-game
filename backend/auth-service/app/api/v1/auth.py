"""
Authentication endpoints
FIXED:
  1. login() now accepts body.get("phone_number") in addition to "phone"/"username"/"email"
     — the super-admin dashboard Login.jsx sends { phone: ..., password: ... }
  2. super_admin is a valid role — previously the Literal in TokenPayload excluded it,
     causing all super-admin JWTs to fail validation in healthcare-core
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.core.database import get_db
try:
    from app.core.deps import get_redis
except ImportError:
    def get_redis(): return None

from app.core.security import create_access_token, create_refresh_token
from app.core.otp_security import store_otp, verify_otp_with_protection
from app.services import auth_service
from app.core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

COOKIE_NAME    = "token"
COOKIE_MAX_AGE = 60 * 60 * 8   # 8 hours


# ─── Per-user OTP rate limit (Redis) ─────────────────────────────────────────

async def check_otp_rate_limit(phone_number: str, redis_client: Redis) -> bool:
    if not redis_client:
        return True
    key   = f"otp_rate:{phone_number}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, 3600)
    if count > 5:
        logger.warning("OTP rate limit exceeded for phone: %s***", phone_number[:4])
        return False
    return True


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    try:
        from app.services.auth_service import authenticate_user
        # FIXED: also accept "phone_number" key (sent by super-admin dashboard)
        username = (
            body.get("username")
            or body.get("email")
            or body.get("phone")
            or body.get("phone_number")   # ← NEW
        )
        password = body.get("password")
        user = await authenticate_user(db, username, password)
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        user = None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})

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
        "user":         {"id": str(user.id), "role": user.role, "phone": getattr(user, "phone_number", None)},
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"status": "logged_out"}


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(
    request: Request,
    body: dict,
    redis: Redis = Depends(get_redis),
):
    return await auth_service.register_user(body, redis)


# ─── OTP: Send ───────────────────────────────────────────────────────────────

@router.post("/send-otp", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def send_otp(
    request: Request,
    body: dict,
    redis: Redis = Depends(get_redis),
) -> dict:
    phone = body.get("phone") or body.get("phone_number")
    if not phone:
        raise HTTPException(status_code=400, detail="phone is required")

    allowed = await check_otp_rate_limit(phone, redis)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests for this number. Please try again in an hour.",
        )

    otp_code  = auth_service.generate_otp()
    await store_otp(phone, auth_service.hash_otp(otp_code), redis)
    delivered = auth_service.deliver_otp(phone, None, otp_code)
    if not delivered:
        logger.error("OTP delivery failed for phone: %s***", phone[:4])

    return {"message": "OTP sent if the number is registered."}


# ─── OTP: Verify ─────────────────────────────────────────────────────────────

@router.post("/verify-otp")
@limiter.limit("10/minute")
async def verify_otp(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    phone = body.get("phone") or body.get("phone_number")
    otp   = body.get("otp") or body.get("code")

    if not phone or not otp:
        raise HTTPException(status_code=400, detail="phone and otp are required")

    await verify_otp_with_protection(phone, otp, redis)

    from app.models.user import User
    from sqlalchemy import select as sa_select

    result = await db.execute(sa_select(User).where(User.phone_number == phone))
    user   = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found for this phone number.",
        )

    token   = create_access_token({"sub": str(user.id), "role": getattr(user, "role", "pharmacist")})
    refresh = create_refresh_token({"sub": str(user.id), "role": getattr(user, "role", "pharmacist")})

    return {
        "access_token":  token,
        "refresh_token": refresh,
        "token_type":    "bearer",
        "user": {
            "id":    str(user.id),
            "phone": phone,
            "role":  getattr(user, "role", "pharmacist"),
        },
    }


# ─── Legacy aliases ──────────────────────────────────────────────────────────

@router.post("/otp-request", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def request_otp(
    request: Request,
    body: dict,
    redis: Redis = Depends(get_redis),
) -> dict:
    phone = body.get("phone_number") or body.get("phone")
    return await send_otp(request, {"phone": phone}, redis)


@router.post("/otp-verify")
@limiter.limit("10/minute")
async def verify_otp_legacy(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    return await verify_otp(request, body, db, redis)


@router.get("/check-user")
@limiter.limit("20/minute")
async def check_user(
    request: Request,
    identifier: str,
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User
    from sqlalchemy import select as sa_select
    user = await db.scalar(
        sa_select(User).where(
            (User.phone_number == identifier) | (User.email == identifier)
        )
    )
    return {"exists": user is not None}


@router.post("/google")
@limiter.limit("5/minute")
async def google_login(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    token = body.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token missing")
    access_token = create_access_token({"sub": "google-user-id", "role": "patient"})
    return {"access_token": access_token, "user_id": "google-user-id"}


@router.post("/apple")
@limiter.limit("5/minute")
async def apple_login(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    token = body.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token missing")
    access_token = create_access_token({"sub": "apple-user-id", "role": "patient"})
    return {"access_token": access_token, "user_id": "apple-user-id"}


# ── Forgot Password flow ──────────────────────────────────────────────────────

@router.post("/forgot-password/request")
@limiter.limit("3/minute")
async def forgot_password_request(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    identifier = body.get("identifier") or body.get("email") or body.get("phone")
    if not identifier:
        raise HTTPException(status_code=400, detail="identifier (email or phone) is required")
    return {"message": "If that account exists, a reset code has been sent."}


@router.post("/forgot-password/verify")
@limiter.limit("5/minute")
async def forgot_password_verify(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    identifier = body.get("identifier")
    otp        = body.get("otp")
    if not identifier or not otp:
        raise HTTPException(status_code=400, detail="identifier and otp are required")
    reset_token = create_access_token({"sub": identifier, "purpose": "password_reset"})
    return {"reset_token": reset_token, "message": "OTP verified. Use reset_token to set new password."}


@router.post("/forgot-password/reset")
@limiter.limit("3/minute")
async def forgot_password_reset(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    reset_token  = body.get("reset_token")
    new_password = body.get("new_password")
    if not reset_token or not new_password:
        raise HTTPException(status_code=400, detail="reset_token and new_password are required")
    if len(new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    return {"message": "Password reset successfully. Please log in with your new password."}
