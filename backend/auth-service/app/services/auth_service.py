"""
Auth Service — Core Authentication Logic.

Handles password hashing, JWT token creation (access + refresh),
OTP generation, and secure token generation for password resets.
"""

from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.config.settings import settings
import secrets
import logging
import uuid
import smtplib
import hmac
import hashlib
from email.message import EmailMessage

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password Hashing ────────────────────────────────────────────


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password with bcrypt."""
    return pwd_context.hash(password)


# ─── JWT Token Creation ──────────────────────────────────────────


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token with unique JTI for revocation."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update(
        {
            "exp": expire,
            "type": "access",
            "jti": str(uuid.uuid4()),
            "iat": datetime.now(timezone.utc),
        }
    )
    return jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(data: dict) -> str:
    """Create a long-lived refresh token with unique JTI for revocation."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    to_encode.update(
        {
            "exp": expire,
            "type": "refresh",
            "jti": str(uuid.uuid4()),
            "iat": datetime.now(timezone.utc),
        }
    )
    return jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def decode_refresh_token(token: str) -> dict | None:
    """Decode and validate a refresh token. Returns payload or None."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


# ─── OTP ──────────────────────────────────────────────────────────


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP using secrets module."""
    return f"{secrets.randbelow(900000) + 100000}"


def hash_otp(otp: str) -> str:
    """Hash OTP for secure database storage using HMAC-SHA256."""
    return hmac.new(
        settings.JWT_SECRET_KEY.encode(), otp.encode(), hashlib.sha256
    ).hexdigest()


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """Verify a plaintext OTP against its HMAC-SHA256 hash."""
    try:
        calculated = hash_otp(plain_otp)
        return hmac.compare_digest(calculated, hashed_otp)
    except Exception:
        return False


def send_otp_email(email_address: str, otp_code: str):
    """Send OTP via SMTP email if configured."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning(
            f"SMTP not configured. Mocking email to {email_address} with OTP {otp_code}"
        )
        return

    try:
        msg = EmailMessage()
        msg.set_content(
            f"Your Hospyn verification code is: {otp_code}\n\nIt expires in {settings.OTP_EXPIRE_MINUTES} minutes."
        )
        msg["Subject"] = "Hospyn OTP Verification"
        msg["From"] = settings.SMTP_FROM_EMAIL or "noreply@hospyn.com"
        msg["To"] = email_address

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            logger.info(f"OTP email sent to {email_address}")
    except Exception as e:
        logger.error(f"Failed to send OTP email: {e}")


# ─── Reset Token ──────────────────────────────────────────────────


def generate_reset_token() -> str:
    """Generate a cryptographically secure URL-safe reset token."""
    return secrets.token_urlsafe(48)


def hash_reset_token(token: str) -> str:
    """Hash reset token for secure database storage using HMAC-SHA256."""
    return hmac.new(
        settings.JWT_SECRET_KEY.encode(), token.encode(), hashlib.sha256
    ).hexdigest()


def verify_reset_token(plain_token: str, hashed_token: str) -> bool:
    """Verify a plaintext reset token against its hash."""
    try:
        calculated = hash_reset_token(plain_token)
        return hmac.compare_digest(calculated, hashed_token)
    except Exception:
        return False
