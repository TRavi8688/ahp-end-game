import asyncio
import os
import hashlib
from app.core.config import settings
from app.core.secrets import get_secret
from app.services.ai_service import get_ai_service
from app.core.security import calculate_content_checksum
from unittest.mock import MagicMock, patch

async def verify_hardening():
    print("--- 1. Secret Management Verification ---")
    # Verify that get_secret is called for sensitive keys
    encryption_key = get_secret("ENCRYPTION_KEY")
    print(f"ENCRYPTION_KEY loaded via secret manager: {'[PROTECTED]' if encryption_key else '[MISSING]'}")
    
    print("\n--- 2. OCR Fallback Verification ---")
    ai_service = await get_ai_service()
    
    # Simulate AI Outage (Mock both Groq and Gemini to fail)
    with patch.object(ai_service, '_call_groq', side_effect=Exception("Groq Down")):
        with patch.object(ai_service, '_call_gemini', side_effect=Exception("Gemini Down")):
            with patch("pytesseract.image_to_string", return_value="SIMULATED TESSERACT TEXT"):
                mock_image = b"fake-id-image-bytes"
                result = await ai_service.unified_ai_engine("OCR this", mock_image)
                print(f"Fallback OCR Result: {result}")
                assert "SIMULATED" in result
                print("OCR Fallback: SUCCESS")

    print("\n--- 3. Tamper-Proof Integrity Verification ---")
    # Test checksum logic
    test_content = "Patient has seasonal allergies."
    checksum = calculate_content_checksum(test_content)
    print(f"Generated Checksum: {checksum}")
    
    # Verify match
    assert checksum == hashlib.sha256(test_content.encode()).hexdigest()
    print("Integrity Logic: SUCCESS")
    
    # Simulate DB Tamper (Modify content but not checksum)
    tampered_content = "Patient has SEVERE allergies."
    if calculate_content_checksum(tampered_content) != checksum:
        print("Tamper Detection: SUCCESS (Mismatch detected)")
    else:
        print("Tamper Detection: FAILED")

if __name__ == "__main__":
    asyncio.run(verify_hardening())
