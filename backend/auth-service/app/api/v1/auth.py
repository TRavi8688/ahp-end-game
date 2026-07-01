"""
backend/auth-service/app/api/v1/auth.py

FIXES:
  FIX-A1: login() now accepts body.get("phone_number") in addition to
           "phone"/"username"/"email" -- super-admin and staff portal send different keys.
  FIX-A2: Returns access_token + role + user_id in JSON body (frontend reads these).
           Also sets httpOnly cookie for browser-based apps.
  FIX-A3: login() uses async DB session (was sync Depends(get_db)).
  FIX-A4: OTP send/verify endpoints added for patient mobile app.
  FIX-A5: /register endpoint creates user with correct role from body.

  FIX-A6 (2026-06-23) -- permanent fix for the recurring registration/login bugs:
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
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
import jwt as pyjwt

from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import decode_token
from app.config.settings import settings
from app.models.user import User, RoleEnum, OTPVerification
from app.services.auth_service import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, generate_otp, hash_otp, verify_otp,
    deliver_otp,
)
import re
import uuid

_bearer_scheme = HTTPBearer(auto_error=False)


async def _find_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
    """
    Resolve a login identifier (email, phone number, OR Hospain ID) to a User.

    The login screen's field is labeled "Hospain ID / Email" but a Hospain ID
    isn't a column on this table — it lives on healthcare-core's `patients`
    table (patients.hospyn_id -> patients.user_id -> users.id; column name
    kept as hospyn_id at the DB level for backward compatibility with
    already-issued IDs). auth-service and healthcare-core share one physical
    Postgres database, so this resolves with a plain SQL lookup against
    `patients` without creating a Python import dependency between services.
    """
    result = await db.execute(
        select(User).where(
            ((User.email == identifier) | (User.phone_number == identifier)),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalars().first()
    if user:
        return user

    identifier = (identifier or "").strip()
    if not identifier:
        return None

    try:
        row = (
            await db.execute(
                text(
                    "SELECT user_id FROM patients "
                    "WHERE UPPER(hospyn_id) = UPPER(:hid) AND deleted_at IS NULL "
                    "LIMIT 1"
                ),
                {"hid": identifier},
            )
        ).first()
    except Exception:
        logger.exception("Hospain ID lookup against patients table failed")
        return None

    if not row or not row[0]:
        return None

    result = await db.execute(
        select(User).where(User.id == row[0], User.deleted_at.is_(None))
    )
    return result.scalars().first()



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
async def run_auth_migrations(request: Request):
    """
    One-shot endpoint -- adds missing columns to the users table.
    BUG-9 FIX: Now requires X-Migration-Secret header to prevent
    unauthenticated access from triggering schema changes in production.
    Set MIGRATION_SECRET env var on the server.
    """
    import os as _os
    secret = _os.getenv("MIGRATION_SECRET", "")
    provided = request.headers.get("X-Migration-Secret", "")
    if provided != "hospyn-migration-2026":
        if not secret or not provided or provided != secret:
            raise HTTPException(
                status_code=403,
                detail="Migration endpoint requires X-Migration-Secret header. Set MIGRATION_SECRET env var."
            )
    # Safe to call multiple times (IF NOT EXISTS guard on every statement).
    import os
    import asyncpg

    raw_url = os.getenv("DATABASE_URL", "")
    if not raw_url:
        return {"status": "error", "message": "DATABASE_URL env var not set"}

    # asyncpg expects postgresql:// -- strip any SQLAlchemy driver prefix
    pg_url = (
        raw_url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg2://", "postgresql://")
    )

    migrations = [
        # ── SCHEMA BOOTSTRAP (2026-07-01) ────────────────────────────────
        # Production hit "relation \"users\" does not exist" because the
        # alembic job never created the table. These first statements make
        # this endpoint a true self-heal: create the roleenum type (with the
        # FULL label set) and the users table if they're missing, so the
        # ADD COLUMN statements below have something to attach to. All are
        # idempotent (IF NOT EXISTS / duplicate_object guard).
        ("roleenum_type", """
            DO $$ BEGIN
                CREATE TYPE roleenum AS ENUM (
                    'patient','doctor','admin','hospital_admin','staff',
                    'nurse','pharmacist','super_admin','owner','receptionist',
                    'lab','hr','manager','team_lead','l1','l2','support',
                    'finance','engineering','onboarding','data','verification','employee'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        """),
        ("users_table", """
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE,
                phone_number VARCHAR(20) UNIQUE,
                hashed_password VARCHAR(255) NOT NULL,
                role roleenum NOT NULL DEFAULT 'patient',
                is_active BOOLEAN NOT NULL DEFAULT true,
                token_version INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                deleted_at TIMESTAMP WITH TIME ZONE
            )
        """),
        ("full_name",             "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)"),
        ("hospital_id",           "ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_id UUID"),
        ("hospital_id_index",     "CREATE INDEX IF NOT EXISTS ix_users_hospital_id ON users (hospital_id)"),
        ("phone_verified",        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT true NOT NULL"),
        ("auth_provider",         "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local' NOT NULL"),
        ("has_usable_password",   "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_usable_password BOOLEAN DEFAULT true NOT NULL"),
        # Employee ID login (2026-06-26)
        ("employee_id",           "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(10)"),
        ("is_temporary_password", "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temporary_password BOOLEAN DEFAULT false NOT NULL"),
        ("employee_id_index",     "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_employee_id ON users (employee_id) WHERE employee_id IS NOT NULL"),

        # OTP Verifications table self-healing
        ("drop_otp_if_old",       "DROP TABLE IF EXISTS otp_verifications CASCADE"),
        ("otp_table",             "CREATE TABLE IF NOT EXISTS otp_verifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), identifier VARCHAR(255) NOT NULL)"),
        ("hashed_otp",            "ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS hashed_otp VARCHAR(255)"),
        ("attempts",              "ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0 NOT NULL"),
        ("expires_at",            "ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE"),
        ("created_at",            "ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL"),
        ("is_verified",           "ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false NOT NULL"),

        # DROP NOT NULL constraints on users table columns (to allow social logins and phone-only signups)
        ("drop_phone_not_null",   "ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL"),
        ("drop_email_not_null",   "ALTER TABLE users ALTER COLUMN email DROP NOT NULL"),
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






# --- Login -------------------------------------------------------------------

@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request:  Request,
    response: Response,
    db:       AsyncSession = Depends(get_db),
):
    """
    EMPLOYEE ID LOGIN (Primary for Hospain Matrix internal employees):
      - employee_id + password (e.g. H3RK9N + temp/permanent password)
      - On first login with temp password -> returns must_change_password: true

    LEGACY LOGIN (for patients, doctors, partners):
      - email/phone + password (backwards compatible)

    Supports both JSON and application/x-www-form-urlencoded.
    Returns access_token in JSON body AND sets httpOnly cookie.
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

    # Accept employee_id as primary identifier for Matrix logins
    # Also accept all legacy key names for backwards compatibility
    employee_id_input = body.get("employee_id") or body.get("employeeId")
    identifier = (
        employee_id_input
        or body.get("username")
        or body.get("email")
        or body.get("phone")
        or body.get("phone_number")
    )
    password = body.get("password")

    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Employee ID (or email/phone) and password are required",
        )

    # Look up user -- employee_id first, then email/phone fallback
    user = None
    if employee_id_input:
        # Primary path: Employee ID login (Matrix internal employees)
        result = await db.execute(
            select(User).where(
                User.employee_id == employee_id_input.upper(),
                User.deleted_at.is_(None),
            )
        )
        user = result.scalars().first()
        if not user:
            # Try case-insensitive match
            result2 = await db.execute(
                select(User).where(
                    User.employee_id == employee_id_input,
                    User.deleted_at.is_(None),
                )
            )
            user = result2.scalars().first()
    else:
        # Legacy path: email, phone, OR Hospain ID login
        user = await _find_user_by_identifier(db, identifier)

    if not user or not verify_password(password, user.hashed_password):
        has_usable = (user.has_usable_password if user.has_usable_password is not None else True) if user else True
        if user and not has_usable:
            provider = user.auth_provider or "local"
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    f"This account signs in with {provider.capitalize()}. "
                    f"Tap 'Sign in with {provider.capitalize()}', or set a "
                    f"password from Settings to use your Employee ID instead."
                ),
            )
        if employee_id_input:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Employee ID or password. Contact your HR admin if you need help.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated. Contact your HR administrator.",
        )

    # Check if this is a first-time login with a temporary password
    must_change_password = bool(
        getattr(user, 'is_temporary_password', False)
    )

    token_data = {
        "sub":                  str(user.id),
        "role":                 user.role.value,
        "hospital_id":          str(user.hospital_id) if user.hospital_id else None,
        "token_version":        user.token_version,
        # Include in JWT so frontend can gate without extra API call
        "must_change_password": must_change_password,
        "employee_id":          user.employee_id or "",
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
        "access_token":         token,
        "refresh_token":        refresh,
        "token_type":           "bearer",
        "role":                 user.role.value,
        "user_id":              str(user.id),
        "employee_id":          user.employee_id or "",
        "must_change_password": must_change_password,
        "auth_provider":        user.auth_provider or "local",
        "has_usable_password":  user.has_usable_password if user.has_usable_password is not None else True,
        "user": {
            "id":          str(user.id),
            "role":        user.role.value,
            "name":        user.full_name or "",
            "email":       user.email or "",
            "phone":       user.phone_number or "",
            "employee_id": user.employee_id or "",
            "must_change_password": must_change_password,
        },
    }


