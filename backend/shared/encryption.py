"""
PHI Encryption at Rest -- Fernet-based SQLAlchemy TypeDecorators

Provides EncryptedString and EncryptedText column types that transparently
encrypt on write and decrypt on read using Fernet symmetric encryption.

Key management:
  • ENCRYPTION_KEY env var -- base64-encoded Fernet key(s), comma-separated for rotation.
  • First key is always used for encryption; all keys are tried on decryption.
  • In production (ENVIRONMENT=production), missing key raises ValueError at import time.
  • In dev, a deterministic dev-only key is used with a loud warning.
"""

import base64
import hashlib
import logging
import os
from typing import Optional, Sequence

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import String, Text
from sqlalchemy.types import TypeDecorator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Key loading
# ---------------------------------------------------------------------------


def _load_fernet_keys() -> list[Fernet]:
    """Return a list of Fernet instances from ENCRYPTION_KEY env var."""
    raw = (os.environ.get("APP_ENCRYPTION_KEY") or os.environ.get("ENCRYPTION_KEY", "")).strip()

    if raw:
        keys: list[Fernet] = []
        for part in raw.split(","):
            part = part.strip()
            if part:
                try:
                    keys.append(Fernet(part.encode()))
                except ValueError as e:
                    logger.critical(
                        "FATAL: Provided ENCRYPTION_KEY is not a valid 32 url-safe base64-encoded string. "
                        "Error: %s. Falling back to dev-key to prevent crash, but PHI will be lost!", e
                    )
                    keys.clear()
                    raw = ""
                    break
        if keys:
            return keys

    # Key is missing -- behaviour depends on environment
    environment = os.environ.get("ENVIRONMENT", "development").lower()
    if environment == "production":
        logger.critical(
            "ENCRYPTION_KEY environment variable is REQUIRED in production. "
            "Generating an ephemeral DEV-ONLY key so the service can start, but "
            "ALL PHI encrypted during this session will be lost on restart. "
            "Set FERNET_KEY in GitHub Secrets ASAP."
        )
    else:
        # Dev-only deterministic key -- NEVER use in production
        logger.warning(
            "⚠️  ENCRYPTION_KEY is not set -- using a deterministic DEV-ONLY key. "
            "DO NOT use this in production!"
        )
    dev_seed = b"hospyn-dev-only-encryption-seed-do-not-use-in-prod"
    dev_key = base64.urlsafe_b64encode(hashlib.sha256(dev_seed).digest())
    return [Fernet(dev_key)]


_FERNET_KEYS: list[Fernet] = _load_fernet_keys()
_PRIMARY_FERNET: Fernet = _FERNET_KEYS[0]


# ---------------------------------------------------------------------------
# Encrypt / Decrypt helpers
# ---------------------------------------------------------------------------


def _encrypt(value: str) -> str:
    """Encrypt a plaintext string and return the ciphertext as a UTF-8 string."""
    return _PRIMARY_FERNET.encrypt(value.encode("utf-8")).decode("utf-8")


def _decrypt(token: str, keys: Sequence[Fernet] = _FERNET_KEYS) -> str:
    """
    Decrypt a ciphertext token, trying each key in order (supports rotation).

    If decryption fails with *all* keys, assumes the value is already
    plaintext (migration-period graceful handling) and returns it as-is.
    """
    for fernet in keys:
        try:
            return fernet.decrypt(token.encode("utf-8")).decode("utf-8")
        except (InvalidToken, Exception):
            continue

    # None of the keys worked -- treat as already-unencrypted (migration period)
    logger.debug(
        "Value could not be decrypted with any key; returning as plaintext "
        "(migration period)."
    )
    return token


# ---------------------------------------------------------------------------
# SQLAlchemy TypeDecorators
# ---------------------------------------------------------------------------


class EncryptedString(TypeDecorator):
    """
    A column type that stores an encrypted string in a VARCHAR(length) column.

    Usage::

        emergency_contact_name = mapped_column(EncryptedString(600), nullable=True)
    """

    impl = String
    cache_ok = True

    def __init__(self, length: int = 255, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.impl = String(length)

    # ------ bind (Python -> DB) ------
    def process_bind_param(self, value: Optional[str], dialect) -> Optional[str]:
        if value is None:
            return None
        return _encrypt(value)

    # ------ result (DB -> Python) ------
    def process_result_value(self, value: Optional[str], dialect) -> Optional[str]:
        if value is None:
            return None
        return _decrypt(value)


class EncryptedText(TypeDecorator):
    """
    A column type that stores an encrypted string in a TEXT column.

    Usage::

        clinical_notes = mapped_column(EncryptedText, nullable=True)
    """

    impl = Text
    cache_ok = True

    # ------ bind (Python -> DB) ------
    def process_bind_param(self, value: Optional[str], dialect) -> Optional[str]:
        if value is None:
            return None
        return _encrypt(value)

    # ------ result (DB -> Python) ------
    def process_result_value(self, value: Optional[str], dialect) -> Optional[str]:
        if value is None:
            return None
        return _decrypt(value)
