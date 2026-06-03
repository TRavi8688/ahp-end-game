"""
backend/auth-service/app/core/security.py
Phase 5 fix:
  - RS256 asymmetric JWT (was HS256 symmetric — single shared secret, insecure multi-service)
  - token_version revocation: incrementing DB field invalidates all old tokens instantly
  - OTP hashed with HMAC-SHA256 before storing (was stored plaintext)
  - Fernet PHI encryption loaded from env, not from enc.key file
"""
import hashlib
import hmac
import os
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.fernet import Fernet
from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# RS256 JWT — asymmetric signing
# Audit fix: was HS256 (symmetric). RS256 means only auth-service holds the
# private key; all other services verify using the public key only.
# ---------------------------------------------------------------------------

def _load_private_key():
    pem = settings.JWT_PRIVATE_KEY_PEM
    if not pem:
        # Dev fallback: generate ephemeral key (not for production)
        if settings.is_production:
            raise RuntimeError("JWT_PRIVATE_KEY_PEM must be set in production")
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        return key
    return serialization.load_pem_private_key(pem.encode(), password=None)


def _load_public_key():
    pem = settings.JWT_PUBLIC_KEY_PEM
    if not pem:
        return _load_private_key().public_key()
    return serialization.load_pem_public_key(pem.encode())


def create_access_token(
    subject: str,
    hospital_id: str,
    role: str,
    token_version: int,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": subject,           # user_id
        "hid": hospital_id,       # hospital_id — ABAC scoping
        "role": role,
        "ver": token_version,     # revocation: if DB ver > this, token is invalid
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    private_key = _load_private_key()
    return jwt.encode(payload, private_key, algorithm="RS256")


def create_refresh_token(subject: str, token_version: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "ver": token_version,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    }
    private_key = _load_private_key()
    return jwt.encode(payload, private_key, algorithm="RS256")


def decode_token(token: str) -> dict:
    """Decode and verify RS256 JWT. Raises JWTError on invalid/expired token."""
    public_key = _load_public_key()
    return jwt.decode(token, public_key, algorithms=["RS256"])


def get_public_key_pem() -> str:
    """Returns the public key PEM for JWKS endpoint — other services fetch this."""
    pub = _load_public_key()
    return pub.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()


# ---------------------------------------------------------------------------
# JWKS endpoint data (for other services to validate tokens without shared secret)
# ---------------------------------------------------------------------------

def get_jwks() -> dict:
    import base64
    pub = _load_public_key()
    pub_numbers = pub.public_key().public_numbers() if hasattr(pub, 'private_bytes') else pub.public_numbers()

    def _b64url(n: int, length: int) -> str:
        return base64.urlsafe_b64encode(
            n.to_bytes(length, "big")
        ).rstrip(b"=").decode()

    return {
        "keys": [{
            "kty": "RSA",
            "use": "sig",
            "alg": "RS256",
            "kid": "hospyn-auth-key-1",
            "n": _b64url(pub_numbers.n, 256),
            "e": _b64url(pub_numbers.e, 3),
        }]
    }


# ---------------------------------------------------------------------------
# OTP — HMAC-SHA256 hashed storage (not plaintext)
# Audit fix: OTPs stored plaintext in Redis → now HMAC-SHA256 hashed
# ---------------------------------------------------------------------------

_OTP_HMAC_SECRET = os.environ.get("OTP_HMAC_SECRET", settings.SECRET_KEY).encode()


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP."""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def hash_otp(otp: str) -> str:
    """HMAC-SHA256 hash of OTP for safe storage in Redis."""
    return hmac.new(_OTP_HMAC_SECRET, otp.encode(), hashlib.sha256).hexdigest()


def verify_otp(plain_otp: str, stored_hash: str) -> bool:
    """Constant-time comparison of OTP hash."""
    return hmac.compare_digest(hash_otp(plain_otp), stored_hash)


# ---------------------------------------------------------------------------
# Fernet PHI encryption — loaded from env var, NOT from enc.key file
# Audit fix: enc.key was committed to repo and baked into Docker images
# ---------------------------------------------------------------------------

def get_fernet() -> Fernet:
    key = os.environ.get("FERNET_KEY", "")
    if not key:
        raise RuntimeError(
            "FERNET_KEY environment variable is not set. "
            "Generate: make gen-fernet  Then store in GCP Secret Manager."
        )
    compromised = "CUV3WDeZXcp_7F74LyTqqIDmgDqn5-xbqKvDzEikdUs="
    if key == compromised:
        raise RuntimeError(
            "FERNET_KEY is the known compromised key from the public repo. "
            "Generate a new key immediately: make gen-fernet"
        )
    return Fernet(key.encode())


def encrypt_phi(value: str) -> str:
    """Encrypt a PHI string field at the application layer."""
    return get_fernet().encrypt(value.encode()).decode()


def decrypt_phi(value: str) -> str:
    """Decrypt a PHI string field."""
    return get_fernet().decrypt(value.encode()).decode()
