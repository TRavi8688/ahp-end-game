"""
Startup Checks — Production safety validations.

Run once at service boot (inside the lifespan context) to catch
fatal misconfigurations BEFORE the service starts accepting traffic.
"""
import logging
import os

logger = logging.getLogger(__name__)

_KNOWN_UNSAFE_SECRETS = [
    "local_dev_secret_key_must_be_at_least_32_characters_long_for_security",
    "supersecretkey_please_change_in_production_12345",
]


def validate_production_secrets(settings) -> None:
    """
    Validates that production deployments are not using default/unsafe secrets.
    Raises ValueError to prevent startup if a known-bad key is detected.
    """
    env = getattr(settings, "ENVIRONMENT", "development").lower()
    if env != "production":
        return

    jwt_key = getattr(settings, "JWT_SECRET_KEY", "")
    if jwt_key in _KNOWN_UNSAFE_SECRETS:
        raise ValueError(
            "FATAL: JWT_SECRET_KEY is set to a known default value in production. "
            'Generate a new key: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )

    enc_key = os.environ.get("ENCRYPTION_KEY", "")
    if not enc_key:
        logger.warning("ENCRYPTION_KEY not set — PHI field encryption is DISABLED")
