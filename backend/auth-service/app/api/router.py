"""
Auth API Routes — Production-grade authentication endpoints.

Every endpoint uses Depends(get_db) for real database sessions.
All sensitive operations use proper hashing, stored tokens, and logging.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import uuid
import logging

from app.schemas.auth import (
    UserCreate, UserLogin, ForgotPasswordRequest, VerifyOTPRequest,
    ResetPasswordRequest, RefreshTokenRequest, ChangePasswordRequest,
)
from app.models.user import User, OTPVerification, PasswordResetToken
from app.services.auth_service import (
    verify_password, get_password_hash, create_access_token, create_refresh_token,
    decode_refresh_token, generate_otp, hash_otp, verify_otp,
    generate_reset_token, hash_reset_token, verify_reset_token,
)
from app.core.database import get_db
from shared.utils.responses import success_response, error_response
from app.config.settings import settings
from shared.redis_client import publish_user_status
from shared.audit import log_audit_event

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=True)

router = APIRouter()


# ─── Registration ─────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account."""
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        return error_response("USER_EXISTS", "Email already registered", status_code=409)

    # Check phone uniqueness (if provided)
    if user_in.phone_number:
        phone_check = await db.execute(
            select(User).where(User.phone_number == user_in.phone_number)
        )
        if phone_check.scalars().first():
            return error_response("PHONE_EXISTS", "Phone number already registered", status_code=409)

    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        phone_number=user_in.phone_number,
        hashed_password=hashed_pwd,
        role=user_in.role,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    logger.info(f"New user registered: id={new_user.id}, role={new_user.role.value}")

    return success_response(
        data={"user_id": str(new_user.id), "role": new_user.role.value},
        message="User registered successfully",
        status_code=201,
    )


# ─── Login ────────────────────────────────────────────────────────

