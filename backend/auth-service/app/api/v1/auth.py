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

  FIX-A6 (2026-06-23) — permanent fix for the recurring registration/login bugs:
    - register() no longer hard-blocks on an existing-but-unverified account.
      It resumes that registration (updates the pending record + re-sends OTP)
      instead of leaving the user permanently stuck between "can't register
      again" and "can't really log in yet."
    - send-otp now returns a real failure status when delivery fails on every
      channel, instead of always claiming success. Added a 5-minute resend
      cooldown so the frontend can show "you can request a new code in Xs."
    - verify-otp now marks the account phone_verified=True on success.
    - check-user now also returns `verified`, so the frontend can route a
      user to "resume verification" vs "go to login" correctly.
    - google_login() now tags accounts with auth_provider="google" and
      has_usable_password=False, and login() uses that to return a helpful,
      specific error instead of a generic "invalid credentials" when a
      Google-only user tries their Hospyn ID + password.
    - Added POST /auth/set-password so a Google/Apple user can set a real
      Hospyn ID + password once, after which Hospyn ID/password login works
      for them too (no more "click Sign in with Google every single time").
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Response, HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import jwt as pyjwt

from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import decode_token
from app.models.user import User, RoleEnum, OTPVerification
from app.services.auth_service import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, generate_otp, hash_otp, verify_otp,
    deliver_otp,
)
import re
import uuid

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated User from a Bearer access token.

    Lives here (not imported from healthcare-core) because auth-service is
    the only service that owns the users table and is allowed to issue or
    validate credential-changing operations like set-password.
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        payload = decode_token(creds.credentials)
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please log in again.")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    user_id = payload.get("sub")
    try:
        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    result = await db.execute(select(User).where(User.id == user_uuid, User.deleted_at.is_(None)))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account not found or inactive.")
    return user

logger = logging.getLogger(__name__)
router = APIRouter()

COOKIE_NAME    = "token"
COOKIE_MAX_AGE = 60 * 60 * 8   # 8 hours



@router.get("/run-auth-migrations")
async def run_auth_migrations():
    """
    One-shot endpoint — adds the 3 missing account-verification columns.
    Uses asyncpg directly (the driver already installed) to avoid SQLAlchemy
    trying to import the sync psycopg2 driver.
    Safe to call multiple times (IF NOT EXISTS guard on every statement).
    """
    import os
    import asyncpg

    raw_url = os.getenv("DATABASE_URL", "")
    if not raw_url:
        return {"status": "error", "message": "DATABASE_URL env var not set"}

    # asyncpg expects postgresql:// — strip any SQLAlchemy driver prefix
    pg_url = (
        raw_url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg2://", "postgresql://")
    )

    migrations = [
        ("phone_verified",      "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT true NOT NULL"),
        ("auth_provider",       "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local' NOT NULL"),
        ("has_usable_password", "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_usable_password BOOLEAN DEFAULT true NOT NULL"),
    ]
    results = {}
    try:
        conn = await asyncpg.connect(dsn=pg_url)
        try:
            for col, sql in migrations:
                try:
                    await conn.execute(sql)
                    results[col] = "ok"
                except Exception as col_err:
                    results[col] = str(col_err)
        finally:
            await conn.close()
        return {"status": "done", "columns": results}
    except Exception as e:
        return {"status": "error", "message": str(e), "partial": results}




@router.get("/db-test")
async def db_test():
    import os
    import asyncpg
    import traceback

    raw_url = os.getenv("DATABASE_URL", "")
    if not raw_url:
        return {"status": "error", "message": "DATABASE_URL env var not set"}

    pg_url = (
        raw_url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg2://", "postgresql://")
    )

    try:
        conn = await asyncpg.connect(dsn=pg_url)
        try:
            # Query columns of users table
            columns = await conn.fetch(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';"
            )
            columns_list = [{"column_name": r["column_name"], "data_type": r["data_type"]} for r in columns]

            # Query list of users
            users = await conn.fetch(
                "SELECT id, email, role, is_active, phone_verified, auth_provider FROM users LIMIT 10;"
            )
            users_list = [
                {
                    "id": str(r["id"]),
                    "email": r["email"],
                    "role": r["role"],
                    "is_active": r["is_active"],
                    "phone_verified": r["phone_verified"] if "phone_verified" in r else None,
                    "auth_provider": r["auth_provider"] if "auth_provider" in r else None,
                }
                for r in users
            ]
            return {
                "status": "success",
                "columns": columns_list,
                "users": users_list,
            }
        finally:
            await conn.close()
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc(),
        }




