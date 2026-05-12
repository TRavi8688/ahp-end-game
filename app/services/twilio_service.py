import os
from twilio.rest import Client
from app.core.config import settings
from app.core.logging import logger

def validate_twilio_config():
    """Validates Twilio credentials at startup/first use."""
    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    from_num = settings.TWILIO_PHONE_NUMBER or settings.TWILIO_FROM_NUMBER

    missing = []
    if not sid or "your_" in sid: missing.append("TWILIO_ACCOUNT_SID")
    if not token or "your_" in token: missing.append("TWILIO_AUTH_TOKEN")
    if not from_num: missing.append("TWILIO_PHONE_NUMBER")

    if missing:
        error_msg = f"CRITICAL_TWILIO_CONFIG_MISSING: {', '.join(missing)}"
        if settings.ENVIRONMENT == "production":
            logger.critical(error_msg)
            raise RuntimeError(error_msg)
        else:
            logger.warning(f"{error_msg}. SMS delivery will be mocked.")
            return False, None, None, None
    
    return True, sid, token, from_num

def send_sms_otp(phone_number: str, otp: str) -> bool:
    """
    ENTERPRISE SMS DELIVERY: Strictly production-safe.
    No hardcoded mock bypasses. No OTP leakage in logs.
    """
    is_valid, sid, token, from_num = validate_twilio_config()
    
    if not is_valid:
        # Fallback for non-production environments
        logger.info(f"MOCK_SMS_SENT: To={phone_number}, OTP=[REDACTED]")
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
        logger.info("SMS_DISPATCH_SUCCESS", sid=message.sid, recipient=phone_number)
        return True
    except Exception as e:
        logger.error("SMS_DISPATCH_FAILURE", error=str(e), recipient=phone_number)
        return False
