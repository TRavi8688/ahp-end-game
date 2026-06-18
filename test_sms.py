"""
backend/notification-service/tests/test_sms.py

Tests for the OTP / SMS notification endpoints.
Covers: happy path, validation, rate limiting, and internal-secret enforcement.
"""
import os
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

INTERNAL_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "test-internal-secret")


class TestOtpSms:
    """Core OTP send endpoint — POST /api/v1/notifications/otp"""

    @pytest.mark.asyncio
    async def test_send_otp_sms_success(
        self, client: AsyncClient, mock_twilio, mock_redis
    ):
        """
        Valid request with correct internal secret → 200, Twilio called exactly once.
        """
        resp = await client.post(
            "/api/v1/notifications/otp",
            json={"phone_number": "+919300000001", "otp": "482917"},
            headers={"X-Internal-Secret": INTERNAL_SECRET},
        )
        assert resp.status_code == 200, (
            f"Expected 200, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data.get("status") in ("queued", "sent", "success"), (
            f"Unexpected status in response: {data}"
        )
        # Twilio create() must have been called exactly once
        mock_twilio.assert_called_once()
        call_kwargs = mock_twilio.call_args
        # Verify the phone number was forwarded correctly
        to_number = (
            call_kwargs.kwargs.get("to")
            or (call_kwargs.args[0] if call_kwargs.args else None)
        )
        assert to_number == "+919300000001", (
            f"Twilio called with wrong 'to' number: {to_number}"
        )

    @pytest.mark.asyncio
    async def test_send_otp_invalid_phone(self, client: AsyncClient):
        """
        Malformed phone number → 422 Unprocessable Entity.
        The service must validate phone format before touching Twilio.
        """
        invalid_phones = [
            "not-a-phone",
            "12345",
            "++919300000001",
            "919300000001",   # missing leading +
        ]
        for phone in invalid_phones:
            resp = await client.post(
                "/api/v1/notifications/otp",
                json={"phone_number": phone, "otp": "123456"},
                headers={"X-Internal-Secret": INTERNAL_SECRET},
            )
            assert resp.status_code == 422, (
                f"Invalid phone '{phone}' should return 422, got {resp.status_code}"
            )

    @pytest.mark.asyncio
    async def test_sms_rate_limit_per_phone(
        self, client: AsyncClient, mock_twilio, mock_redis
    ):
        """
        Send 6 OTP requests to the same phone within the rate-limit window.
        The 6th request must return 429 Too Many Requests.
        """
        phone = "+919300000002"
        limit = 5  # match your NOTIFICATION_OTP_RATE_LIMIT setting
        responses = []

        for i in range(limit + 1):
            # The mock_redis fixture's fake_incr auto-increments per key
            resp = await client.post(
                "/api/v1/notifications/otp",
                json={"phone_number": phone, "otp": str(100000 + i)},
                headers={"X-Internal-Secret": INTERNAL_SECRET},
            )
            responses.append(resp.status_code)

        assert all(s == 200 for s in responses[:limit]), (
            f"First {limit} requests should succeed: {responses[:limit]}"
        )
        assert responses[limit] == 429, (
            f"Request {limit + 1} should be rate-limited (429), "
            f"got {responses[limit]}"
        )

    @pytest.mark.asyncio
    async def test_internal_secret_required(self, client: AsyncClient):
        """
        Requests without X-Internal-Secret header → 401.
        The notification service is internal-only and must not be publicly accessible.
        """
        resp = await client.post(
            "/api/v1/notifications/otp",
            json={"phone_number": "+919300000003", "otp": "999999"},
            # No X-Internal-Secret header
        )
        assert resp.status_code == 401, (
            f"Missing internal secret should return 401, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_internal_secret_wrong_value_rejected(self, client: AsyncClient):
        """Wrong internal secret → 401 (not 403, so we don't leak whether the endpoint exists)."""
        resp = await client.post(
            "/api/v1/notifications/otp",
            json={"phone_number": "+919300000004", "otp": "111111"},
            headers={"X-Internal-Secret": "definitely-wrong-secret"},
        )
        assert resp.status_code == 401, (
            f"Wrong internal secret should return 401, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_twilio_failure_returns_503(
        self, client: AsyncClient, mock_redis
    ):
        """
        When Twilio raises an exception, the endpoint should return 503
        rather than leaking a 500 / internal stack trace.
        """
        from twilio.base.exceptions import TwilioRestException

        with patch("app.services.twilio_client.messages.create") as mock_create:
            mock_create.side_effect = TwilioRestException(
                status=500, uri="/Messages", msg="Twilio is down"
            )
            resp = await client.post(
                "/api/v1/notifications/otp",
                json={"phone_number": "+919300000005", "otp": "123456"},
                headers={"X-Internal-Secret": INTERNAL_SECRET},
            )

        assert resp.status_code == 503, (
            f"Twilio failure should return 503, got {resp.status_code}"
        )
        # Must NOT expose internal error details
        assert "stack" not in resp.text.lower()
        assert "traceback" not in resp.text.lower()