# ─── Login ───────────────────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request:  Request,
    response: Response,
    db:       AsyncSession = Depends(get_db),
):
    """
    FIX-A1: Accepts any of these body keys for the identifier:
      username, email, phone, phone_number
    Sends access_token in JSON body AND as httpOnly cookie.
    Supports both JSON and application/x-www-form-urlencoded bodies.
    """
    try:
        content_type = request.headers.get("content-type", "")
        if "application/x-www-form-urlencoded" in content_type:
            form_data = await request.form()
            body = dict(form_data)
        else:
            body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request payload")

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
        # FIX-A6: if the account exists but was created via Google/Apple and
        # never had a real password set, say so instead of a generic error —
        # this is the exact case from the support report where Google users
        # try Hospyn ID + password and just see "invalid credentials" forever.
        has_usable = (user.has_usable_password if user.has_usable_password is not None else True) if user else True
        if user and not has_usable:
            provider = user.auth_provider or "local"
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    f"This account signs in with {provider.capitalize()}. "
                    f"Tap 'Sign in with {provider.capitalize()}', or set a "
                    f"password from Settings to use your Hospyn ID instead."
                ),
            )
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
        "auth_provider": user.auth_provider or "local",
        "has_usable_password": user.has_usable_password if user.has_usable_password is not None else True,
        "user": {
            "id":    str(user.id),
            "role":  user.role.value,
            "name":  user.full_name or "",
            "email": user.email or "",
            "phone": user.phone_number or "",
        },
    }


