import asyncio
from app.core.config import settings
from app.core.logging import logger
from app.services.twilio_service import send_sms_otp as twilio_send

async def send_sms_otp(phone_number: str, otp: str) -> bool:
    """
    TWILIO PRODUCTION SMS DELIVERY: 
    Enterprise-grade reliability for global numbers.
    """
    # Simply delegate to the specialized Twilio service using a threadpool
    # to avoid blocking the main event loop.
    return await asyncio.to_thread(twilio_send, phone_number, otp)
