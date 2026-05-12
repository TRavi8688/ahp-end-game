import httpx
from app.core.config import settings
from app.core.logging import logger

async def send_sms_otp(phone_number: str, otp: str) -> bool:
    """
    MSG91 PRODUCTION SMS DELIVERY (v5 API): 
    Elite OTP delivery for Indian numbers.
    """
    auth_key = settings.MSG91_AUTH_KEY
    template_id = settings.MSG91_OTP_TEMPLATE_ID
    
    # 1. Check for missing credentials
    if not auth_key or "your_" in auth_key or not template_id:
        if settings.ENVIRONMENT == "production":
            logger.critical("MSG91_CREDENTIALS_MISSING: SMS delivery failed in production.")
            return False
        
        # In non-production, we fallback to logging the OTP for development ease
        logger.warning(f"[DEV_MODE] SMS OTP for {phone_number}: {otp}")
        return True

    # 2. Standardize phone number (MSG91 likes country code without +)
    target = phone_number.lstrip("+")
    if len(target) == 10:
        target = f"91{target}"

    # MSG91 API Format (v5): https://control.msg91.com/api/v5/otp
    url = "https://control.msg91.com/api/v5/otp"
    
    params = {
        "template_id": template_id,
        "mobile": target,
        "authkey": auth_key,
        "otp": otp,
        "otp_length": 6
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # We use POST as per documentation
            response = await client.post(url, params=params)
            data = response.json()
            
            if response.status_code == 200 and data.get("type") == "success":
                logger.info(f"MSG91_OTP_DISPATCHED: recipient={target}")
                return True
            else:
                logger.error(f"MSG91_DISPATCH_FAILURE: error={data.get('message')}, status={response.status_code}")
                return False
                
    except Exception as e:
        logger.error(f"MSG91_NETWORK_FAILURE: error={str(e)}")
        return False
