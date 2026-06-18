"""
Smoke tests for the Gemini AI integration.

Run with:
    pytest backend/ai-service/tests/test_ai_integration.py -v
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── helpers ────────────────────────────────────────────────────────────────

SAMPLE_NOTE = "Patient presents with fever 38.5 °C, productive cough, and dyspnea."
SAMPLE_CONTEXT = {"note_type": "clinical note", "specialty": "general medicine"}

VALID_GEMINI_RESPONSE = json.dumps(
    {
        "summary": "Patient presents with febrile illness, productive cough, and breathing difficulty.",
        "key_findings": ["fever 38.5°C", "productive cough", "dyspnea"],
        "action_items": ["order chest X-ray", "prescribe antipyretics"],
        "confidence": 0.9,
    }
)


# ── tests ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_ai_summary_fallback_when_no_key():
    """When GEMINI_API_KEY is not set, should return fallback dict — not raise."""
    with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
        # Force settings cache to reload with the patched env
        from app.config import settings as settings_module

        settings_module.get_settings.cache_clear()

        from app.main import _generate_ai_summary

        result = await _generate_ai_summary(SAMPLE_NOTE, SAMPLE_CONTEXT)

        assert result["fallback"] is True
        assert "summary" in result
        assert isinstance(result["key_findings"], list)
        assert isinstance(result["action_items"], list)


@pytest.mark.asyncio
async def test_generate_ai_summary_structure():
    """Mock Gemini call — verify output structure and types."""
    mock_response = MagicMock()
    mock_response.text = VALID_GEMINI_RESPONSE

    with patch("google.generativeai.GenerativeModel.generate_content", return_value=mock_response):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "test_key_abc123"}):
            from app.config import settings as settings_module

            settings_module.get_settings.cache_clear()

            from app.main import _generate_ai_summary

            result = await _generate_ai_summary(SAMPLE_NOTE, SAMPLE_CONTEXT)

            assert "summary" in result
            assert isinstance(result["summary"], str)
            assert isinstance(result["key_findings"], list)
            assert isinstance(result["action_items"], list)
            assert 0.0 <= result["confidence"] <= 1.0
            assert result.get("fallback") is False


@pytest.mark.asyncio
async def test_generate_ai_summary_handles_json_decode_error():
    """When Gemini returns non-JSON, should return fallback — not raise."""
    mock_response = MagicMock()
    mock_response.text = "Sorry, I cannot summarize this note."  # plain text, not JSON

    with patch("google.generativeai.GenerativeModel.generate_content", return_value=mock_response):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "test_key_abc123"}):
            from app.config import settings as settings_module

            settings_module.get_settings.cache_clear()

            from app.main import _generate_ai_summary

            result = await _generate_ai_summary(SAMPLE_NOTE, SAMPLE_CONTEXT)

            assert result["fallback"] is True
            assert "fallback_reason" in result


@pytest.mark.asyncio
async def test_generate_ai_summary_strips_markdown_fences():
    """Gemini sometimes wraps JSON in ```json ... ``` — should be stripped."""
    fenced = f"```json\n{VALID_GEMINI_RESPONSE}\n```"
    mock_response = MagicMock()
    mock_response.text = fenced

    with patch("google.generativeai.GenerativeModel.generate_content", return_value=mock_response):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "test_key_abc123"}):
            from app.config import settings as settings_module

            settings_module.get_settings.cache_clear()

            from app.main import _generate_ai_summary

            result = await _generate_ai_summary(SAMPLE_NOTE, SAMPLE_CONTEXT)

            assert result.get("fallback") is False
            assert result["summary"]


@pytest.mark.asyncio
async def test_generate_ai_summary_handles_api_exception():
    """When Gemini API raises an exception, should return fallback — not propagate."""
    with patch(
        "google.generativeai.GenerativeModel.generate_content",
        side_effect=Exception("Network timeout"),
    ):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "test_key_abc123"}):
            from app.config import settings as settings_module

            settings_module.get_settings.cache_clear()

            from app.main import _generate_ai_summary

            result = await _generate_ai_summary(SAMPLE_NOTE, SAMPLE_CONTEXT)

            assert result["fallback"] is True
            assert "Network timeout" in result.get("fallback_reason", "")
