import httpx
from app.core.config import settings
from app.core.logging import logger

async def send_sms_otp(phone_number: str, otp: str) -> bool:
    """
    2FACTOR.IN PRODUCTION SMS DELIVERY: 
    Reliable OTP delivery for Indian numbers.
    """
    api_key = settings.TWO_FACTOR_API_KEY
    
    if not api_key or "your_" in api_key:
        if settings.ENVIRONMENT == "production":
            logger.critical("2FACTOR_CREDENTIALS_MISSING: SMS delivery failed in production.")
            return False
        logger.warning("SMS_SKIPPED: 2Factor.in Credentials not configured.", recipient=phone_number)
        if settings.DEMO_MODE:
            logger.info("DEMO_MODE_OTP", recipient=phone_number, otp=otp)
        return True

    # Standardize phone number (2Factor.in likes just the number with country code, usually +91 for India)
    target = phone_number.lstrip("+")
    if len(target) == 10:
        target = f"91{target}"

    # 2Factor.in API Format: https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp}
    url = f"https://2factor.in/API/V1/{api_key}/SMS/{target}/{otp}/OTP1" # Using standard OTP template

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            data = response.json()
            
            if response.status_code == 200 and data.get("Status") == "Success":
                logger.info("2FACTOR_OTP_DISPATCHED", recipient=target, session_id=data.get("Details"))
                return True
            else:
                logger.error("2FACTOR_DISPATCH_FAILURE", error=data.get("Details"), status=response.status_code)
                return False
    except Exception as e:
        logger.error("2FACTOR_NETWORK_FAILURE", error=str(e))
        return False
