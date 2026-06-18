"""
B-4: Notification Service — Push Token Storage + Send Push + Sentry
Place at: backend/notification-service/app/api/v1/notifications.py

Then in backend/notification-service/app/main.py add:
    from app.api.v1.notifications import router as notifications_router
    app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])

Also add to requirements.txt:
    sentry-sdk[fastapi]>=1.40.0
    firebase-admin>=6.0.0
"""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text

router = APIRouter()
logger = logging.getLogger(__name__)


# ── DB dependency ────────────────────────────────────────────
def get_db():
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth dependency ───────────────────────────────────────────
def get_current_user(request: Request):
    from app.core.auth import verify_token
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    return verify_token(token)


# ── DeviceToken model (create if it doesn't exist) ───────────
def _get_device_token_model():
    try:
        from app.models.device_token import DeviceToken
        return DeviceToken
    except ImportError:
        from app.database import Base
        class DeviceToken(Base):
            __tablename__ = "device_tokens"
            id = Column(Integer, primary_key=True, index=True)
            patient_id = Column(String(64), nullable=False, index=True)
            fcm_token = Column(Text, nullable=False)
            platform = Column(String(20), nullable=False, default="android")  # ios | android
            created_at = Column(DateTime, default=datetime.utcnow)
            updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
        return DeviceToken


# ── FCM client (firebase-admin) ───────────────────────────────
_fcm_initialized = False

def _get_fcm_app():
    global _fcm_initialized
    if not _fcm_initialized:
        import firebase_admin
        from firebase_admin import credentials
        service_account_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        if not service_account_path:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_PATH env var is not set")
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        _fcm_initialized = True
    return True


# ─────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────

class RegisterTokenRequest(BaseModel):
    patient_id: str
    fcm_token: str
    platform: str = "android"  # ios | android


class SendPushRequest(BaseModel):
    patient_id: str
    title: str
    body: str
    data: Optional[dict] = {}


# ─────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.post("/register-token", status_code=status.HTTP_200_OK)
async def register_token(
    body: RegisterTokenRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Store or update the FCM push token for a patient.
    Called by the patient mobile app after Firebase registers a token.
    """
    if body.platform not in ("ios", "android"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="platform must be 'ios' or 'android'",
        )

    DeviceToken = _get_device_token_model()

    # Upsert — update if exists, insert if not
    existing = db.query(DeviceToken).filter(
        DeviceToken.patient_id == body.patient_id
    ).first()

    if existing:
        existing.fcm_token = body.fcm_token
        existing.platform = body.platform
        existing.updated_at = datetime.utcnow()
    else:
        token_record = DeviceToken(
            patient_id=body.patient_id,
            fcm_token=body.fcm_token,
            platform=body.platform,
        )
        db.add(token_record)

    db.commit()
    logger.info(f"FCM token registered for patient {body.patient_id} ({body.platform})")

    return {"success": True, "message": "Token registered"}


@router.post("/send-push")
async def send_push(
    body: SendPushRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Internal endpoint — send a push notification to a patient.
    Called by other services (healthcare-core, ai-service) via internal HTTP.
    Does NOT require patient JWT — restrict at network level (Cloud Run VPC or API key).
    """
    # Optional: validate an internal service API key
    internal_key = request.headers.get("X-Internal-Key")
    expected_key = os.environ.get("INTERNAL_SERVICE_KEY")
    if expected_key and internal_key != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal key")

    DeviceToken = _get_device_token_model()
    token_record = db.query(DeviceToken).filter(
        DeviceToken.patient_id == body.patient_id
    ).first()

    if not token_record:
        logger.warning(f"No FCM token found for patient {body.patient_id}")
        return {
            "success": False,
            "message": f"No device token registered for patient {body.patient_id}",
        }

    try:
        _get_fcm_app()
        from firebase_admin import messaging

        message = messaging.Message(
            notification=messaging.Notification(
                title=body.title,
                body=body.body,
            ),
            data={k: str(v) for k, v in (body.data or {}).items()},
            token=token_record.fcm_token,
            android=messaging.AndroidConfig(priority="high"),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default", badge=1)
                )
            ),
        )

        fcm_response = messaging.send(message)
        logger.info(f"Push sent to patient {body.patient_id}: {fcm_response}")

        return {
            "success": True,
            "message": "Push notification sent",
            "fcm_message_id": fcm_response,
            "patient_id": body.patient_id,
        }

    except Exception as e:
        logger.error(f"FCM send failed for patient {body.patient_id}: {e}")
        # Report to Sentry if configured
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return {
            "success": False,
            "message": f"Failed to send push: {str(e)}",
            "patient_id": body.patient_id,
        }


# ─────────────────────────────────────────────────────────────
# SENTRY INIT — add this to main.py (not here)
# ─────────────────────────────────────────────────────────────
SENTRY_INIT_SNIPPET = '''
# ADD TO TOP OF backend/notification-service/app/main.py:

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    integrations=[FastApiIntegration(), SqlalchemyIntegration()],
    traces_sample_rate=0.2,
    environment=os.environ.get("ENVIRONMENT", "development"),
    send_default_pii=False,   # IMPORTANT: never send PII to Sentry in healthcare app
)
'''
