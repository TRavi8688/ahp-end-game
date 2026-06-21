import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from app.services.ai_service import AsyncAIService, AIServiceError, AIRateLimitError

@pytest.fixture
def ai_service():
    return AsyncAIService()

@pytest.mark.asyncio
async def test_ai_fallback_chain(ai_service):
    """Verify that the engine falls back from Groq to Gemini on rate limits."""
    with patch.object(ai_service, '_call_groq', new_callable=AsyncMock) as mock_groq, \
         patch.object(ai_service, '_call_gemini', new_callable=AsyncMock) as mock_gemini:
        
        # Groq is rate limited
        mock_groq.side_effect = AIRateLimitError("Rate limit")
        # Gemini provides the result
        mock_gemini.return_value = "Reliable Medical Summary"
        
        result = await ai_service.unified_ai_engine("Summarize this document")
        
        assert result["success"] is True
        assert "Reliable Medical Summary" in result["response"]
        assert mock_groq.call_count == 1
        assert mock_gemini.call_count == 1

@pytest.mark.asyncio
async def test_ai_total_failure(ai_service):
    """Verify system behavior when all AI providers are unavailable."""
    with patch.object(ai_service, '_call_groq', new_callable=AsyncMock) as mock_groq, \
         patch.object(ai_service, '_call_gemini', new_callable=AsyncMock) as mock_gemini:
        
        mock_groq.return_value = ""
        mock_gemini.return_value = "ERROR"
        
        result = await ai_service.unified_ai_engine("Test")
        assert result["success"] is False
        assert result["error"] == "ALL_PROVIDERS_FAILED"
        assert "CLINICAL SAFE MODE" in result["response"]
