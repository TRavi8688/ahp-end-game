import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from app.services.ai_service import AsyncAIService, MedicalEntities

@pytest.fixture
def ai_service():
    return AsyncAIService()

@pytest.mark.asyncio
async def test_extract_medical_entities_success(ai_service):
    """Test successful extraction of medical entities from text."""
    mock_response = {
        "conditions": [{"name": "Hypertension"}],
        "medications": [{"name": "Amlodipine"}],
        "lab_results": [{"test": "BP", "value": "140/90"}]
    }
    
    with patch.object(ai_service, 'unified_ai_engine', new_callable=AsyncMock) as mock_engine:
        mock_engine.return_value = {
            "success": True,
            "response": '{"conditions": [{"name": "Hypertension"}], "medications": [{"name": "Amlodipine"}], "lab_results": [{"test": "BP", "value": "140/90"}]}'
        }
        
        entities = await ai_service.extract_medical_entities("Patient has hypertension and takes amlodipine.")
        
        assert isinstance(entities, MedicalEntities)
        assert len(entities.conditions) == 1
        assert entities.conditions[0]["name"] == "Hypertension"
        assert entities.medications[0]["name"] == "Amlodipine"

@pytest.mark.asyncio
async def test_ai_service_fallback(ai_service):
    """Test that the engine falls back from Groq to Gemini on error."""
    with patch.object(ai_service, '_call_groq', new_callable=AsyncMock) as mock_groq, \
         patch.object(ai_service, '_call_gemini', new_callable=AsyncMock) as mock_gemini:
        
        # Groq fails with an error string or empty
        mock_groq.return_value = ""
        # Gemini succeeds
        mock_gemini.return_value = "Gemini response"
        
        result = await ai_service.unified_ai_engine("Test prompt")
        
        assert result["success"] is True
        assert "Gemini response" in result["response"]
        assert mock_groq.called
        assert mock_gemini.called

@pytest.mark.asyncio
async def test_encryption_decryption():
    """Test data privacy layer."""
    from app.services.ai_service import encrypt_data, decrypt_data
    
    original_text = "Sensitive Patient Data"
    encrypted = encrypt_data(original_text)
    
    assert encrypted != original_text
    
    decrypted = decrypt_data(encrypted)
    assert decrypted == original_text
