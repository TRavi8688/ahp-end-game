from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

router = APIRouter(prefix="/notify", tags=["notifications"])


class SMSRequest(BaseModel):
    to_phone: str      # E.164 format: +919876543210
    message: str
    template: str = "custom"  # otp | appointment_reminder | lab_result | prescription_ready | custom


class PushRequest(BaseModel):
    device_token: str
    title: str
    body: str
    data: dict = {}


class EmailRequest(BaseModel):
    to_email: str
    subject: str
    html_body: str
    template: str = "custom"


@router.post("/sms")
async def send_sms_notification(
    request: SMSRequest,
    background_tasks: BackgroundTasks
):
    """Send an SMS notification. Runs in background to avoid blocking the request."""
    from app.services.sms import send_sms
    background_tasks.add_task(send_sms, request.to_phone, request.message)
    return {"status": "queued", "to": request.to_phone}


@router.post("/push")
async def send_push(
    request: PushRequest,
    background_tasks: BackgroundTasks
):
    """Send a push notification via Firebase FCM."""
    from app.services.push import send_push_notification
    background_tasks.add_task(
        send_push_notification,
        request.device_token, request.title, request.body, request.data
    )
    return {"status": "queued"}


@router.post("/email")
async def send_email_notification(request: EmailRequest):
    """Send an email notification via SendGrid. Wire SENDGRID_API_KEY when ready."""
    # TODO: Implement SendGrid integration
    return {"status": "queued", "to": request.to_email, "note": "Email integration pending — set SENDGRID_API_KEY"}


@router.get("/health")
async def health():
    return {"status": "ok"}
