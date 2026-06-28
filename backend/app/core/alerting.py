"""
alerting.py -- Sentry error tracking + PagerDuty alerting configuration.
Phase 12 Fix: "No alerting rules configured -- outages go undetected."

Place at: backend/app/core/alerting.py
Call configure_sentry() in main.py lifespan startup.
"""
import os
import logging
from typing import Optional

from backend.app.core.logging_config import get_logger

logger = get_logger(__name__)


def configure_sentry() -> None:
    """
    Initialize Sentry SDK for error tracking and P0/P1 alerting.
    Phase 12 Fix: sentry-sdk[fastapi] was in pyproject.toml but never wired up.

    Required env vars:
        SENTRY_DSN         -- from Sentry project settings
        SENTRY_ENVIRONMENT -- production / staging / development
        SENTRY_TRACES_SAMPLE_RATE -- 0.1 for prod (10% of requests traced)
    """
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        logger.warning(
            "sentry_not_configured",
            hint="Set SENTRY_DSN env var to enable error tracking",
        )
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.redis import RedisIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        environment = os.environ.get("SENTRY_ENVIRONMENT", "production")
        sample_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))

        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            traces_sample_rate=sample_rate,
            # Send 100% of errors (not just sampled traces)
            sample_rate=1.0,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                RedisIntegration(),
                LoggingIntegration(
                    level=logging.ERROR,        # Capture ERROR and above
                    event_level=logging.CRITICAL,  # Send CRITICAL as Sentry events
                ),
            ],
            # CRITICAL: Strip PHI from Sentry payloads
            before_send=_strip_phi_from_sentry_event,
            # Don't send user IPs (DPDP compliance)
            send_default_pii=False,
        )
        logger.info("sentry_configured", environment=environment)

    except ImportError:
        logger.error(
            "sentry_sdk_not_installed",
            hint="pip install sentry-sdk[fastapi]",
        )


def _strip_phi_from_sentry_event(event: dict, hint: dict) -> Optional[dict]:
    """
    Before-send hook: removes PHI fields from Sentry events.
    Ensures patient data never reaches Sentry's servers (DPDP compliance).
    """
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
        elif isinstance(obj, list):
            return [_scrub(item) for item in obj]
        return obj

    return _scrub(event)


# --- PagerDuty alerting -------------------------------------------------------

class AlertManager:
    """
    Phase 12 Fix: "No PagerDuty configuration -- if DB crashes at 2AM, no one is paged."
    Sends P0/P1 alerts via PagerDuty Events API v2.
    """

    PRIORITY_ROUTING_KEYS = {
        "P0": os.environ.get("PAGERDUTY_P0_KEY", ""),   # 15-min response SLA
        "P1": os.environ.get("PAGERDUTY_P1_KEY", ""),   # 1-hour response SLA
        "P2": os.environ.get("PAGERDUTY_P2_KEY", ""),   # Best effort
    }

    async def trigger(
        self,
        summary: str,
        severity: str = "P1",
        component: str = "hospyn-backend",
        details: Optional[dict] = None,
    ) -> bool:
        """
        Trigger a PagerDuty alert.

        Args:
            summary: Human-readable alert summary
            severity: "P0" (critical), "P1" (high), "P2" (medium)
            component: Affected component name
            details: Additional context dict

        Returns:
            True if alert was sent successfully
        """
        routing_key = self.PRIORITY_ROUTING_KEYS.get(severity)
        if not routing_key:
            logger.warning("pagerduty_not_configured", severity=severity)
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
                    "https://events.pagerduty.com/v2/enqueue",
                    json=payload,
                )
                if response.status_code == 202:
                    logger.info("pagerduty_alert_sent", severity=severity, summary=summary)
                    return True
                else:
                    logger.error("pagerduty_alert_failed",
                                 status=response.status_code,
                                 body=response.text)
                    return False

        except Exception as e:
            logger.error("pagerduty_alert_exception", error=str(e))
            return False

    async def resolve(self, dedup_key: str) -> bool:
        """Resolve an existing PagerDuty incident when the issue is fixed."""
        routing_key = self.PRIORITY_ROUTING_KEYS.get("P1")
        if not routing_key:
            return False

        try:
            import httpx
            payload = {
                "routing_key": routing_key,
                "dedup_key": dedup_key,
                "event_action": "resolve",
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://events.pagerduty.com/v2/enqueue",
                    json=payload,
                )
                return response.status_code == 202
        except Exception as e:
            logger.error("pagerduty_resolve_failed", error=str(e))
            return False


# Global alert manager instance
alert_manager = AlertManager()


# --- Pre-defined P0 alert triggers --------------------------------------------

async def alert_database_down(error: str) -> None:
    """P0: Database unreachable -- hospital workflows completely blocked."""
    await alert_manager.trigger(
        summary=f"Database unreachable: {error}",
        severity="P0",
        component="postgresql",
        details={"error": error, "impact": "All hospital workflows blocked"},
    )


async def alert_encryption_key_missing() -> None:
    """P0: Encryption key missing -- PHI at risk."""
    await alert_manager.trigger(
        summary="APP_ENCRYPTION_KEY / ENCRYPTION_KEY not set -- PHI may be stored unencrypted",
        severity="P0",
        component="encryption",
        details={"impact": "CRITICAL: Patient data security compromised"},
    )


async def alert_redis_down(error: str) -> None:
    """P1: Redis down -- OTP and session management broken."""
    await alert_manager.trigger(
        summary=f"Redis unreachable: {error}",
        severity="P1",
        component="redis",
        details={"error": error, "impact": "OTP verification and session caching unavailable"},
    )


async def alert_high_error_rate(endpoint: str, error_rate: float) -> None:
    """P1: API error rate spike."""
    await alert_manager.trigger(
        summary=f"High error rate on {endpoint}: {error_rate:.1%}",
        severity="P1",
        component="api",
        details={"endpoint": endpoint, "error_rate": error_rate},
    )