@router.post("/login")
async def login(
    user_in: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and return access + refresh tokens."""
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()

    if not user or not verify_password(user_in.password, user.hashed_password):
        logger.warning(f"Failed login attempt for email={user_in.email}")
        log_audit_event(
            action="user_login_failed",
            actor_id="anonymous",
            details={"email": user_in.email}
        )
        return error_response("INVALID_CREDENTIALS", "Incorrect email or password", status_code=401)

    if not user.is_active:
        log_audit_event(
            action="user_login_inactive",
            actor_id=str(user.id),
            details={"email": user_in.email}
        )
        return error_response("INACTIVE_USER", "User account is inactive", status_code=403)

    token_data = {
        "sub": str(user.id),
        "role": user.role.value,
        "token_version": user.token_version,
    }

    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    logger.info(f"User logged in: id={user.id}")

    # Publish user active status and token version to Redis cache
    await publish_user_status(str(user.id), user.is_active, user.token_version)

    log_audit_event(
        action="user_login_success",
        actor_id=str(user.id),
        target_id=str(user.id)
    )

    return success_response(data={
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "role": user.role.value,
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }, message="Login successful")


# ─── Refresh Token ────────────────────────────────────────────────

@router.post("/refresh")
async def refresh_access_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new access token."""
    decoded = decode_refresh_token(payload.refresh_token)
    if not decoded:
        return error_response("INVALID_TOKEN", "Refresh token is invalid or expired", status_code=401)

    user_id = decoded.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalars().first()

    if not user or not user.is_active:
        return error_response("INVALID_TOKEN", "User not found or inactive", status_code=401)

    # Check token_version — if user changed password, old refresh tokens are invalid
    if decoded.get("token_version") != user.token_version:
        return error_response("TOKEN_REVOKED", "Token has been revoked. Please log in again.", status_code=401)

    new_access_token = create_access_token(data={
        "sub": str(user.id),
        "role": user.role.value,
        "token_version": user.token_version,
    })

    return success_response(data={
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }, message="Token refreshed")


# ─── Forgot Password: Request OTP ────────────────────────────────

@router.post("/forgot-password/request")
async def request_password_reset(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send an OTP to the user's email or phone for password reset."""
    result = await db.execute(
        select(User).where(
            (User.email == req.identifier) | (User.phone_number == req.identifier)
        )
    )
    user = result.scalars().first()

    if not user:
        # Prevent user enumeration — always return success
        logger.info(f"Password reset requested for non-existent identifier: {req.identifier}")
        return success_response(message="If the account exists, an OTP has been sent.")

    otp_code = generate_otp()
    hashed = hash_otp(otp_code)

    otp_record = OTPVerification(
        identifier=req.identifier,
        hashed_otp=hashed,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(otp_record)
    await db.flush()

    # ── OTP Delivery ──
    # In production, this would dispatch via Twilio SMS or SMTP email.
    # For now, log it securely (never expose in API response).
    logger.info(
        f"OTP generated for {req.identifier} "
        f"(otp_id={otp_record.id}, expires_at={otp_record.expires_at.isoformat()})"
    )
    if settings.ENVIRONMENT == "development":
        # Only log the actual OTP in development — NEVER in production
        logger.warning(f"[DEV ONLY] OTP for {req.identifier}: {otp_code}")

    return success_response(message="If the account exists, an OTP has been sent.")


# ─── Forgot Password: Verify OTP ─────────────────────────────────

@router.post("/forgot-password/verify")
async def verify_password_reset_otp(
    req: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and return a one-time-use reset token."""
    result = await db.execute(
        select(OTPVerification)
        .where(OTPVerification.identifier == req.identifier)
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    otp_record = result.scalars().first()

    if not otp_record or otp_record.is_verified:
        return error_response("INVALID_OTP", "OTP is invalid or already used", status_code=400)

    # Check expiry
    if otp_record.expires_at < datetime.now(timezone.utc):
        return error_response("EXPIRED_OTP", "OTP has expired. Please request a new one.", status_code=400)

    # Brute-force protection
    if otp_record.attempts >= settings.OTP_MAX_ATTEMPTS:
        return error_response("OTP_LOCKED", "Too many failed attempts. Please request a new OTP.", status_code=429)

    if not verify_otp(req.otp, otp_record.hashed_otp):
        otp_record.attempts += 1
        await db.flush()
        remaining = settings.OTP_MAX_ATTEMPTS - otp_record.attempts
        return error_response(
            "INVALID_OTP",
            f"Incorrect OTP. {remaining} attempt(s) remaining.",
            status_code=400,
        )

    # Mark OTP as verified
    otp_record.is_verified = True
    await db.flush()

    # Find the user for this identifier
    user_result = await db.execute(
        select(User).where(
            (User.email == req.identifier) | (User.phone_number == req.identifier)
        )
    )
    user = user_result.scalars().first()
    if not user:
        return error_response("USER_NOT_FOUND", "User not found", status_code=404)

    # Generate a real reset token, hash it, store it linked to the user
    raw_token = generate_reset_token()
    hashed_token = hash_reset_token(raw_token)

    reset_record = PasswordResetToken(
        user_id=user.id,
        hashed_token=hashed_token,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES),
    )
    db.add(reset_record)
    await db.flush()

    logger.info(f"Password reset token issued for user_id={user.id}")

    return success_response(
        data={"reset_token": raw_token},
        message="OTP verified. Use the reset token to set a new password.",
    )


# ─── Reset Password ──────────────────────────────────────────────

@router.post("/forgot-password/reset")
async def reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Set a new password using a valid reset token."""
    # Direct O(1) query using fast HMAC-SHA256 token hash
    hashed_input_token = hash_reset_token(req.reset_token)
    result = await db.execute(
        select(PasswordResetToken)
        .where(
            PasswordResetToken.hashed_token == hashed_input_token,
            PasswordResetToken.is_used == False,  # noqa: E712
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    matched_record = result.scalars().first()

    if not matched_record:
        return error_response("INVALID_TOKEN", "Reset token is invalid or expired", status_code=400)

    # Get the user
    user_result = await db.execute(select(User).where(User.id == matched_record.user_id))
    user = user_result.scalars().first()
    if not user:
        return error_response("USER_NOT_FOUND", "User not found", status_code=404)

    # Update password
    user.hashed_password = get_password_hash(req.new_password)
    # Increment token_version to invalidate ALL existing access + refresh tokens
    user.token_version += 1

    # Mark reset token as used
    matched_record.is_used = True
    await db.flush()

    # Publish updated token version to Redis cache
    await publish_user_status(str(user.id), user.is_active, user.token_version)

    log_audit_event(
        action="user_password_reset",
        actor_id=str(user.id),
        target_id=str(user.id)
    )

    logger.info(f"Password reset completed for user_id={user.id}, all tokens revoked (version={user.token_version})")

    return success_response(message="Password reset successfully. Please log in with your new password.")


# ─── Change Password (Authenticated) ─────────────────────────────

@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Change password for the currently authenticated user."""
    from jose import jwt as jose_jwt, JWTError

    try:
        payload = jose_jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(req.current_password, user.hashed_password):
        return error_response("WRONG_PASSWORD", "Current password is incorrect", status_code=400)

    if req.current_password == req.new_password:
        return error_response("SAME_PASSWORD", "New password must be different from current password", status_code=400)

    user.hashed_password = get_password_hash(req.new_password)
    user.token_version += 1  # Revoke all existing tokens
    await db.flush()

    # Blacklist the current token in Redis
    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp:
        try:
            from shared.redis_client import blacklist_token
            remaining = int(exp - datetime.now(timezone.utc).timestamp())
            if remaining > 0:
                await blacklist_token(jti, remaining)
        except Exception:
            pass  # Non-critical — token_version bump already invalidates all old tokens

    # Publish updated token version to Redis cache
    await publish_user_status(str(user.id), user.is_active, user.token_version)

    log_audit_event(
        action="user_password_changed",
        actor_id=str(user.id),
        target_id=str(user.id)
    )

    # Issue new tokens so the user doesn't get logged out
    token_data = {
        "sub": str(user.id),
        "role": user.role.value,
        "token_version": user.token_version,
    }
    new_access = create_access_token(data=token_data)
    new_refresh = create_refresh_token(data=token_data)

    logger.info(f"Password changed for user_id={user.id}")

    return success_response(
        data={
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
        message="Password changed successfully. All other sessions have been revoked.",
    )


# ─── Logout ───────────────────────────────────────────────────────

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Logout: blacklist the current access token in Redis."""
    from jose import jwt as jose_jwt, JWTError
    from shared.redis_client import blacklist_token

    try:
        payload = jose_jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    jti = payload.get("jti")
    exp = payload.get("exp")

    if jti and exp:
        remaining = int(exp - datetime.now(timezone.utc).timestamp())
        if remaining > 0:
            try:
                await blacklist_token(jti, remaining)
                logger.info(f"Token blacklisted on logout: jti={jti}, user={payload.get('sub')}")
            except Exception as e:
                logger.error(f"Failed to blacklist token in Redis: {e}")

    log_audit_event(
        action="user_logout",
        actor_id=payload.get("sub") or "anonymous",
        target_id=payload.get("sub")
    )

    return success_response(message="Logged out successfully")
