# ─────────────────────────────────────────────────────────────────────────────
# PATCH: backend/auth-service/app/services/auth_service.py
#
# Add the following import block near the top of the file (after existing imports):
# ─────────────────────────────────────────────────────────────────────────────

import httpx
from app.config.settings import settings  # already imported — no change needed

# ─────────────────────────────────────────────────────────────────────────────
# Add this function anywhere in auth_service.py before it is called:
# ─────────────────────────────────────────────────────────────────────────────

async def deliver_otp(phone_number: str, otp: str) -> bool:
    """
    Call notification-service to deliver OTP via SMS.

    Designed to be non-blocking: if delivery fails (network error, service
    down, bad response) we log and return False but do NOT raise — the caller
    (register / verify flow) must decide whether to surface the error to the
    user or silently continue.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.NOTIFICATION_SERVICE_URL}/api/v1/notifications/otp",
                json={"phone_number": phone_number, "otp": otp},
                headers={"X-Internal-Secret": settings.INTERNAL_SERVICE_SECRET},
            )
            if response.status_code == 200:
                return True
            # Log non-200 without raising so caller can continue
            logger.error(
                f"Notification service returned {response.status_code} "
                f"for OTP delivery to ...{phone_number[-4:]}"
            )
            return False
    except httpx.TimeoutException:
        logger.error(f"Timeout delivering OTP to ...{phone_number[-4:]}")
        return False
    except Exception as e:
        logger.error(f"OTP delivery failed: {type(e).__name__}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# In the existing send_otp / register_user function, replace any placeholder
# OTP logging with a call to deliver_otp. Example:
#
#   otp = generate_otp()
#   await store_otp_in_redis(phone_number, otp)
#   delivered = await deliver_otp(phone_number, otp)
#   if not delivered:
#       logger.warning(f"OTP generated but SMS not confirmed for ...{phone_number[-4:]}")
#   return otp  # return regardless — don't block registration on SMS
# ─────────────────────────────────────────────────────────────────────────────
