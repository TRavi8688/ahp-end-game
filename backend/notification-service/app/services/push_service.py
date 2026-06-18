import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


async def send_push(
    fcm_token: str,
    title: str,
    body: str,
    data: Optional[dict[str, Any]] = None,
) -> bool:
    """
    Send a push notification via Firebase Cloud Messaging.

    TODO (Phase 2): Implement FCM delivery.
    Steps:
      1. Add firebase-admin to requirements.txt
      2. Add FIREBASE_SERVICE_ACCOUNT_JSON to settings
      3. Initialize firebase_admin.initialize_app() on startup
      4. Call messaging.send(messaging.Message(...))
      5. Handle messaging.UnregisteredError to remove stale tokens

    For now this stub logs the intent and returns True so downstream
    callers are not broken during Phase 1 development.
    """
    logger.info(
        f"[FCM STUB] Push notification — token={fcm_token[:8]}... "
        f"title='{title}' body='{body[:50]}'"
    )
    return True
