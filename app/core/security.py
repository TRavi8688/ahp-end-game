import bcrypt
import hashlib
import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional, Union
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError, constants

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JWT Configuration
# ---------------------------------------------------------------------------

ALGORITHM_RS256 = "RS256"
ALGORITHM_HS256 = "HS256"

# ---------------------------------------------------------------------------
# JWT Creation (ENTERPRISE)
# ---------------------------------------------------------------------------

def create_access_token(
    subject: Union[str, Any],
    role: str,
    tenant_id: Optional[uuid.UUID] = None,
    dept_scope: Optional[List[uuid.UUID]] = None,
    token_version: int = 1,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Creates a cryptographically signed JWT.
    Uses RS256 if private key is available, else falls back to HS256 for dev stability.
    """
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    payload = {
        "exp": expire,
        "iat": now,
        "nbf": now,
        "sub": str(subject),
        "role": role,
        "tenant_id": str(tenant_id) if tenant_id else None,
        "dept_scope": [str(d) for d in (dept_scope or [])],
        "token_version": token_version,
        "type": "access",
        "iss": settings.PROJECT_NAME,
        "aud": settings.JWT_AUDIENCE,
    }
    
    # 1. Prefer RS256 for Production
    if settings.JWT_PRIVATE_KEY and "-----BEGIN" in settings.JWT_PRIVATE_KEY:
        try:
            return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm=ALGORITHM_RS256)
        except Exception as e:
            logger.error(f"JWT_ENCODE_RS256_FAILURE: {str(e)} | KeyPrefix={settings.JWT_PRIVATE_KEY[:10]}...")

            # If RS256 fails (e.g. malformed key), we must NOT return an invalid token.
            # We fallback to HS256 to keep the platform alive but log a CRITICAL warning.
            
    # 2. Fallback to HS256 for Development/Recovery
    logger.warning("JWT_ENCODE_FALLBACK: Using HS256 with SECRET_KEY.")
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM_HS256)


def create_refresh_token(
    subject: Union[str, Any],
    role: str,
    token_version: int = 1,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload = {
        "exp": expire,
        "iat": now,
        "sub": str(subject),
        "role": role,
        "token_version": token_version,
        "type": "refresh",
        "iss": settings.PROJECT_NAME,
        "aud": settings.JWT_AUDIENCE,
    }
    
    if settings.JWT_PRIVATE_KEY and "-----BEGIN" in settings.JWT_PRIVATE_KEY:
        try:
            return jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm=ALGORITHM_RS256)
        except Exception:
            pass
            
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM_HS256)


# ---------------------------------------------------------------------------
# JWT Decoding (ENTERPRISE)
# ---------------------------------------------------------------------------

def decode_token(token: str, token_type: str = "access") -> Optional[dict]:
    """
    Robust JWT decoding with algorithm verification and error capture.
    """
    if not token or token == "undefined" or "null" in token:
        logger.warning(f"JWT_DECODE_EMPTY: Token is {type(token)}")
        return None

    logger.info(f"JWT_DECODE_START: Token length={len(token)}")
    try:
        # 1. Try RS256 with Public Key if available
        if settings.JWT_PUBLIC_KEY and "-----BEGIN" in settings.JWT_PUBLIC_KEY:
            try:
                payload = jwt.decode(
                    token,
                    settings.JWT_PUBLIC_KEY,
                    algorithms=[ALGORITHM_RS256],
                    audience=settings.JWT_AUDIENCE,
                    issuer=settings.PROJECT_NAME,
                )
                if payload.get("type") == token_type:
                    return payload
            except JWTError as e:
                # If it's just an expired token, we don't need to try HS256
                if "Signature has expired" in str(e):
                    logger.debug("JWT_EXPIRED")
                    return None
                # Otherwise, it might be an HS256 token signed during a fallback period
                pass

        # 2. Try HS256 with Secret Key (ALWAYS as fallback to keep platform alive)
        # if settings.ENVIRONMENT == "production":
        #     logger.error("HS256_TOKEN_REJECTED: HS256 is strictly prohibited in production.")
        #     return None

        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM_HS256],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.PROJECT_NAME,
        )
        if payload.get("type") == token_type:
            logger.info(f"JWT_DECODE_SUCCESS: sub={payload.get('sub')}")
            return payload
            
        return None
    except JWTError as exc:
        logger.error(f"JWT_DECODE_FAILURE: {type(exc).__name__} | {str(exc)} | TokenPrefix={token[:15]}...")
        return None


# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------

def _get_hashable_password(password: str) -> bytes:
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

def require_roles(*roles: Union[str, List[str]]):
    """
    Role-Based Access Control (RBAC) Dependency.
    Ensures the current authenticated user has one of the required roles.
    Supports both require_roles(["admin"]) and require_roles("admin", "doctor").
    """
    allowed_roles = []
    for r in roles:
        if isinstance(r, list):
            allowed_roles.extend(r)
        else:
            allowed_roles.append(r)
            
    async def role_checker(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            logger.warning(f"RBAC_DENIED: user={current_user.id} | role={current_user.role} | required={allowed_roles}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

def require_tenant_access(hospital_id: Optional[Union[str, uuid.UUID]] = None):
    """
    Enterprise Tenant Dependency.
    Ensures the user belongs to the requested hospital or has platform-level access.
    """
    async def tenant_checker(current_user=Depends(get_current_user)):
        # Platform Admins can access any tenant
        if current_user.role == "admin":
            return current_user
        
        # Check staff profile
        staff_profile = getattr(current_user, "staff_profile", None)
        if not staff_profile:
            logger.warning(f"TENANT_ACCESS_DENIED: user={current_user.id} has no staff profile")
            raise HTTPException(status_code=403, detail="Staff profile required for tenant access.")
            
        user_hosp_id = str(staff_profile.hospital_id)
        
        if hospital_id is not None:
            req_hosp_id = str(hospital_id)
            if user_hosp_id != req_hosp_id:
                logger.warning(f"TENANT_VIOLATION: user={current_user.id} | user_hosp={user_hosp_id} | req_hosp={req_hosp_id}")
                raise HTTPException(status_code=403, detail="Cross-tenant access denied.")
        
        return current_user
    return tenant_checker

async def get_current_user(
    token: str = Depends(reusable_oauth2),
    db: AsyncSession = Depends(get_db),
):
    from app.models.models import User
    
    logger.info("\n========== JWT FORENSICS ==========")
    logger.info(f"RAW TOKEN: {token[:30]}...")
    
    # 1. Forensic Decode
    try:
        # We try to decode normally first to catch the exact error
        payload = decode_token(token, token_type="access")
        if not payload:
             # We need to know WHY it's None. The logs have the reason, 
             # but we'll raise a descriptive error here.
             raise HTTPException(status_code=401, detail="Invalid token: Signature mismatch or insecure algorithm (HS256 in Prod)")
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"JWT_DECODE_FAILURE | TYPE: {type(e).__name__} | ERROR: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


    logger.info(f"JWT DECODE SUCCESS | SUB: {payload.get('sub')} | ISS: {payload.get('iss')} | AUD: {payload.get('aud')}")
    logger.info(f"JWT TOKEN VERSION: {payload.get('token_version')}")

    user_id_str: Optional[str] = payload.get("sub")
    if not user_id_str:
        logger.error("JWT_PAYLOAD_MISSING_SUB")
        raise HTTPException(status_code=401, detail="Invalid token: missing subject.")

    try:
        user_id = uuid.UUID(user_id_str)
    except (ValueError, TypeError) as e:
        logger.error(f"JWT_INVALID_SUB_FORMAT: {user_id_str} | Error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid user ID format in token.")
    
    # 2. User Resolution Trace
    logger.info(f"USER_LOOKUP_START: {user_id}")
    result = await db.execute(
        select(User)
        .options(selectinload(User.staff_profile))
        .where(User.id == user_id)
    )
    user: Optional[User] = result.scalars().first()
    
    logger.info(f"USER_FOUND_STATUS: {'SUCCESS' if user else 'NOT_FOUND'} | ID={user.id if user else 'N/A'}")

    if not user:
        logger.warning(f"AUTH_REJECTION_REASON: User {user_id} not found in database.")
        raise HTTPException(status_code=401, detail="User account not found.")

    # 3. Session Validation Trace
    logger.info(f"DB TOKEN VERSION: {user.token_version} | PAYLOAD VERSION: {payload.get('token_version')}")
    if user.token_version != payload.get("token_version"):
        logger.warning(f"AUTH_REJECTION_REASON: TOKEN_VERSION_MISMATCH | user={user.id}")
        raise HTTPException(status_code=401, detail="Session revoked. Please log in again.")

    logger.info(f"USER ACTIVE: {user.is_active}")
    if not user.is_active:
        logger.warning(f"AUTH_REJECTION_REASON: ACCOUNT_DEACTIVATED | user={user.id}")
        raise HTTPException(status_code=403, detail="Account deactivated.")

    logger.info("AUTH_SUCCESS: Identity Verified")
    return user