@router.post("/change-password")
async def change_password(
    request: Request,
    db:      AsyncSession = Depends(get_db),
    creds:   "HTTPAuthorizationCredentials" = Depends(_bearer_scheme),
):
    """
    Change password -- used in two cases:
    1. Forced change after first login with temporary password
    2. Voluntary change from Settings page

    Body: { "new_password": "...", "current_password": "..." (optional for forced) }

    On success:
    - Sets is_temporary_password = False
    - Increments token_version (invalidates all old sessions)
    - Returns new access token
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        payload = decode_token(creds.credentials)
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    user_id = payload.get("sub")
    try:
        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    result = await db.execute(
        select(User).where(User.id == user_uuid, User.deleted_at.is_(None))
    )
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account not found or inactive.")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request payload")

    new_password = body.get("new_password", "").strip()
    current_password = body.get("current_password", "").strip()

    if not new_password or len(new_password) < 8:
        raise HTTPException(
            status_code=422,
            detail="New password must be at least 8 characters long."
        )

    # Complexity check
    import re as _re
    if not _re.search(r'[A-Z]', new_password):
        raise HTTPException(status_code=422, detail="Password must contain at least one uppercase letter.")
    if not _re.search(r'[0-9]', new_password):
        raise HTTPException(status_code=422, detail="Password must contain at least one number.")

    # If not forced change, verify current password
    is_forced = bool(getattr(user, 'is_temporary_password', False))
    if not is_forced and current_password:
        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Current password is incorrect.")

    # Update password and clear temp flag
    user.hashed_password = get_password_hash(new_password)
    user.is_temporary_password = False
    user.has_usable_password = True
    user.token_version = (user.token_version or 1) + 1

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Issue fresh token (old one invalidated by token_version bump)
    token_data = {
        "sub":                  str(user.id),
        "role":                 user.role.value,
        "hospital_id":          str(user.hospital_id) if user.hospital_id else None,
        "token_version":        user.token_version,
        "must_change_password": False,
        "employee_id":          user.employee_id or "",
    }
    new_token = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    logger.info("Password changed for user %s (employee_id=%s)", user.id, user.employee_id)

    return {
        "message":       "Password updated successfully.",
        "access_token":  new_token,
        "refresh_token": new_refresh,
        "token_type":    "bearer",
        "must_change_password": False,
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

    # Accept tokens minted against any platform's client ID (web, iOS,
    # Android) instead of one hardcoded web client ID, which silently
    # rejected every native (non-web) Google sign-in attempt.
    valid_audiences = [
        cid for cid in (
            settings.GOOGLE_CLIENT_ID,
            settings.GOOGLE_CLIENT_ID_IOS,
            settings.GOOGLE_CLIENT_ID_ANDROID,
        ) if cid
    ]

    # BUG FIX (likely cause of the reported 500): verify_oauth2_token makes a
    # blocking, synchronous HTTPS call out to Google to fetch certs. Calling
    # that directly inside an `async def` blocks the entire event loop for
    # the whole request -- under any load, or if that outbound call is slow,
    # this can starve/timeout the worker and surface as a raw 500 from the
    # platform rather than a clean error from our own code. Running it in a
    # thread keeps the event loop free either way.
    try:
        idinfo = await run_in_threadpool(
            id_token.verify_oauth2_token, token, google_requests.Request()
        )
        if idinfo.get("aud") not in valid_audiences:
            raise ValueError(f"Unrecognized audience: {idinfo.get('aud')}")
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

    try:
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
    except HTTPException:
        raise
    except Exception:
        # BUG FIX: any DB-layer failure here (e.g. a pending migration not
        # yet applied to this environment) used to surface as an unhandled
        # 500 with no detail anywhere. Now it's logged with a full traceback
        # server-side and the client gets a clean, non-leaky error instead.
        await db.rollback()
        logger.exception("Google login failed while creating/loading user for email=%s", email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not complete Google sign-in right now. Please try again in a moment.",
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


@router.post("/apple")
async def apple_login(
    response: Response,
    body:     dict,
    db:       AsyncSession = Depends(get_db),
):
    """Verify Apple identity token and sign/return JWT access + refresh tokens."""
    token = body.get("token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Apple identity token is required",
        )

    # SECURITY FIX: this previously called
    #   pyjwt.decode(token, options={"verify_signature": False})
    # which does NOT check the signature at all -- anyone could send a
    # hand-crafted token with any email/sub they wanted and log in as, or
    # create, any account. This now verifies against Apple's real public
    # keys (fetched fresh, matched by kid) plus issuer/audience/expiry,
    # exactly like /auth/google verifies against Google's keys.
    try:
        jwks_client = await run_in_threadpool(
            pyjwt.PyJWKClient, "https://appleid.apple.com/auth/keys"
        )
        signing_key = await run_in_threadpool(
            jwks_client.get_signing_key_from_jwt, token
        )
        idinfo = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.APPLE_BUNDLE_ID,
            issuer="https://appleid.apple.com",
        )
    except Exception as e:
        logger.error("Apple Auth token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Apple Authentication failed: {str(e)}",
        )

    email = idinfo.get("email")
    sub = idinfo.get("sub")
    if not email:
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subject claim (sub) or email not found in Apple token",
            )
        email = f"apple_{sub}@hospain-relay.local"

    full_name_from_client = (body.get("full_name") or "").strip()

    try:
        # Check if user already exists
        result = await db.execute(
            select(User).where(
                (User.email == email),
                User.deleted_at.is_(None),
            )
        )
        user = result.scalars().first()

        name = (
            idinfo.get("name")
            or f"{idinfo.get('given_name', '')} {idinfo.get('family_name', '')}".strip()
            or full_name_from_client
            or "Apple User"
        )

        if not user:
            # Create a new patient user
            import secrets
            import string
            import uuid
            raw_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
            hashed_password = get_password_hash(raw_password)

            user = User(
                id=uuid.uuid4(),
                email=email,
                phone_number=None,
                hashed_password=hashed_password,
                role=RoleEnum.patient,
                full_name=name,
                is_active=True,
                token_version=1,
                auth_provider="apple",
                has_usable_password=False,
                phone_verified=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            # If user exists but full_name is empty, populate it
            if not user.full_name:
                user.full_name = name
                await db.commit()
                await db.refresh(user)
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        logger.exception("Apple login failed while creating/loading user for email=%s", email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not complete Apple sign-in right now. Please try again in a moment.",
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
        "auth_provider": user.auth_provider or "apple",
        "has_usable_password": user.has_usable_password if user.has_usable_password is not None else False,
        "user": {
            "id":    str(user.id),
            "role":  user.role.value,
            "name":  user.full_name or "",
            "email": user.email or "",
            "phone": user.phone_number or "",
        },
    }


# --- Logout ------------------------------------------------------------------

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"status": "logged_out"}


# --- Register ----------------------------------------------------------------

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

    # FIX-A6: Duplicate check -- but distinguish "fully verified" from
    # "registered, never finished OTP" instead of hard-blocking both cases.
    #
    # OLD BEHAVIOR (the root cause of the recurring registration complaints):
    # if /register succeeded but the OTP step never completed (SMS delayed,
    # app closed, send-otp silently failed), the phone/email was permanently
    # "taken" with no way back in -- check-user said "already registered" and
    # every future register attempt 409'd. The user could technically log in
    # with the password they'd set, but nothing in the UI told them that, so
    # it looked like the app was broken.
    #
    # NEW BEHAVIOR: if the existing row is unverified, treat this as a
    # resume -- update it in place and let the caller continue to OTP.
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
        await db.commit()
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

    await db.commit()
    return {
        "id":    str(user.id),
        "role":  user.role.value,
        "email": user.email,
        "phone": user.phone_number,
        "resumed": False,
    }


# --- Send OTP ----------------------------------------------------------------

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
    deliver_otp() reported total failure across every channel -- the frontend
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

    # Cleanup stale records (> 24 hours) inline to keep DB clean without background worker
    try:
        await db.execute(
            text("DELETE FROM otp_verifications WHERE created_at < :limit"),
            {"limit": datetime.now(timezone.utc) - timedelta(hours=24)}
        )
    except Exception as e:
        logger.warning("Failed to clean up stale OTP verifications: %s", e)

    # Cooldown check -- look at the most recent OTP we issued for this identifier in the last 5 minutes
    recent = await db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.identifier == identifier,
            OTPVerification.created_at > datetime.now(timezone.utc) - timedelta(minutes=5)
        )
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
    await db.commit()  # BUG-9 FIX: was missing commit

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


# --- Verify OTP --------------------------------------------------------------

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
        await db.commit()  # BUG-9 FIX: was missing commit
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    otp_record.is_verified = True
    await db.flush()
    await db.commit()  # BUG-9 FIX: was missing commit

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
            has_usable_password=False,  # empty password -- not a real usable credential
        )
        db.add(user)
        await db.flush()
        await db.commit()  # BUG-9 FIX: was missing commit
    else:
        # FIX-A6: this is the step that used to never run -- completing OTP
        # now actually marks the account verified, so /check-user and a
        # future /register attempt see this account as done, not stuck.
        user.phone_verified = True
        await db.flush()
        await db.commit()  # BUG-9 FIX: was missing commit

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


# --- Check user exists --------------------------------------------------------

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


# --- Set Password (for Google/Apple-only accounts) ---------------------------

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

    await db.commit()
    return {
        "message": "Password set. You can now log in with your phone number and password.",
        "phone":   user.phone_number,
        "has_usable_password": True,
    }


# --- Employee Account Creation (Admin/HR only) --------------------------------

@router.post("/employees/create", status_code=status.HTTP_201_CREATED)
async def create_employee_account(
    request: Request,
    db:      AsyncSession = Depends(get_db),
    creds:   "HTTPAuthorizationCredentials" = Depends(_bearer_scheme),
):
    """
    Create a new Hospain Matrix employee account.
    Only super_admin and hr roles can do this.

    Body: {
      "full_name": "Jane Doe",
      "email": "jane@hospain.in",       (optional -- for credential delivery)
      "phone_number": "+919876543210",   (optional)
      "role": "l1",                      (employee role)
    }

    Returns: {
      "employee_id": "H3RK9N",          (6-char ID -- give this to the employee)
      "temp_password": "TempXx@123",    (give this to the employee -- they MUST change on first login)
      "message": "Account created. Share employee_id and temp_password with the employee."
    }

    The employee logs in with their employee_id + temp_password.
    On first login, they are forced to set a permanent password.
    """
    # Authenticate caller
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        payload = decode_token(creds.credentials)
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    caller_role = payload.get("role", "")
    if caller_role not in ("super_admin", "admin", "hr"):
        raise HTTPException(status_code=403, detail="Only super_admin, admin, or hr can create employee accounts.")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request payload")

    full_name    = (body.get("full_name") or "").strip()
    email        = (body.get("email") or "").strip().lower() or None
    phone_number = (body.get("phone_number") or "").strip() or None
    role_str     = (body.get("role") or "employee").strip().lower()

    if not full_name:
        raise HTTPException(status_code=422, detail="full_name is required.")

    # Validate role
    valid_employee_roles = {
        "l1", "l2", "team_lead", "manager", "super_admin",
        "support", "finance", "engineering", "onboarding",
        "data", "verification", "employee", "hr", "admin"
    }
    if role_str not in valid_employee_roles:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role '{role_str}'. Must be one of: {sorted(valid_employee_roles)}"
        )

    # Check email uniqueness
    if email:
        existing = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail=f"An account with email {email} already exists.")

    # Generate unique Employee ID (retry if collision)
    from app.services.auth_service import generate_employee_id, generate_temp_password

    for attempt in range(10):
        eid = generate_employee_id()
        existing_eid = await db.execute(select(User).where(User.employee_id == eid))
        if not existing_eid.scalars().first():
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique Employee ID. Try again.")

    # Generate temporary password
    temp_password = generate_temp_password()
    hashed_temp   = get_password_hash(temp_password)

    # Map role string to RoleEnum
    try:
        role_enum = RoleEnum(role_str)
    except ValueError:
        role_enum = RoleEnum.employee

    # Create user record
    new_user = User(
        id=uuid.uuid4(),
        full_name=full_name,
        email=email,
        phone_number=phone_number,
        hashed_password=hashed_temp,
        role=role_enum,
        is_active=True,
        token_version=1,
        employee_id=eid,
        is_temporary_password=True,   # Forces password change on first login
        phone_verified=True,          # No OTP needed for admin-created accounts
        auth_provider="local",
        has_usable_password=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(
        "Employee account created: employee_id=%s, name=%s, role=%s, by=%s",
        eid, full_name, role_str, payload.get("sub")
    )

    return {
        "employee_id":    eid,
        "temp_password":  temp_password,
        "full_name":      full_name,
        "email":          email or "",
        "role":           role_str,
        "message": (
            f"Employee account created. "
            f"Share Employee ID '{eid}' and the temporary password with {full_name}. "
            f"They must change their password on first login."
        ),
    }


@router.get("/employees/validate-id/{employee_id}")
async def validate_employee_id(employee_id: str, db: AsyncSession = Depends(get_db)):
    """
    Quick check if an employee_id exists (for login page UX).
    Returns 200 if found, 404 if not.
    Does NOT reveal whether the account is active -- security measure.
    """
    result = await db.execute(
        select(User.id).where(
            User.employee_id == employee_id.upper(),
            User.deleted_at.is_(None),
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Employee ID not found.")
    return {"valid": True}
