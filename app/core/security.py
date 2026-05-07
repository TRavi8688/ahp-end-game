"""
AHP Enterprise Security Layer.

Implements RS256 JWT Authentication with:
  - Minimal JWT payloads (sub, tenant_id, role, dept_scope, token_version)
  - Token versioning for instant, one-click revocation
  - DB-level token_version validation on every protected request
  - Structured error responses on auth failure
  - Role and tenant scope enforcement as FastAPI dependencies

RULES:
  - JWTs are minimal. No config blobs, no permissions lists.
  - All permission decisions are made server-side from the DB.
  - Frontend uses JWT claims for UI convenience ONLY.
  - Backend ALWAYS re-validates tenant scope on every API call.
"""
import bcrypt
import hashlib
import base64
import logging
from datetime import datetime, timedelta
from typing import Any, List, Optional, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# JWT Creation
# ---------------------------------------------------------------------------

def create_access_token(
    subject: Union[str, Any],
    role: str,
    tenant_id: Optional[int] = None,
    dept_scope: Optional[List[int]] = None,
    token_version: int = 1,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Creates a minimal, signed RS256 access token.

    Payload contract:
        sub            : str  — user ID
        role           : str  — RoleEnum value
        tenant_id      : int  — hospital_id (None for platform admins)
        dept_scope     : list — department IDs the user can access
        token_version  : int  — must match DB; increment to revoke
        type           : str  — "access"
    """
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "exp": expire,
        "iat": datetime.utcnow(),
        "sub": str(subject),
        "role": role,
        "tenant_id": tenant_id,
        "dept_scope": dept_scope or [],
        "token_version": token_version,
        "type": "access",
        "iss": settings.PROJECT_NAME,
        "aud": settings.JWT_AUDIENCE,
    }
    return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm="RS256")


def create_refresh_token(
    subject: Union[str, Any],
    role: str,
    token_version: int = 1,
) -> str:
    """Creates a long-lived RS256 refresh token (minimal claims)."""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "exp": expire,
        "iat": datetime.utcnow(),
        "sub": str(subject),
        "role": role,
        "token_version": token_version,
        "type": "refresh",
        "iss": settings.PROJECT_NAME,
        "aud": settings.JWT_AUDIENCE,
    }
    return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm="RS256")


# ---------------------------------------------------------------------------
# JWT Decoding
# ---------------------------------------------------------------------------

def decode_token(token: str, token_type: str = "access") -> Optional[dict]:
    """
    Decodes and structurally validates a JWT using the Public Key.
    Does NOT validate token_version here — that requires a DB call.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_PUBLIC_KEY,
            algorithms=["RS256"],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.PROJECT_NAME,
        )
        if payload.get("type") != token_type:
            logger.warning(
                "TOKEN_TYPE_MISMATCH",
                extra={"expected": token_type, "got": payload.get("type")},
            )
            return None
        return payload
    except JWTError as exc:
        logger.debug("TOKEN_DECODE_ERR: %s", str(exc))
        return None


# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------

def _get_hashable_password(password: str) -> bytes:
    """SHA-256 pre-hash to support passwords > 72 bytes (bcrypt limit)."""
    sha256_hash = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(sha256_hash)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_get_hashable_password(plain), hashed.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    pw_bytes = _get_hashable_password(password)
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


# ---------------------------------------------------------------------------
# FastAPI Dependencies
# ---------------------------------------------------------------------------

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={
        "error_code": "INVALID_TOKEN",
        "message": "Could not validate credentials.",
    },
    headers={"WWW-Authenticate": "Bearer"},
)

_REVOKED_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail={
        "error_code": "TOKEN_REVOKED",
        "message": "This token has been revoked. Please log in again.",
    },
    headers={"WWW-Authenticate": "Bearer"},
)

_INACTIVE_EXCEPTION = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail={
        "error_code": "ACCOUNT_DISABLED",
        "message": "This account has been deactivated.",
    },
)


def get_current_user(
    token: str = Depends(reusable_oauth2),
    db: Session = Depends(get_db),
):
    """
    Primary auth dependency for ALL protected endpoints.

    Validates:
      1. JWT signature and expiry (cryptographic)
      2. token_version against DB record (revocation check)
      3. is_active flag (account disabled check)

    Returns the full User ORM object so endpoints have access to
    tenant_id, role, and any other DB-level attributes safely.
    """
    from app.models.models import User  # local import to avoid circular deps

    payload = decode_token(token, token_type="access")
    if not payload:
        raise _CREDENTIALS_EXCEPTION

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise _CREDENTIALS_EXCEPTION

    user: Optional[User] = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise _CREDENTIALS_EXCEPTION

    # --- Token Version Check (Revocation) ---
    # If the hospital admin revokes a staff member, token_version is incremented
    # in the DB. Any existing token with the old version is immediately invalid.
    if user.token_version != payload.get("token_version"):
        logger.warning(
            "TOKEN_VERSION_MISMATCH: user_id=%s, db_ver=%s, jwt_ver=%s",
            user.id,
            user.token_version,
            payload.get("token_version"),
        )
        raise _REVOKED_EXCEPTION

    if not user.is_active:
        raise _INACTIVE_EXCEPTION

    return user


def require_roles(*roles: str):
    """
    Dependency factory for role-based access control.

    Usage:
        @router.get("/admin-only")
        def admin_view(user = Depends(require_roles("admin", "hospital_admin"))):
            ...
    """
    def checker(current_user=Depends(get_current_user)):
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "INSUFFICIENT_ROLE",
                    "message": f"One of these roles is required: {list(roles)}",
                },
            )
        return current_user
    return checker


def require_tenant_access(hospital_id: int):
    """
    Dependency factory that validates the requesting user belongs to the
    target hospital. Prevents cross-tenant data leakage.

    Usage:
        @router.get("/hospital/{hospital_id}/departments")
        def list_depts(
            hospital_id: int,
            user = Depends(require_tenant_access(hospital_id))
        ):
            ...
    Note: Super Admins (role="admin") bypass this check.
    """
    def checker(current_user=Depends(get_current_user)):
        from app.models.models import StaffProfile
        if current_user.role.value == "admin":
            return current_user  # Platform super-admin bypasses tenant check

        # Verify via StaffProfile — the authoritative tenant membership record
        profile = current_user.staff_profile
        if not profile or profile.hospital_id != hospital_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "TENANT_ACCESS_DENIED",
                    "message": "You do not have access to this hospital's data.",
                },
            )
        return current_user
    return checker


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def calculate_content_checksum(content: str) -> str:
    """SHA-256 integrity check for immutable records."""
    if not content:
        return ""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()
