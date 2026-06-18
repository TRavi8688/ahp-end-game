import logging
import re
from typing import Optional

import redis.asyncio as aioredis

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Compiled once at import time
E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")

# Redis key prefix for SMS rate limiting
RATE_LIMIT_PREFIX = "sms_rl:"
RATE_LIMIT_WINDOW = 3600   # 1 hour in seconds
RATE_LIMIT_MAX = 5          # max SMS per phone per hour


def _mask_phone(phone: str) -> str:
    """Return phone with all but last 4 digits masked."""
    if len(phone) <= 4:
        return "****"
    return "*" * (len(phone) - 4) + phone[-4:]


def _validate_e164(phone: str) -> bool:
    return bool(E164_PATTERN.match(phone))


async def _check_rate_limit(phone: str, redis_client: aioredis.Redis) -> bool:
    """
    Returns True if the phone is within rate limit (OK to send).
    Returns False if the limit is exceeded.
    Uses a simple counter with TTL.
    """
    key = f"{RATE_LIMIT_PREFIX}{phone}"
    try:
        count = await redis_client.incr(key)
        if count == 1:
            # First message in this window — set expiry
            await redis_client.expire(key, RATE_LIMIT_WINDOW)
        if count > RATE_LIMIT_MAX:
            logger.warning(
                f"SMS rate limit exceeded for ...{_mask_phone(phone)} "
                f"(count={count}, max={RATE_LIMIT_MAX})"
            )
            return False
        return True
    except Exception as e:
        logger.error(f"Redis rate-limit check failed: {e} — allowing send")
        return True  # Fail open so a Redis outage doesn't block all SMS


async def send_sms(
    to: str,
    body: str,
    redis_client: Optional[aioredis.Redis] = None,
) -> bool:
    """
    Send an SMS message via Twilio.

    Args:
        to:           Destination phone number in E.164 format (e.g. +919876543210).
        body:         Message text.
        redis_client: Optional Redis client for rate limiting. If None, rate
                      limiting is skipped (useful in tests).

    Returns:
        True on success, False on failure.
    """
    masked = _mask_phone(to)

    # 1. Validate format
    if not _validate_e164(to):
        logger.error(f"Invalid E.164 phone number: {masked}")
        return False

    # 2. Rate limiting
    if redis_client is not None:
        allowed = await _check_rate_limit(to, redis_client)
        if not allowed:
            return False

    # 3. Test mode — log instead of sending
    if settings.SMS_TEST_MODE:
        logger.info(f"[TEST MODE] SMS to {masked}: {body}")
        return True

    # 4. Real send via Twilio
    if not settings.twilio_configured:
        logger.error("Twilio credentials not configured — cannot send SMS")
        return False

    try:
        from twilio.rest import Client  # imported lazily so tests don't need twilio installed

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            to=to,
            from_=settings.TWILIO_PHONE_NUMBER,
            body=body,
        )
        logger.info(f"SMS sent to {masked} — SID: {message.sid}")
        return True

    except Exception as e:
        # Log the error category without exposing full message (may contain PII)
        logger.error(f"Twilio send failed for {masked}: {type(e).__name__}: {e}")
        return False
