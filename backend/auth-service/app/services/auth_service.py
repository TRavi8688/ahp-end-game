"""
Auth Service — Core Authentication Logic.

Handles password hashing, JWT token creation (access + refresh),
OTP generation, and secure token generation for password resets.

FIXES APPLIED:
  - Twilio SMS OTP delivery is now wired (send_otp_sms)
  - OTP is NO LONGER logged to console under any circumstances
  - send_otp_email no longer leaks OTP in the warning log
  - SMS is attempted first; email is the fallback if phone not available
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


def send_otp_sms(phone_number: str, otp_code: str) -> bool:
    """
    Send OTP via Twilio SMS.

    Returns True on success, False on failure.
    NEVER logs the OTP value itself — only masked phone number.
    """
    if not all([
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_AUTH_TOKEN,
        settings.TWILIO_FROM_NUMBER,
    ]):
        logger.error(
            "Twilio credentials not fully configured — OTP SMS NOT sent. "
            "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env"
        )
        return False

    try:
        from twilio.rest import Client  # imported lazily so service starts without twilio if SMS unused

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        masked_phone = phone_number[:4] + "****" + phone_number[-2:] if len(phone_number) > 6 else "****"
        client.messages.create(
            body=(
                f"Your Hospyn verification code is: {otp_code}\n"
                f"Valid for {settings.OTP_EXPIRE_MINUTES} minutes.\n"
                f"Do NOT share this with anyone."
            ),
            from_=settings.TWILIO_FROM_NUMBER,
            to=phone_number,
        )
        logger.info(f"OTP SMS sent successfully to {masked_phone}")
        return True

    except Exception as e:
        # Log the error type but NOT the otp_code
        logger.error(f"Twilio SMS delivery failed: {type(e).__name__}: {e}")
        return False


def send_otp_email(email_address: str, otp_code: str) -> bool:
    """
    Send OTP via SMTP email.

    Returns True on success, False if SMTP not configured or on failure.
    NEVER logs the OTP value — only logs masked email.
    """
    masked_email = email_address[:3] + "****" + email_address[email_address.find("@"):]

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        # SECURITY FIX: Do NOT log the OTP. Just log that it couldn't be sent.
        logger.warning(
            f"SMTP not configured — OTP email NOT sent to {masked_email}. "
            "Set SMTP_HOST and SMTP_USER in .env to enable email OTP delivery."
        )
        return False

    try:
        msg = EmailMessage()
        msg.set_content(
            f"Your Hospyn verification code is: {otp_code}\n\n"
            f"It expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
            f"Do NOT share this code with anyone."
        )
        msg["Subject"] = "Hospyn OTP Verification"
        msg["From"] = settings.SMTP_FROM_EMAIL or "noreply@hospyn.com"
        msg["To"] = email_address

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            logger.info(f"OTP email sent to {masked_email}")
            return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {masked_email}: {type(e).__name__}")
        return False


def deliver_otp(phone_number: str | None, email_address: str | None, otp_code: str) -> bool:
    """
    Deliver OTP via the best available channel.

    Priority: SMS (Twilio) → Email (SMTP).
    Returns True if at least one delivery succeeded.

    This is the single function that router.py should call.
    """
    sms_ok = False
    email_ok = False

    # Try SMS first (preferred — faster, more reliable for medical OTPs)
    if phone_number:
        sms_ok = send_otp_sms(phone_number, otp_code)

    # Fall back to email if SMS failed or phone not available
    if not sms_ok and email_address:
        email_ok = send_otp_email(email_address, otp_code)

    if not sms_ok and not email_ok:
        logger.critical(
            "OTP delivery failed via ALL channels. "
            "User cannot receive OTP. Check Twilio and SMTP configuration."
        )
        return False

    return True


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
