"""
auth-service/app/services/auth_service.py

PLACE AT: backend/auth-service/app/services/auth_service.py
FIX: hmac.new() verified correct — key and msg must be bytes, digestmod must
     be hashlib module object (not string). Added explicit encode() calls.
FIX: Added generate_reset_token() and hash_reset_token() used by router.py.
FIX: deliver_otp() SMS→email fallback fully wired.
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


# ── Password ──────────────────────────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error("Password verification error: %s", e)
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "type": "access",
        "jti": str(uuid.uuid4()),
        "iat": datetime.now(timezone.utc),
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": datetime.now(timezone.utc),
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_refresh_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


# ── OTP ───────────────────────────────────────────────────────────────────────

def generate_otp() -> str:
    """Cryptographically secure 6-digit OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


def hash_otp(otp: str) -> str:
    """
    Hash OTP using HMAC-SHA256.
    FIX: hmac.new(key_bytes, msg_bytes, hashlib.sha256) is the correct call.
    Both arguments must be bytes — .encode() ensures this.
    Verified: python3 -c "import hmac,hashlib; hmac.new(b'k',b'm',hashlib.sha256).hexdigest()"
    """
    return hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        otp.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """Constant-time OTP comparison to prevent timing attacks."""
    try:
        return hmac.compare_digest(hash_otp(plain_otp), hashed_otp)
    except Exception:
        return False


# ── Reset Token ───────────────────────────────────────────────────────────────

def generate_reset_token() -> str:
    """Generate a high-entropy URL-safe reset token."""
    return secrets.token_urlsafe(48)


def hash_reset_token(token: str) -> str:
    """SHA-256 hash of reset token for DB storage (no key needed — token is high-entropy)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ── OTP Delivery ──────────────────────────────────────────────────────────────

def send_otp_sms(phone_number: str, otp_code: str) -> bool:
    if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_FROM_NUMBER]):
        logger.warning("Twilio not configured — SMS skipped for ***%s", phone_number[-4:])
        return False
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=(
                f"Your Hospin verification code is: {otp_code}. "
                f"Valid for {settings.OTP_EXPIRE_MINUTES} minutes. "
                "Do not share this code."
            ),
            from_=settings.TWILIO_FROM_NUMBER,
            to=phone_number,
        )
        logger.info("OTP SMS sent: sid=%s to=***%s", msg.sid, phone_number[-4:])
        return True
    except Exception as e:
        logger.error("Twilio SMS failed for ***%s: %s", phone_number[-4:], e)
        return False


def send_otp_email(email: str, otp_code: str) -> bool:
    if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD, settings.SMTP_FROM_EMAIL]):
        logger.warning("SMTP not configured — email OTP skipped")
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = "Your Hospin Verification Code"
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = email
        msg.set_content(
            f"Your Hospin verification code is: {otp_code}\n\n"
            f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
            "Do not share this code with anyone.\n\n"
            "If you did not request this, ignore this email."
        )
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("OTP email sent to: %s***", email[:3])
        return True
    except Exception as e:
        logger.error("SMTP failed for %s***: %s", email[:3], e)
        return False


def deliver_otp(phone_number: str | None, email: str | None, otp_code: str) -> bool:
    """Try SMS first, fall back to email. Returns True if at least one succeeded."""
    if phone_number and send_otp_sms(phone_number, otp_code):
        return True
    if email and send_otp_email(email, otp_code):
        return True
    logger.error("OTP delivery failed — no channel available (phone=%s, email=%s)", bool(phone_number), bool(email))
    return False


# ── User Authentication ───────────────────────────────────────────────────────

async def authenticate_user(db, identifier: str, password: str):
    """Find user by email or phone and verify password. Returns User or None."""
    from app.models.user import User
    from sqlalchemy import select
    result = await db.execute(
        select(User).where(
            (User.email == identifier) | (User.phone_number == identifier)
        )
    )
    user = result.scalars().first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def register_user(body: dict, redis=None):
    """Lightweight stub — full registration is in router.py."""
    return {"message": "Use POST /api/v1/auth/register"}
