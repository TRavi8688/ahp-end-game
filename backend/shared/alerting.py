"""
shared/alerting.py

Sentry error tracking + PagerDuty alerting.
Moved from backend/app/core/alerting.py with fixed imports (removed
`from backend.app.core.logging_config import get_logger` — uses stdlib).

PLACE AT: backend/shared/alerting.py
Call configure_sentry(settings) in every service's lifespan startup.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def configure_sentry(settings) -> None:
    """
    Initialize Sentry SDK with PHI scrubbing and full integrations.
    Call once at startup. No-op if SENTRY_DSN is not set.
    """
    dsn = getattr(settings, "SENTRY_DSN", None) or os.environ.get("SENTRY_DSN")
    if not dsn:
        logger.warning("SENTRY_DSN not set — error tracking disabled")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.redis import RedisIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        environment = getattr(settings, "ENVIRONMENT", "production")
        sample_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))

        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            traces_sample_rate=sample_rate,
            sample_rate=1.0,
            release=os.getenv("GITHUB_SHA", "local"),
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                RedisIntegration(),
                LoggingIntegration(
                    level=logging.ERROR,
                    event_level=logging.CRITICAL,
                ),
            ],
            before_send=_strip_phi_from_sentry_event,
            send_default_pii=False,
        )
        logger.info("Sentry configured: env=%s sample_rate=%s", environment, sample_rate)

    except ImportError:
        logger.error("sentry-sdk not installed. Run: pip install sentry-sdk[fastapi]")


def _strip_phi_from_sentry_event(event: dict, hint: dict) -> Optional[dict]:
    """Before-send hook: removes PHI fields from Sentry events (DPDP compliance)."""
    PHI_FIELDS = {
        "name", "phone", "email", "address", "dob", "date_of_birth",
        "diagnosis", "prescription", "lab_result", "insurance_number",
        "aadhaar", "pan", "password", "otp", "token",
    }

    def _scrub(obj):
        if isinstance(obj, dict):
            return {
                k: "[Filtered]" if k.lower() in PHI_FIELDS else _scrub(v)
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [_scrub(item) for item in obj]
        return obj

    return _scrub(event)


# ── PagerDuty alerting ────────────────────────────────────────────────────────

class AlertManager:
    """Sends P0/P1/P2 alerts via PagerDuty Events API v2."""

    PRIORITY_ROUTING_KEYS = {
        "P0": os.environ.get("PAGERDUTY_P0_KEY", ""),
        "P1": os.environ.get("PAGERDUTY_P1_KEY", ""),
        "P2": os.environ.get("PAGERDUTY_P2_KEY", ""),
    }

    async def trigger(
        self,
        summary: str,
        severity: str = "P1",
        component: str = "hospyn-backend",
        details: Optional[dict] = None,
    ) -> bool:
        routing_key = self.PRIORITY_ROUTING_KEYS.get(severity)
        if not routing_key:
            logger.warning("PagerDuty not configured for severity=%s", severity)
            return False

        try:
            import httpx
            payload = {
                "routing_key": routing_key,
                "event_action": "trigger",
                "payload": {
                    "summary": f"[{severity}] Hospyn: {summary}",
                    "severity": "critical" if severity == "P0" else "error",
                    "source": component,
                    "component": component,
                    "group": "hospyn-backend",
                    "class": "healthcare-platform",
                    "custom_details": details or {},
                },
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    "https://events.pagerduty.com/v2/enqueue", json=payload
                )
                if response.status_code == 202:
                    logger.info("PagerDuty alert sent: severity=%s summary=%s", severity, summary)
                    return True
                logger.error("PagerDuty alert failed: status=%d", response.status_code)
                return False
        except Exception as e:
            logger.error("PagerDuty alert exception: %s", e)
            return False


alert_manager = AlertManager()


async def alert_database_down(error: str) -> None:
    await alert_manager.trigger(
        summary=f"Database unreachable: {error}",
        severity="P0",
        component="postgresql",
        details={"error": error, "impact": "All hospital workflows blocked"},
    )


async def alert_redis_down(error: str) -> None:
    await alert_manager.trigger(
        summary=f"Redis unreachable: {error}",
        severity="P1",
        component="redis",
        details={"error": error, "impact": "OTP and session caching unavailable"},
    )


async def alert_encryption_key_missing() -> None:
    await alert_manager.trigger(
        summary="APP_ENCRYPTION_KEY / ENCRYPTION_KEY not set — PHI may be stored unencrypted",
        severity="P0",
        component="encryption",
        details={"impact": "CRITICAL: Patient data security compromised"},
    )
