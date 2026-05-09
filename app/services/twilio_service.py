import os
from twilio.rest import Client
from app.core.config import settings
from app.core.logging import logger

def send_sms_otp(phone_number: str, otp: str) -> bool:
    """
    ENTERPRISE SMS DELIVERY: Strictly production-safe.
    No hardcoded mock bypasses. No OTP leakage in logs.
    """
    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    from_num = settings.TWILIO_FROM_NUMBER

    if not sid or not token or "your_" in sid or "your_" in token:
        if settings.ENVIRONMENT == "production":
            logger.critical("TWILIO_CREDENTIALS_MISSING: SMS delivery failed in production.")
            return False
        # In dev, we log that it was skipped, but DO NOT log the OTP itself.
        logger.warning("SMS_SKIPPED: Credentials not configured.", recipient=phone_number)
        return True

    try:
        client = Client(sid, token)
        # Standardize E.164 formatting
        target = phone_number if phone_number.startswith("+") else f"+91{phone_number}"
            
        message = client.messages.create(
            body=f"Your Hospyn verification code is: {otp}",
            from_=from_num,
            to=target
        )
        logger.info("SMS_DISPATCHED", sid=message.sid)
        return True
    except Exception as e:
        logger.error("SMS_DISPATCH_FAILURE", error=str(e))
        return False