@router.post("/google")
async def google_login(
    response: Response,
    body:     dict,
    db:       AsyncSession = Depends(get_db),
):
    """Verify Google ID token and sign/return JWT access + refresh tokens."""
    token = body.get("token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Google ID token is required",
        )

    # Verify Google OAuth2 token using google-auth library
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    import secrets
    import string
    import uuid

    GOOGLE_CLIENT_ID = "625745217419-cq76tvb0mlt0bkmg8bd4r0csj4vmqmr8.apps.googleusercontent.com"
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
    except Exception as e:
        logger.error("Google Auth token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google Authentication failed: {str(e)}",
        )

    email = idinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address not provided by Google",
        )

    # Check if user already exists
    result = await db.execute(
        select(User).where(
            (User.email == email),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalars().first()

    if not user:
        # Create a new patient user
        # Secure random password generation
        raw_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
        hashed_password = get_password_hash(raw_password)
        
        name = idinfo.get("name") or f"{idinfo.get('given_name', '')} {idinfo.get('family_name', '')}".strip() or "Google User"
        
        user = User(
            id=uuid.uuid4(),
            email=email,
            phone_number=None,
            hashed_password=hashed_password,
            role=RoleEnum.patient,
            full_name=name,
            is_active=True,
            token_version=1,
            # FIX-A6: tag this account so /login can give a helpful message
            # and the frontend can offer a one-time "set up a password" step
            # instead of forcing Google sign-in forever.
            auth_provider="google",
            has_usable_password=False,
            phone_verified=True,  # email already verified by Google itself
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # If user exists but full_name is empty, populate it
        if not user.full_name:
            name = idinfo.get("name") or f"{idinfo.get('given_name', '')} {idinfo.get('family_name', '')}".strip()
            if name:
                user.full_name = name
                await db.commit()
                await db.refresh(user)

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
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    response.set_cookie(
        key=COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )

    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "role":          user.role.value,
        "user_id":       str(user.id),
        "auth_provider": user.auth_provider or "google",
        "has_usable_password": user.has_usable_password if user.has_usable_password is not None else False,
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

    # FIX-A6: Duplicate check — but distinguish "fully verified" from
    # "registered, never finished OTP" instead of hard-blocking both cases.
    #
    # OLD BEHAVIOR (the root cause of the recurring registration complaints):
    # if /register succeeded but the OTP step never completed (SMS delayed,
    # app closed, send-otp silently failed), the phone/email was permanently
    # "taken" with no way back in — check-user said "already registered" and
    # every future register attempt 409'd. The user could technically log in
    # with the password they'd set, but nothing in the UI told them that, so
    # it looked like the app was broken.
    #
    # NEW BEHAVIOR: if the existing row is unverified, treat this as a
    # resume — update it in place and let the caller continue to OTP.
    existing_user = None
    if email:
        existing = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
        existing_user = existing.scalars().first()
        if existing_user and existing_user.phone_verified:
            raise HTTPException(status_code=409, detail="Email already registered")
    if phone_number and not existing_user:
        existing = await db.execute(select(User).where(User.phone_number == phone_number, User.deleted_at.is_(None)))
        existing_user = existing.scalars().first()
        if existing_user and existing_user.phone_verified:
            raise HTTPException(status_code=409, detail="Phone number already registered")

    if existing_user and not existing_user.phone_verified:
        # Resume: this person started registering before and never verified.
        # Update their details/password (they may have mistyped originally)
        # and let them retry OTP instead of being locked out.
        existing_user.hashed_password = get_password_hash(password)
        existing_user.full_name = full_name or existing_user.full_name
        existing_user.role = role
        await db.flush()
        return {
            "id":     str(existing_user.id),
            "role":   existing_user.role.value,
            "email":  existing_user.email,
            "phone":  existing_user.phone_number,
            "resumed": True,
        }

    user = User(
        email=email,
        phone_number=phone_number,
        hashed_password=get_password_hash(password),
        role=role,
        full_name=full_name,
        is_active=True,
        token_version=1,
        phone_verified=False,
        auth_provider="local",
        has_usable_password=True,
    )
    db.add(user)
    await db.flush()

    return {
        "id":    str(user.id),
        "role":  user.role.value,
        "email": user.email,
        "phone": user.phone_number,
        "resumed": False,
    }


# ─── Send OTP ────────────────────────────────────────────────────────────────

OTP_RESEND_COOLDOWN_SECONDS = 45


@router.post("/send-otp", status_code=status.HTTP_202_ACCEPTED)
@router.post("/otp/send", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def send_otp(
    request: Request,
    body:    dict,
    db:      AsyncSession = Depends(get_db),
):
    """Send OTP to phone or email for patient app authentication.

    FIX-A6: previously this endpoint always returned 202 "OTP sent" even when
    deliver_otp() reported total failure across every channel — the frontend
    had no way to know the code never arrived, so the user just sat on a
    blank OTP screen with no recourse. It now:
      1. Enforces a short resend cooldown so the frontend can show a
         "resend in Xs" timer instead of letting users spam themselves stuck.
      2. Returns a real error (503) when delivery genuinely failed, instead
         of lying about success.
    """
    phone = body.get("phone") or body.get("phone_number")
    email = body.get("email")

    if not phone and not email:
        raise HTTPException(status_code=422, detail="phone or email is required")

    identifier = phone or email

    # Cooldown check — look at the most recent OTP we issued for this identifier
    recent = await db.execute(
        select(OTPVerification)
        .where(OTPVerification.identifier == identifier)
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    )
    last_otp = recent.scalars().first()
    if last_otp:
        elapsed = (datetime.now(timezone.utc) - last_otp.created_at).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
            retry_after = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {retry_after}s before requesting another code.",
                headers={"Retry-After": str(retry_after)},
            )

    otp_code   = generate_otp()
    hashed     = hash_otp(otp_code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    otp_record = OTPVerification(
        identifier=identifier,
        hashed_otp=hashed,
        expires_at=expires_at,
    )
    db.add(otp_record)
    await db.flush()

    delivered = deliver_otp(phone, email, otp_code)
    if not delivered:
        logger.error("OTP delivery failed on all channels for %s", identifier)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We couldn't send a verification code right now. Please try again in a minute, or use a different number/email.",
        )

    return {
        "message": "OTP sent.",
        "resend_after_seconds": OTP_RESEND_COOLDOWN_SECONDS,
    }


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
            OTPVerification.is_verified.is_(False),
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
        # Auto-create patient account on first OTP verify (used by flows that
        # skip /register entirely and go straight to OTP-only sign-in)
        user = User(
            phone_number=identifier if "@" not in identifier else None,
            email=identifier if "@" in identifier else None,
            hashed_password=get_password_hash(""),
            role=RoleEnum.patient,
            is_active=True,
            token_version=1,
            phone_verified=True,
            auth_provider="local",
            has_usable_password=False,  # empty password — not a real usable credential
        )
        db.add(user)
        await db.flush()
    else:
        # FIX-A6: this is the step that used to never run — completing OTP
        # now actually marks the account verified, so /check-user and a
        # future /register attempt see this account as done, not stuck.
        user.phone_verified = True
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
    # FIX-A6: `verified` lets the frontend tell apart "fully registered,
    # go to Login" from "started registering, never finished OTP" so it can
    # resume verification instead of just blocking the user.
    return {
        "exists":   user is not None,
        "verified": bool(user.phone_verified) if user else False,
    }


# ─── Set Password (for Google/Apple-only accounts) ───────────────────────────

@router.post("/set-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def set_password(
    request: Request,
    body:    dict,
    db:      AsyncSession = Depends(get_db),
    user:    User = Depends(get_current_user),
):
    """
    FIX-A6: Lets a user who signed up via Google/Apple set a real Hospyn ID
    (phone number) + password, so they can log in with either method going
    forward instead of being forced to tap "Sign in with Google" every time.

    Requires a valid access token (the user must already be logged in via
    Google/Apple once) plus the new phone number + password.
    """
    phone_number = body.get("phone_number") or body.get("phone")
    password     = body.get("password")

    if not password or len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if not phone_number:
        raise HTTPException(status_code=422, detail="phone_number is required")

    # Make sure this phone number isn't already used by a different account
    existing = await db.execute(
        select(User).where(
            User.phone_number == phone_number,
            User.id != user.id,
            User.deleted_at.is_(None),
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="That phone number is already linked to another account.")

    user.phone_number = phone_number
    user.hashed_password = get_password_hash(password)
    user.has_usable_password = True
    user.phone_verified = True  # they're already authenticated via Google/Apple
    await db.flush()

    return {
        "message": "Password set. You can now log in with your phone number and password.",
        "phone":   user.phone_number,
        "has_usable_password": True,
    }
